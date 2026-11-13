// 끌기 공통 순수 계산. 화면(useDrag·부품)은 이 결과를 그리기만 한다.

/** 가장 가까운 칸 값(origin 에서 step 간격). 부동소수 찌꺼기를 지우려고 칸 번호로 계산한다 */
export function snap(v: number, step: number, origin = 0): number {
  const k = Math.round((v - origin) / step);
  return Number((origin + k * step).toPrecision(12));
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 방향키·Home·End 로 한 칸 이동한 값. 다루지 않는 키면 null */
export function keyStep(
  v: number,
  key: string,
  step: number,
  min: number,
  max: number,
): number | null {
  const d: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  if (key === 'Home') return min;
  if (key === 'End') return max;
  const s = d[key];
  if (s === undefined) return null;
  return clamp(snap(v + s * step, step, min), min, max);
}

/**
 * 끌던 칩이 등호를 건넜나. 칩 가운데가 등호 상자를 완전히 지나야 건넌 것으로 본다 —
 * 등호 위에서 머뭇거릴 때 '넘었다/안 넘었다'가 깜박이지 않게.
 */
export function crossedSign(
  midX: number,
  eq: { left: number; right: number },
  toward: 'left' | 'right',
): boolean {
  return toward === 'right' ? midX > eq.right : midX < eq.left;
}

/** 누른 곳에서 반경 안의 가장 가까운 손잡이. 손잡이 누르는 영역이 겹칠 때 고르는 규칙 */
export function nearest<T extends { x: number; y: number }>(
  hs: T[],
  p: { x: number; y: number },
  radius: number,
): T | null {
  let best: T | null = null;
  let bd = radius;
  for (const h of hs) {
    const d = Math.hypot(h.x - p.x, h.y - p.y);
    if (d <= bd) {
      best = h;
      bd = d;
    }
  }
  return best;
}

/** 화면 가장자리 여백. iOS 는 가장자리에서 시작한 끌기를 '뒤로 가기' 쓸기로 가로챈다 */
export const EDGE = 20;
export const edgeSafe = (x: number, width: number) => clamp(x, EDGE, width - EDGE);
