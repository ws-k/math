// 막대 객체 {id, bars:{…}, label?}: 히스토그램과 이항분포 막대(요청 84·99, 2-가). '막대의 넓이가 곧 확률·도수'를
// 손으로 보게 하려고 높이·넓이를 모두 분수로 정확히 쥔다 — 읽는 값 area 는 고른 막대의 넓이 합.
//   hist  {x:[계급 끝…], h:[도수…]}            계급 끝과 도수를 그대로
//   data  {data:[자료…], from, w}              자료를 계급의 크기 w(수 또는 슬라이더)로 나눠 센다 — 왼쪽 닫힘 [a, a+w)
//   binom {binom:[n, p]}                        B(n,p) 의 확률, 막대 k 는 가운데 k·폭 1(넓이 = 확률)
//   sel   [a, b]                                가운데가 a~b 안인 막대를 '고른 막대'로(끝은 수·끄는 점·null=끝없음)
//   density                                     높이 = 도수/(총도수×폭) — 넓이 합이 상대도수라 정규분포 곡선과 겹쳐 본다
//
// 막대 수는 n·계급 크기를 끌면 바뀐다. 그래도 그릴 목록은 늘 경로 두 개(나머지·고른 막대)라 끄는 동안 경로 글자만
// 바꿔 넣는다(React 렌더 0회 — 구분구적 조각과 같은 방식).
import { arr, fail, obj, optStr } from '../../parse.ts';
import { type Rational, reduce } from '../../sym.ts';
import { add, cmp, div, mul, num, py, qi, ratStr, sub } from '../q.ts';
import type { WidgetCheck } from '../specs.ts';
import { clampY, MIN_SNAP_PX, narrowFrame, r1, toPx } from './frame.ts';
import { xCells } from './point.ts';
import {
  endPoints,
  endQ,
  inexactQ,
  minus,
  nosNum,
  nosQ,
  nosSliders,
  nosValues,
  numOrSlider,
  qnum,
  roundQ,
  selEnd,
  statStates,
} from './stat.ts';
import type {
  BarsObj,
  BarsSrc,
  CoordParams,
  CoordState,
  KindDef,
  ParseCtx,
  QNum,
  ReadoutObj,
} from './types.ts';

/**
 * 이항분포 n 의 상한. 가장 좁은 화면 그림 폭 250px 에 막대 61개(−1/2~60.5)면 4.1px 로 막대 폭 하한(MIN_BAR_PX)에
 * 닿는다 — 그보다 큰 n 은 어떤 x 범위로도 막대가 안 보이므로 폭 검사보다 먼저 이 수로 알린다
 */
export const BINOM_N_MAX = 60;
/**
 * p 의 분모 상한(4자리 분모까지, 10000). 확률은 같은 분모 dⁿ(binomPmf)라 n=60 이면 10²⁴⁰ — 이보다 크면 화면·그리기가
 * 쓰는 부동소수(Number 상한 약 10³⁰⁸)로 바꿀 때 Infinity 가 되어 막대가 사라진다
 */
const P_DEN_MAX = 10000n;
/**
 * 가장 좁은 화면에서 막대 하나의 최소 폭(px). 테두리(1px)를 빼고도 색이 보여야 고른 막대·나머지를 가린다
 * (구분구적 조각 MIN_RECT_PX 와 같은 까닭·같은 값)
 */
export const MIN_BAR_PX = 4;
/** 계급 수 상한(자료 히스토그램은 가장 작은 계급 크기에서) */
const MAX_BARS = 40;
/** 자료 개수 상한 */
const MAX_DATA = 200;

const Z: Rational = [0n, 1n];
const HALF: Rational = [1n, 2n];

export const barsOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is BarsObj => o.kind === 'bars' && o.id === id) as BarsObj;

/** 막대 하나(정확한 분수): 가로 [lo, hi], 높이 h(density 면 밀도) */
export interface Bar {
  lo: Rational;
  hi: Rational;
  h: Rational;
}

