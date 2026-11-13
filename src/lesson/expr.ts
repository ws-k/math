// 그래프를 그리는 계산기. 식 구조(sym.ts 의 parseSym)를 그대로 받아 값을 낸다 — 파서를 따로 두면
// 화면 글자·검산 식·그래프가 서로 다른 식을 읽게 될 수 있다.
// 값이 실수가 아니거나 정의되지 않으면(0 으로 나눔, 음수의 로그, tan(π/2) …) NaN 을 낸다. sympy 쪽에서는
// 같은 자리가 "실수 아님·zoo" 가 되는데, 둘이 같은 자리에서 끊기는지는 parity 검산이 확인한다.
import { type Node, parseSym, type Rational, reduce, symToTex } from './sym.ts';

const bad = Number.NaN;

/** 식 → 수. env 에 없는 변수는 예외(그리기 전에 compile 로 막는다) */
export function evalNum(n: Node, env: Record<string, number>): number {
  const v = ev(n, env);
  return Number.isFinite(v) ? v : bad;
}

function ev(n: Node, env: Record<string, number>): number {
  switch (n.t) {
    case 'num':
      return Number(n.v);
    case 'var': {
      const v = env[n.v];
      if (v === undefined) throw new Error(`값이 없는 변수 ${n.v}`);
      return v;
    }
    case 'const':
      return n.v === 'pi' ? Math.PI : Math.E;
    case 'neg':
      return -ev(n.a, env);
    case 'pos':
      return ev(n.a, env);
    case 'add':
      return ev(n.a, env) + ev(n.b, env);
    case 'sub':
      return ev(n.a, env) - ev(n.b, env);
    case 'mul':
      return ev(n.a, env) * ev(n.b, env);
    case 'div': {
      const d = ev(n.b, env);
      return d === 0 ? bad : ev(n.a, env) / d;
    }
    case 'pow': {
      const a = ev(n.a, env);
      const b = ev(n.b, env);
      // 음수의 정수 아닌 거듭제곱은 sympy 에서 복소수다(세제곱근도). 0 의 음수 거듭제곱은 zoo
      if (a < 0 && !Number.isInteger(b)) return bad;
      if (a === 0 && b < 0) return bad;
      return a ** b;
    }
    case 'call': {
      const a = ev(n.args[0] as Node, env);
      switch (n.f) {
        case 'sqrt':
          return a < 0 ? bad : Math.sqrt(a);
        case 'sin':
          return Math.sin(a);
        case 'cos':
          return Math.cos(a);
        case 'tan':
          // 부동소수로는 cos(π/2) 가 0 이 안 되어 tan 이 1.6e16 처럼 나온다 — 정의 안 됨으로 본다
          return Math.abs(Math.cos(a)) < 1e-12 ? bad : Math.tan(a);
        case 'Abs':
          return Math.abs(a);
        case 'log': {
          if (a <= 0) return bad;
          if (n.args.length === 1) return Math.log(a);
          const b = ev(n.args[1] as Node, env);
          if (b <= 0 || b === 1) return bad;
          return Math.log(a) / Math.log(b);
        }
        case 'diff':
          return ev(derivative(n.args[0] as Node, 'x'), env);
      }
    }
  }
}

/** 식에 나오는 변수 이름들 */
export function varsOf(n: Node, out = new Set<string>()): Set<string> {
  if (n.t === 'var') out.add(n.v);
  else if (n.t === 'neg' || n.t === 'pos') varsOf(n.a, out);
  else if (n.t === 'call') for (const a of n.args) varsOf(a, out);
  else if ('b' in n) {
    varsOf(n.a, out);
    varsOf(n.b, out);
  }
  return out;
}

/** 식을 읽고, 허락한 변수만 쓰는지 본다. 그래프 식에 모르는 글자가 있으면 그릴 수 없다 */
export function compile(src: string, vars: string[]): Node {
  const n = parseSym(src);
  for (const v of varsOf(n))
    if (!vars.includes(v)) throw new Error(`식에 쓸 수 없는 변수 ${v}: ${src}`);
  return n;
}

/** 분수로 정확히 계산. 함수·무리수·정수 아닌 지수·0 나눗셈이면 null */
export function evalExact(n: Node, env: Record<string, Rational>): Rational | null {
  try {
    return ex(n, env);
  } catch {
    return null;
  }
}

