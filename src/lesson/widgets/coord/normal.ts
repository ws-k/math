// 정규분포 넓이(요청 99, 2-가): 곡선 {id, curve:{normal:[m, s]}} 아래를 {id, shade:{of, x:[a, b]}} 로 칠하고,
// 읽는 값 prob(A) 가 그 넓이 Φ((b−m)/s) − Φ((a−m)/s) 를 낸다. 끝은 수·끄는 점·null(끝없음) — 점을 끌면 넓이가 따라 변한다.
//
// 이 넓이는 (끝이 m 이거나 끝없음인 경우 말고는) 무리수라 분수로 쥘 수 없다. 그래서 칠하기의 넓이 읽기(다항식 적분,
// 정확한 분수)와 따로 두고, 화면 숫자는 digits(기본 4 — 표준정규분포표 자리) 자리로 반올림해 ≈ 를 붙인다. 검산은
// 기존 approx 종류: 닿는 모든 상태에서 화면 글자 = sympy erf 를 같은 자리로 반올림한 값(0.5 는 0 에서 먼 쪽).
// erf 는 부동소수 오차가 1e-15 안이어야 4자리 반올림이 sympy 와 갈리지 않는다 — 근사식(Abramowitz–Stegun 1.5e-7)을
// 쓰지 않고, 작은 x 는 양의 항만 있는 급수(지우는 오차가 없음), 큰 x 는 erfc 연분수로 계산한다.
import { evalNum, varsOf } from '../../expr.ts';
import { arr, fail, obj } from '../../parse.ts';
import { ratStr } from '../q.ts';
import type { WidgetCheck } from '../specs.ts';
import { curveOf } from './curve.ts';
import { clampY, fmtNum, r1, toPx } from './frame.ts';
import { endNum, endPoints, endQ, selEnd, statStates } from './stat.ts';
import type {
  CoordParams,
  CoordState,
  KindDef,
  NormalDist,
  PlainCurve,
  ReadoutObj,
  ShadeObj,
} from './types.ts';

/** 급수와 연분수가 바뀌는 자리. 급수는 항이 e^{x²} 만큼 커져 큰 x 에서 자리를 잃고, 연분수는 작은 x 에서 늦게 모인다 */
const SPLIT = 3;

