// 도형판 부품의 모델(순수). 화면(Shape.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 점은 격자점(정수 좌표)에 붙고, 제약이 있으면 선분 위의 격자점이나 원 위(15° 간격)로만 움직인다.
// 길이·각·넓이는 앱이 부동소수로 계산해 digits 자리로 반올림해 보이고, checks 가 같은 점에서 sympy 로
// 정확한 값을 계산해 반올림이 맞는지 대조한다(approx). 격자점만 쓰는 넓이는 분수로 정확히 대조한다.
// 잘라 옮기기(cut): 조각(piece)을 끌어 by 만큼 옮기면 다른 모양(result)이 되고 넓이는 그대로임을 보인다.
// 목표(goal, 조각 ②): 측정값 하나를 목표값으로("넓이를 20으로") 또는 여러 값에 한 번씩("60°·90°·120°").
// 공통 규칙(손을 뗀 자리만 판정·진행 표시·힌트)은 src/lesson/goal.ts.
// 측정값 묶기(요청 106): 앞 측정값들의 합·차·비도 측정값(PF+PG, |PF−PG|, AD÷AB)이고, 목표는 수 대신 다른
// 측정값과 견줄 수 있다(PF = PH). 이차곡선의 정의·닮음비를 "읽어서 계산"이 아니라 "끌어서 같게"로 보이려는 것.
// 수선의 발(foot): 끄는 점에서 고정 직선에 내린 발 — 상태의 일부로 늘 다시 계산해 끄는 점을 따라온다.
import {
  checkHitTable,
  checkNotAtStart,
  type GoalCommon,
  type GoalNum,
  type GoalShape,
  goalNum,
  growStates,
  hitTable,
  needHint,
  parseGoalShape,
  sameVal,
  type Val,
} from '../goal.ts';
import { arr, fail, int, obj, optStr, str } from '../parse.ts';
import { type Rational, reduce } from '../sym.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import { placeLabels } from './labels.ts';
import { add as qAdd, div as qDiv, qi, neg as qNeg, sub as qSub, ratStr } from './q.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type ShOn = { seg: [string, string] } | { circle: [string, number] };
export interface ShPoint {
  id: string;
  x?: number;
  y?: number;
  /** 원 위 점의 각도(도, 15의 배수) */
  deg?: number;
  drag: boolean;
  on?: ShOn;
  /** 보조점: 그리지 않는 고정 점(선분 위 점의 끝·선분 끝·수선의 발 직선으로만). 설명 없는 점 이름이 그림에 나오지 않게 */
  aux?: true;
  /** 수선의 발: from 에서 직선 line(고정 점 둘)에 내린 발. 자리는 적지 않고 늘 계산한다 */
  foot?: { from: string; line: [string, string] };
}
/**
 * 측정값. sum·diff·ratio 의 수는 앞 측정값의 번호(길이·각만 — 묶은 값을 다시 묶지 않아 순환·긴 이름이 없다).
 * diff 는 |a − b|(이차곡선 정의가 차의 크기라 부호를 두지 않는다).
 */
export type ShMeasure =
  | { len: [string, string] }
  | { angle: [string, string, string] }
  | { area: number }
  | { sum: number[] }
  | { diff: [number, number] }
  | { ratio: [number, number] };
/** 목표가 견주는 것: 수, 또는 다른 측정값의 번호(PF = PH) */
export type ShIs = { num: GoalNum } | { of: number };
/** 목표: of 는 measures 의 번호(보이는 측정값만 목표로 — 학습자가 읽을 수 있어야 맞출 수 있다) */
export type ShGoal = GoalShape<number, ShIs> & GoalCommon;

export interface ShapeParams {
  grid: { w: number; h: number };
  points: ShPoint[];
  polygons: string[][];
  circles: { c: string; r: number }[];
  segments: [string, string][];
  measures: ShMeasure[];
  digits: number;
  cut?: { piece: string[]; rest: string[]; by: [number, number]; result: [number, number][] };
  /** 화면 위 안내 한 줄(선택) */
  note?: string;
  goal?: ShGoal;
  /** 목표를 이뤘을 때 글(Rich) */
  done?: string;
}
export interface ShState {
  pts: Record<string, { x: number; y: number; deg?: number }>;
  /** 잘라 낸 조각의 이동(격자 칸) */
  cut: [number, number];
}

export const W = 320;
const CIRCLE_STEP = 15;

// ---- 좌표 ----

export function shUnit(p: ShapeParams) {
  return Math.min(288 / p.grid.w, 220 / p.grid.h);
}
export function shGeom(p: ShapeParams) {
  const u = shUnit(p);
  const ox = (W - p.grid.w * u) / 2;
  const oy = 16 + p.grid.h * u;
  return { u, ox, oy, h: oy + 16 };
}
const X = (p: ShapeParams, x: number) => r2(shGeom(p).ox + x * shGeom(p).u);
const Y = (p: ShapeParams, y: number) => r2(shGeom(p).oy - y * shGeom(p).u);
const rad = (d: number) => (d * Math.PI) / 180;

function circlePos(s: ShState, on: { circle: [string, number] }, deg: number) {
  const c = s.pts[on.circle[0]] as { x: number; y: number };
  const r = on.circle[1];
  return { x: c.x + r * Math.cos(rad(deg)), y: c.y + r * Math.sin(rad(deg)), deg };
}

export function shInit(p: ShapeParams): ShState {
  const pts: ShState['pts'] = {};
  const s: ShState = { pts, cut: [0, 0] };
  // 원 위 점은 중심이 먼저 있어야 하므로 두 번에 나눠 놓는다
  for (const pt of p.points) if (pt.deg === undefined) pts[pt.id] = { x: pt.x ?? 0, y: pt.y ?? 0 };
  for (const pt of p.points)
    if (pt.deg !== undefined && pt.on && 'circle' in pt.on)
      pts[pt.id] = circlePos(s, pt.on, pt.deg);
  return settle(p, s);
}

