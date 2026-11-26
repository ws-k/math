// 세로셈 가족 부품의 모델(순수). 한 부품 안의 세 모드 — 긴 나눗셈(long)·조립제법(synth)·나눗셈 사다리(ladder).
// 셋 다 '칸을 맞춰 적는 틀에서 같은 일을 칸마다 되풀이'하는 진행이라 한 부품으로 묶었다(D3 시안 승인, 2026-11-25).
// 화면(Column.tsx)은 손을 뗀 결과(쌓은 토막 수·놓은 칸·놓은 카드)를 여기 넘겨 판정을 받고, 여기서 낸 칸 자리를 그리기만 한다.
// 검산(checks)은 이 모델이 낸 단계 값을 sympy 의 divmod·div·gcd·lcm 과 대조한다 — 화면이 보이는 바로 그 값이다.
// 칸 자리(px)는 접은 화면 카드 안쪽 폭 298px 기준이고 D3 시안(outputs/widgets-v2/d3/*.html)의 값을 그대로 옮겼다.
import { arr, fail, int, obj, oneOf } from '../parse.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface LongParams {
  mode: 'long';
  /** 나눠지는 수(1~99999) */
  dividend: number;
  /** 나누는 수(2~99). 막대의 토막 한 개 길이라 두 자리까지 */
  divisor: number;
  /** 소수점 아래로 0 을 내려 끝까지(나머지 0 이나 되풀이까지) 나누는가. 아니면 정수 몫·나머지 */
  decimal: boolean;
}
export interface SynthParams {
  mode: 'synth';
  /** 나눠지는 다항식의 계수(높은 차수부터, 2~4차) */
  coeffs: number[];
  /** x − root 로 나눈다 */
  root: number;
}
export interface LadderParams {
  mode: 'ladder';
  numbers: [number, number];
  /** 수 카드(소수, 작은 것부터). 기본 2·3·5·7 */
  cards: number[];
}
export type ColumnParams = LongParams | SynthParams | LadderParams;

export type Msg = { text: string; cls: '' | 'ok' | 'bad' };

/** 화면에 적는 음수는 빼기 기호(−)로 */
export const fmt = (n: number) => (n < 0 ? `−${-n}` : String(n));
/** 식 가운데에 끼는 음수는 괄호로: 1 × (−2) */
const par = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n));

// ---- 수 뒤 조사 ----

/** 끝자리 읽기의 받침: 0 없음 · 1 ㄹ · 2 그 밖. 0(영)·10(십)·100(백)… 처럼 0 으로 끝나면 받침이 있다 */
const COda = [2, 1, 0, 2, 0, 0, 2, 1, 1, 0];
const coda = (n: number) => {
  const a = Math.abs(n);
  return a % 10 === 0 ? 2 : (COda[a % 10] as number);
};
const PAIRS = {
  은: ['은', '는'],
  이: ['이', '가'],
  을: ['을', '를'],
  과: ['과', '와'],
  이에요: ['이에요', '예요'],
} as const;
/**
 * 수 뒤에 띄어 붙는 조사(이 앱은 '3 으로'처럼 수와 조사 사이를 띈다). 수마다 받침이 달라 글을 짤 때 고른다 —
 * '11 을'·'22 를'을 틀리면 읽는 사람이 바로 걸린다. '으로'는 ㄹ 받침(1·7·8)에도 '로'.
 */
export function jo(n: number, j: '은' | '이' | '을' | '과' | '으로' | '이에요'): string {
  const c = coda(n);
  if (j === '으로') return c === 2 ? '으로' : '로';
  return PAIRS[j][c === 0 ? 1 : 0];
}
const COUNT = ['', '한', '두', '세', '네', '다섯'];

// ---- 긴 나눗셈(long) ----

/** 칸 자리: 나눠지는 수 첫 자리 x, 자리 간격, 소수점 자리 폭. 시안 long-drag.html 의 X = { i: 58, dot: 72, d1: 86 … } */
export const L_X0 = 58;
const L_CELL = 20;
const L_DOT = 14;
/** 몫 줄 y, 나눠지는 수 줄 y, 줄 간격. 시안은 30 — 곱·남은 수 세 번(3 ÷ 8 = 0.375)이 접은 화면에 들게 26 으로 좁혔다 */
export const L_QY = 14;
const L_ROW0 = 50;
const L_PITCH = 26;
export const L_ROW = (k: number) => L_ROW0 + L_PITCH * k;
/** 세로셈 판의 기본 폭(시안 146)과 넓힐 수 있는 끝. 나머지는 덜어 내기 막대가 쓴다(카드 안쪽 298 = 판 + 6 + 막대) */
const L_DG_W = 146;
const L_DG_MAX = 152;
export const L_W = 298;
export const L_GAP = 6;
/** 곱·남은 수를 적는 단계의 상한. 넷째부터는 판이 '계속하기' 밑으로 밀린다(382×580 실측) */
const L_MAX_ROWS = 7;
/** 판 높이 하한 — 덜어 내기 막대에 토막 아홉 개가 드는 높이(시안 188) */
const L_MIN_H = 188;
/** 몫 한 자리 상한(토막 수). 0~9 */
export const L_QMAX = 9;

export interface LStep {
  /** 지금 나누는 수 */
  n: number;
  /** 그 수의 끝자리 칸 번호(나눠지는 수 첫 자리 0, 소수점 아래 0 들도 이어서 센다) */
  c: number;
  q: number;
  r: number;
  /** 지금 나누는 수가 적힌 줄(0 = 나눠지는 수 줄) */
  row: number;
  /** 지금 나누는 수가 차지하는 칸 수(c 에서 왼쪽으로) */
  w: number;
}
export interface LPlan {
  p: LongParams;
  /** 맨 위 줄 숫자들(나눠지는 수 + 내려 쓸 0 들) */
  digits: string;
  intLen: number;
  steps: LStep[];
  /** int: 정수 몫·나머지 / zero: 나머지 0 으로 끝남 / repeat: 남은 수가 앞에 나온 수로 돌아옴 / cut: 판 폭 안에서 안 끝남 */
  end: 'int' | 'zero' | 'repeat' | 'cut';
  /** 되풀이가 시작되는 단계 번호(repeat 일 때) */
  repFrom: number;
  rows: number;
}

