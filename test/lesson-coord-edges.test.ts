// 좌표평면 1-다 검토에서 나온 가장자리 경우: 조각 경계의 한쪽 미분, 끝 표시가 안 보이는데 통과하던 형식,
// 손잡이에 가려지는 화살촉, 범위 제한을 모르던 옛 다가가기 목표, 구멍 앞에서 멈추던 방향키, 중복 선분 비교 등.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordState,
  coordDef,
  draw,
  frame,
  type Item,
  initial,
  keyMove,
  parseCoord,
  toPx,
} from '../src/lesson/widgets/coord.ts';

const BOX = { w: 298, h: 209 };
const deep = (raw: unknown) => coordDef.deep?.(parseCoord(raw));

const sides = (objects: unknown[], over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: 2, step: '1/4' },
  y: { min: 0, max: 4, step: '1/2' },
  objects,
  ...over,
});
const jump = {
  id: 'f',
  curve: [
    { y: 'x+1', x: '[0,1)' },
    { y: '4-x', x: '[1,2]' },
  ],
};

// ---- 조각 경계의 미분(검토 Major 1) ----

test('미분이 쓰이는 조각 곡선 위 점이 매끄럽지 않은 끝(끊긴 경계·정의역 끝)에 닿으면 형식 오류', () => {
  const pt = (range?: unknown[]) => ({
    id: 'P',
    point: { on: 'f', x: '1/2', drag: 'x', snap: '1/4', ...(range ? { range } : {}) },
  });
  assert.throws(
    () => deep(sides([jump, pt(), { tangent: { on: 'f', at: 'P' } }])),
    /매끄럽지 않은/,
  );
  // 정의역 끝(x=0, 화면 끝이어도 한쪽 미분)과 경계 x=1 을 range 로 빼면 통과
  assert.doesNotThrow(() =>
    deep(sides([jump, pt(['1/4', '3/4']), { tangent: { on: 'f', at: 'P' } }])),
  );
  // 미분을 안 쓰면(접선·deriv 없음) 경계에 놓여도 괜찮다
  assert.doesNotThrow(() => deep(sides([jump, pt(), { readout: 'y(P)', label: 'y' }])));
});

test('꺾인 점(값은 이어지고 미분이 다름)·한 점 조각도 매끄럽지 않은 끝, 매끄럽게 이어진 경계는 괜찮다', () => {
  const view = { x: { min: -2, max: 2, step: '1/2' }, y: { min: -1, max: 4, step: 1 } };
  const kink = {
    id: 'f',
    curve: [
      { y: '-x', x: '[-2,0]' },
      { y: 'x', x: '(0,2]' },
    ],
  };
  const P = { id: 'P', point: { on: 'f', x: 1, drag: 'x', range: [-1, 1] } };
  assert.throws(
    () => deep(sides([kink, P, { readout: 'deriv(f,P)', label: '기울기' }], view)),
    /x=0/,
  );
  const smooth = {
    id: 'f',
    curve: [
      { y: 'x**2', x: '[-2,0]' },
      { y: 'x**2', x: '(0,2]' },
    ],
  };
  assert.doesNotThrow(() =>
    deep(sides([smooth, P, { readout: 'deriv(f,P)', label: '기울기' }], view)),
  );
  const dot = {
    id: 'f',
    curve: [
      { y: 'x', x: '[-2,1)' },
      { y: '3', x: '[1,1]' },
      { y: 'x', x: '(1,2]' },
    ],
  };
  const A = { id: 'A', point: { on: 'f', x: 1 } };
  assert.throws(() => deep(sides([dot, A, { tangent: { on: 'f', at: 'A' } }], view)), /x=1/);
});

// ---- 끝 표시가 안 보이는데 통과하던 형식(검토 Major 3) ----

