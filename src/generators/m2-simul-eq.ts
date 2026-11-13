import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { paren } from './util.ts';

const UNIT = 'm2-simul-eq';

// 숫자 뒤 조사. 읽었을 때 끝 글자의 받침은 마지막 자리로 정해진다(m1-linear-eq 와 같은 규칙).
const eul = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '을' : '를');
const ro = (n: number) => ([0, 3, 6].includes(Math.abs(n) % 10) ? '으로' : '로');

const CONCEPT_ADDSUB =
  '가감법: 한 문자의 계수를 같게(또는 부호만 반대로) 맞춘 뒤 두 식을 빼거나 더해 그 문자를 없애요.';
const CONCEPT_SUBST = '대입법: 한 식을 $y=\\cdots$ 꼴로 만들어 다른 식의 $y$ 자리에 넣어요.';
const CONCEPT_BACK = '한 문자의 값을 구하면 처음 식에 넣어 나머지 문자의 값을 구해요.';

/** ax 처럼 계수와 문자를 붙인 항. 첫 항이 아니면 부호를 앞에 붙인다 */
function term(c: number, v: string, first: boolean): string {
  if (c === 0) return '';
  const sign = c < 0 ? '-' : first ? '' : '+';
  const a = Math.abs(c);
  return `${sign}${a === 1 ? '' : a}${v}`;
}

/** ax+by (KaTeX) */
const lhsTex = (a: number, b: number) => term(a, 'x', true) + term(b, 'y', a === 0);
/** ax+by=c (KaTeX) */
const eqTex = (a: number, b: number, c: number) => `${lhsTex(a, b)}=${c}`;
/** sympy 등식 */
const eqSym = (a: number, b: number, c: number) => `Eq(${a}*x + ${b}*y, ${c})`;

/** 두 식을 세로로 묶은 연립방정식 */
const sysTex = (e1: string, e2: string) => `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}`;

/** 해 (x0, y0) 를 구해 x+y 를 답으로 하는 검산식. 답을 베끼지 않고 연립방정식을 sympy 가 푼다 */
const sumCheck = (e1: string, e2: string) => `s = solve([${e1}, ${e2}], [x, y])\nans = s[x] + s[y]`;

/** 0 이 아닌 해 하나. 너무 큰 수는 계산 연습이 아니라 짐이 되므로 ±6 안 */
const root = (rng: Rng) => rng.nonzero(-6, 6);

/** kv=r 에서 v 구하기 */
function solveOne(k: number, r: number, v: string): Step {
  if (k === 1) return { title: `$${v}$의 값`, body: `$$${v}=${r}$$` };
  return {
    title: `양변을 $${k}$${ro(k)} 나누기`,
    body: `$$${term(k, v, true)}=${r}$$\n$$${v}=\\frac{${r}}{${k}}=${r / k}$$`,
  };
}

/** x=x0 를 a x + b y = c 에 넣어 y 구하기 */
function backY(a: number, b: number, c: number, x0: number): Step[] {
  const rest = c - a * x0;
  const steps: Step[] = [
    {
      title: `$x=${x0}$${eul(x0)} 첫째 식에 넣기`,
      body:
        `$$${a}\\times${paren(x0)}${term(b, 'y', false)}=${c}$$\n` +
        `$$${term(b, 'y', true)}=${c}${a * x0 > 0 ? '-' : '+'}${Math.abs(a * x0)}=${rest}$$`,
    },
  ];
  if (b !== 1) steps.push(solveOne(b, rest, 'y'));
  return steps;
}

const answerStep = (x0: number, y0: number): Step => ({
  title: '답 구하기',
  body: `해는 $x=${x0}$, $y=${y0}$이에요.\n$$x+y=${x0}+${paren(y0)}=${x0 + y0}$$`,
});

const checkTip = (a: number, b: number, x0: number, y0: number, c: number) =>
  `구한 해를 다른 식에도 넣어 확인해요. $${a}\\times${paren(x0)}+${paren(b)}\\times${paren(y0)}=${c}$이면 맞아요.`;

