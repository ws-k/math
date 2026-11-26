import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { ieyo, iga, ira, paren } from './util.ts';

const UNIT = 'geo-parabola';

// 검산은 풀이와 다른 길로 계산한다: 초점·준선은 '4p = 계수' 를 sympy solve 로 풀고, 방정식 만들기는
// 정의(초점까지 거리² = 준선까지 거리²)를 sympy 가 전개해 계수를 읽으며, 초점까지 거리는 두 점 사이 거리로 잰다.
// 풀이 공식(초점 (p,0), PF = x+p)을 그대로 다시 적으면 공식을 잘못 옮겼을 때 함께 틀려 검산이 무력해지기 때문이다.

const DEF = '포물선: 한 점(초점)과 한 직선(준선)에서 거리가 같은 점들의 모임이에요.';
const STD_Y = '$y^2=4px$ 의 초점은 $(p,0)$, 준선은 $x=-p$ 예요.';
const STD_X = '$x^2=4py$ 의 초점은 $(0,p)$, 준선은 $y=-p$ 예요.';
const FOCAL = '포물선 위의 점에서 초점까지 거리는 준선까지 거리와 같아요.';
const SHIFT =
  '$(y-n)^2=4p(x-m)$ 은 $y^2=4px$ 를 $x$ 축으로 $m$, $y$ 축으로 $n$ 만큼 평행이동한 거예요.';

/** 식 중간 항: +3 / −3 */
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
/** (y−n) 꼴: n=0 이면 y, n<0 이면 y+|n| */
const shift = (v: string, n: number) => (n === 0 ? v : `(${v}${signed(-n)})`);
/** 계수 붙은 항: 1·x → x, −1·x → −x */
const lead = (k: number, v: string) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);

/** 0 이 아닌 p 를 고르되 부호는 반반 */
const pickP = (rng: Rng, lo: number, hi: number) => {
  const p = rng.int(lo, hi);
  return rng.next() < 0.5 ? -p : p;
};

function focusProblem(rng: Rng): GenProblem {
  const p = pickP(rng, 1, 6);
  const K = 4 * p;
  const sideways = rng.next() < 0.5;
  const eq = sideways ? `y^2=${lead(K, 'x')}` : `x^2=${lead(K, 'y')}`;
  const find = {
    title: '$4p$ 맞추기',
    body: `$${sideways ? 'y^2=4px' : 'x^2=4py'}$ 와 비교하면 $4p=${K}$ 이므로 $p=${p}$ ${ieyo(p)}.`,
  };
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const pt = sideways ? '(a,\\ 0)' : '(0,\\ a)';
    return {
      q: `포물선 $${eq}$ 의 초점의 좌표가 $${pt}$ 일 때, $a$ 의 값을 구하세요.`,
      choices: null,
      answer: String(p),
      answerType: 'int',
      check: `solve(Eq(4*p, ${K}), p)[0]`,
      concepts: [sideways ? STD_Y : STD_X],
      steps: [
        find,
        {
          title: '초점 읽기',
          body: `초점은 $${sideways ? `(${p},\\ 0)` : `(0,\\ ${p})`}$ 이므로 $a=${p}$ ${ieyo(p)}.`,
        },
      ],
      tip:
        p < 0
          ? `$p$ 가 음수라 포물선이 ${sideways ? '왼쪽' : '아래'}으로 열려요. 초점은 늘 포물선이 열린 쪽 안에 있어요.`
          : `초점은 늘 포물선이 열린 쪽 안에 있어요. 계수 $${K}$ 를 $4$ 로 나누는 걸 잊지 마세요.`,
    };
  }
  if (kind === 1) {
    const v = sideways ? 'x' : 'y';
    return {
      q: `포물선 $${eq}$ 의 준선의 방정식이 $${v}=k$ 일 때, $k$ 의 값을 구하세요.`,
      choices: null,
      answer: String(-p),
      answerType: 'int',
      check: `-solve(Eq(4*p, ${K}), p)[0]`,
      concepts: [sideways ? STD_Y : STD_X],
      steps: [
        find,
        {
          title: '준선 읽기',
          body: `준선은 초점과 꼭짓점을 사이에 두고 반대편이라 $${v}=-p=${-p}$ ${ieyo(-p)}. 그래서 $k=${-p}$ ${ieyo(-p)}.`,
        },
      ],
      tip: '꼭짓점(원점)은 초점과 준선의 한가운데 있어요. 그래서 초점과 준선은 부호가 반대예요.',
    };
  }
  return {
    q: `포물선 $${eq}$ 의 초점과 준선 사이의 거리를 구하세요.`,
    choices: null,
    answer: String(2 * Math.abs(p)),
    answerType: 'int',
    check: `2*Abs(solve(Eq(4*p, ${K}), p)[0])`,
    concepts: [sideways ? STD_Y : STD_X],
    steps: [
      find,
      {
        title: '초점과 준선',
        body: sideways
          ? `초점은 $(${p},\\ 0)$, 준선은 $x=${-p}$ ${ieyo(-p)}.`
          : `초점은 $(0,\\ ${p})$, 준선은 $y=${-p}$ ${ieyo(-p)}.`,
      },
      {
        title: '거리 재기',
        body: `꼭짓점에서 양쪽으로 $|p|$ 씩이라 거리는 $2\\times${Math.abs(p)}=${2 * Math.abs(p)}$ ${ieyo(2 * Math.abs(p))}.`,
      },
    ],
    tip: '거리는 음수가 아니에요. $p$ 가 음수여도 절댓값을 써요.',
  };
}

