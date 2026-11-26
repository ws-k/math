import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd, ieyo, ro } from './util.ts';

const UNIT = 'prob-conditional';

// id 는 모두 'prob-conditional-' 로 시작한다. 중2 확률 단원이 이미 'prob-bag'·'prob-dice' 같은
// 짧은 이름을 쓰고 있어서, 'prob-' 만으로는 겹칠 수 있다.
//
// 검산식은 풀이와 다른 길로 계산한다: 표·주머니·독립시행은 경우를 하나하나 늘어놓아 세고
// (itertools), 공식 문제는 주어진 확률에서 덧셈정리·방정식으로 다시 구한다. 풀이가 공식을 잘못
// 고르면(조건과 구하는 것을 뒤바꾸는 등) 늘어놓은 값과 어긋나 검산에서 잡힌다.
// 단일 줄 검산식은 파이썬 eval 이라 1/3 이 실수가 되므로 분수는 늘 Rational 로 쓴다.

const COND = '조건부확률: $P(B\\mid A)=\\dfrac{P(A\\cap B)}{P(A)}$ — 전체를 $A$ 로 줄여서 봐요.';
const ADD = '덧셈정리: $P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$';
const MULT = '곱셈정리: $P(A\\cap B)=P(A)P(B\\mid A)$';
const INDEP = '$A$, $B$ 가 서로 독립이면 $P(A\\cap B)=P(A)P(B)$';
const TRIAL =
  '독립시행: 확률이 $p$ 인 사건이 $n$ 번 중 $r$ 번 일어날 확률은 $_n\\mathrm{C}_r\\,p^r(1-p)^{n-r}$';

const R = (n: number, d: number) => `Rational(${n}, ${d})`;
const C = (n: number, r: number) => {
  let v = 1;
  for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
  return v;
};

/** 센 수끼리 나눈 분수. 약분될 때만 '= 기약분수'를 덧붙인다(같은 분수를 두 번 적지 않게) */
const divTex = (n: number, d: number) =>
  gcd(n, d) === 1 ? `\\frac{${n}}{${d}}` : `\\frac{${n}}{${d}}=${fracTex(n, d)}`;

/** 분모를 맞춘(약분하지 않은) 분수 — 계산 과정을 같은 분모로 보이려고 */
const raw = (n: number, d: number) => `\\frac{${n}}{${d}}`;

