import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, gcd } from './util.ts';

const UNIT = 'm1-integer-rational';

// 숫자 바로 뒤에 조사를 붙이지 않는다. 숫자가 무작위라 "3를"·"7가" 같은 글이 나오기 때문 —
// 수식은 따로 줄에 세우거나, 조사 없이 끝나는 문장으로 쓴다.

/** 유리수 하나. 소수로 보일지(dec)는 글자만 바꾸고 값(n/d)은 그대로다 */
interface Num {
  n: number;
  d: number;
  dec: boolean;
}

const val = (x: Num) => x.n / x.d;
/** 검산식: 파이썬에서 1/2 는 실수라 늘 Rational 로 */
const sym = (x: Num) => `Rational(${x.n}, ${x.d})`;
function tex(x: Num): string {
  if (x.d === 1) return String(x.n);
  if (x.dec) return String(x.n / x.d);
  return fracTex(x.n, x.d);
}

/** 분모 d 인 기약 분수(정수 아님). 소수로 끝나는 분모(2·4·5)는 반쯤 소수로 보인다 */
function frac(rng: Rng, lo: number, hi: number): Num {
  for (;;) {
    const d = rng.pick([2, 3, 4, 5]);
    const n = rng.int(lo * d, hi * d);
    if (n % d === 0 || gcd(n, d) !== 1) continue;
    return { n, d, dec: d !== 3 && rng.next() < 0.5 };
  }
}

const int = (n: number): Num => ({ n, d: 1, dec: false });

const ABS_CONCEPT = '절댓값: 수직선에서 0까지의 거리. 부호를 뗀 수예요.';

/** 절댓값이 ~ 이하(미만)인 정수의 개수. 0 과 음수를 빠뜨리는 실수를 노린다 */
function absCount(rng: Rng): GenProblem {
  const strict = rng.next() < 0.5;
  const bound = strict ? frac(rng, 1, 6) : int(rng.int(1, 6));
  const b = { ...bound, n: Math.abs(bound.n) };
  const top = Math.floor(val(b) - (strict && b.d === 1 ? 1 : 0));
  const word = strict ? '보다 작은' : ' 이하인';
  const list = Array.from({ length: 2 * top + 1 }, (_, i) => i - top);
  return {
    q: `절댓값이 $${tex(b)}$${word} 정수는 모두 몇 개인가요?`,
    choices: null,
    answer: String(list.length),
    answerType: 'int',
    check: `len([v for v in range(-50, 51) if Abs(v) ${strict ? '<' : '<='} ${sym(b)}])`,
    concepts: [ABS_CONCEPT, '0의 절댓값은 0이에요. 0도 정수예요.'],
    steps: [
      {
        title: '양의 정수 쪽',
        body:
          top === 1
            ? '0의 오른쪽에서 조건에 맞는 정수는 $1$ 하나예요.'
            : `0의 오른쪽에서 조건에 맞는 정수는 $1$부터 $${top}$까지예요.`,
      },
      {
        title: '음의 정수와 0',
        body: `왼쪽에도 같은 거리에 같은 개수가 있고, 0도 들어가요.\n$$${list.join(',\\ ')}$$`,
      },
      { title: '세기', body: `$$${top}+${top}+1=${list.length}$$` },
    ],
    tip: '음수 쪽과 0을 빠뜨리기 쉬워요. 수직선 위에 점을 찍어 세면 확실해요.',
  };
}

/** 두 수 사이(끝은 빼고)의 정수 개수 */
function betweenCount(rng: Rng): GenProblem {
  for (;;) {
    const a = frac(rng, -6, -1);
    const b = rng.next() < 0.6 ? frac(rng, 1, 5) : frac(rng, -3, 0);
    if (val(b) <= val(a)) continue;
    const lo = Math.ceil(val(a));
    const hi = Math.floor(val(b));
    if (hi < lo) continue;
    const list = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    return {
      q: `두 수 $${tex(a)}$, $${tex(b)}$ 사이에 있는 정수는 모두 몇 개인가요?`,
      choices: null,
      answer: String(list.length),
      answerType: 'int',
      check: `len([v for v in range(-50, 51) if ${sym(a)} < v < ${sym(b)}])`,
      concepts: ['수직선에서 오른쪽에 있는 수가 더 커요. 음수는 0에서 멀수록 작아요.'],
      steps: [
        {
          title: '왼쪽 끝 바로 오른쪽 정수',
          body: `$${tex(a)}$보다 큰 정수 중 가장 작은 것: $${lo}$`,
        },
        {
          title: '오른쪽 끝 바로 왼쪽 정수',
          body: `$${tex(b)}$보다 작은 정수 중 가장 큰 것: $${hi}$`,
        },
        {
          title: '늘어놓고 세기',
          body: `$$${list.join(',\\ ')}$$\n모두 ${list.length}개예요.`,
        },
      ],
      tip: '음수의 소수 부분 때문에 헷갈리면, 수직선 위에 두 수를 먼저 찍어요.',
    };
  }
}

