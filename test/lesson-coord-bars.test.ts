// 좌표평면 2-가: 통계 막대. 히스토그램(계급·도수, 자료+계급 크기 슬라이더, 상대도수 밀도), 이항분포 막대(n·p 슬라이더),
// 막대 넓이 합(끄는 점으로 고르는 구간), 막대 + 정규분포 곡선 겹치기, 정규분포 넓이 읽기(무리수 — approx 검산),
// 신뢰구간 막대 여러 개(덮는 수). 시험 장면은 단원 JSON 이 아니라 이 파일 안에 둔다(단원 적용은 3-아).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordParams,
  type CoordState,
  coordChecks,
  coordDef,
  type Drawing,
  dragPoint,
  draw,
  erf,
  frame,
  initial,
  keyMove,
  normCdf,
  parseCoord,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import type { WidgetCheck } from '../src/lesson/widgets/specs.ts';
import { runChecks, tamper } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

type Raw = Record<string, unknown>;

/** 이항분포 B(n,p) 막대 + 끄는 점 K 까지의 넓이 합 P(X≤k) */
const binomRaw = (over: Raw = {}): Raw => ({
  mode: 'explore',
  x: { min: '-1/2', max: '21/2', step: 1 },
  y: { min: 0, max: 1, step: '1/10' },
  sliders: [
    { id: 'n', min: 1, max: 10, step: 1, value: 4, label: '$n$' },
    { id: 'p', min: '1/10', max: '9/10', step: '1/10', value: '1/2', label: '$p$' },
  ],
  objects: [
    { id: 'K', point: { x: 2, y: 0, drag: 'x' }, name: 'K' },
    { id: 'B', bars: { binom: ['n', 'p'], sel: [null, 'K'] } },
    { readout: 'area(B)', label: '$P(X\\le k)$' },
  ],
  ...over,
});

const st = (p: CoordParams, vars: Record<string, number>, pts: Record<string, number> = {}) => {
  const s = initial(p);
  return {
    ...s,
    vars: { ...s.vars, ...vars },
    pts: {
      ...s.pts,
      ...Object.fromEntries(Object.entries(pts).map(([k, i]) => [k, { ...s.pts[k], i }])),
    },
  } as CoordState;
};
const roText = (p: CoordParams, s: CoordState, k = 0) => draw(p, s, BOX).readouts[k]?.text;
const pathOf = (d: Drawing, key: string) => {
  const it = d.items.find((x) => x.key === key) ?? d.fills.find((x) => x.key === key);
  assert.ok(it && it.t === 'path', `경로 ${key} 없음`);
  return it.d;
};
/** 경로 안 사각형(M…Z) 개수 */
const boxes = (d: string) => (d.match(/M/g) ?? []).length;
const keysOf = (d: Drawing) => [
  ...d.fills.map((x) => x.key),
  ...d.items.map((x) => x.key),
  ...d.handles.map((x) => x.key),
  ...d.readouts.map((x) => x.key),
];

// ---- 이항분포 막대 ----

test('이항분포 막대: n+1 개 막대(폭 1, 가운데 k), 끄는 점 K 이하 막대는 고른 막대로 따로 그린다', () => {
  const p = parseCoord(binomRaw());
  const d = draw(p, initial(p), BOX);
  // K=2: 0·1·2 는 고른 막대, 3·4 는 나머지
  assert.equal(boxes(pathOf(d, 'b1s')), 3);
  assert.equal(boxes(pathOf(d, 'b1')), 2);
  // 막대 0 의 왼쪽 끝은 x=-1/2(그림 왼쪽 끝) — 가운데가 k 인 폭 1 막대
  const f = frame(BOX, p);
  const [X0] = toPx(p, f, -0.5, 0);
  assert.ok(pathOf(d, 'b1s').startsWith(`M${Math.round(X0 * 10) / 10} `));
});

