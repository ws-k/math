// 검산 항목(sympy 식): 처음 자리 측정값·잘라 옮기기 넓이·목표 판정.
import { reduce } from '../../sym.ts';
import { ratStr } from '../q.ts';
import type { WidgetCheck } from '../specs.ts';
import { curveSym, shapeOf } from './curve.ts';
import { derivedSym, isDerived, symId } from './derive.ts';
import { goalMovers, goalStates, goalTable } from './goal.ts';
import { arcOf, measureValue, operands, round, shoelace, sub } from './measure.ts';
import { P, shInit } from './model.ts';
import { pieceChecks } from './piece.ts';
import type {
  ShapeParams,
  ShCircle,
  ShCurve,
  ShGoal,
  ShMeasure,
  ShPoint,
  ShState,
} from './types.ts';

/** sympy 수 글자: 정수는 그대로, 0.5 단위는 Rational(5, 2) — 2.5 를 그대로 적으면 sympy 가 부동소수로 읽는다 */
export const numSym = (r: number) => (Number.isInteger(r) ? `${r}` : `Rational(${r * 2}, 2)`);

/** 원 위 점의 반지름 식(수, 또는 중심에서 고정 점까지 거리) */
const radiusSym = (on: { circle: [string, number | string] }, ps: (id: string) => string) => {
  const r = on.circle[1];
  return typeof r === 'number' ? numSym(r) : `(${ps(on.circle[0])}).distance(${ps(r)})`;
};

/** sympy 점 식 */
export function pointSym(p: ShapeParams, s: ShState, id: string): string {
  const pt = p.points.find((x) => x.id === id) as ShPoint;
  if (isDerived(pt)) return derivedSym(pt, (j) => pointSym(p, s, j));
  const a = P(s, id);
  if (pt.on && 'circle' in pt.on) {
    const c = P(s, pt.on.circle[0]);
    const r = radiusSym(pt.on, (j) => pointSym(p, s, j));
    return `Point(${c.x} + ${r}*cos(rad(${a.deg})), ${c.y} + ${r}*sin(rad(${a.deg})))`;
  }
  if (pt.on && 'curve' in pt.on) {
    const cv = (p.curves ?? [])[pt.on.curve] as ShCurve;
    return curveSym(cv, pointSym(p, s, shapeOf(cv).c), String(a.deg), numSym);
  }
  return `Point(${a.x}, ${a.y})`;
}
export const shoelaceSym = (ps: string[]) =>
  `Abs(${ps
    .map((a, i) => {
      const b = ps[(i + 1) % ps.length];
      return `(${a}).x*(${b}).y - (${b}).x*(${a}).y`;
    })
    .join(' + ')})/2`;

/** B 에서 BA 를 시계 반대 방향으로 돌려 BC 에 닿는 각(도, 0~360): atan2(외적, 내적) 를 2π 로 나눈 나머지 */
function ccwSym(a: string, b: string, c: string) {
  const u = (q: string, k: 'x' | 'y') => `((${q}).${k} - (${b}).${k})`;
  const cross = `${u(a, 'x')}*${u(c, 'y')} - ${u(a, 'y')}*${u(c, 'x')}`;
  const dot = `${u(a, 'x')}*${u(c, 'x')} + ${u(a, 'y')}*${u(c, 'y')}`;
  return `deg(Mod(atan2(${cross}, ${dot}), 2*pi))`;
}

/** 측정값의 sympy 식. ps 는 점 id → sympy 점 글자(고정 점은 값, 목표 검산에서 끄는 점은 상태 기호) */
export function measureSym(p: ShapeParams, m: ShMeasure, ps: (id: string) => string): string {
  if ('len' in m) return `${ps(m.len[0])}.distance(${ps(m.len[1])})`;
  if ('angle' in m) {
    const [a, b, c] = m.angle.map(ps) as [string, string, string];
    if (m.ccw) return ccwSym(a, b, c);
    return `deg(acos((${a} - ${b}).dot(${c} - ${b}) / (${a}.distance(${b})*${c}.distance(${b}))))`;
  }
  if ('area' in m) return shoelaceSym((p.polygons[m.area] ?? []).map(ps));
  if ('arc' in m) {
    const a = arcOf(p, m.arc);
    const [o, f, t] = [ps(a.c), ps(a.from), ps(a.to)];
    return `(${o}).distance(${f})*rad(${ccwSym(f, o, t)})`;
  }
  if ('around' in m) {
    const c = p.circles[m.around] as ShCircle;
    return `2*pi*${'r' in c ? numSym(c.r) : `(${ps(c.c)}).distance(${ps(c.through)})`}`;
  }
  const t = operands(m).map((i) => `(${measureSym(p, sub(p, i), ps)})`);
  if ('sq' in m) return `${t[0]}**2`;
  if ('sin' in m) return `sin(rad(${t[0]}))`;
  if ('sum' in m) return t.join(' + ');
  if ('diff' in m) return `Abs(${t[0]} - ${t[1]})`;
  return `${t[0]}/${t[1]}`;
}

