// 그래프·도형 위의 끄는 점. 보이는 점은 14px, 누르는 영역은 56px(손가락 크기) — 둘을 따로 둔다.
// 키보드로도 옮길 수 있게 role="slider" 와 방향키 한 칸 이동을 갖는다(값 계산은 drag.ts keyStep).
// 부품 6종(수직선·분수·단위원·도형판 등)의 SVG 안 손잡이. 좌표평면은 HTML 손잡이(../Handle.tsx)를 쓴다. touch-action:none 은 이 손잡이에만 건다(페이지 스크롤을 살리려고).
import { forwardRef, type KeyboardEvent } from 'react';

const HANDLE_DOT = 7;
const HANDLE_HIT = 28;

export const SvgHandle = forwardRef<
  SVGGElement,
  {
    x: number;
    y: number;
    label: string;
    value: number;
    min: number;
    max: number;
    /** 화면에 읽어 줄 값(예: "x = 1.5") */
    valueText: string;
    onKey(e: KeyboardEvent): void;
  }
>(function SvgHandle(p, ref) {
  return (
    <g
      ref={ref}
      className="svg-handle"
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={p.value}
      aria-valuetext={p.valueText}
      transform={`translate(${p.x} ${p.y})`}
      onKeyDown={p.onKey}
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      <circle r={HANDLE_HIT} fill="transparent" />
      <circle r={HANDLE_DOT} fill="var(--primary)" stroke="var(--bg)" strokeWidth={3} />
    </g>
  );
});
