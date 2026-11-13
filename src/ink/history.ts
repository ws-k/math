// 실행 취소/다시 실행 (DOM 없는 순수 모듈).
// 획 목록을 "통째 스냅샷"으로 쌓는다. 배열은 절대 고치지 않고 새로 만들기 때문에
// 스냅샷은 획 참조만 담아 가볍고, 추가·지우개·전체 지우기를 한 가지 방식으로 되돌릴 수 있다.

import { strokeHit } from './geometry.ts';
import type { Stroke } from './types.ts';

export interface InkHistory {
  readonly current: readonly Stroke[];
  /** 새 상태로 바꾸며 한 단위 기록. 같은 배열이면(바뀐 게 없으면) 기록하지 않는다. */
  commit(next: readonly Stroke[]): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createHistory(initial: readonly Stroke[], limit = 200): InkHistory {
  let current: readonly Stroke[] = initial.slice();
  const past: (readonly Stroke[])[] = [];
  const future: (readonly Stroke[])[] = [];
  return {
    get current() {
      return current;
    },
    commit(next) {
      if (next === current) return;
      past.push(current);
      if (past.length > limit) past.shift();
      future.length = 0;
      current = next;
    },
    undo() {
      const prev = past.pop();
      if (!prev) return false;
      future.push(current);
      current = prev;
      return true;
    },
    redo() {
      const next = future.pop();
      if (!next) return false;
      past.push(current);
      current = next;
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}

/**
 * 지우개 한 점: 닿은 획을 통째로 뺀 새 배열. 아무것도 안 닿으면 같은 배열을 그대로 돌려줘
 * 호출하는 쪽이 `===` 로 "바뀌었나"를 바로 알 수 있게 한다(문지르는 동안 매 점마다 부르므로).
 */
export function eraseAt(
  strokes: readonly Stroke[],
  x: number,
  y: number,
  r: number,
): readonly Stroke[] {
  // 획 굵기 절반만큼 판정을 넓혀야 굵은 형광펜 가장자리를 문질러도 지워진다
  const kept = strokes.filter((s) => !strokeHit(s.pts, x, y, r + s.base / 2));
  return kept.length === strokes.length ? strokes : kept;
}
