import type { Generator } from './types.ts';
import { jo, paren, polyMul, polySym, polyTex } from './util.ts';

const UNIT = 'h1-poly-ops';

// 다항식은 계수 배열(높은 차수부터)로만 들고 다닌다. 문제 글(polyTex)과 검산식(polySym)을 같은 배열에서
// 만들어, 화면의 식과 sympy 가 계산하는 식이 어긋나지 않게 한다.

/** x-a 의 TeX. a 가 음수면 x+|a| */
export const linTex = (a: number) => `x${a < 0 ? '+' : '-'}${Math.abs(a)}`;

const CUBE = '곱셈 공식: $(a+b)^3=a^3+3a^2b+3ab^2+b^3$';
const DIV = '다항식의 나눗셈: $A=BQ+R$ (나머지 $R$의 차수는 나누는 식 $B$보다 낮아요)';

export const generators: Generator[] = [
  {
    id: 'poly-cube-expand',
    unitId: UNIT,
    title: '세제곱 곱셈 공식으로 계수 구하기',
    make(rng) {
      const a = rng.int(1, 3);
      const b = rng.nonzero(-4, 4);
      const k = rng.pick([1, 2] as const);
      const base = polyTex([a, b]);
      // (ax+b)^3 의 x^2 계수 3a^2b, x 계수 3ab^2 — 공식의 둘째·셋째 항
      const coef = k === 2 ? 3 * a * a * b : 3 * a * b * b;
      const ax = a === 1 ? 'x' : `${a}x`;
      const term =
        k === 2
          ? `3\\times(${ax})^2\\times${paren(b)}=${polyTex([coef, 0, 0])}`
          : `3\\times ${ax}\\times${paren(b)}^2=${polyTex([coef, 0])}`;
      return {
        q: `다음 식을 전개했을 때 $${k === 2 ? 'x^2' : 'x'}$의 계수를 구하세요.\n$$(${base})^3$$`,
        choices: null,
        answer: String(coef),
        answerType: 'int',
        check: `expand((${polySym([a, b])})**3).coeff(x, ${k})`,
        concepts: [CUBE],
        steps: [
          {
            title: '공식의 $a$, $b$ 정하기',
            body: `$(a+b)^3$ 에서 $a=${ax}$, $b=${b}$ ${jo(String(b), '으로/로')} 놓아요.`,
          },
          {
            title: `$${k === 2 ? 'x^2' : 'x'}$이 나오는 항 고르기`,
            body: `$${k === 2 ? '3a^2b' : '3ab^2'}$ 항이에요.\n$$${term}$$`,
          },
          {
            title: '계수 읽기',
            body: `$${k === 2 ? 'x^2' : 'x'}$ 앞의 수는 $${coef}$ ${jo(String(coef), '이에요/예요')}.`,
          },
        ],
        tip: `$(a+b)^3$ 을 $a^3+b^3$ 으로 쓰면 가운데 두 항이 빠져요. 가운데 계수 $3$ 과 ${b < 0 ? '$b$ 의 부호' : '$b$ 의 거듭제곱'}도 빠뜨리지 않아요.`,
      };
    },
  },
  {
    id: 'poly-mul-coef',
    unitId: UNIT,
    title: '다항식의 곱셈에서 계수 구하기',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-5, 5);
        const q = rng.nonzero(-6, 6);
        const r = rng.int(2, 3);
        const s = rng.nonzero(-5, 5);
        const k = rng.pick([1, 2] as const);
        const A = [1, p, q];
        const B = [r, s];
        const prod = polyMul(A, B);
        const coef = prod[3 - k] as number;
        if (coef === 0) continue;
        // x^2 은 x^2·s 와 px·rx 에서, x 는 px·s 와 q·rx 에서 나온다
        const pairs =
          k === 2
            ? `x^2\\times${paren(s)}+${paren(p)}x\\times ${r}x=${polyTex([s, 0, 0])}${polyTex([p * r, 0, 0]).startsWith('-') ? '' : '+'}${polyTex([p * r, 0, 0])}`
            : `${paren(p)}x\\times${paren(s)}+${paren(q)}\\times ${r}x=${polyTex([p * s, 0])}${polyTex([q * r, 0]).startsWith('-') ? '' : '+'}${polyTex([q * r, 0])}`;
        return {
          q: `다음 식을 전개했을 때 $${k === 2 ? 'x^2' : 'x'}$의 계수를 구하세요.\n$$(${polyTex(A)})(${polyTex(B)})$$`,
          choices: null,
          answer: String(coef),
          answerType: 'int',
          check: `expand((${polySym(A)})*(${polySym(B)})).coeff(x, ${k})`,
          concepts: [
            '분배법칙: 앞 괄호의 각 항을 뒤 괄호의 **모든** 항에 곱해요.',
            '필요한 차수의 항만 골라 곱하면 전부 전개하지 않아도 돼요.',
          ],
          steps: [
            {
              title: `$${k === 2 ? 'x^2' : 'x'}$이 나오는 짝 찾기`,
              body:
                k === 2
                  ? '(이차항 × 상수항), (일차항 × 일차항) 두 짝이에요.'
                  : '(일차항 × 상수항), (상수항 × 일차항) 두 짝이에요.',
            },
            { title: '짝마다 곱하기', body: `$$${pairs}$$` },
            { title: '계수 더하기', body: `$$${polyTex([coef, ...new Array(k).fill(0)])}$$` },
          ],
          tip: '모두 전개해서 동류항을 모아도 같아요. 한 짝을 빠뜨리는 실수가 가장 많아요.',
        };
      }
    },
  },
  {
    id: 'poly-div-rem',
    unitId: UNIT,
    title: '다항식의 나눗셈: 몫과 나머지',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-3, 3);
        const p = rng.nonzero(-4, 4);
        const q = rng.nonzero(-5, 5);
        const r = rng.nonzero(-6, 6);
        // A = (x-a)(x^2+px+q) + r 를 먼저 만들어 몫·나머지가 정수로 떨어지게 한다
        const A = polyMul([1, -a], [1, p, q]);
        A[3] = (A[3] as number) + r;
        if (A[1] === 0 && A[2] === 0) continue;
        const sum = p + q + r;
        const r1 = [p, A[2] as number, A[3] as number];
        const r2 = [q, A[3] as number];
        return {
          q: `$${polyTex(A)}$ ${jo(polyTex(A), '을/를')} $${linTex(a)}$ ${jo(linTex(a), '으로/로')} 나눈 몫을 $x^2+px+q$, 나머지를 $r$ 라 할 때 $p+q+r$ 의 값을 구하세요.`,
          choices: null,
          answer: String(sum),
          answerType: 'int',
          check: `qq, rr = div(${polySym(A)}, x - (${a}), x)\nans = qq.coeff(x, 1) + qq.coeff(x, 0) + rr`,
          concepts: [
            DIV,
            '나눗셈은 최고차항부터: 맨 앞 항끼리 나눈 몫을 적고, 곱해서 빼기를 되풀이해요.',
          ],
          steps: [
            {
              title: '첫째 몫 $x^2$',
              body: `$x^3\\div x=x^2$. $x^2(${linTex(a)})$ ${jo(linTex(a), '을/를')} 빼면\n$$${polyTex([...r1])}$$`,
            },
            {
              title: `둘째 몫 $${polyTex([p, 0])}$`,
              body: `$${polyTex([p, 0, 0])}\\div x=${polyTex([p, 0])}$. $${polyTex([p, 0])}(${linTex(a)})$ ${jo(linTex(a), '을/를')} 빼면\n$$${polyTex(r2)}$$`,
            },
            {
              title: `셋째 몫 $${q}$`,
              body: `$${paren(q)}\\times(${linTex(a)})$ ${jo(linTex(a), '을/를')} 빼면 남는 수가 나머지예요.\n$$r=${r}$$`,
            },
            {
              title: '더하기',
              body: `몫 $${polyTex([1, p, q])}$ 에서 $p=${p}$, $q=${q}$\n$$p+q+r=${p}+${paren(q)}+${paren(r)}=${sum}$$`,
            },
          ],
          tip: `검산: $(${linTex(a)})(${polyTex([1, p, q])})${r < 0 ? '' : '+'}${r}$ ${jo(String(r), '을/를')} 전개하면 처음 식이 돼요.`,
        };
      }
    },
  },
  {
    id: 'poly-cube-sum',
    unitId: UNIT,
    title: '곱셈 공식의 변형: $a^3+b^3$',
    make(rng) {
      for (;;) {
        const s = rng.nonzero(-5, 5);
        const p = rng.nonzero(-6, 6);
        // 두 수가 같으면(s^2=4p) 검산의 solve 가 근을 하나만 돌려준다
        if (s * s === 4 * p) continue;
        const ans = s ** 3 - 3 * p * s;
        return {
          q: `두 수 $a$, $b$ 에 대하여 $a+b=${s}$, $ab=${p}$ 일 때 $a^3+b^3$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `ans = expand(sum(t0**3 for t0 in solve(x**2 - (${s})*x + (${p}), x)))`,
          concepts: ['곱셈 공식의 변형: $a^3+b^3=(a+b)^3-3ab(a+b)$', CUBE],
          steps: [
            {
              title: '공식 꺼내기',
              body: '$(a+b)^3=a^3+b^3+3ab(a+b)$ 이니\n$$a^3+b^3=(a+b)^3-3ab(a+b)$$',
            },
            {
              title: '값 넣기',
              body: `$$${paren(s)}^3-3\\times${paren(p)}\\times${paren(s)}$$`,
            },
            {
              title: '계산하기',
              body: `$$${s ** 3}${-3 * p * s < 0 ? '' : '+'}${-3 * p * s}=${ans}$$`,
            },
          ],
          tip: '$a$, $b$ 를 따로 구하지 않아도 돼요. 합과 곱만으로 대칭식을 나타내요.',
        };
      }
    },
  },
];