const floorQ = ([n, d]: Rational): bigint => (n >= 0n ? n / d : -((-n + d - 1n) / d));

/** 자료를 계급 크기 w 로 나눈 도수(계급 0 = [from, from+w)) */
function dataCounts(data: QNum[], from: Rational, w: Rational): number[] {
  const out: number[] = [];
  for (const v of data) {
    const i = Number(floorQ(div(sub(v.q, from), w)));
    while (out.length <= i) out.push(0);
    out[i] = (out[i] as number) + 1;
  }
  return out;
}

/**
 * B(n,p) 의 확률 k=0..n(정확한 분수). p = a/d 면 k 번째는 C(n,k)·aᵏ·(d−a)ⁿ⁻ᵏ / dⁿ 로 **모두 분모 dⁿ** —
 * 항마다 약분(큰 정수 최대공약수)하면 n=60, p=4137/10000 에서 한 프레임이 6ms 를 넘어서, 약분하지 않은 채
 * 같은 분모로 둔다(값은 같다. 넓이 합은 분자끼리 더한 뒤 한 번만 약분 — barsArea). n 이 정수가 아니면 빈 목록
 */
export function binomPmf(n: number, p: Rational): Rational[] {
  if (!Number.isInteger(n) || n < 0) return [];
  const [a, d] = p;
  const b = d - a;
  const aw = [1n];
  const bw = [1n];
  for (let k = 1; k <= n; k++) {
    aw.push((aw[k - 1] as bigint) * a);
    bw.push((bw[k - 1] as bigint) * b);
  }
  const D = (bw[0] as bigint) * d ** BigInt(n);
  let c = 1n;
  const out: Rational[] = [];
  for (let k = 0; k <= n; k++) {
    out.push([c * (aw[k] as bigint) * (bw[n - k] as bigint), D]);
    c = (c * BigInt(n - k)) / BigInt(k + 1);
  }
  return out;
}

/**
 * 막대마다 마지막 (n, p) 의 확률 목록. 끝 점 K 만 끌면 (n, p) 가 그대로라 다시 계산하지 않는다 — K 를 끄는 동안
 * 매 프레임 dⁿ 크기 정수 곱셈을 되풀이하지 않게
 */
const pmfMemo = new WeakMap<BarsObj, { n: number; p: Rational; bars: Bar[] }>();

/** 지금 상태의 막대 전부/** 지금 상태의 막대 전부(높이 0 인 막대도 — 넓이 합·고르기 판정은 막대 자리를 본다) */
export function barsAt(p: CoordParams, s: CoordState, o: BarsObj): Bar[] {
  const src = o.src;
  let bars: Bar[];
  if (src.t === 'binom') {
    const pq = nosQ(p, s, src.p);
    if (!pq) return [];
    const n = nosNum(s, src.n);
    const memo = pmfMemo.get(o);
    if (memo && memo.n === n && memo.p[0] === pq[0] && memo.p[1] === pq[1]) return memo.bars;
    bars = binomPmf(n, pq).map((h, k) => ({ lo: sub(qi(k), HALF), hi: add(qi(k), HALF), h }));
    pmfMemo.set(o, { n, p: pq, bars });
    return bars;
  } else if (src.t === 'hist') bars = histBars(src);
  else {
    const w = nosQ(p, s, src.w);
    if (!w) return [];
    bars = dataCounts(src.data, src.from.q, w).map((c, i) => ({
      lo: add(src.from.q, mul(qi(i), w)),
      hi: add(src.from.q, mul(qi(i + 1), w)),
      h: qi(c),
    }));
  }
  return o.density ? densify(bars) : bars;
}

/** 높이를 밀도로: 도수/(총도수×폭) — 넓이 합이 1(상대도수의 합)이 된다. 총도수가 0 이면 그대로 */
function densify(bars: Bar[]): Bar[] {
  const total = bars.reduce((t, b) => add(t, b.h), Z);
  if (total[0] === 0n) return bars;
  return bars.map((b) => ({ ...b, h: div(b.h, mul(total, sub(b.hi, b.lo))) }));
}