const after = (s: LStep) => (s.q > 0 ? s.row + 2 : s.row);
const afterW = (s: LStep) => (s.q > 0 ? String(s.r).length : s.w);

/**
 * 단계 전부(정답 진행). 몫 자리는 정답이 하나뿐이라 학생의 진행은 이 순서를 따라간다.
 * 학교 세로셈대로: 앞자리부터 나누는 수 이상이 될 때까지 묶어 시작하고, 몫이 0 인 자리는 곱·뺄셈 줄 없이 다음 수를 같은 줄에 내린다.
 * 소수면 나눠지는 수가 더 작을 때 첫 0 을 미리 붙여(3 → 30) 시작하고, 남은 수가 0 이 되거나 소수점 뒤에서 이미 나온 남은 수로
 * 돌아오면 끝 — 돌아온 남은 수 옆에 0 을 한 번 더 내려 '처음과 같은 수'가 보이게 한다(시안 그대로).
 */
export function longPlan(p: LongParams): LPlan {
  const D = p.dividend;
  const d = p.divisor;
  const ds = String(D);
  const intLen = ds.length;
  let digits = ds;
  const steps: LStep[] = [];
  let c: number;
  let n: number;
  let w: number;
  let row = 0;
  if (D < d) {
    c = intLen;
    digits += '0';
    n = D * 10;
    w = intLen + 1;
  } else {
    c = 0;
    while (Number(ds.slice(0, c + 1)) < d) c += 1;
    n = Number(ds.slice(0, c + 1));
    w = c + 1;
  }
  // 소수점을 지난 뒤 단계마다 '나누기 전 남은 수'. 같은 수가 다시 나오면 그다음 몫도 똑같이 되풀이된다
  const decRems: number[] = D < d ? [D] : [];
  let firstDec = D < d ? 0 : -1;
  let end: LPlan['end'] = 'cut';
  let repFrom = -1;
  for (let guard = 0; guard < 12; guard++) {
    const q = Math.floor(n / d);
    const r = n % d;
    const st: LStep = { n, c, q, r, row, w };
    steps.push(st);
    if (c >= intLen && firstDec < 0) firstDec = steps.length - 1;
    if (c + 1 >= intLen) {
      if (!p.decimal) {
        end = 'int';
        break;
      }
      if (r === 0) {
        end = 'zero';
        break;
      }
      if (c >= intLen) {
        const i = decRems.indexOf(r);
        if (i >= 0) {
          end = 'repeat';
          repFrom = firstDec + i;
          digits += '0';
          break;
        }
      }
      decRems.push(r);
      if (c + 1 >= digits.length) digits += '0';
    }
    n = r * 10 + Number(digits[c + 1]);
    row = after(st);
    w = afterW(st) + 1;
    c += 1;
  }
  const last = steps.at(-1) as LStep;
  return { p, digits, intLen, steps, end, repFrom, rows: after(last) + 1 };
}

/** 칸 번호 → x. 소수점 뒤 칸은 소수점 폭만큼 더 간다 */
export function longX(pl: LPlan, c: number): number {
  const dot = pl.p.decimal && c >= pl.intLen ? 2 * L_DOT - L_CELL : 0;
  return L_X0 + L_CELL * c + dot;
}
const dotX = (pl: LPlan) => L_X0 + L_CELL * (pl.intLen - 1) + L_DOT;

/** 손을 뗀 토막 수 판정(P3 — 끄는 동안에는 부르지 않는다) */
export function longJudge(pl: LPlan, k: number, q: number): 'ok' | 'empty' | 'over' | 'more' {
  const s = pl.steps[k] as LStep;
  const d = pl.p.divisor;
  if (q * d > s.n) return 'over';
  if (s.n - q * d >= d) return q === 0 ? 'empty' : 'more';
  return 'ok';
}

export type LState = { k: number; phase: 'q' | 'bring' | 'done' };

/** 단계 k 뒤에 내려 쓸 수가 있는가 — 마지막 단계는 되풀이일 때만(돌아온 남은 수 옆에 0) */
const hasBring = (pl: LPlan, i: number) => i < pl.steps.length - 1 || pl.end === 'repeat';

/** 맞힌 뒤·내린 뒤 다음 상태. q 에서 맞히면 내리기(없으면 끝), 내리고 나면 다음 몫(더 없으면 끝) */
/**
 * 몫 첫 자리가 0 인 단계(1 ÷ 20 의 10)는 내려쓰기를 건너뛴다 — 0 을 정한 순간 다음 0 이 저절로 내려와 바로 100 을 나눈다.
 * 학교 세로셈도 앞자리 0 은 곱·뺄셈 없이 한 자리 더 붙여 시작하고, 아직 아무것도 덜어 내지 않은 줄에 0 을 손으로
 * 옮기는 일은 뜻이 없다(P1, 리뷰 M2). 중간 자리의 몫 0(1203 ÷ 12)은 그 자리까지 나눈 뒤라 그대로 내려 쓴다.
 */
const skipBring = (pl: LPlan, k: number) =>
  k === 0 && (pl.steps[0] as LStep).q === 0 && hasBring(pl, 0);

export function longNext(pl: LPlan, s: LState): LState {
  if (s.phase === 'q') {
    if (skipBring(pl, s.k)) return { k: s.k + 1, phase: 'q' };
    return { k: s.k + 1, phase: hasBring(pl, s.k) ? 'bring' : 'done' };
  }
  if (s.phase === 'bring') return { k: s.k, phase: s.k >= pl.steps.length ? 'done' : 'q' };
  return s;
}

/**
 * 손을 뗀 그 끌기의 토막 수: 시작 토막 수 + 위로 끈 거리 ÷ 토막 높이(반올림), 0~9.
 * 프레임마다 그린 마지막 값이 아니라 뗀 순간의 dy 로 정한다 — 마지막 움직임이 그려지기 전에 떼면 한 칸 어긋났다(리뷰 M3)
 */
