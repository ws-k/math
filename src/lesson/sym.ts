// 계산식(sympy 문법의 작은 부분집합)을 식 구조(나무)로 읽고, 그 구조에서 화면 글자(TeX)를 만든다.
// 예전에는 정규식 치환으로 TeX 를 만들었는데, 2*3*4 → 2×34, x*2 → x2 처럼 구조를 모르는 치환이
// 다른 식을 그려 냈다. 검산한 식과 보이는 식이 같아야 하므로 구조를 거쳐 만든다.
// 연산 우선순위는 파이썬(sympy 가 읽는 방식)을 그대로 따른다: -2*x = (-2)*x, -x**2 = -(x**2), 2**3**2 = 2**(3**2).

/**
 * diff 는 미분한 식(틀린 곳 찾기에서 "{f(x)g(x)}' = …" 을 적으려고). 둘째 인자는 x 이고, 틀린 곳 찾기 식에서만
 * 다른 글자도 된다(매개변수 t — 화면은 d/dt(…). {…}' 에는 무엇으로 미분했는지가 없어서)
 */
export type Fn = 'sqrt' | 'sin' | 'cos' | 'tan' | 'log' | 'Abs' | 'diff';

export type Node =
  | { t: 'num'; v: string }
  | { t: 'var'; v: string }
  | { t: 'const'; v: 'pi' | 'E' }
  | { t: 'neg' | 'pos'; a: Node }
  | { t: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Node; b: Node }
  | { t: 'call'; f: Fn; args: Node[] };

/**
 * 틀린 곳 찾기 식에서만 읽는 기호(sympy 이름 그대로 — 검산기가 같은 글자를 그대로 읽는다).
 * factorial(n) → n! · binomial(n,r) → ₙCᵣ · ff(n,r) → ₙPᵣ(내림 계승) · Sum(몸통,(k,a,b)) → ∑ ·
 * Integral(몸통,x)·Integral(몸통,(x,a,b)) → ∫ · Limit(몸통,x,a[,'+'|'-']) → lim(넷째 인자 없으면 양쪽 극한).
 * 2차(3-바): H(n,r) → ₙHᵣ(중복조합. 검산기가 ₙ₊ᵣ₋₁Cᵣ 로 읽는다) · rad(30) → 30°(sympy 의 rad 는 도를 라디안으로
 * 바꾸는 함수라 sin(rad(30)) 이 그대로 sin 30° 의 값이다 — 이름을 새로 지으면 검산기와 뜻이 갈린다) ·
 * Implies(p,q) → p→q · Not(p) → ~p(명제. 글자나 그 부정끼리만 — 아래 logicOnly).
 * 계산기(expr.ts)·좌표평면은 이 기호를 모른다 — parseSym 은 거부하고 parseSpot 만 읽는다. 허수 I 도 마찬가지.
 */
export type SpotFn =
  | 'factorial'
  | 'binomial'
  | 'ff'
  | 'Sum'
  | 'Integral'
  | 'Limit'
  | 'H'
  | 'rad'
  | 'Implies'
  | 'Not';

/**
 * 틀린 곳 찾기 식의 구조: Node 에 ÷(div 의 obelus)·∞(oo)·SpotFn 을 더한 것. Node 는 이 타입에 그대로 들어간다.
 * ∑·∫·lim 의 묶는 변수와 범위는 args 에 펼쳐 둔다: Sum [몸통, k, a, b] · Integral [몸통, x] 또는 [몸통, x, a, b] ·
 * Limit [몸통, x, a] (+ dir).
 */
export type SpotNode =
  | { t: 'num'; v: string }
  | { t: 'var'; v: string }
  /** I: 허수 단위(sympy 이름 그대로, 화면은 i) */
  | { t: 'const'; v: 'pi' | 'E' | 'oo' | 'I' }
  | { t: 'neg' | 'pos'; a: SpotNode }
  | { t: 'add' | 'sub' | 'mul' | 'pow'; a: SpotNode; b: SpotNode }
  /** obelus: 값은 같은 나눗셈인데 분수 대신 ÷ 로 그린다(분수의 나눗셈 단원은 ÷ 가 보여야 해서) */
  | { t: 'div'; a: SpotNode; b: SpotNode; obelus?: true }
  | { t: 'call'; f: Fn | SpotFn; args: SpotNode[]; dir?: '+' | '-' };

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

