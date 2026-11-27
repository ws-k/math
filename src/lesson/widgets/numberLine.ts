// 수직선 부품의 모델(순수). 화면(NumberLine.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 점 위치는 실수가 아니라 "칸 번호"(정수)로 들고 다닌다 — 값은 min + 칸×step 을 분수로 정확히 계산하므로
// 3/2 칸에 놓인 점이 1.4999999 로 읽혀 채점이 틀어지는 일이 없다.
// 할 수 있는 것: 끄는 점(점 찍기 과제 — 한 점·여러 점), 점프(덧셈·뺄셈 — 점을 그만큼 끌어 옮기면 화살표가 남는다),
// 구간(부등식의 해, 고르기 과제), 자료 점과 평균·중앙값(점을 끌면 평균선·중앙값선이 따라 움직인다),
// 슬라이더로 움직이는 점(점 자리 = 슬라이더 글자의 식).
// 2-라(추가형 옵션): 범위 확대(끝 ±1,000,000·100칸)·소수 눈금(decimal), 두 줄(second — 같은 길이의 다른 눈금),
// 양쪽 막힌·두 조각 구간(region·구간 과제의 lo·hi·out — 계산은 numberLineSet.ts), 무리수 점(고정 점의 식 자리,
// 무리수에 가장 가까운 칸 찍기 near — P10), 편차 막대·분산·표준편차·점 무게(numberLineStats.ts), 진리집합 비교(sets).
//
// 점프를 '다음 이동 보기' 단추에서 끌기로 바꾼 까닭(docs/plan-widgets-v2.md P2): 단추는 결과를 대신 그려 주어 학생이
// 셈하지 않는다. 지금은 점프하는 점(JUMPER)을 다음 도착 칸에 놓아야 화살표가 생긴다 — 놓는 자리가 곧 셈이다.
// 판정은 손을 뗀 자리에서만(P3): 끄는 도중 도착 칸을 지나가도 세지 않으므로 jumpHits 는 놓은 상태에만 부른다.
//
// 다른 부품이 빌려 쓰는 함수(3-가 좌표평면 길 띠 — 읽어 쓰기만): valueAt(칸 → 값) · xOf(칸 → 그림 x) · nlTicks(눈금·숫자).
// 셋 다 매개변수(min·max·step·label)만 보고 상태를 보지 않는다. 쓰임새는 docs/widgets.md 'numberLine — 빌려 쓰는 함수'.
import { LITERAL } from '../../content/check.ts';
import { clamp, keyStep, MIN_CELL_PX, NARROW_CARD_W } from '../drag.ts';
import { compile, evalExact, evalNum } from '../expr.ts';
import { formatValue } from '../format.ts';
import { arr, fail, int, type Obj, obj, oneOf, optStr, rationalStr, str } from '../parse.ts';
import { type Node, parseSym, symToTex } from '../sym.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import {
  type NLEnd,
  type NLSet,
  RELATION_CODE,
  relation,
  relationText,
  setPy,
  setText,
} from './numberLineSet.ts';
import { statsOf } from './numberLineStats.ts';
import { add, cmp, div, mul, num, py, type Q, q, qi, ratStr, sub } from './q.ts';
import { SLIDER_ID, SLIDER_ID_MSG } from './sliderInput.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type { NLEnd, NLSet };

export interface NLPoint {
  id: string;
  /** 칸 위의 처음 값. 슬라이더 점(follow)에는 없다. irr 이면 무리수 식("sqrt(2)") */
  at?: string;
  drag: boolean;
  label?: string;
  /** 슬라이더 글자로 쓴 자리 식("t**2-4*t"). 있으면 끌 수 없고 슬라이더를 따라 움직인다 */
  follow?: string;
  /** at 이 무리수 식이다(끌 수 없는 점만 — 칸 위가 아니다) */
  irr?: boolean;
}
/** 두 줄 수직선의 아래 줄: 위 줄과 같은 길이에 다른 눈금(위 min ↔ 아래 min, 위 max ↔ 아래 max) */
export interface NLSecond {
  min: string;
  max: string;
  step: string;
  label?: string;
  unit?: string;
}
/** 진리집합 하나: 이름·조건(부등식 하나)·그린 구간 */
export interface NLSetDef extends NLSet {
  name: string;
  cond: string;
}
export type NLStat = 'mean' | 'median' | 'dev' | 'var' | 'sd';
/** 구간 고르기 정답: 끝점 하나 + 방향(옛 꼴) 또는 끝점 둘(양쪽 막힌·두 조각) */
export type NLRay = { at: string; dir: NLDir; open: boolean };
export type NLTwoEnds = { lo: NLEnd; hi: NLEnd; out: boolean };
export interface NLSlider {
  /** 식에 쓰는 한 글자 */
  id: string;
  min: string;
  max: string;
  step: string;
  value: string;
  label: string;
}
/** 여러 점 과제의 한 점 */
export interface NLAnswer {
  point: string;
  answer: string;
  check: string;
}
export type NLDir = 'left' | 'right';
export type NLTask =
  /**
   * 점 찍기. near 가 있으면 무리수에 가장 가까운 칸 찍기(P10) — answer 는 그 칸의 값(형식 검사가 계산해 넣는다)이고
   * check 는 없다(검산이 near 원문으로 '반 칸 안'을 따로 본다)
   */
  | { type: 'point'; point: string; answer: string; check?: string; near?: string }
  | { type: 'points'; answers: NLAnswer[] }
  | { type: 'interval'; ineq: string; answer: NLRay | NLTwoEnds };

export interface NLParams {
  min: number;
  max: number;
  /** 칸 간격(정수나 "a/b") */
  step: string;
  /** 숫자를 적는 간격. 없으면 1(칸이 1보다 크면 칸마다) */
  label?: string;
  /** 눈금 숫자·읽는 값을 소수 글자로(칸·이동이 모두 유한소수여야 한다) */
  decimal?: boolean;
  /** 위 줄 단위(읽는 값·마지막 숫자 뒤). 두 줄일 때 어느 줄이 무엇인지 */
  unit?: string;
  second?: NLSecond;
  points: NLPoint[];
  jumps?: { start: string; moves: string[] };
  /** 보여 주기만 하는 구간(부등식의 해) */
  region?: NLSet;
  data?: { values: string[]; weights?: number[]; drag: boolean; show: NLStat[]; digits: number };
  task?: NLTask;
  slider?: NLSlider;
  /** 진리집합(1~3개) — 줄을 나눠 수직선 위에 그린다 */
  sets?: NLSetDef[];
  /** 진리집합 둘의 포함 관계를 읽는 값으로 */
  compare?: boolean;
}

/** 두 끝 구간 고르기의 선택. a·b 는 손잡이 ia·ib 의 칸(엇갈려도 된다 — 읽을 때 왼쪽부터) */
export interface NLTwoState {
  a: number;
  b: number;
  aOpen: boolean;
  bOpen: boolean;
  out: boolean;
}

export interface NLState {
  /** 점 id → 칸 번호. 점프하는 점은 JUMPER 칸 */
  pts: Record<string, number>;
  /** 자료 점의 칸 번호(자료 순서 그대로) */
  data: number[];
  /**
   * 마친 점프 수. 화면은 이 수를 따로 들지 않고 목표 판정기(useGoal)가 센 수를 넣는다 — 판정 시점(손을 뗀 자리,
   * 키는 멈춘 뒤)이 좌표평면·도형판과 하나여야 학습자가 한 규칙으로 익힌다
   */
  jump: number;
  /** 구간 고르기 과제의 현재 선택 */
  iv: { at: number; dir: NLDir; open: boolean } | null;
  /** 두 끝 구간 고르기의 선택(그 과제가 아니면 null) */
  iw?: NLTwoState | null;
  /** 슬라이더 칸 번호(슬라이더가 없으면 0) */
  sl: number;
}

/**
 * 점프하는 점의 손잡이 id. 점 id 는 대문자 한 글자·자료는 d0…·구간 끝점은 iv 라 소문자 한 글자는 겹치지 않는다.
 * 'jumps.point' 같은 칸을 새로 두지 않은 까닭: 점프는 출발점·이동만으로 끄는 점이 하나로 정해지고, 지금 JSON
 * 10장면이 칸을 바꾸지 않고 형식 검사를 통과해야 한다(plan-remaining 2-2).
 */
export const JUMPER = 'j';

// ---- 칸 ↔ 값 ----

const K = (p: NLParams) => Number(div(sub(qi(p.max), qi(p.min)), q(p.step))[0]);
export const valueAt = (p: NLParams, k: number): Q => add(qi(p.min), mul(qi(k), q(p.step)));
/** 값 → 칸 번호. 칸 위가 아니면 null */
export function cellOf(p: NLParams, v: Q): number | null {
  const k = div(sub(v, qi(p.min)), q(p.step));
  return k[1] === 1n ? Number(k[0]) : null;
}

// ---- 그림 배치(SVG 단위). 손잡이 누르는 영역(반지름 28)이 잘리지 않게 양끝을 띄운다 ----
export const W = 320;
const PAD = 24;
const STACK = 6;
/** 같은 칸 이름표를 쌓는 한 줄 높이 */
const LABEL_ROW = 14;

/** 진리집합 한 줄 높이 */
const SET_ROW = 18;
/** 두 줄 수직선의 줄 사이(위 줄 숫자 아래에 아래 줄 눈금이 닿지 않게) */
const LINE_GAP = 44;
/** 자료 점 쌓기 한 층. 무게가 있으면 개수를 적은 큰 점(반지름 10)이라 넓힌다 */
const dataRow = (p: NLParams) => (p.data?.weights ? 22 : 14);

function layout(p: NLParams) {
  let y = 10;
  const jumpTop = y;
  if (p.jumps) y += 46;
  const setsTop = y;
  if (p.sets) y += p.sets.length * SET_ROW + 6;
  const dataTop = y;
  if (p.data) y += Math.min(p.data.values.length, STACK) * dataRow(p) + 30;
  if (p.points.length || p.task?.type === 'interval') y += 30;
  // 이름표 두 층(한 칸에 점 둘)까지는 점 줄 30 안에 든다. 그보다 많이 모일 수 있으면 모자란 층만큼 높인다 —
  // 끄는 점이 하나인 지금 장면들은 높이가 그대로다
  const rows = Math.max(2, labelRows(p));
  y += (rows - 2) * LABEL_ROW;
  const line = y + 8;
  const line2 = p.second ? line + LINE_GAP : line;
  return { jumpTop, setsTop, dataTop, line, line2, h: line2 + 40, rows };
}

/**
 * 한 칸에 모일 수 있는 점의 최대 수(이름표 층 수). 고정 점은 제자리라 같은 칸 것끼리만, 움직이는 점(끄는 점·슬라이더 점)은
 * 어디든 올 수 있어 모두 더한다. 층을 점 수만큼만 두면 넉넉하고, 모자라 겹치는 일이 없다
 */
