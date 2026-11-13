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
