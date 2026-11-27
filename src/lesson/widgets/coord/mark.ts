// 표시 객체: 세로선 {vline}(요청 77·131)·직각 표시 {right}(요청 56)·계단 표시 {stair}(요청 64). 셋 다 값을 읽거나 끄는
// 것이 아니라 그림 위의 표시라, 끄는 동안에는 같은 key 의 항목 값만 바뀐다(세로선 v<순번> 의 x·숨김, 직각 q<순번> 의 경로
// 글자 — 안 보이면 빈 경로, 계단 z<순번> 의 경로·꺾쇠 zq·길이 글자 zx·zy).
//
// 세로선: 곡선으로는 x 가 하나인 선을 그릴 수 없고, 선분으로 그리면 끝을 화면 끝 좌표로 적어야 해 점근선 점선도, 점을
// 따라 움직이는 세로줄(math2-indefinite 'P 와 같은 세로줄')도 안 됐다. 자리는 따라오는 좌표 식(follow.ts)과 같은 꼴.
// 직각 표시: 꼭짓점에서 두 변을 따라 작은 꺾쇠. 정말 직각일 때만 그린다 — 끄는 점이면 직각이 된 순간에만 나타난다.
// 그래서 목표가 움직이는 점·슬라이더에 기대면 꺾쇠가 정답 자리를 알려 주는 신호가 되므로(P3) 형식 오류로 막는다
// (checkRightGoal) — 목표 없는 탐색에서 '직각이 되는 곳'을 보이는 데만 쓴다. 화면에서 직각으로 보일 때만이기도 하다:
// 축척 같게(equal)면 세계의 직각 그대로, 아니면 두 변이 가로·세로일 때만(비스듬한 직각은 비뚤어 보여 꺾쇠가 틀린 말을 함).
import { evalNum } from '../../expr.ts';
import { GOAL_MAX_STATES } from '../../goal.ts';
import { arr, fail, int, obj, oneOf, str } from '../../parse.ts';
import { neg, ratStr, sub } from '../q.ts';
import { near } from './common.ts';
import { isConst, parseFollow } from './follow.ts';
import { fmtNum, labelWidth, narrowFrame, r1, toPx } from './frame.ts';
import {
  type Deps,
  depStates,
  exprDeps,
  exprNum,
  followNow,
  followSymOf,
  lookOf,
  pointDeps,
  pointNum,
  pointOf,
  pointQ,
  pointXY,
  xSym,
  ySym,
} from './point.ts';
import { withUnit } from './readout.ts';
import { endAt, endSliders, endText, endXY, lookIn, parseEnd, slidersIn } from './segment.ts';
import { sliderCombos } from './slider.ts';
import { inexactQ, symText } from './stat.ts';
import {
  type Box4,
  type CoordParams,
  type CoordState,
  type Frame,
  type KindDef,
  type ParseCtx,
  type RightObj,
  type SegEnd,
  type StairObj,
  TONES,
  type VlineObj,
} from './types.ts';

// ---- 세로선 ----

/**
 * 세로선 형식 검사: 수 자리는 화면 안이고 테두리(x 축 끝)와 겹치지 않아야(겹치면 테두리에 묻혀 안 보임), 슬라이더 식
 * 자리는 닿는 모든 칸에서 화면 안(끝은 지나가는 자리라 괜찮다). 끄는 점을 따라오면 자리가 손에 달려 그리기에서 숨긴다
 */
function checkVline(o: VlineObj, at: string, cx: ParseCtx): void {
  const { lo, hi } = cx.x;
  const out = (v: number) => !Number.isFinite(v) || v < lo - 1e-9 || v > hi + 1e-9;
  if (isConst(o.at)) {
    const v = evalNum(o.at.node, {});
    if (out(v)) fail(at, `화면 밖 x=${v} (x 는 ${cx.x.min}~${cx.x.max})`);
    if (near(v, lo) || near(v, hi)) fail(at, `화면 끝 x=${v} — 테두리와 겹쳐 안 보임`);
    return;
  }
  const lk = lookIn(cx);
  const d = exprDeps(lk, o.at);
  if (d.pts.size > 0) return;
  const ids = cx.sliders.map((sl) => sl.id).filter((id) => d.sliders.has(id));
  for (const cb of sliderCombos(cx.sliders, ids, at)) {
    const v = exprNum(lk, o.at, { ...cx.env0, ...cb.num }) ?? Number.NaN;
    if (out(v))
      fail(at, `화면 밖 x=${v}${cb.text ? ` — ${cb.text}` : ''} (닿는 칸마다 그림 안이어야 함)`);
  }
}

