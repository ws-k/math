import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, gcd } from './util.ts';

const UNIT = 'e-ratio';

// 숫자 바로 뒤에 조사를 붙이지 않는다. 숫자가 무작위라 "3를", "7가" 같은 글이 나오기 때문 —
// 대신 단위(명·g·원)를 붙이거나 수식을 따로 줄에 세운다.

/** 천 단위 쉼표(글 속 금액). 수식 안에는 쓰지 않는다 — KaTeX 에서 쉼표 뒤에 공백이 생긴다 */
const comma = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const pct = (n: number) => `${n}\\%`;

const rateConcepts = [
  '비율 = (비교하는 양) ÷ (기준량). 기호 : 의 오른쪽이 기준량이에요.',
  '백분율은 기준량을 100으로 볼 때의 비율이에요. 비율에 100을 곱해요.',
];

/** 비 a:b → 비율(기약분수). 말하는 방식(대, 에 대한, 의 ~에 대한)을 섞어 기준량을 스스로 찾게 한다 */
function ratioToRate(rng: Rng): GenProblem {
  for (;;) {
    const a = rng.int(1, 18);
    const b = rng.int(2, 20);
    // 나누어떨어지면 답이 자연수라 "기약분수로" 라는 물음과 어긋난다
    if (a === b || a % b === 0) continue;
    const g = gcd(a, b);
    // 약분이 필요한 비가 절반쯤 나오게: 서로소만 나오면 약분 단계를 연습할 기회가 없다
    if (g === 1 && rng.next() < 0.4) continue;
    const say = rng.pick([`$${a}:${b}$`, `$${b}$에 대한 $${a}$의 비`, `$${a}$의 $${b}$에 대한 비`]);
    const steps: Step[] = [
      {
        title: '기준량 찾기',
        body: `비 $${a}:${b}$에서 기호 : 의 오른쪽이 기준량, 왼쪽이 비교하는 양이에요.`,
      },
      {
        title: '비교하는 양 ÷ 기준량',
        body: `$$${a}\\div${b}=\\frac{${a}}{${b}}$$`,
      },
    ];
    if (g > 1) {
      steps.push({
        title: '약분하기',
        body: `분자와 분모를 둘의 최대공약수로 나눠요(최대공약수: $${g}$).\n$$\\frac{${a}}{${b}}=${fracTex(a, b)}$$`,
      });
    }
    return {
      q: `${say}의 비율을 기약분수로 나타내세요.`,
      choices: null,
      answer: fracAns(a, b),
      answerTex: `$${fracTex(a, b)}$`,
      answerType: 'fraction',
      check: `Rational(${a})/${b}`,
      concepts: rateConcepts.slice(0, 1),
      steps,
      tip: '"$b$에 대한 $a$의 비"는 $a:b$예요. "에 대한" 앞의 수가 기준량이라 비율의 분모로 가요.',
    };
  }
}

/** 분수·소수 비율 → 백분율. 분모가 100의 약수일 때만 내서 답이 자연수가 되게 한다 */
function rateToPercent(rng: Rng): GenProblem {
  for (;;) {
    const d = rng.pick([2, 4, 5, 10, 20, 25, 50]);
    const n = rng.int(1, d - 1);
    if (gcd(n, d) !== 1) continue;
    const p = (n * 100) / d;
    const decimal = rng.next() < 0.4;
    // 소수 비율: 0.35 처럼 쓰고, 검산식은 분수로(파이썬에서 0.35 는 실수라 정확한 비교가 안 된다)
    const dec = (p / 100).toFixed(p % 10 === 0 ? 1 : 2);
    const shown = decimal ? dec : `\\frac{${n}}{${d}}`;
    const check = decimal ? `Rational(${p},100)*100` : `Rational(${n},${d})*100`;
    return {
      q: `다음 비율을 백분율로 나타내면 몇 %인가요?\n$$${shown}$$`,
      choices: null,
      answer: String(p),
      answerTex: `$${pct(p)}$`,
      answerType: 'int',
      check,
      concepts: rateConcepts.slice(1),
      steps: [
        {
          title: '비율에 100 곱하기',
          body: `$$${shown}\\times100=${p}$$`,
        },
        {
          title: '% 붙이기',
          body: `기준량을 100으로 볼 때 $${p}$만큼이라는 뜻이에요. 그래서 $${pct(p)}$예요.`,
        },
      ],
      tip: decimal
        ? '소수에 100을 곱하면 소수점이 오른쪽으로 두 칸 옮겨 가요.'
        : '분모를 100으로 만드는 수를 분모·분자에 같이 곱해도 돼요.',
    };
  }
}

/** 할인 판매 가격. 할인 금액을 답으로 적는 실수가 흔해서 두 단계로 나눠 보인다 */
function discount(rng: Rng): GenProblem {
  // 물건 이름 뒤 목적격 조사(을/를)는 받침으로 갈리므로 함께 적어 둔다
  const items = [
    '필통을',
    '운동화를',
    '가방을',
    '모자를',
    '보드게임을',
    '우산을',
    '물병을',
    '티셔츠를',
  ];
  for (;;) {
    const price = rng.int(4, 40) * 1000;
    const rate = rng.pick([10, 15, 20, 25, 30, 40, 50]);
    const off = (price * rate) / 100;
    if (!Number.isInteger(off) || off % 100 !== 0) continue;
    const item = rng.pick(items);
    const sale = price - off;
    return {
      q: `정가가 ${comma(price)}원인 ${item} $${pct(rate)}$ 할인해서 샀어요. 낸 돈은 몇 원인가요?`,
      choices: null,
      answer: String(sale),
      answerTex: `${comma(sale)}원`,
      answerType: 'int',
      check: `${price}*(1-Rational(${rate},100))`,
      concepts: [
        '비교하는 양 = 기준량 × 비율. 여기서 기준량은 정가예요.',
        '할인율은 정가에 대한 할인 금액의 비율이에요.',
      ],
      steps: [
        {
          title: '할인 금액 구하기',
          body: `정가의 $${pct(rate)}$를 구해요.\n$$${price}\\times\\frac{${rate}}{100}=${off}$$`,
        },
        {
          title: '정가에서 빼기',
          body: `$$${price}-${off}=${sale}$$`,
        },
      ],
      tip: `${comma(off)}원은 깎아 준 돈이에요. 낸 돈과 깎아 준 돈을 더하면 정가가 돼요.`,
    };
  }
}

