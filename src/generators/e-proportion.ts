import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { gcd, lcm } from './util.ts';

const UNIT = 'e-proportion';

// 숫자 바로 뒤에는 조사를 붙이지 않는다(숫자가 무작위라 "3를"·"2은" 같은 글이 나온다).
// 단위를 붙이거나, 수식을 줄에 따로 세우거나, "□ 에 알맞은 수"처럼 묻는다.

const BOX = '\\square';
const comma = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 비례식 네 항 중 하나를 □ 로 바꾼 TeX 와, 같은 자리를 x 로 바꾼 sympy 항 */
function propTex(t: (number | null)[]): string {
  const s = t.map((v) => (v === null ? BOX : String(v)));
  return `${s[0]}:${s[1]}=${s[2]}:${s[3]}`;
}
/** 빈칸(null)은 검산식에서 미지수 x. 배열 칸 접근이라 undefined 도 받지만 늘 네 칸이 다 있다 */
const sym = (v: number | null | undefined) => (v == null ? 'x' : String(v));

/** 비의 성질: 전항·후항에 같은 수를 곱하거나 나눈 비의 빈칸 */
function equivRatio(rng: Rng): GenProblem {
  for (;;) {
    const a = rng.int(1, 9);
    const b = rng.int(2, 9);
    if (a === b || gcd(a, b) !== 1) continue;
    const k = rng.int(2, 9);
    // 곱하는 쪽(작은 비 → 큰 비)과 나누는 쪽(큰 비 → 작은 비)을 섞는다
    const down = rng.next() < 0.4;
    const [p, q, r, s] = down ? [a * k, b * k, a, b] : [a, b, a * k, b * k];
    const blank = rng.int(2, 3);
    const t: (number | null)[] = [p, q, r, s];
    const ans = t[blank] as number;
    t[blank] = null;
    const known = blank === 2 ? 3 : 2;
    const from = blank === 2 ? q : p;
    const to = t[known] as number;
    const op = down ? '\\div' : '\\times';
    const steps: Step[] = [
      {
        title: down ? '몇으로 나눴는지 찾기' : '몇 배 했는지 찾기',
        body: `${blank === 2 ? '후항' : '전항'}끼리 비교해요.\n$$${from}${op}${k}=${to}$$`,
      },
      {
        title: `${blank === 2 ? '전항' : '후항'}에도 똑같이`,
        body: `비의 성질: 두 항${down ? '을 같은 수로 나눠도' : '에 같은 수를 곱해도'} 비율은 같아요.\n$$${blank === 2 ? p : q}${op}${k}=${ans}$$`,
      },
    ];
    return {
      q: `$${BOX}$ 에 알맞은 수를 구하세요.\n$$${propTex(t)}$$`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `solve(Eq(${sym(t[0])}*${sym(t[3])}, ${sym(t[1])}*${sym(t[2])}), x)[0]`,
      concepts: [
        '비의 전항과 후항에 0이 아닌 같은 수를 곱하거나 나누어도 비율은 같아요.',
        '$a:b=(a\\times k):(b\\times k)$',
      ],
      steps,
      tip: '두 항에 같은 수를 더하면 비율이 달라져요. 꼭 곱하거나 나눠요.',
    };
  }
}

