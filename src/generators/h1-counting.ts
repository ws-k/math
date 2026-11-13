import { jo } from './h1-poly-ops.ts';
import type { Generator } from './types.ts';

const UNIT = 'h1-counting';

// 검산식은 itertools 로 경우를 모두 늘어놓아 센다. 풀이는 공식(nPr·nCr·곱의 법칙)으로 쓰므로,
// 공식을 잘못 고른 문제(순서가 있는데 조합으로 셈 등)는 늘어놓은 수와 어긋나 검산에서 잡힌다.

const PRODUCT = '곱의 법칙: 두 일이 잇따라 일어나면 각 경우의 수를 곱해요.';
const SUM = '합의 법칙: 두 일이 동시에 일어나지 않으면 각 경우의 수를 더해요.';
const PERM =
  '$_n\\mathrm{P}_r=n(n-1)(n-2)\\cdots(n-r+1)$: 서로 다른 $n$ 개에서 $r$ 개를 골라 줄 세우는 수';
const COMB =
  '$_n\\mathrm{C}_r=\\dfrac{_n\\mathrm{P}_r}{r!}$: 서로 다른 $n$ 개에서 순서 없이 $r$ 개를 고르는 수';

/** n(n-1)…(n-r+1) 을 곱셈식으로: (6,3) → 6\times5\times4 */
const fallTex = (n: number, r: number) =>
  Array.from({ length: r }, (_, i) => n - i).join('\\times');
const fall = (n: number, r: number) =>
  Array.from({ length: r }, (_, i) => n - i).reduce((a, b) => a * b, 1);
const fact = (n: number) => fall(n, n);

/** 줄 세우는 자리 이름(r 개) */
const SEATS: Record<number, string> = { 2: '1등과 2등', 3: '1등, 2등, 3등' };

