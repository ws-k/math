import type { Generator } from './types.ts';
import {
  fracAns,
  fracTex,
  ieyo,
  jo,
  paren,
  polyDiff,
  polyEval,
  polySym,
  polyTex,
  reduce,
} from './util.ts';

const UNIT = 'calc-param-implicit';

// 검산은 풀이와 다른 길로 계산한다: 음함수는 sympy idiff, 타원 매개변수는 같은 곡선을 음함수로 보고 idiff,
// 역함수는 f(x)=c 를 sympy solve 로 풀어 그 점의 f' 를 쓴다. 풀이 공식을 그대로 다시 적으면
// 공식을 잘못 옮겼을 때 함께 틀려 검산이 무력해지기 때문이다.
// 다항 매개변수는 t 를 지울 수 없어 공식(dy/dt ÷ dx/dt)으로 검산하되, 미분은 sympy 가 한다.

/** 계산 끝의 분수: 분모 1 이면 정수, 약분되거나 음수면 기약분수까지 한 번 더 이어 쓴다 */
function fracChain(n: number, d: number): string {
  if (d === 1) return String(n);
  const r = reduce(n, d);
  const raw = `\\frac{${n}}{${d}}`;
  return r.d === d && n > 0 && d > 0 ? raw : `${raw}=${fracTex(n, d)}`;
}

/** 분수 × π 의 TeX: 1/4 → \frac{\pi}{4}, 3/4 → \frac{3\pi}{4} */
function piTex(n: number, d: number): string {
  const r = reduce(n, d);
  const a = Math.abs(r.n);
  if (r.d === 1) return `${a === 1 ? '' : a}\\pi`;
  return `\\frac{${a === 1 ? '' : a}\\pi}{${r.d}}`;
}

/** [[2,'x^2'],[-1,'xy']] → "2x^2-xy" */
function lin(terms: [number, string][]): string {
  return terms
    .filter(([c]) => c !== 0)
    .map(([c, t], i) => {
      const sign = c < 0 ? '-' : i === 0 ? '' : '+';
      const a = Math.abs(c);
      return `${sign}${a === 1 && t !== '' ? '' : a}${t}`;
    })
    .join('');
}

const PARAM = '$\\dfrac{dy}{dx}=\\dfrac{dy/dt}{dx/dt}$ (단, $\\dfrac{dx}{dt}\\ne0$)';
const IMPLICIT =
  '음함수 미분법: 양변을 $x$ 로 미분하고, $y$ 가 든 항에는 $\\dfrac{dy}{dx}$ 를 곱해요.';
const INVERSE = "역함수의 미분법: $b=f(a)$ 이면 $(f^{-1})'(b)=\\dfrac{1}{f'(a)}$";
const SECOND = "이계도함수: $f''(x)=\\{f'(x)\\}'$, 도함수를 한 번 더 미분해요.";

