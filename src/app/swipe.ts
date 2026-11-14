// 손가락 가로 쓸기 판정. 세로 이동(필기 화면 스크롤)과 헷갈리지 않게 가로가 확실히 클 때만.

const MIN_DX = 60;
const RATIO = 1.5;
const MAX_MS = 800;

/** 1: 다음(왼쪽으로 쓸기) · -1: 이전 · 0: 넘기지 않음 */
export function classifySwipe(g: { dx: number; dy: number; dt: number }): -1 | 0 | 1 {
  const ax = Math.abs(g.dx);
  if (ax < MIN_DX || ax < RATIO * Math.abs(g.dy) || g.dt > MAX_MS) return 0;
  return g.dx < 0 ? 1 : -1;
}

/**
 * 손가락 쓰기 중 노트 위 여러 손가락 쓸기. 두 손가락만 넘긴다 — 세 손가락은 다시 실행 탭과 헷갈리고,
 * 손바닥 여러 점이 함께 밀린 것일 수도 있다.
 */
export function noteSwipe(g: { dx: number; dy: number; dt: number; fingers: number }): -1 | 0 | 1 {
  return g.fingers === 2 ? classifySwipe(g) : 0;
}