/** 계급 끝·도수가 고정인 히스토그램의 막대(상태와 상관없음) */
const histBars = (src: Extract<BarsSrc, { t: 'hist' }>): Bar[] =>
  src.h.map((h, i) => ({ lo: (src.edges[i] as QNum).q, hi: (src.edges[i + 1] as QNum).q, h: h.q }));

/** 막대가 고른 막대인가: 가운데가 [a, b] 안(양 끝 포함, null 은 끝없음). 구간이 없으면 모두 */
function picked(p: CoordParams, s: CoordState, o: BarsObj): (b: Bar) => boolean {
  if (!o.sel) return () => true;
  const a = endQ(p, s, o.sel[0]);
  const b = endQ(p, s, o.sel[1]);
  return (bar) => {
    const c = div(add(bar.lo, bar.hi), qi(2));
    return (a === null || cmp(a, c) <= 0) && (b === null || cmp(c, b) <= 0);
  };
}

/** 고른 막대의 넓이 합(정확한 분수) */
export function barsArea(p: CoordParams, s: CoordState, o: BarsObj): Rational {
  const pick = picked(p, s, o);
  const bars = barsAt(p, s, o);
  if (o.src.t === 'binom') {
    // 폭 1, 모두 분모 dⁿ(binomPmf) — 분자끼리 더하고 한 번만 약분
    let sum = 0n;
    for (const b of bars) if (pick(b)) sum += b.h[0];
    return reduce(sum, bars[0]?.h[1] ?? 1n);
  }
  return bars.reduce((t, b) => (pick(b) ? add(t, mul(b.h, sub(b.hi, b.lo))) : t), Z);
}

/** 읽는 값 area 의 화면 글자: 분수(frac) 또는 digits 자리 소수(반올림이 값을 바꾸면 ≈) */
export function areaText(q: Rational, ro: Pick<ReadoutObj, 'digits' | 'frac'>): string {
  if (ro.frac) return minus(ratStr(q));
  return `${inexactQ(q, ro.digits) ? '≈ ' : ''}${minus(roundQ(q, ro.digits))}`;
}

/** 막대를 바꾸는 슬라이더(n·p·계급 크기) */
export function barsSliders(o: BarsObj): string[] {
  const src = o.src;
  if (src.t === 'binom') return [...nosSliders(src.n), ...nosSliders(src.p)];
  return src.t === 'data' ? nosSliders(src.w) : [];
}

/** 막대를 바꾸는 슬라이더와 고르는 구간의 끄는 점 */
export const barsMovers = (p: CoordParams, o: BarsObj) => ({
  sliders: barsSliders(o),
  points: o.sel ? endPoints(p, o.sel) : [],
});

/** 막대를 그리는 가로 범위가 화면 안인가 — 잘린 막대는 넓이를 눈으로 견줄 수 없다 */
function fitX(at: string, cx: { x: CoordParams['x'] }, lo: number, hi: number) {
  if (lo < cx.x.lo - 1e-9 || hi > cx.x.hi + 1e-9)
    fail(
      at,
      `막대가 화면 밖(막대 ${fmt(lo)}~${fmt(hi)}, x 는 ${cx.x.min}~${cx.x.max}) — 잘린 막대는 넓이를 눈으로 견줄 수 없음`,
    );
}

/** 가장 좁은 화면(그림 폭 f0w)에서 가장 좁은 막대(폭 minW)가 MIN_BAR_PX 이상인가 */
function fitW(at: string, cx: { x: CoordParams['x'] }, minW: number, f0w: number) {
  const px = (minW / (cx.x.hi - cx.x.lo)) * f0w;
  if (px < MIN_BAR_PX)
    fail(
      at,
      `가장 좁은 화면에서 막대 폭이 ${px.toFixed(1)}px — ${MIN_BAR_PX}px 보다 좁으면 테두리에 가려 색이 안 보임(막대 수를 줄이거나 x 범위를 좁게)`,
    );
}
const fmt = (v: number) => String(Number(v.toPrecision(10)));

