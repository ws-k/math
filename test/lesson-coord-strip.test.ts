// 좌표평면 길 띠(3-가): 그림에 붙는 1차원 띠(가로 — 그림 아래, 세로 — 그림 오른쪽) 위에 표식 하나. 표식 자리는 지정한
// 읽는 값(at), 표식 모양은 진행 방향(face 의 부호): 가로 띠는 걷는 사람(+ 오른쪽 · − 왼쪽 · 0 정면으로 선 모습),
// 세로 띠는 리프트 칸(+ 위 ▲ · − 아래 ▼ · 0 멈춤 =). 띠 눈금·숫자는 수직선(numberLine.ts nlTicks)을 읽어 쓴다.
// 본보기: math2-area-distance trip(속도 그래프 + 집 기준 위치 띠), math2-velocity move(리프트 높이 — 세로 띠).
// 단원 JSON 은 고치지 않는다(단원 적용은 3-나) — 이 파일의 시험 장면으로 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordState,
  coordChecks,
  coordDef,
  draw,
  frame,
  type Item,
  initial,
  narrowFrame,
  parseCoord,
  readout,
  STRIP_PX,
  stripAt,
  stripView,
} from '../src/lesson/widgets/coord.ts';
import { nlTicks } from '../src/lesson/widgets/numberLine.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

/** trip: 속도 v=4−2t 의 B 를 끌면 그때까지의 집 기준 위치 net(F) 가 띠 위 걷는 사람 자리. 방향은 그때의 속도 y(B) */
const tripRaw = (strip: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: 4, step: 1, unit: '시간' },
  y: { min: -4, max: 4, step: 2, name: '속도', unit: 'km/시', areaUnit: 'km' },
  objects: [
    { id: 'v', curve: '4-2*x', label: '속도 $v(t)=4-2t$' },
    { id: 'B', point: { on: 'v', x: 1, drag: 'x', snap: '1/4' }, name: 'B' },
    { id: 'F', fill: { top: 'v', x: [0, 'B'] }, sign: true },
    { readout: 'x(B)', label: '출발 뒤' },
    { readout: 'net(F)', label: '집 기준 위치' },
    { readout: 'abs(F)', label: '걸은 거리' },
  ],
  strip: {
    dir: 'x',
    min: 0,
    max: 4,
    step: '1/2',
    label: '1',
    unit: 'km',
    at: 'net(F)',
    face: 'y(B)',
    ...strip,
  },
  ...over,
});

/** move: 리프트 높이 h(t)=t³−6t²+9t (분·m). 시간 슬라이더 t 를 P 가 따라오고, 세로 띠의 리프트 칸 자리 = y(P) */
const liftRaw = (strip: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: 4, step: 1, name: '시간', unit: '분' },
  y: { min: -1, max: 5, step: 1, name: '높이', unit: 'm' },
  sliders: [{ id: 't', min: 0, max: 4, step: '1/4', value: 0, label: '시각 $t$' }],
  objects: [
    { id: 'X', curve: 'x**3-6*x**2+9*x', label: '높이 $h(t)$' },
    { id: 'P', point: { on: 'X', x: 't' }, name: 'P' },
    { readout: 'value(t)', label: '시각' },
    { readout: 'y(P)', label: '높이' },
  ],
  strip: {
    dir: 'y',
    min: -1,
    max: 5,
    step: '1',
    unit: 'm',
    at: 'y(P)',
    face: 'deriv(X,P)',
    ...strip,
  },
});

const atB = (p: ReturnType<typeof parseCoord>, i: number): CoordState => {
  const s = initial(p);
  return { ...s, pts: { ...s.pts, B: { i, j: 0 } } };
};
const atT = (p: ReturnType<typeof parseCoord>, t: number): CoordState => ({
  ...initial(p),
  vars: { t },
});
const outer = (p: ReturnType<typeof parseCoord>, s: CoordState) => draw(p, s, BOX).outer;
const pathOf = (its: Item[], key: string) => {
  const it = its.find((x) => x.key === key);
  assert.ok(it && it.t === 'path', key);
  return it.d;
};

test('가로 띠는 그림 아래 44px 를 쓴다 — 그림 영역 아래 끝이 그만큼 올라가고 다른 끝은 그대로', () => {
  const p = parseCoord(tripRaw());
  const q = parseCoord(tripRaw({}, { strip: undefined }));
  const f = frame(BOX, p);
  const g = frame(BOX, q);
  assert.equal(STRIP_PX, 44);
  assert.equal(f.b, g.b - STRIP_PX);
  assert.deepEqual([f.l, f.r, f.t], [g.l, g.r, g.t]);
  // 형식 검사도 같은 그림 영역으로 센다(가장 좁은 화면)
  assert.equal(narrowFrame(p).b, narrowFrame(q).b - STRIP_PX);
});