/** 가장 간단한 자연수의 비. 소수·분수·큰 자연수의 비를 정리한다. 답은 뒤 항(앞 항은 문제에 준다) */
function simplest(rng: Rng): GenProblem {
  for (;;) {
    const kind = rng.pick(['int', 'dec', 'frac'] as const);
    if (kind === 'int') {
      const m = rng.int(1, 9);
      const n = rng.int(1, 9);
      if (m === n || gcd(m, n) !== 1) continue;
      const g = rng.int(2, 12);
      const A = m * g;
      const B = n * g;
      return {
        q: `다음 비를 가장 간단한 자연수의 비로 나타내면 $${m}:${BOX}$ 예요. $${BOX}$ 에 알맞은 수를 구하세요.\n$$${A}:${B}$$`,
        choices: null,
        answer: String(n),
        answerType: 'int',
        check: `Rational(${B},${A})*${m}`,
        concepts: ['두 항을 두 수의 최대공약수로 나누면 가장 간단한 자연수의 비가 돼요.'],
        steps: [
          { title: '최대공약수 찾기', body: `두 항의 최대공약수를 찾아요(최대공약수: $${g}$).` },
          { title: '두 항을 나누기', body: `$$${A}\\div${g}=${m},\\quad ${B}\\div${g}=${n}$$` },
        ],
        tip: '나눈 뒤 두 수가 1 말고 공약수가 없으면 끝이에요.',
      };
    }
    if (kind === 'dec') {
      const p = rng.int(1, 9);
      const q = rng.int(1, 9);
      if (p === q) continue;
      const g = gcd(p, q);
      const m = p / g;
      const n = q / g;
      const steps: Step[] = [
        {
          title: '10 곱하기',
          body: `두 항에 10을 곱해 자연수로 만들어요.\n$$0.${p}:0.${q}=${p}:${q}$$`,
        },
      ];
      if (g > 1)
        steps.push({
          title: '최대공약수로 나누기',
          body: `두 항을 최대공약수로 나눠요(최대공약수: $${g}$).\n$$${p}:${q}=${m}:${n}$$`,
        });
      return {
        q: `다음 비를 가장 간단한 자연수의 비로 나타내면 $${m}:${BOX}$ 예요. $${BOX}$ 에 알맞은 수를 구하세요.\n$$0.${p}:0.${q}$$`,
        choices: null,
        answer: String(n),
        answerType: 'int',
        check: `Rational(${q},10)/Rational(${p},10)*${m}`,
        concepts: ['소수의 비는 두 항에 10, 100 같은 수를 곱해 자연수의 비로 바꿔요.'],
        steps,
        tip: '두 항에 같은 수를 곱했으니 비율은 그대로예요.',
      };
    }
    const b = rng.int(2, 9);
    const d = rng.int(2, 9);
    if (b === d) continue;
    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);
    if (gcd(a, b) !== 1 || gcd(c, d) !== 1) continue;
    const L = lcm(b, d);
    const P = (a * L) / b;
    const Q = (c * L) / d;
    const g = gcd(P, Q);
    const m = P / g;
    const n = Q / g;
    const steps: Step[] = [
      {
        title: '분모의 최소공배수 곱하기',
        body: `두 분모의 최소공배수를 두 항에 곱해요(최소공배수: $${L}$).\n$$\\frac{${a}}{${b}}\\times${L}=${P},\\quad \\frac{${c}}{${d}}\\times${L}=${Q}$$`,
      },
    ];
    if (g > 1)
      steps.push({
        title: '최대공약수로 나누기',
        body: `두 항을 최대공약수로 나눠요(최대공약수: $${g}$).\n$$${P}:${Q}=${m}:${n}$$`,
      });
    return {
      q: `다음 비를 가장 간단한 자연수의 비로 나타내면 $${m}:${BOX}$ 예요. $${BOX}$ 에 알맞은 수를 구하세요.\n$$\\frac{${a}}{${b}}:\\frac{${c}}{${d}}$$`,
      choices: null,
      answer: String(n),
      answerType: 'int',
      check: `Rational(${c},${d})/Rational(${a},${b})*${m}`,
      concepts: ['분수의 비는 두 분모의 공배수를 두 항에 곱해 자연수의 비로 바꿔요.'],
      steps,
      tip: '분자끼리만 비로 쓰면 안 돼요. 분모가 다르면 조각 크기가 달라요.',
    };
  }
}