test('막대 넓이 합: P(X≤k) 를 정확한 분수로 — 반올림이 값을 바꾸면 ≈', () => {
  const p = parseCoord(binomRaw());
  // B(4, 1/2): (1+4+6)/16 = 11/16 = 0.6875 (4자리에서 정확)
  assert.equal(roText(p, initial(p)), '0.6875');
  // B(10, 3/10), k=3: 0.6496107184
  assert.equal(roText(p, st(p, { n: 10, p: 0.3 }, { K: 3 })), '≈ 0.6496');
  // K 가 n 보다 오른쪽이면 모든 막대 — 1
  assert.equal(roText(p, st(p, { n: 2 }, { K: 5 })), '1');
  // frac 이면 분수로
  const raw = binomRaw();
  (raw.objects as Raw[])[2] = { readout: 'area(B)', label: '확률', frac: true };
  const q2 = parseCoord(raw);
  assert.equal(roText(q2, initial(q2)), '11/16');
});

test('고른 구간 없는 막대: 넓이 합은 모든 막대(이항분포는 1)', () => {
  const p = parseCoord(
    binomRaw({
      objects: [
        { id: 'B', bars: { binom: ['n', 'p'] } },
        { readout: 'area(B)', label: '합' },
      ],
    }),
  );
  assert.equal(roText(p, st(p, { n: 7, p: 0.3 })), '1');
  const d = draw(p, initial(p), BOX);
  assert.equal(boxes(pathOf(d, 'b0')), 5);
  assert.equal(pathOf(d, 'b0s'), '');
});

test('끄는 동안 렌더 0회의 바탕: n·p·K 가 바뀌어도 그릴 목록 항목(key)이 같다 — 경로 글자만 바뀜', () => {
  const p = parseCoord(binomRaw());
  const base = keysOf(draw(p, initial(p), BOX));
  for (const n of [1, 5, 10])
    for (const pv of [0.1, 0.9])
      for (const k of [0, 3, 10])
        assert.deepEqual(keysOf(draw(p, st(p, { n, p: pv }, { K: k }), BOX)), base);
});

test('막대 + 정규분포 곡선 겹치기: 막대는 곡선 아래 층(곡선이 막대에 가리지 않음)', () => {
  const raw = binomRaw();
  (raw.objects as Raw[]).push({
    id: 'N',
    curve: { normal: ['n*p', 'sqrt(n*p*(1-p))'] },
    label: '정규분포 곡선',
  });
  const p = parseCoord(raw);
  const d = draw(p, st(p, { n: 10, p: 0.5 }), BOX);
  const keys = d.items.map((x) => x.key);
  const curveAt = keys.indexOf('c3');
  assert.ok(curveAt > keys.indexOf('b1') && curveAt > keys.indexOf('b1s'));
  // 곡선은 B(10,1/2) 의 평균 5 에서 가장 높다: 1/sqrt(2π·2.5)
  const top = d.items.find((x) => x.key === 'c3');
  assert.ok(top && top.t === 'path' && top.d.length > 100);
});

