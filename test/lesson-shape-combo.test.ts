// 도형판 측정값 묶기(요청 106): 두 측정값의 합·차·비를 측정값으로, 목표에서 다른 측정값과 견주기,
// 끄는 점을 따라오는 수선의 발. 이차곡선 정의(PF+PG=10, |PF−PG|, PF=PH)와 닮음(AD:AB = AE:AC)을 도형판 하나로.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type ShapeParams,
  shapeDef,
  shDrag,
  shDraw,
  shGoalHits,
  shGoalNeed,
  shInit,
  shKey,
  shMeasures,
  shUnit,
} from '../src/lesson/widgets/shape.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;
const deep = (raw: unknown) => shapeDef.deep?.(parse(raw));

const at = (p: ShapeParams, pts: Record<string, { x: number; y: number; deg?: number }>) => {
  const s = shInit(p);
  return { ...s, pts: { ...s.pts, ...pts } };
};

// 타원: 두 초점 F·G, 끄는 점 P. 거리의 합이 10 인 격자점은 (5,7)·(0,3)·(10,3)
const ellipseRaw = () => ({
  grid: { w: 10, h: 8 },
  points: [
    { id: 'F', x: 2, y: 3 },
    { id: 'G', x: 8, y: 3 },
    { id: 'P', x: 5, y: 3, drag: true },
  ],
  segments: [
    ['P', 'F'],
    ['P', 'G'],
  ],
  measures: [{ len: ['P', 'F'] }, { len: ['P', 'G'] }, { sum: [0, 1] }, { diff: [0, 1] }],
  digits: 1,
  goal: { value: { of: 2, is: 10, places: 3 }, hint: '두 거리를 더해 보세요' },
  done: '세 곳 모두 합이 10 이에요.',
});

test('합·차 측정값: 화면 글(PF + PG, |PF − PG|)과 끌면 따라 바뀜', () => {
  const p = parse(ellipseRaw());
  assert.deepEqual(shMeasures(p, shInit(p)), ['PF = 3', 'PG = 3', 'PF + PG = 6', '|PF − PG| = 0']);
  const u = shUnit(p);
  const s = shDrag(p, shInit(p), 'P', 0, -4 * u); // (5,7)
  assert.deepEqual(shMeasures(p, s), ['PF = 5', 'PG = 5', 'PF + PG = 10', '|PF − PG| = 0']);
  const t = at(p, { P: { x: 0, y: 3 } });
  assert.deepEqual(shMeasures(p, t), ['PF = 2', 'PG = 8', 'PF + PG = 10', '|PF − PG| = 6']);
  // 무리수끼리 더해도 반올림 글: (5,5) 는 √13 + √13
  assert.equal(shMeasures(p, at(p, { P: { x: 5, y: 5 } }))[2], 'PF + PG ≈ 7.2');
});

test('합 목표: 합이 10 인 세 자리에서만 닿고, 같은 자리는 한 번만', () => {
  const p = parse(ellipseRaw());
  assert.equal(shGoalNeed(p), 3);
  assert.deepEqual(shGoalHits(p, shInit(p)), []);
  assert.deepEqual(shGoalHits(p, at(p, { P: { x: 5, y: 7 } })), ['P:5,7']);
  assert.deepEqual(shGoalHits(p, at(p, { P: { x: 10, y: 3 } })), ['P:10,3']);
  assert.deepEqual(shGoalHits(p, at(p, { P: { x: 5, y: 5 } })), []);
  assert.doesNotThrow(() => deep(ellipseRaw()));
});

test('각의 합: 삼각형 세 각을 더하면 180°', () => {
  const p = parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 7, y: 0 },
      { id: 'C', x: 3, y: 5, drag: true },
    ],
    polygons: [['A', 'B', 'C']],
    measures: [
      { angle: ['C', 'A', 'B'] },
      { angle: ['A', 'B', 'C'] },
      { angle: ['B', 'C', 'A'] },
      { sum: [0, 1, 2] },
    ],
    digits: 0,
  });
  assert.equal(shMeasures(p, shInit(p))[3], '∠CAB + ∠ABC + ∠BCA = 180°');
  // C 가 AB 위에 오면 ∠BCA 를 정할 수 있지만(180°) C 가 A 와 겹치면 정할 수 없다
  assert.equal(
    shMeasures(p, at(p, { C: { x: 0, y: 0 } }))[3],
    '∠CAB + ∠ABC + ∠BCA 은 정할 수 없어요',
  );
});

