// 홈의 "오늘 할 일", 지도의 진행률, 오답 노트 목록 — 카드 모음에서 계산만 한다.
import type { Unit } from '../content/types.ts';
import { type CardState, DAY, type Grade, isDue, isInWrongNote, startOfDay } from '../lib/srs.ts';
import { cardKey, parseCardKey, resolveProblem } from './pages.ts';

export type Cards = Record<string, CardState>;

export const GRADE_LABEL: Record<Grade, string> = {
  right: '맞음',
  unsure: '애매함',
  wrong: '틀림',
};

export interface TodayPlan {
  /** 복습일이 된 카드 키(오래 밀린 것부터) */
  due: string[];
  /** 진행 중인 단원에서 아직 안 푼 문제 키 */
  fresh: string[];
}

export function todayPlan(o: {
  cards: Cards;
  units: Unit[];
  lastUnitId: string | null;
  now: number;
  goal: number;
}): TodayPlan {
  const have = new Set(o.units.map((u) => u.id));
  const due = Object.entries(o.cards)
    .filter(([k, c]) => {
      const p = parseCardKey(k);
      return p !== null && have.has(p.unitId) && isDue(c, o.now);
    })
    .sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    .map(([k]) => k);
  const fresh: string[] = [];
  const room = o.goal - due.length;
  const last = o.units.find((u) => u.id === o.lastUnitId);
  if (last && room > 0) {
    for (const p of last.problems) {
      const k = cardKey(last.id, p.id);
      if (!o.cards[k]) fresh.push(k);
      if (fresh.length >= room) break;
    }
  }
  return { due, fresh };
}

/** 마지막 채점이 "맞음"인 단원 문제 수 (생성 문제는 단원 진도에 넣지 않는다) */
export function unitProgress(unit: Unit, cards: Cards): { done: number; total: number } {
  const done = unit.problems.filter((p) => cards[cardKey(unit.id, p.id)]?.last === 'right').length;
  return { done, total: unit.problems.length };
}

const lastT = (c: CardState) => c.history.at(-1)?.t ?? 0;

/** 틀림·애매함 카드, 최근 순. 단원이 빠지거나 문제가 바뀌어 보여 줄 내용이 없는 카드는 뺀다. */
export function wrongNote(cards: Cards, units: Unit[]): string[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const exists = (k: string) => {
    const p = parseCardKey(k);
    const u = p && byId.get(p.unitId);
    return !!u && !!p && resolveProblem(u, p.pid) !== null;
  };
  return Object.entries(cards)
    .filter(([k, c]) => isInWrongNote(c) && exists(k))
    .sort((a, b) => lastT(b[1]) - lastT(a[1]))
    .map(([k]) => k);
}

/**
 * 복습일 문구. 시각 차이를 반올림하면 밤늦게 채점한 "내일"이 0일로 보이므로
 * 두 날짜의 0시끼리 뺀다(서머타임으로 하루가 23·25시간이어도 반올림이 흡수한다).
 */
export function dueText(c: CardState, now: number): string {
  if (c.due === null) return '이 문제는 졸업했습니다';
  const days = Math.round((startOfDay(c.due) - startOfDay(now)) / DAY);
  return days <= 0 ? '오늘 다시 봅니다' : `${days}일 뒤 다시 봅니다`;
}
