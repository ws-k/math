import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';

const UNIT = 'm3-circle';

// 답 칸은 정수·분수만 받으므로(√ 를 칠 수 없다) 현·접선 문제는 세 변이 모두 자연수인 피타고라스 수만 쓴다.
// 반지름이 30 을 넘지 않게 해 제곱을 암산할 수 있게 둔다.
const BASE: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
];

function triple(rng: Rng): [number, number, number] {
  for (;;) {
    const [a, b, c] = rng.pick(BASE);
    const k = rng.int(1, 3);
    if (c * k > 30) continue;
    // 두 다리 순서를 섞어 '짧은 쪽이 늘 거리' 라는 패턴을 외우지 않게 한다
    return rng.int(0, 1) === 0 ? [a * k, b * k, c * k] : [b * k, a * k, c * k];
  }
}

function inscribed(rng: Rng): GenProblem {
  const concepts = ['한 호에 대한 원주각의 크기는 그 호에 대한 중심각의 크기의 절반이에요.'];
  if (rng.int(0, 1) === 0) {
    const c = 2 * rng.int(15, 80);
    return {
      q: `원 O 에서 호 AB 에 대한 중심각 $\\angle\\mathrm{AOB}$ 의 크기가 $${c}^\\circ$ 예요. 호 AB 에 대한 원주각 $\\angle\\mathrm{APB}$ 의 크기는 몇 도인가요?`,
      choices: null,
      answer: String(c / 2),
      answerTex: `$${c / 2}^\\circ$`,
      answerType: 'int',
      check: `${c}*Rational(1, 2)`,
      concepts,
      steps: [
        { title: '같은 호 확인', body: '두 각이 모두 호 AB 에 대한 각이에요.' },
        { title: '절반', body: `$$${c}^\\circ\\div2=${c / 2}^\\circ$$` },
      ],
      tip: '원주각이 중심각보다 커지는 일은 없어요. 답이 더 크면 곱하고 나누는 걸 바꿨는지 봐요.',
    };
  }
  const i = rng.int(15, 85);
  return {
    q: `원 O 에서 호 AB 에 대한 원주각 $\\angle\\mathrm{APB}$ 의 크기가 $${i}^\\circ$ 예요. 호 AB 에 대한 중심각 $\\angle\\mathrm{AOB}$ 의 크기는 몇 도인가요?`,
    choices: null,
    answer: String(2 * i),
    answerTex: `$${2 * i}^\\circ$`,
    answerType: 'int',
    check: `2*${i}`,
    concepts,
    steps: [
      { title: '같은 호 확인', body: '두 각이 모두 호 AB 에 대한 각이에요.' },
      { title: '두 배', body: `$$${i}^\\circ\\times2=${2 * i}^\\circ$$` },
    ],
    tip: '중심각은 원주각의 두 배예요. 중심에서 보면 같은 호가 더 크게 벌어져 보여요.',
  };
}

function diameter(rng: Rng): GenProblem {
  const a = rng.int(15, 75);
  return {
    q: `선분 AB 가 원 O 의 지름이고 점 C 는 원 위의 점이에요. $\\angle\\mathrm{CAB}=${a}^\\circ$ 일 때 $\\angle\\mathrm{ABC}$ 의 크기는 몇 도인가요?`,
    choices: null,
    answer: String(90 - a),
    answerTex: `$${90 - a}^\\circ$`,
    answerType: 'int',
    check: `180 - 90 - ${a}`,
    concepts: [
      '지름에 대한 원주각은 $90^\\circ$ 예요. 중심각이 $180^\\circ$ 이고 그 절반이니까요.',
    ],
    steps: [
      {
        title: '직각 찾기',
        body: '지름 AB 에 대한 원주각이라 $\\angle\\mathrm{ACB}=90^\\circ$ 예요.',
      },
      { title: '삼각형 내각의 합', body: `$$180^\\circ-90^\\circ-${a}^\\circ=${90 - a}^\\circ$$` },
    ],
    tip: '지름이 보이면 그 맞은편 꼭짓점에 직각을 먼저 표시해요.',
  };
}

function cyclic(rng: Rng): GenProblem {
  let a = rng.int(55, 130);
  if (a === 90) a = 95;
  const concepts = ['원에 내접하는 사각형에서 마주 보는 두 각의 크기의 합은 $180^\\circ$ 예요.'];
  if (rng.int(0, 1) === 0) {
    return {
      q: `사각형 ABCD 가 원에 내접해요. $\\angle\\mathrm{A}=${a}^\\circ$ 일 때 $\\angle\\mathrm{C}$ 의 크기는 몇 도인가요?`,
      choices: null,
      answer: String(180 - a),
      answerTex: `$${180 - a}^\\circ$`,
      answerType: 'int',
      check: `180 - ${a}`,
      concepts,
      steps: [
        {
          title: '마주 보는 각',
          body: '$\\angle\\mathrm{A}$ 와 $\\angle\\mathrm{C}$ 는 마주 보는 각이에요.',
        },
        { title: '180° 에서 빼기', body: `$$180^\\circ-${a}^\\circ=${180 - a}^\\circ$$` },
      ],
      tip: '평행사변형처럼 마주 보는 각이 같다고 착각하기 쉬워요. 원에 내접하면 합이 180° 예요.',
    };
  }
  return {
    q: `사각형 ABCD 가 원에 내접해요. $\\angle\\mathrm{A}=${a}^\\circ$ 이고, 변 BC 의 연장선 위에 점 E 를 잡았어요. 외각 $\\angle\\mathrm{DCE}$ 의 크기는 몇 도인가요?`,
    choices: null,
    answer: String(a),
    answerTex: `$${a}^\\circ$`,
    answerType: 'int',
    check: `180 - (180 - ${a})`,
    concepts: [...concepts, '그래서 한 외각의 크기는 그와 마주 보는 내각의 크기와 같아요.'],
    steps: [
      {
        title: '마주 보는 각',
        body: `$$\\angle\\mathrm{BCD}=180^\\circ-${a}^\\circ=${180 - a}^\\circ$$`,
      },
      {
        title: '외각',
        body: `$$\\angle\\mathrm{DCE}=180^\\circ-${180 - a}^\\circ=${a}^\\circ$$`,
      },
    ],
    tip: '내접사각형의 외각은 마주 보는 내각과 같아요. 두 번 빼면 처음 각으로 돌아와요.',
  };
}

