import type { Step } from '../content/types.ts';
import { j } from './e-fraction-mul.ts';
import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd } from './util.ts';

const UNIT = 'm2-repeating-decimal';

// 순환소수는 화면 글자(점 찍은 순환마디)와 검산식을 같은 정수(앞부분·순환마디·마디 길이)에서 만든다.
// 검산식은 풀이(10의 거듭제곱 곱해 빼기)와 다른 길 — 무한등비급수 Sum — 으로 값을 다시 계산해서,
// 풀이 방법에 실수가 있어도 같은 실수를 검산이 따라 하지 않게 했다.

const CONCEPT_X =
  '순환소수를 $x$로 두고 $10$, $100$, … 을 곱해 소수점 아래가 똑같은 두 식을 만들어 빼면, 끝없는 부분이 사라져요.';
const CONCEPT_9 = '순환마디가 소수점 바로 뒤에서 시작하면 분모는 마디 숫자 개수만큼의 $9$예요.';

/** 순환마디 글자 → 점 찍은 TeX ("3"→\dot{3}, "142857"→\dot{1}4285\dot{7}) */
export function dotted(cycle: string): string {
  if (cycle.length === 1) return `\\dot{${cycle}}`;
  return `\\dot{${cycle[0]}}${cycle.slice(1, -1)}\\dot{${cycle.at(-1)}}`;
}

/** 순환마디를 몇 번 풀어 쓴 글자(0.272727…). 마디가 짧으면 더 많이 반복해 '끝없이'가 보이게 */
const unrolled = (head: string, cycle: string) =>
  `${head}${cycle.repeat(cycle.length === 1 ? 4 : 3)}\\cdots`;

/** 무한등비급수로 쓴 순환 부분의 값: 마디 c(정수), 길이 L → c/(10^L-1) */
const sumSym = (c: number, L: number) => `Sum(${c}*Rational(1,${10 ** L})**k, (k, 1, oo)).doit()`;

/** 순환마디: 길이 L, 0 이나 9 만으로 된 것·더 짧은 마디의 반복(33, 4545)은 피한다 */
function cycleOf(rng: Rng, L: number): string {
  for (;;) {
    const s = Array.from({ length: L }, () => String(rng.int(0, 9))).join('');
    if (/^0+$/.test(s) || /^9+$/.test(s)) continue;
    if (L === 2 && s[0] === s[1]) continue;
    return s;
  }
}

/** 분수 n/d(기약, d 가 10 과 서로소)의 순환마디 숫자들 — 나눗셈을 나머지가 처음으로 돌아올 때까지 */
function cycleDigits(n: number, d: number): string {
  let r = n % d;
  const start = r;
  let out = '';
  do {
    r *= 10;
    out += String(Math.floor(r / d));
    r %= d;
  } while (r !== start);
  return out;
}

