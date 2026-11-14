import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';

const UNIT = 'geo-ellipse';

const DEF = '타원 위의 점에서 두 초점까지 거리의 합은 장축의 길이 $2a$ 로 늘 같아요.';
const STD =
  '$\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ 에서 분모가 큰 쪽이 장축 방향이고, 큰 분모가 $a^2$ 이에요.';
const FOC = '초점까지 거리 $c$ 는 $c^2=a^2-b^2$ (큰 분모 − 작은 분모)로 구해요.';

// 초점 좌표가 정수가 되도록 (짧은 반지름 b, 초점 거리 c, 긴 반지름 a) 피타고라스 세 수에서 고른다
const TRIPLES: readonly [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [12, 5, 13],
  [6, 8, 10],
  [8, 6, 10],
  [8, 15, 17],
  [15, 8, 17],
  [9, 12, 15],
  [12, 9, 15],
];

/** (x−h)² 꼴. h=0 이면 x² */
const sq = (v: string, h: number) => (h === 0 ? `${v}^2` : `(${v}${h < 0 ? `+${-h}` : `-${h}`})^2`);
/** 표준형 tex. A 는 x² 의 분모, B 는 y² 의 분모 */
const eqTex = (A: number, B: number, h = 0, k = 0) =>
  `\\frac{${sq('x', h)}}{${A}}+\\frac{${sq('y', k)}}{${B}}=1`;
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);

function shape(rng: Rng) {
  const [b, c, a] = rng.pick(TRIPLES);
  const horiz = rng.next() < 0.5;
  // 가로로 긴 타원이면 x² 의 분모가 a², 세로로 길면 y² 의 분모가 a²
  const A = horiz ? a * a : b * b;
  const B = horiz ? b * b : a * a;
  return { a, b, c, horiz, A, B };
}

