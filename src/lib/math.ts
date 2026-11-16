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

export interface RichOptions {
  /** 레슨 글의 **굵게**·==강조== 표기를 태그로 바꾼다. 문제 글에서는 기호가 그대로 보여야 해서 옵션이다. */
  emph?: boolean;
}

/**
 * 글 조각 하나 안의 강조 표기를 바꾼다. 짝은 같은 글 조각 안에서만 찾는다 — 수식($…$)을 사이에 두고
 * 열고 닫으면 KaTeX 결과 HTML 을 태그가 가로질러 깨지므로 거부한다(strict). 남은 기호가 있으면 짝이 안 맞은 것.
 */
function emphasize(html: string, strict: boolean): string {
  const out = html
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/==(.+?)==/g, '<span class="hl">$1</span>');
  if (strict && (out.includes('**') || out.includes('==')))
    throw new Error(`강조 표기 짝이 안 맞거나 수식 경계를 넘음: ${html.slice(0, 40)}`);
  return out;
}

/** 글+수식 문자열을 HTML 로. strict 이면 수식 오류에서 예외를 던진다(검산 단계용). */
export function renderRich(src: string, strict = false, opt: RichOptions = {}): string {
  const key = `${strict ? '!' : ''}${opt.emph ? '*' : ''}|${src}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const parts = splitMath(src).map((s) => {
    if (s.type === 'text') {
      const t = escapeHtml(s.value).replace(/\n/g, '<br>');
      return { inline: false, html: opt.emph ? emphasize(t, strict) : t };
    }
    const html = katex.renderToString(s.value, {
      displayMode: s.type === 'display',
      throwOnError: strict,
      strict: strict ? 'error' : 'ignore',
      output: 'html',
    });
    return { inline: s.type === 'inline', html };
  });
  // 문장 속 수식과 빈칸 없이 붙은 글자('$i^4=1$,'·'끝($x$)이에요')를 한 덩어리(mglue)로 묶는다. 레슨은 문장 속
  // 수식을 inline-block 덩어리로 두는데(lesson.css), 브라우저는 덩어리 앞뒤를 늘 줄바꿈 자리로 봐서 쉼표가 다음 줄
  // 맨 앞으로 떨어졌다(단어 잇기 문자 U+2060 도 크롬은 덩어리 옆에서 무시한다). 레슨 CSS 가 mglue 를 줄바꿈
  // 없게 하고, 레슨 밖에서는 아무 모양도 없는 span 이다. 묶을 글자에 태그(<b> 등)가 걸리면 가르지 않게 묶지 않는다
  parts.forEach((p, i) => {
    if (!p.inline) return;
    const prev = parts[i - 1];
    const next = parts[i + 1];
    const l = prev && !prev.inline ? (/[^\s<>]+$/.exec(prev.html)?.[0] ?? '') : '';
    const r = next && !next.inline ? (/^[^\s<>]+/.exec(next.html)?.[0] ?? '') : '';
    if (!l && !r) return;
    if (prev && l) prev.html = prev.html.slice(0, -l.length);
    if (next && r) next.html = next.html.slice(r.length);
    p.html = `<span class="mglue">${l}${p.html}${r}</span>`;
  });
  const html = parts.map((p) => p.html).join('');
  if (cache.size > 2000) cache.clear();
  cache.set(key, html);
  return html;
}
