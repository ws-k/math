// 항 끌기 부품의 모델(순수). 등호 건너편으로 항을 옮기면 부호가 바뀐다(이항).
// 화면(TermDrag.tsx)과 검산(checks)이 같은 함수를 쓴다.
import { symToTex } from '../format.ts';
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

/** 항 하나의 KaTeX. 맨 앞 항이 아니면 부호를 붙여 보인다 */
export const termTex = (t: string) => symToTex(t);

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
    const before = `${sideSym(p.lhs)}=${sideSym(p.rhs)}`;
    const m = moved(p);
    // 흔한 실수: 부호를 그대로 둔 채 옮기기. 이것은 동치가 아니어야 이 부품이 보여 주는 규칙이 맞다.
    const t = p.lhs[p.move] as string;
    const naive = [...p.rhs, /^[+-]/.test(t) ? t : `+${t}`];
    return [
      {
        name: '옮기기',
        kind: 'equiv',
        before,
        after: `${sideSym(m.lhs)}=${sideSym(m.rhs)}`,
        expect: true,
      },
      {
        name: '부호 그대로',
        kind: 'equiv',
        before,
        after: `${sideSym(m.lhs)}=${sideSym(naive)}`,
        expect: false,
      },
    ];
  },
  texts: (p) => [p.note],
};
