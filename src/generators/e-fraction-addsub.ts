import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, gcd, lcm, reduce } from './util.ts';

const UNIT = 'e-fraction-addsub';

// 숫자 뒤 조사는 읽는 소리의 받침으로 갈린다(3 '삼'→으로, 2 '이'→로).
// 숫자가 무작위라 조사를 박아 두면 "3로", "2은" 같은 글이 나오므로 마지막 자리로 고른다.
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
const mixedTex = (w: number, n: number, d: number) => (w === 0 ? f(n, d) : `${w}${f(n, d)}`);
const R = (n: number, d: number) => `Rational(${n},${d})`;
type Op = '+' | '-';

/** 0 < a < d 이고 d 와 서로소인 분자 (문제에 처음부터 기약분수를 내기 위해) */
function properNum(rng: Rng, d: number): number {
  for (;;) {
    const a = rng.int(1, d - 1);
    if (gcd(a, d) === 1) return a;
  }
}

/**
 * 계산 결과 n/d 를 정리하는 마지막 단계들. 약분 → (가분수면) 대분수.
 * 앱은 값으로 비교하므로 answer 는 기약 가분수로 두고, 보기 좋은 대분수는 answerTex 에 싣는다.
 */
function finish(n: number, d: number, steps: Step[]): { answer: string; answerTex: string } {
  const g = gcd(n, d);
  const r = reduce(n, d);
  if (g > 1) {
    steps.push({
      title: '약분하기',
      body: `분자와 분모를 둘의 최대공약수 $${g}$${j(g, '으로로')} 나눠요.\n$$${f(n, d)}=${fracTex(r.n, r.d)}$$`,
    });
  }
  if (r.d > 1 && r.n > r.d) {
    const w = Math.floor(r.n / r.d);
    const rem = r.n % r.d;
    steps.push({
      title: '대분수로 바꾸기',
      body: `분자가 분모보다 큰 가분수예요. $${r.n}\\div${r.d}=${w}$, 나머지 $${rem}$이므로\n$$${f(r.n, r.d)}=${w}${f(rem, r.d)}$$`,
    });
  }
  return { answer: fracAns(n, d), answerTex: `$${fracTex(n, d, { mixed: true })}$` };
}

const diffDenomConcepts = [
  '분모가 다르면 조각 크기가 달라 바로 더할 수 없어요. 먼저 통분해요.',
  '통분: 분모와 분자에 같은 수를 곱해 분모를 똑같이 맞춰요. 같은 수를 곱하면 값은 그대로예요.',
  '공통분모는 두 분모의 최소공배수로 잡으면 수가 가장 작아요.',
];

function sameDenom(rng: Rng, op: Op): GenProblem {
  let d: number;
  let a: number;
  let b: number;
  do {
    d = rng.int(3, 12);
    a = rng.int(1, d - 1);
    b = rng.int(1, d - 1);
  } while (op === '-' && a <= b); // 뺄셈은 답이 0 이하가 되지 않게
  const n = op === '+' ? a + b : a - b;
  const steps: Step[] = [
    {
      title: '분모는 그대로 두기',
      body: `두 분수의 분모가 $${d}$${j(d, '으로로')} 같아요. 조각의 크기가 같으니 분모는 그대로 $${d}$${j(d, '이에요예요')}.`,
    },
    {
      title: op === '+' ? '분자끼리 더하기' : '분자끼리 빼기',
      body: `$$${f(a, d)}${op}${f(b, d)}=${f(`${a}${op}${b}`, d)}=${f(n, d)}$$`,
    },
  ];
  const { answer, answerTex } = finish(n, d, steps);
  return {
    q: `다음을 계산하세요.\n$$${f(a, d)}${op}${f(b, d)}$$`,
    choices: null,
    answer,
    answerTex,
    answerType: 'fraction',
    check: `${R(a, d)} ${op} ${R(b, d)}`,
    concepts: [
      '분모가 같으면 조각의 크기가 같으므로 분자(조각 수)끼리만 계산해요.',
      '$\\frac{a}{d}\\pm\\frac{b}{d}=\\frac{a\\pm b}{d}$',
    ],
    steps,
    tip:
      op === '+'
        ? '분모끼리도 더해 버리는 실수가 가장 흔해요. 분모는 조각의 크기라서 더해도 바뀌지 않아요.'
        : '답에 빼는 수를 다시 더해 처음 수가 나오면 맞게 푼 거예요.',
  };
}

