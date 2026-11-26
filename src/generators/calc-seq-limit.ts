import type { Generator } from './types.ts';
import { eul, fracAns, fracTex, ieyo, paren, polySym, polyTex, reduce, ro } from './util.ts';

const UNIT = 'calc-seq-limit';

// 수열의 극한 기초 5유형: ∞/∞ 꼴(유리식), ∞−∞ 꼴(근호 유리화), 등비수열(밑이 큰 쪽으로 나누기·수렴 범위),
// 극한의 성질, 샌드위치 정리. 수능 미적 25번은 이 다섯 중 하나를 한 번 쓰는 문제라서 풀이도
// "꼴 알아보기 → 정해진 손질(나누기·유리화) → 0 으로 가는 항 지우기"의 같은 순서로 쓴다.
// (-1)^n 이 든 수열은 sympy limit 가 부호를 못 정해 검산이 깨지므로 생성기에서는 쓰지 않는다
// (진동하는 수열은 레슨에서 수직선·샌드위치로 다룬다).

const LIM = '\\displaystyle\\lim_{n\\to\\infty}';
const ZERO = '$n\\to\\infty$ 일 때 $\\frac{1}{n}\\to0$, $\\frac{1}{n^2}\\to0$';

/** '으로/로' — ㄹ 받침(일·칠·팔)과 받침 없음은 '로' */

/** n^k 꼴 TeX (k=1 이면 n) */
const nPow = (k: number) => (k === 1 ? 'n' : `n^${k}`);

/**
 * 다항식을 n^deg 로 나눈 꼴: [3,1,0] , 2 → "3+\frac{1}{n}". 최고차항으로 나눌 때 각 항이 어떻게 바뀌는지
 * 보여 줘야 "0 으로 가는 항"이 눈에 보인다.
 */
function divTex(coeffs: number[], deg: number): string {
  const top = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const e = top - i; // 이 항의 차수
    const k = deg - e; // 나눈 뒤 남는 분모 n^k
    const a = Math.abs(c);
    const sign = c < 0 ? '-' : parts.length ? '+' : '';
    parts.push(k === 0 ? `${sign}${a}` : `${sign}\\frac{${a}}{${nPow(k)}}`);
  });
  return parts.join('') || '0';
}

/** n²+an+b 의 TeX·sympy */
const quadTex = (a: number, b: number) => polyTex([1, a, b], 'n');
const quadSym = (a: number, b: number) => polySym([1, a, b], 'n');

