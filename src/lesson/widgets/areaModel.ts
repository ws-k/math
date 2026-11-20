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

/**
 * 타일로 만들 수 있는 직사각형들: (a1 x + b1)(a2 x + b2) = 타일 식인 자연수 a·b 쌍. 형식 검사(만들 수 있나)와
 * 접은 화면 판 크기(tilesSides)가 같은 목록을 쓴다 — 따로 세면 둘이 어긋날 수 있다
 */
export function tileFactorings(
  p: TilesParams,
): { a1: number; b1: number; a2: number; b2: number }[] {
  const out: { a1: number; b1: number; a2: number; b2: number }[] = [];
  for (let a1 = 1; a1 <= p.x2; a1++)
    for (let a2 = 1; a2 <= p.x2; a2++)
      for (let b1 = 0; b1 <= 9; b1++)
        for (let b2 = 0; b2 <= 9; b2++)
          if (a1 * a2 === p.x2 && a1 * b2 + a2 * b1 === p.x && b1 * b2 === p.one)
            out.push({ a1, b1, a2, b2 });
  return out;
}

const factorable = (p: TilesParams) => tileFactorings(p).length > 0;

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

// ---- 그릴 목록(상태 → 그릴 것). 끄는 동안 화면이 이것을 DOM 에 직접 적용한다 ----

export interface Rect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cls: string;
}

const PAD = 12;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 숫자 글자(자리수 3, 뒤 0 지우기, 진짜 빼기 기호) */
/**
 * 범례의 '가로 ○ · 세로 ○'. 단원 글이 이름을 '가로 $x$' 처럼 이미 쓰면 부품이 또 붙여 '가로 가로 x' 가 됐다 —
 * 이름이 그 말로 시작하면 그대로 둔다(m3-poly-mul 은 '가로 $x$', math2-diff-product-rule 은 '$f(x)=x^2$')
 */
export const sideLabel = (side: '가로' | '세로', label: string) =>
  label.trimStart().startsWith(side) ? label : `${side} ${label}`;

export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  let t = v.toFixed(digits).replace(/\.?0+$/, '');
  if (/^-0$/.test(t)) t = '0';
  return t.replace('-', '−');
}

/** grow: 가장 크게 늘린 직사각형이 상자에 들어가는 배율(px / 길이) */
function growScale(p: GrowParams, box: { w: number; h: number }) {
  const v = growView(p, growSteps(p));
  return Math.min((box.w - 2 * PAD) / (v.w + v.dw), (box.h - 2 * PAD) / (v.h + v.dh));
}

/** grow 의 그릴 것: 기준 직사각형·오른쪽 띠·위쪽 띠·모서리, 끄는 손잡이(바깥 모서리), 읽는 값 */
export function growDraw(p: GrowParams, k: number, box: { w: number; h: number }) {
  const v = growView(p, k);
  const s = growScale(p, box);
  const x0 = PAD;
  const y0 = box.h - PAD;
  const W = v.w * s;
  const H = v.h * s;
  const dW = v.dw * s;
  const dH = v.dh * s;
  const rects: Rect[] = [
    { key: 'base', x: r1(x0), y: r1(y0 - H), w: r1(W), h: r1(H), cls: 'base' },
    { key: 'right', x: r1(x0 + W), y: r1(y0 - H), w: r1(dW), h: r1(H), cls: 'strip a' },
    { key: 'top', x: r1(x0), y: r1(y0 - H - dH), w: r1(W), h: r1(dH), cls: 'strip b' },
    { key: 'corner', x: r1(x0 + W), y: r1(y0 - H - dH), w: r1(dW), h: r1(dH), cls: 'corner' },
  ];
  const d = Number((k * p.stepN).toPrecision(12));
  return {
    rects,
    handle: { x: r1(x0 + W + dW), y: r1(y0 - H - dH) },
    d,
    readouts: [
      { key: 'dx', label: '$\\Delta x$', text: fmt(d) },
      { key: 'right', label: '오른쪽 띠', text: fmt(v.right) },
      { key: 'top', label: '위쪽 띠', text: fmt(v.top) },
      { key: 'corner', label: '모서리', text: fmt(v.corner) },
      { key: 'sr', label: '띠 두 개 ÷ $\\Delta x$', text: fmt(v.stripsRate) },
      { key: 'cr', label: '모서리 ÷ $\\Delta x$', text: fmt(v.cornerRate) },
    ],
  };
}

