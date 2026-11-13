import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { polySym, polyTex } from './util.ts';

const UNIT = 'm3-sqrt';

// 숫자 뒤 조사는 읽는 소리의 받침으로 갈린다(m1-linear-eq 와 같은 규칙). 숫자가 무작위라 마지막 자리로 고른다.
// (일·삼·육·칠·팔·영/십 → 받침, 이·사·오·구 → 없음). ㄹ 받침(1·7·8)은 '로'를 쓴다.
const eul = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '을' : '를');
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

const CONCEPT_SQ = '$a>0$ 이면 $(\\sqrt{a})^2=a$, $(-\\sqrt{a})^2=a$ 예요.';
const CONCEPT_ABS = '$\\sqrt{a^2}=|a|$. 근호 안이 제곱이면 꺼낸 값은 늘 0 이상이에요.';
const CONCEPT_ORDER = '$0<a<b$ 이면 $\\sqrt{a}<\\sqrt{b}$ 예요. 제곱해서 비교하면 쉬워요.';
const CONCEPT_PERFECT = '$\\sqrt{N}$ 이 자연수가 되려면 $N$ 이 어떤 자연수의 제곱이어야 해요.';

/** 제곱수가 아닌 수만 — (√a)² 가 "그냥 a" 로 보이도록 근호가 남는 수를 고른다 */
const NON_SQUARES = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

interface Part {
  tex: string;
  sym: string;
  value: number;
  /** 이 조각의 값을 구하는 한 줄 설명 */
  why: string;
}

function part(rng: Rng): Part {
  const kind = rng.int(0, 3);
  if (kind <= 1) {
    const a = rng.pick(NON_SQUARES);
    const neg = kind === 1;
    return {
      tex: neg ? `(-\\sqrt{${a}})^2` : `(\\sqrt{${a}})^2`,
      sym: neg ? `(-sqrt(${a}))**2` : `sqrt(${a})**2`,
      value: a,
      why: neg ? `$(-\\sqrt{${a}})^2=${a}$ (음수를 제곱해도 양수)` : `$(\\sqrt{${a}})^2=${a}$`,
    };
  }
  const b = rng.int(2, 9);
  const neg = kind === 3;
  return {
    tex: neg ? `\\sqrt{(-${b})^2}` : `\\sqrt{${b}^2}`,
    sym: neg ? `sqrt((-${b})**2)` : `sqrt(${b}**2)`,
    value: b,
    why: neg ? `$\\sqrt{(-${b})^2}=\\sqrt{${b * b}}=${b}$` : `$\\sqrt{${b}^2}=${b}$`,
  };
}

