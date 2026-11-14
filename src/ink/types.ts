// 필기 엔진 ↔ 앱 화면 연결 규격. 좌표는 "종이 좌표"(쪽 너비 = 1000).

export type ToolKind = 'pen' | 'highlighter' | 'eraser';
/** 굵기 3단계: 0 가늘게 · 1 보통 · 2 굵게 */
export type SizeLevel = 0 | 1 | 2;
export type Background = 'none' | 'grid' | 'lines';

export interface Tool {
  kind: ToolKind;
  color: string;
  size: SizeLevel;
}

export interface Stroke {
  tool: 'pen' | 'highlighter';
  color: string;
  /** 기본 굵기(종이 단위) */
  base: number;
  /** [x, y, t(ms), pressure] 를 이어 붙인 평평한 배열 */
  pts: number[];
}

export interface InkDoc {
  strokes: Stroke[];
  /** 종이 높이(종이 단위). 공책은 아래까지 쓰면 늘어난다. */
  height: number;
}

export interface InkOptions {
  doc: InkDoc;
  /** 아래쪽 가까이 쓰면 종이를 늘릴지 (공책 쪽 = true) */
  grow: boolean;
  background: Background;
  tool: Tool;
  /** 획이 끝나거나 지우기·실행 취소로 내용이 바뀔 때마다 (자동 저장용) */
  onChange(doc: InkDoc): void;
  /** 펜·마우스·손가락으로 쓰기 시작하고 끝날 때 (쓰는 중 화면이 손가락 쓸기를 막는 용도) */
  onPenActive?(active: boolean): void;
  /** 한 손가락으로도 쓸지 (기본 false = 손가락은 스크롤·쪽 넘김·여러 손가락 탭) */
  fingerInk?: boolean;
  /** 손가락 쓰기 중 여러 손가락 끌기가 끝났을 때 — 손가락 중심의 전체 이동(쪽 넘김 쓸기 판정용) */
  onSwipe?(g: { dx: number; dy: number; dt: number; fingers: number }): void;
}

export interface InkSurface {
  setTool(t: Tool): void;
  setBackground(b: Background): void;
  setFingerInk(on: boolean): void;
  undo(): void;
  redo(): void;
  /** 전체 지우기 — 이것도 실행 취소 가능 */
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** 펜이 닿아 있거나 막 뗀 참이라 손가락(손바닥) 입력을 무시해야 하는가 — 쪽 넘김 쓸기를 막는 데 쓴다 */
  palmBlocked(): boolean;
  /** 쪽 크기가 바뀌었을 때 다시 맞춤 (ResizeObserver 가 자동으로도 부름) */
  resize(): void;
  destroy(): void;
}

/** createInkSurface(host, opts): host = 필기를 얹을 쪽 요소(스크롤되는 내용 전체를 덮는 상자) */
export type CreateInkSurface = (host: HTMLElement, opts: InkOptions) => InkSurface;
