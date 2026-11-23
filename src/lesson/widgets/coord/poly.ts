// 다항식(분수 계수)과 스투름 열로 세는 실근 개수. '교점 3개'·'중근이 되게' 같은 목표를 소수 계산으로 판정하면
// 중근(곡선이 가로축에 닿기만 하는 자리)에서 부동소수 오차로 0개·2개를 오가므로, 분수로 정확히 센다(원칙 P10).
// 맨 아래층(식 구조만 안다) — 곡선·읽는 값이 이 파일을 빌려 쓴다.
import { derivative, evalExact } from '../../expr.ts';
import type { Node, Rational } from '../../sym.ts';
import { add as qadd, div as qdiv, mul as qmul, neg as qneg } from '../q.ts';

/** 계수 목록(낮은 차수부터). 끝의 0 은 떼어 둔다 — 빈 목록 = 0 인 다항식 */
export type Poly = Rational[];

const Z: Rational = [0n, 1n];

function trim(p: Poly): Poly {
  let n = p.length;
  while (n > 0 && (p[n - 1] as Rational)[0] === 0n) n--;
  return p.slice(0, n);
}
function padd(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(qadd(a[i] ?? Z, b[i] ?? Z));
  return trim(out);
}
function pmul(a: Poly, b: Poly): Poly {
  if (!a.length || !b.length) return [];
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => Z);
  a.forEach((x, i) => {
    b.forEach((y, j) => {
      out[i + j] = qadd(out[i + j] as Rational, qmul(x, y));
    });
  });
  return trim(out);
}
const pscale = (a: Poly, k: Rational) => trim(a.map((x) => qmul(x, k)));

/** 차수 상한 — 계수가 너무 커지지 않게(레슨 곡선은 많아야 5차쯤) */
const MAX_DEG = 12;

/**
 * 식 → x 의 다항식(다른 변수는 env 의 분수). 다항식이 아니면(함수·x 로 나눔·정수 아닌 지수) null.
 * diff(…) 는 미분한 식으로 읽는다.
 */
export function polyOf(n: Node, env: Record<string, Rational>): Poly | null {
  try {
    const p = pl(n, env);
    return p.length - 1 > MAX_DEG ? null : p;
  } catch {
    return null;
  }
}

function pl(n: Node, env: Record<string, Rational>): Poly {
  switch (n.t) {
    case 'num':
    case 'const': {
      const v = evalExact(n, {});
      if (!v) throw new Error('무리수');
      return trim([v]);
    }
    case 'var': {
      if (n.v === 'x') return [Z, [1n, 1n]];
      const v = env[n.v];
      if (!v) throw new Error('값 없음');
      return trim([v]);
    }
    case 'neg':
      return pl(n.a, env).map(qneg);
    case 'pos':
      return pl(n.a, env);
    case 'add':
      return padd(pl(n.a, env), pl(n.b, env));
    case 'sub':
      return padd(pl(n.a, env), pl(n.b, env).map(qneg));
    case 'mul':
      return pmul(pl(n.a, env), pl(n.b, env));
    case 'div': {
      const d = pl(n.b, env);
      if (d.length !== 1) throw new Error('x 로 나눔');
      return pscale(pl(n.a, env), qdiv([1n, 1n], d[0] as Rational));
    }
    case 'pow': {
      const e = evalExact(n.b, env);
      if (!e) throw new Error('지수에 x');
      if (e[1] !== 1n || e[0] < 0n || e[0] > BigInt(MAX_DEG)) throw new Error('지수');
      const b = pl(n.a, env);
      let out: Poly = [[1n, 1n]];
      for (let k = 0n; k < e[0]; k++) out = pmul(out, b);
      return out;
    }
    case 'call':
      if (n.f === 'diff') return pl(derivative(n.args[0] as Node, 'x'), env);
      throw new Error('함수');
  }
}

const deriv = (p: Poly): Poly => trim(p.slice(1).map((c, i) => qmul(c, [BigInt(i + 1), 1n])));

