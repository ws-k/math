import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type ShapeParams,
  shapeDef,
  shDone,
  shDrag,
  shDraw,
  shInit,
  shKey,
  shMeasures,
  shUnit,
} from '../src/lesson/widgets/shape.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;

const TRI = parse({
  grid: { w: 8, h: 6 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0, drag: true },
    { id: 'C', x: 0, y: 3, drag: true },
  ],
  polygons: [['A', 'B', 'C']],
  measures: [{ len: ['B', 'C'] }, { angle: ['B', 'A', 'C'] }, { area: 0 }],
});

test('길이·각·넓이(앱 계산)', () => {
  const s = shInit(TRI);
  assert.deepEqual(shMeasures(TRI, s), ['BC = 5', '∠BAC = 90°', '넓이 = 6']);
  const t = shDrag(TRI, s, 'B', shUnit(TRI) * 1.2, 0); // 4 → 5(가장 가까운 격자)
  assert.deepEqual(t.pts.B, { x: 5, y: 0 });
  assert.deepEqual(shMeasures(TRI, t), ['BC ≈ 5.8', '∠BAC = 90°', '넓이 = 7.5']);
  // 격자 밖으로는 못 나간다
  assert.deepEqual(shDrag(TRI, s, 'B', 9999, 9999).pts.B, { x: 8, y: 0 });
  assert.deepEqual(shKey(TRI, s, 'C', 'ArrowUp')?.pts.C, { x: 0, y: 4 });
});

const ON = parse({
  grid: { w: 10, h: 8 },
  points: [
    { id: 'O', x: 5, y: 4 },
    { id: 'P', x: 0, y: 0 },
    { id: 'Q', x: 6, y: 3 },
    { id: 'M', x: 2, y: 1, drag: true, on: { seg: ['P', 'Q'] } },
    { id: 'R', deg: 90, drag: true, on: { circle: ['O', 3] } },
  ],
  circles: [{ c: 'O', r: 3 }],
  segments: [['P', 'Q']],
  measures: [{ len: ['O', 'R'] }, { len: ['P', 'M'] }],
  digits: 2,
});

test('제약: 선분 위 점은 선분 위 격자점에, 원 위 점은 15° 간격으로', () => {
  const s = shInit(ON);
  assert.deepEqual(s.pts.R, { x: 5, y: 7, deg: 90 });
  const u = shUnit(ON);
  assert.deepEqual(shDrag(ON, s, 'M', u * 2.2, u * -1.1).pts.M, { x: 4, y: 2 });
  assert.deepEqual(shDrag(ON, s, 'M', -999, 999).pts.M, { x: 0, y: 0 });
  const r = shDrag(ON, s, 'R', u * -3, u * 3).pts.R; // (5,7) → (2,4) 쪽 = 180°
  assert.equal(r?.deg, 180);
  assert.deepEqual(shMeasures(ON, s), ['OR = 3', 'PM ≈ 2.24']);
});

const CUT = parse({
  grid: { w: 8, h: 4 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0 },
    { id: 'C', x: 6, y: 3 },
    { id: 'D', x: 2, y: 3 },
    { id: 'E', x: 2, y: 0 },
  ],
  polygons: [['A', 'B', 'C', 'D']],
  cut: {
    piece: ['A', 'E', 'D'],
    rest: ['E', 'B', 'C', 'D'],
    by: [4, 0],
    result: [
      [2, 0],
      [6, 0],
      [6, 3],
      [2, 3],
    ],
  },
});

test('잘라 옮기기: 조각이 목표 자리에 가면 끝, 넓이는 그대로', () => {
  const s = shInit(CUT);
  assert.equal(shDone(CUT, s), false);
  const u = shUnit(CUT);
  const t = shDrag(CUT, s, 'cut', u * 3.8, u * 0.3);
  assert.deepEqual(t.cut, [4, 0]);
  assert.equal(shDone(CUT, t), true);
  assert.equal(String(mark(shDraw(CUT, t), 'cutp')?.a.points).split(' ').length, 3);
  assert.equal(shDraw(CUT, t).texts.area, '넓이 = 12 → 옮긴 뒤 넓이 = 12');
});

test('검산 항목이 sympy 를 통과하고, 값을 망가뜨리면 실패한다', () => {
  for (const p of [TRI, ON, CUT]) {
    const r = runChecks(shapeDef.checks(p));
    assert.ok(r.ok, r.out);
  }
  assert.equal(runChecks(tamper(shapeDef.checks(TRI))).ok, false);
  assert.equal(runChecks(tamper(shapeDef.checks(CUT))).ok, false);
});

test('parse: 모르는 칸·격자 밖·없는 점·넓이가 다른 결과 모양은 오류', () => {
  const base = { grid: { w: 4, h: 4 }, points: [{ id: 'A', x: 0, y: 0 }] };
  assert.throws(() => parse({ ...base, colour: 1 }), /모르는 칸/);
  assert.throws(() => parse({ ...base, points: [{ id: 'A', x: 9, y: 0 }] }), /격자/);
  assert.throws(() => parse({ ...base, segments: [['A', 'Z']] }), /없는 점/);
  const bad = structuredClone(CUT) as unknown as { cut: { result: number[][] } };
  bad.cut.result = [
    [2, 0],
    [7, 0],
    [7, 3],
    [2, 3],
  ];
  assert.throws(() => parse(bad), /넓이/);
});

// 보조점(aux): 선분 끝으로만 쓰는 안 보이는 점. 설명 없는 점 이름이 그림에 나오지 않게(사다리꼴 장면 S·M·T)
const auxRaw = () => ({
  grid: { w: 10, h: 5 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 8, y: 0 },
    { id: 'S', x: 0, y: 4, aux: true },
    { id: 'M', x: 5, y: 4, aux: true },
    { id: 'D', x: 2, y: 4, drag: true, on: { seg: ['S', 'M'] } },
  ],
  polygons: [['A', 'B', 'D']],
  measures: [{ area: 0 }],
  digits: 0,
});

test('보조점: 점·이름표를 그리지 않고, 선분 끝으로는 쓴다', () => {
  const p = parse(auxRaw());
  const ks = shDraw(p, shInit(p)).marks.map((m) => m.k);
  for (const k of ['pt:S', 'lab:S', 'pt:M', 'lab:M']) assert.ok(!ks.includes(k), k);
  assert.ok(ks.includes('lab:D') && ks.includes('pt:A'));
});

for (const [name, f] of [
  [
    '보조점을 끌 수 있게',
    (r: ReturnType<typeof auxRaw>) =>
      Object.assign(r.points[2] as object, { drag: true, on: { seg: ['A', 'B'] } }),
  ],
  ['보조점이 다각형 꼭짓점', (r: ReturnType<typeof auxRaw>) => r.polygons.push(['A', 'B', 'S'])],
  [
    '보조점을 재기',
    (r: ReturnType<typeof auxRaw>) => r.measures.push({ len: ['A', 'M'] } as never),
  ],
  [
    'aux 가 true 아님',
    (r: ReturnType<typeof auxRaw>) => Object.assign(r.points[2] as object, { aux: 1 }),
  ],
] as const) {
  test(`parse 오류(보조점): ${name}`, () => {
    const r = auxRaw();
    f(r);
    assert.throws(() => parse(r));
  });
}
