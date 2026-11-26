import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { eul, paren } from './util.ts';

const UNIT = 'h1-transform';

const PT = '점의 평행이동: $(x,y)\\to(x+m,y+n)$ 이에요.';
const FIG =
  '도형 $f(x,y)=0$ 을 $x$축 방향으로 $m$, $y$축 방향으로 $n$ 만큼 평행이동하면 $f(x-m,y-n)=0$ 이에요.';
const SYM =
  '$x$축 대칭 $(a,-b)$, $y$축 대칭 $(-a,b)$, 원점 대칭 $(-a,-b)$, $y=x$ 대칭 $(b,a)$ 예요.';

/** 식 중간 항: +3 / −3 */
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
/** 계수 붙은 항: 1·x → +x, −1·x → −x, 0 → 빈 글자 */
const term = (k: number, v: string) =>
  k === 0 ? '' : `${k < 0 ? '-' : '+'}${Math.abs(k) === 1 ? '' : Math.abs(k)}${v}`;
/** (x−a) 꼴: a=0 이면 x, a<0 이면 x+|a| */
const shift = (v: string, a: number) => (a === 0 ? v : `(${v}${signed(-a)})`);

type Mirror = 'x' | 'y' | 'o' | 'yx';
const MIRROR_NAME: Record<Mirror, string> = {
  x: '$x$축',
  y: '$y$축',
  o: '원점',
  yx: '직선 $y=x$',
};
/** 대칭이동한 점 */
function mirror(k: Mirror, a: number, b: number): [number, number] {
  if (k === 'x') return [a, -b];
  if (k === 'y') return [-a, b];
  if (k === 'o') return [-a, -b];
  return [b, a];
}
/** 대칭이동의 규칙(점) 한 줄 */
const MIRROR_RULE: Record<Mirror, string> = {
  x: '$x$축 대칭은 $y$좌표의 부호만 바꿔요.',
  y: '$y$축 대칭은 $x$좌표의 부호만 바꿔요.',
  o: '원점 대칭은 두 좌표의 부호를 모두 바꿔요.',
  yx: '$y=x$ 대칭은 두 좌표의 자리를 바꿔요.',
};
/** 같은 대칭이동을 sympy 식 글자로(검산이 내 계산을 베끼지 않게 규칙에서 따로 만든다) */
function mirrorSym(k: Mirror, a: number, b: number): [string, string] {
  const A = paren(a);
  const B = paren(b);
  if (k === 'x') return [A, `-${B}`];
  if (k === 'y') return [`-${A}`, B];
  if (k === 'o') return [`-${A}`, `-${B}`];
  return [B, A];
}

function nz(rng: Rng, lo: number, hi: number): number {
  return rng.nonzero(lo, hi);
}

/** 맨 앞 계수: 1·x → x, −1·x → −x */
const lead = (k: number, v: string) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);

