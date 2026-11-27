// 수직선 부품의 모델(순수). 화면(NumberLine.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 점 위치는 실수가 아니라 "칸 번호"(정수)로 들고 다닌다 — 값은 min + 칸×step 을 분수로 정확히 계산하므로
// 3/2 칸에 놓인 점이 1.4999999 로 읽혀 채점이 틀어지는 일이 없다.
// 할 수 있는 것: 끄는 점(점 찍기 과제 — 한 점·여러 점), 점프(덧셈·뺄셈 — 점을 그만큼 끌어 옮기면 화살표가 남는다),
// 구간(부등식의 해, 고르기 과제), 자료 점과 평균·중앙값(점을 끌면 평균선·중앙값선이 따라 움직인다),
// 슬라이더로 움직이는 점(점 자리 = 슬라이더 글자의 식).
//
// 점프를 '다음 이동 보기' 단추에서 끌기로 바꾼 까닭(docs/plan-widgets-v2.md P2): 단추는 결과를 대신 그려 주어 학생이
// 셈하지 않는다. 지금은 점프하는 점(JUMPER)을 다음 도착 칸에 놓아야 화살표가 생긴다 — 놓는 자리가 곧 셈이다.
// 판정은 손을 뗀 자리에서만(P3): 끄는 도중 도착 칸을 지나가도 세지 않으므로 jumpHits 는 놓은 상태에만 부른다.
//
// 다른 부품이 빌려 쓰는 함수(3-가 좌표평면 길 띠 — 읽어 쓰기만): valueAt(칸 → 값) · xOf(칸 → 그림 x) · nlTicks(눈금·숫자).
// 셋 다 매개변수(min·max·step·label)만 보고 상태를 보지 않는다. 쓰임새는 docs/widgets.md 'numberLine — 빌려 쓰는 함수'.
import { LITERAL } from '../../content/check.ts';
import { clamp, keyStep, MIN_CELL_PX, NARROW_CARD_W } from '../drag.ts';
import { compile, evalExact } from '../expr.ts';
import { formatValue } from '../format.ts';
import { arr, fail, int, type Obj, obj, oneOf, optStr, rationalStr, str } from '../parse.ts';
import { type Node, parseSym, symToTex } from '../sym.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import { add, cmp, div, mul, num, py, type Q, q, qi, ratStr, sub } from './q.ts';
import { SLIDER_ID, SLIDER_ID_MSG } from './sliderInput.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface NLPoint {
  id: string;
  /** 칸 위의 처음 값. 슬라이더 점(follow)에는 없다 */
  at?: string;
  drag: boolean;
  label?: string;
  /** 슬라이더 글자로 쓴 자리 식("t**2-4*t"). 있으면 끌 수 없고 슬라이더를 따라 움직인다 */
  follow?: string;
}
export interface NLEnd {
  at: string;
  open: boolean;
}
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
  | { type: 'point'; point: string; answer: string; check: string }
  | { type: 'points'; answers: NLAnswer[] }
  | { type: 'interval'; ineq: string; answer: { at: string; dir: NLDir; open: boolean } };

