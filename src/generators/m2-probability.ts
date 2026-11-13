import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex } from './util.ts';

const UNIT = 'm2-probability';

// 검산식은 늘 "경우를 모두 늘어놓아 세는" 파이썬 식으로 쓴다. 생성기가 계산한 개수를 그대로 적으면
// 개수 세기 실수(예: (1,3) 과 (3,1) 을 한 번만 셈)가 답과 검산에 똑같이 들어가 잡히지 않는다.
const DICE = 'for i in range(1, 7) for j in range(1, 7)';

/** "(1, 6), (2, 5)" — 풀이에 경우를 늘어놓아 보인다 */
const pairList = (ps: [number, number][]) => ps.map(([a, b]) => `$(${a},${b})$`).join(', ');

function dice(rng: Rng): GenProblem {
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const s = rng.int(3, 11);
    const ps: [number, number][] = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) ps.push([a, b]);
    const w = ps.length;
    return {
      q: `서로 다른 주사위 두 개를 동시에 던질 때, 나온 두 눈의 합이 $${s}$일 확률을 구하세요.`,
      choices: null,
      answer: fracAns(w, 36),
      answerTex: `$${fracTex(w, 36)}$`,
      answerType: 'fraction',
      check: `Rational(len([1 ${DICE} if i + j == ${s}]), 36)`,
      concepts: [
        '확률 $=\\dfrac{\\text{그 사건이 일어나는 경우의 수}}{\\text{모든 경우의 수}}$',
        '주사위 두 개의 모든 경우는 곱의 법칙으로 $6\\times6=36$가지예요.',
      ],
      steps: [
        { title: '모든 경우', body: '$$6\\times6=36$$' },
        { title: '합이 맞는 경우 늘어놓기', body: `${pairList(ps)} 로 $${w}$가지예요.` },
        { title: '확률', body: `$$\\frac{${w}}{36}=${fracTex(w, 36)}$$` },
      ],
      tip: '$(1,2)$ 와 $(2,1)$ 은 다른 경우예요. 두 주사위를 구별해서 세요.',
    };
  }
  if (kind === 1) {
    const d = rng.int(1, 4);
    const ps: [number, number][] = [];
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) if (Math.abs(a - b) === d) ps.push([a, b]);
    const w = ps.length;
    return {
      q: `서로 다른 주사위 두 개를 동시에 던질 때, 나온 두 눈의 차가 $${d}$일 확률을 구하세요.`,
      choices: null,
      answer: fracAns(w, 36),
      answerTex: `$${fracTex(w, 36)}$`,
      answerType: 'fraction',
      check: `Rational(len([1 ${DICE} if Abs(i - j) == ${d}]), 36)`,
      concepts: [
        '확률 $=\\dfrac{\\text{그 사건이 일어나는 경우의 수}}{\\text{모든 경우의 수}}$',
        '주사위 두 개의 모든 경우는 $6\\times6=36$가지예요.',
      ],
      steps: [
        { title: '모든 경우', body: '$$6\\times6=36$$' },
        { title: '차가 맞는 경우 늘어놓기', body: `${pairList(ps)} 로 $${w}$가지예요.` },
        { title: '확률', body: `$$\\frac{${w}}{36}=${fracTex(w, 36)}$$` },
      ],
      tip: '큰 눈이 첫째 주사위일 때와 둘째 주사위일 때를 둘 다 세요.',
    };
  }
  // 한 개: 짝수·소수·m 의 배수처럼 눈 조건
  const conds = [
    { name: '짝수', test: (v: number) => v % 2 === 0, py: 'i % 2 == 0' },
    { name: '홀수', test: (v: number) => v % 2 === 1, py: 'i % 2 == 1' },
    { name: '소수', test: (v: number) => [2, 3, 5].includes(v), py: 'isprime(i)' },
    { name: '3의 배수', test: (v: number) => v % 3 === 0, py: 'i % 3 == 0' },
    { name: '6의 약수', test: (v: number) => 6 % v === 0, py: '6 % i == 0' },
  ];
  const c = rng.pick(conds);
  const hits = [1, 2, 3, 4, 5, 6].filter(c.test);
  const w = hits.length;
  return {
    q: `주사위 한 개를 던질 때, ${c.name}의 눈이 나올 확률을 구하세요.`,
    choices: null,
    answer: fracAns(w, 6),
    answerTex: `$${fracTex(w, 6)}$`,
    answerType: 'fraction',
    check: `Rational(len([1 for i in range(1, 7) if ${c.py}]), 6)`,
    concepts: ['확률 $=\\dfrac{\\text{그 사건이 일어나는 경우의 수}}{\\text{모든 경우의 수}}$'],
    steps: [
      { title: '모든 경우', body: '눈은 $1$부터 $6$까지 $6$가지예요.' },
      { title: '맞는 눈 고르기', body: `$${hits.join(',')}$ 로 $${w}$가지예요.` },
      { title: '확률', body: `$$\\frac{${w}}{6}=${fracTex(w, 6)}$$` },
    ],
    tip: '확률은 늘 $0$ 이상 $1$ 이하예요. 답이 1보다 크면 다시 세요.',
  };
}