test('세로 띠는 그림 오른쪽 44px — 가로축 끝 글자 자리와 겹쳐 쓰고(글자는 띠 아래 눈금 줄), 더 넓은 쪽만 비운다', () => {
  // 단위만 '(분)'(24px)이면 글자 자리(14+28=42)보다 띠가 넓어 띠 폭만큼
  const short = parseCoord({ ...liftRaw(), x: { min: 0, max: 4, step: 1, unit: '분' } });
  const f = frame(BOX, short);
  assert.equal(f.r, BOX.w - STRIP_PX);
  assert.equal(f.b, BOX.h - 26);
  // '시간(분)'(46px)이면 글자 자리(64)가 띠보다 넓어 띠가 없을 때와 같은 폭 — 띠는 그 자리 위쪽을 쓴다
  const long = parseCoord(liftRaw());
  const { strip: _, ...noStrip } = liftRaw();
  assert.equal(frame(BOX, long).r, frame(BOX, parseCoord(noStrip)).r);
  assert.equal(frame(BOX, long).r, BOX.w - 64);
});

test('표식 자리 = 지정한 읽는 값: B 를 옮기면 걷는 사람이 띠 위 net(F) 자리로(끄는 점 칸마다)', () => {
  const p = parseCoord(tripRaw());
  const f = frame(BOX, p);
  for (const i of [0, 1, 4, 8, 11, 16]) {
    const s = atB(p, i);
    const want = readout(p, s, { f: 'net', fill: 'F' });
    const m = stripAt(p, s, BOX);
    assert.equal(m.v, want);
    // 띠 왼쪽 끝 = min(0), 오른쪽 끝 = max(4) — 그림 영역 가로 끝과 같은 자리
    const X = f.l + ((want - 0) / 4) * (f.r - f.l);
    assert.ok(Math.abs(m.px - X) < 0.06, `${i}: ${m.px} vs ${X}`);
  }
});

