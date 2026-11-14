import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, polyDiff, polyEval, polySym, polyTex, reduce } from './util.ts';

const UNIT = 'calc-exp-log-diff';

// 이 단원의 극한은 모두 기본 꼴 셋 — (1+x)^(1/x)→e, (e^x-1)/x→1, ln(1+x)/x→1 — 로 "맞춰 주는" 연습이라,
// 풀이는 늘 "기본 꼴이 되도록 곱하고 나눠 맞추기 → 기본 꼴은 1(또는 e) → 남은 수 계산" 순서로 쓴다.
// 답이 e^k 처럼 무리수가 되는 극한은 지수 k 를 묻는다(정수 답이라야 앱이 채점한다).
// 검산은 sympy limit·diff 에 화면의 식을 그대로 넣어, 맞춰 주는 과정을 거치지 않은 값과 대조한다.
// 합성함수의 미분은 아직 배우지 않았으므로(다음 단원들) 미분 문제는 e^x, ln x 와 곱의 미분법까지만 쓴다.
// 생성기 id 는 다른 단원과 겹치지 않도록 모두 단원 id 'calc-exp-log-diff-' 로 시작한다.

// '이에요/예요'는 읽었을 때 끝소리 받침으로 갈린다(분수 b분의 a 는 분자 a 로 끝난다).
const ieyoN = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');
const ieyoF = (n: number, d: number) => ieyoN(reduce(n, d).n);

/** 계수: 1 은 생략, -1 은 부호만 */
const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : String(a));

const E_DEF = '$\\lim_{x\\to0}(1+x)^{\\frac1x}=e$';
const E_LIM = '$\\lim_{x\\to0}\\frac{e^x-1}{x}=1$';
const LN_LIM = '$\\lim_{x\\to0}\\frac{\\ln(1+x)}{x}=1$';
const D_EXP = "$(e^x)'=e^x$";
const D_LN = "$(\\ln x)'=\\frac1x$";
const PRODUCT = "곱의 미분법: $\\{f(x)g(x)\\}'=f'(x)g(x)+f(x)g'(x)$";

