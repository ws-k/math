import type { Generator } from './types.ts';
import { fracAns, fracTex, ieyo, jo, reduce, ro } from './util.ts';

const UNIT = 'prob-estimation';

// 통계적 추정 기초 4유형: 표본평균의 평균·분산, 표본평균의 확률(표준정규분포표), 모평균의 신뢰구간, 필요한 표본 크기.
// 수능 확통 26번은 "σ/√n 으로 표본평균의 표준편차를 만든 뒤 표준화" 또는 "신뢰구간 식에 넣기" 한 걸음이 핵심이라
// 풀이는 늘 σ(X̄)=σ/√n 을 먼저 따로 적는다 — 여기서 √ 를 빠뜨리는 실수가 가장 흔하다.
// 신뢰도 계수는 교과서·수능 값(95% → 1.96, 99% → 2.58)을 쓰고, 문제에 '단' 조건으로 밝혀 준다.
// 소수 답은 기약분수로 두고 answerTex 로 소수를 보인다(답 칸은 소수 입력도 분수로 읽는다).

/** P(0≤Z≤z), z = h/2. 만분율 정수 */
const TABLE: Record<number, number> = { 1: 1915, 2: 3413, 3: 4332, 4: 4772 };
const zTex = (h: number) => (h % 2 === 0 ? String(h / 2) : `${(h - 1) / 2}.5`);

/** 정수 v 를 10^k 로 나눈 소수 글자: (8185, 4) → 0.8185, (9804, 2) → 98.04 */
function dec(v: number, k: number): string {
  const neg = v < 0;
  const s = String(Math.abs(v)).padStart(k + 1, '0');
  let t = `${s.slice(0, -k)}.${s.slice(-k)}`.replace(/0+$/, '').replace(/\.$/, '');
  if (neg) t = `-${t}`;
  return t;
}

const given = (hs: number[]) =>
  `(표준정규분포표: ${[...new Set(hs)]
    .sort((a, b) => a - b)
    .map((h) => `$P(0\\le Z\\le ${zTex(h)})=${dec(TABLE[h] as number, 4)}$`)
    .join(', ')})`;

const PY_TABLE = `T = {${Object.entries(TABLE)
  .map(([h, v]) => `Rational(${h}, 2): Rational(${v}, 10000)`)
  .join(', ')}}
def F(z):
    return Rational(1, 2) + (T[z] if z > 0 else (0 if z == 0 else -T[-z]))`;

/** '으로/로' — ㄹ 받침(일·칠·팔)과 받침 없음은 '로' */

const MEAN_VAR =
  '$E(\\bar X)=m$, $V(\\bar X)=\\frac{\\sigma^2}{n}$, $\\sigma(\\bar X)=\\frac{\\sigma}{\\sqrt n}$';
const CI =
  '신뢰도 95%: $\\bar x-1.96\\frac{\\sigma}{\\sqrt n}\\le m\\le\\bar x+1.96\\frac{\\sigma}{\\sqrt n}$ (99% 는 2.58)';

/** 신뢰도 → 계수(백분율 정수) */
const Z = { 95: 196, 99: 258 } as const;
const zNote = (c: 95 | 99) =>
  c === 95
    ? '(단, $P(|Z|\\le 1.96)=0.95$ 로 계산하세요.)'
    : '(단, $P(|Z|\\le 2.58)=0.99$ 로 계산하세요.)';

/** 표본 크기 n(제곱수)과 그 제곱근 */
const SQ = [4, 9, 16, 25, 36, 49, 64, 100] as const;

/** 이산 모집단: 세 값 a, a+d, a+2d 와 확률(분자, 공통 분모) */
const PROBS = [
  { w: [1, 2, 1], d: 4 },
  { w: [1, 1, 1], d: 3 },
  { w: [2, 1, 1], d: 4 },
  { w: [1, 1, 2], d: 4 },
  { w: [1, 3, 1], d: 5 },
] as const;

function popTable(vals: number[], w: readonly number[], den: number): string {
  const cells = vals.map((v) => String(v)).join(' & ');
  const ps = w.map((k) => fracTex(k, den)).join(' & ');
  return `$$\\begin{array}{c|ccc|c} X & ${cells} & \\text{합계}\\\\ \\hline P(X=x) & ${ps} & 1 \\end{array}$$`;
}

