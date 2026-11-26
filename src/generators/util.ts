// 생성기에서 쓰는 수·식 표기 도우미. 계수 배열은 항상 높은 차수부터.

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function reduce(n: number, d: number): { n: number; d: number } {
  if (d === 0) throw new Error('분모 0');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g + 0, d: (s * d) / g };
}

/** 분수를 LaTeX 로. mixed 이면 가분수를 대분수로 적는다. */
export function fracTex(n: number, d: number, opt: { mixed?: boolean } = {}): string {
  const r = reduce(n, d);
  if (r.d === 1) return String(r.n);
  const sign = r.n < 0 ? '-' : '';
  const a = Math.abs(r.n);
  if (opt.mixed && a > r.d) {
    const w = Math.floor(a / r.d);
    return `${sign}${w}\\frac{${a % r.d}}{${r.d}}`;
  }
  return `${sign}\\frac{${a}}{${r.d}}`;
}

/** 정답 칸에 넣는 기약분수 문자열 ("5/3", 정수면 "2") */
export function fracAns(n: number, d: number): string {
  const r = reduce(n, d);
  return r.d === 1 ? String(r.n) : `${r.n}/${r.d}`;
}

function terms(coeffs: number[]): { c: number; e: number }[] {
  const deg = coeffs.length - 1;
  return coeffs.map((c, i) => ({ c, e: deg - i })).filter((t) => t.c !== 0);
}

/** [2,-1,-2] → "2x^2-x-2" */
export function polyTex(coeffs: number[], v = 'x'): string {
  const ts = terms(coeffs);
  if (ts.length === 0) return '0';
  return ts
    .map(({ c, e }, i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      const a = Math.abs(c);
      const coef = a === 1 && e > 0 ? '' : String(a);
      const pow = e === 0 ? '' : e === 1 ? v : `${v}^${e > 9 ? `{${e}}` : e}`;
      return sign + coef + pow;
    })
    .join('');
}

/** [2,-1,-2] → "2*x**2 - 1*x - 2" (sympy 문법) */
export function polySym(coeffs: number[], v = 'x'): string {
  const ts = terms(coeffs);
  if (ts.length === 0) return '0';
  return ts
    .map(({ c, e }, i) => {
      const a = Math.abs(c);
      const body = e === 0 ? String(a) : e === 1 ? `${a}*${v}` : `${a}*${v}**${e}`;
      if (i === 0) return (c < 0 ? '-' : '') + body;
      return (c < 0 ? ' - ' : ' + ') + body;
    })
    .join('');
}

/** 음수면 괄호를 씌운다: -3 → "(-3)" */
export function paren(n: number | string): string {
  const s = String(n);
  return s.startsWith('-') ? `(${s})` : s;
}

// ---- 조사 도우미 ----
// 생성기 글은 값이 무작위라 숫자·식 뒤 조사(을/를, 이에요/예요 …)를 글자로 고정할 수 없어, 읽는 소리의 끝 받침으로
// 고른다. 예전에는 생성기마다 따로 적어 규칙이 갈렸다(분수 \frac{3}{4} 를 '}' 로 보고 받침 없음, √3 을 받침 없음 등 —
// 요청 18). 한곳에 두고 모두 이것을 쓴다.

/** 받침을 읽을 수 있는 것: 수, TeX 글자, 분수 {n, d}(약분한 분자 소리) */
export type Sayable = number | string | { n: number; d: number };

/** 숫자 끝자리 소리: 영·일·삼·육·칠·팔은 받침, 그 가운데 일·칠·팔은 ㄹ 받침. 0 으로 끝나면 십·백·천·만이라 받침 */
const DIGIT_BATCHIM = '013678';
const DIGIT_RIEUL = '178';

/**
 * 소리 내어 읽은 끝 글자에 받침이 있나·그 받침이 ㄹ 인가. TeX 는 읽는 순서대로 본다: 분수는 'b분의 a' 라 분자,
 * 거듭제곱은 '제곱'(받침), ° 는 '도'(받침 없음), 괄호·근호·집합 기호는 안쪽 끝 글자. 영문 글자·그리스 문자는
 * 받침 없음으로 본다(x 엑스 · π 파이 — 단위 cm·m 를 '엠' 으로 잘못 읽지 않게, 예전 생성기들과 같은 판단)
 */
export function lastSound(v: Sayable): { batchim: boolean; rieul: boolean } {
  if (typeof v === 'object') return lastSound(reduce(v.n, v.d).n);
  let s = String(v).trim();
  for (;;) {
    // 닫는 괄호·근호 칸·집합 기호·수식 구분 $ 는 소리가 없다 — 안쪽 끝 글자가 끝소리
    const t = s.replace(/(\\right)?[)\]}|$]$|\\[{}]$|\s+$/, '');
    if (t === s) break;
    s = t;
  }
  if (/\^\{?\\circ\}?$|°$/.test(s)) return { batchim: false, rieul: false };
  const frac = /\\[dt]?frac\{(-?[^{}]+)\}\{[^{}]+$/.exec(s);
  if (frac) return lastSound(frac[1] as string);
  if (/\^(\{[^{}]*|[A-Za-z0-9])$/.test(s)) return { batchim: true, rieul: false };
  const last = s.slice(-1);
  if (/\d/.test(last))
    return { batchim: DIGIT_BATCHIM.includes(last), rieul: DIGIT_RIEUL.includes(last) };
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code < 11172) return { batchim: code % 28 !== 0, rieul: code % 28 === 8 };
  return { batchim: false, rieul: false };
}

export type JoPair =
  | '은/는'
  | '이/가'
  | '을/를'
  | '과/와'
  | '으로/로'
  | '이에요/예요'
  | '이라/라'
  | '이었어요/였어요';

/** 짝 조사 가운데 앞 소리에 맞는 쪽. 으로/로 는 받침이 없거나 ㄹ 받침이면 '로' */
export function jo(v: Sayable, pair: JoPair): string {
  const [yes, no] = pair.split('/') as [string, string];
  const s = lastSound(v);
  return s.batchim && !(pair === '으로/로' && s.rieul) ? yes : no;
}

/** 자주 쓰는 짝의 줄임. 둘째 인자가 있으면 분수 n/d(약분한 분자의 소리) */
const say = (v: Sayable, d?: number): Sayable =>
  d === undefined || typeof v !== 'number' ? v : { n: v, d };
export const ieyo = (v: Sayable, d?: number) => jo(say(v, d), '이에요/예요');
export const eul = (v: Sayable, d?: number) => jo(say(v, d), '을/를');
export const eun = (v: Sayable, d?: number) => jo(say(v, d), '은/는');
export const iga = (v: Sayable, d?: number) => jo(say(v, d), '이/가');
export const gwa = (v: Sayable, d?: number) => jo(say(v, d), '과/와');
export const ro = (v: Sayable, d?: number) => jo(say(v, d), '으로/로');
export const ira = (v: Sayable, d?: number) => jo(say(v, d), '이라/라');

/** 두 다항식(계수 배열)의 곱 */
export function polyMul(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => {
    b.forEach((y, j) => {
      out[i + j] += x * y;
    });
  });
  return out;
}

/** 다항식 미분 */
export function polyDiff(a: number[]): number[] {
  const deg = a.length - 1;
  if (deg === 0) return [0];
  return a.slice(0, -1).map((c, i) => c * (deg - i));
}

/** 다항식 값 */
export function polyEval(a: number[], x: number): number {
  return a.reduce((acc, c) => acc * x + c, 0);
}
