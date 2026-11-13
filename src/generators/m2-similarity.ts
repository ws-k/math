import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';

const UNIT = 'm2-similarity';

// 닮음비는 서로소 m:n(m<n)만 쓴다. 약분되는 비를 주면 "닮음비를 가장 간단히" 하는 단계가 끼어
// 기초 문제 한 단계에 계산이 둘이 되기 때문이다.
const RATIOS: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [3, 4],
  [2, 5],
  [3, 5],
  [4, 5],
  [5, 6],
];

// 길이 단위는 늘 cm 로 고정한다. 받침 없는 'cm'(센티미터) 뒤 조사를 하나로 쓰려고.
function side(rng: Rng): GenProblem {
  const [m, n] = rng.pick(RATIOS);
  const k1 = rng.int(1, 4);
  let k2 = rng.int(1, 5);
  if (k2 === k1) k2 = k1 + 1;
  const ab = m * k1;
  const de = n * k1;
  const bc = m * k2;
  const ef = n * k2;
  return {
    q: `$\\triangle ABC\\sim\\triangle DEF$ 이고 $\\overline{AB}=${ab}$ cm, $\\overline{DE}=${de}$ cm, $\\overline{BC}=${bc}$ cm 예요. $\\overline{EF}$ 의 길이는 몇 cm 인가요?`,
    choices: null,
    answer: String(ef),
    answerTex: `$${ef}$ cm`,
    answerType: 'int',
    check: `${bc}*Rational(${de}, ${ab})`,
    concepts: [
      '닮은 도형에서 대응변의 길이의 비는 모두 같아요. 이 비가 닮음비예요.',
      '기호 순서대로 $A$ 와 $D$, $B$ 와 $E$, $C$ 와 $F$ 가 대응해요.',
    ],
    steps: [
      { title: '닮음비 구하기', body: `$$\\overline{AB}:\\overline{DE}=${ab}:${de}=${m}:${n}$$` },
      { title: '비례식 세우기', body: `$$${bc}:\\overline{EF}=${m}:${n}$$` },
      { title: '길이 구하기', body: `$$\\overline{EF}=${bc}\\times\\frac{${n}}{${m}}=${ef}$$` },
    ],
    tip: '대응변을 기호 순서로 짝지어야 해요. BC 의 짝은 EF 예요.',
  };
}

function areaVolume(rng: Rng): GenProblem {
  const [m, n] = rng.pick(RATIOS);
  const t = rng.int(1, 3);
  if (rng.int(0, 1) === 0) {
    const small = m * m * t;
    const big = n * n * t;
    return {
      q: `닮음비가 $${m}:${n}$ 인 두 삼각형이 있어요. 작은 삼각형의 넓이가 $${small}$ cm² 일 때, 큰 삼각형의 넓이는 몇 cm² 인가요?`,
      choices: null,
      answer: String(big),
      answerTex: `$${big}$ cm²`,
      answerType: 'int',
      check: `${small}*Rational(${n}, ${m})**2`,
      concepts: [
        '닮음비가 $m:n$ 이면 넓이의 비는 $m^2:n^2$ 이에요.',
        '가로와 세로가 함께 늘어나니 넓이는 두 번 곱해져요.',
      ],
      steps: [
        { title: '넓이의 비', body: `$$${m}^2:${n}^2=${m * m}:${n * n}$$` },
        {
          title: '큰 넓이 구하기',
          body: `$$${small}\\times\\frac{${n * n}}{${m * m}}=${big}$$`,
        },
      ],
      tip: '닮음비를 그대로 곱하면 안 돼요. 넓이는 닮음비를 제곱해요.',
    };
  }
  const small = m * m * m * t;
  const big = n * n * n * t;
  return {
    q: `닮음비가 $${m}:${n}$ 인 두 정육면체가 있어요. 작은 정육면체의 부피가 $${small}$ cm³ 일 때, 큰 정육면체의 부피는 몇 cm³ 인가요?`,
    choices: null,
    answer: String(big),
    answerTex: `$${big}$ cm³`,
    answerType: 'int',
    check: `${small}*Rational(${n}, ${m})**3`,
    concepts: [
      '닮음비가 $m:n$ 이면 부피의 비는 $m^3:n^3$ 이에요.',
      '가로·세로·높이가 모두 늘어나니 세 번 곱해져요.',
    ],
    steps: [
      { title: '부피의 비', body: `$$${m}^3:${n}^3=${m ** 3}:${n ** 3}$$` },
      {
        title: '큰 부피 구하기',
        body: `$$${small}\\times\\frac{${n ** 3}}{${m ** 3}}=${big}$$`,
      },
    ],
    tip: '부피는 닮음비를 세제곱해요. 넓이(제곱)와 헷갈리지 마세요.',
  };
}

