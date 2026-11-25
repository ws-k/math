// 읽는 값 객체 {readout:'slope(P,Q)', label}: 식 글자 형식 검사·값 계산·화면 숫자 한 줄.
// 그림 위에는 아무것도 그리지 않고 readouts 목록에만 보탠다.
// 목표가 읽는 값을 견주므로(조각 ②) 같은 값을 세 갈래로 낸다 — 화면 수(readout), 판정용 분수(readoutVal),
// 검산용 sympy 글자(readoutSym). 세 갈래가 어긋나면 검산의 goal 항목(앱 판정 = sympy 판정)이 잡는다.
import { compile, evalExact, evalNum, varsOf } from '../../expr.ts';
import { GOAL_MAX_STATES, type Val } from '../../goal.ts';
import { fail, int, obj, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { div, num, qi, ratStr, sub } from '../q.ts';
import { areaChecks, areaText, barsArea, barsMovers, barsOf, barsSliders } from './bars.ts';
import { ciMovers, ciOf, coverAt } from './ci.ts';
import { curveDerivExact, curveOf, curveVars, dfAt, plainOf, wholeCurve } from './curve.ts';
import { fillEnds, fillOf, fillSums, fillSumsAt } from './fill.ts';
import { fmtNum } from './frame.ts';
import { distSliders, probAt, probChecks, probText, shadeMovers, shadeOf } from './normal.ts';
import { coincide, pointOf, pointQ, pointXY, xSym, ySym } from './point.ts';
import { polyOf, rootCount } from './poly.ts';
import { rectsOf, sumSym, sums } from './rects.ts';
import { sliderQ, sliderText, sliderValues } from './slider.ts';
import { checkStateCount, dragEnds, inexactQ } from './stat.ts';
import type {
  CoordParams,
  CoordState,
  CurveObj,
  FillArea,
  FillObj,
  KindDef,
  NormalDist,
  ParseCtx,
  PlainCurve,
  ReadoutExpr,
  ReadoutLine,
  ReadoutObj,
} from './types.ts';

const SLOPE_RE = /^slope\((\w+),(\w+)\)$/;
const DERIV_RE = /^deriv\((\w+),(\w+)\)$/;
const XY_RE = /^([xy])\((\w+)\)$/;
const VALUE_RE = /^value\((\w+)\)$/;
const ROOTS_RE = /^roots\((\w+)\)$/;
const MEET_RE = /^meet\((\w+),(\w+)\)$/;
const RECTS_RE = /^(sums|big|small|gap)\((\w+)\)$/;
const FILL_RE = /^(net|abs)\((\w+)\)$/;
const AREA_RE = /^area\((\w+)\)$/;
const PROB_RE = /^prob\((\w+)\)$/;
const COVER_RE = /^cover\((\w+)\)$/;

const FORMS =
  'slope(P,Q)·deriv(f,P)·x(P)·y(P)·value(a)·roots(f)·meet(f,g)·sums(R)·big(R)·small(R)·gap(R)·net(F)·abs(F)·area(B)·prob(A)·cover(C)·슬라이더 식(b**2-4*a*c)';

// ---- 단위 ----

const isArea = (e: ReadoutExpr) =>
  e.f === 'sums' ||
  e.f === 'big' ||
  e.f === 'small' ||
  e.f === 'gap' ||
  e.f === 'net' ||
  e.f === 'abs';

/**
 * 읽는 값의 단위 — 축에서 저절로 정한다(읽는 값마다 적지 않아 어긋날 수 없다).
 * 가로 좌표 → 가로 단위, 세로 좌표 → 세로 단위, 기울기 → 세로/가로, 넓이(조각 합) → 가로×세로(같으면 m²).
 * 시간 × (km/시) = km 처럼 저절로 만든 글자가 어색하면 세로축의 areaUnit·slopeUnit 이 덮어쓴다.
 * 슬라이더 값·식 값·개수는 단위가 없다. 정할 수 없으면(넓이인데 가로·세로 단위가 다르거나 한쪽만 있음) 오류 글자.
 */
export function unitOf(
  p: Pick<CoordParams, 'x' | 'y'>,
  e: ReadoutExpr,
): string | { error: string } | undefined {
  const { x, y } = p;
  switch (e.f) {
    case 'x':
      return x.unit;
    case 'y':
      return y.unit;
    case 'slope':
    case 'deriv':
      if (y.slopeUnit) return y.slopeUnit;
      // 같은 단위끼리 나누면 단위가 없다(m/m 이 아니라 그냥 수 — 경사의 '오르막 비율')
      if (x.unit && y.unit) return x.unit === y.unit ? undefined : `${y.unit}/${x.unit}`;
      if (x.unit || y.unit)
        return {
          error: '가로·세로 중 한쪽만 단위가 있어 기울기 단위를 정할 수 없음 — y 의 slopeUnit 으로',
        };
      return undefined;
    case 'sums':
    case 'big':
    case 'small':
    case 'gap':
    case 'net':
    case 'abs':
      if (y.areaUnit) return y.areaUnit;
      if (x.unit && y.unit && x.unit === y.unit) return `${x.unit}²`;
      if (x.unit || y.unit)
        return {
          error: `가로(${x.unit ?? '단위 없음'})·세로(${y.unit ?? '단위 없음'}) 단위로 넓이 단위를 정할 수 없음 — y 의 areaUnit 으로 한 번 적으세요`,
        };
      return undefined;
    default:
      return undefined;
  }
}

const withUnit = (t: string, u: string | undefined) => (u && t !== '—' ? `${t} ${u}` : t);

/**
 * 실근 개수를 셀 곡선(읽기): 곡선의 슬라이더가 분수 칸이고(π 칸이 아님) 처음 값에서 x 의 다항식이어야 한다.
 * 슬라이더의 **모든 값**에서 다항식인지(x**n 의 n=3/2 처럼 옮기면 셀 수 없게 되는 곳)는 값 조합을 다 늘어놓는
 * 무거운 검사라 형식 검사(checkPolyCurves, coordDef.deep)에서만 한다.
 */
function polyCurve(cx: ParseCtx, v: string, at: string): CurveObj {
  const c = wholeCurve(cx.curveRef(v, at), at, '실근 개수(roots·meet)');
  const used = varsOf(c.node);
  const env: Record<string, Rational> = {};
  for (const sl of cx.sliders) {
    if (!used.has(sl.id)) continue;
    const q = sliderQ(sl, sl.value);
    if (!q) return fail(at, `슬라이더 ${sl.id} 의 칸이 분수가 아니라 실근을 정확히 셀 수 없음`);
    env[sl.id] = q;
  }
  if (!polyOf(c.node, env)) fail(at, `곡선 ${c.id} 이 x 의 다항식이 아니라 실근을 셀 수 없음`);
  return c;
}

/** 실근 개수를 세는 곡선들(읽는 값·목표의 roots·meet) */
function countedCurves(p: CoordParams): string[] {
  const out = new Set<string>();
  const add = (e: ReadoutExpr) => {
    if (e.f === 'roots') out.add(e.curve);
    if (e.f === 'meet') {
      out.add(e.a);
      out.add(e.b);
    }
  };
  for (const o of p.objects) if (o.kind === 'readout') add(o.expr);
  const g = p.goal;
  if (g && 'kind' in g && g.kind !== 'place') {
    add(g.of);
    if (g.kind === 'value' && 'of' in g.is) add(g.is.of);
  }
  return [...out];
}

/** 형식 검사: 실근 개수를 세는 곡선이 슬라이더의 모든 값(조합)에서 x 의 다항식인가 */
export function checkPolyCurves(p: CoordParams): void {
  const at = '좌표 roots·meet';
  for (const id of countedCurves(p)) {
    const c = plainOf(p, id);
    const used = varsOf(c.node);
    let envs: Record<string, Rational>[] = [{}];
    for (const sl of p.sliders) {
      if (!used.has(sl.id)) continue;
      const qs = sliderValues(sl).map(({ v: x }) => sliderQ(sl, x) as Rational);
      if (envs.length * qs.length > GOAL_MAX_STATES)
        fail(
          at,
          `슬라이더 칸 조합이 ${GOAL_MAX_STATES}개를 넘어 모든 값에서 다항식인지 확인할 수 없음`,
        );
      envs = envs.flatMap((e) => qs.map((q) => ({ ...e, [sl.id]: q })));
    }
    for (const env of envs)
      if (!polyOf(c.node, env)) {
        const where = Object.entries(env)
          .map(([k, q]) => `${k}=${ratStr(q)}`)
          .join(', ');
        fail(at, `곡선 ${id} 이 x 의 다항식이 아닌 자리가 있어 실근을 셀 수 없음 (${where})`);
      }
  }
}

/** 읽는 값 글자 읽기(형식 검사). 목표의 of·is 도 이 함수를 쓴다 */
export function parseReadoutExpr(s: string, at: string, cx: ParseCtx): ReadoutExpr {
  const t = s.replace(/\s+/g, '');
  let m = t.match(SLOPE_RE);
  if (m) {
    const a = cx.pointRef(m[1], at).id;
    return { f: 'slope', a, b: cx.pointRef(m[2], at).id };
  }
  m = t.match(DERIV_RE);
  if (m) {
    const cv = cx.curveRef(m[1], at);
    if (cx.pointRef(m[2], at).on !== cv.id) fail(at, '접점이 그 곡선 위 점이 아님');
    return { f: 'deriv', curve: cv.id, at: m[2] as string };
  }
  m = t.match(XY_RE);
  if (m) return { f: m[1] as 'x' | 'y', at: cx.pointRef(m[2], at).id };
  m = t.match(VALUE_RE);
  if (m) {
    if (!cx.sliders.some((sl) => sl.id === m?.[1])) fail(at, `없는 슬라이더 ${m[1]}`);
    return { f: 'value', slider: m[1] as string };
  }
  m = t.match(ROOTS_RE);
  if (m) return { f: 'roots', curve: polyCurve(cx, m[1] as string, at).id };
  m = t.match(MEET_RE);
  if (m) {
    const a = polyCurve(cx, m[1] as string, at).id;
    return { f: 'meet', a, b: polyCurve(cx, m[2] as string, at).id };
  }
  m = t.match(RECTS_RE);
  if (m) {
    const id = m[2] as string;
    if (!cx.rects.has(id)) fail(at, `앞에 없는 구분구적 조각 ${id}`);
    return { f: m[1] as 'sums' | 'big' | 'small' | 'gap', rects: id };
  }
  m = t.match(FILL_RE);
  if (m) {
    const id = m[2] as string;
    const fo = cx.fills.get(id);
    if (!fo) return fail(at, `앞에 없는 칠하기 ${id}(칠하기에 id 를 붙이세요)`);
    // 맞힌 뒤 칠하기의 넓이를 읽으면 맞히기 전에 답(영역의 크기)이 보인다 — 숨긴 곡선·점과 같은 규칙
    if (fo.hide) fail(at, `숨긴 칠하기 ${id} 의 합은 읽지 못함(맞히기 전에 드러남)`);
    return { f: m[1] as 'net' | 'abs', fill: id };
  }
  m = t.match(AREA_RE);
  if (m) {
    if (!cx.bars.has(m[1] as string)) fail(at, `앞에 없는 막대 ${m[1]}`);
    return { f: 'area', bars: m[1] as string };
  }
  m = t.match(PROB_RE);
  if (m) {
    if (!cx.shades.has(m[1] as string))
      fail(at, `앞에 없는 정규분포 넓이 ${m[1]}(shade 에 id 를 붙이세요)`);
    return { f: 'prob', shade: m[1] as string };
  }
  m = t.match(COVER_RE);
  if (m) {
    if (!cx.cis.has(m[1] as string)) fail(at, `앞에 없는 신뢰구간 ${m[1]}`);
    return { f: 'cover', ci: m[1] as string };
  }
  // 나머지는 슬라이더로 계산하는 식(판별식 등). x 를 쓰면 곡선이지 읽는 값이 아니다
  try {
    return {
      f: 'calc',
      src: t,
      node: compile(
        t,
        cx.sliders.map((sl) => sl.id),
      ),
    };
  } catch {
    return fail(at, `${FORMS} 중 하나가 아님 (${s})`);
  }
}

/** 슬라이더 값의 분수(분수가 아닌 칸이면 그 이름은 빠진다) */
function envQ(p: CoordParams, s: CoordState): Record<string, Rational> {
  const out: Record<string, Rational> = {};
  for (const sl of p.sliders) {
    const q = sliderQ(sl, s.vars[sl.id] ?? sl.value);
    if (q) out[sl.id] = q;
  }
  return out;
}

/** f−g(또는 f) 의 서로 다른 실근 개수. 다항식이 아니거나 0 인 다항식(무수히 많음)이면 NaN */
function rootsOf(p: CoordParams, s: CoordState, a: string, b?: string): number {
  const env = envQ(p, s);
  const pa = polyOf(plainOf(p, a).node, env);
  const pb = b === undefined ? [] : polyOf(plainOf(p, b).node, env);
  if (!pa || !pb) return Number.NaN;
  const diff = Array.from({ length: Math.max(pa.length, pb.length) }, (_, i) =>
    sub(pa[i] ?? qi(0), pb[i] ?? qi(0)),
  );
  return rootCount(diff) ?? Number.NaN;
}

/** 읽는 값(수). 할선의 두 점이 겹치면 그 곡선의 접선 기울기(극한) */
export function readout(p: CoordParams, s: CoordState, e: ReadoutExpr): number {
  switch (e.f) {
    case 'slope': {
      const c = coincide(p, s, e.a, e.b);
      const [x1, y1] = pointXY(p, s, e.a);
      if (c) return dfAt(p, s, c, x1);
      const [x2, y2] = pointXY(p, s, e.b);
      return x1 === x2 ? Number.NaN : (y2 - y1) / (x2 - x1);
    }
    case 'deriv':
      return dfAt(p, s, e.curve, pointXY(p, s, e.at)[0]);
    case 'x':
      return pointXY(p, s, e.at)[0];
    case 'y':
      return pointXY(p, s, e.at)[1];
    case 'value':
      return s.vars[e.slider] ?? Number.NaN;
    case 'roots':
      return rootsOf(p, s, e.curve);
    case 'meet':
      return rootsOf(p, s, e.a, e.b);
    case 'calc': {
      const v = readoutVal(p, s, e);
      return v.n;
    }
    case 'sums':
      return Number.NaN;
    case 'big':
    case 'small':
    case 'gap': {
      // readoutVal 을 부르지 않는다 — 합을 못 구하면 readoutVal 이 다시 이 함수로 돌아와 끝없이 돈다
      const v = sums(p, s, rectsOf(p, e.rects));
      if (!v) return Number.NaN;
      const q = e.f === 'gap' ? sub(v.big, v.small) : v[e.f];
      return num(q);
    }
    case 'net':
    case 'abs': {
      const v = fillSums(p, s, fillOf(p, e.fill));
      return v ? num(v[e.f]) : Number.NaN;
    }
    case 'area':
      return num(barsArea(p, s, barsOf(p, e.bars)));
    case 'prob':
      return probAt(p, s, shadeOf(p, e.shade));
    case 'cover':
      return coverAt(p, s, ciOf(p, e.ci));
  }
}

/** 판정용 값: 수와, 분수로 정확히 구해지면 그 분수(무리수·π 칸이면 null) */
export function readoutVal(p: CoordParams, s: CoordState, e: ReadoutExpr): Val {
  const env = envQ(p, s);
  const exact = (): Rational | null => {
    switch (e.f) {
      case 'x':
        return pointQ(p, s, e.at)[0];
      case 'y':
        return pointQ(p, s, e.at)[1];
      case 'slope': {
        const c = coincide(p, s, e.a, e.b);
        const [xa, ya] = pointQ(p, s, e.a);
        if (c) return xa ? curveDerivExact(p, c, { ...env, x: xa }) : null;
        const [xb, yb] = pointQ(p, s, e.b);
        if (!xa || !ya || !xb || !yb || xa[0] * xb[1] === xb[0] * xa[1]) return null;
        return div(sub(yb, ya), sub(xb, xa));
      }
      case 'deriv': {
        const xa = pointQ(p, s, e.at)[0];
        return xa ? curveDerivExact(p, e.curve, { ...env, x: xa }) : null;
      }
      case 'value':
        return env[e.slider] ?? null;
      case 'calc':
        return evalExact(e.node, env);
      case 'roots':
      case 'meet': {
        const n = e.f === 'roots' ? rootsOf(p, s, e.curve) : rootsOf(p, s, e.a, e.b);
        return Number.isNaN(n) ? null : [BigInt(n), 1n];
      }
      case 'sums':
        return null;
      case 'big':
      case 'small':
      case 'gap': {
        const v = sums(p, s, rectsOf(p, e.rects));
        if (!v) return null;
        return e.f === 'gap' ? sub(v.big, v.small) : v[e.f];
      }
      case 'net':
      case 'abs':
        return fillSums(p, s, fillOf(p, e.fill))?.[e.f] ?? null;
      case 'area':
        return barsArea(p, s, barsOf(p, e.bars));
      case 'cover': {
        const n = coverAt(p, s, ciOf(p, e.ci));
        return Number.isNaN(n) ? null : [BigInt(n), 1n];
      }
      case 'prob':
        // 무리수(끝이 m·끝없음인 경우만 0·1/2·1) — 수로만 견준다
        return null;
    }
  };
  const q = exact();
  if (q) return { n: num(q), q };
  // 분수로 안 되면(π 칸 슬라이더·√·무리수 곡선) 수로
  if (e.f === 'calc') return { n: evalNum(e.node, s.vars), q: null };
  return { n: readout(p, s, e), q: null };
}

/**
 * 검산용 sympy 글자. 끄는 점의 좌표는 상태 기호(pt_P_x), 슬라이더는 그 이름이고, 고정된 점은 값을 그대로 넣는다.
 * roots 면 그 식의 서로 다른 실근 개수를 sympy 가 따로 센다(verify.py check_goal).
 */
export function readoutSym(p: CoordParams, e: ReadoutExpr): { expr: string; roots?: true } {
  switch (e.f) {
    case 'x':
      return { expr: xSym(p, e.at) };
    case 'y':
      return { expr: ySym(p, e.at) };
    case 'slope': {
      const [xa, ya, xb, yb] = [xSym(p, e.a), ySym(p, e.a), xSym(p, e.b), ySym(p, e.b)];
      const sec = `((${yb})-(${ya}))/((${xb})-(${xa}))`;
      const a = pointOf(p, e.a);
      // 같은 곡선 위 두 점이 겹치면 앱은 접선 기울기(극한)를 읽는다 — sympy 도 같은 갈래로
      if (a.on && a.on === pointOf(p, e.b).on)
        return {
          expr: `Piecewise((diff(${curveOf(p, a.on).expr},x).subs(x,${xa}), Eq(${xa},${xb})), (${sec}, True))`,
        };
      return { expr: sec };
    }
    case 'deriv':
      return { expr: `diff(${curveOf(p, e.curve).expr},x).subs(x,${xSym(p, e.at)})` };
    case 'value':
      return { expr: e.slider };
    case 'calc':
      return { expr: e.src };
    case 'roots':
      return { expr: curveOf(p, e.curve).expr, roots: true };
    case 'meet':
      return { expr: `(${curveOf(p, e.a).expr})-(${curveOf(p, e.b).expr})`, roots: true };
    case 'sums':
      // 목표 형식 검사(goal.ts)가 막는다 — 값이 둘이라 견줄 수 없음
      throw new Error('sums 는 목표로 못 씀');
    case 'big':
    case 'small':
    case 'gap': {
      const o = rectsOf(p, e.rects);
      return { expr: sumSym(p, o, e.f, 'count' in o.n ? String(o.n.count) : o.n.slider) };
    }
    case 'net': {
      const fo = fillOf(p, e.fill);
      return { expr: netSym(fo, fo.toPt ? xSym(p, fo.toPt) : (fo.area?.bSrc as string)) };
    }
    case 'abs':
      // 목표 형식 검사(goal.ts)가 막는다 — 끝이 상태 기호면 끊는 곳(근)이 상태마다 달라 한 식으로 적지 않는다
      throw new Error('abs 는 목표로 못 씀');
    case 'area':
    case 'prob':
    case 'cover':
      // 목표 형식 검사(goal.ts)가 막는다 — 검산은 읽는 값 자기 항목(areaChecks·probChecks·신뢰구간)이 상태마다 따로 낸다
      throw new Error(`${e.f} 는 목표로 못 씀`);
  }
}

/**
 * 위−아래 식을 sympy 에서 분수 계수로. 곡선에 소수(0.1)가 있으면 파이썬이 실수로 계산해 적분이 0.30000000000000004 처럼
 * 나와 분수 답과 어긋난다 — 앱은 소수 계수를 분수로 정확히 계산하므로(expr.ts evalExact) 검산도 분수로 맞춘다
 */
const exactDiff = (diffSrc: string) => `nsimplify(${diffSrc}, rational=True)`;

/** 부호 있는 합의 sympy 글자(끝 b 는 수 또는 상태 기호) */
const netSym = (o: FillObj, b: string) => {
  const ar = o.area as FillArea;
  return `integrate(${exactDiff(ar.diffSrc)},(x,${ar.aSrc},${b}))`;
};

/**
 * 부호 뗀 합의 sympy 검산식(위−아래 식, 시작, 끝): 위−아래의 실근을 sympy 가 따로 찾아 그 자리에서 끊고, 조각마다
 * 적분의 부호를 뗀다. 앱의 끊는 자리(유리근 정리)를 옮겨 적지 않는다 — 앱이 근을 빠뜨리면 이 식이 다른 값을 내야
 * 잡히므로(원칙 P7). 근은 real_roots 로 찾는다: solve 는 세 실근 삼차식(x³−3x+1)의 근을 복소수 꼴로 내서 is_real 이
 * 정해지지 않아 근을 모두 버렸다.
 */
export const absCheckSym = (diffSrc: string, a: string, b: string) =>
  [
    `f = ${exactDiff(diffSrc)}`,
    `lo, hi = S('${a}'), S('${b}')`,
    'cuts = sorted({lo, hi} | {c for c in real_roots(Poly(f, x)) if lo < c < hi})',
    'ans = sum(Abs(integrate(f, (x, c0, c1))) for c0, c1 in zip(cuts, cuts[1:]))',
  ].join('\n');

const absSym = (o: FillObj, b: string) => {
  const ar = o.area as FillArea;
  return absCheckSym(ar.diffSrc, ar.aSrc, b);
};

/** 이 읽는 값을 바꾸는 것들 — 끄는 점 id 와 슬라이더 id(목표 판정 검산에서 늘어놓을 상태) */
export function readoutMovers(
  p: CoordParams,
  e: ReadoutExpr,
): { points: string[]; sliders: string[] } {
  const pts = new Set<string>();
  const sl = new Set<string>();
  const ids = new Set(p.sliders.map((x) => x.id));
  const curve = (id: string) => {
    for (const v of curveVars(curveOf(p, id))) if (ids.has(v)) sl.add(v);
  };
  const point = (id: string) => {
    const o = pointOf(p, id);
    if (o.drag !== 'none') pts.add(id);
    if (o.on) curve(o.on);
  };
  switch (e.f) {
    case 'x':
    case 'y':
      point(e.at);
      break;
    case 'slope':
      point(e.a);
      point(e.b);
      break;
    case 'deriv':
      point(e.at);
      curve(e.curve);
      break;
    case 'value':
      sl.add(e.slider);
      break;
    case 'calc':
      for (const v of varsOf(e.node)) sl.add(v);
      break;
    case 'roots':
      curve(e.curve);
      break;
    case 'meet':
      curve(e.a);
      curve(e.b);
      break;
    case 'sums':
    case 'big':
    case 'small':
    case 'gap': {
      const o = rectsOf(p, e.rects);
      if ('slider' in o.n) sl.add(o.n.slider);
      break;
    }
    case 'net':
    case 'abs': {
      const o = fillOf(p, e.fill);
      if (o.toPt) point(o.toPt);
      break;
    }
    case 'area':
    case 'prob': {
      const m =
        e.f === 'area' ? barsMovers(p, barsOf(p, e.bars)) : shadeMovers(p, shadeOf(p, e.shade));
      for (const id of m.sliders) sl.add(id);
      for (const id of m.points) point(id);
      break;
    }
    case 'cover':
      for (const id of ciMovers(ciOf(p, e.ci))) sl.add(id);
      break;
  }
  return { points: [...pts], sliders: [...sl] };
}

/** 작은 어림 ~ 큰 어림 한 줄. 조각 수(5개)는 늘 같아 끄는 동안 글자만 바꿔 넣는다 */
function sumsLine(
  p: CoordParams,
  s: CoordState,
  o: ReadoutObj,
  key: string,
  u: string | undefined,
): ReadoutLine {
  const v = sums(p, s, rectsOf(p, (o.expr as { rects: string }).rects));
  const parts = v
    ? [
        {
          text: inexactQ(v.small, o.digits) || inexactQ(v.big, o.digits) ? '≈ ' : '',
          cls: '',
        },
        { text: fmtNum(num(v.small), o.digits), cls: 'lo' },
        { text: ' ~ ', cls: '' },
        { text: fmtNum(num(v.big), o.digits), cls: 'hi' },
        { text: u ? ` ${u}` : '', cls: '' },
      ]
    : [
        { text: '', cls: '' },
        { text: '—', cls: 'lo' },
        { text: ' ~ ', cls: '' },
        { text: '—', cls: 'hi' },
        { text: '', cls: '' },
      ];
  return { key, label: o.label, text: parts.map((x) => x.text).join(''), parts };
}

export const readoutKind: KindDef<ReadoutObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['readout', 'label'], ['digits', 'frac']);
    if (c.frac !== undefined && c.frac !== true) fail(`${at} frac`, 'true 만');
    const src = str(c.readout, `${at} readout`);
    const e = parseReadoutExpr(src, at, cx);
    if (e.f === 'area' || e.f === 'prob') {
      const drag = (id: string) => cx.points.get(id)?.drag !== 'none';
      const o = e.f === 'area' ? cx.bars.get(e.bars) : cx.shades.get(e.shade);
      const sl =
        o?.kind === 'bars'
          ? barsSliders(o)
          : o?.kind === 'shade'
            ? distSliders((cx.curves.get(o.of) as PlainCurve).normal as NormalDist, cx.sliders)
            : [];
      const ends = o?.kind === 'bars' ? (o.sel ?? []) : o?.kind === 'shade' ? o.ends : [];
      checkStateCount(cx, sl, dragEnds(ends, drag), at, `읽는 값 ${src}`);
    }
    const u = unitOf(cx, e);
    if (typeof u === 'object') fail(at, u.error);
    // 정규분포 넓이는 (끝이 평균·끝없음일 때 말고는) 무리수 — 분수 꼴로 보일 값이 없다
    if (c.frac === true && e.f === 'prob')
      fail(`${at} frac`, '정규분포 넓이(prob)는 무리수라 분수로 못 보임 — digits 자리 소수로');
    const count = e.f === 'roots' || e.f === 'meet' || e.f === 'cover';
    // 확률·넓이 합(area·prob)은 표준정규분포표처럼 4자리가 기본 — 2자리면 0.6827 과 0.6800 이 같아 보인다
    const dflt = e.f === 'area' || e.f === 'prob' ? 4 : 2;
    return {
      kind: 'readout',
      src,
      expr: e,
      label: str(c.label, `${at} label`),
      // 개수는 늘 정수로 보인다
      digits: count ? 0 : c.digits === undefined ? dflt : int(c.digits, `${at} digits`, 0, 4),
      ...(c.frac === true ? { frac: true as const } : {}),
    };
  },
  draw(o, k, { p, s, readouts }) {
    const u = unitOf(p, o.expr) as string | undefined;
    if (o.expr.f === 'sums') {
      readouts.push(sumsLine(p, s, o, `r${k}`, u));
      return;
    }
    if (o.expr.f === 'area' || o.expr.f === 'prob') {
      const text =
        o.expr.f === 'area'
          ? areaText(barsArea(p, s, barsOf(p, o.expr.bars)), o)
          : probText(p, s, shadeOf(p, o.expr.shade), o.digits);
      readouts.push({ key: `r${k}`, label: o.label, text: withUnit(text, u) });
      return;
    }
    let text: string;
    const exact = o.frac || isArea(o.expr);
    const v = exact ? readoutVal(p, s, o.expr) : null;
    const e = o.expr;
    const sl = e.f === 'value' ? p.sliders.find((x) => x.id === e.slider) : undefined;
    if (o.frac && v?.q && Number.isFinite(v.n)) text = ratStr(v.q).replace('-', '−');
    // 슬라이더 값 그대로를 읽는 칸은 슬라이더 옆 숫자와 같은 꼴(π/4·1/12) — 같은 값이 0.79 와 π/4 로 엇갈려 보였다
    else if (sl) text = sliderText(sl, s.vars[sl.id] ?? sl.value);
    else {
      text = fmtNum(v ? v.n : readout(p, s, o.expr), o.digits);
      // 조각 넓이 합은 정확한 분수를 반올림해 보인다 — 반올림이 값을 바꾸면 ≈ (285 가 정확한 값이라고 읽지 않게)
      if (isArea(o.expr) && v?.q && inexactQ(v.q, o.digits)) text = `≈ ${text}`;
    }
    readouts.push({ key: `r${k}`, label: o.label, text: withUnit(text, u) });
  },
  checks(o, { p, out }) {
    const e = o.expr;
    if (e.f === 'area') return areaChecks(p, o, e.bars, out);
    if (e.f === 'prob') return probChecks(p, o, e.shade, out);
    if (e.f !== 'net' && e.f !== 'abs') return;
    // 닿는 모든 끝 자리에서 앱의 분수 = sympy integrate(원칙 P7 — 목표가 아니어도 보이는 값은 모두 검산)
    const fo = fillOf(p, e.fill);
    for (const b of fillEnds(p, fo)) {
      const v = fillSumsAt(fo, b);
      const bs = ratStr(b);
      out.push({
        name: `칠하기 ${fo.id} ${e.f === 'net' ? '부호 있는 합' : '부호 뗀 합'}${fo.toPt ? ` x=${bs}` : ''}`,
        answer: ratStr(v[e.f]),
        answerType: 'fraction',
        check: e.f === 'net' ? netSym(fo, bs) : absSym(fo, bs),
      });
    }
  },
  derivOf(p, o) {
    if (o.expr.f === 'deriv') return o.expr.curve;
    if (o.expr.f === 'slope') {
      const a = pointOf(p, o.expr.a);
      if (a.on && a.on === pointOf(p, o.expr.b).on) return a.on;
    }
    return undefined;
  },
  texts: (o) => [o.label],
};
