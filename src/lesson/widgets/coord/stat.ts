// 통계 객체(막대·정규분포 넓이·신뢰구간)가 같이 쓰는 도우미: 수 또는 슬라이더 읽기, 고르는 구간의 끝, 닿는 상태
// 늘어놓기, 분수를 정해진 자리로 반올림한 글자. 세 객체가 각자 만들면 '닿는 상태'와 '화면 숫자 꼴'이 어긋난다 —
// 검산(approx)은 화면 숫자 글자를 그대로 sympy 반올림과 견주므로 그 글자를 한곳에서 만든다.
import { compile, evalNum, exactOf, exactStr } from '../../expr.ts';
import { GOAL_MAX_STATES, growStates } from '../../goal.ts';
import { fail, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { mul, qi, ratStr } from '../q.ts';
import { ID } from './common.ts';
import { initial } from './model.ts';
import { pointOf, pointQ, pointXY, xCells } from './point.ts';
import { sliderQ, sliderSym, sliderValues } from './slider.ts';
import type {
  CoordParams,
  CoordState,
  NumOrSlider,
  ParseCtx,
  QNum,
  SelEnd,
  Slider,
} from './types.ts';

/** 유리수 하나(형식 검사). 통계 객체의 수는 넓이·개수를 분수로 정확히 내려고 모두 유리수다 */
export function qnum(v: unknown, at: string): QNum {
  const src = typeof v === 'number' ? exactStr(v) : str(v, at).replace(/\s+/g, '');
  let n: number;
  try {
    n = evalNum(compile(src, []), {});
  } catch (e) {
    return fail(at, (e as Error).message);
  }
  const q = exactOf(src);
  if (!q || !Number.isFinite(n)) return fail(at, `유리수여야 함 (${src})`);
  return { src, n, q };
}

const sliderOf = (sliders: Slider[], id: string) => sliders.find((s) => s.id === id) as Slider;

/**
 * 수 또는 슬라이더 이름. ok 는 닿는 값마다 부르는 검사(오류 글을 돌려주면 형식 오류) — 슬라이더면 닿는 모든 값을 본다.
 * 슬라이더는 칸이 유리수여야 한다(π 칸이면 넓이·확률을 분수로 못 냄)
 */
export function numOrSlider(
  v: unknown,
  at: string,
  cx: Pick<ParseCtx, 'sliders'>,
  ok: (n: number, q: Rational) => string | null,
): NumOrSlider {
  if (typeof v === 'string' && cx.sliders.some((s) => s.id === v.trim())) {
    const sl = sliderOf(cx.sliders, v.trim());
    for (const { v: x } of sliderValues(sl)) {
      const q = sliderQ(sl, x);
      if (!q) return fail(at, `슬라이더 ${sl.id} 의 칸이 유리수가 아님(분수로 정확히 계산하려고)`);
      const why = ok(x, q);
      if (why) fail(at, `슬라이더 ${sl.id}=${x}: ${why}`);
    }
    return { slider: sl.id };
  }
  const n = qnum(v, at);
  const why = ok(n.n, n.q);
  if (why) fail(at, why);
  return n;
}

/** 닿는 값(수) 목록 */
export const nosValues = (p: Pick<CoordParams, 'sliders'>, v: NumOrSlider): number[] =>
  'slider' in v ? sliderValues(sliderOf(p.sliders, v.slider)).map((x) => x.v) : [v.n];

/** 지금 값(수) */
export const nosNum = (s: CoordState, v: NumOrSlider): number =>
  'slider' in v ? (s.vars[v.slider] ?? Number.NaN) : v.n;

/** 지금 값(분수). 형식 검사가 유리수 칸만 받으므로 슬라이더 값이 있으면 늘 분수다 */
export function nosQ(p: CoordParams, s: CoordState, v: NumOrSlider): Rational | null {
  if (!('slider' in v)) return v.q;
  const sl = sliderOf(p.sliders, v.slider);
  return sliderQ(sl, s.vars[v.slider] ?? sl.value);
}

/** 이 값을 바꾸는 슬라이더 */
export const nosSliders = (v: NumOrSlider): string[] => ('slider' in v ? [v.slider] : []);

/**
 * 고르는 구간의 끝: null(끝없음), 앞에 나온 점 이름(그 점의 x 를 따라감 — 끌어서 구간을 고른다), 또는 수.
 * 점은 x 칸이 유리수여야 한다(넓이 합을 닿는 자리마다 분수로 검산하려고)
 */
export function selEnd(v: unknown, at: string, cx: ParseCtx): SelEnd {
  if (v === null) return null;
  if (typeof v === 'string' && ID.test(v.trim()) && !/^(pi|E)$/.test(v.trim())) {
    const pt = cx.pointRef(v.trim(), at);
    if (!xCells(cx.x, pt).step) fail(at, `점 ${pt.id} 의 x 칸이 유리수가 아님`);
    return { pt: pt.id };
  }
  return qnum(v, at);
}

/** 끝의 지금 x(수). null 이면 왼쪽 끝은 −∞, 오른쪽 끝은 +∞ */
export function endNum(p: CoordParams, s: CoordState, e: SelEnd, side: 0 | 1): number {
  if (e === null) return side === 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  if ('pt' in e) return pointXY(p, s, e.pt)[0];
  return e.n;
}

/** 끝의 지금 x(분수). null(끝없음)이면 null */
export function endQ(p: CoordParams, s: CoordState, e: SelEnd): Rational | null {
  if (e === null) return null;
  if ('pt' in e) return pointQ(p, s, e.pt)[0];
  return e.q;
}

/** 끝을 바꾸는 끄는 점. drag 는 점 id → 끄는 점인가(형식 검사 중에는 ParseCtx 의 점 표로, 그 뒤에는 매개변수로) */
export const dragEnds = (ends: SelEnd[], drag: (id: string) => boolean): string[] =>
  ends.flatMap((e) => (e && 'pt' in e && drag(e.pt) ? [e.pt] : []));
export const endPoints = (p: CoordParams, ends: SelEnd[]): string[] =>
  dragEnds(ends, (id) => pointOf(p, id).drag !== 'none');

/**
 * 형식 검사: 읽는 값이 바뀌는 상태 수(슬라이더 칸 × 끄는 점 칸)가 상한 안인가. 검산이 그 모든 상태에서 화면 숫자를
 * sympy 와 견주므로(areaChecks·probChecks), 넘으면 검산 때가 아니라 지금 무엇을 줄일지 알려 준다
 */
export function checkStateCount(
  cx: ParseCtx,
  sliders: string[],
  points: string[],
  at: string,
  what: string,
): void {
  let n = 1;
  for (const id of new Set(sliders)) n *= sliderValues(sliderOf(cx.sliders, id)).length;
  for (const id of new Set(points)) {
    const pt = cx.points.get(id);
    if (!pt) continue;
    const { i0, i1 } = xCells(cx.x, pt);
    n *= i1 - i0 + 1;
  }
  if (n > GOAL_MAX_STATES)
    fail(
      at,
      `${what} 가 바뀌는 상태가 ${n}개 — ${GOAL_MAX_STATES}개 이하로(검산이 모든 상태에서 화면 숫자를 sympy 와 견줌). 슬라이더·끄는 점의 칸을 줄이거나 하나를 고정하세요`,
    );
}

/** 닿는 상태 하나: 상태, 그 상태를 적은 글('n=10, p=3/10, K=3' — 검산 항목 이름), sympy 값(슬라이더 이름 → 분수 글자) */
export interface StatState {
  s: CoordState;
  text: string;
  sym: Record<string, string>;
}

/**
 * 슬라이더·끄는 점이 닿는 모든 상태(목표 검산과 같은 growStates — 2000 상한과 그 형식 오류를 함께 쓴다).
 * 점은 그 점이 닿는 칸(point.ts xCells — 끌기·방향키가 보는 칸과 같다), 칸 위 점의 세로 칸은 처음 자리 그대로.
 */
export function statStates(
  p: CoordParams,
  sliders: string[],
  points: string[],
  at: string,
): StatState[] {
  type Acc = { s: CoordState; sym: Record<string, string> };
  let acc: Acc[] = [{ s: initial(p), sym: {} }];
  for (const id of [...new Set(sliders)]) {
    const sl = sliderOf(p.sliders, id);
    acc = growStates(
      acc,
      sliderValues(sl).map(({ k, v }) => ({
        patch: (s: CoordState) => ({ ...s, vars: { ...s.vars, [id]: v } }),
        sym: { [id]: sliderSym(sl, k) },
      })),
      at,
    );
  }
  for (const id of [...new Set(points)]) {
    const o = pointOf(p, id);
    const { i0, i1, step } = xCells(p.x, o);
    const opts = [];
    for (let i = i0; i <= i1; i++)
      opts.push({
        patch: (s: CoordState) => ({ ...s, pts: { ...s.pts, [id]: { i, j: o.j } } }),
        sym: { [id]: step ? ratStr(mul(qi(i), step)) : String(i) },
      });
    acc = growStates(acc, opts, at);
  }
  return acc.map((a) => ({
    s: a.s,
    sym: a.sym,
    text: Object.entries(a.sym)
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
  }));
}

/**
 * 분수를 d 자리로 반올림한 글자(0.5 는 0 에서 먼 쪽 — sympy approx 검산과 같은 규칙), 끝의 0 은 뗀다(다른 읽는 값
 * fmtNum 과 같은 꼴). 부동소수를 거치지 않는다: 0.00125 같은 정확한 값이 이진수 오차로 반대쪽으로 반올림되지 않게
 */
export function roundQ(q: Rational, d: number): string {
  const [n, den] = q;
  const neg = n < 0n;
  const a = neg ? -n : n;
  const scale = 10n ** BigInt(d);
  const r = (a * scale * 2n + den) / (den * 2n);
  let t = (r / scale).toString();
  if (d > 0) {
    const fp = (r % scale).toString().padStart(d, '0').replace(/0+$/, '');
    if (fp) t += `.${fp}`;
  }
  return neg && r !== 0n ? `-${t}` : t;
}

/** 반올림이 값을 바꾸는가(정확한 분수 q 를 d 자리로) — 바꾸면 화면에 ≈ */
export const inexactQ = (q: Rational, d: number) => (q[0] * 10n ** BigInt(d)) % q[1] !== 0n;

/** 화면 숫자 글자(빼기 기호는 −). 검산은 ASCII 글자를, 화면은 이 글자를 쓴다 */
export const minus = (t: string) => t.replace('-', '−');
