// 화면 배치 판정. 기기 종류가 아니라 "지금 화면의 모양"으로 정한다(설계 7·10장) —
// 그래야 펼치기·접기·회전에 저절로 맞춰진다.

export type LayoutMode = 'spread' | 'single';

/** 너비 800 이상이고 높이의 1.2배 이상이면 펼친 책, 아니면 한 쪽씩. */
export function layoutMode(width: number, height: number): LayoutMode {
  return width >= 800 && width >= 1.2 * height ? 'spread' : 'single';
}
