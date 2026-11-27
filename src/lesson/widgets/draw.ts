// 부품 그림의 "상태 → 그릴 목록" 공통 형식. 부품마다 순수 함수 하나(draw)가 상태를 이 목록으로 바꾸고,
// 적용은 두 가지다: 처음과 손을 뗀 뒤에는 React 가 그리고(Marks.tsx), 끄는 동안에는 applyDrawing 이
// 같은 목록으로 SVG 속성·글자만 직접 고친다(React 렌더 없음). 그림을 두 벌로 짜면 끄는 중 모습과
// 놓은 뒤 모습이 어긋나므로 목록 하나에서 둘 다 나오게 했다(plan-lesson M8).
// 키(k)는 상태가 바뀌어도 그대로여야 직접 고치기가 같은 요소를 찾는다 — 안 보일 때는 지우지 않고 visibility 로 숨긴다.

export type Tag = 'line' | 'circle' | 'rect' | 'path' | 'polygon' | 'text' | 'g';

/**
 * 그릴 것 하나. a 의 이름은 SVG 속성 그대로(x1·cx·d·points·transform·fill·visibility 등)이고,
 * class 만 React 에서 className 으로 바뀐다. 선 굵기 같은 하이픈 속성은 CSS 클래스로 준다(React 와 DOM 의 이름이 달라서).
 */
export interface Mark {
  k: string;
  tag: Tag;
  a: Record<string, string | number>;
  text?: string;
}

export interface Drawing {
  marks: Mark[];
  /** 그림 밖 글(값 읽기 칸). data-t="키" 요소의 글자를 바꾼다 */
  texts: Record<string, string>;
}

/** 소수 둘째 자리까지(SVG 좌표 글자를 짧게, 같은 값이면 같은 글자가 되게) */
export const r2 = (v: number) => Math.round(v * 100) / 100;

const sel = (attr: string, k: string) => `[${attr}="${k.replace(/["\\]/g, '\\$&')}"]`;

/** 끄는 동안 쓰는 직접 적용. 목록에 없는 요소는 건드리지 않는다 */
export function applyDrawing(root: ParentNode, d: Drawing) {
  for (const m of d.marks) {
    const el = root.querySelector(sel('data-k', m.k));
    if (!el) continue;
    for (const [n, v] of Object.entries(m.a)) {
      const s = String(v);
      if (el.getAttribute(n) !== s) el.setAttribute(n, s);
    }
    if (m.text !== undefined) setText(el, m.text);
  }
  for (const [k, t] of Object.entries(d.texts)) {
    const el = root.querySelector(sel('data-t', k));
    if (el) setText(el, t);
  }
}

/**
 * 글자 바꾸기. textContent 로 통째 바꾸면 React 가 쥐고 있던 글자 노드가 떨어져 나가 손을 뗀 뒤 다시 그릴 때
 * 옛 글자가 남는다 — 그래서 React 가 만든 글자 노드의 값만 바꾼다.
 */
export function setText(el: Element, t: string) {
  const n = el.firstChild;
  if (n && n.nodeType === 3 && !n.nextSibling) {
    if (n.nodeValue !== t) n.nodeValue = t;
  } else if (el.textContent !== t) el.textContent = t;
}

/** 목록에서 키로 하나 찾기(테스트·화면에서 값 확인용) */
export const mark = (d: Drawing, k: string) => d.marks.find((m) => m.k === k);
