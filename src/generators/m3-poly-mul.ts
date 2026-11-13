import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { paren, polyMul, polySym, polyTex } from './util.ts';

const UNIT = 'm3-poly-mul';

// 숫자 뒤 조사는 읽는 소리의 받침으로 갈린다(m1-linear-eq 와 같은 규칙). 숫자가 무작위라 마지막 자리로 고른다.
// (일·삼·육·칠·팔·영/십 → 받침, 이·사·오·구 → 없음). ㄹ 받침(1·7·8)은 '로'를 쓴다.
const eul = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '을' : '를');
const ro = (n: number) => ([0, 3, 6].includes(Math.abs(n) % 10) ? '으로' : '로');
const gwa = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '과' : '와');
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

const CONCEPT_SQ =
  '$(a+b)^2=a^2+2ab+b^2$, $(a-b)^2=a^2-2ab+b^2$. 가운데 항 $2ab$ 를 빠뜨리지 마세요.';
const CONCEPT_DIFF = '$(a+b)(a-b)=a^2-b^2$. 가운데 항이 서로 지워져요.';
const CONCEPT_XAB = '$(x+a)(x+b)=x^2+(a+b)x+ab$';
const CONCEPT_GEN = '$(ax+b)(cx+d)=acx^2+(ad+bc)x+bd$';

/** 0 이 아닌 lo~hi 크기의 정수, 부호는 무작위 */
function signed(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
}

/** 계수 하나를 곱셈 기호로 이은 TeX 조각: 2 와 -3 → "2\times(-3)" */
const times = (...ns: number[]) =>
  ns.map((n, i) => (i === 0 ? String(n) : paren(n))).join('\\times ');

