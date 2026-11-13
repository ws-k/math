import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex } from './util.ts';

const UNIT = 'm1-solid-figures';

// 원기둥·원뿔·구의 겉넓이와 부피에는 π 가 남는다. 숫자판으로 π 를 칠 수 없어서 답은 'kπ' 의 k 로 받는다.
// 수 뒤에는 늘 단위(cm·cm²·cm³)를 붙여 조사가 수에 따라 바뀌지 않게 한다.
const cm = (n: number) => `$${n}$ cm`;

const DIGIT = ['', '', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
/** 3 ≤ n ≤ 29 → '칠각', '십이각' (뒤에 '기둥'·'뿔' 을 붙인다) */
function gak(n: number): string {
  const t = Math.floor(n / 10);
  const o = n % 10;
  const tens = t === 0 ? '' : `${t === 1 ? '' : DIGIT[t]}십`;
  return `${tens}${o === 1 ? '일' : DIGIT[o]}각`;
}

// 받침 있는 말(면·꼭짓점)은 '은', 없는 말(모서리)은 '는'
const TOPIC = { 면: '은', 모서리: '는', 꼭짓점: '은' } as const;

function counts(rng: Rng): GenProblem {
  const n = rng.int(3, 12);
  const prism = rng.int(0, 1) === 0;
  const kind = prism ? '기둥' : '뿔';
  const what = rng.pick(['면', '모서리', '꼭짓점'] as const);
  const name = `${gak(n)}${kind}`;
  // 각기둥: 면 n+2, 모서리 3n, 꼭짓점 2n / 각뿔: 면 n+1, 모서리 2n, 꼭짓점 n+1
  const table = prism
    ? {
        면: { v: n + 2, c: `${n}+2`, why: `옆면 $${n}$개와 밑면 $2$개예요.`, calc: `${n}+2` },
        모서리: {
          v: 3 * n,
          c: `3*${n}`,
          why: `위·아래 밑면에 $${n}$개씩, 옆에 $${n}$개예요.`,
          calc: `${n}\\times3`,
        },
        꼭짓점: {
          v: 2 * n,
          c: `2*${n}`,
          why: `위·아래 밑면에 $${n}$개씩이에요.`,
          calc: `${n}\\times2`,
        },
      }
    : {
        면: { v: n + 1, c: `${n}+1`, why: `옆면 $${n}$개와 밑면 $1$개예요.`, calc: `${n}+1` },
        모서리: {
          v: 2 * n,
          c: `2*${n}`,
          why: `밑면에 $${n}$개, 꼭대기로 모이는 옆 모서리 $${n}$개예요.`,
          calc: `${n}\\times2`,
        },
        꼭짓점: {
          v: n + 1,
          c: `${n}+1`,
          why: `밑면에 $${n}$개, 꼭대기에 $1$개예요.`,
          calc: `${n}+1`,
        },
      };
  const t = table[what];
  return {
    q: `${name}의 ${what}${TOPIC[what]} 몇 개인가요?`,
    choices: null,
    answer: String(t.v),
    answerTex: `$${t.v}$개`,
    answerType: 'int',
    check: t.c,
    concepts: [
      prism
        ? '$n$각기둥: 면 $(n+2)$개, 모서리 $3n$개, 꼭짓점 $2n$개'
        : '$n$각뿔: 면 $(n+1)$개, 모서리 $2n$개, 꼭짓점 $(n+1)$개',
    ],
    steps: [
      { title: '어디에 있는지 보기', body: t.why },
      { title: '세기', body: `$$${t.calc}=${t.v}$$` },
    ],
    tip: prism
      ? '각기둥은 위아래가 똑같은 밑면이라 밑면 하나를 세고 2배 하면 편해요.'
      : '각뿔은 밑면이 하나뿐이고 옆면은 모두 꼭대기 한 점에서 만나요.',
  };
}

function cylinder(rng: Rng): GenProblem {
  const r = rng.int(2, 9);
  const h = rng.int(2, 12);
  if (rng.int(0, 1) === 0) {
    const v = r * r * h;
    return {
      q: `밑면의 반지름이 ${cm(r)}, 높이가 ${cm(h)}인 원기둥의 부피는 $k\\pi$ cm³예요. $k$의 값을 구하세요.`,
      choices: null,
      answer: String(v),
      answerTex: `$${v}\\pi$ cm³`,
      answerType: 'int',
      check: `pi*${r}**2*${h}/pi`,
      concepts: ['기둥의 부피 = 밑넓이 × 높이', '원기둥의 밑넓이 $=\\pi r^2$'],
      steps: [
        { title: '밑넓이', body: `$$\\pi\\times${r}^2=${r * r}\\pi$$` },
        { title: '높이 곱하기', body: `$$${r * r}\\pi\\times${h}=${v}\\pi$$` },
      ],
      tip: '밑면 한 장을 높이만큼 쌓는다고 생각해요. 직육면체와 같은 원리예요.',
    };
  }
  const base = r * r;
  const side = 2 * r * h;
  const s = 2 * base + side;
  return {
    q: `밑면의 반지름이 ${cm(r)}, 높이가 ${cm(h)}인 원기둥의 겉넓이는 $k\\pi$ cm²예요. $k$의 값을 구하세요.`,
    choices: null,
    answer: String(s),
    answerTex: `$${s}\\pi$ cm²`,
    answerType: 'int',
    check: `(2*pi*${r}**2 + 2*pi*${r}*${h})/pi`,
    concepts: [
      '원기둥의 전개도는 밑면(원) 2개와 옆면(직사각형) 1개예요.',
      '옆면 직사각형의 가로는 밑면의 둘레 $2\\pi r$ 이에요.',
    ],
    steps: [
      { title: '밑면 두 개', body: `$$\\pi\\times${r}^2\\times2=${2 * base}\\pi$$` },
      {
        title: '옆면',
        body: `가로 $2\\pi\\times${r}$, 세로 $${h}$ 인 직사각형이에요.\n$$${2 * r}\\pi\\times${h}=${side}\\pi$$`,
      },
      { title: '더하기', body: `$$${2 * base}\\pi+${side}\\pi=${s}\\pi$$` },
    ],
    tip: '밑면을 하나만 더하는 실수가 많아요. 원기둥은 위아래 두 개예요.',
  };
}

function cone(rng: Rng): GenProblem {
  // 사각뿔(직사각형 밑면) 또는 원뿔. 부피 = 밑넓이 × 높이 × 1/3
  if (rng.int(0, 1) === 0) {
    let a = 0;
    let b = 0;
    let h = 0;
    do {
      a = rng.int(2, 10);
      b = rng.int(2, 10);
      h = rng.int(2, 12);
    } while ((a * b * h) % 3 !== 0);
    const v = (a * b * h) / 3;
    return {
      q: `밑면이 가로 ${cm(a)}, 세로 ${cm(b)}인 직사각형이고 높이가 ${cm(h)}인 사각뿔의 부피는 몇 cm³인가요?`,
      choices: null,
      answer: String(v),
      answerTex: `$${v}$ cm³`,
      answerType: 'int',
      check: `Rational(1,3)*${a}*${b}*${h}`,
      concepts: [
        '뿔의 부피는 밑면과 높이가 같은 기둥의 $\\frac{1}{3}$ 이에요.',
        '$V=\\frac{1}{3}Sh$',
      ],
      steps: [
        { title: '밑넓이', body: `$$${a}\\times${b}=${a * b}$$` },
        { title: '기둥이라면', body: `$$${a * b}\\times${h}=${a * b * h}$$` },
        { title: '3으로 나누기', body: `$$${a * b * h}\\div3=${v}$$` },
      ],
      tip: '뿔 모양 그릇으로 물을 세 번 부어야 같은 기둥이 가득 차요.',
    };
  }
  const r = rng.int(2, 9);
  const h = rng.int(2, 12);
  const n = r * r * h;
  return {
    q: `밑면의 반지름이 ${cm(r)}, 높이가 ${cm(h)}인 원뿔의 부피는 $k\\pi$ cm³예요. $k$의 값을 구하세요.`,
    choices: null,
    answer: fracAns(n, 3),
    answerTex: `$${fracTex(n, 3)}\\pi$ cm³`,
    answerType: 'fraction',
    check: `Rational(1,3)*pi*${r}**2*${h}/pi`,
    concepts: ['원뿔의 부피 $=\\frac{1}{3}\\times\\pi r^2\\times h$'],
    steps: [
      { title: '밑넓이', body: `$$\\pi\\times${r}^2=${r * r}\\pi$$` },
      { title: '원기둥이라면', body: `$$${r * r}\\pi\\times${h}=${n}\\pi$$` },
      { title: '3으로 나누기', body: `$$${n}\\pi\\times\\frac{1}{3}=${fracTex(n, 3)}\\pi$$` },
    ],
    tip: '$\\frac{1}{3}$ 을 빠뜨리면 원기둥의 부피가 돼요.',
  };
}

function sphere(rng: Rng): GenProblem {
  const r = rng.int(1, 9);
  if (rng.int(0, 1) === 0) {
    const n = 4 * r * r * r;
    return {
      q: `반지름이 ${cm(r)}인 구의 부피는 $k\\pi$ cm³예요. $k$의 값을 구하세요.`,
      choices: null,
      answer: fracAns(n, 3),
      answerTex: `$${fracTex(n, 3)}\\pi$ cm³`,
      answerType: 'fraction',
      check: `Rational(4,3)*pi*${r}**3/pi`,
      concepts: [
        '구의 부피 $=\\frac{4}{3}\\pi r^3$',
        '구는 꼭 맞는 원기둥 부피의 $\\frac{2}{3}$ 예요.',
      ],
      steps: [
        { title: '반지름 세제곱', body: `$$${r}^3=${r * r * r}$$` },
        {
          title: '공식에 넣기',
          body: `$$\\frac{4}{3}\\pi\\times${r * r * r}=${fracTex(n, 3)}\\pi$$`,
        },
      ],
      tip: '부피는 길이를 세 번 곱해요. 반지름을 제곱만 하면 겉넓이 쪽 식과 헷갈려요.',
    };
  }
  const s = 4 * r * r;
  return {
    q: `반지름이 ${cm(r)}인 구의 겉넓이는 $k\\pi$ cm²예요. $k$의 값을 구하세요.`,
    choices: null,
    answer: String(s),
    answerTex: `$${s}\\pi$ cm²`,
    answerType: 'int',
    check: `4*pi*${r}**2/pi`,
    concepts: ['구의 겉넓이 $=4\\pi r^2$', '반지름이 같은 원 넓이의 4배예요.'],
    steps: [
      { title: '같은 반지름 원의 넓이', body: `$$\\pi\\times${r}^2=${r * r}\\pi$$` },
      { title: '4배 하기', body: `$$${r * r}\\pi\\times4=${s}\\pi$$` },
    ],
    tip: '오렌지 껍질을 벗겨 펼치면 같은 반지름 원 네 개를 채워요.',
  };
}

export const generators: Generator[] = [
  {
    id: 'prism-pyramid-count',
    unitId: UNIT,
    title: '각기둥·각뿔의 면·모서리·꼭짓점',
    make: counts,
  },
  { id: 'cylinder-volume-surface', unitId: UNIT, title: '원기둥의 부피·겉넓이', make: cylinder },
  { id: 'pyramid-cone-volume', unitId: UNIT, title: '뿔의 부피', make: cone },
  { id: 'sphere-volume-surface', unitId: UNIT, title: '구의 부피·겉넓이', make: sphere },
];
