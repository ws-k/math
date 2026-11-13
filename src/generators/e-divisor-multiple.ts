import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { gcd, lcm } from './util.ts';

const UNIT = 'e-divisor-multiple';

// 숫자 뒤 조사는 읽는 소리의 받침으로 갈린다. e-fraction-addsub 생성기와 같은 규칙(보고서에 공용화 제안).
const BATCHIM = new Set(['0', '1', '3', '6', '7', '8']);
const RIEUL = new Set(['1', '7', '8']);
type Pair = '은는' | '이가' | '을를' | '과와' | '으로로' | '이에요예요';
function j(n: number, pair: Pair): string {
  const last = String(n).slice(-1);
  if (pair === '으로로') return BATCHIM.has(last) && !RIEUL.has(last) ? '으로' : '로';
  if (pair === '이에요예요') return BATCHIM.has(last) ? '이에요' : '예요';
  return BATCHIM.has(last) ? pair.slice(0, 1) : pair.slice(1);
}

/** 곱해서 n 이 되는 짝(작은 수가 앞) */
function pairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 1; a * a <= n; a++) if (n % a === 0) out.push([a, n / a]);
  return out;
}

const divisorsOf = (n: number) => {
  const ps = pairs(n);
  const small = ps.map(([a]) => a);
  const big = ps.map(([, b]) => b).reverse();
  return [...small, ...big.filter((b) => !small.includes(b))];
};

/**
 * 두 수를 공약수로 계속 나누는 단계(초등의 '나눗셈 사다리'). 작은 소수부터 나눠 더 나눌 공약수가 없을 때 멈춘다.
 * 소인수분해는 중1 단원이라 여기서는 "둘 다 나누어지는 수로 나누기"로만 설명한다.
 */
function ladder(a: number, b: number): { divs: number[]; ra: number; rb: number } {
  const divs: number[] = [];
  let x = a;
  let y = b;
  for (let p = 2; p <= Math.min(x, y); ) {
    if (x % p === 0 && y % p === 0) {
      divs.push(p);
      x /= p;
      y /= p;
    } else p++;
  }
  return { divs, ra: x, rb: y };
}

const ladderBody = (a: number, b: number, divs: number[]) => {
  let x = a;
  let y = b;
  const rows = divs.map((p) => {
    const row = `${x},\\ ${y}\\ \\xrightarrow{\\div ${p}}\\ ${x / p},\\ ${y / p}`;
    x /= p;
    y /= p;
    return row;
  });
  // 표시 수식의 맨 바깥 \\ 는 KaTeX strict 에서 거부되므로 gathered 로 줄을 나눈다
  return `$$\\begin{gathered}${rows.join('\\\\')}\\end{gathered}$$`;
};

/** 약수의 개수. 짝으로 찾으면 빠뜨리지 않는다는 것을 단계로 보인다 */
function divisorCount(rng: Rng): GenProblem {
  let n: number;
  do n = rng.int(12, 72);
  while (divisorsOf(n).length < 4);
  const ps = pairs(n);
  const ds = divisorsOf(n);
  const square = ps.some(([a, b]) => a === b);
  return {
    q: `$${n}$의 약수는 모두 몇 개일까요?`,
    choices: null,
    answer: String(ds.length),
    answerType: 'int',
    check: `len(divisors(${n}))`,
    concepts: [
      '약수: 어떤 수를 나누어떨어지게 하는 수',
      '곱해서 그 수가 되는 두 수의 짝을 찾으면 약수를 빠뜨리지 않아요.',
    ],
    steps: [
      {
        title: '곱셈 짝 찾기',
        body: `1부터 차례로 나눠 보며 곱해서 $${n}$${j(n, '이가')} 되는 짝을 적어요.\n$$${ps.map(([a, b]) => `${a}\\times ${b}`).join(',\\quad ')}$$`,
      },
      {
        title: '약수 늘어놓기',
        body: `짝에 나온 수를 모두 적어요.${square ? ' 같은 수끼리 곱한 짝은 한 번만 세요.' : ''}\n$$${ds.join(',\\ ')}$$`,
      },
      { title: '개수 세기', body: `모두 $${ds.length}$개예요.` },
    ],
    tip: '짝을 찾다가 앞의 수가 뒤의 수보다 커지면 멈춰요. 이미 찾은 짝이 뒤집혀 나오는 거예요.',
  };
}

