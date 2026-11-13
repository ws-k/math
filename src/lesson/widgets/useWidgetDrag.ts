// 부품들이 같이 쓰는 "끄는 동안은 직접 그리고, 놓을 때 한 번 상태로" 묶음.
// 시작 상태를 붙잡아 두고(onStart), 움직일 때마다 move(시작 상태, 거리) → draw → applyDrawing 으로 SVG 만 고친다.
// 놓으면 마지막 그림을 먼저 직접 적용한 뒤 상태를 바꾼다 — 같은 칸에 놓아 상태가 그대로면 React 가
// 다시 그리지 않으므로, 끄는 중에 고친 속성이 그대로 남지 않게 하려는 것이다. 취소면 시작 그림으로 되돌린다.
import { type RefObject, useEffect, useRef } from 'react';
import { type DragHandlers, useDrag } from '../useDrag.ts';
import { applyDrawing, type Drawing } from './draw.ts';

export function useWidgetDrag<S>(
  root: RefObject<HTMLElement | null>,
  state: S,
  draw: (s: S) => Drawing,
  /** 놓은 상태를 반영한다. 돌려준 값이 있으면 그것을 마지막 그림으로 쓴다(놓은 뒤 제자리로 돌아가는 조각 등) */
  commit: (s: S) => S | undefined,
) {
  const cur = useRef(state);
  cur.current = state;
  const start = useRef(state);
  return (move: (s: S, dx: number, dy: number) => S) => ({
    onStart() {
      start.current = cur.current;
    },
    onMove(dx: number, dy: number) {
      if (root.current) applyDrawing(root.current, draw(move(start.current, dx, dy)));
    },
    onEnd(dx: number, dy: number, cancelled: boolean) {
      const n = cancelled ? start.current : move(start.current, dx, dy);
      const shown = cancelled ? n : (commit(n) ?? n);
      if (root.current) applyDrawing(root.current, draw(shown));
    },
  });
}

/**
 * SVG 안의 요소 끌기. useDrag 가 주는 화면 픽셀 거리를 SVG 좌표 거리로 바꿔 넘긴다
 * (그림은 화면 폭에 맞춰 늘고 줄어서 1px 이 SVG 1단위가 아니다). 비율은 끌기 시작 때 한 번 잰다.
 */
export function useSvgDrag(ref: RefObject<SVGGraphicsElement | null>, h: DragHandlers) {
  const unit = useRef(1);
  useDrag(ref, {
    onStart() {
      const m = ref.current?.ownerSVGElement?.getScreenCTM();
      unit.current = m?.a ? 1 / m.a : 1;
      h.onStart?.();
    },
    onMove(dx, dy) {
      h.onMove(dx * unit.current, dy * unit.current);
    },
    onEnd(dx, dy, cancelled) {
      h.onEnd(dx * unit.current, dy * unit.current, cancelled);
    },
  });
  // SVG 안쪽 요소(<g>·<polygon>)의 touch-action:none 은 브라우저가 무시한다(헤드리스 Chrome 실측:
  // 손가락으로 끌면 몇 프레임 뒤 pointercancel 이 오고 페이지가 스크롤된다). 그래서 이 요소에서 시작한
  // 터치만 touchstart 에서 기본 동작(스크롤)을 막는다 — svg 전체에 걸면 그림 위에서 페이지를 못 내린다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', stop, { passive: false });
    return () => el.removeEventListener('touchstart', stop);
  }, [ref]);
}
