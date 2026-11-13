import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex } from './util.ts';

const UNIT = 'm1-plane-figures';

// 각도 뒤에는 늘 '°' 를 붙이고, 다각형은 '칠각형' 처럼 이름으로 쓴다. '형' 이 받침으로 끝나
// 조사(은·의·이에요)가 n 과 상관없이 하나로 정해져서 수에 맞춰 조사를 고를 필요가 없다.
const deg = (n: number) => `$${n}^\\circ$`;

const DIGIT = ['', '', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
/** 3 ≤ n ≤ 29 → '칠각형', '십이각형', '이십각형' */
function polyName(n: number): string {
  const t = Math.floor(n / 10);
  const o = n % 10;
  const tens = t === 0 ? '' : `${t === 1 ? '' : DIGIT[t]}십`;
  return `${tens}${o === 1 ? '일' : DIGIT[o]}각형`;
}

// 정다각형 한 외각이 자연수가 되는 n (360 의 약수 중 3 이상, 너무 큰 것은 뺀다)
const REGULAR = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24];

function interior(rng: Rng): GenProblem {
  if (rng.int(0, 1) === 0) {
    const n = rng.int(5, 15);
    const tri = n - 2;
    const sum = 180 * tri;
    return {
      q: `${polyName(n)}의 내각의 크기의 합은 몇 도인가요?`,
      choices: null,
      answer: String(sum),
      answerTex: deg(sum),
      answerType: 'int',
      check: `180*(${n}-2)`,
      concepts: [
        '한 꼭짓점에서 대각선을 모두 그으면 $n$각형은 삼각형 $(n-2)$개로 나뉘어요.',
        '$n$각형의 내각의 크기의 합 $=180^\\circ\\times(n-2)$',
      ],
      steps: [
        {
          title: '삼각형 개수 세기',
          body: `꼭짓점이 $${n}$개이니 한 꼭짓점에서 대각선을 그으면 삼각형이 $${n}-2=${tri}$개 생겨요.`,
        },
        { title: '삼각형의 각 모으기', body: `$$180\\times${tri}=${sum}$$` },
      ],
      tip: '꼭짓점 수만큼 180° 를 곱하면 안 돼요. 삼각형은 꼭짓점보다 2개 적어요.',
    };
  }
  const n = rng.pick(REGULAR.filter((k) => k >= 5));
  const sum = 180 * (n - 2);
  const one = sum / n;
  return {
    q: `정${polyName(n)}의 한 내각의 크기는 몇 도인가요?`,
    choices: null,
    answer: String(one),
    answerTex: deg(one),
    answerType: 'int',
    check: `Rational(180*(${n}-2), ${n})`,
    concepts: [
      '정다각형은 모든 내각의 크기가 같아요.',
      '정$n$각형의 한 내각 $=\\dfrac{180^\\circ\\times(n-2)}{n}$',
    ],
    steps: [
      { title: '내각의 합', body: `$$180\\times(${n}-2)=${sum}$$` },
      {
        title: '똑같이 나누기',
        body: `내각이 $${n}$개이니 똑같이 나눠요.\n$$${sum}\\div${n}=${one}$$`,
      },
    ],
    tip: `한 외각 $360^\\circ\\div${n}=${360 / n}^\\circ$ 를 $180^\\circ$ 에서 빼도 같아요.`,
  };
}

function diagonals(rng: Rng): GenProblem {
  const n = rng.int(5, 20);
  if (rng.int(0, 1) === 0) {
    const from = n - 3;
    return {
      q: `${polyName(n)}의 한 꼭짓점에서 그을 수 있는 대각선은 몇 개인가요?`,
      choices: null,
      answer: String(from),
      answerTex: `$${from}$개`,
      answerType: 'int',
      check: `${n}-3`,
      concepts: ['대각선은 이웃하지 않는 두 꼭짓점을 이은 선분이에요.'],
      steps: [
        {
          title: '이을 수 없는 꼭짓점',
          body: '자기 자신과 양옆의 이웃한 두 꼭짓점, 모두 $3$개는 대각선으로 이을 수 없어요.',
        },
        { title: '나머지 세기', body: `$$${n}-3=${from}$$` },
      ],
      tip: '양옆 꼭짓점과 이으면 대각선이 아니라 변이에요.',
    };
  }
  const total = (n * (n - 3)) / 2;
  return {
    q: `${polyName(n)}의 대각선은 모두 몇 개인가요?`,
    choices: null,
    answer: String(total),
    answerTex: `$${total}$개`,
    answerType: 'int',
    check: `Rational(${n}*(${n}-3), 2)`,
    concepts: [
      '한 꼭짓점에서 대각선을 $(n-3)$개 그을 수 있어요.',
      '$n$각형의 대각선의 개수 $=\\dfrac{n(n-3)}{2}$',
    ],
    steps: [
      { title: '한 꼭짓점에서', body: `$$${n}-3=${n - 3}$$` },
      { title: '꼭짓점 모두에서', body: `$$${n}\\times${n - 3}=${n * (n - 3)}$$` },
      {
        title: '두 번 센 것 나누기',
        body: `대각선 하나를 양 끝에서 한 번씩, 두 번 셌어요.\n$$${n * (n - 3)}\\div2=${total}$$`,
      },
    ],
    tip: '2로 나누는 것을 잊기 쉬워요. 대각선 AC 와 CA 는 같은 선분이에요.',
  };
}

