import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { eul, fracAns, fracTex, ieyo, paren, polyTex } from './util.ts';

const UNIT = 'm2-linear-func-eq';

const CONCEPT_GRAPH =
  '일차방정식 $ax+by+c=0\\ (b\\neq0)$의 그래프는 일차함수 $y=-\\frac{a}{b}x-\\frac{c}{b}$의 그래프와 같아요.';
const CONCEPT_ON = '점이 그래프 위에 있으면 그 점의 좌표를 식에 넣었을 때 등식이 성립해요.';
const CONCEPT_MEET = '두 일차방정식의 그래프의 교점의 좌표는 두 식을 연립한 방정식의 해예요.';

/** a·x + b·y + c 의 TeX. 계수 0 인 항은 뺀다 */
function linTex(a: number, b: number, c: number): string {
  const parts: [number, string][] = [
    [a, 'x'],
    [b, 'y'],
    [c, ''],
  ];
  let out = '';
  for (const [k, v] of parts) {
    if (k === 0) continue;
    const sign = k < 0 ? '-' : out === '' ? '' : '+';
    const abs = Math.abs(k);
    out += sign + (abs === 1 && v ? '' : String(abs)) + v;
  }
  return out || '0';
}

/** 같은 식의 sympy 글자 */
const linSym = (a: number, b: number, c: number) => `${a}*x + ${paren(b)}*y + ${paren(c)}`;

function signed(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
}

function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType'> {
  return { answer: fracAns(n, d), answerType: n % d === 0 ? 'int' : 'fraction' };
}

