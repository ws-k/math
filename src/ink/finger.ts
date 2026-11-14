// 손가락 쓰기 판정 (순수 모듈). 손가락 쓰기가 켜졌을 때 한 손가락 = 쓰기, 여러 손가락 = 스크롤·탭·쓸기.
// 두 손가락을 "동시에" 대도 실제로는 수십 ms 차이로 닿는다. 그래서 첫 손가락은 바로 쓰기 시작하고
// (기다리면 펜보다 굼떠 보인다), 짧은 시간(grace) 안에 다른 손가락이 오면 그 획을 취소한다.
// grace 가 지난 뒤 닿은 손가락은 쓰는 중 실수로 닿은 것으로 보고 무시한다.

/** 이 시간 안에 두 번째 손가락이 오면 쓰던 획을 여러 손가락 동작으로 바꾼다 */
export const FINGER_GRACE_MS = 150;

/** draw: 이 손가락으로 획 시작 · cancel: 쓰던 획 취소 · ignore: 무시 · multi: 여러 손가락 동작에 합류 */
export type FingerDown = 'draw' | 'cancel' | 'ignore' | 'multi';

export type FingerUp =
  | { kind: 'none' }
  /** 쓰던 손가락을 뗌 — 획 마무리 */
  | { kind: 'end' }
  /** 여러 손가락 동작이 끝남 — 손가락 중심의 전체 이동(쓸기 판정용) */
  | { kind: 'gesture'; dx: number; dy: number; dt: number; fingers: number };

export interface FingerGesture {
  down(id: number, x: number, y: number, t: number): FingerDown;
  /** 여러 손가락 동작 중이면 손가락 중심이 이번에 움직인 만큼(스크롤용), 아니면 null */
  move(id: number, x: number, y: number): { dx: number; dy: number } | null;
  up(id: number, t: number): FingerUp;
  /**
   * 브라우저·시스템이 이 손가락을 가로챔(pointercancel). 여러 손가락 동작 중이면 끝까지 간 게 아니니
   * 알림 없이 전체를 버리고, 아니면 그 손가락만 뺀다(쓰던 손가락이면 'end' — 획 처리는 부르는 쪽 정책).
   * 쓰는 중 무시하던 손가락 하나 때문에 전체를 버리면, 판정은 '아무도 없음'인데 획은 그리는 중이라 어긋난다.
   */
  cancel(id: number): { kind: 'none' } | { kind: 'end' };
  reset(): void;
}

export function createFingerGesture(graceMs = FINGER_GRACE_MS): FingerGesture {
  const pos = new Map<number, { x: number; y: number }>();
  let mode: 'idle' | 'draw' | 'multi' = 'idle';
  let drawId = -1;
  let start = 0;
  let maxCount = 0;
  let last = { x: 0, y: 0 };
  let total = { x: 0, y: 0 };

  const centroid = () => {
    let x = 0;
    let y = 0;
    for (const p of pos.values()) {
      x += p.x;
      y += p.y;
    }
    const n = Math.max(1, pos.size);
    return { x: x / n, y: y / n };
  };

  const reset = () => {
    pos.clear();
    mode = 'idle';
    drawId = -1;
    maxCount = 0;
    total = { x: 0, y: 0 };
  };

  return {
    down(id, x, y, t) {
      pos.set(id, { x, y });
      if (mode === 'multi') {
        maxCount = Math.max(maxCount, pos.size);
        // 손가락 수가 바뀌면 중심이 순간 이동한다 — 그만큼을 스크롤로 치지 않게 기준을 다시 잡는다
        last = centroid();
        return 'multi';
      }
      if (mode === 'draw') {
        if (t - start > graceMs) return 'ignore';
        mode = 'multi';
        drawId = -1;
        maxCount = pos.size;
        last = centroid();
        total = { x: 0, y: 0 };
        return 'cancel';
      }
      mode = 'draw';
      drawId = id;
      start = t;
      return 'draw';
    },
    move(id, x, y) {
      if (!pos.has(id)) return null;
      pos.set(id, { x, y });
      if (mode !== 'multi') return null;
      const c = centroid();
      const d = { dx: c.x - last.x, dy: c.y - last.y };
      last = c;
      total = { x: total.x + d.dx, y: total.y + d.dy };
      return d;
    },
    up(id, t) {
      if (!pos.delete(id)) return { kind: 'none' };
      if (mode === 'draw' && id === drawId) {
        // 무시하던 손가락이 남아 있어도 다음 손가락은 새로 쓸 수 있게 쓰기 상태만 푼다
        mode = 'idle';
        drawId = -1;
        return { kind: 'end' };
      }
      if (mode === 'multi') {
        if (pos.size > 0) {
          last = centroid();
          return { kind: 'none' };
        }
        const g = {
          kind: 'gesture' as const,
          dx: total.x,
          dy: total.y,
          dt: t - start,
          fingers: maxCount,
        };
        reset();
        return g;
      }
      return { kind: 'none' };
    },
    cancel(id) {
      if (mode === 'multi') {
        if (pos.has(id)) reset();
        return { kind: 'none' };
      }
      if (!pos.delete(id)) return { kind: 'none' };
      if (mode === 'draw' && id === drawId) {
        mode = 'idle';
        drawId = -1;
        return { kind: 'end' };
      }
      return { kind: 'none' };
    },
    reset,
  };
}
