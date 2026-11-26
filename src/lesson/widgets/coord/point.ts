// 점 객체 {id, point:{x, y | on, drag, snap}, name}: 형식 검사·점·이름·끄는 손잡이 그리기와 점 좌표 계산.
// 점 좌표는 칸 번호(정수)로 쥔다 — 세계 좌표 = 칸 번호 × 칸 간격. 부동소수 찌꺼기 없이 "같은 점"을 판정하려고.
import { exactOf } from '../../expr.ts';
import { arr, fail, obj, oneOf, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { mul, qi, ratStr } from '../q.ts';
import { MAX_SNAPS, near, numExpr, toIndex } from './common.ts';
import { curveExact, curveNum, curveOf, curveVars, fAt, wholeCurve } from './curve.ts';
import { followNum, followQ, followSliders, followSym, isConst, parseFollow } from './follow.ts';
import { fmtNum, iRange, isWide, r1, toPx } from './frame.ts';
import { sliderCombos, sliderQ, sliderSym, sliderValues } from './slider.ts';
import type {
  Axis,
  CoordParams,
  CoordState,
  CurveObj,
  FollowExpr,
  KindDef,
  ParseCtx,
  PointObj,
} from './types.ts';

export const pointOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is PointObj => o.kind === 'point' && o.id === id) as PointObj;

/**
 * 점이 가로로 움직이는 칸: 간격(곡선 위 점은 끄는 간격, 칸 위 점은 칸 간격)과 x 축 안에서 닿는 칸 번호 [처음, 끝].
 * 끌기(model)·목표 상태 늘어놓기(goal)·끝 점을 따라가는 칠하기(fill)가 같은 칸을 봐야 '끌어서 닿는 자리'와
 * '검산이 늘어놓는 자리'가 어긋나지 않아 한곳에 둔다. 끌 수 없는 점도 칸은 같다(제자리만 쓰는 것은 부르는 쪽 몫).
 */
export function xCells(
  x: Axis,
  o: PointObj,
): { i0: number; i1: number; stepN: number; step: Rational | null } {
  const stepN = o.on ? o.snapN : x.st;
  const [a, b] = iRange(x.lo, x.hi, stepN) as [number, number];
  const [i0, i1] = o.cells ? [Math.max(a, o.cells[0]), Math.min(b, o.cells[1])] : [a, b];
  return { i0, i1, stepN, step: o.on ? exactOf(o.snap) : x.exact };
}

export function worldX(p: CoordParams, o: PointObj, i: number): number {
  return o.on ? i * o.snapN : i * p.x.st;
}

/** 칸 번호 × 간격. 1.45 가 1.4500000000000002 로 보이지 않게 12자리에서 정리한다 */
const at = (k: number, st: number) => Number((k * st).toPrecision(12));

/** 점의 세계 좌표 */
export function pointXY(p: CoordParams, s: CoordState, id: string): [number, number] {
  const o = pointOf(p, id);
  if (o.follow) return followXY(p, s, o, o.follow);
  const g = s.pts[id] ?? { i: o.i, j: o.j };
  if (o.on) {
    const x = at(g.i, o.snapN);
    return [x, fAt(p, s, o.on, x)];
  }
  return [at(g.i, p.x.st), at(g.j, p.y.st)];
}

const times = (k: number, step: Rational | null): Rational | null =>
  step ? mul(qi(k), step) : null;

