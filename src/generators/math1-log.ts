import type { Generator } from './types.ts';
import { fracAns, fracTex, ieyo } from './util.ts';

const UNIT = 'math1-log';

// 로그 계산은 "지수로 바꾸면 몇 번 곱했나"가 뿌리라, 풀이 첫 단계는 늘 진수를 밑의 거듭제곱으로
// 적는 것이다. 검산식은 sympy log(진수, 밑) 에 화면 숫자를 그대로 넣고, sympy 가 log(8)/log(4) 처럼
// 정리하지 않고 남기는 경우가 있어 simplify 로 감싼다(답이 유리수인지 판정하려면 정리된 값이 필요).

const DEF = '$a^x=N \\Leftrightarrow x=\\log_a N$ (밑 $a$ 를 몇 번 곱해야 $N$ 인가)';
const SUM = '$\\log_a M+\\log_a N=\\log_a MN$';
const DIFF = '$\\log_a M-\\log_a N=\\log_a \\dfrac{M}{N}$';
const CHANGE =
  '밑 변환: $\\log_a b=\\dfrac{\\log_c b}{\\log_c a}$, 그래서 $\\log_a b\\times\\log_b c=\\log_a c$';
const POWER = '$\\log_{a^m} b^n=\\dfrac{n}{m}\\log_a b$';

/** 진수 글자: 정수면 그대로, 1/a^k 꼴이면 \frac */
const argTex = (a: number, k: number) => (k >= 0 ? String(a ** k) : fracTex(1, a ** -k));
const argSym = (a: number, k: number) => (k >= 0 ? `${a ** k}` : `Rational(1, ${a ** -k})`);

