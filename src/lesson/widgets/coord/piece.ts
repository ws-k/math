// 조각 함수·구간만 그리기 — 한 기제. {id, curve:'식', x:'[a,b]'}(구간만 그리기)와
// {id, curve:[{y:'식', x:'[a,b)'}, …]}(조각 함수)를 같은 조각 목록으로 읽는다. 구간만 그리기는 조각이 하나일 뿐이다.
// 값은 x 가 든 조각의 식이고, 어느 조각에도 들지 않으면 정의 안 됨(NaN) — sympy Piecewise 와 같은 뜻이라
// 검산은 Piecewise 하나로 앱 계산을 되풀이한다(조각 고르기·경계의 닫힘/열림·구간 밖까지).
//
// 조각 끝에는 찬 점(닫힘 ●)·빈 점(열림 ○)을 저절로 그린다. 예전 꼼수 식(log(Abs(1-x))-log(1-x))은 곡선을 자를 뿐
// 끝 점을 그릴 길이 없어 '극한은 2, 함숫값은 3' 같은 그림을 보일 수 없었다 — 끝 표시가 정의에서 나와야 글과 어긋나지 않는다.
// curve.ts 가 이 파일을 쓴다(곡선 값 계산). 그래서 이 파일은 curve.ts 를 가져오지 않는다(순환).
import { derivative, evalNum, paritySamples, varsOf } from '../../expr.ts';
import { arr, fail, obj, str } from '../../parse.ts';
import type { Node } from '../../sym.ts';
import { near, numExpr } from './common.ts';
import { narrowFrame, r1, samplePath, toPx } from './frame.ts';
import { sliderCombos } from './slider.ts';
import type { CheckCtx, CoordParams, CurveObj, DrawCtx, Frame, ParseCtx, Piece } from './types.ts';

/** 조각 수 상한(한 곡선). 학교 조각 함수는 2~3조각이고, 구멍 + 따로 정한 함숫값이 한 조각을 더 쓴다 */
const MAX_PIECES = 6;
/**
 * 조각 끝 표시 사이 간격 하한(가장 좁은 화면, 가로·같은 x 의 세로 모두). 표시의 바깥 지름은 12.4px
 * (Coord.tsx 점 r=5 + lesson.css .cend 테두리 2.4px 의 절반씩) — 그보다 붙으면 ○ 와 ● 가 겹쳐 어느 쪽 끝이
 * 닫혔는지(함숫값이 어디인지) 보이지 않는다. 그게 이 그림의 뜻 전부라 형식 오류로 막는다.
 */
export const MIN_END_GAP_PX = 13;

/** 'a,b' 를 맨 바깥 쉼표 하나에서 가른다(Rational(1,2) 같은 식 안 쉼표는 두고) */
function splitTop(s: string): string[] {
  let depth = 0;
  const cuts: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) cuts.push(i);
  }
  if (cuts.length !== 1) return [];
  const k = cuts[0] as number;
  return [s.slice(0, k), s.slice(k + 1)];
}

const FORM = "'[0,1)' 꼴 글자(대괄호 = 닫힘, 둥근괄호 = 열림)";

/**
 * 구간 글자 '[0,1)'. 배열 [0,1] 은 받지 않는다 — 끝이 닫혔는지 열렸는지가 이 객체의 뜻이라, 기본값을 두면
 * 작성자가 열림을 빠뜨려도 조용히 닫힘이 된다.
 */
function interval(v: unknown, at: string) {
  if (typeof v !== 'string') return fail(at, `구간은 ${FORM}`);
  const t = v.replace(/\s+/g, '');
  const m = t.match(/^([[(])(.+)([\])])$/);
  const parts = m ? splitTop(m[2] as string) : [];
  if (!m || parts.length !== 2) return fail(at, `구간은 ${FORM} (${v})`);
  const lo = numExpr(parts[0], `${at} 왼쪽 끝`);
  const hi = numExpr(parts[1], `${at} 오른쪽 끝`);
  const loOpen = m[1] === '(';
  const hiOpen = m[3] === ')';
  if (near(lo.n, hi.n)) {
    if (loOpen || hiOpen) fail(at, `한 점 구간은 [a,a] 만 — 열린 한 점은 빈 구간 (${v})`);
  } else if (lo.n > hi.n) fail(at, `왼쪽 끝이 오른쪽 끝보다 작아야 함 (${v})`);
  return { lo: lo.n, hi: hi.n, loSrc: lo.src, hiSrc: hi.src, loOpen, hiOpen };
}

