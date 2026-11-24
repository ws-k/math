// 좌표평면 조각 함수·구간만 그리기(한 기제)와 조각 끝의 빈 점(○)·찬 점(●).
// 본보기는 math2-limit sides(x<1 에서 x+1, x≥1 에서 4−x) — 지금 단원은 log(Abs(1-x))-log(1-x) 꼼수로 구간을 자른다.
// 단원 JSON 은 고치지 않고(단원 적용은 다음 묶음) 이 파일의 시험 장면으로 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordParams,
  type CoordState,
  coordChecks,
  coordDef,
  dragPoint,
  draw,
  fAt,
  frame,
  goalHits,
  type Item,
  initial,
  parseCoord,
  pointXY,
  readout,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

/** math2-limit sides 를 꼼수 식 없이: 한 곡선 f 의 두 조각, Q 는 f 위를 끈다 */
const sidesRaw = (over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: 2, step: '1/4' },
  y: { min: 0, max: 4, step: '1/2' },
  objects: [
    {
      id: 'f',
      curve: [
        { y: 'x+1', x: '[0,1)' },
        { y: '4-x', x: '[1,2]' },
      ],
    } as Record<string, unknown>,
    { id: 'Q', point: { on: 'f', x: '1/5', drag: 'x', snap: '1/20' }, name: 'Q' },
    { readout: 'y(Q)', label: 'Q 의 $y$' },
  ],
  ...over,
});

const at = (p: CoordParams, x: number, id = 'Q'): CoordState => ({
  ...initial(p),
  pts: { ...initial(p).pts, [id]: { i: Math.round(x * 20), j: 0 } },
});
const dots = (p: CoordParams, s: CoordState) =>
  draw(p, s, BOX).items.filter(
    (it): it is Extract<Item, { t: 'dot' }> => it.t === 'dot' && it.cls.startsWith('cend'),
  );
const curvePath = (p: CoordParams, s: CoordState) => {
  const it = draw(p, s, BOX).items.find((x) => x.t === 'path' && x.key === 'c0');
  return it?.t === 'path' ? it.d : '';
};

test('조각 함수: 값은 그 x 가 든 조각의 식, 경계에서는 닫힌 쪽(찬 점), 구간 밖은 정의 안 됨', () => {
  const p = parseCoord(sidesRaw());
  const s = initial(p);
  assert.equal(fAt(p, s, 'f', 0.5), 1.5);
  assert.equal(fAt(p, s, 'f', 1), 3);
  assert.equal(fAt(p, s, 'f', 1.5), 2.5);
  assert.ok(Number.isNaN(fAt(p, s, 'f', 2.5)));
});

test('구간만 그리기: curve 글자 + x 구간 하나 — 같은 기제(조각 하나)', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -1, max: 4, step: 1 },
    y: { min: -2, max: 4, step: 1 },
    objects: [{ id: 'f', curve: 'x**2-2*x', x: '[0,3]' }],
  });
  const s = initial(p);
  assert.equal(fAt(p, s, 'f', 3), 3);
  assert.ok(Number.isNaN(fAt(p, s, 'f', -0.5)));
  assert.ok(Number.isNaN(fAt(p, s, 'f', 3.5)));
  // 닫힌 두 끝(0 과 3)은 화면 안이라 찬 점
  const d = dots(p, s);
  assert.deepEqual(
    d.map((it) => [it.cls, it.hidden]),
    [
      ['cend closed main', false],
      ['cend closed main', false],
    ],
  );
  const f = frame(BOX, p);
  const [X0, Y0] = toPx(p, f, 0, 0);
  assert.ok(Math.abs((d[0]?.x ?? 0) - X0) < 0.1 && Math.abs((d[0]?.y ?? 0) - Y0) < 0.1);
});

test('조각 끝 표시: 경계 x=1 에서 왼쪽 조각은 빈 점(1,2), 오른쪽은 찬 점(1,3). 화면 끝(0·2)은 표시 안 함', () => {
  const p = parseCoord(sidesRaw());
  const f = frame(BOX, p);
  const d = dots(p, initial(p));
  assert.deepEqual(
    d.map((it) => [it.cls, it.hidden]),
    [
      ['cend open main', false],
      ['cend closed main', false],
    ],
  );
  const [X, Y2] = toPx(p, f, 1, 2);
  const [, Y3] = toPx(p, f, 1, 3);
  assert.ok(Math.abs((d[0]?.x ?? 0) - X) < 0.1 && Math.abs((d[0]?.y ?? 0) - Y2) < 0.1);
  assert.ok(Math.abs((d[1]?.y ?? 0) - Y3) < 0.1);
  // 경로는 조각마다 새로 시작(M) — 두 조각이 세로선으로 이어지지 않는다
  assert.equal((curvePath(p, initial(p)).match(/M/g) ?? []).length, 2);
});