test('진행 방향: 속도 부호 + 는 오른쪽을 보고, − 는 좌우가 뒤집히고, 0 이면 정면으로 선 모습', () => {
  const p = parseCoord(tripRaw());
  // B 칸 4 = t=1(속도 2), 8 = t=2(속도 0 — 돌아서는 순간), 12 = t=3(속도 −2)
  const [go, stop, back] = [4, 8, 12].map((i) => stripAt(p, atB(p, i), BOX));
  assert.deepEqual([go?.face, stop?.face, back?.face], [1, 0, -1]);
  const dGo = pathOf(outer(p, atB(p, 4)), 'sw');
  const dBack = pathOf(outer(p, atB(p, 12)), 'sw');
  const dStop = pathOf(outer(p, atB(p, 8)), 'sw');
  // t=1 과 t=3 은 같은 자리(위치 3) — 같은 자리에서 좌우만 뒤집힌 그림
  assert.equal(stripAt(p, atB(p, 4), BOX).px, stripAt(p, atB(p, 12), BOX).px);
  const X = stripAt(p, atB(p, 4), BOX).px;
  // 선(M·L) 꼭짓점들. 머리 원(첫 M 과 호)은 빼고 본다 — 원은 가운데로 그리므로 시작점이 거울 자리가 아니다
  const pts = (d: string) =>
    [...d.replace(/^M[^a]*a[^a]*a[^ML]*/, '').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
  const mirror = (a: number[][], b: number[][]) =>
    a.length === b.length &&
    a.every((q, k) => {
      const r = b[k] as number[];
      return Math.abs(2 * X - (q[0] as number) - (r[0] as number)) < 0.15 && q[1] === r[1];
    });
  assert.notEqual(dGo, dBack);
  // 뒤집힌 그림 = 같은 자리 X 에 대한 거울(같은 차례의 꼭짓점이 X 반대편 같은 높이에)
  assert.ok(mirror(pts(dGo), pts(dBack)), `${dGo}\n${dBack}`);
  // 오른쪽을 볼 때 가장 앞 꼭짓점(얼굴 앞 꺾쇠)은 X 오른쪽
  assert.ok(Math.max(...pts(dGo).map((q) => q[0] as number)) > X + 8);
  // 멈춘 모습은 좌우 대칭(꼭짓점마다 거울 짝이 있고 앞을 가리키는 꺾쇠가 없다)
  const sp = pts(dStop);
  const X0 = stripAt(p, atB(p, 8), BOX).px;
  assert.ok(
    sp.every((q) =>
      sp.some(
        (r) => Math.abs(2 * X0 - (q[0] as number) - (r[0] as number)) < 0.15 && q[1] === r[1],
      ),
    ),
    dStop,
  );
  assert.ok(Math.max(...sp.map((q) => q[0] as number)) < X0 + 5);
});

test('세로 띠(리프트): 칸 자리 = y(P), 오를 때 ▲ · 내릴 때 ▼ · 멈출 때 = (속도 = deriv(X,P))', () => {
  const p = parseCoord(liftRaw());
  const f = frame(BOX, p);
  for (const t of [0, 0.5, 1, 2, 3, 3.75]) {
    const s = atT(p, t);
    const h = t ** 3 - 6 * t ** 2 + 9 * t;
    const m = stripAt(p, s, BOX);
    assert.ok(Math.abs(m.v - h) < 1e-12);
    const Y = f.b - ((h + 1) / 6) * (f.b - f.t);
    assert.ok(Math.abs(m.px - Y) < 0.06, `${t}`);
  }
  // 속도 3t²−12t+9: t=0 → 9(오름) · t=1 → 0(멈춤 — 돌아서는 순간) · t=2 → −3(내림) · t=3 → 0 · t=3.75 → 6.1875
  assert.deepEqual(
    [0, 1, 2, 3, 3.75].map((t) => stripAt(p, atT(p, t), BOX).face),
    [1, 0, -1, 0, 1],
  );
  const up = pathOf(outer(p, atT(p, 0)), 'sw');
  const down = pathOf(outer(p, atT(p, 2)), 'sw');
  const stop = pathOf(outer(p, atT(p, 1)), 'sw');
  assert.ok(new Set([up, down, stop]).size === 3);
  // 칸(테두리) 자리는 높이를 따라간다
  assert.ok(pathOf(outer(p, atT(p, 0)), 'sc') !== pathOf(outer(p, atT(p, 1)), 'sc'));
});

test('끄는 동안 렌더 0회의 바탕: B·t 를 바꿔도 띠 바깥 층(outer) 항목 key 가 같고 경로 글자만 바뀐다', () => {
  const p = parseCoord(tripRaw());
  const a = outer(p, atB(p, 0));
  const b = outer(p, atB(p, 13));
  assert.deepEqual(
    a.map((it) => it.key),
    b.map((it) => it.key),
  );
  assert.notDeepEqual(a, b);
  const l = parseCoord(liftRaw());
  assert.deepEqual(
    outer(l, atT(l, 0)).map((it) => it.key),
    outer(l, atT(l, 2.5)).map((it) => it.key),
  );
  // 띠가 없는 그림은 바깥 층이 비어 있다(지금 장면들은 그대로)
  assert.deepEqual(outer(parseCoord(tripRaw({}, { strip: undefined })), initial(p)), []);
});

test('띠 눈금·숫자 = 수직선 nlTicks 를 띠 길이에 옮긴 것(숫자 간격·단위 글자 그대로)', () => {
  const p = parseCoord(tripRaw());
  const f = frame(BOX, p);
  const v = stripView(p, BOX);
  const nl = nlTicks({ min: 0, max: 4, step: '1/2', label: '1', unit: 'km', points: [] });
  assert.equal(v.ticks.length, nl.length);
  nl.forEach((t, k) => {
    const X = f.l + ((t.x - 24) / 272) * (f.r - f.l);
    assert.ok(Math.abs((v.ticks[k] as number) - X) < 0.06);
  });
  assert.deepEqual(
    v.nums.map((n) => n.text),
    nl.flatMap((t) => (t.label ? [t.label] : [])),
  );
  assert.equal(v.nums.at(-1)?.text, '4 km');
  // 숫자는 띠 아래, 상자 안
  for (const n of v.nums) assert.ok(n.y > f.b + 26 && n.y <= BOX.h);
});

test('세로 띠 숫자는 띠 오른쪽, 단위는 띠 위에 따로(세로 숫자 줄 끝에 붙이면 폭을 넘음)', () => {
  const p = parseCoord(liftRaw());
  const v = stripView(p, BOX);
  assert.deepEqual(
    v.nums.map((n) => n.text),
    ['−1', '0', '1', '2', '3', '4', '5'],
  );
  assert.equal(v.unit?.text, '(m)');
  for (const n of v.nums) assert.ok(n.x > BOX.w - STRIP_PX && n.x < BOX.w);
});

test('형식: 읽는 값 객체가 없는 at · 띠에 못 쓰는 읽는 값 · 방향 없음 · 칸·범위 · 모르는 칸', () => {
  assert.throws(() => parseCoord(tripRaw({ at: 'y(B)' })), /같은 글자의 읽는 값 객체/);
  assert.throws(() => parseCoord(tripRaw({ at: 'abs(F)' })), /띠에 못 씀/);
  assert.throws(() => parseCoord(tripRaw({ face: 'roots(v)' })), /띠에 못 씀/);
  assert.throws(() => parseCoord(tripRaw({ face: undefined })), /face/);
  assert.throws(() => parseCoord(tripRaw({ dir: 'z' })), /dir/);
  assert.throws(() => parseCoord(tripRaw({ min: 4, max: 0 })), /max 가 min 보다/);
  assert.throws(() => parseCoord(tripRaw({ min: 0.5 })), /정수/);
  assert.throws(() => parseCoord(tripRaw({ step: '3' })), /나누어떨어/);
  assert.throws(() => parseCoord(tripRaw({ step: '1/100' })), /100칸/);
  assert.throws(() => parseCoord(tripRaw({ width: 3 })), /모르는 칸 width/);
});

test('무거운 형식 검사: 닿는 어느 자리에서든 표식이 띠 밖이면 오류(어느 칸인지 알려 줌)', () => {
  // 위치는 0~4 km 를 오간다 — 띠가 0~3 이면 t=2 근처에서 띠 밖
  assert.throws(
    () => coordDef.deep?.(parseCoord(tripRaw({ max: 3, label: '1' }))),
    /띠 밖.*pt_B_x/,
  );
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(tripRaw())));
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(liftRaw())));
  // 세로 띠 숫자가 그림 높이에 촘촘하면(가장 좁은 화면에서 이웃 숫자 사이 12px 미만) 오류 — 숫자 13개는 기본 그림 높이
  // (160px)에는 들지만, 축척 같게로 그림이 납작해지면(82px) 겹친다
  assert.throws(
    () =>
      coordDef.deep?.(
        parseCoord({
          ...liftRaw({ min: 0, max: 12, step: '1' }),
          equal: true,
          x: { min: 0, max: 16, step: 1 },
          y: { min: 0, max: 6, step: 1 },
        }),
      ),
    /세로 띠 숫자가 겹침/,
  );
});