/** 같은 세로선 두 번(형식 검사 parse.ts): 수 자리는 값으로('1' 과 '2/2'), 식 자리는 원문으로 견준다 */
export const vlineKey = (o: VlineObj) =>
  isConst(o.at) ? `n${Number(evalNum(o.at.node, {}).toPrecision(12))}` : `s${o.at.src}`;

export const vlineKind: KindDef<VlineObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['vline'], ['tone', 'dash', 'label']);
    if (c.dash !== undefined && c.dash !== true) fail(`${at} dash`, 'true 만');
    const o: VlineObj = {
      kind: 'vline',
      at: parseFollow(c.vline, `${at} vline`, cx),
      tone: c.tone === undefined ? 'main' : oneOf(c.tone, `${at} tone`, TONES),
      ...(c.dash === true ? { dash: true as const } : {}),
      ...(c.label !== undefined ? { label: str(c.label, `${at} label`) } : {}),
    };
    checkVline(o, at, cx);
    return o;
  },
  draw(o, k, { p, s, f, items }) {
    const x = followNow(p, s, o.at);
    const show = Number.isFinite(x) && x >= p.x.lo - 1e-9 && x <= p.x.hi + 1e-9;
    const X = show ? r1(toPx(p, f, x, 0)[0]) : 0;
    items.push({
      t: 'line',
      key: `v${k}`,
      x1: X,
      y1: r1(f.t),
      x2: X,
      y2: r1(f.b),
      cls: `vline ${o.tone}${o.dash ? ' dash' : ''}`,
      hidden: !show,
    });
  },
  checks(o, { p, out }) {
    if (isConst(o.at)) return;
    // 자리 식을 움직이는 것(슬라이더 칸 × 가리키는 끄는 점 칸)마다 앱 = sympy — 따라오는 점의 자리 검산과 같은 길
    const st = depStates(p, exprDeps(lookOf(p), o.at));
    out.push({
      name: `세로선 x=${o.at.src}`,
      kind: 'parity',
      expr: followSymOf(p, o.at),
      points: st.map((q) => q.sym),
      values: st.map((q) => {
        const v = followNow(p, q.s, o.at);
        return Number.isFinite(v) ? v : null;
      }),
    });
  },
  texts: (o) => (o.label ? [o.label] : []),
};

// ---- 직각 표시 ----

/** 꺾쇠 한 변의 길이(px). 점(지름 10)보다 크고 이름표(13px)보다 작게 — 점에 묻히지도, 이름표를 덮지도 않게 */
const RIGHT_PX = 9;
/**
 * 가장 좁은 화면에서 직각 표시의 두 변이 이보다 짧으면 형식 오류(px): 꺾쇠(9px)가 변을 거의 다 덮어 '두 선이 만나는
 * 각'이 아니라 점 옆 네모로 보인다. 끄는 점이면 길이가 손에 달려 있어 그리기에서 꺾쇠를 줄인다
 */
const MIN_RAY_PX = 14;

type V2 = [number, number];
const sub2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const dot2 = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const len2 = (a: V2) => Math.hypot(a[0], a[1]);
/** 두 변이 수직인가(길이에 비례한 너그러움 — 부동소수 찌꺼기만큼) */
const perp = (u: V2, v: V2, tol: number) => Math.abs(dot2(u, v)) <= tol * len2(u) * len2(v);

/** 길이에 비해 0 인가(부동소수 찌꺼기만큼 너그럽게) */
const flat = (c: number, u: V2) => Math.abs(c) <= 1e-9 * len2(u);

/**
 * 세계 좌표의 세 끝 → 그릴 꺾쇠 경로(안 보이면 ''). 보이는 때는 규칙으로 정한다(화면 px 로 재지 않음 — 축척이 다른
 * 그림이 어느 상자 크기에서 우연히 정사각형이 되면 비스듬한 직각이 그 화면에서만 보였다):
 *   축척 같게면 세계에서 직각일 때, 아니면 두 변이 하나는 가로·하나는 세로일 때(어느 축척에서도 직각)
 */
