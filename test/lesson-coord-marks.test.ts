// 좌표평면 표시 객체: 세로선(요청 77·131 — 유리함수 세로 점근선·구간 끝 표시)과 직각 표시(요청 56).
// 세로선은 예전에는 곡선으로 그릴 수 없었고(x 가 하나인 '곡선'은 없다), 선분으로 그리면 점선(점근선)도 점을 따라가기도
// 안 됐다. 직각 표시는 손으로 그은 꼼수 선분 둘이 아니라 꼭짓점의 두 변을 따라 작은 꺾쇠를 그리고, 정말 직각일 때만 보인다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordState,
  coordChecks,
  coordDef,
  draw,
  frame,
  type Item,
  initial,
  parseCoord,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 298, h: 200 };

const base = (objects: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: -4, max: 4, step: 1 },
  y: { min: -4, max: 4, step: 1 },
  sliders: [{ id: 'a', min: -3, max: 3, step: 1, value: 1, label: '$a$' }],
  objects,
  ...over,
});

const vlines = (p: ReturnType<typeof parseCoord>, s: CoordState) =>
  draw(p, s, BOX).items.filter(
    (it): it is Extract<Item, { t: 'line' }> => it.t === 'line' && it.cls.startsWith('vline'),
  );
const marks = (p: ReturnType<typeof parseCoord>, s: CoordState) =>
  draw(p, s, BOX).items.filter(
    (it): it is Extract<Item, { t: 'path' }> => it.t === 'path' && it.cls === 'rmark',
  );
const withA = (p: ReturnType<typeof parseCoord>, a: number): CoordState => ({
  ...initial(p),
  vars: { a },
});

// ---- 세로선 ----

test('세로선: 수·슬라이더·점의 x 자리에 그림 위 끝에서 아래 끝까지, 점선·색', () => {
  const p = parseCoord(
    base([
      { id: 'f', curve: '1/(x-a)' },
      { vline: 'a', dash: true, tone: 'soft', label: '점근선 $x=a$' },
      { vline: 2 },
      { id: 'P', point: { x: -2, y: 1, drag: 'xy' }, name: 'P' },
      { vline: 'x(P)', tone: 'accent' },
    ]),
  );
  const f = frame(BOX, p);
  const s = withA(p, -1);
  const ls = vlines(p, s);
  assert.deepEqual(
    ls.map((l) => l.cls),
    ['vline soft dash', 'vline main', 'vline accent'],
  );
  for (const [l, x] of [
    [ls[0], -1],
    [ls[1], 2],
    [ls[2], -2],
  ] as const) {
    const [X] = toPx(p, f, x, 0);
    assert.ok(l && !l.hidden);
    assert.ok(Math.abs(l.x1 - X) < 0.1 && Math.abs(l.x2 - X) < 0.1);
    assert.ok(Math.abs(l.y1 - f.t) < 0.1 && Math.abs(l.y2 - f.b) < 0.1);
  }
  // 범례 글
  assert.ok(coordDef.texts?.(p).includes('점근선 $x=a$'));
});

test('세로선: 슬라이더·점을 바꿔도 그릴 목록 key 가 같다(끄는 동안 렌더 0회의 바탕)', () => {
  const p = parseCoord(
    base([
      { vline: 'a', dash: true },
      { id: 'P', point: { x: -2, y: 1, drag: 'xy' } },
      { vline: 'x(P)+1' },
    ]),
  );
  const s2: CoordState = { ...withA(p, 3), pts: { P: { i: 4, j: 0 } } };
  assert.deepEqual(
    draw(p, withA(p, -3), BOX).items.map((it) => it.key),
    draw(p, s2, BOX).items.map((it) => it.key),
  );
  // 끄는 점을 따라오다 그림 밖(x=5)이면 숨김
  assert.equal(vlines(p, s2)[1]?.hidden, true);
});

test('세로선 형식 오류: 화면 끝·밖, 슬라이더 칸마다 화면 밖, x 를 쓴 식, 같은 세로선 두 번, 모르는 칸', () => {
  assert.throws(() => parseCoord(base([{ vline: 4 }])), /화면 끝/);
  assert.throws(() => parseCoord(base([{ vline: 7 }])), /화면 밖/);
  assert.throws(() => parseCoord(base([{ vline: 'a+2' }])), /화면 밖 x=5 — a=3/);
  assert.throws(() => parseCoord(base([{ vline: 'x' }])), /쓸 수 없는 변수 x/);
  assert.throws(() => parseCoord(base([{ vline: 1 }, { vline: '2/2' }])), /같은 세로선이 두 번/);
  assert.throws(
    () => parseCoord(base([{ vline: 'a' }, { vline: 'a', dash: true }])),
    /같은 세로선이 두 번/,
  );
  assert.throws(() => parseCoord(base([{ vline: 1, dash: 'yes' }])), /true 만/);
  assert.throws(() => parseCoord(base([{ vline: 1, width: 3 }])), /모르는 칸 width/);
});

test('세로선 검산: 슬라이더 식 자리는 칸마다 앱 = sympy(parity), 수는 항목 없음', () => {
  const p = parseCoord(base([{ vline: 'a/2+1' }, { vline: 0 }]));
  const cs = coordChecks(p).filter((c) => c.name.startsWith('세로선'));
  assert.deepEqual(
    cs.map((c) => c.name),
    ['세로선 x=a/2+1'],
  );
  const r = runChecks(coordChecks(p));
  assert.ok(r.ok, r.out);
});

// ---- 직각 표시 ----