/** 틀린 곳 찾기 함수의 인자 수(∑·∫ 의 범위 묶음 (k,a,b) 는 인자 하나로 센다) */
const SPOT_FNS: Record<SpotFn, number[]> = {
  factorial: [1],
  binomial: [2],
  ff: [2],
  Sum: [2],
  Integral: [2],
  Limit: [3, 4],
  H: [2],
  rad: [1],
  Implies: [2],
  Not: [1],
};

const fail = (src: string, why: string): never => {
  throw new Error(`식을 읽을 수 없음(${why}): ${src}`);
};

type Tok = { k: 'num' | 'name' | 'op' | 'str'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  // 'str' 은 Limit 의 방향 '+'·'-' 만(sympy 가 읽는 그대로)
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z]+)|(\*\*|[-+*/(),÷])|'([+-])')/y;
  let i = 0;
  const s = src.replace(/\s+$/, '');
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return fail(src, `모르는 글자 '${s[i]}'`);
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ k: 'num', v: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'name', v: m[2] });
    else if (m[4] !== undefined) out.push({ k: 'str', v: m[4] });
    else out.push({ k: 'op', v: m[3] as string });
  }
  return out;
}

/** 계산식 → 식 구조. 틀린 곳 찾기 기호(÷·∞·C·SpotFn)는 거부한다 — 그래프·표·수직선이 쓰는 식 */
export const parseSym = (src: string): Node => parse(src, false) as Node;

/** 틀린 곳 찾기 식 → 식 구조. parseSym 이 읽는 것에 더해 ÷·∞(oo)·적분상수 C·SpotFn 을 읽는다 */
export const parseSpot = (src: string): SpotNode => parse(src, true);

