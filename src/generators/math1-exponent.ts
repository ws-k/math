import type { Generator } from './types.ts';
import { fracAns, fracTex } from './util.ts';

const UNIT = 'math1-exponent';

// 수능 공통 1번(지수 계산 2점)이 "밑을 하나로 맞추고 지수끼리 계산"하는 흐름이라,
// 모든 생성기는 밑을 소수(2·3·5)의 거듭제곱으로 바꾸는 단계를 풀이에 꼭 넣는다.
// 검산식은 화면 숫자 그대로(Integer(8)**Rational(2,3))를 sympy 에 넣는다 — 파이썬 정수 나눗셈(2/3)이
// 실수로 바뀌어 검산이 근삿값 비교가 되는 걸 막으려고 지수는 늘 Rational 로 쓴다.

// '이에요/예요'는 앞 소리의 받침으로 갈린다. 분수는 분자가 마지막에 읽혀서("2분의 3") 분자 끝 숫자로 고른다
// (일·삼·육·칠·팔·영/십/백이 받침).
const ieyo = (v: string | number) => {
  const s = String(v).replace(/\\frac\{(-?\d+)\}\{\d+\}/, '$1');
  return /[013678]$/.test(s) ? '이에요' : '예요';
};

/** 지수 m/n 의 TeX. 정수면 그대로, 아니면 \frac */
const expTex = (m: number, n: number) => fracTex(m, n);

const ROOT = '$a>0$ 일 때 $a^{\\frac{m}{n}}=\\sqrt[n]{a^m}=(\\sqrt[n]{a})^m$';
const LAW_MUL = '지수법칙: $a^x\\times a^y=a^{x+y}$';
const LAW_POW = '지수법칙: $(a^x)^y=a^{xy}$';
const NEG = '$a^0=1$, $a^{-n}=\\dfrac{1}{a^n}$';

// 밑이 될 수 있는 수: 소수 p 의 거듭제곱. 큰 수는 손계산이 지루해지므로 범위를 묶는다.
const PRIMES = [2, 3, 5] as const;

