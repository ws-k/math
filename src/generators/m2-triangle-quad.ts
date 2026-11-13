import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex } from './util.ts';

const UNIT = 'm2-triangle-quad';

// 각도 뒤에는 늘 '°' 를 붙이고 문장은 "~는 몇 도인가요?" 로 끝내, 수에 따라 조사가 바뀌지 않게 한다.
const deg = (n: number) => `$${n}^\\circ$`;

function isosceles(rng: Rng): GenProblem {
  const v = rng.int(0, 2);
  const concepts = [
    '이등변삼각형의 두 밑각은 크기가 같아요.',
    '삼각형의 세 각의 합은 $180^\\circ$ 예요.',
  ];
  if (v === 0) {
    // 꼭지각이 짝수여야 밑각이 자연수다
    const a = rng.int(10, 80) * 2;
    const b = (180 - a) / 2;
    return {
      q: `$\\overline{AB}=\\overline{AC}$ 인 이등변삼각형 $ABC$ 에서 $\\angle A=${a}^\\circ$ 일 때, $\\angle B$ 는 몇 도인가요?`,
      choices: null,
      answer: String(b),
      answerTex: deg(b),
      answerType: 'int',
      check: `Rational(180-${a}, 2)`,
      concepts,
      steps: [
        { title: '두 밑각의 합', body: `$$180-${a}=${180 - a}$$` },
        { title: '둘로 나누기', body: `두 밑각은 크기가 같아요.\n$$${180 - a}\\div2=${b}$$` },
      ],
      tip: '꼭지각을 180° 에서 빼기만 하면 두 밑각의 합이에요. 반으로 나누는 걸 잊지 마세요.',
    };
  }
  const b = rng.int(20, 85);
  if (v === 1) {
    const a = 180 - 2 * b;
    return {
      q: `$\\overline{AB}=\\overline{AC}$ 인 이등변삼각형 $ABC$ 에서 $\\angle B=${b}^\\circ$ 일 때, $\\angle A$ 는 몇 도인가요?`,
      choices: null,
      answer: String(a),
      answerTex: deg(a),
      answerType: 'int',
      check: `180-2*${b}`,
      concepts,
      steps: [
        { title: '다른 밑각', body: `$\\angle C=\\angle B=${b}^\\circ$ 예요.` },
        { title: '나머지 각', body: `$$180-${b}\\times2=${a}$$` },
      ],
      tip: '밑각은 두 개예요. 한 번만 빼면 안 돼요.',
    };
  }
  const ext = 180 - b;
  return {
    q: `$\\overline{AB}=\\overline{AC}$ 인 이등변삼각형 $ABC$ 에서 $\\angle B=${b}^\\circ$ 예요. 변 $BC$ 를 $C$ 쪽으로 늘인 직선 위에 점 $D$ 를 잡을 때, $\\angle ACD$ 는 몇 도인가요?`,
    choices: null,
    answer: String(ext),
    answerTex: deg(ext),
    answerType: 'int',
    check: `180-${b}`,
    concepts: [...concepts.slice(0, 1), '한 직선 위에서 이웃한 두 각의 합은 $180^\\circ$ 예요.'],
    steps: [
      { title: '밑각', body: `$\\angle ACB=\\angle B=${b}^\\circ$ 예요.` },
      { title: '한 직선 위의 각', body: `$$180-${b}=${ext}$$` },
    ],
    tip: '외각은 이웃하지 않는 두 내각의 합과 같아요. 확인해 보세요.',
  };
}

