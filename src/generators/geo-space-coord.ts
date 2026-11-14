import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { paren } from './util.ts';

const UNIT = 'geo-space-coord';

// 검산식은 공식을 다시 적지 않고 sympy 의 공간 기하(Point3D·Plane·Line3D)로 계산한다 — 대칭점은
// "평면(직선) 위로의 정사영을 두 배 한 뒤 원래 점을 뺀 것", 거리는 Point3D.distance, 구는 식에서
// 완전제곱으로 중심을 읽는다. 풀이에 쓴 규칙(부호 바꾸기 등)과 다른 길로 같은 답이 나오는지 보려는 것.

// '이에요/예요'는 앞 소리의 받침으로 갈리는데 값이 무작위라 끝자리로 고른다(일·삼·육·칠·팔·영/십 → 받침).
const ieyo = (n: number) => ([0, 1, 3, 6, 7, 8].includes(Math.abs(n) % 10) ? '이에요' : '예요');

type V3 = [number, number, number];

/** 세 수의 제곱의 합이 제곱수인 것 (마지막이 거리) */
const QUADS: [number, number, number, number][] = [
  [1, 2, 2, 3],
  [2, 3, 6, 7],
  [1, 4, 8, 9],
  [4, 4, 7, 9],
  [2, 6, 9, 11],
  [6, 6, 7, 11],
  [3, 4, 12, 13],
  [4, 8, 8, 12],
  [2, 5, 14, 15],
];

/** 순서를 섞고 부호를 붙인 세 차이 */
function diffs(rng: Rng): { d: V3; dist: number } {
  const [p, q, r, dist] = rng.pick(QUADS);
  const arr = [p, q, r];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j] as number, arr[i] as number];
  }
  const d = arr.map((v) => (rng.next() < 0.5 ? -v : v)) as V3;
  return { d, dist };
}

const pt = (name: string, v: V3) => `\\mathrm{${name}}(${v.join(', ')})`;
const sym = (v: V3) => `Point3D(${v.join(', ')})`;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const DIST = '두 점 사이의 거리: $\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2+(z_2-z_1)^2}$';
const SECTION =
  '내분점: $\\left(\\frac{mx_2+nx_1}{m+n},\\ \\frac{my_2+ny_1}{m+n},\\ \\frac{mz_2+nz_1}{m+n}\\right)$';
const CENTROID =
  '무게중심: $\\left(\\frac{x_1+x_2+x_3}{3},\\ \\frac{y_1+y_2+y_3}{3},\\ \\frac{z_1+z_2+z_3}{3}\\right)$';
const SPHERE = '구의 방정식: $(x-a)^2+(y-b)^2+(z-c)^2=r^2$ (중심 $(a,b,c)$, 반지름 $r$)';

/** 차이 하나의 제곱 글자: 음수면 괄호 */
const sq = (n: number) => `${paren(n)}^2`;

// ---- 대칭 ----

type SymKind = 'xy' | 'yz' | 'zx' | 'x' | 'y' | 'z' | 'o';
const SYM_NAME: Record<SymKind, string> = {
  xy: '$xy$평면',
  yz: '$yz$평면',
  zx: '$zx$평면',
  x: '$x$축',
  y: '$y$축',
  z: '$z$축',
  o: '원점',
};
/** 부호가 바뀌는 좌표(0:x 1:y 2:z) */
const FLIP: Record<SymKind, number[]> = {
  xy: [2],
  yz: [0],
  zx: [1],
  x: [1, 2],
  y: [0, 2],
  z: [0, 1],
  o: [0, 1, 2],
};
const AXIS = ['x', 'y', 'z'];