/** 가장 높은 막대가 그림 위로 잘리면 형식 오류 — 잘린 막대는 높이(확률·도수)를 읽을 수 없다 */
function fitY(at: string, yHi: number, h: number, where: string) {
  if (h > yHi + 1e-12)
    fail(
      at,
      `막대가 그림 위로 잘림${where ? ` (${where})` : ''} — 가장 높은 막대 ${fmt(h)} > y max ${fmt(yHi)}`,
    );
}

/**
 * 무거운 형식 검사(coordDef.deep): 닿는 모든 슬라이더 값(n·p·계급 크기)에서 가장 높은 막대가 그림 안인가.
 * 계급 끝·도수가 고정인 히스토그램은 parse 에서 이미 본다
 */
export function checkBarsFit(p: CoordParams): void {
  for (const o of p.objects) {
    if (o.kind !== 'bars' || o.src.t === 'hist') continue;
    const at = `좌표 막대 ${o.id}`;
    for (const st of statStates(p, barsMovers(p, o).sliders, [], at)) {
      const top = Math.max(0, ...barsAt(p, st.s, o).map((b) => num(b.h)));
      fitY(at, p.y.hi, top, st.text);
    }
  }
  for (const ro of p.objects) {
    if (ro.kind !== 'readout' || ro.expr.f !== 'area' || !ro.frac) continue;
    const o = barsOf(p, ro.expr.bars);
    const m = barsMovers(p, o);
    for (const st of statStates(p, m.sliders, m.points, `좌표 읽는 값 ${ro.src}`)) {
      const t = areaText(barsArea(p, st.s, o), ro);
      if ([...t].length > MAX_FRAC_CHARS)
        fail(
          `좌표 읽는 값 ${ro.src}`,
          `분수 글자 '${t}' 가 ${[...t].length}자(${st.text}) — 접은 화면 읽는 값 칸에 ${MAX_FRAC_CHARS}자까지(frac 을 빼고 소수로)`,
        );
    }
  }
}

/**
 * 분수로 보이는 넓이 합(area frac)의 글자 수 상한. 접은 화면(382) 상자 폭 298px 의 읽는 값 한 줄에서 이름 칸을 뺀
 * 값 칸이 절반(149px) 남짓이고, 굵은 숫자 한 자가 약 10.5px 라 14자 — B(10, 3/10) 의 분모 10¹⁰ 같은 글자는 넘친다
 */
const MAX_FRAC_CHARS = 14;