/** 점의 정확한 좌표(분수). π 칸·무리수 곡선 값이면 그 성분은 null — 목표 판정이 분수로 견줄 때 쓴다 */
export function pointQ(
  p: CoordParams,
  s: CoordState,
  id: string,
): [Rational | null, Rational | null] {
  const o = pointOf(p, id);
  const env: Record<string, Rational> = {};
  for (const sl of p.sliders) {
    const q = sliderQ(sl, s.vars[sl.id] ?? sl.value);
    if (q) env[sl.id] = q;
  }
  if (o.follow) {
    const f = o.follow;
    const ref = (pt: string, ax: 'x' | 'y') => pointQ(p, s, pt)[ax === 'x' ? 0 : 1];
    const x = followQ(f.x, env, ref);
    if (o.on) return [x, x ? curveExact(p, o.on, { ...env, x }) : null];
    return [x, f.y ? followQ(f.y, env, ref) : null];
  }
  const g = s.pts[id] ?? { i: o.i, j: o.j };
  if (o.on) {
    const x = times(g.i, exactOf(o.snap));
    if (!x) return [null, null];
    return [x, curveExact(p, o.on, { ...env, x })];
  }
  return [times(g.i, p.x.exact), times(g.j, p.y.exact)];
}

// ---- 따라오는 점 ----

/** 슬라이더의 지금 값(상태에 없으면 처음 값) — 따라오는 식은 슬라이더를 다 쓸 수 있다 */
const sliderVals = (p: CoordParams, s: CoordState): Record<string, number> => ({
  ...Object.fromEntries(p.sliders.map((sl) => [sl.id, sl.value])),
  ...s.vars,
});

/** 따라오는 좌표 식의 지금 값(그리기). 세로선 자리도 이것으로 */
export const followNow = (p: CoordParams, s: CoordState, e: FollowExpr): number =>
  followNum(e, sliderVals(p, s), (pt, ax) => pointXY(p, s, pt)[ax === 'x' ? 0 : 1]);

/** 따라오는 좌표 식의 sympy 글자(가리키는 점은 그 점의 검산 글자로) */
export const followSymOf = (p: CoordParams, e: FollowExpr): string => followSym(e, refSym(p));

function followXY(
  p: CoordParams,
  s: CoordState,
  o: PointObj,
  f: NonNullable<PointObj['follow']>,
): [number, number] {
  const x = followNow(p, s, f.x);
  if (o.on) return [x, Number.isFinite(x) ? fAt(p, s, o.on, x) : Number.NaN];
  return [x, f.y ? followNow(p, s, f.y) : Number.NaN];
}

/** 점 자리를 움직이는 것: 끄는 점 id 와 슬라이더 id. 따라오는 점은 가리키는 점을 거슬러 올라가 모은다 */
export interface Deps {
  pts: Set<string>;
  sliders: Set<string>;
}
/** 형식 검사(앞에 나온 것 표)와 그 뒤(매개변수 전체)가 같은 셈을 쓰게, 점·곡선을 찾는 길만 받는다 */
export interface PointLook {
  point(id: string): PointObj | undefined;
  curve(id: string): CurveObj | undefined;
  sliders: readonly { id: string }[];
}
export const lookOf = (p: CoordParams): PointLook => ({
  point: (id) => pointOf(p, id),
  curve: (id) => curveOf(p, id),
  sliders: p.sliders,
});

export function pointDeps(
  lk: PointLook,
  id: string,
  out: Deps = { pts: new Set(), sliders: new Set() },
): Deps {
  const o = lk.point(id);
  if (!o) return out;
  if (o.on) {
    const c = lk.curve(o.on);
    // 곡선 식에 나오는 차례로 모은다 — 목표 판정 검산이 이 차례로 상태를 늘어놓아, 차례가 바뀌면 기준선(verify:diff)이 바뀐다
    const ids = new Set(lk.sliders.map((sl) => sl.id));
    if (c) for (const v of curveVars(c)) if (ids.has(v)) out.sliders.add(v);
  }
  if (o.follow) {
    exprDeps(lk, o.follow.x, out);
    if (o.follow.y) exprDeps(lk, o.follow.y, out);
  } else if (o.drag !== 'none') out.pts.add(id);
  return out;
}

