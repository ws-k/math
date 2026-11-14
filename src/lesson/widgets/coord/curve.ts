// 곡선 객체 {id, curve:'x**2'}: 형식 검사·곡선 경로 그리기·검산(앱 계산 = sympy)과 곡선 값 계산.
// 점·직선·과제가 곡선 값을 빌려 쓰므로 객체 파일 가운데 가장 아래에 둔다.
import { compile, derivative, evalNum, paritySamples } from '../../expr.ts';
import { fail, obj, oneOf, str } from '../../parse.ts';
import type { Node } from '../../sym.ts';
import { r1, toPx } from './frame.ts';
import type { CoordParams, CoordState, CurveObj, Frame, KindDef } from './types.ts';

const TONES = ['main', 'soft', 'accent'] as const;

export const curveOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is CurveObj => o.kind === 'curve' && o.id === id) as CurveObj;

/** 곡선 값 f(x) (정의 안 되면 NaN) */
export const fAt = (p: CoordParams, s: CoordState, id: string, x: number) =>
  evalNum(curveOf(p, id).node, { ...s.vars, x });

/** f'(x) (기호 미분을 계산) */
export function dfAt(p: CoordParams, s: CoordState, id: string, x: number): number {
  return evalNum(derivative(curveOf(p, id).node, 'x'), { ...s.vars, x });
}

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

export const curveKind: KindDef<CurveObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['id', 'curve'], ['label', 'tone', 'hide']);
    if (c.hide !== undefined && c.hide !== true) fail(`${at} hide`, 'true 만');
    const id = cx.named(c.id, `${at} id`);
    const expr = str(c.curve, `${at} curve`).replace(/\s+/g, '');
    let node: Node;
    try {
      node = compile(expr, cx.vars);
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
      ...(c.hide === true ? { hide: true as const } : {}),
    };
    cx.curves.set(id, co);
    return co;
  },
  draw(o, k, { p, s, f, items }) {
    // 숨긴 정답 곡선은 맞히기 전에는 경로를 비워 둔다(숨김 표시만 하면 모양이 DOM 에 남는다)
    const d = o.hide && !s.solved ? '' : curvePath(p, s, o, f);
    items.push({ t: 'path', key: `c${k}`, d, cls: `curve ${o.tone}` });
  },
  checks(o, { vars, range, fixed, deriv, out }) {
    out.push({
      name: `곡선 ${o.id} 계산`,
      kind: 'parity',
      expr: o.expr,
      ...paritySamples(o.expr, vars, range, fixed),
    });
    if (deriv.has(o.id)) {
      // 접선·기울기는 앱이 기호 미분으로 계산한다 — sympy diff 와 같은 값인지
      const e = `diff(${o.expr},x)`;
      out.push({
        name: `곡선 ${o.id} 미분`,
        kind: 'parity',
        expr: e,
        ...paritySamples(e, vars, range, fixed),
      });
    }
  },
  texts: (o) => (o.label ? [o.label] : []),
};
