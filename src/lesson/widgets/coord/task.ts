// 과제(task) — 점 찍기·곡선 위 점·직선 그리기·손으로 긋기. 형식 검사·채점·과제 모드의 그릴 것·과제 검산.
// 과제는 객체가 아니라 모드에 딸려 있어(그리는 것도 모드가 정한다) 객체 종류 표와 따로 둔다.
import { compile, derivative, evalExact, evalNum, exactOf } from '../../expr.ts';
import { type GridPt, gradeLine, gradePoint, gradePointsOn, gradeSketch } from '../../grade.ts';
import { fail, int, obj, str } from '../../parse.ts';
import { type Rational, ratStr } from '../../sym.ts';
import type { WidgetCheck } from '../specs.ts';
import { numExpr, target, toIndex } from './common.ts';
import { curveOf, fAt, wholeCurve } from './curve.ts';
import { fullLine, hidden0, r1, tickText, toPx } from './frame.ts';
import type {
  CoordParams,
  CoordState,
  CurveObj,
  DrawCtx,
  Mode,
  Target,
  Task,
  Verdict,
} from './types.ts';

export function parseTask(raw: unknown, p: CoordParams, curves: Map<string, CurveObj>): Task {
  const at = '좌표 task';
  const o = obj(raw, at, [], ['point', 'pointsOn', 'line', 'sketch']);
  const keys = Object.keys(o);
  if (keys.length !== 1) fail(at, 'point·pointsOn·line·sketch 중 하나만');
  const want: Record<string, Mode[]> = {
    point: ['plot'],
    pointsOn: ['plot', 'connect'],
    line: ['line'],
    sketch: ['sketch'],
  };
  const k = keys[0] as string;
  if (!want[k]?.includes(p.mode)) fail(at, `${k} 과제는 ${want[k]?.join('·')} 모드에서`);
  const curve = (v: unknown, w: string) => {
    const c = curves.get(str(v, w));
    if (!c) return fail(w, `없는 곡선 ${String(v)}`);
    wholeCurve(c, w, '과제 곡선');
    // 채점 기준 곡선이 슬라이더로 바뀌면 검산한 답과 채점하는 답이 달라진다
    try {
      compile(c.expr, ['x']);
    } catch {
      fail(w, '과제 곡선에는 슬라이더 변수를 쓰지 않음');
    }
    return c;
  };
  if (k === 'point') {
    const t = obj(o.point, `${at} point`, ['x', 'y']);
    const tx = target(t.x, `${at} x`);
    const ty = target(t.y, `${at} y`);
    const xn = evalNum(compile(tx.value, []), {});
    const yn = evalNum(compile(ty.value, []), {});
    if (xn < p.x.lo || xn > p.x.hi || yn < p.y.lo || yn > p.y.hi) fail(at, '목표 점이 화면 밖');
    return {
      kind: 'point',
      x: tx,
      y: ty,
      i: toIndex(xn, p.x.st, `${at} x`),
      j: toIndex(yn, p.y.st, `${at} y`),
    };
  }
  if (k === 'pointsOn') {
    const t = obj(o.pointsOn, `${at} pointsOn`, ['curve', 'count']);
    return {
      kind: 'pointsOn',
      curve: curve(t.curve, `${at} curve`).id,
      count: int(t.count, `${at} count`, 1, 12),
    };
  }
  if (k === 'sketch') {
    const t = obj(o.sketch, `${at} sketch`, ['curve', 'tol']);
    const tol = numExpr(t.tol, `${at} tol`);
    if (!(tol.n > 0) || tol.n > p.x.st + 1e-12 || tol.n > p.y.st + 1e-12)
      fail(`${at} tol`, '0 보다 크고 격자 간격 이하');
    return { kind: 'sketch', curve: curve(t.curve, `${at} curve`).id, tol: tol.src, tolN: tol.n };
  }
  // line: 칸 간격이 유리수여야 기울기를 분수로 정확히 비교할 수 있다
  if (!p.x.exact || !p.y.exact) fail(at, '직선 과제는 칸 간격이 유리수일 때만');
  const t = obj(o.line, `${at} line`, [], ['slope', 'through', 'intercept', 'tangent']);
  if (Object.keys(t).length === 0) fail(at, '직선 조건이 하나는 있어야 함');
  const rational = (tg: Target, w: string) => {
    if (!exactOf(tg.value)) fail(w, `유리수가 아님 (${tg.value})`);
    return tg;
  };
  const out: Extract<Task, { kind: 'line' }> = { kind: 'line' };
  if (t.tangent !== undefined) {
    if (t.slope !== undefined || t.through !== undefined || t.intercept !== undefined)
      fail(at, 'tangent 는 다른 조건과 함께 쓰지 않음(기울기·점을 곡선에서 계산)');
    const tg = obj(t.tangent, `${at} tangent`, ['curve', 'at']);
    const c = curve(tg.curve, `${at} tangent.curve`);
    const a = numExpr(tg.at, `${at} tangent.at`);
    const ra = exactOf(a.src);
    if (!ra) return fail(`${at} tangent.at`, '유리수여야 함');
    // 파생값은 작성자가 적지 않고 기준 곡선에서 계산한다. sympy diff 와 대조하는 항목은 checks 가 만든다
    const m = evalExact(derivative(c.node, 'x'), { x: ra });
    const y0 = evalExact(c.node, { x: ra });
    if (!m || !y0) return fail(at, '접선 기울기·접점이 유리수로 계산되지 않음(다항·유리식만)');
    out.tangent = { curve: c.id, at: a.src, slope: ratStr(m), y: ratStr(y0) };
  }
  if (t.slope !== undefined) out.slope = rational(target(t.slope, `${at} slope`), `${at} slope`);
  if (t.intercept !== undefined)
    out.intercept = rational(target(t.intercept, `${at} intercept`), `${at} intercept`);
  if (t.through !== undefined) {
    const th = obj(t.through, `${at} through`, ['x', 'y']);
    out.through = {
      x: rational(target(th.x, `${at} through.x`), `${at} through.x`),
      y: rational(target(th.y, `${at} through.y`), `${at} through.y`),
    };
  }
  return out;
}

