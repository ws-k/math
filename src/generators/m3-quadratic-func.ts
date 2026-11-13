import type { Generator } from './types.ts';
import { polySym, polyTex } from './util.ts';

const UNIT = 'm3-quadratic-func';

// 이차함수는 꼭짓점 (p, q) 로 묻는다. 검산식은 꼭짓점을 "기울기가 0 인 곳"(diff)으로 sympy 가 직접 찾게 해서,
// 생성기가 표준형으로 바꾸는 계산(완전제곱식)과 독립적으로 맞는지 본다.

const A_LIST = [-3, -2, -1, 1, 2, 3] as const;
/** 음수면 괄호 */
const pp = (n: number) => (n < 0 ? `(${n})` : String(n));
/** 계수 a 의 TeX 앞머리: 1 → "", -1 → "-" */
const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : String(a));
/** (x-p)^2 의 TeX: p=0 이면 x^2 */
const sq = (p: number) => (p === 0 ? 'x^2' : `(x${p > 0 ? '-' : '+'}${Math.abs(p)})^2`);
/** 상수항 덧붙이기: 0 이면 빈 글자 */
const tail = (q: number) => (q === 0 ? '' : q > 0 ? `+${q}` : `${q}`);
/** y=a(x-p)^2+q 의 오른쪽 TeX */
export const stdTex = (a: number, p: number, q: number) => `${coef(a)}${sq(p)}${tail(q)}`;
/** 같은 식의 sympy 글자 */
const stdSym = (a: number, p: number, q: number) => `${a}*(x - (${p}))**2 + (${q})`;

const VERTEX = '$y=a(x-p)^2+q$ 의 꼭짓점은 $(p,\\,q)$, 축은 직선 $x=p$ 예요.';
const SHIFT =
  '$y=ax^2$ 을 $x$축 방향으로 $p$, $y$축 방향으로 $q$ 만큼 평행이동하면 $y=a(x-p)^2+q$ 예요.';
const COMPLETE = '$x^2-2px=(x-p)^2-p^2$: $x$의 계수 절반을 제곱해 더하고 빼요.';

/** 꼭짓점을 sympy 로 찾는 검산 앞부분 */
const vtx = (f: string) => `f = ${f}\nv = solve(diff(f, x), x)[0]\n`;

