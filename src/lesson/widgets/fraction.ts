// 분수 조각 부품의 모델(순수). 화면(Fraction.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 핵심 생각: 크기가 다른 조각은 "몇 개"로 셀 수 없다. 한 칸을 d 조각으로 다시 잘랐을 때 d 가 분모의 배수여야
// 원래 조각이 새 조각 여러 개로 딱 나뉜다(fit). 두 분수가 모두 딱 나뉘는 d 가 공통분모다 —
// 그래서 덧셈·뺄셈은 그때만 합쳐진다(fMerge). 통분을 규칙으로 알려 주기 전에 손으로 발견하게 하려는 구조다.
// mode: compare(크기 비교) · add · sub · mul(넓이 모형: 가로 a, 세로 b 의 겹친 넓이) · div(b 가 a 에 몇 번 들어가나)
import { fail, int, obj, oneOf, rationalStr } from '../parse.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import { add, cmp, div, mul, num, py, type Q, q, qi, ratStr } from './q.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type FMode = 'compare' | 'add' | 'sub' | 'mul' | 'div';
export interface FParams {
  shape: 'bar' | 'circle';
  mode: FMode;
  a: string;
  b: string;
  /** 다시 자르기 슬라이더 범위(한 칸을 몇 조각으로). 없으면 슬라이더 없음 */
  cut?: { min: number; max: number };
  /** 그림만(손 조작·검산 없음). 질문 장면에서 두 분수를 먼저 보여 줄 때 */
  still?: true;
}

export interface FState {
  /** 다시 자른 칸 수. null = 처음 그대로(각자 자기 분모) */
  d: number | null;
  merged: boolean;
  /** 비교 답: a 가 크면 1, 같으면 0, 작으면 −1 */
  pick: -1 | 0 | 1 | null;
  /** 곱: 칠한 세로 줄 수(a 의 분모 칸 기준), 칠한 가로 줄 수(b 의 분모 칸 기준) */
  wa: number;
  hb: number;
  /** 나눗셈: a 위에 놓은 b 조각 수 */
  placed: number;
}
/** 그림용 상태: 끄는 중인 아래 막대의 이동 거리(SVG 단위) */
export interface FView {
  s: FState;
  off: [number, number] | null;
}

/** 슬롯 수(한 칸에 그릴 수 있는 최대 조각) — 그릴 목록의 키가 상태와 상관없이 같게 미리 만든다 */
const MAXD = 24;
export const W = 320;
const X0 = 16;
const RW = W - 2 * X0;
const BAR_H = 44;
const ROW_A = 30;
const ROW_B = 118;
const R = 44;

const numer = (x: Q) => Number(x[0]);
const denom = (x: Q) => Number(x[1]);

/** d 로 다시 잘랐을 때 x 가 몇 조각인가. d 가 분모의 배수가 아니면 원래 조각 그대로(fits=false) */
export function fit(x: Q, d: number | null): { den: number; n: number; fits: boolean } {
  const den = denom(x);
  if (d === null) return { den, n: numer(x), fits: true };
  if (d % den !== 0) return { den, n: numer(x), fits: false };
  return { den: d, n: numer(x) * (d / den), fits: true };
}

const A = (p: FParams) => q(p.a);
const B = (p: FParams) => q(p.b);

/** 두 분수를 같은 크기 조각으로 셀 수 있는 상태인가(같은 분모가 됐나) */
function common(p: FParams, d: number | null) {
  const fa = fit(A(p), d);
  const fb = fit(B(p), d);
  return { fa, fb, ok: fa.fits && fb.fits && fa.den === fb.den };
}

/** 자르기 범위 안의 가장 작은 공통분모(없으면 null). 자르기가 없으면 처음 분모가 같을 때 그 분모 */
export function lcmIn(p: FParams): number | null {
  if (!p.cut) return common(p, null).ok ? denom(A(p)) : null;
  for (let d = p.cut.min; d <= p.cut.max; d++) if (common(p, d).ok) return d;
  return null;
}

const units = (p: FParams) => {
  const a = A(p);
  const b = B(p);
  const big = p.mode === 'add' ? add(a, b) : p.mode === 'sub' || p.mode === 'div' ? a : b;
  const m = Math.max(num(a), num(b), num(big));
  return Math.max(1, Math.ceil(m - 1e-12));
};
/** 나눗셈에서 a 를 다 덮는 데 필요한 b 조각 수 */
export const divMax = (p: FParams) => Math.ceil(num(div(A(p), B(p))) - 1e-12);

