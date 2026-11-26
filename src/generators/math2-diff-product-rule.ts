import type { Generator } from './types.ts';
import { ieyo, paren, polyDiff, polyEval, polyMul, polySym, polyTex } from './util.ts';

const UNIT = 'math2-diff-product-rule';

// 수능 공통 5번처럼 "전개하지 않고 x=k 를 바로 대입"하는 흐름을 연습시키는 게 목적이라,
// 풀이는 항상 대입 경로로 쓰고 전개는 tip 의 검산으로만 보여 준다.
// 답이 0 이거나 너무 크면(손계산이 지루해지면) 다시 뽑는다.
const MAX = 150;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

/** "+3" / "-3" — 식 뒤에 상수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

const PRODUCT = "곱의 미분법: $\\{f(x)g(x)\\}'=f'(x)g(x)+f(x)g'(x)$";
const PRODUCT_HINT = '"앞 미분 × 뒤 그대로 + 앞 그대로 × 뒤 미분"';
const POWER = "$(x^n)'=nx^{n-1}$";

/** (일차식)(이차식) 꼴: 두 부분의 값만 구해 넣는 기본형 */
function linQuad(
  g: number[],
  h: number[],
  k: number,
): { ans: number; gk: number; gdk: number; hk: number; hdk: number } {
  const gk = polyEval(g, k);
  const gdk = polyEval(polyDiff(g), k);
  const hk = polyEval(h, k);
  const hdk = polyEval(polyDiff(h), k);
  return { ans: gdk * hk + gk * hdk, gk, gdk, hk, hdk };
}

function expandTip(f: number[], k: number, ans: number): string {
  return `전개해서 검산할 수 있어요. $f(x)=${polyTex(f)}$, $f'(x)=${polyTex(polyDiff(f))}$ 이므로 $f'(${k})=${ans}$ ${ieyo(ans)}.`;
}

