import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, gcd, reduce } from './util.ts';

const UNIT = 'e-fraction-mul';

// 숫자 뒤 조사는 읽는 소리의 받침으로 갈린다(3 '삼'→으로, 2 '이'→로). 숫자가 무작위라 마지막 자리로 고른다.
// e-fraction-addsub 에도 같은 함수가 있지만 그 파일은 내보내지 않고, 공용 util.ts 는 단원 작성 범위 밖이라
// 여기서 내보내 분수의 나눗셈·소수 단원이 함께 쓴다(셋째 복사본을 만들지 않으려고).
const BATCHIM = new Set(['0', '1', '3', '6', '7', '8']);
const RIEUL = new Set(['1', '7', '8']);
export type Pair = '은는' | '이가' | '을를' | '과와' | '으로로' | '이에요예요';
export function j(n: number | string, pair: Pair): string {
  const last = String(n).slice(-1);
  if (pair === '으로로') return BATCHIM.has(last) && !RIEUL.has(last) ? '으로' : '로';
  if (pair === '이에요예요') return BATCHIM.has(last) ? '이에요' : '예요';
  return BATCHIM.has(last) ? pair.slice(0, 1) : pair.slice(1);
}

export const f = (n: number | string, d: number | string) => `\\frac{${n}}{${d}}`;
export const mixedTex = (w: number, n: number, d: number) => (w === 0 ? f(n, d) : `${w}${f(n, d)}`);
export const R = (n: number, d: number) => `Rational(${n},${d})`;

/** 0 < a < d 이고 d 와 서로소인 분자 (문제에 처음부터 기약분수를 내기 위해) */
export function properNum(rng: Rng, d: number): number {
  for (;;) {
    const a = rng.int(1, d - 1);
    if (gcd(a, d) === 1) return a;
  }
}

/** 분수를 화면 글자로. 분모가 1 이면 자연수로 적는다(자연수 3 을 3/1 로 보이지 않게) */
const ft = (n: number, d: number) => (d === 1 ? String(n) : f(n, d));

/**
 * 두 분수의 곱 (p1/q1)×(p2/q2) 의 풀이 단계. 엇갈려 약분할 수 있으면 먼저 약분해 보이고 곱한다.
 * 곱하고 나서 약분해도 답은 같지만, 큰 수를 만든 뒤 나누는 것보다 먼저 줄이는 습관이 실수를 줄인다.
 * 분수의 나눗셈도 '뒤집어 곱하기' 뒤에는 이 흐름을 그대로 쓴다.
 */
export function mulSteps(
  p1: number,
  q1: number,
  p2: number,
  q2: number,
): { steps: Step[]; n: number; d: number } {
  const steps: Step[] = [];
  const g1 = gcd(p1, q2);
  const g2 = gcd(p2, q1);
  let [a, b, c, d] = [p1, q1, p2, q2];
  if (g1 > 1 || g2 > 1) {
    const parts: string[] = [];
    if (g1 > 1)
      parts.push(`$${p1}$${j(p1, '과와')} $${q2}$${j(q2, '을를')} $${g1}$${j(g1, '으로로')}`);
    if (g2 > 1)
      parts.push(`$${p2}$${j(p2, '과와')} $${q1}$${j(q1, '을를')} $${g2}$${j(g2, '으로로')}`);
    a = p1 / g1;
    d = q2 / g1;
    c = p2 / g2;
    b = q1 / g2;
    steps.push({
      title: '엇갈려 약분하기',
      body: `분자와 다른 분수의 분모를 같은 수로 나눠요. ${parts.join(', ')} 나눠요.\n$$${ft(p1, q1)}\\times${ft(p2, q2)}=${ft(a, b)}\\times${ft(c, d)}$$`,
    });
  }
  steps.push({
    title: '분자끼리, 분모끼리 곱하기',
    body: `$$${ft(a, b)}\\times${ft(c, d)}=${f(`${a}\\times${c}`, `${b}\\times${d}`)}=${ft(a * c, b * d)}$$`,
  });
  return { steps, n: a * c, d: b * d };
}

/**
 * 계산 결과 n/d 를 정리하는 마지막 단계들. 약분 → (가분수면) 대분수.
 * 앱은 값으로 비교하므로 answer 는 기약 가분수로 두고, 보기 좋은 대분수는 answerTex 에 싣는다.
 */