/** 따라오는 좌표 식을 움직이는 것(식의 슬라이더 + 가리키는 점을 움직이는 것) */
export function exprDeps(
  lk: PointLook,
  e: FollowExpr,
  out: Deps = { pts: new Set(), sliders: new Set() },
): Deps {
  for (const v of followSliders(e)) out.sliders.add(v);
  for (const r of e.refs) pointDeps(lk, r.pt, out);
  return out;
}

/**
 * 형식 검사 중 따라오는 좌표 식의 값(수). 끄는 점에 기대면 자리가 손에 달려 null. vars 는 슬라이더 값
 */
export function exprNum(
  lk: PointLook & Pick<ParseCtx, 'x' | 'y'>,
  e: FollowExpr,
  vars: Record<string, number>,
): number | null {
  if (exprDeps(lk, e).pts.size > 0) return null;
  return followNum(e, vars, (pt, ax) => {
    const q = pointNum(lk, pt, vars);
    return q ? q[ax === 'x' ? 0 : 1] : Number.NaN;
  });
}

/**
 * 형식 검사 중 점 좌표(수). 끄는 점에 기대면 자리가 손에 달려 null(화면 밖·길이 검사를 건너뜀 — 끄는 점은 칸 안에서만
 * 움직인다). vars 는 슬라이더 값
 */
export function pointNum(
  lk: PointLook & Pick<ParseCtx, 'x' | 'y'>,
  id: string,
  vars: Record<string, number>,
): [number, number] | null {
  const o = lk.point(id);
  if (!o) return null;
  if (o.follow) {
    if (pointDeps(lk, id).pts.size > 0) return null;
    const x = exprNum(lk, o.follow.x, vars) ?? Number.NaN;
    if (!o.on) return [x, o.follow.y ? (exprNum(lk, o.follow.y, vars) ?? Number.NaN) : Number.NaN];
    const c = lk.curve(o.on);
    return c ? [x, curveNum(c, { ...vars, x })] : null;
  }
  if (o.drag !== 'none') return null;
  if (!o.on) return [o.i * lk.x.st, o.j * lk.y.st];
  const c = lk.curve(o.on);
  const x = o.i * o.snapN;
  return c ? [x, curveNum(c, { ...vars, x })] : null;
}

/** 칸 번호 k × 간격(원문)을 sympy 글자로 */
const symAt = (k: number, step: string) => {
  const q = exactOf(step);
  if (q) return ratStr(mul(qi(k), q));
  return `${k}*(${step})`;
};

/**
 * 검산용 점 좌표 글자. 끄는 점은 상태 기호(pt_P_x·pt_P_y — 검산 상태가 값을 넣는다), 고정 점은 값 그대로.
 * 곡선 위 점의 y 는 곡선 식에 x 를 넣은 식(곡선의 슬라이더 이름은 그대로 — 상태가 넣는다).
 */
export function xSym(p: CoordParams, id: string): string {
  const o = pointOf(p, id);
  // 따라오는 점은 가리키는 점의 검산 글자를 식에 넣는다 — 끄는 점까지 거슬러 올라가 상태 기호가 된다
  if (o.follow) return followSym(o.follow.x, refSym(p));
  if (o.drag !== 'none') return `pt_${id}_x`;
  return symAt(o.i, o.on ? o.snap : p.x.step);
}
export function ySym(p: CoordParams, id: string): string {
  const o = pointOf(p, id);
  if (o.on) return `(${curveOf(p, o.on).expr}).subs(x,${xSym(p, id)})`;
  if (o.follow?.y) return followSym(o.follow.y, refSym(p));
  if (o.drag !== 'none') return `pt_${id}_y`;
  return symAt(o.j, p.y.step);
}
const refSym = (p: CoordParams) => (pt: string, ax: 'x' | 'y') =>
  ax === 'x' ? xSym(p, pt) : ySym(p, pt);
/** 끄는 점이 칸 번호 (i,j) 에 있을 때의 상태 기호 값 */
export function pointState(
  p: CoordParams,
  id: string,
  i: number,
  j: number,
): Record<string, string> {
  const o = pointOf(p, id);
  if (o.on) return { [`pt_${id}_x`]: symAt(i, o.snap) };
  return { [`pt_${id}_x`]: symAt(i, p.x.step), [`pt_${id}_y`]: symAt(j, p.y.step) };
}