export const generators: Generator[] = [
  {
    id: 'geo-ellipse-foci',
    unitId: UNIT,
    title: '표준형에서 두 초점 사이의 거리',
    make(rng) {
      const { a, b, c, horiz, A, B } = shape(rng);
      const big = Math.max(A, B);
      const small = Math.min(A, B);
      return {
        q: `타원 $${eqTex(A, B)}$ 의 두 초점 사이의 거리를 구하세요.`,
        choices: null,
        answer: String(2 * c),
        answerType: 'int',
        check: `2*sqrt(${big}-${small})`,
        concepts: [STD, FOC],
        steps: [
          {
            title: '장축 방향 정하기',
            body: `분모가 큰 쪽은 $${horiz ? 'x' : 'y'}^2$ 의 $${big}$ 이에요. 그래서 장축은 $${horiz ? 'x' : 'y'}$ 축 위에 있고 $a^2=${big}$, $b^2=${small}$ 이에요.`,
          },
          {
            title: '$c^2$ 구하기',
            body: `$$c^2=a^2-b^2=${big}-${small}=${c * c}$$`,
          },
          {
            title: '$c$ 구하기',
            body: `$c=${c}$ 이므로 두 초점은 ${horiz ? `$(${c},0)$, $(-${c},0)$` : `$(0,${c})$, $(0,-${c})$`} 이에요.`,
          },
          {
            title: '두 초점 사이의 거리',
            body: `$$2c=2\\times${c}=${2 * c}$$`,
          },
        ],
        tip: `$a=${a}$, $b=${b}$, $c=${c}$ 는 $b^2+c^2=a^2$ 를 만족해요. 단축의 끝점에서 초점까지 거리가 $a$ 인 직각삼각형을 떠올리면 기억하기 쉬워요.`,
      };
    },
  },
  {
    id: 'geo-ellipse-sum',
    unitId: UNIT,
    title: '두 초점까지 거리의 합 이용하기',
    make(rng) {
      const { a, c, A, B } = shape(rng);
      // 타원 위의 점에서 초점까지 거리는 a−c 이상 a+c 이하. 양 끝(꼭짓점)은 피한다
      const d = rng.int(a - c + 1, a + c - 1);
      const big = Math.max(A, B);
      return {
        q: `타원 $${eqTex(A, B)}$ 의 두 초점을 $F$, $F'$ 이라 해요. 타원 위의 점 $P$ 에 대하여 $\\overline{PF}=${d}$ 일 때, $\\overline{PF'}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(2 * a - d),
        answerType: 'int',
        check: `2*sqrt(${big})-${d}`,
        concepts: [DEF, STD],
        steps: [
          {
            title: '$a$ 구하기',
            body: `큰 분모가 $${big}$ 이므로 $a^2=${big}$, $a=${a}$ 예요.`,
          },
          {
            title: '거리의 합',
            body: `$$\\overline{PF}+\\overline{PF'}=2a=${2 * a}$$`,
          },
          {
            title: '빼기',
            body: `$$\\overline{PF'}=${2 * a}-${d}=${2 * a - d}$$`,
          },
        ],
        tip: '초점의 좌표나 점 $P$ 의 좌표를 몰라도 돼요. 타원의 정의 하나로 끝나요.',
      };
    },
  },
  {
    id: 'geo-ellipse-from-foci',
    unitId: UNIT,
    title: '초점과 장축의 길이로 표준형 만들기',
    make(rng) {
      let a: number;
      let c: number;
      do {
        a = rng.int(3, 9);
        c = rng.int(1, 8);
      } while (c >= a);
      return {
        q: `두 초점이 $F(${c},0)$, $F'(-${c},0)$ 이고 장축의 길이가 $${2 * a}$ 인 타원의 방정식을 $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ 이라 할 때, $b^2$ 의 값을 구하세요.`,
        choices: null,
        answer: String(a * a - c * c),
        answerType: 'int',
        check: `Rational(${2 * a},2)**2-${c}**2`,
        concepts: [DEF, FOC],
        steps: [
          {
            title: '$a$ 구하기',
            body: `장축의 길이가 $2a=${2 * a}$ 이므로 $a=${a}$ 예요.`,
          },
          {
            title: '$c$ 읽기',
            body: `초점이 $(\\pm${c},0)$ 이므로 $c=${c}$ 예요.`,
          },
          {
            title: '$b^2$ 구하기',
            body: `$$b^2=a^2-c^2=${a * a}-${c * c}=${a * a - c * c}$$`,
          },
        ],
        tip: `구한 타원은 $${eqTex(a * a, a * a - c * c)}$ 예요. 쌍곡선과 달리 타원은 $a^2$ 에서 $c^2$ 를 **빼요**.`,
      };
    },
  },
  {
    id: 'geo-ellipse-shift',
    unitId: UNIT,
    title: '평행이동한 타원의 초점',
    make(rng) {
      const { a, c, horiz, A, B } = shape(rng);
      let h: number;
      let k: number;
      do {
        h = rng.int(-5, 5);
        k = rng.int(-5, 5);
      } while (h === 0 || k === 0);
      const big = Math.max(A, B);
      const small = Math.min(A, B);
      const fx = horiz ? h + c : h;
      const fy = horiz ? k : k + c;
      return {
        q: `타원 $${eqTex(A, B, h, k)}$ 의 두 초점 중 ${horiz ? '$x$' : '$y$'}좌표가 큰 초점의 좌표를 $(p,q)$ 라 할 때, $p+q$ 의 값을 구하세요.`,
        choices: null,
        answer: String(fx + fy),
        answerType: 'int',
        check: horiz
          ? `(${h}+sqrt(${big}-${small}))+(${k})`
          : `(${h})+(${k}+sqrt(${big}-${small}))`,
        concepts: [
          '$\\frac{(x-m)^2}{a^2}+\\frac{(y-n)^2}{b^2}=1$ 은 원점 중심 타원을 $x$ 축으로 $m$, $y$ 축으로 $n$ 만큼 옮긴 것이에요. 초점도 똑같이 옮겨져요.',
          FOC,
        ],
        steps: [
          {
            title: '옮기기 전 타원',
            body: `원점 중심 타원 $${eqTex(A, B)}$ 은 분모가 큰 쪽이 $${horiz ? 'x' : 'y'}^2$ 이라 장축이 $${horiz ? 'x' : 'y'}$ 축 위에 있어요.`,
          },
          {
            title: '옮기기 전 초점',
            body: `$c^2=${big}-${small}=${c * c}$, $c=${c}$ 이므로 초점은 ${horiz ? `$(\\pm${c},0)$` : `$(0,\\pm${c})$`} 이에요.`,
          },
          {
            title: '얼마나 옮겼나',
            body: `괄호 안 부호를 바꿔 읽으면 $x$ 축으로 $${h}$, $y$ 축으로 $${k}$ 만큼 옮겼어요.`,
          },
          {
            title: '옮긴 초점',
            body: horiz
              ? `$(${c}${signed(h)},\\ 0${signed(k)})=(${fx},${fy})$ 이에요.`
              : `$(0${signed(h)},\\ ${c}${signed(k)})=(${fx},${fy})$ 이에요.`,
          },
          {
            title: '$p+q$',
            body: `$$p+q=${fx}+${paren(fy)}=${fx + fy}$$`,
          },
        ],
        tip: `중심이 $(${h},${k})$ 로 옮겨졌을 뿐 $a=${a}$, $c=${c}$ 는 그대로예요. 초점은 중심에서 장축 방향으로 $c$ 만큼 떨어져 있어요.`,
      };
    },
  },
];
