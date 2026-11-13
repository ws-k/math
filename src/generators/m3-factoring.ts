import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { gcd, polySym, polyTex } from './util.ts';

const UNIT = 'm3-factoring';

// 인수분해 문제는 답이 식이라 앱이 자동 채점하기 어렵다. 그래서 "(x+a)(x+b) 꼴에서 a 의 값"처럼
// 인수 속 수 하나를 묻는다. 검산식은 그 수를 적지 않고, 다항식의 근(solve)이나 판별식에서 거꾸로 계산한다 —
// 문제에 보이는 다항식과 검산하는 다항식이 같은 계수 배열에서 나오게 해서 어긋날 틈을 없앤다.

/** x+r 의 TeX (r 은 0 이 아님): 3 → "x+3", -3 → "x-3" */
const lin = (r: number, v = 'x') => `${v}${r < 0 ? '-' : '+'}${Math.abs(r)}`;
/** 계수 a 인 일차식 ax+r 의 TeX */
const linA = (a: number, r: number) => `${a === 1 ? '' : a}x${r < 0 ? '-' : '+'}${Math.abs(r)}`;
/** 음수면 괄호 */
const pp = (n: number) => (n < 0 ? `(${n})` : String(n));

const SUM_PRODUCT =
  '$x^2+(a+b)x+ab=(x+a)(x+b)$: 곱해서 상수항, 더해서 $x$의 계수가 되는 두 수를 찾아요.';
const PERFECT = '완전제곱식: $a^2\\pm2ab+b^2=(a\\pm b)^2$';
const DIFF_SQ = '합차 공식: $a^2-b^2=(a+b)(a-b)$';
const COMMON = '공통인수가 있으면 먼저 묶어 내요.';
const CROSS =
  '$acx^2+(ad+bc)x+bd=(ax+b)(cx+d)$: 대각선으로 곱해 더한 값이 $x$의 계수가 되게 맞춰요.';

/** 0 이 아닌 서로 다른 두 정수(합도 0 이 아님) */
function pair(rng: Rng, lo: number, hi: number): [number, number] {
  for (;;) {
    const r = rng.nonzero(lo, hi);
    const s = rng.nonzero(lo, hi);
    if (r !== s && r + s !== 0) return [r, s];
  }
}