function pickPair(rng: Rng, minG: number): [number, number] {
  for (;;) {
    const g = rng.int(minG, 12);
    const m = rng.int(1, 9);
    const k = rng.int(1, 9);
    if (m === k || gcd(m, k) !== 1) continue;
    const a = g * m;
    const b = g * k;
    if (a < 6 || b < 6 || a > 120 || b > 120) continue;
    return a < b ? [a, b] : [b, a];
  }
}

/** 최대공약수 */
function gcdTwo(rng: Rng): GenProblem {
  const [a, b] = pickPair(rng, 2);
  const { divs, ra, rb } = ladder(a, b);
  const g = gcd(a, b);
  const steps: Step[] = [
    {
      title: '공약수로 계속 나누기',
      body: `두 수가 모두 나누어떨어지는 수로 나눠요.\n${ladderBody(a, b, divs)}`,
    },
    {
      title: '멈추기',
      body: `$${ra}$${j(ra, '과와')} $${rb}$${j(rb, '은는')} 1 말고는 함께 나누어떨어지게 하는 수가 없어요.`,
    },
  ];
  steps.push(
    divs.length > 1
      ? { title: '나눈 수 곱하기', body: `$$${divs.join('\\times ')}=${g}$$` }
      : { title: '최대공약수', body: `나눈 수 $${g}$${j(g, '이가')} 최대공약수예요.` },
  );
  return {
    q: `$${a}$${j(a, '과와')} $${b}$의 최대공약수를 구하세요.`,
    choices: null,
    answer: String(g),
    answerType: 'int',
    check: `igcd(${a}, ${b})`,
    concepts: [
      '공약수: 두 수의 약수 가운데 함께 들어 있는 수',
      '두 수를 함께 나누어떨어지게 하는 수로 계속 나눈 뒤, 나눈 수를 모두 곱하면 최대공약수예요.',
    ],
    steps,
    tip: `확인: $${a}\\div ${g}=${a / g}$, $${b}\\div ${g}=${b / g}$로 둘 다 나누어떨어져요.`,
  };
}

/** 최소공배수 */
function lcmTwo(rng: Rng): GenProblem {
  let a: number;
  let b: number;
  do [a, b] = pickPair(rng, 2);
  while (lcm(a, b) > 200);
  const { divs, ra, rb } = ladder(a, b);
  const l = lcm(a, b);
  const factors = [...divs, ra, rb];
  return {
    q: `$${a}$${j(a, '과와')} $${b}$의 최소공배수를 구하세요.`,
    choices: null,
    answer: String(l),
    answerType: 'int',
    check: `ilcm(${a}, ${b})`,
    concepts: [
      '공배수: 두 수의 배수 가운데 함께 들어 있는 수',
      '두 수를 공약수로 계속 나눈 뒤, 나눈 수와 마지막 몫을 모두 곱하면 최소공배수예요.',
    ],
    steps: [
      {
        title: '공약수로 계속 나누기',
        body: `두 수가 모두 나누어떨어지는 수로 나눠요.\n${ladderBody(a, b, divs)}`,
      },
      {
        title: '나눈 수와 남은 몫 모두 곱하기',
        body: `나눈 수 ${divs.map((d) => `$${d}$`).join(', ')}${j(divs[divs.length - 1] ?? 0, '과와')} 마지막 몫 $${ra}$, $${rb}$${j(rb, '을를')} 모두 곱해요.\n$$${factors.join('\\times ')}=${l}$$`,
      },
    ],
    tip: `확인: $${l}\\div ${a}=${l / a}$, $${l}\\div ${b}=${l / b}$로 둘 다 나누어떨어져요. 두 수를 그냥 곱한 $${a * b}$${j(a * b, '은는')} 공배수이긴 하지만 가장 작은 것은 아니에요.`,
  };
}

