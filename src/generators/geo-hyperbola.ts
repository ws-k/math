import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, ieyo } from './util.ts';

const UNIT = 'geo-hyperbola';

const DEF = '쌍곡선 위의 점에서 두 초점까지 거리의 차는 늘 $2a$(주축의 길이)예요.';
const STD = '$\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ 의 초점은 $(\\pm c,0)$, $c^2=a^2+b^2$ 예요.';
const ASY =
  '$\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ 의 점근선은 $y=\\pm\\frac{b}{a}x$ 예요. 세로 $b$ ÷ 가로 $a$ 예요.';

// 초점이 정수 자리에 오도록 c²=a²+b² 인 (a, b, c) 만 쓴다 — 근호가 남으면 기초 문제의 계산이 길어져서
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
  [9, 12, 15],
  [12, 9, 15],
  [8, 15, 17],
  [15, 8, 17],
];

/** x²/A − y²/B (A·B 가 1 이면 분수를 쓰지 않는다) */
const sq = (v: string, k: number) => (k === 1 ? `${v}^2` : `\\frac{${v}^2}{${k}}`);
const hyp = (A: number, B: number, rhs = 1) => `${sq('x', A)}-${sq('y', B)}=${rhs}`;
/** 맨 앞 계수: 1 이면 생략 */
const coef = (k: number, v: string) => (k === 1 ? v : `${k}${v}`);

function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType' | 'answerTex'> {
  const r = fracAns(n, d);
  return r.includes('/')
    ? { answer: r, answerType: 'fraction', answerTex: `$${fracTex(n, d)}$` }
    : { answer: r, answerType: 'int' };
}

const pickTriple = (rng: Rng) => rng.pick(TRIPLES);