const pieceAtX = (pieces: Piece[], x: number) =>
  pieces.find((pc) => {
    const a = near(x, pc.lo) ? !pc.loOpen : x > pc.lo;
    const b = near(x, pc.hi) ? !pc.hiOpen : x < pc.hi;
    return a && b;
  });

/** x 에서 쓰는 조각의 식(어느 조각에도 없으면 null). 조각 아닌 곡선은 그 식 */
export const nodeAt = (c: CurveObj, x: number) =>
  c.pieces ? (pieceAtX(c.pieces, x)?.node ?? null) : c.node;

/** 조각 끝 하나(화면 안 끝만 — 화면 끝과 같은 끝은 그림 밖으로 이어지는 것과 구분이 안 돼 그리지 않는다) */
interface End {
  /** 조각 번호(적은 순서) */
  k: number;
  x: number;
  src: string;
  open: boolean;
  side: 'lo' | 'hi';
}

export function pieceEnds(p: Pick<CoordParams, 'x'>, c: { pieces?: Piece[] }): End[] {
  const inView = (x: number) => x > p.x.lo && x < p.x.hi && !near(x, p.x.lo) && !near(x, p.x.hi);
  const out: End[] = [];
  (c.pieces ?? []).forEach((pc, k) => {
    if (inView(pc.lo)) out.push({ k, x: pc.lo, src: pc.loSrc, open: pc.loOpen, side: 'lo' });
    // 한 점 조각은 끝이 하나
    if (!near(pc.lo, pc.hi) && inView(pc.hi))
      out.push({ k, x: pc.hi, src: pc.hiSrc, open: pc.hiOpen, side: 'hi' });
  });
  return out;
}

/**
 * 조각 끝의 높이. 식이 끝에서 정의되면 그 값(빈 점이면 다가가는 값 = 극한), 정의 안 되면((x²−1)/(x−1) 의 x=1)
 * 안쪽으로 아주 조금 들어간 자리의 값으로 그린다 — 그리기용이라 px 정밀도면 된다(검산은 정의 여부만 대조).
 */
function endY(c: { pieces: Piece[] }, e: End, env: Record<string, number>, span: number): number {
  const pc = c.pieces[e.k] as Piece;
  const v = evalNum(pc.node, { ...env, x: e.x });
  if (Number.isFinite(v) || !e.open) return v;
  const h = span * 1e-7;
  return evalNum(pc.node, { ...env, x: e.side === 'lo' ? e.x + h : e.x - h });
}

/**
 * 그릴 끝 표시와 그 높이. 같은 경계에서 닫힌 끝과 열린 끝이 같은 높이면(이어짐) 둘 다 숨긴다 — 연속인 곳에
 * 점을 찍지 않게. 그리기(drawEnds)와 형식 검사(checkEnds)가 같은 판정을 써야 '보인다고 검사한 표시'가 그려진다
 */
function visibleEnds(
  p: Pick<CoordParams, 'x'>,
  c: { pieces: Piece[] },
  env: Record<string, number>,
): { e: End; y: number; show: boolean }[] {
  const span = p.x.hi - p.x.lo;
  const ends = pieceEnds(p, c).map((e) => ({ e, y: endY(c, e, env, span) }));
  return ends.map(({ e, y }) => {
    const joined = ends.some(
      (o) => o.e.open !== e.open && near(o.e.x, e.x) && Number.isFinite(o.y) && near(o.y, y),
    );
    return { e, y, show: Number.isFinite(y) && !joined };
  });
}

