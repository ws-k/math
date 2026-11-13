// 여러 손가락 탭 판정 (순수 모듈). 두 손가락 탭 = 실행 취소, 세 손가락 탭 = 다시 실행.
// 첫 손가락이 닿은 때부터 마지막 손가락을 뗄 때까지를 한 동작으로 보고,
// 그 사이 짧고(maxMs) 거의 안 움직였으면(slop) 최대 동시 손가락 수를 돌려준다.

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TapDetector {
  /** 새로 닿은 손가락들 */
  down(pts: readonly TouchPoint[], t: number): void;
  /** 움직인 손가락들 */
  move(pts: readonly TouchPoint[], t: number): void;
  /** 손가락을 뗌. remaining = 아직 닿아 있는 손가락 수. 동작이 끝나면 탭 손가락 수(2·3) 또는 0. */
  up(remaining: number, t: number): number;
  /** 지금 동작을 탭 후보에서 뺀다 (펜·손바닥 무시 중). 모두 떼면 다시 받는다. */
  invalidate(): void;
}

export function createTapDetector(maxMs = 250, slop = 12): TapDetector {
  let start = -1;
  let valid = false;
  let maxCount = 0;
  const origin = new Map<number, TouchPoint>();
  const reset = () => {
    start = -1;
    valid = false;
    maxCount = 0;
    origin.clear();
  };
  return {
    down(pts, t) {
      if (start < 0) {
        start = t;
        valid = true;
      }
      for (const p of pts) origin.set(p.id, p);
      maxCount = Math.max(maxCount, origin.size);
    },
    move(pts, t) {
      if (start < 0) return;
      if (t - start > maxMs) valid = false;
      for (const p of pts) {
        const o = origin.get(p.id);
        if (o && Math.hypot(p.x - o.x, p.y - o.y) > slop) valid = false;
      }
    },
    up(remaining, t) {
      if (start < 0) return 0;
      if (t - start > maxMs) valid = false;
      if (remaining > 0) return 0;
      const result = valid && (maxCount === 2 || maxCount === 3) ? maxCount : 0;
      reset();
      return result;
    },
    invalidate() {
      // 동작 중일 때만 표시 — 손가락이 없는데 무효 처리하면 다음 탭까지 막힐 수 있다
      if (start >= 0) valid = false;
      else reset();
    },
  };
}
