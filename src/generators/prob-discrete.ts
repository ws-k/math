import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd, ieyo, lcm, paren } from './util.ts';

const UNIT = 'prob-discrete';

// 수능 확통 27번(3점)이 묻는 흐름 그대로: 확률분포표의 빈칸을 "합이 1"로 먼저 채우고,
// 값 × 확률을 더해 평균, 제곱의 평균 − 평균의 제곱으로 분산을 구한다.
// 표의 확률은 공통분모 d 로 만든 뒤 칸마다 기약분수로 보여 준다 — 계산은 분모 d 로 맞춰 하는 게
// 손으로 가장 짧아서, 풀이 단계도 "분자끼리 더하고 d 로 나눈다"로 쓴다.

/** 분수 값 하나(분자·분모). 화면 글자와 검산식을 같은 값에서 만든다 */
interface Fr {
  n: number;
  d: number;
}
const fr = (n: number, d: number): Fr => {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
};
const tex = (f: Fr) => fracTex(f.n, f.d);
const ans = (f: Fr) => fracAns(f.n, f.d);
const sym = (f: Fr) => (f.d === 1 ? String(f.n) : `Rational(${f.n}, ${f.d})`);

const P_SUM = '확률분포표의 확률을 모두 더하면 $1$';
const MEAN = '$E(X)=x_1p_1+x_2p_2+\\cdots+x_np_n$';
const VAR = '$V(X)=E(X^2)-\\{E(X)\\}^2$';
const LIN = '$E(aX+b)=aE(X)+b$, $V(aX+b)=a^2V(X)$, $\\sigma(aX+b)=|a|\\sigma(X)$';

/** 확률분포표 KaTeX. cells 는 칸마다 보일 글자 */
function tableTex(xs: number[], cells: string[]): string {
  const cols = 'c'.repeat(xs.length);
  return (
    `$$\\begin{array}{c|${cols}|c} X & ${xs.join(' & ')} & \\text{합계} \\\\ \\hline ` +
    `P(X=x) & ${cells.join(' & ')} & 1 \\end{array}$$`
  );
}

/** 합이 d 인 양의 정수 k 개(무작위) */
function weights(rng: Rng, k: number, d: number): number[] {
  for (;;) {
    const w = Array.from({ length: k }, () => rng.int(1, d - k + 1));
    const s = w.reduce((a, b) => a + b, 0);
    if (s === d) return w;
  }
}

/** 값이 띄엄띄엄 놓인 확률변수의 값들(작은 것부터) */
function values(rng: Rng, k: number): number[] {
  const start = rng.int(0, 2);
  const step = rng.pick([1, 1, 2]);
  return Array.from({ length: k }, (_, i) => start + i * step);
}

/** "1\times\frac{1}{8}+2\times a+…" — 값 × 확률의 합 */
const productTex = (xs: number[], ps: string[], sq = false) =>
  xs.map((x, i) => `${sq ? `${paren(x)}^2` : paren(x)}\\times ${ps[i]}`).join('+');

/** sympy 쪽 합 — 앱 글자와 따로, 표의 수에서 바로 계산한다 */
const productSym = (xs: number[], ps: string[], sq = false) =>
  xs.map((x, i) => `${sq ? `(${x})**2` : `(${x})`}*${ps[i]}`).join(' + ');

