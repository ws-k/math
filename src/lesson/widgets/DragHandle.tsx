// SVG 그림 위의 끄는 점 하나. 공용 Handle(보이는 점 14px·누르는 영역 56px·role="slider")에 useDrag 를 붙이고,
// 손가락이 움직인 화면 픽셀을 SVG 좌표로 바꿔 넘긴다. 바깥 <g data-k> 의 transform 은 끄는 동안
// 부품의 그릴 목록(applyDrawing)이 직접 고친다 — 그래서 Handle 자체는 (0,0)에 두었다.
// 부품마다 점 수가 달라 훅을 반복문에서 부를 수 없으므로 점 하나를 컴포넌트 하나로 두었다.
import { type KeyboardEvent, useRef } from 'react';
import { SvgHandle } from './SvgHandle.tsx';
import { useSvgDrag } from './useWidgetDrag.ts';

export interface DragHandleProps {
  k: string;
  x: number;
  y: number;
  label: string;
  value: number;
  min: number;
  max: number;
  valueText: string;
  /** 방향키 등. 다룬 키면 true(페이지 스크롤을 막는다) */
  onKey(key: string): boolean;
  /** 포커스가 떠날 때 */
  onBlur?(): void;
  /**
   * 누른 순간 끌기를 시작할지(없으면 늘). 부품 안에서 다른 손잡이를 끄는 중이면 false 로 거절한다(P9 동시 끌기 1개) —
   * 거절한 손가락은 잡지 않으니 그 자리 쓸기는 페이지 스크롤로 남는다
   */
  pick?(): boolean;
  onStart?(): void;
  /** 누른 곳에서 움직인 거리(SVG 좌표) */
  onMove(dx: number, dy: number): void;
  onEnd(dx: number, dy: number, cancelled: boolean): void;
}

export function DragHandle(p: DragHandleProps) {
  const ref = useRef<SVGGElement>(null);
  const pick = p.pick;
  useSvgDrag(ref, {
    ...(pick ? { pick: () => pick() } : {}),
    onStart: p.onStart,
    onMove: p.onMove,
    onEnd: p.onEnd,
  });
  const key = (e: KeyboardEvent) => {
    if (p.onKey(e.key)) e.preventDefault();
  };
  return (
    <g data-k={p.k} transform={`translate(${p.x} ${p.y})`}>
      <SvgHandle
        ref={ref}
        x={0}
        y={0}
        label={p.label}
        value={p.value}
        min={p.min}
        max={p.max}
        valueText={p.valueText}
        onKey={key}
        onBlur={p.onBlur}
      />
    </g>
  );
}
