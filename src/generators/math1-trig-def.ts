import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd, reduce } from './util.ts';

const UNIT = 'math1-trig-def';

// 검산식은 각 θ 를 sympy 의 실제 각(예: pi - asin(3/5))으로 세우고 sin·cos·tan 을 직접 계산한다.
// 풀이는 "부호는 사분면에서, 크기는 sin²+cos²=1 에서"로 쓰므로, 풀이 쪽에서 부호를 잘못 정하면
// sympy 가 계산한 실제 값과 어긋나 검산에서 잡힌다.

/** '이에요/예요': 정수는 끝자리 소리, 분수는 '○분의 △'라 분자 끝자리 소리로 고른다 */
const ieyo = (n: number, d = 1) => {
  const r = reduce(n, d);
  return '013678'.includes(String(Math.abs(r.n)).slice(-1)) ? '이에요' : '예요';
};

/** 분수 × π 의 TeX: 1 → \pi, 2/3 → \frac{2}{3}\pi, -1 → -\pi */
function piTex(n: number, d: number): string {
  const r = reduce(n, d);
  if (r.n === 0) return '0';
  if (r.d === 1) return r.n === 1 ? '\\pi' : r.n === -1 ? '-\\pi' : `${r.n}\\pi`;
  const sign = r.n < 0 ? '-' : '';
  const a = Math.abs(r.n);
  return `${sign}\\frac{${a === 1 ? '' : a}\\pi}{${r.d}}`;
}

const RAD = '$180^\\circ=\\pi$ (라디안), 곧 $1^\\circ=\\dfrac{\\pi}{180}$';
const SECTOR_L = '반지름 $r$, 중심각 $\\theta$ (라디안)인 부채꼴의 호의 길이 $l=r\\theta$';
const SECTOR_S = '부채꼴의 넓이 $S=\\dfrac12r^2\\theta=\\dfrac12rl$';
const PYTH = '$\\sin^2\\theta+\\cos^2\\theta=1$';
const TAN = '$\\tan\\theta=\\dfrac{\\sin\\theta}{\\cos\\theta}$';
const SIGN = '양수인 것: 제1사분면 모두, 제2사분면 $\\sin$, 제3사분면 $\\tan$, 제4사분면 $\\cos$';

/** 직각삼각형 세 변(빗변이 마지막) */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
];

type F = 'sin' | 'cos' | 'tan';
/** 사분면별 부호 [sin, cos, tan] */
const SIGNS: Record<number, [number, number, number]> = {
  1: [1, 1, 1],
  2: [1, -1, -1],
  3: [-1, -1, 1],
  4: [-1, 1, -1],
};
/** 사분면 q 의 각을 기준각 a(sympy 글자)로: 제2사분면은 π−a … */
const angleSym = (q: number, a: string) =>
  q === 1 ? a : q === 2 ? `pi - ${a}` : q === 3 ? `pi + ${a}` : `2*pi - ${a}`;

/** 두 일반각이 아니라 합이 정해진 sin+cos 의 값들(|k|<√2 라야 실제 각이 있다) */
const SUMS: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [4, 5],
  [6, 5],
  [5, 4],
  [4, 3],
  [-1, 2],
  [-1, 3],
  [-2, 3],
  [-3, 4],
];

const ratSym = (n: number, d: number) => (d === 1 ? String(n) : `Rational(${n}, ${d})`);

