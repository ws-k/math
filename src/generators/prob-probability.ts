import { jo } from './h1-poly-ops.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd, lcm } from './util.ts';

const UNIT = 'prob-probability';

// 검산은 가능하면 표본공간을 모두 늘어놓아 센다(카드·공·주사위). 풀이는 덧셈정리·여사건 공식으로 쓰므로,
// 겹친 부분을 빼지 않거나 여사건을 잘못 잡으면 늘어놓아 센 값과 어긋나 검산에서 잡힌다.
// 확률만 주어지는 문제는 늘어놓을 표본이 없어 덧셈정리 식 자체를 sympy 로 풀게 둔다.
// id 는 모두 단원 id 'prob-probability-' 로 시작한다(다른 단원 생성기와 이름이 겹친 사고가 있었다).

const ADD = '확률의 덧셈정리: $P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$';
const EXCL = '$A$, $B$ 가 배반사건($A\\cap B=\\varnothing$)이면 $P(A\\cup B)=P(A)+P(B)$';
const COMP = '여사건의 확률: $P(A^C)=1-P(A)$. "적어도 하나"는 "하나도 없음"의 여사건이에요.';

const C = (n: number, r: number): number => {
  let v = 1;
  for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
};
const P = (n: number, d: number) => fracTex(n, d);