function parse(src: string, spot: boolean): SpotNode {
  const ts = tokenize(src);
  if (ts.length === 0) fail(src, '빈 식');
  let i = 0;
  const peek = () => ts[i];
  const isOp = (v: string) => peek()?.k === 'op' && peek()?.v === v;
  const eat = (v: string) => {
    if (!isOp(v)) fail(src, `'${v}' 가 와야 함`);
    i++;
  };

  const arith = (): SpotNode => {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const t = (ts[i++] as Tok).v === '+' ? 'add' : 'sub';
      a = { t, a, b: term() };
    }
    return a;
  };
  const term = (): SpotNode => {
    let a = factor();
    while (isOp('*') || isOp('/') || (spot && isOp('÷'))) {
      const op = (ts[i++] as Tok).v;
      // ÷ 는 / 와 같은 자리(파이썬 우선순위·왼쪽부터) — 검산기가 ÷ 를 / 로 바꿔 읽어도 같은 식이 된다
      a =
        op === '*'
          ? { t: 'mul', a, b: factor() }
          : op === '/'
            ? { t: 'div', a, b: factor() }
            : { t: 'div', a, b: factor(), obelus: true };
    }
    return a;
  };
  const factor = (): SpotNode => {
    if (isOp('-') || isOp('+')) {
      const t = (ts[i++] as Tok).v === '-' ? 'neg' : 'pos';
      return { t, a: factor() };
    }
    return power();
  };
  const power = (): SpotNode => {
    const a = atom();
    if (!isOp('**')) return a;
    i++;
    return { t: 'pow', a, b: factor() };
  };
  /** ∑·∫·lim 이 묶는 변수. 식이 오면 화면의 k=1·dx·x→a 가 무엇을 뜻하는지 정할 수 없다 */
  const boundVar = (name: string): SpotNode => {
    const tk = ts[i++];
    if (tk?.k !== 'name' || !VARS.has(tk.v)) return fail(src, `${name} 의 변수는 글자 하나`);
    return { t: 'var', v: tk.v };
  };
  const spotCall = (name: SpotFn): SpotNode => {
    eat('(');
    const args = [arith()];
    let dir: '+' | '-' | undefined;
    if (name === 'Sum' || name === 'Integral') {
      eat(',');
      if (isOp('(')) {
        i++;
        args.push(boundVar(name));
        eat(',');
        args.push(arith());
        eat(',');
        args.push(arith());
        eat(')');
      } else if (name === 'Integral') args.push(boundVar(name));
      else fail(src, 'Sum 은 (k, 시작, 끝) 범위가 있어야 함');
    } else if (name === 'Limit') {
      eat(',');
      args.push(boundVar(name));
      eat(',');
      args.push(arith());
      if (isOp(',')) {
        i++;
        const d = ts[i++];
        if (d?.k !== 'str') return fail(src, "Limit 의 방향은 '+' 나 '-'");
        dir = d.v as '+' | '-';
      }
    } else {
      while (isOp(',')) {
        i++;
        args.push(arith());
      }
      if (!SPOT_FNS[name].includes(args.length)) fail(src, `${name} 인자 수`);
    }
    eat(')');
    // 화면의 \,dx 와 글자 d 가 섞이면 ∫d x dx 처럼 어디까지가 몸통인지 흐려진다
    if (name === 'Integral' && args.some((a) => hasVar(a, 'd')))
      fail(src, '적분에는 글자 d 를 쓰지 않음(dx 와 헷갈림)');
    return dir ? { t: 'call', f: name, args, dir } : { t: 'call', f: name, args };
  };
  const atom = (): SpotNode => {
    const tk = ts[i++];
    if (!tk) return fail(src, '식이 끝나 버림');
    if (tk.k === 'num') return { t: 'num', v: tk.v };
    if (tk.k === 'str') return fail(src, `'${tk.v}' 는 Limit 의 방향 자리에만`);
    if (tk.k === 'op') {
      if (tk.v !== '(') return fail(src, `'${tk.v}' 자리가 이상함`);
      const e = arith();
      eat(')');
      return e;
    }
    const name = tk.v;
    if (name === 'pi' || name === 'E') return { t: 'const', v: name };
    if (spot && name === 'oo') return { t: 'const', v: 'oo' };
    if (spot && name === 'I') return { t: 'const', v: 'I' };
    if (spot && Object.hasOwn(SPOT_FNS, name)) return spotCall(name as SpotFn);
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
      if (name === 'exp') return { t: 'pow', a: { t: 'const', v: 'E' }, b: args[0] as SpotNode };
      // 화면 글자 {…}' 에는 무엇으로 미분했는지가 없다 — x 가 아니면 보이는 식과 검산 식이 달라진다.
      // 틀린 곳 찾기 식은 다른 글자(t)도 받아 d/dt(…) 로 그린다. 글자 d 는 d/dd·d/dt(dt) 처럼 미분 기호와 헷갈려 막는다
      if (name === 'diff') {
        const v = args[1];
        if (v?.t !== 'var' || (v.v !== 'x' && !spot)) fail(src, 'diff 는 x 로만 미분');
        else if (v.v !== 'x' && (v.v === 'd' || hasVar(args[0] as SpotNode, 'd')))
          fail(src, 'd/dt 로 그리는 미분에는 글자 d 를 쓰지 않음');
      }
      return { t: 'call', f: name as Fn, args };
    }
    if (VARS.has(name)) return { t: 'var', v: name };
    // 부정적분의 적분상수. 소문자 c 는 이미 보통 글자라 교과서대로 대문자 C 로 둔다
    if (spot && name === 'C') return { t: 'var', v: 'C' };
    return fail(src, `모르는 이름 ${name}`);
  };

  const e = arith();
  const rest = peek();
  if (rest) {
    // 3x·2(x+1)·(x)(x) 처럼 곱셈 기호를 빼먹은 꼴은 sympy 가 못 읽는다 — 화면만 맞고 검산이 깨지지 않게 거부
    const juxt = rest.k !== 'op' || rest.v === '(';
    fail(src, juxt ? '곱셈은 * 로 적어야 함' : `'${rest.v}' 자리가 이상함`);
  }
  if (spot) logicOnly(e, true, src);
  return e;
}

/**
 * 명제(→·~)는 식 전체로만, 그리고 글자나 그 부정끼리만 잇는다(p→q · ~q→~p). 명제에 수를 더하거나 함수에 넣으면
 * 뜻이 없고, ~~p · p→(q→r) 같은 겹친 꼴은 화면 글자(~·→ 만, 괄호 없음)로 어디까지가 한 명제인지 보일 수 없다
 */
