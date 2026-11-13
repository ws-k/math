import { jo, linTex } from './h1-poly-ops.ts';
import type { Generator } from './types.ts';
import { paren, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'h1-remainder-factor';

const REM = '나머지정리: $f(x)$를 $x-a$로 나눈 나머지는 $f(a)$ 예요.';
const FACTOR = '인수정리: $f(a)=0$ 이면 $f(x)$는 $x-a$로 나누어떨어져요.';

/** f(a) 를 항마다 풀어 쓴 TeX: 2x^3-x+1, a=-2 → 2\times(-2)^3-(-2)+1 */
function subTex(f: number[], a: number): string {
  const deg = f.length - 1;
  return f
    .map((c, i) => ({ c, e: deg - i }))
    .filter((t) => t.c !== 0)
    .map(({ c, e }, i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      const m = Math.abs(c);
      if (e === 0) return sign + m;
      const pow = `${paren(a)}${e > 1 ? `^${e}` : ''}`;
      return sign + (m === 1 ? pow : `${m}\\times${pow}`);
    })
    .join('');
}

/** 항마다 계산한 값을 이어 쓴 TeX: 8+12-10+1 */
function valTex(f: number[], a: number): string {
  const deg = f.length - 1;
  return f
    .map((c, i) => c * a ** (deg - i))
    .filter((_, i) => f[i] !== 0)
    .map((v, i) => (v < 0 ? String(v) : i === 0 ? String(v) : `+${v}`))
    .join('');
}

export const generators: Generator[] = [
  {
    id: 'rem-theorem',
    unitId: UNIT,
    title: '나머지정리로 나머지 구하기',
    make(rng) {
      for (;;) {
        const L = rng.int(1, 2);
        const f = [L, rng.int(-4, 4), rng.int(-5, 5), rng.nonzero(-6, 6)];
        const a = rng.nonzero(-3, 3);
        const R = polyEval(f, a);
        if (Math.abs(R) > 60) continue;
        return {
          q: `$f(x)=${polyTex(f)}$ ${jo(polyTex(f), '을')} $${linTex(a)}$ ${jo(linTex(a), '으로')} 나눈 나머지를 구하세요.`,
          choices: null,
          answer: String(R),
          answerType: 'int',
          check: `rem(${polySym(f)}, x - (${a}), x)`,
          concepts: [REM, '$x-a=0$ 이 되는 $x$ 를 넣어요. $x+2$ 로 나누면 $x=-2$ 예요.'],
          steps: [
            {
              title: '넣을 수 정하기',
              body: `$${linTex(a)}=0$ 이 되는 $x=${a}$ ${jo(String(a), '을')} 넣어요. 나머지는 $f(${a})$ ${jo(String(a), '이에요')}.`,
            },
            { title: '대입하기', body: `$$f(${a})=${subTex(f, a)}$$` },
            { title: '계산하기', body: `$$${valTex(f, a)}=${R}$$` },
          ],
          tip: `$${linTex(a)}$ ${jo(linTex(a), '으로')} 나눌 때 $f(${-a})$ ${jo(String(-a), '을')} 넣는 실수가 잦아요. 나누는 식을 $0$ 으로 만드는 수를 넣어요.`,
        };
      }
    },
  },
  {
    id: 'factor-find-k',
    unitId: UNIT,
    title: '인수정리로 미지수 구하기',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-3, 3);
        const k = rng.nonzero(-4, 4);
        const c = rng.int(-6, 6);
        const d = -(a ** 3 + k * a * a + c * a);
        if (d === 0 || Math.abs(d) > 40) continue;
        const rest = polyTex([c, d]);
        const restT = rest.startsWith('-') ? rest : `+${rest}`;
        const known = a ** 3 + c * a + d;
        return {
          q: `다항식 $x^3+kx^2${restT}$ ${jo(restT, '이')} $${linTex(a)}$ ${jo(linTex(a), '으로')} 나누어떨어질 때 상수 $k$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `solve((x**3 + k*x**2 + (${c})*x + (${d})).subs(x, ${a}), k)[0]`,
          concepts: [FACTOR],
          steps: [
            {
              title: '나누어떨어지면 나머지가 $0$',
              body: `$f(x)=x^3+kx^2${restT}$ ${jo(restT, '이라')} 하면 $f(${a})=0$ 이에요.`,
            },
            {
              title: '대입하기',
              body: `$$${paren(a)}^3+k\\times${paren(a)}^2${c === 0 ? '' : `${c < 0 ? '-' : '+'}${Math.abs(c)}\\times${paren(a)}`}${d < 0 ? '' : '+'}${d}=0$$`,
            },
            {
              title: '정리하기',
              body: `$$${a * a}k${known < 0 ? '' : '+'}${known}=0$$`,
            },
            { title: '$k$ 구하기', body: `$$k=${k}$$` },
          ],
          tip: '“나누어떨어진다”, “인수로 갖는다”는 모두 나머지가 $0$ 이라는 말이에요.',
        };
      }
    },
  },
  {
    id: 'synthetic-div',
    unitId: UNIT,
    title: '조립제법으로 몫과 나머지',
    make(rng) {
      for (;;) {
        const L = rng.int(1, 3);
        const f = [L, rng.int(-5, 5), rng.int(-6, 6), rng.int(-8, 8)];
        const a = rng.nonzero(-3, 3);
        const [, b, c, d] = f as [number, number, number, number];
        const q1 = L;
        const q2 = b + a * q1;
        const q3 = c + a * q2;
        const R = d + a * q3;
        if (q2 === 0 || q3 === 0) continue;
        const ans = q1 + q2 + q3 + R;
        const table = `\\begin{array}{r|rrrr} ${a} & ${L} & ${b} & ${c} & ${d} \\\\ & & ${a * q1} & ${a * q2} & ${a * q3} \\\\ \\hline & ${q1} & ${q2} & ${q3} & ${R} \\end{array}`;
        return {
          q: `$${polyTex(f)}$ ${jo(polyTex(f), '을')} $${linTex(a)}$ ${jo(linTex(a), '으로')} 나눈 몫을 $Q(x)$, 나머지를 $R$ 이라 할 때 $Q(1)+R$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `qq, rr = div(${polySym(f)}, x - (${a}), x)\nans = qq.subs(x, 1) + rr`,
          concepts: [
            '조립제법: 계수만 늘어놓고 "내리기 → 곱하기 → 더하기"를 되풀이해요.',
            '마지막 칸이 나머지, 앞의 칸들이 몫의 계수예요.',
          ],
          steps: [
            {
              title: '계수 늘어놓기',
              body: `왼쪽에 $x=${a}$, 오른쪽에 계수 $${L},\\ ${b},\\ ${c},\\ ${d}$ ${jo(String(d), '을')} 적어요.`,
            },
            {
              title: '내리고, 곱하고, 더하기',
              body: `$$${table}$$`,
            },
            {
              title: '몫과 나머지 읽기',
              body: `$$Q(x)=${polyTex([q1, q2, q3])},\\quad R=${R}$$`,
            },
            {
              title: '$Q(1)+R$',
              body: `$Q(1)$ 은 몫의 계수의 합이에요.\n$$${q1}+${paren(q2)}+${paren(q3)}+${paren(R)}=${ans}$$`,
            },
          ],
          tip: '빠진 차수가 있으면 그 자리에 $0$ 을 꼭 적어요. 칸이 밀리면 몫이 통째로 틀려요.',
        };
      }
    },
  },
  {
    id: 'identity-coef',
    unitId: UNIT,
    title: '항등식의 미정계수',
    make(rng) {
      for (;;) {
        const P = rng.int(1, 3);
        const q = rng.int(-6, 6);
        const r = rng.int(-6, 6);
        const h = rng.nonzero(-3, 3);
        const f = [P, q, r];
        const B = 2 * P * h + q;
        const C = polyEval(f, h);
        const S = polyEval(f, h + 1);
        if (B === 0) continue;
        const hx = linTex(h);
        return {
          q: `등식 $${polyTex(f)}=a(${hx})^2+b(${hx})+c$ 가 $x$ 에 대한 항등식일 때 상수 $b$ 의 값을 구하세요.`,
          choices: null,
          answer: String(B),
          answerType: 'int',
          check: `sol = solve(Poly(expand(${polySym(f)} - (a*(x - (${h}))**2 + b*(x - (${h})) + c)), x).all_coeffs(), [a, b, c])\nans = sol[b]`,
          concepts: [
            '항등식: 어떤 $x$ 를 넣어도 성립해요. 그래서 편한 $x$ 를 골라 넣어도 되고(수치대입법), 계수를 비교해도 돼요(계수비교법).',
          ],
          steps: [
            {
              title: '$x^2$ 의 계수 비교',
              body: `오른쪽의 $x^2$ 은 $a(${hx})^2$ 에서만 나와요.\n$$a=${P}$$`,
            },
            {
              title: `$x=${h}$ 넣기`,
              body: `괄호가 $0$ 이 되어 $c$ 만 남아요.\n$$c=${C}$$`,
            },
            {
              title: `$x=${h + 1}$ 넣기`,
              body: `괄호가 $1$ 이 되어\n$$a+b+c=${S}$$`,
            },
            {
              title: '$b$ 구하기',
              body: `$$b=${S}-${paren(P)}-${paren(C)}=${B}$$`,
            },
          ],
          tip: '괄호를 $0$, $1$ 로 만드는 $x$ 를 고르면 계산이 짧아요.',
        };
      }
    },
  },
];