test('직각 표시: 꼭짓점에서 두 변을 따라 작은 꺾쇠(9px) — 고정 점·좌표 끝', () => {
  const p = parseCoord(
    base([
      { id: 'A', point: { x: 0, y: 3 }, name: 'A' },
      { id: 'H', point: { x: 0, y: 0 }, name: 'H' },
      { segment: ['A', 'H'] },
      { segment: ['H', [3, 0]] },
      { right: ['A', 'H', [3, 0]] },
    ]),
  );
  const f = frame(BOX, p);
  const [m] = marks(p, initial(p));
  assert.ok(m);
  const [HX, HY] = toPx(p, f, 0, 0);
  // M(위쪽 9px) L(모서리) L(오른쪽 9px)
  const n = (m.d.match(/-?[\d.]+/g) ?? []).map(Number);
  const want = [HX, HY - 9, HX + 9, HY - 9, HX + 9, HY];
  assert.equal(n.length, 6);
  assert.ok(
    want.every((w, i) => Math.abs((n[i] ?? Number.NaN) - w) < 0.1),
    m.d,
  );
});

test('직각 표시: 끄는 점이면 직각일 때만 보이고, 아니면 빈 경로(항목·key 는 그대로)', () => {
  const p = parseCoord(
    base(
      [
        { id: 'O', point: { x: 0, y: 0 } },
        { id: 'A', point: { x: 2, y: 1 } },
        { id: 'P', point: { x: 1, y: 1, drag: 'xy' }, name: 'P' },
        { right: ['A', 'O', 'P'] },
      ],
      { equal: true },
    ),
  );
  const at = (i: number, j: number): CoordState => ({
    ...initial(p),
    pts: { ...initial(p).pts, P: { i, j } },
  });
  // OA=(2,1), OP=(−1,2) 이면 직각
  assert.notEqual(marks(p, at(-1, 2))[0]?.d, '');
  assert.equal(marks(p, at(1, 1))[0]?.d, '');
  assert.deepEqual(
    draw(p, at(-1, 2), BOX).items.map((it) => it.key),
    draw(p, at(1, 1), BOX).items.map((it) => it.key),
  );
});

test('직각 표시: 축척이 다르면 비스듬한 직각은 화면에서 비뚤어 보여 그리지 않는다(가로·세로 변은 그림)', () => {
  const raw = (equal: boolean) =>
    base(
      [
        { id: 'O', point: { x: 0, y: 0 } },
        { id: 'A', point: { x: 2, y: 1 } },
        { id: 'P', point: { x: -1, y: 2, drag: 'xy' } },
        { right: ['A', 'O', 'P'] },
      ],
      {
        x: { min: -4, max: 4, step: 1 },
        y: { min: -2, max: 4, step: 1 },
        ...(equal ? { equal: true } : {}),
      },
    );
  const p = parseCoord(raw(false));
  assert.equal(marks(p, initial(p))[0]?.d, '');
  const q = parseCoord(raw(true));
  assert.notEqual(marks(q, initial(q))[0]?.d, '');
});

test('직각 표시 형식 오류: 고정인데 직각이 아님·축척이 달라 비뚤게 보임·슬라이더 칸 어디서도 직각 아님·너무 짧은 변', () => {
  assert.throws(
    () =>
      parseCoord(
        base([
          {
            right: [
              [1, 1],
              [0, 0],
              [2, 0],
            ],
          },
        ]),
      ),
    /직각이 아님/,
  );
  assert.throws(
    () =>
      parseCoord(
        base([
          {
            right: [
              [2, 1],
              [0, 0],
              [-1, 2],
            ],
          },
        ]),
      ),
    /equal/,
  );
  assert.doesNotThrow(() =>
    parseCoord(
      base(
        [
          {
            right: [
              [2, 1],
              [0, 0],
              [-1, 2],
            ],
          },
        ],
        { equal: true },
      ),
    ),
  );
  // (a, 1)·(1, 0) 은 a=0 에서만 직각 — 한 칸이라도 직각이면 괜찮다
  assert.doesNotThrow(() =>
    parseCoord(
      base(
        [
          {
            right: [
              ['a', 1],
              [0, 0],
              [1, 0],
            ],
          },
        ],
        { equal: true },
      ),
    ),
  );
  assert.throws(
    () =>
      parseCoord(
        base(
          [
            {
              // 내적 a + 1/2 — 정수 a 에서는 0 이 안 된다
              right: [
                ['a', 1],
                [0, 0],
                [1, '1/2'],
              ],
            },
          ],
          { equal: true },
        ),
      ),
    /어느 슬라이더 칸에서도 직각이 아님/,
  );
  // 가장 좁은 화면에서 변이 짧으면 꺾쇠가 변보다 커진다
  assert.throws(
    () =>
      parseCoord(
        base(
          [
            {
              right: [
                [0, '1/10'],
                [0, 0],
                ['1/10', 0],
              ],
            },
          ],
          {
            x: { min: -40, max: 40, step: 2 },
            y: { min: -40, max: 40, step: 2 },
          },
        ),
      ),
    /짧/,
  );
  assert.throws(() => parseCoord(base([{ right: ['A', 'B'] }])), /3~3개/);
});

test('직각 표시 검산: 보이는 상태마다 두 변의 내적 = 0 (sympy), 망가뜨리면 실패', () => {
  const p = parseCoord(
    base([{ id: 'O', point: { x: 0, y: 0 } }, { right: [['a', 1], 'O', [1, '-a']] }], {
      equal: true,
    }),
  );
  const cs = coordChecks(p);
  const it = cs.find((c) => c.name.startsWith('직각'));
  assert.ok(it && 'kind' in it && it.kind === 'parity');
  assert.equal(it.name, '직각 (a,1)-O-(1,-a) 내적');
  assert.equal(it.points.length, 7);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  const bad = cs.map((c) => (c === it ? { ...it, expr: `${it.expr}+1` } : c));
  assert.equal(runChecks(bad).ok, false);
});
