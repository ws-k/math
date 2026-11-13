import { j } from './e-fraction-mul.ts';
import type { Generator } from './types.ts';
import { paren, polySym, polyTex } from './util.ts';

const UNIT = 'm2-exponent-poly';

// 단항식은 (계수, x 지수, y 지수) 세 정수로 들고 다닌다. 화면 글자(mono)와 검산식(monoSym)을 같은 세 수에서
// 만들어, 문제에 보이는 식과 sympy 가 계산하는 식이 어긋나지 않게 한다.

const LAW_MUL = '지수법칙: $a^m\\times a^n=a^{m+n}$ (곱하면 지수끼리 더해요)';
const LAW_POW = '지수법칙: $(a^m)^n=a^{mn}$ (거듭제곱의 거듭제곱은 지수끼리 곱해요)';
const LAW_DIV = '지수법칙: $m>n$이면 $a^m\\div a^n=a^{m-n}$ (나누면 지수끼리 빼요)';
const LAW_PROD = '지수법칙: $(ab)^n=a^nb^n$ (괄호 안 모든 인수에 지수를 나눠 줘요)';

/** x^e 의 TeX (e=0 이면 빈 글자) */
const pw = (v: string, e: number) => (e === 0 ? '' : e === 1 ? v : `${v}^{${e}}`);

/** 단항식 TeX: 계수 c, x 지수 ex, y 지수 ey */
export function mono(c: number, ex: number, ey = 0): string {
  const vars = pw('x', ex) + pw('y', ey);
  if (!vars) return String(c);
  const coef = c === 1 ? '' : c === -1 ? '-' : String(c);
  return coef + vars;
}
/** 곱셈·나눗셈 기호 뒤에 오는 단항식: 음수면 괄호 */
const monoP = (c: number, ex: number, ey = 0) => (c < 0 ? `(${mono(c, ex, ey)})` : mono(c, ex, ey));

/** 단항식 sympy 식 */
const monoSym = (c: number, ex: number, ey = 0) => `(${c}*x**${ex}*y**${ey})`;

const CONCEPT_MONO = '단항식의 곱셈·나눗셈은 계수끼리, 같은 문자끼리 따로 계산해요.';