function rightPath(
  pa: V2,
  po: V2,
  pb: V2,
  equal: boolean,
  px: (q: V2) => V2,
  minLen = 0,
): { d: string; world: boolean; shown: boolean; short: boolean } {
  const u = sub2(pa, po);
  const v = sub2(pb, po);
  const none = { d: '', world: false, shown: false, short: false };
  if (![...u, ...v].every(Number.isFinite) || len2(u) === 0 || len2(v) === 0) return none;
  if (!perp(u, v, 1e-9)) return none;
  const axes = (flat(u[0], u) && flat(v[1], v)) || (flat(u[1], u) && flat(v[0], v));
  if (!equal && !axes) return { ...none, world: true };
  const O = px(po);
  const U = sub2(px(pa), O);
  const V = sub2(px(pb), O);
  const L = Math.min(len2(U), len2(V));
  const s = Math.min(RIGHT_PX, L * 0.4);
  const a: V2 = [O[0] + (U[0] / len2(U)) * s, O[1] + (U[1] / len2(U)) * s];
  const b: V2 = [O[0] + (V[0] / len2(V)) * s, O[1] + (V[1] / len2(V)) * s];
  const c: V2 = [a[0] + b[0] - O[0], a[1] + b[1] - O[1]];
  return {
    d: `M${r1(a[0])} ${r1(a[1])}L${r1(c[0])} ${r1(c[1])}L${r1(b[0])} ${r1(b[1])}`,
    world: true,
    shown: true,
    short: L < minLen,
  };
}
/**
 * 직각 표시 형식 검사(끝이 다 셀 수 있을 때 — 끄는 점에 기대면 손에 달려 건너뜀): 끝이 쓰는 슬라이더의 칸마다 보고,
 * 한 칸에서도 세계에서 직각이 아니면 오류(늘 안 보이는 표시), 직각인데 화면에서 비뚤어 한 번도 안 보이면 equal 을 권하는
 * 오류, 보이는 칸에서 가장 좁은 화면의 변이 MIN_RAY_PX 보다 짧으면 오류
 */
function checkRight(o: RightObj, at: string, cx: ParseCtx): void {
  const ends = [o.a, o.o, o.b];
  const ids = [...new Set(ends.flatMap((e) => endSliders(e, cx)))];
  const f = narrowFrame(cx);
  const sx = (f.r - f.l) / (cx.x.hi - cx.x.lo);
  const sy = (f.b - f.t) / (cx.y.hi - cx.y.lo);
  const px = (q: V2): V2 => [q[0] * sx, -q[1] * sy];
  let world = 0;
  let shown = 0;
  for (const cb of sliderCombos(cx.sliders, ids, at)) {
    const qs = ends.map((e) => endAt(e, cx, { ...cx.env0, ...cb.num }));
    if (qs.some((q) => q === null)) return;
    const [pa, po, pb] = qs as V2[];
    const r = rightPath(pa as V2, po as V2, pb as V2, cx.equal, px, MIN_RAY_PX);
    if (r.world) world++;
    if (!r.shown) continue;
    shown++;
    if (r.short)
      fail(
        at,
        `가장 좁은 화면에서 직각 표시의 변이 ${MIN_RAY_PX}px 보다 짧음${cb.text ? ` (${cb.text})` : ''} — 꺾쇠가 변을 덮음`,
      );
  }
  if (world === 0)
    fail(
      at,
      ids.length
        ? `어느 슬라이더 칸에서도 직각이 아님 (${o.ref}) — 늘 안 보이는 표시`
        : `직각이 아님 (${o.ref}) — 직각일 때만 그리므로 늘 안 보임`,
    );
  if (shown === 0)
    fail(
      at,
      `축척 같게가 아니라 비스듬한 직각은 화면에서 비뚤어 보여 그리지 않음 (${o.ref}) — 좌표에 equal: true 를(가로·세로 변의 직각만 축척과 상관없이 그림)`,
    );
}

/** 끝 하나를 움직이는 것: 좌표 식의 슬라이더, 점이면 그 점을 움직이는 것 */
function endDeps(p: CoordParams, e: SegEnd, out: Deps): void {
  if ('pt' in e) {
    pointDeps(lookOf(p), e.pt, out);
    return;
  }
  for (const v of [...slidersIn(e.nx, p), ...slidersIn(e.ny, p)]) out.sliders.add(v);
}
const endSym = (p: CoordParams, e: SegEnd, ax: 'x' | 'y') =>
  'pt' in e ? (ax === 'x' ? xSym(p, e.pt) : ySym(p, e.pt)) : ax === 'x' ? e.x : e.y;

