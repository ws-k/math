// 끌기 훅. Pointer Events + setPointerCapture 로 손가락·펜·마우스를 똑같이 받는다.
// 끄는 동안 React 상태를 바꾸지 않는다: 움직임은 requestAnimationFrame 한 번에 모아 onMove 로 넘기고,
// 부품이 그 안에서 DOM 속성을 직접 고친다. 상태는 손을 뗄 때(onEnd) 한 번만 바뀐다 —
// 매 프레임 React 렌더가 끼면 느린 기기에서 칩이 손가락을 못 따라온다.
import { type RefObject, useContext, useEffect, useRef } from 'react';
import { DragGuard } from './widgets/index.tsx';

export interface DragHandlers {
  onStart?(): void;
  /** 누른 곳에서 움직인 거리(px). 프레임마다 많아야 한 번 */
  onMove(dx: number, dy: number): void;
  /**
   * 손을 뗐을 때. cancelled = 시스템이 끌기를 빼앗음(pointercancel·lostpointercapture —
   * 전화 수신, 홈 쓸기 등). 이때는 결과를 반영하지 않고 제자리로 돌린다.
   */
  onEnd(dx: number, dy: number, cancelled: boolean): void;
}

export function useDrag(ref: RefObject<HTMLElement | SVGElement | null>, h: DragHandlers) {
  const guard = useContext(DragGuard);
  const latest = useRef(h);
  latest.current = h;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let drag: { id: number; x: number; y: number; dx: number; dy: number } | null = null;
    let raf = 0;
    const down = (e: PointerEvent) => {
      // 두 번째 손가락·마우스 오른쪽 단추는 무시
      if (drag || !e.isPrimary || e.button !== 0) return;
      e.preventDefault();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
      el.setPointerCapture(e.pointerId);
      guard(true);
      latest.current.onStart?.();
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      drag.dy = e.clientY - drag.y;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (drag) latest.current.onMove(drag.dx, drag.dy);
      });
    };
    const end = (cancelled: boolean) => (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      // 뗀 순간 위치까지 반영(마지막 프레임이 아직 안 그려졌을 수 있다). 취소면 마지막으로 본 값.
      const dx = cancelled ? drag.dx : e.clientX - drag.x;
      const dy = cancelled ? drag.dy : e.clientY - drag.y;
      drag = null;
      cancelAnimationFrame(raf);
      raf = 0;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      guard(false);
      latest.current.onEnd(dx, dy, cancelled);
    };
    const up = end(false);
    const cancel = end(true);
    el.addEventListener('pointerdown', down as EventListener);
    el.addEventListener('pointermove', move as EventListener);
    el.addEventListener('pointerup', up as EventListener);
    el.addEventListener('pointercancel', cancel as EventListener);
    el.addEventListener('lostpointercapture', cancel as EventListener);
    return () => {
      cancelAnimationFrame(raf);
      if (drag) guard(false);
      el.removeEventListener('pointerdown', down as EventListener);
      el.removeEventListener('pointermove', move as EventListener);
      el.removeEventListener('pointerup', up as EventListener);
      el.removeEventListener('pointercancel', cancel as EventListener);
      el.removeEventListener('lostpointercapture', cancel as EventListener);
    };
  }, [ref, guard]);
}