/** grow 손잡이가 갈 수 있는 자리들(Δx 칸 1~끝). 누른 자리에서 가장 가까운 것을 고른다 */
export function growStops(p: GrowParams, box: { w: number; h: number }) {
  return Array.from({ length: growSteps(p) }, (_, n) => {
    const k = n + 1;
    return { k, ...growDraw(p, k, box).handle };
  });
}

/**
 * grow 그림 상자. 접은 화면은 낮게 — 238px 이면 아래 읽는 값 6칸·안내·버튼이 '계속하기' 밑으로 밀렸고,
 * 목표를 이룬 뒤 두 줄 완료 글(math2-diff-product-rule)까지 들어가려면 150px 까지 낮춰야 했다
 */
export function growBox(w: number, compact: boolean): { w: number; h: number } {
  return compact
    ? { w, h: Math.min(175, Math.max(150, Math.round(w * 0.5))) }
    : { w, h: Math.min(320, Math.max(220, Math.round(w * 0.8))) };
}

/** tiles: 판의 한 변(길이 단위). x 둘에 1 여섯까지 들어간다 */
export const BOARD = 2 * XLEN + 6;

export interface TileRect extends Rect {
  n: number;
  placed: boolean;
  /** 더미 아래에 깔린 타일(접은 화면). 그리기만 하고 누를 수 없다 */
  under?: boolean;
  /** 더미 맨 위 타일의 더미 크기(접은 화면) */
  count?: number;
  /** 누르는 영역이 그림보다 클 때(접은 화면 놓는 곳: 44px 이상) */
  hit?: Rect;
}

/** 타일로 만들 수 있는 직사각형의 짧은 변·긴 변(길이 단위). 인수분해가 여럿이면 각각 가장 긴 것 */
export function tilesSides(p: TilesParams): { short: number; long: number } {
  let short = 0;
  let long = 0;
  for (const { a1, b1, a2, b2 } of tileFactorings(p)) {
    const s = [a1 * XLEN + b1, a2 * XLEN + b2].sort((m, n) => m - n) as [number, number];
    short = Math.max(short, s[0]);
    long = Math.max(long, s[1]);
  }
  return { short, long };
}

export interface TilesLayout {
  /** 길이 1 의 px */
  u: number;
  /** 판 크기(길이 단위) */
  board: { w: number; h: number };
  /** 놓는 곳에서 같은 타일을 한 더미로 쌓나(접은 화면) */
  stack: boolean;
}

/** 판에서 놓는 곳까지 띄우는 px(그 가운데에 점선) — 넓은 배치와 같은 값 */
const TRAY_GAP = 14;
/** 누르는 영역 최소(iOS 44pt) */
const HIT_MIN = 44;
/**
 * 접은 화면 놓는 곳의 더미 사이 px. 좁은 더미 둘(세운 x·1, 폭 u)이 이웃하면 둘 다 누르는 영역을 양쪽으로
 * (44 − u)/2 씩 넓히므로 사이가 44 − u 는 돼야 안 겹친다. 칸이 클 때는 14px(넓은 배치의 판–놓는 곳 사이와 같게)
 */
const slotGap = (u: number) => Math.max(14, HIT_MIN - u);
/** 놓는 곳 한 줄의 폭: x²·누운 x 더미(2.6칸씩)·세운 x·1 더미(1칸씩) + 사이 셋 + 오른쪽 끝(1 의 누르는 영역·개수 표시) */
const trayWidth = (u: number) =>
  (2 * XLEN + 2) * u + 3 * slotGap(u) + Math.max(10, (HIT_MIN - u) / 2);