export const generators: Generator[] = [
  {
    id: 'exp-law',
    unitId: UNIT,
    title: '지수법칙으로 지수 구하기',
    make(rng) {
      const kind = rng.pick(['muldiv', 'powmul', 'powdiv'] as const);
      if (kind === 'muldiv') {
        for (;;) {
          const a = rng.int(2, 9);
          const b = rng.int(2, 9);
          const c = rng.int(2, 9);
          const r = a + b - c;
          if (r < 2) continue;
          return {
            q: `다음 식을 간단히 하면 $x^{\\square}$ 꼴이 돼요. $\\square$에 알맞은 수를 구하세요.\n$$x^{${a}}\\times x^{${b}}\\div x^{${c}}$$`,
            choices: null,
            answer: String(r),
            answerType: 'int',
            check: `degree(x**${a}*x**${b}/x**${c}, x)`,
            concepts: [LAW_MUL, LAW_DIV],
            steps: [
              {
                title: '곱하기: 지수 더하기',
                body: `$x$가 ${a}개, 또 ${b}개 곱해져서 모두 ${a + b}개예요.\n$$x^{${a}}\\times x^{${b}}=x^{${a}+${b}}=x^{${a + b}}$$`,
              },
              {
                title: '나누기: 지수 빼기',
                body: `분수로 쓰면 위아래에서 $x$가 ${c}개씩 약분돼요.\n$$x^{${a + b}}\\div x^{${c}}=x^{${a + b}-${c}}=x^{${r}}$$`,
              },
            ],
            tip: '곱셈과 나눗셈이 섞이면 앞에서부터 차례로 계산해요.',
          };
        }
      }
      const a = rng.int(2, 5);
      const b = rng.int(2, 4);
      if (kind === 'powmul') {
        const c = rng.int(2, 9);
        return {
          q: `다음 식을 간단히 하면 $x^{\\square}$ 꼴이 돼요. $\\square$에 알맞은 수를 구하세요.\n$$(x^{${a}})^{${b}}\\times x^{${c}}$$`,
          choices: null,
          answer: String(a * b + c),
          answerType: 'int',
          check: `degree((x**${a})**${b}*x**${c}, x)`,
          concepts: [LAW_POW, LAW_MUL],
          steps: [
            {
              title: '괄호 먼저: 지수 곱하기',
              body: `$x^{${a}}$ 묶음이 ${b}개 곱해지니 $x$는 $${a}\\times${b}$개예요.\n$$(x^{${a}})^{${b}}=x^{${a * b}}$$`,
            },
            {
              title: '곱하기: 지수 더하기',
              body: `$$x^{${a * b}}\\times x^{${c}}=x^{${a * b}+${c}}=x^{${a * b + c}}$$`,
            },
          ],
          tip: `$(x^{${a}})^{${b}}$에서 지수를 더해 $x^{${a + b}}$로 쓰는 실수가 잦아요. 묶음이 ${b}개 곱해지는 것이라 지수는 곱해요.`,
        };
      }
      for (;;) {
        const c = rng.int(2, 9);
        const r = a * rng.int(2, 4) - c;
        const bb = (r + c) / a;
        if (r < 2) continue;
        return {
          q: `다음 식을 간단히 하면 $x^{\\square}$ 꼴이 돼요. $\\square$에 알맞은 수를 구하세요.\n$$(x^{${a}})^{${bb}}\\div x^{${c}}$$`,
          choices: null,
          answer: String(r),
          answerType: 'int',
          check: `degree((x**${a})**${bb}/x**${c}, x)`,
          concepts: [LAW_POW, LAW_DIV],
          steps: [
            {
              title: '괄호 먼저: 지수 곱하기',
              body: `$$(x^{${a}})^{${bb}}=x^{${a}\\times${bb}}=x^{${a * bb}}$$`,
            },
            {
              title: '나누기: 지수 빼기',
              body: `$$x^{${a * bb}}\\div x^{${c}}=x^{${a * bb}-${c}}=x^{${r}}$$`,
            },
          ],
          tip: '나눗셈은 지수끼리 나누는 게 아니라 빼요. $x^6\\div x^2$는 $x^3$이 아니라 $x^4$예요.',
        };
      }
    },
  },
  {
    id: 'mono-coef',
    unitId: UNIT,
    title: '단항식의 곱셈과 나눗셈',
    make(rng) {
      if (rng.next() < 0.5) {
        // (p x^a y^b)^n
        const p = rng.pick([-3, -2, 2, 3]);
        const a = rng.int(1, 4);
        const b = rng.int(1, 3);
        const n = rng.int(2, 3);
        const k = p ** n;
        const res = mono(1, a * n, b * n);
        return {
          q: `다음 식을 간단히 하면 $\\square\\,${res}$ 꼴이 돼요. $\\square$에 알맞은 수를 구하세요.\n$$(${mono(p, a, b)})^{${n}}$$`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `Poly(${monoSym(p, a, b)}**${n}, x, y).LC()`,
          concepts: [LAW_PROD, LAW_POW],
          steps: [
            {
              title: '괄호 안 모든 인수에 지수 나눠 주기',
              body: `계수 $${p}$에도, $${pw('x', a)}$에도, $${pw('y', b)}$에도 $${n}$제곱을 해요.\n$$${paren(p)}^{${n}}\\times(${pw('x', a)})^{${n}}\\times(${pw('y', b)})^{${n}}$$`,
            },
            {
              title: '계수 계산하기',
              body: `$$${paren(p)}^{${n}}=${k}$$${p < 0 ? `\n음수를 ${n === 2 ? '짝수 번 곱하면 양수' : '홀수 번 곱하면 음수'}예요.` : ''}`,
            },
            {
              title: '문자의 지수 곱하기',
              body: `$$(${pw('x', a)})^{${n}}=${pw('x', a * n)},\\quad(${pw('y', b)})^{${n}}=${pw('y', b * n)}$$\n그래서 $${mono(k, a * n, b * n)}$예요.`,
            },
          ],
          tip: `계수에 지수를 빠뜨리고 $${mono(p, a * n, b * n)}$로 쓰는 실수가 가장 많아요. 괄호 안 **모든** 것에 $${n}$제곱이에요.`,
        };
      }
      for (;;) {
        // A x^a y^b ÷ (C x^c y^d) × B x^e y^f
        const C = rng.pick([-4, -3, -2, 2, 3, 4]);
        const q0 = rng.nonzero(-4, 4);
        const A = C * q0 * rng.pick([1, 2]);
        const B = rng.nonzero(-3, 3);
        const a = rng.int(3, 6);
        const c = rng.int(1, a - 1);
        const b = rng.int(1, 3);
        const d = rng.int(0, b);
        const e = rng.int(0, 2);
        const f = rng.int(0, 2);
        if (Math.abs(A) > 24 || e + f === 0) continue;
        const k = (A / C) * B;
        const X = a - c + e;
        const Y = b - d + f;
        if (Y === 0 || k === 0) continue;
        // \times 뒤에 x 가 바로 붙으면 \timesx 라는 없는 명령이 되므로 한 칸 띄운다
        const expr = `${mono(A, a, b)}\\div ${monoP(C, c, d)}\\times ${monoP(B, e, f)}`;
        return {
          q: `다음 식을 간단히 하면 $\\square\\,${mono(1, X, Y)}$ 꼴이 돼요. $\\square$에 알맞은 수를 구하세요.\n$$${expr}$$`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `Poly(${monoSym(A, a, b)}/${monoSym(C, c, d)}*${monoSym(B, e, f)}, x, y).LC()`,
          concepts: [CONCEPT_MONO, LAW_MUL, LAW_DIV],
          steps: [
            {
              title: '나눗셈을 분수로',
              body: `나누는 식은 분모로 보내요.\n$$\\frac{${mono(A, a, b)}\\times ${monoP(B, e, f)}}{${mono(C, c, d)}}$$`,
            },
            {
              title: '계수끼리 계산하기',
              body: `$$${A}\\times${paren(B)}\\div${paren(C)}=${k}$$`,
            },
            {
              title: '같은 문자끼리 지수 계산하기',
              body: `$x$: $${a}+${e}-${c}=${X}$, $y$: $${b}+${f}-${d}=${Y}$\n$$${mono(k, X, Y)}$$`,
            },
          ],
          tip: '나눗셈이 끼어 있으면 분수로 바꿔 분자·분모를 한꺼번에 보면 순서 실수가 줄어요. 부호는 음수의 개수로 정해요.',
        };
      }
    },
  },
  {
    id: 'poly-addsub',
    unitId: UNIT,
    title: '다항식의 덧셈과 뺄셈',
    make(rng) {
      for (;;) {
        const P = [rng.nonzero(-5, 5), rng.nonzero(-9, 9), rng.nonzero(-9, 9)];
        const Q = [rng.nonzero(-5, 5), rng.nonzero(-9, 9), rng.nonzero(-9, 9)];
        const minus = rng.next() < 0.7;
        const s = minus ? -1 : 1;
        const R = P.map((v, i) => v + s * (Q[i] as number));
        if (R[0] === 0 || R.every((v) => v === 0)) continue;
        const op = minus ? '-' : '+';
        const expr = `(${polyTex(P)})${op}(${polyTex(Q)})`;
        const sum = R.reduce((t, v) => t + v, 0);
        const sym = `(${polySym(P)}) ${op} (${polySym(Q)})`;
        const opened = minus ? polyTex(Q.map((v) => -v)) : polyTex(Q);
        return {
          q: `다음 식을 간단히 하면 $ax^2+bx+c$ 꼴이 돼요. $a+b+c$의 값을 구하세요.\n$$${expr}$$`,
          choices: null,
          answer: String(sum),
          answerType: 'int',
          check: `sum(Poly(expand(${sym}), x).all_coeffs())`,
          concepts: [
            '괄호 앞이 $-$이면 괄호를 풀 때 안의 **모든** 항의 부호가 바뀌어요.',
            '동류항(문자와 차수가 같은 항)끼리만 더하고 빼요.',
          ],
          steps: [
            {
              title: '괄호 풀기',
              body: `${minus ? '뒤 괄호 앞이 $-$라서 안의 세 항 모두 부호를 바꿔요.' : '괄호 앞이 $+$라서 그대로 풀어요.'}\n$$${polyTex(P)}${opened.startsWith('-') ? '' : '+'}${opened}$$`,
            },
            {
              title: '동류항끼리 모으기',
              body: `$x^2$항은 $${P[0]}${minus ? '-' : '+'}${paren(Q[0] as number)}=${R[0]}$, $x$항은 $${P[1]}${minus ? '-' : '+'}${paren(Q[1] as number)}=${R[1]}$, 상수항은 $${P[2]}${minus ? '-' : '+'}${paren(Q[2] as number)}=${R[2]}$이에요.\n$$${polyTex(R)}$$`,
            },
            {
              title: '$a+b+c$ 계산하기',
              body: `$a=${R[0]}$, $b=${R[1]}$, $c=${R[2]}$\n$$a+b+c=${R.map((v, i) => (i ? paren(v) : String(v))).join('+')}=${sum}$$`,
            },
          ],
          tip: minus
            ? '괄호 앞 $-$를 첫 항에만 적용하고 뒤 항은 그대로 두는 실수가 가장 흔해요.'
            : '계수가 $0$인 항이 생기면 그 항은 사라진 거예요($b=0$이어도 $a+b+c$에 $0$으로 넣어요).',
        };
      }
    },
  },
  {
    id: 'poly-mono-mul',
    unitId: UNIT,
    title: '다항식과 단항식의 곱셈·나눗셈',
    make(rng) {
      if (rng.next() < 0.65) {
        // k x (p x + q) + m x (r x + s) → A x^2 + B x
        for (;;) {
          const k = rng.nonzero(-5, 5);
          const p = rng.nonzero(-4, 4);
          const q = rng.nonzero(-6, 6);
          const m = rng.nonzero(-4, 4);
          const r = rng.nonzero(-4, 4);
          const s = rng.nonzero(-6, 6);
          const A = k * p + m * r;
          const B = k * q + m * s;
          if (A === 0 || B === 0) continue;
          const ask = rng.pick(['x2', 'x'] as const);
          const want = ask === 'x2' ? A : B;
          const t1 = `${mono(k, 1)}(${polyTex([p, q])})`;
          const t2 = `${mono(Math.abs(m), 1)}(${polyTex([r, s])})`;
          const expr = `${t1}${m < 0 ? '-' : '+'}${t2}`;
          const e1 = [k * p, k * q, 0];
          const e2 = [m * r, m * s, 0];
          const name = ask === 'x2' ? '$x^2$의 계수' : '$x$의 계수';
          return {
            q: `다음 식을 간단히 했을 때, ${name}를 구하세요.\n$$${expr}$$`,
            choices: null,
            answer: String(want),
            answerType: 'int',
            check: `expand(${k}*x*(${polySym([p, q])}) + ${m}*x*(${polySym([r, s])})).coeff(x, ${ask === 'x2' ? 2 : 1})`,
            concepts: [
              '분배법칙: $a(b+c)=ab+ac$. 단항식을 괄호 안 **모든** 항에 곱해요.',
              '동류항(문자와 차수가 같은 항)끼리만 더하고 빼요.',
            ],
            steps: [
              {
                title: '앞 괄호 풀기',
                body: `$${mono(k, 1)}$를 두 항에 각각 곱해요.\n$$${t1}=${polyTex(e1)}$$`,
              },
              {
                title: '뒤 괄호 풀기',
                body: `앞의 부호까지 붙여 $${mono(m, 1)}$를 곱해요.\n$$${mono(m, 1)}(${polyTex([r, s])})=${polyTex(e2)}$$`,
              },
              {
                title: '동류항끼리 모으기',
                body: `$$${polyTex(e1)}${polyTex(e2).startsWith('-') ? '' : '+'}${polyTex(e2)}=${polyTex([A, B, 0])}$$\n${name}는 $${want}$${j(Math.abs(want), '이에요예요')}.`,
              },
            ],
            tip: '단항식을 괄호 안 첫 항에만 곱하고 뒤 항을 빠뜨리는 실수가 잦아요. 넓이 모형의 칸이 모두 채워졌는지 떠올려 봐요.',
          };
        }
      }
      // (a x^2 + b x) ÷ (c x) → p x + q
      for (;;) {
        const c = rng.pick([-4, -3, -2, 2, 3, 4, 5]);
        const p = rng.nonzero(-6, 6);
        const q = rng.nonzero(-8, 8);
        if (p + q === 0) continue;
        const a = c * p;
        const b = c * q;
        return {
          q: `다음 식을 간단히 하면 $px+q$ 꼴이 돼요. $p+q$의 값을 구하세요.\n$$(${polyTex([a, b, 0])})\\div${monoP(c, 1)}$$`,
          choices: null,
          answer: String(p + q),
          answerType: 'int',
          check: `sum(Poly(cancel((${polySym([a, b, 0])})/(${c}*x)), x).all_coeffs())`,
          concepts: [
            '다항식을 단항식으로 나눌 때는 각 항을 따로 나눠요: $\\frac{A+B}{C}=\\frac{A}{C}+\\frac{B}{C}$',
            LAW_DIV,
          ],
          steps: [
            {
              title: '항마다 나누기',
              body: `$$\\frac{${mono(a, 2)}}{${mono(c, 1)}}+\\frac{${mono(b, 1)}}{${mono(c, 1)}}$$`,
            },
            {
              title: '계수와 지수 계산하기',
              body: `$${a}\\div${paren(c)}=${p}$, $x^2\\div x=x$ 이고 $${b}\\div${paren(c)}=${q}$, $x\\div x=1$이에요.\n$$${polyTex([p, q])}$$`,
            },
            {
              title: '$p+q$ 계산하기',
              body: `$$${p}+${paren(q)}=${p + q}$$`,
            },
          ],
          tip: '나누는 식이 음수면 모든 항의 부호가 바뀌어요. 둘째 항을 나누는 것도 잊지 않아요.',
        };
      }
    },
  },
];