/** 끄는 x 범위 range:[a,b](축 위 칸, 양 끝 포함)를 칸 번호로 읽어 점에 붙인다 */
function withRange(
  po: PointObj,
  raw: unknown,
  at: string,
  x: Axis,
  defined: (x: number) => boolean = () => true,
): void {
  if (raw === undefined) return;
  if (po.drag === 'none') fail(at, '끄는 점만 범위를 둠');
  const [ra, rb] = arr(raw, at, 2, 2);
  const a = numExpr(ra, `${at}1`);
  const b = numExpr(rb, `${at}2`);
  if (a.n < x.lo - 1e-9 || b.n > x.hi + 1e-9) fail(at, `축 밖 (x 는 ${x.min}~${x.max})`);
  const ia = toIndex(a.n, po.snapN, at);
  const ib = toIndex(b.n, po.snapN, at);
  if (ib - ia < 1) fail(at, '두 칸 이상이어야 함(작은 쪽 먼저)');
  if (po.i < ia || po.i > ib) fail(at, '처음 자리가 범위 밖');
  // 범위 끝은 '여기까지 끌린다'는 약속 — 곡선이 거기서 정의 안 되면 끌기가 그 칸을 거부해 끝에 닿지 않는다
  for (const v of [a.n, b.n])
    if (!defined(v)) fail(at, `범위 끝 x=${v} 에서 곡선이 정의 안 됨(범위를 정의되는 칸까지로)`);
  po.cells = [ia, ib];
}

// ---- 점 이름 ----

/**
 * 점 이름표(.pname 13px 굵게)의 글자 폭 어림(px): 넓은 글자 13·아는 좁은 글자 9(frame.ts isWide — 모르는 글자는
 * 넓게). 이름표 자리 고르기(draw.ts)와 폭 상한이 같은 셈을 써야 '형식 검사를 통과한 이름은 그림 안에 놓인다'가 맞는다.
 * 한글을 영문과 같은 9px 로 세면 '그저께'가 실제보다 12px 좁게 잡혀 오른쪽 끝 점의 이름표가 그림 밖으로 나간다
 */
export const nameWidth = (t: string) => [...t].reduce((w, ch) => w + (isWide(ch) ? 13 : 9), 0);
/**
 * 이름표 폭 상한(px) — 한글 4자·영문 6자. 가장 좁은 화면(382px) 그림 폭 250px 의 1/5 남짓: 더 길면 점 둘레를 넓게
 * 덮어 곡선·다른 점을 가리고, 이웃 점과 자리를 나눌 수 없게 된다
 */
export const NAME_MAX_PX = 54;

/**
 * 점 이름: 여러 글자('출발'·'그저께')·프라임(A′, 옛 단원의 ASCII A' 도 그대로)·아래 첨자(P₁). 그림 글자(SVG text)라
 * 수식($…$)이 그려지지 않으므로 받지 않는다 — 그대로 두면 '$P$' 가 글자째 보인다
 */
function pointName(v: unknown, at: string): string {
  const name = str(v, at);
  if (name.trim() !== name) fail(at, `이름 앞뒤 빈칸 ('${name}')`);
  if (/[$\\{}]/.test(name))
    fail(at, `그림 글자라 수식 글자($ \\ { })를 못 씀 — A′·P₁ 처럼 글자 그대로 (${name})`);
  const w = nameWidth(name);
  if (w > NAME_MAX_PX)
    fail(
      at,
      `이름표 '${name}' 이 ${w}px — ${NAME_MAX_PX}px 이하로(한글 4자·영문 6자 — 가장 좁은 화면에서 그림을 가림)`,
    );
  return name;
}

