import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, gcd, lcm } from './util.ts';

const UNIT = 'm1-signed-ops';

// 숫자 바로 뒤에 조사를 붙이지 않는다. 숫자가 무작위라 "3를"·"7가" 같은 글이 나오기 때문 —
// 수식은 따로 줄에 세우거나, 조사 없이 끝나는 문장으로 쓴다.
// 검산식의 나눗셈은 Integer 로 감싼다. 파이썬에서 -12/4 는 실수 -3.0 이 되어 정수 비교가 틀어진다.

/** 부호를 붙여 괄호로 감싼 수: 5 → (+5), -3 → (-3) */
const signed = (n: number) => `(${n < 0 ? '-' : '+'}${Math.abs(n)})`;

const ADD_CONCEPTS = [
  '뺄셈은 빼는 수의 부호를 바꿔 더하는 것과 같아요: $a-(-b)=a+b$',
  '같은 부호끼리 더하면 절댓값을 더하고, 다른 부호끼리 더하면 절댓값이 큰 쪽에서 작은 쪽을 빼요. 부호는 절댓값이 큰 쪽을 따라요.',
];

/** (±a) ± (±b) ± (±c). 뺄셈을 덧셈으로 바꾸는 단계를 먼저 보인다 */
function addSub(rng: Rng): GenProblem {
  for (;;) {
    const ns = [rng.nonzero(-12, 12), rng.nonzero(-12, 12), rng.nonzero(-12, 12)];
    const ops = [rng.pick(['+', '-']), rng.pick(['+', '-'])];
    if (!ops.includes('-')) continue;
    // 빼는 수가 음수인 경우가 꼭 하나는 있게(이 단원에서 가장 자주 틀리는 곳)
    if (!ops.some((o, i) => o === '-' && (ns[i + 1] as number) < 0)) continue;
    const added = ns.map((n, i) => (i > 0 && ops[i - 1] === '-' ? -n : n));
    const ans = added.reduce((a, b) => a + b, 0);
    const shown = `${signed(ns[0] as number)}${ops[0]}${signed(ns[1] as number)}${ops[1]}${signed(ns[2] as number)}`;
    const asAdd = added.map(signed).join('+');
    const pos = added.filter((n) => n > 0).reduce((a, b) => a + b, 0);
    const neg = added.filter((n) => n < 0).reduce((a, b) => a + b, 0);
    // 양수·음수가 모두 있어야 "따로 모아 마저 더하기" 단계가 뜻이 있다
    if (pos === 0 || neg === 0) continue;
    return {
      q: `다음을 계산하세요.\n$$${shown}$$`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `${ns[0]} ${ops[0]} (${ns[1]}) ${ops[1]} (${ns[2]})`,
      concepts: ADD_CONCEPTS,
      steps: [
        { title: '뺄셈을 덧셈으로', body: `빼는 수의 부호를 바꿔 더해요.\n$$${asAdd}$$` },
        {
          title: '양수끼리, 음수끼리',
          body: `양수의 합 $${pos}$, 음수의 합 $${neg}$`,
        },
        { title: '마저 더하기', body: `$$${pos}+(${neg})=${ans}$$` },
      ],
      tip: '부호가 같은 것끼리 먼저 모으면 계산이 짧아져요. 덧셈은 순서를 바꿔도 결과가 같아요.',
    };
  }
}

/** (±a)÷(±b)×(±c). 부호를 먼저 정하고 절댓값을 계산한다 */
function mulDiv(rng: Rng): GenProblem {
  const b = rng.nonzero(-6, 6);
  const q0 = rng.nonzero(-6, 6);
  const a = b * q0;
  const c = rng.nonzero(-5, 5);
  if (Math.abs(b) === 1) return mulDiv(rng);
  const ans = q0 * c;
  const negs = [a, b, c].filter((n) => n < 0).length;
  const abs = Math.abs(ans);
  return {
    q: `다음을 계산하세요.\n$$${signed(a)}\\div${signed(b)}\\times${signed(c)}$$`,
    choices: null,
    answer: String(ans),
    answerType: 'int',
    check: `Integer(${a})/(${b})*(${c})`,
    concepts: [
      '곱셈·나눗셈에서 음수가 짝수 개면 +, 홀수 개면 − 예요.',
      '곱셈과 나눗셈이 섞이면 앞에서부터 차례로 계산해요.',
    ],
    steps: [
      {
        title: '부호 정하기',
        body: `음수가 ${negs}개라서 ${negs % 2 === 0 ? '짝수 개 → $+$' : '홀수 개 → $-$'}`,
      },
      {
        title: '절댓값 계산',
        body: `$$${Math.abs(a)}\\div${Math.abs(b)}\\times${Math.abs(c)}=${abs}$$`,
      },
      { title: '부호 붙이기', body: ans > 0 ? `$$+${abs}=${ans}$$` : `$$${ans}$$` },
    ],
    tip: '부호와 크기를 따로 처리하면 실수가 줄어요.',
  };
}

