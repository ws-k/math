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

/** 화면에 그릴 물건 하나(낱개 또는 묶음). move 가 null 이면 지금은 옮길 수 없다 */
export interface Item {
  key: string;
  kind: 'cup' | 'coin';
  /** 이 물건에 든 낱개 수(묶음이면 2 이상) */
  n: number;
  move: Move | null;
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

/**
 * 접시와 바닥에 놓일 물건 목록. key 는 낱개 번호라 같은 동전이 접시↔바닥을 오가도 같은 key 다
 * (접시 위는 0번부터, 바닥은 그 뒤 번호). 묶음은 첫 낱개 번호로 key 를 붙인다.
 */
export function layout(p: BalanceParams, s: BalanceState) {
  const z = start(p);
  const a = p.left.x;
  const sp = s.split;
  const k = sp === null ? 0 : sp / a;
  const coin = (side: 'l' | 'r', i: number, n: number, mv: Move | null, lock?: Item['lock']) => ({
    key: `${side}${n > 1 ? 'b' : ''}${i}`,
    kind: 'coin' as const,
    n,
    move: mv,
    ...(lock ? { lock } : {}),
  });
  const can = (m: Move) => (move(p, s, m) ? m : null);
  const cups = (from: number, to: number, dir: 'off' | 'on'): Item[] =>
    Array.from({ length: to - from }, (_, j) => {
      const m = sp === null ? null : can({ side: 'l', dir, bundle: true });
      const lock: Item['lock'] = sp === null ? 'cup' : 'last';
      return { key: `c${from + j}`, kind: 'cup', n: 1, move: m, ...(m ? {} : { lock }) };
    });
  const singles = (side: 'l' | 'r', from: number, to: number, dir: 'off' | 'on'): Item[] =>
    Array.from({ length: to - from }, (_, j) => {
      const m = can({ side, dir, bundle: false });
      return coin(side, from + j, 1, m, m ? undefined : 'split');
    });
  const bundles = (from: number, to: number, dir: 'off' | 'on'): Item[] =>
    k <= 1
      ? Array.from({ length: to - from }, (_, j) =>
          coin('r', from + j, 1, can({ side: 'r', dir, bundle: true })),
        )
      : Array.from({ length: (to - from) / k }, (_, j) =>
          coin('r', from + j * k, k, can({ side: 'r', dir, bundle: true })),
        );
  return {
    pan: {
      l: [...cups(0, s.cups, 'off'), ...singles('l', 0, s.l, 'off')],
      r: sp === null ? singles('r', 0, s.r, 'off') : bundles(0, s.r, 'off'),
    },
    floor: {
      l: [...cups(s.cups, a, 'on'), ...singles('l', s.l, z.l, 'on')],
      r:
        sp === null
          ? singles('r', s.r, z.r, 'on')
          : [...bundles(s.r, sp, 'on'), ...singles('r', sp, z.r, 'on')],
    },
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
 * 옮긴 뒤 보일 안내. anchor = 마지막으로 수평이던 상태, prev = 옮기기 전, next = 옮긴 뒤.
 * 단원 글(ops)이 짚은 조작에 닿았으면 그 글, 아니면 null(화면이 '수평이에요/기울었어요'를 보인다).
 * 한쪽만 바꾼 상태는 실수가 아니라 과정이라 글만 보이고 아무것도 되돌리지 않는다.
 */
export function talk(
  p: BalanceParams,
  anchor: BalanceState,
  prev: BalanceState,
  next: BalanceState,
): { text: string; tone: '' | 'ok' } | null {
  const both = p.ops.filter((o) => o.side === 'both');
  const one = p.ops.filter((o) => o.side !== 'both');
  if (heavier(p, next) !== 0) {
    const o = one.find((x) => same(opResult(p, anchor, x), next));
    return o ? { text: o.say, tone: '' } : null;
  }
  const o = both.find((x) => same(opResult(p, anchor, x), next));
  if (o) return { text: o.say, tone: 'ok' };
  if (same(anchor, next)) {
    const u = one.find((x) => same(opResult(p, anchor, x), prev));
    if (u?.undo) return { text: u.undo, tone: '' };
  }
  // 번갈아 내리며 중간 수평을 거쳐 목표에 닿은 경우에도 목표 글을 보인다
  if (view(p, next).solved) {
    const fin = both.find((x) =>
      reachable(p).some((s) => {
        const t = opResult(p, s, x);
        return !!t && view(p, t).solved;
      }),
    );
    if (fin) return { text: fin.say, tone: 'ok' };
  }
  return null;
}

const ALL_MOVES: Move[] = (['l', 'r'] as const).flatMap((side) =>
  (['off', 'on'] as const).flatMap((dir) => [
    { side, dir, bundle: false },
    { side, dir, bundle: true },
  ]),
);

/** 처음 상태에서 끌기로 닿을 수 있는 모든 상태(개수가 같으면 하나로). 검산과 형식 검사가 쓴다 */
export function reachable(p: BalanceParams, limit = MAX_STATES + 1): BalanceState[] {
  const key = (s: BalanceState) => `${s.cups},${s.l},${s.r},${s.split}`;
  const seen = new Set<string>();
  const out = new Map<string, BalanceState>();
  const queue = [initial(p)];
  while (queue.length && out.size < limit) {
    const s = queue.shift() as BalanceState;
    if (seen.has(key(s))) continue;
    seen.add(key(s));
    const c = `${s.cups},${s.l},${s.r}`;
    if (!out.has(c)) out.set(c, s);
    for (const m of ALL_MOVES) {
      const n = move(p, s, m);
      if (n) queue.push(n);
    }
  }
  return [...out.values()];
}

/** 검산 상태 수 상한 — 한 장면이 sympy 를 수백 번 부르지 않게 */
const MAX_STATES = 120;
/** 접시 하나에 올릴 동전 수 상한(가장 좁은 화면에서 접시 안에 들어가게) */
const MAX_COINS = { l: 8, r: 16 };

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
        `동전이 너무 많음(왼쪽 ${z.l}개·오른쪽 ${z.r}개, 동전 하나 = ${coinOf(p)}) — 각각 ${MAX_COINS.l}·${MAX_COINS.r}개까지`,
      );
    const all = reachable(p);
    if (all.length > MAX_STATES) fail('저울', `끌어서 닿는 상태가 ${MAX_STATES}개를 넘음`);
    if (!all.some((s) => view(p, s).solved))
      fail('저울', '끌어서 x 하나만 남길 수 없음(목표에 닿지 못함)');
    const level = all.filter((s) => heavier(p, s) === 0);
    const has = (t: BalanceState | null) => !!t && all.some((s) => same(t, s));
    for (const [i, op] of p.ops.entries())
      if (!level.some((s) => has(opResult(p, s, op))))
        fail(`저울 연산${i + 1}`, '끌어서 이 조작에 닿을 수 없음(안내 글이 보일 일이 없음)');
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