export const generators: Generator[] = [
  {
    id: 'simul-eliminate-y',
    unitId: UNIT,
    title: '가감법: y 계수가 같거나 반대인 연립방정식',
    make(rng) {
      const x0 = root(rng);
      const y0 = root(rng);
      const b = rng.int(1, 5);
      // y 계수가 같으면 빼고, 부호가 반대면 더한다 — 두 경우를 섞어 둘 다 연습하게
      const add = rng.next() < 0.5;
      const b2 = add ? -b : b;
      let a1: number;
      let a2: number;
      // x 계수가 0 이 되거나(한 식이 y 만) 두 식을 합쳐 x 가 사라지면 가감법 연습이 안 된다
      do {
        a1 = rng.nonzero(-5, 5);
        a2 = rng.nonzero(-5, 5);
      } while (add ? a1 + a2 === 0 : a1 === a2);
      const c1 = a1 * x0 + b * y0;
      const c2 = a2 * x0 + b2 * y0;
      const e1 = eqTex(a1, b, c1);
      const e2 = eqTex(a2, b2, c2);
      const k = add ? a1 + a2 : a1 - a2;
      const r = add ? c1 + c2 : c1 - c2;
      const steps: Step[] = [
        {
          title: add ? '두 식 더하기' : '첫째 식에서 둘째 식 빼기',
          body:
            `$y$의 계수가 ${add ? '부호만 반대' : '같아요'}${add ? '예요' : ''}. ` +
            `${add ? '두 식을 더하면' : '빼면'} $y$가 사라져요.\n` +
            `$$(${lhsTex(a1, b)})${add ? '+' : '-'}(${lhsTex(a2, b2)})=${c1}${add ? '+' : '-'}${paren(c2)}$$\n` +
            `$$${term(k, 'x', true)}=${r}$$`,
        },
        ...(k === 1 ? [] : [solveOne(k, r, 'x')]),
        ...backY(a1, b, c1, x0),
        answerStep(x0, y0),
      ];
      return {
        q: `연립방정식 $${sysTex(e1, e2)}$의 해를 $x=p$, $y=q$라 할 때, $p+q$의 값을 구하세요.`,
        choices: null,
        answer: String(x0 + y0),
        answerType: 'int',
        check: sumCheck(eqSym(a1, b, c1), eqSym(a2, b2, c2)),
        concepts: [CONCEPT_ADDSUB, CONCEPT_BACK],
        steps,
        tip: checkTip(a2, b2, x0, y0, c2),
      };
    },
  },
  {
    id: 'simul-substitute',
    unitId: UNIT,
    title: '대입법: y=mx+k 를 넣는 연립방정식',
    make(rng) {
      const x0 = root(rng);
      const m = rng.nonzero(-4, 4);
      const kk = rng.int(-6, 6);
      const y0 = m * x0 + kk;
      let a: number;
      let b: number;
      // 넣은 뒤 x 계수 a+bm 이 0 이면 x 가 사라져 해가 하나로 정해지지 않는다
      do {
        a = rng.nonzero(-5, 5);
        b = rng.nonzero(-5, 5);
      } while (a + b * m === 0);
      const c = a * x0 + b * y0;
      const yExpr = `${term(m, 'x', true)}${kk === 0 ? '' : kk > 0 ? `+${kk}` : kk}`;
      const k = a + b * m;
      const r = c - b * kk;
      const steps: Step[] = [
        {
          title: '첫째 식을 둘째 식에 넣기',
          body: `$y$ 자리에 $${yExpr}$를 괄호째 넣어요.\n$$${term(a, 'x', true)}${b < 0 ? '-' : '+'}${Math.abs(b) === 1 ? '' : Math.abs(b)}(${yExpr})=${c}$$`,
        },
        {
          title: '괄호 풀고 정리하기',
          body:
            `괄호 앞의 $${b}$${eul(b)} 안의 두 항에 모두 곱해요.\n` +
            `$$${term(a, 'x', true)}${term(b * m, 'x', false)}${kk === 0 ? '' : `${b * kk > 0 ? '+' : '-'}${Math.abs(b * kk)}`}=${c}$$\n` +
            `$$${term(k, 'x', true)}=${r}$$`,
        },
        ...(k === 1 ? [] : [solveOne(k, r, 'x')]),
        {
          title: `$x=${x0}$${eul(x0)} 첫째 식에 넣기`,
          body: `$$y=${m}\\times${paren(x0)}${kk === 0 ? '' : kk > 0 ? `+${kk}` : kk}=${y0}$$`,
        },
        answerStep(x0, y0),
      ];
      return {
        q: `연립방정식 $${sysTex(`y=${yExpr}`, eqTex(a, b, c))}$의 해를 $x=p$, $y=q$라 할 때, $p+q$의 값을 구하세요.`,
        choices: null,
        answer: String(x0 + y0),
        answerType: 'int',
        check: sumCheck(`Eq(y, ${m}*x + ${kk})`, eqSym(a, b, c)),
        concepts: [CONCEPT_SUBST, CONCEPT_BACK],
        steps,
        tip: `$${b}(${yExpr})$처럼 넣을 때 괄호를 빼먹으면 뒤 항에 $${b}$${eul(b)} 곱하지 않는 실수가 나와요.`,
      };
    },
  },
  {
    id: 'simul-scale-one',
    unitId: UNIT,
    title: '가감법: 한 식에 수를 곱해 계수 맞추기',
    make(rng) {
      const x0 = root(rng);
      const y0 = root(rng);
      // 둘째 식의 y 계수가 1 이라 둘째 식에 첫째 식의 y 계수만 곱하면 맞는다
      const b1 = rng.pick([2, 3, 4, 5]);
      const sgn = rng.next() < 0.5 ? 1 : -1;
      let a1: number;
      let a2: number;
      do {
        a1 = rng.nonzero(-5, 5);
        a2 = rng.nonzero(-4, 4);
      } while (a1 === a2 * b1 * sgn);
      const b2 = sgn;
      const c1 = a1 * x0 + b1 * y0;
      const c2 = a2 * x0 + b2 * y0;
      const mul = b1 * sgn; // 둘째 식에 곱하는 수 → y 계수가 b1 로 같아진다
      const A2 = a2 * mul;
      const C2 = c2 * mul;
      const k = a1 - A2;
      const r = c1 - C2;
      const steps: Step[] = [
        {
          title: `둘째 식에 $${mul}$${eul(mul)} 곱하기`,
          body:
            `$y$의 계수를 첫째 식과 같은 $${b1}$${ro(b1)} 맞춰요. 모든 항에 곱해요.\n` +
            `$$${eqTex(A2, b1, C2)}$$`,
        },
        {
          title: '첫째 식에서 빼기',
          body: `$$(${lhsTex(a1, b1)})-(${lhsTex(A2, b1)})=${c1}-${paren(C2)}$$\n$$${term(k, 'x', true)}=${r}$$`,
        },
        ...(k === 1 ? [] : [solveOne(k, r, 'x')]),
        ...backY(a1, b1, c1, x0),
        answerStep(x0, y0),
      ];
      return {
        q: `연립방정식 $${sysTex(eqTex(a1, b1, c1), eqTex(a2, b2, c2))}$의 해를 $x=p$, $y=q$라 할 때, $p+q$의 값을 구하세요.`,
        choices: null,
        answer: String(x0 + y0),
        answerType: 'int',
        check: sumCheck(eqSym(a1, b1, c1), eqSym(a2, b2, c2)),
        concepts: [
          CONCEPT_ADDSUB,
          '등식의 성질: 양변에 같은 수를 곱해도 등식은 그대로예요.',
          CONCEPT_BACK,
        ],
        steps,
        tip: `수를 곱할 때 우변의 $${c2}$에도 곱해야 해요. 좌변에만 곱하면 다른 식이 돼요.`,
      };
    },
  },
];