export const generators: Generator[] = [
  {
    id: 'count-sum-product',
    unitId: UNIT,
    title: '합의 법칙과 곱의 법칙',
    make(rng) {
      if (rng.int(0, 1) === 0) {
        const a = rng.int(3, 6);
        const b = rng.int(2, 5);
        const c = rng.int(2, 4);
        return {
          q: `티셔츠 $${a}$ 벌, 바지 $${b}$ 벌, 운동화 $${c}$ 켤레가 있어요. 각각 하나씩 골라 입는 방법의 수를 구하세요.`,
          choices: null,
          answer: String(a * b * c),
          answerType: 'int',
          check: `from itertools import product\nans = len(list(product(range(${a}), range(${b}), range(${c}))))`,
          concepts: [PRODUCT],
          steps: [
            {
              title: '잇따라 고르기',
              body: '티셔츠를 고르고, 그 각각에 바지를, 또 그 각각에 운동화를 골라요.',
            },
            { title: '곱하기', body: `$$${a}\\times${b}\\times${c}=${a * b * c}$$` },
          ],
          tip: `셋을 모두 입으니까 더하면 안 돼요. $${a}+${b}+${c}$ 는 '하나만 고르는' 경우예요.`,
        };
      }
      const a = rng.int(3, 7);
      const b = rng.int(2, 6);
      return {
        q: `분식 메뉴 $${a}$ 가지와 덮밥 메뉴 $${b}$ 가지가 있어요. 이 가운데 한 가지만 골라 주문하는 방법의 수를 구하세요.`,
        choices: null,
        answer: String(a + b),
        answerType: 'int',
        check: `ans = len(set([('A', i) for i in range(${a})] + [('B', j) for j in range(${b})]))`,
        concepts: [SUM],
        steps: [
          {
            title: '동시에 일어나지 않아요',
            body: '한 가지만 고르니 분식을 고르면 덮밥은 고르지 않아요.',
          },
          { title: '더하기', body: `$$${a}+${b}=${a + b}$$` },
        ],
        tip: '"하나만"·"또는"이면 더하고, "그리고"·"각각 하나씩"이면 곱해요.',
      };
    },
  },
  {
    id: 'perm-rank',
    unitId: UNIT,
    title: '순열의 수',
    make(rng) {
      const n = rng.int(4, 9);
      const r = rng.int(2, 3);
      const ans = fall(n, r);
      return {
        q: `달리기 대회에 $${n}$ 명이 나갔어요. ${SEATS[r]}을 정하는 방법의 수를 구하세요. (같은 등수는 없어요.)`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import permutations\nans = len(list(permutations(range(${n}), ${r})))`,
        concepts: [PERM],
        steps: [
          {
            title: '순서가 있어요',
            body: `등수가 다르면 다른 경우라 순열 $_{${n}}\\mathrm{P}_{${r}}$ ${jo(String(r), '이에요')}.`,
          },
          {
            title: '자리마다 고르기',
            body: `1등 $${n}$ 명, 2등은 남은 $${n - 1}$ 명${r === 3 ? `, 3등은 남은 $${n - 2}$ 명` : ''} 가운데서 골라요.`,
          },
          { title: '곱하기', body: `$$${fallTex(n, r)}=${ans}$$` },
        ],
        tip: '앞자리에서 한 명을 쓰면 다음 자리 후보가 한 명씩 줄어요.',
      };
    },
  },
  {
    id: 'comb-choose',
    unitId: UNIT,
    title: '조합의 수',
    make(rng) {
      const n = rng.int(5, 10);
      const r = rng.int(2, 4);
      const ans = fall(n, r) / fact(r);
      return {
        q: `동아리 회원 $${n}$ 명 가운데 대회에 나갈 대표 $${r}$ 명을 뽑는 방법의 수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import combinations\nans = len(list(combinations(range(${n}), ${r})))`,
        concepts: [COMB],
        steps: [
          {
            title: '순서가 없어요',
            body: `대표끼리는 자리가 없으니 조합 $_{${n}}\\mathrm{C}_{${r}}$ ${jo(String(r), '이에요')}.`,
          },
          {
            title: '줄 세우는 수',
            body: `$$_{${n}}\\mathrm{P}_{${r}}=${fallTex(n, r)}=${fall(n, r)}$$`,
          },
          {
            title: `${r}! 로 나누기`,
            body: `같은 대표 $${r}$ 명이 $${r}!=${fact(r)}$ 번씩 겹쳐 세졌어요.\n$$\\frac{${fall(n, r)}}{${fact(r)}}=${ans}$$`,
          },
        ],
        tip: '순서가 없으면 순열을 $r!$ 로 나눠요. 나누지 않으면 같은 대표를 여러 번 세요.',
      };
    },
  },
  {
    id: 'perm-adjacent',
    unitId: UNIT,
    title: '이웃하게 줄 세우기',
    make(rng) {
      const n = rng.int(4, 7);
      const ans = fact(n - 1) * 2;
      return {
        q: `$${n}$ 명이 한 줄로 서서 사진을 찍어요. 이 가운데 두 친구 A, B 가 서로 이웃하게 서는 방법의 수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `from itertools import permutations\nans = len([s for s in permutations(range(${n})) if abs(s.index(0) - s.index(1)) == 1])`,
        concepts: ['이웃하는 것은 한 묶음으로 보고 줄 세운 뒤, 묶음 안의 순서를 곱해요.', PRODUCT],
        steps: [
          {
            title: 'A, B 를 한 묶음으로',
            body: `묶음 하나와 나머지 $${n - 2}$ 명, 모두 $${n - 1}$ 개를 줄 세워요.\n$$${n - 1}!=${fact(n - 1)}$$`,
          },
          { title: '묶음 안의 순서', body: 'AB 와 BA 로 $2!=2$ 가지예요.' },
          { title: '곱하기', body: `$$${fact(n - 1)}\\times2=${ans}$$` },
        ],
        tip: '묶음 안에서 자리를 바꾸는 $2!$ 을 빠뜨리기 쉬워요.',
      };
    },
  },
  {
    id: 'comb-symmetry',
    unitId: UNIT,
    title: '조합의 성질',
    make(rng) {
      for (;;) {
        const n = rng.int(7, 15);
        const r = rng.int(1, Math.floor((n - 1) / 2));
        const s = n - r;
        if (s === r) continue;
        return {
          q: `$_n\\mathrm{C}_{${r}}={}_n\\mathrm{C}_{${s}}$ 을 만족하는 자연수 $n$ 의 값을 구하세요.`,
          choices: null,
          answer: String(n),
          answerType: 'int',
          check: `ans = [m for m in range(${s}, 60) if binomial(m, ${r}) == binomial(m, ${s})][0]`,
          concepts: [
            '$_n\\mathrm{C}_r={}_n\\mathrm{C}_{n-r}$: $r$ 개를 고르는 것은 남길 $n-r$ 개를 고르는 것과 같아요.',
          ],
          steps: [
            {
              title: '고르기 = 남기기',
              body: `$_n\\mathrm{C}_{${r}}={}_n\\mathrm{C}_{n-${r}}$ 이에요.`,
            },
            {
              title: '같은 자리 맞추기',
              body: `$${r}\\neq${s}$ 이므로 $n-${r}=${s}$ ${jo(String(s), '이에요')}.`,
            },
            { title: 'n 구하기', body: `$$n=${s}+${r}=${n}$$` },
          ],
          tip: '$_n\\mathrm{C}_a={}_n\\mathrm{C}_b$ 이면 $a=b$ 또는 $a+b=n$ 이에요.',
        };
      }
    },
  },
];
