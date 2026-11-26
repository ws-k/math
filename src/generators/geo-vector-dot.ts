import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, ieyo, paren } from './util.ts';

const UNIT = 'geo-vector-dot';

// 검산식은 풀이에 쓴 공식을 그대로 옮기지 않고, 성분이나 좌표에서 따로 계산한다.
// 예: |a+b|² 은 a=(|a|,0), b=(|b|cosθ, |b|sinθ) 로 놓고 성분으로 계산 —
// 풀이의 "|a|²+2a·b+|b|²" 를 잘못 세우면 검산에서 어긋나게 하려고.

const SIZE = '$\\vec a=(a_1,a_2)$ 이면 $\\lvert\\vec a\\rvert=\\sqrt{a_1^2+a_2^2}$ 이에요.';
const COMP = '$\\vec a\\cdot\\vec b=a_1b_1+a_2b_2$ — 같은 자리 성분끼리 곱해서 더해요.';
const DEF = '$\\vec a\\cdot\\vec b=\\lvert\\vec a\\rvert\\lvert\\vec b\\rvert\\cos\\theta$';
const PERP = '$\\vec a\\perp\\vec b$ 이면 $\\vec a\\cdot\\vec b=0$ 이에요.';
const SQ =
  '$\\lvert\\vec a\\pm\\vec b\\rvert^2=\\lvert\\vec a\\rvert^2\\pm2\\,\\vec a\\cdot\\vec b+\\lvert\\vec b\\rvert^2$';
const AB = '$A(x_1,y_1)$, $B(x_2,y_2)$ 이면 $\\overrightarrow{AB}=(x_2-x_1,\\ y_2-y_1)$ 이에요.';

// 크기가 정수로 떨어지는 성분(피타고라스 수). 무리수 크기는 기초 문제의 초점(성분→크기)을 흐린다
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
];

const flip = (rng: Rng, n: number) => (rng.next() < 0.5 ? -n : n);
/** 성분 TeX: (3,-1) */
const v2 = (a: number | string, b: number | string) => `(${a},${b})`;
/** a+b 를 괄호 붙여 적기: 3+(−2) */
const plus = (a: number, b: number) => `${a}+${paren(b)}`;
const minus = (a: number, b: number) => `${a}-${paren(b)}`;
/** 곱 a·b 를 괄호 붙여 적기 */
const times = (a: number, b: number) => `${paren(a)}\\cdot${paren(b)}`;

// '이에요/예요'는 앞 소리의 받침으로 갈린다. 정수는 끝자리(영·일·삼·육·칠·팔에 받침),
// 분수는 '○분의 △'로 읽으니 분자 끝자리로 고른다.

function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType' | 'answerTex'> {
  const r = fracAns(n, d);
  return r.includes('/')
    ? { answer: r, answerType: 'fraction', answerTex: `$${fracTex(n, d)}$` }
    : { answer: r, answerType: 'int' };
}

