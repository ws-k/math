// 저울 부품의 모델(순수). 화면(Balance.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 식은 a·x + b = c (a: 컵 수, b: 왼쪽 동전, c: 오른쪽 동전). 저울 위 물건은 덜어 내거나 나눌 수 있는
// 만큼만 다룬다 — 그래서 빼기는 덜어 낼 동전이 있을 때만, 나누기는 컵만 남고 나누어떨어질 때만 켠다.
import { fill, formatValue } from '../format.ts';
import { arr, fail, int, obj, oneOf, str } from '../parse.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type OpKind = 'add' | 'sub' | 'mul' | 'div';
export type Side = 'both' | 'left' | 'right';

export interface BalanceOp {
  op: OpKind;
  value: number;
  side: Side;
  /** 누른 뒤 안내. {{a}} {{b}} {{c}}(쉼표) {{x}}(c 그대로) 치환 */
  say: string;
  /** 한쪽만 하는 연산은 잠시 뒤 되돌리며 이 안내를 보인다 */
  undo?: string;
}

export interface BalanceParams {
  /** 동전에 붙는 단위 */
  unit: string;
  left: { x: number; c: number };
  right: { c: number };
  intro: string;
  ops: BalanceOp[];
}

export interface BalanceState {
  a: number;
  b: number;
  c: number;
  /** 0 수평, -1 왼쪽이 올라감, 1 오른쪽이 올라감 */
  tilt: -1 | 0 | 1;
}

export const initial = (p: BalanceParams): BalanceState => ({
  a: p.left.x,
  b: p.left.c,
  c: p.right.c,
  tilt: 0,
});

const f = (n: number, o: OpKind, v: number) =>
  o === 'add' ? n + v : o === 'sub' ? n - v : o === 'mul' ? n * v : n / v;

export function apply(s: BalanceState, o: BalanceOp): BalanceState {
  const { op, value: v, side } = o;
  if (side === 'both') {
    if (op === 'add' || op === 'sub') return { ...s, b: f(s.b, op, v), c: f(s.c, op, v) };
    return { a: f(s.a, op, v), b: f(s.b, op, v), c: f(s.c, op, v), tilt: 0 };
  }
  // 한쪽만: 그쪽 무게만 바뀌고 저울이 기운다. 가벼워진 쪽이 올라간다.
  const lighter = op === 'sub' || op === 'div';
  if (side === 'left') {
    const n =
      op === 'add' || op === 'sub'
        ? { ...s, b: f(s.b, op, v) }
        : { ...s, a: f(s.a, op, v), b: f(s.b, op, v) };
    return { ...n, tilt: lighter ? -1 : 1 };
  }
  return { ...s, c: f(s.c, op, v), tilt: lighter ? 1 : -1 };
}

export function enabled(s: BalanceState, o: BalanceOp): boolean {
  if (s.tilt !== 0) return false;
  const v = o.value;
  const left = o.side !== 'right';
  const right = o.side !== 'left';
  switch (o.op) {
    case 'sub':
      return (!left || s.b >= v) && (!right || s.c >= v);
    case 'div':
      return s.b === 0 && s.a > 1 && s.a % v === 0 && (!right || s.c % v === 0);
    case 'mul':
      return s.a * v <= 9;
    case 'add':
      return true;
  }
}

const SIGN: Record<OpKind, string> = { add: '+', sub: '−', mul: '×', div: '÷' };
const SIDE: Record<Side, string> = { both: '양쪽', left: '왼쪽에서만', right: '오른쪽에서만' };

export function opLabel(o: BalanceOp): string {
  const t = `${SIDE[o.side]} ${SIGN[o.op]}${formatValue(String(o.value), {})}`;
  return o.side === 'both' ? t : `${t} 해 보기`;
}

/** 저울 상태의 sympy 식 */
export const eqSym = (s: BalanceState) =>
  `${s.a === 1 ? 'x' : `${s.a}*x`}${s.b ? `+${s.b}` : ''}=${s.c}`;

