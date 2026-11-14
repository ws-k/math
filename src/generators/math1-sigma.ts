import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, polySym, polyTex, reduce } from './util.ts';

const UNIT = 'math1-sigma';

// 수열의 합은 "∑ 를 성질로 쪼갠 뒤 아는 합(∑k, ∑k², 상수)으로 바꾸는" 흐름이 뿌리라, 풀이는 늘
// 쪼개기 → 공식 → 더하기 순서로 쓴다. 검산식은 sympy summation 에 화면의 식을 그대로 넣어,
// 공식을 거치지 않고 실제로 더한 값과 대조한다(공식을 잘못 옮겨 적어도 잡히게).
// 생성기 id 는 다른 단원과 겹치지 않도록 모두 'math1-sig-' 로 시작한다.

// '이에요/예요'는 앞 소리 받침으로 갈린다(숫자는 끝자리: 일·삼·육·칠·팔·영/십 → 받침).
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

/** "+3" / "-3" — 식 뒤에 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

/** ∑ 앞의 계수: 1 이면 생략, -1 이면 부호만 */
const coefTex = (c: number, first: boolean) => {
  if (c === 1) return first ? '' : '+';
  if (c === -1) return '-';
  return first || c < 0 ? String(c) : `+${c}`;
};

const sig = (n: number | string) => `\\sum_{k=1}^{${n}}`;
/** 한 항(k)은 괄호 없이, 여러 항(k+2)은 괄호로 */
const wrap = (t: string) => (t === 'k' ? 'k' : `(${t})`);
const S1 = (n: number) => (n * (n + 1)) / 2;
const S2 = (n: number) => (n * (n + 1) * (2 * n + 1)) / 6;

const PROP =
  '$\\sum(a_k\\pm b_k)=\\sum a_k\\pm\\sum b_k$, $\\sum ca_k=c\\sum a_k$, $\\sum_{k=1}^{n}c=cn$';
const SUM_K = '$\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}$';
const SUM_K2 = '$\\sum_{k=1}^{n}k^2=\\frac{n(n+1)(2n+1)}{6}$';
const SN = '$a_1=S_1$, $a_n=S_n-S_{n-1}$ ($n\\ge2$)';

