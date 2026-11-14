import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex } from './util.ts';

const UNIT = 'math1-sine-cosine-law';

// 기초 문제는 특수각(30°·45°·60°·90°·120°·135°·150°)만 쓴다. 이 단원에서 익힐 것은 "어느 법칙을 언제
// 쓰나"이고, 삼각비 근삿값 계산은 수능에도 나오지 않기 때문이다. 각은 검산식에서 A*pi/180 으로 넘겨
// sympy 가 정확한 값(sqrt(3)/2 등)으로 계산하게 한다.

// '이에요/예요'는 앞 소리의 받침으로 갈리는데 값이 무작위라 끝자리로 고른다(일·삼·육·칠·팔·영/십 → 받침).
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');
const signed = (n: number) => (n < 0 ? `-${Math.abs(n)}` : `+${n}`);

/** 특수각의 사인 값: 화면 글자, 그리고 "a=2R·sinA 에서 R 에 곱해지는 몫"을 √ 꼴로 적기 위한 정보 */
const SIN: Record<number, { tex: string; root: 1 | 2 | 3; half: boolean }> = {
  // root: sin 값 = √root / 2 (root=1 이면 1/2), 90° 만 1
  30: { tex: '\\frac12', root: 1, half: true },
  45: { tex: '\\frac{\\sqrt2}{2}', root: 2, half: true },
  60: { tex: '\\frac{\\sqrt3}{2}', root: 3, half: true },
  90: { tex: '1', root: 1, half: false },
  120: { tex: '\\frac{\\sqrt3}{2}', root: 3, half: true },
  135: { tex: '\\frac{\\sqrt2}{2}', root: 2, half: true },
  150: { tex: '\\frac12', root: 1, half: true },
};
const sinOf = (deg: number) => SIN[deg] as (typeof SIN)[number];
const rad = (deg: number) => `${deg}*pi/180`;

/** 2R·sinA 의 값: 정수 k 와 √root (예: R=3, A=60° → 3√3) */
function chord(R: number, deg: number): { tex: string; sym: string } {
  const s = sinOf(deg);
  const k = s.half ? R : 2 * R;
  if (s.root === 1) return { tex: String(k), sym: String(k) };
  return { tex: `${k}\\sqrt${s.root}`, sym: `${k}*sqrt(${s.root})` };
}

/** 두 변과 끼인각(60°·120°) 또는 직각으로 세 변이 모두 정수인 삼각형. 각 A 는 a 의 대각 */
interface Tri {
  b: number;
  c: number;
  a: number;
  A: 60 | 90 | 120;
}
const TRIS: Tri[] = (() => {
  const out: Tri[] = [];
  // 15 까지 훑어야 각마다 서너 가지씩 나와서, 기초 15문제 안에서 같은 삼각형이 덜 겹친다
  for (let b = 1; b <= 15; b++)
    for (let c = 1; c <= 15; c++) {
      if (b === c) continue; // 정삼각형은 법칙 없이도 보이므로 뺀다
      for (const A of [60, 90, 120] as const) {
        const sq = b * b + c * c + (A === 60 ? -b * c : A === 120 ? b * c : 0);
        const a = Math.round(Math.sqrt(sq));
        if (a * a === sq) out.push({ b, c, a, A });
      }
    }
  return out;
})();

const COS_LAW = '코사인법칙: $a^2=b^2+c^2-2bc\\cos A$';
const COS_LAW_ANGLE = '$\\cos A=\\frac{b^2+c^2-a^2}{2bc}$';
const SIN_LAW = '사인법칙: $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}=2R$';
const AREA = '넓이: $S=\\frac12bc\\sin A$';

function pickAngle(rng: Rng, from: readonly number[]): number {
  return rng.pick(from);
}