function chord(rng: Rng): GenProblem {
  const [d, h, r] = triple(rng);
  const concepts = [
    '원의 중심에서 현에 내린 수선은 그 현을 이등분해요.',
    '반지름, 중심까지의 거리, 현의 절반이 직각삼각형을 이뤄요.',
  ];
  if (rng.int(0, 1) === 0) {
    return {
      q: `반지름이 $${r}$ cm 인 원 O 의 중심에서 현 AB 까지의 거리가 $${d}$ cm 예요. 현 AB 의 길이는 몇 cm 인가요?`,
      choices: null,
      answer: String(2 * h),
      answerTex: `$${2 * h}$ cm`,
      answerType: 'int',
      check: `2*sqrt(${r}**2 - ${d}**2)`,
      concepts,
      steps: [
        {
          title: '현의 절반',
          body: `$$${r}^2-${d}^2=${r * r - d * d}\\text{ 이므로 절반}=${h}$$`,
        },
        { title: '두 배', body: `$$${h}\\times2=${2 * h}$$` },
      ],
      tip: '피타고라스 정리로 구한 값은 현의 절반이에요. 두 배 하는 걸 잊지 마세요.',
    };
  }
  return {
    q: `반지름이 $${r}$ cm 인 원 O 에 길이가 $${2 * h}$ cm 인 현 AB 가 있어요. 원의 중심 O 에서 현 AB 까지의 거리는 몇 cm 인가요?`,
    choices: null,
    answer: String(d),
    answerTex: `$${d}$ cm`,
    answerType: 'int',
    check: `sqrt(${r}**2 - (${2 * h}*Rational(1, 2))**2)`,
    concepts,
    steps: [
      { title: '현의 절반', body: `$$${2 * h}\\div2=${h}$$` },
      {
        title: '피타고라스 정리',
        body: `$$${r}^2-${h}^2=${r * r - h * h}\\text{ 이므로 거리}=${d}$$`,
      },
    ],
    tip: '현 전체 길이를 그대로 넣으면 빗변보다 긴 변이 생겨 계산이 안 맞아요.',
  };
}

function tangent(rng: Rng): GenProblem {
  const [r, t, c] = triple(rng);
  const concepts = [
    '원의 접선은 접점을 지나는 반지름과 수직이에요.',
    '그래서 중심, 접점, 원 밖의 점이 직각삼각형을 이뤄요.',
  ];
  if (rng.int(0, 1) === 0) {
    return {
      q: `원 밖의 점 P 에서 반지름이 $${r}$ cm 인 원 O 에 접선을 그어 접점을 T 라 했어요. $\\overline{\\mathrm{OP}}=${c}$ cm 일 때 접선의 길이 $\\overline{\\mathrm{PT}}$ 는 몇 cm 인가요?`,
      choices: null,
      answer: String(t),
      answerTex: `$${t}$ cm`,
      answerType: 'int',
      check: `sqrt(${c}**2 - ${r}**2)`,
      concepts,
      steps: [
        {
          title: '직각 찾기',
          body: '$\\angle\\mathrm{OTP}=90^\\circ$ 이고 빗변은 $\\overline{\\mathrm{OP}}$ 예요.',
        },
        {
          title: '피타고라스 정리',
          body: `$$${c}^2-${r}^2=${c * c - r * r}\\text{ 이므로 }\\overline{\\mathrm{PT}}=${t}$$`,
        },
      ],
      tip: '빗변은 직각과 마주 보는 OP 예요. 반지름과 접선이 직각을 껴요.',
    };
  }
  return {
    q: `원 밖의 점 P 에서 반지름이 $${r}$ cm 인 원 O 에 그은 접선의 길이가 $${t}$ cm 예요. 점 P 에서 원의 중심 O 까지의 거리는 몇 cm 인가요?`,
    choices: null,
    answer: String(c),
    answerTex: `$${c}$ cm`,
    answerType: 'int',
    check: `sqrt(${r}**2 + ${t}**2)`,
    concepts,
    steps: [
      { title: '직각 찾기', body: '반지름과 접선이 접점에서 직각을 이뤄요.' },
      {
        title: '피타고라스 정리',
        body: `$$${r}^2+${t}^2=${r * r + t * t}\\text{ 이므로 }\\overline{\\mathrm{OP}}=${c}$$`,
      },
    ],
    tip: '구하는 OP 가 빗변이라 이번에는 더해요.',
  };
}

export const generators: Generator[] = [
  { id: 'cprop-inscribed', unitId: UNIT, title: '원주각과 중심각', make: inscribed },
  { id: 'cprop-diameter', unitId: UNIT, title: '지름에 대한 원주각', make: diameter },
  { id: 'cprop-cyclic', unitId: UNIT, title: '원에 내접하는 사각형', make: cyclic },
  { id: 'cprop-chord', unitId: UNIT, title: '현의 수직이등분선', make: chord },
  { id: 'cprop-tangent', unitId: UNIT, title: '접선의 길이', make: tangent },
];
