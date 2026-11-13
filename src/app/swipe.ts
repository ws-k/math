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
