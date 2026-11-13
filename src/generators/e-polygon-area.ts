import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';

const UNIT = 'e-polygon-area';

// 수 뒤에는 늘 단위(cm·cm²)를 붙여 쓴다. 단위 '센티미터'가 모음으로 끝나 조사(는·를·예요)가
// 수와 상관없이 하나로 정해지므로, 무작위 수에 맞춰 조사를 고르는 장치가 필요 없다.
const cm = (n: number) => `$${n}$ cm`;
const cm2 = (n: number) => `$${n}$ cm²`;

// 검산식에서 '/' 를 쓰지 않는다. 파이썬 eval 에서 8*5/2 는 실수 20.0 이 되어 정수 비교가 깨진다.
// 반으로 나누는 공식은 Rational(1,2) 를 곱해 정확한 유리수로 계산한다.
const HALF = 'Rational(1,2)';

function rect(rng: Rng): GenProblem {
  const square = rng.int(1, 4) === 1;
  const w = rng.int(3, 15);
  let h = w;
  while (!square && h === w) h = rng.int(2, 12);
  const name = square ? '정사각형' : '직사각형';
  const dims = square
    ? `한 변이 ${cm(w)}인 정사각형`
    : `가로가 ${cm(w)}, 세로가 ${cm(h)}인 직사각형`;
  if (rng.int(0, 1) === 0) {
    const a = w * h;
    return {
      q: `${dims}의 넓이는 몇 cm²인가요?`,
      choices: null,
      answer: String(a),
      answerTex: `${cm2(a)}`,
      answerType: 'int',
      check: `${w}*${h}`,
      concepts: [
        '넓이는 한 변이 1 cm 인 정사각형(1 cm²)이 몇 개 들어가는지예요.',
        `${name}의 넓이 = 가로 × 세로`,
      ],
      steps: [
        {
          title: '한 줄에 들어가는 칸 수',
          body: `가로가 ${cm(w)}이니 한 줄에 1 cm² 칸이 $${w}$개 들어가요.`,
        },
        {
          title: '줄 수만큼 곱하기',
          body: `세로 ${cm(h)}만큼 줄이 있어요.\n$$${w}\\times${h}=${a}$$`,
        },
      ],
      tip: '넓이의 단위는 cm² 예요. 길이를 곱했으니 단위도 두 번 곱한 꼴이에요.',
    };
  }
  const p = (w + h) * 2;
  const steps: Step[] = [
    {
      title: '가로와 세로 더하기',
      body: `마주 보는 변은 길이가 같아요. 먼저 한 쌍씩 더해요.\n$$${w}+${h}=${w + h}$$`,
    },
    {
      title: '두 번 곱하기',
      body: `같은 길이가 한 번 더 있으니 2를 곱해요.\n$$${w + h}\\times2=${p}$$`,
    },
  ];
  return {
    q: `${dims}의 둘레는 몇 cm인가요?`,
    choices: null,
    answer: String(p),
    answerTex: cm(p),
    answerType: 'int',
    check: `(${w}+${h})*2`,
    concepts: ['둘레는 테두리를 한 바퀴 돈 길이예요.', `${name}의 둘레 = (가로 + 세로) × 2`],
    steps,
    tip: '둘레는 길이라서 단위가 cm 예요. 넓이(cm²)와 헷갈리지 않게 조심해요.',
  };
}