export const generators: Generator[] = [
  {
    id: 'calc-param-implicit-param',
    unitId: UNIT,
    title: '매개변수로 나타낸 함수의 $\\frac{dy}{dx}$',
    make(rng) {
      for (;;) {
        if (rng.int(0, 2) > 0) {
          const X = [rng.nonzero(-2, 2), rng.int(-3, 3), rng.int(-3, 3)];
          const Y = [rng.nonzero(-2, 2), 0, rng.int(-4, 4), rng.int(-3, 3)];
          const k = rng.nonzero(-2, 2);
          const xd = polyEval(polyDiff(X), k);
          const yd = polyEval(polyDiff(Y), k);
          if (xd === 0 || yd === 0) continue;
          const Xt = polyTex(X, 't');
          const Yt = polyTex(Y, 't');
          const Xd = polyTex(polyDiff(X), 't');
          const Yd = polyTex(polyDiff(Y), 't');
          return {
            q: `매개변수 $t$ 로 나타낸 곡선 $x=${Xt}$, $y=${Yt}$ 에서 $t=${k}$ 일 때 $\\dfrac{dy}{dx}$ 의 값을 구하세요.`,
            choices: null,
            answer: fracAns(yd, xd),
            answerType: 'fraction',
            check: `diff(${polySym(Y, 't')}, t).subs(t, ${k})/diff(${polySym(X, 't')}, t).subs(t, ${k})`,
            concepts: [PARAM],
            steps: [
              {
                title: '각각 $t$ 로 미분하기',
                body: `$$\\frac{dx}{dt}=${Xd},\\quad \\frac{dy}{dt}=${Yd}$$`,
              },
              {
                title: `$t=${k}$ 대입`,
                body: `$\\dfrac{dx}{dt}=${xd}$, $\\dfrac{dy}{dt}=${yd}$ ${ieyo(yd)}.`,
              },
              {
                title: '나누기',
                body: `$$\\frac{dy}{dx}=\\frac{dy/dt}{dx/dt}=${fracChain(yd, xd)}$$`,
              },
            ],
            tip: `분자와 분모를 바꿔 $\\frac{dx/dt}{dy/dt}$ 로 쓰면 역수인 $${fracTex(xd, yd)}$ ${jo(fracTex(xd, yd), '이/가')} 나와요. 구하는 것이 $\\frac{dy}{dx}$ 이니 $y$ 쪽이 위예요.`,
          };
        }
        // 타원 x=a cos t, y=b sin t: π/4 의 홀수 배에서 cos t / sin t = ±1 이라 답이 유리수
        const a = rng.int(1, 5);
        const b = rng.int(1, 5);
        if (a === b) continue;
        const m = rng.pick([1, 3, 5, 7]);
        // cot t: π/4 → 1, 3π/4 → −1, 5π/4 → 1, 7π/4 → −1
        const cot = m === 1 || m === 5 ? 1 : -1;
        const s = m === 1 || m === 3 ? 1 : -1;
        const c = m === 1 || m === 7 ? 1 : -1;
        const th = piTex(m, 4);
        const A = a === 1 ? '' : String(a);
        const B = b === 1 ? '' : String(b);
        const r2 = '\\frac{\\sqrt2}{2}';
        const sv = s > 0 ? r2 : `-${r2}`;
        const cv = c > 0 ? r2 : `-${r2}`;
        return {
          q: `매개변수 $t$ 로 나타낸 곡선 $x=${A}\\cos t$, $y=${B}\\sin t$ 에서 $t=${th}$ 일 때 $\\dfrac{dy}{dx}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(-b * cot, a),
          answerType: 'fraction',
          // 같은 곡선을 음함수 x²/a²+y²/b²=1 로 보고 그 점의 기울기를 따로 구한다
          check: `idiff(x**2/${a * a} + y**2/${b * b} - 1, y, x).subs({x: ${a}*cos(${m}*pi/4), y: ${b}*sin(${m}*pi/4)})`,
          concepts: [PARAM, "$(\\cos t)'=-\\sin t$, $(\\sin t)'=\\cos t$"],
          steps: [
            {
              title: '각각 $t$ 로 미분하기',
              body: `$$\\frac{dx}{dt}=-${A}\\sin t,\\quad \\frac{dy}{dt}=${B}\\cos t$$`,
            },
            {
              title: `$t=${th}$ 의 값`,
              body: `$\\sin ${th}=${sv}$, $\\cos ${th}=${cv}$ 이에요.`,
            },
            {
              title: '나누기',
              body: `$\\sqrt2$ 는 약분돼요.\n$$\\frac{dy}{dx}=\\frac{${B}\\cos t}{-${A}\\sin t}=\\frac{${b}\\cdot${paren(c)}}{-${a}\\cdot${paren(s)}}=${fracTex(-b * cot, a)}$$`,
            },
          ],
          tip: `$t$ 를 지우면 $\\frac{x^2}{${a * a}}+\\frac{y^2}{${b * b}}=1$ 인 타원이에요. 음함수로 미분해도 같은 기울기가 나와요.`,
        };
      }
    },
  },
  {
    id: 'calc-param-implicit-implicit',
    unitId: UNIT,
    title: '음함수의 접선 기울기',
    make(rng) {
      for (;;) {
        const m = rng.int(-2, 2);
        const n = rng.int(1, 2);
        const x0 = rng.nonzero(-3, 3);
        const y0 = rng.nonzero(-3, 3);
        const C = x0 * x0 + m * x0 * y0 + n * y0 * y0;
        const num = -(2 * x0 + m * y0);
        const den = m * x0 + 2 * n * y0;
        // m²=4n 이면 좌변이 완전제곱식((x±y)²)이라 곡선이 아니라 직선 두 개가 된다
        if (m * m === 4 * n || C <= 0 || num === 0 || den === 0 || C > 30) continue;
        const F = lin([
          [1, 'x^2'],
          [m, 'xy'],
          [n, 'y^2'],
        ]);
        const sym = `x**2 + ${m}*x*y + ${n}*y**2`;
        const D = '\\frac{dy}{dx}';
        // xy 항은 곱의 미분이라 y 와 x·dy/dx 두 항이 생긴다(m=0 이면 그 항이 없다)
        const dmid =
          m === 0
            ? ''
            : `${m > 0 ? '+' : '-'}${Math.abs(m) === 1 ? '' : Math.abs(m)}\\left(y+x${D}\\right)`;
        const coefTex = lin([
          [m, 'x'],
          [2 * n, 'y'],
        ]);
        const restTex = lin([
          [2, 'x'],
          [m, 'y'],
        ]);
        return {
          q: `곡선 $${F}=${C}$ 위의 점 $(${x0},\\ ${y0})$ 에서의 접선의 기울기를 구하세요.`,
          choices: null,
          answer: fracAns(num, den),
          answerType: 'fraction',
          check: `idiff(${sym} - ${C}, y, x).subs({x: ${x0}, y: ${y0}})`,
          concepts: [
            IMPLICIT,
            '$\\dfrac{d}{dx}y^2=2y\\dfrac{dy}{dx}$',
            "곱의 미분법: $(xy)'=y+x\\dfrac{dy}{dx}$",
          ],
          steps: [
            {
              title: '양변을 $x$ 로 미분하기',
              body: `$$2x${dmid}+${2 * n}y${D}=0$$`,
            },
            {
              title: `$${D}$ 로 묶기`,
              body: `$$\\left(${coefTex}\\right)${D}=-\\left(${restTex}\\right)$$`,
            },
            {
              title: `점 $(${x0},\\ ${y0})$ 대입`,
              body: `$${coefTex}$ 의 값은 $${den}$, $${restTex}$ 의 값은 $${-num}$ ${ieyo(-num)}.\n$$${D}=${fracChain(num, den)}$$`,
            },
          ],
          tip: `$y$ 를 $x$ 의 식으로 풀지 않아도 기울기를 구할 수 있어요. $y^2$ 을 미분할 때 $${D}$ 를 곱하는 것을 빠뜨리지 마세요.`,
        };
      }
    },
  },
  {
    id: 'calc-param-implicit-inverse',
    unitId: UNIT,
    title: '역함수의 미분계수',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 4);
        const b = rng.int(-3, 3);
        const k = rng.int(-2, 2);
        const c = k ** 3 + a * k + b;
        const fd = 3 * k * k + a;
        const f = [1, 0, a, b];
        const F = polyTex(f);
        return {
          q: `함수 $f(x)=${F}$ 의 역함수를 $g(x)$ 라 할 때, $g'(${c})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(1, fd),
          answerType: 'fraction',
          // f 가 증가함수라 f(x)=c 의 실근은 하나뿐 — 그 근을 sympy 가 직접 찾게 한다
          check: `r = [s for s in solve(Eq(${polySym(f)}, ${c}), x) if s.is_real][0]\nans = 1/diff(${polySym(f)}, x).subs(x, r)`,
          concepts: [INVERSE, "$f'(x)=3x^2+a>0$ 이면 $f$ 는 증가함수라 역함수가 있어요."],
          steps: [
            {
              title: `$f(x)=${c}$ 인 $x$ 찾기`,
              body: `작은 정수를 넣어 보면 $f(${k})=${c}$ ${ieyo(c)}. $f$ 는 증가함수라 이런 $x$ 는 $${k}$ 하나뿐이에요. 곧 $g(${c})=${k}$ ${ieyo(k)}.`,
            },
            {
              title: '$f$ 의 도함수',
              body: `$$f'(x)=3x^2+${a},\\quad f'(${k})=${fd}$$`,
            },
            {
              title: '역수 취하기',
              body: `$$g'(${c})=\\frac{1}{f'(${k})}=${fracTex(1, fd)}$$`,
            },
          ],
          tip: `$g'(${c})=\\frac{1}{f'(${c})}$ 로 쓰면 틀려요. $${c}$ ${jo(c, '은/는')} $f$ 의 출력값이라, $f$ 에 넣을 입력값 $${k}$ ${jo(k, '을/를')} 먼저 찾아야 해요.`,
        };
      }
    },
  },
  {
    id: 'calc-param-implicit-second',
    unitId: UNIT,
    title: '이계도함수의 값',
    make(rng) {
      for (;;) {
        const kind = rng.int(0, 2);
        if (kind === 0) {
          const a = rng.nonzero(-3, 3);
          const b = rng.nonzero(-3, 3);
          const n = rng.pick([3, 4]);
          const k = rng.int(-2, 2);
          const v = a * k + b;
          if (v === 0 || Math.abs(v) > 3) continue;
          const ans = n * (n - 1) * a * a * v ** (n - 2);
          if (Math.abs(ans) > 300) continue;
          const G = polyTex([a, b]);
          return {
            q: `함수 $f(x)=(${G})^${n}$ 에 대하여 $f''(${k})$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `diff((${polySym([a, b])})**${n}, x, 2).subs(x, ${k})`,
            concepts: [SECOND, "합성함수의 미분법: $\\{(ax+b)^n\\}'=n(ax+b)^{n-1}\\cdot a$"],
            steps: [
              {
                title: '한 번 미분하기',
                body: `$$f'(x)=${n}(${G})^${n - 1}\\cdot ${paren(a)}=${n * a}(${G})^${n - 1}$$`,
              },
              {
                title: '한 번 더 미분하기',
                body: `안쪽 미분 $${a}$ ${jo(a, '이/가')} 또 곱해져요.\n$$f''(x)=${n * a}\\cdot${n - 1}(${G})${n - 2 === 1 ? '' : `^${n - 2}`}\\cdot ${paren(a)}=${n * (n - 1) * a * a}(${G})${n - 2 === 1 ? '' : `^${n - 2}`}$$`,
              },
              {
                title: `$x=${k}$ 대입`,
                body: `$${G}$ 의 값은 $${v}$ 이므로\n$$f''(${k})=${n * (n - 1) * a * a}\\cdot${paren(v)}${n - 2 === 1 ? '' : `^${n - 2}`}=${ans}$$`,
              },
            ],
            tip: `두 번 미분하면 안쪽 미분 $${a}$ 도 두 번 곱해져 $${a * a}$ ${jo(a * a, '이/가')} 돼요. 한 번만 곱하면 답이 달라져요.`,
          };
        }
        if (kind === 1) {
          // c sin ax + d cos ax 는 두 번 미분하면 −a² 배가 된다: f'' = −a² f
          const a = rng.int(1, 3);
          const c = rng.nonzero(-3, 3);
          const d = rng.nonzero(-3, 3);
          const atZero = rng.int(0, 1) === 0;
          const ans = atZero ? -a * a * d : -a * a * c;
          const A = a === 1 ? 'x' : `${a}x`;
          const f = lin([
            [c, `\\sin ${A}`],
            [d, `\\cos ${A}`],
          ]);
          const th = atZero ? '0' : piTex(1, 2 * a);
          const at = atZero ? '0' : `pi/${2 * a}`;
          const fAt = atZero ? d : c;
          return {
            q: `함수 $f(x)=${f}$ 에 대하여 $f''\\left(${th}\\right)$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `diff(${c}*sin(${a}*x) + ${d}*cos(${a}*x), x, 2).subs(x, ${at})`,
            concepts: [SECOND, "$(\\sin ax)'=a\\cos ax$, $(\\cos ax)'=-a\\sin ax$"],
            steps: [
              {
                title: '한 번 미분하기',
                body: `$$f'(x)=${lin([
                  [c * a, `\\cos ${A}`],
                  [-d * a, `\\sin ${A}`],
                ])}$$`,
              },
              {
                title: '한 번 더 미분하기',
                body: `$$f''(x)=${lin([
                  [-c * a * a, `\\sin ${A}`],
                  [-d * a * a, `\\cos ${A}`],
                ])}=-${a * a === 1 ? '' : a * a}f(x)$$`,
              },
              {
                title: `$x=${th}$ 대입`,
                body: `$f\\left(${th}\\right)=${fAt}$ 이므로\n$$f''\\left(${th}\\right)=-${a * a}\\cdot${paren(fAt)}=${ans}$$`,
              },
            ],
            tip: `$\\sin$ 과 $\\cos$ 은 두 번 미분하면 부호만 바뀐 자기 자신(안쪽 계수의 제곱배)으로 돌아와요.`,
          };
        }
        // (x+p)e^x: 곱의 미분을 두 번 하면 f'' = (x+p+2)e^x
        const p = rng.int(-4, 4);
        if (p + 2 === 0) continue;
        const P = polyTex([1, p]);
        return {
          q: `함수 $f(x)=(${P})e^x$ 에 대하여 $f''(0)$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p + 2),
          answerType: 'int',
          check: `diff((x + ${paren(p)})*exp(x), x, 2).subs(x, 0)`,
          concepts: [SECOND, "$(e^x)'=e^x$", "곱의 미분법: $\\{f(x)g(x)\\}'=f'(x)g(x)+f(x)g'(x)$"],
          steps: [
            {
              title: '한 번 미분하기',
              body: `$$f'(x)=1\\cdot e^x+(${P})e^x=(${polyTex([1, p + 1])})e^x$$`,
            },
            {
              title: '한 번 더 미분하기',
              body: `$$f''(x)=e^x+(${polyTex([1, p + 1])})e^x=(${polyTex([1, p + 2])})e^x$$`,
            },
            {
              title: '$x=0$ 대입',
              body: `$e^0=1$ 이므로 $f''(0)=${p + 2}$ ${ieyo(p + 2)}.`,
            },
          ],
          tip: `$(x+p)e^x$ 는 미분할 때마다 괄호 안 상수만 $1$ 씩 커져요.`,
        };
      }
    },
  },
];