export const generators: Generator[] = [
  {
    id: 'sqrt-square-value',
    unitId: UNIT,
    title: '제곱근의 성질로 계산하기',
    make(rng) {
      const p = part(rng);
      let q = part(rng);
      // 같은 모양 두 개면 "더하기 연습"이 아니라 같은 계산 반복이 되므로 다시 뽑는다
      while (q.tex === p.tex) q = part(rng);
      const op = rng.pick(['+', '-', '\\times'] as const);
      const value =
        op === '+' ? p.value + q.value : op === '-' ? p.value - q.value : p.value * q.value;
      const symOp = op === '\\times' ? '*' : op;
      const hasNegInside = p.tex.includes('(-') || q.tex.includes('(-');
      return {
        q: `$${p.tex}${op}${q.tex}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(value),
        answerType: 'int',
        check: `(${p.sym}) ${symOp} (${q.sym})`,
        concepts: [CONCEPT_SQ, CONCEPT_ABS],
        steps: [
          { title: '앞 조각 계산', body: p.why },
          { title: '뒤 조각 계산', body: q.why },
          {
            title: '두 값 계산',
            body: `$$${p.value}${op}${q.value}=${value}$$`,
          },
        ],
        tip: hasNegInside
          ? '근호 안의 음수를 제곱하면 양수가 돼요. 그래서 $\\sqrt{(-3)^2}$ 은 $-3$ 이 아니라 $3$ 이에요.'
          : '제곱근을 제곱하면 근호가 사라져요. 근호 안이 제곱이면 근호를 벗겨도 돼요.',
      };
    },
  },
  {
    id: 'sqrt-abs-simplify',
    unitId: UNIT,
    title: '근호 안이 제곱인 식 간단히 하기',
    make(rng) {
      let p: number;
      let q: number;
      do {
        p = rng.int(-5, 6);
        q = rng.int(-4, 9);
        // 0 이면 근호 안이 그냥 x 가 되어 "x>0 이므로 x>0" 처럼 단계가 겉돈다
      } while (q - p < 2 || p === 0 || q === 0);
      // (x-p) 대신 (p-x) 로 적어도 제곱하면 같다 — 근호 안 부호에 흔들리지 않는 연습
      const flip = rng.next() < 0.4;
      const inA = flip ? polyTex([-1, p]) : polyTex([1, -p]);
      const inASym = flip ? polySym([-1, p]) : polySym([1, -p]);
      const inB = polyTex([1, -q]);
      const xp = polyTex([1, -p]);
      return {
        q: `$${p}<x<${q}$ 일 때, $\\sqrt{(${inA})^2}+\\sqrt{(${inB})^2}$ 을 간단히 한 값을 구하세요.`,
        choices: null,
        answer: String(q - p),
        answerType: 'int',
        // 범위 안 한 점(가운데)에서 값을 계산한다 — 간단히 한 결과가 상수라면 어느 점에서나 같다
        check: `(sqrt((${inASym})**2) + sqrt((${polySym([1, -q])})**2)).subs(x, Rational(${p + q}, 2))`,
        concepts: [CONCEPT_ABS],
        steps: [
          {
            title: '앞 근호의 부호 보기',
            body: `$x>${p}$ 이므로 $${xp}>0$ 이에요. 그래서 근호를 그대로 벗겨요.\n$$\\sqrt{(${inA})^2}=${xp}$$`,
          },
          {
            title: '뒤 근호의 부호 보기',
            body: `$x<${q}$ 이므로 $${inB}<0$ 이에요. 음수를 꺼낼 때는 부호를 바꿔요.\n$$\\sqrt{(${inB})^2}=-(${inB})=${polyTex([-1, q])}$$`,
          },
          {
            title: '더하기',
            body: `$$(${xp})+(${polyTex([-1, q])})=${q - p}$$`,
          },
        ],
        tip: '$\\sqrt{a^2}$ 을 무조건 $a$ 로 꺼내면 틀려요. 꺼낸 값은 늘 0 이상이니 음수면 $-a$ 로 꺼내요.',
      };
    },
  },
  {
    id: 'sqrt-between',
    unitId: UNIT,
    title: '제곱근이 놓인 자리 찾기',
    make(rng) {
      let n: number;
      do n = rng.int(3, 120);
      while (Number.isInteger(Math.sqrt(n)));
      const a = Math.floor(Math.sqrt(n));
      const count = rng.next() < 0.5;
      return {
        q: count
          ? `$\\sqrt{${n}}$ 보다 작은 자연수는 모두 몇 개인지 구하세요.`
          : `부등식 $a<\\sqrt{${n}}<a+1$ 을 만족시키는 자연수 $a$ 의 값을 구하세요.`,
        choices: null,
        answer: String(a),
        answerType: 'int',
        check: count
          ? `ans = len([k for k in range(1, ${n}) if k < sqrt(${n})])`
          : `floor(sqrt(${n}))`,
        concepts: [CONCEPT_ORDER],
        steps: [
          {
            title: '가까운 제곱수 찾기',
            body: `$${n}$ ${eul(n)} 가까운 두 제곱수 사이에 끼워요.\n$$${a}^2=${a * a}<${n}<${(a + 1) * (a + 1)}=${a + 1}^2$$`,
          },
          {
            title: '제곱근으로 바꾸기',
            body: `세 수의 제곱근을 잡아도 순서는 그대로예요.\n$$${a}<\\sqrt{${n}}<${a + 1}$$`,
          },
          count
            ? {
                title: '개수 세기',
                body: `$\\sqrt{${n}}$ 보다 작은 자연수는 $1$ 부터 $${a}$ 까지, 모두 $${a}$ 개예요.`,
              }
            : { title: '답 읽기', body: `$a=${a}$ ${ieyo(a)}.` },
        ],
        tip: `$\\sqrt{${n}}$ 의 값을 몰라도 돼요. 근호 안의 수를 제곱수 사이에 끼우면 자리가 바로 보여요.`,
      };
    },
  },
  {
    id: 'sqrt-natural-min',
    unitId: UNIT,
    title: '근호 안을 제곱수로 만들기',
    make(rng) {
      // N = (제곱수) × (제곱 아닌 부분). 곱할 가장 작은 수는 제곱 아닌 부분 그 자체다
      let sq: number;
      let rest: number;
      do {
        sq = rng.pick([1, 4, 9, 16, 25, 36]);
        rest = rng.pick([2, 3, 5, 6, 7, 10, 14, 15, 21]);
      } while (sq * rest > 200 || sq === 1);
      const n = sq * rest;
      const r = Math.sqrt(sq);
      return {
        q: `$\\sqrt{${n}x}$ 가 자연수가 되도록 하는 가장 작은 자연수 $x$ 의 값을 구하세요.`,
        choices: null,
        answer: String(rest),
        answerType: 'int',
        check: `ans = [t for t in range(1, 1000) if sqrt(${n}*t).is_integer][0]`,
        concepts: [CONCEPT_PERFECT],
        steps: [
          {
            title: '제곱수로 나누기',
            body: `$${n}=${r}^2\\times${rest}$ ${ieyo(rest)}. $${r}^2$ 은 이미 제곱수예요.`,
          },
          {
            title: '남은 부분 짝 맞추기',
            body: `제곱이 아닌 $${rest}$ ${eul(rest)} 한 번 더 곱하면 $${rest}^2$ 이 돼요. 그래서 $x=${rest}$ ${ieyo(rest)}.`,
          },
          {
            title: '확인',
            body: `$$\\sqrt{${n}\\times${rest}}=\\sqrt{(${r}\\times${rest})^2}=${r * rest}$$`,
          },
        ],
        tip: '소인수분해했을 때 지수가 모두 짝수면 제곱수예요. 지수가 홀수인 소인수만 하나씩 더 곱해요.',
      };
    },
  },
];
