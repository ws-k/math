// 좌표평면 따라오는 점(요청 50·129·137): 좌표를 슬라이더·앞에 나온 점의 x(P)·y(P) 식으로 적으면 그 값을 따라 움직인다.
// 본보기: h1-transform graph(꼭짓점이 h 를 따라 (h, 0)), math2-indefinite shift(R 이 P 와 같은 세로줄의 다른 곡선 위).
// 끌지 않는 점이라 손잡이가 없고, 끄는 동안 다른 점처럼 같은 key 의 항목 값만 바뀐다(React 렌더 0회 — P8).
// 단원 JSON 은 고치지 않는다(단원 적용은 3-아) — 이 파일의 시험 장면으로 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordState,
  coordChecks,
  coordDef,
  draw,
  frame,
  goalHits,
  initial,
  parseCoord,
  pointXY,
  readout,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 298, h: 200 };

/** h1-transform graph: 꼭짓점 V 가 (h, 0) 을 따라온다 */
const vertexRaw = (over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: -5, max: 5, step: 1 },
  y: { min: -1, max: 9, step: 1 },
  sliders: [{ id: 'h', min: -3, max: 3, step: 1, value: 0, label: '$h$' }],
  objects: [
    { id: 'g', curve: '(x-h)**2' },
    { id: 'V', point: { x: 'h', y: 0 }, name: '꼭짓점' },
  ] as Record<string, unknown>[],
  ...over,
});

/** math2-indefinite shift: R 은 P 와 같은 x 의 다른 곡선 위, H 는 P 에서 가로축에 내린 발, K 는 H 를 따라오는 점 */
const shiftRaw = (over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: -2, max: 2, step: '1/2' },
  y: { min: -4, max: 7, step: 1 },
  sliders: [{ id: 'c', min: -3, max: 3, step: 1, value: 0, label: '$C$' }],
  objects: [
    { id: 'g', curve: 'x**2', tone: 'soft' },
    { id: 'F', curve: 'x**2+c' },
    { id: 'P', point: { on: 'F', x: -1, drag: 'x', snap: '1/2' }, name: 'P' },
    { id: 'R', point: { on: 'g', x: 'x(P)' }, name: 'R' },
    { tangent: { on: 'g', at: 'R' } },
    { id: 'H', point: { x: 'x(P)', y: 0 }, name: 'H' },
    { id: 'K', point: { x: 'x(H)/2', y: 'y(R)-c' } },
    { readout: 'deriv(g,R)', label: 'R 의 기울기' },
    { readout: 'y(K)', label: 'K 의 높이' },
  ] as Record<string, unknown>[],
  ...over,
});

const at = (s: CoordState, i: number, c = 0): CoordState => ({
  ...s,
  vars: { ...s.vars, c },
  pts: { ...s.pts, P: { i, j: 0 } },
});

test('슬라이더를 따라오는 점: (h, 0) — h 를 바꾸면 자리가 따라간다, 손잡이 없음', () => {
  const p = parseCoord(vertexRaw());
  const s = initial(p);
  assert.deepEqual(pointXY(p, s, 'V'), [0, 0]);
  assert.deepEqual(pointXY(p, { ...s, vars: { h: 2 } }, 'V'), [2, 0]);
  assert.deepEqual(pointXY(p, { ...s, vars: { h: -3 } }, 'V'), [-3, 0]);
  const d = draw(p, { ...s, vars: { h: 2 } }, BOX);
  assert.equal(d.handles.length, 0);
  const f = frame(BOX, p);
  const [X, Y] = toPx(p, f, 2, 0);
  const dot = d.items.find((it) => it.t === 'dot');
  assert.ok(dot && dot.t === 'dot' && !dot.hidden && dot.cls === 'pt');
  assert.ok(Math.abs(dot.x - X) < 0.1 && Math.abs(dot.y - Y) < 0.1);
});

test('다른 점·곡선을 따라오는 점: R=(x(P), g(x(P))), H=(x(P), 0), K=(x(H)/2, y(R)−c) — 줄줄이 따라온다', () => {
  const p = parseCoord(shiftRaw());
  const s = at(initial(p), 3, 2); // P 는 x=3/2, c=2
  assert.deepEqual(pointXY(p, s, 'R'), [1.5, 2.25]);
  assert.deepEqual(pointXY(p, s, 'H'), [1.5, 0]);
  assert.deepEqual(pointXY(p, s, 'K'), [0.75, 0.25]);
  // 따라오는 점을 가리키는 읽는 값도 따라간다(분수로 정확히: deriv 는 2·(3/2) = 3, K 의 높이 = 9/4 − 2)
  const rs = draw(p, s, BOX).readouts;
  assert.deepEqual(
    rs.map((r) => r.text),
    ['3', '0.25'],
  );
  const ky = p.objects[8];
  assert.ok(ky?.kind === 'readout');
  assert.ok(Math.abs(readout(p, s, ky.expr) - 0.25) < 1e-12);
});

