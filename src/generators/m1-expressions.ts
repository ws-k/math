import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { paren, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'm1-expressions';

const CONCEPT_VALUE = '식의 값: 문자 자리에 수를 넣어(대입해) 계산한 결과예요.';
const CONCEPT_NEG = '음수를 대입할 때는 괄호를 씌워요. $-3^2$ 와 $(-3)^2$ 은 다른 수예요.';
const CONCEPT_LIKE =
  '동류항: 문자와 차수가 같은 항. 동류항끼리만 계수를 더하거나 빼서 하나로 모아요.';
const CONCEPT_DIST = '분배법칙: $a(b+c)=ab+ac$. 괄호 앞의 수는 괄호 안의 모든 항에 곱해요.';

/** 0 이 아닌 lo~hi 크기의 정수, 부호는 무작위 */
function signed(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
}

/**
 * 항 목록 → 부호가 붙은 글자. 맨 앞 항의 + 는 뗀다.
 * 동류항 문제는 "3x-5-7x+2" 처럼 항이 섞인 순서 그대로 보여야 해서 polyTex(차수순 정리)를 쓸 수 없다.
 */
interface Term {
  c: number;
  x: boolean;
}
function termsTex(ts: Term[]): string {
  return ts
    .map((t, i) => {
      const sign = t.c < 0 ? '-' : i === 0 ? '' : '+';
      const a = Math.abs(t.c);
      return sign + (t.x ? (a === 1 ? 'x' : `${a}x`) : String(a));
    })
    .join('');
}
function termsSym(ts: Term[]): string {
  return ts
    .map((t, i) => {
      const body = t.x ? `${Math.abs(t.c)}*x` : String(Math.abs(t.c));
      if (i === 0) return (t.c < 0 ? '-' : '') + body;
      return (t.c < 0 ? ' - ' : ' + ') + body;
    })
    .join('');
}

/** 계수 배열의 각 항에 x=v 를 넣은 모양: "2\times(-3)^2-5\times(-3)+1" */
function substTex(coeffs: number[], v: number): string {
  const deg = coeffs.length - 1;
  const pv = paren(v);
  return coeffs
    .map((c, i) => ({ c, e: deg - i }))
    .filter((t) => t.c !== 0)
    .map(({ c, e }, i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      const a = Math.abs(c);
      if (e === 0) return sign + a;
      const pow = e === 1 ? pv : `${pv}^${e}`;
      return sign + (a === 1 ? pow : `${a}\\times ${pow}`);
    })
    .join('');
}

/** 항마다 계산한 값을 이어 쓴 모양: "18+15+1" */
function termValuesTex(coeffs: number[], v: number): string {
  const deg = coeffs.length - 1;
  return coeffs
    .map((c, i) => c * v ** (deg - i))
    .filter((_, i) => coeffs[i] !== 0)
    .map((n, i) => (n < 0 ? `-${-n}` : i === 0 ? String(n) : `+${n}`))
    .join('');
}

export const generators: Generator[] = [
  {
    id: 'expr-value',
    unitId: UNIT,
    title: '식의 값 구하기',
    make(rng) {
      const v = signed(rng, 1, 5);
      // 다섯 중 둘은 x² 항이 있는 식 — 음수의 제곱에서 괄호를 빼먹는 실수를 연습하려고
      const quad = rng.next() < 0.4;
      let coeffs: number[];
      do {
        coeffs = quad
          ? [signed(rng, 1, 3), signed(rng, 1, 7), rng.int(-9, 9)]
          : [signed(rng, 2, 9), signed(rng, 1, 12)];
      } while (Math.abs(polyEval(coeffs, v)) > 80);
      const value = polyEval(coeffs, v);
      const negSquare = quad && v < 0;
      return {
        q: `$x=${v}$일 때, 식 $${polyTex(coeffs)}$의 값을 구하세요.`,
        choices: null,
        answer: String(value),
        answerType: 'int',
        check: `(${polySym(coeffs)}).subs(x, ${v})`,
        concepts: v < 0 ? [CONCEPT_VALUE, CONCEPT_NEG] : [CONCEPT_VALUE],
        steps: [
          {
            title: '$x$ 자리에 수 넣기',
            body: `${
              v < 0
                ? '음수를 넣으니 괄호를 씌워요. 생략했던 곱하기 기호도 다시 살려 써요.'
                : '생략했던 곱하기 기호를 다시 살려 써요.'
            }\n$$${substTex(coeffs, v)}$$`,
          },
          {
            title: '곱셈부터 계산하기',
            body: `${quad ? '거듭제곱, 곱셈 순서로 계산해요.' : '곱셈을 먼저 해요.'}\n$$${termValuesTex(coeffs, v)}$$`,
          },
          {
            title: '더하고 빼기',
            body: `$$${termValuesTex(coeffs, v)}=${value}$$`,
          },
        ],
        tip: negSquare
          ? `$(${v})^2=${v * v}$ 이에요. 괄호 없이 $${v}^2$ 이라고 쓰면 $-${v * v}$ 으로 읽혀서 답이 달라져요.`
          : '대입하기 전에 곱하기 기호를 살려 쓰면, $2x$ 에 $x=3$ 을 넣고 $23$ 으로 읽는 실수를 막을 수 있어요.',
      };
    },
  },
  {
    id: 'expr-like-terms',
    unitId: UNIT,
    title: '동류항 모아 간단히 하기',
    make(rng) {
      let p: number;
      let r: number;
      let q: number;
      let s: number;
      do {
        p = signed(rng, 1, 9);
        r = signed(rng, 1, 9);
        q = signed(rng, 1, 12);
        s = signed(rng, 1, 12);
      } while (p + r === 0 || q + s === 0 || p + r + q + s === 0);
      // 항이 섞여 있어야 "동류항끼리 모으기"가 의미 있다 — 순서는 세 가지 중 하나
      const orders: Term[][] = [
        [
          { c: p, x: true },
          { c: q, x: false },
          { c: r, x: true },
          { c: s, x: false },
        ],
        [
          { c: q, x: false },
          { c: p, x: true },
          { c: s, x: false },
          { c: r, x: true },
        ],
        [
          { c: p, x: true },
          { c: q, x: false },
          { c: s, x: false },
          { c: r, x: true },
        ],
      ];
      const ts = rng.pick(orders);
      const a = p + r;
      const b = q + s;
      const xs = termsTex([
        { c: p, x: true },
        { c: r, x: true },
      ]);
      const cs = termsTex([
        { c: q, x: false },
        { c: s, x: false },
      ]);
      return {
        q: `식 $${termsTex(ts)}$을 간단히 하면 $ax+b$ 꼴이 돼요. $a+b$의 값을 구하세요.`,
        choices: null,
        answer: String(a + b),
        answerType: 'int',
        check: `f = expand(${termsSym(ts)})\nans = f.coeff(x, 1) + f.coeff(x, 0)`,
        concepts: [CONCEPT_LIKE],
        steps: [
          {
            title: '동류항끼리 모으기',
            body: `$x$가 붙은 항끼리, 숫자만 있는 항끼리 묶어요. 부호는 항에 붙여서 함께 옮겨요.\n$$(${xs})+(${cs})$$`,
          },
          {
            title: '계수끼리 계산하기',
            body: `$x$ 항은 계수끼리 계산해요.\n$$${polyTex([a, b])}$$`,
          },
          {
            title: '$a+b$ 구하기',
            body: `$a=${a}$, $b=${b}$ 이므로\n$$a+b=${a}${b < 0 ? '' : '+'}${b}=${a + b}$$`,
          },
        ],
        tip: '$x$ 항과 숫자 항은 서로 더할 수 없어요. $3x+2$ 는 그 자체로 끝까지 간단히 한 식이에요.',
      };
    },
  },
  {
    id: 'expr-paren',
    unitId: UNIT,
    title: '괄호가 있는 일차식 계산',
    make(rng) {
      let k: number;
      let m: number;
      let a: number;
      let b: number;
      let c: number;
      let d: number;
      do {
        k = rng.int(2, 5);
        m = signed(rng, 2, 5);
        a = signed(rng, 1, 5);
        b = signed(rng, 1, 9);
        c = signed(rng, 1, 5);
        d = signed(rng, 1, 9);
      } while (k * a + m * c === 0 || k * b + m * d === 0);
      const A = k * a + m * c;
      const B = k * b + m * d;
      const askX = rng.next() < 0.5;
      const exprTex = `${k}(${polyTex([a, b])})${m < 0 ? '-' : '+'}${Math.abs(m)}(${polyTex([c, d])})`;
      const exprSym = `${k}*(${polySym([a, b])}) + (${m})*(${polySym([c, d])})`;
      const expanded = termsTex([
        { c: k * a, x: true },
        { c: k * b, x: false },
        { c: m * c, x: true },
        { c: m * d, x: false },
      ]);
      return {
        q: `식 $${exprTex}$을 간단히 했을 때, ${askX ? '$x$의 계수' : '상수항'}를 구하세요.`,
        choices: null,
        answer: String(askX ? A : B),
        answerType: 'int',
        check: `expand(${exprSym}).coeff(x, ${askX ? 1 : 0})`,
        concepts: [CONCEPT_DIST, CONCEPT_LIKE],
        steps: [
          {
            title: '괄호 풀기',
            body: `괄호 앞의 수를 안의 두 항에 모두 곱해요.${m < 0 ? ` 뒤쪽은 $${m}$ 을 곱하니 두 항의 부호가 모두 바뀌어요.` : ''}\n$$${expanded}$$`,
          },
          {
            title: '동류항끼리 모으기',
            body: `$x$ 항끼리, 숫자 항끼리 계산해요.\n$$${polyTex([A, B])}$$`,
          },
          {
            title: askX ? '$x$의 계수 읽기' : '상수항 읽기',
            body: askX
              ? `$x$ 앞에 곱해진 수가 계수예요. 답은 $${A}$ 이에요.`
              : `숫자만 있는 항이 상수항이에요. 부호까지 포함해서 $${B}$ 이에요.`,
          },
        ],
        tip:
          m < 0
            ? '괄호 앞이 음수이면 뒤쪽 항의 부호도 바뀌어요. 첫 항에만 곱하고 끝내는 실수가 가장 흔해요.'
            : '분배법칙은 괄호 안의 항 개수만큼 곱셈이 생겨요. 곱한 횟수를 세어 보면 빠뜨린 항을 찾을 수 있어요.',
      };
    },
  },
];