export const longDragQ = (start: number, dy: number, bh: number) =>
  clampN(start + Math.round(-dy / bh), 0, L_QMAX);
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 키보드로 한 일 뒤 초점이 갈 곳(눌러 쓴 단추가 사라지면 초점이 문서 맨 앞으로 튀지 않게, 리뷰 M4) */
export const longFocus = (s: LState): 'handle' | 'bring' | 'reset' =>
  s.phase === 'q' ? 'handle' : s.phase === 'bring' ? 'bring' : 'reset';

/** 단계 k−1 뒤에 내려 쓸 수: 맨 위 줄의 그 칸에서 남은 수 바로 옆 칸으로 */
export function longBringSpot(pl: LPlan, k: number) {
  const s = pl.steps[k - 1] as LStep;
  const x = longX(pl, s.c + 1);
  return {
    from: { x, y: L_ROW(0) },
    to: { x, y: L_ROW(after(s)) },
    digit: pl.digits[s.c + 1] as string,
  };
}

export interface LCell {
  key: string;
  text: string;
  x: number;
  y: number;
  cls: string[];
}
export interface LView {
  cells: LCell[];
  /** 곱 아래 뺄셈 밑줄 */
  lines: { key: string; x0: number; x1: number; y: number }[];
  /** 소수점을 지난 뒤 남은 수의 줄(3 → 8 → 3). 되풀이면 rep = [처음 나온 자리, 마지막] */
  trail: number[];
  trailRep: [number, number] | null;
  w: number;
  h: number;
}

/** 판 크기(폭·높이). 높이는 줄 수에 맞추되 막대 토막 아홉 개가 드는 만큼은 둔다 */
export function longSize(pl: LPlan) {
  const lastX = longX(pl, pl.digits.length - 1);
  return { w: Math.max(L_DG_W, lastX + 12), h: Math.max(L_MIN_H, L_ROW(pl.rows - 1) + 18) };
}

/** 상태 → 세로셈 판의 칸들. 끄는 동안에는 이 판이 바뀌지 않는다(손을 뗀 뒤 맞으면 한 번에 적힌다) */
export function longView(pl: LPlan, s: LState): LView {
  const { p, steps, intLen } = pl;
  const cells: LCell[] = [];
  const lines: LView['lines'] = [];
  const put = (key: string, text: string, c: number, y: number, cls: string[] = []) =>
    cells.push({ key, text, x: longX(pl, c), y, cls });
  const judged = steps.slice(0, s.k);
  const brought = (i: number) =>
    i < s.k - 1 ||
    (i === s.k - 1 && (s.phase === 'q' || (s.phase === 'done' && pl.end === 'repeat')));
  let maxCol = (steps[0] as LStep).c;
  judged.forEach((st, i) => {
    if (brought(i)) maxCol = Math.max(maxCol, st.c + 1);
  });

  // 맨 위 줄: 나누는 수, 나눠지는 수, 소수점, 내려 쓸 0(아직 안 내린 것은 흐리게)
  cells.push({ key: 'dv', text: String(p.divisor), x: 6, y: L_ROW(0), cls: ['dv'] });
  for (let c = 0; c < pl.digits.length; c++) {
    // 소수점은 읽는 차례(정수 자리 뒤)에 — 화면 낭독기가 칸 차례대로 읽는다
    if (p.decimal && c === intLen)
      cells.push({ key: 'tdot', text: '.', x: dotX(pl), y: L_ROW(0), cls: [] });
    put(`t${c}`, pl.digits[c] as string, c, L_ROW(0), c >= intLen && c > maxCol ? ['faint'] : []);
  }

  // 몫 줄
  if (p.dividend < p.divisor) put('q-lead', '0', intLen - 1, L_QY, ['q']);
  if (p.decimal) cells.push({ key: 'qdot', text: '.', x: dotX(pl), y: L_QY, cls: ['q'] });
  judged.forEach((st, i) => {
    put(`q${i}`, String(st.q), st.c, L_QY, ['q']);
  });
  if (s.phase === 'done' && pl.end === 'repeat')
    put('q-more', '…', pl.digits.length - 1, L_QY, ['q', 'faint']);

  // 단계마다 곱·밑줄·남은 수, 그리고 내려 쓴 수
  judged.forEach((st, i) => {
    if (st.q > 0) {
      const prod = String(st.q * p.divisor);
      const rs = String(st.r);
      for (let j = 0; j < prod.length; j++)
        put(`p${i}-${j}`, prod[j] as string, st.c - prod.length + 1 + j, L_ROW(st.row + 1));
      const span = Math.max(st.w, prod.length);
      lines.push({
        key: `u${i}`,
        x0: longX(pl, st.c - span + 1) - 13,
        x1: longX(pl, st.c) + 13,
        y: L_ROW(st.row + 1) + L_PITCH / 2,
      });
      for (let j = 0; j < rs.length; j++)
        put(`r${i}-${j}`, rs[j] as string, st.c - rs.length + 1 + j, L_ROW(st.row + 2));
    }
    // 맨 위 줄에 그대로 붙는 수(몫 첫 자리 0 뒤)는 이미 그 자리에 적혀 있어 다시 적지 않는다
    if (brought(i) && after(st) > 0)
      put(`b${i}`, pl.digits[st.c + 1] as string, st.c + 1, L_ROW(after(st)));
  });

  const mark = (row: number, c: number, w: number, cls: string) => {
    const xs = new Set(Array.from({ length: w }, (_, j) => longX(pl, c - j)));
    for (const cell of cells)
      if (cell.y === L_ROW(row) && xs.has(cell.x) && cell.key !== 'dv') cell.cls.push(cls);
  };
  if (s.phase === 'q') {
    const st = steps[s.k] as LStep;
    mark(st.row, st.c, st.w, 'cur');
  }
  const done = s.phase === 'done';
  if (done && pl.end === 'repeat') {
    const a = steps[pl.repFrom] as LStep;
    const z = steps.at(-1) as LStep;
    mark(a.row, a.c, a.w, 'rep');
    mark(after(z), z.c + 1, afterW(z) + 1, 'rep');
  }

  // 남은 수 줄(소수만): 소수점에 닿을 때의 남은 수부터
  const trail: number[] = [];
  if (p.decimal) {
    if (p.dividend < p.divisor) trail.push(p.dividend);
    for (const st of judged) if (st.c + 1 >= intLen) trail.push(st.r);
  }
  // 남은 수 줄의 i 번째 = 소수 단계 i 를 나누기 전 남은 수라 되풀이 시작 자리가 그대로 줄 번호다
  const firstDec = steps.findIndex((x) => x.c >= intLen);
  const trailRep: [number, number] | null =
    done && pl.end === 'repeat' ? [pl.repFrom - firstDec, trail.length - 1] : null;
  const { w, h } = longSize(pl);
  return { cells, lines, trail, trailRep, w, h };
}