function ex(n: Node, env: Record<string, Rational>): Rational {
  switch (n.t) {
    case 'num': {
      const [ip, fp = ''] = n.v.split('.');
      return reduce(BigInt(ip + fp), 10n ** BigInt(fp.length));
    }
    case 'var': {
      const v = env[n.v];
      if (!v) throw new Error('값 없음');
      return v;
    }
    case 'neg': {
      const [a, b] = ex(n.a, env);
      return [-a, b];
    }
    case 'pos':
      return ex(n.a, env);
    case 'add':
    case 'sub':
    case 'mul':
    case 'div': {
      const [a, b] = ex(n.a, env);
      const [c, d] = ex(n.b, env);
      if (n.t === 'add') return reduce(a * d + c * b, b * d);
      if (n.t === 'sub') return reduce(a * d - c * b, b * d);
      if (n.t === 'mul') return reduce(a * c, b * d);
      return reduce(a * d, b * c);
    }
    case 'pow': {
      const [a, b] = ex(n.a, env);
      const [e, ed] = ex(n.b, env);
      if (ed !== 1n) throw new Error('정수 아닌 지수');
      const k = e < 0n ? -e : e;
      return e < 0n ? reduce(b ** k, a ** k) : reduce(a ** k, b ** k);
    }
    case 'call':
      if (n.f === 'diff') return ex(derivative(n.args[0] as Node, 'x'), env);
      throw new Error('함수');
    case 'const':
      throw new Error('무리수');
  }
}

// ---- 미분 ----
// 접선 기울기·readout 같은 파생값은 작성자가 적지 않고 기준 곡선에서 이 함수로 계산한다.
// 결과는 sympy 의 diff 와 대조한다(parity·답 검산). 간단한 정리(0·1 지우기, 숫자끼리 계산)만 한다.

const N = (v: string | number): Node => ({ t: 'num', v: String(v) });
const isNum = (n: Node, v: number) => n.t === 'num' && Number(n.v) === v;

function add(a: Node, b: Node): Node {
  if (isNum(a, 0)) return b;
  if (isNum(b, 0)) return a;
  return { t: 'add', a, b };
}
function sub(a: Node, b: Node): Node {
  if (isNum(b, 0)) return a;
  if (isNum(a, 0)) return neg(b);
  return { t: 'sub', a, b };
}
function neg(a: Node): Node {
  if (isNum(a, 0)) return a;
  return { t: 'neg', a };
}
function mul(a: Node, b: Node): Node {
  if (isNum(a, 0) || isNum(b, 0)) return N(0);
  if (isNum(a, 1)) return b;
  if (isNum(b, 1)) return a;
  if (a.t === 'num' && b.t === 'num') return N(Number(a.v) * Number(b.v));
  return { t: 'mul', a, b };
}
function div(a: Node, b: Node): Node {
  if (isNum(a, 0)) return N(0);
  if (isNum(b, 1)) return a;
  return { t: 'div', a, b };
}
const pow = (a: Node, b: Node): Node => (isNum(b, 1) ? a : { t: 'pow', a, b });
const call = (f: 'sin' | 'cos' | 'log' | 'sqrt', a: Node): Node => ({ t: 'call', f, args: [a] });

const has = (n: Node, v: string) => varsOf(n).has(v);

/** 식을 v 로 미분한 식. 절댓값은 미분하지 않는다(꺾이는 점이 있어 그래프 덧그림에 쓰지 않음) */
export function derivative(n: Node, v: string): Node {
  const d = (m: Node) => derivative(m, v);
  switch (n.t) {
    case 'num':
    case 'const':
      return N(0);
    case 'var':
      return N(n.v === v ? 1 : 0);
    case 'neg':
      return neg(d(n.a));
    case 'pos':
      return d(n.a);
    case 'add':
      return add(d(n.a), d(n.b));
    case 'sub':
      return sub(d(n.a), d(n.b));
    case 'mul':
      return add(mul(d(n.a), n.b), mul(n.a, d(n.b)));
    case 'div':
      return div(sub(mul(d(n.a), n.b), mul(n.a, d(n.b))), pow(n.b, N(2)));
    case 'pow': {
      const { a, b } = n;
      if (!has(b, v)) {
        // 지수가 상수: b·a^(b−1)·a'
        const e: Node = b.t === 'num' ? N(Number(b.v) - 1) : sub(b, N(1));
        return mul(mul(b, pow(a, e)), d(a));
      }
      // e^b 는 그대로, 그 밖은 a^b·(b'·ln a + b·a'/a)
      if (a.t === 'const' && a.v === 'E') return mul(n, d(b));
      return mul(n, add(mul(d(b), call('log', a)), div(mul(b, d(a)), a)));
    }
    case 'call': {
      const a = n.args[0] as Node;
      switch (n.f) {
        case 'sin':
          return mul(call('cos', a), d(a));
        case 'cos':
          return neg(mul(call('sin', a), d(a)));
        case 'tan':
          return div(d(a), pow(call('cos', a), N(2)));
        case 'sqrt':
          return div(d(a), mul(N(2), call('sqrt', a)));
        case 'log': {
          const base = n.args[1];
          if (base === undefined) return div(d(a), a);
          if (has(base, v)) throw new Error('밑에 변수가 있는 로그는 미분하지 않음');
          return div(d(a), mul(a, call('log', base)));
        }
        case 'diff':
          return d(derivative(a, 'x'));
        case 'Abs':
          throw new Error('절댓값은 미분하지 않음');
      }
    }
  }
}

