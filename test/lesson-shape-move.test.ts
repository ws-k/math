// 도형판 3-다: 끄는 범위(range)·따라오는 점(follow — 모양 지키며 끌기)·마주 보는 점(mirror)·점 이름 F′.
// 끄는 점이 셋 이상이어도 범위를 좁히면 목표 판정 자리가 상한(2000) 안에 든다(요청 133).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type ShapeParams,
  shapeDef,
  shDrag,
  shDraw,
  shGoalHits,
  shInit,
  shKey,
  shMeasures,
  shUnit,
} from '../src/lesson/widgets/shape.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;
const full = (raw: unknown) => {
  const p = parse(raw);
  shapeDef.deep?.(p);
  return p;
};

// ---- 끄는 범위 ----

const triRaw = (range = true) => ({
  grid: { w: 10, h: 8 },
  points: [
    { id: 'A', x: 1, y: 1, drag: true, ...(range ? { range: { x: [0, 2], y: [0, 2] } } : {}) },
    { id: 'B', x: 7, y: 1, drag: true, ...(range ? { range: { x: [6, 8], y: [0, 2] } } : {}) },
    { id: 'C', x: 3, y: 6, drag: true, ...(range ? { range: { x: [2, 4], y: [5, 6] } } : {}) },
  ],
  polygons: [['A', 'B', 'C']],
  measures: [{ area: 0 }],
  digits: 1,
  goal: { value: { of: 0, is: 12 }, hint: '밑변과 높이를 생각해 보세요' },
});

test('범위: 자유 점은 range 안의 격자점으로만(끌기·방향키)', () => {
  const p = parse(triRaw());
  const s = shInit(p);
  const u = shUnit(p);
  assert.deepEqual(shDrag(p, s, 'A', u * 9, u * 9).pts.A, { x: 2, y: 0 });
  assert.deepEqual(shDrag(p, s, 'C', 0, u * -5).pts.C, { x: 3, y: 6 });
  const up = shKey(p, shDrag(p, s, 'C', 0, u * -5), 'C', 'ArrowUp');
  assert.deepEqual(up?.pts.C, { x: 3, y: 6 });
});

test('범위: 끄는 점 셋도 범위를 좁히면 판정 자리가 상한 안 — 검산 통과(요청 133)', () => {
  assert.throws(() => full(triRaw(false)), /너무 많음/);
  const p = full(triRaw());
  const goal = shapeDef.checks(p).find((c) => c.name === '목표 판정');
  assert.ok(goal && 'states' in goal && goal.states.length === 9 * 9 * 6);
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
});

test('범위 형식 오류: 끄는 자유 점에만, 격자 안, 처음 자리가 범위 안, 한 칸 이상', () => {
  const r = (pt: object) => ({ grid: { w: 6, h: 6 }, points: [{ id: 'A', x: 2, y: 2, ...pt }] });
  assert.throws(() => parse(r({ range: { x: [0, 3] } })), /끄는 자유 점/);
  assert.throws(() => parse(r({ drag: true, range: { x: [0, 9] } })), /격자/);
  assert.throws(() => parse(r({ drag: true, range: { x: [3, 4] } })), /처음 자리/);
  assert.throws(() => parse(r({ drag: true, range: { x: [2, 2], y: [2, 2] } })), /움직일 곳/);
  assert.throws(() => parse(r({ drag: true, range: { x: [3, 1] } })), /작은 수/);
  // 한 축만 막으면 가로로만 끄는 점
  const p = parse(r({ drag: true, range: { y: [2, 2] } }));
  assert.deepEqual(shDrag(p, shInit(p), 'A', 999, -999).pts.A, { x: 6, y: 2 });
});

// ---- 따라오는 점(모양 지키며 끌기) ----

const rectRaw = () => ({
  grid: { w: 12, h: 8 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'C', x: 4, y: 2, drag: true, range: { x: [1, 12], y: [1, 8] } },
    { id: 'B', y: 0, follow: { x: 'C' } },
    { id: 'D', x: 0, follow: { y: 'C' } },
  ],
  polygons: [['A', 'B', 'C', 'D']],
  measures: [{ len: ['A', 'B'] }, { len: ['A', 'D'] }, { area: 0 }],
  digits: 0,
  goal: { value: { of: 2, is: 12, places: 4 }, hint: '가로 × 세로 = 12 인 수를 찾아요' },
  done: '넓이가 12 인 직사각형 네 가지를 찾았어요.',
});

test('따라오는 점: C 를 끌면 B·D 가 따라와 직사각형이 유지됨', () => {
  const p = parse(rectRaw());
  const s = shInit(p);
  assert.deepEqual(s.pts.B, { x: 4, y: 0 });
  assert.deepEqual(s.pts.D, { x: 0, y: 2 });
  const u = shUnit(p);
  const t = shDrag(p, s, 'C', u * 2, u * -1);
  assert.deepEqual(
    [t.pts.B, t.pts.C, t.pts.D],
    [
      { x: 6, y: 0 },
      { x: 6, y: 3 },
      { x: 0, y: 3 },
    ],
  );
  assert.deepEqual(shMeasures(p, t), ['AB = 6', 'AD = 3', '넓이 = 18']);
  // 따라오는 점은 끄는 점이 아니라 그냥 점(손잡이 없음)
  const ks = shDraw(p, t).marks.map((m) => m.k);
  assert.ok(ks.includes('pt:B') && !ks.includes('h:B') && ks.includes('h:C'));
});

