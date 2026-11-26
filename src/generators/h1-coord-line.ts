import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { eul, fracAns, fracTex, gcd, gwa, paren, ro } from './util.ts';

const UNIT = 'h1-coord-line';

const DIST = '두 점 $(x_1,y_1)$, $(x_2,y_2)$ 사이 거리는 $\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}$ 이에요.';
const INNER =
  '$m:n$ 내분점은 $\\left(\\frac{mx_2+nx_1}{m+n},\\frac{my_2+ny_1}{m+n}\\right)$ 이에요.';
const CEN =
  '무게중심은 $\\left(\\frac{x_1+x_2+x_3}{3},\\frac{y_1+y_2+y_3}{3}\\right)$, 세 꼭짓점 좌표의 평균이에요.';
const LINE = '점 $(x_1,y_1)$ 을 지나고 기울기가 $m$ 인 직선은 $y-y_1=m(x-x_1)$ 이에요.';
const PTL =
  '점 $(x_1,y_1)$ 과 직선 $ax+by+c=0$ 사이 거리는 $\\frac{|ax_1+by_1+c|}{\\sqrt{a^2+b^2}}$ 예요.';

// 정수 거리가 나오는 가로·세로 차. 답이 무리수가 되면 기초 문제의 초점(공식 적용)이 근호 정리로 흐려진다
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
];

const flip = (rng: Rng, n: number) => (rng.next() < 0.5 ? -n : n);

/** 점 좌표 TeX */
const pt = (x: number, y: number) => `(${x},${y})`;
/** a − b 를 괄호 붙여 적기: 5−(−2) */
const minus = (a: number, b: number) => `${a}-${paren(b)}`;
/** +3 / −3 (식 중간에 붙는 항) */
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType' | 'answerTex'> {
  const r = fracAns(n, d);
  return r.includes('/')
    ? { answer: r, answerType: 'fraction', answerTex: `$${fracTex(n, d)}$` }
    : { answer: r, answerType: 'int' };
}