// ---- 채점 ----

const xyText = (x: string, y: string) => `(${x}, ${y})`;

export function grade(p: CoordParams, s: CoordState): Verdict {
  const t = p.task;
  if (!t) return { ok: false, why: '' };
  if (t.kind === 'point') {
    if (s.user.length === 0) return { ok: false, why: '먼저 점을 찍어 보세요.' };
    if (s.user.length > 1) return { ok: false, why: '점을 하나만 남겨 주세요.' };
    const r = gradePoint(s.user, { i: t.i, j: t.j });
    return { ok: r.ok, why: r.ok ? '' : '그 자리가 아니에요. 가로 좌표부터 다시 세어 보세요.' };
  }
  if (t.kind === 'pointsOn') {
    const on = (g: GridPt) => {
      const x = g.i * p.x.st;
      const fx = fAt(p, s, t.curve, x);
      return Math.abs(g.j * p.y.st - fx) <= 1e-9 * Math.max(1, Math.abs(fx));
    };
    const r = gradePointsOn(s.user, on, t.count);
    if (r.ok) return { ok: true, why: '' };
    if (r.dupX)
      return { ok: false, why: '같은 세로줄에 점이 두 개 있어요. 함수는 x 하나에 y 가 하나예요.' };
    if (r.on < r.total)
      return { ok: false, why: `곡선 위에 있지 않은 점이 ${r.total - r.on}개 있어요.` };
    return { ok: false, why: `곡선 위의 점을 ${t.count}개 이상 찍어 주세요.` };
  }
  if (t.kind === 'line') {
    const [a, b] = s.user as [GridPt, GridPt];
    const lt = lineTarget(t);
    const r = gradeLine(a, b, p.x.exact as Rational, p.y.exact as Rational, lt);
    if (r.ok) return { ok: true, why: '' };
    if (r.vertical)
      return { ok: false, why: '세로선은 기울기가 없어요. 손잡이를 옆으로 옮겨 보세요.' };
    const m = fracText(r.slope as string);
    if (!r.slopeOk && r.throughOk === false)
      return { ok: false, why: `지금 기울기는 ${m}이고, 지나야 할 점도 지나지 않아요.` };
    if (!r.slopeOk) return { ok: false, why: `지금 기울기는 ${m}이에요. 기울기를 다시 보세요.` };
    if (r.throughOk === false && lt.through)
      return {
        ok: false,
        why: `기울기는 맞아요. 점 ${xyText(fracText(lt.through[0]), fracText(lt.through[1]))}을 지나게 옮겨 보세요.`,
      };
    return { ok: false, why: 'y절편이 달라요.' };
  }
  const r = gradeSketch(s.stroke, (x) => fAt(p, s, t.curve, x), p.x.lo, p.x.hi, t.tolN);
  if (r.ok) return { ok: true, why: '' };
  if (r.coverage < 0.8) return { ok: false, why: '왼쪽 끝부터 오른쪽 끝까지 이어서 그어 보세요.' };
  return { ok: false, why: '곡선과 많이 떨어진 곳이 있어요. 다시 그어 보세요.' };
}