/** sympy 로 대칭점: 평면·축 위로의 정사영 H 에 대해 Q = 2H − P (원점이면 −P) */
function reflectSym(kind: SymKind, p: V3): string {
  const P = sym(p);
  const O = 'Point3D(0, 0, 0)';
  if (kind === 'o') return `(-${P})`;
  if (kind.length === 2) {
    const n = kind === 'xy' ? '(0, 0, 1)' : kind === 'yz' ? '(1, 0, 0)' : '(0, 1, 0)';
    return `(2*Plane(${O}, normal_vector=${n}).projection(${P}) - ${P})`;
  }
  const u = kind === 'x' ? '(1, 0, 0)' : kind === 'y' ? '(0, 1, 0)' : '(0, 0, 1)';
  return `(2*Line3D(${O}, Point3D${u}).projection(${P}) - ${P})`;
}

function flipRule(kind: SymKind): string {
  const f = FLIP[kind].map((i) => `$${AXIS[i]}$`).join('·');
  if (kind === 'o') return '원점에 대칭이면 세 좌표의 부호가 모두 바뀌어요.';
  if (kind.length === 2)
    return `${SYM_NAME[kind]}에 대칭이면 그 평면에 없는 ${f} 좌표만 부호가 바뀌어요.`;
  return `${SYM_NAME[kind]}에 대칭이면 축 좌표는 그대로이고 나머지 ${f} 좌표의 부호가 바뀌어요.`;
}

// ---- 구 ----

/** x^2+y^2+z^2 뒤에 붙는 일차항·상수항 글자 */
function sphereTex(D: number, E: number, F: number, G: number): string {
  let s = 'x^2+y^2+z^2';
  const lin = (c: number, v: string) => {
    if (c === 0) return '';
    const a = Math.abs(c);
    return `${c < 0 ? '-' : '+'}${a === 1 ? '' : a}${v}`;
  };
  s += lin(D, 'x') + lin(E, 'y') + lin(F, 'z');
  if (G !== 0) s += G < 0 ? `${G}` : `+${G}`;
  return `${s}=0`;
}
function sphereSym(D: number, E: number, F: number, G: number): string {
  return `x**2 + y**2 + z**2 + (${D})*x + (${E})*y + (${F})*z + (${G})`;
}
/** (x−a)^2 꼴 글자 */
function shiftTex(v: string, a: number): string {
  if (a === 0) return `${v}^2`;
  return `(${v}${a > 0 ? '-' : '+'}${Math.abs(a)})^2`;
}
/** 식에서 중심·반지름²을 완전제곱으로 읽는 검산 머리말(마지막에 ans 를 붙인다) */
const sphereHead = (e: string) =>
  [
    `e = ${e}`,
    'o = {x: 0, y: 0, z: 0}',
    'cen = [-diff(e, v).subs(o)/2 for v in (x, y, z)]',
    'r2 = sum(t**2 for t in cen) - e.subs(o)',
  ].join('\n');