export const generators: Generator[] = [
  {
    id: 'geo-vector-dot-size',
    unitId: UNIT,
    title: '성분으로 벡터의 크기 구하기',
    make(rng) {
      for (;;) {
        // 결과 벡터를 먼저 정해 크기가 정수가 되게 하고, a 를 뽑은 뒤 b 를 거꾸로 만든다
        const [p, q, d] = rng.pick(TRIPLES);
        const r1 = flip(rng, p);
        const r2 = flip(rng, q);
        const sub = rng.next() < 0.5;
        const a1 = rng.int(-4, 4);
        const a2 = rng.int(-4, 4);
        // a+b=r 이면 b=r−a, a−b=r 이면 b=a−r
        const b1 = sub ? a1 - r1 : r1 - a1;
        const b2 = sub ? a2 - r2 : r2 - a2;
        if ((a1 === 0 && a2 === 0) || (b1 === 0 && b2 === 0)) continue;
        if (Math.abs(b1) > 9 || Math.abs(b2) > 9) continue;
        const op = sub ? '-' : '+';
        const f = sub ? minus : plus;
        return {
          q: `두 벡터 $\\vec a=${v2(a1, a2)}$, $\\vec b=${v2(b1, b2)}$ 에 대하여 $\\lvert\\vec a${op}\\vec b\\rvert$ 의 값을 구하세요.`,
          choices: null,
          answer: String(d),
          answerType: 'int',
          check: `sqrt((${a1}${op}(${b1}))**2+(${a2}${op}(${b2}))**2)`,
          concepts: [SIZE, '벡터끼리 더하거나 뺄 때는 같은 자리 성분끼리 계산해요.'],
          steps: [
            {
              title: '성분끼리 계산',
              body: `$$\\vec a${op}\\vec b=(${f(a1, b1)},\\ ${f(a2, b2)})=${v2(r1, r2)}$$`,
            },
            {
              title: '제곱해서 더하기',
              body: `$$${paren(r1)}^2+${paren(r2)}^2=${p * p}+${q * q}=${d * d}$$`,
            },
            {
              title: '제곱근',
              body: `$\\lvert\\vec a${op}\\vec b\\rvert=\\sqrt{${d * d}}=${d}$ ${ieyo(d)}.`,
            },
          ],
          tip: `$\\lvert\\vec a\\rvert${op}\\lvert\\vec b\\rvert$ 처럼 크기끼리 ${sub ? '빼면' : '더하면'} 안 돼요. 두 벡터의 방향이 다르면 값이 달라져요.`,
        };
      }
    },
  },
  {
    id: 'geo-vector-dot-comp',
    unitId: UNIT,
    title: '성분으로 내적 구하기',
    make(rng) {
      for (;;) {
        const pts = rng.next() < 0.5;
        if (!pts) {
          const a1 = rng.nonzero(-5, 5);
          const a2 = rng.nonzero(-5, 5);
          const b1 = rng.nonzero(-5, 5);
          const b2 = rng.nonzero(-5, 5);
          const dot = a1 * b1 + a2 * b2;
          if (dot === 0) continue;
          return {
            q: `두 벡터 $\\vec a=${v2(a1, a2)}$, $\\vec b=${v2(b1, b2)}$ 의 내적 $\\vec a\\cdot\\vec b$ 의 값을 구하세요.`,
            choices: null,
            answer: String(dot),
            answerType: 'int',
            check: `${a1}*(${b1})+(${a2})*(${b2})`,
            concepts: [COMP],
            steps: [
              {
                title: '같은 자리끼리 곱하기',
                body: `$x$ 성분끼리 $${times(a1, b1)}=${a1 * b1}$, $y$ 성분끼리 $${times(a2, b2)}=${a2 * b2}$ ${ieyo(a2 * b2)}.`,
              },
              {
                title: '더하기',
                body: `$$\\vec a\\cdot\\vec b=${a1 * b1}${a2 * b2 < 0 ? '' : '+'}${a2 * b2}=${dot}$$`,
              },
            ],
            tip: '엇갈려 곱하면($a_1b_2$) 안 돼요. 내적은 벡터가 아니라 **수 하나**예요.',
          };
        }
        // 세 점 A, B, C 에서 AB·AC — 성분을 먼저 구하는 단계가 하나 더 있다
        const ax = rng.int(-3, 3);
        const ay = rng.int(-3, 3);
        const u1 = rng.nonzero(-4, 4);
        const u2 = rng.nonzero(-4, 4);
        const w1 = rng.nonzero(-4, 4);
        const w2 = rng.nonzero(-4, 4);
        const dot = u1 * w1 + u2 * w2;
        if (dot === 0 || u1 * w2 === u2 * w1) continue;
        const [bx, by, cx, cy] = [ax + u1, ay + u2, ax + w1, ay + w2];
        return {
          q: `세 점 $A${v2(ax, ay)}$, $B${v2(bx, by)}$, $C${v2(cx, cy)}$ 에 대하여 $\\overrightarrow{AB}\\cdot\\overrightarrow{AC}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(dot),
          answerType: 'int',
          check: `(${bx}-(${ax}))*(${cx}-(${ax}))+(${by}-(${ay}))*(${cy}-(${ay}))`,
          concepts: [AB, COMP],
          steps: [
            {
              title: '$\\overrightarrow{AB}$ 의 성분',
              body: `끝점에서 시작점을 빼요.\n$$\\overrightarrow{AB}=(${minus(bx, ax)},\\ ${minus(by, ay)})=${v2(u1, u2)}$$`,
            },
            {
              title: '$\\overrightarrow{AC}$ 의 성분',
              body: `$$\\overrightarrow{AC}=(${minus(cx, ax)},\\ ${minus(cy, ay)})=${v2(w1, w2)}$$`,
            },
            {
              title: '내적',
              body: `$$${times(u1, w1)}+${times(u2, w2)}=${u1 * w1}${u2 * w2 < 0 ? '' : '+'}${u2 * w2}=${dot}$$`,
            },
          ],
          tip: '시작점이 같은 두 벡터를 만들어야 해요. $\\overrightarrow{AB}$ 는 $B-A$, 끝점에서 시작점을 빼요.',
        };
      }
    },
  },
  {
    id: 'geo-vector-dot-perp',
    unitId: UNIT,
    title: '수직 조건으로 미지수 구하기',
    make(rng) {
      for (;;) {
        // b=(k+c, b2) 또는 (b1, k+c) — 미지수가 어느 성분에 있든 내적=0 한 줄로 풀린다
        const a1 = rng.nonzero(-4, 4);
        const a2 = rng.nonzero(-4, 4);
        const c = rng.int(-3, 3);
        const other = rng.nonzero(-5, 5);
        const first = rng.next() < 0.5;
        // first: a1(k+c)+a2·other=0 → k = −c − a2·other/a1
        const [num, den] = first ? [-c * a1 - a2 * other, a1] : [-c * a2 - a1 * other, a2];
        // 기초 문제라 분수 답은 피한다(계산보다 수직 조건 세우기가 초점)
        if (num === 0 || num % den !== 0) continue;
        const kTex = c === 0 ? 'k' : `k${c > 0 ? '+' : ''}${c}`;
        const kSym = `(k+(${c}))`;
        const bTex = first ? v2(kTex, other) : v2(other, kTex);
        // 계수 1·−1 은 "1(k+2)" 대신 "(k+2)"·"-(k+2)" 로
        const kMul = (c: number) => `${c === 1 ? '' : c === -1 ? '-' : paren(c)}(${kTex})`;
        const lhs = first
          ? `${kMul(a1)}+${times(a2, other)}`
          : `${times(a1, other)}${a2 === -1 ? '' : '+'}${kMul(a2)}`;
        const known = first ? a2 * other : a1 * other;
        const coef = first ? a1 : a2;
        return {
          q: `두 벡터 $\\vec a=${v2(a1, a2)}$, $\\vec b=${bTex}$ 가 서로 수직일 때, 실수 $k$ 의 값을 구하세요.`,
          choices: null,
          ...ans(num, den),
          check: first
            ? `solve(Eq(${a1}*${kSym}+(${a2})*(${other}), 0), k)[0]`
            : `solve(Eq(${a1}*(${other})+(${a2})*${kSym}, 0), k)[0]`,
          concepts: [PERP, COMP],
          steps: [
            { title: '수직이면 내적이 0', body: `$$${lhs}=0$$` },
            {
              title: '정리하기',
              body: `$$${coef === 1 ? '' : coef === -1 ? '-' : coef}(${kTex})=${-known}$$`,
            },
            {
              title: '$k$ 구하기',
              body: `$${kTex}=${fracTex(-known, coef)}$ 이므로 $k=${fracTex(num, den)}$ ${ieyo(num, den)}.`,
            },
          ],
          tip: '구한 $k$ 를 넣어 $\\vec a\\cdot\\vec b$ 를 다시 계산하면 0 이 나와야 해요.',
        };
      }
    },
  },
  {
    id: 'geo-vector-dot-angle',
    unitId: UNIT,
    title: '크기와 끼인각으로 내적·크기 구하기',
    make(rng) {
      for (;;) {
        const p = rng.int(1, 6);
        const q = rng.int(1, 6);
        const t = rng.pick([60, 120]);
        const half = t === 60 ? 1 : -1; // cosθ = half/2
        const kind = rng.pick(['dot', 'plus', 'minus'] as const);
        if (p === q && kind !== 'dot') continue;
        // a=(p,0), b=(q cosθ, q sinθ) 로 놓고 성분으로 계산한다(풀이의 공식과 다른 길)
        const A = `${p}`;
        const B1 = `${q}*cos(rad(${t}))`;
        const B2 = `${q}*sin(rad(${t}))`;
        const dot2 = p * q * half; // 2·(a·b)
        const cosTex = t === 60 ? '\\frac12' : '-\\frac12';
        const head = `두 벡터 $\\vec a$, $\\vec b$ 가 $\\lvert\\vec a\\rvert=${p}$, $\\lvert\\vec b\\rvert=${q}$ 이고, 두 벡터가 이루는 각의 크기가 $${t}^\\circ$ 일 때`;
        const dotStep = {
          title: '내적',
          body: `$\\cos${t}^\\circ=${cosTex}$ 이므로\n$$\\vec a\\cdot\\vec b=${p}\\cdot${q}\\cdot${t === 60 ? cosTex : `\\left(${cosTex}\\right)`}=${fracTex(dot2, 2)}$$`,
        };
        if (kind === 'dot') {
          return {
            q: `${head}, $\\vec a\\cdot\\vec b$ 의 값을 구하세요.`,
            choices: null,
            ...ans(dot2, 2),
            check: `${A}*${B1}+0*${B2}`,
            concepts: [DEF],
            steps: [dotStep],
            tip: `각이 $90^\\circ$ 보다 크면 $\\cos$ 가 음수라 내적도 음수예요.`,
          };
        }
        const s = kind === 'plus' ? 1 : -1;
        const op = kind === 'plus' ? '+' : '-';
        const sq = p * p + s * dot2 + q * q;
        return {
          q: `${head}, $\\lvert\\vec a${op}\\vec b\\rvert^2$ 의 값을 구하세요.`,
          choices: null,
          answer: String(sq),
          answerType: 'int',
          check: `(${A}${op}${B1})**2+(0${op}${B2})**2`,
          concepts: [DEF, SQ],
          steps: [
            dotStep,
            {
              title: '전개해서 넣기',
              body: `$$\\lvert\\vec a${op}\\vec b\\rvert^2=${p}^2${op}2\\cdot${dot2 < 0 ? `\\left(${fracTex(dot2, 2)}\\right)` : fracTex(dot2, 2)}+${q}^2=${p * p}${s * dot2 < 0 ? '' : '+'}${s * dot2}+${q * q}=${sq}$$`,
            },
          ],
          tip: '가운데 $2\\,\\vec a\\cdot\\vec b$ 를 빠뜨리면 $\\lvert\\vec a\\rvert^2+\\lvert\\vec b\\rvert^2$ 만 남아요. 가장 흔한 실수예요.',
        };
      }
    },
  },
];
