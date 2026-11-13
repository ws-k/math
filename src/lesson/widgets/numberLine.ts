// 수직선 부품의 모델(순수). 화면(NumberLine.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 점 위치는 실수가 아니라 "칸 번호"(정수)로 들고 다닌다 — 값은 min + 칸×step 을 분수로 정확히 계산하므로
// 3/2 칸에 놓인 점이 1.4999999 로 읽혀 채점이 틀어지는 일이 없다.
// 할 수 있는 것: 끄는 점(점 찍기 과제), 점프 화살표(덧셈·뺄셈), 구간(부등식의 해, 고르기 과제),
// 자료 점과 평균·중앙값(점을 끌면 평균선·중앙값선이 따라 움직인다).
import { LITERAL } from '../../content/check.ts';
import { clamp, keyStep } from '../drag.ts';
import { formatValue } from '../format.ts';
import { arr, fail, int, type Obj, obj, oneOf, optStr, rationalStr, str } from '../parse.ts';
import { parseSym, symToTex } from '../sym.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import { add, cmp, div, mul, num, py, type Q, q, qi, ratStr, sub } from './q.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface NLPoint {
  id: string;
  at: string;
  drag: boolean;
  label?: string;
}
export interface NLEnd {
  at: string;
  open: boolean;
}
export type NLDir = 'left' | 'right';
export type NLTask =
  | { type: 'point'; point: string; answer: string; check: string }
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
}

export interface NLState {
  /** 점 id → 칸 번호 */
  pts: Record<string, number>;
  /** 자료 점의 칸 번호(자료 순서 그대로) */
  data: number[];
  /** 펼친 점프 화살표 수 */
  jump: number;
  /** 구간 고르기 과제의 현재 선택 */
  iv: { at: number; dir: NLDir; open: boolean } | null;
}

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

