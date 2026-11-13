import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, gcd, lcm } from './util.ts';

const UNIT = 'e-fraction-basics';

// 숫자 뒤 조사는 읽는 소리의 받침으로 갈린다. e-fraction-addsub 생성기와 같은 규칙(보고서에 공용화 제안).
// 분수는 "4분의 3"처럼 분자를 마지막에 읽으므로 분자를 넘긴다.
const BATCHIM = new Set(['0', '1', '3', '6', '7', '8']);
const RIEUL = new Set(['1', '7', '8']);
type Pair = '은는' | '이가' | '을를' | '과와' | '으로로' | '이에요예요';
function j(n: number, pair: Pair): string {
  const last = String(n).slice(-1);
  if (pair === '으로로') return BATCHIM.has(last) && !RIEUL.has(last) ? '으로' : '로';
  if (pair === '이에요예요') return BATCHIM.has(last) ? '이에요' : '예요';
  return BATCHIM.has(last) ? pair.slice(0, 1) : pair.slice(1);
}

const f = (n: number | string, d: number | string) => `\\frac{${n}}{${d}}`;

/** 0 < n < d 이고 d 와 서로소인 분자 — 처음부터 기약분수를 내려고 */
function properNum(rng: Rng, d: number): number {
  for (;;) {
    const n = rng.int(1, d - 1);
    if (gcd(n, d) === 1) return n;
  }
}

/** 약분해서 기약분수로. 분모·분자에 같은 수 k 를 곱해 둔 분수를 내므로 최대공약수가 곧 k 다 */
function reduceFrac(rng: Rng): GenProblem {
  const d = rng.int(2, 12);
  const n = properNum(rng, d);
  const k = rng.int(2, 9);
  const N = n * k;
  const D = d * k;
  return {
    q: `$${f(N, D)}$${j(N, '을를')} 기약분수로 나타내세요.`,
    choices: null,
    answer: fracAns(N, D),
    answerType: 'fraction',
    check: `Integer(${N})/${D}`,
    concepts: [
      '약분: 분모와 분자를 둘의 공약수로 나눠 간단히 하는 것. 크기는 그대로예요.',
      '최대공약수로 한 번에 나누면 바로 기약분수가 돼요.',
    ],
    steps: [
      {
        title: '최대공약수 찾기',
        body: `분자 $${N}$${j(N, '과와')} 분모 $${D}$의 최대공약수는 $${k}$${j(k, '이에요예요')}.`,
      },
      {
        title: '분모와 분자를 나누기',
        body: `$$${f(N, D)}=${f(`${N}\\div ${k}`, `${D}\\div ${k}`)}=${f(n, d)}$$`,
      },
      {
        title: '더 나눌 수 있는지 확인',
        body: `$${n}$${j(n, '과와')} $${d}$의 공약수는 1뿐이라 기약분수예요.`,
      },
    ],
    tip: `작은 공약수로 여러 번 나눠도 답은 같아요. 끝에 분모와 분자의 공약수가 1뿐인지 꼭 확인해요.`,
  };
}

/** 대분수 → 가분수 */
function mixedToImproper(rng: Rng): GenProblem {
  const w = rng.int(1, 5);
  const d = rng.int(2, 9);
  const n = properNum(rng, d);
  const N = w * d + n;
  return {
    q: `$${w}${f(n, d)}$${j(n, '을를')} 가분수로 나타내세요.`,
    choices: null,
    answer: fracAns(N, d),
    answerType: 'fraction',
    check: `${w} + Rational(${n}, ${d})`,
    concepts: [
      '대분수는 자연수와 진분수의 합이에요.',
      `자연수 1은 $${f(d, d)}$처럼 분모와 분자가 같은 분수예요.`,
    ],
    steps: [
      {
        title: '자연수를 분수로',
        body:
          w === 1
            ? `1은 $${f(1, d)}$이 $${d}$개, 곧 $${f(d, d)}$${j(d, '이에요예요')}.\n$$1=${f(d, d)}$$`
            : `1은 $${f(d, d)}$${j(d, '이에요예요')}. 그래서 $${w}$${j(w, '은는')} $${f(1, d)}$이 $${w * d}$개예요.\n$$${w}=${f(w * d, d)}$$`,
      },
      {
        title: '분수끼리 더하기',
        body: `$$${f(w * d, d)}+${f(n, d)}=${f(N, d)}$$`,
      },
    ],
    tip: `한 번에 쓰면 분자는 $${w}\\times ${d}+${n}=${N}$, 분모는 그대로예요. 분모를 바꾸는 실수를 조심해요.`,
  };
}

