import type { Generator } from './types.ts';
import { eul, ieyo, iga, ira, paren, polySym, polyTex } from './util.ts';

const UNIT = 'calc-diff-app';

// 미적분의 도함수 활용은 수학Ⅱ 와 달리 초월함수(eˣ·ln x)가 섞이고 이계도함수(f″)로 휘는 방향을 본다.
// 손계산이 정수로 떨어지게, 접점은 eˣ 의 지수가 0 이 되는 곳·ln 의 안이 1 이 되는 곳으로 고른다
// (e⁰=1, ln 1=0 이라 e·ln 이 답에 남지 않는다). 답이 0 이거나 너무 크면 다시 뽑는다.
const MAX = 60;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

/** "+3" / "-3" / "" — 식 뒤에 상수를 이어 붙일 때(0 이면 생략) */
const plusC = (n: number) => (n === 0 ? '' : n < 0 ? String(n) : `+${n}`);

/** 계수 a 를 식 앞에: 1 이면 생략, -1 이면 부호만 */
const coef = (a: number, body: string) => (a === 1 ? body : a === -1 ? `-${body}` : `${a}${body}`);

/** e^{x-p} 의 TeX·sympy. p=0 이면 eˣ */
const expTex = (p: number) => (p === 0 ? 'e^{x}' : `e^{${polyTex([1, -p])}}`);
const expSym = (p: number) => (p === 0 ? 'exp(x)' : `exp(${polySym([1, -p])})`);

const TANGENT = "곡선 $y=f(x)$ 위의 점 $(a,f(a))$ 에서의 접선: $y-f(a)=f'(a)(x-a)$";
const EXP_D =
  "$(e^{x})'=e^{x}$, $(\\ln x)'=\\dfrac1x$ — 안쪽이 $x-p$ 여도 안쪽의 도함수가 $1$ 이라 그대로예요.";
const CONCAVE = "$f''(x)>0$ 이면 아래로 볼록, $f''(x)<0$ 이면 위로 볼록";
const INFLECT = "변곡점: $f''(a)=0$ 이고 그 좌우에서 $f''(x)$ 의 부호가 바뀌는 점";
const PRODUCT = "곱의 미분법: $\\{f(x)g(x)\\}'=f'(x)g(x)+f(x)g'(x)$";
const SPEED =
  '평면 위를 움직이는 점의 속력: $\\sqrt{\\left(\\dfrac{dx}{dt}\\right)^2+\\left(\\dfrac{dy}{dt}\\right)^2}$';