/** 수 다섯 개 중 가장 작은(큰) 수 */
function extreme(rng: Rng): GenProblem {
  for (;;) {
    const xs: Num[] = [
      frac(rng, -5, -1),
      frac(rng, -5, 3),
      int(rng.int(-6, -1)),
      int(rng.int(0, 5)),
      frac(rng, 0, 4),
    ];
    const vs = xs.map(val);
    if (new Set(vs).size !== vs.length) continue;
    const small = rng.next() < 0.6;
    const best = small ? Math.min(...vs) : Math.max(...vs);
    const ans = xs[vs.indexOf(best)] as Num;
    // 보이는 순서를 섞는다(가장 작은 수가 늘 맨 앞이면 읽지 않고도 맞힌다)
    const shown = shuffle(rng, xs);
    const sorted = [...xs].sort((p, q) => val(p) - val(q));
    return {
      q: `다음 수 중 가장 ${small ? '작은' : '큰'} 수를 구하세요.\n$$${shown.map(tex).join(',\\quad ')}$$`,
      choices: null,
      answer: fracAns(ans.n, ans.d),
      answerTex: `$${tex(ans)}$`,
      answerType: ans.d === 1 ? 'int' : 'fraction',
      check: `${small ? 'Min' : 'Max'}(${xs.map(sym).join(', ')})`,
      concepts: [
        '(음수) < 0 < (양수)',
        '음수끼리는 절댓값이 큰 쪽이 더 작아요. 0에서 왼쪽으로 더 멀리 있어서예요.',
      ],
      steps: [
        {
          title: '음수와 양수 나누기',
          body: small
            ? '가장 작은 수는 음수 가운데 있어요. 음수끼리 비교해요.'
            : '가장 큰 수는 양수 가운데 있어요. 양수끼리 비교해요.',
        },
        {
          title: '수직선 순서로 늘어놓기',
          body: `$$${sorted.map(tex).join('<')}$$`,
        },
        {
          title: small ? '맨 왼쪽' : '맨 오른쪽',
          body: `가장 ${small ? '작은' : '큰'} 수: $${tex(ans)}$`,
        },
      ],
      tip: '분수와 소수가 섞이면 같은 꼴(소수 또는 통분한 분수)로 바꿔 비교해요.',
    };
  }
}

/** 수직선 위 두 점 사이의 거리. 0 을 사이에 두면 두 절댓값의 합이다 */
function distance(rng: Rng): GenProblem {
  for (;;) {
    const half = rng.next() < 0.4;
    const pick = (lo: number, hi: number): Num =>
      half ? { n: rng.int(lo * 2, hi * 2), d: 2, dec: rng.next() < 0.5 } : int(rng.int(lo, hi));
    const a = pick(-8, -1);
    const b = rng.next() < 0.65 ? pick(1, 8) : pick(-8, -1);
    const A = { ...a, ...reduceNum(a) };
    const B = { ...b, ...reduceNum(b) };
    if (val(A) >= val(B) || val(A) === 0 || val(B) === 0) continue;
    const dist = val(B) - val(A);
    const cross = val(B) > 0;
    const steps: Step[] = cross
      ? [
          {
            title: '0까지의 거리 두 개',
            body: `0까지의 거리: $|${tex(A)}|=${tex(abs(A))}$, $|${tex(B)}|=${tex(B)}$\n한 점은 0의 왼쪽, 다른 점은 오른쪽에 있어요.`,
          },
          {
            title: '더하기',
            body: `0을 사이에 두고 있어서 두 거리를 더해요.\n$$${tex(abs(A))}+${tex(B)}=${fracTex(dist * 2, 2)}$$`,
          },
        ]
      : [
          {
            title: '0까지의 거리 두 개',
            body: `0까지의 거리: $|${tex(A)}|=${tex(abs(A))}$, $|${tex(B)}|=${tex(abs(B))}$\n두 점 모두 0의 왼쪽에 있어요.`,
          },
          {
            title: '빼기',
            body: `같은 쪽에 있어서 먼 거리에서 가까운 거리를 빼요.\n$$${tex(abs(A))}-${tex(abs(B))}=${fracTex(dist * 2, 2)}$$`,
          },
        ];
    return {
      q: `수직선에서 두 수 $${tex(A)}$, $${tex(B)}$에 대응하는 두 점 사이의 거리를 구하세요.`,
      choices: null,
      answer: fracAns(dist * 2, 2),
      answerType: Number.isInteger(dist) ? 'int' : 'fraction',
      ...(Number.isInteger(dist) ? {} : { answerTex: `$${fracTex(dist * 2, 2)}$` }),
      check: `Abs(${sym(B)} - ${sym(A)})`,
      concepts: [ABS_CONCEPT],
      steps,
      tip: '거리는 음수가 될 수 없어요. 수직선에 두 점을 찍고 칸을 세어 확인해요.',
    };
  }
}

/** 피셔-예이츠 섞기(rng 로만 — 같은 시드면 같은 순서) */
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const reduceNum = (x: Num) => {
  const g = gcd(x.n, x.d) || 1;
  return { n: x.n / g, d: x.d / g };
};
const abs = (x: Num): Num => ({ ...x, n: Math.abs(x.n) });

export const generators: Generator[] = [
  { id: 'ir-abs-count', unitId: UNIT, title: '절댓값 조건에 맞는 정수 세기', make: absCount },
  { id: 'ir-between-count', unitId: UNIT, title: '두 수 사이의 정수 세기', make: betweenCount },
  { id: 'ir-extreme', unitId: UNIT, title: '가장 작은 수·큰 수 찾기', make: extreme },
  { id: 'ir-distance', unitId: UNIT, title: '수직선 위 두 점 사이의 거리', make: distance },
];
