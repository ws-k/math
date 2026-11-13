import katex from 'katex';

export type Segment = { type: 'text' | 'inline' | 'display'; value: string };

/** "$...$"(문장 속 수식), "$$...$$"(가운데 수식), "\$"(달러 기호)를 나눈다. */
export function splitMath(src: string): Segment[] {
  const out: Segment[] = [];
  let text = '';
  let i = 0;
  const flush = () => {
    if (text) out.push({ type: 'text', value: text });
    text = '';
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && src[i + 1] === '$') {
      text += '$';
      i += 2;
      continue;
    }
    if (ch === '$') {
      const display = src[i + 1] === '$';
      const open = display ? 2 : 1;
      const close = display ? '$$' : '$';
      let j = i + open;
      for (; j < src.length; j++) {
        if (src[j] === '\\') {
          j++;
          continue;
        }
        if (src.startsWith(close, j)) break;
      }
      if (j >= src.length) throw new Error(`닫히지 않은 수식: ${src.slice(i, i + 40)}`);
      flush();
      out.push({ type: display ? 'display' : 'inline', value: src.slice(i + open, j) });
      i = j + close.length;
      continue;
    }
    text += ch;
    i++;
  }
  flush();
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cache = new Map<string, string>();

/** 글+수식 문자열을 HTML 로. strict 이면 수식 오류에서 예외를 던진다(검산 단계용). */
export function renderRich(src: string, strict = false): string {
  const key = strict ? `!${src}` : src;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const html = splitMath(src)
    .map((s) => {
      if (s.type === 'text') return escapeHtml(s.value).replace(/\n/g, '<br>');
      return katex.renderToString(s.value, {
        displayMode: s.type === 'display',
        throwOnError: strict,
        strict: strict ? 'error' : 'ignore',
        output: 'html',
      });
    })
    .join('');
  if (cache.size > 2000) cache.clear();
  cache.set(key, html);
  return html;
}
