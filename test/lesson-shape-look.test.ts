// 도형판 3-다: 보이는 것 — 단위(m·m²)·이름표(label)·그림 위 값(tag)·점선/연장선·각 호·오목각(ccw)·
// 호와 호 길이·원주·반지름 비정수(2.5·점까지 거리)·계산값(AB²·sin)·점 10개 넘게·격자 세로 16칸.
// 값은 모두 sympy 가 같은 점에서 다시 계산해 대조한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type ShapeParams,
  shapeDef,
  shDraw,
  shGoalHits,
  shInit,
  shKey,
  shMeasures,
} from '../src/lesson/widgets/shape.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;
const sympyOk = (p: ShapeParams) => {
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
};

const rect = (extra: object = {}) =>
  parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 1, y: 1 },
      { id: 'B', x: 5, y: 1 },
      { id: 'C', x: 5, y: 4 },
      { id: 'D', x: 1, y: 4 },
    ],
    polygons: [['A', 'B', 'C', 'D']],
    measures: [
      { len: ['A', 'B'], label: '가로', tag: true },
      { area: 0, tag: true },
    ],
    unit: 'm',
    digits: 0,
    ...extra,
  });

test('단위와 이름표: 길이 m, 넓이 m², label 이 이름 대신', () => {
  const p = rect();
  assert.deepEqual(shMeasures(p, shInit(p)), ['가로 = 4 m', '넓이 = 12 m²']);
  sympyOk(p);
});

test('그림 위 값(tag): 길이는 변 가운데 바깥, 넓이는 다각형 가운데', () => {
  const p = rect();
  const d = shDraw(p, shInit(p));
  const t0 = mark(d, 'tag0');
  const t1 = mark(d, 'tag1');
  assert.equal(t0?.text, '4 m');
  assert.equal(t1?.text, '12 m²');
  const A = mark(d, 'pt:A')?.a as { cx: number; cy: number };
  const C = mark(d, 'pt:C')?.a as { cx: number; cy: number };
  // 넓이 글은 직사각형 한가운데(글자 기준선만큼 아래)
  assert.ok(Math.abs(Number(t1?.a.x) - (A.cx + C.cx) / 2) < 0.01);
  // 밑변 AB 글은 밑변 아래(그림 바깥 쪽)
  assert.ok(Number(t0?.a.y) > A.cy);
});

test('점선·연장선: segments 에 { seg, dash, extend }', () => {
  const p = parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 2, y: 1 },
      { id: 'B', x: 4, y: 2, drag: true },
    ],
    segments: [{ seg: ['A', 'B'], dash: true, extend: true }, ['A', 'B']],
  });
  const d = shDraw(p, shInit(p));
  const s0 = mark(d, 'seg0')?.a as Record<string, number | string>;
  assert.match(String(s0.class), /dash/);
  const s1 = mark(d, 'seg1')?.a as Record<string, number | string>;
  // 연장선은 격자 테두리까지: 기울기 1/2 직선이 x=0 (y=0) 과 x=8 (y=4) 에서 만남
  const B = mark(d, 'seg1')?.a as Record<string, number>;
  assert.ok(Number(s0.x1) < Number(B.x1) && Number(s0.x2) > Number(B.x2));
  assert.equal(s1.class, 'sh-seg');
});

test('각 호(arc)·직각 표시, 오목각(ccw: 시계 반대 방향으로 잰 각 0°~360°)', () => {
  const p = parse({
    grid: { w: 8, h: 8 },
    points: [
      { id: 'A', x: 1, y: 1 },
      { id: 'B', x: 4, y: 4 },
      { id: 'C', x: 7, y: 1 },
      { id: 'D', x: 4, y: 7 },
      { id: 'P', x: 7, y: 4, drag: true },
    ],
    polygons: [['A', 'C', 'B', 'D']],
    measures: [
      { angle: ['D', 'B', 'C'], ccw: true, mark: true },
      { angle: ['A', 'B', 'C'], mark: true },
      { angle: ['C', 'B', 'P'], mark: true },
      { angle: ['C', 'B', 'D'], ccw: true },
    ],
    digits: 0,
  });
  const s = shInit(p);
  assert.deepEqual(shMeasures(p, s), ['∠DBC = 225°', '∠ABC = 90°', '∠CBP = 45°', '∠CBD = 135°']);
  const d = shDraw(p, s);
  assert.equal(mark(d, 'ang1')?.a.visibility, 'hidden');
  assert.equal(mark(d, 'rt1')?.a.visibility, 'visible');
  assert.equal(mark(d, 'ang0')?.a.visibility, 'visible');
  // 225° 호는 큰 호(large-arc 1)
  assert.match(String(mark(d, 'ang0')?.a.d), / 0 1 [01] /);
  sympyOk(p);
  assert.equal(runChecks(tamper(shapeDef.checks(p))).ok, false);
});

