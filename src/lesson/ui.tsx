// 레슨 화면 공용 작은 조각.
import { useMemo } from 'react';
import { renderRich } from '../lib/math.ts';

/** KaTeX 한 덩어리(글자 이스케이프는 renderRich 가 한다) */
export function Tex({ tex, className }: { tex: string; className?: string }) {
  const html = useMemo(() => renderRich(`$${tex}$`), [tex]);
  return (
    <span
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX 결과만 넣는다. 원문은 검산된 단원 JSON.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** 동작 줄이기가 켜져 있나. 렌더 중에는 읽지 않고(서버 렌더·스모크 테스트) 이벤트 처리 중에만 부른다 */
export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