function bag(rng: Rng): GenProblem {
  const r = rng.int(2, 7);
  const b = rng.int(2, 7);
  const y = rng.int(1, 6);
  const n = r + b + y;
  const intro = `주머니에 빨간 공 $${r}$개, 파란 공 $${b}$개, 노란 공 $${y}$개가 들어 있어요. 공 하나를 꺼낼 때`;
  if (rng.int(0, 1) === 0) {
    return {
      q: `${intro} 파란 공이 나올 확률을 구하세요.`,
      choices: null,
      answer: fracAns(b, n),
      answerTex: `$${fracTex(b, n)}$`,
      answerType: 'fraction',
      check: `Rational(${b}, ${r} + ${b} + ${y})`,
      concepts: ['확률 $=\\dfrac{\\text{그 사건이 일어나는 경우의 수}}{\\text{모든 경우의 수}}$'],
      steps: [
        { title: '모든 경우', body: `$$${r}+${b}+${y}=${n}$$` },
        { title: '확률', body: `$$\\frac{${b}}{${n}}=${fracTex(b, n)}$$` },
      ],
      tip: '공 하나하나를 서로 다른 경우로 세요. 색깔 세 가지라서 $\\frac13$ 이 아니에요.',
    };
  }
  return {
    q: `${intro} 빨간 공이 나오지 않을 확률을 구하세요.`,
    choices: null,
    answer: fracAns(n - r, n),
    answerTex: `$${fracTex(n - r, n)}$`,
    answerType: 'fraction',
    check: `1 - Rational(${r}, ${r} + ${b} + ${y})`,
    concepts: ['사건 $A$ 가 일어나지 않을 확률 $=1-(A\\text{가 일어날 확률})$'],
    steps: [
      { title: '빨간 공이 나올 확률', body: `$$\\frac{${r}}{${n}}$$` },
      { title: '1에서 빼기', body: `$$1-\\frac{${r}}{${n}}=${fracTex(n - r, n)}$$` },
    ],
    tip: `파란 공과 노란 공의 개수를 더해 $\\dfrac{${b + y}}{${n}}$ 로 구해도 같아요.`,
  };
}

function coins(rng: Rng): GenProblem {
  const n = rng.int(2, 5);
  const all = 2 ** n;
  const loops = Array.from({ length: n }, (_, i) => `for v${i} in range(2)`).join(' ');
  const sum = Array.from({ length: n }, (_, i) => `v${i}`).join(' + ');
  const prod = Array(n).fill('2').join('\\times');
  if (rng.int(0, 1) === 0) {
    return {
      q: `동전 $${n}$개를 동시에 던질 때, 적어도 한 개는 앞면이 나올 확률을 구하세요.`,
      choices: null,
      answer: fracAns(all - 1, all),
      answerTex: `$${fracTex(all - 1, all)}$`,
      answerType: 'fraction',
      check: `Rational(len([1 ${loops} if ${sum} >= 1]), 2**${n})`,
      concepts: [
        '"적어도 한 개"는 "하나도 없다"의 반대(여사건)예요.',
        '사건 $A$ 가 일어나지 않을 확률 $=1-(A\\text{가 일어날 확률})$',
      ],
      steps: [
        { title: '모든 경우', body: `$$${prod}=${all}$$` },
        {
          title: '모두 뒷면인 경우',
          body: `모두 뒷면은 $1$가지라서 확률은 $\\frac{1}{${all}}$ 이에요.`,
        },
        { title: '1에서 빼기', body: `$$1-\\frac{1}{${all}}=${fracTex(all - 1, all)}$$` },
      ],
      tip: '앞면 1개, 2개, … 를 하나하나 더하는 것보다 반대쪽 하나를 빼는 게 빨라요.',
    };
  }
  return {
    q: `동전 $${n}$개를 동시에 던질 때, 모두 앞면이 나올 확률을 구하세요.`,
    choices: null,
    answer: fracAns(1, all),
    answerTex: `$${fracTex(1, all)}$`,
    answerType: 'fraction',
    check: `Rational(len([1 ${loops} if ${sum} == ${n}]), 2**${n})`,
    concepts: ['동전 한 개마다 2가지라서, 곱의 법칙으로 모든 경우를 세요.'],
    steps: [
      { title: '모든 경우', body: `$$${prod}=${all}$$` },
      { title: '모두 앞면', body: '모두 앞면인 경우는 $1$가지예요.' },
      { title: '확률', body: `$$\\frac{1}{${all}}$$` },
    ],
    tip: `동전마다 앞면일 확률 $\\frac12$ 를 $${n}$번 곱해도 같아요.`,
  };
}