export function fInit(_p: FParams): FState {
  return { d: null, merged: false, pick: null, wa: 0, hb: 0, placed: 0 };
}

/** 아래 막대를 위로 보내기(끌어 놓기·버튼). 덧셈·뺄셈은 같은 크기 조각일 때만, 나눗셈은 한 조각 더 놓기 */
export function fMerge(p: FParams, s: FState): { ok: boolean; s: FState } {
  if (p.mode === 'div') {
    if (s.placed >= divMax(p)) return { ok: false, s };
    return { ok: true, s: { ...s, placed: s.placed + 1 } };
  }
  if (p.mode !== 'add' && p.mode !== 'sub') return { ok: false, s };
  if (s.merged) return { ok: true, s };
  if (!common(p, s.d).ok) return { ok: false, s };
  return { ok: true, s: { ...s, merged: true } };
}

export function fDone(p: FParams, s: FState): boolean {
  switch (p.mode) {
    case 'add':
    case 'sub':
      return s.merged;
    case 'compare':
      return s.pick === cmp(A(p), B(p));
    case 'mul':
      return s.wa === numer(A(p)) && s.hb === numer(B(p));
    case 'div':
      return s.placed === divMax(p);
  }
}

const frac = (n: number | bigint, d: number | bigint) =>
  BigInt(d) === 1n ? `${n}` : `\\frac{${n}}{${d}}`;
const fracQ = (x: Q) => frac(x[0], x[1]);
/** "=n/d" 와, 약분되면 "=기약분수"까지 */
function equalsTex(n: number, d: number): string {
  const r = div(qi(n), qi(d));
  const first = `=${frac(n, d)}`;
  return r[0] === BigInt(n) && r[1] === BigInt(d) ? first : `${first}=${fracQ(r)}`;
}

/** 화면 위 식(KaTeX). 같은 크기 조각이 되면 새 분모로 보인다 */
export function fTex(p: FParams, s: FState): string {
  const a = A(p);
  const b = B(p);
  switch (p.mode) {
    case 'add':
    case 'sub':
    case 'compare': {
      const c = common(p, s.d);
      const [l, r] = c.ok ? [frac(c.fa.n, c.fa.den), frac(c.fb.n, c.fb.den)] : [fracQ(a), fracQ(b)];
      if (p.mode === 'compare') {
        const rel = s.pick === null ? '\\,?\\,' : s.pick > 0 ? '>' : s.pick < 0 ? '<' : '=';
        return `${l}${rel}${r}`;
      }
      const op = p.mode === 'add' ? '+' : '-';
      if (!s.merged) return `${l}${op}${r}`;
      const n = p.mode === 'add' ? c.fa.n + c.fb.n : c.fa.n - c.fb.n;
      return `${l}${op}${r}${equalsTex(n, c.fa.den)}`;
    }
    case 'mul': {
      const t = `${fracQ(a)}\\times${fracQ(b)}`;
      return fDone(p, s) ? t + equalsTex(numer(a) * numer(b), denom(a) * denom(b)) : t;
    }
    case 'div': {
      const t = `${fracQ(a)}\\div${fracQ(b)}`;
      return fDone(p, s) ? `${t}=${fracQ(div(a, b))}` : t;
    }
  }
}

/** 화면 아래 안내 한 줄(놓은 결과). 데이터가 아니라 모델 상태에서 나온다 */
export function fSay(p: FParams, s: FState, ok: boolean): string {
  if (p.mode === 'div') {
    const n = s.placed;
    return fDone(p, s)
      ? `${n}번째 조각으로 다 덮었어요. 결과는 아래 식이에요.`
      : `${n}번 놓았어요. 아직 남았어요.`;
  }
  if (!ok) return '조각 크기가 달라서 한꺼번에 셀 수 없어요. 자르는 수를 바꿔 보세요.';
  const least = lcmIn(p);
  return s.d !== null && least !== null && s.d > least
    ? `합쳐졌어요. ${least}조각으로 잘라도 돼요. 더 작은 수예요.`
    : '같은 크기 조각이 됐어요. 이제 셀 수 있어요.';
}

// ---- 그림 ----

function wedge(cx: number, cy: number, i: number, den: number): string {
  if (den === 1)
    return `M${cx - R} ${cy}A${R} ${R} 0 1 0 ${cx + R} ${cy}A${R} ${R} 0 1 0 ${cx - R} ${cy}Z`;
  const t0 = ((-90 + (i * 360) / den) * Math.PI) / 180;
  const t1 = ((-90 + ((i + 1) * 360) / den) * Math.PI) / 180;
  const large = 360 / den > 180 ? 1 : 0;
  return `M${cx} ${cy}L${r2(cx + R * Math.cos(t0))} ${r2(cy + R * Math.sin(t0))}A${R} ${R} 0 ${large} 1 ${r2(cx + R * Math.cos(t1))} ${r2(cy + R * Math.sin(t1))}Z`;
}