function parseSrc(r: Record<string, unknown>, at: string, cx: ParseCtx): BarsSrc {
  const forms = [
    r.x !== undefined || r.h !== undefined ? 'hist' : null,
    r.data !== undefined ? 'data' : null,
    r.binom !== undefined ? 'binom' : null,
  ].filter((x) => x !== null);
  if (forms.length !== 1)
    fail(at, '막대는 {x, h}(계급 끝·도수) · {data, from, w}(자료) · {binom:[n,p]} 중 하나만');
  if (forms[0] !== 'data' && (r.from !== undefined || r.w !== undefined))
    fail(at, 'from·w 는 자료(data) 히스토그램에서만');
  const f0 = narrowFrame(cx);
  const f0w = f0.r - f0.l;
  if (forms[0] === 'hist') {
    const edges = arr(r.x, `${at} x`, 2, MAX_BARS + 1).map((v, i) => qnum(v, `${at} x${i + 1}`));
    const h = arr(r.h, `${at} h`, 1, MAX_BARS).map((v, i) => qnum(v, `${at} h${i + 1}`));
    if (h.length !== edges.length - 1)
      fail(at, `도수 개수(${h.length})가 계급 수(계급 끝 ${edges.length}개 − 1)와 다름`);
    let minW = Number.POSITIVE_INFINITY;
    for (let i = 1; i < edges.length; i++) {
      const w = sub((edges[i] as QNum).q, (edges[i - 1] as QNum).q);
      if (cmp(w, Z) <= 0) fail(`${at} x`, '계급 끝은 차례로 커져야 함');
      minW = Math.min(minW, num(w));
    }
    if (h.some((x) => cmp(x.q, Z) < 0)) fail(`${at} h`, '도수는 0 이상');
    // 밀도 = 도수/(총도수×폭) — 총도수가 0 이면 나눌 수 없어 막대가 그려지지 않는다
    if (r.density === true && h.every((x) => x.q[0] === 0n))
      fail(`${at} h`, '상대도수 밀도(density)인데 총도수가 0');
    fitX(at, cx, (edges[0] as QNum).n, (edges[edges.length - 1] as QNum).n);
    fitW(at, cx, minW, f0w);
    return { t: 'hist', edges, h };
  }
  if (forms[0] === 'data') {
    const data = arr(r.data, `${at} data`, 1, MAX_DATA).map((v, i) =>
      qnum(v, `${at} data${i + 1}`),
    );
    if (r.from === undefined || r.w === undefined)
      fail(at, '자료 히스토그램은 from(첫 계급의 시작)·w(계급의 크기)가 필요');
    const from = qnum(r.from, `${at} from`);
    const low = data.find((v) => cmp(v.q, from.q) < 0);
    if (low)
      fail(`${at} data`, `시작보다 작은 자료 ${low.src}(시작 ${from.src}) — 첫 계급에 들지 않음`);
    const maxV = data.reduce((m, v) => (cmp(v.q, m) > 0 ? v.q : m), from.q);
    const w = numOrSlider(r.w, `${at} w`, cx, (n, q) => {
      if (!(n > 0)) return '계급의 크기는 0 보다 커야 함';
      const k = Number(floorQ(div(sub(maxV, from.q), q))) + 1;
      if (k > MAX_BARS) return `계급이 ${k}개 — ${MAX_BARS}개 이하로`;
      const hi = num(add(from.q, mul(qi(k), q)));
      if (from.n < cx.x.lo - 1e-9 || hi > cx.x.hi + 1e-9)
        return `막대가 화면 밖(계급 ${fmt(from.n)}~${fmt(hi)}, x 는 ${cx.x.min}~${cx.x.max})`;
      return null;
    });
    const ws = nosValues(cx, w);
    // 가로 범위는 계급 크기마다 위에서 봤다
    fitW(at, cx, Math.min(...ws), f0w);
    return { t: 'data', data, from, w };
  }
  const [rn, rp] = arr(r.binom, `${at} binom`, 2, 2);
  const n = numOrSlider(rn, `${at} binom n`, cx, (v) =>
    !Number.isInteger(v) || v < 1
      ? 'n 은 1 이상의 정수'
      : v > BINOM_N_MAX
        ? `n 상한 ${BINOM_N_MAX} 을 넘음(${v}) — 막대가 너무 좁고 검산 상태가 너무 많음`
        : null,
  );
  const pp = numOrSlider(rp, `${at} binom p`, cx, (v, q) =>
    v < 0 || v > 1
      ? `p 는 0~1 (${v})`
      : q[1] > P_DEN_MAX
        ? `p 의 분모 ${q[1]} 가 ${P_DEN_MAX} 를 넘음 — 확률의 분모가 (p 의 분모)ⁿ 이라 수로 바꿀 때 넘칠 수 있음`
        : null,
  );
  if (r.density !== undefined)
    fail(`${at} density`, '이항분포 막대는 이미 확률(폭 1 — 넓이 = 높이)');
  const nMax = Math.max(...nosValues(cx, n));
  fitX(at, cx, -0.5, nMax + 0.5);
  fitW(at, cx, 1, f0w);
  return { t: 'binom', n, p: pp };
}

