import { eul, evalSteps, ieyo } from './math2-indefinite.ts';
import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { paren, polyDiff, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-definite';

// 기초 문제는 "원시함수를 찾아 F(b)-F(a)" 한 가지 길을 몸에 익히는 게 목적이라,
// 원시함수 계수가 정수가 되게 f(x) 를 고른다(x² 의 계수 3의 배수, x 의 계수 짝수).
// 분수가 나오는 계산은 표준·수능형 문제에서 다룬다.
const MAX = 150;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

const FTC = '$\\int_a^b f(x)\\,dx=F(b)-F(a)$ ($F$ 는 $f$ 의 한 부정적분)';

/** F(k) 한 줄. 0 을 넣으면 과정 없이 값만 */
const valueLine = (F: number[], k: number) =>
  k === 0 ? `$$F(0)=${polyEval(F, 0)}$$` : `$$F(${k})=${evalSteps(F, k)}=${polyEval(F, k)}$$`;

/** [F(x)]_a^b 를 F(b), F(a) 따로 구해 빼는 세 단계 */
function bracketSteps(F: number[], a: number, b: number) {
  const Fb = polyEval(F, b);
  const Fa = polyEval(F, a);
  return {
    ans: Fb - Fa,
    steps: [
      { title: `$F(${b})$ 구하기`, body: valueLine(F, b) },
      { title: `$F(${a})$ 구하기`, body: valueLine(F, a) },
      {
        title: '빼기',
        body: `$$F(${b})-F(${a})=${Fb}-${paren(Fa)}=${Fb - Fa}$$`,
      },
    ],
  };
}

/** 원시함수 계수가 정수가 되는 f(x)=3p x²+2q x+r 의 원시함수 [p, q, r, 0] */
function pickF(rng: Rng) {
  return [rng.nonzero(-2, 2), rng.int(-3, 3), rng.int(-5, 5), 0];
}

export const generators: Generator[] = [
  {
    id: 'math2-definite-poly',
    unitId: UNIT,
    title: '다항함수의 정적분',
    make(rng) {
      for (;;) {
        const F = pickF(rng);
        const f = polyDiff(F);
        const a = rng.int(-2, 2);
        const b = rng.int(a + 1, 3);
        const { ans, steps } = bracketSteps(F, a, b);
        if (!okAns(ans)) continue;
        return {
          q: `$\\displaystyle\\int_{${a}}^{${b}}(${polyTex(f)})\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `integrate(${polySym(f)}, (x, ${a}, ${b}))`,
          concepts: [FTC, '$\\int x^n\\,dx=\\dfrac{x^{n+1}}{n+1}+C$'],
          steps: [
            {
              title: '부정적분 하나 고르기',
              body: `적분상수는 빼도 돼요(빼는 과정에서 사라져요).\n$$F(x)=${polyTex(F)}$$`,
            },
            ...steps,
          ],
          tip: `$F(x)$ 를 미분하면 $${polyTex(f)}$ 로 돌아오는지 먼저 확인하면 실수가 줄어요.`,
        };
      }
    },
  },
  {
    id: 'math2-definite-join',
    unitId: UNIT,
    title: '이어진 구간의 정적분 합치기',
    make(rng) {
      for (;;) {
        const F = pickF(rng);
        const f = polyDiff(F);
        const a = rng.int(-2, 0);
        const c = rng.int(a + 1, 2);
        const b = rng.int(c + 1, 3);
        const { ans, steps } = bracketSteps(F, a, b);
        if (!okAns(ans)) continue;
        const ft = polyTex(f);
        return {
          q: `$\\displaystyle\\int_{${a}}^{${c}}(${ft})\\,dx+\\int_{${c}}^{${b}}(${ft})\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `integrate(${polySym(f)}, (x, ${a}, ${c})) + integrate(${polySym(f)}, (x, ${c}, ${b}))`,
          concepts: ['$\\int_a^c f(x)\\,dx+\\int_c^b f(x)\\,dx=\\int_a^b f(x)\\,dx$', FTC],
          steps: [
            {
              title: '구간 합치기',
              body: `함수가 같고 $${c}$ 에서 이어지므로 한 구간으로 합쳐요.\n$$\\int_{${a}}^{${b}}(${ft})\\,dx$$`,
            },
            {
              title: '부정적분 하나 고르기',
              body: `$$F(x)=${polyTex(F)}$$`,
            },
            ...steps,
          ],
          tip: `따로 계산해도 같아요. 가운데 $x=${c}$ 에서의 값은 더했다 빼져 사라지니, 합쳐서 한 번에 하는 편이 짧아요.`,
        };
      }
    },
  },
  {
    id: 'math2-definite-symmetric',
    unitId: UNIT,
    title: '대칭 구간의 정적분(짝수·홀수 차수)',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-3, 3);
        const q = rng.nonzero(-2, 2);
        const r = rng.nonzero(-5, 5);
        const s = rng.int(-4, 4);
        const a = rng.int(1, 3);
        const f = [p, 3 * q, r, s];
        // 홀수 차수 항은 대칭 구간에서 지워지고, 짝수 차수 항만 2배로 남는다
        const half = q * a ** 3 + s * a;
        const ans = 2 * half;
        if (!okAns(ans)) continue;
        const even = [3 * q, 0, s];
        const odd = [p, 0, r, 0];
        return {
          q: `$\\displaystyle\\int_{-${a}}^{${a}}(${polyTex(f)})\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `integrate(${polySym(f)}, (x, -${a}, ${a}))`,
          concepts: [
            '$x^3$, $x$ 처럼 홀수 차수 항은 $\\int_{-a}^{a}$ 에서 $0$ 이에요.',
            '$x^2$, 상수처럼 짝수 차수 항은 $\\int_{-a}^{a}=2\\int_0^a$ 예요.',
          ],
          steps: [
            {
              title: '홀수 차수 항 지우기',
              body: `홀수 차수 항 $${polyTex(odd)}$ 의 그래프는 원점에 대칭이라 $y$ 축 왼쪽과 오른쪽의 정적분이 부호만 반대예요. 더하면 $0$ 이에요.`,
            },
            {
              title: '짝수 차수 항은 2배',
              body: `$$\\int_{-${a}}^{${a}}(${polyTex(even)})\\,dx=2\\int_0^{${a}}(${polyTex(even)})\\,dx$$`,
            },
            {
              title: '0부터 계산하기',
              body: `부정적분 $${polyTex([q, 0, s, 0])}$ 에 $x=${a}$ ${eul(a)} 넣으면 $${evalSteps([q, 0, s, 0], a)}=${half}$ ${ieyo(half)}. $x=0$ 일 때는 $0$ 이에요.`,
            },
            {
              title: '2배 하기',
              body: `$$2\\cdot ${paren(half)}=${ans}$$`,
            },
          ],
          tip: `그냥 계산해도 같은 값이지만, $-${a}$ ${eul(a)} 세제곱하는 부호 계산이 줄어서 실수가 적어요.`,
        };
      }
    },
  },
  {
    id: 'math2-definite-defined',
    unitId: UNIT,
    title: '정적분으로 정의된 함수에서 $f$ 구하기',
    make(rng) {
      for (;;) {
        const k = rng.nonzero(-2, 2);
        const a = rng.nonzero(-6, 6);
        const r = -(k ** 3) - a * k;
        const m = rng.int(-2, 3);
        if (m === k) continue;
        const ans = 3 * m * m + a;
        if (!okAns(ans)) continue;
        const R = polyTex([1, 0, 0, r]).replace(/^x\^3/, '');
        const right = `x^3+ax${R}`;
        // a 앞의 계수 k 를 1·-1 이면 숨겨 "1a" 같은 표기를 피한다
        const kA = k === 1 ? 'a' : k === -1 ? '-a' : `${k}a`;
        return {
          q: `다항함수 $f(x)$ 가 모든 실수 $x$ 에 대하여 $\\displaystyle\\int_{${k}}^{x}f(t)\\,dt=${right}$ ${eul(right)} 만족시켜요. 상수 $a$ 에 대하여 $f(${m})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `a0 = solve(Eq((${k})**3 + a*(${k}) + (${r}), 0), a)[0]\nans = diff(x**3 + a0*x + (${r}), x).subs(x, ${m})`,
          concepts: [
            '$\\int_a^a f(t)\\,dt=0$ — 위끝과 아래끝이 같으면 $0$',
            '$\\dfrac{d}{dx}\\int_a^x f(t)\\,dt=f(x)$',
          ],
          steps: [
            {
              title: `$x=${k}$ 넣기`,
              body: `왼쪽은 위끝과 아래끝이 같아져 $0$ 이에요.\n$$0=${paren(k)}^3${k > 0 ? '+' : ''}${kA}${r === 0 ? '' : signed(r)}$$`,
            },
            {
              title: '$a$ 구하기',
              body:
                k === 1
                  ? `정리하면 $a=${a}$ ${ieyo(a)}.`
                  : `정리하면 $${kA}=${k * a}$ 이므로 $a=${a}$ ${ieyo(a)}.`,
            },
            {
              title: '양변 미분하기',
              body: `왼쪽을 $x$ 로 미분하면 $f(x)$ 예요.\n$$f(x)=3x^2${signed(a)}$$`,
            },
            {
              title: `$f(${m})$ 계산하기`,
              body: `$$f(${m})=3\\cdot ${paren(m)}^2${signed(a)}=${ans}$$`,
            },
          ],
          tip: `$x=${k}$ ${eul(k)} 넣어 상수를, 미분해서 $f(x)$ 를 얻어요. 이 두 동작이 정적분으로 정의된 함수 문제의 기본이에요.`,
        };
      }
    },
  },
];
