// 넓이 모형의 모델(순수). 곱셈·분배법칙·곱셈공식·인수분해·곱의 미분을 "직사각형 넓이"로 보여 준다.
// 세 가지 모드:
//   split — 가로·세로를 항으로 나눈 직사각형. 칸을 눌러 넓이를 열고, 칸 넓이의 합 = 처음 곱(분배법칙)
//   grow  — 가로 w(x)·세로 h(x) 직사각형에서 x 를 Δx 만큼 늘리면 오른쪽 띠·위쪽 띠·모서리가 생긴다.
//           Δx 를 줄이면 모서리/Δx 는 0 으로, 띠 합/Δx 는 (wh)' 로 간다(곱의 미분)
//   tiles — x²·x·1 타일을 끌어 빈틈없는 직사각형을 만들면 가로·세로가 인수가 된다(인수분해)
// 화면(AreaModel.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
import {
  compile,
  derivative,
  evalExact,
  evalNum,
  exactOf,
  exactStr,
  paritySamples,
} from '../expr.ts';
import { arr, fail, int, obj, oneOf, str } from '../parse.ts';
import { type Node, type Rational, ratStr, symToTex } from '../sym.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface SplitParams {
  mode: 'split';
  /** 가로 항들(sympy 식, 예: ["10","3"] · ["x","2"]) */
  w: string[];
  h: string[];
  intro?: string;
  done?: string;
}

export interface GrowParams {
  mode: 'grow';
  /** 가로·세로 길이 식(x 의 함수) */
  w: string;
  h: string;
  wNode: Node;
  hNode: Node;
  /** 범례에 보일 이름(Rich, 예: "$f(x)$") */
  wLabel: string;
  hLabel: string;
  /** 기준 x (유리수) */
  at: string;
  atN: number;
  /** Δx 최댓값·간격(유리수) */
  max: string;
  step: string;
  maxN: number;
  stepN: number;
  /** 이만큼 이하로 줄이면 목표(Δx). 없으면 한 칸 */
  goal: number;
  intro?: string;
  done?: string;
}

export interface TilesParams {
  mode: 'tiles';
  x2: number;
  x: number;
  one: number;
  /** 작성자가 적은 인수분해(검산: 전개하면 타일 식과 같은가) */
  factor: string;
  intro?: string;
  done?: string;
}

export type AreaParams = SplitParams | GrowParams | TilesParams;

// ---- split ----

/** 칸 (r, c) 의 넓이 식과 TeX. 세로 r 번째 항 × 가로 c 번째 항 */
export const cellSym = (p: SplitParams, r: number, c: number) => `(${p.w[c]})*(${p.h[r]})`;

export function cellTex(p: SplitParams, r: number, c: number): string {
  const a = p.w[c] as string;
  const b = p.h[r] as string;
  const ra = exactOf(a);
  const rb = exactOf(b);
  if (ra && rb) {
    const [n, d] = [ra[0] * rb[0], ra[1] * rb[1]];
    return symToTex(d === 1n ? `${n}` : `${n}/${d}`);
  }
  const wrap = (t: string) => (/^[\w.]+$/.test(t) ? t : `(${t})`);
  if (a === b) return symToTex(`${wrap(a)}**2`);
  // 수를 앞에(x×3 이 아니라 3x)
  return symToTex(rb && !ra ? `${wrap(b)}*${wrap(a)}` : `${wrap(a)}*${wrap(b)}`);
}

/** 처음 곱(가로 합 × 세로 합)과 칸 넓이 합(검산 항목의 답). 숫자만이면 값 하나로 */
export function splitTotal(p: SplitParams): { product: string; sum: string; value: string | null } {
  const product = `(${p.w.join('+')})*(${p.h.join('+')})`;
  const cells: string[] = [];
  for (let r = 0; r < p.h.length; r++)
    for (let c = 0; c < p.w.length; c++) cells.push(cellSym(p, r, c));
  const sum = cells.join('+');
  const v = evalExact(compile(sum, ['x']), {});
  return { product, sum, value: v ? ratStr(v) : null };
}

// ---- grow ----

export interface GrowView {
  /** 기준 가로·세로, 늘어난 가로·세로(Δw, Δh) */
  w: number;
  h: number;
  dw: number;
  dh: number;
  /** 오른쪽 띠(Δw·h), 위쪽 띠(w·Δh), 모서리(Δw·Δh) */
  right: number;
  top: number;
  corner: number;
  /** 띠 합/Δx, 모서리/Δx (Δx=0 이면 극한값과 0) */
  stripsRate: number;
  cornerRate: number;
}

