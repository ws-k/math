// 레슨 화면 공용 작은 조각.
import { createContext, useContext, useMemo } from 'react';
import { Rich } from '../app/Rich.tsx';
import { renderRich } from '../lib/math.ts';
import { fill, numSplit } from './format.ts';

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

/** formatValue 글자(보기): 수 안에서는 줄을 안 바꾸고 단위 앞에서만 바꿀 수 있게(numSplit 참고) */
export function NumLabel({ text }: { text: string }) {
  const sp = numSplit(text);
  if (!sp) return <>{text}</>;
  return (
    <>
      <span className="mglue">{sp[0]}</span>
      {sp[1] && <wbr />}
      {sp[1]}
    </>
  );
}

/** 레슨 글의 {{이름}} 값(lessonVars). LessonPlayer 가 한 번 만들어 내려 준다 */
export const LessonVars = createContext<Record<string, string>>({});

/**
 * 레슨 글은 모두 이것으로 그린다 — {{…}} 치환을 한 곳에서 해야 검사기(schema.ts 의 text)가 채워 본 글과
 * 화면 글이 같다. vars 는 그 자리에서만 쓰는 값(풀이의 {{answer}}, 저울의 {{a}} 등)으로 레슨 값 위에 덮는다.
 */
export function LRich(p: {
  src: string;
  vars?: Record<string, string>;
  inline?: boolean;
  className?: string;
}) {
  const base = useContext(LessonVars);
  const src = fill(p.src, p.vars ? { ...base, ...p.vars } : base);
  return <Rich emph src={src} inline={p.inline} className={p.className} />;
}

/** 동작 줄이기가 켜져 있나. 렌더 중에는 읽지 않고(서버 렌더·스모크 테스트) 이벤트 처리 중에만 부른다 */
export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