export const generators: Generator[] = [
  {
    id: 'lfe-slope-intercept',
    unitId: UNIT,
    title: '일차방정식의 그래프의 기울기·절편',
    make(rng) {
      const a = signed(rng, 1, 6);
      let b: number;
      do b = signed(rng, 2, 5);
      while (Math.abs(a) === Math.abs(b));
      const c = signed(rng, 1, 12);
      const ask = rng.pick(['slope', 'yint', 'xint'] as const);
      const eq = `${linTex(a, b, c)}=0`;
      const sym = linSym(a, b, c);
      const ytex = `${linTex(-a, 0, -c)}`;
      // b 로 나누기 전 모양: by = -ax - c
      const solveSteps = [
        {
          title: '$y$ 항만 남기기',
          body: `$x$ 항과 상수항을 오른쪽으로 이항해요.\n$$${polyTex([b, 0], 'y')}=${ytex}$$`,
        },
        {
          title: `양변을 $${b}$로 나누기`,
          body: `$$y=${fracTex(-a, b)}x${(() => {
            const t = fracTex(-c, b);
            return t.startsWith('-') ? t : `+${t}`;
          })()}$$`
            .replace('y=1x', 'y=x')
            .replace('y=-1x', 'y=-x'),
        },
      ];
      if (ask === 'slope') {
        return {
          q: `일차방정식 $${eq}$의 그래프의 기울기를 구하세요.`,
          choices: null,
          ...ans(-a, b),
          check: `solve(Eq(${sym}, 0), y)[0].coeff(x)`,
          concepts: [CONCEPT_GRAPH],
          steps: [
            ...solveSteps,
            {
              title: '기울기 읽기',
              body: `$x$의 계수가 기울기예요.\n$$\\text{기울기}=${fracTex(-a, b)}$$`,
            },
          ],
          tip: `외워도 돼요. $ax+by+c=0$의 기울기는 $-\\frac{a}{b}$예요. 부호를 놓치기 쉬우니 $y$에 대해 풀어서 확인해요.`,
        };
      }
      if (ask === 'yint') {
        return {
          q: `일차방정식 $${eq}$의 그래프의 $y$절편을 구하세요.`,
          choices: null,
          ...ans(-c, b),
          check: `solve(Eq(${sym}, 0).subs(x, 0), y)[0]`,
          concepts: [
            CONCEPT_GRAPH,
            '$y$절편은 그래프가 $y$축과 만나는 점의 $y$좌표예요. $x=0$을 넣어요.',
          ],
          steps: [
            {
              title: '$x=0$ 넣기',
              body: `$y$축 위에서는 $x=0$이에요.\n$$${linTex(0, b, c)}=0$$`,
            },
            {
              title: '$y$ 구하기',
              body: `$$${polyTex([b, 0], 'y')}=${-c}$$\n$$y=${fracTex(-c, b)}$$`,
            },
          ],
          tip: '$y$절편은 $x=0$, $x$절편은 $y=0$을 넣어요. 거꾸로 넣는 실수가 가장 많아요.',
        };
      }
      return {
        q: `일차방정식 $${eq}$의 그래프의 $x$절편을 구하세요.`,
        choices: null,
        ...ans(-c, a),
        check: `solve(Eq(${sym}, 0).subs(y, 0), x)[0]`,
        concepts: [
          CONCEPT_GRAPH,
          '$x$절편은 그래프가 $x$축과 만나는 점의 $x$좌표예요. $y=0$을 넣어요.',
        ],
        steps: [
          {
            title: '$y=0$ 넣기',
            body: `$x$축 위에서는 $y=0$이에요.\n$$${linTex(a, 0, c)}=0$$`,
          },
          {
            title: '$x$ 구하기',
            body: `$$${polyTex([a, 0])}=${-c}$$\n$$x=${fracTex(-c, a)}$$`,
          },
        ],
        tip: '$x$절편은 $y=0$, $y$절편은 $x=0$을 넣어요. 거꾸로 넣는 실수가 가장 많아요.',
      };
    },
  },
  {
    id: 'lfe-through-point',
    unitId: UNIT,
    title: '그래프가 지나는 점으로 계수 구하기',
    make(rng) {
      let a: number;
      let b: number;
      let p: number;
      let q: number;
      let c: number;
      do {
        a = signed(rng, 1, 5);
        b = signed(rng, 1, 5);
        p = rng.nonzero(-4, 4);
        q = rng.int(-4, 4);
        c = -(a * p + b * q);
      } while (c === 0);
      const shown = `ax${linTex(0, b, c).startsWith('-') ? '' : '+'}${linTex(0, b, c)}=0`;
      const rest = b * q + c;
      // 계수 1·-1 은 숫자를 빼고 적는다(1a → a)
      const pa = p === 1 ? 'a' : p === -1 ? '-a' : `${p}a`;
      return {
        q: `일차방정식 $${shown}$의 그래프가 점 $(${p},\\ ${q})$${eul(q)} 지날 때, 상수 $a$의 값을 구하세요.`,
        choices: null,
        ...ans(a, 1),
        check: `solve(Eq(a*${paren(p)} + ${paren(b)}*${paren(q)} + ${paren(c)}, 0), a)[0]`,
        concepts: [CONCEPT_ON],
        steps: [
          {
            title: '점의 좌표 넣기',
            body: `$x=${p}$, $y=${q}$${eul(q)} 넣어요.\n$$a\\times${paren(p)}+${paren(b)}\\times${paren(q)}${c < 0 ? '' : '+'}${c}=0$$`,
          },
          {
            title: '상수끼리 계산하기',
            body: `$$${pa}${rest < 0 ? '' : '+'}${rest}=0$$`,
          },
          {
            title: '$a$ 구하기',
            body: `$$${pa}=${-rest}$$\n$$a=${fracTex(-rest, p)}$$`,
          },
        ],
        tip: `검산: $a=${a}$이면 $${linTex(a, b, c)}=0$이고, $x=${p}$, $y=${q}$${eul(q)} 넣으면 $${a * p}${b * q < 0 ? '' : '+'}${b * q}${c < 0 ? '' : '+'}${c}=0$이에요.`,
      };
    },
  },
  {
    id: 'lfe-intersection',
    unitId: UNIT,
    title: '두 직선의 교점',
    make(rng) {
      let x0: number;
      let y0: number;
      let a1: number;
      let a2: number;
      let b2: number;
      do {
        x0 = rng.int(-4, 5);
        y0 = rng.int(-4, 5);
        a1 = signed(rng, 1, 4);
        a2 = signed(rng, 1, 4);
        b2 = signed(rng, 1, 4);
      } while (a2 - a1 * b2 === 0 || x0 + y0 === 0);
      const c1 = a1 * x0 + y0;
      const c2 = a2 * x0 + b2 * y0;
      const k = a2 - a1 * b2;
      const e1 = `${linTex(a1, 1, 0)}=${c1}`;
      const e2 = `${linTex(a2, b2, 0)}=${c2}`;
      const yExpr = polyTex([-a1, c1]);
      return {
        q: `두 일차방정식 $${e1}$, $${e2}$의 그래프의 교점의 좌표를 $(p,\\ q)$라 할 때, $p+q$의 값을 구하세요.`,
        choices: null,
        ...ans(x0 + y0, 1),
        check: `sum(solve([Eq(${linSym(a1, 1, 0)}, ${c1}), Eq(${linSym(a2, b2, 0)}, ${c2})], [x, y]).values())`,
        concepts: [CONCEPT_MEET, '대입법: 한 식을 한 문자에 대해 풀어 다른 식에 넣어요.'],
        steps: [
          {
            title: '연립방정식으로 바꾸기',
            body: `교점은 두 그래프 위에 함께 있으니 두 식을 동시에 만족해요.\n$$\\begin{cases}${e1}\\\\${e2}\\end{cases}$$`,
          },
          {
            title: '첫 식을 $y$에 대해 풀기',
            body: `$$y=${yExpr}$$`,
          },
          {
            title: '둘째 식에 대입하기',
            body: `$$${polyTex([a2, 0])}${b2 === 1 ? '+' : b2 === -1 ? '-' : b2 < 0 ? b2 : `+${b2}`}(${yExpr})=${c2}$$\n$$${polyTex([k, b2 * c1])}=${c2}$$`,
          },
          {
            title: '$x$ 구하기',
            body: `$$${polyTex([k, 0])}=${c2 - b2 * c1}$$\n$$x=${x0}$$`,
          },
          {
            title: '$y$ 구하기',
            body: `$y=${yExpr}$에 $x=${x0}$${eul(x0)} 넣으면 $y=${y0}$${ieyo(y0)}.`,
          },
          {
            title: '$p+q$ 계산하기',
            body: `$$p+q=${x0}+${paren(y0)}=${x0 + y0}$$`,
          },
        ],
        tip: `교점을 구하면 두 식에 모두 넣어 확인해요. $(${x0},\\ ${y0})$${eul(y0)} 넣으면 두 식이 다 맞아요.`,
      };
    },
  },
];