export function finish(n: number, d: number, steps: Step[]): { answer: string; answerTex: string } {
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

/** 대분수 w a/d 를 가분수로 바꾸는 단계 */
export function toImproper(w: number, a: number, d: number): Step {
  return {
    title: '대분수를 가분수로 바꾸기',
    body: `자연수 $${w}$${j(w, '은는')} $${f(w * d, d)}$${j(w * d, '이에요예요')}. 분수 부분과 합쳐요.\n$$${mixedTex(w, a, d)}=${f(`${w}\\times${d}+${a}`, d)}=${f(w * d + a, d)}$$`,
  };
}

function mulWhole(rng: Rng): GenProblem {
  for (;;) {
    const d = rng.int(3, 12);
    const a = properNum(rng, d);
    const n = rng.int(2, 9);
    // 답이 자연수로 떨어지면 '분자에만 곱한다'를 보기 전에 끝나 버려 다시 뽑는다
    if ((a * n) % d === 0) continue;
    const front = rng.next() < 0.5; // 자연수가 앞에 오는 꼴도 섞는다(곱셈은 순서를 바꿔도 같다)
    const expr = front ? `${n}\\times${f(a, d)}` : `${f(a, d)}\\times${n}`;
    const steps: Step[] = [
      {
        title: '자연수는 분자에만 곱하기',
        body: `자연수 $${n}$${j(n, '은는')} 분모가 1인 분수 $${f(n, 1)}$${j(n, '이에요예요')}. 분모 1은 곱해도 그대로라 분자에만 곱해요.\n$$${expr}=${f(`${a}\\times${n}`, d)}=${f(a * n, d)}$$`,
      },
    ];
    const { answer, answerTex } = finish(a * n, d, steps);
    return {
      q: `다음을 계산하세요.\n$$${expr}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: front ? `${n} * ${R(a, d)}` : `${R(a, d)} * ${n}`,
      concepts: [
        '(분수)×(자연수)는 같은 분수를 여러 번 더한 것과 같아요.',
        '자연수는 분자에만 곱해요. 분모는 조각의 크기라서 그대로예요.',
      ],
      steps,
      tip: '분모에도 자연수를 곱하면 조각만 잘아지고 값은 그대로예요. 분자에만 곱해요.',
    };
  }
}

function mulFrac(rng: Rng): GenProblem {
  for (;;) {
    const b = rng.int(2, 10);
    const d = rng.int(2, 10);
    const a = properNum(rng, b);
    const c = properNum(rng, d);
    if (a === c && b === d) continue;
    // 절반쯤은 엇갈려 약분할 수 있는 문제로 — 이 단원의 핵심 기술이라 자주 만나야 한다
    const cross = gcd(a, d) > 1 || gcd(c, b) > 1;
    if (!cross && rng.next() < 0.6) continue;
    const { steps, n, d: den } = mulSteps(a, b, c, d);
    const { answer, answerTex } = finish(n, den, steps);
    return {
      q: `다음을 계산하세요.\n$$${f(a, b)}\\times${f(c, d)}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `${R(a, b)} * ${R(c, d)}`,
      concepts: [
        '분수끼리 곱할 때는 분자끼리, 분모끼리 곱해요.',
        '$\\frac{a}{b}\\times\\frac{c}{d}=\\frac{a\\times c}{b\\times d}$',
        '곱하기 전에 분자와 다른 분수의 분모를 약분하면 수가 작아져요.',
      ],
      steps,
      tip: '1보다 작은 분수끼리 곱하면 답은 두 수보다 작아요. 답이 더 커졌다면 다시 살펴봐요.',
    };
  }
}

function mulMixed(rng: Rng): GenProblem {
  for (;;) {
    const d1 = rng.int(2, 8);
    const a1 = properNum(rng, d1);
    const w1 = rng.int(1, 4);
    // 대분수×대분수와 대분수×진분수를 섞는다. 둘째가 진분수면 w2 = 0
    const w2 = rng.next() < 0.5 ? rng.int(1, 3) : 0;
    const d2 = rng.int(2, 8);
    const a2 = properNum(rng, d2);
    const p1 = w1 * d1 + a1;
    const p2 = w2 * d2 + a2;
    const steps: Step[] = [toImproper(w1, a1, d1)];
    if (w2 > 0) steps.push(toImproper(w2, a2, d2));
    const m = mulSteps(p1, d1, p2, d2);
    steps.push(...m.steps);
    const { answer, answerTex } = finish(m.n, m.d, steps);
    if (answer === '1' || !answer.includes('/')) {
      // 자연수 답도 괜찮지만 대분수 정리를 연습하도록 절반은 다시 뽑는다
      if (rng.next() < 0.5) continue;
    }
    const left = mixedTex(w1, a1, d1);
    const right = mixedTex(w2, a2, d2);
    return {
      q: `다음을 계산하세요.\n$$${left}\\times${right}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `(${w1} + ${R(a1, d1)}) * (${w2 > 0 ? `${w2} + ` : ''}${R(a2, d2)})`,
      concepts: [
        '대분수는 가분수로 바꾼 다음 곱해요.',
        '자연수끼리, 분수끼리 따로 곱하면 안 돼요. 대분수는 자연수와 분수의 덧셈이라서요.',
      ],
      steps,
      tip: `자연수끼리 곱하고 분수끼리 곱하면 틀려요. $${left}$${j(a1, '은는')} $${w1}+${f(a1, d1)}$이라서 곱할 조각이 더 있어요.`,
    };
  }
}

export const generators: Generator[] = [
  {
    id: 'frac-mul-whole',
    unitId: UNIT,
    title: '(분수)×(자연수)',
    make: mulWhole,
  },
  {
    id: 'frac-mul-frac',
    unitId: UNIT,
    title: '(분수)×(분수) (엇갈려 약분하기)',
    make: mulFrac,
  },
  {
    id: 'frac-mul-mixed',
    unitId: UNIT,
    title: '대분수의 곱셈',
    make: mulMixed,
  },
];