/**
 * 이항분포 막대(폭 1)를 끄는 점으로 고를 때: 점이 모든 막대 가운데(정수)에 설 수 있어야 한다 — 칸이 2 면 홀수 k 의
 * P(X≤k) 를 고를 수 없다. 끄는 칸(1/칸이 정수)과, 곡선 위 점이면 가장 좁은 화면에서 한 칸이 MIN_SNAP_PX 이상인지도 본다
 * (모자라면 끌기가 칸을 2·5칸씩 묶어(model.ts snapMult) 막대를 건너뛴다). 칸 위 점은 묶지 않지만 x 축이 40칸까지라
 * 칸 1 이면 n ≤ 39
 */
function binomEndOk(id: string, at: string, cx: ParseCtx): void {
  const pt = cx.points.get(id);
  if (!pt || pt.drag === 'none') return;
  const { step, stepN } = xCells(cx.x, pt);
  const per = step ? div(qi(1), step) : null;
  if (per?.[1] !== 1n)
    fail(
      at,
      `끝 점 ${id} 의 끄는 칸(${pt.snap})이 막대를 건너뜀 — 칸이 1 을 나누어떨어지게(1·1/2 …)`,
    );
  const f0 = narrowFrame(cx);
  const px = (stepN / (cx.x.hi - cx.x.lo)) * (f0.r - f0.l);
  if (pt.on && px < MIN_SNAP_PX)
    fail(
      at,
      `끝 점 ${id} 의 한 칸이 가장 좁은 화면에서 ${px.toFixed(1)}px — ${MIN_SNAP_PX}px 보다 좁으면 끌기가 칸을 묶어 막대를 건너뜀(x 범위를 좁히거나 칸 위 점으로)`,
    );
}