test('이항분포 형식 검사: n 상한(60)·막대 폭·화면 밖 막대·p 범위·정수 아닌 n', () => {
  const sl = (n: Raw, pp: Raw = {}) =>
    binomRaw({
      sliders: [
        { id: 'n', min: 1, max: 10, step: 1, value: 4, label: '$n$', ...n },
        { id: 'p', min: '1/10', max: '9/10', step: '1/10', value: '1/2', label: '$p$', ...pp },
      ],
    });
  // n 이 60 을 넘으면(고정 수도) 형식 오류 — 가장 좁은 화면에 막대 61개(4.1px)가 끝이라 그보다 크면 늘 너무 좁다
  assert.throws(
    () =>
      parseCoord(
        binomRaw({
          x: { min: '-1/2', max: '123/2', step: 10 },
          objects: [{ id: 'B', bars: { binom: [61, '1/2'] } }],
        }),
      ),
    /n 상한/,
  );
  // n=60 은 가로 −1/2~121/2 에 딱 들어간다(막대 4.1px)
  assert.doesNotThrow(() =>
    parseCoord({
      ...sl({ max: 60 }),
      x: { min: '-1/2', max: '121/2', step: 10 },
      objects: [{ id: 'B', bars: { binom: ['n', 'p'] } }],
    }),
  );
  // n=60 을 가로 0~200 에 그리면 막대 하나가 1px 남짓
  assert.throws(
    () =>
      parseCoord({
        ...sl({ max: 60 }),
        x: { min: '-1/2', max: 200, step: 20 },
        objects: [{ id: 'B', bars: { binom: ['n', 'p'] } }],
      }),
    /막대 폭/,
  );
  // n 이 가장 클 때 막대 n 이 오른쪽 밖, x min 이 0 이면 막대 0 의 왼쪽 반이 잘림
  assert.throws(() => parseCoord(sl({ max: 12 })), /화면 밖/);
  assert.throws(() => parseCoord(binomRaw({ x: { min: 0, max: 11, step: 1 } })), /화면 밖/);
  assert.throws(() => parseCoord(sl({}, { max: 2 })), /0~1/);
  assert.throws(
    () => parseCoord(sl({}, { min: 0, step: 'pi/10', max: 'pi/5', value: 0 })),
    /유리수/,
  );
  assert.throws(() => parseCoord(sl({ step: '1/2', value: 4 })), /정수/);
  // 막대 아래가 잘리는 세로 범위(가로축이 그림 안에 없음)
  assert.throws(() => parseCoord(binomRaw({ y: { min: '1/10', max: 1, step: '1/10' } })), /y min/);
});

test('읽는 값이 바뀌는 상태가 2000 을 넘으면 형식 오류(검산이 모든 상태를 본다) — n·p·K 를 한 장면에 다 두면 넘음', () => {
  const big = binomRaw({
    x: { min: '-1/2', max: '41/2', step: 1 },
    sliders: [
      { id: 'n', min: 1, max: 20, step: 1, value: 4, label: '$n$' },
      { id: 'p', min: '1/10', max: '9/10', step: '1/10', value: '1/2', label: '$p$' },
    ],
  });
  // n 20 × p 9 × K 21칸 = 3780
  assert.throws(() => parseCoord(big), /상태가 3780개/);
  const pr = normalRaw({
    objects: [
      { id: 'N', curve: { normal: [0, 1] } },
      { id: 'P', point: { on: 'N', x: -1, drag: 'x', snap: '1/5' } },
      { id: 'Q', point: { on: 'N', x: 1, drag: 'x', snap: '1/5' } },
      { id: 'A', shade: { of: 'N', x: ['P', 'Q'] } },
      { readout: 'prob(A)', label: '넓이' },
    ],
  });
  // 두 끝 41칸 × 41칸 = 1681 — 됨
  assert.doesNotThrow(() => parseCoord(pr));
});

test('이항분포 형식 검사(무거운 것): 닿는 n·p 에서 가장 높은 막대가 그림 위로 잘리면 오류', () => {
  const p = parseCoord(binomRaw({ y: { min: 0, max: '1/2', step: '1/10' } }));
  // n=1, p=9/10 이면 막대 1 의 높이 0.9 > 1/2
  assert.throws(() => coordDef.deep?.(p), /위로 잘림/);
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(binomRaw())));
});