function layout(p: NLParams) {
  let y = 10;
  const jumpTop = y;
  if (p.jumps) y += 46;
  const dataTop = y;
  if (p.data) y += Math.min(p.data.values.length, STACK) * 14 + 30;
  if (p.points.length || p.task?.type === 'interval') y += 30;
  const line = y + 8;
  return { jumpTop, dataTop, line, h: line + 40 };
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

// ---- 상태 ----

export function nlInit(p: NLParams): NLState {
  const pts: Record<string, number> = {};
  for (const pt of p.points) pts[pt.id] = cellOf(p, q(pt.at)) as number;
  const data = (p.data?.values ?? []).map((v) => cellOf(p, q(v)) as number);
  let iv: NLState['iv'] = null;
  if (p.task?.type === 'interval') {
    const zero = cellOf(p, qi(0));
    const at = zero ?? Math.floor(K(p) / 2);
    iv = { at, dir: 'right', open: false };
    if (nlGrade(p, { pts, data, jump: 0, iv })) iv = { ...iv, dir: 'left' };
  }
  return { pts, data, jump: 0, iv };
}

/** 손잡이 id 의 칸 번호 */
export function cellOfHandle(s: NLState, id: string): number {
  if (id === 'iv') return s.iv?.at ?? 0;
  if (id.startsWith('d')) return s.data[Number(id.slice(1))] ?? 0;
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

/** 점프 식 "5 − 7 + 3 = 1"(펼친 만큼) */
function jumpText(p: NLParams, shown: number): string {
  const j = p.jumps;
  if (!j) return '';
  let v = q(j.start);
  let t = fmt(v);
  for (const m of j.moves.slice(0, shown)) {
    const mv = q(m);
    t += cmp(mv, qi(0)) < 0 ? ` − ${fmt(mul(mv, qi(-1)))}` : ` + ${fmt(mv)}`;
    v = add(v, mv);
  }
  return shown ? `${t} = ${fmt(v)}` : t;
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
  for (const pt of p.points) {
    const k = s.pts[pt.id] as number;
    const x = xOf(p, k);
    marks.push({ k: `h:${pt.id}`, tag: 'g', a: { transform: `translate(${x} ${L.line})` } });
    marks.push({
      k: `pl:${pt.id}`,
      tag: 'text',
      a: { x, y: L.line - 20, class: 'nl-plabel' },
      text: pt.label ?? pt.id,
    });
    texts[`pt:${pt.id}`] = `${pt.label ?? pt.id} = ${fmt(valueAt(p, k))}`;
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
  if (p.jumps) texts.jump = jumpText(p, s.jump);
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

export const numberLineDef: WidgetDef<NLParams> = {
  parse(raw) {
    const o: Obj = obj(
      raw,
      '수직선',
      ['min', 'max', 'step'],
      ['label', 'points', 'jumps', 'region', 'data', 'task'],
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
    const ids = new Set<string>();
    p.points = (o.points === undefined ? [] : arr(o.points, '수직선 points', 1, 4)).map((rp, i) => {
      const w = `수직선 점${i + 1}`;
      const x = obj(rp, w, ['id', 'at'], ['drag', 'label']);
      const id = str(x.id, `${w} id`);
      if (!/^[A-Z]$/.test(id)) fail(`${w} id`, '대문자 한 글자');
      if (ids.has(id)) fail(`${w} id`, `중복 (${id})`);
      ids.add(id);
      const label = optStr(x.label, `${w} label`);
      return {
        id,
        at: at(x.at, `${w} at`, p),
        drag: bool(x.drag, `${w} drag`),
        ...(label !== undefined ? { label } : {}),
      };
    });
    if (o.jumps !== undefined) {
      const j = obj(o.jumps, '수직선 jumps', ['start', 'moves']);
      p.jumps = {
        start: at(j.start, '수직선 jumps.start', p),
        moves: arr(j.moves, '수직선 jumps.moves', 1, 4).map((m, i) =>
          rationalStr(m, `수직선 이동${i + 1}`),
        ),
      };
      for (const [i, [, to]] of jumpEnds(p).entries()) {
        const k = cellOf(p, to);
        if (k === null || k < 0 || k > K(p)) fail(`수직선 이동${i + 1}`, '도착점이 범위 밖');
      }
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
    if (o.task !== undefined) {
      const t0 = obj(o.task, '수직선 task', ['type'], ['point', 'answer', 'check', 'ineq']);
      const type = oneOf(t0.type, '수직선 task.type', ['point', 'interval'] as const);
      if (type === 'point') {
        const t = obj(o.task, '수직선 task', ['type', 'point', 'answer', 'check']);
        const pt = p.points.find((x) => x.id === t.point);
        if (!pt?.drag) fail('수직선 task.point', '끌 수 있는 점 id 가 아님');
        p.task = {
          type,
          point: String(t.point),
          answer: at(t.answer, '수직선 task.answer', p),
          check: noLiteral(t.check, '수직선 task.check'),
        };
        if (pt?.at === p.task.answer) fail('수직선 task', '처음 위치가 이미 답');
      } else {
        const t = obj(o.task, '수직선 task', ['type', 'ineq', 'answer']);
        const ineq = str(t.ineq, '수직선 task.ineq').replace(/\s+/g, '');
        try {
          const [l, , r] = splitIneq(ineq);
          parseSym(l);
          parseSym(r);
        } catch (e) {
          fail('수직선 task.ineq', (e as Error).message);
        }
        const a = obj(t.answer, '수직선 task.answer', ['at', 'dir', 'open']);
        p.task = {
          type,
          ineq,
          answer: {
            at: at(a.at, '수직선 task.answer.at', p),
            dir: oneOf(a.dir, '수직선 task.answer.dir', ['left', 'right'] as const),
            open: bool(a.open, '수직선 task.answer.open'),
          },
        };
      }
    }
    return p;
  },
  checks(p) {
    const out: WidgetCheck[] = [];
    const t = p.task;
    if (t?.type === 'point')
      out.push({ name: '점 찍기', answer: t.answer, answerType: 'fraction', check: t.check });
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
      const ends = jumpEnds(p);
      const last = ends[ends.length - 1]?.[1] as Q;
      out.push({
        name: '점프 도착',
        answer: ratStr(last),
        answerType: 'fraction',
        check: [p.jumps.start, ...p.jumps.moves].map((v) => `(${py(q(v))})`).join('+'),
      });
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
  texts: (p) => [...p.points.flatMap((x) => (x.label ? [x.label] : []))],
};
