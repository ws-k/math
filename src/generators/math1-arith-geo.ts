import type { Generator } from './types.ts';
import { ieyo, paren } from './util.ts';

const UNIT = 'math1-arith-geo';

// 생성기 id 는 모두 'math1-ag-' 로 시작한다 — 예전에 다른 단원과 id 가 겹쳐 기초 문제가
// 엉뚱한 생성기로 찍힌 일이 있어서, 단원 접두어로 이름 공간을 나눈다.

/** "+3" / "-3" — 식 뒤에 수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

const ARITH_TERM = '등차수열의 일반항: $a_n=a+(n-1)d$';
const ARITH_SUM = '등차수열의 합: $S_n=\\frac{n(a+l)}{2}=\\frac{n\\{2a+(n-1)d\\}}{2}$';
const GEO_TERM = '등비수열의 일반항: $a_n=ar^{n-1}$';
const GEO_SUM = '등비수열의 합: $S_n=\\frac{a(r^n-1)}{r-1}$ ($r\\ne1$)';

export const generators: Generator[] = [
  {
    id: 'math1-ag-arith-term',
    unitId: UNIT,
    title: '등차수열의 일반항',
    make(rng) {
      if (rng.next() < 0.5) {
        // 첫째 항과 공차가 바로 주어지는 기본형
        const a = rng.nonzero(-10, 10);
        const d = rng.nonzero(-5, 5);
        const n = rng.int(8, 20);
        const ans = a + (n - 1) * d;
        return {
          q: `첫째 항이 $${a}$, 공차가 $${d}$ 인 등차수열 $\\{a_n\\}$ 에 대하여 $a_{${n}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${a} + (${n} - 1)*(${d})`,
          concepts: [ARITH_TERM, '제$n$항까지는 공차를 $n-1$ 번 더해요.'],
          steps: [
            {
              title: '공차를 몇 번 더하나',
              body: `첫째 항에서 제${n}항까지는 공차를 $${n}-1=${n - 1}$ 번 더해요.`,
            },
            {
              title: '일반항에 넣기',
              body: `$$a_{${n}}=${a}+${n - 1}\\cdot ${paren(d)}=${a}${signed((n - 1) * d)}=${ans}$$`,
            },
          ],
          tip: `공차를 $${n}$ 번 더하면 $a_{${n + 1}}$ 이 돼요. 첫째 항이 이미 1번째라 $n-1$ 번이에요.`,
        };
      }
      // 두 항이 주어지면 그 차이로 공차부터 구한다 — 수능 공통 앞번호의 흔한 꼴
      for (;;) {
        const a = rng.nonzero(-10, 10);
        const d = rng.nonzero(-5, 5);
        const p = rng.int(2, 4);
        const q = p + rng.int(2, 4);
        const n = rng.int(10, 15);
        const u = a + (p - 1) * d;
        const v = a + (q - 1) * d;
        const ans = a + (n - 1) * d;
        if (u === v) continue;
        return {
          q: `등차수열 $\\{a_n\\}$ 에서 $a_{${p}}=${u}$, $a_{${q}}=${v}$ 일 때, $a_{${n}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `s = solve([Eq(a + (${p} - 1)*d, ${u}), Eq(a + (${q} - 1)*d, ${v})], [a, d])\nans = s[a] + (${n} - 1)*s[d]`,
          concepts: [ARITH_TERM, '두 항 사이의 차이는 (번호 차이) × 공차예요.'],
          steps: [
            {
              title: '공차 구하기',
              body: `$a_{${p}}$ 에서 $a_{${q}}$ 까지 공차를 $${q - p}$ 번 더해요.\n$$${q - p}d=${v}-${paren(u)}=${v - u},\\quad d=${d}$$`,
            },
            {
              title: `$a_{${n}}$ 까지 가기`,
              body: `$a_{${q}}$ 에서 $a_{${n}}$ 까지는 공차를 $${n - q}$ 번 더 더해요.\n$$a_{${n}}=${v}+${n - q}\\cdot ${paren(d)}=${ans}$$`,
            },
          ],
          tip: `첫째 항을 구하지 않아도 돼요. 확인하려면 첫째 항 $a_1=${a}$ 에서 시작해 $${a}+${n - 1}\\cdot${paren(d)}=${ans}$ 인지 봐요.`,
        };
      }
    },
  },
  {
    id: 'math1-ag-geo-term',
    unitId: UNIT,
    title: '등비수열의 일반항',
    make(rng) {
      if (rng.next() < 0.5) {
        for (;;) {
          const a = rng.nonzero(-3, 3);
          const r = rng.pick([-3, -2, 2, 3]);
          const n = rng.int(4, 7);
          const ans = a * r ** (n - 1);
          if (Math.abs(ans) > 2000) continue;
          return {
            q: `첫째 항이 $${a}$, 공비가 $${r}$ 인 등비수열 $\\{a_n\\}$ 에 대하여 $a_{${n}}$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `${a}*(${r})**(${n} - 1)`,
            concepts: [GEO_TERM, '제$n$항까지는 공비를 $n-1$ 번 곱해요.'],
            steps: [
              {
                title: '공비를 몇 번 곱하나',
                body: `첫째 항에서 제${n}항까지는 공비를 $${n - 1}$ 번 곱해요.`,
              },
              {
                title: '거듭제곱 계산',
                body: `$$${paren(r)}^{${n - 1}}=${r ** (n - 1)}$$`,
              },
              {
                title: '첫째 항 곱하기',
                body: `$$a_{${n}}=${a}\\cdot ${paren(r ** (n - 1))}=${ans}$$`,
              },
            ],
            tip: `첫째 항과 공비를 먼저 곱해 $${paren(a * r)}^{${n - 1}}$ 로 쓰면 안 돼요. 거듭제곱은 공비에만 붙어요.`,
          };
        }
      }
      // 모든 항이 양수라는 조건으로 공비의 부호를 정한다
      for (;;) {
        const a = rng.int(1, 4);
        const r = rng.int(2, 3);
        const ans = a * r ** 5;
        if (ans > 1000) continue;
        const a2 = a * r;
        const a4 = a * r ** 3;
        return {
          q: `모든 항이 양수인 등비수열 $\\{a_n\\}$ 에서 $a_2=${a2}$, $a_4=${a4}$ 일 때, $a_6$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `t = [v for v in solve(Eq(${a2}*r**2, ${a4}), r) if v > 0][0]\nans = ${a4}*t**2`,
          concepts: [GEO_TERM, '두 항의 비는 공비의 거듭제곱이에요.'],
          steps: [
            {
              title: '공비의 제곱',
              body: `$a_2$ 에서 $a_4$ 까지 공비를 2번 곱해요.\n$$r^2=\\frac{${a4}}{${a2}}=${r * r}$$`,
            },
            {
              title: '공비 정하기',
              body: `모든 항이 양수라 $r>0$ 이므로 $r=${r}$ ${ieyo(r)}.`,
            },
            {
              title: '$a_6$ 구하기',
              body: `$a_4$ 에서 공비를 2번 더 곱해요.\n$$a_6=${a4}\\cdot ${r * r}=${ans}$$`,
            },
          ],
          tip: `$r=-${r}$ 이면 $a_1$ 이 음수가 돼 조건에 맞지 않아요. $a_6=a_4\\cdot r^2$ 이라 사실 $r$ 의 부호와 상관없이 같은 값이 나와요.`,
        };
      }
    },
  },
  {
    id: 'math1-ag-arith-sum',
    unitId: UNIT,
    title: '등차수열의 합',
    make(rng) {
      for (;;) {
        const a = rng.int(-10, 10);
        const d = rng.nonzero(-4, 6);
        const n = rng.int(8, 20);
        const l = a + (n - 1) * d;
        const ans = (n * (a + l)) / 2;
        if (ans === 0) continue;
        const list = [0, 1, 2].map((i) => a + i * d).join(',\\ ');
        return {
          q: `등차수열 $${list},\\ \\cdots$ 의 첫째 항부터 제${n}항까지의 합을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `summation(${a} + (k - 1)*(${d}), (k, 1, ${n}))`,
          concepts: [ARITH_TERM, ARITH_SUM],
          steps: [
            {
              title: '첫째 항과 공차',
              body: `첫째 항은 $${a}$, 이웃한 두 항의 차이인 공차는 $${d}$ ${ieyo(d)}.`,
            },
            {
              title: '끝항 구하기',
              body: `$$a_{${n}}=${a}+${n - 1}\\cdot ${paren(d)}=${l}$$`,
            },
            {
              title: '합 공식에 넣기',
              body: `처음과 끝을 짝지으면 한 쌍의 합이 $${a}+${paren(l)}=${a + l}$ 이고, 이런 쌍이 $\\frac{${n}}{2}$ 개 있는 셈이에요.\n$$S_{${n}}=\\frac{${n}\\cdot ${paren(a + l)}}{2}=${ans}$$`,
            },
          ],
          tip: `$S_n=\\frac{n\\{2a+(n-1)d\\}}{2}$ 로 바로 계산해도 같아요: $\\frac{${n}\\cdot(${2 * a}${signed((n - 1) * d)})}{2}=${ans}$.`,
        };
      }
    },
  },
  {
    id: 'math1-ag-geo-sum',
    unitId: UNIT,
    title: '등비수열의 합',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 3);
        const r = rng.pick([2, 3, -2]);
        const n = rng.int(4, 7);
        const rn = r ** n;
        const ans = (a * (rn - 1)) / (r - 1);
        if (Math.abs(ans) > 1500) continue;
        const list = [0, 1, 2].map((i) => a * r ** i).join(',\\ ');
        return {
          q: `등비수열 $${list},\\ \\cdots$ 의 첫째 항부터 제${n}항까지의 합을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `summation(${a}*(${r})**(k - 1), (k, 1, ${n}))`,
          concepts: [GEO_TERM, GEO_SUM],
          steps: [
            {
              title: '첫째 항과 공비',
              body: `첫째 항은 $${a}$, 앞 항에 곱하는 수인 공비는 $${r}$ ${ieyo(r)}.`,
            },
            {
              title: `$r^{${n}}$ 계산`,
              body: `$$${paren(r)}^{${n}}=${rn}$$`,
            },
            {
              title: '합 공식에 넣기',
              body: `$$S_{${n}}=\\frac{${a}\\{${paren(rn)}-1\\}}{${paren(r)}-1}=\\frac{${a * (rn - 1)}}{${r - 1}}=${ans}$$`,
            },
          ],
          tip: `지수는 항의 개수 $${n}$ 이에요. $r^{n-1}$ 로 쓰면 항 하나가 빠진 합이 나와요.`,
        };
      }
    },
  },
  {
    id: 'math1-ag-mean',
    unitId: UNIT,
    title: '등차중항과 등비중항',
    make(rng) {
      if (rng.next() < 0.5) {
        for (;;) {
          const p = rng.int(-10, 20);
          const q = rng.int(-10, 30);
          if (p === q || (p + q) % 2 !== 0) continue;
          const ans = (p + q) / 2;
          return {
            q: `세 수 $${p}$, $x$, $${q}$ 가 이 순서대로 등차수열을 이룰 때, $x$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `solve(Eq(2*x, ${p} + ${paren(q)}), x)[0]`,
            concepts: ['등차중항: $a$, $b$, $c$ 가 이 순서대로 등차수열이면 $2b=a+c$'],
            steps: [
              {
                title: '공차가 같다',
                body: `$x-${paren(p)}=${q}-x$ 이므로 $2x=${p}+${paren(q)}$ ${ieyo(p + q)}.`,
              },
              {
                title: '풀기',
                body: `$$x=\\frac{${p + q}}{2}=${ans}$$`,
              },
            ],
            tip: '등차중항은 두 수의 한가운데, 곧 평균이에요. 수직선 위에서 두 수의 딱 중간 자리예요.',
          };
        }
      }
      const p = rng.int(1, 6);
      const r = rng.int(2, 4);
      const x = p * r;
      const q = p * r * r;
      return {
        q: `세 양수 $${p}$, $x$, $${q}$ 가 이 순서대로 등비수열을 이룰 때, $x$ 의 값을 구하세요.`,
        choices: null,
        answer: String(x),
        answerType: 'int',
        check: `[t for t in solve(Eq(x**2, ${p}*${q}), x) if t > 0][0]`,
        concepts: ['등비중항: $a$, $b$, $c$ 가 이 순서대로 등비수열이면 $b^2=ac$'],
        steps: [
          {
            title: '공비가 같다',
            body: `$\\frac{x}{${p}}=\\frac{${q}}{x}$ 이므로 $x^2=${p}\\cdot${q}=${p * q}$ ${ieyo(p * q)}.`,
          },
          {
            title: '양수인 것 고르기',
            body: `$x=\\pm${x}$ 인데 $x$ 는 양수이므로 $x=${x}$ ${ieyo(x)}.`,
          },
        ],
        tip: `확인: $${p}\\to${x}\\to${q}$ 는 모두 $${r}$ 배씩 커져요.`,
      };
    },
  },
];