// 포물선: 초점 F(5,4), 준선 y=2(보조점 L·R 을 지나는 직선). H 는 P 에서 준선에 내린 수선의 발 —
// PF = PH 인 격자점은 (5,3)·(3,4)·(7,4)·(1,7)·(9,7)
const parabolaRaw = () => ({
  grid: { w: 10, h: 8 },
  points: [
    { id: 'F', x: 5, y: 4 },
    { id: 'L', x: 0, y: 2, aux: true },
    { id: 'R', x: 10, y: 2, aux: true },
    { id: 'P', x: 5, y: 6, drag: true },
    { id: 'H', foot: { from: 'P', line: ['L', 'R'] } },
  ],
  segments: [
    ['L', 'R'],
    ['P', 'F'],
    ['P', 'H'],
  ],
  measures: [{ len: ['P', 'F'] }, { len: ['P', 'H'] }],
  digits: 1,
  goal: { value: { of: 0, is: { of: 1 }, places: 3 }, hint: '준선까지의 거리와 비교해 보세요' },
  done: 'PF 와 PH 가 같은 곳을 세 곳 찾았어요.',
});

test('따라오는 수선의 발: P 를 끌거나 키로 옮기면 H 가 준선 위에서 따라옴', () => {
  const p = parse(parabolaRaw());
  const s = shInit(p);
  assert.deepEqual(s.pts.H, { x: 5, y: 2 });
  const u = shUnit(p);
  const t = shDrag(p, s, 'P', -2 * u, 0); // (3,6)
  assert.deepEqual(t.pts.P, { x: 3, y: 6 });
  assert.deepEqual(t.pts.H, { x: 3, y: 2 });
  assert.deepEqual(shKey(p, t, 'P', 'ArrowRight')?.pts.H, { x: 4, y: 2 });
  assert.deepEqual(shMeasures(p, t), ['PF ≈ 2.8', 'PH = 4']);
  // 끌지 않는 점으로 그린다(손잡이 없음) — 끄는 동안 SVG 를 직접 고칠 때 이 표시가 따라 움직인다
  const d = shDraw(p, t);
  assert.ok(mark(d, 'pt:H'));
  assert.equal(mark(d, 'h:H'), undefined);
  assert.notEqual(mark(d, 'pt:H')?.a.cx, mark(shDraw(p, s), 'pt:H')?.a.cx);
});

test('다른 측정값과 견주기: PF = PH 인 자리에서만 닿음', () => {
  const p = parse(parabolaRaw());
  assert.deepEqual(shGoalHits(p, shInit(p)), []);
  const put = (x: number, y: number) =>
    shDrag(p, shInit(p), 'P', (x - 5) * shUnit(p), (6 - y) * shUnit(p));
  assert.deepEqual(shGoalHits(p, put(3, 4)), ['P:3,4']);
  assert.deepEqual(shGoalHits(p, put(9, 7)), ['P:9,7']);
  assert.deepEqual(shGoalHits(p, put(3, 5)), []);
  assert.doesNotThrow(() => deep(parabolaRaw()));
});

test('비스듬한 직선에 내린 발은 격자점이 아니어도 정확한 자리(반올림하지 않음)', () => {
  const p = parse({
    grid: { w: 6, h: 6 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 4 },
      { id: 'P', x: 1, y: 0, drag: true },
      { id: 'H', foot: { from: 'P', line: ['A', 'B'] } },
    ],
    segments: [['A', 'B']],
    measures: [{ len: ['P', 'H'] }, { len: ['A', 'H'] }],
    digits: 2,
  });
  assert.deepEqual(shInit(p).pts.H, { x: 0.5, y: 0.5 });
  assert.deepEqual(shMeasures(p, shInit(p)), ['PH ≈ 0.71', 'AH ≈ 0.71']);
});