/**
 * 수선의 발 자리를 지금 점들로 다시 계산한 상태. 점을 옮기는 모든 길(끌기·키·검산용 상태 늘어놓기)이 이것을
 * 거쳐야 발이 끄는 점을 따라온다. 정수 좌표면 (내적×방향)/길이² 순서로 나눠 0.3×10 같은 부동소수 찌꺼기를 피한다.
 */
function settle(p: ShapeParams, s: ShState): ShState {
  if (!p.points.some((x) => x.foot)) return s;
  const pts = { ...s.pts };
  for (const pt of p.points) {
    if (!pt.foot) continue;
    const a = pts[pt.foot.line[0]] as { x: number; y: number };
    const b = pts[pt.foot.line[1]] as { x: number; y: number };
    const q = pts[pt.foot.from] as { x: number; y: number };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dot = (q.x - a.x) * dx + (q.y - a.y) * dy;
    const l2 = dx * dx + dy * dy;
    pts[pt.id] = { x: a.x + (dot * dx) / l2, y: a.y + (dot * dy) / l2 };
  }
  return { ...s, pts };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** 점 id 를 world 좌표 (tx,ty) 쪽으로 옮긴 상태(제약·격자·범위 적용) */
function place(p: ShapeParams, s: ShState, id: string, tx: number, ty: number): ShState {
  const pt = p.points.find((x) => x.id === id);
  if (!pt) return s;
  let n: { x: number; y: number; deg?: number };
  if (pt.on && 'seg' in pt.on) {
    const a = s.pts[pt.on.seg[0]] as { x: number; y: number };
    const b = s.pts[pt.on.seg[1]] as { x: number; y: number };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const N = gcd(dx, dy);
    const t = ((tx - a.x) * dx + (ty - a.y) * dy) / (dx * dx + dy * dy);
    const k = Math.min(N, Math.max(0, Math.round(t * N)));
    n = { x: a.x + (k * dx) / N, y: a.y + (k * dy) / N };
  } else if (pt.on && 'circle' in pt.on) {
    const c = s.pts[pt.on.circle[0]] as { x: number; y: number };
    const deg =
      Math.round((Math.atan2(ty - c.y, tx - c.x) * 180) / Math.PI / CIRCLE_STEP) * CIRCLE_STEP;
    n = circlePos(s, pt.on, ((deg % 360) + 360) % 360);
  } else {
    n = {
      x: Math.min(p.grid.w, Math.max(0, Math.round(tx))),
      y: Math.min(p.grid.h, Math.max(0, Math.round(ty))),
    };
  }
  return settle(p, { ...s, pts: { ...s.pts, [id]: n } });
}

/** 끌기: 시작 상태 s 에서 점(또는 'cut' 조각)을 화면 거리 (dx,dy)(SVG 단위)만큼 */
export function shDrag(p: ShapeParams, s: ShState, id: string, dx: number, dy: number): ShState {
  const u = shUnit(p);
  if (id === 'cut') {
    const cx = Math.max(-p.grid.w, Math.min(p.grid.w, Math.round(s.cut[0] + dx / u))) || 0;
    const cy = Math.max(-p.grid.h, Math.min(p.grid.h, Math.round(s.cut[1] - dy / u))) || 0;
    return { ...s, cut: [cx, cy] };
  }
  const cur = s.pts[id];
  if (!cur) return s;
  return place(p, s, id, cur.x + dx / u, cur.y - dy / u);
}

/** 방향키 이동: 자유 점은 격자 한 칸, 선분 위는 다음 격자점, 원 위는 15° */
export function shKey(p: ShapeParams, s: ShState, id: string, key: string): ShState | null {
  const d: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
  };
  const v = d[key];
  if (!v) return null;
  const pt = p.points.find((x) => x.id === id);
  const cur = s.pts[id];
  if (!pt || !cur) return null;
  if (pt.on && 'circle' in pt.on) {
    const deg = ((((cur.deg ?? 0) + (v[0] + v[1]) * CIRCLE_STEP) % 360) + 360) % 360;
    return settle(p, { ...s, pts: { ...s.pts, [id]: circlePos(s, pt.on, deg) } });
  }
  if (pt.on && 'seg' in pt.on) {
    const a = s.pts[pt.on.seg[0]] as { x: number; y: number };
    const b = s.pts[pt.on.seg[1]] as { x: number; y: number };
    const N = gcd(b.x - a.x, b.y - a.y);
    const sx = (b.x - a.x) / N;
    const sy = (b.y - a.y) / N;
    const dir = v[0] + v[1];
    return place(p, s, id, cur.x + dir * sx, cur.y + dir * sy);
  }
  return place(p, s, id, cur.x + v[0], cur.y + v[1]);
}

export const shDone = (p: ShapeParams, s: ShState) =>
  !!p.cut && s.cut[0] === p.cut.by[0] && s.cut[1] === p.cut.by[1];

// ---- 계산 ----

const P = (s: ShState, id: string) => s.pts[id] as { x: number; y: number; deg?: number };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (l < 1e-12) return null;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l));
  return (Math.acos(cos) * 180) / Math.PI;
}
const shoelace = (ps: { x: number; y: number }[]) => {
  let t = 0;
  ps.forEach((a, i) => {
    const b = ps[(i + 1) % ps.length] as { x: number; y: number };
    t += a.x * b.y - b.x * a.y;
  });
  return Math.abs(t) / 2;
};

/** digits 자리 반올림 글자(ASCII, 뒤 0 없앰)와 정확히 떨어지는가 */
function round(v: number, digits: number): { s: string; exact: boolean } {
  const k = 10 ** digits;
  const r = Math.round(v * k + (v >= 0 ? 1e-9 : -1e-9)) / k;
  const s = String(Number(r.toFixed(digits)));
  return { s: s === '-0' ? '0' : s, exact: Math.abs(v - r) < 1e-9 };
}
const shown = (v: number, digits: number, unit = '') => {
  const r = round(v, digits);
  return `${r.exact ? '=' : '≈'} ${r.s.replace('-', '−')}${unit}`;
};