export const rightKind: KindDef<RightObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['right']);
    const [ra, rv, rb] = arr(c.right, `${at} right`, 3, 3);
    const a = parseEnd(ra, `${at} right1`, cx);
    const v = parseEnd(rv, `${at} right2`, cx);
    const b = parseEnd(rb, `${at} right3`, cx);
    const o: RightObj = {
      kind: 'right',
      a,
      o: v,
      b,
      ref: `${endText(a)}-${endText(v)}-${endText(b)}`,
    };
    checkRight(o, at, cx);
    return o;
  },
  draw(o, k, { p, s, f, items }) {
    const [pa, po, pb] = [o.a, o.o, o.b].map((e) => endXY(p, s, e)) as [V2, V2, V2];
    const r = rightPath(pa, po, pb, !!p.equal, (q) => toPx(p, f, q[0], q[1]));
    items.push({ t: 'path', key: `q${k}`, d: r.d, cls: 'rmark' });
  },
  checks(o, { p, out }) {
    // 두 항목으로 앱의 '보임' 판정을 sympy 가 따로 확인한다:
    //  내적 — 꺾쇠가 보이는 상태마다 두 변의 내적 = 0 (앱 값이 아니라 0 을 넘긴다 — 앱 내적값을 넘기면 앱이 직각이 아닌
    //         상태에 꺾쇠를 그려도 '앱 값 = sympy 값'으로 통과한다)
    //  보임 — 늘어놓은 모든 상태에서 앱의 보임(1·0) = sympy 가 규칙(직각이고, 축척 같게가 아니면 가로·세로 변)으로 낸 값.
    //         직각인데 앱이 안 그린 상태(놓침)도 잡는다
    const deps: Deps = { pts: new Set(), sliders: new Set() };
    for (const e of [o.a, o.o, o.b]) endDeps(p, e, deps);
    const f = narrowFrame(p);
    const st = depStates(p, deps).flatMap((q) => {
      const ends = [o.a, o.o, o.b].map((e) => endXY(p, q.s, e)) as [V2, V2, V2];
      if (!ends.flat().every(Number.isFinite)) return [];
      const shown = rightPath(...ends, !!p.equal, (w) => toPx(p, f, w[0], w[1])).shown;
      return [{ sym: q.sym, shown }];
    });
    if (st.length === 0) return;
    const d = (ax: 'x' | 'y', e: SegEnd) => `((${endSym(p, e, ax)})-(${endSym(p, o.o, ax)}))`;
    const [ux, uy, vx, vy] = [d('x', o.a), d('y', o.a), d('x', o.b), d('y', o.b)];
    const dot = `${ux}*${vx}+${uy}*${vy}`;
    const seen = st.filter((q) => q.shown);
    if (seen.length > 0)
      out.push({
        name: `직각 ${o.ref} 내적`,
        kind: 'parity',
        expr: dot,
        points: seen.map((q) => q.sym),
        values: seen.map(() => 0),
      });
    const long = `Ne(${ux}**2+${uy}**2,0),Ne(${vx}**2+${vy}**2,0)`;
    const rule = p.equal
      ? `And(Eq(${dot},0),${long})`
      : `And(Or(And(Eq(${ux},0),Eq(${vy},0)),And(Eq(${uy},0),Eq(${vx},0))),${long})`;
    out.push({
      name: `직각 ${o.ref} 보임`,
      kind: 'parity',
      expr: `Piecewise((1,${rule}),(0,True))`,
      points: st.map((q) => q.sym),
      values: st.map((q) => (q.shown ? 1 : 0)),
    });
  },
};

/** 같은 직각 표시 두 번(parse.ts): 꼭짓점과 두 끝(차례 상관없이 정렬)을 글자로 견준다 */
export const rightKey = (o: RightObj) =>
  `${endText(o.o)}|${[endText(o.a), endText(o.b)].sort().join(',')}`;

/**
 * 목표가 움직이는 점·슬라이더에 기대는 직각 표시는 형식 오류(P3): 직각일 때만 나타나는 꺾쇠가 끄는 도중 '여기가 정답'
 * 신호가 된다. 목표 판정이 늘어놓는 것(movers)과 꺾쇠를 움직이는 것이 겹치면 막는다
 */
export function checkRightGoal(p: CoordParams, movers: { points: string[]; sliders: string[] }) {
  for (const o of p.objects) {
    if (o.kind !== 'right') continue;
    const deps: Deps = { pts: new Set(), sliders: new Set() };
    for (const e of [o.a, o.o, o.b]) endDeps(p, e, deps);
    const hit = [
      ...movers.points.filter((id) => deps.pts.has(id)),
      ...movers.sliders.filter((id) => deps.sliders.has(id)),
    ];
    if (hit.length)
      fail(
        '좌표 objects',
        `목표가 움직이는 ${hit.join('·')} 에 기대는 직각 표시 (${o.ref}) — 직각일 때만 나타나는 꺾쇠가 정답 자리를 알려 줌(P3). 목표가 있는 장면에서는 고정된 직각에만`,
      );
  }
}