export const generators: Generator[] = [
  {
    id: 'math1-sc-cos-side',
    unitId: UNIT,
    title: '두 변과 끼인각으로 나머지 한 변',
    make(rng) {
      for (;;) {
        // 아무 두 변이나 뽑으면 a 가 정수로 떨어지는 일이 드물어 늘 a^2 만 묻게 된다.
        // 절반은 세 변이 정수인 삼각형에서 골라 a 자체를 묻는다.
        const nice = TRIS.filter((t) => t.A !== 90);
        const t = rng.next() < 0.5 ? rng.pick(nice) : null;
        const b = t ? t.b : rng.int(2, 9);
        const c = t ? t.c : rng.int(2, 9);
        if (b === c) continue;
        const A = t ? (t.A as 60 | 120) : rng.pick([60, 120] as const);
        const sign = A === 60 ? -1 : 1;
        const sq = b * b + c * c + sign * b * c;
        const r = Math.round(Math.sqrt(sq));
        // 완전제곱이면 a 를, 아니면 a^2 을 묻는다 — 근호 답을 입력 칸에 넣지 않으려고
        const askSq = r * r !== sq;
        const cosTex = A === 60 ? '\\frac12' : '-\\frac12';
        const body = `${b}**2 + ${c}**2 - 2*${b}*${c}*cos(${rad(A)})`;
        const steps = [
          {
            title: '어느 법칙인지 고르기',
            body: `두 변 $b$, $c$ 와 그 끼인각 $A$ 를 알아요. 그러면 코사인법칙이에요.\n$$a^2=b^2+c^2-2bc\\cos A$$`,
          },
          {
            title: '값 넣기',
            body: `$\\cos ${A}^\\circ=${cosTex}$ 이므로\n$$a^2=${b}^2+${c}^2-2\\cdot${b}\\cdot${c}\\cdot\\left(${cosTex}\\right)$$`,
          },
          {
            title: '계산하기',
            body: `$$a^2=${b * b}+${c * c}${signed(sign * b * c)}=${sq}$$`,
          },
        ];
        if (!askSq)
          steps.push({
            title: '제곱근 구하기',
            body: `$a>0$ 이므로 $a=\\sqrt{${sq}}=${r}$ ${ieyo(r)}.`,
          });
        return {
          q: `삼각형 ABC 에서 $b=${b}$, $c=${c}$, $A=${A}^\\circ$ 일 때 ${askSq ? '$a^2$' : '$a$'} 의 값을 구하세요.`,
          choices: null,
          answer: String(askSq ? sq : r),
          answerType: 'int',
          check: askSq ? body : `sqrt(${body})`,
          concepts: [COS_LAW, '두 변과 그 끼인각을 알면 코사인법칙을 써요.'],
          steps,
          tip:
            A === 120
              ? `둔각이면 $\\cos A$ 가 음수라서 $2bc\\cos A$ 를 빼면 오히려 더해져요. 그래서 $a$ 가 가장 긴 변이 돼요.`
              : `$A$ 가 $90^\\circ$ 였다면 $a^2=${b * b + c * c}$ ${ieyo(b * b + c * c)}. $60^\\circ$ 라서 그보다 $bc=${b * c}$ 만큼 작아요.`,
        };
      }
    },
  },
  {
    id: 'math1-sc-cos-angle',
    unitId: UNIT,
    title: '세 변으로 각의 크기',
    make(rng) {
      const t = rng.pick(TRIS);
      const k = t.a * 2 <= 20 && rng.next() < 0.3 ? 2 : 1;
      const [a, b, c] = [t.a * k, t.b * k, t.c * k];
      const num = b * b + c * c - a * a;
      const den = 2 * b * c;
      const cosTex = fracTex(num, den);
      const why =
        t.A === 90
          ? '코사인 값이 $0$ 인 각은 $90^\\circ$ 예요.'
          : t.A === 60
            ? '코사인 값이 $\\frac12$ 인 각은 $60^\\circ$ 예요.'
            : '코사인 값이 $-\\frac12$ 인 각은 $120^\\circ$ 예요. 음수라서 둔각이에요.';
      return {
        q: `세 변의 길이가 $\\overline{BC}=${a}$, $\\overline{CA}=${b}$, $\\overline{AB}=${c}$ 인 삼각형 ABC 에서 각 $A$ 의 크기는 몇 도인지 구하세요.`,
        choices: null,
        answer: String(t.A),
        answerType: 'int',
        check: `deg(acos(Rational(${b}**2 + ${c}**2 - ${a}**2, 2*${b}*${c})))`,
        concepts: [COS_LAW, COS_LAW_ANGLE],
        steps: [
          {
            title: '변 이름 붙이기',
            body: `각 $A$ 의 맞은편 변이 $a=\\overline{BC}=${a}$ 이고, $b=${b}$, $c=${c}$ ${ieyo(c)}.`,
          },
          {
            title: '코사인법칙을 각에 대해 풀기',
            body: `$$\\cos A=\\frac{b^2+c^2-a^2}{2bc}=\\frac{${b * b}+${c * c}-${a * a}}{2\\cdot${b}\\cdot${c}}=\\frac{${num}}{${den}}$$`,
          },
          {
            title: '약분하기',
            body: `$$\\cos A=${cosTex}$$`,
          },
          { title: '각 찾기', body: why },
        ],
        tip: '세 변을 알면 코사인법칙을 각에 대해 풀어 써요. 분자가 음수면 둔각, 0 이면 직각이에요.',
      };
    },
  },
  {
    id: 'math1-sc-sine-radius',
    unitId: UNIT,
    title: '한 변과 대각으로 외접원의 반지름',
    make(rng) {
      const A = pickAngle(rng, [30, 45, 60, 90, 120, 135, 150]);
      const R = rng.int(2, 9);
      const a = chord(R, A);
      const s = sinOf(A);
      return {
        q: `삼각형 ABC 에서 $a=${a.tex}$, $A=${A}^\\circ$ 일 때 외접원의 반지름의 길이 $R$ 을 구하세요.`,
        choices: null,
        answer: String(R),
        answerType: 'int',
        check: `(${a.sym})/(2*sin(${rad(A)}))`,
        concepts: [SIN_LAW, '한 변과 그 맞은편 각을 알면 외접원의 지름 $2R$ 이 바로 나와요.'],
        steps: [
          {
            title: '사인법칙 쓰기',
            body: '변 $a$ 와 그 맞은편 각 $A$ 를 알아요.\n$$\\frac{a}{\\sin A}=2R$$',
          },
          {
            title: '사인 값 넣기',
            body: `$\\sin ${A}^\\circ=${s.tex}$ 이므로\n$$2R=${a.tex}\\div ${s.tex}=${2 * R}$$`,
          },
          { title: '반으로 나누기', body: `$$R=${2 * R}\\div2=${R}$$` },
        ],
        tip: '사인법칙으로 바로 나오는 $2R$ 은 지름이에요. 반지름을 물으면 마지막에 반으로 나누는 걸 잊지 마세요.',
      };
    },
  },
  {
    id: 'math1-sc-sine-side',
    unitId: UNIT,
    title: '사인법칙으로 다른 변',
    make(rng) {
      for (;;) {
        const A = pickAngle(rng, [30, 45, 60, 120, 135]);
        const B = pickAngle(rng, [30, 90, 150]);
        if (A === B || A + B >= 180) continue;
        const R = rng.int(2, 6);
        const a = chord(R, A);
        const b = chord(R, B);
        // 각 B 를 바로 주거나, 각 C 를 주고 B 를 180° 에서 빼서 구하게 한다
        const giveC = rng.next() < 0.5;
        const C = 180 - A - B;
        const sa = sinOf(A);
        const sb = sinOf(B);
        const steps = [];
        if (giveC)
          steps.push({
            title: '남은 각 구하기',
            body: `세 각의 합은 $180^\\circ$ 이므로 $B=180^\\circ-${A}^\\circ-${C}^\\circ=${B}^\\circ$ 예요.`,
          });
        steps.push(
          {
            title: '지름 구하기',
            body: `변 $a$ 와 각 $A$ 가 짝이에요. $\\sin ${A}^\\circ=${sa.tex}$ 이므로\n$$2R=\\frac{a}{\\sin A}=${a.tex}\\div ${sa.tex}=${2 * R}$$`,
          },
          {
            title: '다른 짝에 쓰기',
            body: `$\\frac{b}{\\sin B}$ 도 같은 $2R$ 이에요. $\\sin ${B}^\\circ=${sb.tex}$ 이므로\n$$b=2R\\sin B=${2 * R}\\cdot ${sb.tex}=${b.tex}$$`,
          },
        );
        return {
          q: `삼각형 ABC 에서 $a=${a.tex}$, $A=${A}^\\circ$, ${giveC ? `$C=${C}^\\circ$` : `$B=${B}^\\circ$`} 일 때 $b$ 의 값을 구하세요.`,
          choices: null,
          answer: b.sym,
          answerType: 'int',
          check: `(${a.sym})*sin(${rad(B)})/sin(${rad(A)})`,
          concepts: [
            SIN_LAW,
            '변과 맞은편 각이 한 짝이에요. 짝마다 나눈 값이 모두 $2R$ 로 같아요.',
          ],
          steps,
          tip: '변과 각을 짝지을 때 맞은편끼리 묶어요. $a$ 는 $A$, $b$ 는 $B$ 와 짝이에요.',
        };
      }
    },
  },
  {
    id: 'math1-sc-area',
    unitId: UNIT,
    title: '두 변과 끼인각으로 넓이',
    make(rng) {
      const A = pickAngle(rng, [30, 45, 60, 120, 135, 150]);
      const b = rng.int(2, 10);
      let c = rng.int(2, 10);
      if (c === b) c = b === 10 ? 9 : b + 1;
      const s = sinOf(A);
      // S = (1/2)·b·c·(√root/2) = (b·c/4)·√root. root=1 이면 바로, 아니면 √ 앞의 수 k 를 묻는다
      const k = { n: b * c, d: 4 };
      const kTex = fracTex(k.n, k.d);
      const ans = fracAns(k.n, k.d);
      const rooted = s.root !== 1;
      return {
        q: rooted
          ? `삼각형 ABC 에서 $b=${b}$, $c=${c}$, $A=${A}^\\circ$ 예요. 넓이를 $k\\sqrt${s.root}$ 꼴로 나타낼 때 $k$ 의 값을 구하세요.`
          : `삼각형 ABC 에서 $b=${b}$, $c=${c}$, $A=${A}^\\circ$ 일 때 넓이를 구하세요.`,
        choices: null,
        answer: ans,
        answerType: k.n % k.d === 0 ? 'int' : 'fraction',
        check: rooted
          ? `Rational(1, 2)*${b}*${c}*sin(${rad(A)})/sqrt(${s.root})`
          : `Rational(1, 2)*${b}*${c}*sin(${rad(A)})`,
        concepts: [AREA, '높이는 $c\\sin A$ 예요. 둔각이어도 사인 값은 양수예요.'],
        steps: [
          {
            title: '넓이 공식 고르기',
            body: '두 변과 그 끼인각을 알아요.\n$$S=\\frac12bc\\sin A$$',
          },
          {
            title: '값 넣기',
            body: `$\\sin ${A}^\\circ=${s.tex}$ 이므로\n$$S=\\frac12\\cdot${b}\\cdot${c}\\cdot${s.tex}$$`,
          },
          {
            title: '계산하기',
            body: rooted
              ? `$$S=${kTex}\\sqrt${s.root}$$\n그래서 $k=${kTex}$ ${k.n % k.d === 0 ? ieyo(k.n / k.d) : '예요'}.`
              : `$$S=\\frac{${b * c}}{4}=${kTex}$$`,
          },
        ],
        tip:
          A > 90
            ? `$${A}^\\circ$ 는 둔각이지만 $\\sin ${A}^\\circ=\\sin ${180 - A}^\\circ$ 예요. 넓이는 $${180 - A}^\\circ$ 일 때와 같아요.`
            : '높이가 $c\\sin A$ 라서 넓이는 $\\frac12\\times$ 밑변 $b\\times$ 높이 $c\\sin A$ 예요.',
      };
    },
  },
];