/** 외항의 곱 = 내항의 곱으로 비례식 풀기. 배수가 바로 보이지 않는 수를 골라 곱셈 성질을 쓰게 한다 */
function crossSolve(rng: Rng): GenProblem {
  for (;;) {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    if (a === b) continue;
    const k = rng.int(2, 6);
    const r = a * k;
    const s = b * k;
    // 두 비가 정수 배 관계면 비의 성질로도 풀리지만, 그래도 외항·내항의 곱 연습이 된다
    const t: (number | null)[] = [a, b, r, s];
    const blank = rng.int(0, 3);
    const ans = t[blank] as number;
    t[blank] = null;
    const outer = blank === 0 || blank === 3;
    const [o1, o2, i1, i2] = [t[0], t[3], t[1], t[2]];
    const known = outer ? (i1 as number) * (i2 as number) : (o1 as number) * (o2 as number);
    const other = outer ? (blank === 0 ? o2 : o1) : blank === 1 ? i2 : i1;
    const ot = (x: number | null | undefined) => (x == null ? BOX : String(x));
    const steps: Step[] = [
      {
        title: '외항의 곱 = 내항의 곱',
        body: `$$${ot(o1)}\\times${ot(o2)}=${ot(i1)}\\times${ot(i2)}$$`,
      },
      {
        title: '아는 쪽 계산하기',
        body: outer
          ? `$$${ot(o1)}\\times${ot(o2)}=${known}$$`
          : `$$${known}=${ot(i1)}\\times${ot(i2)}$$`,
      },
      {
        title: '나누어 구하기',
        body: `$$${BOX}=${known}\\div${other}=${ans}$$`,
      },
    ];
    return {
      q: `비례식에서 $${BOX}$ 에 알맞은 수를 구하세요.\n$$${propTex(t)}$$`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `solve(Eq(${sym(t[0])}*${sym(t[3])}, ${sym(t[1])}*${sym(t[2])}), x)[0]`,
      concepts: ['비례식에서 외항의 곱과 내항의 곱은 같아요.', '$a:b=c:d \\Leftrightarrow ad=bc$'],
      steps,
      tip: '구한 수를 넣어 외항의 곱과 내항의 곱이 같은지 확인해요.',
    };
  }
}

/** 비례배분: 전체를 m:n 으로 나눈 한쪽 몫. 분모가 m+n(전체 묶음 수)이라는 점이 핵심 */
function share(rng: Rng): GenProblem {
  const ctx = [
    { what: '구슬', u: '개', obj: '를', pair: '형과 동생이', who: ['형', '동생'] },
    { what: '색종이', u: '장', obj: '을', pair: '지우와 민서가', who: ['지우', '민서'] },
    { what: '용돈', u: '원', obj: '을', pair: '언니와 동생이', who: ['언니', '동생'] },
    { what: '사탕', u: '개', obj: '를', pair: '하준이와 서윤이가', who: ['하준이', '서윤이'] },
  ];
  for (;;) {
    const m = rng.int(1, 7);
    const n = rng.int(1, 7);
    if (m === n || gcd(m, n) !== 1) continue;
    const c = rng.pick(ctx);
    const unit = c.u === '원' ? rng.pick([500, 1000]) : rng.int(2, 8);
    const N = (m + n) * unit;
    const front = rng.next() < 0.5;
    const [who, mine] = front ? [c.who[0], m] : [c.who[1], n];
    const ans = (N * mine) / (m + n);
    const total = c.u === '원' ? `${comma(N)}원` : `${N}${c.u}`;
    return {
      q: `${c.what} ${total}${c.obj} ${c.pair} $${m}:${n}$의 비로 나누어 가져요. ${who}의 몫은 몇 ${c.u}인가요?`,
      choices: null,
      answer: String(ans),
      answerTex: c.u === '원' ? `${comma(ans)}원` : `${ans}${c.u}`,
      answerType: 'int',
      check: `${N}*Rational(${mine},${m}+${n})`,
      concepts: [
        '전체를 $m:n$ 으로 나누면 한쪽 몫은 전체 × $\\frac{m}{m+n}$ 이에요.',
        '분모는 두 항의 합(전체 묶음 수)이에요.',
      ],
      steps: [
        {
          title: '전체 묶음 수',
          body: `$$${m}+${n}=${m + n}$$`,
        },
        {
          title: `${who}의 몫 비율`,
          body: `${who}의 몫은 전체의 $\\frac{${mine}}{${m + n}}$ 만큼이에요.`,
        },
        {
          title: '곱하기',
          body: `$$${N}\\times\\frac{${mine}}{${m + n}}=${ans}$$`,
        },
      ],
      tip: '두 사람 몫을 더해 전체가 되는지 확인해요.',
    };
  }
}

