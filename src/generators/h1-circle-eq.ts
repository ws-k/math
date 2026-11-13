import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns, fracTex, paren } from './util.ts';

const UNIT = 'h1-circle-eq';

const STD = '중심 $(a,b)$, 반지름 $r$ 인 원은 $(x-a)^2+(y-b)^2=r^2$ 이에요.';
const GEN = '$x^2+y^2+Ax+By+C=0$ 은 $x$ 끼리, $y$ 끼리 완전제곱식으로 묶어 표준형으로 바꿔요.';
const POS =
  '중심과 직선 사이 거리 $d$ 와 반지름 $r$ 을 비교해요. $d<r$ 두 점, $d=r$ 한 점(접함), $d>r$ 만나지 않음.';
const PTL =
  '점 $(x_1,y_1)$ 과 직선 $ax+by+c=0$ 사이 거리는 $\\frac{|ax_1+by_1+c|}{\\sqrt{a^2+b^2}}$ 예요.';
const TAN = '$x^2+y^2=r^2$ 위의 점 $(x_1,y_1)$ 에서의 접선은 $x_1x+y_1y=r^2$ 이에요.';

const flip = (rng: Rng, n: number) => (rng.next() < 0.5 ? -n : n);
/** 식 중간 항: +3 / −3 */
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
/** 계수 붙은 항: 1·x → +x, −1·x → −x, 0 → 빈 글자 */
const term = (k: number, v: string) =>
  k === 0 ? '' : `${k < 0 ? '-' : '+'}${Math.abs(k) === 1 ? '' : Math.abs(k)}${v}`;
/** (x−a) 꼴: a=0 이면 x, a<0 이면 x+|a| */
const shift = (v: string, a: number) => (a === 0 ? v : `(${v}${signed(-a)})`);

function ans(n: number, d: number): Pick<GenProblem, 'answer' | 'answerType' | 'answerTex'> {
  const r = fracAns(n, d);
  return r.includes('/')
    ? { answer: r, answerType: 'fraction', answerTex: `$${fracTex(n, d)}$` }
    : { answer: r, answerType: 'int' };
}

// 숫자 뒤 조사. 읽었을 때 끝 글자 받침으로 정한다(영·일·삼·육·칠·팔·십 → 받침, 일·칠·팔은 ㄹ 받침)
const hasB = (n: number) => [0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10);
const eul = (n: number) => (hasB(n) ? '을' : '를');
const gwa = (n: number) => (hasB(n) ? '과' : '와');
/** 맨 앞 계수: 1·x → x, −1·x → −x */
const lead = (k: number, v: string) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);