/** 두 점이 같은 곡선 위 같은 자리인가 — 할선이 접선이 되는 순간 */
export function coincide(p: CoordParams, s: CoordState, a: string, b: string): string | null {
  const pa = pointOf(p, a);
  const pb = pointOf(p, b);
  if (!pa.on || pa.on !== pb.on) return null;
  return near(pointXY(p, s, a)[0], pointXY(p, s, b)[0]) ? pa.on : null;
}

export const pointKind: KindDef<PointObj> = {
  parse(ro, at, cx) {
    const { x, y } = cx;
    const c = obj(ro, at, ['id', 'point'], ['name', 'hide']);
    const id = cx.named(c.id, `${at} id`);
    if (c.hide !== undefined && c.hide !== true) fail(`${at} hide`, 'true 만');
    const hide = c.hide === true ? { hide: true as const } : {};
    const pp = obj(c.point, `${at} point`, ['x'], ['on', 'y', 'drag', 'snap', 'range']);
    const name = c.name === undefined ? undefined : pointName(c.name, `${at} name`);
    // 좌표에 슬라이더·점 좌표를 쓰면 따라오는 점. 수만 쓴 좌표는 예전 길(칸 위 고정·끄는 점) 그대로
    const fx = followOf(pp.x, `${at} x`, cx);
    const fy = pp.on === undefined ? followOf(pp.y, `${at} y`, cx) : null;
    if (fx || fy) return parseFollower(c, pp, at, cx, id, name, fx, fy);
    const xv = numExpr(pp.x, `${at} x`);
    if (pp.on !== undefined) {
      const cv = cx.curveRef(pp.on, `${at} on`);
      if (pp.y !== undefined) fail(at, '곡선 위 점은 y 를 적지 않음(곡선에서 계산)');
      const drag =
        pp.drag === undefined ? 'none' : oneOf(pp.drag, `${at} drag`, ['none', 'x'] as const);
      const snap =
        pp.snap === undefined ? { src: x.step, n: x.st } : numExpr(pp.snap, `${at} snap`);
      if ((x.hi - x.lo) / snap.n > MAX_SNAPS)
        fail(`${at} snap`, `끄는 간격이 너무 촘촘함(${MAX_SNAPS}칸 이하)`);
      const i = toIndex(xv.n, snap.n, `${at} x`);
      if (xv.n < x.lo || xv.n > x.hi) fail(`${at} x`, '화면 밖');
      const yy = curveNum(cv, { ...cx.env0, x: xv.n });
      if (Number.isNaN(yy)) fail(`${at} x`, '곡선이 정의되지 않는 자리');
      const po: PointObj = {
        kind: 'point',
        id,
        on: cv.id,
        drag,
        snap: snap.src,
        snapN: snap.n,
        i,
        j: 0,
        ...(name ? { name } : {}),
        ...hide,
      };
      if (po.hide && drag !== 'none')
        fail(`${at} hide`, '끄는 점은 숨기지 못함(숨기는 것은 목표 점)');
      withRange(po, pp.range, `${at} range`, x, (v) =>
        Number.isFinite(curveNum(cv, { ...cx.env0, x: v })),
      );
      cx.points.set(id, po);
      return po;
    } else {
      if (pp.snap !== undefined) fail(`${at} snap`, '칸 위 점은 칸 간격으로만 움직임');
      const yv = numExpr(pp.y, `${at} y`);
      const drag =
        pp.drag === undefined ? 'none' : oneOf(pp.drag, `${at} drag`, ['none', 'xy', 'x'] as const);
      const po: PointObj = {
        kind: 'point',
        id,
        drag,
        snap: x.step,
        snapN: x.st,
        i: toIndex(xv.n, x.st, `${at} x`),
        j: toIndex(yv.n, y.st, `${at} y`),
        ...(name ? { name } : {}),
        ...hide,
      };
      if (po.hide && drag !== 'none')
        fail(`${at} hide`, '끄는 점은 숨기지 못함(숨기는 것은 목표 점)');
      withRange(po, pp.range, `${at} range`, x);
      cx.points.set(id, po);
      return po;
    }
  },
  draw(o, k, { p, s, f, items, handles, pins, spots }) {
    const [x, y] = pointXY(p, s, o.id);
    const fin = Number.isFinite(x) && Number.isFinite(y);
    const [X0, Y0] = fin ? toPx(p, f, x, y) : [0, 0];
    // 숨긴 목표 점은 맞히기 전에는 자리(좌표)를 그릴 목록에 아예 넣지 않는다 — 숨김 표시만 하면 자리가 DOM 에 남는다.
    // 따라오는 점은 끄는 점을 따라 그림 밖으로 나갈 수 있다: 점은 잘려도 이름표는 그림 안 자리를 골라 홀로 떠 있게
    // 되므로(어느 점의 이름인지 모름) 점·이름표를 함께 숨긴다
    const ok = fin && !(o.hide && !s.solved) && (!o.follow || inFrame(f, X0, Y0));
    const [X, Y] = ok ? [X0, Y0] : [0, 0];
    items.push({
      t: 'dot',
      key: `d${k}`,
      x: r1(X),
      y: r1(Y),
      cls: o.drag === 'none' ? 'pt' : 'pt drag',
      hidden: !ok || o.drag !== 'none',
    });
    if (ok) spots.push({ x: X, y: Y });
    // 손잡이(HTML)는 그림을 잘라 내는 영역(clipPath) 밖이라, 점이 y 범위 밖으로 가면 그림 위로 떠올랐다(요청 141).
    // 테두리에 붙여 둔다 — 점은 잘려 안 보여도 손잡이를 잡아 다시 끌어 올 수 있다. 값 글은 실제 좌표 그대로
    const hy = ok ? Math.min(f.b, Math.max(f.t, Y)) : Y;
    if (o.name) {
      // 자리는 draw 가 모든 이름표를 모은 뒤 고른다(labels.ts) — 여기서는 숨김 여부와 글자만
      const it = { t: 'label' as const, key: `n${k}`, x: 0, y: 0, text: o.name, hidden: !ok };
      items.push(it);
      if (ok) pins.push({ it, x: X, y: Y });
    }
    if (o.drag !== 'none') {
      const { i0, i1 } = xCells(p.x, o);
      const [lo, hi] = o.cells ? [worldX(p, o, i0), worldX(p, o, i1)] : [p.x.lo, p.x.hi];
      handles.push({
        key: o.id,
        x: r1(X),
        y: r1(hy),
        off: ok && hy !== Y,
        label: `점 ${o.name ?? o.id}`,
        value: x,
        min: lo,
        max: hi,
        valueText: `x ${fmtNum(x, 2)}, y ${fmtNum(y, 2)}`,
      });
    }
  },
  checks(o, { p, out }) {
    if (!o.follow) return;
    // 따라오는 점의 자리(부록 B): 그 점을 움직이는 끄는 점 칸 × 슬라이더 칸마다 앱 좌표 = sympy(가리키는 점의 검산
    // 글자를 식에 넣어 따로 계산). 수 그대로인 좌표(수선의 발의 y=0)는 글자 그대로라 항목이 없다
    const axes: ['x' | 'y', string][] = [];
    if (!isConst(o.follow.x)) axes.push(['x', xSym(p, o.id)]);
    if (o.on || (o.follow.y && !isConst(o.follow.y))) axes.push(['y', ySym(p, o.id)]);
    const st = depStates(p, pointDeps(lookOf(p), o.id));
    for (const [ax, expr] of axes)
      out.push({
        name: `따라오는 점 ${o.id} ${ax}`,
        kind: 'parity',
        expr,
        points: st.map((q) => q.sym),
        values: st.map((q) => {
          const v = pointXY(p, q.s, o.id)[ax === 'x' ? 0 : 1];
          return Number.isFinite(v) ? v : null;
        }),
      });
  },
};

