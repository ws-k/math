import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { eul, fracAns, fracTex, gcd, ieyo, reduce, ro } from './util.ts';

const UNIT = 'm3-radical-ops';

const CONCEPT_MUL =
  '$a>0$, $b>0$ 이면 $\\sqrt{a}\\sqrt{b}=\\sqrt{ab}$, $\\frac{\\sqrt{a}}{\\sqrt{b}}=\\sqrt{\\frac{a}{b}}$ 예요.';
const CONCEPT_OUT =
  '근호 밖으로 꺼내기: $\\sqrt{a^2b}=a\\sqrt{b}\\ (a>0)$. 근호 안의 제곱인 수만 밖으로 나와요.';
const CONCEPT_RAT =
  '분모의 유리화: 분모와 분자에 같은 $\\sqrt{a}$ 를 곱해요. $\\frac{k}{\\sqrt{a}}=\\frac{k\\sqrt{a}}{a}$';
const CONCEPT_ADD =
  '근호 안이 같은 수끼리만 더하고 빼요. $m\\sqrt{a}+n\\sqrt{a}=(m+n)\\sqrt{a}$ (동류항처럼)';

/** 제곱 인수가 없는 수 — 근호 안에 남는 가장 작은 수 */
const FREE = [2, 3, 5, 6, 7];

/** k√n 의 TeX(k=1 이면 √n 만) */
const rootTex = (k: number, n: number) => `${k === 1 ? '' : k}\\sqrt{${n}}`;

/** 같은 s 를 품은 √(s·u²) 하나 */
function hidden(rng: Rng, s: number, lo: number, hi: number) {
  const u = rng.int(lo, hi);
  return { u, n: s * u * u };
}

