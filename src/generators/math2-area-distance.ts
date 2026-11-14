import { eul, ieyo as ieyoTex, iga, ro, wa } from './math2-indefinite.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, polyEval, polySym, polyTex, reduce } from './util.ts';

const UNIT = 'math2-area-distance';

// 넓이·거리는 "정적분 값 ≠ 넓이" 를 몸에 익히는 게 목적이라, 풀이는 늘
// ① 경계(교점·속도가 0 인 시각) 찾기 → ② 위아래(부호) 보기 → ③ 정적분 → ④ 부호 정리 순서로 쓴다.
// 이차식의 정적분은 분수가 자연스러워서 답은 기약분수로 받는다.

/** '이에요/예요' — 분수는 분자를 마지막에 읽는다("3분의 4") */
function ieyo(n: number, d = 1): string {
  const r = reduce(n, d);
  return /[013678]$/.test(String(Math.abs(r.n))) ? '이에요' : '예요';
}

const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

/** 인수 (x-p) 의 TeX. p=0 이면 괄호 없이 x */
const fac = (p: number) => (p === 0 ? 'x' : `(${polyTex([1, -p])})`);

/** 분수 계수 다항식 TeX. coeffs 는 [분자, 분모] 쌍, 높은 차수부터 */
function ratPolyTex(coeffs: [number, number][], v = 'x'): string {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach(([n, d], i) => {
    const e = deg - i;
    if (n === 0) return;
    const r = reduce(n, d);
    const neg = r.n < 0;
    const a = Math.abs(r.n);
    const pow = e === 0 ? '' : e === 1 ? v : `${v}^${e}`;
    let body: string;
    if (r.d === 1) body = a === 1 && e > 0 ? pow : `${a}${pow}`;
    else body = `\\frac{${a}}{${r.d}}${pow}`;
    parts.push(`${neg ? '-' : parts.length ? '+' : ''}${body}`);
  });
  return parts.length ? parts.join('') : '0';
}

/**
 * c(x-p)(x-q) 의 원시함수(상수항 0)를 6배 해 정수로 다룬다:
 * 6F(x) = 2c x³ - 3c(p+q) x² + 6cpq x. 분수 계산을 끝까지 정확히 하려고.
 */
const sixF = (c: number, p: number, q: number, x: number) =>
  2 * c * x ** 3 - 3 * c * (p + q) * x ** 2 + 6 * c * p * q * x;

const F_TEX = (c: number, p: number, q: number) =>
  ratPolyTex([
    [c, 3],
    [-c * (p + q), 2],
    [c * p * q, 1],
    [0, 1],
  ]);

const AREA = '넓이는 $\\int_a^b|f(x)|\\,dx$ — $x$ 축 아래 부분은 부호를 바꿔 더해요.';