/** 전체 중 일부가 몇 % 인가. 기준량이 '전체'라는 점이 핵심 */
function partPercent(rng: Rng): GenProblem {
  // 조사는 낱말에 맞춰 미리 적어 둔다(학생이/자유투가, 명이/개가). 단위 뒤 조사는 단위 글자로 정해진다
  const ctx = [
    {
      q: (N: number, k: number) =>
        `반 학생 ${N}명 중 안경을 쓴 학생이 ${k}명이에요. 안경을 쓴 학생은 반 전체의 몇 %인가요?`,
      whole: '명이',
      part: '안경을 쓴 학생',
      u: '명',
    },
    {
      q: (N: number, k: number) =>
        `씨앗 ${N}개를 심었더니 ${k}개가 싹이 났어요. 싹이 난 씨앗은 심은 씨앗의 몇 %인가요?`,
      whole: '개가',
      part: '싹이 난 씨앗',
      u: '개',
    },
    {
      q: (N: number, k: number) =>
        `자유투를 ${N}번 던져 ${k}번 넣었어요. 자유투 성공률은 몇 %인가요?`,
      whole: '번이',
      part: '넣은 자유투',
      u: '번',
    },
    {
      q: (N: number, k: number) =>
        `문제 ${N}개를 풀어 ${k}개를 맞혔어요. 맞힌 문제는 푼 문제의 몇 %인가요?`,
      whole: '개가',
      part: '맞힌 문제',
      u: '개',
    },
  ];
  for (;;) {
    const N = rng.pick([20, 25, 40, 50]);
    const k = rng.int(1, N - 1);
    const p = (k * 100) / N;
    if (!Number.isInteger(p)) continue;
    const c = rng.pick(ctx);
    return {
      q: c.q(N, k),
      choices: null,
      answer: String(p),
      answerTex: `$${pct(p)}$`,
      answerType: 'int',
      check: `Rational(${k},${N})*100`,
      concepts: rateConcepts,
      steps: [
        {
          title: '기준량 찾기',
          body: `전체 ${N}${c.whole} 기준량, ${c.part} ${k}${c.whole} 비교하는 양이에요.`,
        },
        {
          title: '비율 구하기',
          body: `$$${k}\\div${N}=\\frac{${k}}{${N}}$$`,
        },
        {
          title: '100 곱하기',
          body: `$$\\frac{${k}}{${N}}\\times100=${p}$$\n그래서 $${pct(p)}$예요.`,
        },
      ],
      tip: '답이 100%를 넘으면 기준량과 비교하는 양을 바꿔 쓴 거예요. 부분은 전체보다 클 수 없어요.',
    };
  }
}

/** 소금물의 진하기. 기준량이 물이 아니라 소금물 전체(소금+물)라는 점을 짚는다 */
function concentration(rng: Rng): GenProblem {
  for (;;) {
    const total = rng.pick([100, 200, 250, 400, 500]);
    const s = rng.int(1, total / 4);
    const p = (s * 100) / total;
    if (!Number.isInteger(p)) continue;
    const w = total - s;
    const solute = rng.pick(['소금', '설탕']);
    const mix = `${solute}물`;
    return {
      q: `${solute} ${s} g을 물 ${w} g에 모두 녹였어요. 이 ${mix}의 진하기는 몇 %인가요?\n(진하기 = ${mix}에 대한 ${solute}의 비율)`,
      choices: null,
      answer: String(p),
      answerTex: `$${pct(p)}$`,
      answerType: 'int',
      check: `Rational(${s},${s}+${w})*100`,
      concepts: [
        `진하기의 기준량은 물이 아니라 ${mix} 전체(${solute} + 물)예요.`,
        '백분율 = 비율 × 100',
      ],
      steps: [
        {
          title: `${mix}의 양 구하기`,
          body: `$$${s}+${w}=${total}$$`,
        },
        {
          title: '비율 구하기',
          body: `$$${s}\\div${total}=\\frac{${s}}{${total}}$$`,
        },
        {
          title: '100 곱하기',
          body: `$$\\frac{${s}}{${total}}\\times100=${p}$$\n그래서 $${pct(p)}$예요.`,
        },
      ],
      tip: `물 ${w} g으로 나누면 안 돼요. ${solute}도 ${mix}의 일부라서 기준량에 넣어요.`,
    };
  }
}

export const generators: Generator[] = [
  { id: 'ratio-to-rate', unitId: UNIT, title: '비를 비율로 나타내기', make: ratioToRate },
  { id: 'rate-to-percent', unitId: UNIT, title: '비율을 백분율로 나타내기', make: rateToPercent },
  { id: 'ratio-discount', unitId: UNIT, title: '할인한 가격 구하기', make: discount },
  { id: 'ratio-part-percent', unitId: UNIT, title: '전체에 대한 백분율', make: partPercent },
  { id: 'ratio-concentration', unitId: UNIT, title: '소금물의 진하기', make: concentration },
];
