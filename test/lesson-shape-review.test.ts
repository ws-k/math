// 도형판 3-다 리뷰 반영(Minor): 움직일 곳 없는 곡선 위 점·격자 밖으로 자라는 원·형식 오류 글·목표 자리 열쇠·단위.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type ShapeParams,
  shapeDef,
  shDraw,
  shGoalHits,
  shInit,
  shKey,
  shMeasures,
} from '../src/lesson/widgets/shape.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;
const full = (raw: unknown) => {
  const p = parse(raw);
  shapeDef.deep?.(p);
  return p;
};
const message = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return String((e as Error).message);
  }
  return '';
};

test('곡선 위 점이 닿는 자리가 하나뿐이면 형식 오류(끌어도 그대로 — P1)', () => {
  const raw = {
    grid: { w: 10, h: 8 },
    points: [
      { id: 'O', x: 1, y: 4 },
      { id: 'P', deg: 0, drag: true, on: { curve: 0 } },
    ],
    curves: [{ hyperbola: { c: 'O', a: 3, b: 16 } }],
  };
  assert.throws(() => parse(raw), /움직일 곳/);
});

test('지나는 점을 끌면 원이 격자 밖으로 자라는 자리가 있으면 형식 오류(range 를 좁히라고)', () => {
  const raw = (range?: object) => ({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'O', x: 4, y: 3 },
      { id: 'A', x: 5, y: 3, drag: true, ...(range ? { range } : {}) },
    ],
    circles: [{ c: 'O', through: 'A' }],
  });
  assert.throws(() => full(raw()), /격자 밖.*range/);
  assert.doesNotThrow(() => full(raw({ x: [3, 6], y: [2, 4] })));
});

test('형식 오류 글: 목표가 없는 따라오는 점에 목표 글을 쓰지 않고, 끄는 점이 없으면 앞이 비지 않음', () => {
  const many = message(() =>
    full({
      grid: { w: 16, h: 12 },
      points: [
        { id: 'C', x: 4, y: 2, drag: true },
        { id: 'D', x: 6, y: 3, drag: true },
        { id: 'B', follow: { x: 'C', y: 'D' } },
      ],
    }),
  );
  assert.match(many, /너무 많음/);
  assert.doesNotMatch(many, /목표/);
  const still = message(() =>
    full({
      grid: { w: 8, h: 6 },
      points: [
        { id: 'O', x: 1, y: 3 },
        { id: 'F', x: 5, y: 3 },
        { id: 'G', mirror: { of: 'F', about: 'O' } },
      ],
    }),
  );
  assert.match(still, /격자 밖/);
  assert.doesNotMatch(still, /: {2}|^ 에서|: 에서/);
});

test('원·곡선 위 점의 목표 자리 열쇠는 각도(P:270°) — 부동소수 찌꺼기가 열쇠에 들지 않게', () => {
  const p = full({
    grid: { w: 10, h: 8 },
    points: [
      { id: 'O', x: 5, y: 4, aux: true },
      { id: 'F', x: 1, y: 4 },
      { id: 'G', x: 9, y: 4 },
      { id: 'P', deg: 30, drag: true, on: { curve: 0 } },
    ],
    curves: [{ ellipse: { c: 'O', a: 5, b: 3 } }],
    measures: [{ len: ['P', 'F'] }, { len: ['P', 'G'] }],
    digits: 2,
    goal: { value: { of: 0, is: { of: 1 }, places: 2 }, hint: 'h' },
  });
  let s = shInit(p);
  const keys = new Set<string>();
  for (let k = 0; k < 24; k++) {
    for (const h of shGoalHits(p, s)) keys.add(h);
    s = shKey(p, s, 'P', 'ArrowRight') ?? s;
  }
  assert.deepEqual([...keys].sort(), ['P:270°', 'P:90°']);
});

test('단위: 조각 넓이·잘라 옮기기 넓이·길이 ÷ sin 에도', () => {
  const pc = parse({
    grid: { w: 8, h: 8 },
    points: [],
    unit: 'cm',
    pieces: [
      {
        at: [
          [0, 0],
          [2, 0],
          [0, 2],
        ],
        to: [
          [4, 2],
          [6, 2],
          [4, 4],
        ],
      },
    ],
  });
  assert.equal(shDraw(pc, shInit(pc)).texts.pieces, '조각 넓이의 합 = 2 cm²');
  const cut = parse({
    grid: { w: 8, h: 4 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0 },
      { id: 'C', x: 6, y: 3 },
      { id: 'D', x: 2, y: 3 },
      { id: 'E', x: 2, y: 0 },
    ],
    polygons: [['A', 'B', 'C', 'D']],
    unit: 'm',
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
  assert.equal(shDraw(cut, shInit(cut)).texts.area, '넓이 = 12 m²');
  const sine = parse({
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0 },
      { id: 'C', x: 4, y: 3 },
    ],
    measures: [
      { len: ['B', 'C'] },
      { angle: ['B', 'A', 'C'], label: '∠A' },
      { sin: 1 },
      { ratio: [0, 2] },
    ],
    unit: 'cm',
    digits: 2,
  });
  assert.deepEqual(shMeasures(sine, shInit(sine)).slice(2), ['sin ∠A = 0.6', 'BC ÷ sin ∠A = 5 cm']);
});
