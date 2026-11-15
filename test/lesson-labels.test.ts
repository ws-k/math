// 점 이름표 자리(화면 점검 지적): 가까운 두 점의 이름표가 겹치지 않고, 그림 맨 위 점의 이름표가 잘리지 않는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draw, frame, initial, parseCoord } from '../src/lesson/widgets/coord.ts';
import { placeLabels } from '../src/lesson/widgets/labels.ts';
import { type ShapeParams, shapeDef, shDraw, shInit } from '../src/lesson/widgets/shape.ts';

const opts = { charW: 9, h: 13, gx: 10, gy: 7, dotR: 6 };
const overlap = (a: { l: number; t: number; r: number; b: number }, b: typeof a) =>
  a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

test('placeLabels: 겹치는 두 점의 이름표는 서로 다른 자리, 맨 위 점은 아래로', () => {
  const bounds = { l: 0, t: 0, r: 200, b: 200 };
  const [a, b] = placeLabels(
    [
      { x: 100, y: 100, n: 1 },
      { x: 100, y: 100, n: 1 },
    ],
    [{ x: 100, y: 100 }],
    bounds,
    opts,
  );
  assert.ok(a && b && !overlap(a, b));
  // 아무것도 겹치지 않으면 늘 오른쪽 위(예전 자리 그대로)
  assert.deepEqual(a, { l: 110, t: 80, r: 119, b: 93 });
  const [top] = placeLabels([{ x: 100, y: 4, n: 1 }], [], bounds, opts);
  assert.ok(top && top.t >= 0 && top.t > 4);
});

test('좌표평면: 그림 맨 위의 점(m3-quadratic-eq zero 의 x=4)도 이름표가 그림 안에', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -6, max: 4, step: 1 },
    y: { min: -16, max: 10, step: 2 },
    objects: [
      { id: 'f', curve: '(x-3)*(x+5)' },
      { id: 'P', point: { on: 'f', x: 0, drag: 'x' }, name: 'P' },
    ],
  });
  const box = { w: 298, h: 232 };
  const f = frame(box);
  const s = { ...initial(p), pts: { P: { i: 4, j: 0 } } };
  const lab = draw(p, s, box).items.find((i) => i.t === 'label');
  assert.ok(lab?.t === 'label');
  // 글자 기준선 y 에서 위로 약 10px 이 글자 윗변
  assert.ok(lab.y - 10 >= f.t, `이름표 윗변 ${lab.y - 10} < 그림 윗변 ${f.t}`);
});

const triRaw = () => ({
  grid: { w: 8, h: 5 },
  points: [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 6, y: 0 },
    { id: 'C', x: 6, y: 4 },
    { id: 'D', x: 0, y: 4 },
    { id: 'P', x: 2, y: 4, drag: true, on: { seg: ['D', 'C'] } },
  ],
  polygons: [
    ['A', 'B', 'C', 'D'],
    ['A', 'B', 'P'],
  ],
  measures: [{ area: 1 }],
  digits: 0,
});

test('도형판: P 가 C 위에 와도(삼각형 넓이 장면) 두 이름표가 겹치지 않고 그림 안에', () => {
  const p = shapeDef.parse(triRaw()) as ShapeParams;
  const s0 = shInit(p);
  const s = { ...s0, pts: { ...s0.pts, P: { x: 6, y: 4 } } };
  const d = shDraw(p, s);
  const box = (k: string) => {
    const m = d.marks.find((x) => x.k === k);
    const x = Number(m?.a.x);
    const y = Number(m?.a.y);
    // 도형판 이름표는 가운데 맞춤(text-anchor: middle), 글자 한 자 폭 약 9px
    return { l: x - 4.5, t: y - 10, r: x + 4.5, b: y + 3 };
  };
  assert.ok(!overlap(box('lab:P'), box('lab:C')));
  for (const k of ['lab:P', 'lab:C', 'lab:D']) assert.ok(box(k).t >= 0, k);
});