/** 생활 속 최대공약수·최소공배수. 어느 쪽을 써야 하는지 고르는 것이 이 유형의 핵심 */
function gcdLcmStory(rng: Rng): GenProblem {
  if (rng.next() < 0.5) {
    const [a, b] = pickPair(rng, 3);
    const g = gcd(a, b);
    return {
      q: `연필 ${a}자루와 지우개 ${b}개를 남김없이 똑같이 나눠 담으려고 해요. 봉투를 가장 많이 만들면 몇 봉투일까요?`,
      choices: null,
      answer: String(g),
      answerType: 'int',
      check: `igcd(${a}, ${b})`,
      concepts: [
        '남김없이 똑같이 나누려면 봉투 수가 두 수의 공약수여야 해요.',
        '가장 많이 → 공약수 가운데 가장 큰 수, 곧 최대공약수',
      ],
      steps: [
        {
          title: '무엇을 구하는지 정하기',
          body: `봉투 수는 $${a}$${j(a, '과와')} $${b}$${j(b, '을를')} 모두 나누어떨어지게 해야 해요. 그런 수 중 가장 큰 수, 곧 최대공약수를 구해요.`,
        },
        {
          title: '최대공약수 구하기',
          body: `${ladderBody(a, b, ladder(a, b).divs)}\n최대공약수는 $${g}$${j(g, '이에요예요')}.`,
        },
        {
          title: '확인',
          body: `한 봉투에 연필 $${a / g}$자루, 지우개 $${b / g}$개씩 들어가요.`,
        },
      ],
      tip: '"똑같이 나누기·가장 많이·가장 크게"는 최대공약수, "다시 함께·처음으로 같이"는 최소공배수예요.',
    };
  }
  let a: number;
  let b: number;
  do [a, b] = pickPair(rng, 2);
  while (
    // 한 수가 다른 수의 배수면 큰 수가 곧 답이라 배수를 늘어놓는 단계가 한 줄로 끝나므로 뺀다
    lcm(a, b) > 90 ||
    b % a === 0
  );
  const l = lcm(a, b);
  return {
    q: `버스 두 대가 같은 정류장에서 동시에 출발했어요. 한 대는 ${a}분마다, 다른 한 대는 ${b}분마다 출발해요. 처음으로 다시 동시에 출발하는 것은 몇 분 뒤일까요?`,
    choices: null,
    answer: String(l),
    answerType: 'int',
    check: `ilcm(${a}, ${b})`,
    concepts: [
      `한 대가 출발하는 때는 $${a}$의 배수(분), 다른 한 대는 $${b}$의 배수(분)예요.`,
      '처음으로 같이 → 공배수 가운데 가장 작은 수, 곧 최소공배수',
    ],
    steps: [
      {
        title: '무엇을 구하는지 정하기',
        body: `두 버스가 함께 출발하는 때는 $${a}$${j(a, '과와')} $${b}$의 공배수예요. 처음으로 같이 출발하니 최소공배수를 구해요.`,
      },
      {
        title: '최소공배수 구하기',
        body: `$${b}$의 배수를 차례로 적고 $${a}$로 나누어떨어지는 첫 수를 찾아요.\n$$${Array.from({ length: l / b }, (_, i) => b * (i + 1)).join(',\\ ')}$$`,
      },
      { title: '답', body: `처음으로 같이 출발하는 것은 $${l}$분 뒤예요.` },
    ],
    tip: '큰 수의 배수를 적으면서 작은 수로 나누어떨어지는지 보면 빨리 찾아요.',
  };
}

export const generators: Generator[] = [
  { id: 'divisor-count', unitId: UNIT, title: '약수의 개수', make: divisorCount },
  { id: 'gcd-two', unitId: UNIT, title: '두 수의 최대공약수', make: gcdTwo },
  { id: 'lcm-two', unitId: UNIT, title: '두 수의 최소공배수', make: lcmTwo },
  {
    id: 'gcd-lcm-story',
    unitId: UNIT,
    title: '생활 속 최대공약수·최소공배수',
    make: gcdLcmStory,
  },
];