export const barsKind: KindDef<BarsObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['id', 'bars'], ['label']);
    const id = cx.named(c.id, `${at} id`);
    const r = obj(
      c.bars,
      `${at} bars`,
      [],
      ['x', 'h', 'data', 'from', 'w', 'binom', 'sel', 'density'],
    );
    if (r.density !== undefined && r.density !== true) fail(`${at} density`, 'true 만');
    // 막대는 가로축(y=0)에서 선다 — 가로축이 그림 아래로 빠지면 막대 아래가 잘려 높이를 읽을 수 없다
    if (cx.y.lo > 1e-12) fail(at, `y min 은 0 이하(막대가 가로축에서 섬, 지금 ${cx.y.min})`);
    const src = parseSrc(r, `${at} bars`, cx);
    const label = optStr(c.label, `${at} label`);
    let sel: BarsObj['sel'];
    if (r.sel !== undefined) {
      const [a, b] = arr(r.sel, `${at} sel`, 2, 2);
      sel = [selEnd(a, `${at} sel`, cx), selEnd(b, `${at} sel`, cx)];
      if (sel[0] === null && sel[1] === null)
        fail(`${at} sel`, '두 끝이 다 끝없음이면 sel 을 빼세요(모든 막대)');
      const [qa, qb] = sel.map((e) => (e && 'q' in e ? e.q : null));
      if (qa && qb && cmp(qa, qb) > 0) fail(`${at} sel`, '끝이 시작보다 작음');
      if (src.t === 'binom')
        for (const e of sel) if (e && 'pt' in e) binomEndOk(e.pt, `${at} sel`, cx);
    }
    const o: BarsObj = {
      kind: 'bars',
      id,
      src,
      ...(r.density === true ? { density: true as const } : {}),
      ...(sel ? { sel } : {}),
      ...(label !== undefined ? { label } : {}),
    };
    // 계급 끝·도수가 고정이면 지금 높이가 전부다 — 가벼워 여기서 본다(슬라이더가 있으면 deep 에서)
    if (src.t === 'hist') {
      const hs = o.density ? densify(histBars(src)) : histBars(src);
      fitY(`${at} bars`, cx.y.hi, Math.max(0, ...hs.map((b) => num(b.h))), '');
    }
    cx.bars.set(id, o);
    return o;
  },
  draw(o, k, { p, s, f, shapes }) {
    const pick = picked(p, s, o);
    const [, Y0] = toPx(p, f, 0, 0);
    let rest = '';
    let sel = '';
    for (const b of barsAt(p, s, o)) {
      const h = num(b.h);
      // 높이 0 인 막대는 그리지 않는다(선 한 줄만 남아 막대처럼 보이지 않게)
      if (!(h > 0)) continue;
      const [X0] = toPx(p, f, num(b.lo), 0);
      const [X1, Yh] = toPx(p, f, num(b.hi), h);
      const d = `M${r1(X0)} ${r1(clampY(f, Y0))}V${r1(clampY(f, Yh))}H${r1(X1)}V${r1(clampY(f, Y0))}Z`;
      if (pick(b) && o.sel) sel += d;
      else rest += d;
    }
    shapes.push({ t: 'path', key: `b${k}`, d: rest, cls: 'bar' });
    shapes.push({ t: 'path', key: `b${k}s`, d: sel, cls: 'bar sel' });
  },
  checks(o, { p, out }) {
    const src = o.src;
    if (src.t === 'binom') {
      // 막대 높이(그리는 값) = sympy binomial. 닿는 (n, p, k) 가 많으면 고르게 400 점만
      const N = 'slider' in src.n ? src.n.slider : src.n.src;
      const P = 'slider' in src.p ? src.p.slider : `(${src.p.src})`;
      const pts: Record<string, string>[] = [];
      const vals: (number | null)[] = [];
      for (const st of statStates(p, barsMovers(p, o).sliders, [], `좌표 막대 ${o.id}`))
        barsAt(p, st.s, o).forEach((b, kk) => {
          pts.push({ ...st.sym, x: String(kk) });
          vals.push(num(b.h));
        });
      const every = Math.max(1, Math.ceil(pts.length / 400));
      const pick = (_: unknown, i: number) => i % every === 0 || i === pts.length - 1;
      out.push({
        name: `막대 ${o.id} 높이`,
        kind: 'parity',
        expr: `binomial(${N},x)*${P}**x*(1-${P})**(${N}-x)`,
        points: pts.filter(pick),
        values: vals.filter(pick),
      });
    }
    if (src.t === 'data') {
      // 계급 크기마다 도수: 앱이 센 도수 = sympy 가 [시작+i·w, 시작+(i+1)·w) 로 따로 센 값, 모든 자료가 어느 계급에 듦
      for (const st of statStates(p, barsMovers(p, o).sliders, [], `좌표 막대 ${o.id}`)) {
        const w = nosQ(p, st.s, src.w) as Rational;
        const got = dataCounts(src.data, src.from.q, w);
        out.push({
          name: `막대 ${o.id} 도수${st.text ? ` ${st.text}` : ''}`,
          answer: '1',
          answerType: 'int',
          check: [
            `data = [${src.data.map((v) => ratStr(v.q)).join(', ')}]`,
            `F, W = ${ratStr(src.from.q)}, ${ratStr(w)}`,
            `got = [${got.join(', ')}]`,
            'K = len(got)',
            'cnt = [sum(1 for v in data if F + i*W <= v < F + (i+1)*W) for i in range(K)]',
            'ans = 1 if cnt == got and all(F <= v < F + K*W for v in data) else 0',
          ].join('\n'),
        });
      }
    }
    if (o.density) {
      // 밀도 높이 = 도수/(총도수×폭): 앱이 낸 분수 = sympy 가 도수(자료면 다시 센 값)로 따로 셈
      for (const st of statStates(p, barsMovers(p, o).sliders, [], `좌표 막대 ${o.id}`)) {
        const bars = barsAt(p, st.s, o);
        const head =
          src.t === 'hist'
            ? [
                `rows = [${src.h.map((h, i) => `(${ratStr((src.edges[i] as QNum).q)}, ${ratStr((src.edges[i + 1] as QNum).q)}, ${ratStr(h.q)})`).join(', ')}]`,
                'cnt = [h for e0, e1, h in rows]',
                'Ws = [e1 - e0 for e0, e1, h in rows]',
              ]
            : src.t === 'data'
              ? [
                  `data = [${src.data.map((v) => ratStr(v.q)).join(', ')}]`,
                  `F, W = ${ratStr(src.from.q)}, ${ratStr(nosQ(p, st.s, src.w) as Rational)}`,
                  `cnt = [sum(1 for v in data if F + i*W <= v < F + (i+1)*W) for i in range(${bars.length})]`,
                  `Ws = [W]*${bars.length}`,
                ]
              : [];
        out.push({
          name: `막대 ${o.id} 밀도 높이${st.text ? ` ${st.text}` : ''}`,
          answer: '1',
          answerType: 'int',
          check: [
            ...head,
            `got = [${bars.map((b) => py(b.h)).join(', ')}]`,
            'T = sum(cnt)',
            'ans = 1 if T > 0 and [Rational(c)/(T*w) for c, w in zip(cnt, Ws)] == got else 0',
          ].join('\n'),
        });
      }
    }
  },
  texts: (o) => (o.label ? [o.label] : []),
};

