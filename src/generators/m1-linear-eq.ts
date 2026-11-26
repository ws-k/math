import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { eul, fracAns, fracTex, ieyo, lcm, paren, polySym, polyTex, ro } from './util.ts';

const UNIT = 'm1-linear-eq';

const CONCEPT_ADD = '등식의 성질: 양변에 같은 수(또는 같은 식)를 더하거나 빼도 등식은 그대로예요.';
const CONCEPT_DIV = '등식의 성질: 양변을 0이 아닌 같은 수로 나누어도 등식은 그대로예요.';
const CONCEPT_MUL = '등식의 성질: 양변에 같은 수를 곱해도 등식은 그대로예요.';
const CONCEPT_MOVE =
  '이항: 한 변의 항을 부호를 바꿔 다른 변으로 옮기는 것. 등식의 성질을 줄여 쓴 거예요.';

/** 오른쪽의 x 항 cx 를 없애는 단계: ax+b=cx+d → (a-c)x+b=d */
function xStep(a: number, b: number, c: number, d: number): Step {
  const lhs = polyTex([a, b]);
  const rhs = polyTex([c, d]);
  const cx = polyTex([Math.abs(c), 0]);
  const op = c > 0 ? '-' : '+';
  return {
    title: c > 0 ? `양변에서 $${cx}$ 빼기` : `양변에 $${cx}$ 더하기`,
    body:
      `$x$가 있는 항을 왼쪽으로 모아요. 오른쪽의 $${polyTex([c, 0])}$가 없어지도록 ` +
      `${c > 0 ? `양변에서 똑같이 $${cx}$를 빼요` : `양변에 똑같이 $${cx}$를 더해요`}.\n` +
      `$$${lhs}${op}${cx}=${rhs}${op}${cx}$$\n$$${polyTex([a - c, b])}=${d}$$`,
  };
}

/** 왼쪽 상수항 b 를 없애는 단계: kx+b=d → kx=d-b */
function constStep(k: number, b: number, d: number): Step {
  const lhs = polyTex([k, b]);
  const m = Math.abs(b);
  const op = b > 0 ? '-' : '+';
  return {
    title: b > 0 ? `양변에서 $${m}$ 빼기` : `양변에 $${m}$ 더하기`,
    body:
      `상수항은 오른쪽으로 보내요. 왼쪽의 상수항 $${b > 0 ? '+' : '-'}${m}$${eul(m)} 없애려고 ` +
      `${b > 0 ? `양변에서 똑같이 $${m}$${eul(m)} 빼요` : `양변에 똑같이 $${m}$${eul(m)} 더해요`}.\n` +
      `$$${lhs}${op}${m}=${d}${op}${m}$$\n$$${polyTex([k, 0])}=${d - b}$$`,
  };
}

/** kx=r → x=r/k */
function divideStep(k: number, r: number): Step {
  const raw = `\\frac{${r}}{${k}}`;
  const val = fracTex(r, k);
  return {
    title: `양변을 $${k}$${ro(k)} 나누기`,
    body:
      `$x$ 앞의 $${k}$${eul(k)} 없애려고 양변을 $${k}$${ro(k)} 나눠요. 0이 아닌 수로 나누는 것이라 등식은 그대로예요.\n` +
      `$$x=${raw}=${val}$$`,
  };
}

/**
 * 정수 계수 ax+b=cx+d 를 등식의 성질 순서대로 푸는 단계들.
 * 괄호·분수·소수 문제도 정수 계수 꼴로 바꾼 뒤 여기로 모아, 모든 유형의 마무리가 같은 말투가 되게 한다.
 */
function linSteps(a: number, b: number, c: number, d: number): Step[] {
  const k = a - c;
  if (k === 0) throw new Error('x 계수가 같아 해가 하나로 정해지지 않음');
  const steps: Step[] = [];
  if (c !== 0) steps.push(xStep(a, b, c, d));
  if (b !== 0) steps.push(constStep(k, b, d));
  if (k !== 1) steps.push(divideStep(k, d - b));
  return steps;
}

function answerOf(num: number, den: number): Pick<GenProblem, 'answer' | 'answerType'> {
  return { answer: fracAns(num, den), answerType: num % den === 0 ? 'int' : 'fraction' };
}