/** {curve, x?} 또는 {curve:[{y, x}…]} → 조각 목록(형식 검사 전부). 조각이 아니면 undefined */
export function parsePieces(
  c: Record<string, unknown>,
  at: string,
  cx: ParseCtx,
  compileY: (src: string, w: string) => Node,
): Piece[] | undefined {
  let raw: { y: string; x: unknown; at: string }[];
  if (Array.isArray(c.curve)) {
    if (c.x !== undefined) fail(`${at} x`, '조각 곡선은 조각마다 x 를 적음');
    raw = arr(c.curve, `${at} curve`, 1, MAX_PIECES).map((r, k) => {
      const w = `${at} 조각${k + 1}`;
      const o = obj(r, w, ['y', 'x']);
      return { y: str(o.y, `${w} y`).replace(/\s+/g, ''), x: o.x, at: w };
    });
  } else {
    if (c.x === undefined) return undefined;
    raw = [{ y: str(c.curve, `${at} curve`).replace(/\s+/g, ''), x: c.x, at: `${at} x` }];
  }
  const pieces: Piece[] = raw.map((r) => ({
    y: r.y,
    node: compileY(r.y, `${r.at} y`),
    ...interval(r.x, r.at),
  }));
  pieces.forEach((pc, k) => {
    const w = raw[k]?.at as string;
    if (near(pc.lo, pc.hi)) {
      // 한 점 조각은 찬 점 하나가 전부 — 화면 끝이면 표시를 그리지 않으니(pieceEnds) 아무것도 안 보인다
      if (!(pc.lo > cx.x.lo && pc.lo < cx.x.hi) || near(pc.lo, cx.x.lo) || near(pc.lo, cx.x.hi))
        fail(w, `한 점 조각 x=${pc.lo} 이 화면 끝·밖 — 찬 점이 안 보임(x 축을 넓히세요)`);
    } else {
      // 화면과 길이 있게 겹쳐야 한다. 닫힌 끝 한 점만 화면 끝에 걸치면 경로도 표시도 그리지 않는다
      const len = Math.min(pc.hi, cx.x.hi) - Math.max(pc.lo, cx.x.lo);
      if (!(len > 0) || near(len, 0)) fail(w, '화면 밖 조각(x 범위와 길이 있게 겹치지 않음)');
    }
    // 닫힌 끝은 '그 값을 가진다'는 뜻 — 식이 거기서 정의 안 되면 찬 점을 그릴 자리가 없다
    for (const [x, open] of [
      [pc.lo, pc.loOpen],
      [pc.hi, pc.hiOpen],
    ] as const)
      if (!open && Number.isNaN(evalNum(pc.node, { ...cx.env0, x })))
        fail(w, `닫힌 끝 x=${x} 에서 식이 정의 안 됨(열림으로 하거나 그 점을 따로 [a,a] 조각으로)`);
  });
  // 겹치면 한 x 에 값이 둘 — 함수가 아니다. 경계는 한쪽만 닫혀야 한다
  const sorted = pieces
    .map((pc, k) => ({ pc, k }))
    .sort((a, b) => a.pc.lo - b.pc.lo || a.pc.hi - b.pc.hi);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1] as { pc: Piece; k: number };
    const b = sorted[i] as { pc: Piece; k: number };
    const touch = near(a.pc.hi, b.pc.lo);
    if ((!touch && b.pc.lo < a.pc.hi) || (touch && !a.pc.hiOpen && !b.pc.loOpen))
      fail(
        `${at} 조각${b.k + 1}`,
        `조각${a.k + 1} 과 겹침 — x=${b.pc.lo} 에서 값이 둘(경계는 한쪽만 닫힘으로)`,
      );
  }
  narrowEnds(cx, pieces, at);
  checkEnds(cx, pieces, at);
  return pieces;
}

/**
 * 보이는 끝 표시가 그림 안(y 범위)에 들고, 같은 x 의 ○·● 가 가장 좁은 화면에서 세로로 MIN_END_GAP_PX 이상 떨어지는가.
 * 곡선이 쓰는 슬라이더의 모든 칸 값에서 본다 — 처음 값만 보면 슬라이더를 옮겼을 때 표시가 사라지거나 겹친다
 */
function checkEnds(cx: ParseCtx, pieces: Piece[], at: string) {
  const f = narrowFrame(cx);
  const pxY = (f.b - f.t) / (cx.y.hi - cx.y.lo);
  const used = new Set<string>();
  for (const pc of pieces) for (const v of varsOf(pc.node)) used.add(v);
  const ids = cx.sliders.map((sl) => sl.id).filter((id) => used.has(id));
  for (const cb of sliderCombos(cx.sliders, ids, at)) {
    const shown = visibleEnds(cx, { pieces }, { ...cx.env0, ...cb.num }).filter((v) => v.show);
    const when = cb.text ? ` — ${cb.text}` : '';
    for (const v of shown)
      if (v.y < cx.y.lo - 1e-9 || v.y > cx.y.hi + 1e-9)
        fail(
          at,
          `조각 끝 표시 (${v.e.x}, ${fmt(v.y)}) 가 화면 밖(y 는 ${cx.y.min}~${cx.y.max})${when}`,
        );
    for (const a of shown)
      for (const b of shown) {
        if (a === b || !near(a.e.x, b.e.x) || a.y > b.y) continue;
        const gap = (b.y - a.y) * pxY;
        // 같은 자리의 같은 표시(구멍 양쪽의 ○○ — 식이 끝에서 정의 안 되면 높이가 어림이라 아주 조금 다를 수 있음)는
        // 한 표시로 보여 괜찮다. ○ 와 ● 는 겹치면 안 된다
        if (a.e.open === b.e.open && gap < 0.5) continue;
        if (gap < MIN_END_GAP_PX)
          fail(
            at,
            `가장 좁은 화면에서 x=${a.e.x} 의 끝 표시가 세로로 ${gap.toFixed(1)}px 로 붙음(${MIN_END_GAP_PX}px 이상 — 빈 점·찬 점이 겹침)${when}`,
          );
      }
  }
}