function counting(rng: Rng): GenProblem {
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const a = rng.int(2, 7);
    const b = rng.int(2, 6);
    return {
      q: `티셔츠 $${a}$벌과 바지 $${b}$벌이 있어요. 티셔츠 한 벌과 바지 한 벌을 골라 입는 방법은 모두 몇 가지인가요?`,
      choices: null,
      answer: String(a * b),
      answerTex: `$${a * b}$가지`,
      answerType: 'int',
      check: `len([1 for i in range(${a}) for j in range(${b})])`,
      concepts: ['곱의 법칙: 두 가지를 **잇달아 함께** 고르면 경우의 수를 곱해요.'],
      steps: [
        { title: '티셔츠 하나마다', body: `바지를 $${b}$가지로 고를 수 있어요.` },
        { title: '곱하기', body: `$$${a}\\times${b}=${a * b}$$` },
      ],
      tip: '"그리고"로 이어지면 곱하고, "또는"으로 나뉘면 더해요.',
    };
  }
  if (kind === 1) {
    const a = rng.int(2, 6);
    const b = rng.int(1, 5);
    return {
      q: `집에서 도서관까지 가는 버스 노선이 $${a}$가지, 지하철 노선이 $${b}$가지 있어요. 버스 또는 지하철 중 하나를 타고 가는 방법은 모두 몇 가지인가요?`,
      choices: null,
      answer: String(a + b),
      answerTex: `$${a + b}$가지`,
      answerType: 'int',
      check: `len(list(range(${a})) + list(range(${b})))`,
      concepts: ['합의 법칙: 두 사건이 **동시에 일어나지 않으면** 경우의 수를 더해요.'],
      steps: [
        { title: '둘 중 하나만 타요', body: '버스와 지하철을 동시에 탈 수는 없어요.' },
        { title: '더하기', body: `$$${a}+${b}=${a + b}$$` },
      ],
      tip: '버스를 타고 갈아타서 지하철을 타는 거라면 곱해야 해요.',
    };
  }
  const n = rng.int(4, 9);
  return {
    q: `$${n}$명 가운데 회장 한 명과 부회장 한 명을 뽑는 방법은 모두 몇 가지인가요?`,
    choices: null,
    answer: String(n * (n - 1)),
    answerTex: `$${n * (n - 1)}$가지`,
    answerType: 'int',
    check: `len([1 for i in range(${n}) for j in range(${n}) if i != j])`,
    concepts: ['곱의 법칙: 회장을 뽑은 다음 남은 사람 중에서 부회장을 뽑아요.'],
    steps: [
      { title: '회장', body: `$${n}$명 중 한 명이라 $${n}$가지예요.` },
      { title: '부회장', body: `회장을 뺀 $${n - 1}$명 중 한 명이라 $${n - 1}$가지예요.` },
      { title: '곱하기', body: `$$${n}\\times${n - 1}=${n * (n - 1)}$$` },
    ],
    tip: '같은 사람이 둘 다 맡을 수 없으니 두 번째는 한 명 줄어요.',
  };
}

export const generators: Generator[] = [
  { id: 'prob-count-rule', unitId: UNIT, title: '합의 법칙·곱의 법칙', make: counting },
  { id: 'prob-dice', unitId: UNIT, title: '주사위의 확률', make: dice },
  { id: 'prob-bag', unitId: UNIT, title: '주머니 공과 여사건', make: bag },
  { id: 'prob-coins', unitId: UNIT, title: '동전과 적어도 한 개', make: coins },
];
