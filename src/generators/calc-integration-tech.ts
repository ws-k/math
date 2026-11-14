import { ieyo, iga } from './math2-indefinite.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, polySym, polyTex, reduce } from './util.ts';

const UNIT = 'calc-integration-tech';

// 미적 24·26번(치환적분·부분적분)처럼 "어떤 적분법을 고를지 → 끝값 정리"를 연습하는 게 목적이다.
// 답이 e·ln·π 없이 유리수로 떨어지게 끝값을 고른다: 치환은 새 변수의 끝이 정수·1/2 이 되게,
// 부분적분은 e^x·sin·cos 가 0 또는 1 이 되는 끝을 잡는다. 답이 0 이거나 너무 크면 다시 뽑는다.
const MAX = 400;

/** 계수 a 를 식 앞에: 1 이면 생략, -1 이면 부호만 */
const coef = (a: number, body: string) => (a === 1 ? body : a === -1 ? `-${body}` : `${a}${body}`);

/** 분수 (n/d) 를 답과 TeX 로 */
function frac(n: number, d: number) {
  const r = reduce(n, d);
  return { ans: fracAns(r.n, r.d), tex: fracTex(r.n, r.d), n: r.n, d: r.d };
}

/** 정적분 끝값 글자(π 의 배수) */
const PI_TEX: Record<string, string> = {
  'pi/2': '\\frac{\\pi}{2}',
  'pi/3': '\\frac{\\pi}{3}',
  'pi/4': '\\frac{\\pi}{4}',
  'pi/6': '\\frac{\\pi}{6}',
  pi: '\\pi',
};

const SUB = "치환적분: $\\int f(g(x))g'(x)\\,dx=\\int f(t)\\,dt$ ($t=g(x)$)";
const SUB_DEF = '정적분을 치환하면 끝값도 $t=g(a)$, $t=g(b)$ 로 바꿔요.';
const PARTS =
  "부분적분: $\\int_a^b f(x)g'(x)\\,dx=\\Big[f(x)g(x)\\Big]_a^b-\\int_a^b f'(x)g(x)\\,dx$";
const PARTS_HINT =
  "미분하면 간단해지는 쪽(다항식·$\\ln x$)을 $f$ 로, 적분하기 쉬운 쪽을 $g'$ 로 잡아요.";

