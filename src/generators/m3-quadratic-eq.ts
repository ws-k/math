import type { Generator } from './types.ts';
import { polySym, polyTex } from './util.ts';

const UNIT = 'm3-quadratic-eq';

// 이차방정식의 해는 둘이라 답 칸 하나로 받으려면 "큰 근"·"q 의 값"처럼 하나를 집어 묻는다.
// 검산식은 sympy solve·discriminant 로 방정식에서 직접 계산한다(문제에 보인 계수 배열에서 만든 식 그대로).

/** 음수면 괄호 */
const pp = (n: number) => (n < 0 ? `(${n})` : String(n));
/** x+r 의 TeX */
const lin = (r: number) => `x${r < 0 ? '-' : '+'}${Math.abs(r)}`;
const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));

const ZERO_PRODUCT = '$AB=0$ 이면 $A=0$ 또는 $B=0$ 이에요.';
const COMPLETE = '완전제곱식으로 바꾸기: $x^2+2mx$ 에 $m^2$ 을 더하면 $(x+m)^2$ 이 돼요.';
const FORMULA = '근의 공식: $ax^2+bx+c=0$ 의 근은 $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$ 예요.';
const DOUBLE = '중근: 완전제곱식 $(x-m)^2=0$ 꼴이면 두 근이 같아져요.';

