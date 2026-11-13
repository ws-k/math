// 간단한 상자(라이트너) 방식 복습 규칙. 설계 문서 6장.
export const DAY = 24 * 60 * 60 * 1000;

export type Grade = 'right' | 'unsure' | 'wrong';

export interface CardState {
  /** 0: 처음, 1~5: 상자, 6: 졸업 */
  box: number;
  /** 복습할 날의 0시(ms). 졸업하면 null */
  due: number | null;
  lapses: number;
  last: Grade;
  history: { t: number; r: Grade }[];
}

/** 상자 번호 → 복습 간격(일) */
const INTERVAL: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const GRADUATED = 6;

export function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 날짜 더하기 (서머타임이 있어도 0시를 유지) */
function addDays(day0: number, n: number): number {
  const d = new Date(day0);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

export function gradeCard(prev: CardState | undefined, r: Grade, now: number): CardState {
  const box0 = prev?.box ?? 0;
  let box: number;
  if (r === 'wrong') box = 1;
  // 애매하면 졸업(6)한 카드도 5번 상자로 끌어내린다 — 확신 없는 문제가 졸업해 다시 안 나오면 안 된다
  else if (r === 'unsure') box = Math.min(Math.max(box0, 1), GRADUATED - 1);
  else box = box0 === 0 ? 2 : Math.min(box0 + 1, GRADUATED);
  const days = r === 'unsure' ? 1 : (INTERVAL[box] ?? null);
  return {
    box,
    due: box === GRADUATED ? null : addDays(startOfDay(now), days ?? 1),
    lapses: (prev?.lapses ?? 0) + (r === 'wrong' ? 1 : 0),
    last: r,
    history: [...(prev?.history ?? []), { t: now, r }],
  };
}

/** 오늘(now 가 속한 날) 복습할 차례인가 */
export function isDue(s: CardState, now: number): boolean {
  return s.due !== null && s.due <= startOfDay(now);
}

export function isInWrongNote(s: CardState): boolean {
  return s.last === 'wrong' || s.last === 'unsure';
}