export const generators: Generator[] = [
  {
    id: 'calc-integration-tech-sub-poly',
    unitId: UNIT,
    title: '치환적분으로 정적분 구하기(다항식·삼각함수)',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['poly', 'sin', 'cos'] as const);
        if (kind === 'poly') {
          // ∫_0^b 2s·x(x²+c)ⁿ dx, t=x²+c 로 바꾸면 s∫ tⁿ dt
          const s = rng.int(1, 3);
          const c = rng.nonzero(-1, 3);
          const n = rng.int(1, 3);
          const b = rng.int(1, 2);
          const lo = c;
          const hi = b * b + c;
          const num = s * (hi ** (n + 1) - lo ** (n + 1));
          const r = frac(num, n + 1);
          if (r.n === 0 || Math.abs(r.n / r.d) > MAX) continue;
          const inner = polyTex([1, 0, c]);
          const innerSym = polySym([1, 0, c]);
          const pw = n === 1 ? '' : `^${n}`;
          const integrand = `${2 * s}x(${inner})${pw}`;
          const tn = n === 1 ? 't' : `t^${n}`;
          const prim = `\\frac{${s === 1 ? '' : s}t^{${n + 1}}}{${n + 1}}`;
          return {
            q: `정적분 $\\displaystyle\\int_0^{${b}}${integrand}\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: r.ans,
            answerType: 'fraction',
            check: `integrate(${2 * s}*x*(${innerSym})**${n}, (x, 0, ${b}))`,
            concepts: [SUB, SUB_DEF],
            steps: [
              {
                title: '무엇을 $t$ 로 둘까',
                body: `$t=${inner}$ 라 하면 $\\dfrac{dt}{dx}=2x$, 곧 $2x\\,dx=dt$ 예요.`,
              },
              {
                title: '끝값 바꾸기',
                body: `$x=0$ 이면 $t=${lo}$, $x=${b}$ 이면 $t=${hi}$ ${ieyo(hi)}.`,
              },
              {
                title: '$t$ 의 적분으로',
                body: `$$\\int_{${lo}}^{${hi}}${coef(s, tn)}\\,dt=\\Big[${prim}\\Big]_{${lo}}^{${hi}}$$`,
              },
              {
                title: '계산',
                body: `$$\\frac{${s === 1 ? '' : s}(${hi}^{${n + 1}}-${paren(lo)}^{${n + 1}})}{${n + 1}}=${r.tex}$$`,
              },
            ],
            tip:
              '끝값을 $t$ 로 바꿨으니 다시 $x$ 로 되돌릴 필요가 없어요. 끝값을 안 바꾸고 $0$, $' +
              b +
              '$ 를 그대로 넣는 실수가 가장 많아요.',
          };
        }
        // sinⁿx·cos x 는 t=sin x, cosⁿx·sin x 는 t=cos x
        const s = rng.int(1, 3);
        const n = rng.int(1, 3);
        const up =
          kind === 'sin'
            ? rng.pick(['pi/2', 'pi/6'] as const)
            : rng.pick(['pi/2', 'pi/3'] as const);
        // 끝값에서의 t 값(분자, 분모)
        const tEnd: [number, number] = up === 'pi/2' ? (kind === 'sin' ? [1, 1] : [0, 1]) : [1, 2];
        const tStart: [number, number] = kind === 'sin' ? [0, 1] : [1, 1];
        // s/(n+1) · (끝^{n+1} − 시작^{n+1}) — 끝과 시작은 0, 1, 1/2 뿐이라 분모는 2^{n+1}
        const pw = (v: [number, number]) => [v[0] ** (n + 1), v[1] ** (n + 1)] as const;
        const [en, ed] = pw(tEnd);
        const [sn, sd] = pw(tStart);
        const raw = frac(s * (en * sd - sn * ed), ed * sd * (n + 1));
        // cos 는 dt=−sin x dx 라 부호가 뒤집혀 결국 양수
        const r = kind === 'sin' ? raw : frac(-raw.n, raw.d);
        if (r.n === 0) continue;
        const fn = kind === 'sin' ? '\\sin' : '\\cos';
        const other = kind === 'sin' ? '\\cos' : '\\sin';
        const integrand = `${s === 1 ? '' : s}${fn}${n === 1 ? ' ' : `^{${n}}`}x\\,${other} x`;
        const sym = `${s}*${kind}(x)**${n}*${kind === 'sin' ? 'cos' : 'sin'}(x)`;
        const tTex = (v: [number, number]) => fracTex(v[0], v[1]);
        const a = tTex(tStart);
        const b = tTex(tEnd);
        return {
          q: `정적분 $\\displaystyle\\int_0^{${PI_TEX[up]}}${integrand}\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: r.ans,
          answerType: 'fraction',
          check: `integrate(${sym}, (x, 0, ${up}))`,
          concepts: [
            SUB,
            SUB_DEF,
            kind === 'sin' ? "$(\\sin x)'=\\cos x$" : "$(\\cos x)'=-\\sin x$",
          ],
          steps: [
            {
              title: '무엇을 $t$ 로 둘까',
              body:
                kind === 'sin'
                  ? '$t=\\sin x$ 라 하면 $dt=\\cos x\\,dx$ 예요. 뒤에 붙은 $\\cos x$ 가 바로 $dt$ 가 돼요.'
                  : '$t=\\cos x$ 라 하면 $dt=-\\sin x\\,dx$ 예요. 뒤에 붙은 $\\sin x\\,dx$ 는 $-dt$ 가 돼요.',
            },
            {
              title: '끝값 바꾸기',
              body: `$x=0$ 이면 $t=${a}$, $x=${PI_TEX[up]}$ 이면 $t=${b}$ ${ieyo(b)}.`,
            },
            {
              title: '$t$ 의 적분으로',
              body:
                kind === 'sin'
                  ? `$$\\int_{${a}}^{${b}}${coef(s, n === 1 ? 't' : `t^{${n}}`)}\\,dt=\\Big[\\frac{${s === 1 ? '' : s}t^{${n + 1}}}{${n + 1}}\\Big]_{${a}}^{${b}}$$`
                  : `$$-\\int_{${a}}^{${b}}${coef(s, n === 1 ? 't' : `t^{${n}}`)}\\,dt=\\int_{${b}}^{${a}}${coef(s, n === 1 ? 't' : `t^{${n}}`)}\\,dt=\\Big[\\frac{${s === 1 ? '' : s}t^{${n + 1}}}{${n + 1}}\\Big]_{${b}}^{${a}}$$`,
            },
            { title: '계산', body: `값은 $${r.tex}$ ${ieyo(r.tex)}.` },
          ],
          tip:
            kind === 'sin'
              ? '$\\sin x$ 의 거듭제곱 옆에 $\\cos x$ 가 하나 붙어 있으면 $t=\\sin x$ 가 바로 통해요.'
              : '$t=\\cos x$ 로 바꾸면 $-$ 가 생기는데, 위끝·아래끝을 바꾸면 $-$ 가 사라져요. 부호를 하나씩 따라가면 실수가 줄어요.',
        };
      }
    },
  },
  {
    id: 'calc-integration-tech-sub-explog',
    unitId: UNIT,
    title: '치환적분으로 정적분 구하기(지수·로그)',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['log', 'exp'] as const);
        const s = rng.int(1, 3);
        if (kind === 'log') {
          // ∫_1^{e^k} s(ln x)ⁿ/x dx = s·kⁿ⁺¹/(n+1)
          const k = rng.int(1, 3);
          const n = rng.int(1, 3);
          const r = frac(s * k ** (n + 1), n + 1);
          if (r.n / r.d > MAX) continue;
          const up = k === 1 ? 'e' : `e^{${k}}`;
          const lnPow = n === 1 ? '\\ln x' : `(\\ln x)^{${n}}`;
          return {
            q: `정적분 $\\displaystyle\\int_1^{${up}}\\frac{${s === 1 ? '' : s}${lnPow}}{x}\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: r.ans,
            answerType: 'fraction',
            check: `integrate(${s}*log(x)**${n}/x, (x, 1, exp(${k})))`,
            concepts: [SUB, "$(\\ln x)'=\\dfrac1x$"],
            steps: [
              {
                title: '무엇을 $t$ 로 둘까',
                body: '$t=\\ln x$ 라 하면 $dt=\\dfrac1x\\,dx$ 예요. 분모의 $x$ 가 $dt$ 로 들어가요.',
              },
              {
                title: '끝값 바꾸기',
                body: `$x=1$ 이면 $t=\\ln1=0$, $x=${up}$ 이면 $t=${k}$ ${ieyo(k)}.`,
              },
              {
                title: '$t$ 의 적분으로',
                body: `$$\\int_0^{${k}}${coef(s, n === 1 ? 't' : `t^{${n}}`)}\\,dt=\\Big[\\frac{${s === 1 ? '' : s}t^{${n + 1}}}{${n + 1}}\\Big]_0^{${k}}=${r.tex}$$`,
              },
            ],
            tip: '$\\dfrac{(\\ln x)^n}{x}$ 처럼 $\\ln x$ 와 $\\dfrac1x$ 가 함께 있으면 $t=\\ln x$ 를 먼저 떠올려요.',
          };
        }
        // ∫_0^{ln a} s·eˣ(eˣ−1)ⁿ dx, t=eˣ−1 → s·(a−1)ⁿ⁺¹/(n+1)
        const a = rng.int(2, 4);
        const n = rng.int(1, 2);
        const r = frac(s * (a - 1) ** (n + 1), n + 1);
        if (r.n / r.d > MAX) continue;
        const pw = n === 1 ? '' : `^{${n}}`;
        return {
          q: `정적분 $\\displaystyle\\int_0^{\\ln ${a}}${s === 1 ? '' : s}e^{x}(e^{x}-1)${pw}\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: r.ans,
          answerType: 'fraction',
          check: `integrate(${s}*exp(x)*(exp(x) - 1)**${n}, (x, 0, log(${a})))`,
          concepts: [SUB, "$(e^{x})'=e^{x}$, $e^{\\ln a}=a$"],
          steps: [
            {
              title: '무엇을 $t$ 로 둘까',
              body: '$t=e^{x}-1$ 이라 하면 $dt=e^{x}\\,dx$ 예요.',
            },
            {
              title: '끝값 바꾸기',
              body: `$x=0$ 이면 $t=1-1=0$, $x=\\ln ${a}$ 이면 $t=${a}-1=${a - 1}$ ${ieyo(a - 1)}.`,
            },
            {
              title: '$t$ 의 적분으로',
              body: `$$\\int_0^{${a - 1}}${coef(s, n === 1 ? 't' : `t^{${n}}`)}\\,dt=\\Big[\\frac{${s === 1 ? '' : s}t^{${n + 1}}}{${n + 1}}\\Big]_0^{${a - 1}}=${r.tex}$$`,
            },
          ],
          tip: `$e^{\\ln ${a}}=${a}$ 예요. 지수와 로그가 서로 풀어 줘서 끝값이 깔끔한 수가 돼요.`,
        };
      }
    },
  },
  {
    id: 'calc-integration-tech-parts',
    unitId: UNIT,
    title: '부분적분으로 정적분 구하기',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['exp', 'xsin', 'xcos', 'log'] as const);
        if (kind === 'exp') {
          // ∫_p^0 (ax+b)eˣ dx 에서 b=a(1−p) 로 잡으면 원시함수 (ax+b−a)eˣ 가 x=p 에서 0 이 된다
          const a = rng.pick([1, 2, 3, -1, -2]);
          const p = rng.int(-3, -1);
          const b = a * (1 - p);
          const ans = -a * p;
          const lin = polyTex([a, b]);
          const F = polyTex([a, b - a]);
          return {
            q: `정적분 $\\displaystyle\\int_{${p}}^{0}(${lin})e^{x}\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `integrate((${polySym([a, b])})*exp(x), (x, ${p}, 0))`,
            concepts: [PARTS, PARTS_HINT],
            steps: [
              {
                title: '무엇을 미분할까',
                body: `$f(x)=${lin}$, $g'(x)=e^{x}$ 로 잡으면 $f'(x)=${a}$, $g(x)=e^{x}$ 예요.`,
              },
              {
                title: '부분적분',
                body: `$$\\Big[(${lin})e^{x}\\Big]_{${p}}^{0}-\\int_{${p}}^{0}${coef(a, 'e^{x}')}\\,dx=\\Big[(${F})e^{x}\\Big]_{${p}}^{0}$$`,
              },
              {
                title: '끝값 넣기',
                body: `$x=${p}$ 이면 $${F}$ ${iga(F)} $0$ 이 돼요. $x=0$ 이면 $(${b - a})\\cdot e^{0}=${b - a}$ ${ieyo(b - a)}.`,
              },
              { title: '답', body: `$${b - a}-0=${ans}$ ${ieyo(ans)}.` },
            ],
            tip: `원시함수가 $(${F})e^{x}$ 꼴이 되는 건 $\\{(${F})e^{x}\\}'=(${lin})e^{x}$ 로 미분해서 확인할 수 있어요.`,
          };
        }
        const k = rng.pick([1, 2, 3, -1, -2]);
        if (kind === 'xsin') {
          return {
            q: `정적분 $\\displaystyle\\int_0^{\\frac{\\pi}{2}}${coef(k, 'x')}\\sin x\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: String(k),
            answerType: 'int',
            check: `integrate(${k}*x*sin(x), (x, 0, pi/2))`,
            concepts: [PARTS, PARTS_HINT, "$(\\cos x)'=-\\sin x$"],
            steps: [
              {
                title: '무엇을 미분할까',
                body: `$f(x)=${coef(k, 'x')}$, $g'(x)=\\sin x$ 로 잡으면 $f'(x)=${k}$, $g(x)=-\\cos x$ 예요.`,
              },
              {
                title: '부분적분',
                body: `$$\\Big[${coef(-k, 'x')}\\cos x\\Big]_0^{\\frac{\\pi}{2}}+\\int_0^{\\frac{\\pi}{2}}${coef(k, '\\cos x')}\\,dx$$`,
              },
              {
                title: '앞부분',
                body: '$\\cos\\dfrac{\\pi}{2}=0$ 이고 $x=0$ 에서도 $x$ 가 $0$ 이라 앞부분은 $0$ 이에요.',
              },
              {
                title: '뒷부분',
                body: `$$\\Big[${coef(k, '\\sin x')}\\Big]_0^{\\frac{\\pi}{2}}=${k}$$`,
              },
            ],
            tip: '$-\\cos x$ 의 $-$ 와 부분적분의 $-$ 가 만나 $+$ 가 돼요. 부호를 두 번 뒤집는 곳에서 실수가 가장 많아요.',
          };
        }
        if (kind === 'xcos') {
          const ans = -2 * k;
          return {
            q: `정적분 $\\displaystyle\\int_0^{\\pi}${coef(k, 'x')}\\cos x\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `integrate(${k}*x*cos(x), (x, 0, pi))`,
            concepts: [PARTS, PARTS_HINT, "$(\\sin x)'=\\cos x$"],
            steps: [
              {
                title: '무엇을 미분할까',
                body: `$f(x)=${coef(k, 'x')}$, $g'(x)=\\cos x$ 로 잡으면 $f'(x)=${k}$, $g(x)=\\sin x$ 예요.`,
              },
              {
                title: '부분적분',
                body: `$$\\Big[${coef(k, 'x')}\\sin x\\Big]_0^{\\pi}-\\int_0^{\\pi}${coef(k, '\\sin x')}\\,dx$$`,
              },
              { title: '앞부분', body: '$\\sin\\pi=0$, $\\sin0=0$ 이라 앞부분은 $0$ 이에요.' },
              {
                title: '뒷부분',
                body: `$$-\\Big[${coef(-k, '\\cos x')}\\Big]_0^{\\pi}=${coef(k, '')}${k === 1 || k === -1 ? '' : '\\cdot'}(\\cos\\pi-\\cos0)=${ans}$$`,
              },
            ],
            tip: '$\\cos\\pi=-1$ 이에요. $\\cos\\pi-\\cos0=-2$ 에서 부호를 놓치지 않게 괄호를 쳐서 계산해요.',
          };
        }
        // k·ln x: f=ln x, g'=1 로 보는 부분적분
        return {
          q: `정적분 $\\displaystyle\\int_1^{e}${coef(k, '\\ln x')}\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `integrate(${k}*log(x), (x, 1, E))`,
          concepts: [PARTS, "$\\ln x$ 하나만 있으면 $g'(x)=1$ 로 보고 부분적분해요."],
          steps: [
            {
              title: '무엇을 미분할까',
              body: "$f(x)=\\ln x$, $g'(x)=1$ 로 잡으면 $f'(x)=\\dfrac1x$, $g(x)=x$ 예요.",
            },
            {
              title: '부분적분',
              body: `$$${coef(k, '')}${k === 1 || k === -1 ? '' : '\\cdot'}\\left(\\Big[x\\ln x\\Big]_1^{e}-\\int_1^{e}x\\cdot\\frac1x\\,dx\\right)$$`,
            },
            { title: '앞부분', body: '$e\\ln e-1\\cdot\\ln1=e$ 예요.' },
            { title: '뒷부분', body: '$\\displaystyle\\int_1^{e}1\\,dx=e-1$ 이에요.' },
            { title: '답', body: `$${paren(k)}\\cdot\\{e-(e-1)\\}=${k}$ ${ieyo(k)}.` },
          ],
          tip: '$\\int\\ln x\\,dx=x\\ln x-x+C$ 는 자주 쓰여서 외워 두면 편해요. 미분하면 $\\ln x+1-1=\\ln x$ 로 확인돼요.',
        };
      }
    },
  },
  {
    id: 'calc-integration-tech-basic',
    unitId: UNIT,
    title: '여러 가지 함수의 정적분',
    make(rng) {
      for (;;) {
        const kind = rng.pick(['trig', 'recip', 'exp', 'sec'] as const);
        if (kind === 'trig') {
          const a = rng.nonzero(-4, 5);
          const b = rng.nonzero(-4, 5);
          const ans = a + b;
          if (ans === 0) continue;
          return {
            q: `정적분 $\\displaystyle\\int_0^{\\frac{\\pi}{2}}(${coef(a, '\\cos x')}${b < 0 ? '' : '+'}${coef(b, '\\sin x')})\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `integrate(${a}*cos(x) + ${b}*sin(x), (x, 0, pi/2))`,
            concepts: ['$\\int\\cos x\\,dx=\\sin x+C$', '$\\int\\sin x\\,dx=-\\cos x+C$'],
            steps: [
              {
                title: '원시함수',
                body: `$$${coef(a, '\\sin x')}${-b < 0 ? '' : '+'}${coef(-b, '\\cos x')}$$`,
              },
              {
                title: '위끝 $\\frac{\\pi}{2}$',
                body: `$\\sin\\dfrac{\\pi}{2}=1$, $\\cos\\dfrac{\\pi}{2}=0$ 이라 $${a}$ ${ieyo(a)}.`,
              },
              {
                title: '아래끝 $0$',
                body: `$\\sin0=0$, $\\cos0=1$ 이라 $${-b}$ ${ieyo(-b)}.`,
              },
              { title: '빼기', body: `$${a}-${paren(-b)}=${ans}$ ${ieyo(ans)}.` },
            ],
            tip: '$\\sin x$ 의 원시함수는 $-\\cos x$ 예요. 앞의 $-$ 를 빠뜨리면 $b$ 의 부호가 거꾸로 나와요.',
          };
        }
        const a = rng.pick([1, 2, 3, 4, -2, -3]);
        if (kind === 'recip') {
          const k = rng.int(1, 3);
          const up = k === 1 ? 'e' : `e^{${k}}`;
          return {
            q: `정적분 $\\displaystyle\\int_1^{${up}}\\frac{${a}}{x}\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: String(a * k),
            answerType: 'int',
            check: `integrate(${a}/x, (x, 1, exp(${k})))`,
            concepts: ['$\\int\\dfrac1x\\,dx=\\ln|x|+C$', '$\\ln e^{k}=k$, $\\ln 1=0$'],
            steps: [
              { title: '원시함수', body: `$${coef(a, '\\ln x')}$ 예요($x>0$ 이라 절댓값은 떼요).` },
              {
                title: '끝값 넣기',
                body: `$$${coef(a, '')}${a === 1 ? '' : '\\cdot'}(\\ln ${up}-\\ln1)=${a === 1 ? '' : `${paren(a)}\\cdot`}${k}=${a * k}$$`,
              },
            ],
            tip: '$\\dfrac1x$ 은 거듭제곱 공식 $\\dfrac{x^{n+1}}{n+1}$ 이 통하지 않는 유일한 경우예요($n=-1$ 이면 분모가 $0$).',
          };
        }
        if (kind === 'exp') {
          const m = rng.int(2, 5);
          const ans = a * (m - 1);
          return {
            q: `정적분 $\\displaystyle\\int_0^{\\ln ${m}}${coef(a, 'e^{x}')}\\,dx$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `integrate(${a}*exp(x), (x, 0, log(${m})))`,
            concepts: ['$\\int e^{x}\\,dx=e^{x}+C$', '$e^{\\ln m}=m$'],
            steps: [
              {
                title: '원시함수',
                body: `$${coef(a, 'e^{x}')}$ 예요. 적분해도 모양이 그대로예요.`,
              },
              {
                title: '끝값 넣기',
                body: `$$${coef(a, '')}${a === 1 ? '' : '\\cdot'}(e^{\\ln ${m}}-e^{0})=${a === 1 ? '' : `${paren(a)}\\cdot`}(${m}-1)=${ans}$$`,
              },
            ],
            tip: `$e^{\\ln ${m}}=${m}$ 이에요. 지수에 $\\ln$ 이 올라가 있으면 서로 풀려요.`,
          };
        }
        return {
          q: `정적분 $\\displaystyle\\int_0^{\\frac{\\pi}{4}}${coef(a, '\\sec^2 x')}\\,dx$ 의 값을 구하세요.`,
          choices: null,
          answer: String(a),
          answerType: 'int',
          check: `integrate(${a}/cos(x)**2, (x, 0, pi/4))`,
          concepts: ["$(\\tan x)'=\\sec^2x$ 이라 $\\int\\sec^2x\\,dx=\\tan x+C$"],
          steps: [
            { title: '원시함수', body: `$${coef(a, '\\tan x')}$ 예요.` },
            {
              title: '끝값 넣기',
              body: `$$${coef(a, '')}${a === 1 ? '' : '\\cdot'}\\left(\\tan\\frac{\\pi}{4}-\\tan0\\right)=${a === 1 ? '1' : `${paren(a)}\\cdot1=${a}`}$$`,
            },
          ],
          tip: "적분 공식은 미분 공식을 거꾸로 읽은 거예요. $(\\tan x)'=\\sec^2x$ 를 떠올리면 바로 나와요.",
        };
      }
    },
  },
];