export const generators: Generator[] = [
  {
    id: 'calc-diff-app-tangent',
    unitId: UNIT,
    title: '지수·로그함수 그래프의 접선',
    make(rng) {
      for (;;) {
        const a = rng.pick([1, 2, 3, -1, -2, -3]);
        const q = rng.int(-4, 4);
        const kind = rng.pick(['exp', 'log'] as const);
        if (kind === 'exp') {
          const p = rng.int(-2, 3);
          const ans = a * (1 - p) + q;
          if (!okAns(ans)) continue;
          const f = `${coef(a, expTex(p))}${plusC(q)}`;
          const fd = coef(a, expTex(p));
          const y0 = a + q;
          return {
            q: `곡선 $y=${f}$ 위의 점 $(${p},\\,${y0})$ 에서의 접선의 $y$ 절편을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `f = ${a}*${expSym(p)} + ${q}\nx0 = ${p}\nans = f.subs(x, x0) - diff(f, x).subs(x, x0)*x0`,
            concepts: [TANGENT, EXP_D],
            steps: [
              {
                title: '접점 확인',
                body: `$x=${p}$ 이면 지수가 $0$ 이라 $e^{0}=1$, $y=${paren(a)}\\cdot1${plusC(q)}=${y0}$ ${ieyo(y0)}.`,
              },
              {
                title: '도함수',
                body: `$y'=${fd}$ 이라 $x=${p}$ 에서 기울기는 $${a}$ ${ieyo(a)}.`,
              },
              {
                title: '접선의 방정식',
                body: `$$y-${paren(y0)}=${a}\\{x-${paren(p)}\\}$$`,
              },
              {
                title: '$y$ 절편',
                body: `$x=0$ 을 넣으면 $y=${a}\\cdot${paren(-p)}${plusC(y0)}=${ans}$ ${ieyo(ans)}.`,
              },
            ],
            tip: `접점에서 $e$ 의 지수가 $0$ 이 되도록 골랐기 때문에 $e$ 가 답에 남지 않아요. 지수가 $0$ 이 아닌 점이면 기울기가 $e^{\\square}$ 꼴로 남아요.`,
          };
        }
        // ln(x-p) 는 x=p+1 에서 안이 1 이라 ln 1=0, 기울기 a/(1)=a
        const p = rng.int(-2, 2);
        const x0 = p + 1;
        const ans = q - a * x0;
        if (!okAns(ans)) continue;
        const inner = p === 0 ? 'x' : `(${polyTex([1, -p])})`;
        const innerSym = p === 0 ? 'x' : polySym([1, -p]);
        const f = `${coef(a, `\\ln ${inner}`)}${plusC(q)}`;
        const den = p === 0 ? 'x' : polyTex([1, -p]);
        const fd = `${a < 0 ? '-' : ''}\\dfrac{${Math.abs(a)}}{${den}}`;
        return {
          q: `곡선 $y=${f}$ 위의 점 $(${x0},\\,${q})$ 에서의 접선의 $y$ 절편을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${a}*log(${innerSym}) + ${q}\nx0 = ${x0}\nans = f.subs(x, x0) - diff(f, x).subs(x, x0)*x0`,
          concepts: [TANGENT, EXP_D],
          steps: [
            {
              title: '접점 확인',
              body: `$x=${x0}$ 이면 로그 안이 $1$ 이라 $\\ln 1=0$, $y=${q}$ ${ieyo(q)}.`,
            },
            {
              title: '도함수',
              body: `$y'=${fd}$ ${ira(a)} $x=${x0}$ 에서 기울기는 $${a}$ ${ieyo(a)}.`,
            },
            {
              title: '접선의 방정식',
              body: `$$y-${paren(q)}=${a}(x-${paren(x0)})$$`,
            },
            {
              title: '$y$ 절편',
              body: `$x=0$ 을 넣으면 $y=${a}\\cdot${paren(-x0)}${plusC(q)}=${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: '$\\ln$ 안이 $1$ 이 되는 점을 접점으로 잡으면 함숫값에 $\\ln$ 이 남지 않아요. 접선의 기울기는 $\\dfrac{a}{x-p}$ 에 접점을 넣은 값이에요.',
        };
      }
    },
  },
  {
    id: 'calc-diff-app-inflection',
    unitId: UNIT,
    title: '변곡점 찾기',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['cubic', 'expPlus', 'expMinus'] as const);
        if (kind === 'cubic') {
          // f''(x)=6x-6p 이 되도록 x² 의 계수를 -3p 로 잡는다
          const p = rng.nonzero(-2, 2);
          const b = rng.int(-5, 5);
          const c = rng.int(-5, 5);
          const f = [1, -3 * p, b, c];
          const fp = -2 * p ** 3 + b * p + c;
          const ans = p + fp;
          if (!okAns(ans)) continue;
          const ft = polyTex(f);
          return {
            q: `곡선 $y=${ft}$ 의 변곡점의 좌표를 $(a,\\,b)$ 라 할 때, $a+b$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `f = ${polySym(f)}\np = solve(diff(f, x, 2), x)[0]\nans = p + f.subs(x, p)`,
            concepts: [CONCAVE, INFLECT],
            steps: [
              { title: '한 번 미분', body: `$$y'=${polyTex([3, -6 * p, b])}$$` },
              { title: '두 번 미분', body: `$$y''=${polyTex([6, -6 * p])}$$` },
              {
                title: "$y''=0$ 인 곳",
                body: `$x=${p}$ ${ieyo(p)}. 일차식이라 이 점 좌우에서 $y''$ 의 부호가 바뀌어요.`,
              },
              {
                title: '변곡점의 $y$ 좌표',
                body: `$x=${p}$ ${eul(p)} 넣으면 $b=${fp}$ ${ieyo(fp)}.`,
              },
              { title: '답', body: `$a+b=${p}+${paren(fp)}=${ans}$ ${ieyo(ans)}.` },
            ],
            tip: '삼차함수의 변곡점은 언제나 하나이고, 그래프는 그 점에 대해 대칭이에요. 극값이 있으면 두 극점의 한가운데가 변곡점이에요.',
          };
        }
        // (x+a)e^{±x}: 곱의 미분을 두 번 하면 (일차식)·e^{±x} 이 되고, e^{±x}>0 이라 부호는 일차식이 정한다
        const a = rng.int(-4, 4);
        const plus = kind === 'expPlus';
        const p = plus ? -a - 2 : 2 - a;
        if (p === 0) continue;
        const lin = polyTex([1, a]);
        const e = plus ? 'e^{x}' : 'e^{-x}';
        const d1 = plus ? polyTex([1, a + 1]) : polyTex([-1, 1 - a]);
        const d2 = plus ? polyTex([1, a + 2]) : polyTex([1, a - 2]);
        return {
          q: `곡선 $y=(${lin})${e}$ 의 변곡점의 $x$ 좌표를 구하세요.`,
          choices: null,
          answer: String(p),
          answerType: 'int',
          check: `solve(diff((${polySym([1, a])})*exp(${plus ? 'x' : '-x'}), x, 2), x)[0]`,
          concepts: [PRODUCT, plus ? "$(e^{x})'=e^{x}$" : "$(e^{-x})'=-e^{-x}$", INFLECT],
          steps: [
            {
              title: '한 번 미분',
              body: plus
                ? `$$y'=1\\cdot e^{x}+(${lin})e^{x}=(${d1})e^{x}$$`
                : `$$y'=1\\cdot e^{-x}-(${lin})e^{-x}=(${d1})e^{-x}$$`,
            },
            {
              title: '두 번 미분',
              body: plus
                ? `$$y''=1\\cdot e^{x}+(${d1})e^{x}=(${d2})e^{x}$$`
                : `$$y''=-e^{-x}-(${d1})e^{-x}=(${d2})e^{-x}$$`,
            },
            {
              title: "$y''$ 의 부호",
              body: `$${e}>0$ 이라 부호는 $${d2}$ ${iga(d2)} 정해요. $x=${p}$ 좌우에서 부호가 바뀌어요.`,
            },
            { title: '답', body: `변곡점의 $x$ 좌표는 $${p}$ ${ieyo(p)}.` },
          ],
          tip: `$e^{x}$ 꼴은 몇 번을 미분해도 $(\\text{다항식})\\times e^{x}$ 모양이 유지돼요. $e^{x}$ 는 언제나 양수라 부호는 앞의 다항식만 보면 돼요.`,
        };
      }
    },
  },
  {
    id: 'calc-diff-app-speed',
    unitId: UNIT,
    title: '평면 위를 움직이는 점의 속력',
    make(rng) {
      // 속도의 두 성분을 피타고라스 수로 맞춰 속력이 정수가 되게 한다
      const triples: [number, number][] = [
        [3, 4],
        [4, 3],
        [6, 8],
        [8, 6],
        [5, 12],
        [12, 5],
      ];
      for (;;) {
        const [u0, v] = rng.pick(triples);
        const u = rng.pick([1, -1]) * u0;
        const k = rng.int(1, 3);
        const alpha = u - 2 * k;
        if (alpha === 0 || Math.abs(alpha) > 10) continue;
        const kind = rng.pick(['log', 'exp'] as const);
        const xt = polyTex([1, alpha, 0], 't');
        const xs = polySym([1, alpha, 0], 't');
        const beta = v * k;
        if (kind === 'log' && beta > 24) continue;
        const yt = kind === 'log' ? `${beta}\\ln t` : `${v}e^{t-${k}}`;
        const ys = kind === 'log' ? `${beta}*log(t)` : `${v}*exp(t - ${k})`;
        const ydt = kind === 'log' ? `\\dfrac{${beta}}{t}` : `${v}e^{t-${k}}`;
        const ans = Math.sqrt(u * u + v * v);
        return {
          q: `좌표평면 위를 움직이는 점 P 의 시각 $t\\,(t>0)$ 에서의 위치 $(x,\\,y)$ 가 다음과 같아요.\n$$x=${xt},\\quad y=${yt}$$\n시각 $t=${k}$ 에서 점 P 의 속력을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `sqrt(diff(${xs}, t)**2 + diff(${ys}, t)**2).subs(t, ${k})`,
          concepts: [
            '속도는 위치를 시각으로 미분한 $\\left(\\dfrac{dx}{dt},\\,\\dfrac{dy}{dt}\\right)$',
            SPEED,
          ],
          steps: [
            {
              title: '가로 방향 속도',
              body: `$\\dfrac{dx}{dt}=${polyTex([2, alpha], 't')}$ ${ira(alpha)} $t=${k}$ 에서 $${u}$ ${ieyo(u)}.`,
            },
            {
              title: '세로 방향 속도',
              body: `$\\dfrac{dy}{dt}=${ydt}$ ${kind === 'log' ? ira(beta) : '이라'} $t=${k}$ 에서 $${v}$ ${ieyo(v)}.`,
            },
            {
              title: '속력',
              body: `$$\\sqrt{${paren(u)}^2+${v}^2}=\\sqrt{${u * u + v * v}}=${ans}$$`,
            },
          ],
          tip: `속력은 속도 $(${u},\\,${v})$ 의 크기예요. 두 성분을 그냥 더한 $${u + v}$ ${eul(u + v)} 답으로 쓰는 실수가 많아요.`,
        };
      }
    },
  },
  {
    id: 'calc-diff-app-inequality',
    unitId: UNIT,
    title: '부등식이 늘 성립하는 조건(최솟값)',
    make(rng) {
      for (;;) {
        const c = rng.pick([1, 2, 3]);
        const p = rng.int(-3, 3);
        const minus = rng.pick([false, true]);
        // c·e^{x-p} - cx 는 x=p 에서, c·e^{p-x} + cx 는 x=p 에서 가장 작다
        const ans = minus ? c * (1 + p) : c * (1 - p);
        if (!okAns(ans)) continue;
        const ex = minus ? (p === 0 ? 'e^{-x}' : `e^{${polyTex([-1, p])}}`) : expTex(p);
        const exs = minus ? `exp(${polySym([-1, p])})` : expSym(p);
        const lhs = coef(c, ex);
        const rhs = minus ? `${coef(-c, 'x')}+k` : `${coef(c, 'x')}+k`;
        const g = minus ? `${coef(c, ex)}+${coef(c, 'x')}` : `${coef(c, ex)}-${coef(c, 'x')}`;
        const gd = minus ? `-${coef(c, ex)}+${c}` : `${coef(c, ex)}-${c}`;
        const gp = minus ? `${c}+${c}\\cdot${paren(p)}` : `${c}-${c}\\cdot${paren(p)}`;
        return {
          q: `모든 실수 $x$ 에 대하여 부등식 $${lhs}\\ge ${rhs}$ 가 성립하도록 하는 실수 $k$ 의 최댓값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `minimum(${c}*${exs} ${minus ? '+' : '-'} ${c}*x, x)`,
          concepts: [
            '$f(x)\\ge k$ 가 늘 성립 ⇔ $f(x)$ 의 최솟값 $\\ge k$',
            "$f'(a)=0$ 이고 $f''(a)>0$ 이면 $x=a$ 에서 극소",
          ],
          steps: [
            {
              title: '한쪽으로 모으기',
              body: `$g(x)=${g}$ 라 하면 $g(x)\\ge k$ 가 늘 성립해야 해요. 곧 $k$ 는 $g(x)$ 의 최솟값 이하예요.`,
            },
            {
              title: '도함수',
              body: `$g'(x)=${gd}$ ${iga(gd)} $0$ 이 되는 건 지수가 $0$ 인 $x=${p}$ 일 때예요.`,
            },
            {
              title: '극소 확인',
              body: `$g''(x)=${coef(c, ex)}>0$ 이라 $x=${p}$ 에서 극소이자 최소예요.`,
            },
            {
              title: '최솟값',
              body: `$g(${p})=${gp}=${ans}$ ${ira(ans)} $k$ 의 최댓값은 $${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: `그래프로 보면 곡선이 직선 $y=${rhs}$ 보다 늘 위에 있어야 해요. $k$ 가 최대일 때 직선이 곡선에 접하고, 접점은 $x=${p}$ ${ieyo(p)}. 직선의 기울기와 곡선의 기울기가 같아지는 곳을 찾은 것과 같아요.`,
        };
      }
    },
  },
];