function logicOnly(n: SpotNode, root: boolean, src: string) {
  if (n.t === 'call' && n.f === 'Implies') {
    if (!root) fail(src, '명제(→)는 식 전체로만');
    for (const a of n.args)
      if (!(a.t === 'var' || (a.t === 'call' && a.f === 'Not' && a.args[0]?.t === 'var')))
        fail(src, '→ 의 양쪽은 글자나 그 부정(~p)');
    return;
  }
  if (n.t === 'call' && n.f === 'Not') {
    if (!root) fail(src, '명제(~)는 식 전체나 → 의 한쪽으로만');
    if (n.args[0]?.t !== 'var') fail(src, '~ 는 글자 하나에만');
    return;
  }
  if (n.t === 'call') for (const a of n.args) logicOnly(a, false, src);
  else if ('a' in n) {
    logicOnly(n.a, false, src);
    if ('b' in n) logicOnly(n.b, false, src);
  }
}

/** 틀린 곳 찾기 식 하나가 명제(Implies·Not)인가. 명제끼리의 = 는 화면에 ⇔(참·거짓이 늘 같음)로 보인다 */
export function isLogicSpot(sym: string): boolean {
  const n = parseSpot(sym);
  return n.t === 'call' && (n.f === 'Implies' || n.f === 'Not');
}

/** 틀린 곳 찾기 식에 허수 i 가 있는가. 복소수는 크기를 견줄 수 없고 실수 해 집합으로도 다룰 수 없어 형식 검사가 본다 */
export function hasImag(sym: string): boolean {
  const walk = (n: SpotNode): boolean =>
    n.t === 'const'
      ? n.v === 'I'
      : n.t === 'call'
        ? n.args.some(walk)
        : 'a' in n && (walk(n.a) || ('b' in n && walk(n.b)));
  return walk(parseSpot(sym));
}

// ---- 구조 → TeX ----

const paren = (s: string) => `(${s})`;
const signed = (s: string) => /^[-+]/.test(s);

const isObelus = (n: SpotNode) => n.t === 'div' && n.obelus === true;
const isSpotFn = (n: SpotNode) => n.t === 'call' && Object.hasOwn(SPOT_FNS, n.f);

/**
 * 오른쪽 끝이 ∑·lim 의 몸통으로 끝나는가. 교과서 관례로 몸통은 덧셈·뺄셈에서 끊기지만(∑k+n = (∑k)+n)
 * 곱셈·÷ 는 몸통에 붙어 읽힌다(∑k×2 = ∑(k×2)) — 그래서 이런 식이 곱셈·÷ 왼쪽에 오면 괄호로 묶는다.
 * 괄호로 이미 묶인 경우까지 참이라고 해도 괄호가 하나 더 생길 뿐 다른 식이 되지는 않는다.
 */
const openTail = (n: SpotNode): boolean => {
  if (n.t === 'call') return n.f === 'Sum' || n.f === 'Limit';
  if (n.t === 'neg' || n.t === 'pos') return openTail(n.a);
  if (n.t === 'mul' || (n.t === 'div' && n.obelus)) return openTail(n.b);
  return false;
};

/** ∑·∫·lim 의 몸통: 덧셈·뺄셈·부호로 시작하면 괄호(어디까지가 몸통인지 보이게) */
const body = (n: SpotNode) => {
  const s = tex(n);
  return n.t === 'add' || n.t === 'sub' || signed(s) ? paren(s) : s;
};

function spotCallTex(n: Extract<SpotNode, { t: 'call' }>): string {
  const [a, v, lo, hi] = n.args.map(tex) as [string, string, string?, string?];
  const arg0 = n.args[0] as SpotNode;
  switch (n.f) {
    case 'factorial': {
      const atomic = arg0.t === 'num' || arg0.t === 'var';
      return `${atomic ? a : paren(a)}!`;
    }
    case 'binomial':
    case 'ff':
    case 'H':
      // 교과서 표기 ₙCᵣ·ₙPᵣ·ₙHᵣ — 왼쪽 아래 첨자는 빈 묶음 {} 에 붙인다
      return `{}_{${a}}\\mathrm{${n.f === 'binomial' ? 'C' : n.f === 'ff' ? 'P' : 'H'}}_{${v}}`;
    case 'rad': {
      // 도(°)는 n! 처럼 바로 앞 값에 붙는다 — 식이면 괄호로 묶어 어디까지가 각인지 보이게
      const atomic = arg0.t === 'num' || arg0.t === 'var';
      return `${atomic ? a : paren(a)}^{\\circ}`;
    }
    case 'Implies':
      return `${a}\\to${v.startsWith('\\') ? '' : ' '}${v}`;
    case 'Not':
      return `\\sim ${a}`;
    case 'Sum':
      return `\\sum_{${v}=${lo}}^{${hi}}${body(arg0)}`;
    case 'Integral':
      // 몸통 끝을 dx 가 닫으므로 덧셈 몸통만 괄호. 부정적분은 \int 뒤 글자가 명령 이름에 붙지 않게 한 칸
      return `${lo === undefined ? '\\int ' : `\\int_{${lo}}^{${hi}}`}${body(arg0)}\\,d${v}`;
    case 'Limit': {
      const at = `${lo}${n.dir ?? ''}`;
      return `\\lim_{${v}\\to${at.startsWith('\\') ? '' : ' '}${at}}${body(arg0)}`;
    }
  }
  return fail(n.f, '모르는 함수');
}

