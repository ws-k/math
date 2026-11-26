import type { Generator } from './types.ts';
import { fracAns, fracTex, ieyo, reduce } from './util.ts';

const UNIT = 'calc-trig-limit-diff';

// 극한 문제의 검산식은 sympy limit 으로 원래 식을 직접 보낸다. 풀이는 "sin(ax)/(ax) 모양 만들기"로
// 쓰므로, 풀이에서 곱해 줄 계수를 잘못 맞추면 sympy 가 계산한 실제 극한과 어긋나 검산에서 잡힌다.
// 미분 문제는 diff(...).subs(x, 각) 으로 원래 함수를 미분해 대조한다(풀이의 도함수를 믿지 않으려고).

/** 3 → "3x", 1 → "x" (삼각함수 안쪽·분모의 계수) */
const kx = (k: number) => (k === 1 ? 'x' : `${k}x`);

/** 분수 × π 의 TeX: 1/2 → \frac{\pi}{2}, 3/2 → \frac{3\pi}{2}, 1 → \pi, 0 → 0 */
function piTex(n: number, d: number): string {
  if (n === 0) return '0';
  const r = reduce(n, d);
  const a = Math.abs(r.n);
  const sign = r.n < 0 ? '-' : '';
  if (r.d === 1) return `${sign}${a === 1 ? '' : a}\\pi`;
  return `${sign}\\frac{${a === 1 ? '' : a}\\pi}{${r.d}}`;
}

/** [[3,'\\sin x'],[-2,'\\cos x'],[1,'x']] → "3\sin x-2\cos x+x" (0 인 항은 뺀다) */
function lin(terms: [number, string][]): string {
  return terms
    .filter(([c]) => c !== 0)
    .map(([c, t], i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      const a = Math.abs(c);
      // 상수항(t 가 빈 글자)은 1 이어도 숫자를 적어야 한다
      return `${sign}${a === 1 && t !== '' ? '' : a}${t}`;
    })
    .join('');
}

const SIN_LIM = '$\\displaystyle\\lim_{x\\to0}\\frac{\\sin x}{x}=1$ ($x$ 는 라디안)';
const TAN_LIM = '$\\displaystyle\\lim_{x\\to0}\\frac{\\tan x}{x}=1$';
const SHAPE =
  '안쪽의 $ax$ 를 분모에도 똑같이 만들어 주면 $\\frac{\\sin ax}{ax}\\to1$ 을 쓸 수 있어요.';
const D_SIN = "$(\\sin x)'=\\cos x$, $(\\cos x)'=-\\sin x$";
const PRODUCT = "곱의 미분법: $\\{f(x)g(x)\\}'=f'(x)g(x)+f(x)g'(x)$";

/** 특수각(π 의 몇 배인지 [분자, 분모])과 그 cos·sin 값 [분자, 분모] — 모두 유리수인 각만 */
const AXIS: { at: [number, number]; cos: number; sin: number }[] = [
  { at: [0, 1], cos: 1, sin: 0 },
  { at: [1, 2], cos: 0, sin: 1 },
  { at: [1, 1], cos: -1, sin: 0 },
  { at: [3, 2], cos: 0, sin: -1 },
];

/** sin²θ·cos²θ 가 유리수인 각(√3/2 같은 값도 제곱하면 유리수가 된다): [π 배수, sin², cos²] */
const SQ: { at: [number, number]; s2: [number, number]; c2: [number, number] }[] = [
  { at: [1, 6], s2: [1, 4], c2: [3, 4] },
  { at: [1, 3], s2: [3, 4], c2: [1, 4] },
  { at: [1, 2], s2: [1, 1], c2: [0, 1] },
  { at: [2, 3], s2: [3, 4], c2: [1, 4] },
  { at: [5, 6], s2: [1, 4], c2: [3, 4] },
];