/** 묶은 측정값(합·차·비)의 항 번호. 길이·각·넓이는 빈 목록 */
const operands = (m: ShMeasure): number[] =>
  'sum' in m ? m.sum : 'diff' in m ? m.diff : 'ratio' in m ? m.ratio : [];
const sub = (p: ShapeParams, i: number) => p.measures[i] as ShMeasure;

function measureValue(p: ShapeParams, s: ShState, m: ShMeasure): number | null {
  if ('len' in m) return dist(P(s, m.len[0]), P(s, m.len[1]));
  if ('angle' in m) return angleAt(P(s, m.angle[0]), P(s, m.angle[1]), P(s, m.angle[2]));
  if ('area' in m) return shoelace((p.polygons[m.area] ?? []).map((id) => P(s, id)));
  const v = operands(m).map((i) => measureValue(p, s, sub(p, i)));
  if (v.some((x) => x === null)) return null;
  const [a, b] = v as [number, number];
  if ('sum' in m) return (v as number[]).reduce((t, x) => t + x, 0);
  if ('diff' in m) return Math.abs(a - b);
  // 분모 길이가 0(두 점이 겹침)이면 비를 정할 수 없다 — 각을 정할 수 없을 때와 같은 글
  return b < 1e-12 ? null : a / b;
}

/** 측정값의 종류(같은 종류끼리만 묶고 견준다 — 길이와 각을 더하거나 같다고 하면 뜻이 없다) */
function measureKind(p: ShapeParams, m: ShMeasure): 'len' | 'angle' | 'area' | 'ratio' {
  if ('len' in m) return 'len';
  if ('angle' in m) return 'angle';
  if ('area' in m) return 'area';
  if ('ratio' in m) return 'ratio';
  return measureKind(p, sub(p, operands(m)[0] as number));
}

/** 화면에 적는 측정값 이름(PF, ∠ABC, PF + PG, |PF − PG|, AD ÷ AB) */
function measureName(p: ShapeParams, m: ShMeasure): string {
  if ('len' in m) return m.len.join('');
  if ('angle' in m) return `∠${m.angle.join('')}`;
  if ('area' in m) return '넓이';
  const n = operands(m).map((i) => measureName(p, sub(p, i)));
  if ('sum' in m) return n.join(' + ');
  if ('diff' in m) return `|${n[0]} − ${n[1]}|`;
  return `${n[0]} ÷ ${n[1]}`;
}

/**
 * 측정값의 내용(적은 순서와 무관): PF 와 FP, ∠FPG 와 ∠GPF, 항 순서만 다른 합·차는 같은 열쇠. 비는 순서가 뜻이다.
 * 번호가 달라도 내용이 같은 측정값끼리 묶거나 견주면 늘 같은 값이라 끌어서 볼 것이 없다.
 */
function measureKey(p: ShapeParams, m: ShMeasure): string {
  if ('len' in m) return `len:${[...m.len].sort().join('')}`;
  if ('angle' in m) {
    const [a, b, c] = m.angle;
    return `angle:${[a, c].sort().join(b)}`;
  }
  if ('area' in m) {
    // 다각형은 어느 꼭짓점부터·어느 방향으로 적어도 같은 모양
    const v = p.polygons[m.area] ?? [];
    const rots = [v, [...v].reverse()].flatMap((w) =>
      w.map((_, i) => [...w.slice(i), ...w.slice(0, i)].join('')),
    );
    return `area:${rots.sort()[0]}`;
  }
  const ks = operands(m).map((i) => measureKey(p, sub(p, i)));
  if ('ratio' in m) return `ratio(${ks.join('/')})`;
  return `${'sum' in m ? 'sum' : 'diff'}(${ks.sort().join(',')})`;
}

/** 측정 글들(화면에 보이는 그대로) */
export function shMeasures(p: ShapeParams, s: ShState): string[] {
  return p.measures.map((m) => {
    const v = measureValue(p, s, m);
    const name = measureName(p, m);
    if (v === null) return `${name} 은 정할 수 없어요`;
    return `${name} ${shown(v, p.digits, measureKind(p, m) === 'angle' ? '°' : '')}`;
  });
}

const cutArea = (s: ShState, ids: string[]) => shoelace(ids.map((id) => P(s, id)));

// ---- 목표 ----

// 수선의 발은 격자점이 아닐 수 있다 — 격자점으로 반올림해 분수로 견주면 틀린 판정이 나므로 수로만 견준다
const isLattice = (p: ShapeParams, ids: string[]) =>
  ids.every((id) => {
    const pt = p.points.find((x) => x.id === id);
    return pt?.deg === undefined && !pt?.foot;
  });
const isqrt = (n: bigint) => {
  if (n < 0n) return null;
  let r = BigInt(Math.round(Math.sqrt(Number(n))));
  while (r * r > n) r--;
  while ((r + 1n) * (r + 1n) <= n) r++;
  return r * r === n ? r : null;
};
const ints = (s: ShState, id: string) => {
  const a = P(s, id);
  return [BigInt(Math.round(a.x)), BigInt(Math.round(a.y))] as const;
};

/**
 * 판정용 측정값: 수와, 분수로 정확히 구해지면 그 분수. 격자점만 쓰면 넓이는 늘 분수, 길이는 제곱수일 때,
 * 각은 직각일 때(내적 0)만 분수로 — 나머지(원 위 점·무리수)는 상대오차로 견주고 sympy 가 정확히 다시 판정한다.
 */
