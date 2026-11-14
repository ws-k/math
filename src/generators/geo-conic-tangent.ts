import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, paren } from './util.ts';

const UNIT = 'geo-conic-tangent';

const ELL_PT =
  '타원 $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ 위의 점 $(x_1,y_1)$ 에서의 접선: $\\frac{x_1x}{a^2}+\\frac{y_1y}{b^2}=1$';
const HYP_PT =
  '쌍곡선 $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ 위의 점 $(x_1,y_1)$ 에서의 접선: $\\frac{x_1x}{a^2}-\\frac{y_1y}{b^2}=1$';
const PAR_PT = '포물선 $y^2=4px$ 위의 점 $(x_1,y_1)$ 에서의 접선: $y_1y=2p(x+x_1)$';
const SWAP = '곡선의 식에서 $x^2\\to x_1x$, $y^2\\to y_1y$ 로 바꾸면 접선이 돼요.';
const DISC =
  '직선의 식을 곡선의 식에 대입한 이차방정식의 판별식 $D$: $D>0$ 두 점, $D=0$ 접함, $D<0$ 만나지 않음';
const ELL_M = '타원에 기울기 $m$ 인 접선: $y=mx\\pm\\sqrt{a^2m^2+b^2}$';
const HYP_M = '쌍곡선에 기울기 $m$ 인 접선: $y=mx\\pm\\sqrt{a^2m^2-b^2}$';

// 접점이 격자점이어야 풀이가 분수 계산에 묻히지 않는다. 그래서 (a², b², x₁, y₁) 를 미리 다 찾아 두고 고른다.
// 부호는 뽑을 때 붙인다(곡선이 두 축에 대칭이라 부호를 바꿔도 곡선 위).
const ELL: [number, number, number, number][] = [];
const HYP: [number, number, number, number][] = [];
for (let a2 = 2; a2 <= 20; a2++)
  for (let b2 = 1; b2 <= 20; b2++)
    for (let x = 1; x <= 4; x++)
      for (let y = 1; y <= 4; y++) {
        if (a2 !== b2 && x * x * b2 + y * y * a2 === a2 * b2) ELL.push([a2, b2, x, y]);
        if (a2 <= 12 && b2 <= 12 && x * x * b2 - y * y * a2 === a2 * b2) HYP.push([a2, b2, x, y]);
      }

const flip = (rng: Rng, n: number) => (rng.next() < 0.5 ? -n : n);

/** x²/a² 항(분모가 1 이면 분수 없이) */
const sq = (v: string, d: number) => (d === 1 ? `${v}^2` : `\\frac{${v}^2}{${d}}`);
const ellTex = (a2: number, b2: number) => `${sq('x', a2)}+${sq('y', b2)}=1`;
const hypTex = (a2: number, b2: number) => `${sq('x', a2)}-${sq('y', b2)}=1`;
/** x₁x/a² 항: 분모가 1 이면 분수 없이 */
const lin = (c: number, v: string, d: number) =>
  d === 1 ? `${paren(c)}${v}` : `\\frac{${paren(c)}${v}}{${d}}`;