export function measureChecks(p: ShapeParams, s: ShState, tag: string): WidgetCheck[] {
  const out: WidgetCheck[] = [];
  const ps = (id: string) => pointSym(p, s, id);
  p.measures.forEach((m, i) => {
    const v = measureValue(p, s, m);
    if (v === null) return;
    const expr = measureSym(p, m, ps);
    out.push({
      name: `${tag} 측정${i + 1}`,
      kind: 'approx',
      expr,
      value: round(v, p.digits).s,
      digits: p.digits,
    });
  });
  return out;
}

/** 목표 판정 검산 항목: 끄는 점이 닿는 모든 자리를 sympy 가 다시 판정(verify.py check_goal) */
export function goalChecks(p: ShapeParams, g: ShGoal): WidgetCheck {
  const s0 = shInit(p);
  const movers = new Set(goalMovers(p, g));
  const ps = (id: string): string => {
    const pt = p.points.find((x) => x.id === id) as ShPoint;
    // 계산되는 점은 끄는 점을 따라오므로 그 점의 상태 기호로 식을 세운다(처음 자리 값으로 굳히지 않게)
    if (isDerived(pt)) return derivedSym(pt, ps);
    if (!movers.has(id)) return pointSym(p, s0, id);
    if (pt.on && 'circle' in pt.on) {
      const c = P(s0, pt.on.circle[0]);
      const r = radiusSym(pt.on, ps);
      return `Point(${c.x} + ${r}*cos(rad(pt_${symId(id)}_d)), ${c.y} + ${r}*sin(rad(pt_${symId(id)}_d)))`;
    }
    if (pt.on && 'curve' in pt.on) {
      const cv = (p.curves ?? [])[pt.on.curve] as ShCurve;
      return curveSym(cv, ps(shapeOf(cv).c), `pt_${symId(id)}_d`, numSym);
    }
    return `Point(pt_${symId(id)}_x, pt_${symId(id)}_y)`;
  };
  const states = goalStates(p, g);
  return {
    name: '목표 판정',
    kind: 'goal',
    of: [{ expr: measureSym(p, p.measures[g.of] as ShMeasure, ps) }],
    targets:
      g.kind === 'visit'
        ? g.at.map((t) => [t.src])
        : [['num' in g.is ? g.is.num.src : measureSym(p, sub(p, g.is.of), ps)]],
    tol: g.tol.src,
    states: states.map((x) => x.sym),
    hits: goalTable(
      p,
      g,
      states.map((x) => x.s),
    ),
    need: g.kind === 'value' ? g.places : 1,
  };
}

/** 격자점 넓이의 정확한 분수(2배 넓이는 정수) */
export const latticeArea = (ps: { x: number; y: number }[]) =>
  ratStr(reduce(BigInt(Math.round(shoelace(ps) * 2)), 2n));

export function shapeChecks(p: ShapeParams): WidgetCheck[] {
  const s = shInit(p);
  const out = measureChecks(p, s, '처음');
  if (p.cut) {
    const c = p.cut;
    const ps = (id: string) => pointSym(p, s, id);
    const whole = latticeArea((p.polygons[0] as string[]).map((id) => P(s, id)));
    // 화면이 보이는 "처음 넓이"(앱 계산)가 sympy 의 조각+나머지, 그리고 결과 모양의 넓이와 같은가
    out.push({
      name: '처음 넓이 = 조각+나머지',
      answer: whole,
      answerType: 'fraction',
      check: `${shoelaceSym(c.rest.map(ps))} + ${shoelaceSym(c.piece.map(ps))}`,
    });
    out.push({
      name: '처음 넓이 = 옮긴 모양',
      answer: whole,
      answerType: 'fraction',
      check: shoelaceSym(c.result.map(([x, y]) => `Point(${x}, ${y})`)),
    });
    out.push({
      name: '옮긴 조각 = 결과 모양 안',
      answer: whole,
      answerType: 'fraction',
      check: `${shoelaceSym(c.rest.map(ps))} + ${shoelaceSym(c.piece.map((id) => `(${ps(id)} + Point(${c.by[0]}, ${c.by[1]}))`))}`,
    });
  }
  if (p.pieces) out.push(...pieceChecks(p));
  if (p.goal) out.push(goalChecks(p, p.goal));
  return out;
}
