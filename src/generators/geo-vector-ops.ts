import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { eul, fracAns, fracTex, gcd, ieyo, paren, ro } from './util.ts';

const UNIT = 'geo-vector-ops';

const COMP =
  '성분으로 계산: $\\vec a=(a_1,a_2)$, $\\vec b=(b_1,b_2)$ 이면 $m\\vec a+n\\vec b=(ma_1+nb_1,\\ ma_2+nb_2)$';
const SIZE = '$\\vec v=(v_1,v_2)$ 의 크기는 $|\\vec v|=\\sqrt{v_1^2+v_2^2}$';
const PARA = '$\\vec a\\parallel\\vec b$ 이면 $\\vec a=t\\vec b$ ($t\\ne0$ 인 실수)';
const SECTION =
  '$\\overline{AB}$ 를 $m:n$ 으로 내분하는 점 $P$: $\\overrightarrow{OP}=\\dfrac{n\\overrightarrow{OA}+m\\overrightarrow{OB}}{m+n}$';

/** 2a, -a, a, -3a 처럼 계수를 벡터 앞에 붙인다(맨 앞 항이면 + 생략) */
function coefVec(c: number, v: string, first: boolean): string {
  const sign = c < 0 ? '-' : first ? '' : '+';
  const a = Math.abs(c);
  return `${sign}${a === 1 ? '' : a}\\vec ${v}`;
}

const vec = (x: number, y: number) => `(${x},${y})`;
/** 계수 1·−1 은 숫자를 빼고 적는다: 1t → t, −1t → −t */
const coefT = (c: number, v: string) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** 식 중간에 붙는 수: +3 / −3 */
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
const flip = (rng: Rng, n: number) => (rng.next() < 0.5 ? -n : n);

// 정수 크기가 나오는 성분 쌍. 무리수 크기가 되면 기초 문제의 초점(성분 계산)이 근호 정리로 흐려진다
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
];

function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType' | 'answerTex'> {
  const r = fracAns(n, d);
  return r.includes('/')
    ? { answer: r, answerType: 'fraction', answerTex: `$${fracTex(n, d)}$` }
    : { answer: r, answerType: 'int' };
}