export const generators: Generator[] = [
  {
    id: 'geo-hyperbola-foci',
    unitId: UNIT,
    title: '표준형에서 두 초점 사이의 거리',
    make(rng) {
      const [a, b, c] = pickTriple(rng);
      const A = a * a;
      const B = b * b;
      const yAxis = rng.next() < 0.5;
      const eq = hyp(A, B, yAxis ? -1 : 1);
      return {
        q: `쌍곡선 $${eq}$ 의 두 초점 사이의 거리를 구하세요.`,
        choices: null,
        answer: String(2 * c),
        answerType: 'int',
        check: `2*sqrt(${A}+${B})`,
        concepts: [
          STD,
          '우변이 $-1$ 이면 초점이 $y$축 위 $(0,\\pm c)$ 로 가지만 $c^2$ 은 똑같이 두 분모의 합이에요.',
        ],
        steps: [
          {
            title: '분모 읽기',
            body: `$x^2$ 아래가 ${A}, $y^2$ 아래가 ${B} ${ieyo(B)}.`,
          },
          {
            title: '$c^2$ 구하기',
            body: `쌍곡선은 두 분모를 **더해요**. $$c^2=${A}+${B}=${c * c}$$`,
          },
          {
            title: '초점 자리',
            body: `$c=${c}$ 이고, 우변이 ${yAxis ? '$-1$ 이라 초점은 $y$축 위' : '$1$ 이라 초점은 $x$축 위'} $${yAxis ? `(0,\\pm${c})` : `(\\pm${c},0)`}$ ${yAxis ? ieyo(c) : '이에요'}.`,
          },
          {
            title: '두 초점 사이 거리',
            body: `$$2c=2\\times${c}=${2 * c}$$`,
          },
        ],
        tip: `타원처럼 빼면($c^2=${Math.abs(A - B)}$) 틀려요. 쌍곡선의 초점은 꼭짓점보다 바깥에 있어서 $c$ 가 $a$ 보다 커야 해요.`,
      };
    },
  },
  {
    id: 'geo-hyperbola-asymptote',
    unitId: UNIT,
    title: '점근선의 기울기',
    make(rng) {
      let a: number;
      let b: number;
      do {
        a = rng.int(1, 6);
        b = rng.int(1, 6);
      } while (a === b);
      const A = a * a;
      const B = b * b;
      const expanded = A > 1 && B > 1 && rng.next() < 0.5;
      const shown = expanded ? `${coef(B, 'x^2')}-${coef(A, 'y^2')}=${A * B}` : hyp(A, B);
      const steps = [
        ...(expanded
          ? [
              {
                title: '표준형으로 바꾸기',
                body: `양변을 ${A * B} 로 나눠요. $$${hyp(A, B)}$$`,
              },
            ]
          : []),
        {
          title: '$a$, $b$ 읽기',
          body: `$a^2=${A}$, $b^2=${B}$ 이므로 $a=${a}$, $b=${b}$ ${ieyo(b)}.`,
        },
        {
          title: '기울기',
          body: `점근선은 $y=\\pm\\frac{b}{a}x$ 라서 양수 기울기는 $$\\frac{b}{a}=${fracTex(b, a)}$$`,
        },
      ];
      return {
        q: `쌍곡선 $${shown}$ 의 두 점근선 중 기울기가 양수인 것의 기울기를 구하세요.`,
        choices: null,
        ...ans(b, a),
        check: `sqrt(${B})/sqrt(${A})`,
        concepts: [
          ASY,
          '우변을 $0$ 으로 바꾼 식 $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=0$ 을 풀어도 점근선이 나와요.',
        ],
        steps,
        tip: `$\\frac{a}{b}=${fracTex(a, b)}$ 로 뒤집기 쉬워요. $y$ 쪽 분모($b^2$)가 세로, $x$ 쪽 분모($a^2$)가 가로예요.`,
      };
    },
  },
  {
    id: 'geo-hyperbola-diff',
    unitId: UNIT,
    title: '정의로 초점까지 거리 구하기',
    make(rng) {
      const [a, b, c] = pickTriple(rng);
      const A = a * a;
      const B = b * b;
      // 오른쪽 가지에서 F 까지 거리는 c−a 가 가장 짧다. 그보다 길게 골라야 그런 점이 실제로 있다
      const d = rng.int(c - a + 1, c - a + 8);
      const right = rng.next() < 0.5;
      const near = right ? 'F' : "F'";
      const far = right ? "F'" : 'F';
      return {
        q: `쌍곡선 $${hyp(A, B)}$ 의 두 초점 중 $x$좌표가 양수인 것을 $F$, 음수인 것을 $F'$ 이라 해요. 이 쌍곡선 위의 점 $P$ 의 $x$좌표가 ${right ? '양수' : '음수'}이고 $\\overline{P${near}}=${d}$ 일 때, $\\overline{P${far}}$ 의 길이를 구하세요.`,
        choices: null,
        answer: String(d + 2 * a),
        answerType: 'int',
        check: `${d}+2*sqrt(${A})`,
        concepts: [
          DEF,
          '점은 가까운 초점 쪽 가지 위에 있어요. 그래서 먼 초점까지가 $2a$ 만큼 더 길어요.',
        ],
        steps: [
          {
            title: '$a$ 읽기',
            body: `$a^2=${A}$ 이므로 $a=${a}$, 거리의 차는 $2a=${2 * a}$ ${ieyo(2 * a)}.`,
          },
          {
            title: '어느 쪽이 먼가',
            body: `$P$ 는 ${right ? '오른쪽' : '왼쪽'} 가지 위라서 $${near}$ 에 더 가깝고 $${far}$ 에서 더 멀어요.`,
          },
          {
            title: '정의 쓰기',
            body: `$$\\overline{P${far}}-\\overline{P${near}}=${2 * a}$$`,
          },
          {
            title: '계산하기',
            body: `$$\\overline{P${far}}=${d}+${2 * a}=${d + 2 * a}$$`,
          },
        ],
        tip: `초점의 좌표($c=${c}$)는 필요 없어요. 쌍곡선의 정의 하나로 풀려요.`,
      };
    },
  },
  {
    id: 'geo-hyperbola-from-foci',
    unitId: UNIT,
    title: '초점과 꼭짓점으로 식 만들기',
    make(rng) {
      const c = rng.int(3, 9);
      const a = rng.int(1, c - 1);
      const viaDiff = rng.next() < 0.5;
      const q = viaDiff
        ? `두 점 $(${c},0)$, $(-${c},0)$ 까지 거리의 차가 ${2 * a} 인 점들이 이루는 쌍곡선을 $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ 이라 할 때, $b^2$ 의 값을 구하세요.`
        : `두 초점이 $(\\pm${c},0)$ 이고 두 꼭짓점이 $(\\pm${a},0)$ 인 쌍곡선을 $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ 이라 할 때, $b^2$ 의 값을 구하세요.`;
      return {
        q,
        choices: null,
        answer: String(c * c - a * a),
        answerType: 'int',
        check: viaDiff ? `${c}**2-Rational(${2 * a},2)**2` : `${c}**2-${a}**2`,
        concepts: [STD, DEF],
        steps: [
          viaDiff
            ? { title: '$a$ 구하기', body: `거리의 차가 $2a=${2 * a}$ 이므로 $a=${a}$ ${ieyo(a)}.` }
            : { title: '$a$ 읽기', body: `꼭짓점이 $(\\pm${a},0)$ 이므로 $a=${a}$ ${ieyo(a)}.` },
          { title: '$c$ 읽기', body: `초점이 $(\\pm${c},0)$ 이므로 $c=${c}$ ${ieyo(c)}.` },
          {
            title: '$b^2$ 구하기',
            body: `$c^2=a^2+b^2$ 에서 $$b^2=${c * c}-${a * a}=${c * c - a * a}$$`,
          },
        ],
        tip: `식은 $${hyp(a * a, c * c - a * a)}$ 이에요. 타원과 달리 $c$ 가 가장 커요.`,
      };
    },
  },
];