/** 덜어 내기 막대의 자리: 바닥 y, 1 당 높이 S, 토막 높이. 가장 큰 '지금 수'와 토막 아홉 개가 다 들게 */
export function longBar(pl: LPlan) {
  const { w, h } = longSize(pl);
  const by = h - 6;
  const maxN = Math.max(...pl.steps.map((s) => s.n), 1);
  const d = pl.p.divisor;
  const s = Math.min((by - 22) / maxN, (by - 4) / (L_QMAX * d));
  return { w: L_W - L_GAP - w, h, by, s, bh: d * s };
}

/** 몫 한 자리마다의 숫자(소수점 앞·뒤) */
function longDigits(pl: LPlan) {
  const { steps, intLen } = pl;
  const ip = steps.filter((s) => s.c < intLen).map((s) => s.q);
  const dp = steps.filter((s) => s.c >= intLen).map((s) => s.q);
  return { I: ip.length ? Number(ip.join('')) : 0, dp };
}

/** 끝난 몫(글). 되풀이 자리는 rep 로 따로 — 화면이 그 처음·끝 숫자 위에 점을 찍는다 */
export function longResult(pl: LPlan) {
  const { I, dp } = longDigits(pl);
  if (pl.end !== 'repeat') return { int: String(I), non: dp.join(''), rep: '' };
  const firstDec = pl.steps.findIndex((s) => s.c >= pl.intLen);
  const at = pl.repFrom - firstDec;
  return { int: String(I), non: dp.slice(0, at).join(''), rep: dp.slice(at).join('') };
}

// 안내 글(시안 long-drag.html 의 문구). 판정 글은 손을 뗀 뒤에만 쓴다(P3)
export const longText = {
  intro(pl: LPlan): string {
    const s = pl.steps[0] as LStep;
    return `손잡이를 위로 끌어 ${s.n} 에서 ${pl.p.divisor} 씩 덜어 내 보세요.`;
  },
  judge(pl: LPlan, k: number, q: number): Msg {
    const s = pl.steps[k] as LStep;
    const d = pl.p.divisor;
    const v = longJudge(pl, k, q);
    if (v === 'empty')
      return {
        text: `아직 덜어 내지 않았어요. 손잡이를 위로 끌어 ${s.n} 에서 ${d} 씩 덜어 내요.`,
        cls: 'bad',
      };
    if (v === 'over')
      return {
        text: `${d} × ${q} = ${q * d} — 막대 ${s.n} ${jo(s.n, '을')} 넘쳐서 뺄 수 없어요.`,
        cls: 'bad',
      };
    if (v === 'more') {
      const left = s.n - q * d;
      return { text: `남은 칸(${left})에 ${d} ${jo(d, '이')} 한 번 더 들어가요.`, cls: 'bad' };
    }
    const next = longNext(pl, { k, phase: 'q' });
    if (next.phase === 'q') {
      const n1 = (pl.steps[k + 1] as LStep).n;
      const dg = Number(pl.digits[s.c + 1]);
      return {
        text: `${s.n} 에는 ${d} ${jo(d, '이')} 한 번도 안 들어가요 → 몫 0. 다음 ${dg} ${jo(dg, '을')} 내려 ${n1} 에서 다시 덜어 내요.`,
        cls: '',
      };
    }
    const head =
      s.q === 0
        ? `${s.n} 에는 ${d} ${jo(d, '이')} 한 번도 안 들어가요 → 몫 0.`
        : `몫 ${s.q}, 남은 ${s.r}.`;
    if (next.phase === 'bring') {
      const b = longBringSpot(pl, k + 1);
      // 소수점 아래 0 은 아직 안 내린 동안 흐리게 그려져 있다
      const faint = s.c + 1 >= pl.intLen;
      return {
        text: `${head} 위의 ${faint ? '흐린 ' : ''}${b.digit} ${jo(Number(b.digit), '을')} 끌어 ${s.r} 옆 점선 칸에 내려요.`,
        cls: '',
      };
    }
    return longText.end(pl);
  },
  /** 다 끝났을 때(끝나는 나눗셈·정수 몫은 마지막 몫에서, 되풀이는 마지막 0 을 내린 뒤) */
  end(pl: LPlan): Msg {
    const { dividend: D, divisor: d } = pl.p;
    const z = pl.steps.at(-1) as LStep;
    const res = longResult(pl);
    if (pl.end === 'int')
      return {
        text: `더 내릴 수가 없어요. ${D} ÷ ${d} 의 몫은 ${res.int}, 나머지는 ${z.r} ${jo(z.r, '이에요')}.`,
        cls: 'ok',
      };
    if (pl.end === 'zero')
      return {
        text: `남은 수가 0 이 되어 나눗셈이 끝났어요. ${D} ÷ ${d} = ${res.int}.${res.non}`,
        cls: 'ok',
      };
    const first = pl.repFrom === 0 && D < d;
    const digs = res.rep.split('');
    return {
      text: `남은 수가 ${first ? '처음의' : '앞에 나온'} ${z.r} ${jo(z.r, '으로')} 돌아왔어요 → 몫도 ${digs.join(', ')} ${jo(Number(digs.at(-1)), '이')} 끝없이 되풀이돼요.`,
      cls: 'ok',
    };
  },
  dropped(pl: LPlan, k: number): string {
    const s = pl.steps[k] as LStep;
    return `${s.n} ${jo(s.n, '이')} 됐어요. 다시 손잡이를 끌어 ${pl.p.divisor} 씩 덜어 내요.`;
  },
  /** 내릴 수를 그냥 눌렀을 때(첫 번) */
  tapBring: (digit: string) =>
    `${digit} ${jo(Number(digit), '을')} 누른 채 아래 점선 칸까지 끌어 보세요.`,
  /** 눌러서 하기가 켜질 때 */
  tapBringOn: (digit: string) => `${digit} ${jo(Number(digit), '을')} 한 번 누르면 내려가요.`,
  /** 손잡이를 화면 낭독기가 읽는 값 */
  slider: (k: number, d: number) => `토막 ${k}개, ${d} 곱하기 ${k} ${jo(k, '은')} ${k * d}`,
  /** 몫을 정한 뒤 화면 낭독기 */
  bringLive: (q: number, r: number, digit: string) =>
    `몫 ${q}, 남은 수 ${r}. 다음 ${digit} ${jo(Number(digit), '을')} 내리세요.`,
  missBring(pl: LPlan, k: number): string {
    const b = longBringSpot(pl, k);
    const r = (pl.steps[k - 1] as LStep).r;
    return `${b.digit} ${jo(Number(b.digit), '은')} 남은 수 ${r} 바로 옆 점선 칸으로 내려요.`;
  },
};