export const generators: Generator[] = [
  {
    id: 'prob-discrete-fill-mean',
    unitId: UNIT,
    title: '확률분포표의 빈칸 채우고 평균 구하기',
    make(rng) {
      for (;;) {
        const k = rng.pick([3, 4]);
        const d = rng.pick(k === 3 ? [4, 5, 6, 8] : [6, 8, 10, 12]);
        const w = weights(rng, k, d);
        const xs = values(rng, k);
        const h = rng.int(0, k - 1);
        const ps = w.map((wi) => fr(wi, d));
        const num = xs.reduce((s, x, i) => s + x * (w[i] as number), 0);
        const mean = fr(num, d);
        // 평균이 0 이면 "값 × 확률" 연습이 안 되므로 다시 뽑는다
        if (num === 0) continue;
        const a = ps[h] as Fr;
        const cells = ps.map((p, i) => (i === h ? 'a' : tex(p)));
        const others = ps.filter((_, i) => i !== h);
        const restSym = others.map(sym).join(' - ');
        const meanTerms = productTex(
          xs,
          ps.map((p) => tex(p)),
        );
        // 공통분모는 표에 보이는 기약분수들의 최소공배수 — 학생이 실제로 맞출 분모
        const L = ps.reduce((m, p) => lcm(m, p.d), 1);
        const numTerms = xs
          .map((x, i) => `${paren(x)}\\times ${(ps[i] as Fr).n * (L / (ps[i] as Fr).d)}`)
          .join('+');
        const numL = (num * L) / d;
        const reduced = mean.d === L ? '' : `=${tex(mean)}`;
        return {
          q: `확률변수 $X$ 의 확률분포가 다음 표와 같을 때, $E(X)$ 의 값을 구하세요.\n${tableTex(xs, cells)}`,
          choices: null,
          answer: ans(mean),
          answerType: 'fraction',
          check: `a = 1 - ${restSym}\nans = ${productSym(
            xs,
            ps.map((p, i) => (i === h ? 'a' : sym(p))),
          )}`,
          concepts: [P_SUM, MEAN],
          steps: [
            {
              title: '확률의 합은 1',
              body: `$$${others.map(tex).join('+')}+a=1$$\n이므로 $a=${tex(a)}$ ${ieyo(a)}.`,
            },
            {
              title: '값 × 확률을 모두 더하기',
              body: `$$E(X)=${meanTerms}$$`,
            },
            {
              title: '분모를 통일해 계산하기',
              body: `$$E(X)=\\frac{${numTerms}}{${L}}=\\frac{${numL}}{${L}}${reduced}$$`,
            },
          ],
          tip: `확률을 모두 더해 $1$ 이 되는지 먼저 확인하면 표를 잘못 읽는 실수를 막을 수 있어요. 평균은 늘 $X$ 의 가장 작은 값과 가장 큰 값 사이에 있어요. 확인: $${xs[0]}\\le ${tex(mean)}\\le ${xs[k - 1]}$`,
        };
      }
    },
  },
  {
    id: 'prob-discrete-variance',
    unitId: UNIT,
    title: '확률분포표에서 분산 구하기',
    make(rng) {
      for (;;) {
        const k = rng.pick([3, 4]);
        const d = rng.pick(k === 3 ? [4, 5, 6, 8] : [6, 8, 10]);
        const w = weights(rng, k, d);
        const xs = values(rng, k);
        const ps = w.map((wi) => fr(wi, d));
        const s1 = xs.reduce((s, x, i) => s + x * (w[i] as number), 0);
        const s2 = xs.reduce((s, x, i) => s + x * x * (w[i] as number), 0);
        const m = fr(s1, d);
        const e2 = fr(s2, d);
        const v = fr(s2 * d - s1 * s1, d * d);
        if (s1 === 0 || v.n === 0) continue;
        const pt = ps.map(tex);
        const pS = ps.map(sym);
        return {
          q: `확률변수 $X$ 의 확률분포가 다음 표와 같을 때, $V(X)$ 의 값을 구하세요.\n${tableTex(xs, pt)}`,
          choices: null,
          answer: ans(v),
          answerType: 'fraction',
          check: `m = ${productSym(xs, pS)}\nans = ${productSym(xs, pS, true)} - m**2`,
          concepts: [MEAN, VAR],
          steps: [
            {
              title: '평균 구하기',
              body: `$$E(X)=${productTex(xs, pt)}=${tex(m)}$$`,
            },
            {
              title: '제곱의 평균 구하기',
              body: `$$E(X^2)=${productTex(xs, pt, true)}=${tex(e2)}$$`,
            },
            {
              title: '제곱의 평균 − 평균의 제곱',
              body: `$$V(X)=${tex(e2)}-\\left(${tex(m)}\\right)^2=${tex(v)}$$`,
            },
          ],
          tip: `평균을 제곱하지 않고 그대로 빼는 실수가 가장 많아요. 분산은 늘 $0$ 이상이니, 음수가 나오면 계산을 다시 보세요.`,
        };
      }
    },
  },
  {
    id: 'prob-discrete-linear',
    unitId: UNIT,
    title: '$aX+b$ 의 평균·분산·표준편차',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['E', 'V', 'S'] as const);
        const m = rng.int(-3, 8);
        // 표준편차를 물을 때는 분산이 제곱수여야 답이 정수로 나온다
        const v = kind === 'S' ? rng.pick([1, 4, 9, 16]) : rng.int(1, 10);
        const a = rng.pick([-4, -3, -2, 2, 3, 4, 5]);
        const b = rng.nonzero(-6, 6);
        const Y = `${a}X${b < 0 ? b : `+${b}`}`;
        const given =
          kind === 'S'
            ? `$E(X)=${m}$, $V(X)=${v}$`
            : rng.int(0, 1) === 0
              ? `$E(X)=${m}$, $V(X)=${v}$`
              : `$E(X)=${m}$, $\\sigma(X)=\\sqrt{${v}}$`;
        if (kind === 'E') {
          const r = a * m + b;
          return {
            q: `확률변수 $X$ 에 대하여 ${given} 일 때, $E(${Y})$ 의 값을 구하세요.`,
            choices: null,
            answer: String(r),
            answerType: 'int',
            check: `(${a})*(${m}) + (${b})`,
            concepts: [LIN],
            steps: [
              {
                title: '평균은 그대로 따라 바뀌어요',
                body: `$$E(${Y})=${a}E(X)${b < 0 ? b : `+${b}`}$$`,
              },
              {
                title: '값 넣기',
                body: `$$${a}\\times ${paren(m)}${b < 0 ? b : `+${b}`}=${r}$$`,
              },
            ],
            tip: '평균은 모든 값을 똑같이 바꾼 만큼 그대로 바뀌어요. 분산은 평균을 구할 때 쓰지 않아요.',
          };
        }
        if (kind === 'V') {
          const r = a * a * v;
          if (r > 200) continue;
          return {
            q: `확률변수 $X$ 에 대하여 ${given} 일 때, $V(${Y})$ 의 값을 구하세요.`,
            choices: null,
            answer: String(r),
            answerType: 'int',
            check: `(${a})**2*(${v})`,
            concepts: [LIN, '$\\sigma(X)=\\sqrt{V(X)}$'],
            steps: [
              ...(given.includes('sigma')
                ? [
                    {
                      title: '분산으로 바꾸기',
                      body: `분산은 표준편차의 제곱이에요.\n$$V(X)=(\\sqrt{${v}})^2=${v}$$`,
                    },
                  ]
                : []),
              {
                title: '더한 수는 분산을 바꾸지 않아요',
                body: `모든 값을 $${b}$ 만큼 옮겨도 퍼진 정도는 같아요.\n$$V(${Y})=V(${a}X)$$`,
              },
              {
                title: '곱한 수는 제곱으로',
                body: `$$V(${a}X)=${paren(a)}^2\\times ${v}=${r}$$`,
              },
            ],
            tip: '곱한 수를 제곱하지 않고 그대로 곱하거나, 더한 수까지 더하는 실수가 많아요. 분산에는 곱한 수의 **제곱**만 붙어요.',
          };
        }
        const sd = Math.round(Math.sqrt(v));
        const r = Math.abs(a) * sd;
        return {
          q: `확률변수 $X$ 에 대하여 ${given} 일 때, $\\sigma(${Y})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(r),
          answerType: 'int',
          check: `Abs(${a})*sqrt(${v})`,
          concepts: [LIN, '$\\sigma(X)=\\sqrt{V(X)}$'],
          steps: [
            {
              title: '표준편차 구하기',
              body: `$$\\sigma(X)=\\sqrt{${v}}=${sd}$$`,
            },
            {
              title: '곱한 수의 절댓값만 곱해요',
              body: `$$\\sigma(${Y})=|${a}|\\times ${sd}=${r}$$`,
            },
          ],
          tip: '표준편차는 거리처럼 늘 $0$ 이상이에요. 그래서 곱한 수가 음수여도 절댓값을 곱하고, 더한 수는 영향을 주지 않아요.',
        };
      }
    },
  },
  {
    id: 'prob-discrete-bag',
    unitId: UNIT,
    title: '공을 꺼낼 때 개수의 평균',
    make(rng) {
      const r = rng.int(2, 5);
      const bl = rng.int(2, 5);
      const n = r + bl;
      const c2 = (t: number) => (t * (t - 1)) / 2;
      const tot = c2(n);
      const p0 = fr(c2(bl), tot);
      const p1 = fr(r * bl, tot);
      const p2 = fr(c2(r), tot);
      const num = r * bl + 2 * c2(r);
      const mean = fr(num, tot);
      const C = (a: number, b: number) => `{}_{${a}}\\mathrm{C}_{${b}}`;
      return {
        q: `흰 공 $${r}$ 개와 검은 공 $${bl}$ 개가 들어 있는 주머니에서 공 $2$ 개를 동시에 꺼낼 때, 꺼낸 흰 공의 개수를 $X$ 라 해요. $E(X)$ 의 값을 구하세요.`,
        choices: null,
        answer: ans(mean),
        answerType: 'fraction',
        check: `(0*binomial(${bl}, 2) + 1*${r}*${bl} + 2*binomial(${r}, 2))/binomial(${n}, 2)`,
        concepts: ['$X$ 가 가질 수 있는 값을 먼저 정하고, 값마다 확률을 구해 표로 만들어요.', MEAN],
        steps: [
          {
            title: '전체 경우의 수',
            body: `공 $${n}$ 개에서 $2$ 개를 고르므로 $${C(n, 2)}=${tot}$ ${ieyo(tot)}.`,
          },
          {
            title: '값마다 확률',
            body: `$X$ 는 $0$, $1$, $2$ 중 하나예요.\n$$P(X=0)=\\frac{${C(bl, 2)}}{${tot}}=${tex(p0)},\\quad P(X=1)=\\frac{${r}\\times ${bl}}{${tot}}=${tex(p1)},\\quad P(X=2)=\\frac{${C(r, 2)}}{${tot}}=${tex(p2)}$$`,
          },
          {
            title: '값 × 확률을 모두 더하기',
            body: `$$E(X)=0\\times ${tex(p0)}+1\\times ${tex(p1)}+2\\times ${tex(p2)}=\\frac{${num}}{${tot}}${mean.d === tot ? '' : `=${tex(mean)}`}$$`,
          },
        ],
        tip: `세 확률을 더하면 $1$ 이 되는지 확인해 보세요. 지름길도 있어요. 공 하나가 흰 공일 확률 $\\frac{${r}}{${n}}$ 에 꺼낸 개수 $2$ 를 곱해도 같은 값이 나와요.`,
      };
    },
  },
];