test('조각 끝 표시가 y 화면 밖·한 점 조각이 화면 끝·닫힌 끝 한 점만 걸침·같은 x 에서 세로로 붙음 → 형식 오류', () => {
  const one = (curve: unknown) => () => parseCoord(sides([{ id: 'f', curve }]));
  assert.throws(
    one([
      { y: 'x', x: '[0,1)' },
      { y: '30', x: '[1,1]' },
      { y: 'x', x: '(1,2]' },
    ]),
    /끝 표시.*화면 밖/,
  );
  assert.throws(
    one([
      { y: 'x', x: '[0,2)' },
      { y: '3', x: '[2,2]' },
    ]),
    /화면 끝/,
  );
  assert.throws(one([{ y: 'x', x: '[2,5]' }]), /화면 밖 조각/);
  assert.throws(
    one([
      { y: 'x+1', x: '[0,1)' },
      { y: 'x+21/20', x: '[1,2]' },
    ]),
    /세로/,
  );
});

// ---- 화살촉과 손잡이(검토 Major 2) ----

const tipOf = (it: Item | undefined) => {
  const m = it?.t === 'path' ? it.d.match(/^M(-?[\d.]+) (-?[\d.]+)/) : null;
  return (m ? [Number(m[1]), Number(m[2])] : [Number.NaN, Number.NaN]) as [number, number];
};

test('화살표 머리가 점이면 화살촉 끝을 점 가장자리까지 물린다 — 끄는 점은 손잡이(반지름 11.5px) 밖, 고정 점은 6px', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 6, step: 1 },
    y: { min: 0, max: 6, step: 1 },
    objects: [
      { id: 'O', point: { x: 0, y: 0 } },
      { id: 'A', point: { x: 4, y: 0 } },
      { id: 'P', point: { x: 3, y: 4, drag: 'xy' } },
      { arrow: ['O', 'P'] },
      { arrow: ['O', 'A'] },
    ],
  });
  const f = frame(BOX, p);
  const s: CoordState = initial(p);
  const heads = draw(p, s, BOX).items.filter((it) => it.t === 'path' && it.cls.startsWith('ahead'));
  const [PX, PY] = toPx(p, f, 3, 4);
  const [tx, ty] = tipOf(heads[0]);
  assert.ok(Math.hypot(tx - PX, ty - PY) >= 11.5 - 0.1, `${tx},${ty}`);
  // 손잡이 안쪽 원 밖에 화살촉이 남아 보인다(화살촉 밑변이 손잡이 밖)
  const [AX, AY] = toPx(p, f, 4, 0);
  const [ax, ay] = tipOf(heads[1]);
  assert.ok(Math.abs(Math.hypot(ax - AX, ay - AY) - 6) < 0.2);
});

test('가장 좁은 화면 화살표 길이 검사도 머리 점의 물림만큼 더 길어야', () => {
  const base = {
    mode: 'explore',
    x: { min: -20, max: 20, step: 1 },
    y: { min: -10, max: 10, step: 1 },
  };
  // (0,0)→(3,0) 은 가장 좁은 화면에서 18.75px: 좌표 끝이면 16px 이상이라 통과, 고정 점 끝이면 6px 물려 12.75px
  assert.doesNotThrow(() =>
    parseCoord({
      ...base,
      objects: [
        {
          arrow: [
            [0, 0],
            [3, 0],
          ],
        },
      ],
    }),
  );
  assert.throws(
    () =>
      parseCoord({
        ...base,
        objects: [{ id: 'A', point: { x: 3, y: 0 } }, { arrow: [[0, 0], 'A'] }],
      }),
    /좁은 화면/,
  );
});

// ---- 옛 다가가기 목표와 범위(검토 Major 4) ----

test('다가가기 목표: 끄는 범위 안에서 목표 점에 within 안으로 닿을 수 없으면 형식 오류', () => {
  const raw = (range: unknown[], within?: number) => ({
    mode: 'explore',
    x: { min: 0, max: 12, step: 1 },
    y: { min: 0, max: 9, step: 1 },
    objects: [
      { id: 's', curve: '3*x/4' },
      { id: 'O', point: { on: 's', x: 0 } },
      { id: 'P', point: { on: 's', x: 4, drag: 'x', snap: 1, range } },
    ],
    goal: { approach: ['P', 'O'], ...(within !== undefined ? { within } : {}) },
  });
  assert.throws(() => parseCoord(raw([1, 12])), /닿을 수 없음/);
  assert.doesNotThrow(() => parseCoord(raw([1, 12], 1)));
});