/** 두 분수를 공통분모 L 로 바꿔 계산하는 공통 풀이. 분모가 배수 관계든 아니든 흐름은 같다. */
function diffDenomSteps(
  a1: number,
  d1: number,
  a2: number,
  d2: number,
  op: Op,
  first: Step,
): { steps: Step[]; n: number; L: number } {
  const L = lcm(d1, d2);
  const conv = (side: string, a: number, d: number): Step => {
    const k = L / d;
    return {
      title: `${side} 분수를 분모 ${L}${j(L, '으로로')} 바꾸기`,
      body:
        k === 1
          ? `${side} 분수는 분모가 이미 $${L}$${j(L, '이에요예요')}. 그대로 $${f(a, d)}$${j(a, '이에요예요')}.`
          : `분모와 분자에 똑같이 $${k}$${j(k, '을를')} 곱해요.\n$$${f(a, d)}=${f(`${a}\\times${k}`, `${d}\\times${k}`)}=${f(a * k, L)}$$`,
    };
  };
  const A = a1 * (L / d1);
  const B = a2 * (L / d2);
  const n = op === '+' ? A + B : A - B;
  const steps: Step[] = [
    first,
    conv('앞의', a1, d1),
    conv('뒤의', a2, d2),
    {
      title: op === '+' ? '분자끼리 더하기' : '분자끼리 빼기',
      body: `이제 분모가 같으므로 분자끼리 계산해요.\n$$${f(A, L)}${op}${f(B, L)}=${f(n, L)}$$`,
    },
  ];
  return { steps, n, L };
}

function multipleDenom(rng: Rng): GenProblem {
  for (;;) {
    const d1 = rng.int(2, 6);
    const d2 = d1 * rng.int(2, 4);
    const a1 = properNum(rng, d1);
    const a2 = properNum(rng, d2);
    const op = rng.pick(['+', '-'] as const);
    // 작은 분모를 앞에 둘지 뒤에 둘지도 섞어야 "늘 앞을 바꾸면 된다"는 버릇이 안 생긴다
    const swap = rng.next() < 0.5;
    const [p, pd, q, qd] = swap ? [a2, d2, a1, d1] : [a1, d1, a2, d2];
    if (op === '-' && p * qd <= q * pd) continue;
    const big = Math.max(pd, qd);
    const small = Math.min(pd, qd);
    const first: Step = {
      title: '공통분모 정하기',
      body: `$${small}\\times${big / small}=${big}$이므로 $${big}$${j(big, '은는')} $${small}$의 배수예요. 그래서 큰 분모 $${big}$에 맞추면 돼요.`,
    };
    const { steps, n, L } = diffDenomSteps(p, pd, q, qd, op, first);
    const { answer, answerTex } = finish(n, L, steps);
    return {
      q: `다음을 계산하세요.\n$$${f(p, pd)}${op}${f(q, qd)}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `${R(p, pd)} ${op} ${R(q, qd)}`,
      concepts: [
        ...diffDenomConcepts,
        '한 분모가 다른 분모의 배수이면 큰 분모가 곧 최소공배수예요.',
      ],
      steps,
      tip: '분모만 바꾸고 분자를 그대로 두면 값이 달라져요. 분모에 곱한 수를 분자에도 꼭 곱해요.',
    };
  }
}

function lcmDenom(rng: Rng): GenProblem {
  for (;;) {
    const d1 = rng.int(2, 12);
    const d2 = rng.int(2, 12);
    // 배수 관계는 앞 생성기가 맡는다. 여기서는 최소공배수를 직접 찾아야 하는 경우만.
    if (d1 % d2 === 0 || d2 % d1 === 0) continue;
    const L = lcm(d1, d2);
    if (L > 60) continue;
    const a1 = properNum(rng, d1);
    const a2 = properNum(rng, d2);
    const op = rng.pick(['+', '-'] as const);
    if (op === '-' && a1 * d2 <= a2 * d1) continue;
    const g = gcd(d1, d2);
    const first: Step = {
      title: '최소공배수 찾기',
      body:
        g === 1
          ? `$${d1}$${j(d1, '과와')} $${d2}$${j(d2, '은는')} 1 말고 공통으로 나누어지는 수가 없어요. 그래서 최소공배수는 두 수의 곱이에요.\n$$${d1}\\times${d2}=${L}$$`
          : `두 분모의 최대공약수는 $${g}$${j(g, '이에요예요')}. 두 수의 곱을 최대공약수로 나누면 최소공배수예요.\n$$${d1}\\times${d2}\\div${g}=${L}$$`,
    };
    const { steps, n } = diffDenomSteps(a1, d1, a2, d2, op, first);
    const { answer, answerTex } = finish(n, L, steps);
    return {
      q: `다음을 계산하세요.\n$$${f(a1, d1)}${op}${f(a2, d2)}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `${R(a1, d1)} ${op} ${R(a2, d2)}`,
      concepts: [...diffDenomConcepts, '최소공배수 = 두 수의 곱 ÷ 최대공약수'],
      steps,
      tip: '두 분모를 그냥 곱해서 통분해도 답은 같아요. 다만 수가 커져서 마지막에 약분할 일이 많아져요.',
    };
  }
}