/** 한 줄(막대 또는 원 여러 개)의 조각 칸들. fill(i) 가 칸 i 의 색 클래스(없으면 빈 칸) */
function rowMarks(
  p: FParams,
  key: 'A' | 'B',
  y: number,
  den: number,
  shown: boolean,
  fill: (i: number) => string,
  misfit: number | null,
): Mark[] {
  const U = units(p);
  const out: Mark[] = [];
  const unitW = RW / U;
  const circle = p.shape === 'circle';
  const cx = (u: number) => X0 + R + u * (2 * R + 24);
  const cy = y + R - 14;
  for (let i = 0; i < U * MAXD; i++) {
    const vis = shown && i < U * den;
    const cls = `fp ${fill(i)}`.trim();
    if (circle) {
      const u = Math.floor(i / den);
      out.push({
        k: `${key}:${i}`,
        tag: 'path',
        a: {
          d: vis ? wedge(cx(u), cy, i % den, den) : 'M0 0',
          class: cls,
          visibility: vis ? 'visible' : 'hidden',
        },
      });
    } else {
      const w = unitW / den;
      out.push({
        k: `${key}:${i}`,
        tag: 'rect',
        a: {
          x: r2(X0 + i * w),
          y,
          width: r2(vis ? w : 0),
          height: BAR_H,
          class: cls,
          visibility: vis ? 'visible' : 'hidden',
        },
      });
    }
  }
  // 맞지 않는 칸 수로 자르려 할 때 보이는 점선(새 칸 자리). 원래 조각과 어긋나 보인다
  for (let j = 0; j < U * MAXD; j++) {
    // 막대는 칸 경계(전체 칸의 끝)를 빼고, 원은 반지름 선이라 모든 칸 경계를 그린다
    const vis =
      shown && misfit !== null && j < U * misfit && (circle || (j > 0 && j % misfit !== 0));
    const d = misfit ?? 1;
    if (circle) {
      const u = Math.floor(j / d);
      const t = ((-90 + ((j % d) * 360) / d) * Math.PI) / 180;
      out.push({
        k: `G${key}:${j}`,
        tag: 'line',
        a: {
          x1: cx(u),
          y1: cy,
          x2: r2(cx(u) + R * Math.cos(t)),
          y2: r2(cy + R * Math.sin(t)),
          class: 'fmis',
          visibility: vis ? 'visible' : 'hidden',
        },
      });
    } else {
      const x = r2(X0 + (j * unitW) / d);
      out.push({
        k: `G${key}:${j}`,
        tag: 'line',
        a: {
          x1: x,
          y1: y - 4,
          x2: x,
          y2: y + BAR_H + 4,
          class: 'fmis',
          visibility: vis ? 'visible' : 'hidden',
        },
      });
    }
  }
  for (let u = 0; u < U; u++) {
    out.push(
      circle
        ? {
            k: `U${key}:${u}`,
            tag: 'circle',
            a: { cx: cx(u), cy, r: R, class: 'funit', visibility: shown ? 'visible' : 'hidden' },
          }
        : {
            k: `U${key}:${u}`,
            tag: 'rect',
            a: {
              x: r2(X0 + u * unitW),
              y,
              width: r2(unitW),
              height: BAR_H,
              class: 'funit',
              visibility: shown ? 'visible' : 'hidden',
            },
          },
    );
  }
  return out;
}

export const fRowB = (p: FParams) => (p.shape === 'circle' ? ROW_A + 2 * R + 30 : ROW_B);
export function fHeight(p: FParams): number {
  if (p.mode === 'mul') return MUL.y0 + MUL.S + 16;
  return fRowB(p) + (p.shape === 'circle' ? 2 * R : BAR_H) + 12;
}

/** 곱 넓이 모형 배치 */
export const MUL = { x0: 76, y0: 40, S: 200 };

