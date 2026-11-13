// 계산식(sympy 문법의 작은 부분집합)을 식 구조(나무)로 읽고, 그 구조에서 화면 글자(TeX)를 만든다.
// 예전에는 정규식 치환으로 TeX 를 만들었는데, 2*3*4 → 2×34, x*2 → x2 처럼 구조를 모르는 치환이
// 다른 식을 그려 냈다. 검산한 식과 보이는 식이 같아야 하므로 구조를 거쳐 만든다.
// 연산 우선순위는 파이썬(sympy 가 읽는 방식)을 그대로 따른다: -2*x = (-2)*x, -x**2 = -(x**2), 2**3**2 = 2**(3**2).

/** diff 는 x 로 미분한 식(틀린 곳 찾기에서 "{f(x)g(x)}' = …" 을 적으려고). 둘째 인자는 늘 x */
export type Fn = 'sqrt' | 'sin' | 'cos' | 'tan' | 'log' | 'Abs' | 'diff';

export type Node =
  | { t: 'num'; v: string }
  | { t: 'var'; v: string }
  | { t: 'const'; v: 'pi' | 'E' }
  | { t: 'neg' | 'pos'; a: Node }
  | { t: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Node; b: Node }
  | { t: 'call'; f: Fn; args: Node[] };

/** 함수 이름 → 받을 수 있는 인자 수. exp 는 읽자마자 e 의 거듭제곱으로 바꾼다(같은 식을 두 모양으로 두지 않게) */
const FNS: Record<string, number[]> = {
  sqrt: [1],
  sin: [1],
  cos: [1],
  tan: [1],
  exp: [1],
  log: [1, 2],
  Abs: [1],
  diff: [2],
};

/** 검산기(verify.py)가 기호로 아는 글자만. e·i 등은 sympy 에서 다른 뜻이거나 모르는 이름이다 */
const VARS = new Set('abcdhkmnpqrstuvwxyz'.split(''));

const fail = (src: string, why: string): never => {
  throw new Error(`식을 읽을 수 없음(${why}): ${src}`);
};

type Tok = { k: 'num' | 'name' | 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z]+)|(\*\*|[-+*/(),]))/y;
  let i = 0;
  const s = src.replace(/\s+$/, '');
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return fail(src, `모르는 글자 '${s[i]}'`);
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ k: 'num', v: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'name', v: m[2] });
    else out.push({ k: 'op', v: m[3] as string });
  }
  return out;
}

export function parseSym(src: string): Node {
  const ts = tokenize(src);
  if (ts.length === 0) fail(src, '빈 식');
  let i = 0;
  const peek = () => ts[i];
  const isOp = (v: string) => peek()?.k === 'op' && peek()?.v === v;
  const eat = (v: string) => {
    if (!isOp(v)) fail(src, `'${v}' 가 와야 함`);
    i++;
  };

  const arith = (): Node => {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const t = (ts[i++] as Tok).v === '+' ? 'add' : 'sub';
      a = { t, a, b: term() };
    }
    return a;
  };
  const term = (): Node => {
    let a = factor();
    while (isOp('*') || isOp('/')) {
      const t = (ts[i++] as Tok).v === '*' ? 'mul' : 'div';
      a = { t, a, b: factor() };
    }
    return a;
  };
  const factor = (): Node => {
    if (isOp('-') || isOp('+')) {
      const t = (ts[i++] as Tok).v === '-' ? 'neg' : 'pos';
      return { t, a: factor() };
    }
    return power();
  };
  const power = (): Node => {
    const a = atom();
    if (!isOp('**')) return a;
    i++;
    return { t: 'pow', a, b: factor() };
  };
  const atom = (): Node => {
    const tk = ts[i++];
    if (!tk) return fail(src, '식이 끝나 버림');
    if (tk.k === 'num') return { t: 'num', v: tk.v };
    if (tk.k === 'op') {
      if (tk.v !== '(') return fail(src, `'${tk.v}' 자리가 이상함`);
      const e = arith();
      eat(')');
      return e;
    }
    const name = tk.v;
    if (name === 'pi' || name === 'E') return { t: 'const', v: name };
    const arity = FNS[name];
    if (arity) {
      eat('(');
      const args = [arith()];
      while (isOp(',')) {
        i++;
        args.push(arith());
      }
      eat(')');
      if (!arity.includes(args.length)) fail(src, `${name} 인자 수`);
      if (name === 'exp') return { t: 'pow', a: { t: 'const', v: 'E' }, b: args[0] as Node };
      // 화면 글자 {…}' 에는 무엇으로 미분했는지가 없다 — x 가 아니면 보이는 식과 검산 식이 달라진다
      if (name === 'diff' && (args[1]?.t !== 'var' || args[1].v !== 'x'))
        fail(src, 'diff 는 x 로만 미분');
      return { t: 'call', f: name as Fn, args };
    }
    if (VARS.has(name)) return { t: 'var', v: name };
    return fail(src, `모르는 이름 ${name}`);
  };

  const e = arith();
  const rest = peek();
  if (rest) {
    // 3x·2(x+1)·(x)(x) 처럼 곱셈 기호를 빼먹은 꼴은 sympy 가 못 읽는다 — 화면만 맞고 검산이 깨지지 않게 거부
    const juxt = rest.k !== 'op' || rest.v === '(';
    fail(src, juxt ? '곱셈은 * 로 적어야 함' : `'${rest.v}' 자리가 이상함`);
  }
  return e;
}

