// 조각 여러 개 끌어 옮기기·돌리기(pieces). 잘라 옮기기(cut)는 조각 하나를 정한 거리만큼 옮기는 것이라
// 피타고라스 조각 맞추기·사각형 조각 돌려 붙이기처럼 "여러 조각을 돌려서 빈 틀에 채우기"를 보일 수 없었다.
// 조각의 자리 = (돌린 횟수 t, 옮긴 칸 d). 돌리기는 조각의 처음 자리 가운데 격자점(옮긴 만큼 따라감) 둘레로 90° 씩 —
// 격자점 둘레 90° 돌리기는 격자점을 격자점으로 보내 넓이가 정확히 그대로다(돌려도 넓이 불변). 격자 가운데에서는
// 네 번 돌리면 제자리지만, 가장자리에서는 돌린 조각이 격자 안으로 밀려 들어와(clamp) 제자리로 돌아오지 않을 수 있다.
// 목표 판정은 모양(둘레를 도는 꼭짓점 차례, geom.polyKey)으로 한다: 정사각형처럼 돌려도 같은 모양이면 몇 번 돌렸든
// 같은 자리면 맞고, 꼭짓점 모음이 같아도 뒤집힌 모양(거울상)은 다르다. 목표 자리와 조각은 일대일로 짝짓는다 —
// 같은 모양 조각 둘을 한 자리에 겹쳐 놓으면 한 곳만 채운 것이다(리뷰 M2).
// 끄는 동안(ShState.moving)과 키로 옮긴 뒤 판정 전에는 그 조각을 짝짓지 않는다 — 손을 떼기 전에 초록이 되면
// 판정을 미리 알려 주는 셈이다(원칙 P3, 리뷰 M1).
import { arr, fail, int, obj } from '../../parse.ts';
import type { WidgetCheck } from '../specs.ts';
import { areaOf, overlapArea, polyKey, triangulate } from './geom.ts';
import { shoelace } from './measure.ts';
import { shUnit } from './model.ts';
import { shoelaceSym as areaSym, latticeArea } from './num.ts';
import type { ShapeParams, ShPiece, ShPose, ShState } from './types.ts';

type XY = { x: number; y: number };

const MAX_PIECES = 6;

/** 돌리는 둘레: 처음 자리 가운데에 가장 가까운 격자점(옮긴 칸만큼 같이 옮겨 간다) */
function pivot(pc: ShPiece): XY {
  const xs = pc.at.map((v) => v[0]);
  const ys = pc.at.map((v) => v[1]);
  return {
    x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2),
  };
}

/** 자리 pose 에 놓인 조각의 꼭짓점(at 의 차례 그대로) */
export function posed(pc: ShPiece, pose: ShPose): XY[] {
  const c = pivot(pc);
  return pc.at.map(([x, y]) => {
    let dx = x - c.x;
    let dy = y - c.y;
    for (let k = 0; k < pose.t; k++) [dx, dy] = [-dy, dx];
    return { x: c.x + dx + pose.d[0], y: c.y + dy + pose.d[1] };
  });
}

const piece = (p: ShapeParams, i: number) => (p.pieces as ShPiece[])[i] as ShPiece;
const poseOf = (s: ShState, i: number) => (s.pcs as ShPose[])[i] as ShPose;

/** 지금 자리의 조각 꼭짓점 */
export const shPiecePts = (p: ShapeParams, s: ShState, i: number) =>
  posed(piece(p, i), poseOf(s, i));

const key = polyKey;

/** 조각이 격자 밖으로 나가지 않게 옮긴 칸만 당긴다(돌린 횟수는 그대로) */
function clamp(p: ShapeParams, pc: ShPiece, pose: ShPose): ShPose {
  const ps = posed(pc, pose);
  const lo = (a: number[], lim: number) => {
    const min = Math.min(...a);
    const max = Math.max(...a);
    return min < 0 ? -min : max > lim ? lim - max : 0;
  };
  const sx = lo(
    ps.map((q) => q.x),
    p.grid.w,
  );
  const sy = lo(
    ps.map((q) => q.y),
    p.grid.h,
  );
  return { t: pose.t, d: [pose.d[0] + sx || 0, pose.d[1] + sy || 0] };
}

function setPose(p: ShapeParams, s: ShState, i: number, pose: ShPose): ShState {
  const pcs = [...(s.pcs as ShPose[])];
  pcs[i] = clamp(p, piece(p, i), pose);
  return { ...s, pcs };
}

/** 끌기: 시작 상태 s 에서 조각 i 를 화면 거리 (dx,dy)(SVG 단위)만큼 — 격자 칸 단위로. 끄는 중 표시(moving)를 단다 */
export function shPieceDrag(p: ShapeParams, s: ShState, i: number, dx: number, dy: number) {
  const u = shUnit(p);
  const o = poseOf(s, i);
  const n = setPose(p, s, i, {
    t: o.t,
    d: [o.d[0] + Math.round(dx / u) || 0, o.d[1] - Math.round(dy / u) || 0],
  });
  return { ...n, moving: i };
}

