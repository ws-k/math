import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, reduce } from './util.ts';

const UNIT = 'prob-binomial';

// 이항분포 기초 4유형: 확률 P(X=r), 평균·분산, 평균·분산에서 n·p 되찾기, aX+b 의 평균·분산.
// 수능 확통 29번처럼 '이항분포임을 알아보고 np·npq 로 바로 가는' 흐름을 연습시키는 게 목적이라
// 풀이는 늘 "이항분포 B(n,p) 확인 → 공식"의 두 걸음으로 쓴다.
// 확률값은 분수 그대로 다루고, n 은 분모의 배수로 뽑아 평균이 자연수가 되게 한다(손계산이 지루하지 않게).

const PMF = '$P(X=r)={}_n\\mathrm{C}_r\\,p^r(1-p)^{n-r}$';
const MEAN_VAR = '$E(X)=np$, $V(X)=np(1-p)$';
const LINEAR = '$E(aX+b)=aE(X)+b$, $V(aX+b)=a^2V(X)$';

/** 조합 nCr */
function nCr(n: number, r: number): number {
  let v = 1;
  for (let i = 1; i <= r; i++) v = (v * (n - r + i)) / i;
  return v;
}

// '이에요/예요'는 앞 소리의 받침으로 갈린다. 분수는 "b분의 a"로 읽어 분자가 끝 소리이고,
// 숫자 끝자리 영·일·삼·육·칠·팔(0·1·3·6·7·8)에 받침이 있다.
const batchim = (n: number, d = 1) => /[013678]$/.test(String(Math.abs(reduce(n, d).n)));
const ieyo = (n: number, d = 1) => (batchim(n, d) ? '이에요' : '예요');
const iga = (n: number) => (batchim(n) ? '이' : '가');

/** 확률 p = a/b (기약) */
type P = { a: number; b: number };
const pTex = (p: P) => fracTex(p.a, p.b);
const qTex = (p: P) => fracTex(p.b - p.a, p.b);
const pSym = (p: P) => `Rational(${p.a}, ${p.b})`;

/** p^r 를 TeX 로 — 지수가 1 이면 생략, 0 이면 아예 뺀다(1 로) */
function powTex(base: string, e: number): string {
  if (e === 0) return '';
  const b = base.startsWith('\\frac') ? `\\left(${base}\\right)` : base;
  return e === 1 ? b : `${b}^{${e}}`;
}

// 어떤 사건을 n 번 독립적으로 반복하는지 — 확률과 문장
interface Ctx {
  p: P;
  /** "동전 한 개를 {n}번 던질 때" 처럼 시행 부분 */
  trial: (n: number) => string;
  /** "앞면이" — 사건(조사 '이/가' 포함) */
  event: string;
  /** 한 번 할 때 사건이 일어날 확률의 이유 */
  why: string;
}

function pickCtx(rng: { int(lo: number, hi: number): number; pick<T>(a: readonly T[]): T }): Ctx {
  const kind = rng.pick(['coin', 'six', 'three', 'bag'] as const);
  if (kind === 'coin')
    return {
      p: { a: 1, b: 2 },
      trial: (n) => `동전 한 개를 ${n}번 던질 때`,
      event: '앞면이',
      why: '동전 한 개를 던져 앞면이 나올 확률은 $\\frac{1}{2}$ 이에요.',
    };
  if (kind === 'six')
    return {
      p: { a: 1, b: 6 },
      trial: (n) => `주사위 한 개를 ${n}번 던질 때`,
      event: '6의 눈이',
      why: '주사위 한 번에 6의 눈이 나올 확률은 $\\frac{1}{6}$ 이에요.',
    };
  if (kind === 'three')
    return {
      p: { a: 1, b: 3 },
      trial: (n) => `주사위 한 개를 ${n}번 던질 때`,
      event: '3의 배수의 눈이',
      why: '3의 배수의 눈은 3, 6 두 가지라 확률은 $\\frac{2}{6}=\\frac{1}{3}$ 이에요.',
    };
  for (;;) {
    const w = rng.int(1, 3);
    const k = rng.int(1, 4);
    const r = reduce(w, w + k);
    // 흰 공 확률이 1/2 이면 동전과 같아져 굳이 주머니일 이유가 없다
    if (r.n * 2 === r.d) continue;
    const whyP =
      r.d === w + k ? `$\\frac{${w}}{${w + k}}$` : `$\\frac{${w}}{${w + k}}=${fracTex(w, w + k)}$`;
    return {
      p: { a: r.n, b: r.d },
      trial: (n) =>
        `흰 공 ${w}개, 검은 공 ${k}개가 든 주머니에서 공 한 개를 꺼내 색을 확인하고 다시 넣는 시행을 ${n}번 할 때`,
      event: '흰 공이',
      why: `공을 다시 넣으니 매번 흰 공이 나올 확률은 ${whyP} 로 같아요.`,
    };
  }
}

