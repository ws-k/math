import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, reduce } from './util.ts';

const UNIT = 'calc-trig-addition';

// 덧셈정리 문제는 "주어진 값 하나 → 피타고라스로 짝 값 → 공식에 넣기"가 뼈대라, 각은 늘
// 피타고라스 수(3·4·5, 5·12·13 …)에서 뽑아 sin·cos 이 모두 유리수가 되게 한다(정수·분수로 채점하려고).
// 검산은 sympy 에 각 자체(asin·acos·atan 으로 만든 각)를 넣고 expand_trig 로 풀어 계산한다 —
// 짝 값이나 공식의 부호를 옮겨 적다 틀리면 화면 답과 어긋나서 잡힌다.
// 생성기 id 는 다른 단원과 겹치지 않도록 모두 단원 id 'calc-trig-addition-' 로 시작한다.

// '이에요/예요'는 읽었을 때 끝소리 받침으로 갈린다(분수 b분의 a 는 분자 a 로 끝난다).
const ieyoN = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');
const ieyoF = (n: number, d: number) => ieyoN(reduce(n, d).n);

/** 피타고라스 수 [짧은 변, 긴 변, 빗변] */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
];

const ACUTE = '0<\\alpha<\\frac{\\pi}{2}';
const SIN_ADD = '$\\sin(\\alpha\\pm\\beta)=\\sin\\alpha\\cos\\beta\\pm\\cos\\alpha\\sin\\beta$';
const COS_ADD = '$\\cos(\\alpha\\pm\\beta)=\\cos\\alpha\\cos\\beta\\mp\\sin\\alpha\\sin\\beta$';
const TAN_ADD =
  '$\\tan(\\alpha\\pm\\beta)=\\frac{\\tan\\alpha\\pm\\tan\\beta}{1\\mp\\tan\\alpha\\tan\\beta}$';
const PYTH = '$\\sin^2\\theta+\\cos^2\\theta=1$';

/** 유리수 n/d → sympy */
const rat = (n: number, d: number) => {
  const r = reduce(n, d);
  return r.d === 1 ? `${r.n}` : `Rational(${r.n},${r.d})`;
};

