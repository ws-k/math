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

// ---- 끌어 놓기 판정(count 의 칩·카드와 저울의 물건이 같이 쓴다) ----

/** 이만큼 못 움직였으면 끌기가 아니라 누르기로 본다 — 손가락은 누르기만 해도 몇 px 흔들린다 */
export const TAP_PX = 8;
export const isTap = (dx: number, dy: number) => Math.hypot(dx, dy) < TAP_PX;
/**
 * 끌기를 이만큼 놓치면(그냥 누르기·아무 데도 아닌 곳에 놓기) '눌러서 해도 돼요'로 넘어간다(P4 — '넘어가기'와 같은 기준).
 * 한 번은 실수일 수 있고, 두 번이면 끌기가 어려운 사람의 신호로 본다.
 */
export const FAILS_FOR_TAP = 2;
/** '눌러서 해도 돼요' 안내의 앞말. 부품마다 뒤에 무엇을 누르는지 붙인다 — 앞말이 부품마다 다르면 같은 상황이 달리 들린다 */
export const TAP_ON = '끌기가 어려우면 눌러도 돼요.';
/** fails 번째 놓침 뒤의 안내: 첫 번째는 끄는 법(drag), FAILS_FOR_TAP 번째에 '눌러도 돼요'(tap), 그 뒤는 같은 말을 되풀이하지 않는다 */
export const missHint = (fails: number): 'drag' | 'tap' | null =>
  fails === 1 ? 'drag' : fails === FAILS_FOR_TAP ? 'tap' : null;
/** 눌러서 하기가 켜졌나(그 뒤로는 계속 켜 둔다) */
export const tapMode = (fails: number) => fails >= FAILS_FOR_TAP;

/** 가장 좁은 화면(접은 382px)에서 카드 안쪽 폭: 화면 여백 20 × 2 · 카드 안 여백 22 × 2 */
export const NARROW_CARD_W = 382 - 2 * 20 - 2 * 22;
/**
 * 손가락으로 한 칸에 멈출 수 있는 칸 폭 하한(px). 이보다 촘촘하면 목표 칸 하나에 놓기 어렵다 — 좌표평면 슬라이더 목표와
 * 수직선 점프가 같은 기준을 쓴다(한쪽만 느슨하면 같은 손가락이 부품마다 다르게 헛돈다)
 */
export const MIN_CELL_PX = 7;

/** 놓은 요소의 가운데(화면 좌표). 손가락 끝이 아니라 요소 가운데로 판정해야 어디를 잡고 끌었든 같은 결과다 */
export const centerOf = (r: { left: number; top: number; width: number; height: number }) =>
  [r.left + r.width / 2, r.top + r.height / 2] as const;

/** 점이 상자를 사방 slop 만큼 넓힌 안(경계 포함)인가. 가장자리에 걸쳐 놓아도 그 칸으로 쳐 준다 */
export const inBox = (
  x: number,
  y: number,
  b: { left: number; right: number; top: number; bottom: number },
  slop = 0,
) => x >= b.left - slop && x <= b.right + slop && y >= b.top - slop && y <= b.bottom + slop;

/** 화면 가장자리 여백. iOS 는 가장자리에서 시작한 끌기를 '뒤로 가기' 쓸기로 가로챈다 */
export const EDGE = 20;
export const edgeSafe = (x: number, width: number) => clamp(x, EDGE, width - EDGE);
