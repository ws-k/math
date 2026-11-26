import type { Generator } from './types.ts';
import {
  fracAns,
  fracTex,
  ieyo,
  jo,
  paren,
  polyDiff,
  polyEval,
  polySym,
  polyTex,
  reduce,
} from './util.ts';

const UNIT = 'calc-quotient-chain';

// 검산식은 모두 원래 함수를 sympy diff 로 미분한 뒤 대입한다. 풀이는 공식(몫·합성)에 값을 넣는 경로로 쓰므로,
// 풀이에서 부호(몫의 미분 분자 순서)나 안쪽 미분을 빠뜨리면 sympy 의 실제 미분값과 어긋나 검산에서 잡힌다.
// 손계산이 지루해지지 않게 답의 크기를 묶고, 0 이 나오면 다시 뽑는다.

/** 계산 끝의 분수: 분모 1 이면 정수, 약분되거나 음수면 기약분수까지 한 번 더 이어 쓴다 */
function fracChain(n: number, d: number): string {
  if (d === 1) return String(n);
  const r = reduce(n, d);
  const raw = `\\frac{${n}}{${d}}`;
  return r.d === d && n > 0 ? raw : `${raw}=${fracTex(n, d)}`;
}

/** 분수 × π 의 TeX: 1/2 → \frac{\pi}{2}, 3/2 → \frac{3\pi}{2}, 1 → \pi */
function piTex(n: number, d: number): string {
  const r = reduce(n, d);
  const a = Math.abs(r.n);
  const sign = r.n < 0 ? '-' : '';
  if (r.d === 1) return `${sign}${a === 1 ? '' : a}\\pi`;
  return `${sign}\\frac{${a === 1 ? '' : a}\\pi}{${r.d}}`;
}

/** 계수 c 를 식 앞에 붙일 때: 1 → "", -1 → "-", 3 → "3" */
const coef = (c: number) => (c === 1 ? '' : c === -1 ? '-' : String(c));

const QUOT =
  "몫의 미분법: $\\left\\{\\dfrac{f(x)}{g(x)}\\right\\}'=\\dfrac{f'(x)g(x)-f(x)g'(x)}{\\{g(x)\\}^2}$";
const QUOT_HINT = '"분자 미분 × 분모 − 분자 × 분모 미분", 순서를 바꾸면 부호가 뒤집혀요.';
const CHAIN = "합성함수의 미분법: $\\{f(g(x))\\}'=f'(g(x))\\,g'(x)$";
const CHAIN_HINT = '"바깥 미분(안쪽은 그대로) × 안쪽 미분"';

/** 안쪽 각 φ(π 의 몇 배)와 그때의 함숫값 [분자, 분모] — 유리수가 되는 각만 */
const COS_AT: { phi: [number, number]; v: [number, number] }[] = [
  { phi: [1, 3], v: [1, 2] },
  { phi: [2, 3], v: [-1, 2] },
  { phi: [1, 1], v: [-1, 1] },
  { phi: [4, 3], v: [-1, 2] },
  { phi: [5, 3], v: [1, 2] },
  { phi: [2, 1], v: [1, 1] },
];
const SIN_AT: { phi: [number, number]; v: [number, number] }[] = [
  { phi: [1, 6], v: [1, 2] },
  { phi: [1, 2], v: [1, 1] },
  { phi: [5, 6], v: [1, 2] },
  { phi: [7, 6], v: [-1, 2] },
  { phi: [3, 2], v: [-1, 1] },
  { phi: [11, 6], v: [-1, 2] },
];
/** 1/cos²φ */
const SEC2_AT: { phi: [number, number]; v: [number, number] }[] = [
  { phi: [1, 4], v: [2, 1] },
  { phi: [1, 3], v: [4, 1] },
  { phi: [1, 6], v: [4, 3] },
  { phi: [3, 4], v: [2, 1] },
  { phi: [2, 3], v: [4, 1] },
  { phi: [1, 1], v: [1, 1] },
];

