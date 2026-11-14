import { jo } from './h1-poly-ops.ts';
import type { Generator } from './types.ts';
import { paren, polySym, polyTex } from './util.ts';

const UNIT = 'prob-combination-binomial';

// 검산은 공식이 아니라 늘어놓기·전개로 한다: 중복조합은 combinations_with_replacement 로, 정수해는 product 로
// 모두 늘어놓아 세고, 이항계수는 sympy 가 식을 실제로 전개해 계수를 읽는다. 풀이의 공식(nHr, 일반항)이
// 틀리면 검산과 어긋나서 잡힌다.
// id 는 모두 단원 id 'prob-combination-binomial-' 로 시작한다(다른 단원 생성기와 이름이 겹친 사고가 있었다).

const HREP =
  '중복조합: 서로 다른 $n$ 개에서 중복을 허락해 순서 없이 $r$ 개를 고르는 수는 $_n\\mathrm{H}_r={}_{n+r-1}\\mathrm{C}_r$ 이에요.';
const BARS =
  '공 $r$ 개와 칸막이 $n-1$ 개를 한 줄로 늘어놓는 것과 같아서 $_{n+r-1}\\mathrm{C}_r$ 이에요.';
const BINOM =
  '이항정리: $(a+b)^n$ 의 일반항은 $_n\\mathrm{C}_r\\,a^{n-r}b^r$ 이에요. 괄호 $n$ 개 중 $b$ 를 꺼낼 $r$ 개를 고르는 수가 계수예요.';
const SUM =
  '$_n\\mathrm{C}_0+{}_n\\mathrm{C}_1+\\cdots+{}_n\\mathrm{C}_n=2^n$ 이에요. $(1+x)^n$ 에 $x=1$ 을 넣은 값이에요.';

const C = (n: number, r: number): number => {
  let v = 1;
  for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
};
const cTex = (n: number, r: number | string) => `{}_{${n}}\\mathrm{C}_{${r}}`;
const hTex = (n: number, r: number) => `{}_{${n}}\\mathrm{H}_{${r}}`;

const VARS = ['x', 'y', 'z', 'w'];