export const generators: Generator[] = [
  {
    id: 'calc-seq-limit-rational',
    unitId: UNIT,
    title: '$\\frac{\\infty}{\\infty}$ 꼴의 극한',
    make(rng) {
      for (;;) {
        const deg = rng.pick([1, 2, 2]);
        const s = rng.int(1, 5);
        const den = deg === 2 ? [s, rng.int(-4, 4), rng.int(1, 6)] : [s, rng.int(1, 6)];
        // n=1..50 에서 분모가 0 이 되면 수열이 정의되지 않는다
        if ([...Array(50).keys()].some((i) => den.reduce((t, c) => t * (i + 1) + c, 0) <= 0))
          continue;
        const p = rng.nonzero(-6, 6);
        const lower = deg === 2 && rng.int(0, 3) === 0;
        const num = lower
          ? [0, p, rng.int(-5, 5)]
          : deg === 2
            ? [p, rng.int(-5, 5), rng.int(-5, 5)]
            : [p, rng.int(-5, 5)];
        // 분자가 분모의 상수배면 모든 항이 같은 상수 수열이라 극한을 물을 까닭이 없다
        if (!lower && num.every((c, i) => c * s === p * (den[i] as number))) continue;
        const ans = lower ? { n: 0, d: 1 } : reduce(p, s);
        const numDiv = divTex(num, deg);
        const denDiv = divTex(den, deg);
        return {
          q: `$${LIM}\\frac{${polyTex(num, 'n')}}{${polyTex(den, 'n')}}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `limit((${polySym(num, 'n')})/(${polySym(den, 'n')}), n, oo)`,
          concepts: [
            '$\\frac{\\infty}{\\infty}$ 꼴은 분모의 최고차항으로 분자·분모를 나눠요.',
            ZERO,
          ],
          steps: [
            {
              title: '분모의 최고차항으로 나누기',
              body: `분자·분모를 $${nPow(deg)}$ 으로 나눠요.\n$$\\frac{${polyTex(num, 'n')}}{${polyTex(den, 'n')}}=\\frac{${numDiv}}{${denDiv}}$$`,
            },
            {
              title: '0 으로 가는 항 지우기',
              body: `$\\frac{1}{n}$ 이 들어 있는 항은 모두 0 으로 가요.\n$$\\frac{${lower ? 0 : p}+0}{${s}+0}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: lower
            ? '분자의 차수가 분모보다 낮으면 극한은 0 이에요. 최고차항의 계수끼리 나누는 건 차수가 같을 때만이에요.'
            : '차수가 같으면 극한은 최고차항의 계수끼리의 비예요. 상수항끼리 나누지 마세요.',
        };
      }
    },
  },
  {
    id: 'calc-seq-limit-sqrt',
    unitId: UNIT,
    title: '$\\infty-\\infty$ 꼴: 유리화',
    make(rng) {
      const mode = rng.pick(['minus-n', 'two', 'recip'] as const);
      const RAT = '$\\sqrt{A}-\\sqrt{B}=\\frac{A-B}{\\sqrt{A}+\\sqrt{B}}$ (유리화)';
      if (mode === 'two') {
        let a: number;
        let b: number;
        do {
          a = rng.int(1, 10);
          b = rng.int(1, 9);
        } while (a === b);
        const ans = reduce(a - b, 2);
        return {
          q: `$${LIM}\\left(\\sqrt{${quadTex(a, 0)}}-\\sqrt{${quadTex(b, 0)}}\\right)$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `limit(sqrt(${quadSym(a, 0)}) - sqrt(${quadSym(b, 0)}), n, oo)`,
          concepts: [RAT, ZERO],
          steps: [
            {
              title: '유리화',
              body: `$$\\sqrt{${quadTex(a, 0)}}-\\sqrt{${quadTex(b, 0)}}=\\frac{${polyTex([a - b, 0], 'n')}}{\\sqrt{${quadTex(a, 0)}}+\\sqrt{${quadTex(b, 0)}}}$$`,
            },
            {
              title: '$n$ 으로 나누기',
              body: `$$=\\frac{${a - b}}{\\sqrt{${divTex([1, a, 0], 2)}}+\\sqrt{${divTex([1, b, 0], 2)}}}\\to\\frac{${a - b}}{1+1}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: '$\\infty-\\infty$ 를 0 으로 계산하면 틀려요. 유리화해서 $\\frac{\\infty}{\\infty}$ 꼴로 바꿔요.',
        };
      }
      const a = rng.int(1, 10);
      const b = mode === 'recip' ? 0 : rng.int(0, 9);
      const lin = polyTex([a, b], 'n');
      const rat = {
        title: '유리화',
        body: `$$\\sqrt{${quadTex(a, b)}}-n=\\frac{(${quadTex(a, b)})-n^2}{\\sqrt{${quadTex(a, b)}}+n}=\\frac{${lin}}{\\sqrt{${quadTex(a, b)}}+n}$$`,
      };
      if (mode === 'recip') {
        const ans = reduce(2, a);
        return {
          q: `$${LIM}\\frac{1}{\\sqrt{${quadTex(a, 0)}}-n}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `limit(1/(sqrt(${quadSym(a, 0)}) - n), n, oo)`,
          concepts: [RAT, ZERO],
          steps: [
            {
              title: '분모 유리화',
              body: `분자·분모에 $\\sqrt{${quadTex(a, 0)}}+n$ 을 곱해요.\n$$\\frac{1}{\\sqrt{${quadTex(a, 0)}}-n}=\\frac{\\sqrt{${quadTex(a, 0)}}+n}{${lin}}$$`,
            },
            {
              title: '$n$ 으로 나누기',
              body: `$$=\\frac{\\sqrt{${divTex([1, a, 0], 2)}}+1}{${a}}\\to\\frac{1+1}{${a}}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: '분모가 $\\infty-\\infty$ 꼴이면 분모를 유리화해요. 근호가 분자로 올라가요.',
        };
      }
      const ans = reduce(a, 2);
      return {
        q: `$${LIM}\\left(\\sqrt{${quadTex(a, b)}}-n\\right)$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(ans.n, ans.d),
        answerType: 'fraction',
        check: `limit(sqrt(${quadSym(a, b)}) - n, n, oo)`,
        concepts: [RAT, ZERO],
        steps: [
          rat,
          {
            title: '$n$ 으로 나누기',
            body: `$$=\\frac{${divTex([a, b], 1)}}{\\sqrt{${divTex([1, a, b], 2)}}+1}\\to\\frac{${a}}{1+1}=${fracTex(ans.n, ans.d)}$$`,
          },
        ],
        tip: '유리화할 때 분모는 빼기가 아니라 더하기($\\sqrt{\\ }+n$)예요. 부호를 그대로 두면 분모가 다시 $\\infty-\\infty$ 가 돼요.',
      };
    },
  },
  {
    id: 'calc-seq-limit-geometric',
    unitId: UNIT,
    title: '등비수열의 극한',
    make(rng) {
      if (rng.int(0, 2) === 0) {
        // 수렴 범위: -1 < r ≤ 1. 끝값 r=1 은 넣고 r=-1 은 빼는 것을 묻는다
        const c = rng.int(-3, 5);
        const d = rng.int(2, 5);
        const num = c === 0 ? 'x' : `x${c > 0 ? '-' : '+'}${Math.abs(c)}`;
        return {
          q: `수열 $\\left\\{\\left(\\frac{${num}}{${d}}\\right)^n\\right\\}$ 이 수렴하도록 하는 정수 $x$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(2 * d),
          answerType: 'int',
          check: `len([t for t in range(${c - d - 3}, ${c + d + 4}) if -1 < Rational(t - (${c}), ${d}) <= 1])`,
          concepts: ['등비수열 $\\{r^n\\}$ 이 수렴할 조건은 $-1<r\\le1$'],
          steps: [
            { title: '수렴 조건', body: `$$-1<\\frac{${num}}{${d}}\\le1$$` },
            {
              title: '$x$ 의 범위',
              body: `각 변에 ${d} ${eul(d)} 곱하고 ${c === 0 ? '정리하면' : `${Math.abs(c)} ${eul(c)} ${c > 0 ? '더하면' : '빼면'}`}\n$$${c - d}<x\\le ${c + d}$$`,
            },
            {
              title: '개수 세기',
              body: `$${c - d + 1}$ 부터 $${c + d}$ 까지 정수는 ${2 * d}개예요.`,
            },
          ],
          tip: '$r=1$ 이면 모든 항이 1 이라 수렴하고, $r=-1$ 이면 $-1$ 과 $1$ 을 오가며 진동해요. 등호는 오른쪽에만 붙어요.',
        };
      }
      // 밑 1 은 1^n=1 이라 '거듭제곱으로 나누기'를 연습할 거리가 없어서 B ≥ 2
      const A = rng.int(3, 5);
      const B = rng.int(2, A - 1);
      const p = rng.int(1, 3);
      const q = rng.nonzero(-3, 3);
      const r = rng.int(1, 3);
      const up = rng.int(0, 1) === 1; // 분자에 A^{n+1}(→ pA) 인가, 분모에 A^{n+1}(→ p/A) 인가
      const term = (base: number, e: string) => (base === 1 ? '1' : `${base}^{${e}}`);
      const sym = (base: number, e: string) => (base === 1 ? '1' : `${base}**(${e})`);
      const sgn = (k: number) => (k < 0 ? '-' : '+');
      const coef = (k: number) => (Math.abs(k) === 1 ? '' : `${Math.abs(k)}\\cdot `);
      const lead = (k: number) => (k === 1 ? '' : `${k}\\cdot `);
      const numTex = up
        ? `${lead(p)}${term(A, 'n+1')}${sgn(q)}${coef(q)}${term(B, 'n')}`
        : `${lead(p)}${term(A, 'n')}${sgn(q)}${coef(q)}${term(B, 'n+1')}`;
      const denTex = up
        ? `${term(A, 'n')}+${coef(r)}${term(B, 'n')}`
        : `${term(A, 'n+1')}+${coef(r)}${term(B, 'n')}`;
      const numSym = up
        ? `${p}*${sym(A, 'n + 1')} + (${q})*${sym(B, 'n')}`
        : `${p}*${sym(A, 'n')} + (${q})*${sym(B, 'n + 1')}`;
      const denSym = up
        ? `${sym(A, 'n')} + ${r}*${sym(B, 'n')}`
        : `${sym(A, 'n + 1')} + ${r}*${sym(B, 'n')}`;
      const ans = up ? reduce(p * A, 1) : reduce(p, A);
      const ratio = `\\left(${fracTex(B, A)}\\right)^n`;
      const qB = up ? q : q * B;
      const qTerm = `${qB === 1 ? '+' : qB === -1 ? '-' : qB > 0 ? `+${qB}` : qB}${ratio}`;
      const divNum = `${up ? p * A : p}${qTerm}`;
      const divDen = up ? `1+${r === 1 ? '' : r}${ratio}` : `${A}+${r === 1 ? '' : r}${ratio}`;
      return {
        q: `$${LIM}\\frac{${numTex}}{${denTex}}$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(ans.n, ans.d),
        answerType: 'fraction',
        check: `limit((${numSym})/(${denSym}), n, oo)`,
        concepts: [
          '$-1<r<1$ 이면 $\\displaystyle\\lim_{n\\to\\infty}r^n=0$',
          '밑이 가장 큰 거듭제곱으로 분자·분모를 나눠요.',
        ],
        steps: [
          {
            title: `$${A}^n$ 으로 나누기`,
            body: `밑이 가장 큰 $${A}^n$ 으로 분자·분모를 나눠요.\n$$\\frac{${divNum}}{${divDen}}$$`,
          },
          {
            title: '0 으로 가는 항 지우기',
            body: `$0<${fracTex(B, A)}<1$ 이라서 $${ratio}\\to0$ 이에요.\n$$${up ? `\\frac{${p * A}+0}{1+0}=${p * A}` : `\\frac{${p}+0}{${A}+0}=${fracTex(p, A)}`}$$`,
          },
        ],
        tip: `작은 밑으로 나누면 $\\left(${fracTex(A, B)}\\right)^n$ 처럼 발산하는 항이 생겨요. 늘 밑이 가장 큰 것으로 나눠요.`,
      };
    },
  },
  {
    id: 'calc-seq-limit-property',
    unitId: UNIT,
    title: '수열의 극한의 성질',
    make(rng) {
      if (rng.int(0, 1) === 0) {
        // lim (pn+q)a_n = c 에서 lim (rn+s)a_n — 수렴하는 꼴끼리 곱해 옮기는 연습
        const p = rng.int(1, 4);
        let r: number;
        do r = rng.int(1, 5);
        while (r === p);
        const q = rng.int(1, 5);
        const s = rng.nonzero(-3, 3);
        const c = rng.nonzero(-8, 8);
        const ans = reduce(c * r, p);
        const pq = polyTex([p, q], 'n');
        const rs = polyTex([r, s], 'n');
        return {
          q: `수열 $\\{a_n\\}$ 이 $${LIM}(${pq})a_n=${c}$ 을 만족시킬 때, $${LIM}(${rs})a_n$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `limit(${c}*(${polySym([r, s], 'n')})/(${polySym([p, q], 'n')}), n, oo)`,
          concepts: ['수렴하는 두 수열의 곱의 극한은 극한의 곱이에요.'],
          steps: [
            {
              title: '아는 꼴로 쪼개기',
              body: `$$(${rs})a_n=(${pq})a_n\\times\\frac{${rs}}{${pq}}$$`,
            },
            {
              title: '각각의 극한',
              body: `앞은 $${c}$ ${ro(c)} 수렴하고, 뒤는 $\\frac{\\infty}{\\infty}$ 꼴이라 $${fracTex(r, p)}$ ${ro(reduce(r, p).n)} 수렴해요.`,
            },
            { title: '곱하기', body: `$$${c}\\times${fracTex(r, p)}=${fracTex(ans.n, ans.d)}$$` },
          ],
          tip: '$a_n$ 자체는 0 으로 가요. $\\lim a_n=0$ 과 $\\lim(\\infty)=\\infty$ 를 따로 곱하면 안 되고, 수렴하는 두 꼴로 묶어야 해요.',
        };
      }
      for (;;) {
        const al = rng.int(-4, 5);
        const be = rng.nonzero(-4, 5);
        const p = rng.int(1, 4);
        const q = rng.int(1, 3);
        const den = al + q * be;
        if (den === 0) continue;
        const ans = reduce(p * al - be, den);
        const qa = q === 1 ? '' : q;
        return {
          q: `두 수열 $\\{a_n\\}$, $\\{b_n\\}$ 에 대하여 $${LIM}a_n=${al}$, $${LIM}b_n=${be}$ 일 때, $${LIM}\\frac{${p === 1 ? '' : p}a_n-b_n}{a_n+${qa}b_n}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `limit((${p}*(${al} + 1/n) - (${be} - 1/n))/((${al} + 1/n) + ${q}*(${be} - 1/n)), n, oo)`,
          concepts: [
            '수렴하는 수열은 합·차·실수배·몫(분모의 극한이 0 이 아닐 때)의 극한을 각각 구해 계산해요.',
          ],
          steps: [
            {
              title: '극한값 넣기',
              body: `분모의 극한이 $${al}+${q === 1 ? '' : `${q}\\times`}${paren(be)}=${den}\\ne0$ 이라 극한값을 그대로 넣어요.`,
            },
            {
              title: '계산',
              body: `$$\\frac{${p === 1 ? '' : `${p}\\times`}${paren(al)}-${paren(be)}}{${den}}=${fracTex(ans.n, ans.d)}$$`,
            },
          ],
          tip: '몫의 극한은 분모의 극한이 0 이 아닐 때만 이렇게 바로 넣어요.',
        };
      }
    },
  },
  {
    id: 'calc-seq-limit-squeeze',
    unitId: UNIT,
    title: '샌드위치 정리',
    make(rng) {
      const SQZ =
        '$a_n\\le c_n\\le b_n$ 이고 $\\lim a_n=\\lim b_n=\\alpha$ 이면 $\\lim c_n=\\alpha$';
      if (rng.int(0, 1) === 0) {
        const p = rng.int(1, 6);
        const s = rng.int(1, 4);
        const t = rng.int(1, 5);
        const q1 = rng.int(-5, 0);
        const q2 = q1 + rng.int(1, 6);
        const ans = reduce(p, s);
        const lo = polyTex([p, q1], 'n');
        const hi = polyTex([p, q2], 'n');
        const dn = polyTex([s, t], 'n');
        return {
          q: `수열 $\\{a_n\\}$ 이 모든 자연수 $n$ 에 대하여 $\\frac{${lo}}{${dn}}<a_n<\\frac{${hi}}{${dn}}$ 을 만족시킬 때, $${LIM}a_n$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `lo = limit((${polySym([p, q1], 'n')})/(${polySym([s, t], 'n')}), n, oo)\nhi = limit((${polySym([p, q2], 'n')})/(${polySym([s, t], 'n')}), n, oo)\nans = lo if lo == hi else nan`,
          concepts: [SQZ],
          steps: [
            {
              title: '양쪽 극한',
              body: `두 분수는 차수가 같아 최고차항의 계수의 비 $${fracTex(p, s)}$ ${ro(ans.n)} 수렴해요.`,
            },
            {
              title: '샌드위치',
              body: `$a_n$ 은 같은 값으로 가는 두 수열 사이에 끼어 있으니 $${LIM}a_n=${fracTex(ans.n, ans.d)}$ ${ieyo(ans.n, ans.d)}.`,
            },
          ],
          tip: '양쪽 극한이 같을 때만 가운데 극한이 정해져요. 다르면 이 정리로는 알 수 없어요.',
        };
      }
      const p = rng.int(1, 6);
      const c1 = rng.int(1, 5);
      const c2 = rng.int(1, 5);
      return {
        q: `수열 $\\{a_n\\}$ 이 모든 자연수 $n$ 에 대하여 $${p === 1 ? '' : p}n^2-${c1}<na_n<${p === 1 ? '' : p}n^2+${c2}$ 을 만족시킬 때, $${LIM}\\frac{a_n}{n}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(p),
        answerType: 'int',
        check: `lo = limit((${p}*n**2 - ${c1})/n**2, n, oo)\nhi = limit((${p}*n**2 + ${c2})/n**2, n, oo)\nans = lo if lo == hi else nan`,
        concepts: [SQZ],
        steps: [
          {
            title: '$\\frac{a_n}{n}$ 꼴 만들기',
            body: `각 변을 $n^2$ 으로 나눠요.\n$$${p}-\\frac{${c1}}{n^2}<\\frac{a_n}{n}<${p}+\\frac{${c2}}{n^2}$$`,
          },
          {
            title: '샌드위치',
            body: `양쪽이 모두 ${p} ${ro(p)} 수렴하니 $${LIM}\\frac{a_n}{n}=${p}$ ${ieyo(p)}.`,
          },
        ],
        tip: '구하는 꼴($\\frac{a_n}{n}$)이 가운데에 오도록 각 변을 같은 양수로 나눠요. 양수로 나누면 부등호 방향은 그대로예요.',
      };
    },
  },
];