function paraTri(rng: Rng): GenProblem {
  const tri = rng.int(0, 1) === 0;
  let b: number;
  let h: number;
  do {
    b = rng.int(4, 14);
    h = rng.int(3, 12);
  } while (tri && (b * h) % 2 !== 0); // 삼각형은 넓이가 자연수로 떨어지게
  if (tri) {
    const a = (b * h) / 2;
    return {
      q: `밑변이 ${cm(b)}, 높이가 ${cm(h)}인 삼각형의 넓이는 몇 cm²인가요?`,
      choices: null,
      answer: String(a),
      answerTex: cm2(a),
      answerType: 'int',
      check: `${HALF}*${b}*${h}`,
      concepts: [
        '삼각형은 밑변과 높이가 같은 직사각형(평행사변형)의 반이에요.',
        '삼각형의 넓이 = 밑변 × 높이 ÷ 2',
      ],
      steps: [
        { title: '밑변 × 높이', body: `$$${b}\\times${h}=${b * h}$$` },
        {
          title: '반으로 나누기',
          body: `삼각형은 그 넓이의 반이에요.\n$$${b * h}\\div2=${a}$$`,
        },
      ],
      tip: '÷ 2 를 빠뜨리면 두 배가 나와요. 답이 같은 밑변·높이의 직사각형보다 작은지 확인해요.',
    };
  }
  const s = h + rng.int(1, 3);
  const a = b * h;
  return {
    q: `밑변이 ${cm(b)}, 높이가 ${cm(h)}, 기울어진 변이 ${cm(s)}인 평행사변형의 넓이는 몇 cm²인가요?`,
    choices: null,
    answer: String(a),
    answerTex: cm2(a),
    answerType: 'int',
    check: `${b}*${h}`,
    concepts: [
      '평행사변형의 한쪽 세모를 잘라 반대쪽에 붙이면 직사각형이 돼요.',
      '평행사변형의 넓이 = 밑변 × 높이',
    ],
    steps: [
      {
        title: '쓸 길이 고르기',
        body: `넓이에는 밑변과 높이를 써요. 기울어진 변 ${cm(s)}는 쓰지 않아요.`,
      },
      { title: '밑변 × 높이', body: `$$${b}\\times${h}=${a}$$` },
    ],
    tip: '높이는 밑변과 수직으로 잰 길이예요. 기울어진 변의 길이와 다를 수 있어요.',
  };
}

function trapezoid(rng: Rng): GenProblem {
  let a: number;
  let b: number;
  let h: number;
  do {
    a = rng.int(2, 10);
    b = a + rng.int(1, 8);
    h = rng.int(2, 10);
  } while (((a + b) * h) % 2 !== 0);
  const area = ((a + b) * h) / 2;
  return {
    q: `윗변이 ${cm(a)}, 아랫변이 ${cm(b)}, 높이가 ${cm(h)}인 사다리꼴의 넓이는 몇 cm²인가요?`,
    choices: null,
    answer: String(area),
    answerTex: cm2(area),
    answerType: 'int',
    check: `${HALF}*(${a}+${b})*${h}`,
    concepts: [
      '사다리꼴을 대각선으로 자르면 높이가 같은 삼각형 두 개가 돼요.',
      '사다리꼴의 넓이 = (윗변 + 아랫변) × 높이 ÷ 2',
    ],
    steps: [
      { title: '윗변 + 아랫변', body: `$$${a}+${b}=${a + b}$$` },
      { title: '높이 곱하기', body: `$$${a + b}\\times${h}=${(a + b) * h}$$` },
      { title: '반으로 나누기', body: `$$${(a + b) * h}\\div2=${area}$$` },
    ],
    tip: '윗변과 아랫변을 먼저 더해요. 아랫변만 높이와 곱하면 모양이 다른 삼각형이 돼요.',
  };
}

function rhombus(rng: Rng): GenProblem {
  let d1: number;
  let d2: number;
  do {
    d1 = rng.int(4, 16);
    d2 = rng.int(4, 16);
  } while (d1 === d2 || (d1 * d2) % 2 !== 0);
  const area = (d1 * d2) / 2;
  return {
    q: `두 대각선의 길이가 ${cm(d1)}, ${cm(d2)}인 마름모의 넓이는 몇 cm²인가요?`,
    choices: null,
    answer: String(area),
    answerTex: cm2(area),
    answerType: 'int',
    check: `${HALF}*${d1}*${d2}`,
    concepts: [
      '마름모를 두 대각선을 가로·세로로 하는 직사각형에 넣으면 꼭 반을 차지해요.',
      '마름모의 넓이 = 한 대각선 × 다른 대각선 ÷ 2',
    ],
    steps: [
      { title: '대각선끼리 곱하기', body: `$$${d1}\\times${d2}=${d1 * d2}$$` },
      {
        title: '반으로 나누기',
        body: `마름모는 그 직사각형의 반이에요.\n$$${d1 * d2}\\div2=${area}$$`,
      },
    ],
    tip: '마름모의 한 변 길이는 넓이 공식에 쓰지 않아요. 대각선 두 개만 있으면 돼요.',
  };
}

export const generators: Generator[] = [
  { id: 'poly-rect', unitId: UNIT, title: '직사각형·정사각형의 둘레와 넓이', make: rect },
  { id: 'poly-para-tri', unitId: UNIT, title: '평행사변형·삼각형의 넓이', make: paraTri },
  { id: 'poly-trapezoid', unitId: UNIT, title: '사다리꼴의 넓이', make: trapezoid },
  { id: 'poly-rhombus', unitId: UNIT, title: '마름모의 넓이', make: rhombus },
];