export const generators: Generator[] = [
  {
    id: 'prob-combination-binomial-hrep',
    unitId: UNIT,
    title: '중복조합',
    make(rng) {
      const n = rng.int(3, 5);
      const r = rng.int(3, 6);
      const ans = C(n + r - 1, r);
      const steps = [
        {
          title: '중복조합으로 보기',
          body: `$${n}$ 가지에서 같은 것을 여러 번 골라도 되고 순서가 없으니 $${hTex(n, r)}$ ${jo(String(r), '이에요')}.`,
        },
        {
          title: '조합으로 바꾸기',
          body: `$$${hTex(n, r)}=${cTex(n + r - 1, r)}=${ans}$$`,
        },
      ];
      const check = `from itertools import combinations_with_replacement\nans = len(list(combinations_with_replacement(range(${n}), ${r})))`;
      if (rng.int(0, 1) === 0) {
        return {
          q: `서로 다른 $${n}$ 종류의 음료수 중에서 $${r}$ 병을 사요. 같은 종류를 여러 병 사도 될 때, 살 수 있는 방법의 수를 구하세요. (각 종류는 넉넉히 있어요.)`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check,
          concepts: [HREP],
          steps,
          tip: `중복순열 $${n}^${r}$ 과 헷갈리지 마세요. 음료수를 담는 순서는 상관없어서 순서 없이 고르는 중복조합이에요.`,
        };
      }
      return {
        q: `같은 사탕 $${r}$ 개를 서로 다른 $${n}$ 명에게 남김없이 나누어 주는 방법의 수를 구하세요. (사탕을 받지 못하는 사람이 있어도 돼요.)`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check,
        concepts: [HREP, BARS],
        steps: [
          {
            title: '사탕마다 받을 사람 고르기',
            body: `사탕은 서로 같으니, 사탕 $${r}$ 개마다 받을 사람을 순서 없이 골라요. 같은 사람을 여러 번 골라도 돼요.`,
          },
          ...steps.slice(1),
        ],
        tip: `공 $${r}$ 개 사이에 칸막이 $${n - 1}$ 개를 넣는 그림으로 생각하면, $${n + r - 1}$ 자리 중 공 자리 $${r}$ 개를 고르는 수예요.`,
      };
    },
  },
  {
    id: 'prob-combination-binomial-eqsol',
    unitId: UNIT,
    title: '방정식의 정수해 개수',
    make(rng) {
      const v = rng.int(3, 4);
      const natural = rng.int(0, 1) === 1;
      const k = natural ? rng.int(v + 2, v + 6) : rng.int(4, 8);
      const lhs = VARS.slice(0, v).join('+');
      // 자연수해는 각 변수에 1 씩 먼저 주고 남은 k-v 를 음이 아닌 정수로 나눠 갖는다
      const rest = natural ? k - v : k;
      const ans = C(v + rest - 1, rest);
      const lo = natural ? 1 : 0;
      return {
        q: `방정식 $${lhs}=${k}$ ${jo(String(k), '을')} 만족시키는 ${natural ? '자연수' : '음이 아닌 정수'} $${VARS.slice(0, v).join(',\\,')}$ 의 순서쌍의 개수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import product\nans = len([t for t in product(range(${lo}, ${k + 1}), repeat=${v}) if sum(t) == ${k}])`,
        concepts: [HREP, BARS],
        steps: natural
          ? [
              {
                title: '1 씩 먼저 주기',
                body: `자연수라 각 문자가 $1$ 이상이에요. $${v}$ 개에 $1$ 씩 먼저 주면 남는 것은 $${k}-${v}=${rest}$ ${jo(String(rest), '이에요')}.`,
              },
              {
                title: '남은 것 나누기',
                body: `남은 $${rest}$ ${jo(String(rest), '을')} $${v}$ 개 문자에 $0$ 이상씩 나누는 수예요.\n$$${hTex(v, rest)}=${cTex(v + rest - 1, rest)}=${ans}$$`,
              },
            ]
          : [
              {
                title: '1 을 하나씩 나눠 주기',
                body: `$1$ 을 $${k}$ 개 두고, 하나씩 $${v}$ 개 문자 중 누구에게 줄지 순서 없이 골라요(같은 문자를 또 골라도 돼요).`,
              },
              {
                title: '중복조합',
                body: `$$${hTex(v, k)}=${cTex(v + k - 1, k)}=${ans}$$`,
              },
            ],
        tip: natural
          ? `1 씩 먼저 주지 않고 $${hTex(v, k)}$ ${jo(String(k), '으로')} 세면 $0$ 이 들어간 해까지 세어져요.`
          : `문자 $${v}$ 개를 가르는 칸막이 $${v - 1}$ 개와 $1$ 을 $${k}$ 개 늘어놓는 수로 세어도 같아요. $\\dfrac{${v + k - 1}!}{${k}!\\,${v - 1}!}=${ans}$`,
      };
    },
  },
  {
    id: 'prob-combination-binomial-coef',
    unitId: UNIT,
    title: '이항정리로 계수 구하기',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 3);
        const b = rng.nonzero(-3, 3);
        const n = rng.int(4, 6);
        const k = rng.int(1, n - 1);
        const ans = C(n, k) * a ** k * b ** (n - k);
        // (x+1)^n 이면 계수가 이항계수 그대로라 '상수도 거듭제곱해서 곱한다'를 연습할 거리가 없다
        if (Math.abs(ans) > 3000 || (a === 1 && b === 1)) continue;
        const base = polyTex([a, b]);
        const ax = a === 1 ? 'x' : `${a}x`;
        return {
          q: `$(${base})^${n}$ 의 전개식에서 $x^${k}$ 의 계수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `expand((${polySym([a, b])})**${n}).coeff(x, ${k})`,
          concepts: [BINOM],
          steps: [
            {
              title: '일반항',
              body: `괄호 $${n}$ 개 중 $${a === 1 ? 'x' : `(${ax})`}$ 를 꺼낼 괄호 $r$ 개를 고르면 $${cTex(n, 'r')}${a === 1 ? 'x' : `(${ax})`}^{r}${b < 0 ? `(${b})` : b}^{${n}-r}$ 이에요.`,
            },
            {
              title: `$x^${k}$ 이 되는 $r$`,
              body: `$x$ 의 지수가 $${k}$ 이려면 $r=${k}$ ${jo(String(k), '이에요')}.`,
            },
            {
              title: '계수 계산',
              // x 의 계수가 1 이면 1^k 는 적지 않는다(곱해도 그대로라 식만 길어진다)
              body:
                a === 1
                  ? `$$${cTex(n, k)}\\times${paren(b)}^${n - k}=${C(n, k)}\\times${paren(b ** (n - k))}=${ans}$$`
                  : `$$${cTex(n, k)}\\times${a}^${k}\\times${paren(b)}^${n - k}=${C(n, k)}\\times${a ** k}\\times${paren(b ** (n - k))}=${ans}$$`,
            },
          ],
          tip:
            a === 1 && b > 0
              ? `$${cTex(n, k)}$ 만 쓰고 $${b}^${n - k}$ ${jo(String(n - k), '을')} 빠뜨리기 쉬워요. 괄호 속 상수도 거듭제곱해서 곱해요.`
              : `$x$ 앞의 계수와 상수도 함께 거듭제곱해요. $${cTex(n, k)}$ 만 쓰면 틀려요${b < 0 ? `. 음수 $${b}$ 의 거듭제곱이라 부호도 봐요` : ''}.`,
        };
      }
    },
  },
  {
    id: 'prob-combination-binomial-sum',
    unitId: UNIT,
    title: '이항계수의 합',
    make(rng) {
      const n = rng.int(5, 10);
      const kind = rng.int(0, 2);
      if (kind === 0) {
        const ans = 2 ** n;
        return {
          q: `$${cTex(n, 0)}+${cTex(n, 1)}+${cTex(n, 2)}+\\cdots+${cTex(n, n)}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `sum(binomial(${n}, r) for r in range(0, ${n + 1}))`,
          concepts: [SUM],
          steps: [
            {
              title: '이항정리에 $x=1$',
              body: `$(1+x)^${n === 10 ? '{10}' : n}=${cTex(n, 0)}+${cTex(n, 1)}x+\\cdots+${cTex(n, n)}x^{${n}}$ 에 $x=1$ 을 넣어요.`,
            },
            { title: '값', body: `$$2^{${n}}=${ans}$$` },
          ],
          tip: `원소가 $${n}$ 개인 집합의 부분집합 수와 같아요. 원소마다 넣을지 뺄지 $2$ 가지씩이에요.`,
        };
      }
      if (kind === 1) {
        const ans = 2 ** n - 1;
        return {
          q: `$${cTex(n, 1)}+${cTex(n, 2)}+\\cdots+${cTex(n, n)}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `sum(binomial(${n}, r) for r in range(1, ${n + 1}))`,
          concepts: [SUM],
          steps: [
            {
              title: '전체 합',
              body: `$${cTex(n, 0)}$ 부터 모두 더하면 $2^{${n}}=${2 ** n}$ ${jo(String(2 ** n), '이에요')}.`,
            },
            {
              title: `$${cTex(n, 0)}$ 빼기`,
              body: `$${cTex(n, 0)}=1$ 이 빠져 있어요.\n$$${2 ** n}-1=${ans}$$`,
            },
          ],
          tip: '첫 항이 어디서 시작하는지 꼭 봐요. $_n\\mathrm{C}_0=1$ 을 빼먹으면 $1$ 차이가 나요.',
        };
      }
      const ans = 2 ** (n - 1);
      const last = n % 2 === 0 ? n : n - 1;
      return {
        q: `$${cTex(n, 0)}+${cTex(n, 2)}+${cTex(n, 4)}+\\cdots+${cTex(n, last)}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `sum(binomial(${n}, r) for r in range(0, ${n + 1}, 2))`,
        concepts: [
          SUM,
          '$(1+x)^n$ 에 $x=-1$ 을 넣으면 짝수 번째 합과 홀수 번째 합이 같다는 걸 알 수 있어요.',
        ],
        steps: [
          {
            title: '$x=1$ 과 $x=-1$',
            body: `$x=1$ 을 넣으면 모든 항의 합이 $2^{${n}}$, $x=-1$ 을 넣으면 (짝수 번째 합)$-$(홀수 번째 합)$=0$ 이에요.`,
          },
          {
            title: '반으로 나누기',
            body: `두 합이 같으니 각각 전체의 절반이에요.\n$$\\frac{2^{${n}}}{2}=2^{${n - 1}}=${ans}$$`,
          },
        ],
        tip: '부분집합 중 원소가 짝수 개인 것과 홀수 개인 것의 수가 같다는 뜻이에요.',
      };
    },
  },
];