function parallelogram(rng: Rng): GenProblem {
  const v = rng.int(0, 2);
  if (v === 0) {
    let a = rng.int(40, 140);
    if (a === 90) a = 75;
    const b = 180 - a;
    return {
      q: `평행사변형 $ABCD$ 에서 $\\angle A=${a}^\\circ$ 일 때, $\\angle B$ 는 몇 도인가요?`,
      choices: null,
      answer: String(b),
      answerTex: deg(b),
      answerType: 'int',
      check: `180-${a}`,
      concepts: ['평행사변형에서 이웃한 두 각의 합은 $180^\\circ$ 예요.'],
      steps: [
        {
          title: '이웃한 두 각',
          body: '$\\overline{AD}\\parallel\\overline{BC}$ 라서 $\\angle A+\\angle B=180^\\circ$ 예요.',
        },
        { title: '빼기', body: `$$180-${a}=${b}$$` },
      ],
      tip: '마주 보는 두 각(대각)은 같고, 이웃한 두 각은 합이 180° 예요.',
    };
  }
  if (v === 1) {
    // m+n 이 180 의 약수여야 각이 자연수다
    const pairs: [number, number][] = [
      [1, 2],
      [2, 1],
      [1, 3],
      [3, 1],
      [1, 4],
      [4, 1],
      [2, 3],
      [3, 2],
      [1, 5],
      [5, 1],
      [4, 5],
      [5, 4],
      [3, 7],
      [7, 3],
      [7, 8],
      [8, 7],
    ];
    const [m, n] = rng.pick(pairs);
    const c = (180 * m) / (m + n);
    return {
      q: `평행사변형 $ABCD$ 에서 $\\angle A:\\angle B=${m}:${n}$ 일 때, $\\angle C$ 는 몇 도인가요?`,
      choices: null,
      answer: String(c),
      answerTex: deg(c),
      answerType: 'int',
      check: `180*Rational(${m}, ${m}+${n})`,
      concepts: [
        '평행사변형에서 이웃한 두 각의 합은 $180^\\circ$ 예요.',
        '평행사변형에서 두 쌍의 대각의 크기는 각각 같아요.',
      ],
      steps: [
        {
          title: '비로 나누기',
          body: `$\\angle A+\\angle B=180^\\circ$ 를 $${m}:${n}$ 으로 나눠요.\n$$\\angle A=180\\times\\frac{${m}}{${m + n}}=${c}$$`,
        },
        { title: '대각', body: `$\\angle C=\\angle A=${c}^\\circ$ 예요.` },
      ],
      tip: '∠C 는 ∠A 와 마주 보는 각이에요. ∠B 와 헷갈리지 마세요.',
    };
  }
  const x = rng.int(3, 9);
  const k1 = rng.int(1, x - 1);
  const k2 = x - k1;
  const oa = x + k1;
  return {
    q: `평행사변형 $ABCD$ 의 두 대각선이 점 $O$ 에서 만나요. $\\overline{OA}=x+${k1}$, $\\overline{OC}=2x-${k2}$ 일 때, $\\overline{AC}$ 의 길이를 구하세요.`,
    choices: null,
    answer: String(2 * oa),
    answerTex: `$${2 * oa}$`,
    answerType: 'int',
    check: `(2*(x+${k1})).subs(x, solve(Eq(x+${k1}, 2*x-${k2}), x)[0])`,
    concepts: ['평행사변형의 두 대각선은 서로 다른 것을 이등분해요.'],
    steps: [
      { title: '식 세우기', body: `$\\overline{OA}=\\overline{OC}$ 예요.\n$$x+${k1}=2x-${k2}$$` },
      { title: '$x$ 구하기', body: `$$x=${x}$$` },
      { title: '대각선 길이', body: `$$\\overline{AC}=2\\times(${x}+${k1})=${2 * oa}$$` },
    ],
    tip: '구한 x 가 답이 아니에요. 묻는 길이를 끝까지 계산해요.',
  };
}

