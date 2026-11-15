// 좌표평면 목표(explore 모드): 형식 검사·판정(손을 뗀 상태 하나 → 닿은 목표 열쇠)·검산 항목.
// 진행·힌트·완료 글 같은 공통 규칙은 src/lesson/goal.ts 가 맡고, 여기는 "무엇을 재서 무엇과 견주나"만 안다.
//
// 검산(원칙 P7): 목표가 바라보는 끄는 점·슬라이더가 닿는 모든 상태를 늘어놓고, 앱 판정(goalHits)을
// 상태마다 기록해 sympy 가 같은 판정을 되풀이하게 한다(verify.py check_goal). 끄는 도중의 상태도
// 손을 떼면 닿는 상태라 모두 들어간다.

import { exactOf } from '../../expr.ts';
import {
  checkHitTable,
  checkNotAtStart,
  goalNum,
  growStates,
  hitTable,
  needHint,
  parseGoalShape,
  sameVal,
  type Val,
} from '../../goal.ts';
import { fail, obj, str } from '../../parse.ts';
import type { WidgetCheck } from '../specs.ts';
import { near, numExpr, target, toIndex } from './common.ts';
import { iRange, MAX_GOAL_SNAPS } from './frame.ts';
import { initial } from './model.ts';
import { pointOf, pointState, pointXY, worldX, xSym, ySym } from './point.ts';
import { parseReadoutExpr, readoutMovers, readoutSym, readoutVal } from './readout.ts';
import { sliderSym, sliderValues } from './slider.ts';
import type {
  CoordParams,
  CoordState,
  Goal,
  GoalIs,
  NewGoal,
  ParseCtx,
  ReadoutExpr,
} from './types.ts';

const isNew = (g: Goal | undefined): g is NewGoal => g !== undefined && 'kind' in g;

/** 목표 읽기. gx 는 숨긴 정답도 가리킬 수 있는 문맥(목표 점 숨김) */
export function parseGoal(raw: unknown, p: CoordParams, gx: ParseCtx): Goal {
  const at = '좌표 goal';
  if (p.mode !== 'explore') fail(at, 'explore 모드에서만(다른 모드는 task)');
  const of = (v: unknown, w: string): ReadoutExpr => parseReadoutExpr(str(v, w), w, gx);
  const { shape, common, o } = parseGoalShape<ReadoutExpr, GoalIs>(
    raw,
    at,
    {
      of,
      is(v, w) {
        // 수면 목표값, 글자가 읽는 값 꼴이면 그 값과 견준다(접선 기울기 = 평균 기울기)
        if (typeof v === 'number') return { num: goalNum(v, w) };
        const t = str(v, w);
        try {
          return { num: goalNum(t, w) };
        } catch {
          const e = of(t, w);
          if (e.f === 'roots' || e.f === 'meet') fail(w, '개수끼리는 견주지 않음(수를 적으세요)');
          return { of: e };
        }
      },
      num: goalNum,
      isNum: (i) => ('num' in i ? i.num : null),
    },
    { kinds: ['approach', 'place'], keys: ['within'] },
  );
  if (o.approach !== undefined) return approachGoal(o, p, gx, common.hint);
  if (o.within !== undefined) fail(`${at} within`, 'approach 목표에서만');
  needHint(common, at);
  if (shape) return snapsOk(p, { ...shape, ...common });
  // place: 끄는 점을 (x,y) 에. 답이라 검산식이 필요하다
  const pl = obj(o.place, `${at} place`, ['point'], ['x', 'y']);
  const pt = gx.pointRef(pl.point, `${at} place.point`);
  if (pt.drag === 'none') fail(`${at} place`, `${pt.id} 는 끌 수 없는 점`);
  if (common.tol.n !== 0) fail(`${at} tol`, '점 자리 목표는 칸 위라 허용 오차를 두지 않음');
  const out: NewGoal = { kind: 'place', point: pt.id, ...common };
  const val = (t: { value: string }) => numExpr(t.value, `${at} place`).n;
  if (pt.on) {
    if (pl.x === undefined || pl.y !== undefined)
      fail(`${at} place`, '곡선 위 점은 x 만(y 는 곡선에서 계산)');
    out.x = target(pl.x, `${at} place.x`);
    out.i = toIndex(val(out.x), pt.snapN, `${at} place.x`);
  } else {
    if (pl.x === undefined || pl.y === undefined) fail(`${at} place`, 'x 와 y 둘 다');
    out.x = target(pl.x, `${at} place.x`);
    out.y = target(pl.y, `${at} place.y`);
    out.i = toIndex(val(out.x), p.x.st, `${at} place.x`);
    out.j = toIndex(val(out.y), p.y.st, `${at} place.y`);
  }
  return snapsOk(p, out);
}

