import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd, paren, reduce } from './util.ts';

const UNIT = 'calc-series';

// 급수는 "부분합 S_n 을 구해 n→∞ 의 극한을 본다"가 뿌리라, 풀이는 공식만 던지지 않고
// 첫째항·공비 확인(등비급수), 늘어놓고 지우기(부분분수)처럼 그 뿌리가 보이게 쓴다.
// 검산식은 sympy summation 에 화면의 일반항을 그대로 넣어 무한히 더한 값과 대조한다 —
// 공식(a/(1-r), 남는 항)을 거쳐 쓰면 공식을 잘못 옮겨도 함께 틀려서 잡히지 않는다.
// 생성기 id 는 다른 단원과 겹치지 않도록 모두 단원 id 'calc-series-' 로 시작한다.

// '이에요/예요'는 읽었을 때 끝소리 받침으로 갈린다. 분수 b분의 a 는 분자 a 로 끝나고,
// 숫자는 끝자리(일·삼·육·칠·팔·영/십 → 받침, 이·사·오·구 → 받침 없음)로 정한다.
const ieyoN = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');
const ieyoF = (n: number, d: number) => ieyoN(reduce(n, d).n);

/** 괄호 속 분수 거듭제곱의 밑: 3/1 → "3", -1/3 → "\left(-\frac13\right)" 처럼 */
const baseTex = (p: number, q: number) => {
  const t = fracTex(p, q);
  return q === 1 && p > 0 ? t : `\\left(${t}\\right)`;
};

/** 계수: 1 은 생략, -1 은 부호만 */
const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : String(a));

const SUM = '$\\sum_{n=1}^{\\infty}a_n=\\lim_{n\\to\\infty}S_n$ (부분합의 극한)';
const GEO = '등비급수: $-1<r<1$ 이면 $\\sum_{n=1}^{\\infty}ar^{n-1}=\\frac{a}{1-r}$';
const GEO_COND = '등비급수 $\\sum ar^{n-1}$ ($a\\ne0$) 은 $-1<r<1$ 일 때만 수렴해요.';
const PARTIAL = '$\\frac{1}{AB}=\\frac{1}{B-A}\\left(\\frac1A-\\frac1B\\right)$';

/** 1 + 1/2 + … + 1/k 같은 합을 기약분수로 */
function harmonic(from: number, k: number): { n: number; d: number } {
  let n = 0;
  let d = 1;
  for (let j = from; j < from + k; j++) {
    n = n * j + d;
    d *= j;
    const g = gcd(n, d);
    n /= g;
    d /= g;
  }
  return { n, d };
}

