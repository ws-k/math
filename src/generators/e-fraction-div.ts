import type { Step } from '../content/types.ts';
import { f, finish, mixedTex, mulSteps, properNum, R, toImproper } from './e-fraction-mul.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { gcd, jo } from './util.ts';

const UNIT = 'e-fraction-div';

// 나눗셈은 '나누는 수를 뒤집어 곱하기'로 곱셈이 된다. 뒤집은 다음의 풀이(엇갈려 약분 → 곱하기 → 약분·대분수)는
// 분수의 곱셈 단원과 똑같아서 그 단원의 풀이 함수를 그대로 쓴다 — 두 단원의 풀이 말투가 어긋나지 않게.

const concepts = [
  '나눗셈은 나누는 수의 역수를 곱하는 것과 같아요.',
  '$\\frac{a}{b}\\div\\frac{c}{d}=\\frac{a}{b}\\times\\frac{d}{c}$',
];

function divWhole(rng: Rng): GenProblem {
  for (;;) {
    const d = rng.int(2, 9);
    const a = properNum(rng, d) + (rng.next() < 0.3 ? d : 0); // 가끔 가분수도
    const n = rng.int(2, 9);
    if (gcd(a, d) !== 1) continue;
    const steps: Step[] = [
      {
        title: '역수를 곱하는 꼴로 바꾸기',
        body: `자연수 $${n}$의 역수는 $${f(1, n)}$${jo(1, '이에요/예요')}. $${n}$${jo(n, '으로/로')} 나누는 것은 $${f(1, n)}$${jo(1, '을/를')} 곱하는 것과 같아요.\n$$${f(a, d)}\\div${n}=${f(a, d)}\\times${f(1, n)}$$`,
      },
    ];
    const m = mulSteps(a, d, 1, n);
    steps.push(...m.steps);
    const { answer, answerTex } = finish(m.n, m.d, steps);
    return {
      q: `다음을 계산하세요.\n$$${f(a, d)}\\div${n}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `${R(a, d)} / ${n}`,
      concepts: [
        '(분수)÷(자연수)는 그 자연수의 역수를 곱해요. 분모에 자연수를 곱하는 것과 같아요.',
      ],
      steps,
      tip:
        a % n === 0
          ? `분자 $${a}$${jo(a, '이/가')} $${n}$${jo(n, '으로/로')} 나누어떨어지면 분자만 나눠도 돼요: $${f(a / n, d)}$.`
          : '분자가 자연수로 나누어떨어지지 않으면 분모에 자연수를 곱해요. 조각을 더 잘게 나누는 거예요.',
    };
  }
}

function divFrac(rng: Rng): GenProblem {
  for (;;) {
    const b = rng.int(2, 10);
    const d = rng.int(2, 10);
    const a = properNum(rng, b);
    const c = properNum(rng, d);
    if (a * d === b * c) continue; // 같은 수끼리 나누면 1 — 이 유형에서 배울 게 없다
    const steps: Step[] = [
      {
        title: '나누는 수를 뒤집어 곱하기',
        body: `$${f(c, d)}$의 역수는 $${c === 1 ? `${f(d, 1)}=${d}` : f(d, c)}$${jo(d, '이에요/예요')}. ÷를 ×로 바꾸고 나누는 수만 뒤집어요.\n$$${f(a, b)}\\div${f(c, d)}=${f(a, b)}\\times${f(d, c)}$$`,
      },
    ];
    const m = mulSteps(a, b, d, c);
    steps.push(...m.steps);
    const { answer, answerTex } = finish(m.n, m.d, steps);
    return {
      q: `다음을 계산하세요.\n$$${f(a, b)}\\div${f(c, d)}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `${R(a, b)} / ${R(c, d)}`,
      concepts,
      steps,
      tip: '뒤집는 것은 나누는 수(÷ 뒤의 수) 하나뿐이에요. 앞의 수까지 뒤집으면 답이 달라져요.',
    };
  }
}

function divMixed(rng: Rng): GenProblem {
  for (;;) {
    const d1 = rng.int(2, 8);
    const a1 = properNum(rng, d1);
    const w1 = rng.int(1, 4);
    // 나누는 수: 대분수 또는 진분수
    const w2 = rng.next() < 0.5 ? rng.int(1, 2) : 0;
    const d2 = rng.int(2, 8);
    const a2 = properNum(rng, d2);
    const p1 = w1 * d1 + a1;
    const p2 = w2 * d2 + a2;
    if (p1 * d2 === p2 * d1) continue;
    const steps: Step[] = [toImproper(w1, a1, d1)];
    if (w2 > 0) steps.push(toImproper(w2, a2, d2));
    steps.push({
      title: '나누는 수를 뒤집어 곱하기',
      body: `$${f(p2, d2)}$의 역수는 $${f(d2, p2)}$${jo(d2, '이에요/예요')}.\n$$${f(p1, d1)}\\div${f(p2, d2)}=${f(p1, d1)}\\times${f(d2, p2)}$$`,
    });
    const m = mulSteps(p1, d1, d2, p2);
    steps.push(...m.steps);
    const { answer, answerTex } = finish(m.n, m.d, steps);
    const left = mixedTex(w1, a1, d1);
    const right = mixedTex(w2, a2, d2);
    return {
      q: `다음을 계산하세요.\n$$${left}\\div${right}$$`,
      choices: null,
      answer,
      answerTex,
      answerType: 'fraction',
      check: `(${w1} + ${R(a1, d1)}) / (${w2 > 0 ? `${w2} + ` : ''}${R(a2, d2)})`,
      concepts: [
        '대분수는 가분수로 바꾼 다음 나눠요. 대분수 그대로 뒤집을 수는 없어요.',
        ...concepts,
      ],
      steps,
      tip: '대분수를 그대로 뒤집으면 안 돼요. 가분수로 바꾼 다음 뒤집어요.',
    };
  }
}

export const generators: Generator[] = [
  {
    id: 'frac-div-whole',
    unitId: UNIT,
    title: '(분수)÷(자연수)',
    make: divWhole,
  },
  {
    id: 'frac-div-frac',
    unitId: UNIT,
    title: '(분수)÷(분수) (역수 곱하기)',
    make: divFrac,
  },
  {
    id: 'frac-div-mixed',
    unitId: UNIT,
    title: '대분수의 나눗셈',
    make: divMixed,
  },
];