/**
 * 따라오는 점을 못 가리키는 곳(칠하기 끝·막대 고르기 끝·정규분포 넓이 끝·목표 점): 이곳들은 점이 닿는 칸(xCells)을
 * 늘어놓아 넓이·목표를 검산하는데, 따라오는 점의 x 는 칸 위가 아니라 다른 점·슬라이더의 값이다
 */
export function noFollow(o: PointObj, at: string, what: string): PointObj {
  if (o.follow)
    fail(
      at,
      `따라오는 점 ${o.id} 은 ${what}으로 못 씀 — 끄는 점이나 고정 점으로(닿는 칸을 늘어놓지 못함)`,
    );
  return o;
}

/** 그림 테두리 안인가(px, 반올림 찌꺼기만큼 너그럽게) */
const inFrame = (f: { l: number; r: number; t: number; b: number }, X: number, Y: number) =>
  X >= f.l - 0.5 && X <= f.r + 0.5 && Y >= f.t - 0.5 && Y <= f.b + 0.5;

/** 좌표 글자가 슬라이더·점 좌표를 쓰면 따라오는 식, 수만 쓰면(또는 없으면) null — 수는 예전 길로 읽는다 */
function followOf(v: unknown, at: string, cx: ParseCtx): FollowExpr | null {
  if (typeof v !== 'string') return null;
  const e = parseFollow(v, at, cx);
  return isConst(e) ? null : e;
}