export const generators: Generator[] = [
  {
    id: 'geo-vector-ops-combo',
    unitId: UNIT,
    title: '성분으로 $m\\vec a+n\\vec b$ 구하기',
    make(rng) {
      for (;;) {
        const a1 = rng.nonzero(-4, 4);
        const a2 = rng.nonzero(-4, 4);
        const b1 = rng.nonzero(-4, 4);
        const b2 = rng.nonzero(-4, 4);
        const m = rng.pick([2, 3, -1, -2]);
        const n = rng.pick([1, 2, 3, -1, -2, -3]);
        const p = m * a1 + n * b1;
        const q = m * a2 + n * b2;
        // 답이 0 이면 "아무것도 안 남는다"로 잘못 맞힐 수 있어 다시 뽑는다
        if (p + q === 0 || p === 0 || q === 0) continue;
        const expr = `${coefVec(m, 'a', true)}${coefVec(n, 'b', false)}`;
        return {
          q: `두 벡터 $\\vec a=${vec(a1, a2)}$, $\\vec b=${vec(b1, b2)}$ 에 대하여 $${expr}=(p,q)$ 일 때, $p+q$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p + q),
          answerType: 'int',
          check: `(${m})*(${a1})+(${n})*(${b1})+(${m})*(${a2})+(${n})*(${b2})`,
          concepts: [COMP],
          steps: [
            {
              title: '$x$성분끼리',
              body: `$$p=${m}\\cdot${paren(a1)}+${paren(n)}\\cdot${paren(b1)}=${m * a1}+${paren(n * b1)}=${p}$$`,
            },
            {
              title: '$y$성분끼리',
              body: `$$q=${m}\\cdot${paren(a2)}+${paren(n)}\\cdot${paren(b2)}=${m * a2}+${paren(n * b2)}=${q}$$`,
            },
            { title: '더하기', body: `$p+q=${p}+${paren(q)}=${p + q}$` },
          ],
          tip: '벡터의 덧셈·실수배는 $x$성분은 $x$성분끼리, $y$성분은 $y$성분끼리 따로 계산하면 돼요.',
        };
      }
    },
  },
  {
    id: 'geo-vector-ops-length',
    unitId: UNIT,
    title: '두 벡터를 더한 벡터의 크기',
    make(rng) {
      for (;;) {
        const [t1, t2, d] = rng.pick(TRIPLES);
        const v1 = flip(rng, t1);
        const v2 = flip(rng, t2);
        const m = rng.pick([1, 2]);
        const n = rng.pick([1, -1]);
        const a1 = rng.nonzero(-3, 3);
        const a2 = rng.nonzero(-3, 3);
        // 결과 벡터(v1,v2)를 먼저 정하고 b 를 거꾸로 구해 크기가 정수가 되게 한다
        const b1 = (v1 - m * a1) / n;
        const b2 = (v2 - m * a2) / n;
        if (b1 === 0 || b2 === 0 || Math.abs(b1) > 9 || Math.abs(b2) > 9) continue;
        const expr = `${coefVec(m, 'a', true)}${coefVec(n, 'b', false)}`;
        return {
          q: `두 벡터 $\\vec a=${vec(a1, a2)}$, $\\vec b=${vec(b1, b2)}$ 에 대하여 $|${expr}|$ 의 값을 구하세요.`,
          choices: null,
          answer: String(d),
          answerType: 'int',
          check: `sqrt(((${m})*(${a1})+(${n})*(${b1}))**2+((${m})*(${a2})+(${n})*(${b2}))**2)`,
          concepts: [COMP, SIZE],
          steps: [
            {
              title: '성분으로 계산',
              body: `$$${expr}=(${m * a1}${signed(n * b1)},\\ ${m * a2}${signed(n * b2)})=${vec(v1, v2)}$$`,
            },
            {
              title: '크기',
              body: `$$\\sqrt{${paren(v1)}^2+${paren(v2)}^2}=\\sqrt{${v1 * v1 + v2 * v2}}=${d}$$`,
            },
          ],
          tip: `$|\\vec a|$ 와 $|\\vec b|$ 를 따로 구해 더하면 안 돼요. 먼저 벡터를 합친 다음 크기를 재요.`,
        };
      }
    },
  },
  {
    id: 'geo-vector-ops-parallel',
    unitId: UNIT,
    title: '평행 조건으로 성분 구하기',
    make(rng) {
      for (;;) {
        const b1 = rng.nonzero(-4, 4);
        const b2 = rng.nonzero(-4, 4);
        if (gcd(Math.abs(b1), Math.abs(b2)) !== 1) continue;
        const t = rng.pick([2, 3, -1, -2, -3]);
        const k = t * b1;
        const a2 = t * b2;
        return {
          q: `두 벡터 $\\vec a=(k,${a2})$, $\\vec b=${vec(b1, b2)}$ 가 서로 평행할 때, 상수 $k$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `solve(Eq(k*(${b2}) - (${a2})*(${b1}), 0), k)[0]`,
          concepts: [PARA],
          steps: [
            {
              title: '평행이면 실수배',
              body: `$\\vec a=t\\vec b$ 라 하면 $(k,${a2})=(${coefT(b1, 't')},\\ ${coefT(b2, 't')})$ 예요.`,
            },
            {
              title: '$y$성분으로 $t$ 구하기',
              body: `$${coefT(b2, 't')}=${a2}$ 에서 $t=${t}$ ${ieyo(t)}.`,
            },
            {
              title: '$x$성분',
              body: `$$k=${b1}\\cdot${paren(t)}=${k}$$`,
            },
          ],
          tip: `거꾸로 확인해요. $${t}\\vec b=(${t * b1},${t * b2})$ 가 $\\vec a$ 와 같으니 맞아요. 평행에는 방향이 반대인 경우($t<0$)도 들어가요.`,
        };
      }
    },
  },
  {
    id: 'geo-vector-ops-section',
    unitId: UNIT,
    title: '내분점의 위치벡터',
    make(rng) {
      const [m, n] = rng.pick([
        [1, 2],
        [2, 1],
        [1, 3],
        [3, 1],
        [2, 3],
        [3, 2],
      ] as const);
      const s = m + n;
      const x1 = rng.int(-5, 5);
      const y1 = rng.int(-5, 5);
      // 성분 차를 m+n 의 배수로 잡아 내분점 성분이 정수가 되게 한다
      const x2 = x1 + s * rng.nonzero(-2, 2);
      const y2 = y1 + s * rng.nonzero(-2, 2);
      const px = (n * x1 + m * x2) / s;
      const py = (n * y1 + m * y2) / s;
      return {
        q: `원점 $O$ 에 대하여 $\\overrightarrow{OA}=${vec(x1, y1)}$, $\\overrightarrow{OB}=${vec(x2, y2)}$ 예요. 선분 $AB$ 를 $${m}:${n}$ ${ro(n)} 내분하는 점 $P$ 에 대하여 $\\overrightarrow{OP}=(p,q)$ 일 때, $p+q$ 의 값을 구하세요.`,
        choices: null,
        ...ans(px + py, 1),
        check: `Rational(${n}*${paren(x1)}+${m}*${paren(x2)}, ${s}) + Rational(${n}*${paren(y1)}+${m}*${paren(y2)}, ${s})`,
        concepts: [SECTION],
        steps: [
          {
            title: '공식 세우기',
            body: `$A$ 쪽에 $${n}$, $B$ 쪽에 $${m}$ ${eul(m)} 곱해요. 비와 엇갈려 곱하니 가까운 점 쪽에 큰 수가 곱해져요.\n$$\\overrightarrow{OP}=\\frac{${coefT(n, '\\overrightarrow{OA}')}+${coefT(m, '\\overrightarrow{OB}')}}{${s}}$$`,
          },
          {
            title: '$x$성분',
            body: `$$p=\\frac{${n}\\cdot${paren(x1)}+${m}\\cdot${paren(x2)}}{${s}}=\\frac{${n * x1 + m * x2}}{${s}}=${px}$$`,
          },
          {
            title: '$y$성분',
            body: `$$q=\\frac{${n}\\cdot${paren(y1)}+${m}\\cdot${paren(y2)}}{${s}}=\\frac{${n * y1 + m * y2}}{${s}}=${py}$$`,
          },
          { title: '더하기', body: `$p+q=${px}+${paren(py)}=${px + py}$` },
        ],
        tip: `$A$ 에서 $B$ 쪽으로 $\\overrightarrow{AB}$ 의 $\\frac{${m}}{${s}}$ 만큼 간 점이라고 보고 $\\overrightarrow{OA}+\\frac{${m}}{${s}}\\overrightarrow{AB}$ 로 검산할 수 있어요.`,
      };
    },
  },
];
