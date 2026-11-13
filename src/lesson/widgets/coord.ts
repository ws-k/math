// 좌표평면 부품의 모델(순수). 화면(Coord.tsx)·검산(checks)·채점(grade.ts)이 이 함수들을 같이 쓴다.
//
// 매개변수는 "이름 붙은 객체 + 참조" 목록이다:
//   {id:'f', curve:'x**2'} · {id:'P', point:{on:'f', x:1}} · {secant:['P','Q']} ·
//   {tangent:{on:'f', at:'P'}} · {readout:'slope(P,Q)', label:'…'}
// 점 좌표는 칸 번호(정수)로 쥔다. 세계 좌표 = 칸 번호 × 칸 간격. 부동소수 찌꺼기 없이 "같은 점"을 판정하려고.
//
// 끄는 동안의 갱신은 draw(매개변수, 상태, 크기) → 그릴 목록 하나로 한다. 화면은 이 목록을 React 로 처음 그리고,
// 끄는 동안에는 같은 목록을 DOM 에 직접 적용한다(React 렌더 없음) — 두 갈래로 그리면 어긋난다.
import { LITERAL } from '../../content/check.ts';
import { compareAnswer } from '../../lib/answer.ts';
import {
  compile,
  derivative,
  evalExact,
  evalNum,
  exactOf,
  exactStr,
  paritySamples,
} from '../expr.ts';
import { type GridPt, gradeLine, gradePoint, gradePointsOn, gradeSketch } from '../grade.ts';
import { arr, fail, int, type Obj, obj, oneOf, optStr, str } from '../parse.ts';
import { type Node, parseSym, type Rational, ratStr } from '../sym.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type Mode = 'explore' | 'plot' | 'line' | 'connect' | 'sketch';
export type Tone = 'main' | 'soft' | 'accent';

export interface Axis {
  /** 원문(sympy 식 글자) — 검산에 그대로 넘긴다 */
  min: string;
  max: string;
  step: string;
  lo: number;
  hi: number;
  /** 칸 간격(수) */
  st: number;
  /** 칸 간격이 유리수면 분수, π 가 든 간격이면 null */
  exact: Rational | null;
}

/** 채점 목표값: 앱이 쓰는 값(value)과 그 값을 문제 조건으로 계산하는 sympy 식(check) */
export interface Target {
  value: string;
  check: string;
}

export interface CurveObj {
  kind: 'curve';
  id: string;
  expr: string;
  node: Node;
  /** 범례 글(Rich) */
  label?: string;
  tone: Tone;
}
export interface PointObj {
  kind: 'point';
  id: string;
  /** 곡선 위 점이면 곡선 id. 아니면 칸 위 점 */
  on?: string;
  drag: 'none' | 'x' | 'xy';
  /** 곡선 위 점이 x 로 움직이는 간격(원문). 칸 위 점은 칸 간격 */
  snap: string;
  snapN: number;
  /** 처음 자리(칸 번호) */
  i: number;
  j: number;
  /** 그림 위 이름(P, Q). 짧은 글자 */
  name?: string;
}
export interface SecantObj {
  kind: 'secant';
  a: string;
  b: string;
}
export interface TangentObj {
  kind: 'tangent';
  on: string;
  at: string;
}
export type ReadoutExpr =
  | { f: 'slope'; a: string; b: string }
  | { f: 'deriv'; curve: string; at: string }
  | { f: 'x' | 'y'; at: string }
  | { f: 'value'; slider: string };
export interface ReadoutObj {
  kind: 'readout';
  src: string;
  expr: ReadoutExpr;
  label: string;
  digits: number;
}
export type CoordObj = CurveObj | PointObj | SecantObj | TangentObj | ReadoutObj;

export interface Slider {
  id: string;
  min: number;
  max: number;
  step: number;
  stepSrc: string;
  value: number;
  label: string;
}

export type Task =
  | { kind: 'point'; x: Target; y: Target; i: number; j: number }
  | { kind: 'pointsOn'; curve: string; count: number }
  | {
      kind: 'line';
      slope?: Target;
      through?: { x: Target; y: Target };
      intercept?: Target;
      tangent?: { curve: string; at: string; slope: string; y: string };
    }
  | { kind: 'sketch'; curve: string; tol: string; tolN: number };

export interface Goal {
  approach: [string, string];
  /** 이만큼 가까워지면 목표(세계 x 거리). 0 이면 겹쳐야 */
  within: number;
}