/** 접은 화면 타일 그림(판 + 놓는 곳)의 높이 상한 px. 382×580 의 카드 몫 444 에서 안내 두 줄·버튼·여백을 빼고
 * 10여 px 남긴 값 — 고른 뒤 안내 글이 바뀌어도 '계속하기' 밑으로 밀리지 않게 */
export const FOLD_BUDGET = 288;
/** 두 방향 다 되는 판에서 한 칸이 이보다 작아지면 누르기 어려워 긴 변을 가로로 눕힌 판을 쓴다 */
const FOLD_U_MIN = 28;

/**
 * 타일 판 배치. 넓은 화면은 예전 그대로(정사각 판 BOARD, 놓는 곳에 타일을 줄지어).
 * 접은 화면(382×580)은 판 BOARD(11.2칸)에 놓는 곳 세 줄이 붙어 그림만 454~489px 이라 한 화면을 넘었고,
 * 판을 그대로 둔 채 줄이면 1 타일이 26px 아래로 작아진다. 그래서
 *  ① 답(만들 직사각형)으로 정하는 것은 칸 크기 u 뿐: 긴 변 + 1칸이 가로·세로 어느 방향으로도 들어가는 가장 큰 u.
 *     그 u 가 FOLD_U_MIN 보다 작아지면(2x²+5x+3: 긴 변 8.2칸) 짧은 변 + 1칸만 세로로 들어가면 되는 u(긴 변을
 *     가로로 — 단원 글도 '나란히 놓고'라 이끈다).
 *  ② 판 모양은 u 에서만 나온다: 폭은 부품 폭 전체, 높이는 그림 높이 예산(FOLD_BUDGET)이 허락하는 만큼 전부.
 *     판을 답 크기에 딱 맞추면 판 모양이 곧 답의 힌트가 된다(리뷰 지적).
 *  ③ 놓는 곳은 같은 타일을 한 더미(맨 위 하나만 누름, 개수 표시)로 쌓아 한 줄. 줄을 늘리거나 가로로 밀게 하지 않는다.
 */
export function tilesLayout(p: TilesParams, width: number, compact: boolean): TilesLayout {
  if (!compact)
    return { u: Math.min(width / BOARD, 34), board: { w: BOARD, h: BOARD }, stack: false };
  const { short, long } = tilesSides(p);
  // 놓는 곳 한 줄이 폭에 드는 가장 큰 u(사이 간격이 u 에 따라 달라 반으로 나눠 찾는다)
  let lo = 1;
  let hi = 34;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (trayWidth(m) <= width) lo = m;
    else hi = m;
  }
  const room = FOLD_BUDGET - TRAY_GAP - 4;
  const fit = (bh: number) => Math.min(34, width / (long + 1), room / (bh + XLEN), lo);
  const free = fit(long + 1);
  const flat = fit(short + 1);
  const u = free >= FOLD_U_MIN || flat <= free ? free : flat;
  return { u, board: { w: width / u, h: Math.min(BOARD, room / u - XLEN) }, stack: true };
}

/**
 * 판 크기가 바뀐 뒤(접기·펴기·회전·주소창으로 화면 높이가 바뀜) 판 밖으로 나간 타일 정리.
 * 판 위 타일을 그대로 두면 판 밖에 떠 있는 타일이 생기고, 그 상태로는 직사각형을 마칠 수 없다.
 * 놓인 묶음을 통째로 왼쪽 위(0,0) 쪽으로 당겨 붙은 모양을 지키고, 그래도 안 들어가는 타일만 놓는 곳으로 보낸다.
 * 모두 판 안이면 같은 배열을 돌려준다(다시 그리지 않게).
 */