/** 분모가 다른 두 분수의 크기 비교. 통분해서 분자를 비교하게 한다 */
function compareFrac(rng: Rng): GenProblem {
  for (;;) {
    const b = rng.int(2, 12);
    const d = rng.int(2, 12);
    if (b === d) continue;
    const L = lcm(b, d);
    if (L > 60) continue;
    const a = properNum(rng, b);
    const c = properNum(rng, d);
    const A = a * (L / b);
    const C = c * (L / d);
    if (A === C) continue;
    const big = A > C ? [a, b] : [c, d];
    return {
      q: `두 분수 중 더 큰 수를 쓰세요.\n$$${f(a, b)},\\quad ${f(c, d)}$$`,
      choices: null,
      answer: fracAns(big[0] as number, big[1] as number),
      answerType: 'fraction',
      check: `Max(Rational(${a}, ${b}), Rational(${c}, ${d}))`,
      concepts: [
        '분모가 다르면 조각 크기가 달라 분자만 보고 비교할 수 없어요.',
        '통분해서 분모를 같게 만든 다음 분자를 비교해요.',
      ],
      steps: [
        {
          title: '공통분모 정하기',
          body: `$${b}$${j(b, '과와')} $${d}$의 최소공배수는 $${L}$${j(L, '이에요예요')}.`,
        },
        {
          title: '통분하기',
          body: `$$${f(a, b)}=${f(A, L)},\\quad ${f(c, d)}=${f(C, L)}$$`,
        },
        {
          title: '분자 비교하기',
          body: `$${A}$${j(A, '과와')} $${C}$ 중 $${Math.max(A, C)}$${j(Math.max(A, C), '이가')} 더 커요. 그래서 $${f(big[0] as number, big[1] as number)}$${j(big[0] as number, '이가')} 더 커요.`,
        },
      ],
      tip: '분모가 큰 쪽이 크다고 생각하기 쉬워요. 분모가 크면 조각은 오히려 작아요.',
    };
  }
}

/** 크기가 같은 분수의 빈칸. 분모·분자에 같은 수를 곱한다는 것을 거꾸로도 쓰게 한다 */
function equivMissing(rng: Rng): GenProblem {
  const b = rng.int(2, 9);
  const a = properNum(rng, b);
  const k = rng.int(2, 8);
  const top = rng.next() < 0.5;
  const steps = [
    {
      title: '몇 배인지 찾기',
      body: top
        ? `분모가 $${b}$에서 $${b * k}$${j(b * k, '으로로')} $${k}$배가 됐어요.`
        : `분자가 $${a}$에서 $${a * k}$${j(a * k, '으로로')} $${k}$배가 됐어요.`,
    },
    {
      title: `${top ? '분자' : '분모'}에도 같은 수 곱하기`,
      body: `크기가 같으려면 ${top ? '분자' : '분모'}에도 $${k}$${j(k, '을를')} 곱해요.\n$$${f(a, b)}=${f(`${a}\\times ${k}`, `${b}\\times ${k}`)}=${f(a * k, b * k)}$$`,
    },
  ];
  return {
    q: `$\\square$에 알맞은 수를 구하세요.\n$$${f(a, b)}=${top ? f('\\square', b * k) : f(a * k, '\\square')}$$`,
    choices: null,
    answer: String(top ? a * k : b * k),
    answerType: 'int',
    check: top ? `Rational(${a}, ${b})*${b * k}` : `${a * k}/Rational(${a}, ${b})`,
    concepts: [
      '$\\frac{a}{b}=\\frac{a\\times k}{b\\times k}$: 분모와 분자에 같은 수를 곱해도 크기는 그대로예요.',
    ],
    steps,
    tip: '분모와 분자에 같은 수를 더하면 크기가 달라져요. 꼭 곱해요.',
  };
}

export const generators: Generator[] = [
  { id: 'frac-reduce', unitId: UNIT, title: '약분해서 기약분수로', make: reduceFrac },
  { id: 'frac-mixed-to-improper', unitId: UNIT, title: '대분수를 가분수로', make: mixedToImproper },
  { id: 'frac-compare', unitId: UNIT, title: '분모가 다른 분수의 크기 비교', make: compareFrac },
  { id: 'frac-equiv-missing', unitId: UNIT, title: '크기가 같은 분수 만들기', make: equivMissing },
];