export const generators: Generator[] = [
  {
    id: 'fact-sum-product',
    unitId: UNIT,
    title: '$x^2+(a+b)x+ab$ 꼴 인수분해',
    make(rng) {
      const [r, s] = pair(rng, -9, 9);
      const big = Math.max(r, s);
      const small = Math.min(r, s);
      const coeffs = [1, r + s, r * s];
      const askBig = rng.next() < 0.5;
      const ans = askBig ? big : small;
      const poly = polySym(coeffs);
      return {
        q: `다항식 $${polyTex(coeffs)}$ 을 인수분해하면 $(x+a)(x+b)$ 예요. $a>b$ 일 때 $${askBig ? 'a' : 'b'}$ 의 값을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        // 근이 -a, -b 이므로 큰 a 는 작은 근의 부호를 바꾼 값
        check: askBig ? `-min(solve(${poly}, x))` : `-max(solve(${poly}, x))`,
        concepts: [SUM_PRODUCT],
        steps: [
          {
            title: '곱과 합 확인하기',
            body: `상수항은 $${r * s}$, $x$의 계수는 $${r + s}$ 예요. 곱해서 $${r * s}$, 더해서 $${r + s}$ 인 두 정수를 찾아요.`,
          },
          {
            title: '두 수 찾기',
            body: `$${pp(r)}\\times${pp(s)}=${r * s}$, $${pp(r)}+${pp(s)}=${r + s}$ 이에요.`,
          },
          {
            title: '인수분해하기',
            body: `$$${polyTex(coeffs)}=(${lin(big)})(${lin(small)})$$`,
          },
          {
            title: `$${askBig ? 'a' : 'b'}$ 고르기`,
            body: `$a>b$ 이므로 $a=${big}$, $b=${small}$ 이에요. 구하는 값은 $${ans}$ 예요.`,
          },
        ],
        tip: `곱이 음수이면 두 수의 부호가 달라요. 전개해서 $${polyTex(coeffs)}$ 이 다시 나오는지 확인해요.`,
      };
    },
  },
  {
    id: 'fact-perfect-square',
    unitId: UNIT,
    title: '완전제곱식 만들기',
    make(rng) {
      if (rng.next() < 0.5) {
        // x² + 2m x + □
        const m = rng.nonzero(-9, 9);
        const b = 2 * m;
        return {
          q: `다항식 $x^2${b < 0 ? '-' : '+'}${Math.abs(b)}x+\\square$ 가 완전제곱식이 되도록 $\\square$ 에 알맞은 수를 구하세요.`,
          choices: null,
          answer: String(m * m),
          answerType: 'int',
          check: `solve(discriminant(x**2 + ${pp(b)}*x + k, x), k)[0]`,
          concepts: [PERFECT],
          steps: [
            {
              title: '$x$의 계수를 반으로',
              body: `$(x+m)^2=x^2+2mx+m^2$ 이므로 $x$의 계수 $${b}$ 의 절반이 $m$ 이에요. $m=${m}$`,
            },
            {
              title: '제곱하기',
              body: `상수항은 $m^2$ 이에요.\n$$${pp(m)}^2=${m * m}$$`,
            },
          ],
          tip: `"$x$의 계수의 절반을 제곱"이라고 기억해요. 확인: $(${lin(m)})^2=x^2${b < 0 ? '-' : '+'}${Math.abs(b)}x+${m * m}$`,
        };
      }
      // (p x + q)² 의 가운데 항
      for (;;) {
        const p = rng.int(2, 3);
        const q = rng.int(1, 5);
        if (gcd(p, q) !== 1) continue;
        const mid = 2 * p * q;
        return {
          q: `다항식 $${p * p}x^2+\\square\\,x+${q * q}$ 가 완전제곱식이 되도록 하는 양수 $\\square$ 를 구하세요.`,
          choices: null,
          answer: String(mid),
          answerType: 'int',
          check: `max(solve(discriminant(${p * p}*x**2 + k*x + ${q * q}, x), k))`,
          concepts: [PERFECT],
          steps: [
            {
              title: '양 끝을 제곱으로 보기',
              body: `$${p * p}x^2=(${p}x)^2$, $${q * q}=${q}^2$ 이에요.`,
            },
            {
              title: '가운데 항은 두 배의 곱',
              body: `$(${p}x+${q})^2$ 의 가운데 항은 $2\\times${p}x\\times${q}=${mid}x$ 예요.`,
            },
          ],
          tip: `$(${p}x-${q})^2$ 도 완전제곱식이지만 가운데 항이 $-${mid}x$ 라 음수예요. 그래서 양수는 $${mid}$ 하나예요.`,
        };
      }
    },
  },
  {
    id: 'fact-diff-squares',
    unitId: UNIT,
    title: '합차 공식으로 인수분해',
    make(rng) {
      for (;;) {
        const p = rng.int(1, 3);
        const q = rng.int(1, 9);
        if (gcd(p, q) !== 1) continue;
        const c = rng.pick([1, 1, 2, 3]);
        const A = c * p * p;
        const B = c * q * q;
        const px = p === 1 ? 'x' : `${p}x`;
        const form = `${c === 1 ? '' : 'k'}(${px}+a)(${px}-a)`;
        const steps = [];
        if (c > 1)
          steps.push({
            title: `공통인수 $${c}$ 묶기`,
            body: `$$${A}x^2-${B}=${c}(${p * p === 1 ? '' : p * p}x^2-${q * q})$$`,
          });
        steps.push(
          {
            title: '제곱의 차로 보기',
            body:
              p === 1
                ? `$x^2$ 과 $${q * q}=${q}^2$ 의 차예요.`
                : `$${p * p}x^2=(${px})^2$, $${q * q}=${q}^2$ 이에요.`,
          },
          {
            title: '합차 공식 쓰기',
            body: `$$${p * p === 1 ? '' : p * p}x^2-${q * q}=(${px}+${q})(${px}-${q})$$`,
          },
          { title: '$a$ 읽기', body: `$a=${q}$ 예요.` },
        );
        return {
          q: `다항식 $${A === 1 ? '' : A}x^2-${B}$ 을 인수분해하면 $${form}$ 예요. 양수 $a$ 의 값을 구하세요.`,
          choices: null,
          answer: String(q),
          answerType: 'int',
          // 근이 ±q/p 이므로 큰 근에 p 를 곱하면 a
          check: `${p}*max(solve(${A}*x**2 - ${B}, x))`,
          concepts: c > 1 ? [COMMON, DIFF_SQ] : [DIFF_SQ],
          steps,
          tip: `$(${px}-${q})^2$ 으로 쓰는 실수가 많아요. 펼치면 가운데 항이 생겨서 처음 식과 달라져요.`,
        };
      }
    },
  },
  {
    id: 'fact-ac',
    unitId: UNIT,
    title: '$acx^2+\\cdots$ 꼴 인수분해',
    make(rng) {
      for (;;) {
        const a = rng.int(2, 3);
        const b = rng.nonzero(-6, 6);
        const c = rng.nonzero(-6, 6);
        // gcd 가 1 이 아니면 공통인수가 생겨 ax+b 꼴이 하나로 정해지지 않는다
        if (gcd(a, b) !== 1) continue;
        const mid = a * c + b;
        if (mid === 0) continue;
        const coeffs = [a, mid, b * c];
        const poly = polySym(coeffs);
        return {
          q: `다항식 $${polyTex(coeffs)}$ 을 인수분해하면 $(${a}x+m)(x+n)$ 이에요. 정수 $m$, $n$ 에 대해 $m+n$ 의 값을 구하세요.`,
          choices: null,
          answer: String(b + c),
          answerType: 'int',
          // 근은 -m/a(정수가 아님)와 -n(정수). 근에서 m, n 을 거꾸로 구한다
          check: `rs = solve(${poly}, x)\nans = sum(-${a}*r if not r.is_integer else -r for r in rs)`,
          concepts: [CROSS],
          steps: [
            {
              title: '틀 세우기',
              body: `$x^2$의 계수 $${a}$ 는 $${a}\\times1$ 이에요. $(${a}x+m)(x+n)$ 에서 $mn=${b * c}$ 이에요.`,
            },
            {
              title: '대각선 곱의 합 맞추기',
              body: `펼치면 $x$의 계수는 $${a}n+m$ 이에요. $m=${b}$, $n=${c}$ 이면 $${a}\\times${pp(c)}+${pp(b)}=${mid}$ 로 맞아요.`,
            },
            {
              title: '인수분해하기',
              body: `$$${polyTex(coeffs)}=(${linA(a, b)})(${lin(c)})$$`,
            },
            { title: '$m+n$ 구하기', body: `$$${b}+${pp(c)}=${b + c}$$` },
          ],
          tip: `$x^2$의 계수가 $1$이 아니면 곱·합만으로는 안 돼요. 대각선으로 곱해 더한 값이 $${mid}$ 인지 꼭 확인해요.`,
        };
      }
    },
  },
];
