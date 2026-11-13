import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, paren } from './util.ts';

const UNIT = 'm1-coord-graph';

const CONCEPT_QUAD =
  '사분면: 제1사분면 $(+,+)$, 제2사분면 $(-,+)$, 제3사분면 $(-,-)$, 제4사분면 $(+,-)$. 축 위의 점은 어느 사분면에도 속하지 않아요.';
const CONCEPT_DIRECT =
  '정비례 $y=ax$: 그래프 위의 점 $(x, y)$ 를 넣으면 식이 맞아요. $a=\\frac{y}{x}$';
const CONCEPT_INVERSE = '반비례 $y=\\frac{a}{x}$: 그래프 위의 점에서 $x\\times y$ 는 늘 $a$ 예요.';

function signed(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
}

/** 사분면 번호 → (x 부호, y 부호) */
const SIGNS: Record<number, [number, number]> = { 1: [1, 1], 2: [-1, 1], 3: [-1, -1], 4: [1, -1] };
const quadOf = (sx: number, sy: number) => (sx > 0 ? (sy > 0 ? 1 : 4) : sy > 0 ? 2 : 3);
const signWord = (s: number) => (s > 0 ? '양수' : '음수');

/**
 * P(a, b) 에서 만드는 새 점의 좌표. tex 는 화면 글자, sym 은 검산 코드(a0, b0 에 대표값을 넣어 계산),
 * f 는 a·b 의 부호에서 두 좌표의 부호를 정한다. 셋을 한 자리에 두어 글과 검산이 어긋나지 않게 한다.
 */
interface Move {
  tex: [string, string];
  sym: [string, string];
  f: (sa: number, sb: number) => [number, number];
}
const MOVES: Move[] = [
  { tex: ['b', 'a'], sym: ['b0', 'a0'], f: (sa, sb) => [sb, sa] },
  { tex: ['-a', 'b'], sym: ['-a0', 'b0'], f: (sa, sb) => [-sa, sb] },
  { tex: ['a', '-b'], sym: ['a0', '-b0'], f: (sa, sb) => [sa, -sb] },
  { tex: ['-a', '-b'], sym: ['-a0', '-b0'], f: (sa, sb) => [-sa, -sb] },
  { tex: ['b', '-a'], sym: ['b0', '-a0'], f: (sa, sb) => [sb, -sa] },
  { tex: ['ab', 'b'], sym: ['a0*b0', 'b0'], f: (sa, sb) => [sa * sb, sb] },
  { tex: ['a-b', 'ab'], sym: ['a0-b0', 'a0*b0'], f: (sa, sb) => [sa > sb ? 1 : -1, sa * sb] },
];

