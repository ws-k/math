import type { Generator } from './types.ts';
import { eul, ieyo, paren, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-continuity';

// 수능 공통 4번(함수의 연속)은 "경계에서 좌극한 = 우극한 = 함숫값" 식 하나를 세워 미정계수를 구하는 꼴이 대부분이라,
// 기초 유형은 모두 그 식 하나를 세우는 연습이다. 검산은 sympy 의 limit·solve 로 문제 조건에서 따로 계산한다.
// 생성기 id 는 단원 id 로 시작한다 — 예전에 다른 단원과 id 가 겹쳐 엉뚱한 문제가 나온 사고가 있었다.

const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

/** x-a 를 TeX 로: a=-3 → "x+3", a=0 → "x" */
const lin = (a: number) => polyTex([1, -a]);

const CONT = '$x=a$ 에서 연속: $\\lim_{x\\to a}f(x)=f(a)$ (극한값과 함숫값이 같아요)';
const SIDES = '경계에서 연속이려면 좌극한 = 우극한 = 함숫값';

export const generators: Generator[] = [
  {
    id: 'math2-continuity-hole-fill',
    unitId: UNIT,
    title: '구멍을 메우는 함숫값',
    make(rng) {
      for (;;) {
        const a = rng.int(-3, 4);
        const b = rng.int(-5, 5);
        const k = a - b;
        if (b === a || k === 0) continue;
        const num = [1, -(a + b), a * b];
        return {
          q: `함수\n$$f(x)=\\begin{cases}\\dfrac{${polyTex(num)}}{${lin(a)}} & (x\\ne ${a})\\\\ k & (x=${a})\\end{cases}$$\n가 $x=${a}$ 에서 연속일 때, 상수 $k$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `limit((${polySym(num)})/(x - (${a})), x, ${a})`,
          concepts: [CONT, '$\\frac00$ 꼴은 인수분해해서 약분해요.'],
          steps: [
            {
              title: '연속의 조건',
              body: `$x=${a}$ 에서 연속이려면 $\\displaystyle\\lim_{x\\to ${a}}f(x)=f(${a})=k$ 여야 해요.`,
            },
            {
              title: '분자 인수분해',
              body: `$$${polyTex(num)}=(${lin(a)})(${lin(b)})$$`,
            },
            {
              title: '약분해서 극한 구하기',
              body: `$$\\lim_{x\\to ${a}}\\frac{(${lin(a)})(${lin(b)})}{${lin(a)}}=\\lim_{x\\to ${a}}(${lin(b)})=${a}${signed(-b)}=${k}$$`,
            },
            { title: '$k$ 정하기', body: `극한값과 같아야 하므로 $k=${k}$ ${ieyo(k)}.` },
          ],
          tip: `분자에 $x=${a}$ ${eul(a)} 넣은 값 $0$ 을 $k$ 로 고르는 실수가 많아요. 구멍을 메우는 값은 함숫값이 아니라 극한값이에요.`,
        };
      }
    },
  },
  {
    id: 'math2-continuity-piecewise',
    unitId: UNIT,
    title: '경계에서 이어 붙이기',
    make(rng) {
      for (;;) {
        const a = rng.int(-2, 3);
        const p = rng.nonzero(-4, 4);
        const q = rng.int(-4, 4);
        const r = rng.int(-5, 5);
        // 연속이 되게 하는 k: pa + k = a^2 + qa + r
        const right = a * a + q * a + r;
        const k = right - p * a;
        if (k === 0) continue;
        const R = polyTex([1, q, r]);
        return {
          q: `함수\n$$f(x)=\\begin{cases}${polyTex([p, 0])}+k & (x<${a})\\\\ ${R} & (x\\ge ${a})\\end{cases}$$\n가 실수 전체의 집합에서 연속일 때, 상수 $k$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `solve(Eq(limit(${p}*x + k, x, ${a}, '-'), (${polySym([1, q, r])}).subs(x, ${a})), k)[0]`,
          concepts: [CONT, SIDES, '각 조각은 다항식이라 경계가 아닌 곳에서는 저절로 연속이에요.'],
          steps: [
            {
              title: '살펴볼 곳',
              body: `두 조각은 다항식이라 각자 연속이에요. 끊길 수 있는 곳은 경계 $x=${a}$ 하나예요.`,
            },
            {
              title: '함숫값과 우극한',
              body: `$x\\ge ${a}$ 쪽 식에 넣어요.\n$$f(${a})=${paren(a)}^2${q === 0 ? '' : `${signed(q)}\\cdot ${paren(a)}`}${r === 0 ? '' : signed(r)}=${right}$$`,
            },
            {
              title: '좌극한',
              body: `$$\\lim_{x\\to ${a}-}f(x)=${p}\\cdot ${paren(a)}+k=${p * a}+k$$`,
            },
            {
              title: '같다고 놓고 풀기',
              body: `$${p * a}+k=${right}$ 이므로 $k=${k}$ ${ieyo(k)}.`,
            },
          ],
          tip: '함숫값 $f(a)$ 는 등호($\\ge$)가 붙은 쪽 식으로 구해요. 이 문제는 그 값이 우극한과도 같아서, 좌극한과 맞추기만 하면 돼요.',
        };
      }
    },
  },
  {
    id: 'math2-continuity-ivt-count',
    unitId: UNIT,
    title: '사잇값 정리로 근의 위치',
    make(rng) {
      for (;;) {
        const m = rng.int(0, 2);
        const b = rng.int(0, 3);
        const f0 = [1, 0, b, 0];
        const lo = polyEval(f0, m);
        const hi = polyEval(f0, m + 1);
        const count = hi - lo - 1;
        if (count < 2 || count > 40) continue;
        const F = `${polyTex(f0)}-k`;
        return {
          q: `함수 $f(x)=${F}$ 에 대하여 방정식 $f(x)=0$ 이 열린구간 $(${m},\\,${m + 1})$ 에서 실근을 갖도록 하는 정수 $k$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(count),
          answerType: 'int',
          check: `f = ${polySym(f0)}\nans = len([j for j in range(-300, 300) if f.subs(x, ${m}) - j < 0 < f.subs(x, ${m + 1}) - j])`,
          concepts: [
            '사잇값 정리: $f$ 가 $[a,\\,b]$ 에서 연속이고 $f(a)f(b)<0$ 이면 $(a,\\,b)$ 에 $f(c)=0$ 인 $c$ 가 있어요.',
            `$${polyTex(f0)}$ 는 늘 증가해요.`,
          ],
          steps: [
            {
              title: '증가함수 확인',
              body: `$${polyTex(f0)}$ 는 $x$ 가 커지면 늘 커지므로 $f(x)$ 도 증가해요. 그래서 근이 구간 안에 있으려면 왼쪽 끝은 음수, 오른쪽 끝은 양수여야 해요.`,
            },
            {
              title: '왼쪽 끝',
              body: `$f(${m})=${lo}-k<0$ 이므로 $k>${lo}$`,
            },
            {
              title: '오른쪽 끝',
              body: `$f(${m + 1})=${hi}-k>0$ 이므로 $k<${hi}$`,
            },
            {
              title: '정수 세기',
              body: `$${lo}<k<${hi}$ 인 정수는 $${lo + 1}$ 부터 $${hi - 1}$ 까지 $${count}$ 개예요.`,
            },
          ],
          tip: `끝값 $k=${lo}$ 이나 $k=${hi}$ 이면 근이 구간의 끝($x=${m}$ 또는 $x=${m + 1}$)에 생겨 열린구간 밖이에요. 그래서 등호가 빠져요.`,
        };
      }
    },
  },
];
