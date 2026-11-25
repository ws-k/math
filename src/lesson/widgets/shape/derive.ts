// 계산되는 점: 수선의 발(foot)·따라오는 점(follow)·마주 보는 점(mirror). 자리를 적지 않고(따라오는 점은 받지 않는
// 칸만 적는다) 앞에 적은 점들로 늘 다시 계산한다 — 끄는 점을 옮기는 모든 길(끌기·키·검산이 늘어놓는 상태)이
// model.settle 을 거치므로 손으로 끄는 동안에도, sympy 가 다시 판정할 때도 같은 자리가 나온다.
// 앞에 적은 점만 가리키게 해서(차례대로 계산) 서로 기대는 고리가 생기지 않는다.
import { arr, fail, int, obj } from '../../parse.ts';
import type { ShapeParams, ShPoint } from './types.ts';

type XY = { x: number; y: number };

export const isDerived = (pt: ShPoint | undefined) => !!(pt?.foot || pt?.follow || pt?.mirror);

/** 계산되는 점이 기대는 점들(없으면 빈 목록) */
export function sourcesOf(pt: ShPoint): string[] {
  if (pt.foot) return [pt.foot.from, ...pt.foot.line];
  if (pt.follow) return [pt.follow.x, pt.follow.y].filter((v): v is string => !!v);
  const m = pt.mirror;
  if (!m) return [];
  return 'about' in m ? [m.of, m.about] : [m.of, ...m.across];
}

/**
 * 직선 ab 에 q 를 내린 발. 정수 좌표면 (내적×방향)/길이² 순서로 나눠 0.3×10 같은 부동소수 찌꺼기를 피한다
 * (나누기 전 예전 model.settle 의 셈 그대로 — 단원 장면의 발 자리가 한 자리도 바뀌지 않게).
 */
function project(a: XY, b: XY, q: XY): XY {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dot = (q.x - a.x) * dx + (q.y - a.y) * dy;
  const l2 = dx * dx + dy * dy;
  return { x: a.x + (dot * dx) / l2, y: a.y + (dot * dy) / l2 };
}

/** 계산되는 점의 자리(pts 에는 그 점보다 앞에 적은 점이 이미 있다) */
export function derivedPos(pt: ShPoint, pts: Record<string, XY>): XY {
  const at = (id: string) => pts[id] as XY;
  if (pt.foot) return project(at(pt.foot.line[0]), at(pt.foot.line[1]), at(pt.foot.from));
  if (pt.follow) {
    const { x, y } = pt.follow;
    return { x: x ? at(x).x : (pt.x ?? 0), y: y ? at(y).y : (pt.y ?? 0) };
  }
  const m = pt.mirror as NonNullable<ShPoint['mirror']>;
  const q = at(m.of);
  const o = 'about' in m ? at(m.about) : project(at(m.across[0]), at(m.across[1]), q);
  return { x: 2 * o.x - q.x, y: 2 * o.y - q.y };
}

/** 이 점이 기대는 모든 점(자기 포함, 기대는 점이 기대는 점까지) */
export function dependsOn(p: ShapeParams, id: string): string[] {
  const pt = p.points.find((x) => x.id === id);
  if (!pt) return [id];
  return [id, ...sourcesOf(pt).flatMap((j) => dependsOn(p, j))];
}

/**
 * 격자점이라 판정을 분수로 정확히 해도 되는 점인가. 원 위 점·수선의 발·선대칭은 격자점이 아닐 수 있어
 * 반올림해 분수로 견주면 틀린 판정이 나므로 수로만 견준다(sympy 가 정확히 다시 판정).
 */
export function latticePt(p: ShapeParams, id: string): boolean {
  const pt = p.points.find((x) => x.id === id);
  if (!pt || pt.deg !== undefined || pt.foot) return false;
  if (pt.mirror && 'across' in pt.mirror) return false;
  return sourcesOf(pt).every((j) => latticePt(p, j));
}

/** 계산되는 점의 sympy 점 식. ps 는 기대는 점의 식(목표 검산에서는 끄는 점이 상태 기호) */
export function derivedSym(pt: ShPoint, ps: (id: string) => string): string {
  if (pt.foot)
    return `Line(${ps(pt.foot.line[0])}, ${ps(pt.foot.line[1])}).projection(${ps(pt.foot.from)})`;
  if (pt.follow) {
    const { x, y } = pt.follow;
    return `Point(${x ? `(${ps(x)}).x` : pt.x}, ${y ? `(${ps(y)}).y` : pt.y})`;
  }
  const m = pt.mirror as NonNullable<ShPoint['mirror']>;
  const q = ps(m.of);
  if ('across' in m) return `(${q}).reflect(Line(${ps(m.across[0])}, ${ps(m.across[1])}))`;
  const o = ps(m.about);
  return `Point(2*(${o}).x - (${q}).x, 2*(${o}).y - (${q}).y)`;
}

