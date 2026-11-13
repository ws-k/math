import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, reduce } from './util.ts';

const UNIT = 'm3-trig-ratio';

// 답 칸은 정수·분수만 받으므로(√ 를 칠 수 없다) 세 변이 자연수인 피타고라스 수로 삼각형을 만든다.
// 그러면 sin·cos·tan 이 모두 분수로 떨어져서, 비를 '읽는' 연습에만 집중할 수 있다.
const BASE: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

type Fn = 'sin' | 'cos' | 'tan';
const NAME: Record<Fn, string> = { sin: '\\sin', cos: '\\cos', tan: '\\tan' };

/** 직각삼각형 ABC(∠C=90°)에서 BC=a(A 의 맞은편), AC=b(A 에 붙은 변), AB=c(빗변) */
function triangle(rng: Rng) {
  const [p, q, c] = rng.pick(BASE);
  // 두 다리 순서를 섞어 '짧은 변이 늘 높이' 라는 패턴을 외우지 않게 한다
  return rng.int(0, 1) === 0 ? { a: p, b: q, c } : { a: q, b: p, c };
}

function ratioOf(f: Fn, t: { a: number; b: number; c: number }): [number, number] {
  if (f === 'sin') return [t.a, t.c];
  if (f === 'cos') return [t.b, t.c];
  return [t.a, t.b];
}
const WORD: Record<Fn, string> = {
  sin: '(높이) ÷ (빗변)',
  cos: '(밑변) ÷ (빗변)',
  tan: '(높이) ÷ (밑변)',
};

function ratioFromSides(rng: Rng): GenProblem {
  const t = triangle(rng);
  const k = rng.int(1, 3);
  const [a, b, c] = [t.a * k, t.b * k, t.c * k];
  const f = rng.pick<Fn>(['sin', 'cos', 'tan']);
  // 두 변만 주고 나머지 한 변은 피타고라스 정리로 구하게 해 앞 단원과 잇는다
  const hide = rng.pick(['a', 'b', 'c'] as const);
  const given = [
    hide === 'c' ? null : `$\\overline{\\mathrm{AB}}=${c}$`,
    hide === 'a' ? null : `$\\overline{\\mathrm{BC}}=${a}$`,
    hide === 'b' ? null : `$\\overline{\\mathrm{AC}}=${b}$`,
  ].filter(Boolean);
  const [n, d] = ratioOf(f, { a, b, c });
  const findStep =
    hide === 'c'
      ? { title: '빗변 구하기', body: `$$\\overline{\\mathrm{AB}}=\\sqrt{${a}^2+${b}^2}=${c}$$` }
      : hide === 'a'
        ? {
            title: '높이 구하기',
            body: `$$\\overline{\\mathrm{BC}}=\\sqrt{${c}^2-${b}^2}=${a}$$`,
          }
        : {
            title: '밑변 구하기',
            body: `$$\\overline{\\mathrm{AC}}=\\sqrt{${c}^2-${a}^2}=${b}$$`,
          };
  const check =
    hide === 'c'
      ? {
          sin: `${a}/sqrt(${a}**2+${b}**2)`,
          cos: `${b}/sqrt(${a}**2+${b}**2)`,
          tan: `${a}*Rational(1, ${b})`,
        }
      : hide === 'a'
        ? {
            sin: `sqrt(${c}**2-${b}**2)/${c}`,
            cos: `${b}*Rational(1, ${c})`,
            tan: `sqrt(${c}**2-${b}**2)/${b}`,
          }
        : {
            sin: `${a}*Rational(1, ${c})`,
            cos: `sqrt(${c}**2-${a}**2)/${c}`,
            tan: `Rational(${a}, 1)/sqrt(${c}**2-${a}**2)`,
          };
  return {
    q: `$\\angle \\mathrm{C}=90^\\circ$ 인 직각삼각형 ABC 에서 ${given.join(', ')} 일 때 $${NAME[f]} A$ 의 값을 구하세요.`,
    choices: null,
    answer: fracAns(n, d),
    answerTex: `$${fracTex(n, d)}$`,
    answerType: 'fraction',
    check: check[f],
    concepts: [
      '∠A 를 기준으로 맞은편 변이 높이, A 에 붙은 변이 밑변, 직각의 맞은편이 빗변이에요.',
      `$${NAME[f]} A$ = ${WORD[f]}`,
    ],
    steps: [
      findStep,
      { title: '비 세우기', body: `$$${NAME[f]} A=\\frac{${n}}{${d}}=${fracTex(n, d)}$$` },
    ],
    tip: '어느 각을 기준으로 보느냐에 따라 높이와 밑변이 바뀌어요. ∠A 의 맞은편부터 찾으세요.',
  };
}