/**
 * 곱셈·÷ 오른쪽 자리의 글자: 덧셈·뺄셈·곱셈·÷·부호로 시작하는 식은 괄호로 묶는다(2×(x+1), 6÷(2×3), 3×(−2)).
 * 분수는 칸이 묶어 주어 그대로. 틀린 곳 찾기의 ×·÷ 조각 토큰(*(x+2))도 같은 규칙으로 그린다(format.ts tokenTex)
 */
function operandTex(n: SpotNode): string {
  const s = tex(n);
  return ['add', 'sub', 'mul'].includes(n.t) || isObelus(n) || signed(s) ? paren(s) : s;
}

/** 이 곱셈·÷ 는 숨기지 않고 기호를 보인다(앞 토큰에 이어지는 조각을 그릴 때) */
const showOp = new WeakSet<SpotNode>();
const HOLE = '\\square';

/**
 * 앞 식에 +·−·×·÷ 로 이어지는 토큰 조각(+7*4/2 · *(x+2) · ÷2 · *3*2*3)의 글자. 앞 식 자리에 빈칸을 둔 식(□×조각)을 식 전체와
 * 같은 규칙으로 그린 뒤 빈칸을 뗀다 — 바로 뒤 인수는 곱셈·÷ 오른쪽 자리 괄호 규칙을 받고, 그 뒤 연산은 이어 붙인
 * 식에서처럼 왼쪽부터 이어진다. 조각만 따로 그려 괄호를 떼거나(3 ×x+2 로 보이던 *(x+2)) 통째로 묶으면(×(3×2×3))
 * 이어 붙인 식과 다르게 보인다. 빈칸 뒤가 이 꼴로 시작하지 않으면(앞 식째 괄호로 묶여야 하는 ∑ 등) 예외
 */
export function spotContinuationTex(op: '+' | '-' | '*' | '÷', sym: string): string {
  const root = parseSpot(`q${op}${sym}`);
  // 빈칸 q 와 바로 붙은 마디를 찾는다(왼쪽 가지를 따라 내려감). 곱셈이면 기호를 보이게 한다
  let n: SpotNode = root;
  while ((n.t === 'add' || n.t === 'sub' || n.t === 'mul' || n.t === 'div') && n.a.t !== 'var')
    n = n.a;
  if (
    !(n.t === 'add' || n.t === 'sub' || n.t === 'mul' || n.t === 'div') ||
    n.a.t !== 'var' ||
    n.a.v !== 'q'
  )
    return fail(sym, '이어지는 조각 꼴');
  n.a = { t: 'var', v: HOLE };
  showOp.add(n);
  const t = tex(root);
  const head = `${HOLE}${op === '*' ? '\\times' : op === '÷' ? '\\div' : op}`;
  if (!t.startsWith(head)) return fail(sym, '앞 토큰과 이어 그릴 수 없는 조각 — 앞 토큰과 합치기');
  return t.slice(HOLE.length);
}

/** 식에 남는 글자들. ∑·∫·lim 이 묶은 글자(∑ 의 k, ∫ 의 x)는 그 안에서만 쓰이므로 뺀다 */
export function spotFreeVars(n: SpotNode, out = new Set<string>()): Set<string> {
  if (n.t === 'var') out.add(n.v);
  else if (n.t === 'call') {
    const bound = n.f === 'Sum' || n.f === 'Integral' || n.f === 'Limit';
    if (!bound) for (const a of n.args) spotFreeVars(a, out);
    else {
      const [body, v, ...rest] = n.args as [SpotNode, SpotNode, ...SpotNode[]];
      const inner = spotFreeVars(body);
      if (v.t === 'var') inner.delete(v.v);
      for (const x of inner) out.add(x);
      for (const r of rest) spotFreeVars(r, out);
    }
  } else if ('a' in n) {
    spotFreeVars(n.a, out);
    if ('b' in n) spotFreeVars(n.b, out);
  }
  return out;
}