export const generators: Generator[] = [
  {
    id: 'prob-estimation-mean-var',
    unitId: UNIT,
    title: '표본평균의 평균·분산',
    make(rng) {
      if (rng.int(0, 2) === 0) {
        // 이산 모집단에서 E(X̄)=E(X), V(X̄)=V(X)/n — 수능 26번의 '확률분포표 → 표본평균' 꼴
        const a = rng.int(0, 2);
        const step = rng.int(1, 2);
        const vals = [a, a + step, a + 2 * step];
        const p = rng.pick(PROBS);
        const n = rng.int(2, 6);
        // 정수 분자로 계산: E = Σv·w / den, E(X²) = Σv²·w / den
        const sE = vals.reduce((t, v, i) => t + v * (p.w[i] as number), 0);
        const sE2 = vals.reduce((t, v, i) => t + v * v * (p.w[i] as number), 0);
        const E = reduce(sE, p.d);
        const E2 = reduce(sE2, p.d);
        const V = reduce(sE2 * p.d - sE * sE, p.d * p.d);
        const VX = reduce(V.n, V.d * n);
        const pyVals = vals.map((v, i) => `(${v}, Rational(${p.w[i]}, ${p.d}))`).join(', ');
        return {
          q: `모집단의 확률변수 $X$ 의 확률분포가 아래와 같아요. 이 모집단에서 크기가 ${n} 인 표본을 임의추출할 때, 표본평균 $\\bar X$ 의 분산 $V(\\bar X)$ 를 구하세요.\n${popTable(vals, p.w, p.d)}`,
          choices: null,
          answer: fracAns(VX.n, VX.d),
          answerType: 'fraction',
          check: `vals = [${pyVals}]\nE = sum(v*p for v, p in vals)\nV = sum(v**2*p for v, p in vals) - E**2\nans = V/${n}`,
          concepts: [MEAN_VAR, '$V(X)=E(X^2)-\\{E(X)\\}^2$'],
          steps: [
            {
              title: '모평균',
              body: `$$E(X)=${vals.map((v, i) => `${v}\\times ${fracTex(p.w[i] as number, p.d)}`).join('+')}=${fracTex(E.n, E.d)}$$`,
            },
            {
              title: '모분산',
              body: `$$E(X^2)=${vals.map((v, i) => `${v * v}\\times ${fracTex(p.w[i] as number, p.d)}`).join('+')}=${fracTex(E2.n, E2.d)}$$\n$$V(X)=${fracTex(E2.n, E2.d)}-\\left(${fracTex(E.n, E.d)}\\right)^2=${fracTex(V.n, V.d)}$$`,
            },
            {
              title: '표본평균의 분산',
              body: `$$V(\\bar X)=\\frac{V(X)}{${n}}=${fracTex(VX.n, VX.d)}$$`,
            },
          ],
          tip: '표본평균의 분산은 모분산을 표본 크기로 나눠요. 모평균 $E(X)$ 는 그대로 $E(\\bar X)$ 예요.',
        };
      }
      const mode = rng.pick(['sd', 'var', 'ex2'] as const);
      // E(X̄²) 은 m² 을 더하므로 평균을 작게 둔다(7225 같은 수를 더하는 건 계산 연습이 아니다)
      const m = mode === 'ex2' ? rng.int(3, 15) : 5 * rng.int(2, 20);
      const n = rng.pick(SQ);
      const r = Math.sqrt(n);
      const head = (s: number) =>
        `평균이 ${m}, 표준편차가 ${s} 인 모집단에서 크기가 ${n} 인 표본을 임의추출할 때, 표본평균을 $\\bar X$ 라 해요.`;
      if (mode === 'sd') {
        const k = rng.int(1, 4);
        const s = k * r;
        return {
          q: `${head(s)} $\\sigma(\\bar X)$ 를 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `${s}/sqrt(${n})`,
          concepts: [MEAN_VAR],
          steps: [
            { title: '표본 크기의 제곱근', body: `$\\sqrt{${n}}=${r}$ ${ieyo(r)}.` },
            {
              title: '나누기',
              body: `$$\\sigma(\\bar X)=\\frac{${s}}{\\sqrt{${n}}}=\\frac{${s}}{${r}}=${k}$$`,
            },
          ],
          tip: `$${n}$ ${ro(n)} 바로 나누면 틀려요. 표준편차는 $\\sqrt n$ 으로, 분산은 $n$ 으로 나눠요.`,
        };
      }
      // E(X̄²) 은 σ 를 √n 의 배수로 둬서 V(X̄) 가 자연수 — 분수 더하기에 시선이 뺏기지 않게
      const s = mode === 'ex2' ? rng.int(1, 3) * r : rng.int(2, 12);
      const V = reduce(s * s, n);
      if (mode === 'var')
        return {
          q: `${head(s)} $V(\\bar X)$ 를 구하세요.`,
          choices: null,
          answer: fracAns(V.n, V.d),
          answerType: 'fraction',
          check: `${s}**2/Integer(${n})`,
          concepts: [MEAN_VAR],
          steps: [
            { title: '모분산', body: `$\\sigma^2=${s}^2=${s * s}$ ${ieyo(s * s)}.` },
            { title: '나누기', body: `$$V(\\bar X)=\\frac{${s * s}}{${n}}=${fracTex(V.n, V.d)}$$` },
          ],
          tip: '표본평균의 분산은 모분산(표준편차의 제곱)을 $n$ 으로 나눠요. 표준편차를 그대로 나누지 마세요.',
        };
      const E2 = reduce(V.n + m * m * V.d, V.d);
      return {
        q: `${head(s)} $E(\\bar X^2)$ 을 구하세요.`,
        choices: null,
        answer: fracAns(E2.n, E2.d),
        answerType: 'fraction',
        check: `${s}**2/Integer(${n}) + ${m}**2`,
        concepts: [MEAN_VAR, '$E(\\bar X^2)=V(\\bar X)+\\{E(\\bar X)\\}^2$'],
        steps: [
          { title: '평균', body: `$E(\\bar X)=m=${m}$ ${ieyo(m)}.` },
          { title: '분산', body: `$$V(\\bar X)=\\frac{${s}^2}{${n}}=${fracTex(V.n, V.d)}$$` },
          {
            title: '$E(\\bar X^2)$',
            body: `$$E(\\bar X^2)=V(\\bar X)+\\{E(\\bar X)\\}^2=${fracTex(V.n, V.d)}+${m * m}=${fracTex(E2.n, E2.d)}$$`,
          },
        ],
        tip: '$E(\\bar X^2)$ 은 평균의 제곱보다 분산만큼 커요. $V=E(X^2)-\\{E(X)\\}^2$ 을 거꾸로 써요.',
      };
    },
  },
  {
    id: 'prob-estimation-prob',
    unitId: UNIT,
    title: '표본평균의 확률',
    make(rng) {
      const m = 10 * rng.int(3, 20);
      const n = rng.pick([4, 9, 16, 25, 36, 64, 100]);
      const r = Math.sqrt(n);
      const sx = rng.int(1, 4) * 2; // σ(X̄) — 짝수면 z=0.5 단위도 정수
      const s = sx * r;
      const h = rng.int(1, 4);
      const d = (h * sx) / 2;
      const mode = rng.pick(['ge', 'le', 'le-neg', 'between'] as const);
      const T = TABLE[h] as number;
      const sdStep = {
        title: '$\\bar X$ 의 분포',
        body: `$\\sigma(\\bar X)=\\frac{${s}}{\\sqrt{${n}}}=${sx}$ 이라서 $\\bar X$ 는 $\\mathrm{N}\\left(${m},\\ ${sx}^2\\right)$ 을 따라요.`,
      };
      const head = `정규분포 $\\mathrm{N}\\left(${m},\\ ${s}^2\\right)$ 을 따르는 모집단에서 크기가 ${n} 인 표본을 임의추출할 때, 표본평균 $\\bar X$ 에 대하여`;
      const concepts = [
        '모집단이 $\\mathrm{N}(m,\\ \\sigma^2)$ 이면 $\\bar X$ 는 $\\mathrm{N}\\left(m,\\ \\frac{\\sigma^2}{n}\\right)$',
        '$Z=\\frac{\\bar X-m}{\\sigma/\\sqrt n}$',
      ];
      if (mode === 'between') {
        const h2 = rng.int(1, 4);
        const T2 = TABLE[h2] as number;
        const a = m - d;
        const b = m + (h2 * sx) / 2;
        const v = T + T2;
        return {
          q: `${head} $P(${a}\\le\\bar X\\le ${b})$ 를 구하세요. ${given([h, h2])}`,
          choices: null,
          answer: fracAns(v, 10000),
          answerTex: `$${dec(v, 4)}$`,
          answerType: 'fraction',
          check: `${PY_TABLE}\nsx = ${s}/sqrt(${n})\nans = F((${b} - ${m})/sx) - F((${a} - ${m})/sx)`,
          concepts,
          steps: [
            sdStep,
            {
              title: '표준화',
              body: `$$\\frac{${a}-${m}}{${sx}}=-${zTex(h)},\\quad \\frac{${b}-${m}}{${sx}}=${zTex(h2)}$$`,
            },
            {
              title: '넓이 더하기',
              body: `$$P(-${zTex(h)}\\le Z\\le ${zTex(h2)})=${dec(T, 4)}+${dec(T2, 4)}=${dec(v, 4)}$$`,
            },
          ],
          tip: '평균을 사이에 둔 구간이라 두 넓이를 더해요.',
        };
      }
      const x = mode === 'le-neg' ? m - d : m + d;
      const v = mode === 'le' ? 5000 + T : 5000 - T;
      const zt = `${mode === 'le-neg' ? '-' : ''}${zTex(h)}`;
      const ask = mode === 'ge' ? `P(\\bar X\\ge ${x})` : `P(\\bar X\\le ${x})`;
      const zAsk = mode === 'ge' ? `P(Z\\ge ${zt})` : `P(Z\\le ${zt})`;
      const last =
        mode === 'le'
          ? `$$${zAsk}=0.5+${dec(T, 4)}=${dec(v, 4)}$$`
          : `$$${zAsk}=0.5-${dec(T, 4)}=${dec(v, 4)}$$`;
      return {
        q: `${head} $${ask}$ 를 구하세요. ${given([h])}`,
        choices: null,
        answer: fracAns(v, 10000),
        answerTex: `$${dec(v, 4)}$`,
        answerType: 'fraction',
        check: `${PY_TABLE}\nsx = ${s}/sqrt(${n})\nans = ${mode === 'ge' ? '1 - ' : ''}F((${x} - ${m})/sx)`,
        concepts,
        steps: [
          sdStep,
          { title: '표준화', body: `$$\\frac{${x}-${m}}{${sx}}=${zt}$$` },
          { title: '넓이 구하기', body: last },
        ],
        tip: `모표준편차 ${s} ${ro(s)} 표준화하면 틀려요. 표본평균은 $\\frac{\\sigma}{\\sqrt n}=${sx}$ ${ro(sx)} 나눠요.`,
      };
    },
  },
  {
    id: 'prob-estimation-interval',
    unitId: UNIT,
    title: '모평균의 신뢰구간',
    make(rng) {
      const c = rng.pick([95, 99] as const);
      const z = Z[c];
      for (;;) {
        const n = rng.pick([16, 25, 36, 49, 64, 100, 144] as const);
        const r = Math.sqrt(n);
        // σ/√n = u/2 (u=1..6) — 반폭이 소수 둘째 자리에서 끝나게
        const u = rng.int(1, 6);
        if ((u * r) % 2 !== 0) continue;
        const s = (u * r) / 2;
        const xb = rng.int(20, 200);
        const half = (z * u) / 2; // 반폭 × 100
        const mode = rng.pick(['lo', 'hi', 'len', 'sigma'] as const);
        const sxT = fracTex(u, 2);
        const halfStep = {
          title: '반폭',
          body: `$$${dec(z, 2)}\\times\\frac{${s}}{\\sqrt{${n}}}=${dec(z, 2)}\\times ${u % 2 === 0 ? u / 2 : sxT}=${dec(half, 2)}$$`,
        };
        const zPy = `Rational(${z}, 100)`;
        if (mode === 'sigma') {
          const lo = xb * 100 - half;
          const hi = xb * 100 + half;
          return {
            q: `모표준편차가 $\\sigma$ 인 정규분포를 따르는 모집단에서 크기가 ${n} 인 표본을 임의추출해 얻은 표본평균으로 모평균 $m$ 을 추정했더니, 신뢰도 ${c}% 의 신뢰구간이 $${dec(lo, 2)}\\le m\\le ${dec(hi, 2)}$ ${jo(dec(hi, 2), '이었어요/였어요')}. $\\sigma$ 의 값을 구하세요. ${zNote(c)}`,
            choices: null,
            answer: String(s),
            answerType: 'int',
            check: `solve(Eq(2*${zPy}*s/sqrt(${n}), Rational(${hi} - ${lo}, 100)), s)[0]`,
            concepts: [CI],
            steps: [
              { title: '구간 길이', body: `$$${dec(hi, 2)}-${dec(lo, 2)}=${dec(2 * half, 2)}$$` },
              {
                title: '식 세우기',
                body: `길이는 $2\\times${dec(z, 2)}\\times\\frac{\\sigma}{\\sqrt{${n}}}$ 이에요.\n$$2\\times${dec(z, 2)}\\times\\frac{\\sigma}{${r}}=${dec(2 * half, 2)}$$`,
              },
              {
                title: '풀기',
                body: `$\\frac{\\sigma}{${r}}=${u % 2 === 0 ? u / 2 : sxT}$ 이므로 $\\sigma=${s}$ ${ieyo(s)}.`,
              },
            ],
            tip: '구간의 가운데가 표본평균, 길이의 절반이 반폭이에요. 길이를 반폭으로 착각하면 $\\sigma$ 가 2배로 나와요.',
          };
        }
        const v = mode === 'lo' ? xb * 100 - half : mode === 'hi' ? xb * 100 + half : 2 * half;
        const what = mode === 'lo' ? '$a$' : mode === 'hi' ? '$b$' : '$b-a$';
        const last =
          mode === 'lo'
            ? { title: '아래 끝', body: `$$a=${xb}-${dec(half, 2)}=${dec(v, 2)}$$` }
            : mode === 'hi'
              ? { title: '위 끝', body: `$$b=${xb}+${dec(half, 2)}=${dec(v, 2)}$$` }
              : { title: '길이', body: `$$b-a=2\\times${dec(half, 2)}=${dec(v, 2)}$$` };
        return {
          q: `모표준편차가 ${s} 인 정규분포를 따르는 모집단에서 크기가 ${n} 인 표본을 임의추출했더니 표본평균이 ${xb} ${jo(String(xb), '이었어요/였어요')}. 이 결과로 모평균 $m$ 에 대한 신뢰도 ${c}% 의 신뢰구간 $a\\le m\\le b$ 를 구할 때, ${what} 의 값을 구하세요. ${zNote(c)}`,
          choices: null,
          answer: fracAns(v, 100),
          answerTex: `$${dec(v, 2)}$`,
          answerType: 'fraction',
          check:
            mode === 'lo'
              ? `${xb} - ${zPy}*${s}/sqrt(${n})`
              : mode === 'hi'
                ? `${xb} + ${zPy}*${s}/sqrt(${n})`
                : `2*${zPy}*${s}/sqrt(${n})`,
          concepts: [CI],
          steps: [halfStep, last],
          tip:
            mode === 'len'
              ? '길이는 표본평균과 상관없이 $2\\times(\\text{계수})\\times\\frac{\\sigma}{\\sqrt n}$ 이에요.'
              : `$\\frac{\\sigma}{n}$ 으로 나누면 틀려요. 표본평균의 표준편차는 $\\frac{\\sigma}{\\sqrt n}$ 이에요.`,
        };
      }
    },
  },
  {
    id: 'prob-estimation-sample-size',
    unitId: UNIT,
    title: '필요한 표본 크기',
    make(rng) {
      const c = rng.pick([95, 99] as const);
      const z = Z[c];
      for (;;) {
        const s = rng.int(2, 20);
        const k = rng.int(3, 12);
        // 길이 L = 2zσ/k 가 소수 둘째 자리에서 끝나야 문제에 적을 수 있다
        if ((2 * z * s) % k !== 0) continue;
        const L = (2 * z * s) / k; // × 100
        if (L < 50 || L > 2000) continue;
        return {
          q: `모표준편차가 ${s} 인 정규분포를 따르는 모집단에서 크기가 $n$ 인 표본을 임의추출해 모평균에 대한 신뢰도 ${c}% 의 신뢰구간을 구하려고 해요. 신뢰구간의 길이가 ${dec(L, 2)} 이하가 되게 하는 $n$ 의 최솟값을 구하세요. ${zNote(c)}`,
          choices: null,
          answer: String(k * k),
          answerType: 'int',
          check: `ceiling(solve(Eq(2*Rational(${z}, 100)*${s}/sqrt(n), Rational(${L}, 100)), n)[0])`,
          concepts: [
            CI,
            '신뢰구간의 길이 $=2\\times(\\text{계수})\\times\\frac{\\sigma}{\\sqrt n}$',
          ],
          steps: [
            {
              title: '부등식 세우기',
              body: `$$2\\times${dec(z, 2)}\\times\\frac{${s}}{\\sqrt n}\\le ${dec(L, 2)}$$`,
            },
            {
              title: '$\\sqrt n$ 구하기',
              body: `$$\\sqrt n\\ge\\frac{2\\times${dec(z, 2)}\\times${s}}{${dec(L, 2)}}=${k}$$`,
            },
            {
              title: '제곱하기',
              body: `$n\\ge ${k * k}$ 이므로 최솟값은 ${k * k} ${ieyo(k * k)}.`,
            },
          ],
          tip: '마지막에 $\\sqrt n$ 을 제곱하는 걸 잊지 마세요. 구간을 좁히려면 표본이 제곱으로 늘어나요.',
        };
      }
    },
  },
];