function lengthFromRatio(rng: Rng): GenProblem {
  const t = triangle(rng);
  const k = rng.int(2, 4);
  const [a, b, c] = [t.a * k, t.b * k, t.c * k];
  const kind = rng.int(0, 2);
  // 비의 분수와 실제 길이의 배수 k 를 다르게 두어, '분자가 곧 길이' 라는 착각을 피하게 한다
  if (kind === 0) {
    return {
      q: `$\\angle \\mathrm{C}=90^\\circ$ 인 직각삼각형 ABC 에서 $\\overline{\\mathrm{AB}}=${c}$, $\\sin A=${fracTex(t.a, t.c)}$ 일 때 $\\overline{\\mathrm{BC}}$ 의 길이를 구하세요.`,
      choices: null,
      answer: String(a),
      answerTex: `$${a}$`,
      answerType: 'int',
      check: `${c}*Rational(${t.a}, ${t.c})`,
      concepts: [
        '$\\sin A=\\dfrac{\\overline{\\mathrm{BC}}}{\\overline{\\mathrm{AB}}}$ 이므로 $\\overline{\\mathrm{BC}}=\\overline{\\mathrm{AB}}\\sin A$ 예요.',
      ],
      steps: [
        {
          title: '식 세우기',
          body: `$$\\frac{\\overline{\\mathrm{BC}}}{${c}}=${fracTex(t.a, t.c)}$$`,
        },
        {
          title: '빗변 곱하기',
          body: `$$\\overline{\\mathrm{BC}}=${c}\\times${fracTex(t.a, t.c)}=${a}$$`,
        },
      ],
      tip: '높이 = 빗변 × sin 이에요.',
    };
  }
  if (kind === 1) {
    return {
      q: `$\\angle \\mathrm{C}=90^\\circ$ 인 직각삼각형 ABC 에서 $\\overline{\\mathrm{AB}}=${c}$, $\\cos A=${fracTex(t.b, t.c)}$ 일 때 $\\overline{\\mathrm{AC}}$ 의 길이를 구하세요.`,
      choices: null,
      answer: String(b),
      answerTex: `$${b}$`,
      answerType: 'int',
      check: `${c}*Rational(${t.b}, ${t.c})`,
      concepts: [
        '$\\cos A=\\dfrac{\\overline{\\mathrm{AC}}}{\\overline{\\mathrm{AB}}}$ 이므로 $\\overline{\\mathrm{AC}}=\\overline{\\mathrm{AB}}\\cos A$ 예요.',
      ],
      steps: [
        {
          title: '식 세우기',
          body: `$$\\frac{\\overline{\\mathrm{AC}}}{${c}}=${fracTex(t.b, t.c)}$$`,
        },
        {
          title: '빗변 곱하기',
          body: `$$\\overline{\\mathrm{AC}}=${c}\\times${fracTex(t.b, t.c)}=${b}$$`,
        },
      ],
      tip: '밑변 = 빗변 × cos 이에요.',
    };
  }
  return {
    q: `$\\angle \\mathrm{C}=90^\\circ$ 인 직각삼각형 ABC 에서 $\\overline{\\mathrm{AC}}=${b}$, $\\tan A=${fracTex(t.a, t.b)}$ 일 때 $\\overline{\\mathrm{BC}}$ 의 길이를 구하세요.`,
    choices: null,
    answer: String(a),
    answerTex: `$${a}$`,
    answerType: 'int',
    check: `${b}*Rational(${t.a}, ${t.b})`,
    concepts: [
      '$\\tan A=\\dfrac{\\overline{\\mathrm{BC}}}{\\overline{\\mathrm{AC}}}$ 이므로 $\\overline{\\mathrm{BC}}=\\overline{\\mathrm{AC}}\\tan A$ 예요.',
    ],
    steps: [
      {
        title: '식 세우기',
        body: `$$\\frac{\\overline{\\mathrm{BC}}}{${b}}=${fracTex(t.a, t.b)}$$`,
      },
      {
        title: '밑변 곱하기',
        body: `$$\\overline{\\mathrm{BC}}=${b}\\times${fracTex(t.a, t.b)}=${a}$$`,
      },
    ],
    tip: '높이 = 밑변 × tan 이에요.',
  };
}

// 곱하거나 더해도 유리수로 떨어지는 특수각 조각들. sym 은 sympy 가 각도에서 직접 계산하게 둔다
interface Atom {
  tex: string;
  sym: string;
  v: [number, number];
}
const ATOMS: Atom[] = [
  { tex: '\\sin 30^\\circ', sym: 'sin(rad(30))', v: [1, 2] },
  { tex: '\\cos 60^\\circ', sym: 'cos(rad(60))', v: [1, 2] },
  { tex: '\\tan 45^\\circ', sym: 'tan(rad(45))', v: [1, 1] },
  { tex: '\\sin 60^\\circ\\times\\cos 30^\\circ', sym: 'sin(rad(60))*cos(rad(30))', v: [3, 4] },
  { tex: '\\sin 45^\\circ\\times\\cos 45^\\circ', sym: 'sin(rad(45))*cos(rad(45))', v: [1, 2] },
  { tex: '\\tan 60^\\circ\\times\\tan 30^\\circ', sym: 'tan(rad(60))*tan(rad(30))', v: [1, 1] },
  { tex: '\\sin^2 45^\\circ', sym: 'sin(rad(45))**2', v: [1, 2] },
  { tex: '\\cos^2 30^\\circ', sym: 'cos(rad(30))**2', v: [3, 4] },
  { tex: '\\tan^2 60^\\circ', sym: 'tan(rad(60))**2', v: [3, 1] },
];