function parallel(rng: Rng): GenProblem {
  const a = rng.int(1, 5);
  let b = rng.int(1, 5);
  if (b === a) b = a === 5 ? 4 : a + 1;
  if (rng.int(0, 1) === 0) {
    const k = rng.int(1, 4);
    const ad = a * k;
    const db = b * k;
    const j = rng.int(1, 4);
    const bc = (a + b) * j;
    const de = a * j;
    return {
      q: `$\\triangle ABC$ 에서 $\\overline{DE}\\parallel\\overline{BC}$ 이고 점 $D$ 는 $\\overline{AB}$ 위, 점 $E$ 는 $\\overline{AC}$ 위에 있어요. $\\overline{AD}=${ad}$ cm, $\\overline{DB}=${db}$ cm, $\\overline{BC}=${bc}$ cm 일 때 $\\overline{DE}$ 는 몇 cm 인가요?`,
      choices: null,
      answer: String(de),
      answerTex: `$${de}$ cm`,
      answerType: 'int',
      check: `${bc}*Rational(${ad}, ${ad}+${db})`,
      concepts: [
        '$\\overline{DE}\\parallel\\overline{BC}$ 이면 $\\triangle ADE\\sim\\triangle ABC$ (AA 닮음)예요.',
        '$\\overline{AD}:\\overline{AB}=\\overline{DE}:\\overline{BC}$',
      ],
      steps: [
        { title: '전체 변 구하기', body: `$$\\overline{AB}=${ad}+${db}=${ad + db}$$` },
        { title: '비례식 세우기', body: `$$${ad}:${ad + db}=\\overline{DE}:${bc}$$` },
        {
          title: '길이 구하기',
          body: `$$\\overline{DE}=${bc}\\times\\frac{${ad}}{${ad + db}}=${de}$$`,
        },
      ],
      tip: 'DE 와 짝인 것은 AB 전체예요. DB 와 비교하면 틀려요.',
    };
  }
  const k = rng.int(1, 3);
  const j = rng.int(1, 4);
  const ad = a * k;
  const db = b * k;
  const ae = a * j;
  const ec = b * j;
  return {
    q: `$\\triangle ABC$ 에서 $\\overline{DE}\\parallel\\overline{BC}$ 이고 점 $D$ 는 $\\overline{AB}$ 위, 점 $E$ 는 $\\overline{AC}$ 위에 있어요. $\\overline{AD}=${ad}$ cm, $\\overline{DB}=${db}$ cm, $\\overline{AE}=${ae}$ cm 일 때 $\\overline{EC}$ 는 몇 cm 인가요?`,
    choices: null,
    answer: String(ec),
    answerTex: `$${ec}$ cm`,
    answerType: 'int',
    check: `${ae}*Rational(${db}, ${ad})`,
    concepts: [
      '$\\overline{DE}\\parallel\\overline{BC}$ 이면 $\\overline{AD}:\\overline{DB}=\\overline{AE}:\\overline{EC}$',
    ],
    steps: [
      { title: '비례식 세우기', body: `$$${ad}:${db}=${ae}:\\overline{EC}$$` },
      {
        title: '길이 구하기',
        body: `$$\\overline{EC}=${ae}\\times\\frac{${db}}{${ad}}=${ec}$$`,
      },
    ],
    tip: '평행선이 두 변을 같은 비로 나눠요. 위쪽끼리, 아래쪽끼리 짝지어요.',
  };
}