/**
 * 목표가 보는 곡선 위 점은 가장 좁은 화면에서도 끌기가 칸을 건너뛰지 않을 만큼만 촘촘하게(MAX_GOAL_SNAPS).
 * 한 칸이 8px 보다 작으면 끌기가 2·5칸씩 묶여(snapMult) 목표 자리를 건너뛸 수 있다 — 화면 폭마다 닿는 자리를
 * 따로 세는 대신 이렇게 막아, 형식 검사·검산이 늘어놓는 자리가 어느 화면에서나 끌어서 닿는 자리와 같게 한다.
 */
function snapsOk(p: CoordParams, g: NewGoal): NewGoal {
  for (const id of movers(p, g).points) {
    const o = pointOf(p, id);
    const n = (p.x.hi - p.x.lo) / o.snapN;
    if (o.on && n > MAX_GOAL_SNAPS + 1e-9)
      fail(
        `좌표 goal`,
        `${id} 의 끄는 칸이 ${Math.round(n)}칸 — 가장 좁은 화면에서 한 칸이 8px 보다 작아 끌기가 칸을 건너뜀(${MAX_GOAL_SNAPS}칸 이하로)`,
      );
  }
  return g;
}

/** 옛 형식: 끄는 점이 상대 점에 다가가기 */
function approachGoal(
  o: Record<string, unknown>,
  p: CoordParams,
  gx: ParseCtx,
  hint: string,
): Goal {
  const at = '좌표 goal';
  const g = obj(o, at, ['approach'], ['within', 'hint']);
  if (!Array.isArray(g.approach) || g.approach.length !== 2) fail(`${at}.approach`, '점 두 개');
  const [a, b] = g.approach as unknown[];
  const pa = gx.pointRef(a, at);
  const pb = gx.pointRef(b, at);
  if (pa.drag === 'none') fail(at, `${pa.id} 는 끌 수 없는 점`);
  const within = g.within === undefined ? 0 : numExpr(g.within, `${at}.within`).n;
  // 끄는 간격으로 닿을 수 있는 목표인가(겹쳐야 하면 b 의 x 가 a 의 끄는 칸 위에 있어야)
  const xb = worldX(p, pb, pb.i);
  const k = xb / pa.snapN;
  if (within === 0 && !near(Math.round(k) * pa.snapN, xb))
    fail(at, `${pa.id} 를 끌어서는 ${pb.id} 에 닿을 수 없음(끄는 간격)`);
  return { approach: [pa.id, pb.id], within, ...(hint ? { hint } : {}) };
}

// ---- 판정 ----

/** 목표가 바라보는 끄는 점·슬라이더 */
function movers(p: CoordParams, g: NewGoal): { points: string[]; sliders: string[] } {
  if (g.kind === 'place') return { points: [g.point], sliders: [] };
  const a = readoutMovers(p, g.of);
  if (g.kind === 'value' && 'of' in g.is) {
    const b = readoutMovers(p, g.is.of);
    return {
      points: [...new Set([...a.points, ...b.points])],
      sliders: [...new Set([...a.sliders, ...b.sliders])],
    };
  }
  return a;
}

/** 자리 열쇠(여러 자리 목표에서 같은 자리를 두 번 세지 않게) */
function placeKey(p: CoordParams, s: CoordState, g: NewGoal): string {
  const m = movers(p, g);
  const pts = m.points.map((id) => {
    const q = s.pts[id] ?? { i: pointOf(p, id).i, j: pointOf(p, id).j };
    return `${id}:${q.i},${q.j}`;
  });
  return [...pts, ...m.sliders.map((id) => `${id}=${s.vars[id]}`)].join(' ');
}

/**
 * 손을 뗀 상태 하나에서 닿은 목표 열쇠들. 여러 곳 가 보기는 곳 번호, 여러 자리 값 맞추기는 그 자리, 나머지는 '0'.
 * '얼마나 가까운가'는 내지 않는다(원칙 P3 — 숨긴 정답에 가까워짐 신호 금지).
 */
export function goalHits(p: CoordParams, s: CoordState): string[] {
  const g = p.goal;
  if (!g) return [];
  if (!isNew(g)) {
    const [a, b] = g.approach;
    return Math.abs(pointXY(p, s, a)[0] - pointXY(p, s, b)[0]) <= g.within + 1e-12 ? ['0'] : [];
  }
  if (g.kind === 'place') {
    const q = s.pts[g.point] ?? { i: pointOf(p, g.point).i, j: pointOf(p, g.point).j };
    return q.i === g.i && (g.j === undefined || q.j === g.j) ? ['0'] : [];
  }
  const v = readoutVal(p, s, g.of);
  if (g.kind === 'visit')
    return g.at.flatMap((t, k) => (sameVal(v, t, g.tol.n) ? [String(k)] : []));
  const t: Val = 'num' in g.is ? g.is.num : readoutVal(p, s, g.is.of);
  if (!sameVal(v, t, g.tol.n)) return [];
  return [g.places > 1 ? placeKey(p, s, g) : '0'];
}

