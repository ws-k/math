import { jo } from './h1-poly-ops.ts';
import type { Generator } from './types.ts';

const UNIT = 'prob-permutation';

// 검산식은 itertools 로 배열을 모두 늘어놓고, 돌려서 같은 것(원순열)·글자가 같은 것(같은 것이 있는 순열)을
// 집합으로 합쳐 센다. 풀이는 공식((n-1)!, n^r, n!/(p!q!))으로 쓰므로 공식을 잘못 고르면 검산에서 어긋난다.
// id 는 모두 단원 id 'prob-permutation-' 로 시작한다 — 고1 'cnt-' 생성기와 이름이 겹친 사고를 다시 막으려고.
// 늘어놓는 개수는 8! = 40320 을 넘지 않게 사람 수·글자 수를 8 이하로 둔다(시드 200개를 검산하므로).

const CIRCLE =
  '원순열: 서로 다른 $n$ 개를 원형으로 놓는 수는 $\\dfrac{n!}{n}=(n-1)!$ 이에요. 한 명을 기준으로 앉히고 나머지를 줄 세워요.';
const REPEAT =
  '중복순열: 서로 다른 $n$ 개에서 중복을 허락해 $r$ 개를 줄 세우는 수는 $_n\\Pi_r=n^r$ 이에요.';
const SAME =
  '같은 것이 있는 순열: $p$ 개, $q$ 개, $r$ 개가 각각 같을 때 $n$ 개를 줄 세우는 수는 $\\dfrac{n!}{p!\\,q!\\,r!}$ 이에요.';

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
/** 4 → 4\times3\times2\times1 */
const factTex = (n: number) => Array.from({ length: n }, (_, i) => n - i).join('\\times');

