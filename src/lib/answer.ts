import type { AnswerType } from '../content/types.ts';

export type Verdict = 'correct' | 'wrong' | 'invalid' | 'unknown';

/** 객관식 보기 번호 글자. 문제 화면·레슨·채점이 같은 글자를 쓴다 */
export const CIRCLED = '①②③④⑤';

/**
 * 보여 줄 답 글자: 정답 표기(answerTex)가 있으면 그것, 객관식이면 보기 번호 ①~⑤, 아니면 답 그대로.
 * 문제 화면의 '정답 보기'·레슨 글의 {{answer}}·형식 검사가 이 한 함수를 써야 검사한 글자가 화면 글자다(검토 M5)
 */
export const answerText = (p: { answer: string; answerType: AnswerType; answerTex?: string }) =>
  p.answerTex ??
  (p.answerType === 'choice' ? (CIRCLED[Number(p.answer) - 1] ?? p.answer) : p.answer);

function normalize(s: string): string {
  return s.trim().replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
}

/** 분수·대분수·소수·정수를 [분자, 분모] 로. 못 읽으면 null. */
function parseRational(s: string): [bigint, bigint] | null {
  let m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
  if (m) {
    const [, sg, w, n, d] = m as unknown as [string, string, string, string, string];
    if (BigInt(d) === 0n) return null;
    const num = BigInt(w) * BigInt(d) + BigInt(n);
    return [sg ? -num : num, BigInt(d)];
  }
  m = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (m) {
    const d = BigInt(m[2] as string);
    return d === 0n ? null : [BigInt(m[1] as string), d];
  }
  m = s.match(/^(-?)(\d*)\.(\d+)$/);
  if (m) {
    const [, sg, ip, fp] = m as unknown as [string, string, string, string];
    const d = 10n ** BigInt(fp.length);
    const num = BigInt(ip || '0') * d + BigInt(fp);
    return [sg ? -num : num, d];
  }
  m = s.match(/^[+]?(-?\d+)$/);
  if (m) return [BigInt(m[1] as string), 1n];
  return null;
}

const same = (a: [bigint, bigint], b: [bigint, bigint]) => a[0] * b[1] === b[0] * a[1];

export function compareAnswer(input: string, answer: string, type: AnswerType): Verdict {
  const s = normalize(input);
  if (type === 'expr') return 'unknown';
  if (!s) return 'invalid';
  if (type === 'choice') {
    const idx = CIRCLED.indexOf(s);
    const n = idx >= 0 ? idx + 1 : /^[1-5]$/.test(s) ? Number(s) : null;
    if (n === null) return 'invalid';
    return String(n) === answer ? 'correct' : 'wrong';
  }
  if (type === 'int' && !/^[+]?-?\d+$/.test(s)) return 'invalid';
  const a = parseRational(s);
  const b = parseRational(answer);
  if (!a || !b) return 'invalid';
  return same(a, b) ? 'correct' : 'wrong';
}
