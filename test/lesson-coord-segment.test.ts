// 좌표평면 선분·화살표(세로 벡터 포함). 본보기는 geo-vector-ops — 지금 단원은 x/4+Abs(sqrt(x*(4-x)))-sqrt(x*(4-x))
// 같은 꼼수 식(구간 밖에서 허수가 되게 해 곡선을 자름)으로 벡터를 그려 세로 벡터를 못 그리고 화살촉도 없다.
// 단원 JSON 은 고치지 않고(단원 적용은 다음 묶음) 이 파일의 시험 장면으로 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordParams,
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

/** geo-vector-ops scale 를 꼼수 식 없이: k a 의 끝이 슬라이더 식 (2k, k) */
const scaleRaw = (over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: -5, max: 6, step: 1 },
  y: { min: -3, max: 4, step: 1 },
  sliders: [{ id: 'k', min: -2, max: 3, step: '1/2', value: 2, label: '$k$' }],
  objects: [
    { id: 'O', point: { x: 0, y: 0 }, name: 'O' },
    { id: 'A', point: { x: 2, y: 1 }, name: 'A' },
    { arrow: ['O', 'A'], tone: 'soft', label: '$\\vec a=(2,1)$' },
    { arrow: ['O', ['2*k', 'k']], tone: 'accent', label: '$k\\vec a$' },
    { readout: 'value(k)', label: '$k$', digits: 1 },
  ] as Record<string, unknown>[],
  ...over,
});

const withK = (p: CoordParams, k: number): CoordState => ({
  ...initial(p),
  vars: { k },
});
const lines = (p: CoordParams, s: CoordState) =>
  draw(p, s, BOX).items.filter(
    (it): it is Extract<Item, { t: 'line' }> => it.t === 'line' && it.cls.startsWith('seg'),
  );
const heads = (p: CoordParams, s: CoordState) =>
  draw(p, s, BOX).items.filter(
    (it): it is Extract<Item, { t: 'path' }> => it.t === 'path' && it.cls.startsWith('ahead'),
  );

test('화살표: 점 이름 끝·슬라이더 식 끝, 꼬리에서 머리 쪽으로 화살대 + 화살촉', () => {
  const p = parseCoord(scaleRaw());
  const f = frame(BOX, p);
  const s = withK(p, 2);
  const ls = lines(p, s);
  assert.deepEqual(
    ls.map((l) => [l.cls, l.hidden]),
    [
      ['seg soft', false],
      ['seg accent', false],
    ],
  );
  const [X0, Y0] = toPx(p, f, 0, 0);
  const [X4, Y2] = toPx(p, f, 4, 2);
  const ka = ls[1] as Extract<Item, { t: 'line' }>;
  assert.ok(Math.abs(ka.x1 - X0) < 0.1 && Math.abs(ka.y1 - Y0) < 0.1);
  // 화살대는 화살촉 밑에서 끝난다(굵은 선이 뾰족한 끝을 뭉개지 않게) — 끝은 머리 쪽으로 머리 길이보다 덜 감
  const L = Math.hypot(X4 - X0, Y2 - Y0);
  assert.ok(Math.hypot(ka.x2 - X0, ka.y2 - Y0) < L);
  const hs = heads(p, s);
  assert.equal(hs.length, 2);
  // 화살촉 뾰족한 끝 = 머리 자리
  const tip = (hs[1]?.d ?? '').match(/^M(-?[\d.]+) (-?[\d.]+)/);
  assert.ok(tip && Math.abs(Number(tip[1]) - X4) < 0.1 && Math.abs(Number(tip[2]) - Y2) < 0.1);
});

test('화살표: k=0 이면 길이 0 — 화살대·화살촉을 숨긴다(항목은 그대로, 끄는 동안 key 불변)', () => {
  const p = parseCoord(scaleRaw());
  const s = withK(p, 0);
  assert.equal(lines(p, s)[1]?.hidden, true);
  assert.equal(heads(p, s)[1]?.d, '');
  assert.deepEqual(
    draw(p, s, BOX).items.map((it) => it.key),
    draw(p, withK(p, 2), BOX).items.map((it) => it.key),
  );
});

test('세로 벡터·선분: 꼼수 식으로 못 그리던 x 가 같은 두 끝', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -1, max: 4, step: 1 },
    y: { min: -1, max: 4, step: 1 },
    objects: [
      { id: 'P', point: { x: 1, y: 0 }, name: 'P' },
      { arrow: ['P', [1, 3]] },
      {
        segment: [
          [3, 0],
          [3, 3],
        ],
      },
    ],
  });
  const f = frame(BOX, p);
  const s = initial(p);
  const ls = lines(p, s);
  assert.equal(ls.length, 2);
  assert.ok(ls.every((l) => !l.hidden && Math.abs(l.x1 - l.x2) < 0.01));
  const [, Y3] = toPx(p, f, 3, 3);
  assert.ok(Math.abs((ls[1]?.y2 ?? 0) - Y3) < 0.1);
  // 선분은 화살촉이 없다
  assert.equal(heads(p, s).length, 1);
  assert.equal(ls[1]?.cls, 'seg main');
});