export interface NLParams {
  min: number;
  max: number;
  /** 칸 간격(정수나 "a/b") */
  step: string;
  /** 숫자를 적는 간격. 없으면 1(칸이 1보다 크면 칸마다) */
  label?: string;
  points: NLPoint[];
  jumps?: { start: string; moves: string[] };
  /** 보여 주기만 하는 구간(부등식의 해) */
  region?: { lo?: NLEnd; hi?: NLEnd };
  data?: { values: string[]; drag: boolean; show: ('mean' | 'median')[]; digits: number };
  task?: NLTask;
  slider?: NLSlider;
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

function layout(p: NLParams) {
  let y = 10;
  const jumpTop = y;
  if (p.jumps) y += 46;
  const dataTop = y;
  if (p.data) y += Math.min(p.data.values.length, STACK) * 14 + 30;
  if (p.points.length || p.task?.type === 'interval') y += 30;
  // 이름표 두 층(한 칸에 점 둘)까지는 점 줄 30 안에 든다. 그보다 많이 모일 수 있으면 모자란 층만큼 높인다 —
  // 끄는 점이 하나인 지금 장면들은 높이가 그대로다
  const rows = Math.max(2, labelRows(p));
  y += (rows - 2) * LABEL_ROW;
  const line = y + 8;
  return { jumpTop, dataTop, line, h: line + 40, rows };
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
const unitPx = (p: NLParams) => (W - 2 * PAD) / K(p);
export const xOf = (p: NLParams, k: number) => r2(PAD + k * unitPx(p));
const xVal = (p: NLParams, v: Q) => r2(PAD + ((num(v) - p.min) / (p.max - p.min)) * (W - 2 * PAD));

// ---- 글자 ----

const fmt = (v: Q) => formatValue(ratStr(v), {});
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

// ---- 상태 ----

export function nlInit(p: NLParams): NLState {
  const pts: Record<string, number> = {};
  for (const pt of p.points) if (pt.at !== undefined) pts[pt.id] = cellOf(p, q(pt.at)) as number;
  if (p.jumps) pts[JUMPER] = cellOf(p, q(p.jumps.start)) as number;
  const data = (p.data?.values ?? []).map((v) => cellOf(p, q(v)) as number);
  const sl = p.slider ? nlSliderValues(p).indexOf(ratStr(q(p.slider.value))) : 0;
  let iv: NLState['iv'] = null;
  if (p.task?.type === 'interval') {
    const zero = cellOf(p, qi(0));
    const at = zero ?? Math.floor(K(p) / 2);
    iv = { at, dir: 'right', open: false };
    if (nlGrade(p, { pts, data, jump: 0, iv, sl })) iv = { ...iv, dir: 'left' };
  }
  return { pts, data, jump: 0, iv, sl };
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
    from: fmt(jumpValue(p, s.jump)),
    dir: cmp(mv, qi(0)) < 0 ? '왼쪽' : '오른쪽',
    amt: fmt(cmp(mv, qi(0)) < 0 ? mul(mv, qi(-1)) : mv),
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
  ];
}

/** 손잡이 id 의 칸 번호 */
export function cellOfHandle(s: NLState, id: string): number {
  if (id === 'iv') return s.iv?.at ?? 0;
  if (/^d\d+$/.test(id)) return s.data[Number(id.slice(1))] ?? 0;
  return s.pts[id] ?? 0;
}

function setCell(s: NLState, id: string, k: number): NLState {
  if (id === 'iv') return s.iv ? { ...s, iv: { ...s.iv, at: k } } : s;
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
  return !!s.iv && s.iv.at === cellOf(p, q(a.at)) && s.iv.dir === a.dir && s.iv.open === a.open;
}

/** 자료의 평균·중앙값(분수 글자) */
export function nlStats(p: NLParams, s: NLState): { mean: string; median: string } {
  const [mean, median] = statsQ(p, s);
  return { mean: ratStr(mean), median: ratStr(median) };
}
function statsQ(p: NLParams, s: NLState): [Q, Q] {
  const vs = s.data.map((k) => valueAt(p, k));
  const n = vs.length;
  const mean = div(vs.reduce(add, qi(0)), qi(n));
  const sorted = [...vs].sort(cmp);
  const median = div(add(sorted[(n - 1) >> 1] as Q, sorted[n >> 1] as Q), qi(2));
  return [mean, median];
}

const ivText = (p: NLParams, iv: NonNullable<NLState['iv']>) =>
  `x ${iv.dir === 'left' ? (iv.open ? '<' : '≤') : iv.open ? '>' : '≥'} ${fmt(valueAt(p, iv.at))}`;

/**
 * 점프 식. 마친 이동 + 다음 이동을 "= ?" 로("5 − 7 = ?"), 다 뛰면 값("5 − 7 + 3 = 1").
 * 다음 이동을 미리 적는 까닭: 몇만큼 옮길지는 문제가 준 조건이라 숨길 답이 아니고, 학생이 할 일은 그 이동이 닿는 칸을
 * 셈하는 것이다. 도착값은 놓아서 맞혀야 식에 적힌다.
 */
function jumpText(p: NLParams, done: number): string {
  const j = p.jumps;
  if (!j) return '';
  const n = j.moves.length;
  let t = fmt(q(j.start));
  for (const m of j.moves.slice(0, Math.min(done + 1, n))) {
    const mv = q(m);
    t += cmp(mv, qi(0)) < 0 ? ` − ${fmt(mul(mv, qi(-1)))}` : ` + ${fmt(mv)}`;
  }
  return done >= n ? `${t} = ${fmt(jumpValue(p, n))}` : `${t} = ?`;
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

/** 구간(끝점·방향·빈 점) 그림. 선은 끝점에서 그 방향 끝까지, 끝에 화살촉 */
function regionMarks(
  p: NLParams,
  key: string,
  ends: { lo?: { x: number; open: boolean }; hi?: { x: number; open: boolean } },
): Mark[] {
  const y = layout(p).line;
  const x1 = ends.lo ? ends.lo.x : 6;
  const x2 = ends.hi ? ends.hi.x : W - 6;
  const marks: Mark[] = [
    { k: `${key}-seg`, tag: 'line', a: { x1, y1: y, x2, y2: y, class: 'nl-region' } },
  ];
  const arrow = (x: number, dir: 1 | -1) =>
    `${x},${y} ${x - dir * 10},${y - 7} ${x - dir * 10},${y + 7}`;
  marks.push({
    k: `${key}-al`,
    tag: 'polygon',
    a: { points: arrow(4, -1), class: 'nl-arrow', visibility: ends.lo ? 'hidden' : 'visible' },
  });
  marks.push({
    k: `${key}-ar`,
    tag: 'polygon',
    a: { points: arrow(W - 4, 1), class: 'nl-arrow', visibility: ends.hi ? 'hidden' : 'visible' },
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
    const v = pt.follow && sv ? (followQ(p, pt, sv) as Q) : valueAt(p, s.pts[pt.id] as number);
    const x = pt.follow ? xVal(p, v) : xOf(p, s.pts[pt.id] as number);
    // 점프가 남았을 때 끄는 점은 숨긴다(nlActive) — 이름표·읽는 값도 함께
    return { pt, v, x, hide: jumping && pt.drag, lv: 0 };
  });
  const stack = new Map<number, number>();
  const moving = (pt: NLPoint) => pt.drag || !!pt.follow;
  for (const a of [...placed.filter((a) => !moving(a.pt)), ...placed.filter((a) => moving(a.pt))]) {
    if (a.hide) continue;
    a.lv = stack.get(a.x) ?? 0;
    stack.set(a.x, a.lv + 1);
  }
  for (const { pt, v, x, hide, lv } of placed) {
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
    if (!hide) texts[`pt:${pt.id}`] = `${pt.label ?? pt.id} = ${fmt(v)}`;
  }
  if (p.slider && sv) texts.slider = `${p.slider.id} = ${fmt(sv)}`;
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
    if (jumping) texts.jnow = `지금 ${fmt(valueAt(p, k))}`;
  }
  if (p.data) {
    const seen = new Map<number, number>();
    s.data.forEach((k, i) => {
      const h = seen.get(k) ?? 0;
      seen.set(k, h + 1);
      const x = xOf(p, k);
      const y = r2(L.line - 14 - Math.min(h, STACK - 1) * 14);
      marks.push(
        p.data?.drag
          ? { k: `h:d${i}`, tag: 'g', a: { transform: `translate(${x} ${y})` } }
          : { k: `d${i}`, tag: 'circle', a: { cx: x, cy: y, r: 6, class: 'nl-dot' } },
      );
    });
    const [mean, median] = statsQ(p, s);
    const top = L.dataTop + 4;
    for (const [key, v, name] of [
      ['mean', mean, '평균'],
      ['median', median, '중앙값'],
    ] as const) {
      if (!p.data.show.includes(key)) continue;
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
      texts[key] = `${name} ${statText(v, p.data.digits)}`;
    }
  }
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
  return { marks, texts };
}

/** 보여 주기만 하는 구간의 그림(화면이 한 번 그린다) */
export function nlRegion(p: NLParams): Mark[] {
  const r = p.region;
  if (!r) return [];
  const e = (x?: NLEnd) => (x ? { x: xVal(p, q(x.at)), open: x.open } : undefined);
  const lo = e(r.lo);
  const hi = e(r.hi);
  return regionMarks(p, 'rg', { ...(lo ? { lo } : {}), ...(hi ? { hi } : {}) });
}

/** 눈금·숫자(화면이 한 번 그린다) */
export function nlTicks(p: NLParams): { x: number; label?: string }[] {
  const n = K(p);
  const step = q(p.step);
  let every = q(p.label ?? (cmp(step, qi(1)) > 0 ? p.step : '1'));
  // 숫자가 너무 빽빽하면(13개 넘게) 간격을 넓힌다
  const count = num(div(qi(p.max - p.min), every));
  if (count > 12) every = mul(every, qi(Math.ceil(count / 12)));
  const out: { x: number; label?: string }[] = [];
  for (let k = 0; k <= n; k++) {
    const v = valueAt(p, k);
    const onLabel = div(sub(v, qi(p.min)), every)[1] === 1n;
    out.push({ x: xOf(p, k), ...(onLabel ? { label: fmt(v) } : {}) });
  }
  return out;
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

export const numberLineDef: WidgetDef<NLParams> = {
  parse(raw) {
    const o: Obj = obj(
      raw,
      '수직선',
      ['min', 'max', 'step'],
      ['label', 'points', 'jumps', 'region', 'data', 'task', 'slider'],
    );
    const min = int(o.min, '수직선 min', -1000, 1000);
    const max = int(o.max, '수직선 max', min + 1, 1000);
    const step = rationalStr(o.step, '수직선 step');
    if (cmp(q(step), qi(0)) <= 0) fail('수직선 step', '0 보다 커야 함');
    const kk = div(qi(max - min), q(step));
    if (kk[1] !== 1n) fail('수직선 step', `범위(${min}~${max})를 나누어떨어지게 하지 않음`);
    if (kk[0] > 60n) fail('수직선 step', `칸이 너무 많음(${kk[0]}칸, 60칸까지)`);
    const p: NLParams = { min, max, step, points: [] };
    if (o.label !== undefined) {
      p.label = rationalStr(o.label, '수직선 label');
      if (div(q(p.label), q(step))[1] !== 1n) fail('수직선 label', 'step 의 배수가 아님');
    }
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
      return { id, at: at(x.at, `${w} at`, p), drag: bool(x.drag, `${w} drag`), ...lab };
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
      // 도착 칸 하나에 손가락으로 놓아야 하므로 가장 좁은 화면에서 한 칸이 손가락 하한보다 넓어야 한다(좌표평면 슬라이더와
      // 같은 기준). 그림 폭 W 가 카드 안쪽 폭(NARROW_CARD_W)으로 줄어 그려지는 비율로 잰다(헤드리스 382 실측: 그림 폭 298)
      const px = unitPx(p) * (NARROW_CARD_W / W);
      if (px < MIN_CELL_PX)
        fail(
          '수직선 step',
          `점프 칸이 가장 좁은 화면에서 ${px.toFixed(1)}px — ${MIN_CELL_PX}px 보다 좁아 도착 칸에 놓기 어려움(step 을 키우거나 범위를 줄이기)`,
        );
    }
    if (o.region !== undefined) {
      const r = obj(o.region, '수직선 region', [], ['lo', 'hi']);
      p.region = {
        ...(r.lo !== undefined ? { lo: end(r.lo, '수직선 region.lo', p) } : {}),
        ...(r.hi !== undefined ? { hi: end(r.hi, '수직선 region.hi', p) } : {}),
      };
      if (!p.region.lo && !p.region.hi) fail('수직선 region', 'lo·hi 중 하나는 있어야 함');
    }
    if (o.data !== undefined) {
      const d = obj(o.data, '수직선 data', ['values', 'show'], ['drag', 'digits']);
      p.data = {
        values: arr(d.values, '수직선 data.values', 2, 12).map((v, i) =>
          at(v, `수직선 자료${i + 1}`, p),
        ),
        drag: bool(d.drag, '수직선 data.drag'),
        show: arr(d.show, '수직선 data.show', 1, 2).map((v) =>
          oneOf(v, '수직선 data.show', ['mean', 'median'] as const),
        ),
        digits: d.digits === undefined ? 1 : int(d.digits, '수직선 data.digits', 0, 3),
      };
    }
    if (o.task !== undefined) p.task = parseTask(o.task, p);
    // 점프가 남은 동안 끌 수 있는 것은 뛰는 점 하나뿐이다(nlActive) — 구간 끝점·끄는 자료·슬라이더를 함께 두면 그것들이
    // 점프를 마칠 때까지 잠겨 있거나(장면 글과 어긋남) 두 조작이 한 그림에서 엉킨다
    if (p.jumps) {
      if (p.task?.type === 'interval') fail('수직선 task', '점프와 구간 고르기는 함께 못 씀');
      if (p.data?.drag) fail('수직선 data.drag', '점프와 끄는 자료는 함께 못 씀');
      if (p.slider) fail('수직선 slider', '점프와 슬라이더는 함께 못 씀');
    }
    return p;
  },
  checks(p) {
    const out: WidgetCheck[] = [];
    const t = p.task;
    if (t?.type === 'point')
      out.push({ name: '점 찍기', answer: t.answer, answerType: 'fraction', check: t.check });
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
      // 정답 구간이 부등식의 해와 같은지, 그리고 빈 점/찬 점을 바꾼 것은 다른지(과제가 그 차이를 가려내는지)
      out.push({
        name: '구간',
        answer: '1',
        answerType: 'int',
        check: `1 if ${sol} == ${ivPy(t.answer)} else 0`,
      });
      out.push({
        name: '구간 끝점 반대',
        answer: '0',
        answerType: 'int',
        check: `1 if ${sol} == ${ivPy({ ...t.answer, open: !t.answer.open })} else 0`,
      });
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
    if (p.data) {
      const s = nlInit(p);
      const [mean, median] = statsQ(p, s);
      const list = `[${p.data.values.map((v) => py(q(v))).join(', ')}]`;
      const n = p.data.values.length;
      const digits = p.data.digits;
      if (p.data.show.includes('mean'))
        out.push({
          name: '평균',
          kind: 'approx',
          expr: `Add(*${list})/${n}`,
          value: dec(mean, digits),
          digits,
        });
      if (p.data.show.includes('median'))
        out.push({
          name: '중앙값',
          kind: 'approx',
          expr: `v = sorted(${list})\nans = (v[${(n - 1) >> 1}] + v[${n >> 1}]) / 2`,
          value: dec(median, digits),
          digits,
        });
    }
    return out;
  },
  texts: (p) => [
    ...p.points.flatMap((x) => (x.label ? [x.label] : [])),
    ...(p.slider ? [p.slider.label] : []),
  ],
  // 과제(확인으로 채점)나 점프(다 뛰면 끝)가 있으면 이룰 목표가 있다 — 장면의 afterGoal(결론 글을 목표 뒤에)을 쓸 수 있다
  hasGoal: (p) => !!p.task || !!p.jumps,
};

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

/** 과제 한 개(점 찍기 · 여러 점 · 구간 고르기) */
function parseTask(raw: unknown, p: NLParams): NLTask {
  const t0 = obj(raw, '수직선 task', ['type'], ['point', 'answer', 'check', 'ineq', 'answers']);
  const type = oneOf(t0.type, '수직선 task.type', ['point', 'points', 'interval'] as const);
  /** 끌 수 있는 점이고 처음 자리가 답이 아닌가 */
  const target = (id: unknown, answer: unknown, where: string) => {
    const pt = p.points.find((x) => x.id === id);
    if (!pt?.drag) fail(`${where}.point`, '끌 수 있는 점 id 가 아님');
    const a = at(answer, `${where}.answer`, p);
    if (pt?.at === a) fail(where, '처음 위치가 이미 답');
    return a;
  };
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
  const ineq = str(t.ineq, '수직선 task.ineq').replace(/\s+/g, '');
  try {
    const [l, , r] = splitIneq(ineq);
    parseSym(l);
    parseSym(r);
  } catch (e) {
    fail('수직선 task.ineq', (e as Error).message);
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