test('검산: 표식 자리 = sympy 가 원문 식에서 따로 계산한 읽는 값, 방향 = 그 속도 식의 부호(닿는 상태마다)', () => {
  const p = parseCoord(tripRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('길 띠'));
  assert.deepEqual(
    cs.map((c) => c.name),
    ['길 띠 표식 net(F)', '길 띠 방향 y(B)'],
  );
  const mk = cs[0] as { expr: string; points: unknown[]; values: unknown[] };
  // 앱 계산(분수 합)을 옮겨 적지 않고 sympy integrate 로 — 원문 곡선 식 4-2*x 가 그대로 들어간다
  assert.match(mk.expr, /integrate\(.*4-2\*x/);
  assert.equal(mk.points.length, 17);
  const r = runChecks(coordChecks(p));
  assert.ok(r.ok, r.out);
  const l = parseCoord(liftRaw());
  assert.deepEqual(
    coordChecks(l)
      .filter((c) => c.name.startsWith('길 띠'))
      .map((c) => c.name),
    ['길 띠 표식 y(P)', '길 띠 방향 deriv(X,P)'],
  );
  const r2 = runChecks(coordChecks(l));
  assert.ok(r2.ok, r2.out);
});

test('검산이 틀린 표식을 잡는다: 앱 값을 하나 비틀면 parity 가 실패', () => {
  const p = parseCoord(tripRaw());
  const cs = coordChecks(p).map((c) =>
    c.name === '길 띠 표식 net(F)'
      ? { ...c, values: (c as { values: number[] }).values.map((v, k) => (k === 5 ? v + 0.25 : v)) }
      : c.name === '길 띠 방향 y(B)'
        ? { ...c, values: (c as { values: number[] }).values.map((v) => (v === 0 ? 1 : v)) }
        : c,
  );
  const r = runChecks(cs.filter((c) => c.name.startsWith('길 띠')));
  assert.equal(r.ok, false);
  assert.match(r.out, /길 띠 표식/);
  assert.match(r.out, /길 띠 방향/);
});