/** 읽는 값 area 의 sympy 식(앱 계산을 옮기지 않고 정의대로 다시 셈 — 원칙 P7) */
function areaSym(p: CoordParams, st: { s: CoordState }, o: BarsObj): string {
  const a = o.sel ? endQ(p, st.s, o.sel[0]) : null;
  const b = o.sel ? endQ(p, st.s, o.sel[1]) : null;
  const cond = (c: string) =>
    [a ? `${ratStr(a)} <= ${c}` : '', b ? `${c} <= ${ratStr(b)}` : '']
      .filter(Boolean)
      .join(' and ') || 'True';
  const src = o.src;
  if (src.t === 'binom') {
    const n = nosNum(st.s, src.n);
    const P = ratStr(nosQ(p, st.s, src.p) as Rational);
    return `ans = sum(binomial(${n},u)*(${P})**u*(1-(${P}))**(${n}-u) for u in range(${n}+1) if ${cond('u')})`;
  }
  if (src.t === 'hist') {
    const rows = src.h.map(
      (h, i) =>
        `(${ratStr((src.edges[i] as QNum).q)}, ${ratStr((src.edges[i + 1] as QNum).q)}, ${ratStr(h.q)})`,
    );
    const T = o.density ? `/(${src.h.map((h) => ratStr(h.q)).join('+')})` : '';
    const each = o.density ? 'h' : '(e1-e0)*h';
    return `ans = sum(${each} for e0, e1, h in [${rows.join(', ')}] if ${cond('(e0+e1)/2')})${T}`;
  }
  const W = ratStr(nosQ(p, st.s, src.w) as Rational);
  const F = ratStr(src.from.q);
  const data = `[${src.data.map((v) => ratStr(v.q)).join(', ')}]`;
  const c = `(${F} + (floor((v-${F})/(${W})) + Rational(1,2))*(${W}))`;
  return o.density
    ? `ans = Rational(sum(1 for v in ${data} if ${cond(c)}), ${src.data.length})`
    : `ans = sum((${W}) for v in ${data} if ${cond(c)})`;
}

/**
 * 읽는 값 area 의 검산: 막대·고르는 끝이 닿는 모든 상태에서 화면 숫자 = sympy 합. 분수로 보이면(frac) 분수로,
 * 소수로 보이면 그 글자를 sympy 가 같은 자리로 반올림한 값과 견준다(approx — 화면에 보이는 글자 그대로)
 */
export function areaChecks(p: CoordParams, ro: ReadoutObj, bars: string, out: WidgetCheck[]): void {
  const o = barsOf(p, bars);
  const m = barsMovers(p, o);
  for (const st of statStates(p, m.sliders, m.points, `좌표 읽는 값 ${ro.src}`)) {
    const q = barsArea(p, st.s, o);
    const name = `막대 ${o.id} 넓이 합${st.text ? ` ${st.text}` : ''}`;
    const expr = areaSym(p, st, o);
    if (ro.frac) out.push({ name, answer: ratStr(q), answerType: 'fraction', check: expr });
    else out.push({ name, kind: 'approx', expr, value: roundQ(q, ro.digits), digits: ro.digits });
  }
}
