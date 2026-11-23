// 곡선 객체 {id, curve:'x**2'}: 형식 검사·곡선 경로 그리기·검산(앱 계산 = sympy)과 곡선 값 계산.
// 점·직선·과제가 곡선 값을 빌려 쓰므로 객체 파일 가운데 가장 아래에 둔다.
// 조각 함수·구간만 그리기({curve:[{y, x}…]} · {curve, x})도 곡선이다 — 점이 그 위에 놓이고 접선이 닿아야 해서.
// 조각 몫(구간 읽기·끝 표시·Piecewise 검산)은 piece.ts 에 있고, 곡선 값은 늘 여기 fAt·curveExact 로 구한다.
import { compile, derivative, evalExact, evalNum, paritySamples, varsOf } from '../../expr.ts';
import { fail, obj, oneOf, str } from '../../parse.ts';
import type { Node, Rational } from '../../sym.ts';
import { samplePath } from './frame.ts';
import { drawEnds, nodeAt, parsePieces, pieceChecks, piecesPath, piecesSym } from './piece.ts';
import type { CoordParams, CoordState, CurveObj, Frame, KindDef } from './types.ts';

const TONES = ['main', 'soft', 'accent'] as const;

export const curveOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is CurveObj => o.kind === 'curve' && o.id === id) as CurveObj;

/** 곡선 값 c(x) — env 에 x 와 슬라이더 값. 조각 곡선은 x 가 든 조각의 식(없으면 NaN) */
export function curveNum(c: CurveObj, env: Record<string, number>): number {
  const n = nodeAt(c, env.x as number);
  return n ? evalNum(n, env) : Number.NaN;
}

/** 곡선 값 f(x) (정의 안 되면 NaN) */
export const fAt = (p: CoordParams, s: CoordState, id: string, x: number) =>
  curveNum(curveOf(p, id), { ...s.vars, x });

/** f'(x) (기호 미분을 계산). 조각 곡선은 그 x 의 조각을 미분 — 경계에서는 닫힌 쪽 조각(sympy diff(Piecewise) 와 같음) */
export function dfAt(p: CoordParams, s: CoordState, id: string, x: number): number {
  const n = nodeAt(curveOf(p, id), x);
  return n ? evalNum(derivative(n, 'x'), { ...s.vars, x }) : Number.NaN;
}

const qNum = (q: Rational) => Number(q[0]) / Number(q[1]);

/** 곡선 값의 분수(env 에 x 와 슬라이더 분수). 무리수·정의 안 됨이면 null */
export function curveExact(p: CoordParams, id: string, env: Record<string, Rational>) {
  const n = nodeAt(curveOf(p, id), qNum(env.x as Rational));
  return n ? evalExact(n, env) : null;
}

/** 곡선 미분값의 분수 */
export function curveDerivExact(p: CoordParams, id: string, env: Record<string, Rational>) {
  const n = nodeAt(curveOf(p, id), qNum(env.x as Rational));
  return n ? evalExact(derivative(n, 'x'), env) : null;
}

/** 곡선 식에 쓰인 변수(조각이면 모든 조각) — 어느 슬라이더가 이 곡선을 움직이나 */
export function curveVars(c: CurveObj): Set<string> {
  const out = new Set<string>();
  for (const n of c.pieces ? c.pieces.map((pc) => pc.node) : [c.node]) varsOf(n, out);
  return out;
}

/**
 * 식을 통째로 다루는 곳(다항식 실근·칠하기·구분구적·과제 채점)은 조각 곡선을 아직 받지 않는다 — 그 계산들은
 * 식 하나를 x 전체에서 다루고(다항식 계수·적분·sympy 식), 조각의 경계·정의역을 모른다. 조용히 첫 조각만 쓰면
 * 그림과 다른 값을 채점하므로 형식 오류로 막는다.
 */
export function wholeCurve(c: CurveObj, at: string, what: string): CurveObj {
  if (c.pieces) fail(at, `조각·구간 곡선 ${c.id} 은 ${what}에 아직 못 씀(식 하나인 곡선만)`);
  return c;
}

/** 형식 검사: 접선이 쓸 수 있게 기호 미분이 되는가(조각이면 조각마다) */
export function curveDerivable(c: CurveObj, at: string): void {
  for (const n of c.pieces ? c.pieces.map((pc) => pc.node) : [c.node])
    try {
      derivative(n, 'x');
    } catch (e) {
      fail(at, (e as Error).message);
    }
}

/** 곡선 경로(px). 정의 안 되는 곳·크게 튀는 곳(점근선)에서 끊는다 */
function curvePath(p: CoordParams, s: CoordState, c: CurveObj, f: Frame): string {
  if (c.pieces) return piecesPath(p, s.vars, c, f);
  const n = Math.max(60, Math.round((f.r - f.l) / 2));
  return samplePath(p, f, p.x.lo, p.x.hi, n, (x) => evalNum(c.node, { ...s.vars, x }));
}

export const curveKind: KindDef<CurveObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['id', 'curve'], ['label', 'tone', 'hide', 'x']);
    if (c.hide !== undefined && c.hide !== true) fail(`${at} hide`, 'true 만');
    const id = cx.named(c.id, `${at} id`);
    const compileY = (src: string, w: string): Node => {
      try {
        return compile(src, cx.vars);
      } catch (e) {
        return fail(w, (e as Error).message);
      }
    };
    const pieces = parsePieces(c, at, cx, compileY);
    const expr = pieces ? piecesSym(pieces) : str(c.curve, `${at} curve`).replace(/\s+/g, '');
    const co: CurveObj = {
      kind: 'curve',
      id,
      expr,
      node: pieces ? (pieces[0] as { node: Node }).node : compileY(expr, `${at} curve`),
      ...(pieces ? { pieces } : {}),
      ...(c.label !== undefined ? { label: str(c.label, `${at} label`) } : {}),
      tone: c.tone === undefined ? 'main' : oneOf(c.tone, `${at} tone`, TONES),
      ...(c.hide === true ? { hide: true as const } : {}),
    };
    cx.curves.set(id, co);
    return co;
  },
  draw(o, k, cx) {
    const { p, s, f, items } = cx;
    // 숨긴 정답 곡선은 맞히기 전에는 경로를 비워 둔다(숨김 표시만 하면 모양이 DOM 에 남는다)
    const hide = !!o.hide && !s.solved;
    const d = hide ? '' : curvePath(p, s, o, f);
    items.push({ t: 'path', key: `c${k}`, d, cls: `curve ${o.tone}` });
    if (o.pieces) drawEnds(o, k, cx, hide);
  },
  checks(o, cx) {
    if (o.pieces) {
      pieceChecks(o, cx);
      return;
    }
    const { vars, range, fixed, deriv, out } = cx;
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