export const generators: Generator[] = [
  {
    id: 'calc-quotient-chain-lin-lin',
    unitId: UNIT,
    title: '$\\frac{ax+b}{cx+d}$ 의 미분계수',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-4, 4);
        const b = rng.int(-5, 5);
        const c = rng.nonzero(-3, 3);
        const d = rng.nonzero(-5, 5);
        const det = a * d - b * c;
        // det=0 이면 분수가 상수로 약분돼 미분할 거리가 없다
        if (det === 0) continue;
        const k = rng.int(-2, 3);
        const v = c * k + d;
        if (v === 0 || Math.abs(v) > 4) continue;
        const N = polyTex([a, b]);
        const D = polyTex([c, d]);
        return {
          q: `함수 $f(x)=\\dfrac{${N}}{${D}}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(det, v * v),
          answerType: 'fraction',
          check: `diff((${polySym([a, b])})/(${polySym([c, d])}), x).subs(x, ${k})`,
          concepts: [QUOT, QUOT_HINT],
          steps: [
            {
              title: '분자·분모의 도함수',
              body: `$(${N})'=${a}$, $(${D})'=${c}$ ${ieyo(c)}.`,
            },
            {
              title: '몫의 미분법 적용',
              body: `$$f'(x)=\\frac{${coef(a)}(${D})-(${N})\\cdot ${paren(c)}}{(${D})^2}$$`,
            },
            {
              title: '분자 정리',
              body: `$x$ 가 있는 항은 서로 지워져요.\n$$${coef(a)}(${D})-${c === 1 ? '' : paren(c)}(${N})=${det}$$`,
            },
            {
              title: `$x=${k}$ 대입`,
              body: `$${D}$ 의 값은 $${v}$ 이므로\n$$f'(${k})=\\frac{${det}}{${paren(v)}^2}=${fracTex(det, v * v)}$$`,
            },
          ],
          tip: `$\\frac{ax+b}{cx+d}$ 꼴은 언제나 분자가 $ad-bc$ 하나로 정리돼요. 여기서는 $${a}\\cdot${paren(d)}-${paren(b)}\\cdot${paren(c)}=${det}$ ${ieyo(det)}.`,
        };
      }
    },
  },
  {
    id: 'calc-quotient-chain-quad-lin',
    unitId: UNIT,
    title: '$\\frac{x^2+p}{x+q}$ 의 미분계수',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-5, 5);
        const q = rng.nonzero(-4, 4);
        // q²+p=0 이면 분자가 x+q 로 나누어떨어져 몫의 미분을 쓸 이유가 사라진다
        if (q * q + p === 0) continue;
        const k = rng.int(-2, 3);
        const v = k + q;
        if (v === 0 || Math.abs(v) > 4) continue;
        const u = k * k + p;
        const num = 2 * k * v - u;
        if (num === 0) continue;
        const N = polyTex([1, 0, p]);
        const D = polyTex([1, q]);
        return {
          q: `함수 $f(x)=\\dfrac{${N}}{${D}}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(num, v * v),
          answerType: 'fraction',
          check: `diff((${polySym([1, 0, p])})/(${polySym([1, q])}), x).subs(x, ${k})`,
          concepts: [QUOT, QUOT_HINT],
          steps: [
            {
              title: '몫의 미분법 적용',
              body: `$(${N})'=2x$, $(${D})'=1$ 이므로\n$$f'(x)=\\frac{2x(${D})-(${N})\\cdot1}{(${D})^2}$$`,
            },
            {
              title: `$x=${k}$ 일 때 각 부분의 값`,
              body: `$2x=${2 * k}$, $${D}=${v}$, $${N}=${u}$ ${ieyo(u)}.`,
            },
            {
              title: '대입해서 계산하기',
              body: `전개하지 않고 바로 넣어요.\n$$f'(${k})=\\frac{${2 * k}\\cdot${paren(v)}-${paren(u)}}{${paren(v)}^2}=${fracChain(num, v * v)}$$`,
            },
          ],
          tip: `분자에서 빼는 순서를 바꿔 $(${N})\\cdot1-2x(${D})$ 로 쓰면 부호만 반대인 $${fracTex(-num, v * v)}$ ${jo(fracTex(-num, v * v), '이/가')} 나와요. "분자 미분이 먼저"를 기억해요.`,
        };
      }
    },
  },
  {
    id: 'calc-quotient-chain-power',
    unitId: UNIT,
    title: '$\\{g(x)\\}^n$ 의 미분계수',
    make(rng) {
      for (;;) {
        if (rng.int(0, 2) > 0) {
          // 양의 거듭제곱: 안쪽이 일차식 또는 ax²+b
          const g =
            rng.int(0, 1) === 0
              ? [rng.nonzero(-3, 3), rng.nonzero(-4, 4)]
              : [rng.nonzero(-2, 2), 0, rng.nonzero(-4, 4)];
          const n = rng.pick([3, 4]);
          const k = rng.int(-2, 2);
          const gk = polyEval(g, k);
          const gdk = polyEval(polyDiff(g), k);
          if (gk === 0 || gdk === 0 || Math.abs(gk) > 3) continue;
          const ans = n * gk ** (n - 1) * gdk;
          if (Math.abs(ans) > 300) continue;
          const G = polyTex(g);
          const Gd = polyTex(polyDiff(g));
          return {
            q: `함수 $f(x)=(${G})^${n}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `diff((${polySym(g)})**${n}, x).subs(x, ${k})`,
            concepts: [CHAIN, CHAIN_HINT, "$(u^n)'=nu^{n-1}$"],
            steps: [
              {
                title: '안쪽과 바깥 나누기',
                body: `안쪽 $u=${G}$, 바깥 $u^${n}$ 이에요. $u'=${Gd}$ ${ieyo(Gd)}.`,
              },
              {
                title: '합성함수의 미분법',
                body: `$$f'(x)=${n}(${G})^${n - 1}\\cdot(${Gd})$$`,
              },
              {
                title: `$x=${k}$ 일 때 안쪽 값`,
                body: `$u=${gk}$, $u'=${gdk}$ ${ieyo(gdk)}.`,
              },
              {
                title: '계산하기',
                body: `$$f'(${k})=${n}\\cdot${paren(gk)}^${n - 1}\\cdot${paren(gdk)}=${ans}$$`,
              },
            ],
            tip: `끝의 $(${Gd})$ ${jo(Gd, '을/를')} 빠뜨리면 $${n * gk ** (n - 1)}$ ${jo(n * gk ** (n - 1), '이/가')} 나와요. 안쪽 미분을 곱하는 것이 합성함수 미분의 핵심이에요.`,
          };
        }
        // 음의 거듭제곱: 1/(ax+b)^n = (ax+b)^(-n)
        const a = rng.nonzero(-3, 3);
        const b = rng.nonzero(-4, 4);
        const n = rng.pick([1, 2]);
        const k = rng.int(-2, 2);
        const v = a * k + b;
        if (v === 0 || Math.abs(v) > 3) continue;
        const ansN = -n * a;
        const ansD = v ** (n + 1);
        const G = polyTex([a, b]);
        const pw = n === 1 ? `(${G})` : `(${G})^${n}`;
        return {
          q: `함수 $f(x)=\\dfrac{1}{${pw}}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ansN, ansD),
          answerType: 'fraction',
          check: `diff(1/(${polySym([a, b])})**${n}, x).subs(x, ${k})`,
          concepts: [CHAIN, "$(u^{n})'=nu^{n-1}$ 은 $n$ 이 음의 정수여도 성립해요."],
          steps: [
            {
              title: '음의 지수로 바꾸기',
              body: `$$f(x)=(${G})^{-${n}}$$`,
            },
            {
              title: '합성함수의 미분법',
              body: `바깥 $u^{-${n}}$ 을 미분하면 $-${n === 1 ? '' : n}u^{-${n + 1}}$, 안쪽 미분은 $${a}$ ${ieyo(a)}.\n$$f'(x)=-${n === 1 ? '' : n}(${G})^{-${n + 1}}\\cdot ${paren(a)}=\\frac{${ansN}}{(${G})^${n + 1}}$$`,
            },
            {
              title: `$x=${k}$ 대입`,
              body: `$${G}$ 의 값은 $${v}$ 이므로\n$$f'(${k})=\\frac{${ansN}}{${paren(v)}^${n + 1}}=${fracTex(ansN, ansD)}$$`,
            },
          ],
          tip: `몫의 미분법으로 $\\left\\{\\frac{1}{g(x)}\\right\\}'=-\\frac{g'(x)}{\\{g(x)\\}^2}$ 를 써도 같은 값이 나와요.`,
        };
      }
    },
  },
  {
    id: 'calc-quotient-chain-trig',
    unitId: UNIT,
    title: '$\\sin ax$, $\\cos ax$, $\\tan ax$ 의 미분계수',
    make(rng) {
      const c = rng.nonzero(-3, 3);
      const a = rng.int(2, 4);
      const kind = rng.pick(['sin', 'cos', 'tan'] as const);
      const at = rng.pick(kind === 'sin' ? COS_AT : kind === 'cos' ? SIN_AT : SEC2_AT);
      const [pn, pd] = at.phi;
      const [vn, vd] = at.v;
      // sin → c·a·cos φ, cos → −c·a·sin φ, tan → c·a·sec² φ
      const sgn = kind === 'cos' ? -1 : 1;
      const ansN = sgn * c * a * vn;
      const th = piTex(pn, pd * a);
      const phi = piTex(pn, pd);
      const C = coef(c);
      const fn = `\\${kind}`;
      const outer = kind === 'sin' ? '\\cos' : kind === 'cos' ? '-\\sin' : '\\sec^2';
      const outerVal =
        kind === 'tan'
          ? `\\sec^2${phi}=\\frac{1}{\\cos^2${phi}}=${fracTex(vn, vd)}`
          : `${kind === 'sin' ? '\\cos' : '\\sin'}${phi}=${fracTex(vn, vd)}`;
      return {
        q: `함수 $f(x)=${C}${fn} ${a}x$ 에 대하여 $f'\\left(${th}\\right)$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(ansN, vd),
        answerType: 'fraction',
        check: `diff(${c}*${kind}(${a}*x), x).subs(x, ${pn}*pi/${pd * a})`,
        concepts: [CHAIN, "$(\\sin x)'=\\cos x$, $(\\cos x)'=-\\sin x$, $(\\tan x)'=\\sec^2x$"],
        steps: [
          {
            title: '안쪽과 바깥 나누기',
            body: `안쪽 $u=${a}x$, 바깥 $${C}${fn} u$ 예요. 안쪽 미분은 $${a}$ ${ieyo(a)}.`,
          },
          {
            title: '합성함수의 미분법',
            body: `$$f'(x)=${c === 1 ? '' : `${paren(c)}\\cdot`}${kind === 'cos' ? `(${outer} ${a}x)` : `${outer} ${a}x`}\\cdot ${a}$$`,
          },
          {
            title: '안쪽의 값',
            body: `$x=${th}$ 이면 안쪽은 $${a}\\cdot${th}=${phi}$ 이고, $${outerVal}$ ${ieyo(vn, vd)}.`,
          },
          {
            title: '계산하기',
            body: `$$f'\\left(${th}\\right)=${paren(c)}\\cdot${sgn < 0 ? '(-1)\\cdot' : ''}${paren(fracTex(vn, vd))}\\cdot${a}=${fracTex(ansN, vd)}$$`,
          },
        ],
        tip: `안쪽 미분 $${a}$ ${jo(a, '을/를')} 곱하지 않으면 답이 $${a}$ 배 작아져요. 각이 $${a}$ 배 빨리 돌면 기울기도 $${a}$ 배가 돼요.`,
      };
    },
  },
  {
    id: 'calc-quotient-chain-log',
    unitId: UNIT,
    title: '$\\ln g(x)$ 의 미분계수',
    make(rng) {
      for (;;) {
        const quad = rng.int(0, 1) === 0;
        // 이차는 ax²+b (a,b>0)라 모든 실수에서 정의되고, 일차는 대입하는 점에서 양수인 것만 쓴다
        const g = quad ? [rng.int(1, 3), 0, rng.int(1, 5)] : [rng.nonzero(-3, 3), rng.int(-4, 6)];
        const k = rng.nonzero(-3, 3);
        const gk = polyEval(g, k);
        const gdk = polyEval(polyDiff(g), k);
        if (gk <= 0 || gdk === 0) continue;
        const G = polyTex(g);
        const Gd = polyTex(polyDiff(g));
        return {
          q: `함수 $f(x)=\\ln(${G})$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(gdk, gk),
          answerType: 'fraction',
          check: `diff(log(${polySym(g)}), x).subs(x, ${k})`,
          concepts: [CHAIN, "$(\\ln x)'=\\dfrac1x$", "$\\{\\ln g(x)\\}'=\\dfrac{g'(x)}{g(x)}$"],
          steps: [
            {
              title: '안쪽과 바깥 나누기',
              body: `안쪽 $u=${G}$, 바깥 $\\ln u$ 예요. $(\\ln u)'=\\frac1u$ 이고 $u'=${Gd}$ ${ieyo(Gd)}.`,
            },
            {
              title: '합성함수의 미분법',
              body: `$$f'(x)=\\frac{1}{${G}}\\cdot(${Gd})=\\frac{${Gd}}{${G}}$$`,
            },
            {
              title: `$x=${k}$ 대입`,
              body: `분자 $${Gd}$ 의 값은 $${gdk}$, 분모 $${G}$ 의 값은 $${gk}$ 이므로\n$$f'(${k})=${fracChain(gdk, gk)}$$`,
            },
          ],
          tip: `$\\ln$ 의 미분은 언제나 "안쪽 미분 ÷ 안쪽" 이에요. 분모에 $${G}$ ${jo(G, '을/를')} 그대로 두는 것을 잊지 마세요.`,
        };
      }
    },
  },
];
