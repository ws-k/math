import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, paren, polySym, polyTex } from './util.ts';

const UNIT = 'm2-linear-func';

// 숫자 뒤 조사. 읽었을 때 끝 글자의 받침은 마지막 자리로 정해진다(일·삼·육·칠·팔·영/십 → 받침).
// 분수·음수도 마지막 자리 숫자로 읽으므로 절댓값의 끝자리만 본다.
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

const CONCEPT_SLOPE = '기울기 = ($y$의 증가량) ÷ ($x$의 증가량)';
const CONCEPT_FORM = '일차함수 $y=ax+b$에서 $a$는 기울기, $b$는 $y$절편이에요.';
const CONCEPT_XINT = '$x$절편은 그래프가 $x$축과 만나는 점의 $x$좌표, 곧 $y=0$일 때의 $x$값이에요.';
const CONCEPT_VALUE = '함숫값 $f(k)$는 식의 $x$ 자리에 $k$를 넣어 계산한 값이에요.';

function answerOf(num: number, den: number): Pick<GenProblem, 'answer' | 'answerType'> {
  return { answer: fracAns(num, den), answerType: num % den === 0 ? 'int' : 'fraction' };
}

/** 0 이 아닌 수. 크기는 lo~hi, 부호는 무작위 */
function signed(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
}

/** 빼기 식에서 음수를 괄호로: 5-(-1) */
const minus = (a: number, b: number) => `${a}-${paren(b)}`;

export const generators: Generator[] = [
  {
    id: 'lf-slope-two-points',
    unitId: UNIT,
    title: '두 점을 지나는 직선의 기울기',
    make(rng) {
      const x1 = rng.int(-5, 5);
      let x2: number;
      do x2 = rng.int(-5, 5);
      while (x2 === x1);
      const y1 = rng.int(-6, 6);
      let y2: number;
      do y2 = rng.int(-6, 6);
      while (y2 === y1);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const m = fracTex(dy, dx);
      return {
        q: `두 점 $(${x1},\\,${y1})$, $(${x2},\\,${y2})$를 지나는 직선의 기울기를 구하세요.`,
        choices: null,
        ...answerOf(dy, dx),
        check: `Rational(${y2} - (${y1}), ${x2} - (${x1}))`,
        concepts: [CONCEPT_SLOPE],
        steps: [
          {
            title: '$x$의 증가량',
            body: `첫 점에서 둘째 점으로 갈 때 $x$는 $${minus(x2, x1)}=${dx}$만큼 변해요.`,
          },
          {
            title: '$y$의 증가량',
            body: `같은 순서로 $y$는 $${minus(y2, y1)}=${dy}$만큼 변해요.`,
          },
          {
            title: '나누기',
            body: `$$\\frac{${dy}}{${dx}}=${m}$$`,
          },
        ],
        tip: '두 증가량은 **같은 순서**(둘째 점 − 첫 점)로 빼야 해요. 한쪽만 거꾸로 빼면 부호가 반대로 나와요.',
      };
    },
  },
  {
    id: 'lf-value',
    unitId: UNIT,
    title: '일차함수의 함숫값',
    make(rng) {
      const a = signed(rng, 1, 6);
      const b = rng.int(-9, 9);
      const k = signed(rng, 1, 6);
      const v = a * k + b;
      const coef = a === 1 ? '' : a === -1 ? '-' : `${a}\\times`;
      const tail = b === 0 ? '' : `${b > 0 ? '+' : '-'}${Math.abs(b)}`;
      return {
        q: `일차함수 $f(x)=${polyTex([a, b])}$에 대하여 $f(${k})$의 값을 구하세요.`,
        choices: null,
        answer: String(v),
        answerType: 'int',
        check: `(${polySym([a, b])}).subs(x, ${k})`,
        concepts: [CONCEPT_VALUE],
        steps: [
          {
            title: `$x$ 자리에 $${k}$ 넣기`,
            body: `$$f(${k})=${coef}${paren(k)}${tail}$$`,
          },
          {
            title: '계산하기',
            body: `$$${a * k}${tail}=${v}$$`,
          },
        ],
        tip: `음수를 넣을 때는 괄호를 씌워요. 그래프로 보면 $x=${k}$인 점의 높이가 $${v}$${ieyo(v)}.`,
      };
    },
  },
  {
    id: 'lf-x-intercept',
    unitId: UNIT,
    title: 'x절편 구하기',
    make(rng) {
      const a = signed(rng, 1, 6);
      let b: number;
      do b = rng.int(-12, 12);
      while (b === 0);
      const r = fracTex(-b, a);
      return {
        q: `일차함수 $y=${polyTex([a, b])}$의 그래프의 $x$절편을 구하세요.`,
        choices: null,
        ...answerOf(-b, a),
        check: `solve(Eq(${polySym([a, b])}, 0), x)[0]`,
        concepts: [CONCEPT_XINT, CONCEPT_FORM],
        steps: [
          {
            title: '$y$에 $0$ 넣기',
            body: `$x$축 위의 점은 $y=0$이에요.\n$$0=${polyTex([a, b])}$$`,
          },
          {
            title: '상수항 옮기기',
            body: `$$${polyTex([a, 0])}=${-b}$$`,
          },
          {
            title: `양변을 $${a}$로 나누기`,
            body: `$$x=${r}$$`,
          },
        ],
        tip: `$y$절편은 식에 보이는 $${b}$${ieyo(b)}. $x$절편과 헷갈리지 않게, $x$절편은 늘 $y=0$을 넣어 구해요.`,
      };
    },
  },
  {
    id: 'lf-intercept-from-point',
    unitId: UNIT,
    title: '기울기와 한 점으로 y절편 구하기',
    make(rng) {
      const a = signed(rng, 1, 5);
      const p = signed(rng, 1, 5);
      const q = rng.int(-9, 9);
      const b = q - a * p;
      return {
        q: `기울기가 $${a}$이고 점 $(${p},\\,${q})$를 지나는 직선의 $y$절편을 구하세요.`,
        choices: null,
        answer: String(b),
        answerType: 'int',
        check: `solve(Eq(${a}*${paren(p)} + b, ${q}), b)[0]`,
        concepts: [
          CONCEPT_FORM,
          '그래프가 점 $(p,\\,q)$를 지나면 식에 $x=p$, $y=q$를 넣어도 등식이 성립해요.',
        ],
        steps: [
          {
            title: '식 세우기',
            body: `기울기가 $${a}$이니 $y=${polyTex([a, 0])}+b$로 둬요.`,
          },
          {
            title: '점 대입하기',
            body: `$x=${p}$, $y=${q}$를 넣어요.\n$$${q}=${a * p}+b$$`,
          },
          {
            title: '$b$ 구하기',
            body: `$$b=${minus(q, a * p)}=${b}$$`,
          },
        ],
        tip: `구한 직선은 $y=${polyTex([a, b])}$${ieyo(b)}. $x=${p}$를 넣으면 $${q}$가 나오는지 확인해요.`,
      };
    },
  },
];