/** Δx 칸 번호 k → 넓이 조각들 */
export function growView(p: GrowParams, k: number): GrowView {
  const d = Number((k * p.stepN).toPrecision(12));
  const x = p.atN;
  const w = evalNum(p.wNode, { x });
  const h = evalNum(p.hNode, { x });
  const dw = evalNum(p.wNode, { x: x + d }) - w;
  const dh = evalNum(p.hNode, { x: x + d }) - h;
  const lim =
    evalNum(derivative(p.wNode, 'x'), { x }) * h + w * evalNum(derivative(p.hNode, 'x'), { x });
  return {
    w,
    h,
    dw,
    dh,
    right: dw * h,
    top: w * dh,
    corner: dw * dh,
    stripsRate: d === 0 ? lim : (dw * h + w * dh) / d,
    cornerRate: d === 0 ? 0 : (dw * dh) / d,
  };
}

export const growSteps = (p: GrowParams) => Math.round(p.maxN / p.stepN);

/** 곱의 미분 값 (wh)'(at) — 정확한 분수(다항·유리식) */
export function growLimit(p: GrowParams): string | null {
  const a = exactOf(p.at) as Rational;
  const n = derivative(compile(`(${p.w})*(${p.h})`, ['x']), 'x');
  const v = evalExact(n, { x: a });
  return v ? ratStr(v) : null;
}

// ---- tiles ----

/** x 타일의 화면 길이(1 = 한 칸). 정수 배와 겹치지 않는 값이라 길이 비교가 (a·x + b) 꼴로 갈린다 */
export const XLEN = 2.6;
/** 판 위 자리 = a·x + b (a: 0~3, b: 0~9) */
export interface Len {
  a: number;
  b: number;
}
export const lenN = (l: Len) => l.a * XLEN + l.b;

export type TileKind = 'x2' | 'x' | 'one';
export interface Tile {
  kind: TileKind;
  /** x 타일을 세웠나(가로 1·세로 x) */
  rot: boolean;
  /** 판 위 왼쪽·위 자리. 없으면 아직 판 밖 */
  at: { x: Len; y: Len } | null;
}

export function tileSize(t: Tile): { w: Len; h: Len } {
  if (t.kind === 'x2') return { w: { a: 1, b: 0 }, h: { a: 1, b: 0 } };
  if (t.kind === 'one') return { w: { a: 0, b: 1 }, h: { a: 0, b: 1 } };
  return t.rot
    ? { w: { a: 0, b: 1 }, h: { a: 1, b: 0 } }
    : { w: { a: 1, b: 0 }, h: { a: 0, b: 1 } };
}

export function initialTiles(p: TilesParams): Tile[] {
  const out: Tile[] = [];
  for (let k = 0; k < p.x2; k++) out.push({ kind: 'x2', rot: false, at: null });
  for (let k = 0; k < p.x; k++) out.push({ kind: 'x', rot: false, at: null });
  for (let k = 0; k < p.one; k++) out.push({ kind: 'one', rot: false, at: null });
  return out;
}

/** 판 위 수(px 대신 칸 단위)에서 가장 가까운 a·x+b 자리 */
export function snapLen(v: number): Len {
  let best: Len = { a: 0, b: 0 };
  let bd = Number.POSITIVE_INFINITY;
  for (let a = 0; a <= 3; a++)
    for (let b = 0; b <= 9; b++) {
      const d = Math.abs(a * XLEN + b - v);
      if (d < bd) {
        bd = d;
        best = { a, b };
      }
    }
  return best;
}

const EPS = 1e-9;