/** 직선 과제의 목표(분수 글자). 접선이면 곡선에서 계산한 값 */
export function lineTarget(t: Extract<Task, { kind: 'line' }>) {
  if (t.tangent)
    return { slope: t.tangent.slope, through: [t.tangent.at, t.tangent.y] as [string, string] };
  return {
    ...(t.slope ? { slope: ratOf(t.slope.value) } : {}),
    ...(t.intercept ? { intercept: ratOf(t.intercept.value) } : {}),
    ...(t.through
      ? { through: [ratOf(t.through.x.value), ratOf(t.through.y.value)] as [string, string] }
      : {}),
  };
}
const ratOf = (v: string) => ratStr(exactOf(v) as Rational);
/** "a/b" → 화면 글자(−a/b) */
const fracText = (v: string) => v.replace('-', '−');

/** 그린 직선의 기울기(화면에 늘 보이는 값). 세로면 null */
export function userSlope(p: CoordParams, s: CoordState): string | null {
  const [a, b] = s.user;
  if (!a || !b || a.i === b.i || !p.x.exact || !p.y.exact) return null;
  const r = gradeLine(a, b, p.x.exact, p.y.exact, {});
  return r.slope;
}

// ---- 과제 모드의 그릴 것(객체를 다 그린 뒤에 쌓는다) ----

export function drawTask({ p, s, f, items, handles, readouts }: DrawCtx) {
  if (p.mode === 'plot' || p.mode === 'connect' || p.mode === 'line') {
    if (p.mode === 'connect') {
      const sorted = [...s.user].sort((a, b) => a.i - b.i);
      const d = sorted
        .map((g, k) => {
          const [X, Y] = toPx(p, f, g.i * p.x.st, g.j * p.y.st);
          return `${k ? 'L' : 'M'}${r1(X)} ${r1(Y)}`;
        })
        .join('');
      items.push({ t: 'path', key: 'conn', d, cls: 'conn' });
    }
    if (p.mode === 'line') {
      const [a, b] = s.user as [GridPt, GridPt];
      const vertical = a.i === b.i;
      const [ax, ay] = [a.i * p.x.st, a.j * p.y.st];
      const [bx, by] = [b.i * p.x.st, b.j * p.y.st];
      let ln = hidden0;
      if (vertical) {
        const [X] = toPx(p, f, ax, 0);
        ln = { x1: r1(X), y1: f.t, x2: r1(X), y2: f.b };
      } else ln = fullLine(p, f, ax, ay, (by - ay) / (bx - ax));
      items.push({ t: 'line', key: 'uline', ...ln, cls: 'uline', hidden: false });
      const m = userSlope(p, s);
      readouts.push({
        key: 'uslope',
        label: '그린 직선의 기울기',
        text: m === null ? '—' : fracText(m),
      });
    }
    s.user.forEach((g, n) => {
      const [x, y] = [g.i * p.x.st, g.j * p.y.st];
      const [X, Y] = toPx(p, f, x, y);
      handles.push({
        key: `u${n}`,
        x: r1(X),
        y: r1(Y),
        label: p.mode === 'line' ? `직선 손잡이 ${n + 1}` : `찍은 점 ${n + 1}`,
        value: x,
        min: p.x.lo,
        max: p.x.hi,
        valueText: `(${tickText(p.x, g.i)}, ${tickText(p.y, g.j)})`,
      });
    });
  }
  if (p.mode === 'sketch') {
    const d = s.stroke
      .map(([x, y], k) => {
        const [X, Y] = toPx(p, f, x, y);
        return `${k ? 'L' : 'M'}${r1(X)} ${r1(Y)}`;
      })
      .join('');
    items.push({ t: 'path', key: 'stroke', d, cls: 'stroke' });
  }
}

