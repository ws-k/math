import type { Generator } from './types.ts';
import { gcd, paren } from './util.ts';

const UNIT = 'h1-set-logic';

const UN = '$n(A\\cup B)=n(A)+n(B)-n(A\\cap B)$ 예요.';
const CO = '$n(A^C\\cap B^C)=n((A\\cup B)^C)=n(U)-n(A\\cup B)$ 예요(드모르간 법칙).';
const SUB =
  '원소가 $n$ 개인 집합의 부분집합은 $2^n$ 개예요. 꼭 넣을 원소·뺄 원소는 빼고 남은 원소로 세요.';
const CONTRA = '명제와 그 대우($\\sim q\\to\\sim p$)는 참·거짓이 같아요.';
const AMGM = '$a>0$, $b>0$ 이면 $a+b\\ge2\\sqrt{ab}$ 이고, 등호는 $a=b$ 일 때예요.';

const divisorsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
/** 집합 원소 나열 TeX: {1,2,3} */
const setTex = (xs: number[]) => `\\{${xs.join(',')}\\}`;
/** 식 중간 항: +3 / −3 */
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
/** 계수 붙은 항: 1·x → +x, −1·x → −x, 0 → 빈 글자 */
const term = (k: number, v: string) =>
  k === 0 ? '' : `${k < 0 ? '-' : '+'}${Math.abs(k) === 1 ? '' : Math.abs(k)}${v}`;
// "이에요/예요": 숫자를 읽었을 때 끝 글자 받침으로 정한다(일·삼·육·칠·팔·십·영 → 받침)
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

const hasBatchim = (n: number) => [0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10);
const eunNeun = (n: number) => (hasBatchim(n) ? '은' : '는');
const eulReul = (n: number) => (hasBatchim(n) ? '을' : '를');