export const generators: Generator[] = [
  {
    id: 'calc-series-geo-sum',
    unitId: UNIT,
    title: '등비급수의 합',
    make(rng) {
      for (;;) {
        const q = rng.int(2, 5);
        const p = rng.nonzero(1 - q, q - 1);
        if (gcd(p, q) !== 1) continue;
        const a = rng.nonzero(-6, 6);
        // 지수가 n-1 이면 첫째항이 a, n 이면 첫째항이 ar — 둘째 꼴에서 첫째항을 a 로 두는 실수가 가장 흔하다
        const shifted = rng.int(0, 1) === 1;
        const first = shifted ? reduce(a * p, q) : { n: a, d: 1 };
        // 합 = 첫째항 / (1 - p/q) = 첫째항 × q/(q-p)
        const ans = reduce(first.n * q, first.d * (q - p));
        if (Math.abs(ans.n / ans.d) > 40) continue;
        const R = fracTex(p, q);
        const term = `${coef(a)}${baseTex(p, q)}^{${shifted ? 'n' : 'n-1'}}`;
        const F = fracTex(first.n, first.d);
        const oneMinus = fracTex(q - p, q);
        return {
          q: `등비급수 $\\sum_{n=1}^{\\infty}${term}$ 의 합을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `summation(${a}*Rational(${p},${q})**${shifted ? 'n' : '(n-1)'}, (n, 1, oo))`,
          concepts: [GEO, SUM],
          steps: [
            {
              title: '첫째항 구하기',
              body: `$n=1$ 을 넣은 항이 첫째항이에요. 첫째항은 $${F}$ ${ieyoF(first.n, first.d)}.`,
            },
            {
              title: '공비 구하기',
              body: `$n$ 이 1 커질 때마다 곱해지는 수라서 공비는 $r=${R}$ ${ieyoF(p, q)}.`,
            },
            {
              title: '수렴하는지 확인',
              body: `$-1<${R}<1$ 이므로 이 급수는 수렴해요.`,
            },
            {
              title: '공식에 넣기',
              body: `$$\\frac{${F}}{1-${paren(R)}}=\\frac{${F}}{${oneMinus}}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: shifted
            ? `지수가 $n$ 이면 첫째항은 앞의 계수가 아니라 $n=1$ 을 넣은 값 $${F}$ ${ieyoF(first.n, first.d)}. 계수를 그대로 첫째항으로 쓰면 $\\frac{${a}}{${oneMinus}}=${fracTex(a * q, q - p)}$ 처럼 틀린 값이 나와요.`
            : `공비가 ${p < 0 ? '음수여도' : '분수여도'} $-1<r<1$ 이면 수렴해요. 부분합 $S_n=\\frac{${a}\\{1-(${R})^n\\}}{1-${paren(R)}}$ 에서 $(${R})^n\\to0$ 이 되기 때문이에요.`,
        };
      }
    },
  },
  {
    id: 'calc-series-telescope',
    unitId: UNIT,
    title: '부분분수로 지워지는 급수',
    make(rng) {
      const k = rng.int(1, 3);
      const s = rng.int(0, 1);
      const m = rng.int(1, 4);
      const c = m * k;
      // 분모 A=n+s, B=n+s+k. A 와 B 의 차가 k 라 c/(AB) = (c/k)(1/A - 1/B) = m(1/A - 1/B)
      const A = s === 0 ? 'n' : `n+${s}`;
      const B = `n+${s + k}`;
      const den = s === 0 ? `n(${B})` : `(${A})(${B})`;
      const kept = harmonic(1 + s, k);
      const ans = reduce(m * kept.n, kept.d);
      const keptList = Array.from({ length: k }, (_, j) => fracTex(1, 1 + s + j)).join('+');
      const tailList = Array.from({ length: k }, (_, j) => `\\frac{1}{n+${s + 1 + j}}`).join('+');
      // m=1 이면 바깥 괄호 없이 쓴다(1·(…) 이나 빈 괄호가 보이지 않게)
      const times = (body: string, br: [string, string]) =>
        m === 1 ? body : `${m}\\left${br[0]}${body}\\right${br[1]}`;
      const pairs = [1, 2, 3]
        .map((j) => `\\left(${fracTex(1, j + s)}-${fracTex(1, j + s + k)}\\right)`)
        .join('+');
      const tail = k === 1 ? tailList : `\\left(${tailList}\\right)`;
      return {
        q: `급수 $\\sum_{n=1}^{\\infty}\\frac{${c}}{${den}}$ 의 합을 구하세요.`,
        choices: null,
        answer: fracAns(ans.n, ans.d),
        answerType: 'fraction',
        check: `summation(${c}/((n + ${s})*(n + ${s + k})), (n, 1, oo))`,
        concepts: [PARTIAL, SUM],
        steps: [
          {
            title: '부분분수로 나누기',
            body: `두 인수의 차가 $${k}$ 이므로\n$$\\frac{${c}}{${den}}=${times(`\\frac{1}{${A}}-\\frac{1}{${B}}`, ['(', ')'])}$$`,
          },
          {
            title: '부분합 늘어놓기',
            body: `$$S_n=${times(`${pairs}+\\cdots`, ['\\{', '\\}'])}$$`,
          },
          {
            title: '지워지고 남는 항',
            body: `빼는 항이 ${k === 1 ? '바로 다음' : `${k}칸 뒤`} 괄호의 더하는 항과 지워져요. 앞의 ${k}개와 뒤의 ${k}개만 남아요.\n$$S_n=${times(`${keptList}-${tail}`, ['\\{', '\\}'])}$$`,
          },
          {
            title: '극한 구하기',
            body: `$n\\to\\infty$ 이면 뒤의 항은 모두 $0$ 으로 가요.\n$$\\lim_{n\\to\\infty}S_n=${k === 1 && s === 0 ? (m === 1 ? '1' : `${m}\\cdot1`) : times(keptList, ['(', ')'])}${k === 1 && s === 0 && m === 1 ? '' : `=${fracTex(ans.n, ans.d)}`}$$`,
          },
        ],
        tip:
          k === 1
            ? '분모의 두 인수 차가 $1$ 이면 앞에 따로 곱할 수가 없어요. 바로 이웃한 괄호끼리 지워져 처음과 끝 하나씩 남아요.'
            : `차가 $${k}$ 이면 $\\frac{1}{${k}}$ 을 곱해야 해요. 빠뜨리면 답이 $${k}$ 배로 커져요.`,
      };
    },
  },
  {
    id: 'calc-series-converge-count',
    unitId: UNIT,
    title: '등비급수가 수렴하는 조건',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 3);
        const p = rng.int(-5, 5);
        const q = rng.int(2, 7);
        if (gcd(gcd(a, Math.abs(p)), q) !== 1) continue;
        // -q < ax - p < q  →  (p-q)/a < x < (p+q)/a
        const lo = (p - q) / a;
        const hi = (p + q) / a;
        const xs: number[] = [];
        for (let x = Math.ceil(lo); x <= Math.floor(hi); x++) if (x > lo && x < hi) xs.push(x);
        if (xs.length < 2) continue;
        const ax = a === 1 ? 'x' : `${a}x`;
        const num = p === 0 ? ax : `${ax}${p > 0 ? '-' : '+'}${Math.abs(p)}`;
        const Lo = fracTex(p - q, a);
        const Hi = fracTex(p + q, a);
        return {
          q: `등비급수 $\\sum_{n=1}^{\\infty}\\left(\\frac{${num}}{${q}}\\right)^n$ 이 수렴하도록 하는 정수 $x$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(xs.length),
          answerType: 'int',
          check: `ans = len([x for x in range(-60, 61) if Abs(Rational(${a}*x - (${p}), ${q})) < 1])`,
          concepts: [GEO_COND],
          steps: [
            {
              title: '공비 찾기',
              body: `첫째항과 공비가 모두 $r=\\frac{${num}}{${q}}$ 인 등비급수예요.`,
            },
            {
              title: '수렴 조건 세우기',
              body: `$$-1<\\frac{${num}}{${q}}<1$$`,
            },
            {
              title: `양변에 $${q}$ 곱하기`,
              body: `$$${-q}<${num}<${q}$$`,
            },
            {
              title: '$x$ 의 범위',
              body: `${a === 1 ? '모든 변에 같은 수를 더하면' : '모든 변에 같은 수를 더하고 $x$ 의 계수로 나누면'}\n$$${Lo}<x<${Hi}$$`,
            },
            {
              title: '정수 세기',
              body: `범위 안의 정수는 $${xs.join(',\\ ')}$, 모두 $${xs.length}$ 개예요.`,
            },
          ],
          tip: `등비수열 $\\{r^n\\}$ 은 $r=1$ 에서도 수렴하지만, 등비급수는 $r=1$ 이면 같은 수를 끝없이 더해 발산해요. 그래서 등호가 없는 $-1<r<1$ 이에요.`,
        };
      }
    },
  },
  {
    id: 'calc-series-limit-an',
    unitId: UNIT,
    title: '급수가 수렴하면 일반항은 0 으로',
    make(rng) {
      let p = 0;
      let qq = 0;
      let r = 0;
      // qq = p·r 이면 분수가 상수 p 로 약분돼 구할 극한이 없어진다
      do {
        p = rng.nonzero(-4, 5);
        qq = rng.nonzero(-5, 5);
        r = rng.int(1, 5);
      } while (qq === p * r);
      const k = rng.nonzero(-3, 4);
      const m = rng.int(-5, 5);
      const ans = k * p + m;
      const frac = `\\frac{${p === 1 ? '' : p === -1 ? '-' : p}n${qq > 0 ? '+' : '-'}${Math.abs(qq)}}{n+${r}}`;
      const lin = `${k === 1 ? '' : k === -1 ? '-' : k}a_n${m === 0 ? '' : m > 0 ? `+${m}` : m}`;
      return {
        q: `수열 $\\{a_n\\}$ 에 대하여 급수 $\\sum_{n=1}^{\\infty}\\left(a_n-${frac}\\right)$ 이 수렴할 때, $\\lim_{n\\to\\infty}(${lin})$ 의 값을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `ans = ${k}*limit((${p}*n + (${qq}))/(n + ${r}), n, oo) + (${m})`,
        concepts: [
          '$\\sum a_n$ 이 수렴하면 $\\lim_{n\\to\\infty}a_n=0$ 이에요(거꾸로는 성립하지 않아요).',
          '$\\frac{\\infty}{\\infty}$ 꼴은 분모의 최고차항으로 나눠요.',
        ],
        steps: [
          {
            title: '일반항의 극한은 0',
            body: `급수가 수렴하니 더하는 항은 $0$ 으로 가요.\n$$\\lim_{n\\to\\infty}\\left(a_n-${frac}\\right)=0$$`,
          },
          {
            title: '빼는 식의 극한',
            body: `분모·분자를 $n$ 으로 나누면 $${frac}\\to${p}$ ${ieyoN(p)}.`,
          },
          {
            title: '$a_n$ 의 극한',
            body: `$a_n=\\left(a_n-${frac}\\right)+${frac}$ 이므로 $\\lim a_n=0+${paren(p)}=${p}$ ${ieyoN(p)}.`,
          },
          {
            title: '구하는 극한',
            body: `$$\\lim_{n\\to\\infty}(${lin})=${k}\\cdot${paren(p)}${m === 0 ? '' : m > 0 ? `+${m}` : m}=${ans}$$`,
          },
        ],
        tip: '항이 $0$ 으로 간다고 해서 급수가 수렴하는 건 아니에요. 이 문제는 "수렴한다"는 조건에서 거꾸로 항의 극한을 끌어낸 거예요.',
      };
    },
  },
];
