// 저울 부품의 모델(순수). 화면(Balance.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 식은 a·x + b = c (a: 컵 수, b: 왼쪽 동전, c: 오른쪽 동전). 학습자는 접시 위 물건을 손으로 끌어 바닥에
// 내리고 다시 올린다. 버튼이 결과를 대신 그려 주지 않고, 저울은 실제 무게(컵 하나 = 방정식의 해)로 기운다.
//
// 무게는 '동전' 낱개로 센다. 동전 하나의 값(coinOf)은 처음 식·덜어 낼 값·해의 최대공약수 —
// 그래야 "양쪽에서 1,000원 덜기"가 동전 한 개씩이고, 나누기 몫도 동전 몇 개로 딱 떨어진다.
// 컵(x)은 무게를 모르는 물건이라 낱개로 내리지 못한다. 왼쪽에 컵만 남고 수평이면 양쪽이 컵 수만큼의
// 같은 묶음으로 나뉘고(split), 그때부터는 묶음째로만 움직인다 — 그것이 '양쪽을 똑같이 나누기'다.
import { formatValue, symToTex } from '../format.ts';
import { arr, fail, int, obj, oneOf, str } from '../parse.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type OpKind = 'sub' | 'div';
export type Side = 'both' | 'left' | 'right';

/**
 * 단원 글이 짚어 주는 조작 하나. 버튼이 아니라 "이 조작에 닿으면 이 글을 보인다"는 표시다.
 * 기준은 마지막으로 수평이던 상태(anchor)에서 이 조작을 한 결과와 지금 상태가 같은가.
 */
export interface BalanceOp {
  op: OpKind;
  value: number;
  side: Side;
  /** 이 조작에 닿았을 때 안내. {{a}} {{b}} {{c}}(쉼표) {{x}}(c 그대로) 치환 */
  say: string;
  /** 한쪽만 하는 조작에서, 학습자가 그것을 도로 올려 처음 수평으로 돌아왔을 때 안내 */
  undo?: string;
}

export interface BalanceParams {
  /** 동전에 붙는 단위. 비워도 된다(단위 없는 비례식) */
  unit: string;
  left: { x: number; c: number };
  right: { c: number };
  intro: string;
  ops: BalanceOp[];
}

/** 저울 위 상태. 수는 모두 '접시 위에 있는 개수'(동전은 coinOf 단위) */
export interface BalanceState {
  /** 왼쪽 접시의 컵 수 */
  cups: number;
  /** 왼쪽 접시의 동전 수 */
  l: number;
  /** 오른쪽 접시의 동전 수 */
  r: number;
  /** 묶음으로 나뉜 순간 오른쪽 동전 수(묶음 하나 = 이 수 ÷ 처음 컵 수). 나뉘지 않았으면 null */
  split: number | null;
}

/** 손으로 하는 한 번의 옮김: 어느 쪽에서, 접시→바닥(off)인지 바닥→접시(on)인지, 묶음째인지 */
export interface Move {
  side: 'l' | 'r';
  dir: 'off' | 'on';
  bundle: boolean;
}

/**
 * 화면 쪽 물건 배치(누가 어디 있나). 수학(개수)은 s 가 쥐고, 이것은 같은 개수를 물건 id 로 펼친 것이다 —
 * 그래야 학습자가 끈 바로 그 동전이 바닥으로 가고(5번을 끌면 5번이), 묶음으로 묶이고 풀릴 때 동전마다
 * 제자리에서 묶음 자리로 옮겨 가는 것을 그릴 수 있다. 검산은 개수(s)만 본다.
 * id: 컵 c0…, 왼쪽 동전 l0…, 오른쪽 동전 r0…, 묶음 b+첫 동전 id(예: br4)
 */
export interface Board {
  s: BalanceState;
  pan: { l: string[]; r: string[] };
  floor: { l: string[]; r: string[] };
  /** 묶음 id → 든 동전 id. 나뉘지 않았으면 빈 객체 */
  bundles: Record<string, string[]>;
}