export interface CoordParams {
  mode: Mode;
  x: Axis;
  y: Axis;
  objects: CoordObj[];
  sliders: Slider[];
  task?: Task;
  goal?: Goal;
  /** 처음 안내(Rich) */
  intro?: string;
  /** 목표를 이뤘을 때(Rich) */
  done?: string;
  /** 직선 그리기의 두 손잡이 처음 자리(칸 번호) */
  start?: [GridPt, GridPt];
}

// ---- 형식 검사 ----

/** 찍기·그리기 모드에서 x·y 방향 칸 수 상한. 가장 좁은 화면(382px)에서도 한 칸이 손가락으로 고를 만큼(약 20px) */
export const MAX_CELLS = 12;
/** 곡선 위 점을 끌 때 x 방향 칸 수 상한(끄는 간격이 6px 아래로 가지 않게) */
export const MAX_SNAPS = 50;

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

function numExpr(v: unknown, at: string): { src: string; n: number } {
  let src: string;
  if (typeof v === 'number') src = exactStr(v);
  else src = str(v, at).replace(/\s+/g, '');
  let n: number;
  try {
    n = evalNum(compile(src, []), {});
  } catch (e) {
    return fail(at, (e as Error).message);
  }
  if (Number.isNaN(n)) fail(at, `수가 아님 (${src})`);
  return { src, n };
}

function axis(v: unknown, at: string): Axis {
  const o = obj(v, at, ['min', 'max', 'step']);
  const min = numExpr(o.min, `${at} min`);
  const max = numExpr(o.max, `${at} max`);
  const step = numExpr(o.step, `${at} step`);
  if (!(max.n > min.n)) fail(at, 'max 가 min 보다 커야 함');
  if (!(step.n > 0)) fail(`${at} step`, '0 보다 커야 함');
  if ((max.n - min.n) / step.n > 40) fail(at, '칸이 너무 많음(40칸 이하)');
  return {
    min: min.src,
    max: max.src,
    step: step.src,
    lo: min.n,
    hi: max.n,
    st: step.n,
    exact: exactOf(step.src),
  };
}

/** 값을 칸 번호로. 칸 위가 아니면 형식 오류 */
function toIndex(n: number, step: number, at: string): number {
  const k = Math.round(n / step);
  if (!near(k * step, n)) fail(at, `칸 위가 아님 (${n} 은 ${step} 의 배수가 아님)`);
  return k;
}

function target(v: unknown, at: string): Target {
  const o = obj(v, at, ['value', 'check']);
  const value = str(o.value, `${at} value`).replace(/\s+/g, '');
  try {
    compile(value, []);
  } catch (e) {
    fail(`${at} value`, (e as Error).message);
  }
  const check = str(o.check, `${at} check`);
  if (LITERAL.test(check))
    fail(`${at} check`, '답을 그대로 적은 값 — 문제 조건으로 계산하는 식이어야 함');
  return { value, check };
}

const SLOPE_RE = /^slope\((\w+),(\w+)\)$/;
const DERIV_RE = /^deriv\((\w+),(\w+)\)$/;
const XY_RE = /^([xy])\((\w+)\)$/;
const VALUE_RE = /^value\((\w+)\)$/;

function readoutExpr(s: string, at: string): ReadoutExpr {
  const t = s.replace(/\s+/g, '');
  let m = t.match(SLOPE_RE);
  if (m) return { f: 'slope', a: m[1] as string, b: m[2] as string };
  m = t.match(DERIV_RE);
  if (m) return { f: 'deriv', curve: m[1] as string, at: m[2] as string };
  m = t.match(XY_RE);
  if (m) return { f: m[1] as 'x' | 'y', at: m[2] as string };
  m = t.match(VALUE_RE);
  if (m) return { f: 'value', slider: m[1] as string };
  return fail(at, `slope(P,Q)·deriv(f,P)·x(P)·y(P)·value(a) 중 하나가 아님 (${s})`);
}

const ID = /^[A-Za-z][A-Za-z0-9]{0,5}$/;
const TONES = ['main', 'soft', 'accent'] as const;