function labelRows(p: NLParams): number {
  const fixed = new Map<string, number>();
  let moving = 0;
  for (const pt of p.points) {
    if (pt.drag || pt.follow) moving++;
    else if (pt.at !== undefined) fixed.set(pt.at, (fixed.get(pt.at) ?? 0) + 1);
  }
  return Math.max(0, ...fixed.values()) + moving;
}
export const nlHeight = (p: NLParams) => layout(p).h;
export const nlLine = (p: NLParams) => layout(p).line;
/** 두 줄 수직선의 아래 줄 y(아래 줄이 없으면 위 줄과 같다) */
export const nlLine2 = (p: NLParams) => layout(p).line2;
const unitPx = (p: NLParams) => (W - 2 * PAD) / K(p);
export const xOf = (p: NLParams, k: number) => r2(PAD + k * unitPx(p));
/** 칸 위가 아닌 값(실수)의 x — 슬라이더 점·평균선·무리수 점 */
const xNum = (p: NLParams, v: number) => r2(PAD + ((v - p.min) / (p.max - p.min)) * (W - 2 * PAD));
const xVal = (p: NLParams, v: Q) => xNum(p, num(v));

/** 가장 좁은 화면(382)에서 한 칸의 화면 폭(px). 그림 폭 W 가 카드 안쪽 폭으로 줄어 그려지는 비율로 잰다(헤드리스 실측 298) */
const narrowCellPx = (p: NLParams) => unitPx(p) * (NARROW_CARD_W / W);

// ---- 글자 ----

