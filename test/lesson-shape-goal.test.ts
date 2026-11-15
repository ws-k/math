// 도형판 목표(조각 ②): "넓이를 12로"·"60°·90°·120° 모두 보기". 판정은 손을 뗀 상태 하나(shGoalHits),
// 검산은 끄는 점이 닿는 모든 상태를 sympy 가 다시 판정한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type ShapeParams,
  shapeDef,
  shGoalHits,
  shGoalNeed,
  shInit,
} from '../src/lesson/widgets/shape.ts';
import { runChecks } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;

const trapRaw = () => ({
  grid: { w: 10, h: 5 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 8, y: 0 },
    { id: 'S', x: 0, y: 4 },
    { id: 'M', x: 5, y: 4 },
    { id: 'T', x: 10, y: 4 },
    { id: 'D', x: 2, y: 4, drag: true, on: { seg: ['S', 'M'] } },
    { id: 'C', x: 6, y: 4, drag: true, on: { seg: ['M', 'T'] } },
  ],
  polygons: [['A', 'B', 'C', 'D']],
  measures: [{ len: ['D', 'C'] }, { area: 0 }],
  digits: 0,
  goal: { value: { of: 1, is: 20 }, hint: '윗변이 2 가 되게' },
  done: '넓이 20 이에요.',
});

const at = (p: ShapeParams, pts: Record<string, { x: number; y: number }>) => {
  const s = shInit(p);
  return { ...s, pts: { ...s.pts, ...pts } };
};

test('값 맞추기: 사다리꼴 넓이가 20 인 자리(윗변 2)에서만 닿음', () => {
  const p = parse(trapRaw());
  assert.equal(shGoalNeed(p), 1);
  assert.deepEqual(shGoalHits(p, shInit(p)), []);
  assert.deepEqual(shGoalHits(p, at(p, { D: { x: 1, y: 4 }, C: { x: 5, y: 4 } })), []);
  assert.deepEqual(shGoalHits(p, at(p, { D: { x: 3, y: 4 }, C: { x: 5, y: 4 } })), ['0']);
});

const angleRaw = () => ({
  grid: { w: 8, h: 6 },
  points: [
    { id: 'O', x: 4, y: 1 },
    { id: 'A', x: 7, y: 1 },
    { id: 'P', deg: 30, drag: true, on: { circle: ['O', 3] } },
  ],
  segments: [
    ['O', 'A'],
    ['O', 'P'],
  ],
  measures: [{ angle: ['A', 'O', 'P'] }],
  goal: { visit: { of: 0, at: [60, 90, 120] }, hint: '점을 원을 따라 돌려 보세요' },
});

test('여러 곳 가 보기: 각 60°·90°·120°', () => {
  const p = parse(angleRaw());
  assert.equal(shGoalNeed(p), 3);
  const deg = (d: number) => {
    const s = shInit(p);
    const r = (d * Math.PI) / 180;
    return {
      ...s,
      pts: { ...s.pts, P: { x: 4 + 3 * Math.cos(r), y: 1 + 3 * Math.sin(r), deg: d } },
    };
  };
  assert.deepEqual(shGoalHits(p, deg(90)), ['1']);
  assert.deepEqual(shGoalHits(p, deg(75)), []);
  // 240° 는 각 AOP 가 120° — 같은 곳으로 센다
  assert.deepEqual(shGoalHits(p, deg(240)), ['2']);
});

for (const [name, raw] of [
  ['닿을 수 없는 넓이', { ...trapRaw(), goal: { value: { of: 1, is: 100 }, hint: 'h' } }],
  ['없는 측정 번호', { ...trapRaw(), goal: { value: { of: 5, is: 24 }, hint: 'h' } }],
  ['힌트 없음', { ...trapRaw(), goal: { value: { of: 1, is: 20 } } }],
  // 허용 오차는 무리수 목표만 — 유리수 목표에 두면 정답이 아닌 이웃 자리도 맞았다고 하게 된다
  [
    '유리수 목표에 허용 오차',
    { ...trapRaw(), goal: { value: { of: 1, is: 20, places: 3 }, tol: '1/4', hint: 'h' } },
  ],
  // 처음 자리가 이미 목표면 한 번 만지면 끝나는 탐색으로 되돌아간다
  ['처음 자리가 이미 목표', { ...trapRaw(), goal: { value: { of: 1, is: 24 }, hint: 'h' } }],
  [
    '잘라 옮기기와 함께',
    {
      grid: { w: 8, h: 4 },
      points: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 4, y: 0 },
        { id: 'C', x: 6, y: 3 },
        { id: 'D', x: 2, y: 3 },
        { id: 'E', x: 2, y: 0 },
      ],
      polygons: [['A', 'B', 'C', 'D']],
      measures: [{ area: 0 }],
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
      goal: { value: { of: 0, is: 12 }, hint: 'h' },
    },
  ],
] as const) {
  // 형식 검사 전체(읽기 + 닿는 자리 검사 deep) — 검사기(schema.ts)가 부르는 그대로
  test(`parse 오류(도형판 목표): ${name}`, () => {
    assert.throws(() => shapeDef.deep?.(parse(raw)));
  });
}

test('검산: 목표 판정을 sympy 가 다시 판정해 통과하고, 판정을 망가뜨리면 실패', () => {
  const cs = [parse(trapRaw()), parse(angleRaw())].flatMap((p, k) =>
    shapeDef.checks(p).map((c) => ({ ...c, name: `${k}:${c.name}` })),
  );
  assert.equal(cs.filter((c) => 'kind' in c && c.kind === 'goal').length, 2);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  const bad = cs.map((c) =>
    'kind' in c && c.kind === 'goal' ? { ...c, hits: c.hits.map((h) => h.slice(1)) } : c,
  );
  assert.equal(runChecks(bad).ok, false);
});

test('목표가 있으면 hasGoal(결론 글을 목표 뒤로 미룰 수 있음)', () => {
  assert.equal(shapeDef.hasGoal?.(parse(trapRaw())), true);
  const { goal: _g, done: _d, ...plain } = trapRaw();
  assert.equal(shapeDef.hasGoal?.(parse(plain)), false);
});