/**
 * 따라오는 점 {point:{x:'x(P)', y:0}} · {point:{on:'g', x:'x(P)'}} · {point:{x:'h', y:0}}. 끌지 않는다 — 식이 자리를
 * 정하므로 손잡이가 있으면 '끌어도 되돌아가는 점'이 된다(P1). 슬라이더만 따라오면 닿는 모든 칸에서 그림 안이어야 하고,
 * 끄는 점을 따라오면 자리가 손에 달려 있어 그리기에서 그림 밖일 때 숨긴다
 */
function parseFollower(
  c: Record<string, unknown>,
  pp: Record<string, unknown>,
  at: string,
  cx: ParseCtx,
  id: string,
  name: string | undefined,
  fx: FollowExpr | null,
  fy: FollowExpr | null,
): PointObj {
  if (pp.drag !== undefined || pp.snap !== undefined || pp.range !== undefined)
    fail(at, '따라오는 점(좌표가 식)은 끌지 않음 — drag·snap·range 없이(식이 자리를 정함)');
  if (c.hide !== undefined) fail(`${at} hide`, '따라오는 점은 숨기지 못함(숨기는 것은 목표 점)');
  const x = fx ?? parseFollow(pp.x, `${at} x`, cx);
  let on: string | undefined;
  if (pp.on !== undefined) {
    // 조각 곡선은 미분 검사(smooth.ts)가 점이 닿는 칸을 늘어놓아 보는데, 따라오는 점의 x 는 칸 위가 아니다
    on = wholeCurve(cx.curveRef(pp.on, `${at} on`), `${at} on`, '따라오는 점').id;
    if (pp.y !== undefined) fail(at, '곡선 위 점은 y 를 적지 않음(곡선에서 계산)');
  }
  const po: PointObj = {
    kind: 'point',
    id,
    drag: 'none',
    snap: cx.x.step,
    snapN: cx.x.st,
    i: 0,
    j: 0,
    ...(on ? { on } : {}),
    ...(name ? { name } : {}),
    follow: on ? { x } : { x, y: fy ?? parseFollow(pp.y, `${at} y`, cx) },
  };
  const lk: PointLook & Pick<ParseCtx, 'x' | 'y'> = {
    point: (q) => (q === id ? po : cx.points.get(q)),
    curve: (q) => cx.curves.get(q),
    sliders: cx.sliders,
    x: cx.x,
    y: cx.y,
  };
  const deps = pointDeps(lk, id);
  if (deps.pts.size === 0)
    for (const cb of sliderCombos(cx.sliders, [...deps.sliders], at)) {
      const q = pointNum(lk, id, { ...cx.env0, ...cb.num });
      const [qx, qy] = q ?? [Number.NaN, Number.NaN];
      const inside =
        Number.isFinite(qx) &&
        Number.isFinite(qy) &&
        qx >= cx.x.lo - 1e-9 &&
        qx <= cx.x.hi + 1e-9 &&
        qy >= cx.y.lo - 1e-9 &&
        qy <= cx.y.hi + 1e-9;
      if (!inside)
        fail(
          at,
          `정의 안 되거나 화면 밖 (${qx}, ${qy})${cb.text ? ` — ${cb.text}` : ''} (슬라이더를 따라오는 점은 닿는 칸마다 그림 안이어야 함)`,
        );
    }
  cx.points.set(id, po);
  return po;
}

