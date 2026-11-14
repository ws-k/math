import type { Generator } from './types.ts';
import { fracAns, fracTex, gcd } from './util.ts';

const UNIT = 'math1-trig-graph';

// 각은 "도" 정수로 들고 다니다가 글자로 바꿀 때만 π 로 적는다(30·45 의 배수라 늘 깔끔한 분수).
// 검산식은 sympy 의 sin·cos·tan·solveset 으로 문제 조건에서 직접 계산하고, 풀이는 사람이 손으로 하는
// 경로(기준각 → 사분면 부호)로 쓴다 — 두 길이 어긋나면 검산에서 잡힌다.

type Fn = 'sin' | 'cos' | 'tan';

/** '이에요/예요' — 값이 무작위라 끝 글자로 고른다(숫자 일·삼·육·칠·팔·영/십은 받침, π·x 는 받침 없음) */
const ieyo = (s: string) => (/[013678]$/.test(s) ? '이에요' : '예요');
/** 목록 끝 항목의 끝소리로 '은/는'. "$-1$" 처럼 숫자로 끝나면 숫자 받침, π 분수($…}$)는 '파이'라 받침 없음 */
const eun = (items: string[]) => (/[013678]\$$/.test(items[items.length - 1] ?? '') ? '은' : '는');
/** 분수 a/b 는 "b분의 a" 로 읽어 분자가 끝소리다 */
const ieyoFrac = (n: number, d: number) => ieyo(String(Math.abs(n / gcd(n, d))));

/** 도 → π 의 분수 TeX (150 → \frac{5\pi}{6}). 부호는 앞에 */
function angTex(deg: number): string {
  if (deg === 0) return '0';
  const sign = deg < 0 ? '-' : '';
  const a = Math.abs(deg);
  const g = gcd(a, 180);
  const n = a / g;
  const d = 180 / g;
  const top = n === 1 ? '\\pi' : `${n}\\pi`;
  return sign + (d === 1 ? top : `\\frac{${top}}{${d}}`);
}
/** 도 → sympy 식 (150 → 5*pi/6) */
function angSym(deg: number): string {
  if (deg === 0) return '0';
  const g = gcd(Math.abs(deg), 180);
  return `${deg / g}*pi/${180 / g}`;
}

/** 함수 기호 뒤에 각을 붙인 TeX. 분수·음수 각은 괄호로 감싼다 */
function fnAt(f: Fn, deg: number): string {
  const t = angTex(deg);
  return deg < 0 ? `\\${f}\\left(${t}\\right)` : `\\${f}${t.startsWith('\\frac') ? '' : ' '}${t}`;
}

// ---- 1. 최댓값·최솟값·주기 ----

/** 계수 a 를 함수 앞에: 1 → "", -1 → "-", 3 → "3" */
const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : String(a));
const signed = (n: number) => (n === 0 ? '' : n < 0 ? String(n) : `+${n}`);

// ---- 2. π±θ 로 값 구하기 ----

/** 기준값(1사분면 예각의 값)을 [분자, 분모] 로. sin30·cos60 = 1/2, tan45 = 1 */
const BASE: Record<Fn, { ref: number; v: [number, number] }> = {
  sin: { ref: 30, v: [1, 2] },
  cos: { ref: 60, v: [1, 2] },
  tan: { ref: 45, v: [1, 1] },
};

/** π±θ·2π−θ·−θ·2π+θ 로 바꾸는 한 줄과 부호. θ 는 기준각 */
function reduceAngle(f: Fn, deg: number): { tex: string; sign: number; why: string } {
  const r = BASE[f].ref;
  const T = angTex(r);
  const flip = (s: boolean) => (s ? -1 : 1);
  if (deg < 0) {
    const sign = flip(f !== 'cos');
    return {
      tex: `${fnAt(f, deg)}=${sign < 0 ? '-' : ''}${fnAt(f, r)}`,
      sign,
      why: `$\\${f}(-\\theta)=${sign < 0 ? '-' : ''}\\${f}\\theta$`,
    };
  }
  if (deg >= 360)
    return {
      tex: `${fnAt(f, deg)}=\\${f}\\left(2\\pi+${T}\\right)=${fnAt(f, r)}`,
      sign: 1,
      why: `$2\\pi$ 를 더해도 값이 같아요`,
    };
  if (deg < 180) {
    const sign = flip(f !== 'sin');
    return {
      tex: `${fnAt(f, deg)}=\\${f}\\left(\\pi-${T}\\right)=${sign < 0 ? '-' : ''}${fnAt(f, r)}`,
      sign,
      why: `$\\${f}(\\pi-\\theta)=${sign < 0 ? '-' : ''}\\${f}\\theta$`,
    };
  }
  if (deg < 270) {
    const sign = flip(f !== 'tan');
    return {
      tex: `${fnAt(f, deg)}=\\${f}\\left(\\pi+${T}\\right)=${sign < 0 ? '-' : ''}${fnAt(f, r)}`,
      sign,
      why: `$\\${f}(\\pi+\\theta)=${sign < 0 ? '-' : ''}\\${f}\\theta$`,
    };
  }
  const sign = flip(f !== 'cos');
  return {
    tex: `${fnAt(f, deg)}=\\${f}\\left(2\\pi-${T}\\right)=${sign < 0 ? '-' : ''}${fnAt(f, r)}`,
    sign,
    why: `$\\${f}(2\\pi-\\theta)=${sign < 0 ? '-' : ''}\\${f}\\theta$`,
  };
}

