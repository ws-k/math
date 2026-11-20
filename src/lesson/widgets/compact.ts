// 좁고 낮은 화면(접은 화면 382×580)인가 — lesson.css·widgets.css 의 같은 @media 조건을 JS 로도 읽는다.
// CSS 로는 SVG 의 그림 비율(viewBox)이나 타일 판의 칸 크기·배치를 못 바꿔서, 그것을 정하는 부품(확률 실험·넓이 모형)이
// 같은 판정을 쓴다. 조건이 CSS 와 어긋나면 버튼은 접은 모양인데 그림은 넓은 모양이 되므로 글자 그대로 맞춘다
// (test/lesson-compact.test.ts 가 두 CSS 파일과 대조한다).
import { useSyncExternalStore } from 'react';

export const COMPACT_QUERY = '(max-width: 500px) and (max-height: 600px)';

const media = () => (typeof matchMedia === 'function' ? matchMedia(COMPACT_QUERY) : null);
const subscribe = (cb: () => void) => {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const snapshot = () => media()?.matches ?? false;

/**
 * 접은 화면이면 true. 외부 값 구독(useSyncExternalStore, App.tsx 의 저장 경고와 같은 방식)이라 첫 그림부터 맞는 모양으로
 * 그린다 — effect 로 나중에 바꾸면 넓은 모양이 한 번 보였다가 접은 모양으로 바뀌며 깜박인다. matchMedia 가 없는 곳
 * (Node 의 서버 렌더·스모크 테스트)은 넓은 모양. 펼치기·접기·회전에 따라 다시 그린다.
 */
export const useCompact = (): boolean => useSyncExternalStore(subscribe, snapshot, snapshot);