function measureVal(p: ShapeParams, s: ShState, m: ShMeasure): Val {
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
function measurePoints(p: ShapeParams, m: ShMeasure): string[] {
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
function goalMovers(p: ShapeParams, g: ShGoal): string[] {
  const ids = new Set(measurePoints(p, p.measures[g.of] as ShMeasure));
  if (g.kind === 'value' && 'of' in g.is)
    for (const id of measurePoints(p, sub(p, g.is.of))) ids.add(id);
  return p.points.filter((x) => x.drag && ids.has(x.id)).map((x) => x.id);
}

/** 끄는 점 하나가 닿는 모든 자리를 하나씩 놓는 방법(발이 따라오게 settle 까지)과 검산용 상태 기호 */
function moverOptions(p: ShapeParams, id: string) {
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
function goalStates(p: ShapeParams, g: ShGoal) {
  let acc: { s: ShState; sym: Record<string, string> }[] = [{ s: shInit(p), sym: {} }];
  for (const id of goalMovers(p, g)) acc = growStates(acc, moverOptions(p, id), '도형판 goal');
  return acc;
}

/**
 * 형식 검사: 수선의 발은 그린 직선(선분·다각형의 변) 위에만 놓여야 한다 — 내린 점이 닿는 모든 자리에서(목표가 없어도).
 * 발은 무한 직선 위로 계산되므로 직선 끝점이 격자 가장자리에 있지 않으면 발이 그린 선분 밖·그림 밖(SVG 위쪽 바깥)에
 * 놓여 '수선의 발'이 허공에 뜬 점으로 보이거나 아예 사라진다. 그린 선분 안이면 격자 안이기도 하다(끝점이 격자점).
 */
function checkFeet(p: ShapeParams) {
  const edge = (a: string, b: string, u: string, v: string) =>
    (a === u && b === v) || (a === v && b === u);
  for (const pt of p.points) {
    if (!pt.foot) continue;
    const { from, line } = pt.foot;
    const [a, b] = line;
    const at = `도형판 ${pt.id}`;
    const drawn =
      p.segments.some(([u, v]) => edge(a, b, u, v)) ||
      p.polygons.some((pl) => pl.some((u, i) => edge(a, b, u, pl[(i + 1) % pl.length] as string)));
    if (!drawn)
      fail(
        at,
        `수선의 발 ${pt.id}: 직선 ${a}${b} 를 그린 직선(segments 의 선분이나 다각형의 변)으로 두세요 — 발이 허공에 뜬 점으로 보임`,
      );
    const src = p.points.find((x) => x.id === from) as ShPoint;
    const s0 = shInit(p);
    const states = src.drag ? moverOptions(p, from).map((o) => o.patch(s0)) : [s0];
    for (const s of states) {
      const A = P(s, a);
      const B = P(s, b);
      const H = P(s, pt.id);
      const t = ((H.x - A.x) * (B.x - A.x) + (H.y - A.y) * (B.y - A.y)) / dist(A, B) ** 2;
      if (t < -1e-9 || t > 1 + 1e-9) {
        const q = P(s, from);
        fail(
          at,
          `수선의 발 ${pt.id}: ${from} 이 (${r2(q.x)}, ${r2(q.y)}) 에 있으면 발이 (${r2(H.x)}, ${r2(H.y)}) 로 그린 직선 ${a}${b} 밖 — 직선 끝점을 격자 가장자리에 두세요`,
        );
      }
    }
  }
}

/**
 * 형식 검사: 측정값끼리 견주는 목표에서, 두 측정값이 화면에 같은 수로 보이는데(PA ≈ 9, PB ≈ 9) 목표가 아닌 자리가
 * 있으면 오류. 학습자는 '같아 보이는데 왜 아니지'를 알 길이 없다. = 와 ≈ 의 차이만으로 가르지 않는다(PA = 3 과
 * PB ≈ 3 은 학습자 눈에 같다). 고치는 길은 digits 를 늘리는 것 — 정확한 분수 표시는 비(比)만 고칠 수 있어 택하지 않았다.
 */
function checkSameText(p: ShapeParams, g: ShGoal, states: ShState[]) {
  if (g.kind !== 'value' || !('of' in g.is)) return;
  const a = p.measures[g.of] as ShMeasure;
  const b = sub(p, g.is.of);
  for (const s of states) {
    const va = measureValue(p, s, a);
    const vb = measureValue(p, s, b);
    if (va === null || vb === null) continue;
    const t = round(va, p.digits).s;
    if (t !== round(vb, p.digits).s || shGoalHits(p, s).length) continue;
    const where = goalMovers(p, g)
      .map((id) => `${id}(${r2(P(s, id).x)}, ${r2(P(s, id).y)})`)
      .join(' ');
    fail(
      '도형판 goal',
      `${where} 에서 ${measureName(p, a)} 와 ${measureName(p, b)} 가 화면에 똑같이 ${t} 로 보이는데 목표가 아님 — digits 를 늘리세요(지금 ${p.digits})`,
    );
  }
}

const goalTable = (p: ShapeParams, g: ShGoal, states: ShState[]) =>
  hitTable(states, (s) => shGoalHits(p, s), g.kind === 'visit' ? g.at.length : null);

// ---- 그릴 목록 ----

/** 이름표(13px 굵게, 대문자 한 자) 상자. 틈은 예전 자리(가운데가 점에서 오른쪽 12, 기준선이 위 10)와 같게 */
const LABEL = { charW: 9, h: 13, gx: 7.5, gy: 7, dotR: 6 };

const pts = (p: ShapeParams, ps: { x: number; y: number }[]) =>
  ps.map((a) => `${X(p, a.x)},${Y(p, a.y)}`).join(' ');

export function shDraw(p: ShapeParams, s: ShState): Drawing {
  const marks: Mark[] = [];
  p.polygons.forEach((poly, i) => {
    marks.push({
      k: `poly${i}`,
      tag: 'polygon',
      a: {
        points: pts(
          p,
          poly.map((id) => P(s, id)),
        ),
        class: `sh-poly t${i % 3}`,
        visibility: p.cut ? 'hidden' : 'visible',
      },
    });
  });
  p.circles.forEach((c, i) => {
    const o = P(s, c.c);
    marks.push({
      k: `circ${i}`,
      tag: 'circle',
      a: { cx: X(p, o.x), cy: Y(p, o.y), r: r2(c.r * shUnit(p)), class: 'sh-circle' },
    });
  });
  p.segments.forEach(([a, b], i) => {
    const A = P(s, a);
    const B = P(s, b);
    marks.push({
      k: `seg${i}`,
      tag: 'line',
      a: { x1: X(p, A.x), y1: Y(p, A.y), x2: X(p, B.x), y2: Y(p, B.y), class: 'sh-seg' },
    });
  });
  if (p.cut) {
    const c = p.cut;
    marks.push({
      k: 'cutr',
      tag: 'polygon',
      a: {
        points: pts(
          p,
          c.rest.map((id) => P(s, id)),
        ),
        class: 'sh-poly t0',
      },
    });
    // 조각의 원래 자리(점선)와 옮겨 가는 조각
    marks.push({
      k: 'cuto',
      tag: 'polygon',
      a: {
        points: pts(
          p,
          c.piece.map((id) => P(s, id)),
        ),
        class: 'sh-ghost',
      },
    });
    marks.push({
      k: 'cutp',
      tag: 'polygon',
      a: {
        points: pts(
          p,
          c.piece.map((id) => ({ x: P(s, id).x + s.cut[0], y: P(s, id).y + s.cut[1] })),
        ),
        class: shDone(p, s) ? 'sh-piece done' : 'sh-piece',
      },
    });
  }
  // 보조점은 그리지 않는다(점·이름표 모두)
  const shownPts = p.points.filter((pt) => !pt.aux);
  const at = shownPts.map((pt) => ({ x: X(p, P(s, pt.id).x), y: Y(p, P(s, pt.id).y) }));
  // 이름표: 가까운 점끼리 겹치지 않고 그림 안에(labels.ts). 아무것도 겹치지 않으면 예전처럼 점의 오른쪽 위
  const labs = placeLabels(
    at.map((q) => ({ ...q, n: 1 })),
    at,
    { l: 0, t: 0, r: W, b: shGeom(p).h },
    LABEL,
  );
  shownPts.forEach((pt, i) => {
    const { x, y } = at[i] as { x: number; y: number };
    const r = labs[i] as { l: number; t: number; r: number };
    marks.push(
      pt.drag
        ? { k: `h:${pt.id}`, tag: 'g', a: { transform: `translate(${x} ${y})` } }
        : { k: `pt:${pt.id}`, tag: 'circle', a: { cx: x, cy: y, r: 4, class: 'sh-pt' } },
    );
    marks.push({
      k: `lab:${pt.id}`,
      tag: 'text',
      // 가운데 맞춤 글자(.wgt-svg text)라 상자 가운데에 둔다
      a: { x: r2((r.l + r.r) / 2), y: r2(r.t + 10), class: 'sh-lab' },
      text: pt.id,
    });
  });
  const texts: Record<string, string> = {};
  shMeasures(p, s).forEach((t, i) => {
    texts[`m${i}`] = t;
  });
  if (p.cut) {
    const whole = shoelace((p.polygons[0] ?? []).map((id) => P(s, id)));
    const moved = cutArea(s, p.cut.rest) + cutArea(s, p.cut.piece);
    const a = round(whole, p.digits).s;
    texts.area =
      s.cut[0] === 0 && s.cut[1] === 0
        ? `넓이 = ${a}`
        : `넓이 = ${a} → 옮긴 뒤 넓이 = ${round(moved, p.digits).s}`;
  }
  return { marks, texts };
}

// ---- 검산 ----

/** 수선의 발의 sympy 식. ps 는 발을 내린 점·직선 점의 식(목표 검산에서는 끄는 점이 상태 기호) */
const footSym = (f: NonNullable<ShPoint['foot']>, ps: (id: string) => string) =>
  `Line(${ps(f.line[0])}, ${ps(f.line[1])}).projection(${ps(f.from)})`;

/** sympy 점 식 */
function pointSym(p: ShapeParams, s: ShState, id: string): string {
  const pt = p.points.find((x) => x.id === id) as ShPoint;
  if (pt.foot) return footSym(pt.foot, (j) => pointSym(p, s, j));
  const a = P(s, id);
  if (pt.on && 'circle' in pt.on) {
    const c = P(s, pt.on.circle[0]);
    const r = pt.on.circle[1];
    return `Point(${c.x} + ${r}*cos(rad(${a.deg})), ${c.y} + ${r}*sin(rad(${a.deg})))`;
  }
  return `Point(${a.x}, ${a.y})`;
}
const shoelaceSym = (ps: string[]) =>
  `Abs(${ps
    .map((a, i) => {
      const b = ps[(i + 1) % ps.length];
      return `(${a}).x*(${b}).y - (${b}).x*(${a}).y`;
    })
    .join(' + ')})/2`;

/** 측정값의 sympy 식. ps 는 점 id → sympy 점 글자(고정 점은 값, 목표 검산에서 끄는 점은 상태 기호) */
function measureSym(p: ShapeParams, m: ShMeasure, ps: (id: string) => string): string {
  if ('len' in m) return `${ps(m.len[0])}.distance(${ps(m.len[1])})`;
  if ('angle' in m) {
    const [a, b, c] = m.angle.map(ps) as [string, string, string];
    return `deg(acos((${a} - ${b}).dot(${c} - ${b}) / (${a}.distance(${b})*${c}.distance(${b}))))`;
  }
  if ('area' in m) return shoelaceSym((p.polygons[m.area] ?? []).map(ps));
  const t = operands(m).map((i) => `(${measureSym(p, sub(p, i), ps)})`);
  if ('sum' in m) return t.join(' + ');
  if ('diff' in m) return `Abs(${t[0]} - ${t[1]})`;
  return `${t[0]}/${t[1]}`;
}

function measureChecks(p: ShapeParams, s: ShState, tag: string): WidgetCheck[] {
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
function goalChecks(p: ShapeParams, g: ShGoal): WidgetCheck {
  const s0 = shInit(p);
  const movers = new Set(goalMovers(p, g));
  const ps = (id: string): string => {
    const pt = p.points.find((x) => x.id === id) as ShPoint;
    // 발은 끄는 점을 따라오므로 그 점의 상태 기호로 식을 세운다(처음 자리 값으로 굳히지 않게)
    if (pt.foot) return footSym(pt.foot, ps);
    if (!movers.has(id)) return pointSym(p, s0, id);
    if (pt.on && 'circle' in pt.on) {
      const c = P(s0, pt.on.circle[0]);
      const r = pt.on.circle[1];
      return `Point(${c.x} + ${r}*cos(rad(pt_${id}_d)), ${c.y} + ${r}*sin(rad(pt_${id}_d)))`;
    }
    return `Point(pt_${id}_x, pt_${id}_y)`;
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
const latticeArea = (ps: { x: number; y: number }[]) =>
  ratStr(reduce(BigInt(Math.round(shoelace(ps) * 2)), 2n));

// ---- 형식 검사 ----

const ID = /^[A-Z]$/;

export const shapeDef: WidgetDef<ShapeParams> = {
  parse(raw) {
    const o = obj(
      raw,
      '도형판',
      ['grid', 'points'],
      ['polygons', 'circles', 'segments', 'measures', 'digits', 'cut', 'note', 'goal', 'done'],
    );
    const g = obj(o.grid, '도형판 grid', ['w', 'h']);
    const grid = { w: int(g.w, '도형판 grid.w', 2, 16), h: int(g.h, '도형판 grid.h', 2, 12) };
    const ids = new Set<string>();
    const need = (id: unknown, at: string) => {
      const v = str(id, at);
      if (!ids.has(v)) fail(at, `없는 점 ${v}`);
      return v;
    };
    const prev = new Map<string, ShPoint>();
    const points: ShPoint[] = arr(o.points, '도형판 points', 1, 10).map((rp, i) => {
      const at = `도형판 점${i + 1}`;
      const x = obj(rp, at, ['id'], ['x', 'y', 'deg', 'drag', 'on', 'aux', 'foot']);
      const id = str(x.id, `${at} id`);
      if (!ID.test(id)) fail(`${at} id`, '대문자 한 글자');
      if (ids.has(id)) fail(`${at} id`, `중복 (${id})`);
      if (x.drag !== undefined && typeof x.drag !== 'boolean') fail(`${at} drag`, 'true/false 만');
      const pt: ShPoint = { id, drag: x.drag === true };
      if (x.foot !== undefined) {
        // 발은 자리를 늘 계산하는 점 — 자리·끌기·제약을 적으면 계산한 자리와 어긋난다
        const bad = ['x', 'y', 'deg', 'drag', 'on', 'aux'].find((k) => x[k] !== undefined);
        if (bad) fail(`${at} foot`, `수선의 발에는 ${bad} 를 적지 않음(자리는 계산함)`);
        const f = obj(x.foot, `${at} foot`, ['from', 'line']);
        const from = need(f.from, `${at} foot.from`);
        const line = arr(f.line, `${at} foot.line`, 2, 2).map((v, j) =>
          need(v, `${at} foot.line${j + 1}`),
        ) as [string, string];
        if (prev.get(from)?.foot) fail(`${at} foot.from`, '발에서 다시 발을 내리지 않음');
        // 직선을 고정해 두면 발은 내린 점 하나만 따라간다(검산이 늘어놓는 상태도 그 점의 자리뿐)
        const [a, b] = line.map((v) => prev.get(v) as ShPoint);
        for (const e of [a, b])
          if (e?.drag || e?.on || e?.foot)
            fail(`${at} foot.line`, `직선 위 점 ${e.id} 은 고정된 격자점이어야 함`);
        if (a?.x === b?.x && a?.y === b?.y) fail(`${at} foot.line`, '직선의 두 점이 같은 자리');
        pt.foot = { from, line };
        ids.add(id);
        prev.set(id, pt);
        return pt;
      }
      if (x.aux !== undefined) {
        if (x.aux !== true) fail(`${at} aux`, 'true 만');
        if (pt.drag || x.on !== undefined) fail(`${at} aux`, '보조점은 고정 점(끌기·제약 없음)');
        pt.aux = true;
      }
      if (x.on !== undefined) {
        const on = obj(x.on, `${at} on`, [], ['seg', 'circle']);
        if (on.seg !== undefined) {
          const sg = arr(on.seg, `${at} on.seg`, 2, 2).map((v, j) =>
            need(v, `${at} on.seg${j + 1}`),
          );
          pt.on = { seg: [sg[0] as string, sg[1] as string] };
        } else if (on.circle !== undefined) {
          const c = arr(on.circle, `${at} on.circle`, 2, 2);
          pt.on = { circle: [need(c[0], `${at} 원 중심`), int(c[1], `${at} 반지름`, 1, 12)] };
        } else fail(`${at} on`, 'seg 나 circle 이 필요');
      }
      if (pt.on && 'circle' in pt.on) {
        const deg = int(x.deg, `${at} deg`, 0, 345);
        if (deg % CIRCLE_STEP) fail(`${at} deg`, `${CIRCLE_STEP}의 배수가 아님`);
        pt.deg = deg;
      } else {
        const cx = int(x.x, `${at} x`, -99, 99);
        const cy = int(x.y, `${at} y`, -99, 99);
        if (cx < 0 || cx > grid.w || cy < 0 || cy > grid.h) fail(at, `격자 밖 (${cx}, ${cy})`);
        pt.x = cx;
        pt.y = cy;
        if (x.deg !== undefined) fail(`${at} deg`, '원 위 점에만');
      }
      ids.add(id);
      prev.set(id, pt);
      return pt;
    });
    const p: ShapeParams = {
      grid,
      points,
      polygons: (o.polygons === undefined ? [] : arr(o.polygons, '도형판 polygons', 0, 4)).map(
        (pl, i) =>
          arr(pl, `도형판 다각형${i + 1}`, 3, 8).map((v, j) =>
            need(v, `도형판 다각형${i + 1} 점${j + 1}`),
          ),
      ),
      circles: (o.circles === undefined ? [] : arr(o.circles, '도형판 circles', 0, 3)).map(
        (rc, i) => {
          const c = obj(rc, `도형판 원${i + 1}`, ['c', 'r']);
          return { c: need(c.c, `도형판 원${i + 1} c`), r: int(c.r, `도형판 원${i + 1} r`, 1, 12) };
        },
      ),
      segments: (o.segments === undefined ? [] : arr(o.segments, '도형판 segments', 0, 8)).map(
        (rs, i) => {
          const sg = arr(rs, `도형판 선분${i + 1}`, 2, 2).map((v, j) =>
            need(v, `도형판 선분${i + 1} 점${j + 1}`),
          );
          return [sg[0], sg[1]] as [string, string];
        },
      ),
      measures: [],
      digits: o.digits === undefined ? 1 : int(o.digits, '도형판 digits', 0, 3),
    };
    const note = optStr(o.note, '도형판 note');
    if (note !== undefined) p.note = note;
    const done = optStr(o.done, '도형판 done');
    if (done !== undefined) p.done = done;
    // 차례로 읽는다 — 합·차·비는 앞에서 읽은 측정값만 가리킨다(순환이 생기지 않게)
    const rawMeasures = o.measures === undefined ? [] : arr(o.measures, '도형판 measures', 0, 6);
    rawMeasures.forEach((rm, i) => {
      const at = `도형판 측정${i + 1}`;
      const keys = ['len', 'angle', 'area', 'sum', 'diff', 'ratio'];
      const m = obj(rm, at, [], keys);
      // 열쇠가 둘이면 앞의 것만 읽혀 나머지가 소리 없이 버려진다
      if (keys.filter((k) => m[k] !== undefined).length !== 1)
        fail(at, `${keys.join('·')} 중 하나만`);
      const combo = (['sum', 'diff', 'ratio'] as const).find((k) => m[k] !== undefined);
      if (m.len !== undefined) {
        const l = arr(m.len, `${at} len`, 2, 2).map((v) => need(v, `${at} len`));
        p.measures.push({ len: [l[0], l[1]] as [string, string] });
      } else if (m.angle !== undefined) {
        const l = arr(m.angle, `${at} angle`, 3, 3).map((v) => need(v, `${at} angle`));
        p.measures.push({ angle: [l[0], l[1], l[2]] as [string, string, string] });
      } else if (combo) {
        const n = combo === 'sum' ? 4 : 2;
        const ops = arr(m[combo], `${at} ${combo}`, 2, n).map((v, j) => {
          const w = `${at} ${combo}${j + 1}`;
          if (i === 0) fail(w, '앞 측정값이 없음(묶을 측정값을 먼저 적으세요)');
          const k = int(v, w, 0, i - 1);
          const t = p.measures[k] as ShMeasure;
          if (!('len' in t || 'angle' in t))
            fail(w, '길이·각 측정값만 묶음(묶은 값·넓이는 다시 묶지 않음)');
          return k;
        });
        // PF + PF·|PF − FP|·PF ÷ PF 는 늘 2PF·0·1 — 끌어서 볼 것이 없다
        const ks = ops.map((k) => measureKey(p, p.measures[k] as ShMeasure));
        const dup = ks.findIndex((k, j) => ks.indexOf(k) !== j);
        if (dup >= 0)
          fail(
            at,
            `같은 측정값을 두 번 묶음 (${measureName(p, p.measures[ops[dup] as number] as ShMeasure)})`,
          );
        const kinds = new Set(ops.map((k) => measureKind(p, p.measures[k] as ShMeasure)));
        if (kinds.size > 1) fail(at, '길이는 길이끼리, 각은 각끼리 묶음');
        if (combo === 'ratio' && !kinds.has('len')) fail(at, '비는 길이끼리만');
        p.measures.push(
          combo === 'sum'
            ? { sum: ops }
            : combo === 'diff'
              ? { diff: ops as [number, number] }
              : { ratio: ops as [number, number] },
        );
      } else p.measures.push({ area: int(m.area, `${at} area`, 0, p.polygons.length - 1) });
    });
    // 보조점은 선분 위 점의 끝·선분 끝·수선의 발 직선으로만 — 다각형 꼭짓점·측정·원에 쓰면 보이지 않는 점을 읽게 된다
    const aux = new Set(points.filter((x) => x.aux).map((x) => x.id));
    const noAux = (ids: string[], what: string) => {
      const a = ids.find((id) => aux.has(id));
      if (a) fail(`도형판 ${what}`, `보조점 ${a} 은 선분 끝으로만 씀(그림에 안 보임)`);
    };
    p.polygons.forEach((pl, i) => {
      noAux(pl, `다각형${i + 1}`);
    });
    p.measures.forEach((m, i) => {
      // 묶은 값은 항들이 이미 검사됨
      if ('len' in m || 'angle' in m) noAux('len' in m ? m.len : m.angle, `측정${i + 1}`);
    });
    p.circles.forEach((c, i) => {
      noAux([c.c], `원${i + 1}`);
    });
    for (const pt of points) if (pt.on && 'circle' in pt.on) noAux([pt.on.circle[0]], `${pt.id}`);
    for (const pt of points)
      if (pt.on && 'seg' in pt.on) {
        const [a, b] = pt.on.seg.map((id) => points.find((x) => x.id === id) as ShPoint);
        if (a?.drag || b?.drag || a?.on || b?.on || a?.foot || b?.foot)
          fail(`도형판 ${pt.id}`, '선분 끝점은 고정된 격자점이어야 함');
        if (gcd((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0)) < 2)
          fail(`도형판 ${pt.id}`, '선분 위 격자점이 양끝뿐이라 움직일 곳이 없음');
      } else if (pt.on && 'circle' in pt.on) {
        const c = points.find((x) => x.id === (pt.on as { circle: [string, number] }).circle[0]);
        if (c?.drag || c?.on || c?.foot)
          fail(`도형판 ${pt.id}`, '원 중심은 고정된 격자점이어야 함');
      }
    if (o.cut !== undefined) {
      const c = obj(o.cut, '도형판 cut', ['piece', 'rest', 'by', 'result']);
      if (points.some((x) => x.drag || x.on))
        fail('도형판 cut', '잘라 옮기기에는 끄는 점·제약 점을 두지 않음');
      if (!p.polygons.length) fail('도형판 cut', '잘라 낼 다각형(polygons 첫째)이 있어야 함');
      const ids2 = (v: unknown, at: string) =>
        arr(v, at, 3, 8).map((x, j) => need(x, `${at}${j + 1}`));
      const by = arr(c.by, '도형판 cut.by', 2, 2).map((v, j) =>
        int(v, `도형판 cut.by${j + 1}`, -16, 16),
      );
      const result = arr(c.result, '도형판 cut.result', 3, 8).map((rv, j) => {
        const v = arr(rv, `도형판 결과 점${j + 1}`, 2, 2);
        return [
          int(v[0], `도형판 결과 점${j + 1} x`, 0, grid.w),
          int(v[1], `도형판 결과 점${j + 1} y`, 0, grid.h),
        ] as [number, number];
      });
      p.cut = {
        piece: ids2(c.piece, '도형판 조각 점'),
        rest: ids2(c.rest, '도형판 나머지 점'),
        by: [by[0] as number, by[1] as number],
        result,
      };
      if (p.cut.by[0] === 0 && p.cut.by[1] === 0) fail('도형판 cut.by', '옮기는 거리가 0');
      const s = shInit(p);
      const whole = shoelace((p.polygons[0] as string[]).map((id) => P(s, id)));
      const parts = cutArea(s, p.cut.rest) + cutArea(s, p.cut.piece);
      const res = shoelace(result.map(([x, y]) => ({ x, y })));
      if (Math.abs(whole - parts) > 1e-9) fail('도형판 cut', '조각+나머지 넓이가 처음 넓이와 다름');
      if (Math.abs(whole - res) > 1e-9)
        fail('도형판 cut.result', '결과 모양의 넓이가 처음 넓이와 다름');
    }
    if (o.goal !== undefined) {
      const at = '도형판 goal';
      if (p.cut) fail(at, '잘라 옮기기는 조각을 제자리에 옮기는 것이 목표 — 따로 두지 않음');
      const of = (v: unknown, w: string) => int(v, w, 0, p.measures.length - 1);
      const { shape, common } = parseGoalShape<number, ShIs>(o.goal, at, {
        of,
        // 수면 목표값, { of: 번호 } 면 그 측정값과 견준다(PF = PH, AD÷AB = AE÷AC)
        is: (v, w) =>
          typeof v === 'object' && v !== null && !Array.isArray(v)
            ? { of: of(obj(v, w, ['of']).of, `${w}.of`) }
            : { num: goalNum(v, w) },
        num: goalNum,
        isNum: (i) => ('num' in i ? i.num : null),
      });
      needHint(common, at);
      const g = { ...(shape as GoalShape<number, ShIs>), ...common };
      if (g.kind === 'value' && 'of' in g.is) {
        // 번호가 달라도 내용이 같으면(PF 와 FP, ∠FPG 와 ∠GPF) 어디서나 맞아 한 번 만지면 끝난다
        if (measureKey(p, sub(p, g.of)) === measureKey(p, sub(p, g.is.of)))
          fail(`${at} value.is`, '같은 측정값끼리는 늘 같음');
        if (measureKind(p, sub(p, g.of)) !== measureKind(p, sub(p, g.is.of)))
          fail(`${at} value.is`, '같은 종류의 측정값끼리만 견줌(길이는 길이, 각은 각)');
      }
      if (!goalMovers(p, g).length) fail(at, '그 측정값을 바꾸는 끄는 점이 없음');
      p.goal = g;
    } else if (o.done !== undefined) fail('도형판 done', '목표(goal)가 있을 때만');
    return p;
  },
  // 닿는 자리를 모두 늘어놓는 검사(발의 자리·목표에 닿을 수 있는가)는 형식 검사에서만 — 장면을 열 때는 건너뛴다
  deep(p) {
    checkFeet(p);
    const g = p.goal;
    if (!g) return;
    const at = '도형판 goal';
    checkNotAtStart(shGoalHits(p, shInit(p)), shGoalNeed(p), at);
    const states = goalStates(p, g).map((x) => x.s);
    checkSameText(p, g, states);
    checkHitTable(goalTable(p, g, states), g.kind === 'value' ? g.places : 1, g.tol, at, (k) =>
      g.kind === 'visit' ? `가 볼 곳 ${g.at[k]?.src}` : '목표',
    );
  },
  checks(p) {
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
    if (p.goal) out.push(goalChecks(p, p.goal));
    return out;
  },
  texts: (p) => [
    ...(p.note ? [p.note] : []),
    ...(p.done ? [p.done] : []),
    ...(p.goal ? [p.goal.hint] : []),
  ],
  hasGoal: (p) => !!p.cut || !!p.goal,
};