// 1사분면 각은 바로 외운 값이라 연습이 안 되므로 넣지 않는다. 음수 각·2π 를 넘는 각도 섞는다.
const ANGLES: Record<Fn, number[]> = {
  sin: [150, 210, 330, 390, -30],
  cos: [120, 240, 300, 420, -60],
  tan: [135, 225, 315, -45],
};

// ---- 3. 삼각방정식 ----

/** 기준각 표(1사분면 예각 → 값). 값은 ±√r / D 꼴 */
const EQS: { f: Fn; ref: number; r: number; D: number }[] = [
  { f: 'sin', ref: 30, r: 1, D: 2 },
  { f: 'sin', ref: 60, r: 3, D: 2 },
  { f: 'sin', ref: 45, r: 2, D: 2 },
  { f: 'cos', ref: 60, r: 1, D: 2 },
  { f: 'cos', ref: 30, r: 3, D: 2 },
  { f: 'cos', ref: 45, r: 2, D: 2 },
  { f: 'tan', ref: 45, r: 1, D: 1 },
  { f: 'tan', ref: 60, r: 3, D: 1 },
  { f: 'tan', ref: 30, r: 3, D: 3 },
];

/** 값의 부호에 맞는 사분면 두 개. sin + 는 1·2, cos + 는 1·4, tan + 는 1·3 */
function quadrants(f: Fn, pos: boolean): [number, number] {
  if (f === 'sin') return pos ? [1, 2] : [3, 4];
  if (f === 'cos') return pos ? [1, 4] : [2, 3];
  return pos ? [1, 3] : [2, 4];
}
const inQuad = (q: number, r: number) => [r, 180 - r, 180 + r, 360 - r][q - 1] as number;
const rootTex = (r: number) => (r === 1 ? '1' : `\\sqrt{${r}}`);
const rootSym = (r: number) => (r === 1 ? '1' : `sqrt(${r})`);

