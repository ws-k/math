// "그릴 목록"(draw.ts)을 React 로 그린다. 끄는 동안의 직접 고치기(applyDrawing)와 같은 목록을 쓴다.
import { createElement } from 'react';
import type { Mark } from './draw.ts';

export function Marks({ marks }: { marks: Mark[] }) {
  return (
    <>
      {marks.map((m) => {
        const { class: cls, ...rest } = m.a;
        return createElement(
          m.tag,
          {
            key: m.k,
            'data-k': m.k,
            ...(cls !== undefined ? { className: String(cls) } : {}),
            ...rest,
          },
          m.text,
        );
      })}
    </>
  );
}
