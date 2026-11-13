import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { paren } from './util.ts';

const UNIT = 'm2-pythagoras';

// 답 칸은 정수·분수만 받으므로(√ 를 칠 수 없다) 세 변이 모두 자연수인 피타고라스 수만 쓴다.
// 기본 수에 배수를 곱해 숫자를 늘리되, 빗변이 50 을 넘지 않게 해 암산으로 제곱할 수 있게 둔다.
const BASE: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

function triple(rng: Rng): [number, number, number] {
  for (;;) {
    const [a, b, c] = rng.pick(BASE);
    const k = rng.int(1, 4);
    if (c * k > 50) continue;
    // 두 다리 순서를 섞어 '짧은 변이 늘 먼저' 라는 패턴을 외우지 않게 한다
    return rng.int(0, 1) === 0 ? [a * k, b * k, c * k] : [b * k, a * k, c * k];
  }
}

function hypotenuse(rng: Rng): GenProblem {
  const [a, b, c] = triple(rng);
  const s = a * a + b * b;
  return {
    q: `직각을 낀 두 변의 길이가 $${a}$ cm, $${b}$ cm 인 직각삼각형이 있어요. 빗변의 길이는 몇 cm 인가요?`,
    choices: null,
    answer: String(c),
    answerTex: `$${c}$ cm`,
    answerType: 'int',
    check: `sqrt(${a}**2 + ${b}**2)`,
    concepts: ['직각삼각형에서 직각을 낀 두 변을 $a$, $b$, 빗변을 $c$ 라 하면 $a^2+b^2=c^2$ 예요.'],
    steps: [
      { title: '두 변을 제곱해 더하기', body: `$$${a}^2+${b}^2=${a * a}+${b * b}=${s}$$` },
      { title: '제곱해서 그 수가 되는 길이', body: `$$c^2=${s}\\text{ 이므로 }c=${c}$$` },
    ],
    tip: `빗변은 가장 긴 변이에요. $${Math.max(a, b)}$ 보다 길고 $${a}+${b}=${a + b}$ 보다 짧은지 확인해요.`,
  };
}

function leg(rng: Rng): GenProblem {
  const [a, b, c] = triple(rng);
  const d = c * c - a * a;
  return {
    q: `빗변의 길이가 $${c}$ cm, 다른 한 변의 길이가 $${a}$ cm 인 직각삼각형이 있어요. 나머지 한 변의 길이는 몇 cm 인가요?`,
    choices: null,
    answer: String(b),
    answerTex: `$${b}$ cm`,
    answerType: 'int',
    check: `sqrt(${c}**2 - ${a}**2)`,
    concepts: ['$a^2+b^2=c^2$ 에서 빗변이 아닌 변은 $b^2=c^2-a^2$ 으로 구해요.'],
    steps: [
      { title: '빗변의 제곱에서 빼기', body: `$$${c}^2-${a}^2=${c * c}-${a * a}=${d}$$` },
      { title: '제곱해서 그 수가 되는 길이', body: `$$b^2=${d}\\text{ 이므로 }b=${b}$$` },
    ],
    tip: '빗변이 주어졌으면 더하지 말고 빼요. 더하면 빗변보다 긴 변이 나와요.',
  };
}

function distance(rng: Rng): GenProblem {
  const [a, b, c] = triple(rng);
  // 두 점이 격자 어디에 있든 가로·세로 차이만 쓰인다는 것을 보이려고 음수 좌표도 섞는다
  const x1 = rng.int(-6, 6);
  const y1 = rng.int(-6, 6);
  const x2 = x1 + (rng.int(0, 1) === 0 ? a : -a);
  const y2 = y1 + (rng.int(0, 1) === 0 ? b : -b);
  return {
    q: `좌표평면 위의 두 점 $\\mathrm{A}(${x1},\\,${y1})$, $\\mathrm{B}(${x2},\\,${y2})$ 사이의 거리를 구하세요.`,
    choices: null,
    answer: String(c),
    answerTex: `$${c}$`,
    answerType: 'int',
    check: `sqrt((${x2} - ${paren(x1)})**2 + (${y2} - ${paren(y1)})**2)`,
    concepts: [
      '두 점을 잇는 선분을 빗변으로 하고, 가로·세로 선분을 두 변으로 하는 직각삼각형을 그려요.',
    ],
    steps: [
      { title: '가로 차이', body: `$$|${x2}-${paren(x1)}|=${a}$$` },
      { title: '세로 차이', body: `$$|${y2}-${paren(y1)}|=${b}$$` },
      {
        title: '피타고라스 정리',
        body: `$$\\overline{\\mathrm{AB}}^2=${a}^2+${b}^2=${a * a + b * b}\\text{ 이므로 }\\overline{\\mathrm{AB}}=${c}$$`,
      },
    ],
    tip: '음수 좌표가 있어도 차이는 길이라서 늘 양수로 써요.',
  };
}

// 넓이 문제는 세 변이 자연수일 필요가 없다 — 정사각형 넓이가 곧 변의 제곱이라 제곱근 없이 끝난다
function squares(rng: Rng): GenProblem {
  const p = rng.int(5, 60);
  const q = rng.int(5, 60);
  if (rng.int(0, 1) === 0) {
    return {
      q: `직각삼각형의 세 변 위에 정사각형을 하나씩 그렸어요. 직각을 낀 두 변 위의 정사각형 넓이가 $${p}$ cm², $${q}$ cm² 일 때 빗변 위의 정사각형 넓이는 몇 cm² 인가요?`,
      choices: null,
      answer: String(p + q),
      answerTex: `$${p + q}$ cm²`,
      answerType: 'int',
      check: `${p} + ${q}`,
      concepts: [
        '변 위 정사각형의 넓이는 그 변의 제곱이에요. 그래서 $a^2+b^2=c^2$ 은 넓이의 식이에요.',
      ],
      steps: [
        { title: '넓이로 읽기', body: '빗변 위 정사각형 = 나머지 두 정사각형의 합이에요.' },
        { title: '더하기', body: `$$${p}+${q}=${p + q}$$` },
      ],
      tip: '변의 길이를 구하지 않아도 돼요. 넓이끼리 바로 더해요.',
    };
  }
  const big = p + q;
  return {
    q: `직각삼각형의 세 변 위에 정사각형을 하나씩 그렸어요. 가장 큰 정사각형의 넓이가 $${big}$ cm², 다른 하나가 $${p}$ cm² 일 때 나머지 정사각형의 넓이는 몇 cm² 인가요?`,
    choices: null,
    answer: String(q),
    answerTex: `$${q}$ cm²`,
    answerType: 'int',
    check: `${big} - ${p}`,
    concepts: ['가장 큰 정사각형은 빗변 위에 있어요. 나머지 두 정사각형을 합하면 그 넓이예요.'],
    steps: [
      { title: '빗변 위 정사각형 찾기', body: `가장 큰 $${big}$ cm² 가 빗변 위에 있어요.` },
      { title: '빼기', body: `$$${big}-${p}=${q}$$` },
    ],
    tip: '가장 큰 정사각형에서 아는 것을 빼요.',
  };
}

export const generators: Generator[] = [
  { id: 'pyth-hypotenuse', unitId: UNIT, title: '빗변의 길이', make: hypotenuse },
  { id: 'pyth-leg', unitId: UNIT, title: '빗변이 아닌 변의 길이', make: leg },
  { id: 'pyth-distance', unitId: UNIT, title: '두 점 사이의 거리', make: distance },
  { id: 'pyth-squares', unitId: UNIT, title: '세 변 위 정사각형의 넓이', make: squares },
];
