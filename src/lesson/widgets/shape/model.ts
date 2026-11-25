// 좌표와 상태, 손으로 바꾸기(순수): 처음 상태·끌기·방향키·수선의 발 다시 계산. 화면이 손 조작마다 부르는 함수들.
import { r2 } from '../draw.ts';
import { derivedPos, isDerived } from './derive.ts';
import { CIRCLE_STEP, type ShapeParams, type ShPoint, type ShState, W } from './types.ts';

export function shUnit(p: ShapeParams) {
  return Math.min(288 / p.grid.w, 220 / p.grid.h);
}
export function shGeom(p: ShapeParams) {
  const u = shUnit(p);
  const ox = (W - p.grid.w * u) / 2;
  const oy = 16 + p.grid.h * u;
  return { u, ox, oy, h: oy + 16 };
}
export const X = (p: ShapeParams, x: number) => r2(shGeom(p).ox + x * shGeom(p).u);
export const Y = (p: ShapeParams, y: number) => r2(shGeom(p).oy - y * shGeom(p).u);
export const rad = (d: number) => (d * Math.PI) / 180;

export function circlePos(s: ShState, on: { circle: [string, number] }, deg: number) {
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
  if (p.pieces) s.pcs = p.pieces.map(() => ({ t: 0, d: [0, 0] }));
  return settle(p, s);
}

/**
 * 계산되는 점(수선의 발·따라오는 점·마주 보는 점) 자리를 지금 점들로 다시 계산한 상태. 점을 옮기는 모든 길(끌기·키·
 * 검산용 상태 늘어놓기)이 이것을 거쳐야 계산되는 점이 끄는 점을 따라온다. 적은 차례대로 — 앞에 적은 점만 기댄다.
 */
export function settle(p: ShapeParams, s: ShState): ShState {
  if (!p.points.some(isDerived)) return s;
  const pts = { ...s.pts };
  for (const pt of p.points) if (isDerived(pt)) pts[pt.id] = derivedPos(pt, pts);
  return { ...s, pts };
}

/** 자유 점이 닿는 격자 범위(range 가 없으면 격자 전체) */
export const rangeOf = (p: ShapeParams, pt: ShPoint) =>
  pt.range ?? { x: [0, p.grid.w] as [number, number], y: [0, p.grid.h] as [number, number] };

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** 점 id 를 world 좌표 (tx,ty) 쪽으로 옮긴 상태(제약·격자·범위 적용) */
export function place(p: ShapeParams, s: ShState, id: string, tx: number, ty: number): ShState {
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
    const r = rangeOf(p, pt);
    n = {
      x: Math.min(r.x[1], Math.max(r.x[0], Math.round(tx))),
      y: Math.min(r.y[1], Math.max(r.y[0], Math.round(ty))),
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

export const P = (s: ShState, id: string) => s.pts[id] as { x: number; y: number; deg?: number };