export const generators: Generator[] = [
  {
    id: 'calc-trig-addition-sin-cos',
    unitId: UNIT,
    title: '덧셈정리로 $\\sin(\\alpha\\pm\\beta)$, $\\cos(\\alpha\\pm\\beta)$ 구하기',
    make(rng) {
      for (;;) {
        const [a1, a2, ah] = rng.pick(TRIPLES);
        const [b1, b2, bh] = rng.pick(TRIPLES);
        // α 는 sin 을, β 는 cos 을 준다. 어느 변을 주는지도 섞는다
        const [sa, ca] = rng.int(0, 1) ? [a1, a2] : [a2, a1];
        const [cb, sb] = rng.int(0, 1) ? [b1, b2] : [b2, b1];
        // sinα = cosβ 이면 α+β 가 직각이라 공식 없이 답이 보인다
        if (sa * bh === cb * ah) continue;
        const fn = rng.pick(['sin', 'cos'] as const);
        const plus = rng.int(0, 1) === 1;
        const pm = plus ? '+' : '-';
        let n: number;
        let left: [number, number];
        let right: [number, number];
        if (fn === 'sin') {
          // sin(α±β) = sinα cosβ ± cosα sinβ
          left = [sa, cb];
          right = [ca, sb];
          n = sa * cb + (plus ? 1 : -1) * ca * sb;
        } else {
          // cos(α±β) = cosα cosβ ∓ sinα sinβ
          left = [ca, cb];
          right = [sa, sb];
          n = ca * cb - (plus ? 1 : -1) * sa * sb;
        }
        if (n === 0) continue;
        const d = ah * bh;
        const ans = reduce(n, d);
        const op = fn === 'sin' ? pm : plus ? '-' : '+';
        const A = (k: number) => fracTex(k, ah);
        const B = (k: number) => fracTex(k, bh);
        const target = `\\${fn}(\\alpha${pm}\\beta)`;
        const formula =
          fn === 'sin'
            ? `\\sin\\alpha\\cos\\beta${pm}\\cos\\alpha\\sin\\beta`
            : `\\cos\\alpha\\cos\\beta${op}\\sin\\alpha\\sin\\beta`;
        return {
          q: `$\\sin\\alpha=${A(sa)}$, $\\cos\\beta=${B(cb)}$ 일 때, $${target}$ 의 값을 구하세요. (단, $${ACUTE}$, $0<\\beta<\\frac{\\pi}{2}$)`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `simplify(expand_trig(${fn}(asin(${rat(sa, ah)}) ${pm} acos(${rat(cb, bh)}))))`,
          concepts: [fn === 'sin' ? SIN_ADD : COS_ADD, PYTH],
          steps: [
            {
              title: '$\\cos\\alpha$ 구하기',
              body: `$\\alpha$ 가 예각이라 $\\cos\\alpha>0$ 이므로 $\\cos\\alpha=\\sqrt{1-\\left(${A(sa)}\\right)^2}=${A(ca)}$ ${ieyoF(ca, ah)}.`,
            },
            {
              title: '$\\sin\\beta$ 구하기',
              body: `$\\beta$ 도 예각이라 $\\sin\\beta=\\sqrt{1-\\left(${B(cb)}\\right)^2}=${B(sb)}$ ${ieyoF(sb, bh)}.`,
            },
            {
              title: '덧셈정리 적용',
              body: `$$${target}=${formula}$$`,
            },
            {
              title: '값 넣어 계산하기',
              body: `$$${fracTex(left[0], ah)}\\cdot${fracTex(left[1], bh)}${op}${fracTex(right[0], ah)}\\cdot${fracTex(right[1], bh)}=\\frac{${left[0] * left[1]}${op}${right[0] * right[1]}}{${d}}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip:
            fn === 'cos'
              ? `$\\cos$ 의 덧셈정리는 부호가 거꾸로예요. $\\cos(\\alpha${pm}\\beta)$ 에서는 가운데가 $${op}$ 가 돼요.`
              : '$\\sin(\\alpha\\pm\\beta)$ 는 $\\sin\\cos$ 짝과 $\\cos\\sin$ 짝을 더하거나 빼요. 부호는 괄호 안과 같아요.',
        };
      }
    },
  },
  {
    id: 'calc-trig-addition-tan',
    unitId: UNIT,
    title: '$\\tan$ 의 덧셈정리',
    make(rng) {
      const VALS: [number, number][] = [
        [1, 2],
        [1, 3],
        [2, 3],
        [1, 4],
        [2, 1],
        [3, 1],
        [4, 1],
        [3, 2],
        [-1, 2],
        [-1, 3],
        [-2, 1],
        [-3, 1],
      ];
      for (;;) {
        const [pn, pd] = rng.pick(VALS);
        const [qn, qd] = rng.pick(VALS);
        if (pn * qd === qn * pd) continue;
        const plus = rng.int(0, 1) === 1;
        const pm = plus ? '+' : '-';
        const mp = plus ? '-' : '+';
        // (p±q)/(1∓pq) = (pn·qd ± qn·pd)/(pd·qd ∓ pn·qn)
        const num = pn * qd + (plus ? 1 : -1) * qn * pd;
        const den = pd * qd - (plus ? 1 : -1) * pn * qn;
        if (den === 0 || num === 0) continue;
        const ans = reduce(num, den);
        const P = fracTex(pn, pd);
        const Q = fracTex(qn, qd);
        const pq = reduce(pn * qn, pd * qd);
        const top = reduce(num, pd * qd);
        const bot = reduce(den, pd * qd);
        return {
          q: `$\\tan\\alpha=${P}$, $\\tan\\beta=${Q}$ 일 때, $\\tan(\\alpha${pm}\\beta)$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `simplify(expand_trig(tan(atan(${rat(pn, pd)}) ${pm} atan(${rat(qn, qd)}))))`,
          concepts: [TAN_ADD],
          steps: [
            {
              title: '덧셈정리 쓰기',
              body: `$$\\tan(\\alpha${pm}\\beta)=\\frac{\\tan\\alpha${pm}\\tan\\beta}{1${mp}\\tan\\alpha\\tan\\beta}$$`,
            },
            {
              title: '분자 계산',
              body: `$${P}${pm}${paren(Q)}=${fracTex(top.n, top.d)}$`,
            },
            {
              title: '분모 계산',
              body: `$\\tan\\alpha\\tan\\beta=${fracTex(pq.n, pq.d)}$ 이므로 $1${mp}${paren(fracTex(pq.n, pq.d))}=${fracTex(bot.n, bot.d)}$`,
            },
            {
              title: '나누기',
              body: `$$\\frac{${fracTex(top.n, top.d)}}{${fracTex(bot.n, bot.d)}}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: `분모의 부호는 분자와 반대예요. $\\tan(\\alpha${pm}\\beta)$ 의 분모는 $1${mp}\\tan\\alpha\\tan\\beta$ 예요.`,
        };
      }
    },
  },
  {
    id: 'calc-trig-addition-double',
    unitId: UNIT,
    title: '배각 공식',
    make(rng) {
      for (;;) {
        const [s0, c0, h] = rng.pick(TRIPLES);
        const [s, c] = rng.int(0, 1) ? [s0, c0] : [c0, s0];
        const second = rng.int(0, 1) === 1;
        const cs = second ? -c : c; // 제2사분면이면 cos 이 음수
        const fn = rng.pick(['sin', 'cos', 'tan'] as const);
        const range = second ? '\\frac{\\pi}{2}<\\theta<\\pi' : '0<\\theta<\\frac{\\pi}{2}';
        const S = fracTex(s, h);
        const C = fracTex(cs, h);
        const theta = second ? `pi - asin(${rat(s, h)})` : `asin(${rat(s, h)})`;
        let ans: { n: number; d: number };
        let formula: string;
        let calc: string;
        if (fn === 'sin') {
          ans = reduce(2 * s * cs, h * h);
          formula = '\\sin2\\theta=2\\sin\\theta\\cos\\theta';
          calc = `2\\cdot${S}\\cdot${paren(C)}=${fracTex(ans.n, ans.d)}`;
        } else if (fn === 'cos') {
          ans = reduce(h * h - 2 * s * s, h * h);
          formula = '\\cos2\\theta=1-2\\sin^2\\theta';
          calc = `1-2\\cdot\\left(${S}\\right)^2=${fracTex(ans.n, ans.d)}`;
        } else {
          // tan2θ = 2t/(1-t²), t = s/cs
          if (s === Math.abs(cs)) continue;
          ans = reduce(2 * s * cs, cs * cs - s * s);
          const T = fracTex(s, cs);
          formula = '\\tan2\\theta=\\frac{2\\tan\\theta}{1-\\tan^2\\theta}';
          calc = `\\frac{2\\cdot${paren(T)}}{1-\\left(${T}\\right)^2}=${fracTex(ans.n, ans.d)}`;
        }
        if (ans.n === 0) continue;
        const target = `\\${fn}2\\theta`;
        return {
          q: `$\\sin\\theta=${S}$ 일 때, $${target}$ 의 값을 구하세요. (단, $${range}$)`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `simplify(expand_trig(${fn}(2*(${theta}))))`,
          concepts: [
            '$\\sin2\\theta=2\\sin\\theta\\cos\\theta$',
            '$\\cos2\\theta=\\cos^2\\theta-\\sin^2\\theta=1-2\\sin^2\\theta$',
            '$\\tan2\\theta=\\frac{2\\tan\\theta}{1-\\tan^2\\theta}$',
          ],
          steps: [
            {
              title: '$\\cos\\theta$ 구하기',
              body: `$\\theta$ 가 제${second ? 2 : 1}사분면의 각이라 $\\cos\\theta${second ? '<' : '>'}0$ 이에요.\n$$\\cos\\theta=${second ? '-' : ''}\\sqrt{1-\\left(${S}\\right)^2}=${C}$$`,
            },
            ...(fn === 'tan'
              ? [
                  {
                    title: '$\\tan\\theta$ 구하기',
                    body: `$\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}=${fracTex(s, cs)}$`,
                  },
                ]
              : []),
            {
              title: '배각 공식 적용',
              body: `$$${formula}$$`,
            },
            {
              title: '값 넣어 계산하기',
              body: `$$${target}=${calc}$$`,
            },
          ],
          tip: second
            ? '제2사분면에서는 $\\cos\\theta$ 가 음수예요. 부호를 놓치면 답의 부호가 바뀌어요.'
            : '배각 공식은 덧셈정리에서 $\\beta$ 자리에 $\\alpha$ 를 넣은 거예요. $\\sin2\\theta$ 는 $2\\sin\\theta$ 가 아니에요.',
        };
      }
    },
  },
  {
    id: 'calc-trig-addition-lines',
    unitId: UNIT,
    title: '두 직선이 이루는 각',
    make(rng) {
      for (;;) {
        const m1 = rng.nonzero(-4, 4);
        const m2 = rng.nonzero(-4, 4);
        if (m1 === m2 || 1 + m1 * m2 === 0) continue;
        const k1 = rng.int(-3, 3);
        const k2 = rng.int(-3, 3);
        const ans = reduce(Math.abs(m1 - m2), Math.abs(1 + m1 * m2));
        const line = (m: number, k: number) =>
          `y=${m === 1 ? '' : m === -1 ? '-' : m}x${k === 0 ? '' : k > 0 ? `+${k}` : k}`;
        const raw = fracTex(m1 - m2, 1 + m1 * m2);
        return {
          q: `두 직선 $${line(m1, k1)}$, $${line(m2, k2)}$ 에 대하여, 두 직선이 이루는 예각의 크기를 $\\theta$ 라 할 때 $\\tan\\theta$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `Abs(simplify(expand_trig(tan(atan(${m1}) - atan(${m2})))))`,
          concepts: [
            '직선의 기울기는 $x$ 축과 이루는 각 $\\alpha$ 의 $\\tan\\alpha$ 예요.',
            TAN_ADD,
          ],
          steps: [
            {
              title: '기울기를 각으로 보기',
              body: `두 직선이 $x$ 축과 이루는 각을 $\\alpha$, $\\beta$ 라 하면 $\\tan\\alpha=${m1}$, $\\tan\\beta=${m2}$ ${ieyoN(m2)}.`,
            },
            {
              title: '두 각의 차',
              body: `$$\\tan(\\alpha-\\beta)=\\frac{${m1}-${paren(m2)}}{1+${paren(m1)}\\cdot${paren(m2)}}=${raw}$$`,
            },
            {
              title: '예각으로 고치기',
              body: `예각의 $\\tan$ 은 양수라 절댓값을 써요. $\\tan\\theta=${fracTex(ans.n, ans.d)}$ ${ieyoF(ans.n, ans.d)}.`,
            },
          ],
          tip: 'y 절편은 각에 영향을 주지 않아요. 직선을 평행이동해도 기울기, 곧 각은 그대로예요.',
        };
      }
    },
  },
];