const fmt = (v: number) => Number(v.toPrecision(6));

/** 가장 좁은 화면에서 서로 다른 끝 자리끼리 MIN_END_GAP_PX 이상 떨어지는가 */
function narrowEnds(cx: ParseCtx, pieces: Piece[], at: string) {
  const f = narrowFrame(cx);
  const w = f.r - f.l;
  const xs = pieceEnds(cx, { pieces })
    .map((e) => e.x)
    .sort((a, b) => a - b)
    .filter((x, i, a) => i === 0 || !near(x, a[i - 1] as number));
  for (let i = 1; i < xs.length; i++) {
    const px = (((xs[i] as number) - (xs[i - 1] as number)) / (cx.x.hi - cx.x.lo)) * w;
    if (px < MIN_END_GAP_PX)
      fail(
        at,
        `가장 좁은 화면에서 조각 끝 x=${xs[i - 1]} 과 x=${xs[i]} 의 표시가 ${px.toFixed(1)}px 로 붙음(${MIN_END_GAP_PX}px 이상 — 빈 점·찬 점이 겹침)`,
      );
  }
}

/**
 * x 가 매끄럽지 않은 조각 끝인가(접선·deriv·겹친 할선이 한쪽 미분을 기울기로 보이게 되는 자리). 이유 글, 아니면 null.
 * 한 조각 안쪽이면 매끄럽다. 끝이면 왼쪽·오른쪽으로 이어지는 조각이 둘 다 있고 값·미분이 같아야 한다 —
 * 정의역 끝(한쪽만)·한 점 조각·끊긴 경계·꺾인 점은 모두 매끄럽지 않다. sympy diff(Piecewise) 도 같은 한쪽 값을
 * 내므로 검산으로는 못 잡아 형식 검사로 막는다
 */
export function roughAt(pieces: Piece[], x: number, env: Record<string, number>): string | null {
  const inner = pieces.find((pc) => x > pc.lo && x < pc.hi && !near(x, pc.lo) && !near(x, pc.hi));
  if (inner) return null;
  const here = pieceAtX(pieces, x);
  if (here && near(here.lo, here.hi)) return '한 점 조각';
  const left = pieces.find((pc) => near(pc.hi, x) && !near(pc.lo, pc.hi));
  const right = pieces.find((pc) => near(pc.lo, x) && !near(pc.lo, pc.hi));
  if (!left || !right) return '정의역 끝(한쪽만 이어짐)';
  const e = { ...env, x };
  const v = [evalNum(left.node, e), evalNum(right.node, e)];
  const d = [evalNum(derivative(left.node, 'x'), e), evalNum(derivative(right.node, 'x'), e)];
  if (![...v, ...d].every(Number.isFinite)) return '식이 끝에서 정의 안 됨';
  if (!near(v[0] as number, v[1] as number)) return '끊긴 경계(양쪽 값이 다름)';
  if (!near(d[0] as number, d[1] as number)) return '꺾인 점(양쪽 미분이 다름)';
  return null;
}

/** sympy Piecewise 글자. 조건이 하나도 맞지 않는 x 는 sympy 도 nan(정의 안 됨)이라 앱의 NaN 과 같다 */
export function piecesSym(pieces: Piece[]): string {
  const cond = (pc: Piece) =>
    `(x${pc.loOpen ? '>' : '>='}(${pc.loSrc}))&(x${pc.hiOpen ? '<' : '<='}(${pc.hiSrc}))`;
  return `Piecewise(${pieces.map((pc) => `((${pc.y}),${cond(pc)})`).join(',')})`;
}

