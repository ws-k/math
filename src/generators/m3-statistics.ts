import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, paren } from './util.ts';

const UNIT = 'm3-statistics';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const list = (xs: number[]) => xs.map((x) => `$${x}$`).join(', ');
// 검산식에서 평균·분산을 sympy 가 유리수로 다시 계산하게 한다 — 파이썬 / 는 실수가 되므로 Rational 로 나눈다
const varCheck = (xs: number[]) =>
  `v = [${xs.join(', ')}]\nm = Rational(sum(v), len(v))\nans = sum((t - m)**2 for t in v)*Rational(1, len(v))`;

function median(rng: Rng): GenProblem {
  const n = rng.int(5, 8);
  const xs = Array.from({ length: n }, () => rng.int(1, 30));
  const v = [...xs].sort((a, b) => a - b);
  const a = (n - 1) >> 1;
  const b = n >> 1;
  const odd = a === b;
  const mid = (v[a] as number) + (v[b] as number);
  const ans = fracAns(mid, 2);
  return {
    q: `${n}명이 한 달 동안 도서관에 간 횟수가 ${list(xs)} 예요. 중앙값을 구하세요.`,
    choices: null,
    answer: ans,
    answerTex: `$${fracTex(mid, 2)}$`,
    answerType: 'fraction',
    check: `v = sorted([${xs.join(', ')}])\nans = Rational(v[${a}] + v[${b}], 2)`,
    concepts: [
      '중앙값은 자료를 크기 순서로 늘어놓았을 때 한가운데 값이에요.',
      '자료가 짝수 개면 가운데 두 값의 평균이에요.',
    ],
    steps: [
      { title: '크기 순서로', body: `$$${v.join(',\\ ')}$$` },
      odd
        ? { title: '가운데 값', body: `${n}개 중 ${a + 1}번째 값 $${v[a]}$ 이에요.` }
        : {
            title: '가운데 두 값의 평균',
            body: `$$\\frac{${v[a]}+${v[b]}}{2}=${fracTex(mid, 2)}$$`,
          },
    ],
    tip: '순서대로 늘어놓기 전의 가운데 값을 고르면 틀려요. 먼저 정렬해요.',
  };
}

function missingDeviation(rng: Rng): GenProblem {
  for (;;) {
    const n = rng.int(4, 6);
    const ds = Array.from({ length: n - 1 }, () => rng.nonzero(-6, 6));
    const x = -sum(ds);
    if (x === 0 || Math.abs(x) > 8) continue;
    const shown = ds.map((d) => `$${d}$`).join(', ');
    return {
      q: `어떤 자료의 변량 ${n}개의 편차가 ${shown}, $x$ 예요. $x$ 의 값을 구하세요.`,
      choices: null,
      answer: String(x),
      answerTex: `$${x}$`,
      answerType: 'int',
      check: `-(${ds.join(' + ')})`,
      concepts: ['편차 = 변량 − 평균', '편차를 모두 더하면 늘 $0$ 이에요.'],
      steps: [
        { title: '아는 편차의 합', body: `$$${ds.map((d) => paren(d)).join('+')}=${sum(ds)}$$` },
        { title: '합이 0 이 되게', body: `$$${sum(ds)}+x=0\\text{ 이므로 }x=${x}$$` },
      ],
      tip: '평균보다 큰 쪽과 작은 쪽의 편차가 서로 지워져서 합이 0 이 돼요.',
    };
  }
}

/** 합이 0 인 편차들(크기 lim 이내) */
function deviations(rng: Rng, n: number, lim: number): number[] {
  for (;;) {
    const ds = Array.from({ length: n - 1 }, () => rng.int(-lim, lim));
    const last = -sum(ds);
    if (Math.abs(last) <= lim && ds.some((d) => d !== 0)) return [...ds, last];
  }
}

function variance(rng: Rng): GenProblem {
  const n = rng.int(4, 5);
  const m = rng.int(5, 20);
  const ds = deviations(rng, n, 5);
  const xs = ds.map((d) => m + d);
  const sq = sum(ds.map((d) => d * d));
  return {
    q: `${n}일 동안 하루에 걸은 거리(km)가 ${list(xs)} 예요. 분산을 구하세요.`,
    choices: null,
    answer: fracAns(sq, n),
    answerTex: `$${fracTex(sq, n)}$`,
    answerType: 'fraction',
    check: varCheck(xs),
    concepts: ['분산 = 편차 제곱의 평균'],
    steps: [
      { title: '평균', body: `$$\\frac{${xs.join('+')}}{${n}}=${m}$$` },
      { title: '편차', body: `$$${ds.join(',\\ ')}$$` },
      {
        title: '편차 제곱의 합',
        body: `$$${ds.map((d) => `${paren(d)}^2`).join('+')}=${sq}$$`,
      },
      { title: '개수로 나누기', body: `$$${sq}\\div${n}=${fracTex(sq, n)}$$` },
    ],
    tip: '편차를 그냥 더하면 늘 0 이에요. 꼭 제곱해서 더해요.',
  };
}

function stdev(rng: Rng): GenProblem {
  for (;;) {
    const n = rng.int(4, 5);
    const ds = deviations(rng, n, 6);
    const sq = sum(ds.map((d) => d * d));
    if (sq % n) continue;
    const vr = sq / n;
    const s = Math.round(Math.sqrt(vr));
    // 표준편차가 자연수일 때만 — 답 칸에 √ 를 칠 수 없다
    if (s * s !== vr || s === 0) continue;
    const m = rng.int(6, 30);
    const xs = ds.map((d) => m + d);
    return {
      q: `${n}명의 턱걸이 기록(회)이 ${list(xs)} 예요. 표준편차를 구하세요.`,
      choices: null,
      answer: String(s),
      answerTex: `$${s}$회`,
      answerType: 'int',
      check: varCheck(xs).replace('ans = ', 'w = ').concat('\nans = sqrt(w)'),
      concepts: ['분산 = 편차 제곱의 평균', '표준편차 = $\\sqrt{\\text{분산}}$'],
      steps: [
        { title: '평균', body: `$$\\frac{${xs.join('+')}}{${n}}=${m}$$` },
        { title: '편차 제곱의 합', body: `$$${ds.map((d) => `${paren(d)}^2`).join('+')}=${sq}$$` },
        { title: '분산', body: `$$${sq}\\div${n}=${vr}$$` },
        { title: '표준편차', body: `$$\\sqrt{${vr}}=${s}$$` },
      ],
      tip: '분산에서 멈추면 안 돼요. 제곱근을 씌워야 변량과 같은 단위(회)가 돼요.',
    };
  }
}

export const generators: Generator[] = [
  { id: 'stat-median', unitId: UNIT, title: '중앙값', make: median },
  {
    id: 'stat-deviation-missing',
    unitId: UNIT,
    title: '편차의 합으로 빈 편차 구하기',
    make: missingDeviation,
  },
  { id: 'stat-variance', unitId: UNIT, title: '분산', make: variance },
  { id: 'stat-stdev', unitId: UNIT, title: '표준편차', make: stdev },
];