test('오목각 목표: 끄는 점으로 270° 만들기, sympy 목표 판정', () => {
  const p = parse({
    grid: { w: 6, h: 6 },
    points: [
      { id: 'A', x: 0, y: 3 },
      { id: 'B', x: 3, y: 3 },
      { id: 'C', x: 6, y: 3, drag: true, range: { x: [0, 6], y: [0, 6] } },
    ],
    segments: [
      ['B', 'A'],
      ['B', 'C'],
    ],
    measures: [{ angle: ['A', 'B', 'C'], ccw: true, mark: true }],
    digits: 0,
    goal: { value: { of: 0, is: 270 }, hint: '아래로' },
  });
  shapeDef.deep?.(p);
  const s = shInit(p);
  assert.deepEqual(shMeasures(p, s), ['∠ABC = 180°']);
  const t = shKey(p, s, 'C', 'ArrowDown');
  assert.ok(t);
  sympyOk(p);
});

const arcRaw = () => ({
  grid: { w: 8, h: 8 },
  points: [
    { id: 'O', x: 4, y: 4 },
    { id: 'A', deg: 0, on: { circle: ['O', 3] }, drag: true },
    { id: 'B', deg: 90, on: { circle: ['O', 3] }, drag: true },
  ],
  circles: [{ c: 'O', r: 3 }],
  arcs: [{ c: 'O', from: 'A', to: 'B' }],
  segments: [
    ['O', 'A'],
    ['O', 'B'],
  ],
  measures: [{ arc: 0, tag: true }, { around: 0 }, { angle: ['A', 'O', 'B'], ccw: true }],
  unit: 'cm',
  digits: 1,
});

test('호와 호 길이·원주', () => {
  const p = parse(arcRaw());
  const s = shInit(p);
  assert.deepEqual(shMeasures(p, s), ['호 AB ≈ 4.7 cm', '원주 ≈ 18.8 cm', '∠AOB = 90°']);
  const d = shDraw(p, s);
  assert.match(String(mark(d, 'arc0')?.a.d), /^M [\d.]+ [\d.]+ A /);
  assert.equal(mark(d, 'tag0')?.text, '4.7 cm');
  // B 를 한 칸(15°) 더 돌리면 호도 길어진다
  const t = shKey(p, s, 'B', 'ArrowRight');
  assert.ok(t);
  assert.deepEqual(shMeasures(p, t)[0], '호 AB ≈ 5.5 cm');
  sympyOk(p);
});

test('호 길이 목표(visit) — sympy 목표 판정', () => {
  const r = arcRaw();
  // A 를 고정해 판정 자리를 24곳으로(둘 다 끌면 576곳 — sympy 다시 판정이 15초 걸림)
  (r.points[1] as { drag?: boolean }).drag = false;
  Object.assign(r, { goal: { visit: { of: 0, at: ['pi', '2*pi'] }, hint: '반원' } });
  const p = parse(r);
  shapeDef.deep?.(p);
  sympyOk(p);
});

test('반지름 비정수: 2.5, 점까지 거리(through — 컴퍼스로 옮기기)', () => {
  const p = parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'O', x: 1, y: 1 },
      { id: 'A', x: 2, y: 2 },
      { id: 'P', deg: 0, on: { circle: ['O', 'A'] }, drag: true },
      { id: 'C', x: 5, y: 3 },
      { id: 'Q', deg: 90, on: { circle: ['C', 2.5] }, drag: true },
    ],
    circles: [
      { c: 'O', through: 'A' },
      { c: 'C', r: 2.5 },
    ],
    measures: [{ len: ['O', 'P'] }, { len: ['C', 'Q'] }],
    digits: 2,
  });
  const s = shInit(p);
  assert.deepEqual(shMeasures(p, s), ['OP ≈ 1.41', 'CQ = 2.5']);
  const d = shDraw(p, s);
  assert.ok(Math.abs(Number(mark(d, 'circ0')?.a.r) - Math.SQRT2 * 36) < 0.01);
  sympyOk(p);
  assert.throws(
    () =>
      parse({
        grid: { w: 4, h: 4 },
        points: [{ id: 'O', x: 2, y: 2 }],
        circles: [{ c: 'O', r: 1.25 }],
      }),
    /0.5/,
  );
});