// ---- 방향키가 구멍 앞에서 멈춤(검토 Major 5) ----

test('방향키: 곡선이 정의 안 된 칸(구멍)은 같은 방향 다음 칸으로 건너뛰고, 끝이면 제자리', () => {
  const p = parseCoord(
    sides([
      {
        id: 'f',
        curve: [
          { y: 'x+1', x: '[0,1)' },
          { y: 'x+1', x: '(1,2]' },
        ],
      },
      { id: 'Q', point: { on: 'f', x: '3/4', drag: 'x', snap: '1/4' } },
    ]),
  );
  const at = (i: number): CoordState => ({ ...initial(p), pts: { Q: { i, j: 0 } } });
  assert.equal(keyMove(p, at(3), 'Q', 'ArrowRight')?.pts.Q?.i, 5);
  assert.equal(keyMove(p, at(5), 'Q', 'ArrowLeft')?.pts.Q?.i, 3);
  assert.equal(keyMove(p, at(8), 'Q', 'ArrowRight')?.pts.Q?.i, 8);
});

// ---- 작은 것들(검토 Minor) ----

test('끌 수 없는 곡선 위 점 끝도 자리를 계산해 화면 밖이면 형식 오류', () => {
  assert.throws(
    () =>
      parseCoord({
        mode: 'explore',
        x: { min: 0, max: 4, step: 1 },
        y: { min: 0, max: 4, step: 1 },
        objects: [
          { id: 'f', curve: '10*x' },
          { id: 'O', point: { x: 0, y: 0 } },
          { id: 'B', point: { on: 'f', x: 1 } },
          { segment: ['O', 'B'] },
        ],
      }),
    /화면 밖 끝 \(1, 10\)/,
  );
});

test('중복 선분은 좌표로 견준다: 방향 반대·같은 자리 다른 표기는 같은 선분, 화살표는 방향이 다르면 다른 것', () => {
  const raw = (extra: unknown[]) => ({
    mode: 'explore',
    x: { min: -1, max: 4, step: 1 },
    y: { min: -1, max: 4, step: 1 },
    objects: [{ id: 'O', point: { x: 0, y: 0 } }, { id: 'A', point: { x: 2, y: 1 } }, ...extra],
  });
  assert.throws(
    () => parseCoord(raw([{ segment: ['O', 'A'] }, { segment: ['A', 'O'] }])),
    /같은 선분이 두 번/,
  );
  assert.throws(
    () =>
      parseCoord(
        raw([
          { segment: ['O', 'A'] },
          {
            segment: [
              [0, 0],
              ['4/2', 1],
            ],
          },
        ]),
      ),
    /같은 선분이 두 번/,
  );
  assert.throws(
    () => parseCoord(raw([{ arrow: ['O', 'A'] }, { arrow: [[0, 0], 'A'] }])),
    /같은 화살표가 두 번/,
  );
  assert.doesNotThrow(() => parseCoord(raw([{ arrow: ['O', 'A'] }, { arrow: ['A', 'O'] }])));
});

test('끄는 범위 양 끝에서 곡선이 정의 안 되면 형식 오류', () => {
  assert.throws(
    () =>
      parseCoord({
        mode: 'explore',
        x: { min: 0, max: 4, step: 1 },
        y: { min: 0, max: 4, step: 1 },
        objects: [
          { id: 'f', curve: 'sqrt(x-1)' },
          { id: 'P', point: { on: 'f', x: 2, drag: 'x', range: [0, 3] } },
        ],
      }),
    /범위 끝 x=0 에서 곡선이 정의 안 됨/,
  );
});

test('테두리에 붙인 손잡이는 off 로 표시(흐리게) — 그림 안이면 off 아님', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1 },
    y: { min: 0, max: 4, step: 1 },
    objects: [
      { id: 'f', curve: '2*x' },
      { id: 'P', point: { on: 'f', x: 1, drag: 'x' } },
    ],
  });
  assert.equal(draw(p, initial(p), BOX).handles[0]?.off, false);
  const s: CoordState = { ...initial(p), pts: { P: { i: 3, j: 0 } } };
  assert.equal(draw(p, s, BOX).handles[0]?.off, true);
});
