import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { gcd, lcm } from './util.ts';

const UNIT = 'm1-prime-factor';

// 숫자 바로 뒤에 조사를 붙이지 않는다. 숫자가 무작위라 "3를"·"7가" 같은 글이 나오기 때문 —
// 수식은 따로 줄에 세우거나, 조사 없이 끝나는 문장으로 쓴다.

const PRIMES = [2, 3, 5, 7] as const;

/** 소인수분해: 소인수 → 지수. 작은 소인수부터 */
type Fac = [number, number][];

function factor(n: number): Fac {
  const out: Fac = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

const facValue = (f: Fac) => f.reduce((acc, [p, e]) => acc * p ** e, 1);

/** 2^3×3 처럼. 지수 1 은 적지 않는다 */
const facTex = (f: Fac) => f.map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`)).join('\\times ');

/** 소인수분해 한 단계. 나눗셈을 몇 번 했는지 말로 적고, 결과는 따로 줄에 세운다 */
function factorStep(n: number, title = `$${n}$ 소인수분해`): Step {
  const f = factor(n);
  const times = f.map(([p, e]) => `$${p}$ ${e}번`).join(', ');
  return {
    title,
    body: `작은 소수부터 차례로 나누어요(나눈 소수와 횟수: ${times}).\n$$${n}=${facTex(f)}$$`,
  };
}

/** 고른 소인수에 지수를 붙여 만든 수. 너무 작거나 크면 다시 뽑는다 */
function pickFac(rng: Rng, count: number, maxExp: number): Fac {
  const ps = [...PRIMES];
  const chosen: number[] = [];
  while (chosen.length < count) {
    const p = rng.pick(ps);
    if (!chosen.includes(p)) chosen.push(p);
  }
  chosen.sort((a, b) => a - b);
  return chosen.map((p) => [p, rng.int(1, maxExp)]);
}

const DIV_CONCEPTS = [
  '소인수분해: 자연수를 소수만의 곱으로 나타내는 것. 같은 소수는 거듭제곱으로 써요.',
  '$a^m\\times b^n$ 의 약수의 개수는 $(m+1)\\times(n+1)$ 개예요. 각 소인수를 0번부터 지수만큼까지 고를 수 있어서예요.',
];

function divisorCount(rng: Rng): GenProblem {
  for (;;) {
    const three = rng.next() < 0.35;
    const f = pickFac(rng, three ? 3 : 2, three ? 2 : 3);
    const n = facValue(f);
    if (n < 24 || n > 720) continue;
    const ways = f.map(([, e]) => e + 1);
    const ans = ways.reduce((a, b) => a * b, 1);
    return {
      q: `$${n}$의 약수는 모두 몇 개인가요?`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `divisor_count(${n})`,
      concepts: DIV_CONCEPTS,
      steps: [
        factorStep(n),
        {
          title: '고르는 방법 세기',
          body: `약수는 소인수를 골라 곱한 수예요. 소인수마다 곱하는 횟수를 골라요: ${f
            .map(([p, e]) => `$${p}$ 0번~${e}번(${e + 1}가지)`)
            .join(', ')}.`,
        },
        {
          title: '곱하기',
          body: `$$${f.map(([, e]) => `(${e}+1)`).join('\\times')}=${ways.join('\\times')}=${ans}$$`,
        },
      ],
      tip: '지수끼리 곱하면 안 돼요. 그 소인수를 아예 곱하지 않는 경우(0번)까지 세어 1씩 더해요.',
    };
  }
}

/** 공약수가 1뿐이 아니고, 한쪽이 다른 쪽의 약수도 아닌 두 수 */
function pickPair(rng: Rng): [number, number] {
  for (;;) {
    const a = rng.int(12, 180);
    const b = rng.int(12, 180);
    if (a === b || a % b === 0 || b % a === 0) continue;
    const g = gcd(a, b);
    if (g < 2) continue;
    // 큰 소인수(11 이상)가 끼면 나눗셈이 길어져 기초 문제의 뜻을 흐린다
    if ([...factor(a), ...factor(b)].some(([p]) => p > 7)) continue;
    if (lcm(a, b) > 1000) continue;
    return [a, b];
  }
}

function gcdLcm(rng: Rng, kind: 'gcd' | 'lcm'): GenProblem {
  const [a, b] = pickPair(rng);
  const fa = factor(a);
  const fb = factor(b);
  const primes = [...new Set([...fa, ...fb].map(([p]) => p))].sort((x, y) => x - y);
  const exp = (f: Fac, p: number) => f.find(([q]) => q === p)?.[1] ?? 0;
  const pick = primes
    .map((p): [number, number] => {
      const ea = exp(fa, p);
      const eb = exp(fb, p);
      return [p, kind === 'gcd' ? Math.min(ea, eb) : Math.max(ea, eb)];
    })
    .filter(([, e]) => e > 0);
  const ans = kind === 'gcd' ? gcd(a, b) : lcm(a, b);
  const name = kind === 'gcd' ? '최대공약수' : '최소공배수';
  // 절반쯤은 소인수분해한 꼴로 내서, 지수 고르기만 연습하게 한다
  const shown = rng.next() < 0.5;
  const q = shown
    ? `두 수 $${facTex(fa)}$, $${facTex(fb)}$의 ${name}를 구하세요.`
    : `두 수 $${a}$, $${b}$의 ${name}를 구하세요.`;
  const steps: Step[] = shown ? [] : [factorStep(a), factorStep(b)];
  steps.push({
    title: kind === 'gcd' ? '공통 소인수, 작은 지수' : '모든 소인수, 큰 지수',
    body:
      kind === 'gcd'
        ? `두 수에 **모두** 있는 소인수만 골라, 지수가 작은 쪽을 써요.\n$$${facTex(pick)}$$`
        : `어느 한쪽에라도 있는 소인수를 모두 골라, 지수가 큰 쪽을 써요.\n$$${facTex(pick)}$$`,
  });
  steps.push({ title: '계산하기', body: `$$${facTex(pick)}=${ans}$$` });
  return {
    q,
    choices: null,
    answer: String(ans),
    answerType: 'int',
    check: `${kind}(${a}, ${b})`,
    concepts: [
      kind === 'gcd'
        ? '최대공약수: 공통인 소인수를 모두 곱하고, 지수는 작은 쪽'
        : '최소공배수: 나오는 소인수를 모두 곱하고, 지수는 큰 쪽',
    ],
    steps,
    tip:
      kind === 'gcd'
        ? `최대공약수는 두 수보다 클 수 없어요. 답으로 두 수를 나누어 보면 둘 다 나누어떨어져야 해요.`
        : `최소공배수는 두 수 모두로 나누어떨어져요. 답을 두 수로 나누어 확인해요.`,
  };
}

/** 가장 작은 자연수를 곱해 어떤 자연수의 제곱이 되게 하기. 지수가 홀수인 소인수를 하나씩 더 곱한다 */
function makeSquare(rng: Rng): GenProblem {
  for (;;) {
    const f = pickFac(rng, rng.next() < 0.4 ? 3 : 2, 3);
    const n = facValue(f);
    const odd = f.filter(([, e]) => e % 2 === 1);
    if (n < 20 || n > 600 || odd.length === 0 || odd.length === f.length) continue;
    const ans = odd.reduce((acc, [p]) => acc * p, 1);
    const after: Fac = f.map(([p, e]) => [p, e % 2 ? e + 1 : e]);
    const root: Fac = after.map(([p, e]) => [p, e / 2]);
    return {
      q: `$${n}$에 가장 작은 자연수를 곱해서 어떤 자연수의 제곱이 되게 하려고 해요. 곱할 수를 구하세요.`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `Mul(*[p for p, e in factorint(${n}).items() if e % 2])`,
      concepts: [
        '어떤 자연수의 제곱을 소인수분해하면 모든 지수가 짝수예요.',
        '지수가 홀수인 소인수를 하나씩 더 곱하면 지수가 짝수가 돼요.',
      ],
      steps: [
        factorStep(n),
        {
          title: '지수가 홀수인 소인수',
          body: `지수가 홀수인 소인수: ${odd.map(([p]) => `$${p}$`).join(', ')}. 하나씩 더 곱하면 지수가 짝수가 돼요.`,
        },
        {
          title: '곱할 수',
          body:
            odd.length === 1
              ? `홀수 지수인 소인수 하나만 곱하면 돼요.\n$$${ans}$$`
              : `$$${odd.map(([p]) => p).join('\\times ')}=${ans}$$`,
        },
      ],
      tip: `곱한 결과는 $${facTex(after)}=(${facTex(root)})^2$ 이에요. 지수를 반으로 나눈 수의 제곱이에요.`,
    };
  }
}

export const generators: Generator[] = [
  { id: 'pf-divisor-count', unitId: UNIT, title: '약수의 개수', make: divisorCount },
  {
    id: 'pf-gcd',
    unitId: UNIT,
    title: '소인수분해로 최대공약수',
    make: (rng) => gcdLcm(rng, 'gcd'),
  },
  {
    id: 'pf-lcm',
    unitId: UNIT,
    title: '소인수분해로 최소공배수',
    make: (rng) => gcdLcm(rng, 'lcm'),
  },
  { id: 'pf-make-square', unitId: UNIT, title: '제곱수 만들기', make: makeSquare },
];
