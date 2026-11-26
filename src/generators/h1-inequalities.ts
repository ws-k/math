import type { Step } from '../content/types.ts';
import type { Generator } from './types.ts';
import { fracTex, jo, polySym, polyTex } from './util.ts';

const UNIT = 'h1-inequalities';

// 해가 구간이라 답 칸에 바로 적을 수 없어서 "정수 해의 개수"로 묻는다(m2-linear-ineq 와 같은 이유).
// 검산식은 풀이를 따라 하지 않고 정수를 하나씩 넣어 세는 방식이라, 풀이에서 경계나 방향을
// 잘못 잡으면 검산이 바로 다른 수를 낸다. 답도 TS 에서 같은 방식(정수 넣어 보기)으로 세어
// 풀이 글의 경계 계산과 따로 맞춰 본다.

type Rel = '<' | '>' | '<=' | '>=';
// \le 뒤에 x 가 바로 붙으면 \lex 라는 없는 명령이 되므로 한 칸 띄운다
const TEX: Record<Rel, string> = { '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ' };
const FLIP: Record<Rel, Rel> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
const holds = (l: number, r: Rel, rr: number) =>
  r === '<' ? l < rr : r === '>' ? l > rr : r === '<=' ? l <= rr : l >= rr;

/** 범위 안 정수 중 조건을 만족하는 것 */
const ints = (ok: (t: number) => boolean) => {
  const out: number[] = [];
  for (let t = -100; t <= 100; t++) if (ok(t)) out.push(t);
  return out;
};

/** 정수 목록 글자: 많으면 앞뒤만 */
const listTex = (v: number[]) =>
  v.length <= 6 ? v.join(',\\ ') : `${v[0]},\\ ${v[1]},\\ \\dots,\\ ${v[v.length - 1]}`;

/** (x-a) 글자. a=0 이면 x */
const lin = (a: number) => (a === 0 ? 'x' : `(x${a < 0 ? '+' : '-'}${Math.abs(a)})`);

const countStep = (v: number[]): Step => ({
  title: '정수 세기',
  body: `해에 들어가는 정수는 $${listTex(v)}$, 모두 ${v.length}개예요.`,
});

const QUAD =
  '$a>0$, $\\alpha<\\beta$ 일 때 $(x-\\alpha)(x-\\beta)<0 \\Leftrightarrow \\alpha<x<\\beta$';
const ABS = '$a>0$ 일 때 $|X|<a \\Leftrightarrow -a<X<a$';
const SYS = '연립부등식의 해는 각 부등식의 해의 **공통부분**이에요.';
const NEG = '양변을 **음수**로 나누면 부등호 방향이 바뀌어요.';