/** 정수 해일 때 처음 식에 넣어 보는 검산 팁 */
function substTip(x: number, left: string, lv: number, right?: string, rv?: number): string {
  const head = `구한 해를 처음 식에 넣어 확인해요. $x=${x}$이면 왼쪽은 $${left}=${lv}$`;
  // 오른쪽이 상수뿐이면 다시 계산할 것이 없으므로 왼쪽 값만 맞춰 본다
  if (right === undefined || rv === undefined) return `${head}${ro(lv)} 오른쪽과 같아요.`;
  return `${head}, 오른쪽은 $${right}=${rv}$${ro(rv)} 같아요.`;
}

const FRACTION_TIP =
  '해가 분수로 나와도 괜찮아요. 방정식의 해는 정수일 필요가 없어요. 다만 약분을 끝까지 했는지 확인해요.';

/** 계수 범위 안에서 0 이 아닌 수. 크기는 lo~hi, 부호는 무작위 */
function signed(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
}

export const generators: Generator[] = [
  {
    id: 'lin-eq-basic',
    unitId: UNIT,
    title: 'ax+b=c 꼴 풀기',
    make(rng) {
      const a = signed(rng, 2, 9);
      const b = signed(rng, 1, 15);
      let c: number;
      // 넷 중 하나는 분수 해가 나오도록 오른쪽을 고른다
      if (rng.next() < 0.25) {
        do c = rng.int(-20, 20);
        while ((c - b) % a === 0);
      } else {
        c = a * rng.nonzero(-9, 9) + b;
      }
      const steps = linSteps(a, b, 0, c);
      const x = (c - b) / a;
      const intX = Number.isInteger(x);
      return {
        q: `방정식 $${polyTex([a, b])}=${c}$의 해를 구하세요.`,
        choices: null,
        ...answerOf(c - b, a),
        check: `solve(Eq(${polySym([a, b])}, ${c}), x)[0]`,
        concepts: [CONCEPT_ADD, CONCEPT_DIV],
        steps,
        tip: intX
          ? substTip(x, `${a}\\times${paren(x)}${b > 0 ? '+' : '-'}${Math.abs(b)}`, c)
          : FRACTION_TIP,
      };
    },
  },
  {
    id: 'lin-eq-both-sides',
    unitId: UNIT,
    title: '양변에 x가 있는 방정식',
    make(rng) {
      let a: number;
      let c: number;
      do {
        a = signed(rng, 1, 9);
        c = signed(rng, 1, 9);
      } while (a === c);
      const b = signed(rng, 1, 15);
      let d: number;
      for (;;) {
        if (rng.next() < 0.25) {
          d = rng.nonzero(-30, 30);
          if ((d - b) % (a - c) !== 0) break;
        } else {
          d = (a - c) * rng.nonzero(-8, 8) + b;
          if (d !== 0 && Math.abs(d) <= 40) break;
        }
      }
      const x = (d - b) / (a - c);
      const L = polyTex([a, b]);
      const R = polyTex([c, d]);
      // 계수가 ±1 이면 "1×" 를 적지 않는다. 학생이 실제로 적는 모양과 같게
      const coefTimes = (k: number) => (k === 1 ? '' : k === -1 ? '-' : `${k}\\times`);
      const sub = (k: number, m: number) =>
        `${coefTimes(k)}${paren(x)}${m > 0 ? '+' : '-'}${Math.abs(m)}`;
      return {
        q: `방정식 $${L}=${R}$의 해를 구하세요.`,
        choices: null,
        ...answerOf(d - b, a - c),
        check: `solve(Eq(${polySym([a, b])}, ${polySym([c, d])}), x)[0]`,
        concepts: [CONCEPT_ADD, CONCEPT_DIV, CONCEPT_MOVE],
        steps: linSteps(a, b, c, d),
        tip: Number.isInteger(x)
          ? substTip(x, sub(a, b), a * x + b, sub(c, d), c * x + d)
          : `${FRACTION_TIP} 이항으로 줄여 쓰면 $x$항은 왼쪽, 상수항은 오른쪽으로 부호를 바꿔 옮긴 것과 같아요.`,
      };
    },
  },
  {
    id: 'lin-eq-paren',
    unitId: UNIT,
    title: '괄호가 있는 방정식',
    make(rng) {
      let a: number;
      let c: number;
      do {
        a = signed(rng, 2, 6);
        c = signed(rng, 2, 6);
      } while (a === c);
      let b: number;
      let d: number;
      let x: number;
      for (;;) {
        b = rng.nonzero(-6, 6);
        if (rng.next() < 0.25) {
          d = rng.nonzero(-9, 9);
          // b=d 면 괄호 안이 같아 x=-b 가 바로 보이므로 피한다
          if (d !== b && (c * d - a * b) % (a - c) !== 0) {
            x = (c * d - a * b) / (a - c);
            break;
          }
        } else {
          // a(x+b)=c(x+d) 에서 해가 x 가 되려면 c·d = (a-c)x + ab
          x = rng.nonzero(-7, 7);
          const cd = (a - c) * x + a * b;
          if (cd % c === 0 && cd !== 0 && cd / c !== b && Math.abs(cd / c) <= 9) {
            d = cd / c;
            break;
          }
        }
      }
      const L = `${a}(${polyTex([1, b])})`;
      const R = `${c}(${polyTex([1, d])})`;
      const expand: Step = {
        title: '괄호 풀기',
        body:
          '분배법칙으로 괄호 앞의 수를 괄호 안의 두 항에 각각 곱해요. 부호까지 함께 곱하는 것에 주의해요.\n' +
          `$$${polyTex([a, a * b])}=${polyTex([c, c * d])}$$`,
      };
      const sub = (k: number, m: number) => `${k}\\times(${x}${m > 0 ? '+' : '-'}${Math.abs(m)})`;
      return {
        q: `방정식 $${L}=${R}$의 해를 구하세요.`,
        choices: null,
        ...answerOf(c * d - a * b, a - c),
        check: `solve(Eq(${a}*(x + (${b})), ${c}*(x + (${d}))), x)[0]`,
        concepts: ['분배법칙: $k(x+m)=kx+km$', CONCEPT_ADD, CONCEPT_DIV],
        steps: [expand, ...linSteps(a, a * b, c, c * d)],
        tip: Number.isInteger(x)
          ? substTip(x, sub(a, b), a * (x + b), sub(c, d), c * (x + d))
          : `${FRACTION_TIP} 괄호 앞이 음수이면 괄호 안 두 항의 부호가 모두 바뀌어요.`,
      };
    },
  },
  {
    id: 'lin-eq-fraction',
    unitId: UNIT,
    title: '분수 계수 방정식',
    make(rng) {
      if (rng.next() < 0.5) {
        // x/p + q = r : 분모 p 를 곱하면 바로 정수 계수가 된다
        const p = rng.int(2, 9);
        const q = rng.nonzero(-9, 9);
        let r: number;
        do r = rng.nonzero(-9, 9);
        while (r === q);
        const sq = q > 0 ? '+' : '-';
        const mul: Step = {
          title: `양변에 $${p}$ 곱하기`,
          body:
            `분모 $${p}$${eul(p)} 없애려고 양변에 $${p}$${eul(p)} 곱해요. 왼쪽은 두 항 모두에 곱해야 해요.\n` +
            `$$\\frac{x}{${p}}\\times${p}${sq}${Math.abs(q)}\\times${p}=${paren(r)}\\times${p}$$\n` +
            `$$${polyTex([1, p * q])}=${p * r}$$`,
        };
        const x = p * (r - q);
        return {
          q: `방정식 $\\frac{x}{${p}}${sq}${Math.abs(q)}=${r}$의 해를 구하세요.`,
          choices: null,
          ...answerOf(x, 1),
          check: `solve(Eq(x/${p} + (${q}), ${r}), x)[0]`,
          concepts: [CONCEPT_MUL, CONCEPT_ADD],
          steps: [mul, ...linSteps(1, p * q, 0, p * r)],
          tip: `자주 하는 실수는 $\\frac{x}{${p}}$에만 $${p}$${eul(p)} 곱하고 $${Math.abs(q)}$에는 곱하지 않는 거예요. 양변 전체에 곱해야 저울이 기울지 않아요.`,
        };
      }
      // x/p ± x/s = r : 분모의 최소공배수를 곱해 정수 계수로 바꾼다
      let p: number;
      let s: number;
      do {
        p = rng.int(2, 6);
        s = rng.int(2, 6);
      } while (p === s);
      const plus = rng.next() < 0.5;
      const r = rng.nonzero(-6, 6);
      const m = lcm(p, s);
      const u = m / p;
      const v = m / s;
      const k = plus ? u + v : u - v;
      const op = plus ? '+' : '-';
      const steps: Step[] = [
        {
          title: `양변에 최소공배수 $${m}$ 곱하기`,
          body:
            `분모 $${p}$와 $${s}$의 최소공배수는 $${m}$${ieyo(m)}. 양변에 $${m}$${eul(m)} 곱하면 분모가 모두 사라져요.\n` +
            `$$\\frac{x}{${p}}\\times${m}${op}\\frac{x}{${s}}\\times${m}=${paren(r)}\\times${m}$$\n` +
            `$$${polyTex([u, 0])}${op}${polyTex([v, 0])}=${m * r}$$`,
        },
        {
          title: '$x$항끼리 계산하기',
          body: `$x$가 붙은 항끼리는 계수만 계산해요. $${u}${op}${v}=${k}$${ieyo(k)}.\n$$${polyTex([k, 0])}=${m * r}$$`,
        },
      ];
      if (k !== 1) steps.push(divideStep(k, m * r));
      return {
        q: `방정식 $\\frac{x}{${p}}${op}\\frac{x}{${s}}=${r}$의 해를 구하세요.`,
        choices: null,
        ...answerOf(m * r, k),
        check: `solve(Eq(x/${p} ${op} x/${s}, ${r}), x)[0]`,
        concepts: [
          CONCEPT_MUL,
          '분모가 여러 개면 분모들의 최소공배수를 곱하면 한 번에 정수 계수가 돼요.',
          CONCEPT_DIV,
        ],
        steps,
        tip: `분모를 곱하는 대신 $\\frac{1}{${p}}${op}\\frac{1}{${s}}$을 통분해도 같은 답이 나와요. 오른쪽 $${r}$에도 $${m}$${eul(m)} 곱하는 것을 잊지 않아요.`,
      };
    },
  },
  {
    id: 'lin-eq-decimal',
    unitId: UNIT,
    title: '소수 계수 방정식',
    make(rng) {
      // 모두 소수 첫째 자리까지라 10을 곱하면 정수 계수가 된다. A,C 는 x 계수의 10배
      const coef = () => {
        for (;;) {
          const v = signed(rng, 1, 15);
          if (Math.abs(v) !== 10) return v;
        }
      };
      let A: number;
      let C: number;
      do {
        A = coef();
        C = coef();
      } while (A === C);
      let B: number;
      let D: number;
      for (;;) {
        B = rng.nonzero(-30, 30);
        if (rng.next() < 0.2) {
          D = rng.nonzero(-40, 40);
          if ((D - B) % (A - C) !== 0) break;
        } else {
          D = (A - C) * rng.nonzero(-9, 9) + B;
          if (D !== 0 && Math.abs(D) <= 60) break;
        }
      }
      const dec = (n: number) => {
        const t = Math.abs(n);
        const s = t % 10 === 0 ? String(t / 10) : `${Math.floor(t / 10)}.${t % 10}`;
        return n < 0 ? `-${s}` : s;
      };
      const side = (k: number, m: number) => `${dec(k)}x${m > 0 ? '+' : '-'}${dec(Math.abs(m))}`;
      const mul: Step = {
        title: '양변에 $10$ 곱하기',
        body:
          '소수가 모두 소수 첫째 자리까지이므로 양변에 $10$을 곱하면 정수가 돼요. 네 항 모두에 곱해요.\n' +
          `$$${polyTex([A, B])}=${polyTex([C, D])}$$`,
      };
      const R = (n: number) => `Rational(${n}, 10)`;
      return {
        q: `방정식 $${side(A, B)}=${side(C, D)}$의 해를 구하세요.`,
        choices: null,
        ...answerOf(D - B, A - C),
        check: `solve(Eq(${R(A)}*x + ${R(B)}, ${R(C)}*x + ${R(D)}), x)[0]`,
        concepts: [CONCEPT_MUL, CONCEPT_ADD, CONCEPT_DIV],
        steps: [mul, ...linSteps(A, B, C, D)],
        tip: '소수 그대로 계산해도 되지만, 먼저 $10$을 곱해 정수로 바꾸면 계산 실수가 줄어들어요. 상수항에도 빠짐없이 곱했는지 확인해요.',
      };
    },
  },
];