export const generators: Generator[] = [
  {
    id: 'poly-square',
    unitId: UNIT,
    title: '완전제곱 꼴 전개하기',
    make(rng) {
      const p = rng.int(1, 4);
      const q = signed(rng, 1, 7);
      const lin = [p, q];
      const full = polyMul(lin, lin);
      const askX = rng.next() < 0.6;
      const asked = askX
        ? (full[1] as number)
        : (full[0] as number) + (full[1] as number) + (full[2] as number);
      return {
        q: askX
          ? `$(${polyTex(lin)})^2$ 을 전개했을 때, $x$ 의 계수를 구하세요.`
          : `$(${polyTex(lin)})^2$ 을 전개하면 $Ax^2+Bx+C$ 예요. $A+B+C$ 의 값을 구하세요.`,
        choices: null,
        answer: String(asked),
        answerType: 'int',
        check: askX
          ? `expand((${polySym(lin)})**2).coeff(x, 1)`
          : `f = expand((${polySym(lin)})**2)\nans = f.coeff(x, 2) + f.coeff(x, 1) + f.coeff(x, 0)`,
        concepts: [CONCEPT_SQ],
        steps: [
          {
            title: '두 항 정하기',
            body: `$a=${polyTex([p, 0])}$, $b=${q}$ ${ro(q)} 보면 $(a+b)^2$ 꼴이에요.`,
          },
          {
            title: '공식에 넣기',
            body: `$$${p === 1 ? 'x' : `(${p}x)`}^2+2\\times ${p === 1 ? 'x' : `${p}x`}\\times ${paren(q)}+${paren(q)}^2$$`,
          },
          { title: '정리하기', body: `$$${polyTex(full)}$$` },
          askX
            ? { title: '계수 읽기', body: `$x$ 의 계수는 $${full[1]}$ ${ieyo(full[1] as number)}.` }
            : {
                title: '계수 더하기',
                body: `$$${full[0]}${(full[1] as number) < 0 ? '' : '+'}${full[1]}+${full[2]}=${asked}$$`,
              },
        ],
        tip: askX
          ? `가운데 항은 두 항의 곱의 2배예요. $${times(2, p, q)}=${full[1]}$ 처럼 2 를 꼭 곱해요.`
          : '$A+B+C$ 는 $x=1$ 을 넣은 값과 같아요. 전개 전 식에 $x=1$ 을 넣어 검산할 수 있어요.',
      };
    },
  },
  {
    id: 'poly-diff-squares',
    unitId: UNIT,
    title: '합과 차의 곱',
    make(rng) {
      if (rng.next() < 0.4) {
        // 수 계산: (100+d)(100-d) 꼴 — 곱셈 공식이 암산 도구가 되는 장면
        const base = rng.pick([20, 30, 50, 100]);
        const d = rng.int(1, base === 100 ? 9 : 4);
        const a = base + d;
        const b = base - d;
        return {
          q: `곱셈 공식을 이용해 $${a}\\times${b}$ ${eul(b)} 계산하세요.`,
          choices: null,
          answer: String(a * b),
          answerType: 'int',
          check: `${a}*${b}`,
          concepts: [CONCEPT_DIFF],
          steps: [
            {
              title: '합과 차로 쓰기',
              body: `$${a}=${base}+${d}$, $${b}=${base}-${d}$ ${ieyo(d)}.\n$$(${base}+${d})(${base}-${d})$$`,
            },
            { title: '공식 쓰기', body: `$$${base}^2-${d}^2=${base * base}-${d * d}$$` },
            { title: '빼기', body: `$$${base * base}-${d * d}=${a * b}$$` },
          ],
          tip: '두 수의 가운데 수를 찾으면 합과 차의 곱으로 바꿀 수 있어요. 가운데 수의 제곱에서 거리의 제곱을 빼요.',
        };
      }
      const p = rng.int(1, 5);
      const q = rng.int(1, 9);
      const A = p * p;
      const B = -q * q;
      return {
        q: `$(${polyTex([p, q])})(${polyTex([p, -q])})$ 를 전개하면 $Ax^2+B$ 예요. $A+B$ 의 값을 구하세요.`,
        choices: null,
        answer: String(A + B),
        answerType: 'int',
        check: `f = expand((${polySym([p, q])})*(${polySym([p, -q])}))\nans = f.coeff(x, 2) + f.coeff(x, 0)`,
        concepts: [CONCEPT_DIFF],
        steps: [
          {
            title: '합과 차의 곱 알아보기',
            body: `$a=${polyTex([p, 0])}$, $b=${q}$ 인 $(a+b)(a-b)$ 꼴이에요.`,
          },
          {
            title: '공식 쓰기',
            body: `$$${p === 1 ? 'x' : `(${p}x)`}^2-${q}^2=${polyTex([A, 0, B])}$$`,
          },
          { title: '더하기', body: `$A=${A}$, $B=${B}$ 이므로 $A+B=${A + B}$ ${ieyo(A + B)}.` },
        ],
        tip: `하나씩 곱하면 $${polyTex([p * q, 0])}$ 와 $${polyTex([-p * q, 0])}$ 가 생겨 서로 지워져요. 그래서 항이 두 개만 남아요.`,
      };
    },
  },
  {
    id: 'poly-x-ab',
    unitId: UNIT,
    title: '(x+a)(x+b) 전개하기',
    make(rng) {
      let a: number;
      let b: number;
      do {
        a = signed(rng, 1, 9);
        b = signed(rng, 1, 9);
      } while (a + b === 0 || a === b);
      const askX = rng.next() < 0.5;
      const value = askX ? a + b : a * b;
      return {
        q: `$(${polyTex([1, a])})(${polyTex([1, b])})$ 를 전개했을 때, ${askX ? '$x$ 의 계수를' : '상수항을'} 구하세요.`,
        choices: null,
        answer: String(value),
        answerType: 'int',
        check: `expand((${polySym([1, a])})*(${polySym([1, b])})).coeff(x, ${askX ? 1 : 0})`,
        concepts: [CONCEPT_XAB],
        steps: [
          {
            title: '공식에 맞추기',
            body: `$a=${a}$, $b=${b}$ 인 $(x+a)(x+b)$ 꼴이에요.`,
          },
          askX
            ? {
                title: '$x$ 의 계수 = 두 수의 합',
                body: `$$${a}${b < 0 ? '' : '+'}${b}=${value}$$`,
              }
            : { title: '상수항 = 두 수의 곱', body: `$$${times(a, b)}=${value}$$` },
          {
            title: '전체 식',
            body: `$$${polyTex([1, a + b, a * b])}$$`,
          },
        ],
        tip: '합은 $x$ 의 계수, 곱은 상수항이에요. 부호까지 같이 더하고 곱해요.',
      };
    },
  },
  {
    id: 'poly-general',
    unitId: UNIT,
    title: '(ax+b)(cx+d) 전개하기',
    make(rng) {
      let a: number;
      let b: number;
      let c: number;
      let d: number;
      do {
        a = rng.int(1, 5);
        c = rng.int(2, 5);
        b = signed(rng, 1, 7);
        d = signed(rng, 1, 7);
      } while (a * d + b * c === 0);
      const full = polyMul([a, b], [c, d]);
      const mid = a * d + b * c;
      return {
        q: `$(${polyTex([a, b])})(${polyTex([c, d])})$ 를 전개했을 때, $x$ 의 계수를 구하세요.`,
        choices: null,
        answer: String(mid),
        answerType: 'int',
        check: `expand((${polySym([a, b])})*(${polySym([c, d])})).coeff(x, 1)`,
        concepts: [CONCEPT_GEN],
        steps: [
          {
            title: '바깥끼리 곱하기',
            body: `$${polyTex([a, 0])}$ 와 $${d}$ ${eul(d)} 곱하면 $${polyTex([a * d, 0])}$ 예요.`,
          },
          {
            title: '안쪽끼리 곱하기',
            body: `$${b}$ ${gwa(b)} $${polyTex([c, 0])}$ 를 곱하면 $${polyTex([b * c, 0])}$ 예요.`,
          },
          {
            title: '두 $x$ 항 더하기',
            // b 가 음수면 "+-1" 이 되지 않게 덧셈 기호를 뗀다(뒤 곱이 부호로 시작)
            body: `$$${times(a, d)}${b < 0 ? '' : '+'}${times(b, c)}=${mid}$$`,
          },
          { title: '전체 식', body: `$$${polyTex(full)}$$` },
        ],
        tip: '$x$ 항은 두 군데(바깥끼리, 안쪽끼리)에서 생겨요. 하나만 세면 계수가 틀려요.',
      };
    },
  },
];