function parseLong(o: Record<string, unknown>): LongParams {
  const p: LongParams = {
    mode: 'long',
    dividend: int(o.dividend, '세로셈 dividend', 1, 99999),
    divisor: int(o.divisor, '세로셈 divisor', 2, 99),
    decimal: o.decimal === undefined ? false : bool(o.decimal, '세로셈 decimal'),
  };
  if (!p.decimal && p.dividend < p.divisor)
    fail(
      '세로셈',
      '정수 나눗셈은 나눠지는 수가 나누는 수보다 크거나 같아야 함(작으면 decimal: true)',
    );
  if (p.decimal && p.dividend % p.divisor === 0)
    fail('세로셈', '나누어떨어지는 수는 소수로 나눌 것이 없음(decimal 을 빼세요)');
  const pl = longPlan(p);
  const { w } = longSize(pl);
  if (pl.end === 'cut' || w > L_DG_MAX)
    fail(
      '세로셈',
      `맨 위 줄이 ${pl.digits.length + (p.decimal ? 1 : 0)}칸이라 판에 안 들어감(소수점 포함 5칸까지 — 382 폭)`,
    );
  if (pl.rows > L_MAX_ROWS)
    fail(
      '세로셈',
      `곱·뺄셈이 ${pl.steps.filter((s) => s.q > 0).length}번이라 ${pl.rows}줄 — 접은 화면에 ${L_MAX_ROWS}줄(세 번)까지`,
    );
  return p;
}

function bool(v: unknown, at: string): boolean {
  if (typeof v !== 'boolean') fail(at, 'true/false 가 아님');
  return v as boolean;
}

function longChecks(p: LongParams): WidgetCheck[] {
  const pl = longPlan(p);
  const { dividend: D, divisor: d } = p;
  const out: WidgetCheck[] = [];
  // 단계의 '지금 수'를 매개변수에서 따로 만든다: 맨 위 줄을 그 칸까지 읽은 수 = D·10^z 를 10^u 로 내린 몫.
  // 그 수를 d 로 나눈 몫의 끝자리가 그 단계 몫, 나머지가 그 단계 남은 수 — 단계를 이어 온 앱 계산과 따로 맞춘다
  pl.steps.forEach((s, i) => {
    const z = Math.max(0, s.c + 1 - pl.intLen);
    const u = Math.max(0, pl.intLen - 1 - s.c);
    const pre = `${D}*10**${z}//10**${u}`;
    out.push({
      name: `${i + 1}단계 몫`,
      answer: String(s.q),
      answerType: 'int',
      check: `divmod(${pre}, ${d})[0] % 10`,
    });
    out.push({
      name: `${i + 1}단계 나머지`,
      answer: String(s.r),
      answerType: 'int',
      check: `divmod(${pre}, ${d})[1]`,
    });
  });
  if (!p.decimal) {
    const res = longResult(pl);
    out.push({ name: '몫', answer: res.int, answerType: 'int', check: `divmod(${D}, ${d})[0]` });
    out.push({
      name: '나머지',
      answer: String((pl.steps.at(-1) as LStep).r),
      answerType: 'int',
      check: `divmod(${D}, ${d})[1]`,
    });
    return out;
  }
  // 화면에 보인 몫(소수점 아래 숫자·되풀이 자리)이 D/d 와 같은 값인가
  const r = longResult(pl);
  const g = gcd(D, d);
  const answer = `${D / g}/${d / g}`;
  const check =
    pl.end === 'repeat'
      ? `${r.int} + (Integer(${Number(r.non + r.rep)}) - Integer(${Number(r.non || '0')}))/(10**${r.non.length}*(10**${r.rep.length}-1))`
      : `${r.int} + Integer(${Number(r.non)})/10**${r.non.length}`;
  out.push({ name: '값', answer, answerType: 'fraction', check });
  return out;
}

// ---- 조립제법(synth) ----

/** 칸 x(시안 synth.html: 계수 넷이 86·147·208·268), 줄 y, 왼쪽 근 칸 x */
export const S_AX = 22;
export const S_Y = { top: 42, mid: 94, bot: 152 } as const;
export const S_H = 184;
export function synthCols(p: SynthParams): number[] {
  const m = p.coeffs.length;
  // 계수 다섯(4차)이면 칸 사이가 48(칸 폭) 아래로 좁아지지 않게 왼쪽 끝을 조금 당긴다
  const x0 = m >= 5 ? 78 : 86;
  const x1 = m >= 5 ? 274 : 268;
  return Array.from({ length: m }, (_, j) => Math.round(x0 + ((x1 - x0) * j) / (m - 1)));
}
const SUP = ['', '', '²', '³', '⁴'];
export const synthLabels = (p: SynthParams) =>
  p.coeffs.map((_, j) => {
    const e = p.coeffs.length - 1 - j;
    return e === 0 ? '상수' : `x${SUP[e]}`;
  });