const fmt = (v: Q) => formatValue(ratStr(v), {});
/** 분모가 2·5 로만 이뤄졌나(유한소수) */
export const isDecimal = (v: Q) => {
  let d = v[1];
  for (const f of [2n, 5n]) while (d % f === 0n) d /= f;
  return d === 1n;
};
/** 유한소수를 정확한 소수 글자로(자리 수는 분모가 정한다 — 3/4 → 0.75) */
function decExact(v: Q): string {
  let k = 0;
  while (10n ** BigInt(k) % v[1] !== 0n) k++;
  return formatValue(ratStr(v), { digits: k });
}
/** 이 수직선의 수 글자(decimal 이면 소수, 아니면 정수·분수). 형식 검사가 decimal 수직선의 값이 모두 유한소수임을 확인했다 */
const fmtP = (p: NLParams, v: Q) => (p.decimal ? decExact(v) : fmt(v));
/** digits 자리 소수 글자(ASCII). 정확히 떨어지면 뒤 0 을 지운다 */
function dec(v: Q, digits: number): string {
  const s = formatValue(ratStr(v), { digits }).replace('−', '-').replace(/,/g, '');
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
const exactIn = (v: Q, digits: number) => 10n ** BigInt(digits) % v[1] === 0n;
const statText = (v: Q, digits: number) =>
  `${exactIn(v, digits) ? '' : '약 '}${dec(v, digits).replace('-', '−')}`;

// ---- 슬라이더 ----

/** 슬라이더가 닿는 값(분수 글자, 작은 것부터) */
export function nlSliderValues(p: NLParams): string[] {
  const sl = p.slider;
  if (!sl) return [];
  const n = Number(div(sub(q(sl.max), q(sl.min)), q(sl.step))[0]);
  return Array.from({ length: n + 1 }, (_, k) => ratStr(add(q(sl.min), mul(qi(k), q(sl.step)))));
}
const sliderQ = (p: NLParams, s: NLState): Q => q(nlSliderValues(p)[s.sl] ?? '0');

/** 식은 점마다 한 번만 읽는다(슬라이더를 끄는 동안 매 프레임 식을 다시 읽지 않게) */
const followNodes = new WeakMap<NLPoint, Node>();
function followNode(p: NLParams, pt: NLPoint): Node {
  let n = followNodes.get(pt);
  if (!n) {
    n = compile(pt.follow as string, [p.slider?.id ?? '']);
    followNodes.set(pt, n);
  }
  return n;
}
/** 슬라이더 점의 자리(정확한 분수). 형식 검사가 닿는 모든 슬라이더 값에서 분수임을 확인했다 */
const followQ = (p: NLParams, pt: NLPoint, v: Q): Q | null =>
  evalExact(followNode(p, pt), { [p.slider?.id ?? '']: v });

// ---- 무리수 점(P10) ----

/** 무리수 점의 읽는 값 자리 수. 검산(approx)도 같은 자리에서 반올림한다 */
const IRR_DIGITS = 2;
/** 식(무리수)의 값. 형식 검사가 실수·범위 안임을 확인했다 */
const irrNum = (src: string) => evalNum(parseSym(src), {});
/** 반올림한 근삿값 글자(ASCII 부호 — 검산 value 와 같은 글자). 0.5 는 0 에서 먼 쪽(verify.py check_approx 와 같게) */
function irrDec(x: number, digits = IRR_DIGITS): string {
  const r = (Math.round(Math.abs(x) * 10 ** digits) / 10 ** digits).toFixed(digits);
  return x < 0 && Number(r) !== 0 ? `-${r}` : r;
}
/** 표준편차 근삿값 글자: 자료 통계 글자(dec)처럼 뒤 0 을 지운다. 검산 value 도 이 글자 */
const sdDec = (x: number, digits: number) => {
  const t = irrDec(x, digits);
  return t.includes('.') ? t.replace(/\.?0+$/, '') : t;
};
/**
 * 유리수로 보이는 실수인가(분모 1000 까지의 분수와 1e-12 안). sqrt(4) 처럼 식은 무리수 꼴이어도 값이 유리수면 '≈' 로
 * 적을 까닭이 없고 칸에 놓아야 한다. 교과서의 무리수(√2·π·log₂5)가 이만큼 분수에 붙는 일은 없다
 */
function looksRational(x: number): boolean {
  for (let d = 1; d <= 1000; d++)
    if (Math.abs(x - Math.round(x * d) / d) < 1e-12 * Math.max(1, Math.abs(x))) return true;
  return false;
}
/**
 * 실수 x 에 가장 가까운 칸 번호(허용 오차 = 반 칸, P10). 반 칸 경계에 1e-9 보다 붙어 있으면 null — 앱의 부동소수와
 * sympy 의 정확한 값이 서로 다른 칸을 고를 수 있어 정답 칸을 정하지 않는다(형식 검사가 오류로 막는다).
 * 반 칸 안에 드는 칸은 늘 하나뿐이므로 'P10 의 오차 안 자리가 하나뿐'은 이 경계 검사로 지켜진다.
 */
export function nearestCell(p: NLParams, x: number): number | null {
  const u = (x - p.min) / num(q(p.step));
  const k = Math.round(u);
  if (Math.abs(Math.abs(u - k) - 0.5) < 1e-9 * Math.max(1, Math.abs(u))) return null;
  return k < 0 || k > K(p) ? null : k;
}

// ---- 두 줄 ----

/** 위 줄 값 → 아래 줄 값(비례, 정확한 분수) */
function secondOf(p: NLParams, v: Q): Q {
  const s = p.second as NLSecond;
  const range = sub(q(s.max), q(s.min));
  return add(q(s.min), div(mul(sub(v, qi(p.min)), range), qi(p.max - p.min)));
}
const withUnit = (t: string, u?: string) => (u ? `${t} ${u}` : t);

// ---- 상태 ----

export function nlInit(p: NLParams): NLState {
  const pts: Record<string, number> = {};
  for (const pt of p.points)
    if (pt.at !== undefined && !pt.irr) pts[pt.id] = cellOf(p, q(pt.at)) as number;
  if (p.jumps) pts[JUMPER] = cellOf(p, q(p.jumps.start)) as number;
  const data = (p.data?.values ?? []).map((v) => cellOf(p, q(v)) as number);
  const sl = p.slider ? nlSliderValues(p).indexOf(ratStr(q(p.slider.value))) : 0;
  let iv: NLState['iv'] = null;
  let iw: NLTwoState | null = null;
  if (p.task?.type === 'interval') {
    if ('lo' in p.task.answer) {
      // 두 끝: 3등분 자리에 찬 점·사이로 시작. 그대로 정답이면 바깥으로(처음 모양이 답이 되지 않게)
      const n = K(p);
      iw = {
        a: Math.round(n / 3),
        b: Math.round((2 * n) / 3),
        aOpen: false,
        bOpen: false,
        out: false,
      };
      if (nlGrade(p, { pts, data, jump: 0, iv, iw, sl })) iw = { ...iw, out: true };
    } else {
      const zero = cellOf(p, qi(0));
      const at = zero ?? Math.floor(K(p) / 2);
      iv = { at, dir: 'right', open: false };
      if (nlGrade(p, { pts, data, jump: 0, iv, sl })) iv = { ...iv, dir: 'left' };
    }
  }
  return { pts, data, jump: 0, iv, ...(iw ? { iw } : {}), sl };
}

/** 두 끝 선택 → 구간(왼쪽 끝부터). 끝점이 엇갈려 놓였으면 빈 점/찬 점은 그 손잡이를 따라간다 */
function twoSet(p: NLParams, w: NLTwoState): NLSet {
  const [l, lo, r, ro] = w.a <= w.b ? [w.a, w.aOpen, w.b, w.bOpen] : [w.b, w.bOpen, w.a, w.aOpen];
  return {
    lo: { at: ratStr(valueAt(p, l)), open: lo },
    hi: { at: ratStr(valueAt(p, r)), open: ro },
    out: w.out,
  };
}

/**
 * 두 끝 구간의 단추: 'lo'·'hi' 는 지금 왼쪽·오른쪽에 놓인 끝의 빈 점/찬 점, 'out' 은 사이/바깥. 단추 글이 손잡이 이름이
 * 아니라 자리('왼쪽 끝')인 까닭: 학생은 끝점을 엇갈려 옮길 수 있고, 그때 'ia' 같은 이름은 화면에서 보이지 않는다
 */
export function nlIwFlip(s: NLState, what: 'lo' | 'hi' | 'out'): NLState {
  const w = s.iw;
  if (!w) return s;
  if (what === 'out') return { ...s, iw: { ...w, out: !w.out } };
  const aLeft = w.a <= w.b;
  const flipA = what === 'lo' ? aLeft : !aLeft;
  return { ...s, iw: flipA ? { ...w, aOpen: !w.aOpen } : { ...w, bOpen: !w.bOpen } };
}
/** 두 끝 선택의 왼쪽·오른쪽 끝이 빈 점인가(단추 글) */
export function nlIwEnds(s: NLState): { lo: boolean; hi: boolean } | null {
  const w = s.iw;
  if (!w) return null;
  return w.a <= w.b ? { lo: w.aOpen, hi: w.bOpen } : { lo: w.bOpen, hi: w.aOpen };
}

// ---- 점프 ----

/** 점프를 done 번 마친 자리(값) */
function jumpValue(p: NLParams, done: number): Q {
  const j = p.jumps;
  if (!j) return qi(0);
  return j.moves.slice(0, done).reduce((v, m) => add(v, q(m)), q(j.start));
}
const jumpsLeft = (p: NLParams, s: NLState) => !!p.jumps && s.jump < p.jumps.moves.length;
/** 지금 점프의 출발 칸(마지막으로 도착한 칸). 엉뚱한 칸에 놓아도 출발점은 그대로다 */
export const jumpFrom = (p: NLParams, s: NLState): number =>
  cellOf(p, jumpValue(p, s.jump)) as number;
/** 다음 점프가 닿을 칸. 다 뛰었으면 null */
export const jumpTarget = (p: NLParams, s: NLState): number | null =>
  jumpsLeft(p, s) ? (cellOf(p, jumpValue(p, s.jump + 1)) as number) : null;
/**
 * 놓친 뒤 짚어 줄 다음 점프: 출발 값·방향·크기(글자). 이동량은 문제가 준 조건이라 숨길 답이 아니다 — 놓친 학생에게
 * '어디서부터 얼마만큼'을 다시 말해 줄 뿐 도착 값(셈의 결과)은 말하지 않는다. 다 뛰었으면 null
 */
export function jumpGuide(
  p: NLParams,
  s: NLState,
): { from: string; dir: '왼쪽' | '오른쪽'; amt: string } | null {
  const m = p.jumps?.moves[s.jump];
  if (m === undefined) return null;
  const mv = q(m);
  return {
    from: fmtP(p, jumpValue(p, s.jump)),
    dir: cmp(mv, qi(0)) < 0 ? '왼쪽' : '오른쪽',
    amt: fmtP(p, cmp(mv, qi(0)) < 0 ? mul(mv, qi(-1)) : mv),
  };
}

/**
 * 놓은 상태의 판정 열쇠: 점프하는 점이 다음 도착 칸이면 그 점프 번호 하나. 목표 판정기(goal.ts)는 열쇠를 모아
 * 개수로 끝을 보므로, 번호를 열쇠로 쓰면 '모은 열쇠 수 = 마친 점프 수'가 된다
 */
export function jumpHits(p: NLParams, s: NLState): string[] {
  const t = jumpTarget(p, s);
  return t !== null && s.pts[JUMPER] === t ? [String(s.jump)] : [];
}

/**
 * 지금 끌 수 있는 손잡이(순서 = 화면 순서). 점프가 남았으면 점프하는 점 하나만 — 다른 점(점 찍기 과제의 P)이
 * 같은 칸 근처에 있으면 누르는 영역(반지름 28)이 겹쳐 엉뚱한 점이 잡히고, 장면 글도 '다 뛴 뒤 P 를 옮겨요' 순서다.
 */
export function nlActive(p: NLParams, s: NLState): { id: string; name: string }[] {
  if (jumpsLeft(p, s)) return [{ id: JUMPER, name: '뛰는 점' }];
  return [
    ...p.points.filter((x) => x.drag).map((x) => ({ id: x.id, name: x.label ?? x.id })),
    ...(p.data?.drag ? p.data.values.map((_, i) => ({ id: `d${i}`, name: `자료 ${i + 1}` })) : []),
    ...(s.iv ? [{ id: 'iv', name: '끝점' }] : []),
    ...(s.iw
      ? [
          { id: 'ia', name: '끝점 1' },
          { id: 'ib', name: '끝점 2' },
        ]
      : []),
  ];
}

/** 손잡이 id 의 칸 번호 */
export function cellOfHandle(s: NLState, id: string): number {
  if (id === 'iv') return s.iv?.at ?? 0;
  if (id === 'ia') return s.iw?.a ?? 0;
  if (id === 'ib') return s.iw?.b ?? 0;
  if (/^d\d+$/.test(id)) return s.data[Number(id.slice(1))] ?? 0;
  return s.pts[id] ?? 0;
}

function setCell(s: NLState, id: string, k: number): NLState {
  if (id === 'iv') return s.iv ? { ...s, iv: { ...s.iv, at: k } } : s;
  if (id === 'ia' || id === 'ib')
    return s.iw ? { ...s, iw: { ...s.iw, [id === 'ia' ? 'a' : 'b']: k } } : s;
  if (/^d\d+$/.test(id)) {
    const data = [...s.data];
    data[Number(id.slice(1))] = k;
    return { ...s, data };
  }
  return { ...s, pts: { ...s.pts, [id]: k } };
}

/** 끌기: 시작 상태 s 에서 손잡이를 dx(SVG 단위)만큼 옮긴 상태. 가장 가까운 칸에 붙고 양끝에서 멈춘다 */
export function nlDrag(p: NLParams, s: NLState, id: string, dx: number): NLState {
  const k = clamp(Math.round(cellOfHandle(s, id) + dx / unitPx(p)), 0, K(p));
  return setCell(s, id, k);
}

/** 방향키 한 칸 이동. 다루지 않는 키면 null */
export function nlKey(p: NLParams, s: NLState, id: string, key: string): NLState | null {
  const k = keyStep(cellOfHandle(s, id), key, 1, 0, K(p));
  return k === null ? null : setCell(s, id, k);
}

export function nlGrade(p: NLParams, s: NLState): boolean {
  const t = p.task;
  if (!t) return false;
  if (t.type === 'point') return s.pts[t.point] === cellOf(p, q(t.answer));
  if (t.type === 'points') return t.answers.every((a) => s.pts[a.point] === cellOf(p, q(a.answer)));
  const a = t.answer;
  if ('lo' in a) {
    if (!s.iw) return false;
    const g = twoSet(p, s.iw);
    // 같은 값 비교는 분수로(칸 값 글자가 기약분수라 글자 비교와 같다)
    return (
      g.lo?.at === a.lo.at &&
      g.lo.open === a.lo.open &&
      g.hi?.at === a.hi.at &&
      g.hi.open === a.hi.open &&
      !!g.out === a.out
    );
  }
  return !!s.iv && s.iv.at === cellOf(p, q(a.at)) && s.iv.dir === a.dir && s.iv.open === a.open;
}

/** 자료의 평균·중앙값(분수 글자) */
export function nlStats(p: NLParams, s: NLState): { mean: string; median: string } {
  const st = dataStats(p, s);
  return { mean: ratStr(st.mean), median: ratStr(st.median) };
}
/** 자료 점(칸 번호)의 통계. 무게가 있으면 값마다 그 개수로 센다 */
const dataStats = (p: NLParams, s: NLState) =>
  statsOf(
    s.data.map((k) => valueAt(p, k)),
    p.data?.weights,
  );

const ivText = (p: NLParams, iv: NonNullable<NLState['iv']>) =>
  `x ${iv.dir === 'left' ? (iv.open ? '<' : '≤') : iv.open ? '>' : '≥'} ${fmtP(p, valueAt(p, iv.at))}`;

/**
 * 점프 식. 마친 이동 + 다음 이동을 "= ?" 로("5 − 7 = ?"), 다 뛰면 값("5 − 7 + 3 = 1").
 * 다음 이동을 미리 적는 까닭: 몇만큼 옮길지는 문제가 준 조건이라 숨길 답이 아니고, 학생이 할 일은 그 이동이 닿는 칸을
 * 셈하는 것이다. 도착값은 놓아서 맞혀야 식에 적힌다.
 */
function jumpText(p: NLParams, done: number): string {
  const j = p.jumps;
  if (!j) return '';
  const n = j.moves.length;
  let t = fmtP(p, q(j.start));
  for (const m of j.moves.slice(0, Math.min(done + 1, n))) {
    const mv = q(m);
    t += cmp(mv, qi(0)) < 0 ? ` − ${fmtP(p, mul(mv, qi(-1)))}` : ` + ${fmtP(p, mv)}`;
  }
  return done >= n ? `${t} = ${fmtP(p, jumpValue(p, n))}` : `${t} = ?`;
}

/** 점프 화살표 i 의 [출발, 도착] 값 */
export function jumpEnds(p: NLParams): [Q, Q][] {
  const out: [Q, Q][] = [];
  if (!p.jumps) return out;
  let v = q(p.jumps.start);
  for (const m of p.jumps.moves) {
    const nv = add(v, q(m));
    out.push([v, nv]);
    v = nv;
  }
  return out;
}

type EndX = { x: number; open: boolean };

/**
 * 구간 그림(끝점·빈 점·화살촉). 선은 끝점에서 그 방향 끝까지, 끝에 화살촉. out 이면 lo 왼쪽·hi 오른쪽 두 조각.
 * 키는 모양이 바뀌어도 같다 — 두 끝 고르기에서 학생이 사이/바깥을 바꿀 때 끄는 중 직접 고치기(applyDrawing)가 같은
 * 요소를 찾도록, 안 쓰는 조각(seg2)·화살촉은 지우지 않고 숨긴다(draw.ts 규칙)
 */
function regionMarks(
  p: NLParams,
  key: string,
  ends: { lo?: EndX; hi?: EndX; out?: boolean },
  y = layout(p).line,
  x0 = 6,
): Mark[] {
  const out = !!ends.out && !!ends.lo && !!ends.hi;
  // 사이(또는 반직선): seg 하나. 바깥: seg = 왼쪽 조각(−∞ ~ lo), seg2 = 오른쪽 조각(hi ~ +∞)
  const seg = out
    ? { x1: x0, x2: ends.lo?.x ?? 0 }
    : { x1: ends.lo ? ends.lo.x : x0, x2: ends.hi ? ends.hi.x : W - 6 };
  const seg2 = out ? { x1: ends.hi?.x ?? 0, x2: W - 6 } : { x1: 0, x2: 0 };
  const marks: Mark[] = [
    { k: `${key}-seg`, tag: 'line', a: { ...seg, y1: y, y2: y, class: 'nl-region' } },
    {
      k: `${key}-seg2`,
      tag: 'line',
      a: { ...seg2, y1: y, y2: y, class: 'nl-region', visibility: out ? 'visible' : 'hidden' },
    },
  ];
  const arrow = (x: number, dir: 1 | -1) =>
    `${x},${y} ${x - dir * 10},${y - 7} ${x - dir * 10},${y + 7}`;
  const left = out || !ends.lo;
  const right = out || !ends.hi;
  marks.push({
    k: `${key}-al`,
    tag: 'polygon',
    a: { points: arrow(x0 - 2, -1), class: 'nl-arrow', visibility: left ? 'visible' : 'hidden' },
  });
  marks.push({
    k: `${key}-ar`,
    tag: 'polygon',
    a: { points: arrow(W - 4, 1), class: 'nl-arrow', visibility: right ? 'visible' : 'hidden' },
  });
  for (const [n, e] of [
    ['lo', ends.lo],
    ['hi', ends.hi],
  ] as const) {
    marks.push({
      k: `${key}-${n}`,
      tag: 'circle',
      a: {
        cx: e?.x ?? 0,
        cy: y,
        r: 7,
        class: e?.open ? 'nl-end open' : 'nl-end',
        visibility: e ? 'visible' : 'hidden',
      },
    });
  }
  return marks;
}

/** 상태 → 그릴 목록(움직이는 것만. 눈금·숫자는 화면이 한 번 그린다) */
export function nlDraw(p: NLParams, s: NLState): Drawing {
  const L = layout(p);
  const marks: Mark[] = [];
  const texts: Record<string, string> = {};
  const jumping = jumpsLeft(p, s);
  const sv = p.slider ? sliderQ(p, s) : null;
  // 같은 자리 점의 이름표는 위로 쌓는다(부등호 두 점 과제는 a 위에서 P 를 끌어 출발한다). 고정 점이 먼저 아래층을
  // 차지한다 — 끄는 점이 지나가거나 와 앉아도 고정 점 이름표가 위아래로 뛰지 않게(목록 순서와 무관하게)
  const placed = p.points.map((pt) => {
    if (pt.irr) {
      // 무리수 점: 칸이 아니라 식의 값 자리. 읽는 값은 근삿값(검산은 같은 자리 수의 approx)
      const xv = irrNum(pt.at as string);
      return { pt, v: null, xv, x: xNum(p, xv), hide: false, lv: 0 };
    }
    const v = pt.follow && sv ? (followQ(p, pt, sv) as Q) : valueAt(p, s.pts[pt.id] as number);
    const x = pt.follow ? xVal(p, v) : xOf(p, s.pts[pt.id] as number);
    // 점프가 남았을 때 끄는 점은 숨긴다(nlActive) — 이름표·읽는 값도 함께
    return { pt, v, xv: 0, x, hide: jumping && pt.drag, lv: 0 };
  });
  const stack = new Map<number, number>();
  const moving = (pt: NLPoint) => pt.drag || !!pt.follow;
  for (const a of [...placed.filter((a) => !moving(a.pt)), ...placed.filter((a) => moving(a.pt))]) {
    if (a.hide) continue;
    a.lv = stack.get(a.x) ?? 0;
    stack.set(a.x, a.lv + 1);
  }
  for (const { pt, v, xv, x, hide, lv } of placed) {
    if (pt.drag)
      marks.push({ k: `h:${pt.id}`, tag: 'g', a: { transform: `translate(${x} ${L.line})` } });
    // 끌 수 없는 점(고정 점·슬라이더 점)도 점을 그린다 — 이름표만 있으면 어느 칸인지 안 보인다
    else
      marks.push({
        k: `fx:${pt.id}`,
        tag: 'circle',
        a: { cx: x, cy: L.line, r: 6, class: 'nl-fixed' },
      });
    marks.push({
      k: `pl:${pt.id}`,
      tag: 'text',
      a: {
        x,
        y: L.line - 20 - Math.min(lv, L.rows - 1) * LABEL_ROW,
        class: 'nl-plabel',
        visibility: hide ? 'hidden' : 'visible',
      },
      text: pt.label ?? pt.id,
    });
    const name = pt.label ?? pt.id;
    if (p.second) {
      // 두 줄: 아래 줄의 같은 x 에 작은 점, 두 줄을 잇는 점선(위아래 대응이 눈에 보이게)
      const vis = hide ? 'hidden' : 'visible';
      marks.push({
        k: `pk:${pt.id}`,
        tag: 'line',
        a: { x1: x, y1: L.line, x2: x, y2: L.line2, class: 'nl-link', visibility: vis },
      });
      marks.push({
        k: `p2:${pt.id}`,
        tag: 'circle',
        a: { cx: x, cy: L.line2, r: 5, class: 'nl-p2', visibility: vis },
      });
    }
    if (hide) continue;
    if (!v) texts[`pt:${pt.id}`] = `${name} ≈ ${irrDec(xv).replace('-', '−')}`;
    else {
      const top = withUnit(fmtP(p, v), p.unit);
      texts[`pt:${pt.id}`] = p.second
        ? `${name} = ${top} ↔ ${withUnit(fmtP(p, secondOf(p, v)), p.second.unit)}`
        : `${name} = ${top}`;
    }
  }
  if (p.slider && sv) texts.slider = `${p.slider.id} = ${fmtP(p, sv)}`;
  if (p.jumps) {
    const k = s.pts[JUMPER] as number;
    const x = xOf(p, k);
    // 끄는 점(손잡이)과 다 뛴 뒤의 점을 따로 그린다 — 다 뛰면 손잡이를 없애 다음 점(P)을 잡을 때 겹치지 않게
    marks.push({ k: `h:${JUMPER}`, tag: 'g', a: { transform: `translate(${x} ${L.line})` } });
    marks.push({
      k: 'jdot',
      tag: 'circle',
      a: { cx: x, cy: L.line, r: 6, class: 'nl-jdot', visibility: jumping ? 'hidden' : 'visible' },
    });
    // 출발점 고리: 엉뚱한 칸에 놓았을 때 어디서부터 세는지 보이게(점이 그 위에 있으면 손잡이에 가린다)
    marks.push({
      k: 'jfrom',
      tag: 'circle',
      a: {
        cx: xOf(p, jumpFrom(p, s)),
        cy: L.line,
        r: 11,
        class: 'nl-from',
        visibility: jumping ? 'visible' : 'hidden',
      },
    });
    texts.jump = jumpText(p, s.jump);
    // 지금 자리: 칸이 잘아(1/16) 눈금 숫자만으로는 어느 칸인지 세기 어렵다. 끄는 동안 직접 고친다(P8)
    if (jumping) texts.jnow = `지금 ${fmtP(p, valueAt(p, k))}`;
  }
  if (p.data) marks.push(...dataMarks(p, s, L, texts));
  if (s.iv) {
    const x = xOf(p, s.iv.at);
    const e = { x, open: s.iv.open };
    marks.push(...regionMarks(p, 'iv', s.iv.dir === 'left' ? { hi: e } : { lo: e }));
    marks.push({ k: 'h:iv', tag: 'g', a: { transform: `translate(${x} ${L.line})` } });
    // 손잡이의 꽉 찬 점 위에 덮어 그리는 끝점 표시(빈 점이면 속이 빈 원). 눌림은 손잡이가 받는다(CSS)
    marks.push({
      k: 'iv-top',
      tag: 'circle',
      a: { cx: x, cy: L.line, r: 7, class: s.iv.open ? 'nl-end top open' : 'nl-end top' },
    });
    texts.iv = ivText(p, s.iv);
  }
  if (s.iw) {
    const w = s.iw;
    const g = twoSet(p, w);
    const ex = (e?: NLEnd) => ({ x: xVal(p, q(e?.at ?? '0')), open: !!e?.open });
    marks.push(...regionMarks(p, 'iv', { lo: ex(g.lo), hi: ex(g.hi), out: w.out }));
    for (const [id, k, open] of [
      ['ia', w.a, w.aOpen],
      ['ib', w.b, w.bOpen],
    ] as const) {
      const x = xOf(p, k);
      marks.push({ k: `h:${id}`, tag: 'g', a: { transform: `translate(${x} ${L.line})` } });
      marks.push({
        k: `${id}-top`,
        tag: 'circle',
        a: { cx: x, cy: L.line, r: 7, class: open ? 'nl-end top open' : 'nl-end top' },
      });
    }
    texts.iv = setText(g, (v) => fmtP(p, v));
  }
  // 진리집합 비교: 그린 두 집합의 포함 관계(상태와 무관 — 그림은 nlSets 가 한 번 그린다)
  const [A, B] = p.sets ?? [];
  if (p.compare && A && B) texts.rel = relationText(relation(A, B), A.name, B.name);
  return { marks, texts };
}

/** 손잡이 위에 덮어 그리는 표시(끝점 모양·점 무게 개수). 화면이 손잡이 다음에 그린다 — 눌림은 손잡이가 받는다(CSS) */
export const isTopMark = (k: string) =>
  k.endsWith('-top') || /^dw\d+$/.test(k) || /^dwc\d+$/.test(k);

/**
 * 자료 점과 통계선. 무게가 있으면 값마다 큰 점 하나에 개수를 적는다(요청 85 — 12점 상한을 넘는 자료도 한 점으로).
 * 편차 막대(dev)는 각 점의 높이에서 평균선까지의 가로 막대 — 평균보다 작으면 neg, 크면 pos(색이 다르다)
 */
function dataMarks(
  p: NLParams,
  s: NLState,
  L: ReturnType<typeof layout>,
  texts: Record<string, string>,
): Mark[] {
  const d = p.data as NonNullable<NLParams['data']>;
  const marks: Mark[] = [];
  const st = dataStats(p, s);
  const meanX = xVal(p, st.mean);
  const row = dataRow(p);
  const seen = new Map<number, number>();
  s.data.forEach((k, i) => {
    const h = seen.get(k) ?? 0;
    seen.set(k, h + 1);
    const x = xOf(p, k);
    const y = r2(L.line - (d.weights ? 16 : 14) - Math.min(h, STACK - 1) * row);
    if (d.show.includes('dev')) {
      const c = x < meanX ? 'neg' : x > meanX ? 'pos' : 'zero';
      marks.push({
        k: `dev${i}`,
        tag: 'line',
        a: { x1: meanX, y1: y, x2: x, y2: y, class: `nl-dev ${c}` },
      });
    }
    marks.push(
      d.drag
        ? { k: `h:d${i}`, tag: 'g', a: { transform: `translate(${x} ${y})` } }
        : {
            k: `d${i}`,
            tag: 'circle',
            a: { cx: x, cy: y, r: d.weights ? 10 : 6, class: 'nl-dot' },
          },
    );
    if (d.weights) {
      // 끄는 점이면 손잡이(작은 점) 위에 큰 점을 덮어 그린다 — 개수 글자가 손잡이에 가리지 않게(isTopMark)
      if (d.drag)
        marks.push({
          k: `dwc${i}`,
          tag: 'circle',
          a: { cx: x, cy: y, r: 10, class: 'nl-dot top' },
        });
      marks.push({
        k: `dw${i}`,
        tag: 'text',
        a: { x, y, class: 'nl-wt mid-text' },
        text: String(d.weights[i]),
      });
    }
  });
  const top = L.dataTop + 4;
  for (const [key, v, name] of [
    ['mean', st.mean, '평균'],
    ['median', st.median, '중앙값'],
  ] as const) {
    if (!d.show.includes(key)) continue;
    const x = xVal(p, v);
    marks.push({
      k: key,
      tag: 'line',
      a: { x1: x, y1: top + 12, x2: x, y2: L.line, class: `nl-stat ${key}` },
    });
    marks.push({
      k: `${key}T`,
      tag: 'text',
      a: { x, y: key === 'mean' ? top + 6 : top + 18, class: `nl-statT ${key}` },
      text: name,
    });
    texts[key] = `${name} ${statText(v, d.digits)}`;
  }
  if (d.show.includes('var')) texts.var = `분산 ${statText(st.var, d.digits)}`;
  if (d.show.includes('sd'))
    texts.sd = st.sd
      ? `표준편차 ${statText(st.sd, d.digits)}`
      : `표준편차 약 ${sdDec(st.sdNum, d.digits).replace('-', '−')}`;
  return marks;
}

/** 보여 주기만 하는 구간의 그림(화면이 한 번 그린다) */
export function nlRegion(p: NLParams): Mark[] {
  const r = p.region;
  if (!r) return [];
  return regionMarks(p, 'rg', endsX(p, r));
}
const endsX = (p: NLParams, r: NLSet) => {
  const e = (x?: NLEnd) => (x ? { x: xVal(p, q(x.at)), open: x.open } : undefined);
  const lo = e(r.lo);
  const hi = e(r.hi);
  return { ...(lo ? { lo } : {}), ...(hi ? { hi } : {}), ...(r.out ? { out: true } : {}) };
};

/**
 * 진리집합 그림(화면이 한 번 그린다): 집합마다 수직선 위 한 줄, 왼쪽 여백에 이름, 끝점에서 수직선까지 점선(어느 값인지
 * 아래 눈금으로 읽게). 화살촉은 이름 자리를 비우려고 x 18 에서 시작한다 — 수직선 구간(x 6)보다 안쪽
 */
export function nlSets(p: NLParams): Mark[] {
  if (!p.sets) return [];
  const L = layout(p);
  const out: Mark[] = [];
  p.sets.forEach((st, i) => {
    const y = L.setsTop + 9 + i * SET_ROW;
    const key = `set${i}`;
    const marks = regionMarks(p, key, endsX(p, st), y, 18);
    out.push(...marks.map((m) => ({ ...m, a: { ...m.a, class: `${m.a.class} set${i % 3}` } })));
    for (const e of [st.lo, st.hi])
      if (e) {
        const x = xVal(p, q(e.at));
        out.push({
          k: `${key}-g${e === st.lo ? 'lo' : 'hi'}`,
          tag: 'line',
          a: { x1: x, y1: y + 7, x2: x, y2: L.line, class: 'nl-guide' },
        });
      }
    out.push({
      k: `${key}-name`,
      tag: 'text',
      a: { x: 8, y, class: `nl-setname set${i % 3} mid-text` },
      text: st.name,
    });
  });
  return out;
}

/** 눈금 숫자 한 글자 폭 어림(13px 글꼴, SVG 단위)과 숫자 사이 최소 틈 */
const NUM_CH = 7.5;
const NUM_GAP = 6;

/**
 * 한 줄의 눈금·숫자. 숫자 간격(every)은 ① 13개 넘으면 ceil(개수/12) 배(옛 규칙 그대로) ② 그래도 가장 긴 숫자 글자가
 * 옆 숫자와 겹치면 겹치지 않을 때까지 더 넓힌다(범위 확대 — "5,000" 같은 긴 숫자). ②는 지금 36장면에서 넓어지는
 * 곳이 없다(테스트)
 */
function ticksOf(
  n: number,
  min: Q,
  step: Q,
  every0: Q,
  xAt: (k: number) => number,
  f: (v: Q) => string,
): { x: number; label?: string }[] {
  const range = mul(step, qi(n));
  let every = every0;
  const count = num(div(range, every));
  if (count > 12) every = mul(every, qi(Math.ceil(count / 12)));
  const vAt = (k: number) => add(min, mul(qi(k), step));
  const on = (v: Q, e: Q) => div(sub(v, min), e)[1] === 1n;
  for (let m = 1; m < 1000; m++) {
    const e = mul(every, qi(m));
    let len = 0;
    for (let k = 0; k <= n; k++) if (on(vAt(k), e)) len = Math.max(len, f(vAt(k)).length);
    if (num(div(e, range)) * (W - 2 * PAD) >= len * NUM_CH + NUM_GAP || num(e) >= num(range)) {
      every = e;
      break;
    }
  }
  const out: { x: number; label?: string }[] = [];
  for (let k = 0; k <= n; k++) {
    const v = vAt(k);
    out.push({ x: xAt(k), ...(on(v, every) ? { label: f(v) } : {}) });
  }
  return out;
}
const everyOf = (step: string, label?: string) =>
  q(label ?? (cmp(q(step), qi(1)) > 0 ? step : '1'));

/** 눈금·숫자(화면이 한 번 그린다) */
export function nlTicks(p: NLParams): { x: number; label?: string }[] {
  return ticksOf(
    K(p),
    qi(p.min),
    q(p.step),
    everyOf(p.step, p.label),
    (k) => xOf(p, k),
    (v) => fmtP(p, v),
  );
}

/** 두 줄 수직선의 아래 줄 눈금·숫자. 아래 줄 끝이 위 줄 끝과 같은 x 다 */
export function nlTicks2(p: NLParams): { x: number; label?: string }[] {
  const s = p.second;
  if (!s) return [];
  const step = q(s.step);
  const n = Number(div(sub(q(s.max), q(s.min)), step)[0]);
  return ticksOf(
    n,
    q(s.min),
    step,
    everyOf(s.step, s.label),
    (k) => r2(PAD + (k * (W - 2 * PAD)) / n),
    (v) => fmtP(p, v),
  );
}

/** 점프 이름표 글자 폭 어림(13px 굵은 글꼴 — 숫자·부호 한 글자 7.8, 양옆 틈 4) */
const JUMP_CH = 7.8;

/**
 * 점프 화살표(호·화살촉·이름표). 이름표가 다른 이름표와 겹치면 생략한다(calc-seq-limit 처럼 이동이 1/16 까지 줄면
 * '+3/4 −3/8 …' 이 가운데에 뭉친다 — 2-다 검토). 생략해도 잃는 것이 없다: 읽는 값 줄의 점프 식이 모든 이동을 차례로
 * 적는다(한 줄 요약). 옆으로 비켜 놓으면 어느 호의 이름표인지 끊기고, 줄을 늘리면 그림이 높아져 382 한 화면을 넘는다.
 * 큰 이동부터 자리를 준다 — 큰 호는 이름표가 들어갈 폭이 있고, 작은 호는 눈으로도 크기가 보인다.
 * 자리는 매개변수만으로 정한다(화살표가 하나씩 나타나도 이미 보인 이름표가 사라지거나 움직이지 않게)
 */
export function nlJumpArcs(
  p: NLParams,
): { d: string; arrow: string; label?: { x: number; y: number; text: string; w: number } }[] {
  const line = layout(p).line;
  const ends = jumpEnds(p);
  const arcs = ends.map(([a, b], i) => {
    const x1 = xVal(p, a);
    const x2 = xVal(p, b);
    const y = line - 4;
    const top = y - 34;
    const dir = x2 > x1 ? 1 : -1;
    const mv = q(p.jumps?.moves[i] ?? '0');
    const text = cmp(mv, qi(0)) < 0 ? `−${fmtP(p, mul(mv, qi(-1)))}` : `+${fmtP(p, mv)}`;
    return {
      d: `M${x1} ${y} Q${r2((x1 + x2) / 2)} ${top} ${x2} ${y}`,
      arrow: `${x2},${y} ${r2(x2 - dir * 9)},${y - 9} ${r2(x2 - dir * 2)},${y - 12}`,
      span: Math.abs(x2 - x1),
      label: { x: r2((x1 + x2) / 2), y: top + 8, text, w: r2(text.length * JUMP_CH + 4) },
    };
  });
  const kept: { x: number; w: number }[] = [];
  const keep = new Set<number>();
  for (const i of arcs
    .map((_, i) => i)
    .sort((a, b) => (arcs[b]?.span ?? 0) - (arcs[a]?.span ?? 0))) {
    const l = (arcs[i] as (typeof arcs)[number]).label;
    if (kept.some((o) => Math.abs(o.x - l.x) < (o.w + l.w) / 2)) continue;
    kept.push(l);
    keep.add(i);
  }
  return arcs.map(({ d, arrow, label }, i) => ({ d, arrow, ...(keep.has(i) ? { label } : {}) }));
}

export function ineqTex(ineq: string): string {
  const [l, rel, r] = splitIneq(ineq);
  const t: Record<string, string> = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' };
  return `${symToTex(l)}${t[rel]}${symToTex(r)}`;
}
function splitIneq(s: string): [string, string, string] {
  const m = s.replace(/\s+/g, '').match(/^([^<>=]+)(<=|>=|<|>)([^<>=]+)$/);
  if (!m) throw new Error(`부등식이 아님 (${s})`);
  return [m[1] as string, m[2] as string, m[3] as string];
}

// ---- 형식 검사·검산 ----

const at = (v: unknown, where: string, p: NLParams): string => {
  const s = rationalStr(v, where);
  if (cellOf(p, q(s)) === null) fail(where, `칸 위의 값이 아님 (${s})`);
  const k = cellOf(p, q(s)) as number;
  if (k < 0 || k > K(p)) fail(where, `범위 밖 (${s})`);
  return s;
};
const bool = (v: unknown, where: string): boolean => {
  if (v !== undefined && typeof v !== 'boolean') fail(where, 'true/false 만');
  return v === true;
};
const noLiteral = (check: unknown, where: string) => {
  const c = str(check, where);
  if (LITERAL.test(c)) fail(where, '검산식이 답을 그대로 적은 값임 — 문제 조건으로 계산하는 식');
  return c;
};
const end = (v: unknown, where: string, p: NLParams): NLEnd => {
  const o = obj(v, where, ['at', 'open']);
  return { at: at(o.at, `${where} at`, p), open: bool(o.open, `${where} open`) };
};

const ivPy = (a: { at: string; dir: NLDir; open: boolean }) => {
  const v = py(q(a.at));
  const o = a.open ? 'True' : 'False';
  return a.dir === 'left' ? `Interval(-oo, ${v}, True, ${o})` : `Interval(${v}, oo, ${o}, True)`;
};

/** 슬라이더 칸 수 상한. 슬라이더 점은 닿는 값마다 검산 항목이 하나씩 생긴다 */
const SLIDER_MAX_STATES = 40;

function parseSlider(raw: unknown): NLSlider {
  const w = '수직선 slider';
  const s = obj(raw, w, ['id', 'min', 'max', 'step', 'value', 'label']);
  const id = str(s.id, `${w} id`);
  // 좌표평면 슬라이더와 같은 글자(sliderInput.ts)
  if (!SLIDER_ID.test(id)) fail(`${w} id`, SLIDER_ID_MSG);
  const min = rationalStr(s.min, `${w} min`);
  const max = rationalStr(s.max, `${w} max`);
  const step = rationalStr(s.step, `${w} step`);
  const value = rationalStr(s.value, `${w} value`);
  if (cmp(q(step), qi(0)) <= 0) fail(`${w} step`, '0 보다 커야 함');
  if (cmp(q(max), q(min)) <= 0) fail(`${w} max`, 'min 보다 커야 함');
  const n = div(sub(q(max), q(min)), q(step));
  if (n[1] !== 1n) fail(`${w} step`, `범위(${min}~${max})를 나누어떨어지게 하지 않음`);
  if (n[0] > BigInt(SLIDER_MAX_STATES))
    fail(`${w} step`, `칸이 너무 많음(${n[0]}칸, ${SLIDER_MAX_STATES}칸까지)`);
  const k = div(sub(q(value), q(min)), q(step));
  if (k[1] !== 1n || cmp(q(value), q(min)) < 0 || cmp(q(value), q(max)) > 0)
    fail(`${w} value`, `칸 위의 범위 안 값이 아님 (${value})`);
  return { id, min, max, step, value, label: str(s.label, `${w} label`) };
}

/** 칸 수 상한. 60칸 넘는 줄(2-라 범위 확대)은 382 폭에서 한 칸이 손가락보다 좁아 끄는 것 없이 보여 주기만 된다(칸 폭 하한) */
const MAX_CELLS = 100;
/** 옛 범위(2-다 까지): 정수 끝 ±1000·60칸. 이 안의 옛 옵션만 쓰는 수직선은 칸 폭 하한을 점프에만 건다(아래) */
const OLD_END = 1000;
const OLD_CELLS = 60;

/** 구간 하나(lo·hi·out). lo·hi 가 다 있으면 lo < hi(같으면 한 점·빈 집합이라 '구간'이 아니다) */
function setOf(o: Obj, where: string, p: NLParams): NLSet {
  const r: NLSet = {
    ...(o.lo !== undefined ? { lo: end(o.lo, `${where}.lo`, p) } : {}),
    ...(o.hi !== undefined ? { hi: end(o.hi, `${where}.hi`, p) } : {}),
  };
  if (!r.lo && !r.hi) fail(where, 'lo·hi 중 하나는 있어야 함');
  if (r.lo && r.hi && cmp(q(r.lo.at), q(r.hi.at)) >= 0) fail(where, 'lo 가 hi 보다 작아야 함');
  if (o.out !== undefined) {
    if (!bool(o.out, `${where}.out`)) fail(`${where}.out`, 'out 은 true 만(없으면 사이 구간)');
    if (!r.lo || !r.hi) fail(`${where}.out`, 'out(바깥 두 조각)은 lo·hi 가 다 있어야 함');
    r.out = true;
  }
  return r;
}

function parseSecond(raw: unknown): NLSecond {
  const w = '수직선 second';
  const o = obj(raw, w, ['min', 'max', 'step'], ['label', 'unit']);
  const min = rationalStr(o.min, `${w} min`);
  const max = rationalStr(o.max, `${w} max`);
  const step = rationalStr(o.step, `${w} step`);
  if (cmp(q(step), qi(0)) <= 0) fail(`${w} step`, '0 보다 커야 함');
  if (cmp(q(max), q(min)) <= 0) fail(`${w} max`, 'min 보다 커야 함');
  const n = div(sub(q(max), q(min)), q(step));
  if (n[1] !== 1n) fail(`${w} step`, `범위(${min}~${max})를 나누어떨어지게 하지 않음`);
  if (n[0] > BigInt(MAX_CELLS)) fail(`${w} step`, `칸이 너무 많음(${n[0]}칸, ${MAX_CELLS}칸까지)`);
  const s: NLSecond = { min, max, step };
  if (o.label !== undefined) {
    s.label = rationalStr(o.label, `${w} label`);
    if (div(q(s.label), q(step))[1] !== 1n) fail(`${w} label`, 'step 의 배수가 아님');
  }
  const unit = optStr(o.unit, `${w} unit`);
  if (unit !== undefined) s.unit = unit;
  return s;
}

/** 무리수 고정 점의 자리 식: 실수이고 수직선 안, 값이 유리수가 아니어야 한다(유리수면 칸 위 "a/b" 로) */
function irrAt(src: string, where: string, p: NLParams): string {
  let x: number;
  try {
    x = evalNum(compile(src, []), {});
  } catch (e) {
    return fail(where, (e as Error).message);
  }
  if (!Number.isFinite(x)) fail(where, `실수로 계산되지 않음 (${src})`);
  if (looksRational(x)) fail(where, `값이 유리수 — 칸 위 값이면 "a/b" 로 적기 (${src})`);
  if (x < p.min || x > p.max) fail(where, `범위 밖 (${src} ≈ ${irrDec(x)})`);
  return src;
}

const STATS = ['mean', 'median', 'dev', 'var', 'sd'] as const;

/** 진리집합(1~3개). 이름은 대문자 한 글자, 조건은 x 의 부등식 하나 */
function parseSets(raw: unknown, p: NLParams): NLSetDef[] {
  const names = new Set<string>();
  return arr(raw, '수직선 sets', 1, 3).map((rs, i) => {
    const w = `수직선 sets${i + 1}`;
    const o = obj(rs, w, ['name', 'cond'], ['lo', 'hi', 'out']);
    const name = str(o.name, `${w} name`);
    if (!/^[A-Z]$/.test(name)) fail(`${w} name`, '대문자 한 글자');
    if (names.has(name)) fail(`${w} name`, `중복 (${name})`);
    names.add(name);
    const cond = ineqOf(o.cond, `${w} cond`);
    return { name, cond, ...setOf(o, w, p) };
  });
}

/** x 의 부등식 하나(공백 없앤 글자) */
function ineqOf(raw: unknown, where: string): string {
  const ineq = str(raw, where).replace(/\s+/g, '');
  try {
    const [l, , r] = splitIneq(ineq);
    parseSym(l);
    parseSym(r);
  } catch (e) {
    fail(where, (e as Error).message);
  }
  return ineq;
}

/**
 * 소수 눈금(decimal)이면 화면에 나오는 값이 모두 유한소수여야 한다 — 1/3 은 소수 글자로 정확히 적을 수 없다.
 * 칸 값은 step 의 배수라 step·label·끝이 유한소수면 모두 유한소수다. 점프·슬라이더·두 줄은 따로 본다
 */
function checkDecimal(p: NLParams) {
  const need = (v: string, where: string) => {
    if (!isDecimal(q(v))) fail(where, `소수 눈금(decimal)인데 유한소수가 아님 (${v})`);
  };
  need(p.step, '수직선 step');
  if (p.label) need(p.label, '수직선 label');
  p.jumps?.moves.forEach((m, i) => {
    need(m, `수직선 이동${i + 1}`);
  });
  const sl = p.slider;
  if (sl) {
    need(sl.min, '수직선 slider min');
    need(sl.step, '수직선 slider step');
    for (const pt of p.points)
      if (pt.follow)
        for (const v of nlSliderValues(p))
          need(ratStr(followQ(p, pt, q(v)) as Q), `수직선 점 ${pt.id} follow (${sl.id}=${v})`);
  }
  const s = p.second;
  if (s) {
    need(s.min, '수직선 second min');
    need(s.step, '수직선 second step');
    if (s.label) need(s.label, '수직선 second label');
    // 위 줄 칸 하나만큼의 아래 줄 값(점의 아래 줄 읽는 값이 이 배수로 움직인다)
    need(ratStr(sub(secondOf(p, valueAt(p, 1)), q(s.min))), '수직선 second(위 한 칸의 아래 값)');
  }
}

/**
 * 끄는 것(칸에 놓는 것)이 있는가 — 칸 폭 하한을 걸 대상. 끄는 점·끄는 자료·구간 끝점·점프.
 * 슬라이더는 따로(좌표평면과 같은 슬라이더 줄이 자기 칸 수 상한을 가진다)
 */
const hasCellDrag = (p: NLParams) =>
  p.points.some((x) => x.drag) || !!p.data?.drag || p.task?.type === 'interval' || !!p.jumps;

/**
 * 칸 폭 하한을 거는가. 점프(2-다)와 2-라 에서 새로 연 범위·옵션(60칸 넘게·끝 1000 너머·소수 눈금·무리수 찍기·두 끝 구간)을
 * 쓰는 수직선. 옛 범위의 옛 옵션만 쓰는 지금 36장면은 그대로 통과해야 한다(plan-remaining 2-2) — 그 중 하한(7px)에 못 미치는
 * 것이 하나 있다(m2-repeating-decimal ruler, 1/40 칸 40개 ≈ 6.3px). 그 장면의 손질은 단원 적용(3-아) 몫이라 여기서 막지 않는다
 */
function needsCellFloor(p: NLParams): boolean {
  if (p.jumps) return true;
  const t = p.task;
  return (
    K(p) > OLD_CELLS ||
    Math.abs(p.min) > OLD_END ||
    Math.abs(p.max) > OLD_END ||
    !!p.decimal ||
    (t?.type === 'point' && !!t.near) ||
    (t?.type === 'interval' && 'lo' in t.answer)
  );
}

export const numberLineDef: WidgetDef<NLParams> = {
  parse(raw) {
    const o: Obj = obj(
      raw,
      '수직선',
      ['min', 'max', 'step'],
      [
        'label',
        'points',
        'jumps',
        'region',
        'data',
        'task',
        'slider',
        'decimal',
        'unit',
        'second',
        'sets',
        'compare',
      ],
    );
    // 범위 확대(요청 13 — 5000원 등): 끝은 ±1,000,000 까지. 숫자 간격은 글자 폭을 보고 넓힌다(nlTicks)
    const min = int(o.min, '수직선 min', -1_000_000, 1_000_000);
    const max = int(o.max, '수직선 max', min + 1, 1_000_000);
    const step = rationalStr(o.step, '수직선 step');
    if (cmp(q(step), qi(0)) <= 0) fail('수직선 step', '0 보다 커야 함');
    const kk = div(qi(max - min), q(step));
    if (kk[1] !== 1n) fail('수직선 step', `범위(${min}~${max})를 나누어떨어지게 하지 않음`);
    if (kk[0] > BigInt(MAX_CELLS))
      fail('수직선 step', `칸이 너무 많음(${kk[0]}칸, ${MAX_CELLS}칸까지)`);
    const p: NLParams = { min, max, step, points: [] };
    if (o.label !== undefined) {
      p.label = rationalStr(o.label, '수직선 label');
      if (div(q(p.label), q(step))[1] !== 1n) fail('수직선 label', 'step 의 배수가 아님');
    }
    if (bool(o.decimal, '수직선 decimal')) p.decimal = true;
    const unit = optStr(o.unit, '수직선 unit');
    if (unit !== undefined) p.unit = unit;
    if (o.second !== undefined) p.second = parseSecond(o.second);
    // 슬라이더를 점보다 먼저 읽는다 — 슬라이더 점(follow)의 식이 슬라이더 글자를 쓴다
    if (o.slider !== undefined) p.slider = parseSlider(o.slider);
    const ids = new Set<string>();
    p.points = (o.points === undefined ? [] : arr(o.points, '수직선 points', 1, 4)).map((rp, i) => {
      const w = `수직선 점${i + 1}`;
      const x = obj(rp, w, ['id'], ['at', 'drag', 'label', 'follow']);
      const id = str(x.id, `${w} id`);
      if (!/^[A-Z]$/.test(id)) fail(`${w} id`, '대문자 한 글자');
      if (ids.has(id)) fail(`${w} id`, `중복 (${id})`);
      ids.add(id);
      const label = optStr(x.label, `${w} label`);
      const lab = label !== undefined ? { label } : {};
      if (x.follow !== undefined) {
        if (x.at !== undefined || x.drag !== undefined)
          fail(w, 'follow 점은 at·drag 없이(자리는 슬라이더가 정한다)');
        return { id, drag: false, follow: followOf(p, x.follow, `${w} follow`), ...lab };
      }
      if (x.at === undefined) fail(`${w} at`, '없음');
      const drag = bool(x.drag, `${w} drag`);
      // 분수 꼴이 아니면 무리수 식(√2·π·log₂5 — 요청 57). 끄는 점은 칸에 붙으므로 칸 위 값만
      if (typeof x.at === 'string' && !/^-?\d+(\/\d+)?$/.test(x.at)) {
        if (drag) fail(`${w} at`, `끄는 점은 칸 위의 값만 (${x.at})`);
        return { id, at: irrAt(x.at, `${w} at`, p), drag, irr: true, ...lab };
      }
      return { id, at: at(x.at, `${w} at`, p), drag, ...lab };
    });
    if (o.jumps !== undefined) {
      const j = obj(o.jumps, '수직선 jumps', ['start', 'moves']);
      p.jumps = {
        start: at(j.start, '수직선 jumps.start', p),
        moves: arr(j.moves, '수직선 jumps.moves', 1, 4).map((m, i) => {
          const mv = rationalStr(m, `수직선 이동${i + 1}`);
          // 0 만큼의 이동은 놓지 않아도 도착이라 '옮겨서 셈하기'가 뜻이 없다
          if (cmp(q(mv), qi(0)) === 0) fail(`수직선 이동${i + 1}`, '0 만큼은 뛸 수 없음');
          return mv;
        }),
      };
      for (const [i, [, to]] of jumpEnds(p).entries()) {
        const k = cellOf(p, to);
        if (k === null || k < 0 || k > K(p)) fail(`수직선 이동${i + 1}`, '도착점이 범위 밖');
      }
    }
    if (o.region !== undefined)
      p.region = setOf(obj(o.region, '수직선 region', [], ['lo', 'hi', 'out']), '수직선 region', p);
    if (o.data !== undefined) {
      const d = obj(o.data, '수직선 data', ['values', 'show'], ['drag', 'digits', 'weights']);
      const values = arr(d.values, '수직선 data.values', 2, 12).map((v, i) =>
        at(v, `수직선 자료${i + 1}`, p),
      );
      p.data = {
        values,
        drag: bool(d.drag, '수직선 data.drag'),
        show: arr(d.show, '수직선 data.show', 1, STATS.length).map((v) =>
          oneOf(v, '수직선 data.show', STATS),
        ),
        digits: d.digits === undefined ? 1 : int(d.digits, '수직선 data.digits', 0, 3),
      };
      if (d.weights !== undefined) {
        // 점 무게(요청 85): 값마다 개수. 같은 값이 두 번이면 어느 점의 개수인지 겹쳐 보여 한 점으로 합쳐 적게 한다
        const ws = arr(d.weights, '수직선 data.weights', values.length, values.length).map((v, i) =>
          int(v, `수직선 data.weights${i + 1}`, 1, 99),
        );
        if (ws.length !== values.length) fail('수직선 data.weights', '값과 같은 수만큼');
        if (new Set(values).size !== values.length)
          fail('수직선 data.values', '점 무게가 있으면 같은 값을 두 번 적지 않음(개수로 합치기)');
        p.data.weights = ws;
      }
    }
    if (o.task !== undefined) p.task = parseTask(o.task, p);
    if (o.sets !== undefined) p.sets = parseSets(o.sets, p);
    if (bool(o.compare, '수직선 compare')) {
      if (p.sets?.length !== 2) fail('수직선 compare', '진리집합(sets)이 둘일 때만');
      p.compare = true;
    }
    // 점프가 남은 동안 끌 수 있는 것은 뛰는 점 하나뿐이다(nlActive) — 구간 끝점·끄는 자료·슬라이더를 함께 두면 그것들이
    // 점프를 마칠 때까지 잠겨 있거나(장면 글과 어긋남) 두 조작이 한 그림에서 엉킨다
    if (p.jumps) {
      if (p.task?.type === 'interval') fail('수직선 task', '점프와 구간 고르기는 함께 못 씀');
      if (p.data?.drag) fail('수직선 data.drag', '점프와 끄는 자료는 함께 못 씀');
      if (p.slider) fail('수직선 slider', '점프와 슬라이더는 함께 못 씀');
    }
    if (p.decimal) checkDecimal(p);
    // 칸 폭 하한: 칸 하나에 손가락으로 놓아야 하므로 가장 좁은 화면에서 한 칸이 손가락 하한보다 넓어야 한다(좌표평면
    // 슬라이더와 같은 기준 MIN_CELL_PX). 끄는 것이 없는 줄(보여 주기만)은 100칸까지 된다
    if (hasCellDrag(p) && needsCellFloor(p)) {
      const px = narrowCellPx(p);
      if (px < MIN_CELL_PX)
        fail(
          '수직선 step',
          `${p.jumps ? '점프 칸' : '끄는 칸'}이 가장 좁은 화면에서 ${px.toFixed(1)}px — ${MIN_CELL_PX}px 보다 좁아 칸 하나에 놓기 어려움(step 을 키우거나 범위를 줄이기)`,
        );
    }
    return p;
  },
  checks(p) {
    const out: WidgetCheck[] = [];
    const t = p.task;
    if (t?.type === 'point' && t.near) out.push(...nearChecks(p, t.near, t.answer));
    else if (t?.type === 'point')
      out.push({ name: '점 찍기', answer: t.answer, answerType: 'fraction', check: t.check ?? '' });
    if (t?.type === 'points')
      for (const a of t.answers)
        out.push({
          name: `점 찍기 ${a.point}`,
          answer: a.answer,
          answerType: 'fraction',
          check: a.check,
        });
    if (t?.type === 'interval') {
      const [l, rel, r] = splitIneq(t.ineq);
      const sol = `solveset(${l}${rel}${r}, x, S.Reals)`;
      const same = (py: string) => `1 if ${sol} == ${py} else 0`;
      const a = t.answer;
      if ('lo' in a) {
        // 정답 구간이 부등식의 해와 같은지, 그리고 한 가지씩 바꾼 것(왼쪽 끝·오른쪽 끝 빈 점/찬 점, 사이/바깥)은
        // 모두 다른지(과제가 그 차이를 가려내는지)
        const base: NLSet = { lo: a.lo, hi: a.hi, ...(a.out ? { out: true } : {}) };
        const flip = (e: NLEnd) => ({ ...e, open: !e.open });
        out.push({ name: '구간', answer: '1', answerType: 'int', check: same(setPy(base)) });
        for (const [name, s] of [
          ['구간 왼쪽 끝 반대', { ...base, lo: flip(a.lo) }],
          ['구간 오른쪽 끝 반대', { ...base, hi: flip(a.hi) }],
          ['구간 안팎 반대', { lo: a.lo, hi: a.hi, ...(a.out ? {} : { out: true }) }],
        ] as const)
          out.push({ name, answer: '0', answerType: 'int', check: same(setPy(s)) });
      } else {
        out.push({ name: '구간', answer: '1', answerType: 'int', check: same(ivPy(a)) });
        out.push({
          name: '구간 끝점 반대',
          answer: '0',
          answerType: 'int',
          check: same(ivPy({ ...a, open: !a.open })),
        });
      }
    }
    if (p.jumps) {
      // 점프로 닿는 상태(도착점)마다 하나씩(P7 — 끌기로 생기는 중간 상태도 검산). 답은 앱 모델이 더한 값,
      // 검산식은 매개변수 글자(출발·이동)를 sympy 가 따로 더한다. 마지막 것은 이름을 예전 그대로('점프 도착') —
      // 기준선 비교(verify:diff)에서 바뀌지 않은 항목이 바뀐 것으로 나오지 않게
      const ends = jumpEnds(p);
      const parts = [p.jumps.start, ...p.jumps.moves].map((v) => `(${py(q(v))})`);
      ends.forEach(([, to], i) => {
        out.push({
          name: i === ends.length - 1 ? '점프 도착' : `점프 ${i + 1} 도착`,
          answer: ratStr(to),
          answerType: 'fraction',
          check: parts.slice(0, i + 2).join('+'),
        });
      });
    }
    if (p.slider) {
      const sl = p.slider;
      // 슬라이더 점: 닿는 슬라이더 값마다 앱이 낸 자리 = sympy 가 식에 그 값을 넣은 것
      for (const pt of p.points) {
        if (!pt.follow) continue;
        // 원문 그대로 넘긴다 — 앱이 읽은 식 구조(toSym)를 거치면 앱의 식 읽기가 틀릴 때 검산도 같이 틀린다(coord/follow.ts 와 같은 원칙)
        const expr = pt.follow;
        for (const v of nlSliderValues(p))
          out.push({
            name: `슬라이더 점 ${pt.id} (${sl.id}=${v})`,
            answer: ratStr(followQ(p, pt, q(v)) as Q),
            answerType: 'fraction',
            check: `(${expr}).subs(${sl.id}, ${py(q(v))})`,
          });
      }
    }
    // 무리수 고정 점: 읽는 값(근삿값) = sympy 가 식 원문을 같은 자리에서 반올림한 값
    for (const pt of p.points)
      if (pt.irr)
        out.push({
          name: `무리수 점 ${pt.id}`,
          kind: 'approx',
          expr: pt.at as string,
          value: irrDec(irrNum(pt.at as string)),
          digits: IRR_DIGITS,
        });
    if (p.second) out.push(...secondChecks(p));
    if (p.data) out.push(...dataChecks(p));
    if (p.sets) {
      // 그린 진리집합 = 조건의 해(solveset). 포함 관계는 그린 구간이 아니라 조건에서 sympy 가 따로(is_subset 두 번)
      const sol = (c: string) => {
        const [l, rel, r] = splitIneq(c);
        return `solveset(${l}${rel}${r}, x, S.Reals)`;
      };
      for (const st of p.sets)
        out.push({
          name: `진리집합 ${st.name}`,
          answer: '1',
          answerType: 'int',
          check: `1 if ${sol(st.cond)} == ${setPy(st)} else 0`,
        });
      const [A, B] = p.sets;
      if (p.compare && A && B)
        out.push({
          name: '포함 관계',
          answer: String(RELATION_CODE[relation(A, B)]),
          answerType: 'int',
          check: `(1 if (${sol(A.cond)}).is_subset(${sol(B.cond)}) else 0) + (2 if (${sol(B.cond)}).is_subset(${sol(A.cond)}) else 0)`,
        });
    }
    return out;
  },
  texts: (p) => [
    ...p.points.flatMap((x) => (x.label ? [x.label] : [])),
    ...(p.slider ? [p.slider.label] : []),
    ...(p.unit ? [p.unit] : []),
    ...(p.second?.unit ? [p.second.unit] : []),
  ],
  // 과제(확인으로 채점)나 점프(다 뛰면 끝)가 있으면 이룰 목표가 있다 — 장면의 afterGoal(결론 글을 목표 뒤에)을 쓸 수 있다
  hasGoal: (p) => !!p.task || !!p.jumps,
};

/**
 * 무리수 점 찍기(P10): 앱이 고른 칸(answer)이 sympy 의 정확한 값에서 반 칸 안에 들고, 바로 옆 두 칸은 반 칸 밖인가.
 * 식은 매개변수 원문(near) 그대로 — 앱이 계산한 부동소수를 옮겨 적지 않는다. 반 칸 안의 칸은 늘 많아야 하나라서
 * 옆 두 칸이 밖이면 '오차 안 자리가 정답 하나뿐'이 정확한 값으로 확인된다
 */
function nearChecks(p: NLParams, near: string, answer: string): WidgetCheck[] {
  const h = py(div(q(p.step), qi(2)));
  const c = q(answer);
  const st = q(p.step);
  const inside = (v: Q) => `Abs(${py(v)} - (${near})) < ${h}`;
  return [
    { name: '무리수 점 찍기', answer: '1', answerType: 'int', check: `1 if ${inside(c)} else 0` },
    {
      name: '무리수 점 찍기 이웃',
      answer: '0',
      answerType: 'int',
      check: `1 if (${inside(sub(c, st))}) or (${inside(add(c, st))}) else 0`,
    },
  ];
}

/**
 * 두 줄: 점이 읽히는 자리(점 찍기 답 칸, 고정 점이면 그 자리)마다 아래 줄 값 = sympy 가 두 줄의 끝 값(원문)으로
 * 따로 비례 계산한 값. 끄는 동안 닿는 모든 칸을 다 늘어놓지 않는 까닭: 같은 일차식이라 앱 계산이 맞는 자리와 틀리는
 * 자리가 갈리지 않고, 학생이 답으로 읽는 자리는 답 칸이다
 */
function secondChecks(p: NLParams): WidgetCheck[] {
  const s = p.second as NLSecond;
  const t = p.task;
  const answers = new Map<string, string>();
  if (t?.type === 'point') answers.set(t.point, t.answer);
  if (t?.type === 'points') for (const a of t.answers) answers.set(a.point, a.answer);
  const out: WidgetCheck[] = [];
  for (const pt of p.points) {
    if (pt.irr || pt.follow) continue;
    const v = answers.get(pt.id) ?? (pt.drag ? undefined : pt.at);
    if (v === undefined) continue;
    const [a, b, c, d] = [p.min, p.max, s.min, s.max].map((x) => `(${py(q(String(x)))})`);
    out.push({
      name: `두 줄 ${pt.id}`,
      answer: ratStr(secondOf(p, q(v))),
      answerType: 'fraction',
      check: `${c} + ((${py(q(v))}) - ${a})*(${d} - ${c})/(${b} - ${a})`,
    });
  }
  return out;
}

/**
 * 자료 통계(처음 상태): 평균·중앙값·분산·표준편차. 검산식은 자료 원문(값·개수)을 sympy 가 늘어놓아 따로 센다.
 * 이름이 예전 그대로('평균'·'중앙값')인 것은 무게가 없을 때 식도 예전 그대로다 — verify:diff 에서 바뀐 것으로 나오지 않게
 */
function dataChecks(p: NLParams): WidgetCheck[] {
  const d = p.data as NonNullable<NLParams['data']>;
  const st = dataStats(p, nlInit(p));
  const vals = d.values.map((v) => py(q(v)));
  const digits = d.digits;
  // 무게가 있으면 개수만큼 늘어놓은 목록(최대 12 × 99)
  const list = d.weights
    ? `[x for x, w in zip([${vals.join(', ')}], [${d.weights.join(', ')}]) for _ in range(w)]`
    : `[${vals.join(', ')}]`;
  const out: WidgetCheck[] = [];
  const approx = (name: string, expr: string, value: string): WidgetCheck => ({
    name,
    kind: 'approx',
    expr,
    value,
    digits,
  });
  if (d.weights) {
    if (d.show.includes('mean'))
      out.push(approx('평균', `v = ${list}\nans = Add(*v)/len(v)`, dec(st.mean, digits)));
    if (d.show.includes('median'))
      out.push(
        approx(
          '중앙값',
          `v = sorted(${list})\nn = len(v)\nans = (v[(n - 1) // 2] + v[n // 2]) / 2`,
          dec(st.median, digits),
        ),
      );
  } else {
    const n = d.values.length;
    if (d.show.includes('mean'))
      out.push(approx('평균', `Add(*${list})/${n}`, dec(st.mean, digits)));
    if (d.show.includes('median'))
      out.push(
        approx(
          '중앙값',
          `v = sorted(${list})\nans = (v[${(n - 1) >> 1}] + v[${n >> 1}]) / 2`,
          dec(st.median, digits),
        ),
      );
  }
  const varExpr = `v = ${list}\nm = Add(*v)/len(v)\nans = Add(*[(x - m)**2 for x in v])/len(v)`;
  if (d.show.includes('var')) out.push(approx('분산', varExpr, dec(st.var, digits)));
  if (d.show.includes('sd'))
    out.push(
      approx(
        '표준편차',
        `${varExpr}\nans = sqrt(ans)`,
        st.sd ? dec(st.sd, digits) : sdDec(st.sdNum, digits),
      ),
    );
  return out;
}

/** 슬라이더 점의 식: 슬라이더 글자만 쓰고, 닿는 모든 슬라이더 값에서 분수로 계산되며 수직선 안에 있어야 한다 */
function followOf(p: NLParams, raw: unknown, where: string): string {
  const src = str(raw, where);
  const sl = p.slider;
  if (!sl) return fail(where, '슬라이더(slider)가 없음 — 자리를 정할 값이 없다');
  let n: Node;
  try {
    n = compile(src, [sl.id]);
  } catch (e) {
    return fail(where, (e as Error).message);
  }
  for (const v of nlSliderValues(p)) {
    const x = evalExact(n, { [sl.id]: q(v) });
    if (!x) fail(where, `${sl.id}=${v} 에서 분수로 계산되지 않음`);
    const xq = x as Q;
    if (cmp(xq, qi(p.min)) < 0 || cmp(xq, qi(p.max)) > 0)
      fail(where, `${sl.id}=${v} 에서 ${ratStr(xq)} — 수직선 범위 밖`);
  }
  return src;
}

/** 과제 한 개(점 찍기 · 무리수 점 찍기 · 여러 점 · 구간 고르기) */
function parseTask(raw: unknown, p: NLParams): NLTask {
  const t0 = obj(
    raw,
    '수직선 task',
    ['type'],
    ['point', 'answer', 'check', 'ineq', 'answers', 'near'],
  );
  const type = oneOf(t0.type, '수직선 task.type', ['point', 'points', 'interval'] as const);
  /** 끌 수 있는 점이고 처음 자리가 답이 아닌가 */
  const target = (id: unknown, answer: unknown, where: string) => {
    const pt = p.points.find((x) => x.id === id);
    if (!pt?.drag) fail(`${where}.point`, '끌 수 있는 점 id 가 아님');
    const a = at(answer, `${where}.answer`, p);
    if (pt?.at === a) fail(where, '처음 위치가 이미 답');
    return a;
  };
  if (type === 'point' && t0.near !== undefined) {
    // 무리수에 가장 가까운 칸(P10): 정답 칸은 형식 검사가 정하고, 검산은 near 원문으로 sympy 가 '반 칸 안'을 되풀이
    const t = obj(raw, '수직선 task', ['type', 'point', 'near']);
    const near = str(t.near, '수직선 task.near');
    let x: number;
    try {
      x = evalNum(compile(near, []), {});
    } catch (e) {
      return fail('수직선 task.near', (e as Error).message);
    }
    if (!Number.isFinite(x)) fail('수직선 task.near', `실수로 계산되지 않음 (${near})`);
    if (looksRational(x))
      fail('수직선 task.near', `유리수 — 칸 위에 놓이게 step 을 골라 answer·check 로 (${near})`);
    if (x < p.min || x > p.max) fail('수직선 task.near', `범위 밖 (${near} ≈ ${irrDec(x)})`);
    const k = nearestCell(p, x);
    if (k === null)
      fail(
        '수직선 task.near',
        `칸 경계(반 칸)에 너무 가까워 정답 칸이 하나로 정해지지 않음 (${near})`,
      );
    const answer = target(t.point, ratStr(valueAt(p, k as number)), '수직선 task');
    return { type, point: String(t.point), answer, near };
  }
  if (type === 'point') {
    const t = obj(raw, '수직선 task', ['type', 'point', 'answer', 'check']);
    const answer = target(t.point, t.answer, '수직선 task');
    return {
      type,
      point: String(t.point),
      answer,
      check: noLiteral(t.check, '수직선 task.check'),
    };
  }
  if (type === 'points') {
    // 점 여러 개를 각자 답 칸으로(요청 32 — 부등호 두 점 뒤집기). 한 점이면 'point' 를 쓴다
    const t = obj(raw, '수직선 task', ['type', 'answers']);
    const seen = new Set<string>();
    const answers = arr(t.answers, '수직선 task.answers', 2, 4).map((ra, i) => {
      const w = `수직선 task.answers${i + 1}`;
      const a = obj(ra, w, ['point', 'answer', 'check']);
      const id = String(a.point);
      if (seen.has(id)) fail(`${w} point`, `중복 (${id})`);
      seen.add(id);
      return {
        point: id,
        answer: target(a.point, a.answer, w),
        check: noLiteral(a.check, `${w} check`),
      };
    });
    return { type, answers };
  }
  const t = obj(raw, '수직선 task', ['type', 'ineq', 'answer']);
  const ineq = ineqOf(t.ineq, '수직선 task.ineq');
  const a0 = obj(t.answer, '수직선 task.answer', [], ['at', 'dir', 'open', 'lo', 'hi', 'out']);
  if (a0.lo !== undefined || a0.hi !== undefined) {
    // 끝점 둘(요청 54 — 양쪽 막힌 a<x<b·두 조각 x<a 또는 x>b). 한쪽만 막힌 해는 옛 꼴(at·dir)로 쓴다
    const a = obj(t.answer, '수직선 task.answer', ['lo', 'hi'], ['out']);
    const s = setOf(a, '수직선 task.answer', p);
    return { type, ineq, answer: { lo: s.lo as NLEnd, hi: s.hi as NLEnd, out: !!s.out } };
  }
  const a = obj(t.answer, '수직선 task.answer', ['at', 'dir', 'open']);
  return {
    type,
    ineq,
    answer: {
      at: at(a.at, '수직선 task.answer.at', p),
      dir: oneOf(a.dir, '수직선 task.answer.dir', ['left', 'right'] as const),
      open: bool(a.open, '수직선 task.answer.open'),
    },
  };
}
