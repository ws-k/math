// 학습 기록 초기화(단원 하나 또는 전체)에서 지울 저장 키를 고른다.
// 지우는 것: 문제 기록(card:), 레슨 진행(lesson:), 필기(ink:). 전체일 때는 '이어서 하기'(last)도.
// 남기는 것: 설정(펜·배경 등)과 기기 공통 키(프로필 목록 등).

import { scopedKey } from './profile.ts';

/** 프로필 접두어를 뗀 키가 초기화 대상인가. unitId 가 null 이면 전체 */
export function isResetKey(key: string, unitId: string | null): boolean {
  if (unitId === null)
    return (
      key.startsWith('card:') ||
      key.startsWith('lesson:') ||
      key.startsWith('ink:') ||
      key === 'last'
    );
  return (
    key.startsWith(`card:${unitId}/`) ||
    key === `lesson:${unitId}` ||
    key.startsWith(`ink:${unitId}:`)
  );
}

/** 실제 저장 키(프로필 접두어 포함)가 이 프로필의 초기화 대상인가 */
export function scopedResetMatch(profile: string, unitId: string | null) {
  const pre = scopedKey(profile, '');
  return (k: string) =>
    pre
      ? k.startsWith(pre) && isResetKey(k.slice(pre.length), unitId)
      : !k.startsWith('@') && isResetKey(k, unitId);
}

/** 지울 범위: 접두어로 지울 것과 키 하나로 지울 것(프로필 접두어를 뗀 키). isResetKey 와 같은 규칙 */
export function resetRanges(unitId: string | null): { prefixes: string[]; keys: string[] } {
  if (unitId === null) return { prefixes: ['card:', 'lesson:', 'ink:'], keys: ['last'] };
  return { prefixes: [`card:${unitId}/`, `ink:${unitId}:`], keys: [`lesson:${unitId}`] };
}