test('이항분포 검산: 막대 높이 = sympy binomial(parity), 닿는 모든 n·p·K 의 넓이 합 = sympy 합(approx)', () => {
  const p = parseCoord(binomRaw());
  const cs = coordChecks(p);
  const h = cs.find((c) => c.name === '막대 B 높이');
  assert.ok(h && 'kind' in h && h.kind === 'parity');
  const areas = cs.filter((c) => c.name.startsWith('막대 B 넓이 합'));
  // n 10 × p 9 × K 11칸
  assert.equal(areas.length, 10 * 9 * 11);
  const one = areas.find((c) => c.name === '막대 B 넓이 합 n=10, p=3/10, K=3');
  assert.ok(one && 'kind' in one && one.kind === 'approx');
  assert.equal(one.value, '0.6496');
  assert.equal(one.digits, 4);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('막대 넓이 합 검산(분수로 보이는 읽는 값): 앱의 분수 = sympy 합', () => {
  const raw = binomRaw();
  (raw.objects as Raw[])[2] = { readout: 'area(B)', label: '확률', frac: true };
  const p = parseCoord({
    ...raw,
    sliders: [{ id: 'n', min: 1, max: 4, step: 1, value: 4, label: '$n$' }],
    objects: [
      (raw.objects as Raw[])[0],
      { id: 'B', bars: { binom: ['n', '1/3'], sel: [null, 'K'] } },
      (raw.objects as Raw[])[2],
    ],
  });
  const cs = coordChecks(p).filter((c) => c.name.startsWith('막대 B 넓이 합'));
  const one = cs.find((c) => c.name === '막대 B 넓이 합 n=4, K=2');
  assert.ok(one && 'answer' in one);
  // (2/3)^4 + 4(1/3)(2/3)^3 + 6(1/3)^2(2/3)^2 = (16+32+24)/81 = 8/9
  assert.equal(one.answer, '8/9');
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

// ---- 히스토그램 ----

const histRaw = (bars: Raw, over: Raw = {}): Raw => ({
  mode: 'explore',
  x: { min: 0, max: 60, step: 10, name: '점수' },
  y: { min: 0, max: 10, step: 2, name: '도수' },
  objects: [
    { id: 'A', point: { x: 10, y: 0, drag: 'x' }, name: 'A' },
    { id: 'C', point: { x: 30, y: 0, drag: 'x' }, name: 'C' },
    { id: 'H', bars: { x: [0, 10, 20, 30, 40, 50], h: [2, 5, 8, 4, 1], sel: ['A', 'C'], ...bars } },
    { readout: 'area(H)', label: '고른 넓이' },
  ],
  ...over,
});

test('히스토그램(계급 끝·도수): 고른 계급(가운데가 A~C 안)의 넓이 = 도수 × 계급의 크기', () => {
  const p = parseCoord(histRaw({}));
  // 10~20(5), 20~30(8): (5+8)×10 = 130
  assert.equal(roText(p, initial(p)), '130');
  const d = draw(p, initial(p), BOX);
  assert.equal(boxes(pathOf(d, 'b2s')), 2);
  assert.equal(boxes(pathOf(d, 'b2')), 3);
  // 끝을 모두 덮으면 넓이 합 = 계급의 크기 × 도수의 총합 = 10 × 20
  assert.equal(roText(p, st(p, {}, { A: 0, C: 6 })), '200');
  // A 가 C 보다 오른쪽이면 고른 막대가 없다
  assert.equal(roText(p, st(p, {}, { A: 5, C: 1 })), '0');
});

test('히스토그램 상대도수 밀도(density): 높이 = 도수/(총도수×폭), 넓이 합 = 상대도수의 합', () => {
  const p = parseCoord(histRaw({ density: true }, { y: { min: 0, max: '1/20', step: '1/100' } }));
  assert.equal(roText(p, initial(p)), '0.65');
  assert.equal(roText(p, st(p, {}, { A: 0, C: 6 })), '1');
});

test('히스토그램 형식 검사: 끝이 커지지 않음·개수 어긋남·음수 도수·화면 밖·막대가 그림 위로 잘림', () => {
  assert.throws(() => parseCoord(histRaw({ x: [0, 10, 10, 30, 40, 50] })), /커져야/);
  assert.throws(() => parseCoord(histRaw({ h: [2, 5, 8, 4] })), /개수/);
  assert.throws(() => parseCoord(histRaw({ h: [2, -5, 8, 4, 1] })), /0 이상/);
  assert.throws(() => parseCoord(histRaw({ x: [0, 10, 20, 30, 40, 70] })), /화면 밖/);
  assert.throws(() => parseCoord(histRaw({ h: [2, 5, 12, 4, 1] })), /위로 잘림/);
  // 형식이 둘 다(계급 끝과 이항분포)면 오류
  assert.throws(() => parseCoord(histRaw({ binom: [4, '1/2'] })), /하나만/);
});

const dataRaw = (over: Raw = {}): Raw => ({
  mode: 'explore',
  x: { min: 0, max: 60, step: 10 },
  y: { min: 0, max: 6, step: 1 },
  sliders: [{ id: 'h', min: 5, max: 20, step: 5, value: 10, label: '계급의 크기' }],
  objects: [
    {
      id: 'D',
      bars: { data: [3, 7, 12, 15, 18, 22, 25, 31, 34, 38, 41, 45, 47, 52, 58], from: 0, w: 'h' },
    },
    { readout: 'area(D)', label: '넓이 합' },
  ],
  ...over,
});

test('자료 히스토그램: 계급의 크기 슬라이더를 바꾸면 도수를 다시 센다(왼쪽 닫힘 [a, a+w))', () => {
  const p = parseCoord(dataRaw());
  const d10 = draw(p, initial(p), BOX);
  // 10 씩: 2·3·2·3·3·2 — 6계급
  assert.equal(boxes(pathOf(d10, 'b0')), 6);
  const d20 = draw(p, st(p, { h: 20 }), BOX);
  assert.equal(boxes(pathOf(d20, 'b0')), 3);
  // 넓이 합 = 계급의 크기 × 총도수 15
  assert.equal(roText(p, initial(p)), '150');
  assert.equal(roText(p, st(p, { h: 5 })), '75');
  // 항목 key 는 계급 수가 바뀌어도 같다
  assert.deepEqual(keysOf(d10), keysOf(d20));
});

test('자료 히스토그램 형식 검사: 시작보다 작은 자료·화면 밖 계급·도수가 그림 위로', () => {
  const base = dataRaw();
  const bars = (b: Raw) => ({
    ...base,
    objects: [{ id: 'D', bars: { ...((base.objects as Raw[])[0]?.bars as Raw), ...b } }],
  });
  assert.throws(() => parseCoord(bars({ from: 5 })), /시작보다 작은/);
  // 계급의 크기 15 면 4계급(0~60), 20 이면 3계급(0~60) — 가로 50 까지면 밖
  assert.throws(() => parseCoord({ ...bars({}), x: { min: 0, max: 50, step: 10 } }), /화면 밖/);
  // 크기 20 일 때 5·5·5 — 세로 4 면 잘림(무거운 검사)
  assert.throws(
    () => coordDef.deep?.(parseCoord({ ...bars({}), y: { min: 0, max: 4, step: 1 } })),
    /위로 잘림/,
  );
});

test('히스토그램 검산: 닿는 계급 크기마다 도수 = sympy 가 따로 센 값, 넓이 합 = sympy', () => {
  const p = parseCoord(dataRaw());
  const cs = coordChecks(p);
  assert.ok(cs.some((c) => c.name === '막대 D 도수 h=5'));
  assert.ok(cs.some((c) => c.name === '막대 D 넓이 합 h=20'));
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
  const ph = parseCoord(histRaw({}));
  const ch = coordChecks(ph);
  const r2 = runChecks(ch);
  assert.ok(r2.ok, r2.out);
  assert.equal(runChecks(tamper(ch)).ok, false);
});

// ---- 정규분포 넓이 ----

test('erf·정규분포 누적: 알려진 값과 1e-14 안', () => {
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-14, `${a} ≠ ${b}`);
  near(erf(0), 0);
  near(erf(0.5), 0.5204998778130465);
  near(erf(1), 0.8427007929497149);
  near(erf(-2), -0.9953222650189527);
  near(erf(3), 0.9999779095030014);
  near(erf(5), 0.9999999999984626);
  near(normCdf(1.96), 0.9750021048517795);
  near(normCdf(-1), 0.15865525393145707);
});

const normalRaw = (over: Raw = {}): Raw => ({
  mode: 'explore',
  x: { min: -4, max: 4, step: 1 },
  y: { min: 0, max: '1/2', step: '1/10' },
  objects: [
    { id: 'N', curve: { normal: [0, 1] } },
    { id: 'P', point: { on: 'N', x: 1, drag: 'x', snap: '1/5', range: [-3, 3] }, name: 'P' },
    { id: 'A', shade: { of: 'N', x: [null, 'P'] } },
    { readout: 'prob(A)', label: '$P(Z\\le z)$' },
  ],
  ...over,
});

test('정규분포 넓이: P 를 끌면 왼쪽 넓이 Φ(z) — 무리수라 늘 ≈(4자리), z=0 은 정확히 0.5', () => {
  const p = parseCoord(normalRaw());
  assert.equal(roText(p, initial(p)), '≈ 0.8413');
  assert.equal(roText(p, st(p, {}, { P: 0 })), '0.5');
  assert.equal(roText(p, st(p, {}, { P: -10 })), '≈ 0.0228');
  // 칠한 영역은 격자 아래 층(칠하기와 같은 자리)
  const d = draw(p, initial(p), BOX);
  assert.ok(d.fills.some((x) => x.key === 'a2' && x.t === 'path' && x.d.length > 0));
});

test('정규분포 넓이: 두 끝 고정·평균·표준편차 슬라이더', () => {
  const p = parseCoord(
    normalRaw({
      x: { min: 20, max: 80, step: 10 },
      y: { min: 0, max: '1/10', step: '1/50' },
      sliders: [{ id: 's', min: 5, max: 15, step: 5, value: 10, label: '$\\sigma$' }],
      objects: [
        { id: 'N', curve: { normal: [50, 's'] } },
        { id: 'A', shade: { of: 'N', x: [40, 60] } },
        { readout: 'prob(A)', label: '넓이' },
      ],
    }),
  );
  // ±1σ: 0.6827, σ=5 면 ±2σ: 0.9545
  assert.equal(roText(p, initial(p)), '≈ 0.6827');
  assert.equal(roText(p, st(p, { s: 5 })), '≈ 0.9545');
});

test('정규분포 형식 검사: normal 이 아닌 곡선·표준편차 0 이하·x 와 함께', () => {
  const base = normalRaw();
  const objs = base.objects as Raw[];
  assert.throws(
    () =>
      parseCoord({
        ...base,
        objects: [
          { id: 'N', curve: 'exp(-x**2/2)' },
          { id: 'A', shade: { of: 'N', x: [0, 1] } },
        ],
      }),
    /정규분포 곡선/,
  );
  assert.throws(
    () => parseCoord({ ...base, objects: [{ id: 'N', curve: { normal: [0, 0] } }] }),
    /0 보다 커야/,
  );
  assert.throws(
    () =>
      parseCoord({
        ...base,
        sliders: [{ id: 's', min: -1, max: 1, step: 1, value: 1, label: 's' }],
        objects: [{ id: 'N', curve: { normal: [0, 's'] } }],
      }),
    /0 보다 커야/,
  );
  assert.throws(
    () => parseCoord({ ...base, objects: [{ id: 'N', curve: { normal: [0, 1] }, x: '[0,1]' }] }),
    /normal/,
  );
  assert.throws(
    () => parseCoord({ ...base, objects: [objs[0], { id: 'A', shade: { of: 'N', x: [1, 1] } }] }),
    /커야/,
  );
});

test('정규분포 넓이 검산: 닿는 모든 P 자리에서 화면 숫자 = sympy erf 를 같은 자리로 반올림(approx)', () => {
  const p = parseCoord(normalRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('정규분포 넓이 A'));
  // P 는 -3~3 을 1/5 칸: 31곳
  assert.equal(cs.length, 31);
  const one = cs.find((c) => c.name === '정규분포 넓이 A P=1') as WidgetCheck & { value: string };
  assert.equal(one.value, '0.8413');
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

// ---- 신뢰구간 막대 ----

const DRAWS = [
  0.3, -1.2, 2.1, 0.8, -0.4, 1.5, -2.3, 0.1, -0.9, 1.1, 0.6, -1.7, 0.2, -0.5, 1.9, -1, 0.4, -0.2,
  1.3, -0.7,
];
const ciRaw = (over: Raw = {}): Raw => ({
  mode: 'explore',
  x: { min: 20, max: 80, step: 10 },
  y: { min: 0, max: 21, step: 1, name: '표본' },
  sliders: [
    { id: 'n', min: 1, max: 25, step: 1, value: 4, label: '표본 크기 $n$' },
    { id: 'c', min: 1, max: 3, step: '1/2', value: 2, label: '$z$' },
  ],
  objects: [
    { id: 'C', ci: { m: 50, sd: 10, n: 'n', z: 'c', draws: DRAWS } },
    { readout: 'cover(C)', label: '평균을 품은 구간' },
  ],
  ...over,
});

test('신뢰구간 여러 개: 표본마다 가로 막대, 평균을 품은 것과 못 품은 것을 따로 그린다', () => {
  const p = parseCoord(ciRaw());
  const d = draw(p, initial(p), BOX);
  // z=2: |u|>2 인 2.1·-2.3 만 못 품음
  assert.equal(roText(p, initial(p)), '18');
  assert.equal(boxes(pathOf(d, 'i0')), 18);
  assert.equal(boxes(pathOf(d, 'i0m')), 2);
  assert.equal(roText(p, st(p, { c: 1 })), '12');
  assert.equal(roText(p, st(p, { c: 3 })), '20');
  // n 을 키우면 구간이 좁아질 뿐 품은 수는 그대로(표준화한 표본평균)
  assert.equal(roText(p, st(p, { n: 25 })), '18');
  const wide = pathOf(draw(p, st(p, { n: 1 }), BOX), 'i0');
  const narrow = pathOf(draw(p, st(p, { n: 25 }), BOX), 'i0');
  assert.notEqual(wide, narrow);
  assert.deepEqual(keysOf(draw(p, st(p, { n: 25, c: 1 }), BOX)), keysOf(d));
});

test('신뢰구간 형식 검사: 줄이 그림 밖·줄 간격이 좁음·표준편차·z 가 0 이하', () => {
  const ci = (c: Raw, over: Raw = {}) =>
    ciRaw({
      ...over,
      objects: [{ id: 'C', ci: { m: 50, sd: 10, n: 'n', z: 'c', draws: DRAWS, ...c } }],
    });
  assert.throws(() => parseCoord(ci({}, { y: { min: 0, max: 10, step: 1 } })), /줄/);
  assert.throws(
    () =>
      parseCoord(
        ci(
          { draws: Array.from({ length: 40 }, (_, k) => k / 20 - 1) },
          {
            y: { min: 0, max: 41, step: 2 },
          },
        ),
      ),
    /줄 간격/,
  );
  assert.throws(() => parseCoord(ci({ sd: 0 })), /0 보다 커야/);
  assert.throws(() => parseCoord(ci({ z: 0 })), /0 보다 커야/);
  assert.throws(() => parseCoord(ci({ m: 90 })), /화면 밖/);
});

test('신뢰구간 검산: z 마다 평균을 품은 구간 수 = sympy 가 구간 끝으로 따로 센 값(양 끝 포함 n 5칸에서 같음)', () => {
  const p = parseCoord(ciRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('신뢰구간 C'));
  assert.equal(cs.length, 5);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

// ---- 가로로만 끄는 칸 위 점 ----

test('칸 위 점 drag:x — 가로로만 움직이고(세로 칸 그대로), 위·아래 키도 가로로(슬라이더 관례)', () => {
  const p = parseCoord(binomRaw());
  const f = frame(BOX, p);
  const [X, Y] = toPx(p, f, 5, 0.7);
  const s = dragPoint(p, initial(p), 'K', X, Y, BOX);
  assert.deepEqual(s.pts.K, { i: 5, j: 0 });
  assert.deepEqual(keyMove(p, initial(p), 'K', 'ArrowUp')?.pts.K, { i: 3, j: 0 });
  assert.deepEqual(keyMove(p, initial(p), 'K', 'ArrowLeft')?.pts.K, { i: 1, j: 0 });
});

// ---- 목표 ----

test('막대 넓이·정규분포 넓이·덮는 수는 아직 목표로 못 씀(점 자리 목표로)', () => {
  assert.throws(
    () => parseCoord(binomRaw({ goal: { value: { of: 'area(B)', is: '1/2' }, hint: '…' } })),
    /목표로 못 씀/,
  );
  assert.throws(
    () => parseCoord(normalRaw({ goal: { value: { of: 'prob(A)', is: '1/2' }, hint: '…' } })),
    /목표로 못 씀/,
  );
  // 점 자리 목표는 된다: 'P(X≤k) 가 처음으로 1/2 을 넘는 k'
  const p = parseCoord(
    binomRaw({
      goal: {
        place: {
          point: 'K',
          x: { value: '2', check: 'floor(4*Rational(1,2))' },
          y: { value: '0', check: '0*1' },
        },
        hint: '…',
      },
      objects: [
        { id: 'K', point: { x: 0, y: 0, drag: 'x' }, name: 'K' },
        { id: 'B', bars: { binom: ['n', 'p'], sel: [null, 'K'] } },
        { readout: 'area(B)', label: '넓이' },
      ],
    }),
  );
  assert.doesNotThrow(() => coordDef.deep?.(p));
});

test('글 모음: 막대 범례 글이 문구 검사에 들어간다', () => {
  const raw = binomRaw();
  (raw.objects as Raw[])[1] = {
    id: 'B',
    bars: { binom: ['n', 'p'], sel: [null, 'K'] },
    label: '이항분포 $B(n,p)$',
  };
  const p = parseCoord(raw);
  assert.ok(coordDef.texts(p).includes('이항분포 $B(n,p)$'));
});

// ---- 검토 반영(2-가 리뷰) ----

test('M1 이항분포를 끄는 점으로 고르면: 점의 칸이 막대(폭 1)를 건너뛰면 형식 오류', () => {
  // x 칸 2 면 K 가 홀수 막대에 서지 못한다(P(X≤1) 을 고를 수 없음)
  assert.throws(
    () =>
      parseCoord(
        binomRaw({
          x: { min: '-1/2', max: '21/2', step: 2 },
          objects: [
            { id: 'K', point: { x: 2, y: 0, drag: 'x' }, name: 'K' },
            { id: 'B', bars: { binom: ['n', 'p'], sel: [null, 'K'] } },
          ],
        }),
      ),
    /막대를 건너뜀/,
  );
  // 곡선 위 점: 끄는 간격 3/2 도 건너뛴다
  const onCurve = (snap: string) =>
    binomRaw({
      objects: [
        { id: 'g', curve: '0', tone: 'soft' },
        { id: 'K', point: { on: 'g', x: 3, drag: 'x', snap } },
        { id: 'B', bars: { binom: ['n', 'p'], sel: [null, 'K'] } },
      ],
    });
  assert.throws(() => parseCoord(onCurve('3/2')), /막대를 건너뜀/);
  // 1/2 간격은 모든 막대에 선다
  assert.doesNotThrow(() => parseCoord(onCurve('1/2')));
  // 곡선 위 점은 가장 좁은 화면에서 한 칸이 8px 아래면 끌기가 칸을 묶어(snapMult) 막대를 건너뛴다
  assert.throws(
    () =>
      parseCoord({
        ...onCurve('1'),
        x: { min: '-1/2', max: '79/2', step: 1 },
        sliders: [
          { id: 'n', min: 1, max: 39, step: 1, value: 4, label: '$n$' },
          { id: 'p', min: '1/10', max: '9/10', step: '1/10', value: '1/2', label: '$p$' },
        ],
      }),
    /막대를 건너뜀/,
  );
  // 칸 위 점은 묶지 않으므로 n=39(가로 40칸)까지 된다
  assert.doesNotThrow(() =>
    parseCoord(
      binomRaw({
        x: { min: '-1/2', max: '79/2', step: 1 },
        sliders: [
          { id: 'n', min: 1, max: 39, step: 1, value: 4, label: '$n$' },
          { id: 'p', min: '1/10', max: '9/10', step: '1/10', value: '1/2', label: '$p$' },
        ],
        objects: [
          { id: 'K', point: { x: 2, y: 0, drag: 'x' }, name: 'K' },
          { id: 'B', bars: { binom: ['n', 'p'], sel: [null, 'K'] } },
        ],
      }),
    ),
  );
});
