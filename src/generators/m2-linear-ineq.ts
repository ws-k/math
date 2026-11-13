import type { Step } from '../content/types.ts';
import { j } from './e-fraction-mul.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracTex, polySym, polyTex, reduce } from './util.ts';

const UNIT = 'm2-linear-ineq';

// 부등식의 해는 구간이라 답 칸에 바로 적을 수 없다. 그래서 "가장 큰/작은 정수", "자연수 해의 개수"처럼
// 수 하나로 묻는다. 검산식은 풀이(부등식의 성질)를 따라 하지 않고 정수를 하나씩 넣어 보는 방식이라,
// 풀이에서 부등호 방향을 잘못 뒤집으면 검산이 바로 다른 답을 낸다.

export type Rel = '<' | '>' | '<=' | '>=';
// \le 뒤에 x 가 바로 붙으면 \lex 라는 없는 명령이 되므로 한 칸 띄운다
const TEX: Record<Rel, string> = { '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ' };
const FLIP: Record<Rel, Rel> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

const CONCEPT_ADD = '부등식의 성질: 양변에 같은 수를 더하거나 빼도 부등호 방향은 그대로예요.';
const CONCEPT_POS = '부등식의 성질: 양변에 같은 양수를 곱하거나 나눠도 부등호 방향은 그대로예요.';
const CONCEPT_NEG =
  '부등식의 성질: 양변에 같은 **음수**를 곱하거나 나누면 부등호 방향이 **바뀌어요**.';

/** 숫자 범위 안 정수를 모두 넣어 보는 검산식. what: 가장 큰/작은 정수, 자연수 개수 */
function bruteCheck(lhs: string, rel: Rel, rhs: string, what: 'max' | 'min' | 'count'): string {
  // 한쪽이 숫자뿐이면 파이썬 정수라 .subs 가 없다 — S() 로 sympy 식으로 감싼다
  const cond = `S(${lhs}).subs(x, t) ${rel} S(${rhs}).subs(x, t)`;
  if (what === 'count') return `len([t for t in range(1, 500) if ${cond}])`;
  return `${what === 'max' ? 'Max' : 'Min'}(*[t for t in range(-200, 201) if ${cond}])`;
}

/** x rel n/d 에서 답(가장 큰·작은 정수) */
function edgeInt(rel: Rel, n: number, d: number): number {
  const fl = Math.floor(n / d);
  const exact = n % d === 0;
  if (rel === '<') return exact ? n / d - 1 : fl;
  if (rel === '<=') return fl;
  if (rel === '>') return fl + 1;
  return exact ? n / d : fl + 1;
}

/** 경계값 글자: 분수면 대분수도 함께 보여 정수 위치를 가늠하게 */
function boundTex(n: number, d: number): string {
  const r = reduce(n, d);
  if (r.d === 1) return String(r.n);
  const imp = fracTex(n, d);
  const mixed = fracTex(n, d, { mixed: true });
  return imp === mixed ? imp : `${imp}=${mixed}`;
}

/**
 * Ax+B rel Cx+D 를 부등식의 성질 순서대로 푼다. 끝에는 x rel' 경계 를 돌려준다.
 * 음수로 나누는 단계에서만 부등호를 뒤집는다 — 이 단원에서 학생이 가장 자주 틀리는 자리라 단계 제목에 밝힌다.
 */
function solveSteps(A: number, B: number, rel: Rel, C: number, D: number) {
  const steps: Step[] = [];
  const K = A - C;
  if (K === 0) throw new Error('x 계수가 같음');
  let r = rel;
  if (C !== 0) {
    const cx = polyTex([Math.abs(C), 0]);
    steps.push({
      title: C > 0 ? `양변에서 $${cx}$ 빼기` : `양변에 $${cx}$ 더하기`,
      body: `$x$항을 왼쪽으로 모아요. 더하고 빼는 것은 부등호 방향을 바꾸지 않아요.\n$$${polyTex([K, B])}${TEX[r]}${D}$$`,
    });
  }
  if (B !== 0) {
    steps.push({
      title: B > 0 ? `양변에서 $${B}$ 빼기` : `양변에 $${-B}$ 더하기`,
      body: `상수항을 오른쪽으로 모아요.\n$$${polyTex([K, 0])}${TEX[r]}${D - B}$$`,
    });
  }
  if (K !== 1) {
    const neg = K < 0;
    if (neg) r = FLIP[r];
    steps.push({
      title: neg
        ? `양변을 $${K}$${j(K, '으로로')} 나누기 — 방향 바꾸기`
        : `양변을 $${K}$${j(K, '으로로')} 나누기`,
      body: neg
        ? `음수로 나누면 크기 순서가 뒤집혀요. 그래서 부등호 방향도 반대로 바꿔요.\n$$x${TEX[r]}${boundTex(D - B, K)}$$`
        : `양수로 나누니 방향은 그대로예요.\n$$x${TEX[r]}${boundTex(D - B, K)}$$`,
    });
  }
  const red = reduce(D - B, K);
  return { steps, rel: r, n: red.n, d: red.d, flipped: K < 0 };
}

