// 좌표평면 끌기 범위 제한(점마다 x 범위)과 끄는 손잡이를 그림 테두리 안에 두기.
// 요청 127: m3-trig-ratio same 은 P 가 O 에 겹치면(크기 0 미끄럼틀) 할선이 접선으로 바뀌어 기울기 3/4 가 되고,
//   목표 '3/4 인 자리 3곳'이 그 자리도 센다 — P 의 x 범위를 [1,12] 로 막아 그 상태가 아예 없게 한다.
// 요청 141: calc-series geo 에서 r=1.1·n≥9 면 P 의 높이가 y 범위 밖 — 점은 잘리는데 손잡이(HTML)는 그림 위로 떠올랐다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordParams,
  type CoordState,
  coordChecks,
  coordDef,
  dragPoint,
  draw,
  frame,
  goalHits,
  initial,
  keyMove,
  parseCoord,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

/** m3-trig-ratio same 그대로 + P 의 끄는 범위 */
const sameRaw = (range?: unknown) => ({
  mode: 'explore',
  x: { min: 0, max: 12, step: 1 },
  y: { min: 0, max: 9, step: 1 },
  objects: [
    { id: 's', curve: '3*x/4' },
    { id: 'O', point: { on: 's', x: 0 }, name: 'O' },
    {
      id: 'P',
      point: { on: 's', x: 4, drag: 'x', snap: 1, ...(range ? { range } : {}) },
      name: 'P',
    },
    { readout: 'x(P)', label: '수평 거리', digits: 0 },
    { readout: 'y(P)', label: '높이', digits: 2 },
    { readout: 'slope(O,P)', label: '높이 ÷ 수평 거리', digits: 2 },
  ],
  intro: 'P 를 여러 자리에 놓아 보세요.',
  done: '모두 높이 ÷ 수평 거리가 같아요.',
  goal: {
    value: { of: 'slope(O,P)', is: '3/4', places: 3 },
    hint: 'P 를 놓을 때마다 수평 거리와 높이가 함께 몇 배가 되는지 보세요.',
  },
});

const atI = (p: CoordParams, i: number, id = 'P'): CoordState => ({
  ...initial(p),
  pts: { ...initial(p).pts, [id]: { i, j: 0 } },
});

test('요청 127 재현: 범위가 없으면 P=O 상태가 목표 판정에 들어가 3/4 로 센다', () => {
  const p = parseCoord(sameRaw());
  assert.deepEqual(goalHits(p, atI(p, 0)), ['P:0,0']);
  const g = coordChecks(p).find((c) => c.name === '목표 판정');
  assert.ok(g && 'kind' in g && g.kind === 'goal');
  assert.equal(g.states.length, 13);
});

test('요청 127 해결: range [1,12] 면 끌기·방향키가 O 자리로 못 가고, 검산도 그 상태를 늘어놓지 않는다', () => {
  const p = parseCoord(sameRaw([1, 12]));
  const f = frame(BOX, p);
  const [X0, Y0] = toPx(p, f, 0, 0);
  assert.equal(dragPoint(p, initial(p), 'P', X0, Y0, BOX).pts.P?.i, 1);
  assert.equal(keyMove(p, atI(p, 1), 'P', 'ArrowLeft')?.pts.P?.i, 1);
  coordDef.deep?.(p);
  const cs = coordChecks(p);
  const g = cs.find((c) => c.name === '목표 판정');
  assert.ok(g && 'kind' in g && g.kind === 'goal');
  assert.equal(g.states.length, 12);
  assert.ok(g.states.every((st) => st.pt_P_x !== '0'));
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
});

test('범위: 손잡이의 값 범위(aria)도 끄는 범위, 칸 위 점(xy)은 x 만 범위 안으로', () => {
  const p = parseCoord(sameRaw([1, 12]));
  const h = draw(p, initial(p), BOX).handles.find((x) => x.key === 'P');
  assert.equal(h?.min, 1);
  assert.equal(h?.max, 12);
  const q = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 6, step: 1 },
    y: { min: 0, max: 6, step: 1 },
    objects: [{ id: 'R', point: { x: 2, y: 2, drag: 'xy', range: [2, 4] }, name: 'R' }],
  });
  const f = frame(BOX, q);
  const [X, Y] = toPx(q, f, 6, 5);
  assert.deepEqual(dragPoint(q, initial(q), 'R', X, Y, BOX).pts.R, { i: 4, j: 5 });
  assert.deepEqual(keyMove(q, initial(q), 'R', 'ArrowLeft')?.pts.R, { i: 2, j: 2 });
  assert.deepEqual(keyMove(q, initial(q), 'R', 'ArrowUp')?.pts.R, { i: 2, j: 3 });
});

test('형식 오류: 끌 수 없는 점·칸 밖 끝·처음 자리가 범위 밖·축 밖·한 칸뿐', () => {
  const bad = (pt: Record<string, unknown>) => () =>
    parseCoord({
      ...sameRaw(),
      objects: [
        { id: 's', curve: '3*x/4' },
        { id: 'P', point: { on: 's', ...pt }, name: 'P' },
      ],
      goal: undefined,
    });
  assert.throws(bad({ x: 4, range: [1, 12] }), /끄는 점만/);
  assert.throws(bad({ x: 4, drag: 'x', snap: 1, range: [1.5, 12] }), /칸 위가 아님/);
  assert.throws(bad({ x: 4, drag: 'x', snap: 1, range: [5, 12] }), /처음 자리/);
  assert.throws(bad({ x: 4, drag: 'x', snap: 1, range: [1, 13] }), /축 밖/);
  assert.throws(bad({ x: 4, drag: 'x', snap: 1, range: [4, 4] }), /두 칸 이상/);
  assert.throws(bad({ x: 4, drag: 'x', snap: 1, range: '[1,12]' }), /목록/);
});

test('요청 141: 끄는 점이 y 범위 밖으로 가도 손잡이는 그림 테두리 안(위 끝)에 붙는다', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 20, step: 1 },
    y: { min: 0, max: 12, step: 2 },
    sliders: [{ id: 'r', min: '1/10', max: '13/10', step: '1/5', value: '1/2', label: '공비 $r$' }],
    objects: [
      { id: 'S', curve: '(1-r**x)/(1-r)' },
      { id: 'P', point: { on: 'S', x: 1, drag: 'x', snap: 1 }, name: 'P' },
    ],
  });
  const f = frame(BOX, p);
  const s: CoordState = { ...initial(p), vars: { r: 1.1 }, pts: { P: { i: 15, j: 0 } } };
  const h = draw(p, s, BOX).handles[0];
  assert.ok(h);
  assert.equal(h.y, f.t);
  const [X] = toPx(p, f, 15, 0);
  assert.ok(Math.abs(h.x - X) < 0.1);
  // 값 글은 실제 높이 그대로(화면 낭독기가 테두리 자리를 실제 값으로 읽지 않게)
  assert.match(h.valueText, /^x 15, y 31\.77/);
});