// ---- 과제 검산 ----

/** 세계 범위·칸 간격(sympy 글자) */
const viewOf = (p: CoordParams) => ({
  x: [p.x.min, p.x.max] as [string, string],
  y: [p.y.min, p.y.max] as [string, string],
  sx: p.x.step,
  sy: p.y.step,
});

/** 값이 정수·분수면 fraction, 아니면(π 등) expr */
const answerOf = (v: string) => {
  const r = exactOf(v);
  return r ? { answer: ratStr(r), answerType: 'fraction' } : { answer: v, answerType: 'expr' };
};

/** 과제가 미분을 쓰는 곡선(접선 과제) */
export const taskDerivOf = (p: CoordParams) =>
  p.task?.kind === 'line' && p.task.tangent ? p.task.tangent.curve : undefined;

/** 과제 검산 항목(객체 검산 뒤에 쌓는다) */
export function taskChecks(p: CoordParams, out: WidgetCheck[]): void {
  const t = p.task;
  if (!t) return;
  const view = viewOf(p);
  if (t.kind === 'point') {
    out.push({ name: '목표 x', ...answerOf(t.x.value), check: t.x.check });
    out.push({ name: '목표 y', ...answerOf(t.y.value), check: t.y.check });
    // 앱이 쓰는 칸 번호가 검산식의 값과 같은가. 문자열로 sympify 해야 1/2 가 실수 0.5 가 되지 않는다
    out.push({
      name: '목표 x 칸',
      answer: String(t.i),
      answerType: 'int',
      check: `sympify("(${t.x.check})/(${p.x.step})")`,
    });
    out.push({
      name: '목표 y 칸',
      answer: String(t.j),
      answerType: 'int',
      check: `sympify("(${t.y.check})/(${p.y.step})")`,
    });
    out.push({ name: '풀 수 있나', kind: 'plot', view, task: 'point', x: t.x.check, y: t.y.check });
  } else if (t.kind === 'pointsOn') {
    const c = curveOf(p, t.curve);
    out.push({
      name: '풀 수 있나',
      kind: 'plot',
      view,
      task: 'pointsOn',
      curve: c.expr,
      count: t.count,
    });
  } else if (t.kind === 'sketch') {
    const c = curveOf(p, t.curve);
    out.push({ name: '풀 수 있나', kind: 'plot', view, task: 'sketch', curve: c.expr, tol: t.tol });
  } else {
    const lt = lineTarget(t);
    if (t.tangent) {
      const c = curveOf(p, t.tangent.curve);
      out.push({
        name: '접선 기울기',
        answer: t.tangent.slope,
        answerType: 'fraction',
        check: `diff(${c.expr},x).subs(x,${t.tangent.at})`,
      });
      // 지나야 할 점이 곡선 위인가(접점의 y 를 곡선에서 계산)
      out.push({
        name: '접점',
        answer: t.tangent.y,
        answerType: 'fraction',
        check: `(${c.expr}).subs(x,${t.tangent.at})`,
      });
    }
    for (const [name, tg] of [
      ['목표 기울기', t.slope],
      ['목표 y절편', t.intercept],
      ['목표 점 x', t.through?.x],
      ['목표 점 y', t.through?.y],
    ] as const)
      if (tg) out.push({ name, ...answerOf(tg.value), check: tg.check });
    out.push({
      name: '풀 수 있나',
      kind: 'plot',
      view,
      task: 'line',
      ...(lt.slope ? { slope: lt.slope } : {}),
      ...(lt.through ? { through: lt.through } : {}),
      ...('intercept' in lt && lt.intercept ? { intercept: lt.intercept } : {}),
    });
  }
}