function pickStep(rel: Rel, n: number, d: number, ans: number): Step {
  const big = rel === '<' || rel === '<=';
  const incl = rel === '<=' || rel === '>=';
  const exact = n % d === 0;
  return {
    title: big ? '가장 큰 정수 고르기' : '가장 작은 정수 고르기',
    body: exact
      ? `경계 $${n / d}$${incl ? '도 해에 들어가요(등호 포함)' : '는 해에 들어가지 않아요(등호 없음)'}. 그래서 $${ans}$${j(ans, '이에요예요')}.`
      : `경계가 정수가 아니라서, 해 안쪽에서 경계에 가장 가까운 정수를 골라요. $${ans}$${j(ans, '이에요예요')}.`,
  };
}

/** 문제 하나 만들기: Ax+B rel Cx+D 꼴(문제 글자 qTex 는 따로 받는다) */
function build(
  qTex: string,
  lhsSym: string,
  rhsSym: string,
  A: number,
  B: number,
  rel: Rel,
  C: number,
  D: number,
  pre: Step[],
  concepts: string[],
): GenProblem {
  const s = solveSteps(A, B, rel, C, D);
  const big = s.rel === '<' || s.rel === '<=';
  const ans = edgeInt(s.rel, s.n, s.d);
  return {
    q: `다음 부등식을 만족하는 ${big ? '가장 큰' : '가장 작은'} 정수 $x$를 구하세요.\n$$${qTex}$$`,
    choices: null,
    answer: String(ans),
    answerType: 'int',
    check: bruteCheck(lhsSym, rel, rhsSym, big ? 'max' : 'min'),
    concepts: [...concepts, ...(s.flipped ? [CONCEPT_NEG] : [])],
    steps: [...pre, ...s.steps, pickStep(s.rel, s.n, s.d, ans)],
    tip: s.flipped
      ? '음수로 나눈 순간 부등호를 뒤집었는지 꼭 확인해요. 답을 처음 부등식에 넣어 보면 바로 알 수 있어요.'
      : `답 $${ans}$${j(ans, '과와')} 그보다 한 칸 바깥 정수를 처음 부등식에 넣어 보면 경계를 맞게 잡았는지 확인할 수 있어요.`,
  };
}

const rel = (rng: Rng): Rel => rng.pick(['<', '>', '<=', '>='] as const);