// ---- 구조 → TeX ----

const paren = (s: string) => `(${s})`;
const signed = (s: string) => /^[-+]/.test(s);

function tex(n: Node): string {
  switch (n.t) {
    case 'num':
    case 'var':
      return n.v;
    case 'const':
      return n.v === 'pi' ? '\\pi' : 'e';
    case 'call': {
      const [a, b] = n.args.map(tex) as [string, string | undefined];
      if (n.f === 'sqrt') return `\\sqrt{${a}}`;
      if (n.f === 'Abs') return `\\left|${a}\\right|`;
      if (n.f === 'diff') return `\\left\\{${a}\\right\\}'`;
      if (n.f === 'log') return b === undefined ? `\\ln(${a})` : `\\log_{${b}}(${a})`;
      return `\\${n.f}(${a})`;
    }
    case 'neg':
    case 'pos': {
      const s = tex(n.a);
      // -(2*x) 를 -2x 로 그리면 (-2)*x 로 읽힌다 — 값은 같아도 다른 식이라 괄호로 구조를 지킨다
      const wrap = ['add', 'sub', 'mul'].includes(n.a.t) || signed(s);
      return (n.t === 'neg' ? '-' : '+') + (wrap ? paren(s) : s);
    }
    case 'add':
    case 'sub': {
      const r = tex(n.b);
      const wrap = n.b.t === 'add' || n.b.t === 'sub' || signed(r);
      return `${tex(n.a)}${n.t === 'add' ? '+' : '-'}${wrap ? paren(r) : r}`;
    }
    case 'mul': {
      const l0 = tex(n.a);
      const l = n.a.t === 'add' || n.a.t === 'sub' ? paren(l0) : l0;
      const r0 = tex(n.b);
      const r = ['add', 'sub', 'mul'].includes(n.b.t) || signed(r0) ? paren(r0) : r0;
      // 숫자가 뒤따르면(2×3, x×2) 붙여 쓰면 다른 수가 되고, 분수가 뒤따르면(2⅓) 대분수로 읽혀 ×를 보인다
      const times = /^[\d.]/.test(r) || r.startsWith('\\frac') || signed(r0);
      const sep = times ? '\\times ' : /\\[a-z]+$/.test(l) ? ' ' : '';
      return times && /^[\\(]/.test(r) ? `${l}\\times${r}` : l + sep + r;
    }
    case 'div':
      return `\\frac{${tex(n.a)}}{${tex(n.b)}}`;
    case 'pow': {
      const atomBase = n.a.t === 'num' || n.a.t === 'var' || n.a.t === 'const';
      const callBase = n.a.t === 'call';
      const b = tex(n.a);
      return `${atomBase || callBase ? b : paren(b)}^{${tex(n.b)}}`;
    }
  }
}

/** 계산식 → KaTeX 글자. 지원하지 않는 꼴은 예외 */
export const symToTex = (sym: string): string => tex(parseSym(sym));

// ---- TeX → 계산식 (왕복 검사용) ----

/**
 * symToTex 가 만든 TeX 에서 기호를 걷어 계산식으로 되돌린다. 숨긴 곱셈은 * 로 되살린다.
 * 이 왕복이 원래 식 구조와 같아야 "보이는 식 = 검산한 식"이다(테스트가 확인한다).
 */
export function texToSym(src: string): string {
  let i = 0;
  let out = '';
  /** 직전에 끝난 것이 값(숫자·글자·닫는 괄호)인가 — 그 뒤에 값이 오면 숨긴 곱셈 */
  let valueEnd = false;
  const group = (): string => {
    if (src[i] !== '{') fail(src, '{ 가 와야 함');
    let depth = 0;
    const start = i + 1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    if (depth !== 0) fail(src, '{ } 짝');
    const g = src.slice(start, i);
    i++;
    return texToSym(g);
  };
  const value = (s: string, end = true) => {
    if (valueEnd) out += '*';
    out += s;
    valueEnd = end;
  };
  const cmd = (name: string) => src.startsWith(name, i);
  while (i < src.length) {
    const c = src[i] as string;
    if (c === ' ') {
      i++;
    } else if (cmd('\\times')) {
      i += 6;
      out += '*';
      valueEnd = false;
    } else if (cmd('\\frac')) {
      i += 5;
      const a = group();
      const b = group();
      value(`((${a})/(${b}))`);
    } else if (cmd('\\sqrt')) {
      i += 5;
      value(`sqrt(${group()})`);
    } else if (cmd('\\pi')) {
      i += 3;
      value('pi');
    } else if (cmd('\\left|')) {
      i += 6;
      const end = src.indexOf('\\right|', i);
      if (end < 0) fail(src, '| 짝');
      const inner = texToSym(src.slice(i, end));
      i = end + 7;
      value(`Abs(${inner})`);
    } else if (cmd('\\left\\{')) {
      i += 7;
      // 짝 맞추기: 안에 또 {…}' 가 있을 수 있다
      let depth = 1;
      let end = i;
      while (depth > 0) {
        const open = src.indexOf('\\left\\{', end);
        const close = src.indexOf("\\right\\}'", end);
        if (close < 0) return fail(src, '{ } 짝');
        if (open >= 0 && open < close) {
          depth++;
          end = open + 7;
        } else if (--depth > 0) end = close + 9;
        else end = close;
      }
      const inner = texToSym(src.slice(i, end));
      i = end + 9;
      value(`diff(${inner},x)`);
    } else if (cmd('\\log_')) {
      i += 5;
      const base = group();
      if (src[i] !== '(') fail(src, '( 가 와야 함');
      let depth = 0;
      const start = i + 1;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) break;
      }
      const arg = texToSym(src.slice(start, i));
      i++;
      value(`log(${arg}, ${base})`);
    } else if (/^\\(sin|cos|tan|ln)/.test(src.slice(i))) {
      const name = (src.slice(i).match(/^\\(sin|cos|tan|ln)/) as RegExpMatchArray)[1] as string;
      i += name.length + 1;
      // 함수 이름 뒤 ( 는 곱셈이 아니라 인자 — 값이 끝난 것으로 치지 않는다
      value(name === 'ln' ? 'log' : name, false);
    } else if (c === '^') {
      i++;
      out += `**(${group()})`;
      valueEnd = true;
    } else if (/\d/.test(c)) {
      const m = src.slice(i).match(/^\d+(\.\d+)?/) as RegExpMatchArray;
      i += m[0].length;
      value(m[0]);
    } else if (c === 'e') {
      i++;
      value('E');
    } else if (/[a-z]/.test(c)) {
      i++;
      value(c);
    } else if (c === '(') {
      i++;
      value('(', false);
    } else if (c === ')') {
      i++;
      out += ')';
      valueEnd = true;
    } else if (c === '+' || c === '-') {
      i++;
      out += c;
      valueEnd = false;
    } else {
      fail(src, `모르는 TeX '${c}'`);
    }
  }
  return out;
}