test('조각 끝 표시: 이어지는 경계(같은 높이의 닫힘·열림)는 표시 안 함, 구멍(열림·열림)은 빈 점', () => {
  const view = {
    mode: 'explore',
    x: { min: -2, max: 2, step: 1 },
    y: { min: -1, max: 3, step: 1 },
  };
  const joined = parseCoord({
    ...view,
    objects: [
      {
        id: 'f',
        curve: [
          { y: '-x', x: '[-2,0]' },
          { y: 'x', x: '(0,2]' },
        ],
      },
    ],
  });
  assert.ok(dots(joined, initial(joined)).every((it) => it.hidden));
  const hole = parseCoord({
    ...view,
    objects: [
      {
        id: 'f',
        curve: [
          { y: '(x**2-1)/(x-1)', x: '[-2,1)' },
          { y: '(x**2-1)/(x-1)', x: '(1,2]' },
          { y: '1', x: '[1,1]' },
        ],
      },
    ],
  });
  const s = initial(hole);
  assert.ok(Number.isNaN(fAt(hole, s, 'f', 0.999999)) === false);
  assert.equal(fAt(hole, s, 'f', 1), 1);
  const f = frame(BOX, hole);
  const [, Y2] = toPx(hole, f, 1, 2);
  const d = dots(hole, s);
  // 식이 x=1 에서 정의 안 돼도 빈 점은 극한 자리(1,2)에, 따로 정한 함숫값 (1,1) 은 찬 점
  const open = d.filter((it) => it.cls === 'cend open main');
  assert.equal(open.length, 2);
  assert.ok(open.every((it) => !it.hidden && Math.abs(it.y - Y2) < 0.5));
  assert.equal(d.filter((it) => it.cls === 'cend closed main' && !it.hidden).length, 1);
});

test('곡선 위 점: 조각을 따라 끌리고, 경계에서는 찬 점의 값. 구간 밖으로는 못 간다', () => {
  const p = parseCoord(sidesRaw());
  const s1 = at(p, 1);
  assert.deepEqual(pointXY(p, s1, 'Q'), [1, 3]);
  const ro = p.objects.find((o) => o.kind === 'readout');
  assert.ok(ro?.kind === 'readout');
  assert.equal(readout(p, at(p, 0.95), ro.expr), 1.95);
  // 구간만 그린 곡선 위 점은 정의 안 되는 곳으로 끌리지 않는다(제자리)
  const q = parseCoord({
    mode: 'explore',
    x: { min: -1, max: 4, step: 1 },
    y: { min: -2, max: 4, step: 1 },
    objects: [
      { id: 'f', curve: 'x**2-2*x', x: '[0,3]' },
      { id: 'P', point: { on: 'f', x: 1, drag: 'x' }, name: 'P' },
    ],
  });
  const f = frame(BOX, q);
  const [X] = toPx(q, f, -1, 0);
  const n = dragPoint(q, initial(q), 'P', X, 50, BOX);
  assert.deepEqual(n.pts.P, initial(q).pts.P);
});

test('형식 오류: 구간 글자·겹치는 조각·화면 밖 조각·열린 한 점·x 를 두 번', () => {
  const bad =
    (curve: unknown, extra: Record<string, unknown> = {}) =>
    () =>
      parseCoord(sidesRaw({ objects: [{ id: 'f', curve, ...extra }] }));
  assert.throws(bad([{ y: 'x', x: '[0,1' }]), /구간/);
  assert.throws(bad([{ y: 'x', x: [0, 1] }]), /구간/);
  assert.throws(
    bad([
      { y: 'x', x: '[0,1]' },
      { y: '1', x: '[1,2]' },
    ]),
    /겹침/,
  );
  assert.throws(bad([{ y: 'x', x: '[3,4]' }]), /화면 밖/);
  assert.throws(bad([{ y: 'x', x: '(1,1]' }]), /한 점/);
  assert.throws(bad([{ y: 'x', x: '[1,0]' }]), /작아야/);
  assert.throws(bad([{ y: 'x', x: '[0,1]' }], { x: '[0,1]' }), /조각마다/);
  assert.throws(bad([{ y: 'x' }]), /x/);
});