export interface SState {
  /** 지금 할 일: 0 = 첫 계수 내리기, j(1~차수) = 아래 j−1 칸을 위 j 칸으로 올리기, 차수+1 = 끝 */
  k: number;
  mid: (number | null)[];
  bot: (number | null)[];
}
export const synthInit = (p: SynthParams): SState => ({
  k: 0,
  mid: p.coeffs.map(() => null),
  bot: p.coeffs.map(() => null),
});
export const synthDone = (p: SynthParams, s: SState) => s.k >= p.coeffs.length;
/** 키보드로 놓은 뒤 초점: 다음 옮길 수, 끝나면 '처음부터 다시' */
export const synthFocus = (p: SynthParams, s: SState): 'act' | 'reset' =>
  synthDone(p, s) ? 'reset' : 'act';

/**
 * 놓은 칸 판정(P3). 빈칸은 모두 같은 점선이라 어디에 놓을지는 학생이 정하고, 규칙에 맞는 칸만 받는다:
 * 처음엔 첫 계수를 같은 열 맨 아래로, 그다음은 아래 줄 맨 끝 수(× 근)를 바로 오른쪽 위 칸(가운데 줄)으로.
 * 올린 뒤 더한 값은 synthSum 이 내린다(화면이 잠깐 뒤에 불러 '올리고 → 더해 내려오기'가 차례로 보이게).
 */
export function synthPlace(
  p: SynthParams,
  s: SState,
  row: 'mid' | 'bot',
  j: number,
): { res: 'first' | 'up' | 'wrongFirst' | 'wrongBot' | 'wrongCol'; s: SState } {
  if (s.k === 0) {
    if (row === 'bot' && j === 0) {
      const bot = [...s.bot];
      bot[0] = p.coeffs[0] as number;
      return { res: 'first', s: { ...s, k: 1, bot } };
    }
    return { res: 'wrongFirst', s };
  }
  if (row === 'mid' && j === s.k) {
    const mid = [...s.mid];
    mid[j] = (s.bot[j - 1] as number) * p.root;
    return { res: 'up', s: { ...s, mid } };
  }
  return { res: row === 'bot' ? 'wrongBot' : 'wrongCol', s };
}
export function synthSum(p: SynthParams, s: SState): SState {
  const bot = [...s.bot];
  bot[s.k] = (p.coeffs[s.k] as number) + (s.mid[s.k] as number);
  return { ...s, k: s.k + 1, bot };
}

/** 계수 → 글 다항식(x³ − 2x + 1). 1·−1 계수는 숫자를 빼고, 0 인 항은 건너뛴다 */
export function polyText(cs: number[], sup = true): string {
  const deg = cs.length - 1;
  let out = '';
  cs.forEach((c, j) => {
    if (c === 0) return;
    const e = deg - j;
    const a = Math.abs(c);
    const body =
      e === 0 ? String(a) : `${a === 1 ? '' : a}x${sup ? SUP[e] : e > 1 ? `**${e}` : ''}`;
    out += out ? ` ${c < 0 ? '−' : '+'} ${body}` : `${c < 0 ? '−' : ''}${body}`;
  });
  return out || '0';
}
/** sympy 가 읽는 다항식 */
const polySym = (cs: number[]) => cs.map((c, j) => `(${c})*x**${cs.length - 1 - j}`).join('+');

/** f(a) 를 손으로 계산하는 식(2³ − 2×2 + 1). 근이 음수면 괄호 */
function faText(p: SynthParams): string {
  const deg = p.coeffs.length - 1;
  const a = par(p.root);
  let out = '';
  p.coeffs.forEach((c, j) => {
    if (c === 0) return;
    const e = deg - j;
    const m = Math.abs(c);
    const pw = e === 0 ? '' : e === 1 ? a : `${a}${SUP[e]}`;
    const body = e === 0 ? String(m) : m === 1 ? pw : `${m}×${pw}`;
    out += out ? ` ${c < 0 ? '−' : '+'} ${body}` : `${c < 0 ? '−' : ''}${body}`;
  });
  return out;
}

export function synthView(p: SynthParams, s: SState) {
  const n = p.coeffs.length;
  const done = synthDone(p, s);
  const q = s.bot.slice(0, n - 1);
  const rem = s.bot[n - 1] ?? null;
  return {
    poly: polyText(p.coeffs),
    divisor: `x ${p.root < 0 ? '+' : '−'} ${Math.abs(p.root)}`,
    quotient: done ? polyText(q as number[]) : null,
    remainder: done ? rem : null,
    fa: `${faText(p)} = ${fmt(p.coeffs.reduce((acc, c) => acc * p.root + c, 0))}`,
  };
}