export const generators: Generator[] = [
  {
    id: 'math1-sig-property',
    unitId: UNIT,
    title: '$\\sum$ 의 성질로 계산하기',
    make(rng) {
      for (;;) {
        const n = rng.pick([5, 10, 20]);
        const A = rng.nonzero(-10, 20);
        const B = rng.nonzero(-10, 20);
        const p = rng.nonzero(-4, 4);
        const q = rng.nonzero(-4, 4);
        const c = rng.nonzero(-3, 3);
        const ans = p * A + q * B + c * n;
        if (ans === 0) continue;
        const inner = `${coefTex(p, true)}a_k${coefTex(q, false)}b_k${signed(c)}`;
        return {
          q: `$${sig(n)}a_k=${A}$, $${sig(n)}b_k=${B}$ 일 때, $${sig(n)}(${inner})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${p}*(${A}) + ${q}*(${B}) + summation(${c}, (k, 1, ${n}))`,
          concepts: [PROP],
          steps: [
            {
              title: '세 덩어리로 나누기',
              body: `더하기·빼기와 상수배는 $\\sum$ 밖으로 나눠 쓸 수 있어요.\n$$${coefTex(p, true)}${sig(n)}a_k${coefTex(q, false)}${sig(n)}b_k+${sig(n)}${paren(c)}$$`,
            },
            {
              title: '상수의 합',
              body: `$${paren(c)}$ 을 $${n}$ 번 더하므로 $${sig(n)}${paren(c)}=${c}\\times${n}=${c * n}$ ${ieyo(c * n)}.`,
            },
            {
              title: '주어진 값 대입하기',
              body: `$$${p}\\cdot${paren(A)}${signed(q)}\\cdot${paren(B)}${signed(c * n)}=${p * A}${signed(q * B)}${signed(c * n)}=${ans}$$`,
            },
          ],
          tip: `상수 $${paren(c)}$ 의 합을 $${c}$ 로 두는 실수가 많아요. $k$ 가 $1$ 부터 $${n}$ 까지 바뀌는 동안 $${n}$ 번 더해져요.`,
        };
      }
    },
  },
  {
    id: 'math1-sig-linear',
    unitId: UNIT,
    title: '$\\sum(ak+b)$ 의 값',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-4, 5);
        const b = rng.nonzero(-6, 6);
        const n = rng.int(5, 20);
        const T = S1(n);
        const ans = a * T + b * n;
        if (ans === 0) continue;
        const inner = polyTex([a, b], 'k');
        return {
          q: `$${sig(n)}(${inner})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `summation(${polySym([a, b], 'k')}, (k, 1, ${n}))`,
          concepts: [PROP, SUM_K],
          steps: [
            {
              title: '나누어 쓰기',
              body: `$$${sig(n)}(${inner})=${coefTex(a, true)}${sig(n)}k+${sig(n)}${paren(b)}$$`,
            },
            {
              title: '$\\sum k$ 공식',
              body: `$$${sig(n)}k=\\frac{${n}\\cdot${n + 1}}{2}=${T}$$`,
            },
            {
              title: '상수의 합',
              body: `$${paren(b)}$ 을 $${n}$ 번 더해요. $${b}\\times${n}=${b * n}$ ${ieyo(b * n)}.`,
            },
            {
              title: '더하기',
              body:
                Math.abs(a) === 1
                  ? `$$${a * T}${signed(b * n)}=${ans}$$`
                  : `$$${a}\\cdot${T}${signed(b * n)}=${a * T}${signed(b * n)}=${ans}$$`,
            },
          ],
          tip: `$${polyTex([a, b], 'k')}$ 에 $k=1$ 을 넣은 첫째항과 $k=${n}$ 을 넣은 끝항의 평균에 항의 개수 $${n}$ 을 곱해도 같은 답이에요. 등차수열의 합이기 때문이에요.`,
        };
      }
    },
  },
  {
    id: 'math1-sig-square',
    unitId: UNIT,
    title: '$\\sum(k+p)(k+q)$ 의 값',
    make(rng) {
      for (;;) {
        const p = rng.int(-4, 4);
        const q = rng.int(-4, 4);
        if (p === 0 && q === 0) continue;
        const n = rng.int(4, 10);
        const m = p + q;
        const c = p * q;
        const s2 = S2(n);
        const s1 = S1(n);
        const ans = s2 + m * s1 + c * n;
        if (ans === 0) continue;
        const P = polyTex([1, p], 'k');
        const Q = polyTex([1, q], 'k');
        // 한 항뿐인 인수(k)는 괄호 없이 앞에 둔다: (k)(k-1) 이 아니라 k(k-1)
        const shown =
          p === q ? `(${P})^2` : p === 0 ? `k(${Q})` : q === 0 ? `k(${P})` : `(${P})(${Q})`;
        const ex = polyTex([1, m, c], 'k');
        // 전개식에서 사라지는 항(일차항·상수항이 0)은 나누어 쓴 식에도 적지 않는다
        const parts = [`${sig(n)}k^2`];
        if (m !== 0) parts.push(`${coefTex(m, false)}${sig(n)}k`);
        if (c !== 0) parts.push(`+${sig(n)}${paren(c)}`);
        const calc = [`${s2}`];
        if (m !== 0) calc.push(Math.abs(m) === 1 ? signed(m * s1) : `${signed(m)}\\cdot${s1}`);
        if (c !== 0) calc.push(`${signed(c * n)}`);
        return {
          q: `$${sig(n)}${shown}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `summation((k + ${paren(p)})*(k + ${paren(q)}), (k, 1, ${n}))`,
          concepts: [PROP, SUM_K, SUM_K2],
          steps: [
            {
              title: '먼저 전개하기',
              body: `곱은 $\\sum$ 을 나눠 쓸 수 없어서 전개부터 해요.\n$$${shown}=${ex}$$`,
            },
            { title: '나누어 쓰기', body: `$$${parts.join('')}$$` },
            {
              title: '$\\sum k^2$ 공식',
              body: `$$${sig(n)}k^2=\\frac{${n}\\cdot${n + 1}\\cdot${2 * n + 1}}{6}=${s2}$$`,
            },
            {
              title: c !== 0 ? '$\\sum k$ 와 상수의 합' : '$\\sum k$ 공식',
              body:
                `$${sig(n)}k=${s1}$` +
                (c !== 0 ? `, 상수 $${paren(c)}$ 의 합은 $${c}\\times${n}=${c * n}$` : '') +
                ' 이에요.',
            },
            { title: '더하기', body: `$$${calc.join('')}=${ans}$$` },
          ],
          tip: `$${sig(n)}${shown}$ 를 $\\left(${sig(n)}${wrap(P)}\\right)\\left(${sig(n)}${wrap(Q)}\\right)$ 처럼 따로 더해 곱하면 틀려요. 곱은 전개한 뒤 나눠요.`,
        };
      }
    },
  },
  {
    id: 'math1-sig-telescope',
    unitId: UNIT,
    title: '부분분수로 합 구하기',
    make(rng) {
      const d = rng.pick([1, 1, 2]);
      if (d === 1) {
        const s = rng.int(0, 2);
        const n = rng.int(5, 15);
        // 1/(s+1) - 1/(n+s+1) = n / ((s+1)(n+s+1))
        const num = n;
        const den = (s + 1) * (n + s + 1);
        const A = polyTex([1, s], 'k');
        const B = polyTex([1, s + 1], 'k');
        const denTex = s === 0 ? `k(${B})` : `(${A})(${B})`;
        const first = fracTex(1, s + 1);
        const r = reduce(num, den);
        return {
          q: `$${sig(n)}\\frac{1}{${denTex}}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(num, den),
          answerType: r.d === 1 ? 'int' : 'fraction',
          check: `summation(1/((k + ${s})*(k + ${s + 1})), (k, 1, ${n}))`,
          concepts: [
            '$\\frac{1}{AB}=\\frac{1}{B-A}\\left(\\frac1A-\\frac1B\\right)$',
            '늘어놓으면 가운데 항이 서로 지워져요.',
          ],
          steps: [
            {
              title: '부분분수로 나누기',
              body: `두 분모의 차가 $1$ 이라 그대로 나눠져요.\n$$\\frac{1}{${denTex}}=\\frac{1}{${A}}-\\frac{1}{${B}}$$`,
            },
            {
              title: '늘어놓기',
              body: `$$\\left(${first}-\\frac{1}{${s + 2}}\\right)+\\left(\\frac{1}{${s + 2}}-\\frac{1}{${s + 3}}\\right)+\\cdots+\\left(\\frac{1}{${n + s}}-\\frac{1}{${n + s + 1}}\\right)$$`,
            },
            {
              title: '지우고 남은 항',
              body: `가운데가 모두 지워져 처음과 끝만 남아요.\n$$${first}-\\frac{1}{${n + s + 1}}$$`,
            },
            { title: '계산하기', body: `$$=${fracTex(num, den)}$$` },
          ],
          tip: '처음 몇 항과 끝 몇 항을 직접 적어 보면 무엇이 남는지 헷갈리지 않아요.',
        };
      }
      const n = rng.int(4, 12);
      // (1/2)(1 + 1/2 - 1/(n+1) - 1/(n+2)) = (3(n+1)(n+2) - 2(2n+3)) / (4(n+1)(n+2))
      const num = 3 * (n + 1) * (n + 2) - 2 * (2 * n + 3);
      const den = 4 * (n + 1) * (n + 2);
      const r = reduce(num, den);
      return {
        q: `$${sig(n)}\\frac{1}{k(k+2)}$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(num, den),
        answerType: r.d === 1 ? 'int' : 'fraction',
        check: `summation(1/(k*(k + 2)), (k, 1, ${n}))`,
        concepts: [
          '$\\frac{1}{AB}=\\frac{1}{B-A}\\left(\\frac1A-\\frac1B\\right)$',
          '분모의 차가 2이면 한 칸씩 건너 지워져요.',
        ],
        steps: [
          {
            title: '부분분수로 나누기',
            body: '두 분모의 차가 $2$ 라서 앞에 $\\frac12$ 을 곱해요.\n$$\\frac{1}{k(k+2)}=\\frac12\\left(\\frac1k-\\frac{1}{k+2}\\right)$$',
          },
          {
            title: '늘어놓기',
            body: `$$\\frac12\\left\\{\\left(1-\\frac13\\right)+\\left(\\frac12-\\frac14\\right)+\\left(\\frac13-\\frac15\\right)+\\cdots+\\left(\\frac{1}{${n}}-\\frac{1}{${n + 2}}\\right)\\right\\}$$`,
          },
          {
            title: '지우고 남은 항',
            body: `한 칸씩 건너 지워져서 앞의 두 항과 뒤의 두 항이 남아요.\n$$\\frac12\\left(1+\\frac12-\\frac{1}{${n + 1}}-\\frac{1}{${n + 2}}\\right)$$`,
          },
          { title: '계산하기', body: `$$=${fracTex(num, den)}$$` },
        ],
        tip: '$\\frac12$ 을 빠뜨리면 답이 두 배가 돼요. 또 남는 항이 처음과 끝 하나씩이 아니라 두 개씩이에요.',
      };
    },
  },
  {
    id: 'math1-sig-from-sn',
    unitId: UNIT,
    title: '합 $S_n$ 에서 일반항 구하기',
    make(rng) {
      for (;;) {
        const p = rng.int(1, 3);
        const q = rng.int(-5, 5);
        const askFirst = rng.next() < 0.5;
        // a_1 을 함께 묻는 문제는 상수항이 있어야 a_1 이 일반항 식과 달라져 의미가 있다
        const r = askFirst ? rng.nonzero(-5, 5) : rng.int(-3, 3);
        const m = rng.int(3, 10);
        const S = [p, q, r];
        const St = polyTex(S, 'n');
        const Ss = polySym(S, 'n');
        const Sm = p * m * m + q * m + r;
        const Sm1 = p * (m - 1) * (m - 1) + q * (m - 1) + r;
        const am = Sm - Sm1;
        const a1 = p + q + r;
        const ans = askFirst ? a1 + am : am;
        if (ans === 0 || am === 0) continue;
        const head = `수열 $\\{a_n\\}$ 의 첫째항부터 제$n$항까지의 합 $S_n$ 이 $S_n=${St}$ 일 때,`;
        if (!askFirst)
          return {
            q: `${head} $a_{${m}}$ 의 값을 구하세요.`,
            choices: null,
            answer: String(am),
            answerType: 'int',
            check: `(${Ss}).subs(n, ${m}) - (${Ss}).subs(n, ${m - 1})`,
            concepts: [SN],
            steps: [
              {
                title: '합에서 한 항 꺼내기',
                body: `$S_{${m}}$ 에서 바로 앞의 합 $S_{${m - 1}}$ 을 빼면 $a_{${m}}$ 만 남아요.\n$$a_{${m}}=S_{${m}}-S_{${m - 1}}$$`,
              },
              { title: `$S_{${m}}$ 구하기`, body: `$$S_{${m}}=${Sm}$$` },
              { title: `$S_{${m - 1}}$ 구하기`, body: `$$S_{${m - 1}}=${Sm1}$$` },
              { title: '빼기', body: `$$a_{${m}}=${Sm}-${paren(Sm1)}=${am}$$` },
            ],
            tip: `일반항을 먼저 구해도 돼요. $n\\ge2$ 일 때 $a_n=S_n-S_{n-1}=${polyTex([2 * p, q - p], 'n')}$ 이고, $n=${m}$ 을 넣으면 $${am}$ ${ieyo(am)}.`,
          };
        const gen = polyTex([2 * p, q - p], 'n');
        return {
          q: `${head} $a_1+a_{${m}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `(${Ss}).subs(n, 1) + (${Ss}).subs(n, ${m}) - (${Ss}).subs(n, ${m - 1})`,
          concepts: [SN],
          steps: [
            {
              title: '첫째항은 $S_1$',
              body: `앞의 합이 없으니 $a_1=S_1=${a1}$ ${ieyo(a1)}.`,
            },
            {
              title: '$n\\ge2$ 일 때 일반항',
              body: `$$a_n=S_n-S_{n-1}=${gen}$$`,
            },
            {
              title: `$a_{${m}}$ 구하기`,
              body: `$n=${m}$ 을 넣으면 $a_{${m}}=${am}$ ${ieyo(am)}.`,
            },
            { title: '더하기', body: `$$a_1+a_{${m}}=${a1}${signed(am)}=${ans}$$` },
          ],
          tip: `$a_n=${gen}$ 에 $n=1$ 을 넣으면 $${p + q}$ 이지만, 실제 첫째항은 $S_1=${a1}$ ${ieyo(a1)}. $S_n$ 에 상수항이 있으면 첫째항만 따로 구해야 해요.`,
        };
      }
    },
  },
];