/** 상태 → 그릴 목록 */
export function fDraw(p: FParams, v: FView): Drawing {
  const { s } = v;
  const texts: Record<string, string> = {};
  if (p.mode === 'mul') return mulDraw(p, s);
  const a = A(p);
  const b = B(p);
  const c = common(p, s.d);
  const fa = fit(a, s.d);
  const fb = fit(b, s.d);
  const marks: Mark[] = [];
  const yB = fRowB(p);
  const mis = (f: { fits: boolean }) => (s.d !== null && !f.fits ? s.d : null);
  if ((p.mode === 'add' || p.mode === 'sub') && s.merged) {
    const n = c.fa.n;
    const m = c.fb.n;
    const fill =
      p.mode === 'add'
        ? (i: number) => (i < n ? 'fa' : i < n + m ? 'fb' : '')
        : (i: number) => (i < n - m ? 'fa' : i < n ? 'fx' : '');
    marks.push(...rowMarks(p, 'A', ROW_A, c.fa.den, true, fill, null));
    marks.push(...rowMarks(p, 'B', yB, c.fb.den, false, () => '', null));
  } else {
    marks.push(...rowMarks(p, 'A', ROW_A, fa.den, true, (i) => (i < fa.n ? 'fa' : ''), mis(fa)));
    marks.push(...rowMarks(p, 'B', yB, fb.den, true, (i) => (i < fb.n ? 'fb' : ''), mis(fb)));
  }
  if (p.mode === 'div') {
    const U = units(p);
    const unitW = RW / U;
    const bw = num(b) * unitW;
    const aw = num(a) * unitW;
    for (let i = 0; i < 12; i++) {
      const x = X0 + i * bw;
      const vis = i < s.placed;
      marks.push({
        k: `P:${i}`,
        tag: 'rect',
        a: {
          x: r2(x),
          y: ROW_A - 6,
          width: r2(Math.max(0, Math.min(bw, aw - i * bw))),
          height: BAR_H + 12,
          class: 'fplace',
          visibility: vis ? 'visible' : 'hidden',
        },
      });
    }
  }
  marks.push({
    k: 'bgrp',
    tag: 'g',
    a: { transform: v.off ? `translate(${r2(v.off[0])} ${r2(v.off[1])})` : 'translate(0 0)' },
  });
  texts.cut = s.d === null ? '처음 그대로' : `한 칸을 ${s.d}조각으로`;
  return { marks, texts };
}

function mulDraw(p: FParams, s: FState): Drawing {
  const { x0, y0, S } = MUL;
  const da = denom(A(p));
  const db = denom(B(p));
  const w = (s.wa / da) * S;
  const h = (s.hb / db) * S;
  const marks: Mark[] = [
    { k: 'mA', tag: 'rect', a: { x: x0, y: y0, width: r2(w), height: S, class: 'fa soft' } },
    { k: 'mB', tag: 'rect', a: { x: x0, y: y0, width: S, height: r2(h), class: 'fb soft' } },
    { k: 'mO', tag: 'rect', a: { x: x0, y: y0, width: r2(w), height: r2(h), class: 'fo' } },
    { k: 'h:wa', tag: 'g', a: { transform: `translate(${r2(x0 + w)} ${y0 - 22})` } },
    { k: 'h:hb', tag: 'g', a: { transform: `translate(${x0 - 22} ${r2(y0 + h)})` } },
  ];
  return {
    marks,
    texts: {
      wa: `가로 ${s.wa}/${da}`,
      hb: `세로 ${s.hb}/${db}`,
      ov: `겹친 칸 ${s.wa * s.hb} / 전체 ${da * db}`,
    },
  };
}

/** 곱 손잡이 끌기: wa 는 가로로, hb 는 세로로 칸에 붙는다 */
export function fMulDrag(p: FParams, s: FState, id: 'wa' | 'hb', dx: number, dy: number): FState {
  const n = id === 'wa' ? denom(A(p)) : denom(B(p));
  const cur = id === 'wa' ? s.wa : s.hb;
  const k = Math.min(n, Math.max(0, Math.round(cur + ((id === 'wa' ? dx : dy) / MUL.S) * n)));
  return { ...s, [id]: k };
}
export const fMulMax = (p: FParams, id: 'wa' | 'hb') => (id === 'wa' ? denom(A(p)) : denom(B(p)));

/** 아래 막대를 이만큼 위로 끌어 놓으면 보내기로 본다(막대 사이 간격의 절반) */
export const dropDy = (p: FParams) => -(fRowB(p) - ROW_A) / 2;

// ---- 형식 검사·검산 ----

const frStr = (v: unknown, at: string): string => {
  const s = rationalStr(v, at);
  const x = q(s);
  if (cmp(x, qi(0)) <= 0) fail(at, '0 보다 커야 함');
  if (x[1] > 12n) fail(at, `분모는 12 이하 (${s})`);
  return s;
};