export const synthText = {
  intro: (p: SynthParams) =>
    `첫 계수 ${fmt(p.coeffs[0] as number)} ${jo(p.coeffs[0] as number, '을')} 맨 아래 줄로 끌어 내려 보세요.`,
  first(p: SynthParams): string {
    const v = p.coeffs[0] as number;
    return `첫 계수는 그대로 내려와요. 이제 아래 ${fmt(v)} ${jo(v, '을')} 오른쪽 위 칸으로 끌어 올려 보세요.`;
  },
  wrong(p: SynthParams, res: 'wrongFirst' | 'wrongBot' | 'wrongCol'): string {
    const v = p.coeffs[0] as number;
    if (res === 'wrongFirst')
      return `첫 계수 ${fmt(v)} ${jo(v, '은')} 같은 열 맨 아래 줄로 그대로 내려요.`;
    if (res === 'wrongBot')
      return '맨 아래 줄은 더한 값 자리예요. 곱한 값은 오른쪽 위(가운데 줄)로 올려요.';
    return '곱한 값은 바로 오른쪽 한 칸으로 올려요.';
  },
  /** 올리고 더한 뒤(s 는 synthSum 뒤 상태) */
  summed(p: SynthParams, s: SState): Msg {
    const j = s.k - 1;
    const b = s.bot[j - 1] as number;
    const m = s.mid[j] as number;
    const t = p.coeffs[j] as number;
    const sum = s.bot[j] as number;
    if (synthDone(p, s)) {
      const times = COUNT[p.coeffs.length - 1] ?? String(p.coeffs.length - 1);
      return {
        text: `마지막 칸 ${fmt(sum)} ${jo(sum, '이')} 곧 f(${fmt(p.root)}) 예요. "곱해 올리고 더하기"를 ${times} 번 되풀이했을 뿐이에요.`,
        cls: 'ok',
      };
    }
    return {
      text: `${fmt(b)} × ${par(p.root)} = ${fmt(m)} 올리고, ${fmt(t)} + ${par(m)} = ${fmt(sum)} 내려와요. 같은 일을 한 번 더.`,
      cls: '',
    };
  },
  /** 화면 낭독기: "1 곱하기 2 는 2, 0 더하기 2 는 2" */
  summedSr(p: SynthParams, s: SState): string {
    const j = s.k - 1;
    const b = s.bot[j - 1] as number;
    const m = s.mid[j] as number;
    const sum = s.bot[j] as number;
    return `${fmt(b)} 곱하기 ${fmt(p.root)} ${jo(p.root, '은')} ${fmt(m)}, ${fmt(p.coeffs[j] as number)} 더하기 ${fmt(m)} ${jo(m, '은')} ${fmt(sum)}`;
  },
};

/** 칸 한 개(48px)에 드는 수: 빼기 기호 포함 세 글자까지 */
const fits = (v: number) => fmt(v).length <= 3;

function parseSynth(o: Record<string, unknown>): SynthParams {
  const coeffs = arr(o.coeffs, '조립제법 coeffs', 3, 5).map((v, i) =>
    int(v, `조립제법 coeffs${i + 1}`, -99, 99),
  );
  const p: SynthParams = { mode: 'synth', coeffs, root: int(o.root, '조립제법 root', -9, 9) };
  if (coeffs[0] === 0) fail('조립제법 coeffs', '첫 계수(가장 높은 차수)가 0 임');
  if (p.root === 0)
    fail('조립제법 root', '0 이 아닌 수여야 함(x 로 나누기는 조립제법이 필요 없음)');
  // 끝까지 진행해 칸에 적히는 모든 수가 한 칸 안에 드는가
  let s = synthPlace(p, synthInit(p), 'bot', 0).s;
  for (let j = 1; j < coeffs.length; j++) s = synthSum(p, synthPlace(p, s, 'mid', j).s);
  for (const v of [...coeffs, ...s.mid, ...s.bot])
    if (v !== null && !fits(v))
      fail('조립제법', `칸에 ${fmt(v)} ${jo(v, '이')} 안 들어감(빼기 기호 포함 3글자까지)`);
  return p;
}

function synthChecks(p: SynthParams): WidgetCheck[] {
  let s = synthPlace(p, synthInit(p), 'bot', 0).s;
  for (let j = 1; j < p.coeffs.length; j++) s = synthSum(p, synthPlace(p, s, 'mid', j).s);
  const f = polySym(p.coeffs);
  const dv = `x-(${p.root})`;
  const n = p.coeffs.length;
  const out: WidgetCheck[] = s.bot.slice(0, n - 1).map((v, j) => ({
    name: `몫 계수 ${j + 1}`,
    answer: String(v),
    answerType: 'int',
    check: `Poly(div(${f}, ${dv}, x)[0], x).all_coeffs()[${j}]`,
  }));
  const rem = String(s.bot[n - 1]);
  out.push({
    name: '몫',
    answer: polySym(s.bot.slice(0, n - 1) as number[]),
    answerType: 'expr',
    check: `div(${f}, ${dv}, x)[0]`,
  });
  out.push({ name: '나머지', answer: rem, answerType: 'int', check: `div(${f}, ${dv}, x)[1]` });
  // 나머지정리: 마지막 칸 = f(a) — 화면 결론 글이 이것을 말한다
  out.push({ name: 'f(a)', answer: rem, answerType: 'int', check: `(${f}).subs(x, ${p.root})` });
  return out;
}

// ---- 나눗셈 사다리(ladder) ----

/** 칸 자리(시안 ladder.html): 나누는 수 x, 두 수 x, 줄 y */
export const LD_LX = 78;
export const LD_AX = 152;
export const LD_BX = 218;
const LD_PITCH = 46;
export const LD_RY = (r: number) => 26 + r * LD_PITCH;
export const ldHeight = (rows: number) => LD_RY(rows - 1) + 32;
/** 줄 수 상한(처음 두 수 포함). 공약수가 소수 셋을 넘으면 카드 줄·단추까지 접은 화면에 안 든다 */
const LD_MAX_ROWS = 4;
const DEFAULT_CARDS = [2, 3, 5, 7];

export interface LdState {
  rows: [number, number][];
  divs: number[];
}
export const ladderInit = (p: LadderParams): LdState => ({ rows: [[...p.numbers]], divs: [] });

/** 카드를 놓은 뒤 판정(P3): 두 수가 모두 나누어떨어질 때만 아래 줄이 생긴다 */
export function ladderApply(s: LdState, card: number): { res: 'ok' | 'one' | 'none'; s: LdState } {
  const [a, b] = s.rows.at(-1) as [number, number];
  const da = a % card === 0;
  const db = b % card === 0;
  if (da && db)
    return { res: 'ok', s: { rows: [...s.rows, [a / card, b / card]], divs: [...s.divs, card] } };
  return { res: da || db ? 'one' : 'none', s };
}
/** '더 함께 나눌 수 없어요'를 눌렀을 때. 아직 공약수가 있으면 still(어느 수인지는 말하지 않는다) */
export const ladderDone = (s: LdState): 'still' | 'done' => {
  const [a, b] = s.rows.at(-1) as [number, number];
  return gcd(a, b) > 1 ? 'still' : 'done';
};
export function ladderResult(s: LdState) {
  const g = s.divs.reduce((x, y) => x * y, 1);
  const rest = s.rows.at(-1) as [number, number];
  return { g, l: g * rest[0] * rest[1], divs: s.divs, rest };
}

