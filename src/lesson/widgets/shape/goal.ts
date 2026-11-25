// 목표 판정(손을 뗀 상태 하나)과 검산·형식 검사가 늘어놓는 "끄는 점이 닿는 모든 자리".
import { growStates, hitTable, sameVal, type Val } from '../../goal.ts';
import { type Rational, reduce } from '../../sym.ts';
import { add as qAdd, div as qDiv, qi, neg as qNeg, sub as qSub } from '../q.ts';
import { measureValue, operands, sub } from './measure.ts';
import { circlePos, gcd, P, settle, shInit } from './model.ts';
import {
  CIRCLE_STEP,
  type ShapeParams,
  type ShGoal,
  type ShMeasure,
  type ShPoint,
  type ShState,
} from './types.ts';

// 수선의 발은 격자점이 아닐 수 있다 — 격자점으로 반올림해 분수로 견주면 틀린 판정이 나므로 수로만 견준다
export const isLattice = (p: ShapeParams, ids: string[]) =>
  ids.every((id) => {
    const pt = p.points.find((x) => x.id === id);
    return pt?.deg === undefined && !pt?.foot;
  });
export const isqrt = (n: bigint) => {
  if (n < 0n) return null;
  let r = BigInt(Math.round(Math.sqrt(Number(n))));
  while (r * r > n) r--;
  while ((r + 1n) * (r + 1n) <= n) r++;
  return r * r === n ? r : null;
};
export const ints = (s: ShState, id: string) => {
  const a = P(s, id);
  return [BigInt(Math.round(a.x)), BigInt(Math.round(a.y))] as const;
};

/**
 * 판정용 측정값: 수와, 분수로 정확히 구해지면 그 분수. 격자점만 쓰면 넓이는 늘 분수, 길이는 제곱수일 때,
 * 각은 직각일 때(내적 0)만 분수로 — 나머지(원 위 점·무리수)는 상대오차로 견주고 sympy 가 정확히 다시 판정한다.
 */
export function measureVal(p: ShapeParams, s: ShState, m: ShMeasure): Val {
  const n = measureValue(p, s, m) ?? Number.NaN;
  let q: Rational | null = null;
  const ops = operands(m);
  if (ops.length) {
    // 묶은 값은 항이 모두 분수일 때만 분수(PF+PG 가 정수여도 항이 무리수면 수로 견주고 sympy 가 정확히 다시 본다)
    const qs = ops.map((i) => measureVal(p, s, sub(p, i)).q);
    if (Number.isFinite(n) && qs.every((x) => x)) {
      const [a, b] = qs as [Rational, Rational];
      if ('sum' in m) q = (qs as Rational[]).reduce(qAdd, qi(0));
      else if ('diff' in m) {
        const d = qSub(a, b);
        q = d[0] < 0n ? qNeg(d) : d;
      } else if (b[0] !== 0n) q = qDiv(a, b);
    }
  } else if ('area' in m) {
    const ids = p.polygons[m.area] ?? [];
    if (isLattice(p, ids)) {
      let t = 0n;
      ids.forEach((id, i) => {
        const [ax, ay] = ints(s, id);
        const [bx, by] = ints(s, ids[(i + 1) % ids.length] as string);
        t += ax * by - bx * ay;
      });
      q = reduce(t < 0n ? -t : t, 2n);
    }
  } else if ('len' in m && isLattice(p, m.len)) {
    const [ax, ay] = ints(s, m.len[0]);
    const [bx, by] = ints(s, m.len[1]);
    const r = isqrt((ax - bx) ** 2n + (ay - by) ** 2n);
    if (r !== null) q = [r, 1n];
  } else if ('angle' in m && isLattice(p, m.angle) && Number.isFinite(n)) {
    const [ax, ay] = ints(s, m.angle[0]);
    const [bx, by] = ints(s, m.angle[1]);
    const [cx, cy] = ints(s, m.angle[2]);
    if ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) === 0n) q = [90n, 1n];
  }
  return { n, q };
}