/** 화면에 그릴 물건 하나(낱개 또는 묶음) */
export interface Item {
  key: string;
  kind: 'cup' | 'coin';
  /** 나누기 묶음인가(동전 하나짜리 묶음도 묶음 모양으로 그린다) */
  bundle: boolean;
  /** 이 물건을 이루는 낱개 id(컵은 자기 하나). 날아가기 연출이 낱개마다 옛 자리를 찾는 데 쓴다 */
  atoms: string[];
  /** 지금 옮길 수 있나 */
  can: boolean;
  /** 옮길 수 없는 까닭(화면 안내용) */
  lock?: 'cup' | 'last' | 'split';
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** 해(컵 하나의 무게). parse 가 자연수임을 확인한다 */
export const solutionOf = (p: BalanceParams) => (p.right.c - p.left.c) / p.left.x;

/** 동전 하나의 값: 처음 식·덜어 낼 값·해의 최대공약수 */
export function coinOf(p: BalanceParams): number {
  const subs = p.ops.filter((o) => o.op === 'sub').map((o) => o.value);
  return [p.left.c, p.right.c, solutionOf(p), ...subs].reduce(gcd, 0);
}

const hasDiv = (p: BalanceParams) => p.ops.some((o) => o.op === 'div' && o.side === 'both');

/** 양쪽 무게 차의 부호. 1 = 왼쪽이 무거움, -1 = 오른쪽이 무거움, 0 = 수평 */
export function heavier(p: BalanceParams, s: BalanceState): -1 | 0 | 1 {
  const d = coinOf(p);
  const diff = s.cups * solutionOf(p) + s.l * d - s.r * d;
  return diff > 0 ? 1 : diff < 0 ? -1 : 0;
}

/** 왼쪽에 컵만 남고 수평이면 컵 수만큼의 같은 묶음으로 나눈다(나누기 조작이 있는 저울만) */
function settle(p: BalanceParams, s: BalanceState): BalanceState {
  const a = p.left.x;
  if (s.split === null && hasDiv(p) && s.l === 0 && s.cups === a && heavier(p, s) === 0)
    return { ...s, split: s.r };
  return s;
}

export const initial = (p: BalanceParams): BalanceState => {
  const d = coinOf(p);
  return settle(p, { cups: p.left.x, l: p.left.c / d, r: p.right.c / d, split: null });
};

/** 처음 상태의 동전 수 */
const start = (p: BalanceParams) => {
  const d = coinOf(p);
  return { l: p.left.c / d, r: p.right.c / d };
};

/** 묶음이 모두 접시 위에 있나(나뉜 그 순간 그대로인가) */
const atBase = (p: BalanceParams, s: BalanceState) =>
  s.split !== null && s.cups === p.left.x && s.r === s.split;

/** 옮긴 결과. 지금 할 수 없는 옮김이면 null */
export function move(p: BalanceParams, s: BalanceState, m: Move): BalanceState | null {
  const z = start(p);
  const k = s.split === null ? 0 : s.split / p.left.x;
  let n: BalanceState | null = null;
  if (!m.bundle) {
    // 낱개 동전. 묶음으로 나뉜 뒤에는 묶음이 다 올라가 있을 때만 낱개를 올릴 수 있고, 올리면 묶음이 풀린다
    if (m.dir === 'off') {
      if (s.split !== null) return null;
      if (m.side === 'l' && s.l > 0) n = { ...s, l: s.l - 1 };
      if (m.side === 'r' && s.r > 0) n = { ...s, r: s.r - 1 };
    } else {
      if (s.split !== null && !atBase(p, s)) return null;
      const r0 = s.split ?? s.r;
      if (m.side === 'l' && s.l < z.l) n = { ...s, l: s.l + 1, split: null };
      if (m.side === 'r' && r0 < z.r) n = { ...s, r: s.r + 1, split: null };
    }
  } else {
    if (s.split === null) return null;
    if (m.side === 'l') {
      // 컵 하나는 남긴다 — x 를 구하는 저울이라 컵이 없으면 식이 사라진다
      if (m.dir === 'off' && s.cups > 1) n = { ...s, cups: s.cups - 1 };
      if (m.dir === 'on' && s.cups < p.left.x) n = { ...s, cups: s.cups + 1 };
    } else {
      if (m.dir === 'off' && s.r >= k) n = { ...s, r: s.r - k };
      if (m.dir === 'on' && s.r < s.split) n = { ...s, r: s.r + k };
    }
  }
  return n && settle(p, n);
}

/** 저울 상태의 sympy 식 */
export function eqSym(p: BalanceParams, s: BalanceState): string {
  const d = coinOf(p);
  const b = s.l * d;
  return `${s.cups === 1 ? 'x' : `${s.cups}*x`}${b ? `+${b}` : ''}=${s.r * d}`;
}

/** 가장 작게 기울 때와 가장 크게 기울 때(도). 동전 한 개 차이도 눈에 보이게 최소값을 둔다 */
const MIN_DEG = 3;
const MAX_DEG = 12;

/**
 * 막대 회전각(도). 양수 = 시계 방향(오른쪽이 내려감). 무게 차이를 양쪽 무게 합으로 나눈 비율이 클수록
 * 더 기운다(비율 1/4 이상이면 최대) — 실제 저울처럼 '얼마나 다른가'가 보이게.
 */
export function tiltDeg(p: BalanceParams, s: BalanceState): number {
  const h = heavier(p, s);
  if (h === 0) return 0;
  const d = coinOf(p);
  const L = s.cups * solutionOf(p) + s.l * d;
  const R = s.r * d;
  const ratio = Math.min(1, (4 * Math.abs(L - R)) / (L + R));
  return -h * Number((MIN_DEG + (MAX_DEG - MIN_DEG) * ratio).toFixed(2));
}

/** 화면에 그릴 것: 식(KaTeX)·안내 치환 값·목표 달성 */
export function view(p: BalanceParams, s: BalanceState) {
  // 화면 식도 검산 식(eqSym)에서 만든다 — 두 곳에서 따로 조립하면 한쪽만 고쳐질 수 있다
  const level = heavier(p, s) === 0;
  const [l, r] = eqSym(p, s).split('=').map(symToTex) as [string, string];
  const d = coinOf(p);
  return {
    tex: `${l}${level ? '=' : '\\neq '}${r}`,
    vars: {
      a: formatValue(String(s.cups), {}),
      b: formatValue(String(s.l * d), {}),
      c: formatValue(String(s.r * d), {}),
      x: String(s.r * d),
    },
    level,
    solved: level && s.cups === 1 && s.l === 0,
  };
}

export function board0(p: BalanceParams): Board {
  const s = initial(p);
  const ids = (pre: string, n: number) => Array.from({ length: n }, (_, i) => `${pre}${i}`);
  const b: Board = {
    s: { ...s, split: null },
    pan: { l: [...ids('c', s.cups), ...ids('l', s.l)], r: ids('r', s.r) },
    floor: { l: [], r: [] },
    bundles: {},
  };
  return regroup(p, b, s);
}

/** 개수 상태 n 에 맞춰 묶음을 만들거나 푼다(나뉘는 순간 접시 위 동전을 차례대로 묶는다) */
function regroup(p: BalanceParams, b: Board, n: BalanceState): Board {
  if (b.s.split === null && n.split !== null) {
    const k = n.split / p.left.x;
    const coins = b.pan.r;
    const bundles: Record<string, string[]> = {};
    const pan = Array.from({ length: coins.length / k }, (_, i) => {
      const g = coins.slice(i * k, i * k + k);
      bundles[`b${g[0]}`] = g;
      return `b${g[0]}`;
    });
    return { ...b, s: n, pan: { ...b.pan, r: pan }, bundles };
  }
  if (b.s.split !== null && n.split === null) {
    const flat = b.pan.r.flatMap((id) => b.bundles[id] ?? [id]);
    return { ...b, s: n, pan: { ...b.pan, r: flat }, bundles: {} };
  }
  return { ...b, s: n };
}

/** 물건 하나가 있는 곳 */
function locate(b: Board, id: string): { at: 'pan' | 'floor'; side: 'l' | 'r' } | null {
  for (const at of ['pan', 'floor'] as const)
    for (const side of ['l', 'r'] as const) if (b[at][side].includes(id)) return { at, side };
  return null;
}

/** 물건 id 의 개수 단위 옮김(접시→바닥 또는 바닥→접시) */
function moveOf(b: Board, id: string): Move | null {
  const w = locate(b, id);
  if (!w) return null;
  return {
    side: w.side,
    dir: w.at === 'pan' ? 'off' : 'on',
    bundle: id[0] !== 'l' && id[0] !== 'r',
  };
}

/** 물건 id 를 반대쪽(접시↔바닥)으로 옮긴 배치. 지금 할 수 없으면 null */
export function moveItem(p: BalanceParams, b: Board, id: string): Board | null {
  const m = moveOf(b, id);
  const n = m && move(p, b.s, m);
  if (!m || !n) return null;
  const from = m.dir === 'off' ? 'pan' : 'floor';
  const to = m.dir === 'off' ? 'floor' : 'pan';
  const moved: Board = {
    ...b,
    [from]: { ...b[from], [m.side]: b[from][m.side].filter((x) => x !== id) },
    [to]: { ...b[to], [m.side]: [...b[to][m.side], id] },
  };
  return regroup(p, moved, n);
}

/** 접시와 바닥에 놓일 물건 목록(배치 순서 그대로) */
export function layout(p: BalanceParams, b: Board) {
  const div = hasDiv(p);
  const item = (id: string): Item => {
    const m = moveOf(b, id);
    const can = !!m && !!move(p, b.s, m);
    const kind = id[0] === 'c' ? 'cup' : 'coin';
    const bundle = id[0] === 'b';
    const lock: Item['lock'] | undefined = can
      ? undefined
      : kind === 'cup'
        ? // 나누기가 있는 저울의 컵은 나중에 묶음으로, 없는 저울(컵 하나)은 늘 남겨 둔다
          b.s.split === null && div
          ? 'cup'
          : 'last'
        : 'split';
    return {
      key: id,
      kind,
      bundle,
      atoms: b.bundles[id] ?? [id],
      can,
      ...(lock ? { lock } : {}),
    };
  };
  return {
    pan: { l: b.pan.l.map(item), r: b.pan.r.map(item) },
    floor: { l: b.floor.l.map(item), r: b.floor.r.map(item) },
  };
}

const same = (a: BalanceState | null, b: BalanceState) =>
  !!a && a.cups === b.cups && a.l === b.l && a.r === b.r;

/** 수평 상태 s 에서 조작 o 를 한 결과(개수만). 할 수 없는 조작이면 null */
export function opResult(p: BalanceParams, s: BalanceState, o: BalanceOp): BalanceState | null {
  const left = o.side !== 'right';
  const right = o.side !== 'left';
  if (o.op === 'sub') {
    const k = o.value / coinOf(p);
    if ((left && s.l < k) || (right && s.r < k)) return null;
    return { ...s, l: left ? s.l - k : s.l, r: right ? s.r - k : s.r };
  }
  // 나누기는 컵 수로만(parse) — 컵만 남은 처음 컵 수 상태에서 몫이 딱 떨어질 때
  const n = o.value;
  if (s.l !== 0 || s.cups !== p.left.x || (right && s.r % n !== 0)) return null;
  return { ...s, cups: left ? 1 : s.cups, r: right ? s.r / n : s.r };
}

/**
 * 안내 글을 고르려고 기억해 두는 것. levels = 지금까지 지나온 수평 상태(단원 글이 짚은 조작은 그중 어느
 * 것에서 했어도 알아본다 — 한 번에 하나씩 옮기는 손은 중간 수평을 거치기 쉬워서),
 * hit = 한쪽만 한 조작의 글이 떴던 기록(그 조작을 시작한 수평 상태로 돌아오면 undo 를 보인다).
 */
export interface Guide {
  levels: BalanceState[];
  hit: { op: number; from: BalanceState } | null;
}

export const guide0 = (p: BalanceParams): Guide => ({ levels: [initial(p)], hit: null });

/**
 * 옮긴 뒤(next) 보일 안내와 새 기억. 단원 글(ops)이 짚은 조작에 닿았으면 그 글, 아니면 null(화면이
 * '수평이에요/기울었어요'를 보인다). 한쪽만 바꾼 상태는 실수가 아니라 과정이라 글만 보이고 되돌리지 않는다.
 */
export function talk(
  p: BalanceParams,
  g: Guide,
  next: BalanceState,
): { say: { text: string; tone: '' | 'ok' } | null; guide: Guide } {
  const recent = [...g.levels].reverse();
  const find = (side: (o: BalanceOp) => boolean) => {
    for (const [i, o] of p.ops.entries())
      if (side(o)) for (const L of recent) if (same(opResult(p, L, o), next)) return { i, o, L };
    return null;
  };
  if (heavier(p, next) !== 0) {
    const f = find((o) => o.side !== 'both');
    if (!f) return { say: null, guide: g };
    return { say: { text: f.o.say, tone: '' }, guide: { ...g, hit: { op: f.i, from: f.L } } };
  }
  const guide: Guide = {
    levels: g.levels.some((L) => same(L, next)) ? g.levels : [...g.levels, next],
    hit: null,
  };
  const u = g.hit && same(g.hit.from, next) ? p.ops[g.hit.op]?.undo : undefined;
  if (u) return { say: { text: u, tone: '' }, guide };
  const f = find((o) => o.side === 'both');
  return { say: f ? { text: f.o.say, tone: 'ok' } : null, guide };
}

const ALL_MOVES: Move[] = (['l', 'r'] as const).flatMap((side) =>
  (['off', 'on'] as const).flatMap((dir) => [
    { side, dir, bundle: false },
    { side, dir, bundle: true },
  ]),
);

const fullKey = (s: BalanceState) => `${s.cups},${s.l},${s.r},${s.split}`;

/** 끌기로 닿는 모든 상태(묶음 여부까지 구분). 형식 검사가 길을 따질 때 쓴다 */
function graph(p: BalanceParams, limit: number): BalanceState[] {
  const seen = new Map<string, BalanceState>();
  const queue = [initial(p)];
  while (queue.length && seen.size < limit) {
    const s = queue.shift() as BalanceState;
    if (seen.has(fullKey(s))) continue;
    seen.set(fullKey(s), s);
    for (const m of ALL_MOVES) {
      const n = move(p, s, m);
      if (n) queue.push(n);
    }
  }
  return [...seen.values()];
}

/** 처음 상태에서 끌기로 닿을 수 있는 모든 상태(개수가 같으면 하나로). 검산과 형식 검사가 쓴다 */
export function reachable(p: BalanceParams, limit = MAX_STATES + 1): BalanceState[] {
  const out = new Map<string, BalanceState>();
  for (const s of graph(p, limit * 2)) {
    const c = `${s.cups},${s.l},${s.r}`;
    if (!out.has(c)) out.set(c, s);
  }
  return [...out.values()].slice(0, limit);
}

/** 한쪽 조작의 결과 t 에서 기운 상태만 지나 수평 상태 L 로 돌아올 길이 있나(undo 가 보일 길) */
function backTo(p: BalanceParams, t: BalanceState, L: BalanceState): boolean {
  const seen = new Set<string>();
  const queue = [t];
  while (queue.length) {
    const s = queue.shift() as BalanceState;
    if (seen.has(fullKey(s))) continue;
    seen.add(fullKey(s));
    for (const m of ALL_MOVES) {
      const n = move(p, s, m);
      if (!n) continue;
      if (same(L, n)) return true;
      if (heavier(p, n) !== 0) queue.push(n);
    }
  }
  return false;
}

/** 양쪽 조작을 한 개씩 번갈아(왼쪽·오른쪽) 했을 때 마지막에 그 조작의 글이 뜨나 */
function alternates(p: BalanceParams, L: BalanceState, o: BalanceOp): boolean {
  const k = o.op === 'sub' ? o.value / coinOf(p) : p.left.x - 1;
  let s = L;
  let g: Guide = { levels: [L], hit: null };
  let last: string | null = null;
  for (let i = 0; i < k; i++)
    for (const side of ['l', 'r'] as const) {
      const n = move(p, s, { side, dir: 'off', bundle: o.op === 'div' });
      if (!n) return false;
      const t = talk(p, g, n);
      ({ guide: g } = t);
      last = t.say?.text ?? null;
      s = n;
    }
  return last === o.say;
}

/** 컵은 가장 좁은 화면(382px)의 접시 한 줄에 들어가는 4개까지 */
const MAX_X = 4;
/** 접시 하나에 올릴 동전 수 상한(가장 좁은 화면에서 접시 안에 세 줄 이하로 들어가게) */
const MAX_COINS = { l: 8, r: 16 };
/**
 * 검산 상태 수 상한 — 위 두 한도에서 나올 수 있는 최대(낱개 단계 9×17 + 묶음 단계 4×5)와 맞춘다.
 * 한도 안의 저울이 이 검사에 걸리는 일은 없고, 한도를 바꿀 때 같이 바뀌게 계산으로 둔다.
 */
const MAX_STATES = (MAX_COINS.l + 1) * (MAX_COINS.r + 1) + MAX_X * (MAX_X + 1);

export const balanceDef: WidgetDef<BalanceParams> = {
  parse(raw) {
    const o = obj(raw, '저울', ['unit', 'left', 'right', 'intro', 'ops']);
    const l = obj(o.left, '저울 left', ['x', 'c']);
    const r = obj(o.right, '저울 right', ['c']);
    if (typeof o.unit !== 'string') fail('저울 unit', '글이 아님');
    const p: BalanceParams = {
      unit: o.unit as string,
      left: { x: int(l.x, '저울 left.x', 1, 9), c: int(l.c, '저울 left.c', 0, 1e9) },
      right: { c: int(r.c, '저울 right.c', 1, 1e9) },
      intro: str(o.intro, '저울 intro'),
      ops: arr(o.ops, '저울 ops', 1, 6).map((ro, i) => {
        const at = `저울 연산${i + 1}`;
        const x = obj(ro, at, ['op', 'value', 'side', 'say'], ['undo']);
        const side = oneOf(x.side, `${at} side`, ['both', 'left', 'right'] as const);
        const undo = x.undo === undefined ? undefined : str(x.undo, `${at} undo`);
        if ((side === 'both') !== (undo === undefined))
          fail(at, '한쪽만 하는 연산에만, 그리고 반드시 undo 가 있어야 함');
        return {
          op: oneOf(x.op, `${at} op`, ['sub', 'div'] as const),
          value: int(x.value, `${at} value`, 1, 1e9),
          side,
          say: str(x.say, `${at} say`),
          ...(undo !== undefined ? { undo } : {}),
        };
      }),
    };
    if (p.left.x > MAX_X)
      fail(
        '저울 left.x',
        `컵 ${p.left.x}개 — 가장 좁은 화면의 접시 한 줄에 들어가는 ${MAX_X}개까지`,
      );
    const x0 = solutionOf(p);
    if (!Number.isInteger(x0) || x0 <= 0)
      fail('저울', `해가 자연수가 아님(${x0}) — 컵 무게를 동전으로 나타낼 수 없음`);
    for (const [i, op] of p.ops.entries()) {
      if (op.op === 'div' && (op.value !== p.left.x || op.value < 2))
        fail(`저울 연산${i + 1}`, '나누기는 컵 수(left.x, 2 이상)로만 — 컵 하나를 남기는 나누기');
      const dup = p.ops.findIndex(
        (q) => q.op === op.op && q.value === op.value && q.side === op.side,
      );
      if (dup !== i) fail(`저울 연산${i + 1}`, `연산${dup + 1}과 같은 연산`);
    }
    const z = start(p);
    if (z.l > MAX_COINS.l || z.r > MAX_COINS.r)
      fail(
        '저울',
        `동전이 너무 많음(왼쪽 ${z.l}개·오른쪽 ${z.r}개, 동전 하나 = ${coinOf(p)}) — 왼쪽 ${MAX_COINS.l}개·오른쪽 ${MAX_COINS.r}개까지. ` +
          '금액을 줄이거나, 금액·덜 값·해가 더 큰 수의 배수가 되게 바꾸세요(동전 하나 = 그 최대공약수)',
      );
    const all = reachable(p);
    if (all.length > MAX_STATES) fail('저울', `끌어서 닿는 상태가 ${MAX_STATES}개를 넘음`);
    if (!all.some((s) => view(p, s).solved))
      fail(
        '저울',
        '끌어서 x 하나만 남길 수 없음(목표에 닿지 못함) — 나누기(div) 조작이 필요한지 보세요',
      );
    const states = graph(p, MAX_STATES * 2);
    const level = states.filter((s) => heavier(p, s) === 0);
    const at = (t: BalanceState | null) => (t ? states.filter((s) => same(t, s)) : []);
    for (const [i, op] of p.ops.entries()) {
      const w = `저울 연산${i + 1}`;
      const from = level.filter((L) => at(opResult(p, L, op)).length > 0);
      if (!from.length) fail(w, '끌어서 이 조작에 닿을 수 없음(안내 글이 보일 일이 없음)');
      if (op.side === 'both' && !from.some((L) => alternates(p, L, op)))
        fail(w, '한 개씩 번갈아 옮기는 길에서 이 글이 뜨지 않음');
      if (
        op.side !== 'both' &&
        !from.some((L) => at(opResult(p, L, op)).some((t) => backTo(p, t, L)))
      )
        fail(w, '도로 올려 처음 수평으로 돌아올 길이 없어 undo 가 보일 일이 없음');
    }
    return p;
  },
  checks(p) {
    const s0 = initial(p);
    const eq0 = eqSym(p, s0);
    const [L0, R0] = eq0.split('=') as [string, string];
    const out: WidgetCheck[] = [];
    let goal: BalanceState | undefined;
    for (const s of reachable(p)) {
      if (view(p, s).solved) goal ??= s;
      if (same(s0, s)) continue;
      const eq = eqSym(p, s);
      const [L, R] = eq.split('=') as [string, string];
      const h = heavier(p, s);
      if (h === 0) {
        // 수평으로 그리는 상태는 처음 식과 해가 같아야 한다
        out.push({ name: `수평 ${eq}`, kind: 'equiv', before: eq0, after: eq, expect: true });
      } else {
        // 기운 쪽: 컵에 해를 넣어 어느 쪽이 무거운지 sympy 가 다시 잰다(화면은 이 부호로 기운다)
        out.push({
          name: `기욺 ${eq}`,
          answer: String(h),
          answerType: 'int',
          check: `sign((${L})-(${R})).subs(x, solve(Eq(${L0}, ${R0}), x)[0])`,
        });
      }
    }
    out.push({
      name: '해',
      answer: String(goal ? goal.r * coinOf(p) : NaN),
      answerType: 'int',
      check: `solve(Eq(${L0}, ${R0}), x)[0]`,
    });
    return out;
  },
  texts: (p) => [p.intro, ...p.ops.flatMap((o) => [o.say, ...(o.undo ? [o.undo] : [])])],
  // 안내 글의 {{a}} 등은 저울 상태 값이다. 검사기는 처음 상태 값으로 채워 모르는 이름을 잡는다
  vars: (p) => view(p, initial(p)).vars,
  equation: (p) => eqSym(p, initial(p)),
};