function mixedAddSub(rng: Rng): GenProblem {
  for (;;) {
    const op = rng.pick(['+', '-'] as const);
    const w1 = rng.int(2, 6);
    const w2 = op === '-' ? rng.int(1, w1 - 1) : rng.int(1, 5);
    const d1 = rng.int(2, 10);
    // 절반쯤은 분모를 같게 두어 받아올림·받아내림 자체에 집중하게 한다
    const d2 = rng.next() < 0.5 ? d1 : rng.int(2, 10);
    const L = lcm(d1, d2);
    if (L > 40) continue;
    const a1 = properNum(rng, d1);
    const a2 = properNum(rng, d2);
    const A = a1 * (L / d1);
    const B = a2 * (L / d2);
    // 이 유형의 목적은 받아올림/받아내림이므로 그런 일이 없는 경우는 다시 뽑는다
    if (op === '+' && A + B <= L) continue;
    if (op === '-' && A >= B) continue;

    const steps: Step[] = [];
    if (d1 !== d2) {
      steps.push({
        title: `분수 부분을 분모 ${L}${j(L, '으로로')} 통분하기`,
        body: `$${d1}$, $${d2}$의 최소공배수는 $${L}$${j(L, '이에요예요')}. 자연수 부분은 그대로 두고 분수 부분만 바꿔요.\n$$${mixedTex(w1, a1, d1)}${op}${mixedTex(w2, a2, d2)}=${mixedTex(w1, A, L)}${op}${mixedTex(w2, B, L)}$$`,
      });
    }
    let W: number;
    let N: number;
    if (op === '+') {
      steps.push({ title: '자연수끼리 더하기', body: `$$${w1}+${w2}=${w1 + w2}$$` });
      steps.push({ title: '분수끼리 더하기', body: `$$${f(A, L)}+${f(B, L)}=${f(A + B, L)}$$` });
      N = A + B - L;
      W = w1 + w2 + 1;
      steps.push({
        title: '받아올림',
        body: `분자 $${A + B}$${j(A + B, '이가')} 분모 $${L}$보다 크므로 1을 넘어요. $${f(L, L)}=1$만큼 떼어 자연수 쪽으로 올려요.\n$$${w1 + w2}+${f(A + B, L)}=${w1 + w2}+1+${f(N, L)}=${W}${f(N, L)}$$`,
      });
    } else {
      steps.push({
        title: '받아내림',
        body: `분자 $${A}$에서 $${B}$${j(B, '을를')} 뺄 수 없어요. 자연수 $${w1}$에서 1을 빌려 $${f(L, L)}$${j(L, '으로로')} 바꿔 분수 부분에 더해요.\n$$${mixedTex(w1, A, L)}=${w1 - 1}+${f(L, L)}+${f(A, L)}=${mixedTex(w1 - 1, A + L, L)}$$`,
      });
      W = w1 - 1 - w2;
      N = A + L - B;
      steps.push({ title: '자연수끼리 빼기', body: `$$${w1 - 1}-${w2}=${W}$$` });
      steps.push({ title: '분수끼리 빼기', body: `$$${f(A + L, L)}-${f(B, L)}=${f(N, L)}$$` });
    }
    const g = gcd(N, L);
    const r = reduce(N, L);
    const whole = W === 0 ? '' : String(W);
    let body: string;
    if (g > 1) {
      body = `분수 부분 $${f(N, L)}$${j(N, '은는')} 최대공약수 $${g}$${j(g, '으로로')} 약분하면 $${f(r.n, r.d)}$${j(r.n, '이에요예요')}.\n$$${whole}${f(N, L)}=${whole}${f(r.n, r.d)}$$`;
    } else if (W === 0) {
      body = `자연수 부분이 0이므로 분수 부분만 남아요.\n$$${f(N, L)}$$`;
    } else {
      body = `자연수 부분과 분수 부분을 붙여 적어요.\n$$${W}+${f(N, L)}=${W}${f(N, L)}$$`;
    }
    // 덧셈은 받아올림 단계에서 이미 대분수로 합쳐 적었으므로, 약분할 게 없으면 같은 식을 되풀이하지 않는다
    if (g > 1 || op === '-') steps.push({ title: g > 1 ? '약분하기' : '정리하기', body });
    const total = W * L + N;
    return {
      q: `다음을 계산하세요.\n$$${mixedTex(w1, a1, d1)}${op}${mixedTex(w2, a2, d2)}$$`,
      choices: null,
      answer: fracAns(total, L),
      answerTex: `$${fracTex(total, L, { mixed: true })}$`,
      answerType: 'fraction',
      check: `(${w1} + ${R(a1, d1)}) ${op} (${w2} + ${R(a2, d2)})`,
      concepts: [
        '대분수는 자연수 부분과 분수 부분으로 나눠 따로 계산해요.',
        op === '+'
          ? '분수끼리 더해 1을 넘으면 1만큼을 자연수 쪽으로 올려요(받아올림).'
          : '분수 부분끼리 뺄 수 없으면 자연수에서 1을 빌려 분수 부분에 더해요(받아내림). 빌려 온 1은 분자와 분모가 같은 분수예요.',
      ],
      steps,
      tip:
        op === '+'
          ? '가분수로 바꿔 한 번에 계산해도 돼요. 두 방법의 답이 같으면 맞게 푼 거예요.'
          : `빌려 온 1은 $${f(L, L)}$${j(L, '이에요예요')}. 자연수 뺄셈 습관대로 분자에 10을 더하는 실수를 조심해요.`,
    };
  }
}

export const generators: Generator[] = [
  {
    id: 'frac-add-same-denom',
    unitId: UNIT,
    title: '분모가 같은 분수의 덧셈',
    make: (rng) => sameDenom(rng, '+'),
  },
  {
    id: 'frac-sub-same-denom',
    unitId: UNIT,
    title: '분모가 같은 분수의 뺄셈',
    make: (rng) => sameDenom(rng, '-'),
  },
  {
    id: 'frac-addsub-multiple-denom',
    unitId: UNIT,
    title: '분모가 배수 관계인 분수의 덧셈·뺄셈',
    make: multipleDenom,
  },
  {
    id: 'frac-addsub-lcm',
    unitId: UNIT,
    title: '분모가 다른 분수의 덧셈·뺄셈 (최소공배수로 통분)',
    make: lcmDenom,
  },
  {
    id: 'frac-mixed-addsub',
    unitId: UNIT,
    title: '대분수의 덧셈·뺄셈 (받아올림·받아내림)',
    make: mixedAddSub,
  },
];