export const generators: Generator[] = [
  {
    id: 'calc-exp-log-diff-limit-e',
    unitId: UNIT,
    title: '$e$ 의 정의를 이용한 극한',
    make(rng) {
      // a=1 이면 이미 기본 꼴이라 맞춰 줄 게 없고, tip 의 '흔한 오답'이 정답과 같아진다
      const a = rng.pick([-4, -3, -2, -1, 2, 3, 4]);
      const b = rng.nonzero(-3, 4);
      const k = a * b;
      const ax = `${coef(a)}x`;
      // (1+ax)^(b/x) = {(1+ax)^(1/(ax))}^(ab)
      return {
        q: `$\\lim_{x\\to0}(1${a > 0 ? '+' : ''}${ax})^{\\frac{${b}}{x}}=e^k$ 일 때, 상수 $k$ 의 값을 구하세요.`,
        choices: null,
        answer: String(k),
        answerType: 'int',
        check: `log(limit((1 + (${a})*x)**(${b}/x), x, 0))`,
        concepts: [E_DEF, '$t=ax$ 로 두면 $x\\to0$ 일 때 $t\\to0$ 이에요.'],
        steps: [
          {
            title: '기본 꼴 찾기',
            body: `괄호 안이 $1+(${ax})$ 이니 지수가 $\\frac{1}{${ax}}$ 이면 기본 꼴이에요.`,
          },
          {
            title: '지수를 나눠 쓰기',
            body: `$\\frac{${b}}{x}=\\frac{1}{${ax}}\\times${paren(k)}$ 이므로\n$$(1${a > 0 ? '+' : ''}${ax})^{\\frac{${b}}{x}}=\\left\\{(1${a > 0 ? '+' : ''}${ax})^{\\frac{1}{${ax}}}\\right\\}^{${k}}$$`,
          },
          {
            title: '극한 구하기',
            body: `$x\\to0$ 이면 $${ax}\\to0$ 이라 중괄호 안은 $e$ 로 가요. 그래서 극한값은 $e^{${k}}$, $k=${k}$ ${ieyoN(k)}.`,
          },
        ],
        tip: `지수의 분자만 보고 답을 $e^{${b}}$ 처럼 쓰는 실수가 많아요. 괄호 안의 $${ax}$ 와 지수의 분모가 같아지도록 맞춰야 해요.`,
      };
    },
  },
  {
    id: 'calc-exp-log-diff-limit-basic',
    unitId: UNIT,
    title: '$\\frac{e^x-1}{x}$, $\\frac{\\ln(1+x)}{x}$ 꼴의 극한',
    make(rng) {
      let a = 0;
      let b = 0;
      // a = b 이면 맞춰 줄 것 없이 기본 꼴 그대로라 연습이 되지 않는다
      do {
        a = rng.nonzero(-5, 6);
        b = rng.int(1, 6);
      } while (a === b);
      const isExp = rng.int(0, 1) === 1;
      const ax = `${coef(a)}x`;
      const bx = `${coef(b)}x`;
      const top = isExp ? `e^{${ax}}-1` : `\\ln(1${a > 0 ? '+' : ''}${ax})`;
      const base = isExp
        ? `\\frac{e^{${ax}}-1}{${ax}}`
        : `\\frac{\\ln(1${a > 0 ? '+' : ''}${ax})}{${ax}}`;
      const ans = reduce(a, b);
      return {
        q: `$\\lim_{x\\to0}\\frac{${top}}{${bx}}$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(a, b),
        answerType: 'fraction',
        check: isExp
          ? `limit((exp(${a}*x) - 1)/(${b}*x), x, 0)`
          : `limit(log(1 + (${a})*x)/(${b}*x), x, 0)`,
        concepts: [isExp ? E_LIM : LN_LIM, '$t=ax$ 로 두면 $x\\to0$ 일 때 $t\\to0$ 이에요.'],
        steps: [
          {
            title: '분모를 기본 꼴로 맞추기',
            body: `분자에 $${ax}$ 가 있으니 분모에도 $${ax}$ 가 오도록 곱하고 나눠요.\n$$\\frac{${top}}{${bx}}=${base}\\times\\frac{${ax}}{${bx}}$$`,
          },
          {
            title: '기본 꼴의 극한',
            body: `$x\\to0$ 이면 $${ax}\\to0$ 이라 $${base}\\to1$ 이에요.`,
          },
          {
            title: '남은 수 계산',
            body: `$\\frac{${ax}}{${bx}}=${fracTex(a, b)}$ 이므로 극한값은 $1\\times${paren(fracTex(a, b))}=${fracTex(a, b)}$ ${ieyoF(ans.n, ans.d)}.`,
          },
        ],
        tip: isExp
          ? `$e^{${ax}}$ 의 지수와 분모가 같을 때만 $1$ 이에요. 결국 (지수의 계수)÷(분모의 계수)가 답이에요.`
          : `$\\ln$ 안의 $${ax}$ 와 분모가 같을 때만 $1$ 이에요. 결국 (안쪽 계수)÷(분모의 계수)가 답이에요.`,
      };
    },
  },
  {
    id: 'calc-exp-log-diff-deriv-exp',
    unitId: UNIT,
    title: '(다항식)$\\times e^x$ 의 미분계수',
    make(rng) {
      for (;;) {
        const f = [rng.int(-3, 3), rng.int(-5, 5), rng.int(-5, 5)];
        if (f[0] === 0 && f[1] === 0) continue;
        // x=0 에서만 묻는다 — 다른 점이면 답에 e 가 남아 정수로 채점할 수 없다
        const fk = polyEval(f, 0);
        const dfk = polyEval(polyDiff(f), 0);
        const ans = dfk + fk;
        if (ans === 0) continue;
        const P = polyTex(f);
        const Pd = polyTex(polyDiff(f));
        return {
          q: `함수 $f(x)=(${P})e^x$ 에 대하여 $f'(0)$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff((${polySym(f)})*exp(x), x).subs(x, 0)`,
          concepts: [D_EXP, PRODUCT],
          steps: [
            {
              title: '곱의 미분법 적용',
              body: `$(${P})'=${Pd}$, $(e^x)'=e^x$ 이므로\n$$f'(x)=(${Pd})e^x+(${P})e^x$$`,
            },
            {
              title: '$x=0$ 대입',
              body: `$e^0=1$ 이므로 $f'(0)=${paren(dfk)}+${paren(fk)}=${ans}$ ${ieyoN(ans)}.`,
            },
          ],
          tip: "$e^x$ 는 미분해도 그대로라서 $f'(x)=\\{P'(x)+P(x)\\}e^x$ 처럼 묶을 수 있어요. 다항식과 그 도함수를 더하기만 하면 돼요.",
        };
      }
    },
  },
  {
    id: 'calc-exp-log-diff-deriv-log',
    unitId: UNIT,
    title: '$\\ln x$ 가 든 함수의 미분계수',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-6, 6);
        const b = rng.int(-3, 3);
        const c = rng.int(-5, 5);
        const k = rng.int(1, 4);
        if (b === 0 && c === 0) continue;
        // f'(k) = a/k + 2bk + c
        const ans = reduce(a + 2 * b * k * k + c * k, k);
        if (ans.n === 0) continue;
        const poly = polyTex([b, c, 0]).replace(/^0$/, '');
        const fTex = `${coef(a)}\\ln x${poly ? (poly.startsWith('-') ? poly : `+${poly}`) : ''}`;
        const dPoly = polyTex([2 * b, c]);
        const dTex = `${a < 0 ? `-\\frac{${-a}}{x}` : `\\frac{${a}}{x}`}${dPoly === '0' ? '' : dPoly.startsWith('-') ? dPoly : `+${dPoly}`}`;
        const valPoly = 2 * b * k + c;
        return {
          q: `함수 $f(x)=${fTex}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `diff(${a}*log(x) + ${polySym([b, c, 0])}, x).subs(x, ${k})`,
          concepts: [D_LN, "$(x^n)'=nx^{n-1}$"],
          steps: [
            {
              title: '항마다 미분하기',
              body: `$(\\ln x)'=\\frac1x$ 이므로\n$$f'(x)=${dTex}$$`,
            },
            {
              title: `$x=${k}$ 대입`,
              body: `$$f'(${k})=${fracTex(a, k)}${valPoly === 0 ? '' : valPoly > 0 ? `+${valPoly}` : valPoly}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: `$\\ln x$ 를 미분하면 $\\frac1x$ 이에요. 값을 넣기 전에 먼저 미분해야 해요. $\\ln ${k}$ 같은 값이 남으면 순서가 바뀐 거예요.`,
        };
      }
    },
  },
];