test('끄는 점을 끝으로 쓰면 점을 따라 움직인다', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1 },
    y: { min: 0, max: 4, step: 1 },
    objects: [
      { id: 'O', point: { x: 0, y: 0 } },
      { id: 'P', point: { x: 1, y: 1, drag: 'xy' }, name: 'P' },
      { arrow: ['O', 'P'] },
    ],
  });
  const f = frame(BOX, p);
  const s: CoordState = { ...initial(p), pts: { ...initial(p).pts, P: { i: 3, j: 2 } } };
  const [X, Y] = toPx(p, f, 3, 2);
  const tip = (heads(p, s)[0]?.d ?? '').match(/^M(-?[\d.]+) (-?[\d.]+)/);
  assert.ok(tip && Math.abs(Number(tip[1]) - X) < 0.1 && Math.abs(Number(tip[2]) - Y) < 0.1);
});

test('형식 오류: 화면 밖 끝(슬라이더 값마다)·모르는 점·x 를 쓴 식·같은 선분 두 번·좁은 화면에서 너무 짧은 화살표', () => {
  const objs = (extra: Record<string, unknown>) =>
    scaleRaw({ objects: [...scaleRaw().objects, extra] });
  // k 를 처음 값(2)이 아닌 칸까지 다 본다: k=−2 이면 (−6, −2) — 화면 밖(x 는 −5 부터)
  assert.throws(
    () => parseCoord(objs({ arrow: ['O', ['3*k', 'k']] })),
    /화면 밖 끝 \(-6, -2\) — k=-2/,
  );
  assert.throws(() => parseCoord(objs({ arrow: ['O', 'Z'] })), /앞에 없는 점 Z/);
  assert.throws(() => parseCoord(objs({ arrow: ['O', ['x', 1]] })), /쓸 수 없는 변수 x/);
  assert.throws(() => parseCoord(objs({ arrow: ['O', 'A'] })), /같은 선분이 두 번/);
  assert.throws(() => parseCoord(objs({ arrow: ['O', [1, 2, 3]] })), /2~2개/);
  // 가장 좁은 화면에서 (0,0)→(1/2·k 의 가장 작은 0 아닌 값) 길이가 화살촉보다 짧다
  assert.throws(
    () =>
      parseCoord(
        scaleRaw({
          x: { min: -20, max: 20, step: 1 },
          y: { min: -10, max: 10, step: 1 },
          objects: [
            {
              arrow: [
                [0, 0],
                ['k/4', 0],
              ],
            },
          ],
        }),
      ),
    /좁은 화면/,
  );
  // 두 끝이 늘 같은 자리면 그릴 것이 없다
  assert.throws(() => parseCoord(objs({ segment: ['A', [2, 1]] })), /두 끝이 같음/);
});

test('검산: 슬라이더 식 끝은 슬라이더 칸마다 앱 계산 = sympy(parity), 고정 끝은 항목 없음', () => {
  const p = parseCoord(scaleRaw());
  coordDef.deep?.(p);
  const cs = coordChecks(p);
  const ends = cs.filter((c) => c.name.startsWith('화살표'));
  assert.deepEqual(
    ends.map((c) => c.name),
    ['화살표 O→(2*k,k) 머리 x', '화살표 O→(2*k,k) 머리 y'],
  );
  const hx = ends[0];
  assert.ok(hx && 'kind' in hx && hx.kind === 'parity');
  assert.equal(hx.points.length, 11);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  const bad = cs.map((c) =>
    c === hx ? { ...hx, values: hx.values.map((v, j) => (j === 3 ? (v ?? 0) + 1 : v)) } : c,
  );
  assert.equal(runChecks(bad).ok, false);
});

test('범례·글: 화살표 label 이 범례 글로 들어간다', () => {
  const p = parseCoord(scaleRaw());
  const t = coordDef.texts?.(p) ?? [];
  assert.ok(t.includes('$k\\vec a$') && t.includes('$\\vec a=(2,1)$'));
});

test('본보기: geo-vector-ops tiptotail 을 화살표로(꼼수 곡선 없이) — 형식·검산 통과', () => {
  const p = parseCoord({
    mode: 'plot',
    x: { min: -1, max: 6, step: 1 },
    y: { min: -1, max: 5, step: 1 },
    objects: [
      { id: 'O', point: { x: 0, y: 0 }, name: 'O' },
      { id: 'A', point: { x: 4, y: 1 }, name: 'A' },
      { id: 'B', point: { x: 1, y: 3 }, name: 'B' },
      { arrow: ['O', 'A'], label: '$\\vec a$: $O$ 에서 $A$ 로' },
      { arrow: ['O', 'B'], label: '$\\vec b$: $O$ 에서 $B$ 로', tone: 'accent' },
    ],
    task: { point: { x: { value: '5', check: '4+1' }, y: { value: '4', check: '1+3' } } },
  });
  coordDef.deep?.(p);
  assert.equal(heads(p, initial(p)).length, 2);
  const r = runChecks(coordChecks(p));
  assert.ok(r.ok, r.out);
});