// ---- 구조 → sympy 글자 ----

/** 식 구조 → sympy 가 읽는 글자. 괄호를 넉넉히 쳐서 우선순위가 바뀌지 않게 한다 */
export function toSym(n: Node): string {
  switch (n.t) {
    case 'num':
    case 'var':
    case 'const':
      return n.v;
    case 'neg':
      return `(-${toSym(n.a)})`;
    case 'pos':
      return toSym(n.a);
    case 'add':
      return `(${toSym(n.a)}+${toSym(n.b)})`;
    case 'sub':
      return `(${toSym(n.a)}-${toSym(n.b)})`;
    case 'mul':
      return `(${toSym(n.a)}*${toSym(n.b)})`;
    case 'div':
      return `(${toSym(n.a)}/${toSym(n.b)})`;
    case 'pow':
      return `(${toSym(n.a)})**(${toSym(n.b)})`;
    case 'call':
      return `${n.f}(${n.args.map(toSym).join(',')})`;
  }
}

// ---- parity 표본 ----

/** 숫자 → 정확한 유리수 글자(0.1 → 1/10). 식 글자면 그대로 */
export function exactStr(v: number | string): string {
  if (typeof v === 'string') return v.replace(/\s+/g, '');
  const s = String(v);
  if (/e/i.test(s)) throw new Error(`지수 표기 숫자는 쓰지 않음: ${s}`);
  const [ip, fp = ''] = s.split('.');
  const [n, d] = reduce(BigInt(ip + fp), 10n ** BigInt(fp.length));
  return d === 1n ? `${n}` : `${n}/${d}`;
}

/** 수식이 유리수면 분수 [분자,분모], 아니면 null */
export const exactOf = (s: string): Rational | null => evalExact(parseSym(s), {});

const PARITY_N = 9;

/**
 * 그래프 식을 범위 안 9개 점에서 TS 로 계산한 값(정의 안 되면 null). sympy 가 같은 점에서 다시 계산해
 * 상대오차 1e-9 안인지, 정의 안 되는 자리가 같은지 본다. 점은 정확한 글자로 넘겨 sympy 가 반올림 없이 넣게 한다.
 */
export function paritySamples(
  src: string,
  vars: string[],
  range: Record<string, [number | string, number | string]>,
  fixed: Record<string, string>,
): { points: Record<string, string>[]; values: (number | null)[] } {
  const n = compile(src, vars);
  const [v, [lo, hi]] = Object.entries(range)[0] as [string, [number | string, number | string]];
  const a = exactStr(lo);
  const b = exactStr(hi);
  const ra = exactOf(a);
  const rb = exactOf(b);
  const points: Record<string, string>[] = [];
  const values: (number | null)[] = [];
  for (let k = 0; k < PARITY_N; k++) {
    let x: string;
    if (ra && rb) {
      const [p, q] = reduce(
        ra[0] * rb[1] * BigInt(PARITY_N - 1) + (rb[0] * ra[1] - ra[0] * rb[1]) * BigInt(k),
        ra[1] * rb[1] * BigInt(PARITY_N - 1),
      );
      x = q === 1n ? `${p}` : `${p}/${q}`;
    } else x = `(${a})+${k}*((${b})-(${a}))/${PARITY_N - 1}`;
    const pt = { [v]: x, ...fixed };
    const env: Record<string, number> = {};
    for (const [k2, s] of Object.entries(pt)) env[k2] = evalNum(parseSym(s), {});
    const val = evalNum(n, env);
    points.push(pt);
    values.push(Number.isNaN(val) ? null : val);
  }
  return { points, values };
}

/** 그래프 식의 KaTeX(라벨용) */
export const exprTex = (src: string) => symToTex(src);
