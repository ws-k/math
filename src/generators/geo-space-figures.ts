import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd } from './util.ts';

const UNIT = 'geo-space-figures';

// 기초 문제는 답이 정수·분수로 떨어지게만 만든다. 정사영은 cos 60° 이거나 cos 값을 분수로 주고,
// 삼수선·정사영 길이는 피타고라스 수(3·4·5 등)로 고른다 — 이 단원에서 익힐 것은 "어느 직각삼각형을
// 보느냐"이지 √ 계산이 아니기 때문이다(수능 기하 27·28번도 그 직각삼각형을 찾는 것이 핵심).

// '이에요/예요'는 앞 소리의 받침으로 갈리는데 값이 무작위라 끝자리로 고른다(일·삼·육·칠·팔·영/십 → 받침).
// 분수 \frac{a}{b} 는 "b분의 a"로 읽으니 분자의 끝자리로 고른다.
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

/** 피타고라스 수 (빗변이 마지막) */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
  [12, 16, 20],
  [7, 24, 25],
];

/** 두 다리의 순서를 섞은 피타고라스 수 */
function triple(rng: Rng): { a: number; b: number; c: number } {
  const [p, q, c] = rng.pick(TRIPLES);
  return rng.next() < 0.5 ? { a: p, b: q, c } : { a: q, b: p, c };
}

const PROJ_LEN = "정사영의 길이: $\\overline{A'B'}=\\overline{AB}\\cos\\theta$";
const PROJ_AREA = "정사영의 넓이: $S'=S\\cos\\theta$";
const THREE_PERP =
  '삼수선의 정리: $\\overline{PH}\\perp\\alpha$, $\\overline{HO}\\perp l$ 이면 $\\overline{PO}\\perp l$';
const PYTH = '직각삼각형에서 (빗변)$^2$ = (다른 두 변의 제곱의 합)';

// ---- 각기둥의 모서리 위치 관계 ----

/**
 * 정n각기둥에서 모서리 하나(를 품은 직선)와 꼬인 위치에 있는 모서리 수.
 * 같은 밑면 위의 모서리는 한 평면 위에 있으니 늘이면 만나거나 평행해서 **꼬인 위치가 아니다** —
 * "안 만나면 꼬인 위치"로 세는 흔한 실수가 바로 이것이라 풀이도 평면별로 나눠 센다.
 * 아랫면 모서리 A1A2: 다른 아랫면 모서리는 모두 제외, 옆모서리는 양 끝 2개만 만나고 n−2개가 꼬임,
 *   윗면 모서리는 평행한 것(B1B2, n 이 짝수면 마주 보는 것까지)을 뺀 나머지가 꼬임.
 * 옆모서리 A1B1: 다른 옆모서리는 모두 평행, 아랫면·윗면에서 각각 붙어 있는 2개를 뺀 n−2개씩 꼬임.
 */
export function prismRelations(n: number, lateral: boolean) {
  const topPar = n % 2 === 0 ? 2 : 1;
  if (lateral) return { parallel: n - 1, skew: 2 * (n - 2), topPar };
  return { parallel: 1 + (topPar - 1) * 2, skew: n - 2 + (n - topPar), topPar };
}

/**
 * 검산식: 앱 계산(prismRelations)을 베끼지 않으려고 정n각기둥 꼭짓점을 실제 좌표로 놓고
 * 두 모서리의 네 끝점이 한 평면 위에 있지 않으면 꼬인 위치, 방향이 같으면 평행으로 센다.
 */
function prismCheck(n: number, lateral: boolean, ask: 'skew' | 'parallel'): string {
  return [
    'import math',
    `n = ${n}`,
    'P = [(math.cos(2*math.pi*i/n), math.sin(2*math.pi*i/n), z) for z in (0, 1) for i in range(n)]',
    'E = [(i, (i+1) % n) for i in range(n)] + [(n+i, n+(i+1) % n) for i in range(n)] + [(i, n+i) for i in range(n)]',
    'def sub(u, v): return [u[0]-v[0], u[1]-v[1], u[2]-v[2]]',
    'def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]',
    'def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]',
    `e = ${lateral ? '(0, n)' : '(0, 1)'}`,
    'u = sub(P[e[1]], P[e[0]])',
    'def skew(f): return abs(dot(cross(u, sub(P[f[1]], P[f[0]])), sub(P[f[0]], P[e[0]]))) > 1e-9',
    'def par(f): return max(abs(t) for t in cross(u, sub(P[f[1]], P[f[0]]))) < 1e-9',
    `ans = sum(1 for f in E if f != e and ${ask === 'skew' ? 'skew(f)' : 'par(f)'})`,
  ].join('\n');
}

