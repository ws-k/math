// 좌표평면 계단 표시 {stair:['P','Q']}(요청 64 — 3-가): 두 점 사이 가로 변(P 에서 Q 의 x 까지)과 세로 변(그 끝에서 Q 까지),
// 꺾인 곳의 직각 꺾쇠, 두 변의 길이 글자(축 단위). 할선 기울기 = 세로 길이 ÷ 가로 길이를 그림에서 읽게 한다.
// 본보기: math2-diff-coefficient secant(자동차 s=t² — Q 를 P 쪽으로 끌면 계단이 작아지며 평균 빠르기가 모임).
// 단원 JSON 은 고치지 않는다(단원 적용은 3-나) — 이 파일의 시험 장면으로 확인한다.
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

const BOX = { w: 298, h: 209 };

const secantRaw = (stair: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: '7/2', step: '1/2', name: '시간', unit: '초' },
  y: { min: 0, max: 10, step: 1, name: '거리', unit: 'm' },
  objects: [
    { id: 'f', curve: 'x**2', label: '$s=t^2$' },
    { id: 'P', point: { on: 'f', x: 1 }, name: 'P' },
    { id: 'Q', point: { on: 'f', x: 3, drag: 'x', snap: '1/10' }, name: 'Q' },
    { secant: ['P', 'Q'] },
    { stair: ['P', 'Q'], ...stair },
    { readout: 'slope(P,Q)', label: 'P~Q 평균 빠르기' },
  ],
  ...over,
});

const atQ = (p: ReturnType<typeof parseCoord>, i: number): CoordState => {
  const s = initial(p);
  return { ...s, pts: { ...s.pts, Q: { i, j: 0 } } };
};
const its = (p: ReturnType<typeof parseCoord>, s: CoordState) => draw(p, s, BOX).items;
const one = (xs: Item[], key: string) => {
  const it = xs.find((x) => x.key === key);
  assert.ok(it, key);
  return it;
};
const nums = (d: string) => (d.match(/-?[\d.]+/g) ?? []).map(Number);

test('계단: P 에서 가로로 Q 의 x 까지, 거기서 세로로 Q 까지 — 꺾인 곳에 직각 꺾쇠', () => {
  const p = parseCoord(secantRaw());
  const f = frame(BOX, p);
  const xs = its(p, atQ(p, 30));
  const leg = one(xs, 'z4');
  assert.ok(leg.t === 'path');
  const [PX, PY] = toPx(p, f, 1, 1);
  const [CX, CY] = toPx(p, f, 3, 1);
  const [QX, QY] = toPx(p, f, 3, 9);
  const n = nums(leg.d);
  const want = [PX, PY, CX, CY, QX, QY];
  assert.equal(n.length, 6, leg.d);
  assert.ok(
    want.every((w, i) => Math.abs((n[i] ?? Number.NaN) - w) < 0.06),
    leg.d,
  );
  assert.equal(leg.cls, 'stair');
  const mark = one(xs, 'zq4');
  assert.ok(mark.t === 'path' && mark.d !== '' && mark.cls === 'rmark');
});

test('길이 글자: 가로 = |Δx| 와 가로 단위, 세로 = |Δy| 와 세로 단위 — Q 를 P 왼쪽으로 끌어도 길이(음수 아님)', () => {
  const p = parseCoord(secantRaw());
  const txt = (s: CoordState) =>
    ['zx4', 'zy4'].map((k) => {
      const it = one(its(p, s), k);
      assert.ok(it.t === 'label');
      return it.hidden ? null : it.text;
    });
  assert.deepEqual(txt(atQ(p, 30)), ['2 초', '8 m']);
  assert.deepEqual(txt(atQ(p, 15)), ['0.5 초', '1.25 m']);
  // Q 가 P 왼쪽(t=0.5): 가로 0.5, 세로 0.75 — 그림의 변 방향이 부호를 보인다
  assert.deepEqual(txt(atQ(p, 5)), ['0.5 초', '0.75 m']);
  // 소수 자리 digits(기본 2)
  const q = parseCoord(secantRaw({ digits: 1 }));
  const it = one(its(q, atQ(q, 11)), 'zy4');
  assert.ok(it.t === 'label');
  assert.equal(it.text, '0.2 m');
});

