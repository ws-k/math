import type { Generator } from './types.ts';
import { eun, gwa, ieyo, paren, polyDiff, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-max-min-eq';

// 이 단원의 세 유형(닫힌구간 최대·최소, 실근의 개수, 늘 성립하는 부등식)은 모두
// "극값과 끝값을 구해 그래프 모양을 잡은 뒤 비교한다"는 한 흐름이라 풀이도 그 순서로 쓴다.
// 손계산이 맞게 떨어지도록 삼차함수를 극값의 두 자리(α<β)에서 거꾸로 만든다: f'(x)=3A(x-α)(x-β).
// 검산식은 sympy 의 maximum/minimum·real_roots 처럼 풀이 경로와 다른 길로 계산해, 후보를 빠뜨린
// 풀이가 맞는 답을 내는 일이 없게 한다. 생성기 id 는 모두 'math2-max-min-eq-' 로 시작한다.

/** x-α 를 글로: 0 → "x", 2 → "x-2", -3 → "x+3" */
const lin = (r: number) => (r === 0 ? 'x' : r > 0 ? `x-${r}` : `x+${-r}`);

/** 3A(x-α)(x-β) 를 글로. 한쪽이 0 이면 3x(x-β) 처럼 괄호를 하나 줄인다 */
function factorTex(A: number, al: number, be: number): string {
  const c = 3 * A;
  if (al === 0) return `${c}x(${lin(be)})`;
  if (be === 0) return `${c}x(${lin(al)})`;
  return `${c}(${lin(al)})(${lin(be)})`;
}

/** 극값이 x=α, x=β 에서 생기는 삼차함수의 계수. x^2 계수가 정수가 아니면 null */
function cubic(A: number, al: number, be: number, c: number): number[] | null {
  const b2 = -3 * A * (al + be);
  if (b2 % 2 !== 0) return null;
  return [A, b2 / 2, 3 * A * al * be, c];
}

type Rng = Parameters<Generator['make']>[0];

function pickCubic(
  rng: Rng,
  A: readonly number[],
  c: number,
): { A: number; al: number; be: number; f: number[] } {
  for (;;) {
    const a = rng.pick(A);
    const al = rng.int(-3, 2);
    const be = al + rng.int(1, 4);
    const f = cubic(a, al, be, c);
    if (f) return { A: a, al, be, f };
  }
}

/** 극대·극소 자리(A>0 이면 작은 쪽이 극대) */
const maxMin = (A: number, al: number, be: number) =>
  (A > 0 ? [al, be] : [be, al]) as [number, number];

/** 도함수 단계. 문제 글에 f(x) 라는 이름이 없으면(named) 이름부터 붙인다 — 뒤 단계가 f(1) 처럼 부르므로 */
const DERIV = (f: number[], A: number, al: number, be: number, named = false) =>
  `${named ? `$f(x)=${polyTex(f)}$ 라 하면\n` : ''}$$f'(x)=${polyTex(polyDiff(f))}=${factorTex(A, al, be)}$$`;

const CANDIDATES = '닫힌구간의 최대·최소 후보: 구간 안의 극값과 양 끝값';
const ROOTS = '방정식 $f(x)=k$ 의 서로 다른 실근의 개수 = $y=f(x)$ 와 $y=k$ 의 교점 개수';

export const generators: Generator[] = [
  {
    id: 'math2-max-min-eq-closed',
    unitId: UNIT,
    title: '닫힌구간에서의 최댓값·최솟값',
    make(rng) {
      for (;;) {
        const { A, al, be, f } = pickCubic(rng, [1, -1, 2, -2], rng.int(-5, 5));
        const p = al - rng.int(1, 2);
        const q = rng.int(al + 1, be + 2);
        // 구간 안의 극값 자리(양 끝은 따로 더한다)
        const inside = [al, be].filter((r) => p < r && r < q);
        const xs = [...inside, p, q].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
        const vals = xs.map((v) => polyEval(f, v));
        if (vals.some((v) => Math.abs(v) > 80)) continue;
        const M = Math.max(...vals);
        const m = Math.min(...vals);
        const kind = rng.pick(['max', 'min', 'sum'] as const);
        const ans = kind === 'max' ? M : kind === 'min' ? m : M + m;
        const F = polyTex(f);
        const iv = `[${p},\\,${q}]`;
        const pick = { max: 'Max(*vals)', min: 'Min(*vals)', sum: 'Max(*vals) + Min(*vals)' }[kind];
        const steps = [
          { title: '도함수 구하기', body: DERIV(f, A, al, be) },
          {
            title: '후보 고르기',
            // p<α<q 로 뽑으므로 구간 안 후보는 늘 하나 이상이다. β 가 오른쪽 끝 밖이면 그 사실을 적는다
            body: `구간 안의 극값 후보는 ${inside.map((r) => `$x=${r}$`).join(', ')}. ${
              be > q ? `$x=${be}$ ${eun(be)} 구간 밖이라 빼요. ` : ''
            }여기에 양 끝 $x=${p}$, $x=${q}$ 까지 넣어 비교해요.`,
          },
          {
            title: '후보의 함숫값',
            body: xs.map((v, i) => `$f(${v})=${vals[i]}$`).join(', '),
          },
          {
            title: '비교하기',
            body: `가장 큰 값은 $${M}$, 가장 작은 값은 $${m}$ ${ieyo(m)}.`,
          },
        ];
        if (kind === 'sum')
          steps.push({ title: '더하기', body: `$$M+m=${M}+${paren(m)}=${ans}$$` });
        return {
          q:
            kind === 'sum'
              ? `닫힌구간 $${iv}$ 에서 함수 $f(x)=${F}$ 의 최댓값을 $M$, 최솟값을 $m$ 이라 할 때, $M+m$ 의 값을 구하세요.`
              : `닫힌구간 $${iv}$ 에서 함수 $f(x)=${F}$ 의 ${kind === 'max' ? '최댓값' : '최솟값'}을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: [
            `f = ${polySym(f)}`,
            `cs = [r for r in solve(diff(f, x), x) if ${p} < r < ${q}] + [${p}, ${q}]`,
            'vals = [f.subs(x, r) for r in cs]',
            `ans = ${pick}`,
          ].join('\n'),
          concepts: [CANDIDATES, "$f'(x)=0$ 인 $x$ 가 구간 밖이면 후보에서 빼요."],
          steps,
          tip: '극댓값이 늘 최댓값인 것은 아니에요. 양 끝값까지 넣어 비교해야 해요.',
        };
      }
    },
  },
  {
    id: 'math2-max-min-eq-three-roots',
    unitId: UNIT,
    title: '서로 다른 세 실근을 갖는 정수 k 의 개수',
    make(rng) {
      for (;;) {
        const { A, al, be, f } = pickCubic(rng, [1, -1, 2, -2], 0);
        const [mx, mn] = maxMin(A, al, be);
        const M = polyEval(f, mx);
        const m = polyEval(f, mn);
        const ans = M - m - 1;
        if (ans < 1 || ans > 60) continue;
        const F = polyTex(f);
        return {
          q: `방정식 $${F}=k$ 가 서로 다른 세 실근을 갖도록 하는 정수 $k$ 의 개수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: [
            `f = ${polySym(f)}`,
            'vs = sorted([f.subs(x, r) for r in solve(diff(f, x), x)])',
            'ans = len([j for j in range(int(vs[0]), int(vs[1]) + 1) if vs[0] < j < vs[1]])',
          ].join('\n'),
          concepts: [ROOTS, '가로선이 극솟값과 극댓값 사이에 있으면 세 점에서 만나요.'],
          steps: [
            { title: '도함수 구하기', body: DERIV(f, A, al, be, true) },
            {
              title: '극댓값과 극솟값',
              body: `극댓값은 $f(${mx})=${M}$, 극솟값은 $f(${mn})=${m}$ ${ieyo(m)}.`,
            },
            {
              title: '가로선의 자리',
              body: `$y=f(x)$ 와 가로선 $y=k$ 가 세 점에서 만나려면 가로선이 극솟값과 극댓값 사이에 있어야 해요.\n$$${m}<k<${M}$$`,
            },
            {
              title: '정수 세기',
              body: `$${m + 1}$ 부터 $${M - 1}$ 까지, 모두 ${ans}개예요.`,
            },
          ],
          tip: `$k=${M}$ 이나 $k=${m}$ 이면 가로선이 곡선에 접해서 실근이 두 개뿐이에요. 그래서 양 끝은 빠져요.`,
        };
      }
    },
  },
  {
    id: 'math2-max-min-eq-count-roots',
    unitId: UNIT,
    title: '삼차방정식의 서로 다른 실근의 개수',
    make(rng) {
      for (;;) {
        const { A, al, be, f } = pickCubic(rng, [1, -1, 2, -2], 0);
        const [mx, mn] = maxMin(A, al, be);
        const M = polyEval(f, mx);
        const m = polyEval(f, mn);
        if (M - m < 2 || Math.abs(M) > 60 || Math.abs(m) > 60) continue;
        const where = rng.pick(['above', 'max', 'mid', 'min', 'below'] as const);
        const k = {
          above: M + rng.int(1, 4),
          max: M,
          mid: rng.int(m + 1, M - 1),
          min: m,
          below: m - rng.int(1, 4),
        }[where];
        const ans = where === 'mid' ? 3 : where === 'max' || where === 'min' ? 2 : 1;
        const eq = [...f.slice(0, 3), -k];
        const G = polyTex(f);
        const reason = {
          above: `$${k}$ ${eun(k)} 극댓값 $${M}$ 보다 커서 가로선이 곡선과 한 점에서만 만나요.`,
          max: '가로선이 극댓값의 높이라서 곡선에 접하는 점과 다른 한 점, 두 점에서 만나요.',
          mid: `$${m}<${k}<${M}$ 이라 가로선이 극솟값과 극댓값 사이를 지나 세 점에서 만나요.`,
          min: '가로선이 극솟값의 높이라서 곡선에 접하는 점과 다른 한 점, 두 점에서 만나요.',
          below: `$${k}$ ${eun(k)} 극솟값 $${m}$ 보다 작아서 가로선이 곡선과 한 점에서만 만나요.`,
        }[where];
        return {
          q: `방정식 $${polyTex(eq)}=0$ 의 서로 다른 실근의 개수를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `len(set(real_roots(Poly(${polySym(eq)}, x))))`,
          concepts: [ROOTS, '상수항을 오른쪽으로 넘기면 부호가 바뀌어요.'],
          steps: [
            {
              title: '상수항 넘기기',
              body:
                k === 0
                  ? `상수항이 없으니 그대로 $${G}=0$ 이에요. $y=${G}$ 와 $x$축($y=0$)의 교점을 세요.`
                  : `$${G}=${k}$ 꼴로 바꿔요. 실근의 개수는 $y=${G}$ 와 가로선 $y=${k}$ 의 교점 개수예요.`,
            },
            { title: '도함수 구하기', body: DERIV(f, A, al, be, true) },
            {
              title: '극댓값과 극솟값',
              body: `극댓값은 $f(${mx})=${M}$, 극솟값은 $f(${mn})=${m}$ ${ieyo(m)}.`,
            },
            { title: '교점 세기', body: `${reason} 그래서 실근은 ${ans}개예요.` },
          ],
          tip: '$+k$ 를 넘길 때 부호를 그대로 두면 엉뚱한 가로선과 교점을 세게 돼요. 넘기면 부호가 바뀌어요.',
        };
      }
    },
  },
  {
    id: 'math2-max-min-eq-inequality',
    unitId: UNIT,
    title: '늘 성립하는 부등식의 조건',
    make(rng) {
      for (;;) {
        const A = rng.pick([1, 2]);
        const al = rng.int(-3, 2);
        const be = rng.int(Math.max(al + 1, 1), al + 4);
        const lower = rng.next() < 0.5; // true: f(x)≥k 의 k 최댓값, false: g(x)+k≥0 의 k 최솟값
        const f = cubic(A, al, be, lower ? rng.int(-5, 5) : 0);
        if (!f) continue;
        const f0 = polyEval(f, 0);
        const fb = polyEval(f, be);
        const mn = Math.min(f0, fb);
        if (Math.abs(fb) > 60 || mn === 0) continue;
        const ans = lower ? mn : -mn;
        const F = polyTex(f);
        // 0≤x 에서의 모양: α>0 이면 올라갔다 내려갔다 올라가고, α≤0 이면 β 까지 내려갔다 올라간다
        const shape =
          al > 0
            ? `$x\\ge0$ 에서 $x=${al}$ 까지 증가, $x=${be}$ 까지 감소, 그 뒤로 증가해요.`
            : `$x\\ge0$ 에서 $x=${be}$ 까지 감소하고 그 뒤로 증가해요.`;
        return {
          q: lower
            ? `$x\\ge0$ 인 모든 실수 $x$ 에 대하여 부등식 $${F}\\ge k$ 가 성립하도록 하는 실수 $k$ 의 최댓값을 구하세요.`
            : `$x\\ge0$ 인 모든 실수 $x$ 에 대하여 부등식 $${F}+k\\ge0$ 이 성립하도록 하는 실수 $k$ 의 최솟값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: lower
            ? `minimum(${polySym(f)}, x, Interval(0, oo))`
            : `-minimum(${polySym(f)}, x, Interval(0, oo))`,
          concepts: [
            '$x\\ge0$ 에서 $f(x)\\ge k$ 가 늘 성립 ⇔ $x\\ge0$ 에서 $f(x)$ 의 최솟값 $\\ge k$',
            CANDIDATES,
          ],
          steps: [
            { title: '도함수 구하기', body: DERIV(f, A, al, be, true) },
            { title: '모양 잡기', body: shape },
            {
              title: '최솟값 구하기',
              body: `후보는 $f(0)=${f0}$ ${gwa(f0)} $f(${be})=${fb}$ 이고, 최솟값은 $${mn}$ ${ieyo(mn)}.`,
            },
            {
              title: '조건으로 바꾸기',
              body: lower
                ? `가장 낮은 곳에서도 $k$ 이상이어야 하므로 $k\\le${mn}$, 최댓값은 $${ans}$ ${ieyo(ans)}.`
                : `가장 낮은 곳에서도 $${mn}+k\\ge0$ 이어야 하므로 $k\\ge${ans}$, 최솟값은 $${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: '부등식이 늘 성립한다는 말은 "가장 낮은 곳에서도 성립한다"는 뜻이에요. 그래서 최솟값만 보면 돼요.',
        };
      }
    },
  },
];