/** erf(x) = 2/√π · e^{−x²} · Σ 2ⁿ x^{2n+1}/(1·3·…·(2n+1)) — 모든 항이 양수라 빼서 지워지는 자리가 없다 */
function erfSeries(x: number): number {
  let term = x;
  let sum = x;
  for (let n = 1; n < 200; n++) {
    term *= (2 * x * x) / (2 * n + 1);
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return (2 / Math.sqrt(Math.PI)) * Math.exp(-x * x) * sum;
}

/** erfc(x), x > 0: e^{−x²}/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + …)))) — 수정 Lentz 법 */
function erfcCF(x: number): number {
  const tiny = 1e-300;
  let f = x;
  let C = f;
  let D = 0;
  for (let k = 1; k < 500; k++) {
    const a = k / 2;
    D = x + a * D;
    D = Math.abs(D) < tiny ? 1 / tiny : 1 / D;
    C = x + a / C;
    if (Math.abs(C) < tiny) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

/** 오차함수 erf(x) */
export function erf(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x < 0) return -erf(-x);
  if (x === Number.POSITIVE_INFINITY) return 1;
  return x < SPLIT ? erfSeries(x) : 1 - erfcCF(x);
}

/** 1 − erf(x) (x ≥ 0). 큰 x 에서 1 − erf 로 빼면 자리를 다 잃는 꼬리 넓이를 바로 낸다 */
function erfc(x: number): number {
  if (x === Number.POSITIVE_INFINITY) return 0;
  return x < SPLIT ? 1 - erfSeries(x) : erfcCF(x);
}

/** 표준정규분포 누적 Φ(z). 왼쪽 꼬리는 erfc 로(작은 확률의 자리를 지키려고) */
export function normCdf(z: number): number {
  if (Number.isNaN(z)) return Number.NaN;
  if (z === Number.NEGATIVE_INFINITY) return 0;
  if (z === Number.POSITIVE_INFINITY) return 1;
  return z < 0 ? erfc(-z / Math.SQRT2) / 2 : 1 - erfc(z / Math.SQRT2) / 2;
}

export const shadeOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is ShadeObj => o.kind === 'shade' && o.id === id) as ShadeObj;

const distOf = (p: CoordParams, o: ShadeObj) =>
  (curveOf(p, o.of) as PlainCurve).normal as NormalDist;

/** 지금 평균·표준편차 */
function msAt(p: CoordParams, s: CoordState, o: ShadeObj): [number, number] {
  const d = distOf(p, o);
  return [evalNum(d.mNode, s.vars), evalNum(d.sNode, s.vars)];
}

/** 칠한 넓이(수). 끝이 시작 이하면 0 */
export function probAt(p: CoordParams, s: CoordState, o: ShadeObj): number {
  const a = endNum(p, s, o.ends[0], 0);
  const b = endNum(p, s, o.ends[1], 1);
  if (!(b > a)) return 0;
  const [m, sd] = msAt(p, s, o);
  return normCdf((b - m) / sd) - normCdf((a - m) / sd);
}

/**
 * 넓이가 정확히 떨어지는가(0·1/2·1): 끝이 모두 끝없음이거나 평균 m 이거나, 칠할 곳이 없을 때. 그 밖은 무리수
 * (0 이 아닌 유리수·대수적 수의 erf 는 초월수) — 화면에 ≈ 를 붙인다
 */
function exactProb(p: CoordParams, s: CoordState, o: ShadeObj): boolean {
  const a = endNum(p, s, o.ends[0], 0);
  const b = endNum(p, s, o.ends[1], 1);
  if (!(b > a)) return true;
  const [m] = msAt(p, s, o);
  const at = (v: number) =>
    !Number.isFinite(v) || Math.abs(v - m) <= 1e-12 * Math.max(1, Math.abs(m));
  return at(a) && at(b);
}

/** 화면 숫자(ASCII, ≈ 없이) — 검산 approx 의 value 와 같은 글자 */
const probNum = (v: number, digits: number) => fmtNum(v, digits).replace('−', '-');

/** 읽는 값 prob 의 화면 글자 */
export function probText(p: CoordParams, s: CoordState, o: ShadeObj, digits: number): string {
  const t = fmtNum(probAt(p, s, o), digits);
  return exactProb(p, s, o) ? t : `≈ ${t}`;
}

/** 넓이를 바꾸는 슬라이더(곡선의 m·s)와 끄는 점(끝) */
export function shadeMovers(p: CoordParams, o: ShadeObj): { sliders: string[]; points: string[] } {
  const d = distOf(p, o);
  const ids = new Set(p.sliders.map((x) => x.id));
  const sl = [...varsOf(d.mNode), ...varsOf(d.sNode)].filter((v) => ids.has(v));
  return { sliders: [...new Set(sl)], points: endPoints(p, o.ends) };
}

export const shadeKind: KindDef<ShadeObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['id', 'shade']);
    const id = cx.named(c.id, `${at} id`);
    const r = obj(c.shade, `${at} shade`, ['of', 'x']);
    const cv = cx.curveRef(r.of, `${at} shade.of`);
    if (cv.pieces !== undefined || !cv.normal)
      fail(
        `${at} shade.of`,
        `곡선 ${cv.id} 은 정규분포 곡선이 아님 — {curve:{normal:[m, s]}} 로 만든 곡선만(넓이를 정규분포 누적으로 냄)`,
      );
    const [ra, rb] = arr(r.x, `${at} shade.x`, 2, 2);
    const ends: ShadeObj['ends'] = [
      selEnd(ra, `${at} shade.x`, cx),
      selEnd(rb, `${at} shade.x`, cx),
    ];
    const [qa, qb] = ends.map((e) => (e && 'q' in e ? e.q : null));
    if (qa && qb && !(Number(qa[0]) / Number(qa[1]) < Number(qb[0]) / Number(qb[1])))
      fail(`${at} shade.x`, '끝이 시작보다 커야 함');
    const o: ShadeObj = { kind: 'shade', id, of: cv.id, ends };
    cx.shades.set(id, o);
    return o;
  },
  draw(o, k, { p, s, f, fills }) {
    // 화면 안 조각만: 끝없음·화면 밖 끝은 그림 끝에서 자른다(넓이 값은 끝까지 — 읽는 값이 정확히 낸다)
    const lo = Math.max(p.x.lo, endNum(p, s, o.ends[0], 0));
    const hi = Math.min(p.x.hi, endNum(p, s, o.ends[1], 1));
    let d = '';
    if (hi > lo) {
      const [m, sd] = msAt(p, s, o);
      const n = Math.max(40, Math.round((f.r - f.l) / 3));
      const pts: string[] = [];
      for (let i = 0; i <= n; i++) {
        const x = lo + ((hi - lo) * i) / n;
        const y = Math.exp(-((x - m) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
        const [X, Y] = toPx(p, f, x, y);
        pts.push(`${r1(X)} ${r1(clampY(f, Y))}`);
      }
      const [X0, Y0] = toPx(p, f, lo, 0);
      const [X1] = toPx(p, f, hi, 0);
      d = `M${r1(X0)} ${r1(clampY(f, Y0))}L${pts.join('L')}L${r1(X1)} ${r1(clampY(f, Y0))}Z`;
    }
    fills.push({ t: 'path', key: `a${k}`, d, cls: 'fillr shade' });
  },
};

/**
 * 읽는 값 prob 의 검산(approx): 곡선의 m·s 슬라이더와 끝 점이 닿는 모든 상태에서 화면 글자 = sympy erf 를 같은
 * 자리로 반올림한 값. sympy 식은 넓이의 정의(erf)로 따로 쓴다 — 앱의 급수·연분수를 옮기지 않는다
 */
export function probChecks(
  p: CoordParams,
  ro: ReadoutObj,
  shade: string,
  out: WidgetCheck[],
): void {
  const o = shadeOf(p, shade);
  const d = distOf(p, o);
  const m = shadeMovers(p, o);
  for (const st of statStates(p, m.sliders, m.points, `좌표 읽는 값 ${ro.src}`)) {
    const end = (k: 0 | 1) => {
      const q = endQ(p, st.s, o.ends[k]);
      return q ? ratStr(q) : k === 0 ? '-oo' : 'oo';
    };
    const lines = [
      ...m.sliders.map((id) => `${id} = ${st.sym[id]}`),
      `M_ = (${d.m})`,
      `S_ = (${d.s})`,
      `A_, B_ = ${end(0)}, ${end(1)}`,
      'ans = (erf((B_-M_)/(S_*sqrt(2))) - erf((A_-M_)/(S_*sqrt(2))))/2 if B_ > A_ else 0',
    ];
    out.push({
      name: `정규분포 넓이 ${o.id}${st.text ? ` ${st.text}` : ''}`,
      kind: 'approx',
      expr: lines.join('\n'),
      value: probNum(probAt(p, st.s, o), ro.digits),
      digits: ro.digits,
    });
  }
}