export const generators: Generator[] = [
  {
    id: 'math2-area-distance-x-axis',
    unitId: UNIT,
    title: '곡선과 $x$ 축으로 둘러싸인 넓이',
    make(rng) {
      for (;;) {
        const c = rng.pick([1, -1, 2, -2, 3, -3]);
        const p = rng.int(-3, 2);
        const q = p + rng.int(1, 4);
        const f = [c, -c * (p + q), c * p * q];
        const n6 = sixF(c, p, q, q) - sixF(c, p, q, p);
        const val = reduce(n6, 6);
        const ans = fracAns(Math.abs(n6), 6);
        const ft = polyTex(f);
        const below = c > 0;
        return {
          q: `곡선 $y=${ft}$ ${wa(ft)} $x$ 축으로 둘러싸인 부분의 넓이를 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `r = solve(${polySym(f)}, x)\nans = Abs(integrate(${polySym(f)}, (x, min(r), max(r))))`,
          concepts: [AREA, '$x$ 축과 만나는 점이 적분 구간의 끝이에요.'],
          steps: [
            {
              title: '$x$ 축과 만나는 점',
              body: `$${ft}=${c === 1 ? '' : c === -1 ? '-' : c}${fac(p)}${fac(q)}=0$ 에서 $x=${p}$, $x=${q}$ ${ieyo(q)}.`,
            },
            {
              title: '위인지 아래인지',
              body: below
                ? `$x^2$ 의 계수가 양수라 두 점 사이에서 곡선은 $x$ 축 **아래**에 있어요. 정적분이 음수로 나와요.`
                : `$x^2$ 의 계수가 음수라 두 점 사이에서 곡선은 $x$ 축 **위**에 있어요. 정적분이 그대로 넓이예요.`,
            },
            {
              title: '정적분 계산',
              body: `$$\\int_{${p}}^{${q}}(${ft})\\,dx=\\Big[${F_TEX(c, p, q)}\\Big]_{${p}}^{${q}}=${fracTex(sixF(c, p, q, q), 6)}-${paren(fracTex(sixF(c, p, q, p), 6))}=${fracTex(n6, 6)}$$`,
            },
            {
              title: '넓이',
              body: below
                ? `부호를 바꾸면 넓이는 $${fracTex(-n6, 6)}$ ${ieyo(-n6, 6)}.`
                : `넓이는 $${fracTex(n6, 6)}$ ${ieyo(n6, 6)}.`,
            },
          ],
          tip: `두 근이 $\\alpha$, $\\beta$ 인 이차함수 $y=a(x-\\alpha)(x-\\beta)$ 와 $x$ 축 사이 넓이는 $\\dfrac{|a|(\\beta-\\alpha)^3}{6}$ 이에요. 여기서는 $\\dfrac{${Math.abs(c)}\\cdot ${q - p}^3}{6}=${fracTex(Math.abs(val.n), val.d)}$ 로 같아요.`,
        };
      }
    },
  },
  {
    id: 'math2-area-distance-two-curves',
    unitId: UNIT,
    title: '곡선과 직선으로 둘러싸인 넓이',
    make(rng) {
      for (;;) {
        const p = rng.int(-3, 2);
        const q = p + rng.int(1, 4);
        const u = rng.int(-4, 4);
        const w = rng.int(-4, 4);
        const f = [1, u, w];
        // g - f = -(x-p)(x-q) 가 되게 직선을 만든다
        const g = [u + p + q, w - p * q];
        if (g[0] === 0) continue;
        const n6 = sixF(-1, p, q, q) - sixF(-1, p, q, p);
        const ans = fracAns(n6, 6);
        const ft = polyTex(f);
        const gt = polyTex(g);
        const diff = polyTex([-1, p + q, -p * q]);
        return {
          q: `곡선 $y=${ft}$ ${wa(ft)} 직선 $y=${gt}$ ${ro(gt)} 둘러싸인 부분의 넓이를 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `r = solve(Eq(${polySym(f)}, ${polySym(g)}), x)\nans = integrate((${polySym(g)}) - (${polySym(f)}), (x, min(r), max(r)))`,
          concepts: [
            '두 곡선 사이 넓이는 $\\int_a^b\\{(\\text{위})-(\\text{아래})\\}\\,dx$',
            '교점의 $x$ 좌표가 적분 구간의 끝이에요.',
          ],
          steps: [
            {
              title: '교점 찾기',
              body: `$${ft}=${gt}$ ${eul(gt)} 정리하면 $${polyTex([1, -(p + q), p * q])}=0$, 곧 $${fac(p)}${fac(q)}=0$ 이라 $x=${p}$, $x=${q}$ ${ieyo(q)}.`,
            },
            {
              title: '위아래 정하기',
              body: `두 교점 사이(예: $x=${p + q === 0 ? 0 : fracTex(p + q, 2)}$)에서 직선이 곡선보다 위에 있어요. 그래서 (직선)−(곡선)을 적분해요.\n$$(${gt})-(${ft})=${diff}$$`,
            },
            {
              title: '정적분 계산',
              body: `$$\\int_{${p}}^{${q}}(${diff})\\,dx=\\Big[${F_TEX(-1, p, q)}\\Big]_{${p}}^{${q}}=${fracTex(n6, 6)}$$`,
            },
          ],
          tip: `$\\dfrac{(\\beta-\\alpha)^3}{6}=\\dfrac{${q - p}^3}{6}=${fracTex(n6, 6)}$ 로 검산할 수 있어요. 두 식의 $x^2$ 계수 차가 $1$ 일 때 쓰는 공식이에요.`,
        };
      }
    },
  },
  {
    id: 'math2-area-distance-distance',
    unitId: UNIT,
    title: '방향이 바뀌는 운동의 움직인 거리',
    make(rng) {
      for (;;) {
        const c = rng.nonzero(-3, 3);
        const p = rng.int(1, 3);
        const T = p + rng.int(1, 3);
        const v = [c, -c * p];
        // 거리 = |c|p²/2 + |c|(T-p)²/2 (속도가 0 인 p 에서 끊어 두 삼각형)
        const d1 = Math.abs(c) * p * p;
        const d2 = Math.abs(c) * (T - p) ** 2;
        const change = c * (T - p) ** 2 - c * p * p;
        const vt = polyTex(v, 't');
        return {
          q: `수직선 위를 움직이는 점 P 의 시각 $t$ 에서의 속도가 $v(t)=${vt}$ ${ieyoTex(vt)}. 시각 $t=0$ 에서 $t=${T}$ 까지 점 P 가 움직인 거리를 구하세요.`,
          choices: null,
          answer: fracAns(d1 + d2, 2),
          answerType: 'fraction',
          check: `r = solve(${polySym(v, 't')}, t)[0]\nans = Abs(integrate(${polySym(v, 't')}, (t, 0, r))) + Abs(integrate(${polySym(v, 't')}, (t, r, ${T})))`,
          concepts: [
            '움직인 거리 $=\\int_a^b|v(t)|\\,dt$',
            '속도가 $0$ 이 되는 시각에서 방향이 바뀌어요.',
          ],
          steps: [
            {
              title: '방향이 바뀌는 시각',
              body: `$v(t)=0$ 에서 $t=${p}$ ${ieyo(p)}. 이때 속도의 부호가 바뀌어요.`,
            },
            {
              title: `$0\\le t\\le ${p}$ 에서 간 거리`,
              body: `$$\\left|\\int_0^{${p}}(${vt})\\,dt\\right|=${fracTex(d1, 2)}$$`,
            },
            {
              title: `$${p}\\le t\\le ${T}$ 에서 간 거리`,
              body: `$$\\left|\\int_{${p}}^{${T}}(${vt})\\,dt\\right|=${fracTex(d2, 2)}$$`,
            },
            {
              title: '더하기',
              body: `$$${fracTex(d1, 2)}+${fracTex(d2, 2)}=${fracTex(d1 + d2, 2)}$$`,
            },
          ],
          tip: `그냥 $\\int_0^{${T}}v(t)\\,dt$ 를 계산하면 $${fracTex(change, 2)}$ ${iga(fracTex(change, 2))} 나와요. 이것은 위치의 변화량이고, 거리는 오고 간 것을 모두 더한 값이에요. 속도 그래프와 $t$ 축 사이 두 삼각형의 넓이를 더해도 같아요.`,
        };
      }
    },
  },
  {
    id: 'math2-area-distance-position',
    unitId: UNIT,
    title: '속도로 나중 위치 구하기',
    make(rng) {
      for (;;) {
        const b = rng.int(-3, 3);
        const c = rng.int(-5, 5);
        const x0 = rng.int(-5, 5);
        const k = rng.int(1, 3);
        const v = [3, 2 * b, c];
        const X = [1, b, c, 0];
        const move = polyEval(X, k);
        const ans = x0 + move;
        if (move === 0 || ans === 0 || Math.abs(ans) > 150) continue;
        const vt = polyTex(v, 't');
        return {
          q: `수직선 위를 움직이는 점 P 의 시각 $t$ 에서의 속도가 $v(t)=${vt}$ ${ieyoTex(vt)}. 시각 $t=0$ 에서 점 P 의 위치가 $${x0}$ 일 때, 시각 $t=${k}$ 에서 점 P 의 위치를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${paren(x0)} + integrate(${polySym(v, 't')}, (t, 0, ${k}))`,
          concepts: [
            '나중 위치 = 처음 위치 + $\\int_0^t v(t)\\,dt$ (위치의 변화량)',
            '위치를 구할 때는 절댓값을 씌우지 않아요.',
          ],
          steps: [
            {
              title: '위치의 변화량',
              body: `$$\\int_0^{${k}}(${vt})\\,dt=\\Big[${polyTex(X, 't')}\\Big]_0^{${k}}=${move}$$`,
            },
            {
              title: '처음 위치에 더하기',
              body: `$$${x0}${signed(move)}=${ans}$$`,
            },
          ],
          tip: `거리와 달리 위치는 방향(부호)을 그대로 살려 더해요. 도중에 방향이 바뀌어도 변화량은 $\\int_0^{${k}}v(t)\\,dt$ 하나로 끝나요.`,
        };
      }
    },
  },
];