export const generators: Generator[] = [
  {
    id: 'tgr-max-min-period',
    unitId: UNIT,
    title: '최댓값·최솟값·주기',
    make(rng) {
      const f = rng.pick(['sin', 'cos'] as const);
      const a = rng.pick([1, 2, 3, 4]) * rng.pick([1, -1]);
      // b 가 분수면 x/2 꼴로 적고, c(좌우 이동)는 정수 b 에만 붙인다 — 분수 안의 이동은 글자가 복잡해진다
      const [bn, bd] = rng.pick([
        [2, 1],
        [3, 1],
        [4, 1],
        [1, 2],
        [1, 3],
      ] as const);
      const c = bd === 1 ? rng.pick([0, 60, -45, 30, -90]) : 0;
      const d = rng.int(-3, 3);
      const bx = bd === 1 ? `${bn}x` : `\\frac{x}{${bd}}`;
      const bxSym = bd === 1 ? `${bn}*x` : `x/${bd}`;
      const inner = c === 0 ? bx : `${bx}${c < 0 ? '' : '+'}${angTex(c)}`;
      const innerSym = c === 0 ? bxSym : `${bxSym}+(${angSym(c)})`;
      // 괄호는 이동(c)이 있을 때만. x/3 처럼 분수 하나면 괄호 없이 붙인다
      const arg = c !== 0 ? `\\left(${inner}\\right)` : bd === 1 ? ` ${inner}` : inner;
      const yTex = `y=${coef(a)}\\${f}${arg}${signed(d)}`;
      const ySym = `${a}*${f}(${innerSym})+(${d})`;
      const A = Math.abs(a);
      const rangeSteps = [
        { title: `$\\${f}$ 의 범위`, body: `각이 무엇이든 $-1\\le\\${f}${arg}\\le1$ 이에요.` },
        {
          title: `$${a}$ 곱하기`,
          body:
            a < 0
              ? `음수를 곱하면 위아래가 뒤집히지만 범위는 $-${A}$ 부터 $${A}$ 까지 그대로예요.`
              : `$${A}$ 배로 늘리면 $-${A}$ 부터 $${A}$ 까지예요.`,
        },
      ];
      const kind = rng.int(0, 2);
      if (kind === 2) {
        // 주기 2π/|b| 를 pπ 로: p = 2/b
        const [pn, pd] = [2 * bd, bn];
        const p = fracAns(pn, pd);
        const others = [
          ...(a === 1 ? [] : [`앞에 곱한 $${a}$`]),
          ...(d === 0 ? [] : [`뒤에 더한 $${d}$`]),
          ...(c === 0 ? [] : [`괄호 속 $${angTex(c)}$`]),
        ];
        return {
          q: `함수 $${yTex}$ 의 주기가 $p\\pi$ 일 때, $p$ 의 값을 구하세요.`,
          choices: null,
          answer: p,
          answerType: 'fraction',
          check: `periodicity(${ySym}, x)/pi`,
          concepts: ['$y=a\\sin(bx+c)+d$, $y=a\\cos(bx+c)+d$ 의 주기는 $\\dfrac{2\\pi}{|b|}$'],
          steps: [
            {
              title: '$x$ 의 계수 찾기',
              body: `$x$ 앞에 곱해진 수는 $${fracTex(bn, bd)}$ ${ieyoFrac(bn, bd)}.`,
            },
            {
              title: '주기 공식',
              body: `$$\\frac{2\\pi}{${fracTex(bn, bd)}}=${fracTex(pn, pd) === '1' ? '' : fracTex(pn, pd)}\\pi$$`,
            },
            {
              title: '$p$ 의 값',
              body: `$p=${fracTex(pn, pd)}$ ${ieyoFrac(pn, pd)}.`,
            },
          ],
          tip: `주기는 $x$ 의 계수만 봐요.${others.length ? ` ${others.join(', ')}${eun(others)} 주기와 상관없어요.` : ''}`,
        };
      }
      const max = kind === 0;
      const ans = max ? A + d : -A + d;
      return {
        q: `함수 $${yTex}$ 의 ${max ? '최댓값' : '최솟값'}을 구하세요.`,
        choices: null,
        answer: String(ans),
        answerType: 'int',
        check: `${max ? 'maximum' : 'minimum'}(${ySym}, x)`,
        concepts: ['$y=a\\sin(bx+c)+d$ 의 최댓값은 $|a|+d$, 최솟값은 $-|a|+d$'],
        steps: [
          ...rangeSteps,
          {
            title: `$${d}$ 더하기`,
            body:
              d === 0
                ? `더하는 수가 없어 ${max ? '최댓값' : '최솟값'}은 $${ans}$ ${ieyo(String(Math.abs(ans)))}.`
                : `$$${max ? A : -A}${signed(d)}=${ans}$$`,
          },
        ],
        tip: `$a$ 가 음수여도 ${max ? '최댓값은 $|a|+d$' : '최솟값은 $-|a|+d$'} 예요. $x$ 의 계수나 괄호 속 수는 그래프를 좌우로 늘이거나 옮길 뿐 높이와는 상관없어요.`,
      };
    },
  },
  {
    id: 'tgr-reduce-value',
    unitId: UNIT,
    title: '$\\pi\\pm\\theta$ 로 값 구하기',
    make(rng) {
      for (;;) {
        const A = rng.pick(ANGLES.sin);
        const g = rng.pick(['cos', 'tan'] as const);
        const B = rng.pick(ANGLES[g]);
        const k1 = rng.int(1, 4);
        const k2 = rng.int(1, 4);
        const ra = reduceAngle('sin', A);
        const rb = reduceAngle(g, B);
        const [an, ad] = BASE.sin.v;
        const [bn, bd] = BASE[g].v;
        // k1·(±1/2) + k2·(±b) 를 분수로
        const num = k1 * ra.sign * an * bd + k2 * rb.sign * bn * ad;
        const den = ad * bd;
        if (num === 0) continue;
        const va = fracTex(ra.sign * an, ad);
        const vb = fracTex(rb.sign * bn, bd);
        const term = (k: number, t: string) => (k === 1 ? t : `${k}${t}`);
        return {
          q: `$${term(k1, fnAt('sin', A))}+${term(k2, fnAt(g, B))}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(num, den),
          answerType: 'fraction',
          check: `${k1}*sin(${angSym(A)}) + ${k2}*${g}(${angSym(B)})`,
          concepts: [
            '$\\sin(\\pi\\pm\\theta)=\\mp\\sin\\theta$, $\\cos(\\pi\\pm\\theta)=-\\cos\\theta$, $\\tan(\\pi\\pm\\theta)=\\pm\\tan\\theta$',
            '$\\sin(-\\theta)=-\\sin\\theta$, $\\cos(-\\theta)=\\cos\\theta$, $\\tan(-\\theta)=-\\tan\\theta$',
          ],
          steps: [
            { title: '앞의 값', body: `${ra.why}.\n$$${ra.tex}=${va}$$` },
            { title: '뒤의 값', body: `${rb.why}.\n$$${rb.tex}=${vb}$$` },
            {
              title: '계산하기',
              body: `$$${k1 === 1 ? '' : `${k1}\\cdot`}\\left(${va}\\right)+${k2 === 1 ? '' : `${k2}\\cdot`}\\left(${vb}\\right)=${fracTex(num, den)}$$`,
            },
          ],
          tip: '각을 예각 $\\theta$ 와 $\\pi$, $2\\pi$ 로 나눠 적고, 부호는 그 각이 있는 사분면에서 정해요.',
        };
      }
    },
  },
  {
    id: 'tgr-eq-sum',
    unitId: UNIT,
    title: '삼각방정식의 해',
    make(rng) {
      const e = rng.pick(EQS);
      const pos = rng.pick([true, false]);
      const [q1, q2] = quadrants(e.f, pos);
      const s1 = inQuad(q1, e.ref);
      const s2 = inQuad(q2, e.ref);
      // 식 모양: D·f(x)=±√r 또는 D·f(x)∓√r=0
      const lhs = `${e.D === 1 ? '' : e.D}\\${e.f} x`;
      const R = rootTex(e.r);
      const eqTex =
        rng.int(0, 1) === 0 ? `${lhs}=${pos ? '' : '-'}${R}` : `${lhs}${pos ? '-' : '+'}${R}=0`;
      const eqSym = `Eq(${e.D}*${e.f}(x), ${pos ? '' : '-'}${rootSym(e.r)})`;
      const valTex = `${pos ? '' : '-'}${e.D === 1 ? R : `\\frac{${R}}{${e.D}}`}`;
      const set = 'Interval.Ropen(0, 2*pi)';
      const sum = rng.int(0, 1) === 0;
      const [pn, pd] = sum ? [s1 + s2, 180] : [Math.abs(s2 - s1), 180];
      const p = fracAns(pn, pd);
      const ansTex = fracTex(pn, pd);
      const sign = pos ? '양수' : '음수';
      const quadName = (q: number) => `제${q}사분면`;
      return {
        q: `$0\\le x<2\\pi$ 에서 방정식 $${eqTex}$ 의 ${sum ? '모든 해의 합이' : '가장 큰 해와 가장 작은 해의 차가'} $p\\pi$ 일 때, $p$ 의 값을 구하세요.`,
        choices: null,
        answer: p,
        answerType: 'fraction',
        check: sum
          ? `sum(solveset(${eqSym}, x, ${set}))/pi`
          : `s = solveset(${eqSym}, x, ${set})\nans = (Max(*s) - Min(*s))/pi`,
        concepts: [
          '기준각(예각)을 먼저 찾고, 값의 부호로 사분면을 골라요.',
          '$\\sin$ 은 1·2사분면, $\\cos$ 은 1·4사분면, $\\tan$ 은 1·3사분면에서 양수예요.',
        ],
        steps: [
          { title: `$\\${e.f} x$ 의 값`, body: `$$\\${e.f} x=${valTex}$$` },
          {
            title: '기준각',
            body: `$\\${e.f}\\theta=${e.D === 1 ? R : `\\frac{${R}}{${e.D}}`}$ 인 예각은 $\\theta=${angTex(e.ref)}$ 예요.`,
          },
          {
            title: '사분면 고르기',
            body: `값이 ${sign}라 ${quadName(q1)}과 ${quadName(q2)}이에요.\n$$x=${angTex(s1)},\\ ${angTex(s2)}$$`,
          },
          {
            title: sum ? '합' : '차',
            body: `$$${sum ? `${angTex(s1)}+${angTex(s2)}` : `${angTex(s2)}-${angTex(s1)}`}=${ansTex === '1' ? '' : ansTex}\\pi$$\n그래서 $p=${ansTex}$ ${ieyoFrac(pn, pd)}.`,
          },
        ],
        tip:
          e.f === 'tan'
            ? '$\\tan$ 은 주기가 $\\pi$ 라 $0\\le x<2\\pi$ 에서 해가 $\\pi$ 간격으로 두 개예요. 하나만 쓰면 해를 빠뜨려요.'
            : '단위원에서 같은 높이(또는 같은 가로 위치)의 점은 늘 두 개예요. 하나만 쓰면 해를 빠뜨려요.',
      };
    },
  },
];