export const generators: Generator[] = [
  {
    id: 'ce-general',
    unitId: UNIT,
    title: '일반형에서 중심·반지름 읽기',
    make(rng) {
      let a: number;
      let b: number;
      do {
        a = rng.int(-5, 5);
        b = rng.int(-5, 5);
      } while (a === 0 || b === 0);
      const r = rng.int(1, 6);
      const A = -2 * a;
      const B = -2 * b;
      const Cc = a * a + b * b - r * r;
      const eq = `x^2+y^2${term(A, 'x')}${term(B, 'y')}${Cc === 0 ? '' : signed(Cc)}=0`;
      const steps = [
        {
          title: '$x$ 묶기',
          body: `$$x^2${term(A, 'x')}=${shift('x', a)}^2-${a * a}$$`,
        },
        {
          title: '$y$ 묶기',
          body: `$$y^2${term(B, 'y')}=${shift('y', b)}^2-${b * b}$$`,
        },
        {
          title: '표준형',
          body: `$$${shift('x', a)}^2+${shift('y', b)}^2=${a * a}+${b * b}${Cc === 0 ? '' : signed(-Cc)}=${r * r}$$`,
        },
      ];
      if (rng.next() < 0.5) {
        return {
          q: `원 $${eq}$ 의 반지름의 길이를 구하세요.`,
          choices: null,
          answer: String(r),
          answerType: 'int',
          check: `sqrt(Rational(${A}, 2)**2+Rational(${B}, 2)**2-${paren(Cc)})`,
          concepts: [GEN, STD],
          steps: [...steps, { title: '반지름', body: `$r^2=${r * r}$ 이므로 $r=${r}$ 이에요.` }],
          tip: '반지름의 제곱에서 멈추지 말고 제곱근까지 구해요.',
        };
      }
      return {
        q: `원 $${eq}$ 의 중심의 좌표를 $(p,q)$ 라 할 때, $p+q$ 의 값을 구하세요.`,
        choices: null,
        answer: String(a + b),
        answerType: 'int',
        check: `-Rational(${A}, 2)-Rational(${B}, 2)`,
        concepts: [GEN, STD],
        steps: [
          ...steps,
          {
            title: '중심 읽기',
            body: `괄호 안 부호를 바꿔 읽어 중심은 $(${a},${b})$, $p+q=${a}${signed(b)}=${a + b}$ 이에요.`,
          },
        ],
        tip: '중심은 $\\left(-\\frac{A}{2},-\\frac{B}{2}\\right)$ 로 바로 읽을 수도 있어요.',
      };
    },
  },
  {
    id: 'ce-through',
    unitId: UNIT,
    title: '중심과 지나는 점으로 원 만들기',
    make(rng) {
      const a = rng.int(-4, 4);
      const b = rng.int(-4, 4);
      let dx: number;
      let dy: number;
      do {
        dx = rng.int(-5, 5);
        dy = rng.int(-5, 5);
      } while (dx === 0 && dy === 0);
      const p = a + dx;
      const q = b + dy;
      return {
        q: `중심이 $(${a},${b})$ 이고 점 $(${p},${q})$ ${eul(q)} 지나는 원의 방정식을 $(x-a)^2+(y-b)^2=r^2$ 이라 할 때, $r^2$ 의 값을 구하세요.`,
        choices: null,
        answer: String(dx * dx + dy * dy),
        answerType: 'int',
        check: `(${p}-${paren(a)})**2+(${q}-${paren(b)})**2`,
        concepts: [STD, '반지름은 중심에서 원 위의 점까지 거리예요.'],
        steps: [
          {
            title: '반지름의 제곱 = 거리의 제곱',
            body: `$$r^2=(${p}-${paren(a)})^2+(${q}-${paren(b)})^2$$`,
          },
          {
            title: '계산하기',
            body: `$$r^2=${paren(dx)}^2+${paren(dy)}^2=${dx * dx}+${dy * dy}=${dx * dx + dy * dy}$$`,
          },
        ],
        tip: `원의 방정식은 $${shift('x', a)}^2+${shift('y', b)}^2=${dx * dx + dy * dy}$ 이에요. 점을 넣어 등식이 성립하는지 확인해 보세요.`,
      };
    },
  },
  {
    id: 'ce-position',
    unitId: UNIT,
    title: '원과 직선의 교점의 개수',
    make(rng) {
      const [na, nb] = rng.pick([
        [3, 4],
        [4, 3],
        [3, -4],
        [4, -3],
      ] as const);
      const a = rng.int(-3, 3);
      const b = rng.int(-3, 3);
      const r = rng.int(1, 4);
      const n = na * a + nb * b;
      const kind = rng.pick(['two', 'one', 'none'] as const);
      // 중심에서의 거리 ×5 (= |na·a + nb·b + c|) 를 먼저 정하고 c 를 거꾸로 구한다
      const v =
        kind === 'one'
          ? 5 * r
          : kind === 'two'
            ? rng.int(0, 5 * r - 1)
            : rng.int(5 * r + 1, 5 * r + 8);
      const c = flip(rng, v) - n;
      const count = kind === 'two' ? 2 : kind === 'one' ? 1 : 0;
      const circle = `${shift('x', a)}^2+${shift('y', b)}^2=${r * r}`;
      const line = `${na}x${term(nb, 'y')}${c === 0 ? '' : signed(c)}=0`;
      const cmp = v < 5 * r ? '<' : v === 5 * r ? '=' : '>';
      return {
        q: `원 $${circle}$ ${gwa(r * r)} 직선 $${line}$ 의 교점의 개수를 구하세요.`,
        choices: null,
        answer: String(count),
        answerType: 'int',
        check: `len([s0 for s0 in solve([Eq((x-${paren(a)})**2+(y-${paren(b)})**2, ${r * r}), Eq(${na}*x+${paren(nb)}*y+${paren(c)}, 0)], [x, y], dict=True) if all(v0.is_real for v0 in s0.values())])`,
        concepts: [POS, PTL],
        steps: [
          { title: '중심과 반지름', body: `중심 $(${a},${b})$, 반지름 $${r}$ 이에요.` },
          {
            title: '중심과 직선 사이 거리',
            body: `$$d=\\frac{|${na}\\cdot${paren(a)}${nb < 0 ? '' : '+'}${nb}\\cdot${paren(b)}${c === 0 ? '' : signed(c)}|}{\\sqrt{${na}^2+${paren(nb)}^2}}=\\frac{${v}}{5}$$`,
          },
          {
            title: '비교하기',
            body: `$\\frac{${v}}{5}${cmp}${r}$ 이므로 교점은 ${count} 개예요.`,
          },
        ],
        tip: '연립해서 판별식으로 풀어도 되지만, 거리와 반지름을 비교하는 쪽이 계산이 훨씬 짧아요.',
      };
    },
  },
  {
    id: 'ce-tangent',
    unitId: UNIT,
    title: '원 위의 점에서의 접선',
    make(rng) {
      const [px, py] = rng.pick([
        [1, 2],
        [2, 1],
        [1, 3],
        [3, 1],
        [2, 3],
        [3, 2],
        [3, 4],
        [4, 3],
      ] as const);
      const x1 = flip(rng, px);
      const y1 = flip(rng, py);
      const R = x1 * x1 + y1 * y1;
      const askY = rng.next() < 0.5;
      const which = askY ? '$y$절편' : '$x$절편';
      return {
        q: `원 $x^2+y^2=${R}$ 위의 점 $(${x1},${y1})$ 에서의 접선의 ${which}을 구하세요.`,
        choices: null,
        ...ans(R, askY ? y1 : x1),
        check: askY
          ? `solve(Eq(${x1}*0+${paren(y1)}*y, ${R}), y)[0]`
          : `solve(Eq(${x1}*x+${paren(y1)}*0, ${R}), x)[0]`,
        concepts: [TAN],
        steps: [
          {
            title: '접선의 식',
            body: `$x_1x+y_1y=r^2$ 에 넣으면\n$$${lead(x1, 'x')}${term(y1, 'y')}=${R}$$`,
          },
          askY
            ? {
                title: '$x=0$ 넣기',
                body: `$${lead(y1, 'y')}=${R}$ 이므로 $y=${fracTex(R, y1)}$ 이에요.`,
              }
            : {
                title: '$y=0$ 넣기',
                body: `$${lead(x1, 'x')}=${R}$ 이므로 $x=${fracTex(R, x1)}$ 이에요.`,
              },
        ],
        tip: `반지름의 기울기 $${fracTex(y1, x1)}$ 와 접선의 기울기 $${fracTex(-x1, y1)}$ 의 곱이 $-1$ 이에요.`,
      };
    },
  },
];