// ---- 계단 표시 ----
// 할선 기울기(Δy/Δx)를 그림에서 읽게: 가로 변(P → Q 의 x)과 세로 변(그 끝 → Q)을 긋고 변마다 길이를 적는다. 길이는 부호를
// 뗀 |Δx|·|Δy|(변의 길이라 음수가 없다 — 부호는 변이 아래로 가는지로 보인다). 두 변은 늘 가로·세로라 꺾인 곳은 어느 축척에서도
// 직각이고, 직각 표시와 같은 꺾쇠(rightPath)를 그린다. 계단의 두 끝은 점만 — 끄는 점·따라오는 점이 정하는 자리라, 끝이 그림
// 밖이면(따라오는 점이 숨거나 곡선 위 끄는 점이 위아래로 나감) 계단을 통째로 숨긴다(그림 안 글자만 홀로 뜨지 않게).
// 길이 글자는 점 이름표 자리(labels.ts — 그대로)를 다 고른 뒤, 이름표·점·손잡이·다른 계단 글자를 피해 변의 바깥쪽 → 안쪽 →
// 한 칸씩 더 먼 자리 차례로 놓는다(그릴 목록 key 는 그대로 — 자리만 나중에 채운다).

/** 길이 글자(.zlen 11px 굵게) 상자: 기준선 위 10 · 아래 3. 폭은 축 끝 글자와 같은 어림(frame.ts labelWidth) */
const ZLEN = { up: 10, down: 3 };
/** 변과 글자 사이 틈 — 점(반지름 6)보다 넓게 */
const ZLEN_GAP = 7;
/** 끝이 끄는 점이면 세로 글자를 손잡이(보이는 점 반지름 10)만큼 띄운다 */
const HANDLE_DOT_R = 10;
/** 점 상자 반지름(이름표 자리 고르기와 같은 값) */
const DOT_R = 6;
/** 첫 자리가 막히면 이만큼씩 더 떨어진 자리(세 번) */
const ZLEN_STEP = 10;

const hitBox = (a: Box4, b: Box4) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const around = (x: number, y: number, r: number): Box4 => ({
  l: x - r,
  t: y - r,
  r: x + r,
  b: y + r,
});
/** 길이 글자 상자(왼쪽 x · 기준선 y) */
export const zlenBox = (x: number, y: number, text: string): Box4 => ({
  l: x,
  t: y - ZLEN.up,
  r: x + labelWidth(text),
  b: y + ZLEN.down,
});

/** 두 점이 겹치는가(가로 변 0) — 부동소수 찌꺼기만큼 너그럽게 */
const zero = (d: number, ref: number) => Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(ref));

/** 계단의 두 변 길이(부호 뗌) 계산에 쓰는 좌표와, 가로 변·세로 변이 있는가. 정의 안 되면 h=false */
function stairLens(p: CoordParams, s: CoordState, o: StairObj) {
  const [xa, ya] = pointXY(p, s, o.a);
  const [xb, yb] = pointXY(p, s, o.b);
  const fin = [xa, ya, xb, yb].every(Number.isFinite);
  const h = fin && !zero(xb - xa, xa);
  return { xa, ya, xb, yb, h, v: h && !zero(yb - ya, ya) };
}
/** 끝이 둘 다 그림 안인가(px — 테두리 반 px 너그럽게) */
const inFrame = (f: Frame, q: V2) =>
  q[0] >= f.l - 0.5 && q[0] <= f.r + 0.5 && q[1] >= f.t - 0.5 && q[1] <= f.b + 0.5;
/** 계단이 보이는가: 가로 변이 있고 두 끝이 그림 안 */
function stairShows(p: CoordParams, s: CoordState, o: StairObj, f: Frame): boolean {
  const L = stairLens(p, s, o);
  return L.h && inFrame(f, toPx(p, f, L.xa, L.ya)) && inFrame(f, toPx(p, f, L.xb, L.yb));
}

export const stairDeps = (p: CoordParams, o: StairObj): Deps => {
  const lk = lookOf(p);
  return pointDeps(lk, o.b, pointDeps(lk, o.a));
};

/** 같은 계단 두 번(parse.ts): 두 점(차례 상관없이) */
export const stairKey = (o: StairObj) => [o.a, o.b].sort().join('|');

/**
 * 길이 글자 하나의 자리 후보(그림 안으로 당긴 왼쪽 x·기준선 y). 차례는 변 바깥쪽 틈 → 안쪽 틈 → 한 칸씩 더 먼 틈, 그다음
 * 변을 따라 조금씩 민 자리(slides — 끄는 점이 다른 점에 바짝 붙어 변이 짧으면 변 옆이 이름표·손잡이로 꽉 찬다)
 */