/** 화면에 그릴 것: 식(KaTeX)·안내 치환 값·목표 달성 */
export function view(s: BalanceState) {
  const left = `${s.a === 1 ? '' : s.a}x${s.b ? `+${s.b}` : ''}`;
  return {
    tex: `${left}${s.tilt ? '\\neq ' : '='}${s.c}`,
    vars: {
      a: formatValue(String(s.a), {}),
      b: formatValue(String(s.b), {}),
      c: formatValue(String(s.c), {}),
      x: String(s.c),
    },
    solved: s.tilt === 0 && s.a === 1 && s.b === 0,
  };
}

/** 처음 상태에서 버튼으로 닿을 수 있는 모든 (상태, 연산) — 검산과 목표 도달 확인에 쓴다 */
function explore(p: BalanceParams) {
  const steps: { from: BalanceState; to: BalanceState; op: BalanceOp }[] = [];
  const seen = new Set<string>();
  const queue = [initial(p)];
  let goal: BalanceState | null = null;
  while (queue.length && seen.size < 50) {
    const s = queue.shift() as BalanceState;
    const k = eqSym(s);
    if (seen.has(k)) continue;
    seen.add(k);
    if (view(s).solved) goal ??= s;
    for (const o of p.ops) {
      if (!enabled(s, o)) continue;
      const t = apply(s, o);
      steps.push({ from: s, to: t, op: o });
      if (t.tilt === 0) queue.push(t);
    }
  }
  return { steps, goal };
}

export const balanceDef: WidgetDef<BalanceParams> = {
  parse(raw) {
    const o = obj(raw, '저울', ['unit', 'left', 'right', 'intro', 'ops']);
    const l = obj(o.left, '저울 left', ['x', 'c']);
    const r = obj(o.right, '저울 right', ['c']);
    const p: BalanceParams = {
      unit: str(o.unit, '저울 unit'),
      left: { x: int(l.x, '저울 left.x', 1, 9), c: int(l.c, '저울 left.c', 0, 1e9) },
      right: { c: int(r.c, '저울 right.c', 0, 1e9) },
      intro: str(o.intro, '저울 intro'),
      ops: arr(o.ops, '저울 ops', 1, 6).map((ro, i) => {
        const at = `저울 연산${i + 1}`;
        const x = obj(ro, at, ['op', 'value', 'side', 'say'], ['undo']);
        const side = oneOf(x.side, `${at} side`, ['both', 'left', 'right'] as const);
        const undo = x.undo === undefined ? undefined : str(x.undo, `${at} undo`);
        if ((side === 'both') !== (undo === undefined))
          fail(at, '한쪽만 하는 연산에만, 그리고 반드시 undo 가 있어야 함');
        return {
          op: oneOf(x.op, `${at} op`, ['add', 'sub', 'mul', 'div'] as const),
          value: int(x.value, `${at} value`, 1, 1e9),
          side,
          say: str(x.say, `${at} say`),
          ...(undo !== undefined ? { undo } : {}),
        };
      }),
    };
    if (!explore(p).goal) fail('저울', '버튼으로 x 하나만 남길 수 없음(목표에 닿지 못함)');
    return p;
  },
  checks(p) {
    const { steps, goal } = explore(p);
    const out: WidgetCheck[] = steps.map((s, i) => ({
      name: `연산${i + 1}`,
      kind: 'equiv',
      before: eqSym(s.from),
      after: eqSym(s.to),
      expect: s.op.side === 'both',
    }));
    const s0 = initial(p);
    out.push({
      name: '해',
      answer: String(goal?.c),
      answerType: 'int',
      check: `solve(Eq(${s0.a === 1 ? 'x' : `${s0.a}*x`}${s0.b ? `+${s0.b}` : ''}, ${s0.c}), x)[0]`,
    });
    return out;
  },
  // 안내 글의 {{a}} 등은 저울 상태 값이라 여기서 채워 넘긴다(모르는 이름이면 fill 이 오류를 낸다)
  texts: (p) => {
    const vars = view(initial(p)).vars;
    return [p.intro, ...p.ops.flatMap((o) => [o.say, ...(o.undo ? [o.undo] : [])])].map((t) =>
      fill(t, vars),
    );
  },
};