export function parseCoord(raw: unknown): CoordParams {
  const o = obj(
    raw,
    '좌표',
    ['mode', 'x', 'y', 'objects'],
    ['sliders', 'task', 'goal', 'intro', 'done', 'start'],
  );
  const mode = oneOf(o.mode, '좌표 mode', [
    'explore',
    'plot',
    'line',
    'connect',
    'sketch',
  ] as const);
  const x = axis(o.x, '좌표 x');
  const y = axis(o.y, '좌표 y');
  if (mode !== 'explore' && mode !== 'sketch') {
    const cx = (x.hi - x.lo) / x.st;
    const cy = (y.hi - y.lo) / y.st;
    if (cx > MAX_CELLS || cy > MAX_CELLS)
      fail(
        '좌표',
        `찍기·그리기 모드는 칸이 ${MAX_CELLS}칸 이하(지금 ${cx}×${cy}) — 한 칸이 손가락보다 작아짐`,
      );
  }
  const sliders: Slider[] = (
    o.sliders === undefined ? [] : arr(o.sliders, '좌표 sliders', 1, 3)
  ).map((rs, k) => {
    const at = `좌표 슬라이더${k + 1}`;
    const s = obj(rs, at, ['id', 'min', 'max', 'step', 'value', 'label']);
    const id = str(s.id, `${at} id`);
    if (!/^[abcdhkmnpqrst]$/.test(id))
      fail(`${at} id`, '식에 쓸 수 있는 한 글자(a·b·c·d·h·k·m·n·p·q·r·s·t)');
    const min = numExpr(s.min, `${at} min`).n;
    const max = numExpr(s.max, `${at} max`).n;
    const step = numExpr(s.step, `${at} step`);
    const value = numExpr(s.value, `${at} value`).n;
    if (!(max > min) || value < min || value > max) fail(at, '범위가 이상함');
    toIndex(value - min, step.n, `${at} value`);
    return {
      id,
      min,
      max,
      step: step.n,
      stepSrc: step.src,
      value,
      label: str(s.label, `${at} label`),
    };
  });
  const vars = ['x', ...sliders.map((s) => s.id)];
  const env0: Record<string, number> = Object.fromEntries(sliders.map((s) => [s.id, s.value]));

  const objects: CoordObj[] = [];
  const ids = new Set<string>();
  const curves = new Map<string, CurveObj>();
  const points = new Map<string, PointObj>();
  const named = (id: unknown, at: string) => {
    const s = str(id, at);
    if (!ID.test(s)) fail(at, `이름은 영문으로 시작하는 6자 이하 (${s})`);
    if (ids.has(s)) fail(at, `이름 중복 (${s})`);
    ids.add(s);
    return s;
  };
  const curveRef = (v: unknown, at: string) => {
    const c = curves.get(str(v, at));
    if (!c) return fail(at, `앞에 없는 곡선 ${String(v)}`);
    return c;
  };
  const pointRef = (v: unknown, at: string) => {
    const p = points.get(str(v, at));
    if (!p) return fail(at, `앞에 없는 점 ${String(v)}`);
    return p;
  };
  arr(o.objects, '좌표 objects', 1, 16).forEach((ro, k) => {
    const at = `좌표 객체${k + 1}`;
    const r = (typeof ro === 'object' && ro !== null ? ro : {}) as Obj;
    if ('curve' in r) {
      const c = obj(ro, at, ['id', 'curve'], ['label', 'tone']);
      const id = named(c.id, `${at} id`);
      const expr = str(c.curve, `${at} curve`).replace(/\s+/g, '');
      let node: Node;
      try {
        node = compile(expr, vars);
      } catch (e) {
        node = fail(`${at} curve`, (e as Error).message);
      }
      const co: CurveObj = {
        kind: 'curve',
        id,
        expr,
        node,
        ...(c.label !== undefined ? { label: str(c.label, `${at} label`) } : {}),
        tone: c.tone === undefined ? 'main' : oneOf(c.tone, `${at} tone`, TONES),
      };
      curves.set(id, co);
      objects.push(co);
    } else if ('point' in r) {
      const c = obj(ro, at, ['id', 'point'], ['name']);
      const id = named(c.id, `${at} id`);
      const pp = obj(c.point, `${at} point`, ['x'], ['on', 'y', 'drag', 'snap']);
      const name = optStr(c.name, `${at} name`);
      if (name !== undefined && !/^[A-Za-z][']?$/.test(name))
        fail(`${at} name`, '한 글자(P, Q, A′)');
      const xv = numExpr(pp.x, `${at} x`);
      if (pp.on !== undefined) {
        const cv = curveRef(pp.on, `${at} on`);
        if (pp.y !== undefined) fail(at, '곡선 위 점은 y 를 적지 않음(곡선에서 계산)');
        const drag =
          pp.drag === undefined ? 'none' : oneOf(pp.drag, `${at} drag`, ['none', 'x'] as const);
        const snap =
          pp.snap === undefined ? { src: x.step, n: x.st } : numExpr(pp.snap, `${at} snap`);
        if ((x.hi - x.lo) / snap.n > MAX_SNAPS)
          fail(`${at} snap`, `끄는 간격이 너무 촘촘함(${MAX_SNAPS}칸 이하)`);
        const i = toIndex(xv.n, snap.n, `${at} x`);
        if (xv.n < x.lo || xv.n > x.hi) fail(`${at} x`, '화면 밖');
        const yy = evalNum(cv.node, { ...env0, x: xv.n });
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
        points.set(id, po);
        objects.push(po);
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
        points.set(id, po);
        objects.push(po);
      }
    } else if ('secant' in r) {
      const c = obj(ro, at, ['secant']);
      const [a, b] = arr(c.secant, `${at} secant`, 2, 2);
      objects.push({ kind: 'secant', a: pointRef(a, at).id, b: pointRef(b, at).id });
    } else if ('tangent' in r) {
      const c = obj(ro, at, ['tangent']);
      const t = obj(c.tangent, `${at} tangent`, ['on', 'at']);
      const cv = curveRef(t.on, `${at} on`);
      const pt = pointRef(t.at, `${at} at`);
      if (pt.on !== cv.id) fail(at, `접점 ${pt.id} 가 곡선 ${cv.id} 위의 점이 아님`);
      try {
        derivative(cv.node, 'x');
      } catch (e) {
        fail(at, (e as Error).message);
      }
      objects.push({ kind: 'tangent', on: cv.id, at: pt.id });
    } else if ('readout' in r) {
      const c = obj(ro, at, ['readout', 'label'], ['digits']);
      const src = str(c.readout, `${at} readout`);
      const e = readoutExpr(src, at);
      if (e.f === 'slope') {
        pointRef(e.a, at);
        pointRef(e.b, at);
      } else if (e.f === 'deriv') {
        const cv = curveRef(e.curve, at);
        if (pointRef(e.at, at).on !== cv.id) fail(at, '접점이 그 곡선 위 점이 아님');
      } else if (e.f === 'value') {
        if (!sliders.some((s) => s.id === e.slider)) fail(at, `없는 슬라이더 ${e.slider}`);
      } else pointRef(e.at, at);
      objects.push({
        kind: 'readout',
        src,
        expr: e,
        label: str(c.label, `${at} label`),
        digits: c.digits === undefined ? 2 : int(c.digits, `${at} digits`, 0, 4),
      });
    } else fail(at, 'curve·point·secant·tangent·readout 중 하나여야 함');
  });

  const p: CoordParams = {
    mode,
    x,
    y,
    objects,
    sliders,
    ...(o.intro !== undefined ? { intro: str(o.intro, '좌표 intro') } : {}),
    ...(o.done !== undefined ? { done: str(o.done, '좌표 done') } : {}),
  };

  if (o.goal !== undefined) {
    if (mode !== 'explore') fail('좌표 goal', 'explore 모드에서만(다른 모드는 task)');
    const g = obj(o.goal, '좌표 goal', ['approach'], ['within']);
    const [a, b] = arr(g.approach, '좌표 goal.approach', 2, 2);
    const pa = pointRef(a, '좌표 goal');
    const pb = pointRef(b, '좌표 goal');
    if (pa.drag === 'none') fail('좌표 goal', `${pa.id} 는 끌 수 없는 점`);
    const within = g.within === undefined ? 0 : numExpr(g.within, '좌표 goal.within').n;
    p.goal = { approach: [pa.id, pb.id], within };
    // 끄는 간격으로 닿을 수 있는 목표인가(겹쳐야 하면 b 의 x 가 a 의 끄는 칸 위에 있어야)
    const xb = worldX(p, pb, pb.i);
    const k = (xb - 0) / pa.snapN;
    if (within === 0 && !near(Math.round(k) * pa.snapN, xb))
      fail('좌표 goal', `${pa.id} 를 끌어서는 ${pb.id} 에 닿을 수 없음(끄는 간격)`);
  }

  if (o.task !== undefined) p.task = parseTask(o.task, p, curves);
  else if (mode !== 'explore') fail('좌표', `${mode} 모드에는 task 가 필요함`);

  if (o.start !== undefined) {
    if (mode !== 'line') fail('좌표 start', 'line 모드에서만');
    const pts = arr(o.start, '좌표 start', 2, 2).map((rp, k) => {
      const [sx, sy] = arr(rp, `좌표 start${k + 1}`, 2, 2);
      return {
        i: toIndex(numExpr(sx, '좌표 start').n, x.st, '좌표 start'),
        j: toIndex(numExpr(sy, '좌표 start').n, y.st, '좌표 start'),
      };
    }) as [GridPt, GridPt];
    if (pts[0].i === pts[1].i && pts[0].j === pts[1].j) fail('좌표 start', '두 점이 같음');
    p.start = pts;
  }
  return p;
}

function parseTask(raw: unknown, p: CoordParams, curves: Map<string, CurveObj>): Task {
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

// ---- 상태 ----

export interface CoordState {
  vars: Record<string, number>;
  /** 움직이는 점의 칸 번호(곡선 위 점은 i 만 쓴다) */
  pts: Record<string, GridPt>;
  /** 찍은 점(plot·connect) 또는 직선 손잡이 두 개(line) */
  user: GridPt[];
  /** 그은 선(세계 좌표). sketch */
  stroke: [number, number][];
}

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
    vars: Object.fromEntries(p.sliders.map((s) => [s.id, s.value])),
    pts,
    user: p.mode === 'line' ? (p.start ?? defaultStart(p)).map((g) => ({ ...g })) : [],
    stroke: [],
  };
}

const curveOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is CurveObj => o.kind === 'curve' && o.id === id) as CurveObj;
const pointOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is PointObj => o.kind === 'point' && o.id === id) as PointObj;

