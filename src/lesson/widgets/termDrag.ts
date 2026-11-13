// 항 끌기 부품의 모델(순수). 등호 건너편으로 항을 옮기면 부호가 바뀐다(이항).
// 화면(TermDrag.tsx)과 검산(checks)이 같은 함수를 쓴다.
import { formatValue, symToTex } from '../format.ts';
import { arr, fail, int, obj, str } from '../parse.ts';
import type { WidgetDef } from './specs.ts';

export interface TermDragParams {
  /** 왼쪽 변의 항(sympy 문법). 둘째 항부터는 부호(+/-)로 시작 */
  lhs: string[];
  rhs: string[];
  /** 옮길 왼쪽 항 번호(0부터) */
  move: number;
  /** 옮긴 뒤 보이는 설명 */
  note: string;
}

export function flipSign(t: string): string {
  if (t.startsWith('-')) return `+${t.slice(1)}`;
  return `-${t.startsWith('+') ? t.slice(1) : t}`;
}

export function moved(p: TermDragParams): { lhs: string[]; rhs: string[] } {
  const t = p.lhs[p.move] as string;
  return { lhs: p.lhs.filter((_, i) => i !== p.move), rhs: [...p.rhs, flipSign(t)] };
}

/** 한쪽 변의 항을 이어 붙인 식. 맨 앞의 + 는 뗀다 */
export const sideSym = (ts: string[]) => ts.join('').replace(/^\+/, '');

/** 항 하나의 KaTeX */
export const termTex = (t: string) => symToTex(t);

/** 화면에 보일 항 하나. key 는 원래 자리(l0·r1)나 'mover' — 같은 항이 두 번 나와도 겹치지 않는다 */
export interface ShownTerm {
  key: string;
  /** 부호까지 붙인 그대로 보일 항. 변의 맨 앞이면 + 를 떼고, 아니면 늘 부호로 시작한다 */
  sym: string;
  mover: boolean;
}

/**
 * (매개변수, 옮겼나) → 양 변에 보일 항. 화면(TermDrag.tsx)도 검산(checks)도 이것 하나로 식을 만든다 —
 * 화면이 따로 항을 늘어놓으면 검산한 식과 보이는 식이 어긋날 틈이 생긴다.
 */
export function layout(
  p: TermDragParams,
  flipped: boolean,
): { lhs: ShownTerm[]; rhs: ShownTerm[] } {
  if (!Number.isInteger(p.move) || p.move < 0 || p.move >= p.lhs.length)
    throw new Error(`항 끌기 move 범위 밖 (${p.move})`);
  const orig = p.lhs[p.move] as string;
  const mover: ShownTerm = { key: 'mover', sym: flipped ? flipSign(orig) : orig, mover: true };
  const lhs: ShownTerm[] = p.lhs.map((sym, i) =>
    i === p.move ? mover : { key: `l${i}`, sym, mover: false },
  );
  const rhs: ShownTerm[] = p.rhs.map((sym, i) => ({ key: `r${i}`, sym, mover: false }));
  const L = flipped ? lhs.filter((t) => !t.mover) : lhs;
  const R = flipped ? [...rhs, mover] : rhs;
  const norm = (ts: ShownTerm[]) =>
    ts.map((t, i) => ({
      ...t,
      sym: i === 0 ? t.sym.replace(/^\+/, '') : /^[+-]/.test(t.sym) ? t.sym : `+${t.sym}`,
    }));
  return { lhs: norm(L), rhs: norm(R) };
}

const eqOf = (v: { lhs: ShownTerm[]; rhs: ShownTerm[] }) =>
  `${sideSym(v.lhs.map((t) => t.sym))}=${sideSym(v.rhs.map((t) => t.sym))}`;

function side(v: unknown, at: string): string[] {
  return arr(v, at, 1, 6).map((x, i) => {
    const t = str(x, `${at}${i + 1}`).replace(/\s+/g, '');
    try {
      symToTex(t);
    } catch (e) {
      fail(`${at}${i + 1}`, (e as Error).message);
    }
    if (i > 0 && !/^[+-]/.test(t)) fail(`${at}${i + 1}`, '둘째 항부터는 + 나 - 로 시작');
    return t;
  });
}

/** 항 하나를 글 속 글자로: 숫자면 부호+쉼표(+1,000·−1,000), 아니면 수식 */
function termText(t: string): string {
  const m = t.match(/^([+-]?)(\d+(?:\.\d+)?)$/);
  if (m) return (m[1] === '-' ? '−' : '+') + formatValue(m[2] as string, {});
  return `$${symToTex(t)}$`;
}

export const termDragDef: WidgetDef<TermDragParams> = {
  parse(raw) {
    const o = obj(raw, '항 끌기', ['lhs', 'rhs', 'move', 'note']);
    const lhs = side(o.lhs, '항 끌기 lhs');
    const p: TermDragParams = {
      lhs,
      rhs: side(o.rhs, '항 끌기 rhs'),
      move: int(o.move, '항 끌기 move', 0, lhs.length - 1),
      note: str(o.note, '항 끌기 note'),
    };
    if (lhs.length < 2) fail('항 끌기', '옮기고 남는 항이 있어야 함(왼쪽 항 2개 이상)');
    return p;
  },
  checks(p) {
    const before = eqOf(layout(p, false));
    const after = layout(p, true);
    // 흔한 실수: 부호를 그대로 둔 채 옮기기. 이것은 동치가 아니어야 이 부품이 보여 주는 규칙이 맞다.
    const t = p.lhs[p.move] as string;
    const naive = {
      lhs: after.lhs,
      rhs: after.rhs.map((x) => (x.mover ? { ...x, sym: /^[+-]/.test(t) ? t : `+${t}` } : x)),
    };
    return [
      { name: '옮기기', kind: 'equiv', before, after: eqOf(after), expect: true },
      { name: '부호 그대로', kind: 'equiv', before, after: eqOf(naive), expect: false },
    ];
  },
  texts: (p) => [p.note],
  // 설명 글의 {{from}}·{{to}}: 옮기기 전·후 항. 검산한 바로 그 항(layout)에서 만든다
  vars(p) {
    const t = p.lhs[p.move] as string;
    return { from: termText(/^[+-]/.test(t) ? t : `+${t}`), to: termText(flipSign(t)) };
  },
  equation: (p) => eqOf(layout(p, false)),
};