export const generators: Generator[] = [
  {
    id: 'rd-pure-to-frac',
    unitId: UNIT,
    title: '순환소수를 분수로 (소수점 바로 뒤부터 순환)',
    make(rng) {
      const L = rng.next() < 0.4 ? 1 : 2;
      const cyc = cycleOf(rng, L);
      const c = Number(cyc);
      const M = 10 ** L;
      const tex = `0.${dotted(cyc)}`;
      const nines = M - 1;
      const g = gcd(c, nines);
      const steps: Step[] = [
        {
          title: '$x$로 두기',
          body: `끝없이 이어지는 수에 이름을 붙여요.\n$$x=${unrolled('0.', cyc)}$$`,
        },
        {
          title: `양변에 $${M}$ 곱하기`,
          body: `순환마디가 ${L}자리라서 $${M}$${j(M, '을를')} 곱하면 소수점 아래가 처음과 똑같아져요.\n$$${M}x=${unrolled(`${c}.`, cyc)}$$`,
        },
        {
          title: '두 식 빼기',
          body: `소수점 아래가 똑같으니 빼면 끝없는 부분이 모두 사라져요.\n$$${M}x-x=${c}$$\n$$${nines}x=${c}$$`,
        },
        {
          title: g > 1 ? '나누고 약분하기' : `양변을 $${nines}$${j(nines, '으로로')} 나누기`,
          body: `$$x=\\frac{${c}}{${nines}}${g > 1 ? `=${fracTex(c, nines)}` : ''}$$`,
        },
      ];
      return {
        q: `다음 순환소수를 기약분수로 나타내세요.\n$$${tex}$$`,
        choices: null,
        answer: fracAns(c, nines),
        answerType: 'fraction',
        check: sumSym(c, L),
        concepts: [CONCEPT_X, CONCEPT_9],
        steps,
        tip: `지름길: 소수점 바로 뒤부터 순환하면 (순환마디)÷(마디 자리 수만큼의 $9$)예요. $${tex}=\\frac{${c}}{${nines}}$. 약분을 잊지 않아요.`,
      };
    },
  },
  {
    id: 'rd-mixed-to-frac',
    unitId: UNIT,
    title: '순환소수를 분수로 (순환하지 않는 자리가 있을 때)',
    make(rng) {
      for (;;) {
        const I = rng.next() < 0.7 ? 0 : rng.int(1, 3);
        const a = rng.int(0, 9);
        const L = rng.next() < 0.6 ? 1 : 2;
        const cyc = cycleOf(rng, L);
        // 앞자리 a 가 마디 끝 숫자와 같으면 마디가 한 칸 당겨진 다른 수(0.3\dot{3}=0.\dot{3})가 된다
        if (String(a) === cyc.at(-1)) continue;
        const tex = `${I}.${a}${dotted(cyc)}`;
        const big = 10 ** (1 + L);
        const N1 = Number(`${I}${a}${cyc}`);
        const N2 = I * 10 + a;
        const D = big - 10;
        const num = N1 - N2;
        const g = gcd(num, D);
        const tail = unrolled('', cyc).replace('\\cdots', '');
        const steps: Step[] = [
          {
            title: '$x$로 두기',
            body: `$$x=${I}.${a}${tail}\\cdots$$`,
          },
          {
            title: `$10x$와 $${big}x$ 만들기`,
            body:
              `순환하지 않는 $${a}$${j(a, '을를')} 소수점 앞으로 보내려면 $10$, 한 마디를 더 넘기려면 $${big}$${j(big, '을를')} 곱해요. 두 수의 소수점 아래가 똑같아져요.\n` +
              `$$${big}x=${N1}.${tail}\\cdots$$\n$$10x=${N2}.${tail}\\cdots$$`,
          },
          {
            title: '두 식 빼기',
            body: `$$${big}x-10x=${N1}-${N2}$$\n$$${D}x=${num}$$`,
          },
          {
            title: g > 1 ? '나누고 약분하기' : `양변을 $${D}$${j(D, '으로로')} 나누기`,
            body: `$$x=\\frac{${num}}{${D}}${g > 1 ? `=${fracTex(num, D)}` : ''}$$`,
          },
        ];
        return {
          q: `다음 순환소수를 기약분수로 나타내세요.\n$$${tex}$$`,
          choices: null,
          answer: fracAns(num, D),
          answerType: 'fraction',
          check: `${I} + Rational(${a}, 10) + ${sumSym(Number(cyc), L)}/10`,
          concepts: [
            CONCEPT_X,
            '순환하지 않는 자리가 있으면, 그 자리를 소수점 앞으로 보낸 식과 한 마디 더 보낸 식을 빼요.',
          ],
          steps,
          tip: `$${big}x-x$로 빼면 소수점 아래가 맞지 않아 끝없는 부분이 남아요. 소수점 아래가 **똑같은** 두 식을 골라야 해요.`,
        };
      }
    },
  },
  {
    id: 'rd-finite-cond',
    unitId: UNIT,
    title: '유한소수가 되게 하는 수',
    make(rng) {
      for (;;) {
        const i = rng.int(0, 3);
        const k = rng.int(0, 2);
        const q = rng.pick([3, 7, 9, 11, 13, 21, 3 * 3 * 3]);
        const d = 2 ** i * 5 ** k * q;
        if (d > 160 || d === q) continue;
        const n = rng.int(1, d - 1);
        const g = gcd(n, d);
        const dd = d / g;
        let r = dd;
        while (r % 2 === 0) r /= 2;
        while (r % 5 === 0) r /= 5;
        if (r === 1) continue;
        const fac = (m: number) => {
          const parts: string[] = [];
          for (const p of [2, 3, 5, 7, 11, 13]) {
            let e = 0;
            while (m % p === 0) {
              m /= p;
              e++;
            }
            if (e) parts.push(e === 1 ? `${p}` : `${p}^${e}`);
          }
          return parts.join('\\times ');
        };
        const steps: Step[] = [];
        if (g > 1)
          steps.push({
            title: '기약분수로 만들기',
            body: `분자와 분모를 $${g}$${j(g, '으로로')} 나눠요. 약분한 뒤에 분모를 봐야 해요.\n$$\\frac{${n}}{${d}}=\\frac{${n / g}}{${dd}}$$`,
          });
        steps.push(
          {
            title: '분모를 소인수분해하기',
            body: `$$${dd}=${fac(dd)}$$`,
          },
          {
            title: '$2$, $5$가 아닌 소인수 찾기',
            body: `분모에 $2$와 $5$만 남아야 유한소수예요. 남은 $${fac(r) === String(r) ? r : `${fac(r)}=${r}`}$${j(r, '을를')} 없애야 해요.`,
          },
          {
            title: '가장 작은 수 고르기',
            body: `곱하는 수가 $${r}$의 배수면 $${r}$${j(r, '이가')} 약분되어 사라져요. 그중 가장 작은 자연수는 $${r}$${j(r, '이에요예요')}.`,
          },
        );
        return {
          q: `분수 $\\frac{${n}}{${d}}$에 자연수 $a$를 곱하면 유한소수로 나타낼 수 있어요. 가장 작은 $a$를 구하세요.`,
          choices: null,
          answer: String(r),
          answerType: 'int',
          check: `ans = next(t for t in range(1, 1000) if set(factorint((Rational(${n}, ${d})*t).q)) <= {2, 5})`,
          concepts: [
            '기약분수의 분모를 소인수분해했을 때 소인수가 $2$나 $5$뿐이면 유한소수예요.',
            '분모가 $10$, $100$, $1000$, … 이 되게 바꿀 수 있어야 유한소수예요. $10=2\\times5$라서 $2$와 $5$만 허락돼요.',
          ],
          steps,
          tip:
            g > 1
              ? '약분하지 않은 분모를 보면 이미 사라질 소인수까지 세게 돼요. 항상 기약분수로 만든 뒤 분모를 봐요.'
              : `확인: $\\frac{${n}}{${d}}\\times${r}$${j(r, '을를')} 약분하면 분모에 $2$와 $5$만 남아요.`,
        };
      }
    },
  },
  {
    id: 'rd-nth-digit',
    unitId: UNIT,
    title: '소수점 아래 n번째 자리 숫자',
    make(rng) {
      for (;;) {
        const d = rng.pick([7, 11, 13, 27, 33, 37]);
        const n = rng.int(1, d - 1);
        if (gcd(n, d) !== 1) continue;
        const cyc = cycleDigits(n, d);
        const p = cyc.length;
        if (p < 2) continue;
        const k = rng.int(20, 60);
        if (k % p === 0 && rng.next() < 0.5) continue; // 나머지 0 인 경우를 너무 자주 내지 않게
        const rem = k % p;
        const pos = rem === 0 ? p : rem;
        const digit = cyc[pos - 1] as string;
        const steps: Step[] = [
          {
            title: '순환소수로 나타내기',
            body: `$${n}\\div${d}$${j(d, '을를')} 계산하면 나머지가 처음으로 돌아오면서 같은 숫자가 되풀이돼요.\n$$\\frac{${n}}{${d}}=0.${dotted(cyc)}$$`,
          },
          {
            title: '순환마디의 자리 수',
            body: `순환마디 $${cyc}$${j(cyc, '은는')} ${p}자리예요. 숫자가 ${p}개씩 한 묶음으로 되풀이돼요.`,
          },
          {
            title: `$${k}$${j(k, '을를')} $${p}$${j(p, '으로로')} 나누기`,
            body: `$$${k}=${p}\\times${Math.floor(k / p)}+${rem}$$\n${
              rem === 0
                ? `나머지가 $0$이면 묶음이 꼭 끝나는 자리, 곧 마디의 마지막(${p}번째) 숫자예요.`
                : `묶음 ${Math.floor(k / p)}개를 지나고 ${rem}번째 자리예요.`
            }`,
          },
          {
            title: '숫자 읽기',
            body: `순환마디 $${cyc}$의 ${pos}번째 숫자는 $${digit}$${j(digit, '이에요예요')}.`,
          },
        ];
        return {
          q: `다음 분수를 소수로 나타낼 때, 소수점 아래 ${k}번째 자리의 숫자를 구하세요.\n$$\\frac{${n}}{${d}}$$`,
          choices: null,
          answer: digit,
          answerType: 'int',
          check: `floor(Rational(${n}, ${d})*10**${k}) % 10`,
          concepts: [
            '순환소수의 소수점 아래 숫자는 순환마디가 한 묶음씩 되풀이돼요.',
            '$n$번째 자리는 $n$을 마디의 자리 수로 나눈 나머지로 찾아요(나머지 $0$이면 마디의 끝).',
          ],
          steps,
          tip: '나머지가 $0$일 때 마디의 첫 숫자로 착각하기 쉬워요. 나머지 $0$은 묶음이 막 끝난 자리예요.',
        };
      }
    },
  },
];