/** -a^n 과 (-a)^n 을 섞은 계산. 괄호가 있어야 음수 전체가 거듭제곱된다 */
function powerSign(rng: Rng): GenProblem {
  for (;;) {
    const a = rng.int(2, 4);
    const n = rng.int(2, 3);
    const b = rng.int(1, 3);
    const m = rng.int(2, 5);
    const first = rng.next() < 0.5 ? 'bare' : 'paren';
    const v1 = first === 'bare' ? -(a ** n) : (-a) ** n;
    const v2 = (-b) ** m;
    if (Math.abs(v1) > 64 || Math.abs(v2) > 64) continue;
    const ans = v1 + v2;
    const t1 = first === 'bare' ? `-${a}^{${n}}` : `(-${a})^{${n}}`;
    const s1 = first === 'bare' ? `-${a}**${n}` : `(-${a})**${n}`;
    return {
      q: `다음을 계산하세요.\n$$${t1}+(-${b})^{${m}}$$`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `${s1} + (-${b})**${m}`,
      concepts: [
        '$(-a)^n$ 은 $-a$ 를 $n$번 곱해요. $n$이 짝수면 +, 홀수면 −.',
        '$-a^n$ 은 $a^n$ 에 − 를 붙인 것이에요. 거듭제곱이 먼저예요.',
      ],
      steps: [
        {
          title: '첫째 항',
          body:
            first === 'bare'
              ? `괄호가 없어서 $${a}^{${n}}$ 을 먼저 계산하고 − 를 붙여요.\n$$${t1}=${v1}$$`
              : `$-${a}$ 를 ${n}번 곱해요. 음수가 ${n}개예요.\n$$${t1}=${v1}$$`,
        },
        {
          title: '둘째 항',
          body: `$-${b}$ 를 ${m}번 곱해요. 음수가 ${m}개예요.\n$$(-${b})^{${m}}=${v2}$$`,
        },
        { title: '더하기', body: `$$${v1}+(${v2})=${ans}$$` },
      ],
      tip: '$-2^2$ 와 $(-2)^2$ 는 달라요. 괄호가 있을 때만 음수 전체를 거듭제곱해요.',
    };
  }
}

/** 분모가 다른 두 유리수의 덧셈·뺄셈 */
function fracAddSub(rng: Rng): GenProblem {
  for (;;) {
    const d1 = rng.pick([2, 3, 4, 5, 6]);
    const d2 = rng.pick([2, 3, 4, 5, 6]);
    if (d1 === d2) continue;
    const n1 = rng.nonzero(-d1 * 2, d1 * 2);
    const n2 = rng.nonzero(1, d2 * 2);
    // 기약분수만: 약분되면 보이는 분모가 바뀌어 "분모 6" 이라는 풀이와 문제가 어긋난다
    if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue;
    const sub = rng.next() < 0.5;
    const s2 = sub ? -n2 : n2; // 둘째 수에 음수 부호를 붙인다
    const L = lcm(d1, d2);
    const a = (n1 * L) / d1;
    const b = (s2 * L) / d2;
    const op = rng.pick(['+', '-']);
    const num = op === '+' ? a + b : a - b;
    if (num === 0) continue;
    const t1 = fracTex(n1, d1);
    // 둘째 수는 늘 부호를 붙여 괄호로: (+5/3), (−5/3)
    const signedFrac = (n: number, d: number) =>
      `\\left(${n < 0 ? '-' : '+'}\\frac{${Math.abs(n)}}{${d}}\\right)`;
    const t2 = signedFrac(s2, d2);
    const bAdd = op === '+' ? b : -b;
    return {
      q: `다음을 계산하세요.\n$$${t1}${op}${t2}$$`,
      choices: null,
      answer: fracAns(num, L),
      answerTex: `$${fracTex(num, L)}$`,
      answerType: 'fraction',
      check: `Rational(${n1}, ${d1}) ${op} Rational(${s2}, ${d2})`,
      concepts: [ADD_CONCEPTS[0] as string, '분모가 다르면 최소공배수로 통분해요.'],
      steps: [
        {
          title: '덧셈으로 바꾸고 통분하기',
          body: `분모 $${d1}$, $${d2}$의 최소공배수: $${L}$\n$$${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{${L}}+${signedFrac(bAdd, L)}$$`,
        },
        {
          title: '분자끼리 더하기',
          body: `$$\\frac{${a}${bAdd < 0 ? '' : '+'}${bAdd}}{${L}}=${num < 0 ? '-' : ''}\\frac{${Math.abs(num)}}{${L}}${gcd(num, L) > 1 ? `=${fracTex(num, L)}` : ''}$$`,
        },
      ],
      tip: '분자의 부호를 정한 뒤 분자끼리만 계산해요. 분모는 그대로예요.',
    };
  }
}

export const generators: Generator[] = [
  { id: 'so-add-sub', unitId: UNIT, title: '정수의 덧셈과 뺄셈', make: addSub },
  { id: 'so-mul-div', unitId: UNIT, title: '정수의 곱셈과 나눗셈', make: mulDiv },
  { id: 'so-power-sign', unitId: UNIT, title: '거듭제곱의 부호', make: powerSign },
  { id: 'so-frac-add-sub', unitId: UNIT, title: '유리수의 덧셈과 뺄셈', make: fracAddSub },
];