/** 나머지(a ÷ b). b 는 0 이 아님 */
function rem(a: Poly, b: Poly): Poly {
  let r = a.slice();
  const lb = b[b.length - 1] as Rational;
  while (r.length >= b.length && r.length) {
    const k = qdiv(r[r.length - 1] as Rational, lb);
    const shift = r.length - b.length;
    const sub: Poly = Array.from({ length: shift }, () => Z).concat(b.map((c) => qmul(c, k)));
    r = trim(r.map((c, i) => qadd(c, qneg(sub[i] ?? Z))));
  }
  return r;
}

/** 양수 상수로 나눠 계수를 작게(부호는 그대로라 스투름 열의 부호 변화가 같다) */
function shrink(p: Poly): Poly {
  const l = p[p.length - 1] as Rational;
  const a: Rational = l[0] < 0n ? [-l[0], l[1]] : l;
  return p.map((c) => qdiv(c, a));
}

const sign = (q: Rational) => (q[0] > 0n ? 1 : q[0] < 0n ? -1 : 0);
function changes(signs: number[]): number {
  let n = 0;
  let prev = 0;
  for (const s of signs) {
    if (s === 0) continue;
    if (prev !== 0 && s !== prev) n++;
    prev = s;
  }
  return n;
}

/** 스투름 열(p, p′, 나머지의 부호를 바꾼 것…). p 는 상수가 아닌 다항식 */
function sturm(p: Poly): Poly[] {
  const seq: Poly[] = [shrink(p), shrink(deriv(p))];
  for (;;) {
    const r = rem(seq[seq.length - 2] as Poly, seq[seq.length - 1] as Poly);
    if (!r.length) break;
    seq.push(shrink(r.map(qneg)));
  }
  return seq;
}

/**
 * 서로 다른 실근의 개수(스투름 정리: −∞ 와 +∞ 에서 스투름 열의 부호 변화 수의 차).
 * 중근은 하나로 센다. 0 인 다항식(모든 x 가 근)이면 null.
 */
export function rootCount(p0: Poly): number | null {
  const p = trim(p0);
  if (!p.length) return null;
  if (p.length === 1) return 0;
  const seq = sturm(p);
  const lead = (q: Poly) => sign(q[q.length - 1] as Rational);
  const atPos = seq.map(lead);
  const atNeg = seq.map((q) => lead(q) * ((q.length - 1) % 2 === 0 ? 1 : -1));
  return changes(atNeg) - changes(atPos);
}

/** p(x) (호너) */
function at(p: Poly, x: Rational): Rational {
  let v = Z;
  for (let i = p.length - 1; i >= 0; i--) v = qadd(qmul(v, x), p[i] as Rational);
  return v;
}

/** p ÷ (x − r) 의 몫(r 이 근일 때 — 나머지 0). 조립제법 */
function deflate(p: Poly, r: Rational): Poly {
  const out: Poly = new Array(p.length - 1);
  let c = Z;
  for (let i = p.length - 1; i >= 1; i--) {
    c = qadd(qmul(c, r), p[i] as Rational);
    out[i - 1] = c;
  }
  return trim(out);
}

/**
 * 열린 구간 (a, b) 안의 서로 다른 실근 개수(a < b). 0 인 다항식이면 null.
 * 끝점이 근이면 (x−a)·(x−b) 로 먼저 나눠 낸다 — 스투름 정리는 끝점에서 다항식이 0 이 아니어야 해서.
 * 구분구적 곡선의 '구간에서 계속 오르거나 내리는가'(도함수가 구간 안에서 0 이 되지 않는가)를 본다.
 */
export function rootsBetween(p0: Poly, a: Rational, b: Rational): number | null {
  let p = trim(p0);
  if (!p.length) return null;
  for (const e of [a, b]) while (p.length > 1 && sign(at(p, e)) === 0) p = deflate(p, e);
  if (p.length === 1) return 0;
  const seq = sturm(p);
  const v = (x: Rational) => changes(seq.map((q) => sign(at(q, x))));
  return v(a) - v(b);
}