/** 판정할 때(손을 뗌·키 입력이 멈춤): 끄는 중 표시를 뗀 상태. 표시가 없으면 그대로(같은 객체 — 다시 그리지 않게) */
export function shPieceDrop(s: ShState): ShState {
  if (s.moving === undefined) return s;
  const { moving: _, ...rest } = s;
  return rest;
}

/** 돌리기: 시계 반대 방향으로 90° */
export const shPieceTurn = (p: ShapeParams, s: ShState, i: number) => {
  const o = poseOf(s, i);
  return setPose(p, s, i, { t: (o.t + 1) % 4, d: o.d });
};

/** 방향키: 한 칸 옮기기(다른 키는 null) */
export function shPieceKey(p: ShapeParams, s: ShState, i: number, k: string): ShState | null {
  const v = (
    { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as const
  )[k as 'ArrowRight'];
  if (!v) return null;
  const o = poseOf(s, i);
  return setPose(p, s, i, { t: o.t, d: [o.d[0] + v[0], o.d[1] + v[1]] });
}

const targetKeys = (p: ShapeParams) =>
  (p.pieces ?? []).map((pc) => key(pc.to.map(([x, y]) => ({ x, y }))));

/**
 * 조각마다 목표 자리 하나와 짝지어졌는가(일대일). 적은 차례대로 비어 있는 같은 모양 자리를 차지한다 — 모양이
 * 같아야만 짝이 되므로 차례대로 고르기로 가장 많이 짝지어진다. 끄는 중인 조각은 짝짓지 않는다.
 */
export function shPieceMatch(p: ShapeParams, s: ShState): boolean[] {
  const free = targetKeys(p);
  return (p.pieces ?? []).map((_, i) => {
    if (s.moving === i) return false;
    const k = free.indexOf(key(shPiecePts(p, s, i)));
    if (k < 0) return false;
    free.splice(k, 1);
    return true;
  });
}

/** 모든 조각이 목표 자리를 하나씩 채웠는가(같은 모양 조각끼리는 자리를 바꿔 놓아도 된다) */
export function shPiecesDone(p: ShapeParams, s: ShState): boolean {
  return !!p.pieces && shPieceMatch(p, s).every(Boolean);
}

/** 조각 넓이의 합(돌리고 옮겨도 그대로 — 화면 글로 보인다) */
export const piecesArea = (p: ShapeParams, s: ShState) =>
  (p.pieces ?? []).reduce((t, _, i) => t + shoelace(shPiecePts(p, s, i)), 0);

const xyList = (v: unknown, at: string, grid: { w: number; h: number }, n?: number) =>
  arr(v, at, n ?? 3, n ?? 8).map((rv, j) => {
    const q = arr(rv, `${at} 점${j + 1}`, 2, 2).map((c, k) =>
      int(c, `${at} 점${j + 1} ${k ? 'y' : 'x'}`, -99, 99),
    ) as [number, number];
    if (q[0] < 0 || q[0] > grid.w || q[1] < 0 || q[1] > grid.h)
      fail(`${at} 점${j + 1}`, `격자 밖 (${q[0]}, ${q[1]})`);
    return q;
  });

/** 조각 읽기. 목표 자리 to 가 처음 조각을 돌리고 옮겨서 닿는 자리인지 여기서 확인하고 그 자리(pose)를 적어 둔다 */
export function parsePieces(raw: unknown, rawOutline: unknown, p: ShapeParams): void {
  const pieces = arr(raw, '도형판 pieces', 1, MAX_PIECES).map((rp, i) => {
    const at = `도형판 조각${i + 1}`;
    const o = obj(rp, at, ['at', 'to']);
    const from = xyList(o.at, `${at} at`, p.grid);
    const to = xyList(o.to, `${at} to`, p.grid, from.length);
    const pc: ShPiece = { at: from, to, pose: { t: 0, d: [0, 0] } };
    if (shoelace(from.map(([x, y]) => ({ x, y }))) < 1e-9) fail(`${at} at`, '넓이가 0 인 조각');
    // 어느 쪽으로 돌려도 격자에 들어가야 돌리기가 늘 된다(격자 밖으로 밀려 나가지 않게)
    for (let t = 0; t < 4; t++) {
      const ps = posed(pc, { t, d: [0, 0] });
      const w = Math.max(...ps.map((q) => q.x)) - Math.min(...ps.map((q) => q.x));
      const h = Math.max(...ps.map((q) => q.y)) - Math.min(...ps.map((q) => q.y));
      if (w > p.grid.w || h > p.grid.h)
        fail(at, '돌리면 격자보다 커짐 — 조각을 줄이거나 격자를 넓히세요');
    }
    const want = key(to.map(([x, y]) => ({ x, y })));
    const lowest = (ps: XY[]) =>
      ps.reduce((a, q) => (q.x < a.x || (q.x === a.x && q.y < a.y) ? q : a));
    const goal = [0, 1, 2, 3]
      .map((t) => {
        const ps = posed(pc, { t, d: [0, 0] });
        const a = lowest(ps);
        const b = lowest(to.map(([x, y]) => ({ x, y })));
        return { t, d: [b.x - a.x, b.y - a.y] as [number, number] };
      })
      .find((pose) => key(posed(pc, pose)) === want);
    if (!goal)
      fail(
        `${at} to`,
        '처음 조각을 돌리고 옮겨서 닿지 않는 자리(뒤집어야 하거나 모양이 다름) — 꼭짓점 자리를 확인하세요',
      );
    pc.pose = goal as ShPose;
    return pc;
  });
  p.pieces = pieces;
  // 목표 자리끼리: 같은 자리 둘이면 한 조각이 놓일 곳이 없고, 겹치면 '다 채웠다'가 틀을 채운 것이 아니다
  const tos = pieces.map((pc) => pc.to.map(([x, y]) => ({ x, y })));
  for (const [i, t] of tos.entries()) {
    const tri = triangulate(t).reduce((s, q) => s + areaOf(q), 0);
    // 귀 자르기가 다 못 나눈 모양(자기 교차 등)은 겹침을 셀 수 없다
    if (Math.abs(tri - areaOf(t)) > 1e-9)
      fail(
        `도형판 조각${i + 1} to`,
        '변이 서로 엇갈리는 모양 — 둘레를 도는 차례로 꼭짓점을 적으세요',
      );
    for (let j = 0; j < i; j++) {
      const u = tos[j] as XY[];
      if (key(u) === key(t)) fail(`도형판 조각${i + 1} to`, `조각${j + 1} 과 같은 목표 자리`);
      if (overlapArea(u, t) > 1e-9)
        fail(`도형판 조각${i + 1} to`, `조각${j + 1} 의 목표 자리와 겹침`);
    }
  }
  if (rawOutline !== undefined) {
    p.outline = xyList(rawOutline, '도형판 outline', p.grid);
    const o = p.outline.map(([x, y]) => ({ x, y }));
    const a = shoelace(o);
    const sum = pieces.reduce((t, pc) => t + shoelace(pc.at.map(([x, y]) => ({ x, y }))), 0);
    if (Math.abs(a - sum) > 1e-9)
      fail('도형판 outline', `빈 틀 넓이 ${a} 가 조각 넓이의 합 ${sum} 과 다름`);
    // 목표 자리가 겹치지 않고 넓이 합이 틀과 같으니, 모두 틀 안이면 틀을 빈틈없이 채운다
    for (const [i, t] of tos.entries())
      if (Math.abs(overlapArea(t, o) - areaOf(t)) > 1e-9)
        fail(`도형판 조각${i + 1} to`, '목표 자리가 빈 틀 밖으로 나감');
  }
  const s = {
    pts: {},
    cut: [0, 0] as [number, number],
    pcs: pieces.map(() => ({ t: 0, d: [0, 0] })),
  };
  if (shPiecesDone(p, s as ShState))
    fail('도형판 pieces', '처음 자리가 이미 목표 — 옮길 것이 없음');
}

/**
 * 검산: 조각마다 sympy 가 처음 꼭짓점을 같은 둘레로 같은 횟수 돌리고(rotate) 옮긴 자리 = 앱이 계산한 목표 자리,
 * 그 넓이 = 처음 넓이(돌려도 넓이 불변). 빈 틀이 있으면 조각 넓이의 합 = 빈 틀 넓이.
 */
export function pieceChecks(p: ShapeParams): WidgetCheck[] {
  const out: WidgetCheck[] = [];
  (p.pieces ?? []).forEach((pc, i) => {
    const c = pivot(pc);
    const sym = pc.at.map(
      ([x, y]) =>
        `(Point(${x}, ${y}).rotate(${pc.pose.t}*pi/2, Point(${c.x}, ${c.y})) + Point(${pc.pose.d[0]}, ${pc.pose.d[1]}))`,
    );
    const app = posed(pc, pc.pose);
    out.push({
      name: `조각${i + 1} 돌려 옮긴 넓이 = 처음 넓이`,
      answer: latticeArea(pc.at.map(([x, y]) => ({ x, y }))),
      answerType: 'fraction',
      check: areaSym(sym),
    });
    out.push({
      name: `조각${i + 1} 목표 자리 = sympy 로 돌려 옮긴 자리`,
      answer: '0',
      answerType: 'fraction',
      check: app.map((q, k) => `Abs(${sym[k]}.x - ${q.x}) + Abs(${sym[k]}.y - ${q.y})`).join(' + '),
    });
  });
  if (p.outline && p.pieces)
    out.push({
      name: '조각 넓이의 합 = 빈 틀 넓이',
      answer: latticeArea(p.outline.map(([x, y]) => ({ x, y }))),
      answerType: 'fraction',
      check: p.pieces.map((pc) => areaSym(pc.at.map(([x, y]) => `Point(${x}, ${y})`))).join(' + '),
    });
  return out;
}