/** y = mx (+n) 의 mx 부분 */
/** 계수 1·-1 은 숫자를 떼고 적는다 */
const coef = (t: string) => (t === '1' ? '' : t === '-1' ? '-' : t);
const mx = (m: number) => (m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`);

/** 분수 답: 정수면 int, 아니면 fraction + answerTex */
function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType' | 'answerTex'> {
  const r = fracAns(n, d);
  return r.includes('/')
    ? { answer: r, answerType: 'fraction', answerTex: `$${fracTex(n, d)}$` }
    : { answer: r, answerType: 'int' };
}

export const generators: Generator[] = [
  {
    id: 'geo-conic-tangent-ellipse-point',
    unitId: UNIT,
    title: '타원 위의 점에서의 접선',
    make(rng) {
      const [a2, b2, ax, ay] = rng.pick(ELL);
      const x1 = flip(rng, ax);
      const y1 = flip(rng, ay);
      const askY = rng.next() < 0.5;
      const C = ellTex(a2, b2);
      const T = `${lin(x1, 'x', a2)}+${lin(y1, 'y', b2)}=1`;
      // 접선의 기울기를 음함수 미분으로 따로 구해 절편을 계산한다(공식을 그대로 옮겨 적지 않으려고)
      const slope = `m0 = idiff(x**2/${a2} + y**2/${b2} - 1, y, x).subs({x: ${x1}, y: ${y1}})`;
      return {
        q: `타원 $${C}$ 위의 점 $(${x1},${y1})$ 에서의 접선의 ${askY ? '$y$절편' : '$x$절편'}을 구하세요.`,
        choices: null,
        ...(askY ? ans(b2, y1) : ans(a2, x1)),
        check: askY ? `${slope}\nans = ${y1} - m0*(${x1})` : `${slope}\nans = ${x1} - (${y1})/m0`,
        concepts: [ELL_PT, SWAP],
        steps: [
          {
            title: '점이 타원 위에 있는지 확인',
            body: `$${sq(paren(x1), a2)}+${sq(paren(y1), b2)}=1$ 이라 타원 위의 점이에요.`,
          },
          {
            title: '접선 공식에 넣기',
            body: `$x^2$ 을 $${paren(x1)}x$ 로, $y^2$ 을 $${paren(y1)}y$ 로 바꿔요.\n$$${T}$$`,
          },
          askY
            ? {
                title: '$x=0$ 넣기',
                body: `$y$절편은 $x=0$ 일 때의 $y$ 값이에요.\n$$${lin(y1, 'y', b2)}=1,\\quad y=${fracTex(b2, y1)}$$`,
              }
            : {
                title: '$y=0$ 넣기',
                body: `$x$절편은 $y=0$ 일 때의 $x$ 값이에요.\n$$${lin(x1, 'x', a2)}=1,\\quad x=${fracTex(a2, x1)}$$`,
              },
        ],
        tip: `절편은 바로 나와요. 접선 $\\frac{x_1x}{a^2}+\\frac{y_1y}{b^2}=1$ 의 $y$절편은 $\\frac{b^2}{y_1}$, $x$절편은 $\\frac{a^2}{x_1}$ 이에요.`,
      };
    },
  },
  {
    id: 'geo-conic-tangent-hyperbola-point',
    unitId: UNIT,
    title: '쌍곡선 위의 점에서의 접선',
    make(rng) {
      const [a2, b2, ax, ay] = rng.pick(HYP);
      const x1 = flip(rng, ax);
      const y1 = flip(rng, ay);
      const askSlope = rng.next() < 0.5;
      const C = hypTex(a2, b2);
      const T = `${lin(x1, 'x', a2)}-${lin(y1, 'y', b2)}=1`;
      const slope = `idiff(x**2/${a2} - y**2/${b2} - 1, y, x).subs({x: ${x1}, y: ${y1}})`;
      // 기울기 = b²x₁/(a²y₁), y절편 = -b²/y₁
      const [sn, sd] = [b2 * x1, a2 * y1];
      return {
        q: `쌍곡선 $${C}$ 위의 점 $(${x1},${y1})$ 에서의 접선의 ${askSlope ? '기울기를' : '$y$절편을'} 구하세요.`,
        choices: null,
        ...(askSlope ? ans(sn, sd) : ans(-b2, y1)),
        check: askSlope ? slope : `m0 = ${slope}\nans = ${y1} - m0*(${x1})`,
        concepts: [HYP_PT, SWAP],
        steps: [
          {
            title: '점이 쌍곡선 위에 있는지 확인',
            body: `$${sq(paren(x1), a2)}-${sq(paren(y1), b2)}=1$ 이라 쌍곡선 위의 점이에요.`,
          },
          {
            title: '접선 공식에 넣기',
            body: `가운데 빼기는 그대로 두고 $x^2\\to${paren(x1)}x$, $y^2\\to${paren(y1)}y$ 로 바꿔요.\n$$${T}$$`,
          },
          askSlope
            ? {
                title: '$y=\\cdots$ 꼴로 정리',
                body: `$y$ 에 대해 풀면 $x$ 앞의 수가 기울기예요.\n$$y=${coef(fracTex(sn, sd))}x${fracTex(-b2, y1).startsWith('-') ? '' : '+'}${fracTex(-b2, y1)}$$`,
              }
            : {
                title: '$x=0$ 넣기',
                body: `$y$절편은 $x=0$ 일 때의 $y$ 값이에요.\n$$-${lin(y1, 'y', b2)}=1,\\quad y=${fracTex(-b2, y1)}$$`,
              },
        ],
        tip: '타원 공식과 모양이 같고 가운데 부호만 빼기예요. 빼기를 더하기로 쓰는 실수가 가장 많아요.',
      };
    },
  },
  {
    id: 'geo-conic-tangent-slope',
    unitId: UNIT,
    title: '기울기가 주어진 접선',
    make(rng) {
      for (;;) {
        const hyp = rng.next() < 0.5;
        const a2 = rng.int(1, 9);
        const b2 = rng.int(1, 9);
        const m = rng.pick([1, 2, 3, -1, -2]);
        const n2 = hyp ? a2 * m * m - b2 : a2 * m * m + b2;
        if (a2 === b2 || n2 <= 0) continue;
        const C = hyp ? hypTex(a2, b2) : ellTex(a2, b2);
        const sgn = hyp ? '-' : '+';
        return {
          q: `직선 $y=${mx(m)}+n$ 이 ${hyp ? '쌍곡선' : '타원'} $${C}$ 에 접할 때, $n^2$ 의 값을 구하세요.`,
          choices: null,
          answer: String(n2),
          answerType: 'int',
          // 대입한 이차방정식(양변에 a²b² 곱함)의 판별식 = 0 에서 n 을 구한다
          check: `ans = expand(solve(discriminant(${b2}*x**2 ${sgn} ${a2}*(${m}*x + n)**2 - ${a2 * b2}, x), n)[0]**2)`,
          concepts: [DISC, hyp ? HYP_M : ELL_M],
          steps: [
            {
              title: '공식의 $a^2$, $b^2$, $m$ 읽기',
              body: `$a^2=${a2}$, $b^2=${b2}$, 기울기 $m=${m}$ 이에요.`,
            },
            {
              title: hyp ? '쌍곡선은 빼기' : '타원은 더하기',
              body: `접할 조건(판별식 $=0$)을 정리하면 $n^2=a^2m^2${sgn}b^2$ 이에요.`,
            },
            {
              title: '계산하기',
              body: `$$n^2=${a2}\\cdot${paren(m)}^2${sgn}${b2}=${n2}$$`,
            },
          ],
          tip: `공식이 헷갈리면 $y=${mx(m)}+n$ 을 곡선의 식에 직접 넣고 판별식이 0 이 되는 $n$ 을 구해도 돼요. 결과는 같아요.`,
        };
      }
    },
  },
  {
    id: 'geo-conic-tangent-parabola',
    unitId: UNIT,
    title: '포물선 위의 점에서의 접선',
    make(rng) {
      const p = rng.int(1, 3);
      const t = flip(rng, rng.int(1, 3));
      // y₁ = 2pt, x₁ = pt² 이면 y₁² = 4px₁ 이 늘 성립한다
      const y1 = 2 * p * t;
      const x1 = p * t * t;
      const askSlope = rng.next() < 0.5;
      const slope = `idiff(y**2 - ${4 * p}*x, y, x).subs({x: ${x1}, y: ${y1}})`;
      return {
        q: `포물선 $y^2=${4 * p}x$ 위의 점 $(${x1},${y1})$ 에서의 접선의 ${askSlope ? '기울기를' : '$y$절편을'} 구하세요.`,
        choices: null,
        ...(askSlope ? ans(2 * p, y1) : ans(y1, 2)),
        check: askSlope ? slope : `m0 = ${slope}\nans = ${y1} - m0*${x1}`,
        concepts: [PAR_PT, '$y^2\\to y_1y$, $x\\to\\frac{x+x_1}{2}$ 로 바꿔요.'],
        steps: [
          {
            title: '$p$ 읽기',
            body: `$4p=${4 * p}$ 이니까 $p=${p}$, $2p=${2 * p}$ 예요.`,
          },
          {
            title: '접선 공식에 넣기',
            body: `$$${paren(y1)}y=${2 * p}(x+${x1})$$`,
          },
          askSlope
            ? {
                title: '기울기 읽기',
                body: `양변을 $${y1}$ 로 나누면 $x$ 앞의 수가 기울기예요.\n$$\\frac{${2 * p}}{${y1}}=${fracTex(2 * p, y1)}$$`,
              }
            : {
                title: '$x=0$ 넣기',
                body: `$$${paren(y1)}y=${2 * p}\\cdot${x1},\\quad y=${fracTex(y1, 2)}$$`,
              },
        ],
        tip: `포물선의 접선은 $x$절편이 늘 $-x_1$ 이에요. 이 문제에서도 $y=0$ 을 넣으면 $x=-${x1}$ 이 나와요.`,
      };
    },
  },
  {
    id: 'geo-conic-tangent-count',
    unitId: UNIT,
    title: '판별식으로 만나는 조건',
    make(rng) {
      for (;;) {
        const a2 = rng.int(1, 9);
        const b2 = rng.int(1, 9);
        const m = rng.pick([1, 2, -1, -2]);
        const N = a2 * m * m + b2;
        if (a2 === b2) continue;
        let r = 0;
        while ((r + 1) * (r + 1) < N) r++;
        const cnt = 2 * r + 1;
        return {
          q: `직선 $y=${mx(m)}+k$ 가 타원 $${ellTex(a2, b2)}$ 와 서로 다른 두 점에서 만나도록 하는 정수 $k$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(cnt),
          answerType: 'int',
          check: `ans = len([k0 for k0 in range(-40, 41) if discriminant(${b2}*x**2 + ${a2}*(${m}*x + k0)**2 - ${a2 * b2}, x) > 0])`,
          concepts: [DISC, ELL_M],
          steps: [
            {
              title: '접할 때의 $k$',
              body: `접선이 되는 것은 $k^2=a^2m^2+b^2=${a2}\\cdot${paren(m)}^2+${b2}=${N}$ 일 때예요.`,
            },
            {
              title: '두 점에서 만날 조건',
              body: `직선이 두 접선 사이에 있어야 해요. 판별식 $D>0$ 을 정리하면\n$$k^2<${N}$$`,
            },
            {
              title: '정수 세기',
              body: `$k^2<${N}$ 인 정수는 $-${r}$ 부터 $${r}$ 까지예요. 개수는 $2\\times${r}+1$ 이에요.`,
            },
          ],
          tip: `$k^2=${N}$ 인 두 값에서는 접하고, 그보다 바깥이면 만나지 않아요. 등호가 들어가는지 꼭 확인해요.`,
        };
      }
    },
  },
];