/** [a, b] 에서의 정적분(정확한 분수) — 부정적분에 양 끝을 넣어서. 구분구적 넓이·칠한 영역의 합이 같이 쓴다 */
export function polyIntegral(c: Poly, a: Rational, b: Rational): Rational {
  const anti = (x: Rational) =>
    c.reduce<Rational>((acc, ck, i) => {
      let xp: Rational = [1n, 1n];
      for (let j = 0; j <= i; j++) xp = qmul(xp, x);
      return qadd(acc, qdiv(qmul(ck, xp), [BigInt(i + 1), 1n]));
    }, Z);
  return qadd(anti(b), qneg(anti(a)));
}

/**
 * 유리수 근 후보를 늘어놓을 정수 계수(공약수로 나눈 뒤)의 상한. 약수를 √n 까지 나눠 찾고 후보 수가 두 끝 계수의
 * 약수 수의 곱이라, 이보다 크면 형식 검사가 눈에 띄게 느려진다(레슨 곡선의 계수는 많아야 수백)
 */
const ROOT_COEF_MAX = 10n ** 6n;

const babs = (n: bigint) => (n < 0n ? -n : n);
const bgcd = (a: bigint, b: bigint): bigint => (b === 0n ? babs(a) : bgcd(b, a % b));

function divisors(n: bigint): bigint[] {
  const out: bigint[] = [];
  for (let d = 1n; d * d <= n; d++)
    if (n % d === 0n) {
      out.push(d);
      if (d * d !== n) out.push(n / d);
    }
  return out;
}

/**
 * 서로 다른 유리수 근(작은 것부터). 0 인 다항식이거나 계수가 너무 커서 후보를 늘어놓을 수 없으면 null.
 * 유리근 정리: 정수 계수로 바꾼 뒤 근 p/q 의 p 는 상수항, q 는 최고차 계수의 약수라 후보를 모두 대입해 본다.
 * 부호 뗀 합(칠한 영역의 abs)을 분수로 정확히 끊으려고 쓴다 — 근을 소수로 찾으면 끊는 자리가 흔들려 합이 분수가 아니다.
 * 무리수 근은 여기 나오지 않으므로, 부르는 쪽이 rootsBetween(스투름) 개수와 견줘 빠진 근이 없는지 본다.
 */
export function rationalRoots(p0: Poly): Rational[] | null {
  let p = trim(p0);
  if (!p.length) return null;
  const out: Rational[] = [];
  // x 로 묶이는 만큼 떼어 낸다(근 0) — 상수항이 0 이면 약수 후보를 늘어놓을 수 없다
  if ((p[0] as Rational)[0] === 0n) {
    out.push(Z);
    while ((p[0] as Rational)[0] === 0n) p = p.slice(1);
  }
  if (p.length > 1) {
    const lcm = p.reduce((l, c) => (l / bgcd(l, c[1])) * c[1], 1n);
    const raw = p.map((c) => c[0] * (lcm / c[1]));
    // 공약수로 먼저 나눈다 — 2x²−8 과 x²−4 는 근이 같은데 앞의 것만 후보가 늘고 상한에 먼저 걸린다
    const g = raw.reduce((acc, c) => bgcd(acc, c), 0n);
    const ints = raw.map((c) => c / g);
    const c0 = babs(ints[0] as bigint);
    const cn = babs(ints[ints.length - 1] as bigint);
    if (c0 > ROOT_COEF_MAX || cn > ROOT_COEF_MAX) return null;
    const seen = new Set<string>();
    for (const a of divisors(c0))
      for (const b of divisors(cn))
        for (const s of [a, -a]) {
          const g = bgcd(s, b);
          const r: Rational = [s / g, b / g];
          const key = `${r[0]}/${r[1]}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (sign(at(p, r)) === 0) out.push(r);
        }
  }
  return out.sort((a, b) => sign(qadd(a, qneg(b))));
}
