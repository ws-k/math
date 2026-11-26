import type { Generator } from './types.ts';
import { eul, fracAns, fracTex, ieyo, iga, reduce } from './util.ts';

const UNIT = 'calc-integral-app';

// 정적분의 활용(미적 26·28번)은 "무엇을 잘게 나눠 더하는가 → 그 정적분"을 세우는 게 핵심이라,
// 풀이는 늘 ① 식 세우기(급수→정적분, 단면 넓이, 속력) ② 적분 ③ 끝값 순서로 쓴다.
// 답이 e·ln·π 없이 유리수가 되도록 끝값을 e^k·ln m·π 처럼 함수와 맞물리게 고른다.
// 검산은 sympy 로 정적분을 직접 계산한다 — 급수의 극한을 sympy 로 바로 구하면 시드당 수십 초가 걸려서.

/** 계수 s 를 식 앞에: 1 이면 생략 */
const coef = (s: number, body: string) => (s === 1 ? body : `${s}${body}`);

/** 분수를 답·TeX 로 */
function frac(n: number, d: number) {
  const r = reduce(n, d);
  return { ans: fracAns(r.n, r.d), tex: fracTex(r.n, r.d) };
}

/** e^k 의 TeX(1 이면 e) */
const eTex = (k: number) => (k === 1 ? 'e' : `e^{${k}}`);

const RIEMANN =
  '$\\displaystyle\\lim_{n\\to\\infty}\\sum_{k=1}^{n}f\\!\\left(a+\\frac{(b-a)k}{n}\\right)\\frac{b-a}{n}=\\int_a^b f(x)\\,dx$';
const VOLUME = '단면의 넓이가 $S(x)$ 인 입체의 부피: $V=\\int_a^b S(x)\\,dx$';
const LENGTH = "곡선 $y=f(x)$ 의 길이: $\\int_a^b\\sqrt{1+\\{f'(x)\\}^2}\\,dx$";
const DIST =
  '평면 위를 움직인 거리: $\\int_a^b\\sqrt{\\left(\\dfrac{dx}{dt}\\right)^2+\\left(\\dfrac{dy}{dt}\\right)^2}\\,dt$';

