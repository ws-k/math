// 상태가 바뀐 뒤 요소를 옛 자리에서 새 자리로 날려 보내는 연출(FLIP). 새 자리는 이미 그려진 뒤라
// 옛 자리와의 차이만큼 transform 으로 되돌렸다가 0 으로 푼다. 부품마다 같은 계산을 되풀이하지 않게 한 곳에 둔다.
import { reducedMotion } from './ui.tsx';

/** 날아가는 기본 시간과 곡선. 포물선(arc)은 중간에 위로 34px 떠올랐다 내려앉는다 */
const EASE = 'cubic-bezier(.3,.7,.3,1)';
const ARC_LIFT = 34;

export function flyFrom(
  el: Element,
  from: { left: number; top: number },
  { duration = 320, arc = false }: { duration?: number; arc?: boolean } = {},
): void {
  // 동작 줄이기를 켠 사람에게는 제자리에 바로 놓는다
  if (reducedMotion()) return;
  const last = el.getBoundingClientRect();
  const dx = from.left - last.left;
  const dy = from.top - last.top;
  if (!dx && !dy) return;
  const frames = arc
    ? [
        { transform: `translate(${dx}px,${dy}px)` },
        { transform: `translate(${dx / 2}px,-${ARC_LIFT}px)`, offset: 0.5 },
        { transform: 'none' },
      ]
    : [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }];
  el.animate(frames, { duration, easing: EASE });
}