function exterior(rng: Rng): GenProblem {
  const n = rng.pick(REGULAR);
  const one = 360 / n;
  if (rng.int(0, 1) === 0) {
    return {
      q: `정${polyName(n)}의 한 외각의 크기는 몇 도인가요?`,
      choices: null,
      answer: String(one),
      answerTex: deg(one),
      answerType: 'int',
      check: `360*Rational(1, ${n})`,
      concepts: [
        '다각형의 외각의 크기의 합은 꼭짓점 수와 상관없이 늘 $360^\\circ$ 예요.',
        '정다각형은 외각의 크기도 모두 같아요.',
      ],
      steps: [
        { title: '외각의 합', body: '어떤 다각형이든 외각을 모두 더하면 $360^\\circ$ 예요.' },
        { title: '똑같이 나누기', body: `$$360\\div${n}=${one}$$` },
      ],
      tip: '한 바퀴 돌아 제자리로 오니 외각의 합은 360° 예요.',
    };
  }
  return {
    q: `한 외각의 크기가 ${deg(one)}인 정다각형의 꼭짓점은 몇 개인가요?`,
    choices: null,
    answer: String(n),
    answerTex: `$${n}$개 (정${polyName(n)})`,
    answerType: 'int',
    check: `solve(Eq(${one}*n, 360), n)[0]`,
    concepts: ['정$n$각형의 외각 $n$개를 모두 더하면 $360^\\circ$ 예요.'],
    steps: [
      { title: '식 세우기', body: `$$${one}\\times n=360$$` },
      { title: '꼭짓점 수 구하기', body: `$$n=360\\div${one}=${n}$$` },
    ],
    tip: `확인: $${one}\\times${n}=360$ 이에요.`,
  };
}

// 호의 길이·넓이에는 π 가 남는다. 답은 'aπ' 의 a 로 받는다(숫자판으로 π 를 칠 수 없어서)
function sector(rng: Rng): GenProblem {
  const r = rng.int(2, 12);
  const a = rng.pick([30, 45, 60, 72, 90, 120, 135, 150, 180, 240, 270]);
  if (rng.int(0, 1) === 0) {
    // 호의 길이 = 2πr × a/360
    const n = 2 * r * a;
    const ans = fracAns(n, 360);
    const tex = fracTex(n, 360);
    return {
      q: `반지름이 $${r}$ cm, 중심각이 ${deg(a)}인 부채꼴의 호의 길이는 $k\\pi$ cm예요. $k$의 값을 구하세요.`,
      choices: null,
      answer: ans,
      answerTex: `$${tex}\\pi$ cm`,
      answerType: 'fraction',
      check: `2*pi*${r}*Rational(${a},360)/pi`,
      concepts: [
        '부채꼴의 호의 길이는 중심각에 정비례해요.',
        '호의 길이 $=2\\pi r\\times\\dfrac{x}{360}$',
      ],
      steps: [
        { title: '원 전체의 둘레', body: `$$2\\pi\\times${r}=${2 * r}\\pi$$` },
        {
          title: '중심각만큼 떼어 내기',
          body: `원 한 바퀴는 $360^\\circ$ 예요.\n$$${2 * r}\\pi\\times\\frac{${a}}{360}=${tex}\\pi$$`,
        },
      ],
      tip: '반지름을 두 번 곱하면 넓이예요. 둘레는 2πr 로 시작해요.',
    };
  }
  const n = r * r * a;
  const ans = fracAns(n, 360);
  const tex = fracTex(n, 360);
  return {
    q: `반지름이 $${r}$ cm, 중심각이 ${deg(a)}인 부채꼴의 넓이는 $k\\pi$ cm²예요. $k$의 값을 구하세요.`,
    choices: null,
    answer: ans,
    answerTex: `$${tex}\\pi$ cm²`,
    answerType: 'fraction',
    check: `pi*${r}**2*Rational(${a},360)/pi`,
    concepts: [
      '부채꼴의 넓이도 중심각에 정비례해요.',
      '부채꼴의 넓이 $=\\pi r^2\\times\\dfrac{x}{360}$',
    ],
    steps: [
      { title: '원 전체의 넓이', body: `$$\\pi\\times${r}^2=${r * r}\\pi$$` },
      {
        title: '중심각만큼 떼어 내기',
        body: `$$${r * r}\\pi\\times\\frac{${a}}{360}=${tex}\\pi$$`,
      },
    ],
    tip: '분수 $\\frac{x}{360}$ 을 먼저 약분하면 계산이 쉬워요.',
  };
}

export const generators: Generator[] = [
  { id: 'polygon-interior', unitId: UNIT, title: '다각형의 내각', make: interior },
  { id: 'polygon-diagonals', unitId: UNIT, title: '다각형의 대각선', make: diagonals },
  { id: 'polygon-exterior', unitId: UNIT, title: '정다각형의 외각', make: exterior },
  { id: 'sector-arc-area', unitId: UNIT, title: '부채꼴의 호와 넓이', make: sector },
];