export const generators: Generator[] = [
  {
    id: 'cl-distance',
    unitId: UNIT,
    title: '두 점 사이의 거리',
    make(rng) {
      const [a, b, d] = rng.pick(TRIPLES);
      const x1 = rng.int(-5, 5);
      const y1 = rng.int(-5, 5);
      const x2 = x1 + flip(rng, a);
      const y2 = y1 + flip(rng, b);
      return {
        q: `두 점 $A${pt(x1, y1)}$, $B${pt(x2, y2)}$ 사이의 거리를 구하세요.`,
        choices: null,
        answer: String(d),
        answerType: 'int',
        check: `sqrt((${x2}-${paren(x1)})**2+(${y2}-${paren(y1)})**2)`,
        concepts: [DIST],
        steps: [
          {
            title: '가로 차·세로 차',
            body: `가로 차는 $${minus(x2, x1)}=${x2 - x1}$, 세로 차는 $${minus(y2, y1)}=${y2 - y1}$ 이에요.`,
          },
          {
            title: '제곱해서 더하기',
            body: `$$${paren(x2 - x1)}^2+${paren(y2 - y1)}^2=${a * a}+${b * b}=${d * d}$$`,
          },
          { title: '제곱근', body: `$\\sqrt{${d * d}}=${d}$ 이에요.` },
        ],
        tip: '빼는 순서는 어느 쪽이든 괜찮아요. 제곱하면 부호가 사라지기 때문이에요.',
      };
    },
  },
  {
    id: 'cl-inner',
    unitId: UNIT,
    title: '내분점의 좌표',
    make(rng) {
      const [m, n] = rng.pick([
        [1, 2],
        [2, 1],
        [1, 3],
        [3, 1],
        [2, 3],
        [3, 2],
      ] as const);
      const k = m + n;
      const x1 = rng.int(-6, 6);
      const y1 = rng.int(-6, 6);
      // 좌표 차를 m+n 의 배수로 잡아 내분점이 정수 칸에 오게 한다
      const x2 = x1 + k * rng.nonzero(-2, 2);
      const y2 = y1 + k * rng.nonzero(-2, 2);
      const px = (m * x2 + n * x1) / k;
      const py = (m * y2 + n * y1) / k;
      return {
        q: `두 점 $A${pt(x1, y1)}$, $B${pt(x2, y2)}$ ${eul(y2)} 잇는 선분 $AB$ 를 $${m}:${n}$ ${ro(n)} 내분하는 점을 $P(a,b)$ 라 할 때, $a+b$ 의 값을 구하세요.`,
        choices: null,
        answer: String(px + py),
        answerType: 'int',
        check: `Rational(${m}*${paren(x2)}+${n}*${paren(x1)}, ${k}) + Rational(${m}*${paren(y2)}+${n}*${paren(y1)}, ${k})`,
        concepts: [INNER],
        steps: [
          {
            title: '$x$좌표',
            body: `$B$ 쪽에 ${m}, $A$ 쪽에 ${n}${n === 2 ? '를' : '을'} 곱해요.\n$$a=\\frac{${m}\\cdot${paren(x2)}+${n}\\cdot${paren(x1)}}{${k}}=\\frac{${m * x2 + n * x1}}{${k}}=${px}$$`,
          },
          {
            title: '$y$좌표',
            body: `$$b=\\frac{${m}\\cdot${paren(y2)}+${n}\\cdot${paren(y1)}}{${k}}=\\frac{${m * y2 + n * y1}}{${k}}=${py}$$`,
          },
          { title: '더하기', body: `$a+b=${px}${signed(py)}=${px + py}$ 이에요.` },
        ],
        tip: `$A$ 에서 $B$ 쪽으로 전체의 $\\frac{${m}}{${k}}$ 만큼 간 점이라고 생각하면 검산할 수 있어요.`,
      };
    },
  },
  {
    id: 'cl-centroid',
    unitId: UNIT,
    title: '삼각형의 무게중심',
    make(rng) {
      let gx: number;
      let gy: number;
      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;
      let x3: number;
      let y3: number;
      // 세 점이 한 직선 위에 있으면 삼각형이 아니므로 다시 뽑는다. 무게중심을 먼저 정해 답이 정수가 되게 한다
      do {
        gx = rng.int(-3, 3);
        gy = rng.int(-3, 3);
        x1 = rng.int(-6, 6);
        y1 = rng.int(-6, 6);
        x2 = rng.int(-6, 6);
        y2 = rng.int(-6, 6);
        x3 = 3 * gx - x1 - x2;
        y3 = 3 * gy - y1 - y2;
      } while (
        (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1) === 0 ||
        Math.abs(x3) > 9 ||
        Math.abs(y3) > 9
      );
      return {
        q: `세 점 $A${pt(x1, y1)}$, $B${pt(x2, y2)}$, $C${pt(x3, y3)}$ ${eul(y3)} 꼭짓점으로 하는 삼각형의 무게중심을 $(a,b)$ 라 할 때, $a+b$ 의 값을 구하세요.`,
        choices: null,
        answer: String(gx + gy),
        answerType: 'int',
        check: `Rational(${x1}+${paren(x2)}+${paren(x3)}, 3) + Rational(${y1}+${paren(y2)}+${paren(y3)}, 3)`,
        concepts: [CEN],
        steps: [
          {
            title: '$x$좌표',
            body: `$$a=\\frac{${x1}${signed(x2)}${signed(x3)}}{3}=\\frac{${3 * gx}}{3}=${gx}$$`,
          },
          {
            title: '$y$좌표',
            body: `$$b=\\frac{${y1}${signed(y2)}${signed(y3)}}{3}=\\frac{${3 * gy}}{3}=${gy}$$`,
          },
          { title: '더하기', body: `$a+b=${gx}${signed(gy)}=${gx + gy}$ 이에요.` },
        ],
        tip: '무게중심은 중선을 꼭짓점 쪽에서 $2:1$ 로 나누는 점이기도 해요.',
      };
    },
  },
  {
    id: 'cl-line-two',
    unitId: UNIT,
    title: '두 점을 지나는 직선의 y절편',
    make(rng) {
      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;
      // 세로선(기울기 없음)·가로선(기울기 0)은 이 유형의 뜻에서 벗어나므로 피한다
      do {
        x1 = rng.int(-5, 5);
        y1 = rng.int(-6, 6);
        x2 = rng.int(-5, 5);
        y2 = rng.int(-6, 6);
      } while (x1 === x2 || y1 === y2 || x1 === 0 || x2 === 0);
      const sn = y2 - y1;
      const sd = x2 - x1;
      // y절편 = y1 − m·x1 = (y1·sd − sn·x1)/sd
      const bn = y1 * sd - sn * x1;
      return {
        q: `두 점 $${pt(x1, y1)}$, $${pt(x2, y2)}$ ${eul(y2)} 지나는 직선의 $y$절편을 구하세요.`,
        choices: null,
        ...ans(bn, sd),
        check: `${y1} - Rational(${sn}, ${sd})*${paren(x1)}`,
        concepts: [
          LINE,
          '기울기는 $\\frac{y_2-y_1}{x_2-x_1}$, $y$절편은 $x=0$ 일 때의 $y$ 값이에요.',
        ],
        steps: [
          {
            title: '기울기',
            body: `$$m=\\frac{${minus(y2, y1)}}{${minus(x2, x1)}}=${fracTex(sn, sd)}$$`,
          },
          {
            title: '직선의 식',
            body: `점 $${pt(x1, y1)}$ ${eul(y1)} 지나므로\n$$y-${paren(y1)}=${fracTex(sn, sd)}\\left(x-${paren(x1)}\\right)$$`,
          },
          {
            title: '$x=0$ 넣기',
            body: `$$y=${y1}-${paren(fracTex(sn, sd))}\\cdot${paren(x1)}=${fracTex(bn, sd)}$$`,
          },
        ],
        tip: '다른 점을 넣어도 같은 직선이라 $y$절편이 같아야 해요. 검산에 써 보세요.',
      };
    },
  },
  {
    id: 'cl-pt-line',
    unitId: UNIT,
    title: '점과 직선 사이의 거리',
    make(rng) {
      const [ta, tb, r] = rng.pick(TRIPLES);
      const a = flip(rng, ta);
      const b = flip(rng, tb);
      const px = rng.int(-4, 4);
      const py = rng.int(-4, 4);
      let c: number;
      // 점이 직선 위에 있으면 거리 0 이라 다시 뽑는다
      do c = rng.int(-15, 15);
      while (a * px + b * py + c === 0);
      const v = a * px + b * py + c;
      const line = `${a}x${signed(b)}y${c === 0 ? '' : signed(c)}=0`;
      return {
        q: `점 $${pt(px, py)}$ ${gwa(py)} 직선 $${line}$ 사이의 거리를 구하세요.`,
        choices: null,
        ...ans(Math.abs(v), r),
        check: `Abs(${a}*${paren(px)}+${paren(b)}*${paren(py)}+${paren(c)})/sqrt(${paren(a)}**2+${paren(b)}**2)`,
        concepts: [PTL],
        steps: [
          {
            title: '분자: 점을 넣고 절댓값',
            body: `$$|${a}\\cdot${paren(px)}${b < 0 ? '' : '+'}${b}\\cdot${paren(py)}${c === 0 ? '' : signed(c)}|=|${v}|=${Math.abs(v)}$$`,
          },
          {
            title: '분모',
            body: `$$\\sqrt{${paren(a)}^2+${paren(b)}^2}=\\sqrt{${r * r}}=${r}$$`,
          },
          {
            title: '나누기',
            body:
              gcd(Math.abs(v), r) === 1
                ? `$$\\frac{${Math.abs(v)}}{${r}}$$`
                : `$$\\frac{${Math.abs(v)}}{${r}}=${fracTex(Math.abs(v), r)}$$`,
          },
        ],
        tip: '직선을 꼭 $ax+by+c=0$ 꼴(오른쪽이 0)로 둔 뒤 점을 넣어요.',
      };
    },
  },
];