function worldX(p: CoordParams, o: PointObj, i: number): number {
  return o.on ? i * o.snapN : i * p.x.st;
}

/** 곡선 값 f(x) (정의 안 되면 NaN) */
export const fAt = (p: CoordParams, s: CoordState, id: string, x: number) =>
  evalNum(curveOf(p, id).node, { ...s.vars, x });

/** f'(x) (기호 미분을 계산) */
export function dfAt(p: CoordParams, s: CoordState, id: string, x: number): number {
  return evalNum(derivative(curveOf(p, id).node, 'x'), { ...s.vars, x });
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
function coincide(p: CoordParams, s: CoordState, a: string, b: string): string | null {
  const pa = pointOf(p, a);
  const pb = pointOf(p, b);
  if (!pa.on || pa.on !== pb.on) return null;
  return near(pointXY(p, s, a)[0], pointXY(p, s, b)[0]) ? pa.on : null;
}

/** 읽는 값(수). 할선의 두 점이 겹치면 그 곡선의 접선 기울기(극한) */
export function readout(p: CoordParams, s: CoordState, e: ReadoutExpr): number {
  switch (e.f) {
    case 'slope': {
      const c = coincide(p, s, e.a, e.b);
      const [x1, y1] = pointXY(p, s, e.a);
      if (c) return dfAt(p, s, c, x1);
      const [x2, y2] = pointXY(p, s, e.b);
      return x1 === x2 ? Number.NaN : (y2 - y1) / (x2 - x1);
    }
    case 'deriv':
      return dfAt(p, s, e.curve, pointXY(p, s, e.at)[0]);
    case 'x':
      return pointXY(p, s, e.at)[0];
    case 'y':
      return pointXY(p, s, e.at)[1];
    case 'value':
      return s.vars[e.slider] ?? Number.NaN;
  }
}

/** 화면 숫자: 자리수만큼, 음수는 진짜 빼기 기호, 정의 안 되면 — */
export function fmtNum(v: number, digits: number): string {
  if (!Number.isFinite(v)) return '—';
  let t = v.toFixed(digits);
  if (digits > 0) t = t.replace(/\.?0+$/, '');
  if (/^-0(\.0*)?$/.test(t)) t = '0';
  return t.replace('-', '−');
}

// ---- 화면 좌표 ----

export interface Box {
  w: number;
  h: number;
}
export interface Frame {
  l: number;
  r: number;
  t: number;
  b: number;
}

/** 그림 영역(눈금 글자 자리를 뺀 안쪽) */
export const frame = (b: Box): Frame => ({ l: 34, r: b.w - 14, t: 14, b: b.h - 26 });

export function toPx(p: CoordParams, f: Frame, x: number, y: number): [number, number] {
  return [
    f.l + ((x - p.x.lo) / (p.x.hi - p.x.lo)) * (f.r - f.l),
    f.b - ((y - p.y.lo) / (p.y.hi - p.y.lo)) * (f.b - f.t),
  ];
}
export function toWorld(p: CoordParams, f: Frame, px: number, py: number): [number, number] {
  return [
    p.x.lo + ((px - f.l) / (f.r - f.l)) * (p.x.hi - p.x.lo),
    p.y.lo + ((f.b - py) / (f.b - f.t)) * (p.y.hi - p.y.lo),
  ];
}

/** 끄는 간격의 배수: 한 간격이 minPx 보다 작으면 1·2·5·10… 배로 묶는다(손떨림에 값이 튀지 않게) */
export function snapMult(stepPx: number, minPx: number): number {
  for (const k of [1, 2, 5, 10, 20, 50]) if (stepPx * k >= minPx) return k;
  return 100;
}
/** 곡선 위 점을 끌 때 한 간격의 최소 픽셀 */
export const MIN_SNAP_PX = 8;

const iRange = (lo: number, hi: number, st: number) => [
  Math.ceil(lo / st - 1e-9),
  Math.floor(hi / st + 1e-9),
];

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
  const f = frame(box);
  const [wx, wy] = toWorld(p, f, px, py);
  if (o.on) {
    const pxPerStep = (o.snapN / (p.x.hi - p.x.lo)) * (f.r - f.l);
    const k = snapMult(pxPerStep, MIN_SNAP_PX);
    const [lo, hi] = iRange(p.x.lo, p.x.hi, o.snapN);
    const i = Math.min(hi as number, Math.max(lo as number, Math.round(wx / (o.snapN * k)) * k));
    if (Number.isNaN(fAt(p, s, o.on, i * o.snapN))) return s;
    return { ...s, pts: { ...s.pts, [id]: { i, j: 0 } } };
  }
  return { ...s, pts: { ...s.pts, [id]: gridAt(p, wx, wy) } };
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
    const [lo, hi] = iRange(p.x.lo, p.x.hi, o.snapN) as [number, number];
    const i = Math.min(hi, Math.max(lo, g.i + step));
    if (Number.isNaN(fAt(p, s, o.on, i * o.snapN))) return s;
    return { ...s, pts: { ...s.pts, [handle]: { i, j: 0 } } };
  }
  return {
    ...s,
    pts: { ...s.pts, [handle]: gridAt(p, (g.i + d[0]) * p.x.st, (g.j + d[1]) * p.y.st) },
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
  const [wx, wy] = toWorld(p, frame(box), px, py);
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

/** 탐색 목표: 끄는 점이 상대 점에 within 만큼 다가갔나 */
export function goalMet(p: CoordParams, s: CoordState): boolean {
  if (!p.goal) return false;
  const [a, b] = p.goal.approach;
  return Math.abs(pointXY(p, s, a)[0] - pointXY(p, s, b)[0]) <= p.goal.within + 1e-12;
}

// ---- 채점 ----

export interface Verdict {
  ok: boolean;
  /** 화면에 보일 까닭(틀렸을 때). 맞으면 p.done 을 보인다 */
  why: string;
}

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

// ---- 그릴 목록 ----

export type Item =
  | { t: 'path'; key: string; d: string; cls: string }
  | {
      t: 'line';
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      cls: string;
      hidden: boolean;
    }
  | { t: 'dot'; key: string; x: number; y: number; cls: string; hidden: boolean }
  | { t: 'label'; key: string; x: number; y: number; text: string; hidden: boolean };

export interface HandleItem {
  key: string;
  x: number;
  y: number;
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
}

export interface Drawing {
  items: Item[];
  handles: HandleItem[];
  readouts: { key: string; label: string; text: string }[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** 곡선 경로(px). 정의 안 되는 곳·크게 튀는 곳(점근선)에서 끊는다 */
function curvePath(p: CoordParams, s: CoordState, c: CurveObj, f: Frame): string {
  const n = Math.max(60, Math.round((f.r - f.l) / 2));
  const span = f.b - f.t;
  let d = '';
  let prev: number | null = null;
  for (let k = 0; k <= n; k++) {
    const x = p.x.lo + ((p.x.hi - p.x.lo) * k) / n;
    const y = evalNum(c.node, { ...s.vars, x });
    if (Number.isNaN(y)) {
      prev = null;
      continue;
    }
    const [X, Y0] = toPx(p, f, x, y);
    // 화면 밖으로 멀리 간 값은 잘라 둔다(SVG 좌표가 너무 커지지 않게, 잘린 부분은 clipPath 가 가린다)
    const Y = Math.max(f.t - span, Math.min(f.b + span, Y0));
    const jump = prev !== null && Math.abs(Y - prev) > span * 1.5;
    d += `${prev === null || jump ? 'M' : 'L'}${r1(X)} ${r1(Y)}`;
    prev = Y;
  }
  return d;
}

/** (x0,y0) 를 지나고 기울기 m 인 직선을 그림 영역 가로 끝까지 */
function fullLine(p: CoordParams, f: Frame, x0: number, y0: number, m: number) {
  const [X1, Y1] = toPx(p, f, p.x.lo, y0 + m * (p.x.lo - x0));
  const [X2, Y2] = toPx(p, f, p.x.hi, y0 + m * (p.x.hi - x0));
  return { x1: r1(X1), y1: r1(Y1), x2: r1(X2), y2: r1(Y2) };
}

const hidden0 = { x1: 0, y1: 0, x2: 0, y2: 0 };

/**
 * (매개변수, 상태, 크기) → 그릴 것 전부. 화면의 처음 그리기와 끄는 동안의 직접 적용이 이 함수 하나를 쓴다.
 * 끄는 동안 항목이 생기거나 사라지면 직접 적용이 못 따라가므로, 항목은 늘 같은 key 로 두고 hidden 으로 숨긴다.
 */
export function draw(p: CoordParams, s: CoordState, box: Box): Drawing {
  const f = frame(box);
  const items: Item[] = [];
  const handles: HandleItem[] = [];
  const readouts: Drawing['readouts'] = [];
  for (const [k, o] of p.objects.entries()) {
    if (o.kind === 'curve')
      items.push({ t: 'path', key: `c${k}`, d: curvePath(p, s, o, f), cls: `curve ${o.tone}` });
    else if (o.kind === 'secant' || o.kind === 'tangent') {
      let ln: { x1: number; y1: number; x2: number; y2: number } | null = null;
      let tangent = o.kind === 'tangent';
      if (o.kind === 'secant') {
        const [x1, y1] = pointXY(p, s, o.a);
        const [x2, y2] = pointXY(p, s, o.b);
        const c = coincide(p, s, o.a, o.b);
        if (c) {
          // 두 점이 겹치면 할선의 극한 = 접선
          const m = dfAt(p, s, c, x1);
          if (Number.isFinite(m)) ln = fullLine(p, f, x1, y1, m);
          tangent = true;
        } else if (x1 !== x2 && [y1, y2].every(Number.isFinite))
          ln = fullLine(p, f, x1, y1, (y2 - y1) / (x2 - x1));
      } else {
        const [x0, y0] = pointXY(p, s, o.at);
        const m = dfAt(p, s, o.on, x0);
        if (Number.isFinite(m) && Number.isFinite(y0)) ln = fullLine(p, f, x0, y0, m);
      }
      items.push({
        t: 'line',
        key: `l${k}`,
        ...(ln ?? hidden0),
        cls: tangent ? 'tan' : 'sec',
        hidden: !ln,
      });
    } else if (o.kind === 'point') {
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
    } else if (o.kind === 'readout') {
      readouts.push({
        key: `r${k}`,
        label: o.label,
        text: fmtNum(readout(p, s, o.expr), o.digits),
      });
    }
  }
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
  return { items, handles, readouts };
}

// ---- 눈금 ----

/** 칸 간격이 π 의 유리수 배인가: 그 배수(분자, 분모) */
function piRatio(step: number): [number, number] | null {
  const r = step / Math.PI;
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(r * d);
    if (n > 0 && Math.abs(r * d - n) < 1e-9) return [n, d];
  }
  return null;
}

const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : Math.abs(a));

/** 칸 번호 k 의 눈금 글자(1/2·π/6·2π 등) */
export function tickText(a: Axis, k: number): string {
  if (k === 0) return '0';
  if (a.exact) {
    const [n, d] = a.exact;
    const num = BigInt(k) * n;
    const g = BigInt(gcdN(Number(num < 0n ? -num : num), Number(d)));
    const nn = num / g;
    const dd = d / g;
    return (dd === 1n ? `${nn}` : `${nn}/${dd}`).replace('-', '−');
  }
  const pr = piRatio(a.st);
  if (!pr) return fmtNum(k * a.st, 2);
  const n = k * pr[0];
  const g = gcdN(Math.abs(n), pr[1]);
  const nn = n / g;
  const dd = pr[1] / g;
  const head = nn === 1 ? 'π' : nn === -1 ? '−π' : `${String(nn).replace('-', '−')}π`;
  return dd === 1 ? head : `${head}/${dd}`;
}

export interface Grid {
  xs: { px: number; k: number; label: string | null; axis: boolean }[];
  ys: { px: number; k: number; label: string | null; axis: boolean }[];
}

/** 격자선과 눈금 글자(글자는 서로 28px 이상 떨어지게 몇 칸 걸러). 크기에만 달려 끄는 동안 바뀌지 않는다 */
export function grid(p: CoordParams, box: Box): Grid {
  const f = frame(box);
  const make = (a: Axis, len: number, horiz: boolean) => {
    const [k0, k1] = iRange(a.lo, a.hi, a.st) as [number, number];
    const per = (a.st / (a.hi - a.lo)) * len;
    const every = Math.max(1, Math.ceil(28 / per));
    const out: Grid['xs'] = [];
    for (let k = k0; k <= k1; k++) {
      const [X, Y] = horiz ? toPx(p, f, k * a.st, p.y.lo) : toPx(p, f, p.x.lo, k * a.st);
      out.push({
        px: r1(horiz ? X : Y),
        k,
        label: k % every === 0 ? tickText(a, k) : null,
        axis: k === 0,
      });
    }
    return out;
  };
  return { xs: make(p.x, f.r - f.l, true), ys: make(p.y, f.b - f.t, false) };
}

// ---- 검산 ----

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

/** 미분이 쓰이는 곡선(접선·할선 극한·deriv 읽기·접선 과제) */
function derivUsed(p: CoordParams): Set<string> {
  const out = new Set<string>();
  for (const o of p.objects) {
    if (o.kind === 'tangent') out.add(o.on);
    if (o.kind === 'secant') {
      const a = pointOf(p, o.a);
      if (a.on && a.on === pointOf(p, o.b).on) out.add(a.on);
    }
    if (o.kind === 'readout' && o.expr.f === 'deriv') out.add(o.expr.curve);
    if (o.kind === 'readout' && o.expr.f === 'slope') {
      const a = pointOf(p, o.expr.a);
      if (a.on && a.on === pointOf(p, o.expr.b).on) out.add(a.on);
    }
  }
  if (p.task?.kind === 'line' && p.task.tangent) out.add(p.task.tangent.curve);
  return out;
}

export function coordChecks(p: CoordParams): WidgetCheck[] {
  const out: WidgetCheck[] = [];
  const vars = ['x', ...p.sliders.map((s) => s.id)];
  const fixed = Object.fromEntries(p.sliders.map((s) => [s.id, exactStr(s.value)]));
  const range = { x: [p.x.min, p.x.max] as [string, string] };
  const dset = derivUsed(p);
  for (const o of p.objects) {
    if (o.kind !== 'curve') continue;
    out.push({
      name: `곡선 ${o.id} 계산`,
      kind: 'parity',
      expr: o.expr,
      ...paritySamples(o.expr, vars, range, fixed),
    });
    if (dset.has(o.id)) {
      // 접선·기울기는 앱이 기호 미분으로 계산한다 — sympy diff 와 같은 값인지
      const e = `diff(${o.expr},x)`;
      out.push({
        name: `곡선 ${o.id} 미분`,
        kind: 'parity',
        expr: e,
        ...paritySamples(e, vars, range, fixed),
      });
    }
  }
  const t = p.task;
  if (!t) return out;
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
  return out;
}

/** 목표 값끼리 비교(앱 채점에 쓰는 값이 분수 글자로 같은가) — 테스트용 */
export const sameValue = (a: string, b: string) => compareAnswer(a, b, 'fraction') === 'correct';

export const coordDef: WidgetDef<CoordParams> = {
  parse: parseCoord,
  checks: coordChecks,
  texts(p) {
    const out: string[] = [];
    if (p.intro) out.push(p.intro);
    if (p.done) out.push(p.done);
    for (const s of p.sliders) out.push(s.label);
    for (const o of p.objects) {
      if (o.kind === 'curve' && o.label) out.push(o.label);
      if (o.kind === 'readout') out.push(o.label);
    }
    return out;
  },
};

/** 범례 등에서 식 글자를 다시 읽을 때 */
export const parseExpr = parseSym;
