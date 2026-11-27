// 수직선 구간(부등식의 해·진리집합)의 순수 계산: 조각으로 펴기, 포함 관계, 글자, sympy 식.
// 수직선 그림(numberLine.ts)과 따로 둔 까닭: 구간 고르기 과제·보여 주기 구간·진리집합 비교가 같은 '구간' 하나를
// 세 곳에서 다르게 쓴다. 한곳에서 읽어야 화면 글자("x < −1 또는 x > 3")·채점·검산식이 같은 구간을 가리킨다.
//
// 구간의 모양(region 과 같은 칸 이름):
//   lo 만        x > lo (찬 점이면 ≥)
//   hi 만        x < hi
//   lo·hi        lo < x < hi           — 양쪽 막힌 구간
//   lo·hi·out    x < lo 또는 x > hi     — 두 조각 구간(바깥)
// 끝점 값은 분수 글자(칸 위)라 부동소수 없이 비교한다.
import { cmp, py, type Q, q } from './q.ts';

export interface NLEnd {
  at: string;
  /** 빈 점(그 값은 빠짐) */
  open: boolean;
}
export interface NLSet {
  lo?: NLEnd;
  hi?: NLEnd;
  /** lo·hi 바깥 두 조각. lo·hi 가 다 있어야 한다 */
  out?: boolean;
}

/** 이어진 한 조각. null 은 무한(−∞·+∞) */
interface Piece {
  a: Q | null;
  aOpen: boolean;
  b: Q | null;
  bOpen: boolean;
}

export function pieces(s: NLSet): Piece[] {
  const lo = s.lo ? q(s.lo.at) : null;
  const hi = s.hi ? q(s.hi.at) : null;
  if (s.out && s.lo && s.hi)
    return [
      { a: null, aOpen: true, b: lo, bOpen: s.lo.open },
      { a: hi, aOpen: s.hi.open, b: null, bOpen: true },
    ];
  return [{ a: lo, aOpen: s.lo?.open ?? true, b: hi, bOpen: s.hi?.open ?? true }];
}

/** 왼쪽 끝 a 가 c 보다 왼쪽이 아닌가(같은 값이면 a 가 빈 점이거나 c 가 찬 점일 때만) — p 가 q 의 왼쪽 끝 안에서 시작하는가 */
function startsInside(p: Piece, r: Piece): boolean {
  if (r.a === null) return true;
  if (p.a === null) return false;
  const c = cmp(p.a, r.a);
  return c > 0 || (c === 0 && (p.aOpen || !r.aOpen));
}
function endsInside(p: Piece, r: Piece): boolean {
  if (r.b === null) return true;
  if (p.b === null) return false;
  const c = cmp(p.b, r.b);
  return c < 0 || (c === 0 && (p.bOpen || !r.bOpen));
}

/**
 * a ⊆ b. 조각 하나는 이어져 있고 b 의 두 조각 사이에는 늘 빈틈(lo < hi)이 있으므로, a 의 조각마다 b 의 어느 한 조각 안에
 * 들면 된다(두 조각에 걸쳐 들 수 없다)
 */
export function subset(a: NLSet, b: NLSet): boolean {
  const bs = pieces(b);
  return pieces(a).every((p) => bs.some((r) => startsInside(p, r) && endsInside(p, r)));
}

/** 두 집합의 포함 관계. 검산은 sympy is_subset 을 두 번 불러 같은 수로 맞춘다(같음 3 · a⊂b 1 · b⊂a 2 · 없음 0) */
export type Relation = 'eq' | 'sub' | 'sup' | 'none';
export function relation(a: NLSet, b: NLSet): Relation {
  const ab = subset(a, b);
  const ba = subset(b, a);
  return ab && ba ? 'eq' : ab ? 'sub' : ba ? 'sup' : 'none';
}
export const RELATION_CODE: Record<Relation, number> = { none: 0, sub: 1, sup: 2, eq: 3 };

export function relationText(r: Relation, a: string, b: string): string {
  if (r === 'eq') return `${a} = ${b}`;
  if (r === 'sub') return `${a} ⊂ ${b}`;
  if (r === 'sup') return `${b} ⊂ ${a}`;
  return `${a} ⊄ ${b}, ${b} ⊄ ${a}`;
}

/** 부등식 글자. fmt 는 수직선의 수 글자(분수·소수)를 따른다 */
export function setText(s: NLSet, fmt: (v: Q) => string): string {
  const lt = (open: boolean) => (open ? '<' : '≤');
  const gt = (open: boolean) => (open ? '>' : '≥');
  const v = (e: NLEnd) => fmt(q(e.at));
  if (s.lo && s.hi) {
    if (s.out) return `x ${lt(s.lo.open)} ${v(s.lo)} 또는 x ${gt(s.hi.open)} ${v(s.hi)}`;
    return `${v(s.lo)} ${lt(s.lo.open)} x ${lt(s.hi.open)} ${v(s.hi)}`;
  }
  if (s.lo) return `x ${gt(s.lo.open)} ${v(s.lo)}`;
  if (s.hi) return `x ${lt(s.hi.open)} ${v(s.hi)}`;
  return '';
}

/** sympy 집합 식(Interval·Union). 끝점은 매개변수 글자를 그대로 분수로 */
export function setPy(s: NLSet): string {
  const iv = (p: Piece) => {
    const a = p.a === null ? '-oo' : py(p.a);
    const b = p.b === null ? 'oo' : py(p.b);
    return `Interval(${a}, ${b}, ${p.a === null || p.aOpen ? 'True' : 'False'}, ${p.b === null || p.bOpen ? 'True' : 'False'})`;
  };
  const ps = pieces(s).map(iv);
  return ps.length === 1 ? (ps[0] as string) : `Union(${ps.join(', ')})`;
}
