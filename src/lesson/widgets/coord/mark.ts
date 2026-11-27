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
import { arr, fail, int, obj, oneOf, str } from '../../parse.ts';
import { near } from './common.ts';
import { isConst, parseFollow } from './follow.ts';
import { fmtNum, isWide, narrowFrame, r1, toPx } from './frame.ts';
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
  pointXY,
  xSym,
  ySym,
} from './point.ts';
import { endAt, endSliders, endText, endXY, lookIn, parseEnd, slidersIn } from './segment.ts';
import { sliderCombos } from './slider.ts';
import {
  type CoordParams,
  type CoordState,
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
// 직각이고, 직각 표시와 같은 꺾쇠(rightPath)를 그린다. 계단의 두 끝은 점만 — 끄는 점·따라오는 점이 정하는 자리라 그 점의
// 화면 밖 규칙(따라오는 점 숨김·고정 점 화면 안)을 그대로 받는다.

/** 길이 글자(.zlen 12px 굵게)의 어림 폭: 넓은 글자 12, 그 밖 7px */
const zlenWidth = (t: string) => [...t].reduce((w, ch) => w + (isWide(ch) ? 12 : 7), 0);
/** 글자 기준선에서 글자 윗변까지 */
const ZLEN_ASCENT = 10;
/** 변과 글자 사이 틈 */
const ZLEN_GAP = 5;

/** 두 점이 겹치는가(가로 변 0) — 부동소수 찌꺼기만큼 너그럽게 */
const zero = (d: number, ref: number) => Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(ref));

/** 계단의 두 변 길이(부호 뗌). 정의 안 되면 NaN */
function stairLens(p: CoordParams, s: CoordState, o: StairObj) {
  const [xa, ya] = pointXY(p, s, o.a);
  const [xb, yb] = pointXY(p, s, o.b);
  const fin = [xa, ya, xb, yb].every(Number.isFinite);
  const h = fin && !zero(xb - xa, xa);
  return { xa, ya, xb, yb, h, v: h && !zero(yb - ya, ya) };
}

const stairDeps = (p: CoordParams, o: StairObj): Deps => {
  const lk = lookOf(p);
  return pointDeps(lk, o.b, pointDeps(lk, o.a));
};

/** 길이 글자: 소수 digits 자리와 그 축의 단위 */
const lenText = (v: number, digits: number, unit: string | undefined) =>
  `${fmtNum(Math.abs(v), digits)}${unit ? ` ${unit}` : ''}`;

/** 같은 계단 두 번(parse.ts): 두 점(차례 상관없이) */
export const stairKey = (o: StairObj) => [o.a, o.b].sort().join('|');

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
  draw(o, k, { p, s, f, items }) {
    const L = stairLens(p, s, o);
    const px = (x: number, y: number) => toPx(p, f, x, y);
    const A = L.h ? px(L.xa, L.ya) : [0, 0];
    const C = L.h ? px(L.xb, L.ya) : [0, 0];
    const B = L.h ? px(L.xb, L.yb) : [0, 0];
    const pt = (q: number[]) => `${r1(q[0] as number)} ${r1(q[1] as number)}`;
    items.push({
      t: 'path',
      key: `z${k}`,
      d: L.h ? `M${pt(A)}L${pt(C)}${L.v ? `L${pt(B)}` : ''}` : '',
      cls: 'stair',
    });
    // 꺾인 곳의 꺾쇠 — 세로 변이 있을 때만(직각 표시와 같은 그리기: 가로·세로 두 변이라 늘 보이는 규칙)
    items.push({
      t: 'path',
      key: `zq${k}`,
      d: L.v
        ? rightPath([L.xa, L.ya], [L.xb, L.ya], [L.xb, L.yb], !!p.equal, (q) => px(q[0], q[1])).d
        : '',
      cls: 'rmark',
    });
    // 길이 글자는 변 바깥쪽(가로 글자는 Q 반대쪽 위·아래, 세로 글자는 P 반대쪽 옆)에 두고, 그림 끝을 넘으면 안쪽으로 당긴다 —
    // 그림 영역으로 잘라 내는 층이라 넘으면 글자가 잘린다
    const fit = (x: number, w: number, y: number) => ({
      x: r1(Math.max(f.l + 1, Math.min(f.r - 1 - w, x))),
      y: r1(Math.max(f.t + ZLEN_ASCENT + 1, Math.min(f.b - 2, y))),
    });
    const xu = p.x.unit;
    const yu = p.y.unit;
    const tx = L.h ? lenText(L.xb - L.xa, o.digits, xu) : '';
    const ty = L.v ? lenText(L.yb - L.ya, o.digits, yu) : '';
    const wx = zlenWidth(tx);
    const wy = zlenWidth(ty);
    const up = (B[1] as number) < (A[1] as number);
    const hx = fit(
      ((A[0] as number) + (C[0] as number)) / 2 - wx / 2,
      wx,
      up ? (A[1] as number) + ZLEN_GAP + ZLEN_ASCENT : (A[1] as number) - ZLEN_GAP,
    );
    const right = (B[0] as number) > (A[0] as number);
    const vy = fit(
      right ? (C[0] as number) + ZLEN_GAP : (C[0] as number) - ZLEN_GAP - wy,
      wy,
      ((C[1] as number) + (B[1] as number)) / 2 + ZLEN_ASCENT / 2,
    );
    items.push({ t: 'label', key: `zx${k}`, ...hx, text: tx, hidden: !L.h, cls: 'zlen' });
    items.push({ t: 'label', key: `zy${k}`, ...vy, text: ty, hidden: !L.v, cls: 'zlen' });
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
      shown = (s) => stairLens(p, s, o).h;
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