export const ladderText = {
  /** 점선 칸의 이름(화면 낭독기) */
  target: (a: number, b: number) => `${a} ${jo(a, '과')} ${b} ${jo(b, '을')} 함께 나눌 수 칸`,
  intro: (p: LadderParams) =>
    `수 카드를 끌어 ${p.numbers[0]}·${p.numbers[1]} 왼쪽 칸에 놓아 보세요.`,
  apply(s: LdState, card: number): Msg {
    const [a, b] = s.rows.at(-1) as [number, number];
    const r = ladderApply(s, card);
    if (r.res === 'ok')
      return {
        text: `${a} ÷ ${card} = ${a / card}, ${b} ÷ ${card} = ${b / card}. 더 함께 나눌 수 있을까요?`,
        cls: '',
      };
    if (r.res === 'one') {
      const [x, y] = a % card === 0 ? [a, b] : [b, a];
      return {
        text: `${card} ${jo(card, '으로')} ${x} ${jo(x, '은')} 나뉘지만 ${y} ${jo(y, '은')} 나누어떨어지지 않아요. 두 수를 함께 나누는 수만 놓아요.`,
        cls: 'bad',
      };
    }
    return {
      text: `${card} ${jo(card, '으로')}는 ${a} 도 ${b} 도 나누어떨어지지 않아요.`,
      cls: 'bad',
    };
  },
  done(s: LdState): Msg {
    const [a, b] = s.rows.at(-1) as [number, number];
    if (ladderDone(s) === 'still')
      return { text: '아직 두 수를 함께 나누는 수가 있어요.', cls: 'bad' };
    return {
      text: `${a} ${jo(a, '과')} ${b} ${jo(b, '은')} 1 말고 함께 나누는 수가 없어요. 왼쪽은 '함께 가진 조각', 아래는 '각자 조각'.`,
      cls: 'ok',
    };
  },
};

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
};
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}
/** 소인수(겹치는 것까지) */
function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let f = 2; f * f <= m; f++)
    while (m % f === 0) {
      out.push(f);
      m /= f;
    }
  if (m > 1) out.push(m);
  return out;
}

function parseLadder(o: Record<string, unknown>): LadderParams {
  const nums = arr(o.numbers, '사다리 numbers', 2, 2).map((v, i) =>
    int(v, `사다리 numbers${i + 1}`, 2, 999),
  ) as [number, number];
  const cards =
    o.cards === undefined
      ? DEFAULT_CARDS
      : arr(o.cards, '사다리 cards', 1, 4).map((v, i) => int(v, `사다리 cards${i + 1}`, 2, 97));
  cards.forEach((c, i) => {
    if (!isPrime(c)) fail('사다리 cards', `${c} ${jo(c, '은')} 소수가 아님(카드는 소수만)`);
    if (i > 0 && c <= (cards[i - 1] as number)) fail('사다리 cards', '작은 수부터, 겹치지 않게');
  });
  const g = gcd(nums[0], nums[1]);
  if (g === 1)
    fail(
      '사다리',
      `${nums[0]} ${jo(nums[0], '과')} ${nums[1]} ${jo(nums[1], '은')} 서로소라 함께 나눌 수가 없음`,
    );
  const fs = primeFactors(g);
  for (const f of fs)
    if (!cards.includes(f)) fail('사다리 cards', `공약수의 소인수 ${f} 카드가 없음`);
  if (fs.length + 1 > LD_MAX_ROWS)
    fail(
      '사다리',
      `함께 나누는 횟수가 ${fs.length}번이라 ${fs.length + 1}줄 — 접은 화면에 ${LD_MAX_ROWS}줄까지`,
    );
  return { mode: 'ladder', numbers: nums, cards };
}

function ladderChecks(p: LadderParams): WidgetCheck[] {
  // 작은 카드부터 되풀이해 끝까지(학생의 차례는 달라도 결과는 같다 — 소인수분해는 하나뿐)
  let s = ladderInit(p);
  for (const c of p.cards) {
    let r = ladderApply(s, c);
    while (r.res === 'ok') {
      s = r.s;
      r = ladderApply(s, c);
    }
  }
  const { g, l } = ladderResult(s);
  const [a, b] = p.numbers;
  return [
    { name: '최대공약수', answer: String(g), answerType: 'int', check: `gcd(${a}, ${b})` },
    { name: '최소공배수', answer: String(l), answerType: 'int', check: `lcm(${a}, ${b})` },
  ];
}

// ---- 등록 ----

const MODES = ['long', 'synth', 'ladder'] as const;
const FIELDS: Record<(typeof MODES)[number], [string[], string[]]> = {
  long: [['mode', 'dividend', 'divisor'], ['decimal']],
  synth: [['mode', 'coeffs', 'root'], []],
  ladder: [['mode', 'numbers'], ['cards']],
};

export const columnDef: WidgetDef<ColumnParams> = {
  parse(raw) {
    const head = obj(
      raw,
      '세로셈',
      ['mode'],
      ['dividend', 'divisor', 'decimal', 'coeffs', 'root', 'numbers', 'cards'],
    );
    const mode = oneOf(head.mode, '세로셈 mode', MODES);
    const [req, opt] = FIELDS[mode];
    const o = obj(raw, `세로셈(${mode})`, req, opt);
    if (mode === 'long') return parseLong(o);
    if (mode === 'synth') return parseSynth(o);
    return parseLadder(o);
  },
  checks(p) {
    if (p.mode === 'long') return longChecks(p);
    if (p.mode === 'synth') return synthChecks(p);
    return ladderChecks(p);
  },
  texts: () => [],
  hasGoal: () => true,
};