// 닮음: D 는 AB 위, E 는 AC 위. AD÷AB = AE÷AC 가 되는 자리(DE ∥ BC)
const ratioRaw = () => ({
  grid: { w: 8, h: 4 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 8, y: 0 },
    { id: 'C', x: 0, y: 4 },
    { id: 'D', x: 2, y: 0, drag: true, on: { seg: ['A', 'B'] } },
    { id: 'E', x: 0, y: 2, drag: true, on: { seg: ['A', 'C'] } },
  ],
  polygons: [['A', 'B', 'C']],
  segments: [['D', 'E']],
  measures: [
    { len: ['A', 'D'] },
    { len: ['A', 'B'] },
    { len: ['A', 'E'] },
    { len: ['A', 'C'] },
    { ratio: [0, 1] },
    { ratio: [2, 3] },
  ],
  digits: 2,
  goal: { value: { of: 4, is: { of: 5 }, places: 2 }, hint: 'DE 와 BC 가 나란해지게' },
});

test('비 측정값: AD ÷ AB, 비끼리 견주기', () => {
  const p = parse(ratioRaw());
  assert.deepEqual(shMeasures(p, shInit(p)).slice(4), ['AD ÷ AB = 0.25', 'AE ÷ AC = 0.5']);
  assert.deepEqual(shGoalHits(p, shInit(p)), []);
  const s = at(p, { D: { x: 6, y: 0 }, E: { x: 0, y: 3 } });
  assert.deepEqual(shGoalHits(p, s), ['D:6,0 E:0,3']);
  // 분모가 0 이면 비를 정할 수 없다(목표에도 닿지 않음)
  const z = parse({
    ...ratioRaw(),
    measures: [{ len: ['A', 'D'] }, { len: ['A', 'E'] }, { ratio: [1, 0] }],
    goal: undefined,
  });
  assert.equal(shMeasures(z, at(z, { D: { x: 0, y: 0 } }))[2], 'AE ÷ AD 은 정할 수 없어요');
  assert.doesNotThrow(() => deep(ratioRaw()));
});

const base = ellipseRaw();
for (const [name, raw] of [
  [
    '합의 항이 뒤 번호',
    {
      ...base,
      measures: [{ sum: [0, 1] }, { len: ['P', 'F'] }, { len: ['P', 'G'] }],
      goal: undefined,
      done: undefined,
    },
  ],
  [
    '합의 항이 자기 자신',
    { ...base, measures: [{ len: ['P', 'F'] }, { sum: [0, 1] }], goal: undefined, done: undefined },
  ],
  [
    '합의 항이 하나',
    { ...base, measures: [{ len: ['P', 'F'] }, { sum: [0] }], goal: undefined, done: undefined },
  ],
  [
    '길이와 각을 더함',
    {
      ...base,
      measures: [{ len: ['P', 'F'] }, { angle: ['F', 'P', 'G'] }, { sum: [0, 1] }],
      goal: undefined,
      done: undefined,
    },
  ],
  [
    '합을 다시 더함',
    {
      ...base,
      measures: [{ len: ['P', 'F'] }, { len: ['P', 'G'] }, { sum: [0, 1] }, { sum: [0, 2] }],
      goal: undefined,
      done: undefined,
    },
  ],
  [
    '차의 항이 셋',
    {
      ...base,
      measures: [
        { len: ['P', 'F'] },
        { len: ['P', 'G'] },
        { len: ['F', 'G'] },
        { diff: [0, 1, 2] },
      ],
      goal: undefined,
      done: undefined,
    },
  ],
  [
    '각의 비',
    {
      ...base,
      measures: [{ angle: ['F', 'P', 'G'] }, { angle: ['P', 'F', 'G'] }, { ratio: [0, 1] }],
      goal: undefined,
      done: undefined,
    },
  ],
  ['같은 측정값끼리 견줌', { ...base, goal: { value: { of: 2, is: { of: 2 } }, hint: 'h' } }],
  [
    '길이와 각을 견줌',
    {
      ...base,
      measures: [{ len: ['P', 'F'] }, { angle: ['F', 'P', 'G'] }],
      goal: { value: { of: 0, is: { of: 1 } }, hint: 'h' },
    },
  ],
  ['없는 측정값과 견줌', { ...base, goal: { value: { of: 2, is: { of: 9 } }, hint: 'h' } }],
  // 처음 자리 (5,3) 에서 PF = PG — 한 번 만지면 끝나는 탐색이 된다
  [
    '처음 자리가 이미 목표(측정값끼리)',
    { ...base, goal: { value: { of: 0, is: { of: 1 } }, hint: 'h' } },
  ],
  // PF + PG 는 늘 FG(6) 이상 — 5 는 닿을 수 없다
  ['닿을 수 없는 합', { ...base, goal: { value: { of: 2, is: 5 }, hint: 'h' } }],
  [
    '유리수 합 목표에 허용 오차',
    { ...base, goal: { value: { of: 2, is: 10, places: 3 }, tol: '1/10', hint: 'h' } },
  ],
] as const) {
  test(`parse 오류(측정값 묶기): ${name}`, () => {
    assert.throws(() => deep(raw));
  });
}