test('끄는 동안 렌더 0회의 바탕: P·c 가 바뀌어도 그릴 목록 key 가 같고, 따라오는 점의 값만 바뀐다', () => {
  const p = parseCoord(shiftRaw());
  const a = draw(p, at(initial(p), -2, 0), BOX);
  const b = draw(p, at(initial(p), 4, 3), BOX);
  assert.deepEqual(
    a.items.map((it) => it.key),
    b.items.map((it) => it.key),
  );
  const dot = (d: typeof a, k: string) => d.items.find((it) => it.key === k);
  // R(객체 순번 3)의 점이 움직였다
  assert.notDeepEqual(dot(a, 'd3'), dot(b, 'd3'));
});

test('따라오는 점이 그림 밖(곡선이 y 범위를 넘음)이면 점·이름표를 숨긴다 — 이름표가 그림 밖으로 떠 있지 않게', () => {
  const raw = shiftRaw();
  // y 범위를 좁혀 P 가 x=2 일 때 R=(2, 4) 가 그림 위로 나가게
  const tight = { ...raw, y: { min: -4, max: 3, step: 1 } };
  const p = parseCoord(tight);
  const d = draw(p, at(initial(p), 4), BOX);
  const R = d.items.filter((it) => it.key === 'd3' || it.key === 'n3');
  assert.equal(R.length, 2);
  assert.ok(R.every((it) => 'hidden' in it && it.hidden));
  // 안으로 돌아오면 다시 보인다
  const back = draw(p, at(initial(p), 2), BOX).items.filter(
    (it) => it.key === 'd3' || it.key === 'n3',
  );
  assert.ok(back.every((it) => 'hidden' in it && !it.hidden));
});

test('목표가 따라오는 점의 읽는 값을 보면, 그 점을 움직이는 끄는 점·슬라이더를 늘어놓는다', () => {
  const p = parseCoord(
    shiftRaw({
      goal: { value: { of: 'deriv(g,R)', is: 2 }, hint: 'R 의 기울기가 2 가 되게' },
    }),
  );
  assert.doesNotThrow(() => coordDef.deep?.(p));
  assert.deepEqual(goalHits(p, at(initial(p), 2)), ['0']);
  assert.deepEqual(goalHits(p, at(initial(p), 1)), []);
});

test('형식 오류: 끌기·범위를 붙인 따라오는 점, 모르는 점, x 를 쓴 식, 화면 밖(슬라이더 값마다), 조각 곡선 위', () => {
  const objs = (extra: Record<string, unknown>) =>
    shiftRaw({ objects: [...shiftRaw().objects, extra] });
  assert.throws(
    () => parseCoord(objs({ id: 'Q', point: { x: 'x(P)', y: 1, drag: 'xy' } })),
    /따라오는 점.*끌지 않음/,
  );
  assert.throws(
    () => parseCoord(objs({ id: 'Q', point: { on: 'g', x: 'x(P)', snap: 1 } })),
    /따라오는 점/,
  );
  assert.throws(() => parseCoord(objs({ id: 'Q', point: { x: 'x(Z)', y: 0 } })), /앞에 없는 점 Z/);
  assert.throws(
    () => parseCoord(objs({ id: 'Q', point: { x: 'x+1', y: 0 } })),
    /쓸 수 없는 변수 x/,
  );
  // 점 좌표의 자리표 글자(u·y …)를 직접 적어도 점 좌표로 몰래 읽히지 않는다
  assert.throws(
    () => parseCoord(objs({ id: 'Q', point: { x: 'u+x(P)', y: 0 } })),
    /쓸 수 없는 변수 u: u\+x\(P\)/,
  );
  // 슬라이더만 따라오는 점은 닿는 모든 칸에서 화면 안이어야: h=3 이면 (h+3, 0) = (6, 0)
  assert.throws(
    () =>
      parseCoord(
        vertexRaw({
          objects: [...vertexRaw().objects, { id: 'W', point: { x: 'h+3', y: 0 } }],
        }),
      ),
    /화면 밖.*h=3/,
  );
  assert.throws(
    () =>
      parseCoord(
        shiftRaw({
          objects: [
            ...shiftRaw().objects,
            { id: 'u', curve: [{ y: 'x', x: '[-2,2]' }] },
            { id: 'Q', point: { on: 'u', x: 'x(P)' } },
          ],
        }),
      ),
    /조각·구간 곡선 u 은 따라오는 점/,
  );
  assert.throws(
    () => parseCoord(objs({ id: 'Q', point: { x: 'x(P)', y: 0 }, hide: true })),
    /숨기/,
  );
});