/** sympy 상태 기호에 쓰는 점 이름(F′ 의 ′ 는 파이썬 이름에 못 쓴다 — 소문자는 점 이름에 없어 겹치지 않는다) */
export const symId = (id: string) => id.replace('′', 'p');

/**
 * 따라오는 점·마주 보는 점 읽기. x 는 점 하나의 원래 칸, prev 는 앞에 적은 점들. 끌기·제약을 같이 적으면
 * 계산한 자리와 어긋나므로 막는다. 따라오는 점은 따라 받는 칸(x 또는 y)을 적지 않고, 나머지 칸만 적는다.
 */
export function parseDerived(
  x: Record<string, unknown>,
  pt: ShPoint,
  at: string,
  grid: { w: number; h: number },
  need: (v: unknown, at: string) => string,
  prev: Map<string, ShPoint>,
): void {
  const kind = x.follow !== undefined ? 'follow' : 'mirror';
  if (x.follow !== undefined && x.mirror !== undefined) fail(at, 'follow 와 mirror 중 하나만');
  const bad = ['drag', 'on', 'aux', 'deg', 'foot', 'range'].find((k) => x[k] !== undefined);
  if (bad) fail(`${at} ${kind}`, `계산되는 점은 끌 수 없음(${bad} 를 적지 않음)`);
  if (kind === 'follow') {
    const f = obj(x.follow, `${at} follow`, [], ['x', 'y']);
    if (f.x === undefined && f.y === undefined)
      fail(`${at} follow`, 'x 나 y 중 따라 받을 칸이 필요');
    const follow: { x?: string; y?: string } = {};
    for (const k of ['x', 'y'] as const) {
      const lim = k === 'x' ? grid.w : grid.h;
      if (f[k] !== undefined) {
        if (x[k] !== undefined) fail(`${at} ${k}`, `따라 받는 칸(${k})은 적지 않음(자리는 계산함)`);
        follow[k] = need(f[k], `${at} follow.${k}`);
      } else pt[k] = int(x[k], `${at} ${k}(따라 받지 않는 칸의 자리)`, 0, lim);
    }
    pt.follow = follow;
    return;
  }
  for (const k of ['x', 'y'])
    if (x[k] !== undefined) fail(`${at} ${k}`, '마주 보는 점은 자리를 적지 않음(계산함)');
  const m = obj(x.mirror, `${at} mirror`, ['of'], ['about', 'across']);
  const of = need(m.of, `${at} mirror.of`);
  if ((m.about === undefined) === (m.across === undefined))
    fail(`${at} mirror`, 'about(점대칭의 중심) 이나 across(선대칭의 직선) 중 하나');
  if (m.about !== undefined) {
    pt.mirror = { of, about: need(m.about, `${at} mirror.about`) };
    return;
  }
  const line = arr(m.across, `${at} mirror.across`, 2, 2).map((v, j) =>
    need(v, `${at} mirror.across${j + 1}`),
  ) as [string, string];
  // 직선이 움직이면 두 점이 겹칠 때 대칭을 정할 수 없다 — 축은 고정 격자점 둘로
  const [a, b] = line.map((v) => prev.get(v) as ShPoint);
  for (const e of [a, b])
    if (e?.drag || e?.on || isDerived(e))
      fail(`${at} mirror.across`, `대칭축 위 점 ${e?.id} 은 고정된 격자점이어야 함`);
  if (a?.x === b?.x && a?.y === b?.y) fail(`${at} mirror.across`, '대칭축의 두 점이 같은 자리');
  pt.mirror = { of, across: line };
}

/** 끄는 자유 점의 범위 읽기. 없는 축은 격자 전체 */
export function parseRange(
  v: unknown,
  pt: ShPoint,
  at: string,
  grid: { w: number; h: number },
): ShPoint['range'] {
  if (!pt.drag || pt.on) fail(`${at} range`, '끄는 자유 점에만(선분·원 위 점은 이미 길이 정해짐)');
  const r = obj(v, `${at} range`, [], ['x', 'y']);
  const axis = (k: 'x' | 'y', lim: number): [number, number] => {
    if (r[k] === undefined) return [0, lim];
    const [lo, hi] = arr(r[k], `${at} range.${k}`, 2, 2).map((n, j) =>
      int(n, `${at} range.${k}${j + 1}`, -99, 99),
    ) as [number, number];
    if (lo < 0 || hi > lim) fail(`${at} range.${k}`, `격자 밖 (${lo}~${hi}, 격자 0~${lim})`);
    if (lo > hi) fail(`${at} range.${k}`, '작은 수부터');
    const c = pt[k] as number;
    if (c < lo || c > hi) fail(`${at} range.${k}`, `처음 자리 ${c} 가 범위 ${lo}~${hi} 밖`);
    return [lo, hi];
  };
  const range = { x: axis('x', grid.w), y: axis('y', grid.h) };
  if (range.x[0] === range.x[1] && range.y[0] === range.y[1])
    fail(`${at} range`, '움직일 곳이 없음(한 자리뿐)');
  return range;
}