test('따라오는 점: 넓이 12 직사각형 네 자리 목표, 형식 검사·sympy 통과', () => {
  const p = full(rectRaw());
  const s = shInit(p);
  assert.deepEqual(shGoalHits(p, { ...s, pts: { ...s.pts, C: { x: 4, y: 3 } } }), []); // B·D 를 안 고침
  const u = shUnit(p);
  assert.deepEqual(shGoalHits(p, shDrag(p, s, 'C', 0, -u)), ['C:4,3']);
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(shapeDef.checks(p))).ok, false);
});

test('따라오는 점 형식 오류', () => {
  const bad = (f: (r: ReturnType<typeof rectRaw>) => void) => {
    const r = rectRaw();
    f(r);
    return () => parse(r);
  };
  // 따라 받는 칸을 적으면 어긋남
  assert.throws(
    bad((r) => Object.assign(r.points[2] as object, { x: 4 })),
    /적지 않음/,
  );
  // 뒤에 적은 점은 따라갈 수 없음(차례대로 계산)
  assert.throws(
    bad((r) => Object.assign(r.points[2] as object, { follow: { x: 'D' } })),
    /없는 점/,
  );
  // 두 칸 모두 비면 따라오는 것이 없음, 둘 다 적힌 칸이 없으면 자리 모름
  assert.throws(
    bad((r) => Object.assign(r.points[2] as object, { follow: {} })),
    /x 나 y/,
  );
  assert.throws(
    bad((r) => Object.assign(r.points[2] as object, { drag: true })),
    /끌 수 없음/,
  );
});

// ---- 마주 보는 점 ----

const crossRaw = () => ({
  grid: { w: 8, h: 8 },
  points: [
    { id: 'O', x: 4, y: 4 },
    { id: 'P', deg: 30, drag: true, on: { circle: ['O', 3] } },
    { id: 'Q', deg: 120, drag: true, on: { circle: ['O', 3] } },
    { id: 'R', mirror: { of: 'P', about: 'O' } },
    { id: 'S', mirror: { of: 'Q', about: 'O' } },
  ],
  segments: [
    ['P', 'R'],
    ['Q', 'S'],
  ],
  measures: [{ angle: ['P', 'O', 'Q'] }, { angle: ['R', 'O', 'S'] }],
  digits: 0,
  goal: { visit: { of: 0, at: [30, 60, 120] }, hint: '두 직선을 돌려 보세요' },
});

test('마주 보는 점: P 를 돌리면 R 이 O 건너편으로 따라와 맞꼭지각이 늘 같음', () => {
  const p = full(crossRaw());
  const s = shInit(p);
  const R = s.pts.R as { x: number; y: number };
  const P = s.pts.P as { x: number; y: number };
  assert.ok(Math.abs(R.x + P.x - 8) < 1e-9 && Math.abs(R.y + P.y - 8) < 1e-9);
  assert.deepEqual(shMeasures(p, s), ['∠POQ = 90°', '∠ROS = 90°']);
  const t = shKey(p, s, 'P', 'ArrowRight');
  assert.ok(t);
  assert.deepEqual(shMeasures(p, t), ['∠POQ = 75°', '∠ROS = 75°']);
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
});

const flipRaw = () => ({
  grid: { w: 10, h: 6 },
  points: [
    { id: 'L', x: 4, y: 0, aux: true },
    { id: 'M', x: 4, y: 6, aux: true },
    { id: 'F', x: 2, y: 2, drag: true, range: { x: [0, 4], y: [0, 6] } },
    { id: 'F′', mirror: { of: 'F', across: ['L', 'M'] } },
  ],
  segments: [
    ['L', 'M'],
    ['F', 'F′'],
  ],
  measures: [{ len: ['F', 'F′'] }],
  digits: 0,
});

test('선대칭: F′ 이 직선 LM 건너편에, 점 이름에 ′ 를 쓸 수 있음', () => {
  const p = full(flipRaw());
  const s = shInit(p);
  assert.deepEqual(s.pts['F′'], { x: 6, y: 2 });
  assert.deepEqual(shMeasures(p, s), ['FF′ = 4']);
  const ks = shDraw(p, s).marks;
  assert.equal(ks.find((m) => m.k === 'lab:F′')?.text, 'F′');
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
});

test('마주 보는 점이 격자 밖으로 나가는 자리가 있으면 형식 오류(범위를 좁히라고)', () => {
  const r = flipRaw();
  (r.points[2] as { range?: unknown }).range = undefined;
  assert.throws(() => full(r), /격자 밖.*range/);
});

test('끄는 점 이름에 ′ 가 있어도 목표 검산 기호가 sympy 이름으로 바뀜', () => {
  const raw = {
    grid: { w: 6, h: 4 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'A′', x: 3, y: 0, drag: true, range: { x: [1, 5], y: [0, 2] } },
    ],
    segments: [['A', 'A′']],
    measures: [{ len: ['A', 'A′'] }],
    digits: 0,
    goal: { value: { of: 0, is: 5 }, hint: '피타고라스' },
  };
  const p = full(raw);
  const g = shapeDef.checks(p).find((c) => c.name === '목표 판정');
  assert.ok(g && 'states' in g);
  assert.ok(Object.keys(g.states[0] ?? {}).every((k) => /^pt_[A-Za-z_]+$/.test(k)));
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
});