function zlenCands(
  text: string,
  at: (off: number, side: 1 | -1, slide: number) => [number, number],
  pref: 1 | -1,
  gap: number,
  slides: number[],
  f: Frame,
): [number, number][] {
  const w = labelWidth(text);
  const fit = ([x, y]: [number, number]): [number, number] => [
    r1(Math.max(f.l + 1, Math.min(f.r - 1 - w, x))),
    r1(Math.max(f.t + ZLEN.up + 1, Math.min(f.b - ZLEN.down - 1, y))),
  ];
  const all: [number, number][] = [];
  for (const slide of slides)
    for (const off of [0, 1, 2, 3].map((n) => gap + n * ZLEN_STEP))
      for (const side of [pref, -pref as 1 | -1]) all.push(fit(at(off, side, slide)));
  return all;
}

/**
 * 두 길이 글자를 함께 놓는다: 가로 글자 후보를 차례로 보며, 피할 것(이름표·점·손잡이·앞서 놓은 길이 글자)과 안 겹치고
 * 세로 글자도 비는 자리가 남는 첫 짝. 가로 글자만 먼저 고르면 세로 글자 자리를 막는 일이 있다(Q 가 P 왼쪽 아래 구석).
 * 짝이 없으면 따로따로 첫 빈자리, 그것도 없으면 첫 후보(무거운 검사 checkStairs 가 겹침을 오류로 잡는다)
 */
function placePair(
  hs: [number, number][],
  ht: string,
  vs: [number, number][] | null,
  vt: string,
  avoid: Box4[],
): { h: [number, number]; v: [number, number] | null } {
  const free = (c: [number, number], t: string, more: Box4[] = []) =>
    ![...avoid, ...more].some((b) => hitBox(zlenBox(c[0], c[1], t), b));
  const first = <T>(xs: T[]) => xs[0] as T;
  if (!vs) return { h: hs.find((c) => free(c, ht)) ?? first(hs), v: null };
  for (const h of hs) {
    if (!free(h, ht)) continue;
    const v = vs.find((c) => free(c, vt, [zlenBox(h[0], h[1], ht)]));
    if (v) return { h, v };
  }
  const h = hs.find((c) => free(c, ht)) ?? first(hs);
  return { h, v: vs.find((c) => free(c, vt, [zlenBox(h[0], h[1], ht)])) ?? first(vs) };
}

/** 글자 한 줄 높이만큼 — 변을 따라 밀어 볼 거리 */
const ZLEN_ROW = ZLEN.up + ZLEN.down + 1;