export const generators: Generator[] = [
  {
    id: 'prod-lin-quad',
    unitId: UNIT,
    title: '(일차식)(이차식)의 미분계수',
    make(rng) {
      for (;;) {
        const g = [rng.nonzero(-3, 3), rng.nonzero(-5, 5)];
        const h = [rng.nonzero(-3, 3), rng.int(-5, 5), rng.nonzero(-5, 5)];
        const k = rng.int(-2, 3);
        const { ans, gk, gdk, hk, hdk } = linQuad(g, h, k);
        if (!okAns(ans)) continue;
        const G = polyTex(g);
        const H = polyTex(h);
        const Hd = polyTex(polyDiff(h));
        return {
          q: `함수 $f(x)=(${G})(${H})$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff((${polySym(g)})*(${polySym(h)}), x).subs(x, ${k})`,
          concepts: [PRODUCT, PRODUCT_HINT, POWER],
          steps: [
            {
              title: '두 부분으로 나누기',
              body: `$g(x)=${G}$, $h(x)=${H}$ 라 하면 $g'(x)=${gdk}$, $h'(x)=${Hd}$ ${ieyo(Hd)}.`,
            },
            {
              title: '곱의 미분법 적용',
              body: `$$f'(x)=${gdk}\\cdot(${H})+(${G})(${Hd})$$`,
            },
            {
              title: `$x=${k}$ 일 때 각 부분의 값`,
              body: `$h(${k})=${hk}$, $g(${k})=${gk}$, $h'(${k})=${hdk}$ ${ieyo(hdk)}.`,
            },
            {
              title: '대입해서 계산하기',
              body: `전개하지 않고 바로 넣어요.\n$$f'(${k})=${gdk}\\cdot ${paren(hk)}+${paren(gk)}\\cdot ${paren(hdk)}=${gdk * hk}${signed(gk * hdk)}=${ans}$$`,
            },
          ],
          tip: expandTip(polyMul(g, h), k, ans),
        };
      }
    },
  },
  {
    id: 'prod-quad-quad',
    unitId: UNIT,
    title: '(이차식)(이차식)의 미분계수',
    make(rng) {
      for (;;) {
        const g = [1, 0, rng.nonzero(-5, 5)];
        const h = [1, rng.nonzero(-5, 5), rng.nonzero(-5, 5)];
        const k = rng.int(-2, 3);
        const { ans, gk, gdk, hk, hdk } = linQuad(g, h, k);
        if (!okAns(ans)) continue;
        const G = polyTex(g);
        const H = polyTex(h);
        const Hd = polyTex(polyDiff(h));
        return {
          q: `함수 $f(x)=(${G})(${H})$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff((${polySym(g)})*(${polySym(h)}), x).subs(x, ${k})`,
          concepts: [PRODUCT, PRODUCT_HINT, POWER],
          steps: [
            {
              title: '두 부분으로 나누기',
              body: `$g(x)=${G}$, $h(x)=${H}$ 라 하면 $g'(x)=2x$, $h'(x)=${Hd}$ ${ieyo(Hd)}.`,
            },
            {
              title: '곱의 미분법 적용',
              body: `$$f'(x)=2x(${H})+(${G})(${Hd})$$`,
            },
            {
              title: `$x=${k}$ 일 때 각 부분의 값`,
              body: `$g'(${k})=${gdk}$, $h(${k})=${hk}$, $g(${k})=${gk}$, $h'(${k})=${hdk}$ ${ieyo(hdk)}.`,
            },
            {
              title: '대입해서 계산하기',
              body: `$$f'(${k})=${paren(gdk)}\\cdot ${paren(hk)}+${paren(gk)}\\cdot ${paren(hdk)}=${gdk * hk}${signed(gk * hdk)}=${ans}$$`,
            },
          ],
          tip: expandTip(polyMul(g, h), k, ans),
        };
      }
    },
  },
  {
    id: 'prod-linear-power',
    unitId: UNIT,
    title: '$(ax+b)^n$ 의 미분계수',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-3, 3);
        const b = rng.nonzero(-5, 5);
        const n = rng.pick([2, 3]);
        const k = rng.int(-2, 3);
        const v = a * k + b;
        // 세제곱은 v^2 이 곱해져 금방 커지므로 안쪽 값을 작게 묶는다.
        if (v === 0 || (n === 3 && Math.abs(v) > 4)) continue;
        const ans = n * v ** (n - 1) * a;
        if (!okAns(ans)) continue;
        const g = [a, b];
        const G = polyTex(g);
        const f = n === 2 ? polyMul(g, g) : polyMul(polyMul(g, g), g);
        const formula = n === 2 ? `2(${G})\\cdot ${paren(a)}` : `3(${G})^2\\cdot ${paren(a)}`;
        const calc =
          n === 2
            ? `2\\cdot ${paren(v)}\\cdot ${paren(a)}`
            : `3\\cdot ${paren(v)}^2\\cdot ${paren(a)}`;
        return {
          q: `함수 $f(x)=(${G})^${n}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff((${polySym(g)})**${n}, x).subs(x, ${k})`,
          concepts: [
            "$[\\{g(x)\\}^n]'=n\\{g(x)\\}^{n-1}g'(x)$",
            '같은 함수를 $n$번 곱한 것에 곱의 미분법을 쓰면 같은 항이 $n$개 나와요.',
          ],
          steps: [
            {
              title: '안쪽 함수 보기',
              body: `$g(x)=${G}$ 라 하면 $f(x)=\\{g(x)\\}^${n}$ 이고 $g'(x)=${a}$ ${ieyo(a)}.`,
            },
            {
              title: '거듭제곱의 미분 공식 적용',
              body: `$$f'(x)=${formula}$$`,
            },
            {
              title: `안쪽에 $x=${k}$ 대입`,
              body: `$g(${k})=${a}\\cdot ${paren(k)}${signed(b)}=${v}$ ${ieyo(v)}.`,
            },
            {
              title: '계산하기',
              body: `$$f'(${k})=${calc}=${ans}$$`,
            },
          ],
          tip: `${expandTip(f, k, ans)} 끝에 곱하는 $g'(x)=${a}$ 를 빠뜨리지 않도록 조심해요.`,
        };
      }
    },
  },
  {
    id: 'prod-given-values',
    unitId: UNIT,
    title: "$f(a)$, $f'(a)$ 만 주어진 곱의 미분",
    make(rng) {
      for (;;) {
        const deg = rng.pick([2, 3]);
        const p = rng.nonzero(-5, 5);
        const P = deg === 2 ? [1, 0, p] : [1, 0, 0, p];
        const t = rng.int(-2, 3);
        const F = rng.nonzero(-5, 5);
        const D = rng.nonzero(-5, 5);
        const pv = polyEval(P, t);
        const pdv = polyEval(polyDiff(P), t);
        const ans = pdv * F + pv * D;
        if (!okAns(ans)) continue;
        const Pt = polyTex(P);
        const Pdt = polyTex(polyDiff(P));
        return {
          q: `다항함수 $f(x)$ 가 $f(${t})=${F}$, $f'(${t})=${D}$ 를 만족시켜요. 함수 $h(x)=(${Pt})f(x)$ 에 대하여 $h'(${t})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          // h'(t) 는 f(t)·f'(t) 두 값에만 의존하므로, 같은 두 값을 갖는 일차식으로 f 를 대신해 실제로 미분한다.
          check: `diff((${polySym(P)})*(${D}*(x - ${paren(t)}) + ${paren(F)}), x).subs(x, ${t})`,
          concepts: [PRODUCT, POWER],
          steps: [
            {
              title: '곱의 미분법 적용',
              body: `$$h'(x)=${Pdt}f(x)+(${Pt})f'(x)$$`,
            },
            {
              title: `$x=${t}$ 일 때 앞부분의 값`,
              body: `$${Pdt}$ 의 값은 $${pdv}$, $${Pt}$ 의 값은 $${pv}$ ${ieyo(pv)}.`,
            },
            {
              title: '주어진 값 대입하기',
              body: `$$h'(${t})=${paren(pdv)}\\cdot ${paren(F)}+${paren(pv)}\\cdot ${paren(D)}=${pdv * F}${signed(pv * D)}=${ans}$$`,
            },
          ],
          tip: `$f(x)$ 의 식을 몰라도 돼요. $h'(${t})$ 에는 $f(${t})$ 와 $f'(${t})$ 두 값만 쓰이기 때문이에요.`,
        };
      }
    },
  },
  {
    id: 'prod-three-linear',
    unitId: UNIT,
    title: '세 일차식의 곱의 미분계수',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-5, 5);
        const b = rng.nonzero(-5, 5);
        const c = rng.nonzero(-5, 5);
        if (a === b || b === c || a === c) continue;
        const k = rng.int(-2, 3);
        const [u, v, w] = [k + a, k + b, k + c];
        const ans = v * w + u * w + u * v;
        if (!okAns(ans)) continue;
        const [A, B, C] = [a, b, c].map((n) => polyTex([1, n]));
        const f = polyMul(polyMul([1, a], [1, b]), [1, c]);
        return {
          q: `함수 $f(x)=(${A})(${B})(${C})$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff((x + ${paren(a)})*(x + ${paren(b)})*(x + ${paren(c)}), x).subs(x, ${k})`,
          concepts: [
            "세 함수의 곱: $\\{fgh\\}'=f'gh+fg'h+fgh'$",
            '한 번에 하나씩만 미분하고 나머지는 그대로 둬요.',
          ],
          steps: [
            {
              title: '세 함수의 곱의 미분법',
              body: `각 괄호를 미분하면 $1$ 이므로, 하나씩 지운 두 괄호의 곱 세 개를 더하면 돼요.\n$$f'(x)=(${B})(${C})+(${A})(${C})+(${A})(${B})$$`,
            },
            {
              title: `$x=${k}$ 일 때 각 괄호의 값`,
              body: `$${A}$, $${B}$, $${C}$ 의 값은 차례로 $${u}$, $${v}$, $${w}$ ${ieyo(w)}.`,
            },
            {
              title: '세 항 각각 계산하기',
              body: `$${paren(v)}\\cdot ${paren(w)}=${v * w}$, $${paren(u)}\\cdot ${paren(w)}=${u * w}$, $${paren(u)}\\cdot ${paren(v)}=${u * v}$ ${ieyo(u * v)}.`,
            },
            {
              title: '더하기',
              body: `$$f'(${k})=${v * w}${signed(u * w)}${signed(u * v)}=${ans}$$`,
            },
          ],
          tip: expandTip(f, k, ans),
        };
      }
    },
  },
];
