import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { eun, fracAns, fracTex, ieyo, reduce } from './util.ts';

const UNIT = 'prob-normal';

// 정규분포 기초 4유형: 표준화(Z 값), 표준정규분포표로 확률 구하기, 이항분포의 정규 근사, 확률밀도함수(넓이 1).
// 수능 확통 29번은 "표준화 → 표의 넓이 → 대칭으로 더하고 빼기"가 거의 전부라서, 풀이를 늘 그 세 걸음으로 쓴다.
// 표의 값은 교과서·수능이 쓰는 네 자리 값이고, 문제마다 쓰는 값만 '단' 조건으로 준다(표 전체를 외우게 하지 않으려고).
// 확률은 소수 넷째 자리로 끝나므로 정답은 기약분수(1637/2000)로 두고 화면에는 answerTex 로 0.8185 를 보인다 —
// 답 칸은 소수 입력도 분수로 읽어 비교한다(answer.ts).

/** P(0≤Z≤z), z = h/2 (h=1..6). 만분율 정수로 둬서 계산을 정확한 정수로 한다 */
const TABLE: Record<number, number> = { 1: 1915, 2: 3413, 3: 4332, 4: 4772, 5: 4938, 6: 4987 };

/** z = h/2 를 글자로: 1.5, 2, 0.5 */
const zTex = (h: number) => (h % 2 === 0 ? String(h / 2) : `${(h - (h % 2)) / 2}.5`);
/** 만분율 정수 → 0.8185 */
const decTex = (v: number) => {
  const s = String(Math.abs(v)).padStart(5, '0');
  const t = `${s.slice(0, -4)}.${s.slice(-4)}`.replace(/0+$/, '').replace(/\.$/, '');
  return (v < 0 ? '-' : '') + t;
};
/** 만분율 정수 → 기약분수 정답 */
const decAns = (v: number) => fracAns(v, 10000);
/** 표 값을 '단' 조건 한 줄로 */
const given = (hs: number[]) =>
  `(표준정규분포표: ${[...new Set(hs)]
    .sort((a, b) => a - b)
    .map((h) => `$P(0\\le Z\\le ${zTex(h)})=${decTex(TABLE[h] as number)}$`)
    .join(', ')})`;

// 검산식: 표와 누적확률 F(z)=P(Z≤z) 를 정의해 두고, 문제의 숫자로 표준화해서 계산한다.
// z 값을 생성기가 계산해 넣으면 표준화 실수를 검산이 못 잡으므로 (x-m)/σ 를 sympy 가 직접 계산하게 둔다.
const PY_TABLE = `T = {${Object.entries(TABLE)
  .map(([h, v]) => `Rational(${h}, 2): Rational(${v}, 10000)`)
  .join(', ')}}
def F(z):
    return Rational(1, 2) + (T[z] if z > 0 else (0 if z == 0 else -T[-z]))`;

const STD =
  '$Z=\\frac{X-m}{\\sigma}$ 로 바꾸면 $Z$ 는 표준정규분포 $\\mathrm{N}(0,\\ 1)$ 을 따라요.';
const SYM = '표준정규분포 곡선은 $z=0$ 을 기준으로 좌우 대칭이고, 한쪽 넓이가 $0.5$ 예요.';

/** N(m, σ²) 표기. 분산을 숫자로(N(50, 16)) 적는 꼴도 섞어 '둘째 자리는 분산'을 연습시킨다 */
function nTex(m: number, s: number, asVar: boolean): string {
  return `\\mathrm{N}\\left(${m},\\ ${asVar ? s * s : `${s}^2`}\\right)`;
}

/** 표준화 한 줄: Z=(x-m)/σ=z */
function stdLine(x: number, m: number, s: number, h: number, sign: 1 | -1): string {
  return `$X=${x}$ ${eun(x)} $Z=\\frac{${x}-${m}}{${s}}=${sign < 0 ? '-' : ''}${zTex(h)}$`;
}

const SIGMAS = [2, 4, 5, 6, 8, 10, 12] as const;

/** 평균 m 과 표준편차 σ — σ 가 짝수면 z=0.5 단위도 x 가 정수로 떨어진다 */
function pickMS(rng: Rng): { m: number; s: number } {
  return { m: 5 * rng.int(4, 16), s: rng.pick(SIGMAS) };
}

/** σ 가 홀수면 z 는 정수만(x 가 정수가 되게) */
const pickH = (rng: Rng, s: number, lo = 1, hi = 5) => {
  for (;;) {
    const h = rng.int(lo, hi);
    if ((h * s) % 2 === 0) return h;
  }
};