// ---- 숫자만 있는 식의 정확한 값 ----

export type Rational = [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};

/** 기약분수로(분모는 양수) */
export function reduce(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new Error('0 으로 나눔');
  const g = gcd(n, d) || 1n;
  const s = d < 0n ? -1n : 1n;
  return [(s * n) / g, (s * d) / g];
}

/** 숫자만 있는 식을 분수로 정확히 계산한다(표 칸 등). 기호·함수·정수가 아닌 지수는 예외 */
export function evalRational(n: Node): Rational {
  switch (n.t) {
    case 'num': {
      const [ip, fp = ''] = n.v.split('.');
      return reduce(BigInt(ip + fp), 10n ** BigInt(fp.length));
    }
    case 'neg': {
      const [a, b] = evalRational(n.a);
      return [-a, b];
    }
    case 'pos':
      return evalRational(n.a);
    case 'add':
    case 'sub':
    case 'mul':
    case 'div': {
      const [a, b] = evalRational(n.a);
      const [c, d] = evalRational(n.b);
      if (n.t === 'add') return reduce(a * d + c * b, b * d);
      if (n.t === 'sub') return reduce(a * d - c * b, b * d);
      if (n.t === 'mul') return reduce(a * c, b * d);
      return reduce(a * d, b * c);
    }
    case 'pow': {
      const [a, b] = evalRational(n.a);
      const [e, ed] = evalRational(n.b);
      if (ed !== 1n) throw new Error('정수가 아닌 지수는 계산하지 않음');
      const k = e < 0n ? -e : e;
      return e < 0n ? reduce(b ** k, a ** k) : reduce(a ** k, b ** k);
    }
    default:
      throw new Error('숫자만 있는 식이 아님');
  }
}

/** 분수 → "a/b"·정수 문자열(검산기와 같은 표기) */
export const ratStr = ([n, d]: Rational) => (d === 1n ? `${n}` : `${n}/${d}`);