function centers(rng: Rng): GenProblem {
  const v = rng.int(0, 3);
  if (v === 0) {
    const a = rng.int(15, 70) * 2;
    const ans = 90 + a / 2;
    return {
      q: `삼각형 $ABC$ 의 내심을 $I$ 라 해요. $\\angle A=${a}^\\circ$ 일 때, $\\angle BIC$ 는 몇 도인가요?`,
      choices: null,
      answer: String(ans),
      answerTex: deg(ans),
      answerType: 'int',
      check: `90+Rational(${a}, 2)`,
      concepts: [
        '내심은 세 내각의 이등분선의 교점이에요.',
        '$\\angle BIC=90^\\circ+\\dfrac12\\angle A$',
      ],
      steps: [
        { title: '나머지 두 각의 합', body: `$$\\angle B+\\angle C=180-${a}=${180 - a}$$` },
        {
          title: '반씩',
          body: `$IB$, $IC$ 가 각을 반으로 나눠요.\n$$${180 - a}\\div2=${(180 - a) / 2}$$`,
        },
        { title: '삼각형 IBC', body: `$$180-${(180 - a) / 2}=${ans}$$` },
      ],
      tip: '외심이면 2배(∠BOC = 2∠A), 내심이면 90° + 절반이에요.',
    };
  }
  if (v === 1) {
    const a = rng.int(30, 85);
    return {
      q: `예각삼각형 $ABC$ 의 외심을 $O$ 라 해요. $\\angle A=${a}^\\circ$ 일 때, $\\angle BOC$ 는 몇 도인가요?`,
      choices: null,
      answer: String(2 * a),
      answerTex: deg(2 * a),
      answerType: 'int',
      check: `2*${a}`,
      concepts: [
        '외심에서 세 꼭짓점까지의 거리는 같아요($\\overline{OA}=\\overline{OB}=\\overline{OC}$).',
        '$\\angle BOC=2\\angle A$',
      ],
      steps: [
        {
          title: '이등변삼각형 둘',
          body: '$\\triangle OAB$, $\\triangle OAC$ 는 이등변삼각형이라 $\\angle A$ 가 두 밑각으로 나뉘어요.',
        },
        { title: '두 배', body: `$$\\angle BOC=2\\times${a}=${2 * a}$$` },
      ],
      tip: '외심은 2배, 내심은 90° + 절반. 둘을 섞지 마세요.',
    };
  }
  if (v === 2) {
    const p = rng.int(10, 40);
    const q = rng.int(10, 75 - p);
    const ans = 90 - p - q;
    return {
      q: `삼각형 $ABC$ 의 외심 $O$ 가 삼각형 안에 있어요. $\\angle OAB=${p}^\\circ$, $\\angle OBC=${q}^\\circ$ 일 때, $\\angle OCA$ 는 몇 도인가요?`,
      choices: null,
      answer: String(ans),
      answerTex: deg(ans),
      answerType: 'int',
      check: `Rational(180, 2)-${p}-${q}`,
      concepts: [
        '$\\triangle OAB$, $\\triangle OBC$, $\\triangle OCA$ 는 모두 이등변삼각형이에요.',
        '세 쌍의 같은 밑각을 모두 더하면 $180^\\circ$, 한 쌍씩이면 $90^\\circ$ 예요.',
      ],
      steps: [
        {
          title: '한 쌍씩 더하기',
          body: '$\\angle OAB+\\angle OBC+\\angle OCA=90^\\circ$ 예요.',
        },
        { title: '빼기', body: `$$90-${p}-${q}=${ans}$$` },
      ],
      tip: '여섯 각이 세 쌍으로 같아서, 한 쌍씩만 더하면 180° 의 절반이에요.',
    };
  }
  const h = rng.int(5, 30);
  return {
    q: `$\\angle C=90^\\circ$ 인 직각삼각형 $ABC$ 에서 빗변 $\\overline{AB}=${h}$ 일 때, 외접원의 반지름을 구하세요.`,
    choices: null,
    answer: fracAns(h, 2),
    answerTex: `$${fracTex(h, 2)}$`,
    answerType: 'fraction',
    check: `${h}*Rational(1, 2)`,
    concepts: ['직각삼각형의 외심은 빗변의 중점이에요.'],
    steps: [
      { title: '외심의 자리', body: '외심은 빗변 $AB$ 의 중점이에요.' },
      { title: '반지름', body: `$$${h}\\div2=${fracTex(h, 2)}$$` },
    ],
    tip: '직각삼각형이면 외접원의 지름이 곧 빗변이에요.',
  };
}

