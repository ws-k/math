import { jo } from './h1-poly-ops.ts';
import type { Generator } from './types.ts';
import { paren, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'h1-function';

// 함수는 계수 배열로만 들고 다닌다. 문제 글(polyTex)과 검산식(polySym)을 같은 배열에서 만들고,
// 검산식은 sympy 가 식에 값을 직접 넣어(subs)·방정식을 풀어(solve) 계산하게 한다 — 생성기가 계산한 값을
// 검산식에 그대로 적으면 생성기의 계산 실수가 답과 검산에 똑같이 들어가 잡히지 않는다.

/** 합성 순서 설명. 바깥 함수 o, 안쪽 함수 i 이름으로 만든다 — (g∘f) 문제에 f∘g 설명이 붙지 않게 */
const comp = (o: string, i: string) =>
  `$(${o}\\circ ${i})(x)=${o}(${i}(x))$: 안쪽 $${i}$ 를 먼저 계산하고, 그 결과를 $${o}$ 에 넣어요.`;

/** 계수 u 와 문자 v 의 항: (3,'a') → 3a, (-1,'a') → -a, (0,'a') → '' */
const term = (u: number, v: string) =>
  u === 0 ? '' : u === 1 ? v : u === -1 ? `-${v}` : `${u}${v}`;

/**
 * 다항식에 값을 넣은 식의 TeX: ([3,4], 3) → 3\times3+4, ([1,0,2], -2) → (-2)^2+2.
 * polyTex 의 x 를 글자 그대로 바꾸면 3x 에 3 을 넣어 "33" 이 되므로 항마다 곱셈 기호를 넣는다.
 */
function subTex(coeffs: number[], v: number): string {
  const deg = coeffs.length - 1;
  return coeffs
    .map((c, i) => ({ c, e: deg - i }))
    .filter((t) => t.c !== 0)
    .map(({ c, e }, i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      const a = Math.abs(c);
      if (e === 0) return `${sign}${a}`;
      const base = v < 0 || e > 1 ? `(${v})` : `${v}`;
      const pow = e > 1 ? `^${e}` : '';
      return `${sign}${a === 1 ? '' : `${a}\\times`}${base}${pow}`;
    })
    .join('');
}

/** ua+b 의 TeX (u=0 이면 b) */
const ab = (u: number) => (u === 0 ? 'b' : `${term(u, 'a')}+b`);
const INV = '$f^{-1}(k)=t$ 는 $f(t)=k$ 와 같은 말이에요.';

export const generators: Generator[] = [
  {
    id: 'fn-composite-value',
    unitId: UNIT,
    title: '합성함수의 함숫값',
    make(rng) {
      const a = rng.pick([-3, -2, 2, 3]);
      const b = rng.nonzero(-5, 5);
      const c = rng.int(-4, 4);
      const k = rng.nonzero(-3, 3);
      const f = [a, b];
      const g = [1, 0, c];
      // 어느 쪽을 먼저 하는지 섞는다 — 순서를 헷갈리면 답이 달라지게
      const fg = rng.int(0, 1) === 1;
      const [inner, outer] = fg ? [g, f] : [f, g];
      const [iName, oName] = fg ? ['g', 'f'] : ['f', 'g'];
      const v = polyEval(inner, k);
      const ans = polyEval(outer, v);
      return {
        q: `두 함수 $f(x)=${polyTex(f)}$, $g(x)=${polyTex(g)}$ 에 대하여 $(${oName}\\circ ${iName})(${k})$ 의 값을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `f = ${polySym(f)}\ng = ${polySym(g)}\nans = ${oName}.subs(x, ${iName}.subs(x, ${k}))`,
        concepts: [comp(oName, iName)],
        steps: [
          {
            title: `안쪽 ${iName} 먼저`,
            body: `$$${iName}(${k})=${subTex(inner, k)}=${v}$$`,
          },
          {
            title: `그 값을 ${oName} 에 넣기`,
            body: `$$${oName}(${v})=${subTex(outer, v)}=${ans}$$`,
          },
        ],
        tip: `$(${oName}\\circ ${iName})$ 는 오른쪽 $${iName}$ 부터 해요. 왼쪽부터 하면 $(${iName}\\circ ${oName})$ 가 돼요.`,
      };
    },
  },
  {
    id: 'fn-inverse-value',
    unitId: UNIT,
    title: '역함수의 함숫값',
    make(rng) {
      const a = rng.pick([-4, -3, -2, 2, 3, 4]);
      const b = rng.nonzero(-6, 6);
      // 답 t 를 먼저 정하고 k=f(t) 로 만든다 — 답이 정수로 떨어지게
      const t = rng.nonzero(-5, 5);
      const f = [a, b];
      const k = polyEval(f, t);
      return {
        q: `함수 $f(x)=${polyTex(f)}$ 의 역함수를 $f^{-1}$ 라 할 때, $f^{-1}(${k})$ 의 값을 구하세요.`,
        choices: null,
        answer: String(t),
        answerType: 'int',
        check: `solve(Eq(${polySym(f)}, ${k}), x)[0]`,
        concepts: [INV, '역함수는 $x$ 와 $y$ 의 자리를 바꾼 함수예요.'],
        steps: [
          {
            title: '뜻 바꾸기',
            body: `$f^{-1}(${k})=t$ 라 하면 $f(t)=${k}$ ${jo(String(k), '이에요')}.`,
          },
          { title: '방정식 세우기', body: `$$${polyTex(f, 't')}=${k}$$` },
          { title: '풀기', body: `$$${a}t=${k - b},\\quad t=${t}$$` },
        ],
        tip: `역함수 식을 다 구하지 않아도 돼요. $f(t)=${k}$ 인 $t$ 만 찾으면 끝이에요.`,
      };
    },
  },
  {
    id: 'fn-inverse-coef',
    unitId: UNIT,
    title: '역함수 조건으로 일차함수 정하기',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-4, 4);
        const b = rng.int(-6, 6);
        const u = rng.int(-3, 4);
        const z = rng.int(-3, 4);
        if (u === z) continue;
        const v = a * u + b;
        const w = a * z + b;
        const du = u - z;
        return {
          q: `일차함수 $f(x)=ax+b$ 에 대하여 $f(${u})=${v}$, $f^{-1}(${w})=${z}$ 일 때, 상수 $a$, $b$ 에 대하여 $a+b$ 의 값을 구하세요.`,
          choices: null,
          answer: String(a + b),
          answerType: 'int',
          check: `sol = solve([Eq(a*(${u}) + b, ${v}), Eq(a*(${z}) + b, ${w})], [a, b])\nans = sol[a] + sol[b]`,
          concepts: [INV],
          steps: [
            {
              title: '역함수 조건 바꾸기',
              body: `$f^{-1}(${w})=${z}$ 이면 $f(${z})=${w}$ ${jo(String(w), '이에요')}.`,
            },
            {
              title: '두 식 세우기',
              body: `$$${ab(u)}=${v},\\quad ${ab(z)}=${w}$$`,
            },
            { title: '빼서 a 구하기', body: `$$${du}a=${v - w},\\quad a=${a}$$` },
            {
              title: 'b 구하고 더하기',
              body: `$$b=${v}-${paren(a)}\\times${paren(u)}=${b},\\quad a+b=${a + b}$$`,
            },
          ],
          tip: '역함수 조건은 늘 원래 함수 $f$ 의 조건으로 바꿔서 풀어요.',
        };
      }
    },
  },
  {
    id: 'fn-composite-linear',
    unitId: UNIT,
    title: '합성함수의 식',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-3, 3);
        const b = rng.nonzero(-5, 5);
        const c = rng.nonzero(-3, 3);
        const d = rng.nonzero(-5, 5);
        if (a === 1 && c === 1) continue;
        const f = [a, b];
        const g = [c, d];
        // f(g(x)) = a(cx+d)+b
        const p = a * c;
        const q = a * d + b;
        if (q === 0) continue;
        return {
          q: `두 함수 $f(x)=${polyTex(f)}$, $g(x)=${polyTex(g)}$ 에 대하여 $(f\\circ g)(x)=px+q$ 일 때, 상수 $p$, $q$ 에 대하여 $p+q$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p + q),
          answerType: 'int',
          check: `f = ${polySym(f)}\ng = ${polySym(g)}\nh = expand(f.subs(x, g))\nans = h.coeff(x, 1) + h.subs(x, 0)`,
          concepts: [comp('f', 'g')],
          steps: [
            {
              title: 'f 의 x 자리에 g(x) 넣기',
              body: `$$f(g(x))=${a === 1 ? '' : a === -1 ? '-' : a}(${polyTex(g)})${b < 0 ? b : `+${b}`}$$`,
            },
            { title: '전개하기', body: `$$=${polyTex([p, q])}$$` },
            { title: '더하기', body: `$p=${p}$, $q=${q}$\n$$p+q=${p + q}$$` },
          ],
          tip: '$f(g(x))$ 는 $f$ 의 식에서 $x$ 를 통째로 $g(x)$ 로 바꿔요. 괄호를 꼭 씌워요.',
        };
      }
    },
  },
];