/** 같은 빠르기·같은 값의 문장제를 비례식으로. 배수가 정수가 아닐 때도 외항·내항의 곱으로 풀린다 */
function wordProp(rng: Rng): GenProblem {
  const ctx = [
    {
      q: (a: number, p: number, b: number) =>
        `같은 빠르기로 ${a}분 동안 ${p} m를 걸었어요. 같은 빠르기로 ${b}분 동안 걸으면 몇 m를 걸을까요?`,
      u: 'm',
      pair: '시간과 거리',
    },
    {
      q: (a: number, p: number, b: number) =>
        `공책 ${a}권의 값이 ${comma(p)}원이에요. 같은 공책 ${b}권의 값은 몇 원일까요?`,
      u: '원',
      pair: '공책 수와 값',
    },
    {
      q: (a: number, p: number, b: number) =>
        `기계 한 대가 ${a}분 동안 쿠키 ${p}개를 구워요. 같은 빠르기로 ${b}분 동안은 몇 개를 구울까요?`,
      u: '개',
      pair: '시간과 쿠키 수',
    },
  ];
  for (;;) {
    const c = rng.pick(ctx);
    const a = rng.int(2, 9);
    const b = rng.int(2, 15);
    if (a === b || b % a === 0) continue;
    const unit =
      c.u === '원'
        ? rng.pick([300, 500, 700, 900])
        : c.u === 'm'
          ? rng.pick([40, 50, 60, 70, 80])
          : rng.int(3, 12);
    const p = a * unit;
    const ans = (p * b) / a;
    return {
      q: c.q(a, p, b),
      choices: null,
      answer: String(ans),
      answerTex: c.u === '원' ? `${comma(ans)}원` : `${ans}${c.u === 'm' ? ' m' : c.u}`,
      answerType: 'int',
      check: `solve(Eq(${a}*x, ${p}*${b}), x)[0]`,
      concepts: [`${c.pair}의 비가 늘 같으므로 비례식을 세울 수 있어요.`],
      steps: [
        {
          title: '비례식 세우기',
          body: `구할 값을 $${BOX}$ 로 두어요.\n$$${a}:${p}=${b}:${BOX}$$`,
        },
        {
          title: '외항의 곱 = 내항의 곱',
          body: `$$${a}\\times${BOX}=${p}\\times${b}=${p * b}$$`,
        },
        {
          title: '나누기',
          body: `$$${BOX}=${p * b}\\div${a}=${ans}$$`,
        },
      ],
      tip: `한 ${c.u === '원' ? '권' : '분'}에 얼마인지 먼저 구해서 곱해도 같아요.`,
    };
  }
}

export const generators: Generator[] = [
  { id: 'prop-equiv-ratio', unitId: UNIT, title: '비의 성질로 빈칸 채우기', make: equivRatio },
  { id: 'prop-simplest', unitId: UNIT, title: '가장 간단한 자연수의 비', make: simplest },
  { id: 'prop-cross', unitId: UNIT, title: '비례식 풀기', make: crossSolve },
  { id: 'prop-share', unitId: UNIT, title: '비례배분', make: share },
  { id: 'prop-word', unitId: UNIT, title: '비례식 문장제', make: wordProp },
];