export const generators: Generator[] = [
  {
    id: 'prob-normal-standardize',
    unitId: UNIT,
    title: '표준화: $Z=\\frac{X-m}{\\sigma}$',
    make(rng) {
      const { m, s } = pickMS(rng);
      const h = pickH(rng, s);
      const sign = rng.pick([1, -1] as const);
      const x = m + (sign * h * s) / 2;
      const asVar = rng.int(0, 1) === 1;
      // 'ge-le' 는 P(X≥x)=P(Z≤k) — 대칭으로 부호가 바뀌는 꼴
      const mode = rng.pick(['le', 'ge', 'ge-le'] as const);
      const k = mode === 'ge-le' ? -sign : sign;
      const lhs = mode === 'le' ? `P(X\\le ${x})` : `P(X\\ge ${x})`;
      const rhs = mode === 'ge' ? 'P(Z\\ge k)' : 'P(Z\\le k)';
      const kTex = `${k < 0 ? '-' : ''}${zTex(h)}`;
      const steps = [
        {
          title: '평균과 표준편차 읽기',
          body: asVar
            ? `$${nTex(m, s, true)}$ 의 둘째 자리는 분산이에요. 표준편차는 $\\sigma=\\sqrt{${s * s}}=${s}$ ${ieyo(s)}.`
            : `평균 $m=${m}$, 표준편차 $\\sigma=${s}$ ${ieyo(s)}.`,
        },
        { title: '표준화', body: `${stdLine(x, m, s, h, sign)} 로 바뀌어요.` },
      ];
      if (mode === 'ge-le')
        steps.push({
          title: '대칭으로 뒤집기',
          body: `곡선이 $z=0$ 을 기준으로 대칭이라 $P(Z\\ge ${sign < 0 ? '-' : ''}${zTex(h)})$ 와 $P(Z\\le ${kTex})$ 는 넓이가 같아요. 그래서 $k=${kTex}$ ${ieyo(zTex(h))}.`,
        });
      return {
        q: `확률변수 $X$ 가 정규분포 $${nTex(m, s, asVar)}$ 을 따를 때, $${lhs}=${rhs}$ 를 만족시키는 상수 $k$ 의 값을 구하세요. (단, $Z$ 는 표준정규분포를 따르는 확률변수예요.)`,
        choices: null,
        answer: fracAns(k * h, 2),
        answerTex: `$${kTex}$`,
        answerType: 'fraction',
        check: `${mode === 'ge-le' ? '-' : ''}(${x} - ${m})/sqrt(${s * s})`,
        concepts: [STD, ...(mode === 'ge-le' ? [SYM] : [])],
        steps,
        tip: asVar
          ? '분산으로 나누면 틀려요. 표준화는 늘 표준편차로 나눠요.'
          : '평균을 빼고 표준편차로 나눠요. 빼기만 하거나 나누기만 하면 다른 값이 나와요.',
      };
    },
  },
  {
    id: 'prob-normal-table',
    unitId: UNIT,
    title: '표준정규분포표로 확률 구하기',
    make(rng) {
      const { m, s } = pickMS(rng);
      const asVar = rng.int(0, 1) === 1;
      const mode = rng.pick(['ge', 'le', 'le-neg', 'between', 'same-side'] as const);
      const head = `확률변수 $X$ 가 정규분포 $${nTex(m, s, asVar)}$ 을 따를 때,`;
      const sTitle = {
        title: '평균과 표준편차',
        body: asVar
          ? `$m=${m}$, $\\sigma=\\sqrt{${s * s}}=${s}$ ${ieyo(s)}.`
          : `$m=${m}$, $\\sigma=${s}$ ${ieyo(s)}.`,
      };
      const concepts = [STD, SYM];
      if (mode === 'between' || mode === 'same-side') {
        let h1: number;
        let h2: number;
        for (;;) {
          h1 = pickH(rng, s);
          h2 = pickH(rng, s);
          if (mode === 'between' || h1 !== h2) break;
        }
        if (mode === 'same-side' && h1 > h2) [h1, h2] = [h2, h1];
        const T1 = TABLE[h1] as number;
        const T2 = TABLE[h2] as number;
        const a = mode === 'between' ? m - (h1 * s) / 2 : m + (h1 * s) / 2;
        const b = m + (h2 * s) / 2;
        const v = mode === 'between' ? T1 + T2 : T2 - T1;
        const z1 = `${mode === 'between' ? '-' : ''}${zTex(h1)}`;
        const z2 = zTex(h2);
        const area =
          mode === 'between'
            ? `$z=0$ 을 사이에 두고 양쪽 넓이를 더해요.\n$$P(${z1}\\le Z\\le ${z2})=P(0\\le Z\\le ${zTex(h1)})+P(0\\le Z\\le ${z2})=${decTex(T1)}+${decTex(T2)}=${decTex(v)}$$`
            : `둘 다 평균보다 오른쪽이라 큰 넓이에서 작은 넓이를 빼요.\n$$P(${z1}\\le Z\\le ${z2})=${decTex(T2)}-${decTex(T1)}=${decTex(v)}$$`;
        return {
          q: `${head} $P(${a}\\le X\\le ${b})$ 를 구하세요. ${given([h1, h2])}`,
          choices: null,
          answer: decAns(v),
          answerTex: `$${decTex(v)}$`,
          answerType: 'fraction',
          check: `${PY_TABLE}\nans = F(Rational(${b} - ${m}, ${s})) - F(Rational(${a} - ${m}, ${s}))`,
          concepts,
          steps: [
            sTitle,
            {
              title: '표준화',
              body: `${stdLine(a, m, s, h1, mode === 'between' ? -1 : 1)}, ${stdLine(b, m, s, h2, 1)} 로 바뀌어요.`,
            },
            { title: '넓이 구하기', body: area },
          ],
          tip:
            mode === 'between'
              ? '평균을 사이에 두면 더하고, 같은 쪽에 있으면 빼요. 그림을 그리면 헷갈리지 않아요.'
              : '같은 쪽 두 구간이면 더하지 않고 빼요. 두 값을 더하면 1 에 가까운 이상한 값이 나와요.',
        };
      }
      const h = pickH(rng, s);
      const T = TABLE[h] as number;
      const x = mode === 'le-neg' ? m - (h * s) / 2 : m + (h * s) / 2;
      const sign = mode === 'le-neg' ? -1 : 1;
      const v = mode === 'le' ? 5000 + T : 5000 - T;
      const zt = `${sign < 0 ? '-' : ''}${zTex(h)}`;
      const ask = mode === 'ge' ? `P(X\\ge ${x})` : `P(X\\le ${x})`;
      const zAsk = mode === 'ge' ? `P(Z\\ge ${zt})` : `P(Z\\le ${zt})`;
      const area =
        mode === 'le'
          ? `왼쪽 절반 $0.5$ 에 $0$ 부터 $${zt}$ 까지를 더해요.\n$$${zAsk}=0.5+${decTex(T)}=${decTex(v)}$$`
          : mode === 'ge'
            ? `오른쪽 절반 $0.5$ 에서 $0$ 부터 $${zt}$ 까지를 빼요.\n$$${zAsk}=0.5-${decTex(T)}=${decTex(v)}$$`
            : `대칭이라 $${zAsk}=P(Z\\ge ${zTex(h)})$ 이고, 오른쪽 절반에서 빼요.\n$$0.5-${decTex(T)}=${decTex(v)}$$`;
      return {
        q: `${head} $${ask}$ 를 구하세요. ${given([h])}`,
        choices: null,
        answer: decAns(v),
        answerTex: `$${decTex(v)}$`,
        answerType: 'fraction',
        check: `${PY_TABLE}\nans = ${mode === 'ge' ? '1 - ' : ''}F(Rational(${x} - ${m}, ${s}))`,
        concepts,
        steps: [
          sTitle,
          { title: '표준화', body: `${stdLine(x, m, s, h, sign)} 로 바뀌어요.` },
          { title: '넓이 구하기', body: area },
        ],
        tip: `표의 값 $${decTex(T)}$ ${eun(decTex(T))} $0$ 부터 $${zTex(h)}$ 까지의 넓이예요. 구하는 넓이가 그보다 큰지 작은지 그림으로 먼저 어림해요.`,
      };
    },
  },
  {
    id: 'prob-normal-binomial-approx',
    unitId: UNIT,
    title: '이항분포를 정규분포로 어림하기',
    make(rng) {
      // np(1-p) 가 제곱수가 되는 (n, p) 만 — 표준편차가 자연수여야 표준화가 손으로 된다
      const CASES = [
        { n: 100, a: 1, b: 2, s: 5, ctx: 'coin' },
        { n: 144, a: 1, b: 2, s: 6, ctx: 'coin' },
        { n: 256, a: 1, b: 2, s: 8, ctx: 'coin' },
        { n: 400, a: 1, b: 2, s: 10, ctx: 'coin' },
        { n: 180, a: 1, b: 6, s: 5, ctx: 'six' },
        { n: 720, a: 1, b: 6, s: 10, ctx: 'six' },
        { n: 72, a: 1, b: 3, s: 4, ctx: 'three' },
        { n: 162, a: 1, b: 3, s: 6, ctx: 'three' },
        { n: 100, a: 1, b: 5, s: 4, ctx: 'shot' },
        { n: 225, a: 1, b: 5, s: 6, ctx: 'shot' },
        { n: 400, a: 1, b: 5, s: 8, ctx: 'shot' },
        { n: 48, a: 1, b: 4, s: 3, ctx: 'quiz' },
        { n: 192, a: 1, b: 4, s: 6, ctx: 'quiz' },
      ] as const;
      const c = rng.pick(CASES);
      const mean = (c.n * c.a) / c.b;
      const what = {
        coin: `동전 한 개를 ${c.n}번 던질 때 앞면이 나오는 횟수`,
        six: `주사위 한 개를 ${c.n}번 던질 때 1의 눈이 나오는 횟수`,
        three: `주사위 한 개를 ${c.n}번 던질 때 3의 배수의 눈이 나오는 횟수`,
        shot: `한 번 던져 넣을 확률이 $\\frac{1}{5}$ 인 공 던지기를 ${c.n}번 할 때 넣은 횟수`,
        quiz: `보기 4개 중 정답이 하나인 문제 ${c.n}개를 모두 임의로 골라 답할 때 맞힌 문제 수`,
      }[c.ctx];
      const pT = fracTex(c.a, c.b);
      const qT = fracTex(c.b - c.a, c.b);
      const meanStep = {
        title: '평균',
        body: `$X$ 는 이항분포 $\\mathrm{B}\\left(${c.n},\\ ${pT}\\right)$ 를 따라요.\n$$E(X)=${c.n}\\times ${pT}=${mean}$$`,
      };
      const sdStep = {
        title: '표준편차',
        body: `$$V(X)=${c.n}\\times ${pT}\\times ${qT}=${c.s * c.s},\\quad \\sigma(X)=${c.s}$$`,
      };
      const pSym = `Rational(${c.a}, ${c.b})`;
      const mode = rng.pick(['sd', 'prob', 'prob'] as const);
      if (mode === 'sd')
        return {
          q: `${what}를 확률변수 $X$ 라 할 때, $X$ 는 근사적으로 정규분포 $\\mathrm{N}(m,\\ \\sigma^2)$ 을 따라요. $m+\\sigma$ 의 값을 구하세요. (단, $\\sigma>0$)`,
          choices: null,
          answer: String(mean + c.s),
          answerType: 'int',
          check: `${c.n}*${pSym} + sqrt(${c.n}*${pSym}*(1 - ${pSym}))`,
          concepts: [
            '$n$ 이 충분히 크면 $\\mathrm{B}(n,\\ p)$ 는 근사적으로 $\\mathrm{N}(np,\\ np(1-p))$ 를 따라요.',
          ],
          steps: [
            meanStep,
            sdStep,
            {
              title: '더하기',
              body: `$m+\\sigma=${mean}+${c.s}=${mean + c.s}$ ${ieyo(mean + c.s)}.`,
            },
          ],
          tip: '분산을 $\\sigma$ 자리에 넣지 마세요. $\\mathrm{N}(m,\\ \\sigma^2)$ 의 둘째 자리는 분산이에요.',
        };
      // σ 가 홀수면 z=1.5 는 x 가 정수가 아니라서 정수 z 만
      const h = c.s % 2 === 0 ? rng.pick([2, 3, 4]) : rng.pick([2, 4]);
      const up = rng.int(0, 1) === 1;
      const x = mean + (h * c.s) / 2;
      const T = TABLE[h] as number;
      const v = up ? 5000 - T : 5000 + T;
      return {
        q: `${what}를 확률변수 $X$ 라 할 때, $P(X${up ? '\\ge' : '\\le'} ${x})$ 의 값을 정규분포를 이용해 어림하세요. ${given([h])}`,
        choices: null,
        answer: decAns(v),
        answerTex: `$${decTex(v)}$`,
        answerType: 'fraction',
        check: `${PY_TABLE}\nm = ${c.n}*${pSym}\ns = sqrt(${c.n}*${pSym}*(1 - ${pSym}))\nans = ${up ? '1 - ' : ''}F((${x} - m)/s)`,
        concepts: [
          '$n$ 이 충분히 크면 $\\mathrm{B}(n,\\ p)$ 는 근사적으로 $\\mathrm{N}(np,\\ np(1-p))$ 를 따라요.',
          STD,
        ],
        steps: [
          meanStep,
          sdStep,
          {
            title: '표준화',
            body: `근사적으로 $\\mathrm{N}\\left(${mean},\\ ${c.s}^2\\right)$ 이라서 ${stdLine(x, mean, c.s, h, 1)} 로 바뀌어요.`,
          },
          {
            title: '넓이 구하기',
            body: up
              ? `$$P(Z\\ge ${zTex(h)})=0.5-${decTex(T)}=${decTex(v)}$$`
              : `$$P(Z\\le ${zTex(h)})=0.5+${decTex(T)}=${decTex(v)}$$`,
          },
        ],
        tip: '이항분포의 평균 $np$, 표준편차 $\\sqrt{np(1-p)}$ 를 그대로 정규분포의 $m$, $\\sigma$ 로 써요.',
      };
    },
  },
  {
    id: 'prob-normal-density',
    unitId: UNIT,
    title: '확률밀도함수: 넓이는 1',
    make(rng) {
      const a = rng.int(2, 6);
      const k = reduce(2, a * a);
      const kT = fracTex(2, a * a);
      const area = {
        title: '전체 넓이는 1',
        body: `그래프와 $x$축 사이는 밑변 ${a}, 높이 $f(${a})=${a}k$ 인 삼각형이에요.\n$$\\frac{1}{2}\\times ${a}\\times ${a}k=${fracTex(a * a, 2)}k=1$$\n그래서 $k=${kT}$ ${ieyo(k.n, k.d)}.`,
      };
      const head = `연속확률변수 $X$ 가 갖는 값의 범위는 $0\\le X\\le ${a}$ 이고, 확률밀도함수가 $f(x)=kx$ 예요.`;
      const concepts = [
        '확률밀도함수의 그래프와 $x$축 사이의 넓이는 $1$ 이에요.',
        '$P(\\alpha\\le X\\le\\beta)$ 는 $x=\\alpha$ 부터 $x=\\beta$ 까지 그래프 아래 넓이예요.',
      ];
      if (rng.int(0, 2) === 0)
        return {
          q: `${head} 상수 $k$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(2, a * a),
          answerType: 'fraction',
          check: `solve(Eq(integrate(k*x, (x, 0, ${a})), 1), k)[0]`,
          concepts,
          steps: [area],
          tip: '높이 $f(x)$ 가 확률이 아니에요. 넓이가 확률이라서 전체 넓이를 1 로 맞춰요.',
        };
      const b = rng.int(1, a - 1);
      const right = rng.int(0, 1) === 1;
      const small = reduce(b * b, a * a);
      const ans = right ? reduce(a * a - b * b, a * a) : small;
      const smallT = fracTex(b * b, a * a);
      return {
        q: `${head} $P(${right ? `${b}\\le X\\le ${a}` : `0\\le X\\le ${b}`})$ 를 구하세요.`,
        choices: null,
        answer: fracAns(ans.n, ans.d),
        answerType: 'fraction',
        check: `kk = solve(Eq(integrate(k*x, (x, 0, ${a})), 1), k)[0]\nans = integrate(kk*x, (x, ${right ? b : 0}, ${right ? a : b}))`,
        concepts,
        steps: [
          area,
          {
            title: `$0$ 부터 ${b} 까지의 넓이`,
            body: `밑변 ${b}, 높이 $f(${b})=${fracTex(2 * b, a * a)}$ 인 삼각형이에요.\n$$\\frac{1}{2}\\times ${b}\\times ${fracTex(2 * b, a * a)}=${smallT}$$`,
          },
          ...(right
            ? [
                {
                  title: '나머지 넓이',
                  body: `전체 넓이 1 에서 빼요.\n$$1-${smallT}=${fracTex(ans.n, ans.d)}$$`,
                },
              ]
            : []),
        ],
        tip: right
          ? '오른쪽 사다리꼴 넓이를 바로 구해도 되지만, 전체 1 에서 왼쪽 삼각형을 빼는 쪽이 빨라요.'
          : `넓이는 $\\left(\\frac{${b}}{${a}}\\right)^2$ 로, 가로 비율의 제곱이에요. 비율 $\\frac{${b}}{${a}}$ 를 그대로 답하면 틀려요.`,
      };
    },
  },
];