/** 조각마다 따로 시작하는 경로(조각 사이를 세로선으로 잇지 않게). 열린 끝·정의 안 되는 끝은 다가가는 값까지 */
export function piecesPath(p: CoordParams, env: Record<string, number>, c: CurveObj, f: Frame) {
  const span = p.x.hi - p.x.lo;
  const total = Math.max(60, Math.round((f.r - f.l) / 2));
  let d = '';
  for (const pc of c.pieces as Piece[]) {
    const a = Math.max(pc.lo, p.x.lo);
    const b = Math.min(pc.hi, p.x.hi);
    if (!(b > a) || near(a, b)) continue;
    const n = Math.max(2, Math.ceil((total * (b - a)) / span));
    const h = span * 1e-7;
    d += samplePath(p, f, a, b, n, (x) => {
      const v = evalNum(pc.node, { ...env, x });
      if (Number.isFinite(v)) return v;
      // 끝에서만 정의 안 되면(구멍) 안쪽으로 조금 들어간 값 — 경로가 빈 점 바로 앞에서 끊기지 않게
      if (near(x, pc.lo)) return evalNum(pc.node, { ...env, x: x + h });
      if (near(x, pc.hi)) return evalNum(pc.node, { ...env, x: x - h });
      return v;
    });
  }
  return d;
}

/** 조각 끝 표시(찬 점·빈 점). 숨김 판정은 visibleEnds(형식 검사와 같은 것) */
export function drawEnds(
  c: { pieces: Piece[]; tone: string },
  k: number,
  cx: DrawCtx,
  hide: boolean,
) {
  const { p, s, f, items } = cx;
  visibleEnds(p, c, s.vars).forEach(({ e, y, show }, m) => {
    const ok = !hide && show;
    const [X, Y] = ok ? toPx(p, f, e.x, y) : [0, 0];
    items.push({
      t: 'dot',
      key: `c${k}e${m}`,
      x: r1(X),
      y: r1(Y),
      cls: `cend ${e.open ? 'open' : 'closed'} ${c.tone}`,
      hidden: !ok,
    });
  });
}

/**
 * 검산 항목: 곡선 계산(Piecewise, 고른 점 9개 + 조각 끝 전부 — 경계에서 어느 조각을 쓰는지까지), 미분(쓰일 때),
 * 열린 끝의 식 값(빈 점 자리). 모두 기존 parity 종류라 verify.py 를 고치지 않는다.
 */
export function pieceChecks(o: CurveObj, { p, vars, range, fixed, deriv, out }: CheckCtx) {
  const pieces = o.pieces as Piece[];
  const even = paritySamples('x', vars, range, fixed).points;
  const seen = even.map((pt) => numExpr(pt.x as string, 'x').n);
  const ends: Record<string, string>[] = [];
  for (const pc of pieces)
    for (const [x, src] of [
      [pc.lo, pc.loSrc],
      [pc.hi, pc.hiSrc],
    ] as const) {
      if (x < p.x.lo - 1e-12 || x > p.x.hi + 1e-12 || seen.some((v) => near(v, x))) continue;
      seen.push(x);
      ends.push({ x: src, ...fixed });
    }
  const points = [...even, ...ends];
  const env = (pt: Record<string, string>) => {
    const e: Record<string, number> = {};
    for (const [k, v] of Object.entries(pt)) e[k] = numExpr(v, k).n;
    return e;
  };
  const val = (f: (n: Node, e: Record<string, number>) => number) =>
    points.map((pt) => {
      const e = env(pt);
      const pc = pieceAtX(pieces, e.x as number);
      const v = pc ? f(pc.node, e) : Number.NaN;
      return Number.isNaN(v) ? null : v;
    });
  out.push({
    name: `곡선 ${o.id} 계산`,
    kind: 'parity',
    expr: o.expr,
    points,
    values: val(evalNum),
  });
  if (deriv.has(o.id))
    out.push({
      name: `곡선 ${o.id} 미분`,
      kind: 'parity',
      expr: `diff(${o.expr},x)`,
      points,
      values: val((n, e) => evalNum(derivative(n, 'x'), e)),
    });
  pieces.forEach((pc, k) => {
    const opens = pieceEnds(p, o).filter((e) => e.k === k && e.open);
    if (opens.length === 0) return;
    const pts = opens.map((e) => ({ x: e.src, ...fixed }));
    out.push({
      name: `곡선 ${o.id} 조각${k + 1} 빈 점`,
      kind: 'parity',
      expr: pc.y,
      points: pts,
      values: pts.map((pt) => {
        const v = evalNum(pc.node, env(pt));
        return Number.isNaN(v) ? null : v;
      }),
    });
  });
}
