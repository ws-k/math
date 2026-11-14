import type { Generator } from './types.ts';
import { fracTex, paren, polyDiff, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-tangent';

// 접선 문제는 모두 "접점 (a, f(a)) 와 기울기 f'(a)" 두 가지를 먼저 찾는 같은 뼈대라서,
// 유형마다 '무엇이 주어지고 접점을 어떻게 찾는가'만 바꾼다. 답은 y절편처럼 정수 하나로 묻는다
// (접선 식 전체를 답으로 받으면 앱이 자동 채점할 수 없어서).
const MAX = 120;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

/** "+3" / "-3" — 식 뒤에 상수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

// '이에요/예요', '을/를'은 앞 소리의 받침으로 갈리는데 값이 무작위라 끝 글자로 고른다
// (숫자는 일·삼·육·칠·팔·영/십이 받침, 문자는 영어 이름이라 받침 없음).
const hasBatchim = (tex: string | number) => /[013678]$/.test(String(tex));
const ieyo = (tex: string | number) => (hasBatchim(tex) ? '이에요' : '예요');
const eul = (tex: string | number) => (hasBatchim(tex) ? '을' : '를');

const TANGENT = "접선의 방정식: $y=f'(a)(x-a)+f(a)$";

/** 기울기 m, 점 (a, b) 를 지나는 직선 "y=m(x-a)+b" 의 오른쪽. m=1·a=0 등은 군더더기를 뺀다 */
function pointSlope(m: number, a: number, b: number): string {
  const mm = m === 1 ? '' : m === -1 ? '-' : String(m);
  const xa = a === 0 ? 'x' : `(x${signed(-a)})`;
  return `${mm}${xa}${b === 0 ? '' : signed(b)}`;
}

/** y=mx+n 을 글자로 */
const lineTex = (m: number, n: number) => polyTex([m, n]);

export const generators: Generator[] = [
  {
    id: 'm2tan-at-point',
    unitId: UNIT,
    title: '곡선 위의 점에서의 접선',
    make(rng) {
      for (;;) {
        const cubic = rng.next() < 0.6;
        const f = cubic
          ? [rng.pick([1, -1]), rng.int(-3, 3), rng.int(-4, 4), rng.int(-4, 4)]
          : [rng.pick([1, 2, -1]), rng.int(-4, 4), rng.int(-4, 4)];
        const a = rng.nonzero(-2, 2);
        const fa = polyEval(f, a);
        const d = polyDiff(f);
        const m = polyEval(d, a);
        const ans = fa - a * m;
        if (!okAns(ans) || m === 0) continue;
        return {
          q: `곡선 $y=${polyTex(f)}$ 위의 점 $(${a},\\,${fa})$ 에서의 접선의 $y$절편을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${polySym(f)}\nm = diff(f, x).subs(x, ${a})\nans = m*(0 - ${paren(a)}) + f.subs(x, ${a})`,
          concepts: [TANGENT, '$y$절편은 접선의 식에 $x=0$ 을 넣은 값이에요.'],
          steps: [
            {
              title: '도함수 구하기',
              body: `$$y'=${polyTex(d)}$$`,
            },
            {
              title: '접선의 기울기',
              body: `$x=${a}$ ${eul(a)} 넣으면 기울기는 $${m}$ ${ieyo(m)}.`,
            },
            {
              title: '접선의 방정식',
              body: `$$y=${pointSlope(m, a, fa)}=${lineTex(m, ans)}$$`,
            },
            {
              title: '$y$절편',
              body: `$x=0$ 을 넣으면 $y=${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: `$y$절편은 $f(a)-af'(a)$ 로 바로 구할 수도 있어요. $${fa}-${paren(a)}\\cdot ${paren(m)}=${ans}$ ${ieyo(ans)}.`,
        };
      }
    },
  },
  {
    id: 'm2tan-given-slope',
    unitId: UNIT,
    title: '기울기가 주어진 접선',
    make(rng) {
      for (;;) {
        const p = rng.pick([1, 1, 2, -1]);
        const b = rng.int(-5, 5);
        const c = rng.int(-5, 5);
        const t = rng.nonzero(-3, 3);
        const f = [p, b, c];
        const m = 2 * p * t + b;
        const ft = polyEval(f, t);
        const ans = ft - t * m;
        if (!okAns(ans) || m === 0) continue;
        return {
          q: `곡선 $y=${polyTex(f)}$ 에 접하고 기울기가 $${m}$ 인 직선의 $y$절편을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${polySym(f)}\nt0 = solve(Eq(diff(f, x), ${m}), x)[0]\nans = ${m}*(0 - t0) + f.subs(x, t0)`,
          concepts: [TANGENT, "기울기 $m$ 이 주어지면 $f'(a)=m$ 을 풀어 접점부터 찾아요."],
          steps: [
            {
              title: '도함수 구하기',
              body: `$$y'=${polyTex(polyDiff(f))}$$`,
            },
            {
              title: '접점의 $x$좌표',
              body: `$${polyTex(polyDiff(f))}=${m}$ ${eul(m)} 풀면 $x=${t}$ ${ieyo(t)}.`,
            },
            {
              title: '접점의 $y$좌표',
              body: `$x=${t}$ ${eul(t)} 곡선의 식에 넣으면 $y=${ft}$ ${ieyo(ft)}.`,
            },
            {
              title: '접선의 방정식',
              body: `$$y=${pointSlope(m, t, ft)}=${lineTex(m, ans)}$$`,
            },
          ],
          tip: `기울기 $${m}$ ${eul(m)} 곡선의 식에 넣는 실수가 많아요. 기울기는 함숫값이 아니라 도함수의 값이에요. 답은 $y$절편 $${ans}$ ${ieyo(ans)}.`,
        };
      }
    },
  },
  {
    id: 'm2tan-outside',
    unitId: UNIT,
    title: '곡선 밖의 점에서 그은 접선',
    make(rng) {
      for (;;) {
        const b = rng.int(-4, 4);
        const c = rng.int(-4, 4);
        const s = rng.int(1, 3);
        const k = c - s * s;
        const f = [1, b, c];
        const m1 = 2 * s + b;
        const m2 = -2 * s + b;
        const ans = m1 * m2;
        if (!okAns(ans)) continue;
        const F = polyTex(f);
        const ft = polyTex([1, b, c], 't');
        const fdt = polyTex([2, b], 't');
        return {
          q: `점 $(0,\\,${k})$ 에서 곡선 $y=${F}$ 에 그은 두 접선의 기울기의 곱을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${polySym(f)}\nts = solve(Eq(diff(f, x).subs(x, t)*(0 - t) + f.subs(x, t), ${k}), t)\nans = diff(f, x).subs(x, ts[0])*diff(f, x).subs(x, ts[1])`,
          concepts: [
            TANGENT,
            '곡선 밖의 점에서는 접점을 $(t,\\,f(t))$ 로 두고, 접선이 그 점을 지난다는 식을 세워요.',
          ],
          steps: [
            {
              title: '접점을 문자로 두기',
              body: `접점을 $(t,\\,${ft})$ 로 두면 기울기는 $${fdt}$ 이고, 접선은\n$$y=(${fdt})(x-t)+${ft}$$`,
            },
            {
              title: `점 $(0,\\,${k})$ ${eul(k)} 지난다`,
              body: `$x=0$, $y=${k}$ ${eul(k)} 넣으면 $${k}=-(${fdt})t+${ft}$ 이고, 정리하면 $${k}=${c === 0 ? '-t^2' : `-t^2${signed(c)}`}$ ${c === 0 ? '이에요' : ieyo(c)}.`,
            },
            {
              title: '접점 구하기',
              body: `$t^2=${s * s}$ 이므로 $t=${s}$ 또는 $t=-${s}$ ${ieyo(s)}.`,
            },
            {
              title: '두 기울기',
              body: `$t=${s}$ 이면 $${m1}$, $t=-${s}$ 이면 $${m2}$ ${ieyo(m2)}.`,
            },
            {
              title: '곱하기',
              body: `$$${paren(m1)}\\cdot ${paren(m2)}=${ans}$$`,
            },
          ],
          tip: `주어진 점은 곡선 위의 점이 아니라서 그 점에서의 미분계수를 기울기로 쓰면 안 돼요. 접점은 늘 곡선 위에 따로 있어요.`,
        };
      }
    },
  },
  {
    id: 'm2tan-mvt',
    unitId: UNIT,
    title: '평균값 정리를 만족시키는 값',
    make(rng) {
      for (;;) {
        const b = rng.int(2, 5);
        const c = rng.int(1, b - 1);
        if (b === 2 * c) continue;
        // 3c²+2pc = b²+pb 를 p 에 대해 풀어, c 가 평균값 정리의 답이 되도록 이차항 계수를 정한다
        const num = 3 * c * c - b * b;
        const den = b - 2 * c;
        if (num % den !== 0) continue;
        const p = num / den;
        if (Math.abs(p) > 9) continue;
        const q = rng.int(-4, 4);
        const f = [1, p, q, 0];
        // f'(x)=slope 의 다른 근 c' = -(b²+pb)/(3c). 구간 안에 답이 둘이면 문제가 모호해진다
        const other = -(b * b + p * b) / (3 * c);
        // 중근이면 풀이의 "근 두 개" 설명이 맞지 않으므로 함께 피한다
        if ((other > 0 && other < b) || other === c) continue;
        const fb = polyEval(f, b);
        const slope = fb / b;
        const d = polyDiff(f);
        const ans = c;
        return {
          q: `함수 $f(x)=${polyTex(f)}$ 에 대하여 닫힌구간 $[0,\\,${b}]$ 에서 평균값 정리를 만족시키는 상수 $c$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${polySym(f)}\nsl = (f.subs(x, ${b}) - f.subs(x, 0))/${b}\nans = [r for r in solve(Eq(diff(f, x), sl), x) if r.is_real and 0 < r < ${b}][0]`,
          concepts: [
            "평균값 정리: $\\frac{f(b)-f(a)}{b-a}=f'(c)$ 인 $c$ 가 $a<c<b$ 에 있어요.",
            '두 점을 잇는 직선과 나란한 접선의 접점이 $c$ 예요.',
          ],
          steps: [
            {
              title: '평균 기울기',
              body: `$f(${b})=${fb}$, $f(0)=0$ 이므로 $\\frac{${fb}-0}{${b}-0}=${slope}$ ${ieyo(slope)}.`,
            },
            {
              title: '도함수',
              body: `$$f'(x)=${polyTex(d)}$$`,
            },
            {
              title: '방정식 세우기',
              body: `$$${polyTex(d)}=${slope}$$`,
            },
            {
              title: '풀기',
              body: `정리하면 $${polyTex([3, 2 * p, q - slope])}=0$ 이고, 근은 $x=${c}$, $x=${fracTex(-(b * b + p * b), 3 * c)}$ 두 개예요.`,
            },
            {
              title: '구간 안의 값 고르기',
              body: `$0<c<${b}$ 인 것은 $c=${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: `곡선 위의 두 점 $(0,\\,0)$, $(${b},\\,${fb})$ ${eul(fb)} 잇는 직선과 나란한 접선이 $x=${ans}$ 에서 생긴다는 뜻이에요.`,
        };
      }
    },
  },
];
