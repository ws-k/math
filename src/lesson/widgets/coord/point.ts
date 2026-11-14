// 점 객체 {id, point:{x, y | on, drag, snap}, name}: 형식 검사·점·이름·끄는 손잡이 그리기와 점 좌표 계산.
// 점 좌표는 칸 번호(정수)로 쥔다 — 세계 좌표 = 칸 번호 × 칸 간격. 부동소수 찌꺼기 없이 "같은 점"을 판정하려고.
import { evalNum } from '../../expr.ts';
import { fail, obj, oneOf, optStr } from '../../parse.ts';
import { MAX_SNAPS, near, numExpr, toIndex } from './common.ts';
import { fAt } from './curve.ts';
import { fmtNum, r1, toPx } from './frame.ts';
import type { CoordParams, CoordState, KindDef, PointObj } from './types.ts';

export const pointOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is PointObj => o.kind === 'point' && o.id === id) as PointObj;

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
    const c = obj(ro, at, ['id', 'point'], ['name']);
    const id = cx.named(c.id, `${at} id`);
    const pp = obj(c.point, `${at} point`, ['x'], ['on', 'y', 'drag', 'snap']);
    const name = optStr(c.name, `${at} name`);
    if (name !== undefined && !/^[A-Za-z][']?$/.test(name)) fail(`${at} name`, '한 글자(P, Q, A′)');
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
      const yy = evalNum(cv.node, { ...cx.env0, x: xv.n });
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
      };
      cx.points.set(id, po);
      return po;
    } else {
      if (pp.snap !== undefined) fail(`${at} snap`, '칸 위 점은 칸 간격으로만 움직임');
      const yv = numExpr(pp.y, `${at} y`);
      const drag =
        pp.drag === undefined ? 'none' : oneOf(pp.drag, `${at} drag`, ['none', 'xy'] as const);
      const po: PointObj = {
        kind: 'point',
        id,
        drag,
        snap: x.step,
        snapN: x.st,
        i: toIndex(xv.n, x.st, `${at} x`),
        j: toIndex(yv.n, y.st, `${at} y`),
        ...(name ? { name } : {}),
      };
      cx.points.set(id, po);
      return po;
    }
  },
  draw(o, k, { p, s, f, items, handles }) {
    const [x, y] = pointXY(p, s, o.id);
    const ok = Number.isFinite(y);
    const [X, Y] = ok ? toPx(p, f, x, y) : [0, 0];
    items.push({
      t: 'dot',
      key: `d${k}`,
      x: r1(X),
      y: r1(Y),
      cls: o.drag === 'none' ? 'pt' : 'pt drag',
      hidden: !ok || o.drag !== 'none',
    });
    if (o.name)
      items.push({
        t: 'label',
        key: `n${k}`,
        x: r1(X + 10),
        y: r1(Y - 10),
        text: o.name,
        hidden: !ok,
      });
    if (o.drag !== 'none') {
      const [lo, hi] = o.on ? [p.x.lo, p.x.hi] : [p.x.lo, p.x.hi];
      handles.push({
        key: o.id,
        x: r1(X),
        y: r1(Y),
        label: `점 ${o.name ?? o.id}`,
        value: x,
        min: lo,
        max: hi,
        valueText: `x ${fmtNum(x, 2)}, y ${fmtNum(y, 2)}`,
      });
    }
  },
};