export const generators: Generator[] = [
  {
    id: 'tr-translate-point',
    unitId: UNIT,
    title: '점의 평행이동',
    make(rng) {
      const a = rng.int(-6, 6);
      const b = rng.int(-6, 6);
      const m = nz(rng, -5, 5);
      const n = nz(rng, -5, 5);
      const p = a + m;
      const q = b + n;
      return {
        q: `점 $(${a},${b})$ ${eul(b)} $x$축 방향으로 $${m}$ 만큼, $y$축 방향으로 $${n}$ 만큼 평행이동한 점을 $(p,q)$ 라 할 때, $p+2q$ 의 값을 구하세요.`,
        choices: null,
        answer: String(p + 2 * q),
        answerType: 'int',
        check: `(${a}+${paren(m)}) + 2*(${b}+${paren(n)})`,
        concepts: [PT],
        steps: [
          { title: '$x$좌표', body: `$p=${a}${signed(m)}=${p}$ 이에요.` },
          { title: '$y$좌표', body: `$q=${b}${signed(n)}=${q}$ 이에요.` },
          { title: '계산하기', body: `$p+2q=${p}+2\\cdot${paren(q)}=${p + 2 * q}$ 이에요.` },
        ],
        tip: '점을 옮길 때는 옮긴 만큼 그대로 더해요. 식을 옮길 때와 부호가 반대예요.',
      };
    },
  },
  {
    id: 'tr-reflect-point',
    unitId: UNIT,
    title: '점의 대칭이동',
    make(rng) {
      const k = rng.pick(['x', 'y', 'o', 'yx'] as const);
      let a: number;
      let b: number;
      do {
        a = nz(rng, -6, 6);
        b = nz(rng, -6, 6);
      } while (a === b);
      const [p, q] = mirror(k, a, b);
      const [ps, qs] = mirrorSym(k, a, b);
      return {
        q: `점 $(${a},${b})$ ${eul(b)} ${MIRROR_NAME[k]}에 대하여 대칭이동한 점을 $(p,q)$ 라 할 때, $p+2q$ 의 값을 구하세요.`,
        choices: null,
        answer: String(p + 2 * q),
        answerType: 'int',
        check: `(${ps}) + 2*(${qs})`,
        concepts: [SYM],
        steps: [
          { title: '대칭이동', body: `${MIRROR_RULE[k]}\n$$(${a},${b})\\to(${p},${q})$$` },
          { title: '계산하기', body: `$p+2q=${p}+2\\cdot${paren(q)}=${p + 2 * q}$ 이에요.` },
        ],
        tip: '좌표평면에 점을 찍고 거울에 비친 자리를 그려 보면 헷갈리지 않아요.',
      };
    },
  },
  {
    id: 'tr-translate-line',
    unitId: UNIT,
    title: '직선의 평행이동',
    make(rng) {
      const s = nz(rng, -4, 4);
      const k = rng.int(-6, 6);
      const m = nz(rng, -4, 4);
      const n = nz(rng, -4, 4);
      const ny = -s * m + k + n;
      const line = `y=${s === 1 ? '' : s === -1 ? '-' : s}x${k === 0 ? '' : signed(k)}`;
      return {
        q: `직선 $${line}$ ${k === 0 ? '를' : eul(k)} $x$축 방향으로 $${m}$ 만큼, $y$축 방향으로 $${n}$ 만큼 평행이동한 직선의 $y$절편을 구하세요.`,
        choices: null,
        answer: String(ny),
        answerType: 'int',
        check: `solve(Eq(y-${paren(n)}, ${s}*(0-${paren(m)})+${paren(k)}), y)[0]`,
        concepts: [FIG],
        steps: [
          {
            title: '반대 부호로 넣기',
            body: `$x$ 대신 $x-${paren(m)}$, $y$ 대신 $y-${paren(n)}$ ${eul(n)} 넣어요.\n$$y-${paren(n)}=${lead(s, '')}\\left(x-${paren(m)}\\right)${k === 0 ? '' : signed(k)}$$`,
          },
          {
            title: '$x=0$ 넣기',
            body: `$$y=${s}\\cdot${paren(-m)}${k === 0 ? '' : signed(k)}${signed(n)}=${ny}$$`,
          },
        ],
        tip: '기울기는 평행이동해도 그대로예요. 바뀌는 것은 위치뿐이에요.',
      };
    },
  },
  {
    id: 'tr-move-circle',
    unitId: UNIT,
    title: '원의 이동',
    make(rng) {
      const a = nz(rng, -4, 4);
      const b = nz(rng, -4, 4);
      const r = rng.int(1, 5);
      const kind = rng.pick(['t', 'x', 'y', 'o', 'yx'] as const);
      let p: number;
      let q: number;
      let how: string;
      let sub: string;
      let rule: string;
      if (kind === 't') {
        const m = nz(rng, -4, 4);
        const n = nz(rng, -4, 4);
        [p, q] = [a + m, b + n];
        how = `$x$축 방향으로 $${m}$ 만큼, $y$축 방향으로 $${n}$ 만큼 평행이동한`;
        // 도형의 평행이동 규칙(x→x−m, y→y−n)을 식에 그대로 적용해 검산한다
        sub = `((x-${paren(m)})-${paren(a)})**2+((y-${paren(n)})-${paren(b)})**2-${r * r}`;
        rule = `중심 $(${a},${b})$ 를 옮기면 $(${p},${q})$ 예요.`;
      } else {
        [p, q] = mirror(kind, a, b);
        how = `${MIRROR_NAME[kind]}에 대하여 대칭이동한`;
        const X = kind === 'y' || kind === 'o' ? '(-x)' : kind === 'yx' ? 'y' : 'x';
        const Y = kind === 'x' || kind === 'o' ? '(-y)' : kind === 'yx' ? 'x' : 'y';
        sub = `(${X}-${paren(a)})**2+(${Y}-${paren(b)})**2-${r * r}`;
        rule = `${MIRROR_RULE[kind]} 중심 $(${a},${b})\\to(${p},${q})$ 예요.`;
      }
      const A = -2 * p;
      const B = -2 * q;
      return {
        q: `원 $${shift('x', a)}^2+${shift('y', b)}^2=${r * r}$ ${eul(r * r)} ${how} 원의 방정식을 $x^2+y^2+Ax+By+C=0$ 이라 할 때, $A+B$ 의 값을 구하세요.`,
        choices: null,
        answer: String(A + B),
        answerType: 'int',
        check: `e0 = expand(${sub})\nans = e0.coeff(x, 1) + e0.coeff(y, 1)`,
        concepts: [kind === 't' ? PT : SYM, '원을 옮기면 중심만 옮겨지고 반지름은 그대로예요.'],
        steps: [
          { title: '중심 옮기기', body: rule },
          {
            title: '옮긴 원',
            body: `$$${shift('x', p)}^2+${shift('y', q)}^2=${r * r}$$`,
          },
          {
            title: '일차항만 보기',
            body: `전개하면 $x$ 의 계수는 $-2\\cdot${paren(p)}=${A}$, $y$ 의 계수는 $-2\\cdot${paren(q)}=${B}$ 이에요.`,
          },
          { title: '더하기', body: `$A+B=${A}${signed(B)}=${A + B}$ 이에요.` },
        ],
        tip: `전개한 식은 $x^2+y^2${term(A, 'x')}${term(B, 'y')}${p * p + q * q === r * r ? '' : signed(p * p + q * q - r * r)}=0$ 이에요.`,
      };
    },
  },
];