/** 따라오는 점 검산에서 늘어놓는 상태 상한. 끄는 점 둘(21×21 칸)만 따라와도 수십만이라 고르게 덜어 낸다 */
const MAX_FOLLOW_STATES = 400;

/**
 * 따라오는 점을 움직이는 것(끄는 점 칸 × 슬라이더 칸)의 상태들. 다 세면 상한을 넘을 수 있어 처음·끝을 품고 고르게
 * 덜어 낸다(목표 판정과 달리 '닿는 자리 전부'가 아니라 '계산이 맞는가'를 보는 표본이라)
 */
export function depStates(
  p: CoordParams,
  deps: Deps,
): { s: CoordState; sym: Record<string, string> }[] {
  type Opt = { patch: (s: CoordState) => CoordState; sym: Record<string, string> };
  const dims: Opt[][] = [];
  for (const id of deps.sliders) {
    const sl = p.sliders.find((x) => x.id === id);
    if (!sl) continue;
    dims.push(
      sliderValues(sl).map(({ k, v }) => ({
        patch: (s: CoordState) => ({ ...s, vars: { ...s.vars, [id]: v } }),
        sym: { [id]: sliderSym(sl, k) },
      })),
    );
  }
  for (const id of deps.pts) {
    const o = pointOf(p, id);
    const { i0, i1 } = xCells(p.x, o);
    const [j0, j1] = o.on
      ? [0, 0]
      : o.drag === 'x'
        ? [o.j, o.j]
        : (iRange(p.y.lo, p.y.hi, p.y.st) as [number, number]);
    const opts: Opt[] = [];
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++)
        opts.push({
          patch: (s) => ({ ...s, pts: { ...s.pts, [id]: { i, j } } }),
          sym: pointState(p, id, i, j),
        });
    dims.push(opts);
  }
  const total = dims.reduce((n, d) => n * d.length, 1);
  const k = Math.min(total, MAX_FOLLOW_STATES);
  const base: CoordState = {
    solved: false,
    vars: Object.fromEntries(p.sliders.map((sl) => [sl.id, sl.value])),
    pts: Object.fromEntries(
      p.objects.flatMap((o) => (o.kind === 'point' ? [[o.id, { i: o.i, j: o.j }]] : [])),
    ),
    user: [],
    stroke: [],
  };
  const out: { s: CoordState; sym: Record<string, string> }[] = [];
  for (let t = 0; t < k; t++) {
    // 섞인 진법으로 풀어 칸마다 하나씩 고른다(t 번째 표본 = 전체 상태 중 고르게 떨어진 자리)
    let n = k === 1 ? 0 : Math.round((t * (total - 1)) / (k - 1));
    let s = base;
    let sym: Record<string, string> = {};
    for (const d of dims) {
      const o = d[n % d.length] as Opt;
      n = Math.floor(n / d.length);
      s = o.patch(s);
      sym = { ...sym, ...o.sym };
    }
    out.push({ s, sym });
  }
  return out;
}
