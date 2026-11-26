import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, jo } from './util.ts';

const UNIT = 'e-decimal';

// 소수는 '정수 n 을 10^k 로 나눈 값'으로 들고 다닌다. 부동소수(0.1+0.2=0.30000000000000004)를 쓰면
// 화면 글자와 검산 값이 어긋날 수 있어서다. 검산식도 같은 정수로 Rational(n, 10**k) 를 적는다.

const P = (k: number) => 10 ** k;

/** n/10^k 를 소수 글자로. 끝의 0 은 지운다(2.50 → 2.5) */
export function dec(n: number, k: number): string {
  if (k === 0) return String(n);
  const s = String(n).padStart(k + 1, '0');
  return `${s.slice(0, -k)}.${s.slice(-k)}`.replace(/\.?0+$/, '');
}
/** 끝의 0 을 지우지 않고 k 자리로 적는다(자리 맞추기 단계에서 2.5 를 2.50 으로 보이려고) */
const decPad = (n: number, k: number) => {
  if (k === 0) return String(n);
  const s = String(n).padStart(k + 1, '0');
  return `${s.slice(0, -k)}.${s.slice(-k)}`;
};
const R = (n: number, k: number) => `Rational(${n},${P(k)})`;
const ans = (n: number, k: number) => ({ answer: fracAns(n, P(k)), answerTex: `$${dec(n, k)}$` });

/** 소수 k 자리 수(끝자리가 0 이 아닌). 자연수 부분은 0..maxWhole */
function decimal(rng: Rng, k: number, maxWhole: number): number {
  for (;;) {
    const n = rng.int(1, (maxWhole + 1) * P(k) - 1);
    if (k === 0 || n % 10 !== 0) return n;
  }
}

function addSub(rng: Rng): GenProblem {
  for (;;) {
    const k1 = rng.int(1, 2);
    // 자리 수가 다른 두 소수를 자주 내야 '소수점 맞추기'가 의미 있다
    const k2 = rng.next() < 0.7 ? 3 - k1 : k1;
    const a = decimal(rng, k1, 9);
    const b = decimal(rng, k2, 9);
    const op = rng.pick(['+', '-'] as const);
    const K = Math.max(k1, k2);
    const A = a * P(K - k1);
    const B = b * P(K - k2);
    if (op === '-' && A <= B) continue;
    const S = op === '+' ? A + B : A - B;
    const unit = dec(1, K);
    const steps: Step[] = [
      {
        title: '소수점 맞추기',
        body:
          k1 === k2
            ? `두 수 모두 소수 ${K}자리예요. 소수점끼리 줄을 맞춰 세로로 써요.`
            : // 자리 수가 짧은 쪽만 0 을 붙여 보인다(4.26=4.26 같은 같은 식을 적지 않게)
              `소수점끼리 줄을 맞춰요. 자리 수가 다르면 끝에 0을 붙여 맞춰요. 끝의 0은 값을 바꾸지 않아요.\n$$${
                k1 < K ? `${dec(a, k1)}=${decPad(A, K)}` : `${dec(b, k2)}=${decPad(B, K)}`
              }$$`,
      },
      {
        title: `${unit}이 몇 개인지로 계산하기`,
        body: `$${decPad(A, K)}$${jo(A, '은/는')} $${unit}$이 $${A}$개, $${decPad(B, K)}$${jo(B, '은/는')} $${B}$개예요. 자연수처럼 계산해요.\n$$${A}${op}${B}=${S}$$`,
      },
      {
        title: '소수점 찍기',
        body: `$${unit}$이 $${S}$개이므로 소수점을 같은 자리에 찍어요.\n$$${dec(a, k1)}${op}${dec(b, k2)}=${dec(S, K)}$$`,
      },
    ];
    return {
      q: `다음을 계산하세요.\n$$${dec(a, k1)}${op}${dec(b, k2)}$$`,
      choices: null,
      ...ans(S, K),
      answerType: 'fraction',
      check: `${R(a, k1)} ${op} ${R(b, k2)}`,
      concepts: [
        '소수의 덧셈과 뺄셈은 소수점끼리 줄을 맞춰 같은 자리끼리 계산해요.',
        '소수 끝에 0을 붙여도 값은 같아요. $0.5=0.50$',
      ],
      steps,
      tip: '끝자리를 맞추면 안 돼요. 자연수와 달리 소수는 소수점을 맞춰야 같은 자리끼리 만나요.',
    };
  }
}