/** 판 위 타일들이 빈틈·겹침 없이 직사각형을 이루나. 이루면 가로·세로(a·x+b) */
export function rectangle(tiles: Tile[]): { w: Len; h: Len } | null {
  if (tiles.some((t) => !t.at)) return null;
  const box = tiles.map((t) => {
    const s = tileSize(t);
    const at = t.at as { x: Len; y: Len };
    return {
      l: lenN(at.x),
      t: lenN(at.y),
      r: lenN(at.x) + lenN(s.w),
      b: lenN(at.y) + lenN(s.h),
      R: { a: at.x.a + s.w.a, b: at.x.b + s.w.b },
      B: { a: at.y.a + s.h.a, b: at.y.b + s.h.b },
      L: at.x,
      T: at.y,
    };
  });
  for (let i = 0; i < box.length; i++)
    for (let j = i + 1; j < box.length; j++) {
      const a = box[i] as (typeof box)[number];
      const b = box[j] as (typeof box)[number];
      if (a.l < b.r - EPS && b.l < a.r - EPS && a.t < b.b - EPS && b.t < a.b - EPS) return null;
    }
  const minBy = (k: 'l' | 't') => box.reduce((m, x) => (x[k] < m[k] ? x : m));
  const maxBy = (k: 'r' | 'b') => box.reduce((m, x) => (x[k] > m[k] ? x : m));
  const L = minBy('l').L;
  const T = minBy('t').T;
  const R = maxBy('r').R;
  const B = maxBy('b').B;
  const w = { a: R.a - L.a, b: R.b - L.b };
  const h = { a: B.a - T.a, b: B.b - T.b };
  const area = box.reduce((s, x) => s + (x.r - x.l) * (x.b - x.t), 0);
  // 겹침이 없으니 넓이 합 = 바깥 직사각형 넓이면 빈틈도 없다
  return Math.abs(area - lenN(w) * lenN(h)) < 1e-6 ? { w, h } : null;
}

/** a·x+b → sympy 글자 */
export const lenSym = (l: Len) =>
  [l.a ? (l.a === 1 ? 'x' : `${l.a}*x`) : '', l.b ? String(l.b) : ''].filter(Boolean).join('+') ||
  '0';

/** 타일 식 (x² 개수)x² + (x 개수)x + (1 개수) */
export const tilesSym = (p: TilesParams) => `${p.x2}*x**2+${p.x}*x+${p.one}`;

/** 타일로 직사각형을 만들 수 있나: (a1 x + b1)(a2 x + b2) = 타일 식인 자연수 a·b 가 있나 */
function factorable(p: TilesParams): boolean {
  for (let a1 = 1; a1 <= p.x2; a1++)
    for (let a2 = 1; a2 <= p.x2; a2++)
      for (let b1 = 0; b1 <= 9; b1++)
        for (let b2 = 0; b2 <= 9; b2++)
          if (a1 * a2 === p.x2 && a1 * b2 + a2 * b1 === p.x && b1 * b2 === p.one) return true;
  return false;
}

// ---- 형식 검사 ----

function rat(v: unknown, at: string): { src: string; n: number } {
  const src = typeof v === 'number' ? exactStr(v) : str(v, at).replace(/\s+/g, '');
  const r = exactOf(src);
  if (!r) return fail(at, `유리수가 아님 (${src})`);
  return { src, n: Number(r[0]) / Number(r[1]) };
}

function terms(v: unknown, at: string): string[] {
  return arr(v, at, 1, 3).map((t, k) => {
    const s = str(t, `${at}${k + 1}`).replace(/\s+/g, '');
    try {
      compile(s, ['x']);
    } catch (e) {
      fail(`${at}${k + 1}`, (e as Error).message);
    }
    return s;
  });
}