/** 이항분포 확률 P(X=r) 를 분수(n/d) 로 */
function pmf(n: number, r: number, p: P): { n: number; d: number } {
  const num = nCr(n, r) * p.a ** r * (p.b - p.a) ** (n - r);
  const den = p.b ** n;
  return reduce(num, den);
}

/** p 후보: 분모가 작은 것만(평균·분산 계산이 손으로 될 만큼) */
const PS: readonly P[] = [
  { a: 1, b: 2 },
  { a: 1, b: 3 },
  { a: 2, b: 3 },
  { a: 1, b: 4 },
  { a: 3, b: 4 },
  { a: 1, b: 5 },
  { a: 2, b: 5 },
  { a: 3, b: 5 },
  { a: 1, b: 6 },
];

export const generators: Generator[] = [
  {
    id: 'prob-binomial-pmf',
    unitId: UNIT,
    title: '독립시행의 확률 $P(X=r)$',
    make(rng) {
      for (;;) {
        const c = pickCtx(rng);
        const n = rng.int(3, 5);
        const r = rng.int(1, n);
        const ans = pmf(n, r, c.p);
        // 분모가 너무 크면(6^5=7776) 손계산이 의미 없이 지루해진다
        if (ans.d > 1296) continue;
        const C = nCr(n, r);
        const terms = [powTex(pTex(c.p), r), powTex(qTex(c.p), n - r)].filter(Boolean);
        // 분자는 1 이 아닌 인수만 적는다(동전이면 1^r 같은 군더더기가 생긴다)
        const q = c.p.b - c.p.a;
        const numParts = [
          String(C),
          ...(c.p.a > 1 ? [`${c.p.a}${r > 1 ? `^{${r}}` : ''}`] : []),
          ...(q > 1 && n - r > 0 ? [`${q}${n - r > 1 ? `^{${n - r}}` : ''}`] : []),
        ];
        const rawNum = C * c.p.a ** r * q ** (n - r);
        const rawDen = c.p.b ** n;
        const frac = `\\frac{${numParts.join('\\cdot ')}}{${c.p.b}^{${n}}}`;
        // 약분은 손으로 한 번 보여 준다(1296 같은 분모를 바로 기약분수로 적으면 어디서 왔는지 안 보인다)
        const raw = `\\frac{${rawNum}}{${rawDen}}`;
        const tail = ans.d === rawDen ? `=${raw}` : `=${raw}=${fracTex(ans.n, ans.d)}`;
        return {
          q: `${c.trial(n)}, ${c.event} 정확히 ${r}번 나올 확률을 구하세요.`,
          choices: null,
          answer: fracAns(ans.n, ans.d),
          answerType: 'fraction',
          check: `binomial(${n}, ${r})*${pSym(c.p)}**${r}*(1 - ${pSym(c.p)})**${n - r}`,
          concepts: [PMF, '같은 시행을 독립적으로 반복하면 횟수 $X$ 는 이항분포를 따라요.'],
          steps: [
            {
              title: '한 번의 확률',
              body: `${c.why} 일어나지 않을 확률은 $1-p=${qTex(c.p)}$ ${ieyo(c.p.b - c.p.a, c.p.b)}.`,
            },
            {
              title: '자리 고르기',
              body: `${n}번 중 ${c.event} 나올 ${r}번의 자리를 고르는 수는 $${'{}'}_${n}\\mathrm{C}_${r}=${C}$ ${ieyo(C)}.`,
            },
            {
              title: '곱하기',
              body: `$$${C}\\times ${terms.join('\\times ')}=${frac}${tail}$$`,
            },
          ],
          tip: `자리 고르는 수 $${'{}'}_${n}\\mathrm{C}_${r}$ 를 빠뜨리면 한 가지 순서의 확률만 구한 셈이에요.`,
        };
      }
    },
  },
  {
    id: 'prob-binomial-mean-var',
    unitId: UNIT,
    title: '이항분포의 평균·분산',
    make(rng) {
      const p = rng.pick(PS);
      const n = p.b * rng.int(2, 8);
      const q = p.b - p.a;
      const E = (n * p.a) / p.b;
      const V = reduce(n * p.a * q, p.b * p.b);
      const mode = rng.pick(['V', 'EX2'] as const);
      const head = `확률변수 $X$ 가 이항분포 $\\mathrm{B}\\left(${n},\\ ${pTex(p)}\\right)$ 를 따를 때,`;
      const vStep = {
        title: '분산',
        body: `$$V(X)=np(1-p)=${n}\\times ${pTex(p)}\\times ${qTex(p)}=${fracTex(V.n, V.d)}$$`,
      };
      if (mode === 'V')
        return {
          q: `${head} $V(X)$ 를 구하세요.`,
          choices: null,
          answer: fracAns(V.n, V.d),
          answerType: 'fraction',
          check: `${n}*${pSym(p)}*(1 - ${pSym(p)})`,
          concepts: [MEAN_VAR],
          steps: [
            {
              title: '$n$ 과 $p$ 읽기',
              body: `$n=${n}$, $p=${pTex(p)}$, $1-p=${qTex(p)}$ ${ieyo(q, p.b)}.`,
            },
            vStep,
          ],
          tip: `$1-p$ 를 곱하지 않으면 평균 $np=${E}$ ${iga(E)} 나와요. 분산은 평균에 $1-p$ 를 한 번 더 곱한 값이에요.`,
        };
      const EX2 = reduce(V.n + E * E * V.d, V.d);
      return {
        q: `${head} $E(X^2)$ 을 구하세요.`,
        choices: null,
        answer: fracAns(EX2.n, EX2.d),
        answerType: 'fraction',
        check: `${n}*${pSym(p)}*(1 - ${pSym(p)}) + (${n}*${pSym(p)})**2`,
        concepts: [MEAN_VAR, '$V(X)=E(X^2)-\\{E(X)\\}^2$'],
        steps: [
          { title: '평균', body: `$$E(X)=np=${n}\\times ${pTex(p)}=${E}$$` },
          vStep,
          {
            title: '$E(X^2)$ 로 옮기기',
            body: `$V(X)=E(X^2)-\\{E(X)\\}^2$ 이므로\n$$E(X^2)=V(X)+\\{E(X)\\}^2=${fracTex(V.n, V.d)}+${E}^2=${fracTex(EX2.n, EX2.d)}$$`,
          },
        ],
        tip: '$E(X^2)$ 은 $\\{E(X)\\}^2$ 과 달라요. 분산만큼 더 커요.',
      };
    },
  },
  {
    id: 'prob-binomial-find-np',
    unitId: UNIT,
    title: '평균·분산으로 $n$, $p$ 구하기',
    make(rng) {
      const p = rng.pick(PS);
      const q = p.b - p.a;
      // n = b²j 이면 평균 bja, 분산 ja(b-a) 가 모두 자연수
      const j = rng.int(1, 3);
      const n = p.b * p.b * j;
      const E = p.b * j * p.a;
      const V = j * p.a * q;
      const ask = rng.pick(['n', 'p'] as const);
      const steps = [
        {
          title: '두 식 세우기',
          body: `$np=${E}$, $np(1-p)=${V}$ ${ieyo(V)}.`,
        },
        {
          title: '나누어 $1-p$ 구하기',
          body: `아래 식을 위 식으로 나누면 $1-p=\\frac{${V}}{${E}}${E === p.b ? '' : `=${qTex(p)}`}$ 이므로 $p=${pTex(p)}$ ${ieyo(p.a, p.b)}.`,
        },
      ];
      if (ask === 'p')
        return {
          q: `확률변수 $X$ 가 이항분포 $\\mathrm{B}(n,\\ p)$ 를 따르고 $E(X)=${E}$, $V(X)=${V}$ 일 때, $p$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(p.a, p.b),
          answerType: 'fraction',
          check: `1 - Rational(${V}, ${E})`,
          concepts: [MEAN_VAR, '분산 ÷ 평균 $=1-p$'],
          steps,
          tip: `$1-p$ 와 $p$ 를 헷갈리기 쉬워요. $\\frac{V(X)}{E(X)}$ 는 실패할 확률 $1-p$ 예요.`,
        };
      return {
        q: `확률변수 $X$ 가 이항분포 $\\mathrm{B}(n,\\ p)$ 를 따르고 $E(X)=${E}$, $V(X)=${V}$ 일 때, $n$ 의 값을 구하세요.`,
        choices: null,
        answer: String(n),
        answerType: 'int',
        check: `${E} / (1 - Rational(${V}, ${E}))`,
        concepts: [MEAN_VAR, '분산 ÷ 평균 $=1-p$'],
        steps: [
          ...steps,
          {
            title: '$n$ 구하기',
            body: `$$n\\times ${pTex(p)}=${E}\\text{ 이므로 }n=${n}$$`,
          },
        ],
        tip: `확인: $${n}\\times ${pTex(p)}\\times ${qTex(p)}=${V}$, 분산도 맞아요.`,
      };
    },
  },
  {
    id: 'prob-binomial-linear',
    unitId: UNIT,
    title: '$aX+b$ 의 평균·분산',
    make(rng) {
      const p = rng.pick(PS);
      const n = p.b * rng.int(2, 6);
      const a = rng.pick([2, 3, -2, 4, 5]);
      const b = rng.nonzero(-5, 5);
      const E = (n * p.a) / p.b;
      const V = reduce(n * p.a * (p.b - p.a), p.b * p.b);
      const Y = `${a}X${b < 0 ? b : `+${b}`}`;
      const head = `확률변수 $X$ 가 이항분포 $\\mathrm{B}\\left(${n},\\ ${pTex(p)}\\right)$ 를 따를 때,`;
      if (rng.int(0, 1) === 0) {
        const ans = a * E + b;
        return {
          q: `${head} $E(${Y})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${a}*(${n}*${pSym(p)}) + (${b})`,
          concepts: [MEAN_VAR, LINEAR],
          steps: [
            { title: '평균', body: `$$E(X)=np=${n}\\times ${pTex(p)}=${E}$$` },
            {
              title: '일차식의 평균',
              body: `$$E(${Y})=${a}\\times ${E}${b < 0 ? b : `+${b}`}=${ans}$$`,
            },
          ],
          tip: '평균은 곱하고 더한 그대로 따라가요.',
        };
      }
      const ans = reduce(a * a * V.n, V.d);
      return {
        q: `${head} $V(${Y})$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(ans.n, ans.d),
        answerType: 'fraction',
        check: `(${a})**2*(${n}*${pSym(p)}*(1 - ${pSym(p)}))`,
        concepts: [MEAN_VAR, LINEAR],
        steps: [
          {
            title: '분산',
            body: `$$V(X)=np(1-p)=${n}\\times ${pTex(p)}\\times ${qTex(p)}=${fracTex(V.n, V.d)}$$`,
          },
          {
            title: '일차식의 분산',
            body: `더하거나 뺀 수는 흩어진 정도를 바꾸지 않고, 곱한 수는 제곱으로 들어가요.\n$$V(${Y})=${paren(a)}^2\\times ${fracTex(V.n, V.d)}=${fracTex(ans.n, ans.d)}$$`,
          },
        ],
        tip: '곱한 수를 제곱하지 않거나 더한 수까지 더하는 실수가 많아요. 분산에는 곱한 수의 제곱만 곱해요.',
      };
    },
  },
];
