// 상태와 손으로 바꾸기(순수): 처음 상태·점 끌기·방향키·찍은 점 더하기/옮기기/지우기. 목표 판정은 goal.ts.
// 화면(Coord.tsx)이 손 조작마다 부르는 함수들이라, 그리기·검산과 떼어 두면 손 조작만 따로 읽고 고칠 수 있다.
import type { GridPt } from '../../grade.ts';
import { fAt } from './curve.ts';
import { frame, iRange, MIN_SNAP_PX, snapMult, toWorld } from './frame.ts';
import { pointOf, xCells } from './point.ts';
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
    solved: false,
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
  const f = frame(box, p);
  const [wx, wy] = toWorld(p, f, px, py);
  if (o.on) {
    const pxPerStep = (o.snapN / (p.x.hi - p.x.lo)) * (f.r - f.l);
    // 목표가 보는 점은 묶지 않는다: 묶으면 좁은 화면에서 목표 칸(예: 정의 안 되는 x=1 옆 0.95)을 건너뛴다.
    // 손떨림 방지(묶기)보다 '끌어서 닿는다'가 먼저 — 새 목표는 31칸 상한(goal.ts)으로 칸 폭도 지킨다
    const k = p.goalPts?.includes(id) ? 1 : snapMult(pxPerStep, MIN_SNAP_PX);
    const { i0: lo, i1: hi } = xCells(p.x, o);
    const i = Math.min(hi, Math.max(lo, Math.round(wx / (o.snapN * k)) * k));
    if (Number.isNaN(fAt(p, s, o.on, i * o.snapN))) return s;
    return { ...s, pts: { ...s.pts, [id]: { i, j: 0 } } };
  }
  const g = inRange(p, id, gridAt(p, wx, wy));
  // 가로로만 끄는 칸 위 점: 세로 칸은 그대로(손이 위아래로 흔들려도 가로축에서 떨어지지 않게)
  const j = o.drag === 'x' ? (s.pts[id] ?? o).j : g.j;
  return { ...s, pts: { ...s.pts, [id]: { i: g.i, j } } };
}

/** 칸 위 점의 끄는 x 범위(point.ts xCells) 안으로. 범위가 없으면 그대로 */
function inRange(p: CoordParams, id: string, g: GridPt): GridPt {
  const { i0, i1 } = xCells(p.x, pointOf(p, id));
  return { i: Math.min(i1, Math.max(i0, g.i)), j: g.j };
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
    const { i0: lo, i1: hi } = xCells(p.x, o);
    // 곡선이 정의 안 된 칸(조각 함수의 구멍·정의역 밖)은 같은 방향 다음 칸으로 건너뛴다 — 멈추면 방향키·◀▶ 로는
    // 구멍 건너편에 영영 못 간다(슬라이더 제외 값 건너뛰기 sliderSnap 과 같은 규칙). 끝까지 없으면 제자리
    for (let i = g.i + step; i >= lo && i <= hi; i += step)
      if (!Number.isNaN(fAt(p, s, o.on, i * o.snapN)))
        return { ...s, pts: { ...s.pts, [handle]: { i, j: 0 } } };
    return s;
  }
  // 가로로만 끄는 칸 위 점은 위·아래 키도 가로로(곡선 위 점·슬라이더 관례)
  const [di, dj] = o.drag === 'x' ? [d[0] || d[1], 0] : d;
  return {
    ...s,
    pts: {
      ...s.pts,
      [handle]: inRange(p, handle, gridAt(p, (g.i + di) * p.x.st, (g.j + dj) * p.y.st)),
    },
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
  const [wx, wy] = toWorld(p, frame(box, p), px, py);
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
