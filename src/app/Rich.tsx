import { useMemo } from 'react';
import { renderRich } from '../lib/math.ts';

/** 글 + KaTeX 수식. */
export function Rich({
  src,
  inline,
  className,
}: {
  src: string;
  inline?: boolean;
  className?: string;
}) {
  const html = useMemo(() => renderRich(src), [src]);
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: renderRich 가 일반 글자는 이스케이프하고 KaTeX 결과만 넣는다. 원문은 저장소 안의 검산된 단원 JSON 이다.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