function equationProblem(rng: Rng): GenProblem {
  const p = pickP(rng, 1, 6);
  const sideways = rng.next() < 0.5;
  const F = sideways ? `(${p},\\ 0)` : `(0,\\ ${p})`;
  const dir = sideways ? `x=${-p}` : `y=${-p}`;
  const form = sideways ? 'y^2=Ax' : 'x^2=Ay';
  // 정의로 만든 식: (초점까지 거리)² − (준선까지 거리)² = 0 을 전개해 x(또는 y) 의 계수를 읽는다
  const check = sideways
    ? `-expand((x-${paren(p)})**2+y**2-(x+${paren(p)})**2).coeff(x)`
    : `-expand(x**2+(y-${paren(p)})**2-(y+${paren(p)})**2).coeff(y)`;
  const u = sideways ? 'x' : 'y';
  const w = sideways ? 'y' : 'x';
  return {
    q: `초점이 $F${F}$ 이고 준선이 $${dir}$ 인 포물선의 방정식을 $${form}$ 라 할 때, 상수 $A$ 의 값을 구하세요.`,
    choices: null,
    answer: String(4 * p),
    answerType: 'int',
    check,
    concepts: [DEF, sideways ? STD_Y : STD_X],
    steps: [
      {
        title: '정의로 식 세우기',
        body: `점 $P(x,y)$ 에서 초점까지 거리와 준선까지 거리가 같아요.\n$$(${u}${signed(-p)})^2+${w}^2=(${u}${signed(p)})^2$$`,
      },
      {
        title: '전개해서 정리하기',
        body: `양쪽의 $${u}^2$ 과 $${p * p}$ ${iga(p * p)} 지워지고 $${w}^2=${4 * p}${u}$ 만 남아요.`,
      },
      {
        title: '$A$ 읽기',
        body: `$A=4p=4\\times${paren(p)}=${4 * p}$ ${ieyo(4 * p)}.`,
      },
    ],
    tip: `초점 $${F}$ 만 보고 바로 $4p$ 를 쓸 수 있어요. 꼭짓점이 원점일 때만 되는 지름길이에요.`,
  };
}

