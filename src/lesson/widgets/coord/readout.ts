// 읽는 값 객체 {readout:'slope(P,Q)', label}: 식 글자 형식 검사·값 계산·화면 숫자 한 줄.
// 그림 위에는 아무것도 그리지 않고 readouts 목록에만 보탠다.
// 목표가 읽는 값을 견주므로(조각 ②) 같은 값을 세 갈래로 낸다 — 화면 수(readout), 판정용 분수(readoutVal),
// 검산용 sympy 글자(readoutSym). 세 갈래가 어긋나면 검산의 goal 항목(앱 판정 = sympy 판정)이 잡는다.
import { compile, derivative, evalExact, evalNum, varsOf } from '../../expr.ts';
import { GOAL_MAX_STATES, type Val } from '../../goal.ts';
import { fail, int, obj, str } from '../../parse.ts';
import { type Rational, reduce } from '../../sym.ts';
import { curveOf, dfAt } from './curve.ts';
import { fmtNum } from './frame.ts';
import { coincide, pointOf, pointQ, pointXY, xSym, ySym } from './point.ts';
import { polyOf, rootCount } from './poly.ts';
import { sliderQ, sliderValues } from './slider.ts';
import type {
  CoordParams,
  CoordState,
  CurveObj,
  KindDef,
  ParseCtx,
  ReadoutExpr,
  ReadoutObj,
} from './types.ts';

const SLOPE_RE = /^slope\((\w+),(\w+)\)$/;
const DERIV_RE = /^deriv\((\w+),(\w+)\)$/;
const XY_RE = /^([xy])\((\w+)\)$/;
const VALUE_RE = /^value\((\w+)\)$/;
const ROOTS_RE = /^roots\((\w+)\)$/;
const MEET_RE = /^meet\((\w+),(\w+)\)$/;

const FORMS = 'slope(P,Q)·deriv(f,P)·x(P)·y(P)·value(a)·roots(f)·meet(f,g)·슬라이더 식(b**2-4*a*c)';

/**
 * 실근 개수를 셀 곡선: 슬라이더가 늘 분수 값이고(π 칸이 아님) **슬라이더의 모든 값에서** x 의 다항식이어야 한다.
 * 처음 값에서만 보면 x**n 의 n=2 는 통과하고 n=3/2 로 옮기는 순간 개수를 셀 수 없게 된다.
 */
function polyCurve(cx: ParseCtx, v: string, at: string): CurveObj {
  const c = cx.curveRef(v, at);
  const used = varsOf(c.node);
  let envs: Record<string, Rational>[] = [{}];
  for (const sl of cx.sliders) {
    if (!used.has(sl.id)) continue;
    const qs = sliderValues(sl).map(({ v: x }) => sliderQ(sl, x));
    if (qs.some((q) => !q))
      fail(at, `슬라이더 ${sl.id} 의 칸이 분수가 아니라 실근을 정확히 셀 수 없음`);
    if (envs.length * qs.length > GOAL_MAX_STATES)
      fail(
        at,
        `슬라이더 칸 조합이 ${GOAL_MAX_STATES}개를 넘어 모든 값에서 다항식인지 확인할 수 없음`,
      );
    envs = envs.flatMap((e) => qs.map((q) => ({ ...e, [sl.id]: q as Rational })));
  }
  for (const env of envs)
    if (!polyOf(c.node, env)) {
      const at2 = Object.entries(env)
        .map(([k, [a, b]]) => `${k}=${b === 1n ? a : `${a}/${b}`}`)
        .join(', ');
      fail(
        at,
        `곡선 ${c.id} 이 x 의 다항식이 아닌 자리가 있어 실근을 셀 수 없음${at2 ? ` (${at2})` : ''}`,
      );
    }
  return c;
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
  const pa = polyOf(curveOf(p, a).node, env);
  const pb = b === undefined ? [] : polyOf(curveOf(p, b).node, env);
  if (!pa || !pb) return Number.NaN;
  const diff = Array.from({ length: Math.max(pa.length, pb.length) }, (_, i) => {
    const x = pa[i] ?? ([0n, 1n] as Rational);
    const y = pb[i] ?? ([0n, 1n] as Rational);
    return reduce(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
  });
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
  }
}

const qsub = (a: Rational, b: Rational) => reduce(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const qdiv = (a: Rational, b: Rational) => reduce(a[0] * b[1], a[1] * b[0]);

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
        if (c) return xa ? evalExact(derivative(curveOf(p, c).node, 'x'), { ...env, x: xa }) : null;
        const [xb, yb] = pointQ(p, s, e.b);
        if (!xa || !ya || !xb || !yb || xa[0] * xb[1] === xb[0] * xa[1]) return null;
        return qdiv(qsub(yb, ya), qsub(xb, xa));
      }
      case 'deriv': {
        const xa = pointQ(p, s, e.at)[0];
        return xa ? evalExact(derivative(curveOf(p, e.curve).node, 'x'), { ...env, x: xa }) : null;
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
    }
  };
  const q = exact();
  if (q) return { n: Number(q[0]) / Number(q[1]), q };
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
  }
}

/** 이 읽는 값을 바꾸는 것들 — 끄는 점 id 와 슬라이더 id(목표 판정 검산에서 늘어놓을 상태) */
export function readoutMovers(
  p: CoordParams,
  e: ReadoutExpr,
): { points: string[]; sliders: string[] } {
  const pts = new Set<string>();
  const sl = new Set<string>();
  const ids = new Set(p.sliders.map((x) => x.id));
  const curve = (id: string) => {
    for (const v of varsOf(curveOf(p, id).node)) if (ids.has(v)) sl.add(v);
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
  }
  return { points: [...pts], sliders: [...sl] };
}

export const readoutKind: KindDef<ReadoutObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['readout', 'label'], ['digits']);
    const src = str(c.readout, `${at} readout`);
    const e = parseReadoutExpr(src, at, cx);
    const count = e.f === 'roots' || e.f === 'meet';
    return {
      kind: 'readout',
      src,
      expr: e,
      label: str(c.label, `${at} label`),
      // 개수는 늘 정수로 보인다
      digits: count ? 0 : c.digits === undefined ? 2 : int(c.digits, `${at} digits`, 0, 4),
    };
  },
  draw(o, k, { p, s, readouts }) {
    readouts.push({
      key: `r${k}`,
      label: o.label,
      text: fmtNum(readout(p, s, o.expr), o.digits),
    });
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