export const fractionDef: WidgetDef<FParams> = {
  parse(raw) {
    const o = obj(raw, '분수', ['shape', 'mode', 'a', 'b'], ['cut', 'still']);
    const p: FParams = {
      shape: oneOf(o.shape, '분수 shape', ['bar', 'circle'] as const),
      mode: oneOf(o.mode, '분수 mode', ['compare', 'add', 'sub', 'mul', 'div'] as const),
      a: frStr(o.a, '분수 a'),
      b: frStr(o.b, '분수 b'),
    };
    if (o.cut !== undefined) {
      const c = obj(o.cut, '분수 cut', ['min', 'max']);
      const min = int(c.min, '분수 cut.min', 2, MAXD);
      p.cut = { min, max: int(c.max, '분수 cut.max', min + 1, MAXD) };
    }
    if (o.still !== undefined) {
      if (o.still !== true) fail('분수 still', 'true 만');
      if (p.cut) fail('분수 still', '그림만 보이는 부품에는 자르기(cut)를 두지 않음');
      p.still = true;
    }
    const a = A(p);
    const b = B(p);
    if (p.mode === 'sub' && cmp(b, a) >= 0) fail('분수', '뺄셈은 b 가 a 보다 작아야 함');
    if (p.mode === 'mul' && (cmp(a, qi(1)) > 0 || cmp(b, qi(1)) > 0))
      fail('분수', '곱 넓이 모형은 a·b 가 1 이하');
    if (p.mode === 'div' && divMax(p) > 12) fail('분수', 'b 조각이 12번 넘게 들어감');
    if (units(p) > 2) fail('분수', '그림이 2칸(값 2)을 넘음');
    if (!p.still && (p.mode === 'add' || p.mode === 'sub') && lcmIn(p) === null)
      fail('분수 cut', '자르는 범위 안에 공통분모가 없어 합칠 수 없음');
    return p;
  },
  checks(p) {
    if (p.still) return [];
    const a = A(p);
    const b = B(p);
    const [pa, pb] = [py(a), py(b)];
    const out: WidgetCheck[] = [];
    if (p.mode === 'add' || p.mode === 'sub') {
      const op = p.mode === 'add' ? '+' : '-';
      // 화면이 합친 뒤 보여 주는 값은 모델이 센 조각 수에서 나온다 — 그 값을 sympy 계산과 대조
      const d = lcmIn(p) as number;
      const m = fMerge(p, { ...fInit(p), d: p.cut ? d : null }).s;
      const c = common(p, m.d);
      const n = p.mode === 'add' ? c.fa.n + c.fb.n : c.fa.n - c.fb.n;
      out.push({
        name: '결과',
        answer: ratStr(div(qi(n), qi(c.fa.den))),
        answerType: 'fraction',
        check: `${pa}${op}${pb}`,
      });
      if (p.cut) {
        out.push({
          name: '가장 작은 공통분모',
          answer: String(d),
          answerType: 'int',
          check: `ilcm(${denom(a)},${denom(b)})`,
        });
        for (let k = p.cut.min; k <= p.cut.max; k++) {
          const cc = common(p, k);
          if (!cc.ok) continue;
          out.push({
            name: `${k}조각 a`,
            answer: String(cc.fa.n),
            answerType: 'int',
            check: `${pa}*${k}`,
          });
          out.push({
            name: `${k}조각 b`,
            answer: String(cc.fb.n),
            answerType: 'int',
            check: `${pb}*${k}`,
          });
        }
      }
    }
    if (p.mode === 'compare')
      out.push({
        name: '크기 비교',
        answer: String(cmp(a, b)),
        answerType: 'int',
        check: `sign(${pa}-${pb})`,
      });
    if (p.mode === 'mul') {
      out.push({
        name: '곱',
        answer: ratStr(mul(a, b)),
        answerType: 'fraction',
        check: `${pa}*${pb}`,
      });
      out.push({
        name: '겹친 칸',
        answer: String(numer(a) * numer(b)),
        answerType: 'int',
        check: `${pa}*${pb}*${denom(a) * denom(b)}`,
      });
    }
    if (p.mode === 'div') {
      out.push({
        name: '몫',
        answer: ratStr(div(a, b)),
        answerType: 'fraction',
        check: `${pa}/(${pb})`,
      });
      out.push({
        name: '놓는 횟수',
        answer: String(divMax(p)),
        answerType: 'int',
        check: `ceiling(${pa}/(${pb}))`,
      });
    }
    return out;
  },
  texts: () => [],
};