export const generators: Generator[] = [
  {
    id: 'qe-factor-root',
    unitId: UNIT,
    title: '인수분해로 이차방정식 풀기',
    make(rng) {
      for (;;) {
        const r = rng.nonzero(-9, 9);
        const s = rng.nonzero(-9, 9);
        if (r === s) continue;
        const k = rng.pick([1, 1, 1, 2, 3]);
        const coeffs = [k, -k * (r + s), k * r * s];
        if (coeffs[1] === 0) continue;
        const askBig = rng.next() < 0.5;
        const ans = askBig ? Math.max(r, s) : Math.min(r, s);
        const eqTex = `${polyTex(coeffs)}=0`;
        const steps = [];
        if (k > 1)
          steps.push({
            title: `양변을 $${k}$ 로 나누기`,
            body: `모든 계수가 $${k}$ 의 배수예요.\n$$${polyTex([1, -(r + s), r * s])}=0$$`,
          });
        steps.push(
          {
            title: '인수분해하기',
            body: `곱해서 $${r * s}$, 더해서 $${-(r + s)}$ 인 두 수는 $${-r}$, $${-s}$ 예요.\n$$(${lin(-r)})(${lin(-s)})=0$$`,
          },
          {
            title: '곱이 0 이면 하나는 0',
            body: `$${lin(-r)}=0$ 또는 $${lin(-s)}=0$ 이므로 $x=${r}$ 또는 $x=${s}$ 예요.`,
          },
          {
            title: `${askBig ? '큰' : '작은'} 근 고르기`,
            body: `$${ans}$ 예요.`,
          },
        );
        return {
          q: `이차방정식 $${eqTex}$ 의 두 근 중 ${askBig ? '큰' : '작은'} 근을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${askBig ? 'max' : 'min'}(solve(${polySym(coeffs)}, x))`,
          concepts: [ZERO_PRODUCT],
          steps,
          tip: `구한 근을 처음 식에 넣어 $0$ 이 되는지 확인해요. 인수 $${lin(-r)}$ 의 근은 부호가 바뀐 $${r}$ 이에요.`,
        };
      }
    },
  },
  {
    id: 'qe-complete-square',
    unitId: UNIT,
    title: '완전제곱식으로 바꾸기',
    make(rng) {
      for (;;) {
        const m = rng.nonzero(-6, 6);
        const c = rng.int(-9, 9);
        const q = m * m - c;
        if (q <= 0 || c === 0) continue;
        const coeffs = [1, 2 * m, c];
        const askSum = rng.next() < 0.4;
        const ans = askSum ? m + q : q;
        const poly = polySym(coeffs);
        return {
          q: `이차방정식 $${polyTex(coeffs)}=0$ 을 $(x+p)^2=q$ 꼴로 바꿀 때, ${askSum ? '$p+q$' : '$q$'} 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          // p = x 계수의 절반, q = (x+p)² 에서 처음 식을 뺀 나머지
          check: askSum
            ? `p0 = Poly(${poly}, x).coeff_monomial(x)/2\nans = p0 + expand((x + p0)**2 - (${poly}))`
            : `p0 = Poly(${poly}, x).coeff_monomial(x)/2\nans = expand((x + p0)**2 - (${poly}))`,
          concepts: [COMPLETE],
          steps: [
            {
              title: '상수항 옮기기',
              body: `$$${polyTex([1, 2 * m, 0])}=${-c}$$`,
            },
            {
              title: `양변에 $${m * m}$ 더하기`,
              body: `$x$의 계수 $${2 * m}$ 의 절반 $${m}$ 을 제곱한 $${m * m}$ 을 더해요.\n$$${polyTex([1, 2 * m, m * m])}=${-c}+${m * m}$$`,
            },
            {
              title: '완전제곱식으로 묶기',
              body: `$$(${lin(m)})^2=${q}$$`,
            },
            {
              title: askSum ? '$p+q$ 구하기' : '$q$ 읽기',
              body: askSum
                ? `$p=${m}$, $q=${q}$ 이므로 $${m}+${q}=${ans}$ 예요.`
                : `$q=${q}$ 예요.`,
            },
          ],
          tip: `왼쪽에 $${m * m}$ 을 더했으면 오른쪽에도 똑같이 더해야 해요. 한쪽만 더하는 실수가 가장 많아요.`,
        };
      }
    },
  },
  {
    id: 'qe-formula',
    unitId: UNIT,
    title: '근의 공식의 근호 안 값',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 3);
        const b = rng.int(-7, 7);
        const c = rng.nonzero(-5, 5);
        const D = b * b - 4 * a * c;
        if (D <= 0 || isSquare(D)) continue;
        const coeffs = [a, b, c];
        return {
          q: `이차방정식 $${polyTex(coeffs)}=0$ 을 근의 공식 $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$ 에 그대로 넣었어요. 근호 안의 값 $b^2-4ac$ 를 구하세요.`,
          choices: null,
          answer: String(D),
          answerType: 'int',
          check: `discriminant(${polySym(coeffs)}, x)`,
          concepts: [FORMULA],
          steps: [
            {
              title: '$a$, $b$, $c$ 읽기',
              body: `$a=${a}$, $b=${b}$, $c=${c}$ 이에요. 부호까지 함께 읽어요.`,
            },
            { title: '$b^2$ 계산하기', body: `$$${pp(b)}^2=${b * b}$$` },
            {
              title: '$4ac$ 계산하기',
              body: `$$4\\times${a}\\times${pp(c)}=${4 * a * c}$$`,
            },
            { title: '빼기', body: `$$${b * b}-${pp(4 * a * c)}=${D}$$` },
          ],
          tip: `$c$가 음수이면 $-4ac$ 는 더하기가 돼요. 근은 $x=\\frac{${-b}\\pm\\sqrt{${D}}}{${2 * a}}$ 예요.`,
        };
      }
    },
  },
  {
    id: 'qe-double-root',
    unitId: UNIT,
    title: '중근을 가질 조건',
    make(rng) {
      const m = rng.nonzero(-7, 7);
      if (rng.next() < 0.5) {
        // x² + 2m x + k = 0 이 중근 → k = m², 근은 -m
        const b = 2 * m;
        const askRoot = rng.next() < 0.5;
        const ans = askRoot ? -m : m * m;
        return {
          q: `이차방정식 $x^2${b < 0 ? '-' : '+'}${Math.abs(b)}x+k=0$ 이 중근을 가질 때, ${askRoot ? '그 중근' : '상수 $k$ 의 값'}을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: askRoot
            ? `k0 = solve(discriminant(x**2 + ${pp(b)}*x + k, x), k)[0]\nans = solve(x**2 + ${pp(b)}*x + k0, x)[0]`
            : `solve(discriminant(x**2 + ${pp(b)}*x + k, x), k)[0]`,
          concepts: [DOUBLE],
          steps: [
            {
              title: '완전제곱식이 되어야 해요',
              body: `중근을 가지려면 왼쪽이 $(x+m)^2$ 꼴이어야 해요. $x$의 계수 $${b}$ 의 절반은 $${m}$ 이에요.`,
            },
            {
              title: '$k$ 구하기',
              body: `$k=${pp(m)}^2=${m * m}$ 이에요.\n$$(${lin(m)})^2=0$$`,
            },
            ...(askRoot
              ? [{ title: '중근 구하기', body: `$${lin(m)}=0$ 이므로 $x=${-m}$ 예요.` }]
              : []),
          ],
          tip: `중근은 두 근이 겹친 것이에요. 근의 공식에서 $b^2-4ac=0$ 이 되는 경우와 같아요.`,
        };
      }
      // x² + k x + m² = 0 이 중근, k>0
      const s = Math.abs(m);
      return {
        q: `이차방정식 $x^2+kx+${s * s}=0$ 이 중근을 가질 때, 양수 $k$ 의 값을 구하세요.`,
        choices: null,
        answer: String(2 * s),
        answerType: 'int',
        check: `max(solve(discriminant(x**2 + k*x + ${s * s}, x), k))`,
        concepts: [DOUBLE],
        steps: [
          {
            title: '완전제곱식 꼴 정하기',
            body: `상수항 $${s * s}=${s}^2$ 이므로 $(x+${s})^2$ 또는 $(x-${s})^2$ 이어야 해요.`,
          },
          {
            title: '가운데 항 비교하기',
            body: `$(x+${s})^2=x^2+${2 * s}x+${s * s}$ 이므로 $k=${2 * s}$, $(x-${s})^2$ 이면 $k=-${2 * s}$ 예요.`,
          },
          { title: '양수 고르기', body: `$k=${2 * s}$ 예요.` },
        ],
        tip: `$k=${2 * s}$ 이면 중근은 $x=-${s}$ 이고, $k=-${2 * s}$ 이면 $x=${s}$ 예요.`,
      };
    },
  },
];
