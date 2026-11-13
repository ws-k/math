import type { AnswerType } from '../content/types.ts';

export type Verdict = 'correct' | 'wrong' | 'invalid' | 'unknown';

const CIRCLED = '①②③④⑤';

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