test('형식 오류: 조각·구간 곡선은 실근 개수·칠하기·구분구적·과제 곡선으로 아직 못 씀', () => {
  const pieceCurve = { id: 'f', curve: 'x', x: '[0,1]' };
  const base = sidesRaw({ objects: [pieceCurve] });
  assert.throws(
    () => parseCoord({ ...base, objects: [pieceCurve, { readout: 'roots(f)', label: '근' }] }),
    /아직 못 씀/,
  );
  assert.throws(
    () => parseCoord({ ...base, objects: [pieceCurve, { fill: { top: 'f', x: [0, 1] } }] }),
    /아직 못 씀/,
  );
  assert.throws(
    () =>
      parseCoord({
        ...base,
        objects: [pieceCurve, { id: 'R', rects: { of: 'f', x: [0, 1], n: 4 } }],
      }),
    /아직 못 씀/,
  );
  assert.throws(
    () =>
      parseCoord({
        ...base,
        mode: 'plot',
        objects: [pieceCurve],
        task: { pointsOn: { curve: 'f', count: 2 } },
      }),
    /아직 못 씀/,
  );
});

test('좁은 화면 형식 검사: 조각 끝 표시끼리 가로로 너무 붙으면 형식 오류(○·● 가 겹침)', () => {
  assert.throws(
    () =>
      parseCoord(
        sidesRaw({
          x: { min: 0, max: 8, step: '1/4' },
          objects: [
            {
              id: 'f',
              curve: [
                { y: 'x+1', x: '[0,1)' },
                { y: '3', x: '[1,5/4]' },
                { y: '4-x', x: '(5/4,2]' },
              ],
            },
          ],
        }),
      ),
    /좁은 화면/,
  );
});

test('검산: 조각 함수 계산은 sympy Piecewise 와 같다(경계 점 포함, 구간 밖은 양쪽 다 정의 안 됨)', () => {
  const p = parseCoord(sidesRaw());
  const cs = coordChecks(p);
  const it = cs.find((c) => c.name === '곡선 f 계산');
  assert.ok(it && 'kind' in it && it.kind === 'parity');
  assert.match(it.expr, /^Piecewise\(/);
  const xs = it.points.map((pt) => pt.x);
  assert.ok(xs.includes('1'));
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  // 경계에서 열린 쪽 값을 낸 것처럼 바꾸면 sympy 가 잡는다
  const k = xs.indexOf('1');
  const bad = cs.map((c) =>
    c === it ? { ...it, values: it.values.map((v, j) => (j === k ? 2 : v)) } : c,
  );
  assert.equal(runChecks(bad).ok, false);
});

test('검산: 빈 점 자리(열린 끝의 식 값)·미분·목표가 sympy 와 같다', () => {
  // 목표가 보는 점은 좁은 화면에서 한 칸이 8px 이상이어야 해서(goal.ts snapsOk) 끄는 간격을 1/10 로
  const [f, , ro] = sidesRaw().objects;
  const p = parseCoord(
    sidesRaw({
      objects: [
        f,
        // 접선·deriv 가 쓰이면 정의역 끝(0·2)과 끊긴 경계(1)에 닿지 않게 범위를 둔다(smooth.ts)
        {
          id: 'Q',
          point: { on: 'f', x: '1/5', drag: 'x', snap: '1/10', range: ['1/10', '9/10'] },
          name: 'Q',
        },
        ro,
        { tangent: { on: 'f', at: 'Q' } },
        { readout: 'deriv(f,Q)', label: '기울기' },
      ],
      goal: { value: { of: 'y(Q)', is: '19/10' }, hint: '왼쪽에서 1 바로 앞까지' },
    }),
  );
  coordDef.deep?.(p);
  const cs = coordChecks(p);
  const names = cs.map((c) => c.name);
  assert.ok(names.includes('곡선 f 조각1 빈 점'));
  assert.ok(names.includes('곡선 f 미분'));
  const q = (x: number): CoordState => ({
    ...initial(p),
    pts: { Q: { i: Math.round(x * 10), j: 0 } },
  });
  assert.deepEqual(goalHits(p, q(0.9)), ['0']);
  assert.deepEqual(goalHits(p, q(1)), []);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
});

test('조각 아닌 곡선의 검산 항목은 그대로(기존 장면 불변)', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 2, step: 1 },
    y: { min: 0, max: 4, step: 1 },
    objects: [{ id: 'f', curve: 'x**2' }],
  });
  const [c] = coordChecks(p);
  assert.ok(c && 'kind' in c && c.kind === 'parity');
  assert.equal(c.expr, 'x**2');
  assert.equal(c.points.length, 9);
});

test('형식 오류: 닫힌 끝(찬 점)에서 식이 정의 안 되면 — 찬 점을 그릴 자리가 없다', () => {
  assert.throws(
    () => parseCoord(sidesRaw({ objects: [{ id: 'f', curve: [{ y: '1/(x-1)', x: '[0,1]' }] }] })),
    /닫힌 끝 x=1/,
  );
});