export const stairKind: KindDef<StairObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['stair'], ['digits']);
    const [ra, rb] = arr(c.stair, `${at} stair`, 2, 2);
    const a = cx.pointRef(ra, `${at} stair1`).id;
    const b = cx.pointRef(rb, `${at} stair2`).id;
    if (a === b) fail(`${at} stair`, `같은 점 두 번 (${a}) — 계단은 두 점 사이`);
    const o: StairObj = {
      kind: 'stair',
      a,
      b,
      digits: c.digits === undefined ? 2 : int(c.digits, `${at} digits`, 0, 4),
    };
    // 늘 안 보이는 계단: 두 점이 끄는 점에 기대지 않으면 슬라이더 칸마다 셀 수 있다 — 어느 칸에서도 x 가 같으면 오류.
    // 끄는 점에 기대면 무거운 검사(checkShown)가 닿는 상태로 본다
    const lk = lookIn(cx);
    const d = pointDeps(lk, b, pointDeps(lk, a));
    if (d.pts.size === 0) {
      const ids = cx.sliders.map((sl) => sl.id).filter((id) => d.sliders.has(id));
      const seen = sliderCombos(cx.sliders, ids, at).some((cb) => {
        const env = { ...cx.env0, ...cb.num };
        const [pa, pb] = [pointNum(lk, a, env), pointNum(lk, b, env)];
        return !!pa && !!pb && Number.isFinite(pa[0] - pb[0]) && !zero(pb[0] - pa[0], pa[0]);
      });
      if (!seen)
        fail(
          at,
          `가로 변이 늘 0 (${a}·${b} 의 x 가 같음) — 계단이 그려지지 않음(세로 선분이면 segment 로)`,
        );
    }
    return o;
  },
  draw(o, k, { p, s, f, items, spots, handles, later }) {
    const L = stairLens(p, s, o);
    const px = (x: number, y: number) => toPx(p, f, x, y);
    const show = stairShows(p, s, o, f);
    const v = show && L.v;
    const O: V2 = [0, 0];
    const [A, C, B]: [V2, V2, V2] = show
      ? [px(L.xa, L.ya), px(L.xb, L.ya), px(L.xb, L.yb)]
      : [O, O, O];
    const pt = (q: V2) => `${r1(q[0])} ${r1(q[1])}`;
    items.push({
      t: 'path',
      key: `z${k}`,
      d: show ? `M${pt(A)}L${pt(C)}${v ? `L${pt(B)}` : ''}` : '',
      cls: 'stair',
    });
    // 꺾인 곳의 꺾쇠 — 세로 변이 있을 때만(직각 표시와 같은 그리기: 가로·세로 두 변이라 늘 보이는 규칙)
    items.push({
      t: 'path',
      key: `zq${k}`,
      d: v
        ? rightPath([L.xa, L.ya], [L.xb, L.ya], [L.xb, L.yb], !!p.equal, (q) => px(q[0], q[1])).d
        : '',
      cls: 'rmark',
    });
    const tx = show ? withUnit(fmtNum(Math.abs(L.xb - L.xa), o.digits), p.x.unit) : '';
    const ty = v ? withUnit(fmtNum(Math.abs(L.yb - L.ya), o.digits), p.y.unit) : '';
    const zx = {
      t: 'label' as const,
      key: `zx${k}`,
      x: 0,
      y: 0,
      text: tx,
      hidden: !show,
      cls: 'zlen',
    };
    const zy = {
      t: 'label' as const,
      key: `zy${k}`,
      x: 0,
      y: 0,
      text: ty,
      hidden: !v,
      cls: 'zlen',
    };
    items.push(zx, zy);
    if (!show) return;
    // 자리는 점 이름표를 다 놓은 뒤에 고른다(draw.ts) — 이름표·점·손잡이·앞서 놓은 길이 글자를 피해서
    later.push((placed) => {
      const avoid: Box4[] = [
        ...placed,
        ...spots.map((q) => around(q.x, q.y, DOT_R)),
        ...handles.map((h) => around(h.x, h.y, HANDLE_DOT_R)),
      ];
      // 가로 글자: 가운데 맞춤, Q 가 위면 변 아래(바깥쪽)부터. 가로로 글자 반 폭·한 폭씩 밀어 본다
      const wx = labelWidth(tx);
      const midX = (A[0] + C[0]) / 2 - wx / 2;
      const hs = zlenCands(
        tx,
        (off, side, sl) => [midX + sl, side > 0 ? A[1] + off + ZLEN.up : A[1] - off - ZLEN.down],
        B[1] < A[1] ? 1 : -1,
        ZLEN_GAP,
        [0, -wx / 2, wx / 2, -wx, wx],
        f,
      );
      // 세로 글자: 세로 변 가운데 높이, P 반대쪽 옆부터. 끝이 끄는 점이면 손잡이만큼 띄운다. 위아래로 한 줄씩 세 줄까지 밀어 본다
      const wy = labelWidth(ty);
      const drag = [o.a, o.b].some((id) => pointOf(p, id).drag !== 'none');
      const midY = (C[1] + B[1]) / 2 + (ZLEN.up - ZLEN.down) / 2;
      const vs = v
        ? zlenCands(
            ty,
            (off, side, sl) => [side > 0 ? C[0] + off : C[0] - off - wy, midY + sl],
            B[0] > A[0] ? 1 : -1,
            drag ? HANDLE_DOT_R + 1 : ZLEN_GAP,
            [0, -1, 1, -2, 2, -3, 3].map((n) => n * ZLEN_ROW),
            f,
          )
        : null;
      const pick = placePair(hs, tx, vs, ty, avoid);
      [zx.x, zx.y] = pick.h;
      const out = [zlenBox(zx.x, zx.y, tx)];
      if (pick.v) {
        [zy.x, zy.y] = pick.v;
        out.push(zlenBox(zy.x, zy.y, ty));
      }
      return out;
    });
  },
  checks(o, { p, out }) {
    // 닿는 상태마다 앱의 두 길이 = sympy 가 두 점의 원문 좌표 식(곡선 위 점은 곡선 식에 x 를 넣은 것)으로 따로 낸 Abs(차) —
    // 앱이 구한 좌표를 옮겨 적지 않는다(원칙 P7)
    const st = depStates(p, stairDeps(p, o));
    const val = (ax: 0 | 1) =>
      st.map((q) => {
        const L = stairLens(p, q.s, o);
        const v = ax === 0 ? L.xb - L.xa : L.yb - L.ya;
        return Number.isFinite(v) ? Math.abs(v) : null;
      });
    for (const [ax, what, sym] of [
      [0, '가로', xSym],
      [1, '세로', ySym],
    ] as const)
      out.push({
        name: `계단 ${o.a}-${o.b} ${what}`,
        kind: 'parity',
        expr: `Abs((${sym(p, o.b)})-(${sym(p, o.a)}))`,
        points: st.map((q) => q.sym),
        values: val(ax),
      });
  },
};

