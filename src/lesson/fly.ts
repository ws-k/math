// 상태가 바뀐 뒤 요소를 옛 자리에서 새 자리로 날려 보내는 연출(FLIP). 새 자리는 이미 그려진 뒤라
// 옛 자리와의 차이만큼 transform 으로 되돌렸다가 0 으로 푼다. 부품마다 같은 계산을 되풀이하지 않게 한 곳에 둔다.
import { type RefObject, useLayoutEffect, useRef } from 'react';
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

// ---- 끌어 놓기 부품(count·저울)이 놓은 뒤 쓰는 것 ----

/** 이 요소들(attr 이 붙은 것)의 지금 화면 자리, attr 값 → 자리. 상태가 바뀐 뒤 옛 자리에서 날려 보내려고 잰다 */
export function rectsOf(host: ParentNode | null | undefined, attr: string): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  for (const el of host?.querySelectorAll<HTMLElement>(`[${attr}]`) ?? [])
    m.set(el.getAttribute(attr) as string, el.getBoundingClientRect());
  return m;
}

/**
 * 끌어 놓은 요소를 놓인 자리에서 잰 뒤 transform 을 지운다(onDrop 첫머리).
 * back = 놓인 자리에서 제자리로 날려 보내기 — 놓을 수 없는 곳이었을 때 손을 뗀 곳에서 돌아가게.
 */
export function landAt(el: HTMLElement, duration: number) {
  const rect = el.getBoundingClientRect();
  el.style.transform = '';
  return { rect, back: () => flyFrom(el, rect, { duration }) };
}

/**
 * 상태를 바꾼 뒤 한 번, attr 이 붙은 요소마다 옛 자리에서 새 자리로 날려 보낸다. 자리가 그대로인 것은 움직이지 않는다.
 * 옛 자리는 상태를 바꾸기 직전에 mark 로 잰다 — 다시 그린 뒤에는 이미 새 자리라 잴 수 없다.
 */
export function useSettleFx(host: RefObject<HTMLElement | null>, attr: string, duration: number) {
  const fly = useRef<Map<string, DOMRect> | null>(null);
  useLayoutEffect(() => {
    const old = fly.current;
    fly.current = null;
    if (!old || !host.current) return;
    for (const el of host.current.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      const r = old.get(el.getAttribute(attr) as string);
      if (r) flyFrom(el, r, { duration });
    }
  });
  return {
    /** 상태를 바꾸기 직전에 부른다. dropped = 끌어 놓은 요소의 놓인 자리(옛 자리 대신 손 뗀 자리에서 날아가게) */
    mark(dropped?: Iterable<[string, DOMRect]>) {
      fly.current = rectsOf(host.current, attr);
      for (const [k, r] of dropped ?? []) fly.current.set(k, r);
    },
  };
}