export function parseArea(raw: unknown): AreaParams {
  const mode = oneOf((raw as { mode?: unknown } | null)?.mode, '넓이 mode', [
    'split',
    'grow',
    'tiles',
  ] as const);
  const text = (o: Record<string, unknown>) => ({
    ...(o.intro !== undefined ? { intro: str(o.intro, '넓이 intro') } : {}),
    ...(o.done !== undefined ? { done: str(o.done, '넓이 done') } : {}),
  });
  if (mode === 'split') {
    const o = obj(raw, '넓이', ['mode', 'w', 'h'], ['intro', 'done']);
    return { mode, w: terms(o.w, '넓이 w'), h: terms(o.h, '넓이 h'), ...text(o) };
  }
  if (mode === 'tiles') {
    const o = obj(raw, '넓이', ['mode', 'tiles', 'factor'], ['intro', 'done']);
    const t = obj(o.tiles, '넓이 tiles', ['x2', 'x', 'one']);
    const p: TilesParams = {
      mode,
      x2: int(t.x2, '넓이 x2', 1, 3),
      x: int(t.x, '넓이 x', 0, 12),
      one: int(t.one, '넓이 one', 0, 20),
      factor: str(o.factor, '넓이 factor').replace(/\s+/g, ''),
      ...text(o),
    };
    try {
      compile(p.factor, ['x']);
    } catch (e) {
      fail('넓이 factor', (e as Error).message);
    }
    if (!factorable(p)) fail('넓이 tiles', '이 타일로는 직사각형을 만들 수 없음');
    return p;
  }
  const o = obj(
    raw,
    '넓이',
    ['mode', 'w', 'h', 'wLabel', 'hLabel', 'at', 'max', 'step'],
    ['goal', 'intro', 'done'],
  );
  const w = str(o.w, '넓이 w').replace(/\s+/g, '');
  const h = str(o.h, '넓이 h').replace(/\s+/g, '');
  let wNode: Node;
  let hNode: Node;
  try {
    wNode = compile(w, ['x']);
    hNode = compile(h, ['x']);
    derivative(wNode, 'x');
    derivative(hNode, 'x');
  } catch (e) {
    return fail('넓이 w·h', (e as Error).message);
  }
  const at = rat(o.at, '넓이 at');
  const max = rat(o.max, '넓이 max');
  const step = rat(o.step, '넓이 step');
  if (!(max.n > 0 && step.n > 0)) fail('넓이', 'max·step 은 0 보다 커야 함');
  const k = max.n / step.n;
  if (Math.abs(k - Math.round(k)) > 1e-9 || k > 50)
    fail('넓이', 'max 가 step 의 정수배(50 이하)가 아님');
  const goal = o.goal === undefined ? step.n : rat(o.goal, '넓이 goal').n;
  const p: GrowParams = {
    mode,
    w,
    h,
    wNode,
    hNode,
    wLabel: str(o.wLabel, '넓이 wLabel'),
    hLabel: str(o.hLabel, '넓이 hLabel'),
    at: at.src,
    atN: at.n,
    max: max.src,
    step: step.src,
    maxN: max.n,
    stepN: step.n,
    goal,
    ...text(o),
  };
  for (let i = 0; i <= Math.round(k); i++) {
    const v = growView(p, i);
    if (
      ![v.w, v.h, v.dw, v.dh].every(Number.isFinite) ||
      v.w <= 0 ||
      v.h <= 0 ||
      v.dw < 0 ||
      v.dh < 0
    )
      fail('넓이', 'Δx 범위에서 가로·세로가 양수로 늘어나야 함');
  }
  if (!growLimit(p)) fail('넓이', '(wh)′ 이 유리수로 계산되지 않음(다항·유리식만)');
  return p;
}

export function areaChecks(p: AreaParams): WidgetCheck[] {
  if (p.mode === 'split') {
    const t = splitTotal(p);
    // 칸 넓이의 합(앱이 보여 주는 조각들) = 처음 곱(분배법칙)
    return [
      t.value !== null
        ? { name: '칸 넓이 합', answer: t.value, answerType: 'fraction', check: t.product }
        : { name: '칸 넓이 합', answer: t.sum, answerType: 'expr', check: `expand(${t.product})` },
    ];
  }
  if (p.mode === 'tiles')
    return [{ name: '인수분해', answer: p.factor, answerType: 'expr', check: tilesSym(p) }];
  const range = { x: [p.at, `${p.at}+${p.max}`] as [string, string] };
  return [
    { name: '가로 계산', kind: 'parity', expr: p.w, ...paritySamples(p.w, ['x'], range, {}) },
    { name: '세로 계산', kind: 'parity', expr: p.h, ...paritySamples(p.h, ['x'], range, {}) },
    {
      name: '띠 합의 극한',
      kind: 'parity',
      expr: `diff((${p.w})*(${p.h}),x)`,
      ...paritySamples(`diff((${p.w})*(${p.h}),x)`, ['x'], range, {}),
    },
    {
      name: '곱의 미분 값',
      answer: growLimit(p) as string,
      answerType: 'fraction',
      check: `diff((${p.w})*(${p.h}),x).subs(x,${p.at})`,
    },
  ];
}

export const areaModelDef: WidgetDef<AreaParams> = {
  parse: parseArea,
  checks: areaChecks,
  texts(p) {
    const out = [p.intro, p.done].filter((s): s is string => s !== undefined);
    if (p.mode === 'grow') out.push(p.wLabel, p.hLabel);
    return out;
  },
};