function mul(rng: Rng): GenProblem {
  for (;;) {
    const k1 = rng.int(1, 2);
    const k2 = rng.int(0, 1);
    const a = decimal(rng, k1, k1 === 2 ? 2 : 9);
    const b = k2 === 0 ? rng.int(2, 9) : decimal(rng, 1, 3);
    const pr = a * b;
    const K = k1 + k2;
    if (pr % 10 === 0 && rng.next() < 0.5) continue; // 끝 0 지우기는 가끔만
    const steps: Step[] = [
      {
        title: '소수점을 떼고 자연수처럼 곱하기',
        body: `$$${a}\\times${b}=${pr}$$`,
      },
      {
        title: '소수점 아래 자리 수 세기',
        body:
          k2 === 0
            ? `$${dec(a, k1)}$${jo(dec(a, k1), '은/는')} 소수 ${k1}자리, $${b}$${jo(b, '은/는')} 자연수예요. 답도 소수 ${K}자리예요.`
            : `$${dec(a, k1)}$${jo(dec(a, k1), '은/는')} 소수 ${k1}자리, $${dec(b, k2)}$${jo(dec(b, k2), '은/는')} 소수 ${k2}자리예요. 답은 둘을 더한 소수 ${K}자리예요.`,
      },
      {
        title: '소수점 찍기',
        body: `$${pr}$의 오른쪽 끝에서 ${K}자리를 세어 소수점을 찍어요.${
          String(pr).length <= K ? ' 자리가 모자라면 앞에 0을 채워요.' : ''
        }${pr % 10 === 0 ? ' 끝의 0은 지워요.' : ''}\n$$${dec(a, k1)}\\times${dec(b, k2)}=${dec(pr, K)}$$`,
      },
    ];
    return {
      q: `다음을 계산하세요.\n$$${dec(a, k1)}\\times${dec(b, k2)}$$`,
      choices: null,
      ...ans(pr, K),
      answerType: 'fraction',
      check: `${R(a, k1)} * ${R(b, k2)}`,
      concepts: [
        '소수의 곱셈은 자연수처럼 곱한 뒤 소수점을 찍어요.',
        '곱의 소수점 아래 자리 수 = 두 수의 소수점 아래 자리 수의 합',
      ],
      steps,
      tip: '어림으로 확인해요. 답의 크기가 대강 맞는지 보면 소수점을 잘못 찍은 걸 잡을 수 있어요.',
    };
  }
}

function divide(rng: Rng): GenProblem {
  for (;;) {
    // 나누는 수는 소수 한 자리, 몫은 자연수이거나 소수 한 자리 — 나누어떨어지는 문제만 낸다
    const Bt = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 16, 25]);
    const kq = rng.next() < 0.5 ? 0 : 1;
    const Qs = kq === 0 ? rng.int(2, 12) : decimal(rng, 1, 9);
    const At = Bt * Qs; // 나누어지는 수 = At / 10^(1+kq)
    const kA = 1 + kq;
    const a = dec(At, kA);
    const b = dec(Bt, 1);
    // 두 수에 10 을 곱한 모습
    const a10 = dec(At, kA - 1);
    const b10 = String(Bt);
    const q = dec(Qs, kq);
    const steps: Step[] = [
      {
        title: '나누는 수를 자연수로 만들기',
        body: `두 수에 똑같이 10을 곱해요. 둘 다 10배가 되면 몫은 그대로예요.\n$$${a}\\div${b}=${a10}\\div${b10}$$`,
      },
      {
        title: '나누기',
        body:
          kq === 0
            ? `$$${a10}\\div${b10}=${q}$$`
            : a10.includes('.')
              ? `몫의 소수점은 나누어지는 수 $${a10}$의 소수점 바로 위에 찍어요.\n$$${a10}\\div${b10}=${q}$$`
              : `나누어떨어지지 않으면 $${a10}$${jo(a10, '을/를')} $${a10}.0$${jo(0, '으로/로')} 보고 소수 첫째 자리까지 계속 나눠요.\n$$${a10}\\div${b10}=${q}$$`,
      },
    ];
    return {
      q: `다음을 계산하세요.\n$$${a}\\div${b}$$`,
      choices: null,
      ...ans(Qs, kq),
      answerType: kq === 0 ? 'int' : 'fraction',
      check: `${R(At, kA)} / ${R(Bt, 1)}`,
      concepts: [
        '나누는 수와 나누어지는 수에 같은 수를 곱해도 몫은 같아요.',
        '나누는 수가 소수면 10배, 100배 해서 자연수로 바꾼 다음 나눠요.',
      ],
      steps,
      tip: `확인: 몫 × 나누는 수 = 나누어지는 수. $${q}\\times${b}=${a}$`,
    };
  }
}

export const generators: Generator[] = [
  {
    id: 'dec-addsub',
    unitId: UNIT,
    title: '소수의 덧셈·뺄셈 (소수점 맞추기)',
    make: addSub,
  },
  {
    id: 'dec-mul',
    unitId: UNIT,
    title: '소수의 곱셈 (소수점 위치)',
    make: mul,
  },
  {
    id: 'dec-div',
    unitId: UNIT,
    title: '소수로 나누기',
    make: divide,
  },
];
