// 표시 객체: 세로선 {vline}(요청 77·131)과 직각 표시 {right}(요청 56). 둘 다 값을 읽거나 끄는 것이 아니라 그림 위의
// 표시라, 끄는 동안에는 같은 key 의 항목 값만 바뀐다(세로선 v<순번> 의 x·숨김, 직각 q<순번> 의 경로 글자 — 안 보이면 빈 경로).
//
// 세로선: 곡선으로는 x 가 하나인 선을 그릴 수 없고, 선분으로 그리면 끝을 화면 끝 좌표로 적어야 해 점근선 점선도, 점을
// 따라 움직이는 세로줄(math2-indefinite 'P 와 같은 세로줄')도 안 됐다. 자리는 따라오는 좌표 식(follow.ts)과 같은 꼴.
// 직각 표시: 꼭짓점에서 두 변을 따라 작은 꺾쇠. 정말 직각일 때만 그린다 — 끄는 점이면 직각이 된 순간에만 나타나
// '직각이 되는 자리를 찾아보기'에 쓸 수 있다. 화면에서 직각으로 보일 때만이기도 하다(축척이 다르면 비스듬한 직각은
// 화면에서 비뚤어 보여 꺾쇠가 틀린 말을 한다).
import { evalNum } from '../../expr.ts';
import { arr, fail, obj, oneOf, str } from '../../parse.ts';
import { near } from './common.ts';
import { isConst, parseFollow } from './follow.ts';
import { narrowFrame, r1, toPx } from './frame.ts';
import {
  type Deps,
  depStates,
  exprDeps,
  exprNum,
  followNow,
  followSymOf,
  lookOf,
  pointDeps,
  xSym,
  ySym,
} from './point.ts';
import { endAt, endSliders, endText, endXY, parseEnd, slidersIn } from './segment.ts';
import { sliderCombos } from './slider.ts';
import {
  type CoordParams,
  type KindDef,
  type ParseCtx,
  type RightObj,
  type SegEnd,
  TONES,
  type VlineObj,
} from './types.ts';

/** 형식 검사 중의 점·곡선 찾기(point.ts exprDeps·exprNum 이 받는 꼴) */
const lookIn = (cx: ParseCtx) => ({
  point: (id: string) => cx.points.get(id),
  curve: (id: string) => cx.curves.get(id),
  sliders: cx.sliders,
  x: cx.x,
  y: cx.y,
});

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

/**
 * 세계 좌표의 세 끝 → 그릴 꺾쇠 경로(안 보이면 ''). 세계에서 직각이고 화면(px)에서도 직각일 때만 —
 * 축척 같게(equal)가 아니면 비스듬한 직각은 화면에서 직각이 아니다(가로·세로 변은 어느 축척에서도 직각)
 */
function rightPath(
  pa: V2,
  po: V2,
  pb: V2,
  px: (q: V2) => V2,
  minLen = 0,
): { d: string; world: boolean; screen: boolean; short: boolean } {
  const u = sub2(pa, po);
  const v = sub2(pb, po);
  const none = { d: '', world: false, screen: false, short: false };
  if (![...u, ...v].every(Number.isFinite) || len2(u) === 0 || len2(v) === 0) return none;
  if (!perp(u, v, 1e-9)) return none;
  const O = px(po);
  const U = sub2(px(pa), O);
  const V = sub2(px(pb), O);
  if (!perp(U, V, 1e-6)) return { ...none, world: true };
  const L = Math.min(len2(U), len2(V));
  const s = Math.min(RIGHT_PX, L * 0.4);
  const a: V2 = [O[0] + (U[0] / len2(U)) * s, O[1] + (U[1] / len2(U)) * s];
  const b: V2 = [O[0] + (V[0] / len2(V)) * s, O[1] + (V[1] / len2(V)) * s];
  const c: V2 = [a[0] + b[0] - O[0], a[1] + b[1] - O[1]];
  return {
    d: `M${r1(a[0])} ${r1(a[1])}L${r1(c[0])} ${r1(c[1])}L${r1(b[0])} ${r1(b[1])}`,
    world: true,
    screen: true,
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
    const r = rightPath(pa as V2, po as V2, pb as V2, px, MIN_RAY_PX);
    if (r.world) world++;
    if (!r.screen) continue;
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
      `축척이 달라 비스듬한 직각이 화면에서 비뚤어 보여 그리지 않음 (${o.ref}) — 좌표에 equal: true 를`,
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
    const r = rightPath(pa, po, pb, (q) => toPx(p, f, q[0], q[1]));
    items.push({ t: 'path', key: `q${k}`, d: r.d, cls: 'rmark' });
  },
  checks(o, { p, out }) {
    // 꺾쇠가 보이는 상태마다 두 변의 내적 = 0 (sympy). '그린 곳은 정말 직각'을 앱 셈과 따로 확인한다.
    // 화면 직각 여부는 가장 좁은 화면 축척으로 본다(축척 같게면 크기와 상관없고, 아니면 가로·세로 변만 보임)
    const deps: Deps = { pts: new Set(), sliders: new Set() };
    for (const e of [o.a, o.o, o.b]) endDeps(p, e, deps);
    const f = narrowFrame(p);
    const seen = depStates(p, deps).flatMap((q) => {
      const [pa, po, pb] = [o.a, o.o, o.b].map((e) => endXY(p, q.s, e)) as [V2, V2, V2];
      if (!rightPath(pa, po, pb, (w) => toPx(p, f, w[0], w[1])).screen) return [];
      return [{ sym: q.sym, v: dot2(sub2(pa, po), sub2(pb, po)) }];
    });
    if (seen.length === 0) return;
    const d = (ax: 'x' | 'y', e: SegEnd) => `(${endSym(p, e, ax)})-(${endSym(p, o.o, ax)})`;
    out.push({
      name: `직각 ${o.ref} 내적`,
      kind: 'parity',
      expr: `(${d('x', o.a)})*(${d('x', o.b)})+(${d('y', o.a)})*(${d('y', o.b)})`,
      points: seen.map((q) => q.sym),
      values: seen.map((q) => q.v),
    });
  },
};