export const generators: Generator[] = [
  {
    id: 'prob-conditional-formula',
    unitId: UNIT,
    title: '덧셈정리로 조건부확률 구하기',
    make(rng) {
      for (;;) {
        const N = rng.pick([6, 8, 10, 12, 15, 20]);
        const nAB = rng.int(1, Math.floor(N / 3));
        const nA = rng.int(nAB + 1, N - 2);
        const nB = rng.int(nAB + 1, N - 2);
        const nU = nA + nB - nAB;
        if (nU >= N) continue; // P(A∪B)=1 이면 문제가 어색해서 뺀다
        // 셋이 모두 약분되지 않으면 분모 맞추기 단계가 의미 없어지므로 하나는 약분되게 한다
        if (gcd(nA, N) === 1 && gcd(nB, N) === 1 && gcd(nU, N) === 1) continue;
        const givenB = rng.int(0, 1) === 1; // true: P(A|B), false: P(B|A)
        const nC = givenB ? nB : nA;
        const cond = givenB ? 'B' : 'A';
        const other = givenB ? 'A' : 'B';
        return {
          q: `두 사건 $A$, $B$ 에 대하여 $P(A)=${fracTex(nA, N)}$, $P(B)=${fracTex(nB, N)}$, $P(A\\cup B)=${fracTex(nU, N)}$ 일 때, $P(${other}\\mid ${cond})$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(nAB, nC),
          answerType: 'fraction',
          check: `(${R(nA, N)} + ${R(nB, N)} - ${R(nU, N)})/${R(nC, N)}`,
          concepts: [ADD, COND],
          steps: [
            {
              title: `분모를 ${N} ${ro(N)} 맞추기`,
              body: `$$P(A)=${raw(nA, N)},\\quad P(B)=${raw(nB, N)},\\quad P(A\\cup B)=${raw(nU, N)}$$`,
            },
            {
              title: '덧셈정리로 겹친 부분 구하기',
              body: `$$P(A\\cap B)=${raw(nA, N)}+${raw(nB, N)}-${raw(nU, N)}=${raw(nAB, N)}$$`,
            },
            {
              title: `조건 ${cond} 로 나누기`,
              body: `$${cond}$ 가 일어났다는 조건이니 $P(${cond})$ 로 나눠요.\n$$P(${other}\\mid ${cond})=\\frac{P(A\\cap B)}{P(${cond})}=\\frac{${nAB}/${N}}{${nC}/${N}}=${fracTex(nAB, nC)}$$`,
            },
          ],
          tip: `분모가 같으니 분자끼리만 나눠도 돼요: $\\frac{${nAB}}{${nC}}$. $P(${cond}\\mid ${other})$ 와 헷갈리지 않게, 세로선 오른쪽(조건)이 분모로 가요.`,
        };
      }
    },
  },
  {
    id: 'prob-conditional-count',
    unitId: UNIT,
    title: '조사 결과에서 조건부확률 구하기',
    make(rng) {
      for (;;) {
        // [집단1, 집단2, 성질, 성질 가진 사람]
        const [g1, g2, prop, who] = rng.pick([
          ['남학생', '여학생', '안경을 썼', '안경을 쓴 학생'],
          ['1학년', '2학년', '동아리에 가입했', '동아리에 가입한 학생'],
          ['남학생', '여학생', '방과후 수업을 신청했', '방과후 수업을 신청한 학생'],
        ] as const);
        const m = rng.int(10, 20);
        const f = rng.int(10, 20);
        const a = rng.int(2, m - 2);
        const b = rng.int(2, f - 2);
        if (a === b) continue;
        const rev = rng.int(0, 1) === 1; // true: 성질 → 집단2, false: 집단2 → 성질
        const num = b;
        const den = rev ? a + b : f;
        // 검산: 학생을 (집단, 성질) 쌍으로 늘어놓고 조건에 맞는 사람만 남겨 센다
        const list = `S = [(1, 1)]*${a} + [(1, 0)]*${m - a} + [(2, 1)]*${b} + [(2, 0)]*${f - b}`;
        const check = rev
          ? `${list}\nT = [s for s in S if s[1] == 1]\nans = Rational(len([s for s in T if s[0] == 2]), len(T))`
          : `${list}\nT = [s for s in S if s[0] == 2]\nans = Rational(len([s for s in T if s[1] == 1]), len(T))`;
        const ask = rev
          ? `뽑힌 학생이 ${who}이었을 때, 이 학생이 ${g2}일 확률`
          : `뽑힌 학생이 ${g2}이었을 때, 이 학생이 ${prop}을 확률`;
        return {
          q: `어느 반 ${g1} $${m}$ 명 중 $${a}$ 명, ${g2} $${f}$ 명 중 $${b}$ 명이 ${prop}어요. 이 반에서 한 명을 뽑았어요. ${ask}을 구하세요.`,
          choices: null,
          answer: fracAns(num, den),
          answerType: 'fraction',
          check,
          concepts: [COND, '조건부확률은 전체를 조건에 맞는 사람으로 줄여서 세도 돼요.'],
          steps: rev
            ? [
                {
                  title: '조건으로 전체 줄이기',
                  body: `조건은 '${who}'이에요. 그런 학생은 $${a}+${b}=${a + b}$ 명이에요.`,
                },
                {
                  title: '그중 구하는 것 세기',
                  body: `그중 ${g2}은 $${b}$ 명이에요.`,
                },
                { title: '나누기', body: `$$${divTex(num, den)}$$` },
              ]
            : [
                {
                  title: '조건으로 전체 줄이기',
                  body: `조건은 '${g2}'이에요. 전체가 ${g2} $${f}$ 명으로 줄어요.`,
                },
                {
                  title: '그중 구하는 것 세기',
                  body: `그중 ${who}은 $${b}$ 명이에요.`,
                },
                { title: '나누기', body: `$$${divTex(num, den)}$$` },
              ],
          tip: rev
            ? `분모를 ${g2} $${f}$ 명으로 하면 '${g2}일 때 ${prop}을 확률'이 돼요. 조건이 무엇인지 먼저 확인해요.`
            : `분모를 ${who} $${a + b}$ 명으로 하면 조건과 구하는 것이 뒤바뀐 확률이 돼요.`,
        };
      }
    },
  },
  {
    id: 'prob-conditional-draw',
    unitId: UNIT,
    title: '다시 넣지 않고 두 번 꺼내기(곱셈정리)',
    make(rng) {
      const r = rng.int(2, 6);
      const b = rng.int(2, 6);
      const n = r + b;
      const kind = rng.int(0, 2); // 0: 둘 다 빨강, 1: 파랑 → 빨강, 2: 둘 다 파랑
      const [f1, f2, d1, d2, what] =
        kind === 0
          ? [r, r - 1, '빨간 공', '빨간 공', '두 번 모두 빨간 공이 나올']
          : kind === 1
            ? [b, r, '파란 공', '빨간 공', '첫 번째에 파란 공, 두 번째에 빨간 공이 나올']
            : [b, b - 1, '파란 공', '파란 공', '두 번 모두 파란 공이 나올'];
      const first = kind === 1 ? 0 : kind === 0 ? 1 : 0;
      const second = kind === 2 ? 0 : 1;
      const left = kind === 1 ? `${d2}은 그대로 $${r}$ 개` : `${d2}은 $${f2}$ 개`;
      return {
        q: `주머니에 빨간 공 $${r}$ 개와 파란 공 $${b}$ 개가 있어요. 공을 하나 꺼내 색을 확인하고 다시 넣지 않은 채 하나를 더 꺼낼 때, ${what} 확률을 구하세요.`,
        choices: null,
        answer: fracAns(f1 * f2, n * (n - 1)),
        answerType: 'fraction',
        check: `from itertools import permutations\nB = [1]*${r} + [0]*${b}\nL = list(permutations(range(${n}), 2))\nans = Rational(len([1 for i, j in L if B[i] == ${first} and B[j] == ${second}]), len(L))`,
        concepts: [MULT, '꺼낸 공을 다시 넣지 않으면 두 번째에는 공이 하나 줄어요.'],
        steps: [
          {
            title: '첫 번째',
            body: `공 $${n}$ 개 중 ${d1}이 $${f1}$ 개라 $\\frac{${f1}}{${n}}$ ${ieyo(f1)}.`,
          },
          {
            title: '첫 번째 결과를 안 뒤의 두 번째',
            body: `공이 $${n - 1}$ 개 남고 ${left}라 $\\frac{${f2}}{${n - 1}}$ ${ieyo(f2)}.`,
          },
          {
            title: '곱셈정리로 곱하기',
            body: `$$\\frac{${f1}}{${n}}\\times\\frac{${f2}}{${n - 1}}=${fracTex(f1 * f2, n * (n - 1))}$$`,
          },
        ],
        tip: `다시 넣었다면 두 번째에도 공이 $${n}$ 개 그대로라 답이 달라져요. 앞 결과가 뒤 확률을 바꾸는 경우(종속)예요.`,
      };
    },
  },
  {
    id: 'prob-conditional-trial',
    unitId: UNIT,
    title: '독립시행의 확률',
    make(rng) {
      for (;;) {
        // [시행 한 번의 설명, 사건, 분자, 분모]
        const [act, ev, pn, pd] = rng.pick([
          ['동전 한 개를', '앞면이 나오는', 1, 2],
          ['주사위 한 개를', '3의 배수의 눈이 나오는', 1, 3],
          ['주사위 한 개를', '6의 눈이 나오는', 1, 6],
          ['주사위 한 개를', '5 이상의 눈이 나오는', 1, 3],
          ['주사위 한 개를', '2 이하의 눈이 나오는', 1, 3],
        ] as const);
        const n = rng.int(3, 5);
        const atLeast = rng.int(0, 3) === 0;
        const r = atLeast ? 1 : rng.int(1, n - 1);
        const qn = pd - pn;
        const ansN = atLeast ? pd ** n - qn ** n : C(n, r) * pn ** r * qn ** (n - r);
        const ansD = pd ** n;
        // 검산: 매번의 결과(일어남 1 / 안 일어남 0)를 모두 늘어놓고 각 경우의 확률을 곱해 더한다
        const cond = atLeast ? 'sum(w) >= 1' : `sum(w) == ${r}`;
        const check = `from itertools import product\nP = ${R(pn, pd)}\nans = sum(P**sum(w)*(1 - P)**(${n} - sum(w)) for w in product([0, 1], repeat=${n}) if ${cond})`;
        const p = fracTex(pn, pd);
        const q = fracTex(qn, pd);
        const base = `${act} $${n}$ 번 던질 때, ${ev} 횟수가`;
        if (atLeast) {
          return {
            q: `${base} 적어도 $1$ 번일 확률을 구하세요.`,
            choices: null,
            answer: fracAns(ansN, ansD),
            answerType: 'fraction',
            check,
            concepts: [TRIAL, "'적어도 한 번'은 여사건(한 번도 안 일어남)을 1 에서 빼요."],
            steps: [
              {
                title: '한 번의 확률',
                body: `한 번 던질 때 일어날 확률은 $${p}$, 일어나지 않을 확률은 $${q}$ ${ieyo(qn)}.`,
              },
              {
                title: '한 번도 안 일어날 확률',
                body: `매번 독립이라 곱해요.\n$$\\left(${q}\\right)^{${n}}=${fracTex(qn ** n, ansD)}$$`,
              },
              {
                title: '여사건으로 빼기',
                body: `$$1-${fracTex(qn ** n, ansD)}=${fracTex(ansN, ansD)}$$`,
              },
            ],
            tip: '한 번, 두 번, … 을 따로 구해 더해도 같지만, 여사건이 훨씬 짧아요.',
          };
        }
        if (ansN === 0) continue;
        return {
          q: `${base} 정확히 $${r}$ 번일 확률을 구하세요.`,
          choices: null,
          answer: fracAns(ansN, ansD),
          answerType: 'fraction',
          check,
          concepts: [TRIAL],
          steps: [
            {
              title: '한 번의 확률',
              body: `일어날 확률 $p=${p}$, 일어나지 않을 확률 $1-p=${q}$ ${ieyo(qn)}.`,
            },
            {
              title: '자리 고르기',
              body: `$${n}$ 번 중 일어날 $${r}$ 번의 자리를 고르는 방법은 \${}_{${n}}\\mathrm{C}_{${r}}=${C(n, r)}$ 가지예요.`,
            },
            {
              title: '독립시행의 확률',
              body: `$\${}_{${n}}\\mathrm{C}_{${r}}\\left(${p}\\right)^{${r}}\\left(${q}\\right)^{${n - r}}=${C(n, r)}\\times\\frac{${pn ** r * qn ** (n - r)}}{${ansD}}=${fracTex(ansN, ansD)}$$`,
            },
          ],
          tip: `자리 고르는 가짓수(\${}_{${n}}\\mathrm{C}_{${r}}$)를 빠뜨리면 한 가지 순서의 확률만 구한 셈이에요.`,
        };
      }
    },
  },
  {
    id: 'prob-conditional-indep',
    unitId: UNIT,
    title: '서로 독립인 두 사건',
    make(rng) {
      for (;;) {
        const da = rng.pick([2, 3, 4, 5]);
        const db = rng.pick([2, 3, 4, 5]);
        const na = rng.int(1, da - 1);
        const nb = rng.int(1, db - 1);
        if (gcd(na, da) !== 1 || gcd(nb, db) !== 1) continue;
        // P(A∪B) = a + b - ab (분모 da*db 로 맞춰서)
        const D = da * db;
        const uN = na * db + nb * da - na * nb;
        if (rng.int(0, 1) === 0) {
          return {
            q: `두 사건 $A$, $B$ 는 서로 독립이고 $P(A)=${fracTex(na, da)}$, $P(B)=${fracTex(nb, db)}$ 일 때, $P(A\\cup B)$ 의 값을 구하세요.`,
            choices: null,
            answer: fracAns(uN, D),
            answerType: 'fraction',
            check: `${R(na, da)} + ${R(nb, db)} - ${R(na, da)}*${R(nb, db)}`,
            concepts: [INDEP, ADD],
            steps: [
              {
                title: '독립이니 곱하기',
                body: `$$P(A\\cap B)=P(A)P(B)=${fracTex(na, da)}\\times${fracTex(nb, db)}=${fracTex(na * nb, D)}$$`,
              },
              {
                title: '덧셈정리',
                body: `$$P(A\\cup B)=${fracTex(na, da)}+${fracTex(nb, db)}-${fracTex(na * nb, D)}=${raw(na * db, D)}+${raw(nb * da, D)}-${raw(na * nb, D)}=${fracTex(uN, D)}$$`,
              },
            ],
            tip: `여사건으로도 구할 수 있어요: $1-P(A^C)P(B^C)=1-${fracTex(da - na, da)}\\times${fracTex(db - nb, db)}=${fracTex(uN, D)}$. 독립이면 여사건끼리도 독립이에요.`,
          };
        }
        // 거꾸로: P(A), P(A∪B) 를 주고 P(B) 를 묻는다. (1-a)·b = u - a
        return {
          q: `두 사건 $A$, $B$ 는 서로 독립이고 $P(A)=${fracTex(na, da)}$, $P(A\\cup B)=${fracTex(uN, D)}$ 일 때, $P(B)$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(nb, db),
          answerType: 'fraction',
          check: `solve(Eq(${R(na, da)} + t - ${R(na, da)}*t, ${R(uN, D)}), t)[0]`,
          concepts: [INDEP, ADD],
          steps: [
            {
              title: '식 세우기',
              body: `$P(B)=t$ 라 하면 독립이라 $P(A\\cap B)=${fracTex(na, da)}t$ 예요.\n$$${fracTex(na, da)}+t-${fracTex(na, da)}t=${fracTex(uN, D)}$$`,
            },
            {
              title: '정리하기',
              body: `$$${fracTex(da - na, da)}t=${fracTex(uN, D)}-${fracTex(na, da)}=${fracTex(uN - na * db, D)}$$`,
            },
            {
              title: '풀기',
              body: `$$t=${fracTex(uN - na * db, D)}\\div${fracTex(da - na, da)}=${fracTex(nb, db)}$$`,
            },
          ],
          tip: `여사건으로 보면 더 빨라요: $P(A^C\\cap B^C)=P(A^C)P(B^C)$ 이므로 $1-${fracTex(uN, D)}=${fracTex(da - na, da)}\\times P(B^C)$ 예요.`,
        };
      }
    },
  },
];