test('형식 오류: 따라오는 점은 칠하기 끝·막대 고르기 끝·목표 점으로 못 씀(닿는 칸을 늘어놓을 수 없음)', () => {
  const objs = (extra: Record<string, unknown>[]) =>
    shiftRaw({ objects: [...shiftRaw().objects, ...extra] });
  assert.throws(() => parseCoord(objs([{ fill: { top: 'g', x: [-2, 'H'] } }])), /따라오는 점 H/);
  assert.throws(() => parseCoord(shiftRaw({ goal: { approach: ['P', 'H'] } })), /따라오는 점 H/);
  assert.throws(
    () =>
      parseCoord(
        objs([
          { id: 'N', curve: { normal: [0, 1] } },
          { id: 'A', shade: { of: 'N', x: [null, 'H'] } },
        ]),
      ),
    /따라오는 점 H/,
  );
});

test('검산: 따라오는 점의 자리 — 끄는 점 칸 × 슬라이더 칸마다 앱 계산 = sympy(parity), 망가뜨리면 실패', () => {
  const p = parseCoord(shiftRaw());
  const cs = coordChecks(p);
  const fol = cs.filter((c) => c.name.startsWith('따라오는 점'));
  assert.deepEqual(
    fol.map((c) => c.name),
    ['따라오는 점 R x', '따라오는 점 R y', '따라오는 점 H x', '따라오는 점 K x', '따라오는 점 K y'],
  );
  const ry = fol[1];
  assert.ok(ry && 'kind' in ry && ry.kind === 'parity');
  // P 의 칸 9개 × c 의 칸 7개 — 다 센다(상한 안)
  assert.equal(ry.points.length, 63);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  const bad = cs.map((c) =>
    c === ry ? { ...ry, values: ry.values.map((v, j) => (j === 5 ? (v ?? 0) + 1 : v)) } : c,
  );
  assert.equal(runChecks(bad).ok, false);
});

test('따라오는 점을 끝으로 쓴 선분은 따라 움직이고, 슬라이더만 따라오는 끝은 선분 검사(화면 밖·같은 선분)도 칸마다 본다', () => {
  const raw = vertexRaw({
    objects: [
      ...vertexRaw().objects,
      { id: 'O', point: { x: 0, y: 0 } },
      { segment: ['O', 'V'] },
      { id: 'T', point: { x: 'h', y: 'h**2/2+1' }, name: 'T' },
      { segment: ['V', 'T'] },
    ],
  });
  const p = parseCoord(raw);
  const seg = (h: number) =>
    draw(p, { ...initial(p), vars: { h } }, BOX).items.filter(
      (it) => it.t === 'line' && it.cls.startsWith('seg'),
    );
  const f = frame(BOX, p);
  const [X3] = toPx(p, f, 3, 0);
  const vt = seg(3)[1];
  assert.ok(vt && vt.t === 'line' && Math.abs(vt.x1 - X3) < 0.1 && Math.abs(vt.x2 - X3) < 0.1);
  // h=0 이면 O 와 V 가 겹쳐 선분 OV 는 길이 0(숨김) — 다른 칸에서는 보이므로 '두 끝이 늘 같음' 오류가 아니다
  const ov = seg(0)[0];
  assert.ok(ov?.t === 'line' && ov.hidden);
  // 높이 h²+1 이면 h=±3 에서 10 — y 범위(9)를 넘어 T 자체가 화면 밖(형식 오류)
  assert.throws(
    () =>
      parseCoord(
        vertexRaw({
          objects: [...vertexRaw().objects, { id: 'T', point: { x: 'h', y: 'h**2+1' } }],
        }),
      ),
    /화면 밖 \(-3, 10\) — h=-3/,
  );
});

test('검산: 슬라이더만 따라오는 점 (h, 0) 은 x 만 항목(y 는 수 그대로)', () => {
  const p = parseCoord(vertexRaw());
  const fol = coordChecks(p).filter((c) => c.name.startsWith('따라오는 점'));
  assert.deepEqual(
    fol.map((c) => c.name),
    ['따라오는 점 V x'],
  );
  const r = runChecks(coordChecks(p));
  assert.ok(r.ok, r.out);
});