export function fitTiles(tiles: Tile[], board: { w: number; h: number }): Tile[] {
  const inside = (t: Tile) => {
    if (!t.at) return true;
    const s = tileSize(t);
    return lenN(t.at.x) + lenN(s.w) <= board.w + EPS && lenN(t.at.y) + lenN(s.h) <= board.h + EPS;
  };
  if (tiles.every(inside)) return tiles;
  const placed = tiles.flatMap((t) => (t.at ? [t.at] : []));
  // 당기는 양: 가장 왼쪽(위) 타일의 자리. 그만큼 빼면 a·x+b 의 a 나 b 가 음수가 되는 타일이 있으면
  // a·b 를 따로 가장 작은 만큼만(늘 0 이상으로 남는 양)
  const shift = (k: 'x' | 'y'): Len => {
    const ls = placed.map((at) => at[k]);
    const min = ls.reduce((m, l) => (lenN(l) < lenN(m) ? l : m));
    if (ls.every((l) => l.a >= min.a && l.b >= min.b)) return min;
    return { a: Math.min(...ls.map((l) => l.a)), b: Math.min(...ls.map((l) => l.b)) };
  };
  const dx = placed.length ? shift('x') : { a: 0, b: 0 };
  const dy = placed.length ? shift('y') : { a: 0, b: 0 };
  return tiles.map((t) => {
    if (!t.at) return t;
    const n: Tile = {
      ...t,
      at: {
        x: { a: t.at.x.a - dx.a, b: t.at.x.b - dx.b },
        y: { a: t.at.y.a - dy.a, b: t.at.y.b - dy.b },
      },
    };
    return inside(n) ? n : { ...t, at: null };
  });
}

/** 누른 자리의 타일(위에 그린 것부터). 더미 아래 타일은 고르지 않는다 */
export function tileAt(rects: TileRect[], x: number, y: number): TileRect | undefined {
  return [...rects].reverse().find((r) => {
    if (r.under) return false;
    const h = r.hit ?? r;
    return x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
  });
}

/** 접은 화면 놓는 곳: 더미 칸(x², 누운 x, 세운 x, 1) 순서대로 한 줄. 타일이 하나도 없는 종류는 칸도 없다 */
function stackDraw(
  tiles: Tile[],
  u: number,
  trayTop: number,
  sel: number | null | undefined,
): { rects: TileRect[]; slots: Rect[]; bottom: number } {
  const slots: { kind: TileKind; rot: boolean }[] = [
    { kind: 'x2', rot: false },
    { kind: 'x', rot: false },
    { kind: 'x', rot: true },
    { kind: 'one', rot: false },
  ].filter((s) => tiles.some((t) => t.kind === s.kind)) as { kind: TileKind; rot: boolean }[];
  const rects: TileRect[] = [];
  const out: Rect[] = [];
  let x = 0;
  let bottom = trayTop;
  for (const s of slots) {
    const size = tileSize({ kind: s.kind, rot: s.rot, at: null });
    const w = lenN(size.w) * u;
    const h = lenN(size.h) * u;
    const members = tiles
      .map((t, n) => ({ t, n }))
      .filter(({ t }) => !t.at && t.kind === s.kind && (s.kind !== 'x' || t.rot === s.rot))
      .map(({ n }) => n);
    // 고른 타일은 늘 맨 위 — 돌리면 다른 더미로 옮겨 가도 테두리가 보이게
    const top = sel != null && members.includes(sel) ? sel : members[members.length - 1];
    const hw = Math.max(w, HIT_MIN);
    const hh = Math.max(h, HIT_MIN);
    for (const n of [...members.filter((m) => m !== top), ...(top === undefined ? [] : [top])]) {
      const isTop = n === top;
      rects.push({
        key: `t${n}`,
        n,
        x: r1(x),
        y: r1(trayTop),
        w: r1(w),
        h: r1(h),
        cls: `tile ${s.kind}`,
        placed: false,
        ...(isTop
          ? {
              count: members.length,
              hit: {
                key: `h${n}`,
                x: r1(x + (w - hw) / 2),
                y: r1(trayTop + (h - hh) / 2),
                w: r1(hw),
                h: r1(hh),
                cls: 'hit',
              },
            }
          : { under: true }),
      });
    }
    out.push({
      key: `s${s.kind}${s.rot ? 'r' : ''}`,
      x: r1(x),
      y: r1(trayTop),
      w: r1(w),
      h: r1(h),
      cls: `slot ${s.kind}${s.rot ? ' rot' : ''}`,
    });
    x += w + slotGap(u);
    bottom = Math.max(bottom, trayTop + h);
  }
  return { rects, slots: out, bottom };
}