export const generators: Generator[] = [
  {
    id: 'lg-basic-value',
    unitId: UNIT,
    title: '로그의 값(정의)',
    make(rng) {
      for (;;) {
        const a = rng.pick([2, 3, 4, 5, 10]);
        const k = rng.int(-3, 4);
        if (k === 0 || a ** Math.abs(k) > 1000 || (a === 10 && Math.abs(k) > 3)) continue;
        const N = argTex(a, k);
        return {
          q: `$\\log_{${a}} ${N}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `simplify(log(${argSym(a, k)}, ${a}))`,
          concepts: [DEF, '$a^{-n}=\\dfrac{1}{a^n}$'],
          steps: [
            {
              title: '지수로 바꿔 묻기',
              body: `$\\log_{${a}} ${N}=x$ 라 하면 $${a}^x=${N}$ 이에요.`,
            },
            {
              title: `진수를 $${a}$ 의 거듭제곱으로`,
              body: `$$${N}=${a}^{${k}}$$`,
            },
            {
              title: '지수 비교하기',
              body: `$${a}^x=${a}^{${k}}$ 이므로 $x=${k}$ ${ieyo(k)}.`,
            },
          ],
          tip:
            k < 0
              ? '진수가 1 보다 작은 분수면 로그값은 음수예요. 몇 번 "나눠야" 하는지 센다고 생각해도 돼요.'
              : `$${a}^{${k}}=${N}$ 이에요. 로그는 밑을 곱한 '횟수'예요.`,
        };
      }
    },
  },
  {
    id: 'lg-sum-diff',
    unitId: UNIT,
    title: '로그의 합과 차',
    make(rng) {
      if (rng.int(0, 1) === 0) {
        // 차: log_a(N·a^k) − log_a N = k
        for (;;) {
          const a = rng.pick([2, 3, 5]);
          const N = rng.pick([3, 5, 6, 7, 10, 11]);
          const k = rng.int(1, 4);
          if (Number.isInteger(Math.log(N) / Math.log(a))) continue;
          const M = N * a ** k;
          if (M > 400) continue;
          return {
            q: `$\\log_{${a}} ${M}-\\log_{${a}} ${N}$ 의 값을 구하세요.`,
            choices: null,
            answer: String(k),
            answerType: 'int',
            check: `simplify(log(${M}, ${a}) - log(${N}, ${a}))`,
            concepts: [DIFF, DEF],
            steps: [
              {
                title: '빼기는 나누기로',
                body: `$$\\log_{${a}} ${M}-\\log_{${a}} ${N}=\\log_{${a}}\\frac{${M}}{${N}}$$`,
              },
              {
                title: '진수 계산하기',
                body: `$$\\frac{${M}}{${N}}=${a ** k}=${a}^{${k}}$$`,
              },
              {
                title: '로그값',
                body: `$\\log_{${a}} ${a}^{${k}}=${k}$ ${ieyo(k)}.`,
              },
            ],
            tip: `$\\log_{${a}} ${M}$, $\\log_{${a}} ${N}$ 각각은 정수가 아니지만, 빼면 정수가 돼요. 따로 구하려 하지 말고 먼저 합쳐요.`,
          };
        }
      }
      // 합: log_a M + log_a N, MN = a^k (M, N 은 a 의 거듭제곱이 아님)
      const PAIRS: [number, number, number, number][] = [
        [6, 2, 3, 1],
        [6, 4, 9, 2],
        [6, 3, 12, 2],
        [6, 2, 18, 2],
        [6, 8, 27, 3],
        [10, 2, 5, 1],
        [10, 4, 25, 2],
        [10, 20, 5, 2],
        [10, 8, 125, 3],
        [10, 25, 40, 3],
        [12, 3, 4, 1],
        [12, 8, 18, 2],
        [15, 3, 5, 1],
        [15, 9, 25, 2],
      ];
      const [a, M, N, k] = rng.pick(PAIRS);
      return {
        q: `$\\log_{${a}} ${M}+\\log_{${a}} ${N}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(k),
        answerType: 'int',
        check: `simplify(log(${M}, ${a}) + log(${N}, ${a}))`,
        concepts: [SUM, DEF],
        steps: [
          {
            title: '더하기는 곱하기로',
            body: `$$\\log_{${a}} ${M}+\\log_{${a}} ${N}=\\log_{${a}}(${M}\\times${N})$$`,
          },
          {
            title: '진수 계산하기',
            body: `$$${M}\\times${N}=${M * N}=${a}^{${k}}$$`,
          },
          {
            title: '로그값',
            body: `$\\log_{${a}} ${a}^{${k}}=${k}$ ${ieyo(k)}.`,
          },
        ],
        tip: `$\\log_{${a}} ${M}$, $\\log_{${a}} ${N}$ 각각은 깔끔한 값이 아니에요. 곱해서 밑의 거듭제곱이 되는지 먼저 봐요.`,
      };
    },
  },
  {
    id: 'lg-change-base',
    unitId: UNIT,
    title: '밑 변환(로그의 곱)',
    make(rng) {
      for (;;) {
        const a = rng.pick([2, 3, 5]);
        const b = rng.pick([2, 3, 5, 7]);
        if (a === b) continue;
        const k = rng.int(2, 4);
        const c = a ** k;
        if (c > 625) continue;
        return {
          q: `$\\log_{${a}} ${b}\\times\\log_{${b}} ${c}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `simplify(log(${b}, ${a}) * log(${c}, ${b}))`,
          concepts: [CHANGE],
          steps: [
            {
              title: '밑을 하나로 바꾸기',
              body: `상용로그(밑 10)로 바꿔요.\n$$\\log_{${a}} ${b}\\times\\log_{${b}} ${c}=\\frac{\\log ${b}}{\\log ${a}}\\times\\frac{\\log ${c}}{\\log ${b}}$$`,
            },
            {
              title: '약분하기',
              body: `분자와 분모의 $\\log ${b}$ 끼리 약분해요.\n$$\\frac{\\log ${c}}{\\log ${a}}=\\log_{${a}} ${c}$$`,
            },
            {
              title: '로그값',
              body: `$${c}=${a}^{${k}}$ 이므로 $\\log_{${a}} ${c}=${k}$ ${ieyo(k)}.`,
            },
          ],
          tip: `$\\log_a b\\times\\log_b c$ 처럼 앞의 진수와 뒤의 밑이 같으면 사슬처럼 이어져 $\\log_a c$ 가 돼요.`,
        };
      }
    },
  },
  {
    id: 'lg-power-base',
    unitId: UNIT,
    title: '밑과 진수가 거듭제곱인 로그',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3]);
        const m = rng.pick([2, 3]);
        const n = rng.int(1, 5);
        if (n % m === 0) continue; // 정수면 정의만으로 끝나 연습이 안 된다
        const A = p ** m;
        const B = p ** n;
        if (B > 243) continue;
        const ans = fracAns(n, m);
        const tex = fracTex(n, m);
        return {
          q: `$\\log_{${A}} ${B}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `simplify(log(${B}, ${A}))`,
          concepts: [POWER, DEF],
          steps: [
            {
              title: `밑과 진수를 $${p}$ 의 거듭제곱으로`,
              body: `$$${A}=${p}^{${m}},\\quad ${B}=${p}^{${n}}$$`,
            },
            {
              title: '지수를 앞으로',
              body: `$$\\log_{${p}^{${m}}} ${p}^{${n}}=\\frac{${n}}{${m}}\\log_{${p}} ${p}$$`,
            },
            {
              title: '값 계산하기',
              body: `$\\log_{${p}} ${p}=1$ 이므로 답은 $${tex}$ ${ieyo(tex)}.`,
            },
          ],
          tip: `지수로 확인해요. $${A}^{${tex}}=(${p}^{${m}})^{${tex}}=${p}^{${n}}=${B}$ 이니 맞아요.`,
        };
      }
    },
  },
];
