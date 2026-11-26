import type { Generator } from './types.ts';
import { eul, ieyo, paren, polyDiff, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-extrema';

// 극값은 "f'(x)=0 인 x 를 찾고 → 그 좌우에서 부호가 바뀌는지 본다"가 뿌리라, 풀이는 늘
// 도함수 → 인수분해 → 부호 바뀜 → 값 계산 순서로 쓴다. 숫자가 손계산에 맞게 나오도록 삼차함수를
// 계수가 아니라 극값을 갖는 두 자리(α<β)에서 거꾸로 만든다: f'(x)=3A(x-α)(x-β).
// 검산식은 "극대 = f'' < 0 인 임계점"처럼 극대·극소의 정의에서 직접 고르게 해서, 풀이가 부호를 뒤집어
// 적어도 잡히게 한다. 생성기 id 는 다른 단원과 겹치지 않도록 모두 'math2-extrema-' 로 시작한다.

/** x-α 를 글로: 0 → "x", 2 → "x-2", -3 → "x+3" */
const lin = (r: number) => (r === 0 ? 'x' : r > 0 ? `x-${r}` : `x+${-r}`);

/** (x-α)(x-β) 를 글로. 한쪽이 0 이면 x(x-β) 처럼 괄호를 하나 줄인다 */
function pairTex(al: number, be: number): string {
  if (al === 0) return `x(${lin(be)})`;
  if (be === 0) return `x(${lin(al)})`;
  return `(${lin(al)})(${lin(be)})`;
}

/** 3A(x-α)(x-β) 를 글로 */
const factorTex = (A: number, al: number, be: number) => `${3 * A}${pairTex(al, be)}`;

/**
 * 극값이 x=α, x=β 에서 생기는 삼차함수 f(x)=Ax^3-(3A/2)(α+β)x^2+3Aαβx+c 의 계수.
 * x^2 계수가 정수가 아니면(A 가 홀수이고 α+β 가 홀수) null — 다시 뽑게 한다.
 */
function cubic(A: number, al: number, be: number, c: number): number[] | null {
  const b2 = -3 * A * (al + be);
  if (b2 % 2 !== 0) return null;
  return [A, b2 / 2, 3 * A * al * be, c];
}

/** f(k) 를 항별 값으로 풀어 쓴 글: "8-12+1=-3". 0 인 항은 뺀다 */
function subTex(f: number[], k: number): string {
  const deg = f.length - 1;
  const vals = f.map((c, i) => c * k ** (deg - i)).filter((v) => v !== 0);
  const ans = polyEval(f, k);
  const expr = vals.length
    ? vals.map((v, i) => (i === 0 || v < 0 ? String(v) : `+${v}`)).join('')
    : '0';
  return expr === String(ans) ? expr : `${expr}=${ans}`;
}

/** f'(x)=3A(x-α)(x-β) 의 부호 흐름과 극대·극소 자리 */
function signText(A: number, al: number, be: number): string {
  const [out, mid] = A > 0 ? ['+', '-'] : ['-', '+'];
  const [mx, mn] = A > 0 ? [al, be] : [be, al];
  return `$x<${al}$ 에서 $${out}$, $${al}<x<${be}$ 에서 $${mid}$, $x>${be}$ 에서 $${out}$ 예요. 그래서 $x=${mx}$ 에서 극대, $x=${mn}$ 에서 극소예요.`;
}

const SIGN = "$f'(x)$ 의 부호가 $+$ 에서 $-$ 로 바뀌면 극대, $-$ 에서 $+$ 로 바뀌면 극소";
const POWER = "$(x^n)'=nx^{n-1}$";
const LEAD_TIP =
  '최고차항의 계수가 양수인 삼차함수는 작은 쪽 근에서 극대, 큰 쪽 근에서 극소예요. 계수가 음수이면 반대예요.';

/** 극값을 갖는 두 자리와 삼차함수를 뽑는다(정수 계수가 될 때까지) */
function pickCubic(
  rng: Parameters<Generator['make']>[0],
  gap: [number, number],
): { A: number; al: number; be: number; f: number[] } {
  for (;;) {
    const A = rng.pick([1, -1, 2, -2]);
    const al = rng.int(-3, 2);
    const be = al + rng.int(gap[0], gap[1]);
    const f = cubic(A, al, be, rng.int(-5, 5));
    if (f) return { A, al, be, f };
  }
}

export const generators: Generator[] = [
  {
    id: 'math2-extrema-value',
    unitId: UNIT,
    title: '삼차함수의 극댓값·극솟값',
    make(rng) {
      for (;;) {
        const { A, al, be, f } = pickCubic(rng, [1, 4]);
        const wantMax = rng.next() < 0.5;
        // A>0 이면 작은 쪽(α)에서 극대, A<0 이면 큰 쪽(β)에서 극대
        const at = A > 0 === wantMax ? al : be;
        const ans = polyEval(f, at);
        if (Math.abs(ans) > 60) continue;
        const what = wantMax ? '극댓값' : '극솟값';
        const d = polyDiff(f);
        return {
          q: `함수 $f(x)=${polyTex(f)}$ 의 ${what}을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: [
            `f = ${polySym(f)}`,
            'd = diff(f, x)',
            `ans = [f.subs(x, r) for r in solve(d, x) if diff(d, x).subs(x, r) ${wantMax ? '<' : '>'} 0][0]`,
          ].join('\n'),
          concepts: [SIGN, POWER],
          steps: [
            {
              title: '도함수 구하기',
              body: `$$f'(x)=${polyTex(d)}=${factorTex(A, al, be)}$$`,
            },
            {
              title: "$f'(x)=0$ 인 $x$",
              body: `$f'(x)=0$ 에서 $x=${al}$ 또는 $x=${be}$ ${ieyo(be)}.`,
            },
            { title: '부호가 바뀌는지 보기', body: signText(A, al, be) },
            {
              title: `${what} 계산하기`,
              body: `$$f(${at})=${subTex(f, at)}$$`,
            },
          ],
          tip: LEAD_TIP,
        };
      }
    },
  },
  {
    id: 'math2-extrema-diff',
    unitId: UNIT,
    title: '극댓값과 극솟값의 차',
    make(rng) {
      for (;;) {
        const { A, al, be, f } = pickCubic(rng, [1, 4]);
        const [mx, mn] = A > 0 ? [al, be] : [be, al];
        const M = polyEval(f, mx);
        const m = polyEval(f, mn);
        const ans = M - m;
        if (Math.abs(M) > 60 || Math.abs(m) > 60 || ans > 80) continue;
        const d = polyDiff(f);
        return {
          q: `함수 $f(x)=${polyTex(f)}$ 의 극댓값을 $M$, 극솟값을 $m$ 이라 할 때, $M-m$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: [
            `f = ${polySym(f)}`,
            'd = diff(f, x)',
            'rs = solve(d, x)',
            'M = [f.subs(x, r) for r in rs if diff(d, x).subs(x, r) < 0][0]',
            'm = [f.subs(x, r) for r in rs if diff(d, x).subs(x, r) > 0][0]',
            'ans = M - m',
          ].join('\n'),
          concepts: [SIGN, POWER],
          steps: [
            {
              title: '도함수 구하기',
              body: `$$f'(x)=${polyTex(d)}=${factorTex(A, al, be)}$$`,
            },
            { title: '부호가 바뀌는지 보기', body: signText(A, al, be) },
            {
              title: '극댓값과 극솟값',
              body: `$$M=f(${mx})=${subTex(f, mx)}$$\n$$m=f(${mn})=${subTex(f, mn)}$$`,
            },
            { title: '빼기', body: `$$M-m=${M}-${paren(m)}=${ans}$$` },
          ],
          tip: '상수항은 극댓값과 극솟값에 똑같이 더해지므로 차에는 영향이 없어요. 삼차함수에서는 극댓값이 극솟값보다 커서 차가 양수로 나와요.',
        };
      }
    },
  },
  {
    id: 'math2-extrema-monotone-count',
    unitId: UNIT,
    title: '감소(증가)하는 구간의 정수 개수',
    make(rng) {
      for (;;) {
        const { A, al, be, f } = pickCubic(rng, [2, 6]);
        // 가운데 구간 [α, β] 는 A>0 이면 감소, A<0 이면 증가하는 구간이다(양 끝을 포함한다)
        const dec = A > 0;
        const ans = be - al + 1;
        const d = polyDiff(f);
        const ints = Array.from({ length: ans }, (_, i) => al + i).join(', ');
        const ineq = dec ? '\\le' : '\\ge';
        return {
          q: `함수 $f(x)=${polyTex(f)}$ 가 ${dec ? '감소' : '증가'}하는 구간에 속하는 정수 $x$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: [
            `f = ${polySym(f)}`,
            'd = diff(f, x)',
            `ans = len([j for j in range(-30, 31) if d.subs(x, j) ${dec ? '<=' : '>='} 0])`,
          ].join('\n'),
          concepts: ["$f'(x)\\ge0$ 인 구간에서 증가, $f'(x)\\le0$ 인 구간에서 감소", POWER],
          steps: [
            {
              title: '도함수 구하기',
              body: `$$f'(x)=${polyTex(d)}=${factorTex(A, al, be)}$$`,
            },
            {
              title: `$f'(x)${ineq}0$ 풀기`,
              body: dec
                ? `$${3 * A}$ 은 양수라서 $${pairTex(al, be)}\\le0$, 곧 $${al}\\le x\\le ${be}$ ${ieyo(be)}.`
                : `$${3 * A}$ 이 음수라서 부등호가 뒤집혀 $${pairTex(al, be)}\\le0$, 곧 $${al}\\le x\\le ${be}$ ${ieyo(be)}.`,
            },
            {
              title: '정수 세기',
              body: `$${ints}$, 모두 ${ans}개예요.`,
            },
          ],
          tip: `${dec ? '감소' : '증가'}하는 구간은 양 끝 $x=${al}$, $x=${be}$ ${eul(be)} 포함해요. 끝에서 $f'(x)=0$ 이어도 그 구간에서 계속 ${dec ? '감소' : '증가'}하기 때문이에요.`,
        };
      }
    },
  },
  {
    id: 'math2-extrema-condition',
    unitId: UNIT,
    title: '극값을 가질(갖지 않을) 조건',
    make(rng) {
      for (;;) {
        const m = rng.nonzero(-3, 3);
        const b = 3 * m;
        const c0 = rng.int(-5, 5);
        const has = rng.next() < 0.5;
        const ans = has ? 3 * m * m - 1 : 3 * m * m;
        const F = `x^3${b > 0 ? '+' : ''}${b}x^2+kx${c0 === 0 ? '' : c0 > 0 ? `+${c0}` : c0}`;
        const fsym = `x**3 + (${b})*x**2 + k*x + (${c0})`;
        const D4 = `${paren(b)}^2-3k`;
        return {
          q: has
            ? `삼차함수 $f(x)=${F}$ 가 극값을 갖도록 하는 정수 $k$ 의 최댓값을 구하세요.`
            : `삼차함수 $f(x)=${F}$ 가 극값을 갖지 않도록 하는 실수 $k$ 의 최솟값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: has
            ? [
                `D = discriminant(diff(${fsym}, x), x)`,
                'ans = max([j for j in range(-200, 200) if D.subs(k, j) > 0])',
              ].join('\n')
            : `solve(discriminant(diff(${fsym}, x), x), k)[0]`,
          concepts: [
            "삼차함수가 극값을 가질 조건: $f'(x)=0$ 이 서로 다른 두 실근을 가짐($D>0$)",
            "극값을 갖지 않을 조건: $f'(x)$ 의 부호가 바뀌지 않음($D\\le0$)",
          ],
          steps: [
            { title: '도함수 구하기', body: `$$f'(x)=3x^2+${2 * b}x+k$$`.replace('+-', '-') },
            {
              title: '조건 세우기',
              body: has
                ? "극값을 가지려면 $f'(x)$ 의 부호가 바뀌어야 해요. 이차방정식 $f'(x)=0$ 이 서로 다른 두 실근을 가져야 하므로 판별식이 $D>0$ 이에요."
                : "극값이 없으려면 $f'(x)$ 의 부호가 바뀌지 않아야 해요. 이차방정식 $f'(x)=0$ 의 판별식이 $D\\le0$ 이에요.",
            },
            {
              title: '판별식 계산하기',
              body: `$$\\frac{D}{4}=${D4}=${b * b}-3k$$`,
            },
            {
              title: '부등식 풀기',
              body: has
                ? `$${b * b}-3k>0$ 에서 $k<${3 * m * m}$ 이므로 정수 $k$ 의 최댓값은 $${ans}$ ${ieyo(ans)}.`
                : `$${b * b}-3k\\le0$ 에서 $k\\ge${ans}$ 이므로 최솟값은 $${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: has
            ? `$k=${3 * m * m}$ 이면 $D=0$ 이라 $f'(x)\\ge0$ 이 되어 극값이 없어요. 그래서 등호는 빠져요.`
            : `$D=0$ 일 때도 $f'(x)$ 가 한 점에서만 0 이고 부호는 그대로라 극값이 없어요. 그래서 등호가 들어가요.`,
        };
      }
    },
  },
];