/** 목표를 이뤘나(모을 것이 하나인 목표에서). 옛 테스트·탐색 목표용 */
export const goalMet = (p: CoordParams, s: CoordState) => goalHits(p, s).length > 0;

/** 모아야 할 열쇠 수(진행 표시의 분모) */
export function goalNeed(p: CoordParams): number {
  const g = p.goal;
  if (!isNew(g)) return 1;
  if (g.kind === 'visit') return g.at.length;
  if (g.kind === 'value') return g.places;
  return 1;
}

// ---- 닿는 상태 늘어놓기(형식 검사·검산) ----

interface Enumerated {
  states: CoordState[];
  syms: Record<string, string>[];
}

function enumerate(p: CoordParams, g: NewGoal): Enumerated {
  const m = movers(p, g);
  let acc: { s: CoordState; sym: Record<string, string> }[] = [{ s: initial(p), sym: {} }];
  for (const id of m.sliders) {
    const sl = p.sliders.find((x) => x.id === id);
    if (!sl) continue;
    acc = growStates(
      acc,
      sliderValues(sl).map(({ k, v }) => ({
        patch: (s: CoordState) => ({ ...s, vars: { ...s.vars, [id]: v } }),
        sym: { [id]: sliderSym(sl, k) },
      })),
      '좌표 goal',
    );
  }
  for (const id of m.points) {
    const o = pointOf(p, id);
    const [i0, i1] = iRange(p.x.lo, p.x.hi, o.on ? o.snapN : p.x.st) as [number, number];
    const [j0, j1] = o.on ? [0, 0] : (iRange(p.y.lo, p.y.hi, p.y.st) as [number, number]);
    const opts: { patch: (s: CoordState) => CoordState; sym: Record<string, string> }[] = [];
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++)
        opts.push({
          patch: (s) => ({ ...s, pts: { ...s.pts, [id]: { i, j } } }),
          sym: pointState(p, id, i, j),
        });
    acc = growStates(acc, opts, '좌표 goal');
  }
  return { states: acc.map((a) => a.s), syms: acc.map((a) => a.sym) };
}

const table = (p: CoordParams, g: NewGoal, states: CoordState[]) =>
  hitTable(states, (s) => goalHits(p, s), g.kind === 'visit' ? g.at.length : null);

/** 형식 검사: 목표마다 끌기·슬라이더로 닿을 수 있는가(공통 규칙은 goal.ts checkHitTable) */
export function checkReachable(p: CoordParams): void {
  const g = p.goal;
  if (!isNew(g)) return;
  checkNotAtStart(goalHits(p, initial(p)), goalNeed(p), '좌표 goal');
  checkHitTable(
    table(p, g, enumerate(p, g).states),
    g.kind === 'value' ? g.places : 1,
    g.tol,
    '좌표 goal',
    (k) => (g.kind === 'visit' ? `가 볼 곳 ${g.at[k]?.src}` : '목표'),
  );
}

/** 값이 정수·분수면 fraction, 아니면 expr 로 대조 */
const answerOf = (v: string) => {
  const r = exactOf(v);
  return r
    ? { answer: r[1] === 1n ? `${r[0]}` : `${r[0]}/${r[1]}`, answerType: 'fraction' }
    : { answer: v, answerType: 'expr' };
};

/** 목표 검산 항목: 점 자리 목표의 답(검산식) + 모든 상태의 판정 */
export function goalChecks(p: CoordParams, out: WidgetCheck[]): void {
  const g = p.goal;
  if (!isNew(g)) return;
  const { states, syms } = enumerate(p, g);
  let of: { expr: string; roots?: true }[];
  let targets: string[][];
  if (g.kind === 'place') {
    const tx = g.x as { value: string; check: string };
    out.push({ name: '목표 점 x', ...answerOf(tx.value), check: tx.check });
    of = [{ expr: xSym(p, g.point) }];
    targets = [[tx.value]];
    if (g.y) {
      out.push({ name: '목표 점 y', ...answerOf(g.y.value), check: g.y.check });
      of.push({ expr: ySym(p, g.point) });
      (targets[0] as string[]).push(g.y.value);
    }
  } else {
    of = [readoutSym(p, g.of)];
    targets =
      g.kind === 'visit'
        ? g.at.map((t) => [t.src])
        : [['num' in g.is ? g.is.num.src : readoutSym(p, g.is.of).expr]];
  }
  out.push({
    name: '목표 판정',
    kind: 'goal',
    of,
    targets,
    tol: g.tol.src,
    states: syms,
    hits: table(p, g, states),
    need: g.kind === 'value' ? g.places : 1,
  });
}

/** 목표 글(문구 검사) */
export const goalTexts = (p: CoordParams): string[] => (p.goal?.hint ? [p.goal.hint] : []);