const hasVar = (n: SpotNode, v: string): boolean =>
  n.t === 'var'
    ? n.v === v
    : n.t === 'call'
      ? n.args.some((a) => hasVar(a, v))
      : 'a' in n && (hasVar(n.a, v) || ('b' in n && hasVar(n.b, v)));

function tex(n: SpotNode): string {
  switch (n.t) {
    case 'num':
    case 'var':
      return n.v;
    case 'const':
      return n.v === 'pi' ? '\\pi' : n.v === 'oo' ? '\\infty' : n.v === 'I' ? 'i' : 'e';
    case 'call': {
      if (isSpotFn(n)) return spotCallTex(n);
      const [a, b] = n.args.map(tex) as [string, string | undefined];
      if (n.f === 'sqrt') return `\\sqrt{${a}}`;
      if (n.f === 'Abs') return `\\left|${a}\\right|`;
      if (n.f === 'diff')
        return b === 'x' ? `\\left\\{${a}\\right\\}'` : `\\frac{d}{d${b}}\\left(${a}\\right)`;
      if (n.f === 'log') return b === undefined ? `\\ln(${a})` : `\\log_{${b}}(${a})`;
      return `\\${n.f}(${a})`;
    }
    case 'neg':
    case 'pos': {
      const s = tex(n.a);
      // -(2*x) 를 -2x 로 그리면 (-2)*x 로 읽힌다 — 값은 같아도 다른 식이라 괄호로 구조를 지킨다
      const wrap = ['add', 'sub', 'mul'].includes(n.a.t) || isObelus(n.a) || signed(s);
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
      const l = n.a.t === 'add' || n.a.t === 'sub' || openTail(n.a) ? paren(l0) : l0;
      const r = operandTex(n.b);
      // 숫자가 뒤따르면(2×3, x×2) 붙여 쓰면 다른 수가 되고, 분수가 뒤따르면(2⅓) 대분수로 읽혀 ×를 보인다.
      // ₙCᵣ 가 뒤따르면 앞 수와 아래 첨자가 붙어 26C3 처럼 보여 × 를 보인다.
      // ÷ 뒤에 붙여 쓰면 6÷2x 가 6÷(2x) 로 읽히고, ∫…dx 뒤에 붙여 쓰면 dx x 로 이어져 × 를 보인다
      const times =
        /^[\d.]/.test(r) ||
        r.startsWith('\\frac') ||
        r.startsWith('{}_') ||
        // 음수가 뒤따르면(−2×(−3)) 괄호만으로는 곱셈이 잘 안 보인다
        /^\([-+]/.test(r) ||
        isObelus(n.a) ||
        showOp.has(n) ||
        /\\,d[a-zA-Z]$/.test(l);
      const sep = times ? '\\times ' : /\\[a-z]+$/.test(l) ? ' ' : '';
      return times && /^[\\({]/.test(r) ? `${l}\\times${r}` : l + sep + r;
    }
    case 'div': {
      if (!n.obelus) return `\\frac{${tex(n.a)}}{${tex(n.b)}}`;
      // 왼쪽부터 계산하므로 왼쪽은 곱셈·÷ 를 그대로 두고, 오른쪽은 곱셈·÷ 도 괄호(6÷(2×3) ≠ 6÷2×3). 분수는 칸이 묶어 준다
      const l0 = tex(n.a);
      const l = n.a.t === 'add' || n.a.t === 'sub' || openTail(n.a) ? paren(l0) : l0;
      const r = operandTex(n.b);
      return /^[\\(]/.test(r) ? `${l}\\div${r}` : `${l}\\div ${r}`;
    }
    case 'pow': {
      const atomBase = n.a.t === 'num' || n.a.t === 'var' || n.a.t === 'const';
      // 함수 호출은 sin(x)^2 처럼 괄호 없이 — 다만 n!·ₙCᵣ·∑ 에 지수를 붙이면 어디에 붙는지 흐려 괄호
      const callBase = n.a.t === 'call' && !isSpotFn(n.a);
      const b = tex(n.a);
      return `${atomBase || callBase ? b : paren(b)}^{${tex(n.b)}}`;
    }
  }
}

/** 계산식 → KaTeX 글자. 지원하지 않는 꼴은 예외 */
export const symToTex = (sym: string): string => tex(parseSym(sym));

/** 틀린 곳 찾기 식 → KaTeX 글자. symToTex 가 읽는 식은 같은 글자로, 거기에 ÷·∞·C·SpotFn 을 더 읽는다 */
export const spotTex = (sym: string): string => tex(parseSpot(sym));

// ---- TeX → 계산식 (왕복 검사용) ----

/**
 * symToTex·spotTex 가 만든 TeX 에서 기호를 걷어 계산식으로 되돌린다. 숨긴 곱셈은 * 로 되살린다.
 * 이 왕복이 원래 식 구조와 같아야 "보이는 식 = 검산한 식"이다(테스트가 확인한다).
 */
export function texToSym(src: string): string {
  let i = 0;
  let out = '';
  /** 직전에 끝난 것이 값(숫자·글자·닫는 괄호)인가 — 그 뒤에 값이 오면 숨긴 곱셈 */
  let valueEnd = false;
  /** out 안에서 가장 최근 값이 시작한 자리. n! 의 ! 가 어느 값에 붙는지 찾는다 */
  let lastValue = 0;
  /** 아직 닫히지 않은 ( 의 out 안 자리 */
  const opens: number[] = [];
  /** → 를 만나 Implies( 로 열어 둔 것(글 끝에서 닫는다) */
  let implies = false;
  const rawGroup = (): string => {
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
    return g;
  };
  const group = (): string => texToSym(rawGroup());
  /**
   * ∑·lim 몸통의 끝: 같은 깊이의 덧셈·뺄셈, 짝 없는 닫는 괄호, 글 끝(spotTex 가 곱셈이 뒤따르는 몸통은 괄호로 묶어 둔다).
   * |…| 와 { } ( ) 안의 부호는 몸통을 끊지 않는다
   */
  const tailEnd = (from: number): number => {
    let depth = 0;
    for (let j = from; j < src.length; j++) {
      const ch = src[j];
      if (src.startsWith('\\left', j)) depth++;
      else if (src.startsWith('\\right', j)) depth--;
      else if (ch === '{' || ch === '(') depth++;
      else if (ch === '}' || ch === ')') {
        if (depth === 0) return j;
        depth--;
      } else if ((ch === '+' || ch === '-') && depth === 0 && j > from) return j;
    }
    return src.length;
  };
  /** ∫ 몸통의 끝: 짝이 맞는 \,d(안쪽 ∫ 의 \,d 는 건너뛴다) */
  const intEnd = (from: number): number => {
    let open = 1;
    for (let j = from; j < src.length; j++) {
      if (src.startsWith('\\int', j)) open++;
      else if (src.startsWith('\\,d', j) && --open === 0) return j;
    }
    return fail(src, '∫ 에 짝이 되는 d 가 없음');
  };
  const value = (s: string, end = true) => {
    if (valueEnd) out += '*';
    lastValue = out.length;
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
    } else if (cmd('\\div')) {
      i += 4;
      out += '÷';
      valueEnd = false;
    } else if (cmd('\\infty')) {
      i += 6;
      value('oo');
    } else if (c === '!') {
      // ! 는 바로 앞 값(글자·수·괄호 묶음)에 붙는다 — spotTex 는 그보다 큰 식이면 괄호로 묶어 둔다
      i++;
      out = `${out.slice(0, lastValue)}factorial(${out.slice(lastValue)})`;
      valueEnd = true;
    } else if (cmd('{}_')) {
      i += 3;
      const n = group();
      const m = /^\\mathrm\{([CPH])\}_/.exec(src.slice(i));
      if (!m) return fail(src, 'ₙCᵣ·ₙPᵣ·ₙHᵣ 꼴이 아님');
      i += m[0].length;
      const r = group();
      value(`${m[1] === 'C' ? 'binomial' : m[1] === 'P' ? 'ff' : 'H'}(${n},${r})`);
    } else if (cmd('\\sum_')) {
      i += 5;
      const m = /^([a-z])=(.*)$/s.exec(rawGroup());
      if (!m || src[i] !== '^') return fail(src, '∑ 범위 꼴');
      i++;
      const hi = group();
      const end = tailEnd(i);
      const b = texToSym(src.slice(i, end));
      i = end;
      value(`Sum(${b},(${m[1]},${texToSym(m[2] as string)},${hi}))`);
    } else if (cmd('\\lim_')) {
      i += 5;
      const m = /^([a-z])\\to\s*(.*?)([+-]?)$/s.exec(rawGroup());
      if (!m) return fail(src, 'lim 아래 꼴');
      const end = tailEnd(i);
      const b = texToSym(src.slice(i, end));
      i = end;
      const dir = m[3] ? `,'${m[3]}'` : '';
      value(`Limit(${b},${m[1]},${texToSym(m[2] as string)}${dir})`);
    } else if (cmd('\\int')) {
      i += 4;
      let range = '';
      if (src[i] === '_') {
        i++;
        const lo = group();
        if (src[i] !== '^') return fail(src, '∫ 범위 꼴');
        i++;
        range = `${lo},${group()}`;
      }
      const end = intEnd(i);
      const b = texToSym(src.slice(i, end));
      const v = src[end + 3] as string;
      i = end + 4;
      value(range ? `Integral(${b},(${v},${range}))` : `Integral(${b},${v})`);
    } else if (/^\\frac\{d\}\{d[a-z]\}\\left\(/.test(src.slice(i))) {
      // d/dt(…): 미분할 글자 뒤 \left( 와 짝이 되는 \right) 까지가 몸통(안에 d/dt 가 또 있을 수 있다)
      const v = src[i + 10] as string;
      i += 18;
      let depth = 1;
      let end = i;
      while (depth > 0) {
        const open = src.indexOf('\\left(', end);
        const close = src.indexOf('\\right)', end);
        if (close < 0) return fail(src, 'd/dt ( ) 짝');
        if (open >= 0 && open < close) {
          depth++;
          end = open + 6;
        } else if (--depth > 0) end = close + 7;
        else end = close;
      }
      const inner = texToSym(src.slice(i, end));
      i = end + 7;
      value(`diff(${inner},${v})`);
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
    } else if (cmd('^{\\circ}')) {
      // ° 는 ! 처럼 바로 앞 값에 붙는다(spotTex 는 그보다 큰 식이면 괄호로 묶어 둔다)
      i += 8;
      out = `${out.slice(0, lastValue)}rad(${out.slice(lastValue)})`;
      valueEnd = true;
    } else if (c === '^') {
      i++;
      out += `**(${group()})`;
      valueEnd = true;
    } else if (cmd('\\sim')) {
      // ~p: 글자 하나의 부정만 그린다(sym.ts logicOnly)
      i += 4;
      while (src[i] === ' ') i++;
      const v = src[i++] as string;
      if (!/[a-z]/.test(v)) return fail(src, '~ 뒤에는 글자 하나');
      value(`Not(${v})`);
    } else if (cmd('\\to')) {
      // p→q: 명제는 식 전체로만 쓰여(logicOnly) → 는 많아야 하나 — 앞까지를 첫 인자로 묶고 글 끝에서 닫는다
      i += 3;
      if (implies) return fail(src, '→ 가 둘 이상');
      out = `Implies(${out},`;
      implies = true;
      valueEnd = false;
    } else if (/\d/.test(c)) {
      const m = src.slice(i).match(/^\d+(\.\d+)?/) as RegExpMatchArray;
      i += m[0].length;
      value(m[0]);
    } else if (c === 'e') {
      i++;
      value('E');
    } else if (c === 'i') {
      // 글자 i 는 허수 단위뿐이다(보통 글자 목록 VARS 에 없다)
      i++;
      value('I');
    } else if (/[a-zC]/.test(c)) {
      i++;
      value(c);
    } else if (c === '(') {
      i++;
      value('(', false);
      opens.push(lastValue);
    } else if (c === ')') {
      i++;
      out += ')';
      // 닫는 괄호로 끝난 값은 여는 괄호부터 — (n+1)! 의 ! 가 1 이 아니라 묶음 전체에 붙게
      lastValue = opens.pop() ?? fail(src, '( ) 짝');
      valueEnd = true;
    } else if (c === '+' || c === '-') {
      i++;
      out += c;
      valueEnd = false;
    } else {
      fail(src, `모르는 TeX '${c}'`);
    }
  }
  return implies ? `${out})` : out;
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