export const generators: Generator[] = [
  {
    id: 'qf-vertex-std',
    unitId: UNIT,
    title: '표준형에서 꼭짓점·축 읽기',
    make(rng) {
      const a = rng.pick(A_LIST);
      const p = rng.int(-6, 6);
      const q = rng.int(-6, 6);
      const kind = rng.pick(['vx', 'vy', 'axis', 'sum'] as const);
      const f = stdSym(a, p, q);
      const ask = {
        vx: { text: '꼭짓점의 $x$ 좌표를', ans: p, check: `${vtx(f)}ans = v` },
        vy: { text: '꼭짓점의 $y$ 좌표를', ans: q, check: `${vtx(f)}ans = f.subs(x, v)` },
        axis: {
          text: '축의 방정식이 $x=k$ 일 때 $k$ 의 값을',
          ans: p,
          check: `${vtx(f)}ans = v`,
        },
        sum: {
          text: '꼭짓점이 $(m,\\,n)$ 일 때 $m+n$ 의 값을',
          ans: p + q,
          check: `${vtx(f)}ans = v + f.subs(x, v)`,
        },
      }[kind];
      return {
        q: `이차함수 $y=${stdTex(a, p, q)}$ 의 그래프에서 ${ask.text} 구하세요.`,
        choices: null,
        answer: String(ask.ans),
        answerType: 'int',
        check: ask.check,
        concepts: [VERTEX],
        steps: [
          {
            title: '$y=a(x-p)^2+q$ 꼴과 맞춰 보기',
            body:
              p < 0
                ? `$x+${-p}=x-(${p})$ 이므로 $p=${p}$, $q=${q}$ 예요.`
                : `$p=${p}$, $q=${q}$ 예요.`,
          },
          {
            title: '꼭짓점 읽기',
            body: `꼭짓점은 $(${p},\\,${q})$, 축은 직선 $x=${p}$ 예요.`,
          },
          ...(kind === 'sum' ? [{ title: '더하기', body: `$$${p}+${pp(q)}=${p + q}$$` }] : []),
        ],
        tip: `괄호 안이 $0$ 이 되는 $x$ 가 꼭짓점의 $x$ 좌표예요. $x+3$ 이면 $-3$ 처럼 부호가 반대로 보여요.`,
      };
    },
  },
  {
    id: 'qf-vertex-general',
    unitId: UNIT,
    title: '일반형을 표준형으로 바꿔 꼭짓점 찾기',
    make(rng) {
      for (;;) {
        const a = rng.pick([1, 1, 2, -1, -2] as const);
        const p = rng.nonzero(-5, 5);
        const q = rng.int(-8, 8);
        const c = a * p * p + q;
        if (Math.abs(c) > 30) continue;
        const coeffs = [a, -2 * a * p, c];
        const f = polySym(coeffs);
        const kind = rng.pick(['vx', 'vy', 'sum'] as const);
        const ask = {
          vx: { text: '꼭짓점의 $x$ 좌표를', ans: p, check: `${vtx(f)}ans = v` },
          vy: { text: '꼭짓점의 $y$ 좌표를', ans: q, check: `${vtx(f)}ans = f.subs(x, v)` },
          sum: {
            text: '꼭짓점이 $(m,\\,n)$ 일 때 $m+n$ 의 값을',
            ans: p + q,
            check: `${vtx(f)}ans = v + f.subs(x, v)`,
          },
        }[kind];
        const inner = polyTex([1, -2 * p, 0]);
        const steps =
          a === 1
            ? [
                {
                  title: '완전제곱식 만들기',
                  body: `$x$의 계수 $${-2 * p}$ 의 절반 $${-p}$ 를 제곱한 $${p * p}$ 을 더하고 빼요.\n$$y=(${polyTex([1, -2 * p, p * p])})-${p * p}${tail(c)}$$`,
                },
                { title: '표준형으로 묶기', body: `$$y=${stdTex(1, p, q)}$$` },
              ]
            : [
                {
                  title: `$x^2$의 계수 $${a}$ 로 묶기`,
                  body: `$$y=${coef(a)}(${inner})${tail(c)}$$`,
                },
                {
                  title: '괄호 안 완전제곱식 만들기',
                  body: `$${inner}=${sq(p)}-${p * p}$ 이에요.\n$$y=${coef(a)}\\{${sq(p)}-${p * p}\\}${tail(c)}$$`,
                },
                {
                  title: '괄호 풀어 정리하기',
                  body: `$${pp(a)}\\times(-${p * p})=${-a * p * p}$ 이에요.\n$$y=${stdTex(a, p, q)}$$`,
                },
              ];
        steps.push({
          title: '꼭짓점 읽기',
          body: `꼭짓점은 $(${p},\\,${q})$ 이므로 구하는 값은 $${ask.ans}$ 예요.`,
        });
        return {
          q: `이차함수 $y=${polyTex(coeffs)}$ 의 그래프에서 ${ask.text} 구하세요.`,
          choices: null,
          answer: String(ask.ans),
          answerType: 'int',
          check: ask.check,
          concepts: [COMPLETE, VERTEX],
          steps,
          tip: `꼭짓점의 $x$ 좌표 $${p}$ 를 처음 식에 넣으면 $y$ 좌표 $${q}$ 가 나와요. 이것으로 검산해요.`,
        };
      }
    },
  },
  {
    id: 'qf-shift',
    unitId: UNIT,
    title: '평행이동한 그래프 위의 점',
    make(rng) {
      for (;;) {
        const a = rng.pick(A_LIST);
        const m = rng.nonzero(-5, 5);
        const n = rng.nonzero(-5, 5);
        const x0 = rng.int(-4, 4);
        if (x0 === m) continue;
        const d = x0 - m;
        const k = a * d * d + n;
        return {
          q: `이차함수 $y=${coef(a)}x^2$ 의 그래프를 $x$축 방향으로 $${m}$ 만큼, $y$축 방향으로 $${n}$ 만큼 평행이동한 그래프가 점 $(${x0},\\,k)$ 를 지나요. $k$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `(${stdSym(a, m, n)}).subs(x, ${x0})`,
          concepts: [SHIFT],
          steps: [
            {
              title: '평행이동한 식 쓰기',
              body: `$x$ 대신 $x-${pp(m)}$, 끝에 $${pp(n)}$ 을 더해요.\n$$y=${stdTex(a, m, n)}$$`,
            },
            {
              title: `$x=${x0}$ 넣기`,
              body: `괄호 안은 $${x0}-${pp(m)}=${d}$ 예요.\n$$k=${pp(a)}\\times${pp(d)}^2${n < 0 ? '' : '+'}${n}$$`,
            },
            { title: '계산하기', body: `$$k=${a * d * d}${n < 0 ? '' : '+'}${n}=${k}$$` },
          ],
          tip: `$x$축 방향으로 $${m}$ 만큼 옮기면 식에는 $x-${pp(m)}$ 로 들어가요. 부호가 바뀌어 보이는 데 주의해요.`,
        };
      }
    },
  },
  {
    id: 'qf-find-a',
    unitId: UNIT,
    title: '꼭짓점과 한 점으로 식 구하기',
    make(rng) {
      const a = rng.pick(A_LIST);
      const p = rng.int(-4, 4);
      const q = rng.int(-6, 6);
      const d = rng.pick([-2, -1, 1, 2] as const);
      const x0 = p + d;
      const y0 = a * d * d + q;
      return {
        q: `꼭짓점이 $(${p},\\,${q})$ 이고 점 $(${x0},\\,${y0})$ 을 지나는 포물선을 $y=a${sq(p)}${tail(q)}$ 로 나타낼 때, 상수 $a$ 의 값을 구하세요.`,
        choices: null,
        answer: String(a),
        answerType: 'int',
        check: `solve(Eq(a*(${x0} - (${p}))**2 + (${q}), ${y0}), a)[0]`,
        concepts: [VERTEX, '그래프가 점을 지나면 그 점의 좌표를 식에 넣었을 때 등식이 성립해요.'],
        steps: [
          {
            title: `점 $(${x0},\\,${y0})$ 대입하기`,
            body: `$$${y0}=a(${x0}-${pp(p)})^2${tail(q)}$$`,
          },
          {
            title: '괄호 계산하기',
            body: `$(${d})^2=${d * d}$ 이므로\n$$${y0}=${d * d === 1 ? '' : d * d}a${tail(q)}$$`,
          },
          {
            title: '$a$ 구하기',
            body:
              d * d === 1
                ? `$$a=${q === 0 ? '' : `${y0}${q > 0 ? '-' : '+'}${Math.abs(q)}=`}${a}$$`
                : `$$${d * d}a=${y0 - q}$$\n$$a=${a}$$`,
          },
        ],
        tip: `$a$가 ${a > 0 ? '양수라 아래로 볼록' : '음수라 위로 볼록'}한 포물선이에요. 지나는 점이 꼭짓점보다 ${a > 0 ? '위' : '아래'}에 있는 것과 맞아요.`,
      };
    },
  },
];