const pb = parabolaRaw();
const ptsWith = (h: object) => [...pb.points.slice(0, 4), { id: 'H', ...h }];
for (const [name, raw] of [
  [
    '발을 끄는 점으로',
    { ...pb, points: ptsWith({ foot: { from: 'P', line: ['L', 'R'] }, drag: true }) },
  ],
  [
    '발에 자리를 적음',
    { ...pb, points: ptsWith({ foot: { from: 'P', line: ['L', 'R'] }, x: 1, y: 2 }) },
  ],
  ['직선이 끄는 점을 지남', { ...pb, points: ptsWith({ foot: { from: 'F', line: ['L', 'P'] } }) }],
  ['직선의 두 점이 같음', { ...pb, points: ptsWith({ foot: { from: 'P', line: ['L', 'L'] } }) }],
  ['없는 점에서 내림', { ...pb, points: ptsWith({ foot: { from: 'Z', line: ['L', 'R'] } }) }],
  [
    '발에서 다시 발',
    {
      ...pb,
      points: [
        ...ptsWith({ foot: { from: 'P', line: ['L', 'R'] } }),
        { id: 'K', foot: { from: 'H', line: ['F', 'L'] } },
      ],
    },
  ],
  [
    '발을 선분 위 점의 끝으로',
    {
      ...pb,
      points: [
        ...ptsWith({ foot: { from: 'P', line: ['L', 'R'] } }),
        { id: 'K', x: 0, y: 0, drag: true, on: { seg: ['F', 'H'] } },
      ],
    },
  ],
] as const) {
  test(`parse 오류(수선의 발): ${name}`, () => {
    assert.throws(() => deep(raw));
  });
}

// 원 위 15° 간격 자리(겹근호 값). A 15°·C 135° 를 고정하고 B 를 돌리면 ∠ABC 는 120° 또는 60° —
// sympy 가 cos 값을 겹근호 식으로 내 60 과 같음을 못 보던 검산기 버그(요청 106 묶음)의 실제 장면
const inscribedRaw = () => ({
  grid: { w: 8, h: 8 },
  points: [
    { id: 'O', x: 4, y: 4 },
    { id: 'A', deg: 15, on: { circle: ['O', 3] } },
    { id: 'C', deg: 135, on: { circle: ['O', 3] } },
    { id: 'B', deg: 0, drag: true, on: { circle: ['O', 3] } },
  ],
  circles: [{ c: 'O', r: 3 }],
  segments: [
    ['A', 'B'],
    ['B', 'C'],
  ],
  measures: [{ angle: ['A', 'B', 'C'] }],
  digits: 0,
  goal: { visit: { of: 0, at: [60, 120] }, hint: '점 B 를 원을 따라 돌려 보세요' },
});

test('검산: 합·차·비·발·측정값끼리 목표를 sympy 가 다시 판정해 통과하고, 망가뜨리면 실패', () => {
  const cs = [ellipseRaw(), parabolaRaw(), ratioRaw(), inscribedRaw()].flatMap((raw, k) => {
    const p = parse(raw);
    shapeDef.deep?.(p);
    return shapeDef.checks(p).map((c) => ({ ...c, name: `${k}:${c.name}` }));
  });
  assert.equal(cs.filter((c) => 'kind' in c && c.kind === 'goal').length, 4);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
  const bad = cs.map((c) =>
    'kind' in c && c.kind === 'goal' ? { ...c, hits: c.hits.map((h) => h.slice(1)) } : c,
  );
  assert.equal(runChecks(bad).ok, false);
});
