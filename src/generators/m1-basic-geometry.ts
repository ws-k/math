import type { Generator } from './types.ts';
import { polySym, polyTex } from './util.ts';

const UNIT = 'm1-basic-geometry';

const CONCEPT_VERT = '맞꼭지각: 두 직선이 만날 때 마주 보는 두 각. 크기가 같아요.';
const CONCEPT_LINE = '한 직선 위에서 이웃한 두 각의 합은 $180^\\circ$ 예요(평각).';
const CONCEPT_CORR = '평행한 두 직선이 다른 직선과 만나면 동위각의 크기가 같아요.';
const CONCEPT_ALT = '평행한 두 직선이 다른 직선과 만나면 엇각의 크기가 같아요.';

/** 각 크기 식 (ax+b)° 의 글자. b 가 0 이면 괄호 없이 ax° */
const angTex = (a: number, b: number) =>
  b === 0 ? `${polyTex([a, 0])}^\\circ` : `(${polyTex([a, b])})^\\circ`;

/** a·x0 + b = θ 가 되도록 b 를 정한다(θ 를 먼저 골라 각이 늘 0°~180° 안에 있게) */
const constFor = (a: number, x0: number, theta: number) => theta - a * x0;

/** 같다(두 식이 같은 각) 또는 합 180 → 해 구하는 단계 */
function solveSteps(a: number, b: number, c: number, d: number, sum: boolean, x0: number) {
  const eqTex = sum
    ? `(${polyTex([a, b])})+(${polyTex([c, d])})=180`
    : `${polyTex([a, b])}=${polyTex([c, d])}`;
  const k = sum ? a + c : a - c;
  const r = sum ? 180 - b - d : d - b;
  return [
    { title: '식 세우기', body: `$$${eqTex}$$` },
    {
      title: sum ? '동류항 정리하기' : '$x$는 왼쪽, 수는 오른쪽으로',
      body: `$$${polyTex([k, 0])}=${r}$$`,
    },
    // 계수가 1 이면 앞 단계에서 이미 x=… 가 나왔으므로 나누는 단계를 붙이지 않는다
    ...(k === 1
      ? []
      : [{ title: `양변을 $${k}$로 나누기`, body: `$$x=\\frac{${r}}{${k}}=${x0}$$` }]),
  ];
}