function special(rng: Rng): GenProblem {
  for (;;) {
    const x = rng.pick(ATOMS);
    const y = rng.pick(ATOMS);
    if (x === y) continue;
    const plus = rng.int(0, 1) === 0;
    const [n1, d1] = x.v;
    const [n2, d2] = y.v;
    const r = plus ? reduce(n1 * d2 + n2 * d1, d1 * d2) : reduce(n1 * d2 - n2 * d1, d1 * d2);
    if (r.n === 0) continue;
    const op = plus ? '+' : '-';
    return {
      q: `$${x.tex}${op}${y.tex}$ 의 값을 구하세요.`,
      choices: null,
      answer: fracAns(r.n, r.d),
      answerTex: `$${fracTex(r.n, r.d)}$`,
      answerType: 'fraction',
      check: `${x.sym} ${op} (${y.sym})`,
      concepts: [
        '$\\sin 30^\\circ=\\cos 60^\\circ=\\frac12$, $\\sin 60^\\circ=\\cos 30^\\circ=\\frac{\\sqrt3}{2}$, $\\sin 45^\\circ=\\cos 45^\\circ=\\frac{\\sqrt2}{2}$',
        '$\\tan 30^\\circ=\\frac{\\sqrt3}{3}$, $\\tan 45^\\circ=1$, $\\tan 60^\\circ=\\sqrt3$',
      ],
      steps: [
        { title: '앞부분', body: `$$${x.tex}=${fracTex(n1, d1)}$$` },
        { title: '뒷부분', body: `$$${y.tex}=${fracTex(n2, d2)}$$` },
        {
          title: '계산',
          body: `$$${fracTex(n1, d1)}${op}${fracTex(n2, d2)}=${fracTex(r.n, r.d)}$$`,
        },
      ],
      tip: '30°·60°는 정삼각형을 반으로 자른 삼각형(변 1 : √3 : 2), 45°는 직각이등변삼각형(1 : 1 : √2)에서 읽어요.',
    };
  }
}

function areaSin(rng: Rng): GenProblem {
  for (;;) {
    const a = rng.int(3, 16);
    const b = rng.int(3, 16);
    // sin 30° = 1/2 와 넓이의 1/2 이 겹쳐 ab/4 가 되므로, 정수 답이 되게 4 의 배수만 고른다
    if ((a * b) % 4 !== 0 || a === b) continue;
    const obtuse = rng.int(0, 1) === 1;
    const C = obtuse ? 150 : 30;
    const S = (a * b) / 4;
    return {
      q: `삼각형 ABC 에서 $\\overline{\\mathrm{BC}}=${a}$, $\\overline{\\mathrm{CA}}=${b}$, $\\angle \\mathrm{C}=${C}^\\circ$ 일 때 넓이를 구하세요.`,
      choices: null,
      answer: String(S),
      answerTex: `$${S}$`,
      answerType: 'int',
      check: obtuse
        ? `Rational(1, 2)*${a}*${b}*sin(rad(180-${C}))`
        : `Rational(1, 2)*${a}*${b}*sin(rad(${C}))`,
      concepts: obtuse
        ? ['두 변 $a$, $b$ 와 끼인각이 둔각 $C$ 이면 넓이는 $\\frac12ab\\sin(180^\\circ-C)$ 예요.']
        : ['두 변 $a$, $b$ 와 끼인각 $C$ 를 알면 넓이는 $\\frac12ab\\sin C$ 예요.'],
      steps: obtuse
        ? [
            { title: '높이에 쓰는 각', body: `$$180^\\circ-${C}^\\circ=30^\\circ$$` },
            { title: '높이', body: `$$${b}\\times\\sin 30^\\circ=${fracTex(b, 2)}$$` },
            { title: '넓이', body: `$$\\frac12\\times${a}\\times${fracTex(b, 2)}=${S}$$` },
          ]
        : [
            { title: '높이', body: `$$${b}\\times\\sin 30^\\circ=${fracTex(b, 2)}$$` },
            { title: '넓이', body: `$$\\frac12\\times${a}\\times${fracTex(b, 2)}=${S}$$` },
          ],
      tip: '높이를 빗변 × sin 으로 구한 뒤 밑변 × 높이 ÷ 2 를 한 것과 같아요.',
    };
  }
}

export const generators: Generator[] = [
  { id: 'trig-ratio-sides', unitId: UNIT, title: '세 변으로 삼각비 구하기', make: ratioFromSides },
  { id: 'trig-length', unitId: UNIT, title: '삼각비로 변의 길이 구하기', make: lengthFromRatio },
  { id: 'trig-special', unitId: UNIT, title: '30°·45°·60° 삼각비 계산', make: special },
  { id: 'trig-area', unitId: UNIT, title: '두 변과 끼인각으로 넓이', make: areaSin },
];