test('계산값: AB², sin, 길이 ÷ sin(사인법칙), 제곱끼리 합(피타고라스)', () => {
  const p = parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0 },
      { id: 'C', x: 4, y: 3, drag: true },
    ],
    polygons: [['A', 'B', 'C']],
    measures: [
      { len: ['A', 'B'] },
      { len: ['B', 'C'] },
      { len: ['C', 'A'] },
      { sq: 0 },
      { sq: 1 },
      { sum: [3, 4] },
      { sq: 2 },
      { angle: ['B', 'A', 'C'], label: 'A' },
    ],
    digits: 2,
  });
  const s = shInit(p);
  assert.deepEqual(shMeasures(p, s), [
    'AB = 4',
    'BC = 3',
    'CA = 5',
    'AB² = 16',
    'BC² = 9',
    'AB² + BC² = 25',
    'CA² = 25',
    'A ≈ 36.87°',
  ]);
  sympyOk(p);
  const q = parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0 },
      { id: 'C', x: 4, y: 3, drag: true },
    ],
    polygons: [['A', 'B', 'C']],
    measures: [
      { len: ['B', 'C'] },
      { angle: ['B', 'A', 'C'], label: 'A' },
      { sin: 1 },
      { ratio: [0, 2] },
    ],
    digits: 2,
  });
  assert.deepEqual(shMeasures(q, shInit(q)), [
    'BC = 3',
    'A ≈ 36.87°',
    'sin A = 0.6',
    'BC ÷ sin A = 5',
  ]);
  sympyOk(q);
  // 사인법칙 목표: BC ÷ sin A 가 5 인 자리(외접원 지름) 여러 곳
  const g = parse({
    ...structuredClone({
      grid: { w: 8, h: 6 },
      points: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 4, y: 0 },
        { id: 'C', x: 4, y: 3, drag: true, range: { x: [1, 6], y: [1, 5] } },
      ],
      polygons: [['A', 'B', 'C']],
      measures: [
        { len: ['B', 'C'] },
        { angle: ['B', 'A', 'C'], label: 'A' },
        { sin: 1 },
        { ratio: [0, 2] },
      ],
      digits: 2,
    }),
    goal: { value: { of: 3, is: 5, places: 2 }, hint: '외접원' },
  });
  shapeDef.deep?.(g);
  assert.equal(shGoalHits(g, shInit(g)).length, 1);
  sympyOk(g);
});

test('계산값 형식 오류: 제곱은 길이만, sin 은 각만, 넓이와 길이 섞어 묶기 금지', () => {
  const base = {
    grid: { w: 4, h: 4 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 3, y: 0 },
      { id: 'C', x: 0, y: 2 },
    ],
    polygons: [['A', 'B', 'C']],
  };
  assert.throws(() => parse({ ...base, measures: [{ area: 0 }, { sq: 0 }] }), /길이/);
  assert.throws(() => parse({ ...base, measures: [{ len: ['A', 'B'] }, { sin: 0 }] }), /각/);
  assert.throws(
    () => parse({ ...base, measures: [{ len: ['A', 'B'] }, { sq: 0 }, { sum: [0, 1] }] }),
    /끼리/,
  );
  assert.throws(() => parse({ ...base, measures: [{ len: ['A', 'B'], ccw: true }] }), /각에만/);
  assert.throws(() => parse({ ...base, unit: 'inch' }), /unit/);
});

test('점 10개 넘게(최대 20), 격자 세로 16칸', () => {
  const points = Array.from({ length: 14 }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    x: i % 8,
    y: Math.floor(i / 8) * 8 + 8,
  }));
  const p = parse({ grid: { w: 8, h: 16 }, points });
  assert.equal(p.points.length, 14);
  assert.throws(() =>
    parse({
      grid: { w: 8, h: 16 },
      points: Array.from({ length: 21 }, (_, i) => ({
        id: `${String.fromCharCode(65 + (i % 26))}${i >= 26 ? '′' : ''}`,
        x: 0,
        y: 0,
      })),
    }),
  );
  assert.throws(() => parse({ grid: { w: 8, h: 17 }, points }), /grid.h/);
});