export const generators: Generator[] = [
  {
    id: 'geo-vertical-angles',
    unitId: UNIT,
    title: '맞꼭지각과 평각으로 각 구하기',
    make(rng) {
      const sum = rng.next() < 0.5;
      const x0 = rng.int(5, 30);
      let a: number;
      let c: number;
      let theta: number;
      let b: number;
      let d: number;
      do {
        a = rng.int(1, 5);
        c = rng.int(1, 5);
        theta = rng.int(4, 32) * 5;
        b = constFor(a, x0, theta);
        // 맞꼭지각이면 두 식이 같은 각, 평각이면 나머지 각
        d = constFor(c, x0, sum ? 180 - theta : theta);
      } while ((sum ? false : a === c) || Math.abs(b) > 90 || Math.abs(d) > 90 || theta === 90);
      const left = angTex(a, b);
      const right = angTex(c, d);
      return {
        q: sum
          ? `두 직선이 한 점에서 만나요. 한 직선 위에서 이웃한 두 각의 크기가 각각 $${left}$, $${right}$일 때, $x$의 값을 구하세요.`
          : `두 직선이 한 점에서 만나요. 맞꼭지각인 두 각의 크기가 각각 $${left}$, $${right}$일 때, $x$의 값을 구하세요.`,
        choices: null,
        answer: String(x0),
        answerType: 'int',
        check: sum
          ? `solve(Eq((${polySym([a, b])}) + (${polySym([c, d])}), 180), x)[0]`
          : `solve(Eq(${polySym([a, b])}, ${polySym([c, d])}), x)[0]`,
        concepts: [sum ? CONCEPT_LINE : CONCEPT_VERT],
        steps: solveSteps(a, b, c, d, sum, x0),
        tip: sum
          ? `구한 $x$를 넣으면 두 각은 $${theta}^\\circ$, $${180 - theta}^\\circ$ 로 합이 $180^\\circ$ 예요.`
          : `구한 $x$를 넣으면 두 각이 모두 $${theta}^\\circ$ 로 같아요.`,
      };
    },
  },
  {
    id: 'geo-parallel-angles',
    unitId: UNIT,
    title: '평행선에서 동위각·엇각',
    make(rng) {
      const kind = rng.pick(['corr', 'alt', 'supp'] as const);
      const x0 = rng.int(5, 30);
      let a: number;
      let c: number;
      let theta: number;
      let b: number;
      let d: number;
      do {
        a = rng.int(1, 5);
        c = rng.int(1, 5);
        theta = rng.int(4, 32) * 5;
        b = constFor(a, x0, theta);
        d = constFor(c, x0, kind === 'supp' ? 180 - theta : theta);
      } while (
        (kind !== 'supp' && a === c) ||
        Math.abs(b) > 90 ||
        Math.abs(d) > 90 ||
        theta === 90
      );
      const left = angTex(a, b);
      const right = angTex(c, d);
      const what =
        kind === 'corr'
          ? `서로 동위각인 두 각의 크기가 $${left}$, $${right}$`
          : kind === 'alt'
            ? `서로 엇각인 두 각의 크기가 $${left}$, $${right}$`
            : `직선 $l$ 위의 한 각이 $${left}$, 직선 $m$ 위에서 그 각의 동위각과 이웃한 각이 $${right}$`;
      return {
        q: `평행한 두 직선 $l$, $m$이 다른 한 직선과 만나요. ${what}일 때, $x$의 값을 구하세요.`,
        choices: null,
        answer: String(x0),
        answerType: 'int',
        check:
          kind === 'supp'
            ? `solve(Eq((${polySym([a, b])}) + (${polySym([c, d])}), 180), x)[0]`
            : `solve(Eq(${polySym([a, b])}, ${polySym([c, d])}), x)[0]`,
        concepts:
          kind === 'alt'
            ? [CONCEPT_ALT]
            : kind === 'corr'
              ? [CONCEPT_CORR]
              : [CONCEPT_CORR, CONCEPT_LINE],
        steps: [
          {
            title: kind === 'supp' ? '두 각의 관계 찾기' : '같은 각이라는 것 쓰기',
            body:
              kind === 'supp'
                ? '동위각끼리는 크기가 같고, 그 동위각과 이웃한 각은 한 직선 위에 있어 합이 $180^\\circ$ 예요. 그래서 두 각의 합이 $180^\\circ$ 예요.'
                : `평행선에서 ${kind === 'corr' ? '동위각' : '엇각'}은 크기가 같아요.`,
          },
          ...solveSteps(a, b, c, d, kind === 'supp', x0),
        ],
        tip: '두 직선이 평행할 때만 동위각·엇각이 같아요. 문제에 "평행"이라는 말이 있는지 먼저 확인해요.',
      };
    },
  },
  {
    id: 'geo-congruent',
    unitId: UNIT,
    title: '합동인 삼각형의 대응',
    make(rng) {
      const angle = rng.next() < 0.5;
      if (angle) {
        let A: number;
        let E: number;
        do {
          A = rng.int(6, 16) * 5;
          E = rng.int(6, 16) * 5;
        } while (A + E >= 165);
        return {
          q: `$\\triangle ABC \\equiv \\triangle DEF$ 이고 $\\angle A=${A}^\\circ$, $\\angle E=${E}^\\circ$ 일 때, $\\angle F$의 크기는 몇 도인지 구하세요.`,
          choices: null,
          answer: String(180 - A - E),
          answerType: 'int',
          check: `180 - ${A} - ${E}`,
          concepts: [
            '합동 기호 $\\equiv$ 는 꼭짓점을 대응하는 순서대로 적어요. $A\\leftrightarrow D$, $B\\leftrightarrow E$, $C\\leftrightarrow F$',
            '삼각형의 세 각의 합은 $180^\\circ$ 예요.',
          ],
          steps: [
            {
              title: '대응각 찾기',
              body: `$A$와 $D$가 대응하므로 $\\angle D=\\angle A=${A}^\\circ$ 예요.`,
            },
            {
              title: '세 각의 합 쓰기',
              body: `$$\\angle F=180^\\circ-${A}^\\circ-${E}^\\circ=${180 - A - E}^\\circ$$`,
            },
          ],
          tip: '합동인 삼각형은 대응하는 각끼리 크기가 같아요. 기호 순서가 곧 대응 순서예요.',
        };
      }
      let ab: number;
      let ef: number;
      let df: number;
      do {
        ab = rng.int(3, 12);
        ef = rng.int(3, 12);
        df = rng.int(3, 12);
      } while (ab + ef <= df || ab + df <= ef || ef + df <= ab);
      return {
        q: `$\\triangle ABC \\equiv \\triangle DEF$ 이고 $\\overline{AB}=${ab}$, $\\overline{EF}=${ef}$, $\\overline{DF}=${df}$ 일 때, $\\triangle ABC$의 둘레의 길이를 구하세요.`,
        choices: null,
        answer: String(ab + ef + df),
        answerType: 'int',
        check: `${ab} + ${ef} + ${df}`,
        concepts: [
          '합동 기호 $\\equiv$ 는 꼭짓점을 대응하는 순서대로 적어요. $A\\leftrightarrow D$, $B\\leftrightarrow E$, $C\\leftrightarrow F$',
        ],
        steps: [
          {
            title: '대응변 찾기',
            body: `$BC$는 $EF$와, $CA$는 $FD$와 대응해요.\n$$\\overline{BC}=${ef},\\quad \\overline{CA}=${df}$$`,
          },
          {
            title: '둘레 더하기',
            body: `$$${ab}+${ef}+${df}=${ab + ef + df}$$`,
          },
        ],
        tip: '대응변은 두 끝점이 모두 대응하는 변이에요. $BC$의 짝은 $B\\to E$, $C\\to F$ 라서 $EF$ 예요.',
      };
    },
  },
];