export const generators: Generator[] = [
  {
    id: 'calc-trig-limit-diff-sin-ratio',
    unitId: UNIT,
    title: '$\\frac{\\sin ax}{bx}$ 꼴의 극한',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 6);
        const b = rng.int(1, 6);
        if (a === b) continue;
        const form = rng.int(0, 3);
        const ans = fracAns(a, b);
        const ansTex = fracTex(a, b);
        const A = kx(a);
        const B = kx(b);
        // 네 꼴 모두 극한은 a/b 이고, 풀이는 '안쪽과 같은 것을 분모에 만든다'는 같은 생각으로 간다
        const [num, den, numSym, denSym] = [
          [`\\sin ${A}`, B, `sin(${a}*x)`, `(${b}*x)`],
          [`\\sin ${A}`, `\\sin ${B}`, `sin(${a}*x)`, `sin(${b}*x)`],
          [`\\tan ${A}`, B, `tan(${a}*x)`, `(${b}*x)`],
          [`\\sin ${A}`, `\\tan ${B}`, `sin(${a}*x)`, `tan(${b}*x)`],
        ][form] as [string, string, string, string];
        const top = form === 2 ? `\\frac{\\tan ${A}}{${A}}` : `\\frac{\\sin ${A}}{${A}}`;
        const bottom =
          form === 1
            ? `\\cdot\\frac{${B}}{\\sin ${B}}`
            : form === 3
              ? `\\cdot\\frac{${B}}{\\tan ${B}}`
              : '';
        // x 는 약분되므로 마지막 계수는 숫자로만 적는다(b=1 이면 분수 대신 정수)
        const ratio = b === 1 ? String(a) : `\\frac{${a}}{${b}}`;
        return {
          q: `$\\displaystyle\\lim_{x\\to0}\\frac{${num}}{${den}}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `limit(${numSym}/${denSym}, x, 0)`,
          concepts: [SIN_LIM, TAN_LIM, SHAPE],
          steps: [
            {
              title: '모양 맞추기',
              body: `안쪽의 $${A}$ 를 분모에도 만들어 줘요.\n$$\\frac{${num}}{${den}}=${top}${bottom}\\cdot\\frac{${A}}{${B}}$$`,
            },
            {
              title: '각 부분의 극한',
              body: `$x\\to0$ 이면 $${A}\\to0$${b === 1 ? '' : `, $${B}\\to0$`} 이므로 분수 모양 부분은 모두 $1$ 로 가요.`,
            },
            {
              title: '답',
              body: `$$1\\cdot${ratio}=${ansTex}$$`,
            },
          ],
          tip: `$x\\to0$ 근처에서는 $\\sin ${A}$, $\\tan ${A}$ 가 거의 $${A}$ 와 같아요. 그래서 삼각함수를 지우고 $\\frac{${A}}{${B}}$ 로 어림하면 답이 바로 보여요.`,
        };
      }
    },
  },
  {
    id: 'calc-trig-limit-diff-one-minus-cos',
    unitId: UNIT,
    title: '$1-\\cos ax$ 가 든 극한',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 4);
        const b = rng.int(1, 4);
        const form = rng.int(0, 1);
        // (1-cos ax)/(b x^2) 와 (1-cos ax)/(x sin bx) 는 둘 다 a^2/(2b) 로 간다
        const n = a * a;
        const ans = fracAns(n, 2 * b);
        if (ans === '1') continue;
        const A = kx(a);
        const den = form === 0 ? `${b === 1 ? '' : b}x^2` : `x\\sin ${kx(b)}`;
        const denSym = form === 0 ? `(${b}*x**2)` : `(x*sin(${b}*x))`;
        const sq = `\\sin^2 ${A}`;
        const nb = b === 1 ? String(n) : `\\frac{${n}}{${b}}`;
        const split =
          form === 0
            ? `\\left(\\frac{\\sin ${A}}{${A}}\\right)^2\\cdot${nb}\\cdot\\frac{1}{1+\\cos ${A}}`
            : `\\left(\\frac{\\sin ${A}}{${A}}\\right)^2\\cdot\\frac{${kx(b)}}{\\sin ${kx(b)}}\\cdot${nb}\\cdot\\frac{1}{1+\\cos ${A}}`;
        return {
          q: `$\\displaystyle\\lim_{x\\to0}\\frac{1-\\cos ${A}}{${den}}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `limit((1 - cos(${a}*x))/${denSym}, x, 0)`,
          concepts: [SIN_LIM, '$1-\\cos^2\\theta=\\sin^2\\theta$', SHAPE],
          steps: [
            {
              title: '켤레식 곱하기',
              body: `분자·분모에 $1+\\cos ${A}$ 를 곱하면 분자가 $1-\\cos^2 ${A}=${sq}$ 가 돼요.\n$$\\frac{${sq}}{${den}(1+\\cos ${A})}$$`,
            },
            {
              title: '모양 맞추기',
              body: `$\\frac{\\sin ${A}}{${A}}$ 를 두 번 만들어 줘요.\n$$${split}$$`,
            },
            {
              title: '각 부분의 극한',
              body: `분수 모양 부분은 $1$ 로, $1+\\cos ${A}$ 는 $2$ 로 가요.`,
            },
            {
              title: '답',
              body: `$$1\\cdot${nb}\\cdot\\frac12=${fracTex(n, 2 * b)}$$`,
            },
          ],
          tip: `$x\\to0$ 근처에서 $1-\\cos ${A}$ 는 $\\frac12${a === 1 ? 'x^2' : `(${A})^2`}$ 처럼 행동해요${form === 1 ? `. 분모의 $x\\sin ${kx(b)}$ 는 $${b === 1 ? '' : b}x^2$ 처럼 행동하니` : '. 그래서'} 어림한 $\\frac{${n}}{2}\\div${b}$ 도 같은 값이에요.`,
        };
      }
    },
  },
  {
    id: 'calc-trig-limit-diff-sin-cos-value',
    unitId: UNIT,
    title: '$a\\sin x+b\\cos x$ 의 미분계수',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-5, 5);
        const q = rng.nonzero(-5, 5);
        const r = rng.int(-3, 3);
        const ang = rng.pick(AXIS);
        const ans = p * ang.cos - q * ang.sin + r;
        if (ans === 0) continue;
        const th = piTex(...ang.at);
        const f = lin([
          [p, '\\sin x'],
          [q, '\\cos x'],
          [r, 'x'],
        ]);
        const fd = lin([
          [p, '\\cos x'],
          [-q, '\\sin x'],
          [r, ''],
        ]);
        const fdAt = lin([
          [p, `\\cos ${th}`],
          [-q, `\\sin ${th}`],
          [r, ''],
        ]);
        const atSym = `${ang.at[0]}*pi/${ang.at[1]}`;
        const sym = `${p}*sin(x) + ${q}*cos(x) + ${r}*x`;
        return {
          q: `함수 $f(x)=${f}$ 에 대하여 $f'\\left(${th}\\right)$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff(${sym}, x).subs(x, ${atSym})`,
          concepts: [D_SIN, "$(ax)'=a$, 상수의 도함수는 $0$"],
          steps: [
            {
              title: '항마다 미분하기',
              body: `$(\\sin x)'=\\cos x$, $(\\cos x)'=-\\sin x$ 이므로\n$$f'(x)=${fd}$$`,
            },
            {
              title: `$x=${th}$ 에서의 값`,
              body: `$\\cos ${th}=${ang.cos}$, $\\sin ${th}=${ang.sin}$ ${ieyo(ang.sin)}.`,
            },
            {
              title: '대입하기',
              body: `$$f'\\left(${th}\\right)=${fdAt}=${ans}$$`,
            },
          ],
          tip: `$\\cos x$ 를 미분할 때 붙는 마이너스를 빠뜨리면 $${lin([[-q, '\\sin x']])}$ 대신 $${lin([[q, '\\sin x']])}$ 가 돼서 답이 달라져요.`,
        };
      }
    },
  },
  {
    id: 'calc-trig-limit-diff-product',
    unitId: UNIT,
    title: '삼각함수의 곱의 미분계수',
    make(rng) {
      for (;;) {
        const k = rng.nonzero(-4, 4);
        if (rng.int(0, 1) === 0) {
          // k sin x cos x: f' = k(cos²x - sin²x). 제곱이 유리수인 각만 써서 √3 이 남지 않게 한다
          const ang = rng.pick(SQ);
          const [cn, cd] = ang.c2;
          const [sn, sd] = ang.s2;
          const diffN = cn * sd - sn * cd;
          const diffD = cd * sd;
          const ansN = k * diffN;
          if (ansN === 0) continue;
          const th = piTex(...ang.at);
          const K = k === 1 ? '' : k === -1 ? '-' : String(k);
          const inner = '\\cos x\\cdot\\cos x+\\sin x\\cdot(-\\sin x)';
          return {
            q: `함수 $f(x)=${K}\\sin x\\cos x$ 에 대하여 $f'\\left(${th}\\right)$ 의 값을 구하세요.`,
            choices: null,
            answer: fracAns(ansN, diffD),
            answerType: 'fraction',
            check: `diff(${k}*sin(x)*cos(x), x).subs(x, ${ang.at[0]}*pi/${ang.at[1]})`,
            concepts: [D_SIN, PRODUCT],
            steps: [
              {
                title: '곱의 미분법',
                body: `앞 미분 × 뒤 그대로 + 앞 그대로 × 뒤 미분이에요.\n$$f'(x)=${K === '' ? inner : `${K}\\{${inner}\\}`}=${K}(\\cos^2x-\\sin^2x)$$`,
              },
              {
                title: `$x=${th}$ 에서의 제곱 값`,
                body: `$\\cos^2 ${th}=${fracTex(cn, cd)}$, $\\sin^2 ${th}=${fracTex(sn, sd)}$ ${ieyo(sn, sd)}.`,
              },
              {
                title: '대입하기',
                body: `$$f'\\left(${th}\\right)=${K}\\left(${fracTex(cn, cd)}-${fracTex(sn, sd)}\\right)=${fracTex(ansN, diffD)}$$`,
              },
            ],
            tip: `$\\cos^2x-\\sin^2x=\\cos 2x$ 이므로 $f'(x)=${K}\\cos 2x$ 로 보고 $\\cos\\left(2\\cdot${th}\\right)$ 를 넣어도 같아요.`,
          };
        }
        // k sin²x 또는 k cos²x: f' = ±2k sin x cos x. sin x cos x 가 ±1/2 인 각만 쓴다
        const isSin = rng.int(0, 1) === 0;
        const ang = rng.pick([
          { at: [1, 4] as [number, number], sc: 1 },
          { at: [3, 4] as [number, number], sc: -1 },
        ]);
        // 2·sin x·cos x 의 값 = sc (π/4 에서 2·(√2/2)² = 1)
        const ans = (isSin ? 2 : -2) * k * (ang.sc / 2);
        const th = piTex(...ang.at);
        const K = k === 1 ? '' : k === -1 ? '-' : String(k);
        const fn = isSin ? '\\sin' : '\\cos';
        const d = isSin ? `${2 * k}\\sin x\\cos x` : `${-2 * k}\\sin x\\cos x`;
        const cosv = ang.sc === 1 ? '\\frac{\\sqrt2}{2}' : '-\\frac{\\sqrt2}{2}';
        return {
          q: `함수 $f(x)=${K}${fn}^2x$ 에 대하여 $f'\\left(${th}\\right)$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff(${k}*${isSin ? 'sin' : 'cos'}(x)**2, x).subs(x, ${ang.at[0]}*pi/${ang.at[1]})`,
          concepts: [D_SIN, PRODUCT],
          steps: [
            {
              title: '곱으로 보기',
              body: `$${fn}^2x=${fn} x\\cdot${fn} x$ 이므로 곱의 미분법을 써요.`,
            },
            {
              title: '곱의 미분법',
              body: isSin
                ? `$$f'(x)=${K}(\\cos x\\sin x+\\sin x\\cos x)=${d}$$`
                : `$$f'(x)=${K}\\{(-\\sin x)\\cos x+\\cos x(-\\sin x)\\}=${d}$$`,
            },
            {
              title: `$x=${th}$ 에서의 값`,
              body: `$\\sin ${th}=\\frac{\\sqrt2}{2}$, $\\cos ${th}=${cosv}$ 이므로 $\\sin ${th}\\cos ${th}=${ang.sc === 1 ? '\\frac12' : '-\\frac12'}$ 이에요.`,
            },
            {
              title: '대입하기',
              body: `$$f'\\left(${th}\\right)=${isSin ? 2 * k : -2 * k}\\cdot${ang.sc === 1 ? '\\frac12' : '\\left(-\\frac12\\right)'}=${ans}$$`,
            },
          ],
          tip: `$(${fn}^2x)'$ 을 $2${fn} x$ 로 끝내면 안 돼요. 안쪽 $${fn} x$ 도 미분해서 곱해야 해요.`,
        };
      }
    },
  },
];
