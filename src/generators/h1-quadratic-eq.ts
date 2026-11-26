import type { Generator } from './types.ts';
import { fracAns, fracTex, ieyo, paren, polySym, polyTex } from './util.ts';

const UNIT = 'h1-quadratic-eq';

// 이 단원은 "근을 직접 구하지 않고 계수만 보고 안다"가 핵심이라, 풀이는 늘 판별식·근과 계수의 관계로 쓴다.
// 반대로 검산식은 근을 sympy 로 실제로 구해(허근 포함) 계산한다 — 풀이와 다른 길로 같은 답이 나와야
// 부호(α+β=−b/a)나 2αβ 를 빠뜨린 생성 코드가 검산에서 걸린다.

const DISC =
  '판별식 $D=b^2-4ac$: $D>0$ 이면 서로 다른 두 실근, $D=0$ 이면 중근, $D<0$ 이면 서로 다른 두 허근';
const VIETA =
  '근과 계수의 관계: $ax^2+bx+c=0$ 의 두 근이 $\\alpha,\\ \\beta$ 이면 $\\alpha+\\beta=-\\frac{b}{a}$, $\\alpha\\beta=\\frac{c}{a}$';
const FROM_ROOTS =
  '두 근이 $\\alpha,\\ \\beta$ 이고 $x^2$ 의 계수가 1 인 이차방정식: $x^2-(\\alpha+\\beta)x+\\alpha\\beta=0$';

/** 계수가 하나라도 미지수인 식을 TeX 로: [a, b, "k"] → "ax^2+bx+k" */
function withK(a: number, b: number, k: string): string {
  return `${polyTex([a, b, 0])}+${k}`;
}