/**
 * 무거운 형식 검사: 닿는 상태(2000 넘으면 고르게 덜어 냄)마다 두 길이가 digits 자리로 정확히 적히는가 — 반올림한 길이로
 * 세로 ÷ 가로 를 셈하면 화면의 기울기와 어긋난다. 무리수 길이(√ 곡선 등)는 분수로 쥘 수 없어 보지 않는다
 */
export function checkStairDigits(p: CoordParams): void {
  for (const o of p.objects) {
    if (o.kind !== 'stair') continue;
    for (const q0 of depStates(p, stairDeps(p, o), GOAL_MAX_STATES)) {
      const [xa, ya] = pointQ(p, q0.s, o.a);
      const [xb, yb] = pointQ(p, q0.s, o.b);
      for (const [what, d0, d1] of [
        ['가로', xa, xb],
        ['세로', ya, yb],
      ] as const) {
        if (!d0 || !d1) continue;
        const d = sub(d1, d0);
        if (inexactQ(d, o.digits))
          fail(
            `좌표 계단 ${o.a}-${o.b}`,
            `${what} 길이 ${ratStr(d[0] < 0n ? neg(d) : d)} 가 소수 ${o.digits}자리로 정확히 안 적힘 (${symText(q0.sym)}) — digits 를 올리세요`,
          );
      }
    }
  }
}

/**
 * 무거운 형식 검사: 끄는 점에 기대는 따라오는 점·세로선·직각 표시가 닿는 상태(끄는 점 칸 × 슬라이더 칸, 2000 상태 넘으면
 * 고르게 덜어 냄) 어디서도 안 보이면 오류 — 늘 숨은 객체는 적은 사람의 실수다. 슬라이더에만 기대는 것은 형식 검사가
 * 이미 칸마다 본다
 */
export function checkShown(p: CoordParams): void {
  const lk = lookOf(p);
  const f = narrowFrame(p);
  const inX = (x: number) => Number.isFinite(x) && x >= p.x.lo - 1e-9 && x <= p.x.hi + 1e-9;
  const inY = (y: number) => Number.isFinite(y) && y >= p.y.lo - 1e-9 && y <= p.y.hi + 1e-9;
  for (const o of p.objects) {
    let deps: Deps;
    let shown: (s: CoordState) => boolean;
    let what: string;
    if (o.kind === 'point' && o.follow) {
      deps = pointDeps(lk, o.id);
      shown = (s) => {
        const [x, y] = pointXY(p, s, o.id);
        return inX(x) && inY(y);
      };
      what = `따라오는 점 ${o.id}`;
    } else if (o.kind === 'vline' && !isConst(o.at)) {
      deps = exprDeps(lk, o.at);
      shown = (s) => inX(followNow(p, s, o.at));
      what = `세로선 x=${o.at.src}`;
    } else if (o.kind === 'right') {
      deps = { pts: new Set(), sliders: new Set() };
      for (const e of [o.a, o.o, o.b]) endDeps(p, e, deps);
      shown = (s) => {
        const ends = [o.a, o.o, o.b].map((e) => endXY(p, s, e)) as [V2, V2, V2];
        return rightPath(...ends, !!p.equal, (w) => toPx(p, f, w[0], w[1])).shown;
      };
      what = `직각 표시 ${o.ref}`;
    } else if (o.kind === 'stair') {
      deps = stairDeps(p, o);
      shown = (s) => stairShows(p, s, o, f);
      what = `계단 ${o.a}-${o.b}`;
    } else continue;
    if (deps.pts.size === 0) continue;
    if (!depStates(p, deps, SHOWN_STATES).some((q) => shown(q.s)))
      fail(
        '좌표',
        `${what}: 끄는 점·슬라이더가 닿는 어느 자리에서도 보이는 상태가 없음 — 늘 숨은 표시(식·자리를 확인)`,
      );
  }
}
/** checkShown 이 늘어놓는 상태 상한(목표 판정 상한과 같은 값) */
const SHOWN_STATES = 2000;