/** 손을 뗀 상태 하나에서 닿은 목표 열쇠들(여러 곳 가 보기는 곳 번호, 여러 자리는 그 자리, 나머지 '0') */
export function shGoalHits(p: ShapeParams, s: ShState): string[] {
  const g = p.goal;
  if (!g) return [];
  const v = measureVal(p, s, p.measures[g.of] as ShMeasure);
  if (g.kind === 'visit')
    return g.at.flatMap((t, k) => (sameVal(v, t, g.tol.n) ? [String(k)] : []));
  const t = 'num' in g.is ? g.is.num : measureVal(p, s, sub(p, g.is.of));
  if (!sameVal(v, t, g.tol.n)) return [];
  if (g.places === 1) return ['0'];
  return [
    goalMovers(p, g)
      .map((id) => `${id}:${P(s, id).x},${P(s, id).y}`)
      .join(' '),
  ];
}

/** 모아야 할 열쇠 수 */
export const shGoalNeed = (p: ShapeParams) =>
  !p.goal ? 1 : p.goal.kind === 'visit' ? p.goal.at.length : p.goal.places;

/** 측정이 쓰는 점들(묶은 값은 항들의 점, 수선의 발은 그 발을 내린 점까지 — 발은 그 점을 따라 움직이므로) */
export function measurePoints(p: ShapeParams, m: ShMeasure): string[] {
  let ids: string[];
  if ('len' in m) ids = m.len;
  else if ('angle' in m) ids = m.angle;
  else if ('area' in m) ids = p.polygons[m.area] ?? [];
  else ids = operands(m).flatMap((i) => measurePoints(p, sub(p, i)));
  return ids.flatMap((id) => {
    const f = p.points.find((x) => x.id === id)?.foot;
    return f ? [id, f.from] : [id];
  });
}

/** 목표가 바라보는 끄는 점(선분 끝·원 중심·발의 직선은 고정이라 끄는 점끼리는 서로 기대지 않는다) */
export function goalMovers(p: ShapeParams, g: ShGoal): string[] {
  const ids = new Set(measurePoints(p, p.measures[g.of] as ShMeasure));
  if (g.kind === 'value' && 'of' in g.is)
    for (const id of measurePoints(p, sub(p, g.is.of))) ids.add(id);
  return p.points.filter((x) => x.drag && ids.has(x.id)).map((x) => x.id);
}

/** 끄는 점 하나가 닿는 모든 자리를 하나씩 놓는 방법(발이 따라오게 settle 까지)과 검산용 상태 기호 */
export function moverOptions(p: ShapeParams, id: string) {
  const pt = p.points.find((x) => x.id === id) as ShPoint;
  const opts: { patch: (s: ShState) => ShState; sym: Record<string, string> }[] = [];
  const set = (pos: { x: number; y: number; deg?: number }, sym: Record<string, string>) =>
    opts.push({ patch: (s) => settle(p, { ...s, pts: { ...s.pts, [id]: pos } }), sym });
  if (pt.on && 'circle' in pt.on) {
    const on = pt.on;
    for (let d = 0; d < 360; d += CIRCLE_STEP)
      set(circlePos(shInit(p), on, d), { [`pt_${id}_d`]: String(d) });
  } else if (pt.on && 'seg' in pt.on) {
    const s0 = shInit(p);
    const a = P(s0, pt.on.seg[0]);
    const b = P(s0, pt.on.seg[1]);
    const N = gcd(b.x - a.x, b.y - a.y);
    for (let k = 0; k <= N; k++) {
      const x = a.x + (k * (b.x - a.x)) / N;
      const y = a.y + (k * (b.y - a.y)) / N;
      set({ x, y }, { [`pt_${id}_x`]: String(x), [`pt_${id}_y`]: String(y) });
    }
  } else
    for (let x = 0; x <= p.grid.w; x++)
      for (let y = 0; y <= p.grid.h; y++)
        set({ x, y }, { [`pt_${id}_x`]: String(x), [`pt_${id}_y`]: String(y) });
  return opts;
}

/** 끄는 점이 닿는 모든 자리(상태)와 검산용 상태 기호 */
export function goalStates(p: ShapeParams, g: ShGoal) {
  let acc: { s: ShState; sym: Record<string, string> }[] = [{ s: shInit(p), sym: {} }];
  for (const id of goalMovers(p, g)) acc = growStates(acc, moverOptions(p, id), '도형판 goal');
  return acc;
}

export const goalTable = (p: ShapeParams, g: ShGoal, states: ShState[]) =>
  hitTable(states, (s) => shGoalHits(p, s), g.kind === 'visit' ? g.at.length : null);