export const generators: Generator[] = [
  {
    id: 'coord-quadrant',
    unitId: UNIT,
    title: '사분면 판단하기',
    make(rng) {
      const qa = rng.int(1, 4);
      let mv: Move;
      // a-b 의 부호는 a, b 의 부호가 다를 때만 정해진다
      do mv = rng.pick(MOVES);
      while (mv.tex[0] === 'a-b' && (qa === 1 || qa === 3));
      const [sa, sb] = SIGNS[qa] as [number, number];
      const [sx, sy] = mv.f(sa, sb);
      const ans = quadOf(sx, sy);
      const qtex = `Q(${mv.tex[0]},\\,${mv.tex[1]})`;
      return {
        q: `점 $P(a,\\,b)$가 제${qa}사분면 위의 점일 때, 점 $${qtex}$는 제몇사분면 위의 점인지 구하세요. (숫자만 답해요)`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        // 대표값(크기 2, 3)으로 부호를 정해 계산한다. 사분면은 부호만으로 정해지므로 크기는 상관없다
        check: [
          `a0, b0 = ${sa * 2}, ${sb * 3}`,
          `X, Y = ${mv.sym[0]}, ${mv.sym[1]}`,
          'ans = 1 if (X > 0 and Y > 0) else (2 if (X < 0 and Y > 0) else (3 if (X < 0 and Y < 0) else 4))',
        ].join('\n'),
        concepts: [CONCEPT_QUAD],
        steps: [
          {
            title: '$a$, $b$의 부호 정하기',
            body: `제${qa}사분면의 점은 $x$좌표가 ${signWord(sa)}, $y$좌표가 ${signWord(sb)}예요. 그래서 $a${sa > 0 ? '>' : '<'}0$, $b${sb > 0 ? '>' : '<'}0$ 이에요.`,
          },
          {
            title: '$Q$ 좌표의 부호 따지기',
            body: `$x$좌표 $${mv.tex[0]}$ 는 ${signWord(sx)}, $y$좌표 $${mv.tex[1]}$ 는 ${signWord(sy)}예요.`,
          },
          {
            title: '사분면 정하기',
            body: `$(${sx > 0 ? '+' : '-'},\\,${sy > 0 ? '+' : '-'})$ 이므로 제${ans}사분면이에요.`,
          },
        ],
        tip: '헷갈리면 $a$, $b$ 대신 부호가 맞는 수를 넣어 보세요. 제2사분면이면 $a=-1$, $b=1$ 처럼요.',
      };
    },
  },
  {
    id: 'coord-direct',
    unitId: UNIT,
    title: '정비례 그래프 위의 점',
    make(rng) {
      const d = rng.pick([1, 1, 2, 3]);
      let n: number;
      do n = signed(rng, 1, 6);
      while (d > 1 && n % d === 0);
      const p = d * signed(rng, 1, 3);
      const q = (n * p) / d;
      let r: number;
      do r = signed(rng, 1, 8);
      while (r === p);
      return {
        q: `정비례 관계 $y=ax$의 그래프가 점 $(${p},\\,${q})$을 지나요. $x=${r}$일 때 $y$의 값을 구하세요.`,
        choices: null,
        answer: fracAns(n * r, d),
        answerType: (n * r) % d === 0 ? 'int' : 'fraction',
        check: `solve(Eq(a*(${p}), ${q}), a)[0]*(${r})`,
        concepts: [CONCEPT_DIRECT],
        steps: [
          {
            title: '점을 식에 넣어 $a$ 구하기',
            body: `그래프 위의 점은 식을 맞게 만들어요. $x=${p}$, $y=${q}$ 를 넣어요.\n$$${q}=a\\times ${paren(p)}$$\n$$a=${fracTex(n, d)}$$`,
          },
          {
            title: `$x=${r}$ 넣기`,
            body: `$$y=${fracTex(n, d)}\\times ${paren(r)}=${fracTex(n * r, d)}$$`,
          },
        ],
        tip: '정비례에서는 $x$가 2배, 3배가 되면 $y$도 2배, 3배가 돼요. 답의 크기가 이 규칙에 맞는지 확인해요.',
      };
    },
  },
  {
    id: 'coord-inverse',
    unitId: UNIT,
    title: '반비례 그래프 위의 점',
    make(rng) {
      let p: number;
      let q: number;
      do {
        p = signed(rng, 1, 6);
        q = signed(rng, 1, 6);
      } while (Math.abs(p * q) < 4);
      const a = p * q;
      let r: number;
      do r = signed(rng, 1, 9);
      while (r === p);
      return {
        q: `반비례 관계 $y=\\frac{a}{x}$의 그래프가 점 $(${p},\\,${q})$을 지나요. $x=${r}$일 때 $y$의 값을 구하세요.`,
        choices: null,
        answer: fracAns(a, r),
        answerType: a % r === 0 ? 'int' : 'fraction',
        check: `solve(Eq(a/(${p}), ${q}), a)[0]/(${r})`,
        concepts: [CONCEPT_INVERSE],
        steps: [
          {
            title: '$a$ 구하기',
            body: `반비례 그래프 위의 점에서는 $x\\times y=a$ 예요.\n$$a=${paren(p)}\\times ${paren(q)}=${a}$$`,
          },
          {
            title: `$x=${r}$ 넣기`,
            body: `$$y=\\frac{${a}}{${r}}=${fracTex(a, r)}$$`,
          },
        ],
        tip: '반비례에서는 $x$가 커지면 $y$가 작아져요(같은 사분면 안에서). 답이 이 방향으로 바뀌었는지 확인해요.',
      };
    },
  },
  {
    id: 'coord-triangle-area',
    unitId: UNIT,
    title: '좌표로 삼각형 넓이 구하기',
    make(rng) {
      let x1: number;
      let x2: number;
      let x3: number;
      let y1: number;
      let y3: number;
      do {
        x1 = rng.int(-6, 6);
        x2 = rng.int(-6, 6);
        x3 = rng.int(-6, 6);
        y1 = rng.int(-6, 6);
        y3 = rng.int(-6, 6);
      } while (x1 === x2 || y1 === y3 || Math.abs(x2 - x1) < 2 || Math.abs(y3 - y1) < 2);
      const base = Math.abs(x2 - x1);
      const h = Math.abs(y3 - y1);
      return {
        q: `세 점 $A(${x1},\\,${y1})$, $B(${x2},\\,${y1})$, $C(${x3},\\,${y3})$을 꼭짓점으로 하는 삼각형 $ABC$의 넓이를 구하세요.`,
        choices: null,
        answer: fracAns(base * h, 2),
        answerType: (base * h) % 2 === 0 ? 'int' : 'fraction',
        check: `Abs((${x2})-(${x1}))*Abs((${y3})-(${y1}))/2`,
        concepts: ['삼각형의 넓이 $=\\frac{1}{2}\\times(\\text{밑변})\\times(\\text{높이})$'],
        steps: [
          {
            title: '밑변 $AB$의 길이',
            body: `$A$와 $B$는 $y$좌표가 같아 가로로 놓인 선분이에요. 길이는 $x$좌표의 차예요.\n$$AB=|${x2}-${paren(x1)}|=${base}$$`,
          },
          {
            title: '높이 구하기',
            body: `$C$에서 가로선 $y=${y1}$까지의 거리는 $y$좌표의 차예요.\n$$|${y3}-${paren(y1)}|=${h}$$`,
          },
          {
            title: '넓이 계산',
            body: `$$\\frac{1}{2}\\times ${base}\\times ${h}=${fracTex(base * h, 2)}$$`,
          },
        ],
        tip: '좌표평면에 세 점을 대강 찍어 보면 어느 변이 가로로 놓였는지 바로 보여요.',
      };
    },
  },
];