export const generators: Generator[] = [
  {
    id: 'prob-probability-addition',
    unitId: UNIT,
    title: '배수 카드와 덧셈정리',
    make(rng) {
      const [a, b] = rng.pick([
        [2, 3],
        [2, 5],
        [3, 4],
        [3, 5],
        [4, 6],
        [2, 7],
        [3, 7],
      ] as const);
      const N = rng.pick([20, 24, 30, 36, 40, 50]);
      const na = Math.floor(N / a);
      const nb = Math.floor(N / b);
      const l = lcm(a, b);
      const nab = Math.floor(N / l);
      const u = na + nb - nab;
      return {
        q: `$1$ 부터 $${N}$ 까지의 자연수가 하나씩 적힌 카드 $${N}$ 장 중에서 한 장을 꺼낼 때, ${a}의 배수 또는 ${b}의 배수가 적힌 카드가 나올 확률을 구하세요.`,
        choices: null,
        answer: fracAns(u, N),
        answerType: 'fraction',
        check: `ans = Rational(len([k for k in range(1, ${N + 1}) if k % ${a} == 0 or k % ${b} == 0]), ${N})`,
        concepts: [ADD],
        steps: [
          {
            title: '각 사건의 확률',
            body: `${a}의 배수가 나오는 사건을 $A$, ${b}의 배수가 나오는 사건을 $B$ 라 해요. ${a}의 배수는 $${na}$ 장, ${b}의 배수는 $${nb}$ 장이에요.\n$$P(A)=\\frac{${na}}{${N}},\\quad P(B)=\\frac{${nb}}{${N}}$$`,
          },
          {
            title: '겹치는 부분',
            body: `둘 다인 수는 최소공배수 ${l}의 배수로 $${nab}$ 장이에요.\n$$P(A\\cap B)=\\frac{${nab}}{${N}}$$`,
          },
          {
            title: '덧셈정리',
            body: `$$\\frac{${na}}{${N}}+\\frac{${nb}}{${N}}-\\frac{${nab}}{${N}}=${P(u, N)}$$`,
          },
        ],
        tip: `${l}의 배수 카드는 두 번 세어졌어요. 빼지 않으면 확률이 $${P(na + nb, N)}$ 처럼 커져서 틀려요.`,
      };
    },
  },
  {
    id: 'prob-probability-complement',
    unitId: UNIT,
    title: '여사건의 확률',
    make(rng) {
      for (;;) {
        const r = rng.int(3, 6);
        const b = rng.int(2, 4);
        const k = rng.int(2, 3);
        if (k > r) continue;
        const all = C(r + b, k);
        const none = C(r, k);
        return {
          q: `빨간 공 $${r}$ 개와 파란 공 $${b}$ 개가 들어 있는 주머니에서 공 $${k}$ 개를 동시에 꺼낼 때, 파란 공이 적어도 한 개 나올 확률을 구하세요.`,
          choices: null,
          answer: fracAns(all - none, all),
          answerType: 'fraction',
          check: `from itertools import combinations\nballs = ['R'] * ${r} + ['B'] * ${b}\ncs = list(combinations(range(${r + b}), ${k}))\nans = Rational(len([c for c in cs if any(balls[i] == 'B' for i in c)]), len(cs))`,
          concepts: [COMP],
          steps: [
            {
              title: '여사건 잡기',
              body: '"파란 공이 적어도 한 개"의 반대는 "모두 빨간 공"이에요.',
            },
            {
              title: '모두 빨간 공일 확률',
              body: `$$\\frac{{}_{${r}}\\mathrm{C}_{${k}}}{{}_{${r + b}}\\mathrm{C}_{${k}}}=\\frac{${none}}{${all}}${gcd(none, all) > 1 ? `=${P(none, all)}` : ''}$$`,
            },
            {
              title: '1 에서 빼기',
              body: `$$1-${P(none, all)}=${P(all - none, all)}$$`,
            },
          ],
          tip: '파란 공이 1개, 2개, … 인 경우를 하나하나 더해도 되지만, 반대쪽 한 가지를 빼는 쪽이 짧고 빠뜨릴 일이 없어요.',
        };
      }
    },
  },
  {
    id: 'prob-probability-formula',
    unitId: UNIT,
    title: '덧셈정리 식 쓰기',
    make(rng) {
      for (;;) {
        const d = rng.pick([6, 8, 10, 12]);
        const c = rng.int(1, 3);
        const a = rng.int(c + 1, d - 1);
        const b = rng.int(c + 1, d - 1);
        const u = a + b - c;
        if (u >= d || a === b) continue;
        const kind = rng.int(0, 2);
        if (kind === 0) {
          return {
            q: `두 사건 $A$, $B$ 에 대하여 $P(A)=${P(a, d)}$, $P(B)=${P(b, d)}$, $P(A\\cap B)=${P(c, d)}$ 일 때, $P(A\\cup B)$ 를 구하세요.`,
            choices: null,
            answer: fracAns(u, d),
            answerType: 'fraction',
            check: `Rational(${a}, ${d}) + Rational(${b}, ${d}) - Rational(${c}, ${d})`,
            concepts: [ADD],
            steps: [
              {
                title: '덧셈정리에 넣기',
                body: `$$P(A\\cup B)=${P(a, d)}+${P(b, d)}-${P(c, d)}$$`,
              },
              {
                title: '계산',
                body: `분모를 $${d}$ ${jo(String(d), '으로')} 맞춰 분자끼리 계산해요.\n$$\\frac{${a}+${b}-${c}}{${d}}=${P(u, d)}$$`,
              },
            ],
            tip: '$P(A)$ 와 $P(B)$ 에 $A\\cap B$ 가 한 번씩 들어 있어서 한 번 빼요.',
          };
        }
        if (kind === 1) {
          return {
            q: `두 사건 $A$, $B$ 에 대하여 $P(A)=${P(a, d)}$, $P(B)=${P(b, d)}$, $P(A\\cup B)=${P(u, d)}$ 일 때, $P(A\\cap B)$ 를 구하세요.`,
            choices: null,
            answer: fracAns(c, d),
            answerType: 'fraction',
            check: `solve(Eq(Rational(${a}, ${d}) + Rational(${b}, ${d}) - s, Rational(${u}, ${d})), s)[0]`,
            concepts: [ADD],
            steps: [
              {
                title: '덧셈정리 세우기',
                body: `$$${P(u, d)}=${P(a, d)}+${P(b, d)}-P(A\\cap B)$$`,
              },
              {
                title: '옮겨서 풀기',
                body: `$$P(A\\cap B)=${P(a, d)}+${P(b, d)}-${P(u, d)}=${P(c, d)}$$`,
              },
            ],
            tip: '$P(A)+P(B)$ 가 $P(A\\cup B)$ 보다 큰 만큼이 두 번 센 겹친 부분, 곧 $P(A\\cap B)$ 예요.',
          };
        }
        // 배반이면 겹친 부분이 없다 — P(A) 를 여사건으로 주어 한 단계 더 거치게 한다
        if (a + b >= d) continue;
        return {
          q: `두 사건 $A$, $B$ 가 서로 배반사건이고 $P(A^C)=${P(d - a, d)}$, $P(B)=${P(b, d)}$ 일 때, $P(A\\cup B)$ 를 구하세요.`,
          choices: null,
          answer: fracAns(a + b, d),
          answerType: 'fraction',
          check: `(1 - Rational(${d - a}, ${d})) + Rational(${b}, ${d})`,
          concepts: [COMP, EXCL],
          steps: [
            { title: '여사건에서 $P(A)$', body: `$$P(A)=1-${P(d - a, d)}=${P(a, d)}$$` },
            {
              title: '배반이면 더하기만',
              body: `$A\\cap B=\\varnothing$ 이라 빼는 부분이 없어요.\n$$P(A\\cup B)=${P(a, d)}+${P(b, d)}=${P(a + b, d)}$$`,
            },
          ],
          tip: '$P(A^C)$ 를 그대로 더하면 안 돼요. 먼저 $1$ 에서 빼서 $P(A)$ 를 구해요.',
        };
      }
    },
  },
  {
    id: 'prob-probability-dice',
    unitId: UNIT,
    title: '배반사건의 확률(주사위 두 개)',
    make(rng) {
      const cnt = (s: number) => 6 - Math.abs(s - 7);
      // '합이 s1 이하이거나 s2 이상'도 섞는다: 합 두 개만 고르면 가짓수가 적어 같은 문제가 자주 겹친다
      if (rng.int(0, 1) === 1) {
        const lo = rng.int(3, 6);
        const hi = rng.int(8, 11);
        let nLo = 0;
        for (let s = 2; s <= lo; s++) nLo += cnt(s);
        let nHi = 0;
        for (let s = hi; s <= 12; s++) nHi += cnt(s);
        return {
          q: `서로 다른 주사위 두 개를 동시에 던질 때, 나온 눈의 합이 $${lo}$ 이하이거나 $${hi}$ 이상일 확률을 구하세요.`,
          choices: null,
          answer: fracAns(nLo + nHi, 36),
          answerType: 'fraction',
          check: `ans = Rational(len([1 for i in range(1, 7) for j in range(1, 7) if i + j <= ${lo} or i + j >= ${hi}]), 36)`,
          concepts: [EXCL],
          steps: [
            {
              title: '배반인지 보기',
              body: `합이 $${lo}$ 이하이면서 $${hi}$ 이상일 수는 없어요. 두 사건은 배반사건이에요.`,
            },
            {
              title: '각각 세기',
              body: `모든 경우는 $36$ 가지예요. 합이 $${lo}$ 이하인 경우 $${nLo}$ 가지, $${hi}$ 이상인 경우 $${nHi}$ 가지예요.`,
            },
            {
              title: '더하기',
              body: `$$\\frac{${nLo}}{36}+\\frac{${nHi}}{36}=${P(nLo + nHi, 36)}$$`,
            },
          ],
          tip: '합이 $2$ 인 경우 $1$ 가지, $3$ 인 경우 $2$ 가지처럼 합이 $7$ 에 가까울수록 경우가 하나씩 늘어요. 표로 그려 두면 빨리 셀 수 있어요.',
        };
      }
      for (;;) {
        const s1 = rng.int(2, 12);
        const s2 = rng.int(2, 12);
        if (s1 >= s2) continue;
        const n1 = cnt(s1);
        const n2 = cnt(s2);
        return {
          q: `서로 다른 주사위 두 개를 동시에 던질 때, 나온 눈의 합이 $${s1}$ 또는 $${s2}$ 일 확률을 구하세요.`,
          choices: null,
          answer: fracAns(n1 + n2, 36),
          answerType: 'fraction',
          check: `ans = Rational(len([1 for i in range(1, 7) for j in range(1, 7) if i + j in (${s1}, ${s2})]), 36)`,
          concepts: [EXCL],
          steps: [
            {
              title: '배반인지 보기',
              body: `눈의 합이 $${s1}$ 이면서 $${s2}$ 일 수는 없어요. 두 사건은 배반사건이에요.`,
            },
            {
              title: '각각의 확률',
              body: `모든 경우는 $6\\times6=36$ 가지예요. 합이 $${s1}$ 인 경우 $${n1}$ 가지, $${s2}$ 인 경우 $${n2}$ 가지예요.`,
            },
            {
              title: '더하기',
              body: `$$\\frac{${n1}}{36}+\\frac{${n2}}{36}=${P(n1 + n2, 36)}$$`,
            },
          ],
          tip: '(1, 2) 와 (2, 1) 은 다른 경우예요. 두 주사위를 구별해야 모든 경우가 똑같이 자주 나와요.',
        };
      }
    },
  },
  {
    id: 'prob-probability-lineup',
    unitId: UNIT,
    title: '줄 세우기와 여사건',
    make(rng) {
      let a = 3;
      let b = 3;
      // 남 3·여 3 은 표준 문제 p107 과 같아져서 피한다
      while (a === 3 && b === 3) {
        a = rng.int(2, 5);
        b = rng.int(1, 3);
      }
      const n = a + b;
      // 양 끝 두 자리만 확률을 정한다: 양 끝이 모두 남학생일 확률 = aP2 / nP2
      const endsM = a * (a - 1);
      const ends = n * (n - 1);
      return {
        q: `남학생 $${a}$ 명과 여학생 $${b}$ 명이 임의로 한 줄로 설 때, 양 끝 중 적어도 한쪽에 여학생이 설 확률을 구하세요.`,
        choices: null,
        answer: fracAns(ends - endsM, ends),
        answerType: 'fraction',
        check: `from itertools import permutations\nkids = ['M'] * ${a} + ['F'] * ${b}\nps = list(permutations(range(${n})))\nans = Rational(len([p for p in ps if kids[p[0]] == 'F' or kids[p[-1]] == 'F']), len(ps))`,
        concepts: [COMP],
        steps: [
          {
            title: '여사건',
            body: "'적어도 한쪽에 여학생'의 반대는 '양 끝 모두 남학생'이에요.",
          },
          {
            title: '양 끝 모두 남학생일 확률',
            body: `양 끝 두 자리에 설 사람만 보면 돼요.\n$$\\frac{{}_{${a}}\\mathrm{P}_{2}}{{}_{${n}}\\mathrm{P}_{2}}=\\frac{${endsM}}{${ends}}${gcd(endsM, ends) > 1 ? `=${P(endsM, ends)}` : ''}$$`,
          },
          { title: '1 에서 빼기', body: `$$1-${P(endsM, ends)}=${P(ends - endsM, ends)}$$` },
        ],
        tip: `가운데 자리는 누가 서든 상관없어서 양 끝만 보면 돼요. 모두 줄 세운 $${n}!$ 로 세어도 가운데 $(${n}-2)!$ 이 분자·분모에서 약분돼요.`,
      };
    },
  },
];