export const generators: Generator[] = [
  {
    id: 'h1qe-double-root',
    unitId: UNIT,
    title: '중근을 가질 조건',
    make(rng) {
      // a(x−r)² 를 펼쳐 b 를 만들면 k=ar² 가 늘 정수다
      const a = rng.pick([1, 1, 2, 3]);
      const r = rng.nonzero(-4, 4);
      const b = -2 * a * r;
      const k = a * r * r;
      const lhs = withK(a, b, 'k');
      const d = `${b * b}-${4 * a}k`;
      return {
        q: `이차방정식 $${lhs}=0$ 이 중근을 가질 때, 상수 $k$ 의 값을 구하세요.`,
        choices: null,
        answer: String(k),
        answerType: 'int',
        check: `solve(Eq((${b})**2 - 4*${a}*k, 0), k)[0]`,
        concepts: [DISC],
        steps: [
          {
            title: '판별식 세우기',
            body: `$a=${a}$, $b=${b}$, $c=k$ 이므로\n$$D=${paren(b)}^2-4\\cdot${a}\\cdot k=${d}$$`,
          },
          {
            title: '중근이면 D=0',
            body: `$$${d}=0$$`,
          },
          {
            title: 'k 구하기',
            body: `$${4 * a}k=${b * b}$ 이므로 $k=${k}$ ${ieyo(k)}.`,
          },
        ],
        tip: `$k=${k}$ 을 넣으면 $${polyTex([a, b, k])}=${a === 1 ? '' : a}(x${r < 0 ? '+' : '-'}${Math.abs(r)})^2$ 이 되어 중근 $x=${r}$ 이 나와요.`,
      };
    },
  },
  {
    id: 'qe-vieta-value',
    unitId: UNIT,
    title: '근과 계수의 관계로 식의 값 구하기',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-6, 6);
        const q = rng.nonzero(-8, 8);
        if (p * p - 4 * q === 0) continue;
        const s = -p;
        const t = q;
        const kind = rng.pick(['sq', 'recip', 'diff2', 'cube'] as const);
        const eq = polyTex([1, p, q]);
        const roots = `r = solve(${polySym([1, p, q])}, x)\n`;
        const base = [
          {
            title: '두 근의 합과 곱',
            body: `근과 계수의 관계에서 $\\alpha+\\beta=${s}$, $\\alpha\\beta=${t}$ ${ieyo(t)}.`,
          },
        ];
        if (kind === 'sq') {
          const ans = s * s - 2 * t;
          return {
            q: `이차방정식 $${eq}=0$ 의 두 근을 $\\alpha,\\ \\beta$ 라 할 때, $\\alpha^2+\\beta^2$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `${roots}ans = simplify(expand(r[0]**2 + r[1]**2))`,
            concepts: [VIETA, '$\\alpha^2+\\beta^2=(\\alpha+\\beta)^2-2\\alpha\\beta$'],
            steps: [
              ...base,
              {
                title: '합과 곱으로 바꾸기',
                body: '$(\\alpha+\\beta)^2=\\alpha^2+2\\alpha\\beta+\\beta^2$ 이므로\n$$\\alpha^2+\\beta^2=(\\alpha+\\beta)^2-2\\alpha\\beta$$',
              },
              {
                title: '값 넣기',
                body: `$$${paren(s)}^2-2\\cdot${paren(t)}=${s * s}${-2 * t < 0 ? '' : '+'}${-2 * t}=${ans}$$`,
              },
            ],
            tip: '근을 직접 구하지 않아도 돼요. 근이 무리수나 허수여도 합과 곱은 늘 정수로 깔끔하게 나와요.',
          };
        }
        if (kind === 'recip') {
          return {
            q: `이차방정식 $${eq}=0$ 의 두 근을 $\\alpha,\\ \\beta$ 라 할 때, $\\dfrac{1}{\\alpha}+\\dfrac{1}{\\beta}$ 의 값을 구하세요.`,
            choices: null,
            answer: fracAns(s, t),
            answerType: 'fraction',
            check: `${roots}ans = simplify(1/r[0] + 1/r[1])`,
            concepts: [
              VIETA,
              '$\\frac{1}{\\alpha}+\\frac{1}{\\beta}=\\frac{\\alpha+\\beta}{\\alpha\\beta}$',
            ],
            steps: [
              ...base,
              {
                title: '통분하기',
                body: '$$\\frac{1}{\\alpha}+\\frac{1}{\\beta}=\\frac{\\alpha+\\beta}{\\alpha\\beta}$$',
              },
              {
                title: '값 넣기',
                body: `$$\\frac{${s}}{${t}}=${fracTex(s, t)}$$`,
              },
            ],
            tip: '분모가 $\\alpha\\beta$ 라서 두 근의 곱이 0 이 아닐 때만 쓸 수 있어요.',
          };
        }
        if (kind === 'diff2') {
          const ans = s * s - 4 * t;
          return {
            q: `이차방정식 $${eq}=0$ 의 두 근을 $\\alpha,\\ \\beta$ 라 할 때, $(\\alpha-\\beta)^2$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `${roots}ans = simplify(expand((r[0] - r[1])**2))`,
            concepts: [VIETA, '$(\\alpha-\\beta)^2=(\\alpha+\\beta)^2-4\\alpha\\beta$'],
            steps: [
              ...base,
              {
                title: '합과 곱으로 바꾸기',
                body: '$(\\alpha-\\beta)^2=\\alpha^2-2\\alpha\\beta+\\beta^2$ 에 $\\alpha^2+\\beta^2=(\\alpha+\\beta)^2-2\\alpha\\beta$ 를 넣으면\n$$(\\alpha-\\beta)^2=(\\alpha+\\beta)^2-4\\alpha\\beta$$',
              },
              {
                title: '값 넣기',
                body: `$$${paren(s)}^2-4\\cdot${paren(t)}=${s * s}${-4 * t < 0 ? '' : '+'}${-4 * t}=${ans}$$`,
              },
            ],
            tip: `이 값은 판별식 $D=${p * p - 4 * q}$ 과 같아요. $x^2$ 의 계수가 1 이면 $(\\alpha-\\beta)^2=D$ 예요.${ans < 0 ? ' 음수가 나온 건 두 근이 허근이라서예요.' : ''}`,
          };
        }
        const ans = s * s * s - 3 * t * s;
        if (Math.abs(ans) > 300) continue;
        return {
          q: `이차방정식 $${eq}=0$ 의 두 근을 $\\alpha,\\ \\beta$ 라 할 때, $\\alpha^3+\\beta^3$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${roots}ans = simplify(expand(r[0]**3 + r[1]**3))`,
          concepts: [
            VIETA,
            '$\\alpha^3+\\beta^3=(\\alpha+\\beta)^3-3\\alpha\\beta(\\alpha+\\beta)$',
          ],
          steps: [
            ...base,
            {
              title: '합과 곱으로 바꾸기',
              body: '$(\\alpha+\\beta)^3=\\alpha^3+\\beta^3+3\\alpha\\beta(\\alpha+\\beta)$ 이므로\n$$\\alpha^3+\\beta^3=(\\alpha+\\beta)^3-3\\alpha\\beta(\\alpha+\\beta)$$',
            },
            {
              title: '값 넣기',
              body: `$$${paren(s)}^3-3\\cdot${paren(t)}\\cdot${paren(s)}=${s * s * s}${-3 * t * s < 0 ? '' : '+'}${-3 * t * s}=${ans}$$`,
            },
          ],
          tip: '곱셈 공식 $(a+b)^3$ 을 거꾸로 쓴 거예요. 합과 곱만 알면 거듭제곱의 합은 모두 구할 수 있어요.',
        };
      }
    },
  },
  {
    id: 'qe-from-roots',
    unitId: UNIT,
    title: '두 근으로 이차방정식 만들기',
    make(rng) {
      const kind = rng.pick(['int', 'surd', 'imag'] as const);
      let rootsTex: string;
      let rootsSym: [string, string];
      let s: number;
      let t: number;
      let sumBody: string;
      let prodBody: string;
      if (kind === 'int') {
        let r1: number;
        let r2: number;
        do {
          r1 = rng.nonzero(-6, 6);
          r2 = rng.nonzero(-6, 6);
        } while (r1 === r2 || r1 === -r2);
        rootsTex = `$${r1},\\ ${r2}$`;
        rootsSym = [String(r1), String(r2)];
        s = r1 + r2;
        t = r1 * r2;
        sumBody = `$${r1}+${paren(r2)}=${s}$`;
        prodBody = `$${r1}\\times${paren(r2)}=${t}$`;
      } else {
        const m = rng.nonzero(-4, 4);
        const n = kind === 'surd' ? rng.pick([2, 3, 5, 6, 7]) : rng.int(1, 4);
        if (kind === 'surd') {
          rootsTex = `$${m}+\\sqrt{${n}},\\ ${m}-\\sqrt{${n}}$`;
          rootsSym = [`${m} + sqrt(${n})`, `${m} - sqrt(${n})`];
          t = m * m - n;
          prodBody = `$(${m}+\\sqrt{${n}})(${m}-\\sqrt{${n}})=${paren(m)}^2-${n}=${t}$`;
        } else {
          const ni = n === 1 ? '' : String(n);
          rootsTex = `$${m}+${ni}i,\\ ${m}-${ni}i$`;
          rootsSym = [`${m} + ${n}*I`, `${m} - ${n}*I`];
          t = m * m + n * n;
          prodBody = `$(${m}+${ni}i)(${m}-${ni}i)=${paren(m)}^2+${n * n}=${t}$ (켤레복소수의 곱)`;
        }
        s = 2 * m;
        sumBody = `더하면 뒤쪽이 지워져서 $${2 * m}$`;
      }
      const p = -s;
      const q = t;
      const ans = p + q;
      return {
        q: `두 근이 ${rootsTex} 이고 $x^2$ 의 계수가 1 인 이차방정식을 $x^2+ax+b=0$ 이라 할 때, $a+b$ 의 값을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `f = expand((x - (${rootsSym[0]}))*(x - (${rootsSym[1]})))\nans = f.coeff(x, 1) + f.coeff(x, 0)`,
        concepts: [FROM_ROOTS],
        steps: [
          { title: '두 근의 합', body: `${sumBody} ${ieyo(s)}.` },
          { title: '두 근의 곱', body: `${prodBody} ${ieyo(t)}.` },
          {
            title: '방정식 세우기',
            body: `$x^2-(\\text{합})x+(\\text{곱})=0$ 이므로\n$$${polyTex([1, p, q])}=0$$`,
          },
          {
            title: 'a+b 구하기',
            body: `$a=${p}$, $b=${q}$ 이므로 $a+b=${ans}$ ${ieyo(ans)}.`,
          },
        ],
        tip: '$x$ 의 계수는 **합의 부호를 바꾼 것**이에요. 부호를 그대로 쓰는 실수가 가장 많아요.',
      };
    },
  },
  {
    id: 'qe-real-range',
    unitId: UNIT,
    title: '판별식으로 계수의 범위 구하기',
    make(rng) {
      if (rng.next() < 0.5) {
        // x²+kx+c=0 이 허근을 가지는 정수 k 의 개수: k²<4c
        const c = rng.int(2, 20);
        let m = 0;
        while ((m + 1) * (m + 1) < 4 * c) m += 1;
        const ans = 2 * m + 1;
        return {
          q: `이차방정식 $x^2+kx+${c}=0$ 이 서로 다른 두 허근을 가지도록 하는 정수 $k$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `len([t for t in range(-100, 101) if t**2 - 4*${c} < 0])`,
          concepts: [DISC],
          steps: [
            { title: '판별식 세우기', body: `$$D=k^2-4\\cdot1\\cdot${c}=k^2-${4 * c}$$` },
            { title: '허근이면 D<0', body: `$$k^2<${4 * c}$$` },
            {
              title: '정수 k 세기',
              body: `제곱이 $${4 * c}$ 보다 작은 정수는 $-${m}$ 부터 $${m}$ 까지예요. 그래서 $${ans}$ 개예요.`,
            },
          ],
          tip: `$${m}^2=${m * m}<${4 * c}$ 이지만 $${m + 1}^2=${(m + 1) * (m + 1)}$ 은 $${4 * c}$ 보다 작지 않아요. 경계에서 등호가 들어가는지 꼭 확인해요.`,
        };
      }
      // ax²+bx+k=0 이 서로 다른 두 실근을 가지는 가장 큰 정수 k: b²−4ak>0
      const a = rng.int(1, 3);
      const b = rng.nonzero(-8, 8);
      const n = b * b;
      const d = 4 * a;
      const ans = n % d === 0 ? n / d - 1 : Math.floor(n / d);
      return {
        q: `이차방정식 $${withK(a, b, 'k')}=0$ 이 서로 다른 두 실근을 가지도록 하는 정수 $k$ 의 최댓값을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `Max(*[t for t in range(-200, 201) if (${b})**2 - 4*${a}*t > 0])`,
        concepts: [DISC],
        steps: [
          { title: '판별식 세우기', body: `$$D=${paren(b)}^2-4\\cdot${a}\\cdot k=${n}-${d}k$$` },
          { title: '서로 다른 두 실근이면 D>0', body: `$$${n}-${d}k>0$$` },
          {
            title: 'k 의 범위',
            body: `$$k<${fracTex(n, d)}$$`,
          },
          {
            title: '가장 큰 정수',
            body: `$${fracTex(n, d)}$ 보다 작은 가장 큰 정수는 $${ans}$ ${ieyo(ans)}.`,
          },
        ],
        tip: '"서로 다른 두 실근"은 $D>0$, "실근"만 있으면 $D\\ge0$ 이에요. 등호 하나로 답이 달라질 수 있어요.',
      };
    },
  },
];