export const generators: Generator[] = [
  {
    id: 'qineq-int-count',
    unitId: UNIT,
    title: '이차부등식의 정수 해 개수',
    make(rng) {
      const a = rng.int(-5, 3);
      const b = a + rng.int(2, 6);
      const rel: Rel = rng.pick(['<', '<='] as const);
      const co = [1, -(a + b), a * b];
      const v = ints((t) => holds(t * t - (a + b) * t + a * b, rel, 0));
      const strict = rel === '<';
      return {
        q: `다음 이차부등식을 만족하는 정수 $x$ 의 개수를 구하세요.\n$$${polyTex(co)}${TEX[rel]}0$$`,
        choices: null,
        answer: String(v.length),
        answerType: 'int',
        check: `len([t for t in range(-100, 101) if ${polySym(co, 't')} ${rel} 0])`,
        concepts: [QUAD, '그래프로 보면 $y=(x-\\alpha)(x-\\beta)$ 가 $x$축 **아래**인 구간이에요.'],
        steps: [
          {
            title: '인수분해하기',
            body: `$$${lin(a)}${lin(b)}${TEX[rel]}0$$`,
          },
          {
            title: '경계 찾기',
            body: `좌변을 $0$ 으로 만드는 경계는 $x=${a}$, $x=${b}$ ${jo(b, '이에요/예요')}.`,
          },
          {
            title: '부호 보기',
            body: `$x^2$ 의 계수가 양수라 그래프는 아래로 볼록이고, 두 경계 **사이**에서 $x$축 아래로 내려가요.\n$$${a}${TEX[rel]}x${TEX[rel]}${b}$$`,
          },
          countStep(v),
        ],
        tip: strict
          ? `등호가 없어서 경계 $${a}$, $${b}$ 는 빠져요. 넣어 보면 좌변이 $0$ 이라 $0<0$ 은 거짓이에요.`
          : `등호가 있어서 경계 $${a}$, $${b}$ 도 해예요. 경계를 빼먹으면 개수가 2 작게 나와요.`,
      };
    },
  },
  {
    id: 'abs-ineq-count',
    unitId: UNIT,
    title: '절댓값이 있는 부등식의 정수 해 개수',
    make(rng) {
      for (;;) {
        const k = rng.pick([1, 1, 2] as const);
        const a = rng.int(-4, 6);
        const b = rng.int(2, 6);
        const rel: Rel = rng.pick(['<', '<='] as const);
        const inner = [k, -a];
        const v = ints((t) => holds(Math.abs(k * t - a), rel, b));
        if (v.length < 2) continue;
        const X = polyTex(inner);
        const lo = fracTex(a - b, k);
        const hi = fracTex(a + b, k);
        const steps: Step[] = [
          {
            title: '절댓값 풀기',
            body: `$|X|${TEX[rel]}${b}$ 는 $X$ 가 $0$ 에서 $${b}$ 이내라는 뜻이에요.\n$$-${b}${TEX[rel]}${X}${TEX[rel]}${b}$$`,
          },
          {
            title:
              a === 0 ? '그대로 두기' : a > 0 ? `세 쪽에 $${a}$ 더하기` : `세 쪽에서 $${-a}$ 빼기`,
            body: `$$${a - b}${TEX[rel]}${polyTex([k, 0])}${TEX[rel]}${a + b}$$`,
          },
        ];
        if (k !== 1)
          steps.push({
            title: `세 쪽을 $${k}$${jo(k, '으로/로')} 나누기`,
            body: `양수로 나누니 방향은 그대로예요.\n$$${lo}${TEX[rel]}x${TEX[rel]}${hi}$$`,
          });
        steps.push(countStep(v));
        return {
          q: `다음 부등식을 만족하는 정수 $x$ 의 개수를 구하세요.\n$$|${X}|${TEX[rel]}${b}$$`,
          choices: null,
          answer: String(v.length),
          answerType: 'int',
          check: `len([t for t in range(-100, 101) if Abs(${polySym(inner, 't')}) ${rel} ${b}])`,
          concepts: [ABS, '절댓값은 수직선에서 $0$ 까지의 거리예요.'],
          steps,
          tip: `$|${X}|${TEX[rel]}${b}$ 를 $${X}${TEX[rel]}${b}$ 하나로만 풀면 왼쪽 경계를 놓쳐요. 거리라서 양쪽으로 ${b}만큼이에요.`,
        };
      }
    },
  },
  {
    id: 'sys-linear-count',
    unitId: UNIT,
    title: '연립일차부등식의 정수 해 개수',
    make(rng) {
      const L = rng.int(-5, 3);
      const U = L + rng.int(2, 7);
      const r1: Rel = rng.pick(['>', '>='] as const);
      const r2: Rel = rng.pick(['<', '<='] as const);
      const k1 = rng.int(1, 4);
      const c1 = rng.nonzero(-6, 6);
      const k2 = rng.nonzero(-4, 4);
      const c2 = rng.nonzero(-6, 6);
      // 둘째 식은 계수가 음수면 처음부터 반대 방향으로 적어 둔다 — 나눌 때 뒤집혀 x<U 가 되게
      const q2: Rel = k2 < 0 ? FLIP[r2] : r2;
      const d1 = k1 * L + c1;
      const d2 = k2 * U + c2;
      const v = ints((t) => holds(k1 * t + c1, r1, d1) && holds(k2 * t + c2, q2, d2));
      const e1 = polyTex([k1, c1]);
      const e2 = polyTex([k2, c2]);
      const solve1: Step = {
        title: '첫째 부등식 풀기',
        body: `$$${polyTex([k1, 0])}${TEX[r1]}${d1 - c1}\\quad\\Rightarrow\\quad x${TEX[r1]}${L}$$`,
      };
      const solve2: Step = {
        title: k2 < 0 ? '둘째 부등식 풀기 — 방향 바꾸기' : '둘째 부등식 풀기',
        body: `$$${polyTex([k2, 0])}${TEX[q2]}${d2 - c2}\\quad\\Rightarrow\\quad x${TEX[r2]}${U}$$${k2 < 0 ? `\n$${k2}$${jo(k2, '으로/로')} 나눌 때 부등호를 뒤집었어요.` : ''}`,
      };
      return {
        q: `다음 연립부등식을 만족하는 정수 $x$ 의 개수를 구하세요.\n$$\\begin{cases} ${e1}${TEX[r1]}${d1} \\\\ ${e2}${TEX[q2]}${d2} \\end{cases}$$`,
        choices: null,
        answer: String(v.length),
        answerType: 'int',
        check: `len([t for t in range(-100, 101) if (${polySym([k1, c1], 't')} ${r1} ${d1}) and (${polySym([k2, c2], 't')} ${q2} ${d2})])`,
        concepts: [SYS, ...(k2 < 0 ? [NEG] : [])],
        steps: [
          solve1,
          solve2,
          { title: '공통부분', body: `$$${L}${TEX[FLIP[r1]]}x${TEX[r2]}${U}$$` },
          countStep(v),
        ],
        tip: '두 해를 수직선 위에 함께 그려 보면, 겹치는 곳만 남는다는 게 한눈에 보여요.',
      };
    },
  },
];