export const generators: Generator[] = [
  {
    id: 'tdef-rad-deg',
    unitId: UNIT,
    title: '육십분법과 호도법 바꾸기',
    make(rng) {
      if (rng.int(0, 1) === 0) {
        // 도 → 라디안. 180° 는 너무 당연해서 뺀다
        let d = 180;
        while (d === 180) d = 15 * rng.int(1, 23);
        const r = reduce(d, 180);
        return {
          q: `$${d}^\\circ$ 를 호도법으로 나타내면 $a\\pi$ 예요. 상수 $a$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(d, 180),
          answerType: 'fraction',
          check: `rad(${d})/pi`,
          concepts: [RAD],
          steps: [
            {
              title: '1° 의 크기',
              body: '$180^\\circ=\\pi$ 이므로 $1^\\circ=\\dfrac{\\pi}{180}$ 이에요.',
            },
            {
              title: '곱하기',
              body: `$$${d}^\\circ=${d}\\times\\frac{\\pi}{180}=${piTex(d, 180)}$$`,
            },
            {
              title: '답',
              body: `$a=${fracTex(d, 180)}$ ${ieyo(r.n, r.d)}.`,
            },
          ],
          tip: '도에서 라디안으로 갈 때는 $\\dfrac{\\pi}{180}$ 을, 라디안에서 도로 갈 때는 $\\dfrac{180}{\\pi}$ 를 곱해요.',
        };
      }
      // 라디안 → 도. 분모가 180 의 약수여야 도가 정수로 나온다
      const q = rng.pick([2, 3, 4, 5, 6, 9, 10, 12]);
      let p = 1;
      for (;;) {
        p = rng.int(1, 2 * q - 1);
        if (gcd(p, q) === 1) break;
      }
      const deg = (180 * p) / q;
      return {
        q: `$${piTex(p, q)}$ 를 육십분법으로 나타내면 몇 도인지 구하세요.`,
        choices: null,
        answer: String(deg),
        answerType: 'int',
        check: `deg(${p}*pi/${q})`,
        concepts: [RAD],
        steps: [
          { title: 'π 를 180° 로', body: '$\\pi=180^\\circ$ 를 그대로 넣어요.' },
          {
            title: '계산하기',
            body: `$$${piTex(p, q)}=\\frac{${p === 1 ? '' : `${p}\\times`}180^\\circ}{${q}}=${deg}^\\circ$$`,
          },
        ],
        tip: `$\\pi$ 자리에 $180^\\circ$ 를 넣는다고 생각하면 빨라요. 답은 $${deg}$ 도예요.`,
      };
    },
  },
  {
    id: 'tdef-sector',
    unitId: UNIT,
    title: '부채꼴의 호의 길이와 넓이',
    make(rng) {
      const r = rng.int(2, 12);
      const q = rng.pick([2, 3, 4, 6]);
      let p = 1;
      for (;;) {
        p = rng.int(1, 2 * q - 1);
        if (gcd(p, q) === 1) break;
      }
      const th = piTex(p, q);
      if (rng.int(0, 1) === 0) {
        const a = reduce(r * p, q);
        return {
          q: `반지름의 길이가 $${r}$, 중심각의 크기가 $${th}$ 인 부채꼴의 호의 길이는 $a\\pi$ 예요. 상수 $a$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(r * p, q),
          answerType: 'fraction',
          check: `(${r}*${p}*pi/${q})/pi`,
          concepts: [SECTOR_L],
          steps: [
            { title: '공식 고르기', body: '중심각이 라디안이면 호의 길이는 $l=r\\theta$ 예요.' },
            { title: '넣기', body: `$$l=${r}\\times${th}=${piTex(r * p, q)}$$` },
            { title: '답', body: `$a=${fracTex(a.n, a.d)}$ ${ieyo(a.n, a.d)}.` },
          ],
          tip: '라디안은 "반지름 몇 개만큼의 호인가"라서 반지름을 곱하면 바로 호의 길이가 나와요.',
        };
      }
      const s = reduce(r * r * p, 2 * q);
      return {
        q: `반지름의 길이가 $${r}$, 중심각의 크기가 $${th}$ 인 부채꼴의 넓이는 $a\\pi$ 예요. 상수 $a$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(r * r * p, 2 * q),
        answerType: 'fraction',
        check: `(Rational(1, 2)*${r}**2*${p}*pi/${q})/pi`,
        concepts: [SECTOR_S],
        steps: [
          {
            title: '공식 고르기',
            body: '중심각이 라디안이면 넓이는 $S=\\dfrac12r^2\\theta$ 예요.',
          },
          {
            title: '넣기',
            body: `$$S=\\frac12\\times${r}^2\\times${th}=${piTex(r * r * p, 2 * q)}$$`,
          },
          { title: '답', body: `$a=${fracTex(s.n, s.d)}$ ${ieyo(s.n, s.d)}.` },
        ],
        tip: '원의 넓이 $\\pi r^2$ 에 "원 전체 $2\\pi$ 중 $\\theta$ 만큼"인 $\\dfrac{\\theta}{2\\pi}$ 를 곱한 것과 같아요.',
      };
    },
  },
  {
    id: 'tdef-quadrant-value',
    unitId: UNIT,
    title: '한 값과 사분면으로 나머지 구하기',
    make(rng) {
      const [x, y, h] = rng.pick(TRIPLES);
      // 기준각의 sin 이 a/h, cos 이 b/h 가 되도록 두 변의 순서를 섞는다
      const [a, b] = rng.int(0, 1) === 0 ? [x, y] : [y, x];
      const quad = rng.int(1, 4);
      const [ss, cs, ts] = SIGNS[quad] as [number, number, number];
      const given: F = rng.pick(['sin', 'cos'] as const);
      const want: F =
        given === 'sin' ? rng.pick(['cos', 'tan'] as const) : rng.pick(['sin', 'tan'] as const);
      const vals: Record<F, [number, number]> = {
        sin: [ss * a, h],
        cos: [cs * b, h],
        tan: [ts * a, b],
      };
      const [gn, gd] = vals[given];
      const [an, ad] = vals[want];
      const ref = given === 'sin' ? `asin(Rational(${a}, ${h}))` : `acos(Rational(${b}, ${h}))`;
      const other: F = given === 'sin' ? 'cos' : 'sin';
      const [on, od] = vals[other];
      const otherAbs = given === 'sin' ? b : a;
      const r = reduce(an, ad);
      const signWord = (s: number) => (s > 0 ? '양수' : '음수');
      const sOf: Record<F, number> = { sin: ss, cos: cs, tan: ts };
      const steps = [
        {
          title: '부호 정하기',
          body: `제${quad}사분면에서 $\\${other}\\theta$ 는 ${signWord(sOf[other])}${want === 'tan' ? `, $\\tan\\theta$ 는 ${signWord(ts)}` : ''}예요.`,
        },
        {
          title: '크기 구하기',
          body: `$\\sin^2\\theta+\\cos^2\\theta=1$ 에서\n$$\\${other}^2\\theta=1-\\left(${fracTex(gn, gd)}\\right)^2=\\frac{${otherAbs * otherAbs}}{${h * h}}$$`,
        },
        {
          title: `$\\${other}\\theta$ 의 값`,
          body: `부호까지 붙이면 $\\${other}\\theta=${fracTex(on, od)}$ ${ieyo(on, od)}.`,
        },
      ];
      if (want === 'tan')
        steps.push({
          title: '$\\tan\\theta$ 의 값',
          body: `$$\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}=${fracTex(an, ad)}$$`,
        });
      return {
        q: `$\\theta$ 가 제${quad}사분면의 각이고 $\\${given}\\theta=${fracTex(gn, gd)}$ 일 때, $\\${want}\\theta$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(an, ad),
        answerType: 'fraction',
        check: `${want}(${angleSym(quad, ref)})`,
        concepts: [PYTH, SIGN, ...(want === 'tan' ? [TAN] : [])],
        steps,
        tip: `크기는 $\\sin^2\\theta+\\cos^2\\theta=1$ 로, 부호는 사분면으로 따로 정해요. 답 $${fracTex(r.n, r.d)}$ 의 부호가 제${quad}사분면과 맞는지 마지막에 한 번 더 봐요.`,
      };
    },
  },
  {
    id: 'tdef-sum-product',
    unitId: UNIT,
    title: 'sin θ + cos θ 의 값으로 구하기',
    make(rng) {
      const [kn, kd] = rng.pick(SUMS);
      const k2 = reduce(kn * kn, kd * kd);
      // sinθcosθ = (k²−1)/2,  (sinθ−cosθ)² = 2 − k²
      const P = reduce(k2.n - k2.d, 2 * k2.d);
      const D = reduce(2 * k2.d - k2.n, k2.d);
      const K = fracTex(kn, kd);
      const sys = `sol = solve([Eq(p + q, ${ratSym(kn, kd)}), Eq(p**2 + q**2, 1)], [p, q])`;
      const first = {
        title: '양변 제곱하기',
        body: `$$(\\sin\\theta+\\cos\\theta)^2=\\sin^2\\theta+2\\sin\\theta\\cos\\theta+\\cos^2\\theta=${fracTex(k2.n, k2.d)}$$`,
      };
      const second = {
        title: '$\\sin^2\\theta+\\cos^2\\theta=1$ 쓰기',
        body: `$$1+2\\sin\\theta\\cos\\theta=${fracTex(k2.n, k2.d)}$$`,
      };
      const prod = {
        title: '$\\sin\\theta\\cos\\theta$ 구하기',
        body: `$$\\sin\\theta\\cos\\theta=\\frac12\\left(${fracTex(k2.n, k2.d)}-1\\right)=${fracTex(P.n, P.d)}$$`,
      };
      if (rng.int(0, 1) === 0)
        return {
          q: `$\\sin\\theta+\\cos\\theta=${K}$ 일 때, $\\sin\\theta\\cos\\theta$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(P.n, P.d),
          answerType: 'fraction',
          check: `${sys}\nans = simplify(sol[0][0]*sol[0][1])`,
          concepts: [PYTH, '$(a+b)^2=a^2+2ab+b^2$'],
          steps: [first, second, prod],
          tip: '$\\sin\\theta$, $\\cos\\theta$ 를 하나하나 구하지 않아도 돼요. 제곱하면 $\\sin^2\\theta+\\cos^2\\theta$ 가 1 로 묶여요.',
        };
      return {
        q: `$\\sin\\theta+\\cos\\theta=${K}$ 일 때, $(\\sin\\theta-\\cos\\theta)^2$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(D.n, D.d),
        answerType: 'fraction',
        check: `${sys}\nans = simplify((sol[0][0] - sol[0][1])**2)`,
        concepts: [PYTH, '$(a-b)^2=a^2-2ab+b^2$'],
        steps: [
          first,
          second,
          prod,
          {
            title: '빼서 제곱한 값',
            body: `$$(\\sin\\theta-\\cos\\theta)^2=1-2\\sin\\theta\\cos\\theta=1-2\\times\\left(${fracTex(P.n, P.d)}\\right)=${fracTex(D.n, D.d)}$$`,
          },
        ],
        tip: '$(\\sin\\theta+\\cos\\theta)^2+(\\sin\\theta-\\cos\\theta)^2=2$ 라서, 한쪽을 알면 다른 쪽은 2 에서 빼면 돼요.',
      };
    },
  },
];