function centroid(rng: Rng): GenProblem {
  const k = rng.int(2, 9);
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const am = 3 * k;
    return {
      q: `$\\triangle ABC$ 의 무게중심을 $G$, $\\overline{BC}$ 의 중점을 $M$ 이라 해요. $\\overline{AM}=${am}$ cm 일 때 $\\overline{AG}$ 는 몇 cm 인가요?`,
      choices: null,
      answer: String(2 * k),
      answerTex: `$${2 * k}$ cm`,
      answerType: 'int',
      check: `${am}*Rational(2, 3)`,
      concepts: ['무게중심은 중선을 꼭짓점 쪽에서부터 $2:1$ 로 나눠요.'],
      steps: [
        {
          title: '비 나누기',
          body: '$\\overline{AG}:\\overline{GM}=2:1$ 이니 $\\overline{AG}$ 는 중선의 $\\frac{2}{3}$ 예요.',
        },
        { title: '길이 구하기', body: `$$${am}\\times\\frac{2}{3}=${2 * k}$$` },
      ],
      tip: '꼭짓점 쪽이 긴 쪽(2)이에요.',
    };
  }
  if (kind === 1) {
    const s = 3 * k * 2;
    return {
      q: `$\\triangle ABC$ 의 넓이가 $${s}$ cm² 이고 점 $G$ 는 무게중심이에요. $\\triangle GBC$ 의 넓이는 몇 cm² 인가요?`,
      choices: null,
      answer: String(s / 3),
      answerTex: `$${s / 3}$ cm²`,
      answerType: 'int',
      check: `${s}*Rational(1, 3)`,
      concepts: ['무게중심과 세 꼭짓점을 이으면 넓이가 같은 삼각형 3개로 나뉘어요.'],
      steps: [
        {
          title: '세 조각',
          body: '$\\triangle GAB$, $\\triangle GBC$, $\\triangle GCA$ 의 넓이가 모두 같아요.',
        },
        { title: '넓이 구하기', body: `$$${s}\\div3=${s / 3}$$` },
      ],
      tip: '세 중선을 다 그으면 넓이가 같은 조각 6개가 생겨요.',
    };
  }
  const s = 6 * k;
  return {
    q: `$\\triangle ABC$ 의 넓이가 $${s}$ cm² 예요. 무게중심 $G$ 와 $\\overline{BC}$ 의 중점 $M$ 에 대하여 $\\triangle GBM$ 의 넓이는 몇 cm² 인가요?`,
    choices: null,
    answer: String(k),
    answerTex: `$${k}$ cm²`,
    answerType: 'int',
    check: `${s}*Rational(1, 6)`,
    concepts: ['세 중선은 삼각형을 넓이가 같은 조각 6개로 나눠요.'],
    steps: [
      { title: '조각 수', body: '$\\triangle GBM$ 은 넓이가 같은 6조각 중 하나예요.' },
      { title: '넓이 구하기', body: `$$${s}\\div6=${k}$$` },
    ],
    tip: '$\\triangle GBC$ 의 절반이 $\\triangle GBM$ 이에요.',
  };
}

export const generators: Generator[] = [
  { id: 'sim-side', unitId: UNIT, title: '닮음비로 변의 길이', make: side },
  { id: 'sim-area-volume', unitId: UNIT, title: '넓이·부피의 비', make: areaVolume },
  { id: 'sim-parallel', unitId: UNIT, title: '평행선과 선분의 비', make: parallel },
  { id: 'sim-centroid', unitId: UNIT, title: '삼각형의 무게중심', make: centroid },
];
