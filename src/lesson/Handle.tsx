// 그래프·도형 위의 끄는 점. 보이는 점은 14px, 누르는 영역은 56px(손가락 크기) — 둘을 따로 둔다.
// 키보드로도 옮길 수 있게 role="slider" 와 방향키 한 칸 이동을 갖는다(값 계산은 부품 모델이 한다).
//
// SVG 안의 <g> 가 아니라 그림 위에 겹친 HTML 요소다: 헤드리스 Chrome 에서 터치로 재 보니 SVG 자식 요소의
// touch-action:none 은 무시되어 손가락 끌기가 페이지 스크롤로 넘어갔다. HTML 요소의 touch-action 은 지켜진다.
// 그래서 부모(그림을 감싼 상자)는 position:relative 이고, 손잡이는 그림과 같은 px 좌표(x, y)에 놓인다.
// touch-action:none 은 이 손잡이에만 건다(페이지 스크롤을 살리려고).
import { forwardRef, type KeyboardEvent } from 'react';

export const HANDLE_DOT = 7;
export const HANDLE_HIT = 28;

/** 손잡이 자리(끄는 동안 부품이 style.transform 에 직접 넣는 값과 같은 꼴) */
export const handleAt = (x: number, y: number) => `translate(${x}px, ${y}px)`;

export const Handle = forwardRef<
  HTMLDivElement,
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
>(function Handle(p, ref) {
  return (
    <div
      ref={ref}
      className="handle"
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={p.value}
      aria-valuetext={p.valueText}
      onKeyDown={p.onKey}
      style={{ transform: handleAt(p.x, p.y), touchAction: 'none' }}
    >
      <i className="dot" />
    </div>
  );
});