test('두 점이 겹치면 계단·꺾쇠·글자를 모두 숨기고, 세로 변이 0 이면 세로 변과 꺾쇠·세로 글자만 숨긴다', () => {
  const p = parseCoord(secantRaw());
  const xs = its(p, atQ(p, 10));
  const leg = one(xs, 'z4');
  assert.ok(leg.t === 'path' && leg.d === '');
  const m = one(xs, 'zq4');
  assert.ok(m.t === 'path' && m.d === '');
  for (const k of ['zx4', 'zy4']) {
    const it = one(xs, k);
    assert.ok(it.t === 'label' && it.hidden);
  }
  // 같은 높이 두 점(가로 선분 하나)
  const h = parseCoord({
    ...secantRaw(),
    objects: [
      { id: 'A', point: { x: 0, y: 2 }, name: 'A' },
      { id: 'B', point: { x: 2, y: 2, drag: 'xy' }, name: 'B' },
      { stair: ['A', 'B'] },
    ],
  });
  const ys = its(h, initial(h));
  const d = one(ys, 'z2');
  assert.ok(d.t === 'path' && nums(d.d).length === 4);
  const zq = one(ys, 'zq2');
  assert.ok(zq.t === 'path' && zq.d === '');
  const zy = one(ys, 'zy2');
  const zx = one(ys, 'zx2');
  assert.ok(zy.t === 'label' && zy.hidden && zx.t === 'label' && !zx.hidden);
});

test('끄는 동안 렌더 0회의 바탕: Q 를 옮겨도 key 가 같고 경로·글자만 바뀐다', () => {
  const p = parseCoord(secantRaw());
  const a = its(p, atQ(p, 30));
  const b = its(p, atQ(p, 12));
  assert.deepEqual(
    a.map((x) => x.key),
    b.map((x) => x.key),
  );
  const ta = one(a, 'zy4');
  const tb = one(b, 'zy4');
  assert.ok(ta.t === 'label' && tb.t === 'label' && ta.text !== tb.text);
});

test('글자는 그림 안: 변 바깥쪽에 두되 그림 끝을 넘으면 안쪽으로 당긴다', () => {
  const p = parseCoord(secantRaw());
  const f = frame(BOX, p);
  for (const i of [0, 5, 15, 30, 35]) {
    for (const k of ['zx4', 'zy4']) {
      const it = one(its(p, atQ(p, i)), k);
      assert.ok(it.t === 'label');
      if (it.hidden) continue;
      assert.ok(it.x >= f.l - 0.5 && it.y <= f.b + 0.5 && it.y - 10 >= f.t - 0.5, `${i} ${k}`);
    }
  }
});

test('형식 오류: 같은 점 두 번 · 늘 같은 두 점(겹친 고정 점) · 숨긴 점 · 모르는 칸 · 같은 계단 두 번', () => {
  assert.throws(() => parseCoord(secantRaw({ stair: ['P', 'P'] })), /같은 점/);
  assert.throws(() => parseCoord(secantRaw({ stair: ['P', 'Z'] })), /앞에 없는 점 Z/);
  assert.throws(() => parseCoord(secantRaw({ wide: 1 })), /모르는 칸 wide/);
  assert.throws(() => parseCoord(secantRaw({ digits: 7 })), /digits/);
  const fixed = {
    ...secantRaw(),
    objects: [
      { id: 'A', point: { x: 1, y: 2 } },
      { id: 'B', point: { x: 1, y: 5 } },
      { stair: ['A', 'B'] },
    ],
  };
  assert.throws(() => parseCoord(fixed), /가로 변이 늘 0/);
  const twice = {
    ...secantRaw(),
    objects: [...secantRaw().objects, { stair: ['Q', 'P'] }],
  };
  assert.throws(() => parseCoord(twice), /같은 계단이 두 번/);
  // 끄는 점에 기대면 닿는 자리 중 하나라도 보이면 된다(무거운 검사)
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(secantRaw())));
});

test('검산: 닿는 상태마다 가로·세로 길이 = sympy Abs(원문 식의 차)', () => {
  const p = parseCoord(secantRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('계단'));
  assert.deepEqual(
    cs.map((c) => c.name),
    ['계단 P-Q 가로', '계단 P-Q 세로'],
  );
  const v = cs[1] as { expr: string; points: unknown[] };
  // 곡선 식 x**2 가 그대로(앱이 구한 y 를 옮겨 적지 않음)
  assert.match(v.expr, /Abs\(.*x\*\*2/);
  assert.equal(v.points.length, 36);
  const r = runChecks(coordChecks(p));
  assert.ok(r.ok, r.out);
  // 앱 값을 비틀면 잡힌다
  const bad = cs.map((c) => ({
    ...c,
    values: (c as { values: number[] }).values.map((x, k) => (k === 3 ? x + 0.1 : x)),
  }));
  const r2 = runChecks(bad);
  assert.equal(r2.ok, false);
});