export const generators: Generator[] = [
  {
    id: 'prob-permutation-circle',
    unitId: UNIT,
    title: '원순열',
    make(rng) {
      // 회전으로 같은 배열을 하나로 합친 가짓수: 회전한 n 개 중 가장 작은 것을 대표로 삼는다
      const rot = (n: number) =>
        `from itertools import permutations\nreps = {min(tuple(p[i:] + p[:i]) for i in range(${n})) for p in permutations(range(${n}))}`;
      if (rng.int(0, 1) === 0) {
        const n = rng.int(4, 7);
        const ans = fact(n - 1);
        return {
          q: `$${n}$ 명이 원탁에 일정한 간격으로 둘러앉는 방법의 수를 구하세요. (돌려서 겹치는 것은 같은 것으로 봐요.)`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${rot(n)}\nans = len(reps)`,
          concepts: [CIRCLE],
          steps: [
            {
              title: '한 명을 기준으로',
              body: '돌려서 같은 것을 하나로 보니, 한 명을 먼저 앉혀 기준으로 삼아요. 그 사람 자리는 한 가지예요.',
            },
            {
              title: '나머지 줄 세우기',
              body: `기준에서 시계 방향으로 남은 $${n - 1}$ 명을 줄 세워요.\n$$${n - 1}!=${factTex(n - 1)}=${ans}$$`,
            },
          ],
          tip: `한 줄로 세운 $${n}!=${fact(n)}$ 에는 같은 원 배열이 회전한 $${n}$ 가지씩 들어 있어요. $${fact(n)}\\div${n}=${ans}$ ${jo(String(ans), '으로')} 검산할 수 있어요.`,
        };
      }
      const n = rng.int(5, 7);
      const adj = fact(n - 2) * 2;
      // 이웃하지 않는 쪽은 '전체 − 이웃'으로 세는 흐름을 연습시킨다(같은 n 이라도 다른 문제가 되게)
      if (rng.int(0, 1) === 1) {
        const ans = fact(n - 1) - adj;
        return {
          q: `A, B 를 포함한 $${n}$ 명이 원탁에 일정한 간격으로 둘러앉을 때, A 와 B 가 이웃하지 않게 앉는 방법의 수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${rot(n)}\nans = len([p for p in reps if (p.index(0) - p.index(1)) % ${n} not in (1, ${n - 1})])`,
          concepts: [CIRCLE, '이웃하지 않는 경우의 수 = 전체 − 이웃하는 경우의 수'],
          steps: [
            {
              title: '전체',
              body: `$${n}$ 명의 원순열은 $(${n}-1)!=${fact(n - 1)}$ ${jo(String(fact(n - 1)), '이에요')}.`,
            },
            {
              title: '이웃하는 경우',
              body: `A, B 를 묶으면 $${n - 1}$ 덩어리라 $(${n - 1}-1)!\\times2=${adj}$ ${jo(String(adj), '이에요')}.`,
            },
            { title: '빼기', body: `$$${fact(n - 1)}-${adj}=${ans}$$` },
          ],
          tip: 'A 를 기준으로 앉히고 B 가 A 바로 옆 두 자리를 피하게 앉혀도 같은 답이 나와요.',
        };
      }
      const ans = adj;
      return {
        q: `A, B 를 포함한 $${n}$ 명이 원탁에 일정한 간격으로 둘러앉을 때, A 와 B 가 이웃하게 앉는 방법의 수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `${rot(n)}\nans = len([p for p in reps if (p.index(0) - p.index(1)) % ${n} in (1, ${n - 1})])`,
        concepts: [
          CIRCLE,
          '이웃하는 것은 한 묶음으로 보고 먼저 배열한 뒤, 묶음 안에서 자리를 바꾸는 수를 곱해요.',
        ],
        steps: [
          {
            title: '한 묶음으로',
            body: `A, B 를 한 사람처럼 묶으면 모두 $${n - 1}$ 명이에요.`,
          },
          {
            title: '원순열',
            body: `$${n - 1}$ 명이 원탁에 앉는 수는 $(${n - 1}-1)!=${n - 2}!=${fact(n - 2)}$ ${jo(String(fact(n - 2)), '이에요')}.`,
          },
          {
            title: '묶음 안 자리 바꾸기',
            body: `묶음 안에서 A, B 가 자리를 바꾸는 $2$ 가지를 곱해요.\n$$${fact(n - 2)}\\times2=${ans}$$`,
          },
        ],
        tip: '원순열이라 묶은 뒤에도 $(\\text{사람 수}-1)!$ 이에요. 한 줄로 세울 때처럼 $(\\text{사람 수})!$ 로 곱하면 회전한 것을 겹쳐 세요.',
      };
    },
  },
  {
    id: 'prob-permutation-repeat',
    unitId: UNIT,
    title: '중복순열',
    make(rng) {
      if (rng.int(0, 1) === 0) {
        const k = rng.int(2, 5);
        const r = rng.int(3, 4);
        const ans = k ** r;
        const digits = Array.from({ length: k }, (_, i) => i + 1).join(',\\,');
        return {
          q: `숫자 $${digits}$ 중에서 중복을 허락하여 만들 수 있는 $${r}$ 자리 자연수의 개수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `from itertools import product\nans = len(list(product(range(1, ${k + 1}), repeat=${r})))`,
          concepts: [REPEAT],
          steps: [
            {
              title: '자리마다 후보',
              body: `같은 숫자를 다시 써도 되니 모든 자리에 $${k}$ 가지씩 올 수 있어요.`,
            },
            {
              title: '곱하기',
              body: `$$_${k}\\Pi_${r}=${k}^${r}=${ans}$$`,
            },
          ],
          tip: `중복이 없으면 $_${k}\\mathrm{P}_${r}$ 처럼 자리마다 후보가 하나씩 줄지만, 중복을 허락하면 줄지 않아요.`,
        };
      }
      // 편지(r)와 우체통(n)의 수가 같으면 n^r 과 r^n 이 같아져, 밑과 지수를 바꾸는 실수를 잡지 못한다
      let n = 2;
      let r = 2;
      while (n === r) {
        n = rng.int(2, 4);
        r = rng.int(2, 4);
      }
      const ans = n ** r;
      return {
        q: `서로 다른 편지 $${r}$ 통을 서로 다른 우체통 $${n}$ 개에 넣는 방법의 수를 구하세요. (한 우체통에 여러 통을 넣어도 되고, 비어 있는 우체통이 있어도 돼요.)`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import product\nans = len(list(product(range(${n}), repeat=${r})))`,
        concepts: [REPEAT],
        steps: [
          {
            title: '누가 고르나',
            body: `편지 한 통마다 들어갈 우체통을 하나씩 골라요. 편지마다 $${n}$ 가지예요.`,
          },
          {
            title: '편지 수만큼 곱하기',
            body: `$$${n}^${r}=${ans}$$`,
          },
        ],
        tip: `고르는 쪽(편지 $${r}$ 통)이 지수, 골라지는 쪽(우체통 $${n}$ 개)이 밑이에요. $${r}^${n}=${r ** n}$ ${jo(String(r ** n), '으로')} 바꿔 쓰지 않게 조심해요.`,
      };
    },
  },
  {
    id: 'prob-permutation-same',
    unitId: UNIT,
    title: '같은 것이 있는 순열',
    make(rng) {
      for (;;) {
        const a = rng.int(2, 4);
        const b = rng.int(1, 3);
        const c = rng.int(0, 2);
        const n = a + b + c;
        if (n > 8 || n < 5) continue;
        const ans = fact(n) / (fact(a) * fact(b) * fact(c));
        const kinds = [`빨간 깃발 $${a}$ 개`, `파란 깃발 $${b}$ 개`];
        if (c > 0) kinds.push(`노란 깃발 $${c}$ 개`);
        const denTex = [a, b, c]
          .filter((x) => x > 1)
          .map((x) => `${x}!`)
          .join('\\,');
        const word = 'R'.repeat(a) + 'B'.repeat(b) + 'Y'.repeat(c);
        return {
          q: `${kinds.join(', ')}를 모두 한 줄로 늘어놓는 방법의 수를 구하세요. (같은 색 깃발끼리는 구별하지 않아요.)`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `from itertools import permutations\nans = len(set(permutations('${word}')))`,
          concepts: [SAME],
          steps: [
            {
              title: '모두 다르다면',
              body: `깃발 $${n}$ 개가 모두 다르면 $${n}!=${fact(n)}$ 가지예요.`,
            },
            {
              title: '같은 것끼리 겹친 횟수',
              body: `같은 색끼리 자리를 바꿔도 같은 배열이라, 한 배열이 $${denTex}$ 번씩 겹쳐 세어졌어요.`,
            },
            {
              title: '나누기',
              body: `$$\\frac{${n}!}{${denTex}}=${ans}$$`,
            },
          ],
          tip: `빨간 깃발 자리만 고르는 것으로도 셀 수 있어요. $${n}$ 자리 중 빨강 $${a}$ 자리를 고르고, 남은 자리에 다른 색을 차례로 놓아요.`,
        };
      }
    },
  },
  {
    id: 'prob-permutation-path',
    unitId: UNIT,
    title: '최단 경로의 수',
    make(rng) {
      const m = rng.int(2, 5);
      const k = rng.int(2, Math.min(4, 8 - m));
      const ans = fact(m + k) / (fact(m) * fact(k));
      return {
        q: `바둑판 모양의 길에서 A 지점에서 오른쪽으로 $${m}$ 칸, 위쪽으로 $${k}$ 칸 떨어진 B 지점까지 가요. A 에서 B 까지 가는 최단 경로의 수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import permutations\nans = len(set(permutations('${'R'.repeat(m)}${'U'.repeat(k)}')))`,
        concepts: [SAME, '최단 경로는 → 와 ↑ 를 정해진 개수만큼 한 줄로 늘어놓는 것과 같아요.'],
        steps: [
          {
            title: '화살표로 바꾸기',
            body: `가장 짧게 가려면 오른쪽(→) $${m}$ 번, 위(↑) $${k}$ 번만 가요. 한 경로는 이 화살표 $${m + k}$ 개를 늘어놓은 것이에요.`,
          },
          {
            title: '같은 것이 있는 순열',
            body: `$$\\frac{${m + k}!}{${m}!\\,${k}!}=${ans}$$`,
          },
        ],
        tip: `왼쪽(←)이나 아래(↓)로 한 번이라도 가면 최단이 아니에요. ↑ 가 들어갈 자리 $${k}$ 개만 고르면 나머지는 → 라서 $_{${m + k}}\\mathrm{C}_{${k}}=${ans}$ ${jo(String(ans), '으로')}도 셀 수 있어요.`,
      };
    },
  },
  {
    id: 'prob-permutation-function',
    unitId: UNIT,
    title: '함수의 개수(중복순열)',
    make(rng) {
      const fixed = rng.int(0, 1) === 1;
      // 값을 하나 정해 두면 지수가 1 줄어드니, 남는 지수가 2 이상이 되게 X 를 하나 더 크게 잡는다.
      // X 원소 3개 → Y 원소 5개(정해 둔 값 없음)는 표준 문제 p106 과 같아서 피한다
      let m = 0;
      let n = 0;
      while (m === n || (!fixed && m === 3 && n === 5)) {
        m = fixed ? rng.int(3, 4) : rng.int(2, 4);
        n = rng.int(2, 5);
      }
      const set = (k: number) => `\\{${Array.from({ length: k }, (_, i) => i + 1).join(',\\,')}\\}`;
      // f(1)=1 처럼 값 하나를 정해 두면 남은 원소만 고르므로 지수가 하나 줄어든다
      const free = fixed ? m - 1 : m;
      const ans = n ** free;
      return {
        q: `두 집합 $X=${set(m)}$, $Y=${set(n)}$ 에 대하여 $X$ 에서 $Y$ 로의 함수 $f$ ${fixed ? '중에서 $f(1)=1$ 인 것' : ''}의 개수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import product\nans = len([f for f in product(range(1, ${n + 1}), repeat=${m})${fixed ? ' if f[0] == 1' : ''}])`,
        concepts: [REPEAT, '함수는 $X$ 의 원소마다 $Y$ 의 원소를 하나씩 정하는 것이에요.'],
        steps: [
          {
            title: '원소마다 고르기',
            body: fixed
              ? `$f(1)$ 은 $1$ 로 정해졌어요. 남은 $${free}$ 개 원소의 함숫값을 $Y$ 에서 $${n}$ 가지씩 골라요.`
              : `$X$ 의 원소 $${m}$ 개마다 함숫값을 $Y$ 에서 $${n}$ 가지씩 골라요. 같은 값을 또 골라도 돼요.`,
          },
          { title: '중복순열', body: `$$_${n}\\Pi_${free}=${n}^${free}=${ans}$$` },
        ],
        tip: `고르는 쪽은 정의역 $X$ 의 원소예요. 그래서 밑이 $${n}$, 지수가 $${free}$ ${jo(String(free), '이에요')}.`,
      };
    },
  },
];