export const generators: Generator[] = [
  {
    id: 'sl-union-count',
    unitId: UNIT,
    title: '합집합·여집합의 원소의 개수',
    make(rng) {
      const both = rng.int(2, 9);
      const a = both + rng.int(2, 12);
      const b = both + rng.int(2, 12);
      const un = a + b - both;
      const kind = rng.pick(['union', 'inter', 'neither'] as const);
      if (kind === 'union') {
        return {
          q: `두 집합 $A$, $B$ 에 대하여 $n(A)=${a}$, $n(B)=${b}$, $n(A\\cap B)=${both}$ 일 때, $n(A\\cup B)$ 를 구하세요.`,
          choices: null,
          answer: String(un),
          answerType: 'int',
          check: `${a}+${b}-${both}`,
          concepts: [UN],
          steps: [
            { title: '공식', body: '겹친 원소를 두 번 셌으니 한 번 빼요.' },
            { title: '계산하기', body: `$$n(A\\cup B)=${a}+${b}-${both}=${un}$$` },
          ],
          tip: '벤 다이어그램에 겹친 부분부터 적어 넣으면 실수가 줄어요.',
        };
      }
      if (kind === 'inter') {
        return {
          q: `두 집합 $A$, $B$ 에 대하여 $n(A)=${a}$, $n(B)=${b}$, $n(A\\cup B)=${un}$ 일 때, $n(A\\cap B)$ 를 구하세요.`,
          choices: null,
          answer: String(both),
          answerType: 'int',
          check: `solve(Eq(${un}, ${a}+${b}-k), k)[0]`,
          concepts: [UN],
          steps: [
            { title: '공식에 넣기', body: `$$${un}=${a}+${b}-n(A\\cap B)$$` },
            {
              title: '풀기',
              body: `$n(A\\cap B)=${a + b}-${un}=${both}$ ${ieyo(both)}.`,
            },
          ],
          tip: '두 집합을 그냥 더한 값과 합집합의 차이가 바로 겹친 부분이에요.',
        };
      }
      const u = un + rng.int(2, 10);
      return {
        q: `전체집합 $U$ 의 두 부분집합 $A$, $B$ 에 대하여 $n(U)=${u}$, $n(A)=${a}$, $n(B)=${b}$, $n(A\\cap B)=${both}$ 일 때, $n(A^C\\cap B^C)$ 를 구하세요.`,
        choices: null,
        answer: String(u - un),
        answerType: 'int',
        check: `${u}-(${a}+${b}-${both})`,
        concepts: [UN, CO],
        steps: [
          { title: '합집합', body: `$$n(A\\cup B)=${a}+${b}-${both}=${un}$$` },
          {
            title: '드모르간 법칙',
            body: `$A^C\\cap B^C=(A\\cup B)^C$ 이므로\n$$${u}-${un}=${u - un}$$`,
          },
        ],
        tip: '"둘 다 아닌 것" 은 전체에서 "둘 중 하나라도" 를 빼면 돼요.',
      };
    },
  },
  {
    id: 'sl-divisor-sets',
    unitId: UNIT,
    title: '약수의 집합',
    make(rng) {
      let m: number;
      let n: number;
      // 두 수가 같거나 공약수가 1 뿐이면 교집합이 시시해지므로 다시 뽑는다
      do {
        m = rng.pick([6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 28, 30, 36]);
        n = rng.pick([6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 28, 30, 36]);
      } while (m === n || gcd(m, n) === 1);
      const A = divisorsOf(m);
      const B = divisorsOf(n);
      const inter = A.filter((x) => B.includes(x));
      const kind = rng.pick(['union', 'inter', 'diff'] as const);
      const sym = (op: string) =>
        `len(FiniteSet(*divisors(${m})) ${op} FiniteSet(*divisors(${n})))`;
      const head = `두 집합 $A=\\{x\\mid x\\text{는 }${m}\\text{의 약수}\\}$, $B=\\{x\\mid x\\text{는 }${n}\\text{의 약수}\\}$ 에 대하여`;
      const list = {
        title: '원소 나열',
        body: `$A=${setTex(A)}$, $B=${setTex(B)}$ 예요.`,
      };
      if (kind === 'inter') {
        return {
          q: `${head} $n(A\\cap B)$ 를 구하세요.`,
          choices: null,
          answer: String(inter.length),
          answerType: 'int',
          check: sym('&'),
          concepts: ['$A\\cap B$ 는 두 집합에 모두 있는 원소의 모임이에요.'],
          steps: [
            list,
            {
              title: '공통 원소',
              body: `$A\\cap B=${setTex(inter)}$ 이므로 ${inter.length} 개예요.`,
            },
          ],
          tip: `공약수는 최대공약수 ${gcd(m, n)} 의 약수예요. 그래서 $A\\cap B$ 는 ${gcd(m, n)} 의 약수의 집합이에요.`,
        };
      }
      if (kind === 'union') {
        return {
          q: `${head} $n(A\\cup B)$ 를 구하세요.`,
          choices: null,
          answer: String(A.length + B.length - inter.length),
          answerType: 'int',
          check: sym('|'),
          concepts: [UN],
          steps: [
            list,
            { title: '공통 원소', body: `$A\\cap B=${setTex(inter)}$ 예요.` },
            {
              title: '합집합의 원소 수',
              body: `$$${A.length}+${B.length}-${inter.length}=${A.length + B.length - inter.length}$$`,
            },
          ],
          tip: '합집합을 직접 나열해서 세어 확인할 수 있어요.',
        };
      }
      const diff = A.filter((x) => !B.includes(x));
      return {
        q: `${head} $n(A-B)$ 를 구하세요.`,
        choices: null,
        answer: String(diff.length),
        answerType: 'int',
        check: sym('-'),
        concepts: [
          '$A-B$ 는 $A$ 에는 있고 $B$ 에는 없는 원소의 모임이에요. $n(A-B)=n(A)-n(A\\cap B)$.',
        ],
        steps: [
          list,
          {
            title: '$B$ 에 있는 것 빼기',
            body: `$A-B=${diff.length ? setTex(diff) : '\\varnothing'}$ 이므로 ${diff.length} 개예요.`,
          },
        ],
        tip: `$n(A)-n(A\\cap B)=${A.length}-${inter.length}$ 로도 구할 수 있어요.`,
      };
    },
  },
  {
    id: 'sl-subset-count',
    unitId: UNIT,
    title: '조건이 있는 부분집합의 개수',
    make(rng) {
      const n = rng.int(4, 7);
      const all = Array.from({ length: n }, (_, i) => i + 1);
      const kin = rng.int(1, 2);
      const kout = rng.int(0, 2);
      // 앞에서부터 꼭 넣을 원소, 뒤에서부터 꼭 뺄 원소를 잡는다(겹치지 않게)
      const inn = all.slice(0, kin);
      const out = all.slice(n - kout);
      const free = n - kin - kout;
      const last = (xs: number[]) => xs[xs.length - 1] as number;
      const cond =
        kout === 0
          ? `${inn.join(', ')}${eulReul(last(inn))} 반드시 원소로 갖는`
          : `${inn.join(', ')}${eunNeun(last(inn))} 반드시 원소로 갖고 ${out.join(', ')}${eunNeun(last(out))} 원소로 갖지 않는`;
      return {
        q: `집합 $${setTex(all)}$ 의 부분집합 중에서 ${cond} 집합의 개수를 구하세요.`,
        choices: null,
        answer: String(2 ** free),
        answerType: 'int',
        check: `2**len(FiniteSet(${all.join(', ')}) - FiniteSet(${[...inn, ...out].join(', ')}))`,
        concepts: [SUB],
        steps: [
          {
            title: '정해진 원소 빼기',
            body: `넣을지 뺄지 이미 정해진 원소 ${kin + kout} 개를 빼면 ${free} 개가 남아요.`,
          },
          {
            title: '세기',
            body: `남은 원소마다 넣거나 빼거나 2 가지라 $2^{${free}}=${2 ** free}$ ${ieyo(2 ** free)}.`,
          },
        ],
        tip: '정해진 원소를 지운 집합의 부분집합에 정해진 원소를 붙인 것과 하나씩 짝이 맞아요.',
      };
    },
  },
  {
    id: 'sl-contra',
    unitId: UNIT,
    title: '대우를 이용해 미지수 구하기',
    make(rng) {
      const r = rng.nonzero(-4, 4);
      const k = rng.nonzero(-6, 6);
      // x=r 가 x²+kx+c=0 의 근이 되게 c 를 정한다
      const c = -r * r - k * r;
      const poly = `x^2+kx${c === 0 ? '' : signed(c)}`;
      return {
        q: `명제 "$${poly}\\ne0$ 이면 $x\\ne${r}$ 이다"가 참이 되도록 하는 상수 $k$ 의 값을 구하세요.`,
        choices: null,
        answer: String(k),
        answerType: 'int',
        check: `solve(Eq(${paren(r)}**2+k*${paren(r)}+${paren(c)}, 0), k)[0]`,
        concepts: [CONTRA],
        steps: [
          {
            title: '대우 만들기',
            body: `"$x=${r}$ 이면 $${poly}=0$ 이다" 가 참이면 돼요.`,
          },
          {
            title: `$x=${r}$ 넣기`,
            body: `$$${r * r}${term(r, 'k')}${c === 0 ? '' : signed(c)}=0$$`,
          },
          { title: '풀기', body: `$k=${k}$ ${ieyo(k)}.` },
        ],
        tip: '"≠" 가 두 번 나오는 명제는 대우로 바꾸면 "=" 하나만 다루면 돼요.',
      };
    },
  },
  {
    id: 'sl-amgm',
    unitId: UNIT,
    title: '산술평균과 기하평균의 관계',
    make(rng) {
      const a = rng.int(1, 4);
      const t = rng.int(1, 4);
      // ab 가 제곱수가 되도록 b = a·t² 로 잡아 최솟값 2at 가 정수가 되게 한다
      const b = a * t * t;
      const ax = a === 1 ? 'x' : `${a}x`;
      return {
        q: `$x>0$ 일 때, $${ax}+\\frac{${b}}{x}$ 의 최솟값을 구하세요.`,
        choices: null,
        answer: String(2 * a * t),
        answerType: 'int',
        check: `minimum(${a}*x+${b}/x, x, Interval.open(0, oo))`,
        concepts: [AMGM],
        steps: [
          {
            title: '곱이 일정',
            body: `$${ax}\\cdot\\frac{${b}}{x}=${a * b}$ 로 늘 같아요.`,
          },
          {
            title: '절대부등식',
            body: `$$${ax}+\\frac{${b}}{x}\\ge2\\sqrt{${a * b}}=${2 * a * t}$$`,
          },
          {
            title: '등호 확인',
            body: `$${ax}=\\frac{${b}}{x}$, 곧 $x=${t}$ 일 때 등호가 성립해요.`,
          },
        ],
        tip: '등호가 성립하는 $x$ 가 실제로 있어야 그 값이 최솟값이에요.',
      };
    },
  },
];