/**
 * tiles 의 그릴 것. 판 위 타일은 자리(a·x+b)대로, 판 밖 타일은 판 아래 놓는 곳에 줄지어(접은 화면은 더미로).
 * u = 길이 1 의 px. 놓는 곳 높이까지 돌려줘 화면이 SVG 높이를 정한다.
 */
export function tilesDraw(
  tiles: Tile[],
  u: number,
  layout?: Omit<TilesLayout, 'u'> & { sel?: number | null },
): {
  rects: TileRect[];
  trayTop: number;
  height: number;
  board: { w: number; h: number };
  /** 접은 화면 더미 자리(비어도 그리는 점선 칸) */
  slots?: Rect[];
} {
  const bw = layout?.board.w ?? BOARD;
  const bh = layout?.board.h ?? BOARD;
  const board = { w: r1(bw * u), h: r1(bh * u) };
  if (layout?.stack) {
    const trayTop = bh * u + TRAY_GAP;
    const placed: TileRect[] = [];
    tiles.forEach((t, n) => {
      if (!t.at) return;
      const s = tileSize(t);
      placed.push({
        key: `t${n}`,
        n,
        x: r1(lenN(t.at.x) * u),
        y: r1(lenN(t.at.y) * u),
        w: r1(lenN(s.w) * u),
        h: r1(lenN(s.h) * u),
        cls: `tile ${t.kind}`,
        placed: true,
      });
    });
    const tray = stackDraw(tiles, u, trayTop, layout.sel);
    return {
      rects: [...placed, ...tray.rects],
      trayTop,
      height: r1(tray.bottom + 4),
      board,
      slots: tray.slots,
    };
  }
  const rects: TileRect[] = [];
  const trayTop = BOARD * u + 14;
  let x = 0;
  let y = trayTop;
  let rowH = 0;
  const gap = 8;
  tiles.forEach((t, n) => {
    const s = tileSize(t);
    const w = lenN(s.w) * u;
    const h = lenN(s.h) * u;
    if (t.at) {
      rects.push({
        key: `t${n}`,
        n,
        x: r1(lenN(t.at.x) * u),
        y: r1(lenN(t.at.y) * u),
        w: r1(w),
        h: r1(h),
        cls: `tile ${t.kind}`,
        placed: true,
      });
      return;
    }
    if (x > 0 && x + w > BOARD * u) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    rects.push({
      key: `t${n}`,
      n,
      x: r1(x),
      y: r1(y),
      w: r1(w),
      h: r1(h),
      cls: `tile ${t.kind}`,
      placed: false,
    });
    x += w + gap;
    rowH = Math.max(rowH, h);
  });
  return { rects, trayTop, height: r1(y + rowH + 4), board };
}

/**
 * 타일을 판 위 px 자리(왼쪽 위)에 놓은 자리. 판 밖으로 나가면 null(놓는 곳으로 돌아간다).
 * board = 판 크기(길이 단위) — 접은 화면은 장면마다 줄인 판(tilesLayout)
 */
export function placeAt(
  t: Tile,
  px: number,
  py: number,
  u: number,
  board: { w: number; h: number } = { w: BOARD, h: BOARD },
): { x: Len; y: Len } | null {
  const s = tileSize(t);
  const x = snapLen(px / u);
  const y = snapLen(py / u);
  if (lenN(x) + lenN(s.w) > board.w + EPS || lenN(y) + lenN(s.h) > board.h + EPS) return null;
  if (px + (lenN(s.w) * u) / 2 < 0 || py > board.h * u) return null;
  return { x, y };
}
