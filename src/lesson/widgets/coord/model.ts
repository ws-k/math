// 상태와 손으로 바꾸기(순수): 처음 상태·점 끌기·방향키·찍은 점 더하기/옮기기/지우기·탐색 목표.
// 화면(Coord.tsx)이 손 조작마다 부르는 함수들이라, 그리기·검산과 떼어 두면 손 조작만 따로 읽고 고칠 수 있다.
import type { GridPt } from '../../grade.ts';
import { fAt } from './curve.ts';
import { frame, iRange, MIN_SNAP_PX, snapMult, toWorld } from './frame.ts';
import { pointOf, pointXY } from './point.ts';
import type { Box, CoordParams, CoordState } from './types.ts';

/** 직선 손잡이 처음 자리: 화면 가로 1/4·3/4, 세로 가운데 줄 */
function defaultStart(p: CoordParams): [GridPt, GridPt] {
  const i0 = Math.ceil(p.x.lo / p.x.st);
  const i1 = Math.floor(p.x.hi / p.x.st);
  const jm = Math.round((Math.ceil(p.y.lo / p.y.st) + Math.floor(p.y.hi / p.y.st)) / 2);
  const a = i0 + Math.round((i1 - i0) / 4);
  const b = i0 + Math.round(((i1 - i0) * 3) / 4);
  return [
    { i: a, j: jm },
    { i: b === a ? a + 1 : b, j: jm },
  ];
}

export function initial(p: CoordParams): CoordState {
  const pts: Record<string, GridPt> = {};
  for (const o of p.objects) if (o.kind === 'point') pts[o.id] = { i: o.i, j: o.j };
  return {
    vars: Object.fromEntries(p.sliders.map((s) => [s.id, s.value])),
    pts,
    user: p.mode === 'line' ? (p.start ?? defaultStart(p)).map((g) => ({ ...g })) : [],
    stroke: [],
  };
}

// ---- 손으로 바꾸기(순수) ----

/** 점 끌기: 누른 자리(px)로 점을 옮긴 상태. 곡선 위 점은 x 만, 정의 안 되는 자리면 그대로 */
export function dragPoint(
  p: CoordParams,
  s: CoordState,
  id: string,
  px: number,
  py: number,
  box: Box,
): CoordState {
  const o = pointOf(p, id);
  const f = frame(box);
  const [wx, wy] = toWorld(p, f, px, py);
  if (o.on) {
    const pxPerStep = (o.snapN / (p.x.hi - p.x.lo)) * (f.r - f.l);
    const k = snapMult(pxPerStep, MIN_SNAP_PX);
    const [lo, hi] = iRange(p.x.lo, p.x.hi, o.snapN);
    const i = Math.min(hi as number, Math.max(lo as number, Math.round(wx / (o.snapN * k)) * k));
    if (Number.isNaN(fAt(p, s, o.on, i * o.snapN))) return s;
    return { ...s, pts: { ...s.pts, [id]: { i, j: 0 } } };
  }
  return { ...s, pts: { ...s.pts, [id]: gridAt(p, wx, wy) } };
}

/** 세계 좌표에서 가장 가까운 칸 점(범위 안) */
export function gridAt(p: CoordParams, wx: number, wy: number): GridPt {
  const [i0, i1] = iRange(p.x.lo, p.x.hi, p.x.st) as [number, number];
  const [j0, j1] = iRange(p.y.lo, p.y.hi, p.y.st) as [number, number];
  return {
    i: Math.min(i1, Math.max(i0, Math.round(wx / p.x.st))),
    j: Math.min(j1, Math.max(j0, Math.round(wy / p.y.st))),
  };
}

const KEYS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/** 방향키 한 칸. 곡선 위 점은 위·아래 키도 x 를 움직인다(슬라이더 관례). 다루지 않는 키면 null */
export function keyMove(
  p: CoordParams,
  s: CoordState,
  handle: string,
  key: string,
): CoordState | null {
  const d = KEYS[key];
  if (!d) return null;
  if (handle.startsWith('u')) {
    const n = Number(handle.slice(1));
    const g = s.user[n];
    if (!g) return null;
    const ng = gridAt(p, (g.i + d[0]) * p.x.st, (g.j + d[1]) * p.y.st);
    const user = s.user.map((u, k) => (k === n ? ng : u));
    return { ...s, user };
  }
  const o = pointOf(p, handle);
  const g = s.pts[handle] ?? { i: o.i, j: o.j };
  if (o.on) {
    const step = d[0] || d[1];
    const [lo, hi] = iRange(p.x.lo, p.x.hi, o.snapN) as [number, number];
    const i = Math.min(hi, Math.max(lo, g.i + step));
    if (Number.isNaN(fAt(p, s, o.on, i * o.snapN))) return s;
    return { ...s, pts: { ...s.pts, [handle]: { i, j: 0 } } };
  }
  return {
    ...s,
    pts: { ...s.pts, [handle]: gridAt(p, (g.i + d[0]) * p.x.st, (g.j + d[1]) * p.y.st) },
  };
}

/** 찍기: 빈 칸 점이면 더하고, 이미 찍은 점이면 그대로(지우기는 그 점을 눌러서) */
export function addUser(s: CoordState, g: GridPt): CoordState {
  if (s.user.some((u) => u.i === g.i && u.j === g.j)) return s;
  return { ...s, user: [...s.user, g] };
}
export const removeUser = (s: CoordState, n: number): CoordState => ({
  ...s,
  user: s.user.filter((_, k) => k !== n),
});
export function moveUser(
  p: CoordParams,
  s: CoordState,
  n: number,
  px: number,
  py: number,
  box: Box,
) {
  const [wx, wy] = toWorld(p, frame(box), px, py);
  const g = gridAt(p, wx, wy);
  // 다른 점 위로 옮기면 겹치므로 그 자리는 받지 않는다
  if (s.user.some((u, k) => k !== n && u.i === g.i && u.j === g.j)) return s;
  return { ...s, user: s.user.map((u, k) => (k === n ? g : u)) };
}

/** 빈 칸 점 하나(키보드로 점을 더할 때): 가운데에서 가장 가까운 빈 칸 */
export function freeSpot(p: CoordParams, s: CoordState): GridPt | null {
  const c = gridAt(p, (p.x.lo + p.x.hi) / 2, (p.y.lo + p.y.hi) / 2);
  const [i0, i1] = iRange(p.x.lo, p.x.hi, p.x.st) as [number, number];
  const [j0, j1] = iRange(p.y.lo, p.y.hi, p.y.st) as [number, number];
  let best: GridPt | null = null;
  let bd = Number.POSITIVE_INFINITY;
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      if (s.user.some((u) => u.i === i && u.j === j)) continue;
      const d = Math.hypot(i - c.i, j - c.j);
      if (d < bd) {
        bd = d;
        best = { i, j };
      }
    }
  return best;
}

/** 탐색 목표: 끄는 점이 상대 점에 within 만큼 다가갔나 */
export function goalMet(p: CoordParams, s: CoordState): boolean {
  if (!p.goal) return false;
  const [a, b] = p.goal.approach;
  return Math.abs(pointXY(p, s, a)[0] - pointXY(p, s, b)[0]) <= p.goal.within + 1e-12;
}