export const generators: Generator[] = [
  {
    id: 'rad-simplify',
    unitId: UNIT,
    title: '근호 밖으로 꺼내기',
    make(rng) {
      let s: number;
      let m: number;
      do {
        s = rng.pick(FREE);
        m = rng.int(2, 6);
      } while (m * m * s > 200);
      const n = m * m * s;
      return {
        q: `$\\sqrt{${n}}=a\\sqrt{b}$ 일 때, $a+b$ 의 값을 구하세요. (단, $b$ 는 가장 작은 자연수예요.)`,
        choices: null,
        answer: String(m + s),
        answerType: 'int',
        // sympy 가 √n 을 스스로 a√b 로 정리한 결과에서 a, b 를 읽는다
        check: `e = sqrt(${n})\nco, rt = e.as_coeff_Mul()\nans = co + rt**2`,
        concepts: [CONCEPT_OUT],
        steps: [
          {
            title: '제곱수 찾기',
            body: `$${n}$ ${eul(n)} 가장 큰 제곱수와 나머지로 나눠요.\n$$${n}=${m * m}\\times${s}=${m}^2\\times${s}$$`,
          },
          {
            title: '제곱수만 밖으로',
            body: `$$\\sqrt{${n}}=\\sqrt{${m}^2}\\times\\sqrt{${s}}=${m}\\sqrt{${s}}$$`,
          },
          { title: '더하기', body: `$a=${m}$, $b=${s}$ 이므로 $a+b=${m + s}$ ${ieyo(m + s)}.` },
        ],
        tip: `작은 제곱수로 한 번만 꺼내면 덜 꺼낸 거예요. 근호 안에 $4$, $9$, $16$ 같은 제곱 인수가 남았는지 꼭 확인해요.`,
      };
    },
  },
  {
    id: 'rad-mul-div',
    unitId: UNIT,
    title: '제곱근의 곱셈과 나눗셈',
    make(rng) {
      const s = rng.pick(FREE);
      if (rng.next() < 0.6) {
        // 곱셈: √(s·u²) × √(s·v²) — 근호 안의 곱이 제곱수라 값이 자연수로 떨어진다
        const A = hidden(rng, s, 1, 3);
        let B = hidden(rng, s, 1, 3);
        while (B.n === A.n) B = hidden(rng, s, 1, 3);
        const c1 = rng.int(1, 3);
        const c2 = rng.int(1, 3);
        const prod = A.n * B.n;
        const root = Math.sqrt(prod);
        const value = c1 * c2 * root;
        return {
          q: `$${rootTex(c1, A.n)}\\times${rootTex(c2, B.n)}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(value),
          answerType: 'int',
          check: `${c1}*sqrt(${A.n}) * ${c2}*sqrt(${B.n})`,
          concepts: [CONCEPT_MUL],
          steps: [
            {
              title: '근호 밖끼리, 안끼리',
              body: `밖의 수끼리 곱하고, 근호 안의 수끼리 곱해요.\n$$${c1 * c2 === 1 ? '' : c1 * c2}\\sqrt{${A.n}\\times${B.n}}=${rootTex(c1 * c2, prod)}$$`,
            },
            {
              title: '제곱수 꺼내기',
              body: `$${prod}=${root}^2$ 이므로 $\\sqrt{${prod}}=${root}$ ${ieyo(root)}.`,
            },
            {
              title: '곱하기',
              body:
                c1 * c2 === 1
                  ? `값은 $${value}$ ${ieyo(value)}.`
                  : `$$${c1 * c2}\\times${root}=${value}$$`,
            },
          ],
          tip: '근호 안을 먼저 곱한 뒤 제곱수를 찾으면 계산이 짧아요. 근호 밖의 수를 근호 안에 곱하지 않도록 조심해요.',
        };
      }
      // 나눗셈: k√(n·t²) ÷ √n = k·t
      const n = rng.pick([2, 3, 5, 6, 7, 10]);
      const t = rng.int(2, 5);
      const k = rng.int(1, 4);
      const big = n * t * t;
      return {
        q: `$${rootTex(k, big)}\\div\\sqrt{${n}}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(k * t),
        answerType: 'int',
        check: `${k}*sqrt(${big}) / sqrt(${n})`,
        concepts: [CONCEPT_MUL],
        steps: [
          {
            title: '근호 안끼리 나누기',
            body: `$$${k === 1 ? '' : k}\\sqrt{\\frac{${big}}{${n}}}=${k === 1 ? '' : k}\\sqrt{${t * t}}$$`,
          },
          {
            title: '제곱수 꺼내기',
            body: `$\\sqrt{${t * t}}=${t}$ 이므로 값은 $${k === 1 ? '' : `${k}\\times`}${t}=${k * t}$ ${ieyo(k * t)}.`,
          },
        ],
        tip: '나눗셈도 곱셈처럼 근호 안끼리 해요. 분수로 바꿔 약분하면 실수가 줄어요.',
      };
    },
  },
  {
    id: 'rad-rationalize',
    unitId: UNIT,
    title: '분모의 유리화',
    make(rng) {
      const n = rng.pick([2, 3, 5, 6, 7, 10]);
      let k: number;
      do k = rng.int(1, 12);
      while (gcd(k, n) === 1 && rng.next() < 0.6);
      const ans = fracAns(k, n);
      const shown = fracTex(k, n);
      return {
        q: `$\\frac{${k}}{\\sqrt{${n}}}$ 의 분모를 유리화하면 $a\\sqrt{${n}}$ ${ieyo(n)}. 유리수 $a$ 의 값을 구하세요.`,
        choices: null,
        answer: ans,
        answerType: 'fraction',
        check: `${k}/sqrt(${n}) / sqrt(${n})`,
        concepts: [CONCEPT_RAT],
        steps: [
          {
            title: '분모·분자에 같은 근호 곱하기',
            body: `$$\\frac{${k}}{\\sqrt{${n}}}=\\frac{${k}\\times\\sqrt{${n}}}{\\sqrt{${n}}\\times\\sqrt{${n}}}=\\frac{${k}\\sqrt{${n}}}{${n}}$$`,
          },
          // 이미 기약분수면 "약분하면 같은 수" 라는 겉도는 문장이 되므로 단계 이름부터 바꾼다
          gcd(k, n) === 1
            ? {
                title: '약분 확인',
                body: `근호 밖의 수 $\\frac{${k}}{${n}}$: 기약분수라 더 약분할 것이 없어요.`,
              }
            : {
                title: '약분하기',
                body: `근호 밖의 수 $\\frac{${k}}{${n}}$ ${eul(k)} 약분하면 $${shown}$ ${ieyo(reduce(k, n).n)}.`,
              },
          { title: '답 읽기', body: `$a=${shown}$ ${ieyo(reduce(k, n).n)}.` },
        ],
        tip: '분자에만 $\\sqrt{a}$ 를 곱하면 값이 바뀌어요. 분모와 분자에 똑같이 곱해야 1 을 곱한 셈이에요.',
      };
    },
  },
  {
    id: 'rad-addsub',
    unitId: UNIT,
    title: '제곱근의 덧셈과 뺄셈',
    make(rng) {
      const s = rng.pick([2, 3, 5]);
      let A: { u: number; n: number };
      let B: { u: number; n: number };
      let C: { u: number; n: number };
      do {
        A = hidden(rng, s, 1, 4);
        B = hidden(rng, s, 1, 4);
        C = hidden(rng, s, 1, 4);
      } while (A.u + B.u - C.u === 0 || A.n === B.n || B.n === C.n || A.n === C.n);
      const coef = A.u + B.u - C.u;
      const r = (u: number) => rootTex(u, s);
      return {
        q: `$\\sqrt{${A.n}}+\\sqrt{${B.n}}-\\sqrt{${C.n}}=a\\sqrt{${s}}$ 일 때, 정수 $a$ 의 값을 구하세요.`,
        choices: null,
        answer: String(coef),
        answerType: 'int',
        check: `(sqrt(${A.n}) + sqrt(${B.n}) - sqrt(${C.n})) / sqrt(${s})`,
        concepts: [CONCEPT_OUT, CONCEPT_ADD],
        steps: [
          {
            title: '근호 안을 같게 만들기',
            body: `세 수 모두 $${s}$ 에 제곱수가 곱해진 수예요. 하나씩 꺼내요.\n$$${r(A.u)}+${r(B.u)}-${r(C.u)}$$`,
          },
          {
            title: '근호 앞의 수끼리 계산',
            body: `$\\sqrt{${s}}$ ${eul(s)} 한 묶음으로 보고 앞의 수끼리 계산해요.\n$$(${A.u}+${B.u}-${C.u})\\sqrt{${s}}=${coef === 1 ? '' : coef === -1 ? '-' : coef}\\sqrt{${s}}$$`,
          },
          { title: '답 읽기', body: `$a=${coef}$ ${ieyo(coef)}.` },
        ],
        tip: `$\\sqrt{${A.n}}+\\sqrt{${B.n}}$ ${eul(B.n)} $\\sqrt{${A.n + B.n}}$ ${ro(A.n + B.n)} 합치면 틀려요. 근호 안을 같게 만든 뒤 앞의 수끼리 더해요.`,
      };
    },
  },
];
