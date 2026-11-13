import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';

const UNIT = 'e-cuboid';

// 수 뒤에는 늘 단위를 붙인다. '센티미터'가 모음으로 끝나 조사가 수와 상관없이 하나로 정해진다
const cm = (n: number) => `$${n}$ cm`;
const cm2 = (n: number) => `$${n}$ cm²`;
const cm3 = (n: number) => `$${n}$ cm³`;

/** 서로 다른 세 모서리(가로·세로·높이) — 정육면체와 헷갈리지 않게 같은 수를 피한다 */
function edges(rng: Rng, lo: number, hi: number): [number, number, number] {
  for (;;) {
    const a = rng.int(lo, hi);
    const b = rng.int(lo, hi);
    const c = rng.int(lo, hi);
    if (a !== b && b !== c && a !== c) return [a, b, c];
  }
}
const box = (a: number, b: number, c: number) =>
  `가로 ${cm(a)}, 세로 ${cm(b)}, 높이 ${cm(c)}인 직육면체`;

function volume(rng: Rng): GenProblem {
  const [a, b, c] = edges(rng, 2, 12);
  const base = a * b;
  return {
    q: `${box(a, b, c)}의 부피는 몇 cm³인가요?`,
    choices: null,
    answer: String(base * c),
    answerTex: cm3(base * c),
    answerType: 'int',
    check: `${a}*${b}*${c}`,
    concepts: [
      '부피는 한 모서리가 1 cm 인 쌓기나무(1 cm³)가 몇 개 들어가는지예요.',
      '직육면체의 부피 = 가로 × 세로 × 높이',
    ],
    steps: [
      {
        title: '한 층에 놓이는 개수',
        body: `밑면에 가로 $${a}$개씩 $${b}$줄을 놓아요.\n$$${a}\\times${b}=${base}$$`,
      },
      {
        title: '층 수만큼 곱하기',
        body: `높이가 ${cm(c)}이니 $${c}$층을 쌓아요.\n$$${base}\\times${c}=${base * c}$$`,
      },
    ],
    tip: '부피의 단위는 cm³ 예요. 길이를 세 번 곱했으니 단위도 세 번 곱한 꼴이에요.',
  };
}

function surface(rng: Rng): GenProblem {
  const [a, b, c] = edges(rng, 2, 10);
  const top = a * b;
  const front = a * c;
  const side = b * c;
  const half = top + front + side;
  return {
    q: `${box(a, b, c)}의 겉넓이는 몇 cm²인가요?`,
    choices: null,
    answer: String(half * 2),
    answerTex: cm2(half * 2),
    answerType: 'int',
    check: `2*(${a}*${b} + ${a}*${c} + ${b}*${c})`,
    concepts: [
      '겉넓이는 여섯 면의 넓이를 모두 더한 값이에요.',
      '마주 보는 두 면은 모양과 크기가 같아서, 서로 다른 세 면을 더해 2를 곱해요.',
    ],
    steps: [
      { title: '윗면 넓이', body: `$$${a}\\times${b}=${top}$$` },
      { title: '앞면 넓이', body: `$$${a}\\times${c}=${front}$$` },
      { title: '옆면 넓이', body: `$$${b}\\times${c}=${side}$$` },
      { title: '세 면 더하기', body: `$$${top}+${front}+${side}=${half}$$` },
      {
        title: '두 배 하기',
        body: `마주 보는 면이 하나씩 더 있어요.\n$$${half}\\times2=${half * 2}$$`,
      },
    ],
    tip: '세 면만 더하고 멈추면 겉넓이의 반이에요. 면은 모두 여섯 개예요.',
  };
}

function cube(rng: Rng): GenProblem {
  const e = rng.int(2, 12);
  const face = e * e;
  if (rng.int(0, 1) === 0) {
    return {
      q: `한 모서리가 ${cm(e)}인 정육면체의 부피는 몇 cm³인가요?`,
      choices: null,
      answer: String(face * e),
      answerTex: cm3(face * e),
      answerType: 'int',
      check: `${e}**3`,
      concepts: [
        '정육면체는 모든 모서리의 길이가 같은 직육면체예요.',
        '정육면체의 부피 = 한 모서리 × 한 모서리 × 한 모서리',
      ],
      steps: [
        { title: '한 면의 넓이', body: `$$${e}\\times${e}=${face}$$` },
        { title: '높이만큼 쌓기', body: `$$${face}\\times${e}=${face * e}$$` },
      ],
      tip: '모서리에 3을 곱하는 것이 아니라 모서리를 세 번 곱해요.',
    };
  }
  return {
    q: `한 모서리가 ${cm(e)}인 정육면체의 겉넓이는 몇 cm²인가요?`,
    choices: null,
    answer: String(face * 6),
    answerTex: cm2(face * 6),
    answerType: 'int',
    check: `6*${e}*${e}`,
    concepts: [
      '정육면체의 여섯 면은 모두 같은 정사각형이에요.',
      '정육면체의 겉넓이 = 한 면의 넓이 × 6',
    ],
    steps: [
      { title: '한 면의 넓이', body: `$$${e}\\times${e}=${face}$$` },
      { title: '여섯 면 더하기', body: `$$${face}\\times6=${face * 6}$$` },
    ],
    tip: '옆면 네 개만 세면 위·아래 면이 빠져요. 상자를 떠올려 면을 여섯 개 다 세요.',
  };
}

function missingEdge(rng: Rng): GenProblem {
  const [a, b, c] = edges(rng, 2, 10);
  const v = a * b * c;
  return {
    q: `부피가 ${cm3(v)}인 직육면체가 있어요. 가로가 ${cm(a)}, 세로가 ${cm(b)}이면 높이는 몇 cm인가요?`,
    choices: null,
    answer: String(c),
    answerTex: cm(c),
    answerType: 'int',
    check: `solve(Eq(${a}*${b}*h, ${v}), h)[0]`,
    concepts: [
      '부피 = 가로 × 세로 × 높이',
      '한 층에 놓이는 개수로 전체 개수를 나누면 층 수(높이)가 나와요.',
    ],
    steps: [
      { title: '한 층의 부피', body: `$$${a}\\times${b}=${a * b}$$` },
      { title: '층 수 구하기', body: `$$${v}\\div${a * b}=${c}$$` },
    ],
    tip: `확인: $${a}\\times${b}\\times${c}=${v}$ 이 나오면 맞아요.`,
  };
}

export const generators: Generator[] = [
  { id: 'cuboid-volume', unitId: UNIT, title: '직육면체의 부피', make: volume },
  { id: 'cuboid-surface', unitId: UNIT, title: '직육면체의 겉넓이', make: surface },
  { id: 'cube-volume-surface', unitId: UNIT, title: '정육면체의 부피·겉넓이', make: cube },
  {
    id: 'cuboid-missing-edge',
    unitId: UNIT,
    title: '부피로 모르는 모서리 구하기',
    make: missingEdge,
  },
];