export const generators: Generator[] = [
  {
    id: 'geo-space-coord-distance',
    unitId: UNIT,
    title: '좌표공간에서 두 점 사이의 거리',
    make(rng) {
      const { d, dist } = diffs(rng);
      const kind = rng.pick(['two', 'two', 'origin', 'unknown'] as const);
      if (kind === 'unknown') {
        // 한 좌표를 모를 때: 그 좌표의 차이가 ±d 두 가지라 두 값의 합을 묻는다
        const a: V3 = [rng.int(-3, 4), rng.int(-3, 4), rng.int(-3, 4)];
        const b = add(a, d);
        const k = rng.int(0, 2);
        const bShow = b.map((v, i) => (i === k ? 'k' : String(v))).join(', ');
        const others = [0, 1, 2].filter((i) => i !== k);
        const known = others.map((i) => d[i] as number) as [number, number];
        const restSq = known[0] ** 2 + known[1] ** 2;
        const need = dist * dist - restSq;
        const kSym = b.map((v, i) => (i === k ? 'k' : String(v))).join(', ');
        const sum = 2 * (a[k] as number);
        return {
          q: `두 점 $${pt('A', a)}$, $\\mathrm{B}(${bShow})$ 사이의 거리가 ${dist} 일 때, 가능한 모든 $k$ 의 값의 합을 구하세요.`,
          choices: null,
          answer: String(sum),
          answerType: 'int',
          check: `sum(solve(Eq(${sym(a)}.distance(Point3D(${kSym}))**2, ${dist}**2), k))`,
          concepts: [DIST],
          steps: [
            {
              title: '거리의 제곱으로 식 세우기',
              body: `$$${sq(known[0])}+${sq(known[1])}+(k-${paren(a[k] as number)})^2=${dist}^2$$`,
            },
            {
              title: '아는 부분 계산하기',
              body: `$${restSq}+(k-${paren(a[k] as number)})^2=${dist * dist}$ 이므로 $(k-${paren(a[k] as number)})^2=${need}$ ${ieyo(need)}.`,
            },
            {
              title: '두 값 구하기',
              body: `$k-${paren(a[k] as number)}=\\pm${Math.sqrt(need)}$ 이므로 $k=${(a[k] as number) + Math.sqrt(need)}$ 또는 $k=${(a[k] as number) - Math.sqrt(need)}$ ${ieyo((a[k] as number) - Math.sqrt(need))}.`,
            },
            {
              title: '합',
              body: `$$${(a[k] as number) + Math.sqrt(need)}+${paren((a[k] as number) - Math.sqrt(need))}=${sum}$$`,
            },
          ],
          tip: `두 값은 A 의 좌표 $${a[k] as number}$ 에서 양쪽으로 같은 만큼 떨어져 있어요. 그래서 합은 늘 그 좌표의 두 배예요.`,
        };
      }
      const a: V3 =
        kind === 'origin' ? [0, 0, 0] : [rng.int(-4, 5), rng.int(-4, 5), rng.int(-4, 5)];
      const b = add(a, d);
      const q =
        kind === 'origin'
          ? `원점 O 와 점 $${pt('P', b)}$ 사이의 거리를 구하세요.`
          : `두 점 $${pt('A', a)}$, $${pt('B', b)}$ 사이의 거리를 구하세요.`;
      return {
        q,
        choices: null,
        answer: String(dist),
        answerType: 'int',
        check: `${sym(a)}.distance(${sym(b)})`,
        concepts: [DIST],
        steps: [
          {
            title: '좌표의 차 구하기',
            body: `$x$ 의 차 ${paren(d[0])}, $y$ 의 차 ${paren(d[1])}, $z$ 의 차 ${paren(d[2])} 예요.`,
          },
          {
            title: '제곱해서 더하기',
            body: `$$${sq(d[0])}+${sq(d[1])}+${sq(d[2])}=${d[0] ** 2}+${d[1] ** 2}+${d[2] ** 2}=${dist * dist}$$`,
          },
          { title: '제곱근', body: `$$\\sqrt{${dist * dist}}=${dist}$$` },
        ],
        tip: '바닥의 대각선을 먼저 구하고, 그 대각선과 높이로 한 번 더 피타고라스를 쓴 것과 같아요. 차의 부호는 제곱하면 사라지니 빼는 순서는 상관없어요.',
      };
    },
  },
  {
    id: 'geo-space-coord-symmetric',
    unitId: UNIT,
    title: '좌표평면·축·원점에 대한 대칭점',
    make(rng) {
      const p: V3 = [rng.nonzero(-6, 6), rng.nonzero(-6, 6), rng.nonzero(-6, 6)];
      const kind = rng.pick(['xy', 'yz', 'zx', 'x', 'y', 'z', 'o'] as const);
      const q = p.map((v, i) => (FLIP[kind].includes(i) ? -v : v)) as V3;
      const askLen = kind.length === 2 && rng.next() < 0.4;
      const qTex = `\\mathrm{Q}(${q.join(', ')})`;
      if (askLen) {
        const i = FLIP[kind][0] as number;
        const len = 2 * Math.abs(p[i] as number);
        return {
          q: `점 $${pt('P', p)}$ 를 ${SYM_NAME[kind]}에 대하여 대칭이동한 점을 Q 라 할 때, 선분 PQ 의 길이를 구하세요.`,
          choices: null,
          answer: String(len),
          answerType: 'int',
          check: `${sym(p)}.distance${reflectSym(kind, p)}`,
          concepts: [flipRule(kind), DIST],
          steps: [
            { title: '대칭점 구하기', body: `${flipRule(kind)} $${qTex}$ 예요.` },
            {
              title: '바뀐 좌표만 차이가 나요',
              body: `$${AXIS[i]}$ 좌표만 $${p[i]}\\to${q[i]}$ 처럼 부호가 바뀌었어요.`,
            },
            {
              title: '길이',
              body: `$$\\overline{PQ}=|${p[i]}-${paren(q[i] as number)}|=${len}$$`,
            },
          ],
          tip: `${SYM_NAME[kind]}까지의 거리가 $|${p[i]}|$ 이고, 대칭점은 반대쪽으로 같은 거리에 있으니 그 두 배예요.`,
        };
      }
      const s = q[0] + q[1] + q[2];
      return {
        q: `점 $${pt('P', p)}$ 를 ${SYM_NAME[kind]}에 대하여 대칭이동한 점을 $\\mathrm{Q}(a, b, c)$ 라 할 때, $a+b+c$ 의 값을 구하세요.`,
        choices: null,
        answer: String(s),
        answerType: 'int',
        check: `sum(${reflectSym(kind, p)}.args)`,
        concepts: [flipRule(kind)],
        steps: [
          { title: '부호가 바뀌는 좌표', body: flipRule(kind) },
          { title: '대칭점', body: `$$${qTex}$$` },
          {
            title: '더하기',
            body: `$$${q[0]}+${paren(q[1])}+${paren(q[2])}=${s}$$`,
          },
        ],
        tip: '평면 대칭은 한 개, 축 대칭은 두 개, 원점 대칭은 세 개의 부호가 바뀌어요. 이름에 들어 있는 좌표가 그대로 남는다고 기억하면 쉬워요.',
      };
    },
  },
  {
    id: 'geo-space-coord-section',
    unitId: UNIT,
    title: '내분점과 무게중심의 좌표',
    make(rng) {
      if (rng.next() < 0.3) {
        // 무게중심: 세 좌표의 합이 3 의 배수가 되도록 마지막 점을 0~2 만큼 당겨 맞춘다
        // (무게중심을 먼저 정하고 C 를 거꾸로 구하면 C 의 좌표가 −17 처럼 커져서)
        const A: V3 = [rng.int(-4, 5), rng.int(-4, 5), rng.int(-4, 5)];
        const B: V3 = [rng.int(-4, 5), rng.int(-4, 5), rng.int(-4, 5)];
        const C = [0, 1, 2].map((i) => {
          const c = rng.int(-4, 5);
          const r = ((((A[i] as number) + (B[i] as number) + c) % 3) + 3) % 3;
          return c - r;
        }) as V3;
        const g = [0, 1, 2].map(
          (i) => ((A[i] as number) + (B[i] as number) + (C[i] as number)) / 3,
        ) as V3;
        const s = g[0] + g[1] + g[2];
        return {
          q: `세 점 $${pt('A', A)}$, $${pt('B', B)}$, $${pt('C', C)}$ 를 꼭짓점으로 하는 삼각형 ABC 의 무게중심을 $\\mathrm{G}(a, b, c)$ 라 할 때, $a+b+c$ 의 값을 구하세요.`,
          choices: null,
          answer: String(s),
          answerType: 'int',
          check: `sum(((${sym(A)} + ${sym(B)} + ${sym(C)})/3).args)`,
          concepts: [CENTROID],
          steps: [
            {
              title: '좌표마다 평균',
              body: `$$a=\\frac{${A[0]}+${paren(B[0])}+${paren(C[0])}}{3}=${g[0]},\\quad b=\\frac{${A[1]}+${paren(B[1])}+${paren(C[1])}}{3}=${g[1]},\\quad c=\\frac{${A[2]}+${paren(B[2])}+${paren(C[2])}}{3}=${g[2]}$$`,
            },
            { title: '더하기', body: `$$${g[0]}+${paren(g[1])}+${paren(g[2])}=${s}$$` },
          ],
          tip: '무게중심은 세 점의 좌표를 각각 평균 낸 점이에요. 평면에서와 똑같고 $z$ 좌표가 하나 더 붙을 뿐이에요.',
        };
      }
      const [m, n] = rng.pick([
        [1, 2],
        [2, 1],
        [1, 3],
        [3, 1],
        [2, 3],
        [3, 2],
        [1, 1],
      ] as const);
      const t = m + n;
      const A: V3 = [rng.int(-4, 5), rng.int(-4, 5), rng.int(-4, 5)];
      const step: V3 = [rng.int(-2, 2), rng.int(-2, 2), rng.int(-2, 2)];
      if (step.every((v) => v === 0)) step[0] = 1;
      const B = [0, 1, 2].map((i) => (A[i] as number) + t * (step[i] as number)) as V3;
      const P = [0, 1, 2].map((i) => (A[i] as number) + m * (step[i] as number)) as V3;
      const s = P[0] + P[1] + P[2];
      // '로/으로'는 끝 숫자의 받침으로(일·칠·팔은 ㄹ 받침이라 '로')
      const ro = [0, 3, 6].includes(n) ? '으로' : '로';
      const ratio = m === n ? '선분 AB 의 중점' : `선분 AB 를 ${m}:${n} ${ro} 내분하는 점`;
      const frac = (i: number) =>
        `\\frac{${m}\\cdot${paren(B[i] as number)}+${n}\\cdot${paren(A[i] as number)}}{${t}}=${P[i]}`;
      return {
        q: `두 점 $${pt('A', A)}$, $${pt('B', B)}$ 에 대하여 ${ratio}을 $\\mathrm{P}(a, b, c)$ 라 할 때, $a+b+c$ 의 값을 구하세요.`,
        choices: null,
        answer: String(s),
        answerType: 'int',
        check: `sum((${sym(A)} + Rational(${m}, ${t})*(${sym(B)} - ${sym(A)})).args)`,
        concepts: [SECTION],
        steps: [
          {
            title: '공식은 좌표마다 따로',
            body: `${m === n ? '중점은 $1:1$ 내분점이에요. ' : ''}$m=${m}$, $n=${n}$ 이고, 분자는 $m$ 을 B 쪽, $n$ 을 A 쪽 좌표에 곱해요.`,
          },
          { title: '$x$, $y$ 좌표', body: `$$a=${frac(0)},\\quad b=${frac(1)}$$` },
          { title: '$z$ 좌표', body: `$$c=${frac(2)}$$` },
          { title: '더하기', body: `$$${P[0]}+${paren(P[1])}+${paren(P[2])}=${s}$$` },
        ],
        tip: `가장 흔한 실수는 $m$ 과 $n$ 을 바꿔 곱하는 거예요. P 는 A 에서 B 쪽으로 전체의 $\\frac{${m}}{${t}}$ 만큼 간 자리라는 걸 떠올리면 헷갈리지 않아요.`,
      };
    },
  },
  {
    id: 'geo-space-coord-sphere',
    unitId: UNIT,
    title: '구의 방정식에서 중심과 반지름',
    make(rng) {
      const kind = rng.pick(['radius', 'center', 'cut'] as const);
      let c: V3;
      let r: number;
      let rho = 0;
      if (kind === 'cut') {
        // xy평면으로 자른 단면: 중심의 높이 |c|, 단면 반지름 ρ, 구 반지름 r 이 직각삼각형
        const [p, q2, hyp] = rng.pick([
          [3, 4, 5],
          [4, 3, 5],
          [5, 12, 13],
          [12, 5, 13],
          [6, 8, 10],
          [8, 6, 10],
        ] as const);
        c = [rng.int(-4, 4), rng.int(-4, 4), rng.next() < 0.5 ? -p : p];
        r = hyp;
        rho = q2;
      } else {
        c = [rng.int(-5, 5), rng.int(-5, 5), rng.int(-5, 5)];
        if (c.filter((v) => v !== 0).length < 2) c = [c[0] || 2, c[1] || -1, c[2]];
        r = rng.int(1, 7);
      }
      const D = -2 * c[0];
      const E = -2 * c[1];
      const F = -2 * c[2];
      const G = c[0] ** 2 + c[1] ** 2 + c[2] ** 2 - r * r;
      const eq = sphereTex(D, E, F, G);
      const head = sphereHead(sphereSym(D, E, F, G));
      const cs = c[0] ** 2 + c[1] ** 2 + c[2] ** 2;
      const complete = {
        title: '완전제곱식으로 묶기',
        body: `$x$, $y$, $z$ 끼리 묶어 완전제곱식을 만들면\n$$${shiftTex('x', c[0])}+${shiftTex('y', c[1])}+${shiftTex('z', c[2])}=${cs}${G === 0 ? '' : G > 0 ? `-${G}` : `+${-G}`}=${r * r}$$`,
      };
      if (kind === 'radius')
        return {
          q: `구 $${eq}$ 의 반지름의 길이를 구하세요.`,
          choices: null,
          answer: String(r),
          answerType: 'int',
          check: `${head}\nans = sqrt(r2)`,
          concepts: [SPHERE],
          steps: [
            complete,
            { title: '반지름', body: `$r^2=${r * r}$ 이므로 $r=${r}$ ${ieyo(r)}.` },
          ],
          tip: '오른쪽 수는 $r^2$ 이에요. 제곱근을 빠뜨리지 마세요. 또 상수항을 오른쪽으로 옮길 때 부호가 바뀌어요.',
        };
      if (kind === 'center') {
        const s = c[0] + c[1] + c[2];
        return {
          q: `구 $${eq}$ 의 중심의 좌표를 $(a, b, c)$ 라 할 때, $a+b+c$ 의 값을 구하세요.`,
          choices: null,
          answer: String(s),
          answerType: 'int',
          check: `${head}\nans = sum(cen)`,
          concepts: [SPHERE],
          steps: [
            complete,
            {
              title: '중심 읽기',
              body: `중심은 $(${c.join(', ')})$ ${ieyo(c[2])}. 괄호 안 부호와 반대예요.`,
            },
            { title: '더하기', body: `$$${c[0]}+${paren(c[1])}+${paren(c[2])}=${s}$$` },
          ],
          tip: '$x$ 의 계수를 $-2$ 로 나누면 중심의 $x$ 좌표가 바로 나와요. $y$, $z$ 도 같아요.',
        };
      }
      return {
        q: `구 $${eq}$ 과 $xy$평면이 만나서 생기는 원의 반지름의 길이를 구하세요.`,
        choices: null,
        answer: String(rho),
        answerType: 'int',
        check: `${head}\nans = sqrt(r2 - cen[2]**2)`,
        concepts: [SPHERE, '구의 중심에서 평면에 내린 수선은 단면인 원의 중심을 지나요.'],
        steps: [
          complete,
          {
            title: '중심과 반지름',
            body: `중심은 $(${c.join(', ')})$, 반지름은 ${r} 이고, 중심에서 $xy$평면까지의 거리는 $|z|=${Math.abs(c[2])}$ ${ieyo(Math.abs(c[2]))}.`,
          },
          {
            title: '단면은 직각삼각형으로',
            body: `구의 반지름이 빗변, 중심까지의 거리와 단면의 반지름이 두 변이에요.\n$$\\sqrt{${r}^2-${Math.abs(c[2])}^2}=\\sqrt{${r * r - c[2] * c[2]}}=${rho}$$`,
          },
        ],
        tip: `방정식에 $z=0$ 을 넣고 정리해도 같은 원이 나와요. 그 원의 반지름의 제곱이 ${rho * rho} ${ieyo(rho * rho)}.`,
      };
    },
  },
];