export const generators: Generator[] = [
  {
    id: 'ex1-frac-power',
    unitId: UNIT,
    title: '분수 지수의 값',
    make(rng) {
      for (;;) {
        const p = rng.pick(PRIMES);
        const n = rng.pick([2, 3]);
        const s = rng.int(1, 2); // 밑 = p^(n·s) 가 아니라 (p^s)^n
        const m = rng.pick([1, 2, 3, -1, -2]);
        const base = p ** (s * n);
        const k = s * m; // 답 = p^k
        if (base > 125 || Math.abs(k) > 4 || p ** Math.abs(k) > 125) continue;
        if (m % n === 0) continue; // 지수가 정수면 분수 지수 연습이 안 된다
        const ans = k >= 0 ? fracAns(p ** k, 1) : fracAns(1, p ** -k);
        const ansTex = k >= 0 ? String(p ** k) : fracTex(1, p ** -k);
        return {
          q: `$${base}^{${expTex(m, n)}}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `Integer(${base})**Rational(${m}, ${n})`,
          concepts: [ROOT, LAW_POW, NEG],
          steps: [
            {
              title: '밑을 거듭제곱으로 쓰기',
              body: `밑을 $${p}$ 의 거듭제곱으로 바꿔요.\n$$${base}=${p}^{${s * n}}$$`,
            },
            {
              title: '지수끼리 곱하기',
              body: `$$${base}^{${expTex(m, n)}}=(${p}^{${s * n}})^{${expTex(m, n)}}=${p}^{${s * n}\\times${m < 0 ? `(${expTex(m, n)})` : expTex(m, n)}}=${p}^{${k}}$$`,
            },
            {
              title: '값 계산하기',
              body: `$$${p}^{${k}}=${ansTex}$$`,
            },
          ],
          tip:
            k < 0
              ? `지수가 음수면 값도 음수라고 착각하기 쉬워요. $${p}^{${k}}$ 는 $${p}^{${-k}}$ 의 역수예요.`
              : m === 1
                ? `$${base}^{${expTex(m, n)}}=\\sqrt[${n}]{${base}}$, 곧 '$${n}$ 제곱하면 $${base}$ 인 양수'예요.`
                : `$${base}^{${expTex(m, n)}}$ 는 '$${n}$ 제곱하면 $${base}$ 인 양수'를 $${m}$ 번 곱한 거예요.`,
        };
      }
    },
  },
  {
    id: 'ex1-same-base',
    unitId: UNIT,
    title: '밑이 같은 분수 지수의 곱셈·나눗셈',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3, 5, 7]);
        const n = rng.pick([2, 3, 4]);
        const a = rng.int(1, 2 * n);
        const div = rng.int(0, 1) === 1;
        const b = rng.int(1, 2 * n);
        const top = div ? a - b : a + b;
        if (top % n !== 0) continue;
        const k = top / n;
        if (k < -2 || k > 3 || k === 0) continue;
        if (a % n === 0 || b % n === 0) continue;
        if (p ** Math.abs(k) > 125) continue;
        const ans = k > 0 ? String(p ** k) : fracAns(1, p ** -k);
        const ansTex = k > 0 ? String(p ** k) : fracTex(1, p ** -k);
        const op = div ? '\\div' : '\\times';
        const sign = div ? '-' : '+';
        return {
          q: `$${p}^{${expTex(a, n)}}${op}${p}^{${expTex(b, n)}}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: div
            ? `Integer(${p})**Rational(${a}, ${n}) / Integer(${p})**Rational(${b}, ${n})`
            : `Integer(${p})**Rational(${a}, ${n}) * Integer(${p})**Rational(${b}, ${n})`,
          concepts: [
            LAW_MUL,
            '지수법칙: $a^x\\div a^y=a^{x-y}$',
            '지수가 분수여도 밑이 같으면 지수끼리 더하고 빼요.',
          ],
          steps: [
            {
              title: div ? '나누면 지수끼리 빼기' : '곱하면 지수끼리 더하기',
              body: `밑이 $${p}$ 로 같아요.\n$$${p}^{${expTex(a, n)}}${op}${p}^{${expTex(b, n)}}=${p}^{${expTex(a, n)}${sign}${expTex(b, n)}}$$`,
            },
            {
              title: '지수 계산하기',
              body: `$$${expTex(a, n)}${sign}${expTex(b, n)}=${k}$$`,
            },
            {
              title: '값 계산하기',
              body: `$$${p}^{${k}}=${ansTex}$$`,
            },
          ],
          tip: `거듭제곱근으로 바꾸지 않고 지수끼리 계산하면 한 줄로 끝나요. 답 $${ansTex}$ ${ieyo(ansTex)}.`,
        };
      }
    },
  },
  {
    id: 'ex1-root-product',
    unitId: UNIT,
    title: '거듭제곱근의 곱',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3]);
        const n = rng.pick([3, 4]);
        const i = rng.int(1, n + 2);
        const j = rng.int(1, n + 2);
        if (i % n === 0 || j % n === 0 || (i + j) % n !== 0) continue;
        const k = (i + j) / n;
        const A = p ** i;
        const B = p ** j;
        if (A > 250 || B > 250 || p ** k > 81) continue;
        return {
          q: `$\\sqrt[${n}]{${A}}\\times\\sqrt[${n}]{${B}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p ** k),
          answerType: 'int',
          check: `Integer(${A})**Rational(1, ${n}) * Integer(${B})**Rational(1, ${n})`,
          concepts: [ROOT, LAW_MUL],
          steps: [
            {
              title: '밑을 하나로 맞추기',
              body: `두 수를 $${p}$ 의 거듭제곱으로 바꿔요.\n$$${A}=${p}^{${i}},\\quad ${B}=${p}^{${j}}$$`,
            },
            {
              title: '분수 지수로 바꾸기',
              body: `$$\\sqrt[${n}]{${A}}\\times\\sqrt[${n}]{${B}}=${p}^{${expTex(i, n)}}\\times${p}^{${expTex(j, n)}}$$`,
            },
            {
              title: '지수끼리 더하기',
              body: `$$${p}^{${expTex(i, n)}+${expTex(j, n)}}=${p}^{${k}}$$`,
            },
            {
              title: '값 계산하기',
              body: `$$${p}^{${k}}=${p ** k}$$`,
            },
          ],
          tip: `$\\sqrt[${n}]{${A}\\times${B}}=\\sqrt[${n}]{${A * B}}$ 로 먼저 합쳐도 같아요. $${A * B}=${p ** k}^{${n}}$ 이기 때문이에요.`,
        };
      }
    },
  },
  {
    id: 'ex1-neg-zero',
    unitId: UNIT,
    title: '0 과 음의 정수 지수',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 5);
        const b = rng.int(2, 5);
        if (a === b) continue;
        const e = rng.pick([1, 2, 3]);
        const c = rng.int(2, 9);
        // (a/b)^(-e) + c^0 = (b/a)^e + 1
        const num = b ** e + a ** e;
        const den = a ** e;
        if (den > 64 || b ** e > 125) continue;
        const g = fracAns(a, b);
        if (g.indexOf('/') < 0) continue; // a/b 가 정수가 되면 분수 밑 연습이 안 된다
        const [ga, gb] = g.split('/').map(Number) as [number, number];
        if (ga !== a || gb !== b) continue; // 기약분수만
        const inv = fracTex(b ** e, a ** e);
        return {
          q: `$\\left(\\dfrac{${a}}{${b}}\\right)^{-${e}}+${c}^{0}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(num, den),
          answerType: 'fraction',
          check: `Rational(${a}, ${b})**(-${e}) + Integer(${c})**0`,
          concepts: [NEG, '$\\left(\\dfrac{a}{b}\\right)^{-n}=\\left(\\dfrac{b}{a}\\right)^{n}$'],
          steps: [
            {
              title: '음의 지수는 뒤집기',
              body: `$$\\left(\\frac{${a}}{${b}}\\right)^{-${e}}=\\left(\\frac{${b}}{${a}}\\right)^{${e}}=${inv}$$`,
            },
            {
              title: '0 제곱은 1',
              body: `$${c}^{0}=1$ 이에요.`,
            },
            {
              title: '더하기',
              body: `$$${inv}+1=${fracTex(num, den)}$$`,
            },
          ],
          tip: `$${c}^0$ 을 $0$ 으로 적는 실수가 많아요. 0 이 아닌 수의 0 제곱은 언제나 $1$ 이에요.`,
        };
      }
    },
  },
];