function special(rng: Rng): GenProblem {
  const v = rng.int(0, 2);
  if (v === 0) {
    const k = rng.int(3, 15);
    return {
      q: `직사각형 $ABCD$ 의 두 대각선이 점 $O$ 에서 만나요. $\\overline{AC}=${2 * k}$ 일 때, $\\overline{OB}$ 의 길이를 구하세요.`,
      choices: null,
      answer: String(k),
      answerTex: `$${k}$`,
      answerType: 'int',
      check: `${2 * k}*Rational(1, 2)`,
      concepts: ['직사각형의 두 대각선은 길이가 같고 서로 다른 것을 이등분해요.'],
      steps: [
        { title: '대각선은 같은 길이', body: `$$\\overline{BD}=\\overline{AC}=${2 * k}$$` },
        { title: '반으로', body: `$$\\overline{OB}=${2 * k}\\div2=${k}$$` },
      ],
      tip: '평행사변형은 이등분만, 직사각형은 길이까지 같아요.',
    };
  }
  if (v === 1) {
    const p = rng.int(2, 10) * 2;
    const q = rng.int(2, 10) * 2;
    return {
      q: `마름모 $ABCD$ 의 두 대각선의 길이가 $${p}$, $${q}$ 일 때, 마름모의 넓이를 구하세요.`,
      choices: null,
      answer: String((p * q) / 2),
      answerTex: `$${(p * q) / 2}$`,
      answerType: 'int',
      check: `${p}*${q}*Rational(1, 2)`,
      concepts: ['마름모의 두 대각선은 서로 다른 것을 수직이등분해요.'],
      steps: [
        {
          title: '직사각형의 절반',
          body: '두 대각선을 가로·세로로 하는 직사각형을 그리면 마름모는 그 절반이에요.',
        },
        { title: '계산', body: `$$${p}\\times${q}\\div2=${(p * q) / 2}$$` },
      ],
      tip: '2로 나누는 걸 잊기 쉬워요.',
    };
  }
  const a = rng.int(20, 80) * 2;
  const ans = (180 - a) / 2;
  return {
    q: `마름모 $ABCD$ 에서 $\\angle A=${a}^\\circ$ 예요. 대각선 $BD$ 를 그을 때, $\\angle ABD$ 는 몇 도인가요?`,
    choices: null,
    answer: String(ans),
    answerTex: deg(ans),
    answerType: 'int',
    check: `Rational(180-${a}, 2)`,
    concepts: ['마름모는 네 변의 길이가 같아요. 그래서 $\\triangle ABD$ 는 이등변삼각형이에요.'],
    steps: [
      {
        title: '이등변삼각형',
        body: '$\\overline{AB}=\\overline{AD}$ 라서 $\\angle ABD=\\angle ADB$ 예요.',
      },
      { title: '밑각', body: `$$(180-${a})\\div2=${ans}$$` },
    ],
    tip: '마름모 안의 삼각형이 이등변삼각형인 걸 먼저 찾으세요.',
  };
}

export const generators: Generator[] = [
  { id: 'tq-isosceles', unitId: UNIT, title: '이등변삼각형의 각', make: isosceles },
  { id: 'tq-parallelogram', unitId: UNIT, title: '평행사변형의 성질', make: parallelogram },
  { id: 'tq-centers', unitId: UNIT, title: '외심과 내심', make: centers },
  { id: 'tq-special-quad', unitId: UNIT, title: '여러 가지 사각형', make: special },
];