function focalProblem(rng: Rng): GenProblem {
  const p = rng.int(1, 5);
  const t = rng.int(1, 12);
  const sideways = rng.next() < 0.5;
  const eq = sideways ? `y^2=${4 * p}x` : `x^2=${4 * p}y`;
  const c = sideways ? 'x' : 'y';
  const F = sideways ? `(${p},\\ 0)` : `(0,\\ ${p})`;
  const dir = sideways ? `x=${-p}` : `y=${-p}`;
  // 곡선 위 점의 다른 좌표(√ 가 나와도 sympy 가 정확히 계산한다)
  const P = sideways ? `Point(${t}, sqrt(${4 * p * t}))` : `Point(sqrt(${4 * p * t}), ${t})`;
  const Fs = sideways ? `Point(${p}, 0)` : `Point(0, ${p})`;
  if (rng.next() < 0.6) {
    return {
      q: `포물선 $${eq}$ 위의 점 $P$ 의 $${c}$ 좌표가 $${t}$ 일 때, 점 $P$ 와 초점 $F$ 사이의 거리를 구하세요.`,
      choices: null,
      answer: String(t + p),
      answerType: 'int',
      check: `${P}.distance(${Fs})`,
      concepts: [sideways ? STD_Y : STD_X, FOCAL],
      steps: [
        {
          title: '초점과 준선',
          body: `$4p=${4 * p}$ ${ira(4 * p)} $p=${p}$, 초점은 $F${F}$, 준선은 $${dir}$ ${ieyo(-p)}.`,
        },
        {
          title: '준선까지 거리로 바꾸기',
          body: `$PF$ 는 $P$ 에서 준선까지 거리와 같아요.`,
        },
        {
          title: '거리 계산',
          body: `$P$ 의 $${c}$ 좌표 $${t}$ 에서 준선 $${dir}$ 까지는 $${t}+${p}=${t + p}$ ${ieyo(t + p)}.`,
        },
      ],
      tip: `거리 공식으로 직접 재면 $\\sqrt{\\ }$ 계산이 길어요. 준선까지 거리로 바꾸면 덧셈 하나로 끝나요.`,
    };
  }
  const d = t + p;
  return {
    q: `포물선 $${eq}$ 위의 점 $P$ 와 초점 $F$ 사이의 거리가 $${d}$ 일 때, 점 $P$ 의 $${c}$ 좌표를 구하세요.`,
    choices: null,
    answer: String(t),
    answerType: 'int',
    check: sideways
      ? `Max(*solve(Eq(sqrt((x-${p})**2+${4 * p}*x), ${d}), x))`
      : `Max(*solve(Eq(sqrt(${4 * p}*y+(y-${p})**2), ${d}), y))`,
    concepts: [sideways ? STD_Y : STD_X, FOCAL],
    steps: [
      {
        title: '초점과 준선',
        body: `$4p=${4 * p}$ ${ira(4 * p)} $p=${p}$, 준선은 $${dir}$ ${ieyo(-p)}.`,
      },
      {
        title: '준선까지 거리도 같아요',
        body: `$P$ 에서 준선까지 거리도 $${d}$ ${ieyo(d)}. 그래서 $${c}+${p}=${d}$ ${ieyo(d)}.`,
      },
      {
        title: '좌표 구하기',
        body: `$${c}=${d}-${p}=${t}$ ${ieyo(t)}.`,
      },
    ],
    tip: `이 포물선 위의 점은 $${c}$ 좌표가 음수일 수 없어요. 그래서 답은 하나예요.`,
  };
}

function shiftProblem(rng: Rng): GenProblem {
  let m: number;
  let n: number;
  do {
    m = rng.int(-4, 4);
    n = rng.int(-4, 4);
  } while (m === 0 || n === 0);
  const p = pickP(rng, 1, 4);
  const K = 4 * p;
  const eq = `${shift('y', n)}^2=${K}${shift('x', m)}`;
  const fx = m + p;
  const s = fx + n;
  return {
    q: `포물선 $${eq}$ 의 초점의 좌표를 $(a,\\ b)$ 라 할 때, $a+b$ 의 값을 구하세요.`,
    choices: null,
    answer: String(s),
    answerType: 'int',
    // 평행이동 전 포물선 y²=Kx 의 초점을 solve 로 구하고, 그 점을 (m, n) 만큼 옮긴다
    check: `F = Point(solve(Eq(4*p, ${K}), p)[0], 0).translate(${m}, ${n})\nans = F.x + F.y`,
    concepts: [SHIFT, STD_Y],
    steps: [
      {
        title: '옮기기 전 포물선',
        body: `$y^2=${K}x$ 에서 $4p=${K}$, $p=${p}$ ${ira(p)} 초점은 $(${p},\\ 0)$ 이에요.`,
      },
      {
        title: '얼마나 옮겼나',
        body: `$x$ 자리에 $x${signed(-m)}$, $y$ 자리에 $y${signed(-n)}$ 가 들어갔으니 $x$ 축의 방향으로 $${m}$, $y$ 축의 방향으로 $${n}$ 만큼 옮겼어요.`,
      },
      {
        title: '초점도 함께 옮기기',
        body: `초점은 $(${p}${signed(m)},\\ 0${signed(n)})=(${fx},\\ ${n})$ ${ieyo(n)}.`,
      },
      {
        title: '더하기',
        body: `$a+b=${fx}${signed(n)}=${s}$ ${ieyo(s)}.`,
      },
    ],
    tip: '꼭짓점 $(m,n)$ 을 먼저 읽고, 꼭짓점에서 열린 쪽으로 $p$ 만큼 가면 초점이에요.',
  };
}

export const generators: Generator[] = [
  {
    id: 'geo-parabola-focus',
    unitId: UNIT,
    title: '포물선의 초점과 준선',
    make: focusProblem,
  },
  {
    id: 'geo-parabola-equation',
    unitId: UNIT,
    title: '초점과 준선으로 포물선의 방정식 만들기',
    make: equationProblem,
  },
  {
    id: 'geo-parabola-focal',
    unitId: UNIT,
    title: '포물선 위의 점과 초점 사이 거리',
    make: focalProblem,
  },
  {
    id: 'geo-parabola-shift',
    unitId: UNIT,
    title: '평행이동한 포물선의 초점',
    make: shiftProblem,
  },
];