export const generators: Generator[] = [
  {
    id: 'ineq-basic',
    unitId: UNIT,
    title: 'ax+b<c 꼴 부등식',
    make(rng) {
      let A: number;
      do A = rng.nonzero(-7, 7);
      while (A === 1);
      const B = rng.nonzero(-12, 12);
      const C = rng.int(-20, 20);
      const r = rel(rng);
      return build(
        `${polyTex([A, B])}${TEX[r]}${C}`,
        polySym([A, B]),
        String(C),
        A,
        B,
        r,
        0,
        C,
        [],
        A > 0 ? [CONCEPT_ADD, CONCEPT_POS] : [CONCEPT_ADD],
      );
    },
  },
  {
    id: 'ineq-both-sides',
    unitId: UNIT,
    title: '양변에 x가 있는 부등식',
    make(rng) {
      for (;;) {
        const A = rng.nonzero(-6, 6);
        const C = rng.nonzero(-6, 6);
        if (A === C || A - C === 1) continue;
        const B = rng.nonzero(-12, 12);
        const D = rng.nonzero(-12, 12);
        const r = rel(rng);
        return build(
          `${polyTex([A, B])}${TEX[r]}${polyTex([C, D])}`,
          polySym([A, B]),
          polySym([C, D]),
          A,
          B,
          r,
          C,
          D,
          [],
          A - C > 0 ? [CONCEPT_ADD, CONCEPT_POS] : [CONCEPT_ADD],
        );
      }
    },
  },
  {
    id: 'ineq-paren-frac',
    unitId: UNIT,
    title: '괄호·분수가 있는 부등식',
    make(rng) {
      if (rng.next() < 0.5) {
        // k(x+m) rel n x + p
        for (;;) {
          const k = rng.nonzero(-5, 5);
          const m = rng.nonzero(-6, 6);
          const n = rng.nonzero(-5, 5);
          const p = rng.nonzero(-12, 12);
          if (k === n || k === 1 || k - n === 1) continue;
          const r = rel(rng);
          const inner = polyTex([1, m]);
          const kTex = k === -1 ? '-' : String(k);
          return build(
            `${kTex}(${inner})${TEX[r]}${polyTex([n, p])}`,
            `${k}*(${polySym([1, m])})`,
            polySym([n, p]),
            k,
            k * m,
            r,
            n,
            p,
            [
              {
                title: '괄호 풀기',
                body: `분배법칙으로 괄호 안 두 항에 모두 $${k}$${j(k, '을를')} 곱해요.\n$$${polyTex([k, k * m])}${TEX[r]}${polyTex([n, p])}$$`,
              },
            ],
            ['분배법칙: $k(x+m)=kx+km$', CONCEPT_ADD],
          );
        }
      }
      // ±x/p + q rel s : 양변에 p 를 곱한다
      for (;;) {
        const p = rng.int(2, 6);
        const sg = rng.next() < 0.5 ? -1 : 1;
        const q = rng.nonzero(-6, 6);
        const s = rng.nonzero(-6, 6);
        if (q === s) continue;
        const r = rel(rng);
        const head = `${sg < 0 ? '-' : ''}\\frac{x}{${p}}`;
        const qTex = `${head}${q > 0 ? '+' : '-'}${Math.abs(q)}${TEX[r]}${s}`;
        return build(
          qTex,
          `${sg}*x/${p} + (${q})`,
          String(s),
          sg,
          p * q,
          r,
          0,
          p * s,
          [
            {
              title: `양변에 $${p}$ 곱하기`,
              body: `분모를 없애려고 양변에 양수 $${p}$${j(p, '을를')} 곱해요. 양수라 방향은 그대로이고, 상수항에도 빠짐없이 곱해요.\n$$${polyTex([sg, p * q])}${TEX[r]}${p * s}$$`,
            },
          ],
          [CONCEPT_POS, CONCEPT_ADD],
        );
      }
    },
  },
  {
    id: 'ineq-natural-count',
    unitId: UNIT,
    title: '자연수 해의 개수',
    make(rng) {
      for (;;) {
        const A = rng.nonzero(-6, 6);
        const C = rng.nonzero(-6, 6);
        if (A === C || A - C === 1) continue;
        const B = rng.nonzero(-15, 15);
        const D = rng.nonzero(-15, 15);
        const r = rel(rng);
        const s = solveSteps(A, B, r, C, D);
        // 해가 'x < 경계' 쪽이어야 자연수 해가 끝이 있다. 개수는 1~9 로
        if (!(s.rel === '<' || s.rel === '<=')) continue;
        const top = edgeInt(s.rel, s.n, s.d);
        if (top < 1 || top > 9) continue;
        return {
          q: `다음 부등식을 만족하는 자연수 $x$는 모두 몇 개인지 구하세요.\n$$${polyTex([A, B])}${TEX[r]}${polyTex([C, D])}$$`,
          choices: null,
          answer: String(top),
          answerType: 'int',
          check: bruteCheck(polySym([A, B]), r, polySym([C, D]), 'count'),
          concepts: [CONCEPT_ADD, ...(s.flipped ? [CONCEPT_NEG] : [CONCEPT_POS])],
          steps: [
            ...s.steps,
            {
              title: '자연수 세기',
              body: `자연수는 $1, 2, 3, \\ldots$ 이에요. 이 중 해에 드는 것은 $1$부터 $${top}$까지, 모두 ${top}개예요.`,
            },
          ],
          tip: '경계가 정수일 때 등호가 있는지(포함하는지) 다시 봐요. $<$이면 경계는 빠지고 $\\le$이면 들어가요.',
        };
      }
    },
  },
];