const PRISM_NAME: Record<number, string> = {
  3: '삼',
  4: '사',
  5: '오',
  6: '육',
  7: '칠',
  8: '팔',
};

export const generators: Generator[] = [
  {
    id: 'geo-space-figures-prism-skew',
    unitId: UNIT,
    title: '각기둥에서 꼬인 위치·평행한 모서리 세기',
    make(rng) {
      const n = rng.int(3, 8);
      const lateral = rng.next() < 0.4;
      // 평행만 물으면 옆모서리는 늘 n−1 이라 단조로워서, 평행은 밑면 모서리일 때만 묻는다
      const ask: 'skew' | 'parallel' = !lateral && rng.next() < 0.3 ? 'parallel' : 'skew';
      const r = prismRelations(n, lateral);
      const name = `정${PRISM_NAME[n]}각기둥`;
      const edge = lateral ? '$A_1B_1$' : '$A_1A_2$';
      const askWord = ask === 'skew' ? '꼬인 위치에 있는' : '평행한';
      const ans = ask === 'skew' ? r.skew : r.parallel;
      const h = n / 2;
      const oppA = `$A_{${h + 1}}A_{${h + 2}}$`;
      const oppB = `$B_{${h + 1}}B_{${h + 2}}$`;
      const even = n % 2 === 0;
      let steps: { title: string; body: string }[];
      if (ask === 'parallel')
        steps = [
          {
            title: '아랫면 안에서',
            body: even
              ? `밑면이 짝수 각형이라 마주 보는 모서리 ${oppA} 가 $A_1A_2$ 와 평행해요.`
              : '밑면이 홀수 각형이면 마주 보는 평행한 변이 없어요.',
          },
          {
            title: '윗면에서',
            body: even
              ? `바로 위의 $B_1B_2$, 그리고 ${oppB} 가 평행해요.`
              : '바로 위의 $B_1B_2$ 만 평행해요.',
          },
          { title: '옆모서리', body: '옆모서리는 밑면에 수직이라 $A_1A_2$ 와 평행하지 않아요.' },
          { title: '답', body: `평행한 모서리는 ${ans}개${ieyo(ans)}.` },
        ];
      else if (!lateral)
        steps = [
          {
            title: '아랫면 모서리는 빼기',
            body: '아랫면의 모서리는 $A_1A_2$ 와 같은 평면 위에 있어서, 늘이면 만나거나 평행해요. 꼬인 위치는 하나도 없어요.',
          },
          {
            title: '옆모서리',
            body: `$A_1B_1$, $A_2B_2$ 는 $A_1A_2$ 와 만나요. 나머지 ${n - 2}개는 만나지도 평행하지도 않으니 꼬인 위치예요.`,
          },
          {
            title: '윗면 모서리',
            body: `윗면은 아랫면과 평행해서 만날 수 없어요. ${even ? `평행한 $B_1B_2$, ${oppB}` : '평행한 $B_1B_2$'} 를 빼면 ${n - r.topPar}개가 꼬인 위치예요.`,
          },
          { title: '더하기', body: `$$${n - 2}+${n - r.topPar}=${ans}$$` },
        ];
      else
        steps = [
          { title: '옆모서리', body: `다른 옆모서리 ${n - 1}개는 모두 $A_1B_1$ 과 평행해요.` },
          {
            title: '아랫면 모서리',
            body: `$A_1$ 에 붙은 2개는 만나요. 나머지 ${n - 2}개는 꼬인 위치예요.`,
          },
          {
            title: '윗면 모서리',
            body: `$B_1$ 에 붙은 2개는 만나요. 나머지 ${n - 2}개는 꼬인 위치예요.`,
          },
          { title: '더하기', body: `$$${n - 2}+${n - 2}=${ans}$$` },
        ];
      return {
        q: `${name}의 아랫면을 $A_1A_2\\cdots A_{${n}}$, 윗면을 $B_1B_2\\cdots B_{${n}}$ 이라 하고, $A_k$ 바로 위의 꼭짓점을 $B_k$ 라 해요. 모서리 ${edge} ${lateral ? '과' : '와'} ${askWord} 모서리의 개수를 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: prismCheck(n, lateral, ask),
        concepts: [
          '두 직선의 위치 관계: 한 점에서 만난다 · 평행하다 · 꼬인 위치에 있다',
          '꼬인 위치: 만나지도 않고 평행하지도 않아서 한 평면 위에 놓을 수 없는 두 직선',
        ],
        steps,
        tip: '"만나지 않으면 꼬인 위치"가 아니에요. 같은 면 위의 모서리는 늘이면 만나거나 평행해요. 면별로 나눠 세면 빠뜨리지 않아요.',
      };
    },
  },
  {
    id: 'geo-space-figures-proj-length',
    unitId: UNIT,
    title: '선분의 정사영의 길이',
    make(rng) {
      if (rng.next() < 0.35) {
        // 평면과 이루는 각이 60° 이면 정사영은 절반 — 각으로 주는 기본형
        const L = 2 * rng.int(2, 12);
        const half = L / 2;
        return {
          q: `길이가 ${L} 인 선분 AB 가 평면 $\\alpha$ 와 이루는 각의 크기가 $60^\\circ$ 예요. 선분 AB 의 평면 $\\alpha$ 위로의 정사영의 길이를 구하세요.`,
          choices: null,
          answer: String(half),
          answerType: 'int',
          check: `${L}*cos(pi/3)`,
          concepts: [PROJ_LEN],
          steps: [
            {
              title: '정사영의 길이 공식',
              body: '선분과 평면이 이루는 각이 $\\theta$ 이면 정사영의 길이는 (선분의 길이)$\\times\\cos\\theta$ 예요.',
            },
            {
              title: '대입하기',
              body: `$$${L}\\cos60^\\circ=${L}\\times\\frac12=${half}$$`,
            },
          ],
          tip: '선분이 평면에 가까이 누울수록(θ 가 작을수록) 그림자가 길어져요. $\\cos$ 를 $\\sin$ 으로 바꿔 쓰면 높이를 구하게 되니 조심해요.',
        };
      }
      // 두 끝점의 높이로 주는 형: 높이 차와 정사영이 직각을 이룬다
      const { a, b, c } = triple(rng);
      const h1 = rng.int(1, 6);
      const h2 = h1 + a;
      return {
        q: `평면 $\\alpha$ 의 같은 쪽에 있는 두 점 A, B 에서 $\\alpha$ 까지의 거리가 각각 ${h1}, ${h2} 이고 $\\overline{AB}=${c}$ 예요. 선분 AB 의 평면 $\\alpha$ 위로의 정사영의 길이를 구하세요.`,
        choices: null,
        answer: String(b),
        answerType: 'int',
        check: `sqrt(${c}**2 - (${h2} - ${h1})**2)`,
        concepts: [PYTH, "정사영 $\\mathrm{A'B'}$ 은 높이 차와 수직이에요."],
        steps: [
          {
            title: '정사영 그리기',
            body: "A, B 에서 $\\alpha$ 에 내린 수선의 발을 A', B' 이라 하면 정사영은 $\\overline{A'B'}$ 예요.",
          },
          {
            title: '직각삼각형 찾기',
            body: `A 를 지나 $\\overline{A'B'}$ 에 평행한 선을 그으면, 빗변이 $\\overline{AB}=${c}$, 세로가 높이 차 $${h2}-${h1}=${a}$ 인 직각삼각형이 생겨요. 가로가 정사영의 길이예요.`,
          },
          {
            title: '피타고라스',
            body: `$$\\overline{A'B'}=\\sqrt{${c}^2-${a}^2}=\\sqrt{${c * c - a * a}}=${b}$$`,
          },
        ],
        tip: `높이 ${h1}, ${h2} 를 그대로 쓰지 말고 **차**를 써요. 높이를 더하는 건 두 점이 평면의 반대쪽에 있을 때예요.`,
      };
    },
  },
  {
    id: 'geo-space-figures-proj-area',
    unitId: UNIT,
    title: '도형의 정사영의 넓이',
    make(rng) {
      const kind = rng.pick(['sixty', 'cos', 'angle'] as const);
      if (kind === 'sixty') {
        const m = rng.int(2, 9);
        const n = rng.int(2, 9);
        const S = m * n;
        return {
          q: `가로 ${m}, 세로 ${n} 인 직사각형이 있는 평면과 평면 $\\beta$ 가 이루는 각의 크기가 $60^\\circ$ 예요. 이 직사각형의 평면 $\\beta$ 위로의 정사영의 넓이를 구하세요.`,
          choices: null,
          answer: fracAns(S, 2),
          answerType: 'fraction',
          check: `${m}*${n}*cos(pi/3)`,
          concepts: [PROJ_AREA],
          steps: [
            { title: '원래 넓이', body: `$S=${m}\\times${n}=${S}$ 이에요.` },
            {
              title: '정사영의 넓이 공식',
              body: `$$S'=S\\cos60^\\circ=${S}\\times\\frac12=${fracTex(S, 2)}$$`,
            },
          ],
          tip: '두 평면이 만나는 선과 나란한 방향은 그대로이고, 수직인 방향만 $\\cos\\theta$ 배로 줄어요. 그래서 넓이도 $\\cos\\theta$ 배예요.',
        };
      }
      // cos 를 분수로 주거나 넓이 둘로 cos 를 묻는다(각이 특수각이 아니어도 되게)
      const q = rng.int(3, 9);
      let p = rng.int(1, q - 1);
      while (gcd(p, q) !== 1) p = rng.int(1, q - 1);
      const S = q * rng.int(2, 6);
      const Sp = (S * p) / q;
      if (kind === 'cos')
        return {
          q: `넓이가 ${S} 인 삼각형 ABC 가 있는 평면과 평면 $\\alpha$ 가 이루는 각의 크기를 $\\theta$ 라 할 때 $\\cos\\theta=${fracTex(p, q)}$ ${ieyo(p)}. 삼각형 ABC 의 평면 $\\alpha$ 위로의 정사영의 넓이를 구하세요.`,
          choices: null,
          answer: String(Sp),
          answerType: 'int',
          check: `${S}*Rational(${p}, ${q})`,
          concepts: [PROJ_AREA],
          steps: [
            {
              title: '정사영의 넓이 공식',
              body: "평면도형의 넓이가 $S$ 이면 정사영의 넓이는 $S'=S\\cos\\theta$ 예요.",
            },
            {
              title: '대입하기',
              body: `$$S'=${S}\\times${fracTex(p, q)}=${Sp}$$`,
            },
          ],
          tip: '정사영은 원래 도형보다 커질 수 없어요($\\cos\\theta\\le1$). 답이 원래 넓이보다 크면 나누기와 곱하기를 바꾼 거예요.',
        };
      return {
        q: `넓이가 ${S} 인 도형 F 의 평면 $\\alpha$ 위로의 정사영의 넓이가 ${Sp} ${ieyo(Sp)}. F 가 있는 평면과 평면 $\\alpha$ 가 이루는 각의 크기를 $\\theta$ 라 할 때 $\\cos\\theta$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(p, q),
        answerType: 'fraction',
        // 넓이의 비가 곧 cos θ — Rational(a, b) 로 적으면 '답 베끼기'와 구별되지 않아 나눗셈으로 쓴다
        check: `Integer(${Sp})/${S}`,
        concepts: [PROJ_AREA, "$\\cos\\theta=\\frac{S'}{S}$"],
        steps: [
          {
            title: '공식 거꾸로 쓰기',
            body: "$S'=S\\cos\\theta$ 이므로 $\\cos\\theta=\\dfrac{S'}{S}$ 이에요.",
          },
          {
            title: '대입하고 약분하기',
            body: `$$\\cos\\theta=\\frac{${Sp}}{${S}}=${fracTex(p, q)}$$`,
          },
        ],
        tip: '정사영 넓이가 분자, 원래 넓이가 분모예요. 거꾸로 쓰면 1 보다 큰 값이 나와서 cos 값이 될 수 없어요.',
      };
    },
  },
  {
    id: 'geo-space-figures-three-perp',
    unitId: UNIT,
    title: '삼수선의 정리로 거리 구하기',
    make(rng) {
      const { a, b, c } = triple(rng);
      // a = PH(평면까지), b = HO(평면 위에서 직선까지), c = PO(직선까지)
      if (rng.next() < 0.6)
        return {
          q: `평면 $\\alpha$ 밖의 점 P 에서 $\\alpha$ 에 내린 수선의 발을 H, 점 H 에서 $\\alpha$ 위의 직선 $l$ 에 내린 수선의 발을 O 라 해요. $\\overline{PH}=${a}$, $\\overline{HO}=${b}$ 일 때 점 P 와 직선 $l$ 사이의 거리를 구하세요.`,
          choices: null,
          answer: String(c),
          answerType: 'int',
          check: `sqrt(${a}**2 + ${b}**2)`,
          concepts: [THREE_PERP, PYTH],
          steps: [
            {
              title: '삼수선의 정리',
              body: '$\\overline{PH}\\perp\\alpha$, $\\overline{HO}\\perp l$ 이므로 $\\overline{PO}\\perp l$ 이에요. 그래서 P 와 $l$ 사이의 거리는 $\\overline{PO}$ 예요.',
            },
            {
              title: '직각삼각형 PHO',
              body: '$\\overline{PH}$ 는 평면 위의 모든 직선과 수직이라 $\\angle PHO=90^\\circ$ 예요.',
            },
            {
              title: '피타고라스',
              body: `$$\\overline{PO}=\\sqrt{${a}^2+${b}^2}=\\sqrt{${a * a + b * b}}=${c}$$`,
            },
          ],
          tip: `$${a}+${b}$ 처럼 더하면 안 돼요. P 에서 평면으로 내려간 뒤 평면 위를 걸어간 길이일 뿐, 곧은 거리가 아니에요.`,
        };
      return {
        q: `평면 $\\alpha$ 밖의 점 P 에서 $\\alpha$ 에 내린 수선의 발을 H 라 하고, $\\alpha$ 위의 직선 $l$ 위의 점 O 에 대하여 $\\overline{PO}\\perp l$ 이에요. $\\overline{PH}=${a}$, $\\overline{PO}=${c}$ 일 때 점 H 와 직선 $l$ 사이의 거리를 구하세요.`,
        choices: null,
        answer: String(b),
        answerType: 'int',
        check: `sqrt(${c}**2 - ${a}**2)`,
        concepts: [
          '삼수선의 정리(역): $\\overline{PH}\\perp\\alpha$, $\\overline{PO}\\perp l$ 이면 $\\overline{HO}\\perp l$',
          PYTH,
        ],
        steps: [
          {
            title: '삼수선의 정리 쓰기',
            body: '$\\overline{PH}\\perp\\alpha$, $\\overline{PO}\\perp l$ 이므로 $\\overline{HO}\\perp l$ 이에요. 그래서 H 와 $l$ 사이의 거리는 $\\overline{HO}$ 예요.',
          },
          {
            title: '직각삼각형 PHO',
            body: '$\\angle PHO=90^\\circ$ 이고 빗변은 $\\overline{PO}$ 예요.',
          },
          {
            title: '피타고라스',
            body: `$$\\overline{HO}=\\sqrt{${c}^2-${a}^2}=\\sqrt{${c * c - a * a}}=${b}$$`,
          },
        ],
        tip: '세 수선 중 두 개가 수직이면 나머지 하나도 수직이에요. 어느 두 개가 주어졌는지 먼저 확인해요.',
      };
    },
  },
];
