// 점 객체 {id, point:{x, y | on, drag, snap}, name}: 형식 검사·점·이름·끄는 손잡이 그리기와 점 좌표 계산.
// 점 좌표는 칸 번호(정수)로 쥔다 — 세계 좌표 = 칸 번호 × 칸 간격. 부동소수 찌꺼기 없이 "같은 점"을 판정하려고.
import { exactOf } from '../../expr.ts';
import { arr, fail, obj, oneOf, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { mul, qi, ratStr } from '../q.ts';
import { MAX_SNAPS, near, numExpr, toIndex } from './common.ts';
import { curveExact, curveNum, curveOf, fAt } from './curve.ts';
import { fmtNum, iRange, r1, toPx } from './frame.ts';
import { sliderQ } from './slider.ts';
import type { Axis, CoordParams, CoordState, KindDef, PointObj } from './types.ts';

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
  const g = s.pts[id] ?? { i: o.i, j: o.j };
  if (o.on) {
    const x = times(g.i, exactOf(o.snap));
    if (!x) return [null, null];
    const env: Record<string, Rational> = { x };
    for (const sl of p.sliders) {
      const q = sliderQ(sl, s.vars[sl.id] ?? sl.value);
      if (q) env[sl.id] = q;
    }
    return [x, curveExact(p, o.on, env)];
  }
  return [times(g.i, p.x.exact), times(g.j, p.y.exact)];
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
  if (o.drag !== 'none') return `pt_${id}_x`;
  return symAt(o.i, o.on ? o.snap : p.x.step);
}
export function ySym(p: CoordParams, id: string): string {
  const o = pointOf(p, id);
  if (o.on) return `(${curveOf(p, o.on).expr}).subs(x,${xSym(p, id)})`;
  if (o.drag !== 'none') return `pt_${id}_y`;
  return symAt(o.j, p.y.step);
}
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
 * 점 이름표(.pname 13px 굵게)의 글자 폭 어림(px): 한글 13·그 밖 9. 이름표 자리 고르기(draw.ts)와 폭 상한이 같은 셈을
 * 써야 '형식 검사를 통과한 이름은 그림 안에 놓인다'가 맞는다. 한글을 영문과 같은 9px 로 세면 '그저께'가 실제보다
 * 12px 좁게 잡혀 오른쪽 끝 점의 이름표가 그림 밖으로 나간다
 */
export const nameWidth = (t: string) => [...t].reduce((w, ch) => w + (HANGUL.test(ch) ? 13 : 9), 0);
/** 한글(자모·호환 자모·음절). 프라임 ′(U+2032)·아래 첨자 ₁ 은 코드 값이 커도 좁은 글자라 범위로 가린다 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
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
    // 숨긴 목표 점은 맞히기 전에는 자리(좌표)를 그릴 목록에 아예 넣지 않는다 — 숨김 표시만 하면 자리가 DOM 에 남는다
    const ok = Number.isFinite(y) && !(o.hide && !s.solved);
    const [X, Y] = ok ? toPx(p, f, x, y) : [0, 0];
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
};