export const generators: Generator[] = [
  {
    id: 'calc-integral-app-riemann',
    unitId: UNIT,
    title: '급수의 합을 정적분으로',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['polyB', 'poly1', 'recip'] as const);
        if (kind === 'recip') {
          // Σ n/(n+ck)² = (1/n)Σ 1/(1+c·k/n)² → ∫₀¹ 1/(1+cx)² dx = 1/(1+c)
          const s = rng.int(1, 4);
          const c = rng.int(1, 3);
          const r = frac(s, 1 + c);
          const ck = c === 1 ? 'k' : `${c}k`;
          const cx = c === 1 ? 'x' : `${c}x`;
          return {
            q: `$\\displaystyle\\lim_{n\\to\\infty}\\sum_{k=1}^{n}\\frac{${coef(s, 'n')}}{(n+${ck})^2}$ 의 값을 구하세요.`,
            choices: null,
            answer: r.ans,
            answerType: 'fraction',
            check: `integrate(${s}/(1 + ${c}*x)**2, (x, 0, 1))`,
            concepts: [
              RIEMANN,
              '$\\dfrac1n$ 을 하나 꺼내고 나머지를 $\\dfrac kn$ 의 식으로 만들어요.',
            ],
            steps: [
              {
                title: '$\\frac1n$ 꺼내기',
                body: `분모·분자를 $n^2$ 으로 나누면 $\\dfrac{${coef(s, 'n')}}{(n+${ck})^2}=\\dfrac1n\\cdot\\dfrac{${s}}{\\left(1+${c === 1 ? '' : c}\\frac kn\\right)^2}$ 이에요.`,
              },
              {
                title: '정적분으로',
                body: `$\\dfrac kn$ 을 $x$ 로, $\\dfrac1n$ 을 $dx$ 로 보면 $\\displaystyle\\int_0^1\\frac{${s}}{(1+${cx})^2}\\,dx$ 예요.`,
              },
              {
                title: '적분',
                body: `$$\\Big[-\\frac{${s}}{${c === 1 ? '' : c}(1+${cx})}\\Big]_0^1=${fracTex(s, c)}\\left(1-\\frac{1}{${1 + c}}\\right)=${r.tex}$$`,
              },
            ],
            tip: '분모가 $n^2$ 차이면 $n^2$ 으로 나눠 $\\dfrac1n\\times(\\dfrac kn$ 의 식$)$ 꼴을 만들어요. 남는 $n$ 이 하나도 없어야 정적분으로 바뀌어요.',
          };
        }
        const a = rng.int(0, 2);
        const b = kind === 'polyB' ? rng.int(1, 3) : rng.int(2, 3);
        const lo = a;
        const hi = a + b;
        const num = hi ** 3 - lo ** 3;
        const r = kind === 'polyB' ? frac(num, 3) : frac(num, 3 * b);
        const bk = b === 1 ? '\\frac{k}{n}' : `\\frac{${b}k}{n}`;
        const inner = a === 0 ? bk : `${a}+${bk}`;
        const front = kind === 'polyB' ? `\\frac{${b}}{n}` : '\\frac{1}{n}';
        const integral =
          kind === 'polyB'
            ? `\\int_{${lo}}^{${hi}}x^2\\,dx`
            : `\\frac{1}{${b}}\\int_{${lo}}^{${hi}}x^2\\,dx`;
        return {
          q: `$\\displaystyle\\lim_{n\\to\\infty}\\sum_{k=1}^{n}${front}\\left(${inner}\\right)^2$ 의 값을 구하세요.`,
          choices: null,
          answer: r.ans,
          answerType: 'fraction',
          check:
            kind === 'polyB'
              ? `integrate(x**2, (x, ${lo}, ${hi}))`
              : `integrate(x**2, (x, ${lo}, ${hi}))/${b}`,
          concepts: [
            RIEMANN,
            '한 칸의 폭은 괄호 안 $\\dfrac kn$ 앞의 수에 $\\dfrac1n$ 을 곱한 거예요.',
          ],
          steps: [
            {
              title: '$x$ 와 폭 정하기',
              body: `$x=${inner}$ 로 보면 $x$ 는 $${lo}$ 부터 $${hi}$ 까지 움직이고, 한 칸의 폭은 $\\dfrac{${b}}{n}$ ${ieyo(b)}.`,
            },
            {
              title: '정적분으로',
              body:
                kind === 'polyB'
                  ? `앞의 $\\dfrac{${b}}{n}$ ${iga(b)} 바로 폭이라 $\\displaystyle${integral}$ 예요.`
                  : `앞에는 $\\dfrac1n=\\dfrac1{${b}}\\cdot\\dfrac{${b}}{n}$ 이 있어서 $\\displaystyle${integral}$ 예요.`,
            },
            {
              title: '적분',
              body: `$$${integral}=${kind === 'polyB' ? '' : `\\frac{1}{${b}}\\cdot`}\\frac{${hi}^3-${lo}^3}{3}=${r.tex}$$`,
            },
          ],
          tip:
            kind === 'polyB'
              ? '$x=0$ 부터로 보고 $\\displaystyle\\int_0^{' +
                b +
                '}(' +
                (a === 0 ? '' : `${a}+`) +
                'x)^2dx$ 로 세워도 같은 값이 나와요. 시작점을 어디로 잡든 폭과 끝값만 맞으면 돼요.'
              : `폭은 $\\dfrac{${b}}{n}$ 인데 식에는 $\\dfrac1n$ 만 있어요. 모자라는 $\\dfrac1{${b}}$ 을 곱하는 걸 빠뜨리면 $${fracTex(num, 3)}$ ${eul(fracTex(num, 3))} 답으로 쓰게 돼요.`,
        };
      }
    },
  },
  {
    id: 'calc-integral-app-volume',
    unitId: UNIT,
    title: '단면의 넓이로 입체의 부피 구하기',
    make(rng) {
      const s = rng.int(1, 4);
      const kind = rng.pick(['xexp', 'sin', 'log', 'exp', 'lnx'] as const);
      let side: string;
      let lo: string;
      let hi: string;
      let loS: string;
      let hiS: string;
      let gS: string;
      let r: { ans: string; tex: string };
      let calc: string;
      let tip: string;
      if (kind === 'xexp') {
        side = `\\sqrt{${coef(s, 'xe^{x}')}}`;
        [lo, hi, loS, hiS, gS] = ['0', '1', '0', '1', `${s}*x*exp(x)`];
        r = frac(s, 1);
        calc = `부분적분으로 $\\displaystyle\\int_0^1xe^{x}\\,dx=\\Big[xe^{x}-e^{x}\\Big]_0^1=1$ 이라 부피는 $${r.tex}$ ${ieyo(r.tex)}.`;
        tip =
          '$xe^{x}$ 는 부분적분으로 적분해요. 단면이 정사각형이라 넓이는 한 변의 제곱, 곧 근호가 벗겨진 식이에요.';
      } else if (kind === 'sin') {
        side = `\\sqrt{${coef(s, '\\sin x')}}`;
        [lo, hi, loS, hiS, gS] = ['0', '\\pi', '0', 'pi', `${s}*sin(x)`];
        r = frac(2 * s, 1);
        calc = `$\\displaystyle\\int_0^{\\pi}\\sin x\\,dx=\\Big[-\\cos x\\Big]_0^{\\pi}=2$ 라 부피는 $${r.tex}$ ${ieyo(r.tex)}.`;
        tip = '$0\\le x\\le\\pi$ 에서 $\\sin x\\ge0$ 이라 근호 안이 음수가 되지 않아요.';
      } else if (kind === 'log') {
        side = `\\sqrt{${coef(s, '\\ln x')}}`;
        [lo, hi, loS, hiS, gS] = ['1', 'e', '1', 'E', `${s}*log(x)`];
        r = frac(s, 1);
        calc = `부분적분으로 $\\displaystyle\\int_1^{e}\\ln x\\,dx=\\Big[x\\ln x-x\\Big]_1^{e}=1$ 이라 부피는 $${r.tex}$ ${ieyo(r.tex)}.`;
        tip = "$\\int\\ln x\\,dx=x\\ln x-x+C$ 는 부분적분($f=\\ln x$, $g'=1$)으로 구해요.";
      } else if (kind === 'exp') {
        const m = rng.int(2, 5);
        side = `\\sqrt{${coef(s, 'e^{x}')}}`;
        [lo, hi, loS, hiS, gS] = ['0', `\\ln ${m}`, '0', `log(${m})`, `${s}*exp(x)`];
        r = frac(s * (m - 1), 1);
        calc = `$\\displaystyle\\int_0^{\\ln ${m}}e^{x}\\,dx=${m}-1=${m - 1}$ 이라 부피는 $${r.tex}$ ${ieyo(r.tex)}.`;
        tip = `$e^{\\ln ${m}}=${m}$ 이에요. 끝값에 $\\ln$ 이 있으면 $e^{x}$ 와 만나 깔끔한 수가 돼요.`;
      } else {
        const k = rng.int(1, 2);
        side = `\\sqrt{\\dfrac{${coef(s, '\\ln x')}}{x}}`;
        [lo, hi, loS, hiS, gS] = ['1', eTex(k), '1', `exp(${k})`, `${s}*log(x)/x`];
        r = frac(s * k * k, 2);
        calc = `$t=\\ln x$ 로 치환하면 $\\displaystyle\\int_0^{${k}}${coef(s, 't')}\\,dt=${r.tex}$ ${ieyo(r.tex)}.`;
        tip = '$\\dfrac{\\ln x}{x}$ 는 $t=\\ln x$ 로 치환해요. $x=1$ 이면 $t=0$ 이에요.';
      }
      const area = side.replace(/^\\sqrt\{(.*)\}$/, '$1');
      return {
        q: `$${lo}\\le x\\le ${hi}$ 에서 $x$ 축 위의 점 $(x,\\,0)$ 을 지나고 $x$ 축에 수직인 평면으로 자른 단면이 한 변의 길이가 $${side}$ 인 정사각형인 입체가 있어요. 이 입체의 부피를 구하세요.`,
        choices: null,
        answer: r.ans,
        answerType: 'fraction',
        check: `integrate(${gS}, (x, ${loS}, ${hiS}))`,
        concepts: [VOLUME, '정사각형 단면의 넓이 = (한 변)²'],
        steps: [
          { title: '단면의 넓이', body: `$S(x)=\\left(${side}\\right)^2=${area}$ 예요.` },
          { title: '부피의 식', body: `$$V=\\int_{${lo}}^{${hi}}${area}\\,dx$$` },
          { title: '적분', body: calc },
        ],
        tip,
      };
    },
  },
  {
    id: 'calc-integral-app-length',
    unitId: UNIT,
    title: '곡선의 길이와 평면 위를 움직인 거리',
    make(rng) {
      const kind = rng.pick(['cat', 'semi', 'motion'] as const);
      if (kind === 'cat') {
        const m = rng.int(2, 5);
        const r = frac(m * m - 1, 2 * m);
        return {
          q: `곡선 $y=\\dfrac{e^{x}+e^{-x}}{2}$ 의 $0\\le x\\le\\ln ${m}$ 부분의 길이를 구하세요.`,
          choices: null,
          answer: r.ans,
          answerType: 'fraction',
          check: `T = Symbol('T', positive=True)\nf = (exp(T) + exp(-T))/2\nans = integrate(sqrt(factor(expand(1 + diff(f, T)**2))), (T, 0, log(${m})))`,
          concepts: [LENGTH],
          steps: [
            { title: '도함수', body: "$y'=\\dfrac{e^{x}-e^{-x}}{2}$ 예요." },
            {
              title: '근호 안 정리',
              body: "$$1+(y')^2=\\frac{4+e^{2x}-2+e^{-2x}}{4}=\\left(\\frac{e^{x}+e^{-x}}{2}\\right)^2$$",
            },
            {
              title: '길이의 식',
              body: `$$\\int_0^{\\ln ${m}}\\frac{e^{x}+e^{-x}}{2}\\,dx=\\Big[\\frac{e^{x}-e^{-x}}{2}\\Big]_0^{\\ln ${m}}$$`,
            },
            {
              title: '끝값',
              body: `$e^{\\ln ${m}}=${m}$, $e^{-\\ln ${m}}=\\dfrac1{${m}}$ 이라 $\\dfrac12\\left(${m}-\\dfrac1{${m}}\\right)=${r.tex}$ ${ieyo(r.tex)}.`,
            },
          ],
          tip: "근호 안이 완전제곱식이 되도록 만들어진 곡선이에요. $1+(y')^2$ 을 먼저 통분해 제곱 꼴을 찾아요.",
        };
      }
      if (kind === 'semi') {
        const b = rng.pick([3, 8, 15]);
        const root = Math.sqrt(1 + b);
        const r = frac(2 * (root ** 3 - 1), 3);
        return {
          q: `곡선 $y=\\dfrac23x^{\\frac32}$ 의 $0\\le x\\le ${b}$ 부분의 길이를 구하세요.`,
          choices: null,
          answer: r.ans,
          answerType: 'fraction',
          check: `T = Symbol('T', positive=True)\nf = Rational(2, 3)*T**Rational(3, 2)\nans = integrate(sqrt(1 + diff(f, T)**2), (T, 0, ${b}))`,
          concepts: [LENGTH],
          steps: [
            { title: '도함수', body: "$y'=x^{\\frac12}=\\sqrt x$ 예요." },
            { title: '길이의 식', body: `$$\\int_0^{${b}}\\sqrt{1+x}\\,dx$$` },
            {
              title: '적분',
              body: `$$\\Big[\\frac23(1+x)^{\\frac32}\\Big]_0^{${b}}=\\frac23(${root}^3-1)=${r.tex}$$`,
            },
          ],
          tip: `$(1+${b})^{\\frac32}=\\sqrt{${1 + b}}^{\\,3}=${root}^3$ 이에요. 끝값을 $1+x$ 가 제곱수가 되게 골라서 근호가 풀려요.`,
        };
      }
      const s = rng.int(1, 3);
      const b = rng.int(1, 3);
      const r = frac(s * (b ** 3 + 3 * b), 3);
      const xt = s === 3 ? 't^3-3t' : `\\frac{${s}}{3}t^3-${coef(s, 't')}`;
      const xs = `${s}*(t**3/3 - t)`;
      const ys = `${s}*t**2`;
      return {
        q: `좌표평면 위를 움직이는 점 P 의 시각 $t$ 에서의 위치가 $x=${xt}$, $y=${coef(s, 't^2')}$ 일 때, 시각 $t=0$ 부터 $t=${b}$ 까지 점 P 가 움직인 거리를 구하세요.`,
        choices: null,
        answer: r.ans,
        answerType: 'fraction',
        check: `T = Symbol('T', positive=True)\nX = (${xs}).subs(t, T)\nY = (${ys}).subs(t, T)\nans = integrate(sqrt(factor(expand(diff(X, T)**2 + diff(Y, T)**2))), (T, 0, ${b}))`,
        concepts: [DIST],
        steps: [
          {
            title: '속도',
            body: `$\\dfrac{dx}{dt}=${s === 1 ? 't^2-1' : `${s}(t^2-1)`}$, $\\dfrac{dy}{dt}=${2 * s}t$ 예요.`,
          },
          {
            title: '속력',
            body: `$$\\sqrt{${s === 1 ? '' : `${s}^2`}(t^2-1)^2+${s === 1 ? '' : `${s}^2\\cdot`}4t^2}=${s === 1 ? '' : s}\\sqrt{(t^2+1)^2}=${s === 1 ? 't^2+1' : `${s}(t^2+1)`}$$`,
          },
          {
            title: '거리',
            body: `$$\\int_0^{${b}}${coef(s, '(t^2+1)')}\\,dt=${s === 1 ? '' : s}\\Big[\\frac{t^3}{3}+t\\Big]_0^{${b}}=${r.tex}$$`,
          },
        ],
        tip: '$(t^2-1)^2+4t^2=t^4+2t^2+1=(t^2+1)^2$ 이라 근호가 풀려요. 제곱의 합을 합의 제곱으로 착각하지 마세요.',
      };
    },
  },
  {
    id: 'calc-integral-app-area',
    unitId: UNIT,
    title: '지수·로그·삼각함수 그래프와 넓이',
    make(rng) {
      const s = rng.int(1, 4);
      const kind = rng.pick(['exp', 'recip', 'sin', 'cos', 'lnx'] as const);
      if (kind === 'cos') {
        const r = 2 * s;
        return {
          q: `곡선 $y=${coef(s, '\\cos x')}$ $(0\\le x\\le\\pi)$ 와 $x$ 축으로 둘러싸인 부분의 넓이를 구하세요.`,
          choices: null,
          answer: String(r),
          answerType: 'int',
          check: `integrate(${s}*cos(x), (x, 0, pi/2)) - integrate(${s}*cos(x), (x, pi/2, pi))`,
          concepts: ['넓이는 $\\int_a^b|f(x)|\\,dx$ — $x$ 축 아래 부분은 부호를 바꿔 더해요.'],
          steps: [
            {
              title: '끊는 점',
              body: '$\\cos x=0$ 인 $x=\\dfrac{\\pi}{2}$ 에서 곡선이 $x$ 축 아래로 내려가요.',
            },
            {
              title: '위쪽 조각',
              body: `$$\\int_0^{\\frac{\\pi}{2}}${coef(s, '\\cos x')}\\,dx=${s}$$`,
            },
            {
              title: '아래쪽 조각',
              body: `$$\\int_{\\frac{\\pi}{2}}^{\\pi}${coef(s, '\\cos x')}\\,dx=-${s}$$\n음수라 부호를 바꾼 $${s}$ ${iga(s)} 이 조각의 넓이예요.`,
            },
            { title: '더하기', body: `$${s}+${s}=${r}$ ${ieyo(r)}.` },
          ],
          tip: `한 번에 $\\int_0^{\\pi}$ 로 적분하면 $0$ 이 나와요. 정적분과 넓이는 다르다는 걸 보여 주는 대표적인 예예요.`,
        };
      }
      let fTex: string;
      let range: string;
      let gS: string;
      let lo: string;
      let hi: string;
      let r: { ans: string; tex: string };
      let calc: string;
      if (kind === 'exp') {
        const m = rng.int(2, 5);
        fTex = coef(s, 'e^{x}');
        range = `0\\le x\\le\\ln ${m}`;
        [gS, lo, hi] = [`${s}*exp(x)`, '0', `log(${m})`];
        r = frac(s * (m - 1), 1);
        calc = `$$\\int_0^{\\ln ${m}}${fTex}\\,dx=${s === 1 ? '' : s}(${m}-1)=${r.tex}$$`;
      } else if (kind === 'recip') {
        const k = rng.int(1, 3);
        fTex = `\\dfrac{${s}}{x}`;
        range = `1\\le x\\le ${eTex(k)}`;
        [gS, lo, hi] = [`${s}/x`, '1', `exp(${k})`];
        r = frac(s * k, 1);
        calc = `$$\\int_1^{${eTex(k)}}\\frac{${s}}{x}\\,dx=${s === 1 ? '' : s}\\Big[\\ln x\\Big]_1^{${eTex(k)}}=${r.tex}$$`;
      } else if (kind === 'sin') {
        fTex = coef(s, '\\sin x');
        range = '0\\le x\\le\\pi';
        [gS, lo, hi] = [`${s}*sin(x)`, '0', 'pi'];
        r = frac(2 * s, 1);
        calc = `$$\\int_0^{\\pi}${fTex}\\,dx=${s === 1 ? '' : s}\\Big[-\\cos x\\Big]_0^{\\pi}=${s === 1 ? '' : `${s}\\cdot`}2=${r.tex}$$`;
      } else {
        const k = rng.int(1, 2);
        fTex = `\\dfrac{${coef(s, '\\ln x')}}{x}`;
        range = `1\\le x\\le ${eTex(k)}`;
        [gS, lo, hi] = [`${s}*log(x)/x`, '1', `exp(${k})`];
        r = frac(s * k * k, 2);
        calc = `$t=\\ln x$ 로 치환하면 $\\displaystyle\\int_0^{${k}}${coef(s, 't')}\\,dt=${r.tex}$ ${ieyo(r.tex)}.`;
      }
      const where = `$${range}$ 에서 곡선 $y=${fTex}$ 아래, $x$ 축 위에 있는 부분의 넓이를 구하세요.`;
      return {
        q: where,
        choices: null,
        answer: r.ans,
        answerType: 'fraction',
        check: `integrate(${gS}, (x, ${lo}, ${hi}))`,
        concepts: ['곡선과 $x$ 축 사이 넓이: $\\int_a^b|f(x)|\\,dx$'],
        steps: [
          {
            title: '위인지 아래인지',
            body: '구간 안에서 곡선은 $x$ 축 위(또는 위에 닿음)에 있어서, 정적분이 그대로 넓이예요.',
          },
          { title: '적분', body: calc },
        ],
        tip:
          kind === 'lnx'
            ? '$x=1$ 에서 $\\ln x=0$ 이라 곡선이 $x$ 축과 만나요. 그래서 왼쪽 끝은 따로 주지 않아도 $x=1$ 이에요.'
            : '넓이를 구할 땐 먼저 곡선이 구간에서 $x$ 축 위에 있는지 확인해요. 아래로 내려가는 곳이 있으면 거기서 끊어요.',
      };
    },
  },
];
