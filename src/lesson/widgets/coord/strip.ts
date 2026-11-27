// 길 띠 strip(3-가): 좌표평면 아래(가로)나 오른쪽(세로)에 붙는 1차원 띠와 그 위 표식 하나.
// 속도 그래프를 보면서 '그래서 지금 어디 있나'를 길 위에서 보게 한다(trip: 집 기준 위치, move: 리프트 높이).
//   자리 = 읽는 값 at — 같은 글자의 읽는 값 객체가 있어야 한다. 화면 숫자와 표식이 늘 같은 값이고, 표식만 따로 보이는
//          값(숨긴 정답의 실마리)이 생기지 않는다
//   모양 = 진행 방향 face 의 부호. 가로 띠는 걷는 사람(+ 오른쪽을 봄, − 좌우를 뒤집음, 0 정면으로 섬 — 돌아서는 순간의
//          속도 0 이 그림으로 보인다), 세로 띠는 리프트 칸(▲ 오름 · ▼ 내림 · = 멈춤)
// 눈금·숫자는 수직선(numberLine.ts)의 칸 계산(xOf·nlTicks)을 읽어 쓰기만 한다 — 두 그림의 숫자 간격이 어긋나지 않게.
// 끄는 동안에는 표식 경로 글자만 바뀐다(그릴 목록 outer 의 같은 key — React 렌더 0회, P8). 띠·눈금은 매개변수로 정해져
// 화면이 한 번 그린다(stripView).
import { fail, obj, oneOf, rationalStr, str } from '../../parse.ts';
import { type NLParams, nlTicks, xOf } from '../numberLine.ts';
import { div, isInt, num, q, sub } from '../q.ts';
import type { WidgetCheck } from '../specs.ts';
import { frame, labelWidth, MIN_BOX_H, NARROW_BOX_W, r1 } from './frame.ts';
import { type Deps, depStates } from './point.ts';
import { parseReadoutExpr, readoutMovers, readoutSym, readoutVal } from './readout.ts';
import type {
  Box,
  CoordObj,
  CoordParams,
  CoordState,
  DrawCtx,
  Frame,
  ParseCtx,
  ReadoutExpr,
  StripObj,
} from './types.ts';

/** 띠 칸 수 상한(수직선과 같은 100칸) */
const MAX_STRIP_CELLS = 100;
/**
 * 띠에 쓰는 읽는 값: 한 자리를 가리키는 수(점 좌표·슬라이더·식·기울기·미분계수·부호 있는 합). 개수(roots·meet·cover)는
 * 자리가 아니고, 두 값(sums)·부호 뗀 합(abs — 끊는 곳이 상태마다 달라 sympy 가 한 식으로 되풀이 못 함)·통계 넓이(area·prob
 * — 검산이 자기 항목으로 따로 감)는 표식 검산식을 한 식으로 적을 수 없다
 */
const FORMS: ReadoutExpr['f'][] = ['x', 'y', 'value', 'calc', 'slope', 'deriv', 'net'];
/** 이웃한 세로 띠 숫자(11px) 사이 최소 간격(px) */
const MIN_VGAP = 12;
/** 이웃한 가로 띠 숫자 글자 사이 최소 틈(px) */
const MIN_HGAP = 2;

/** 형식 검사 앞부분: 띠의 방향만(객체를 읽기 전에 그림 영역을 정해야 칸·이름표 검사가 같은 영역으로 센다) */
export function stripDir(v: unknown): { dir: 'x' | 'y' } {
  const c = obj(v, '좌표 strip', ['dir'], ['min', 'max', 'step', 'label', 'unit', 'at', 'face']);
  return { dir: oneOf(c.dir, '좌표 strip dir', ['x', 'y'] as const) };
}

const intOf = (v: unknown, at: string) => {
  if (typeof v !== 'number' || !Number.isInteger(v)) return fail(at, `정수여야 함 (${String(v)})`);
  return v;
};

/** 띠에 쓰는 읽는 값 하나를 읽는다 */
function formOf(v: unknown, at: string, cx: ParseCtx): { src: string; e: ReadoutExpr } {
  const src = str(v, at).replace(/\s+/g, '');
  const e = parseReadoutExpr(src, at, cx);
  if (!FORMS.includes(e.f))
    fail(at, `${src} 는 띠에 못 씀 — 한 자리를 가리키는 수(x·y·value·식·slope·deriv·net)만`);
  return { src, e };
}

/** 형식 검사 뒷부분(객체를 다 읽은 뒤): 칸·숫자 간격·자리 읽는 값·방향 읽는 값 */
export function parseStrip(v: unknown, cx: ParseCtx, objects: CoordObj[]): StripObj {
  const at = '좌표 strip';
  const c = obj(v, at, ['dir', 'min', 'max', 'step', 'at', 'face'], ['label', 'unit']);
  const { dir } = stripDir(v);
  const min = intOf(c.min, `${at} min`);
  const max = intOf(c.max, `${at} max`);
  if (!(max > min)) fail(at, 'max 가 min 보다 커야 함');
  const step = rationalStr(typeof c.step === 'number' ? String(c.step) : c.step, `${at} step`);
  if (!(num(q(step)) > 0)) fail(`${at} step`, '0 보다 커야 함');
  const cells = div(sub(q(String(max)), q(String(min))), q(step));
  if (!isInt(cells)) fail(`${at} step`, `범위(${min}~${max})를 나누어떨어지게`);
  if (num(cells) > MAX_STRIP_CELLS)
    fail(`${at} step`, `칸이 ${MAX_STRIP_CELLS}칸 넘음 (${num(cells)}칸) — 100칸 이하로`);
  const label =
    c.label === undefined
      ? undefined
      : rationalStr(typeof c.label === 'number' ? String(c.label) : c.label, `${at} label`);
  if (label !== undefined && !isInt(div(q(label), q(step))))
    fail(`${at} label`, `칸 간격(${step})의 배수여야 함`);
  const unit = c.unit === undefined ? undefined : str(c.unit, `${at} unit`).trim();
  const a = formOf(c.at, `${at} at`, cx);
  // 화면 숫자와 표식이 같은 값이게 — 같은 글자의 읽는 값 객체(공백 무시)가 있어야
  if (!objects.some((o) => o.kind === 'readout' && o.src.replace(/\s+/g, '') === a.src))
    fail(
      `${at} at`,
      `${a.src} 와 같은 글자의 읽는 값 객체가 없음 — 표식 자리는 화면에 보이는 읽는 값이어야(숫자와 표식이 같은 값)`,
    );
  if (c.face === undefined)
    fail(`${at} face`, '진행 방향(속도) 읽는 값이 필요함 — 표식 모양이 방향을 말한다');
  const fc = formOf(c.face, `${at} face`, cx);
  const o: StripObj = {
    dir,
    min,
    max,
    step,
    ...(label !== undefined ? { label } : {}),
    ...(unit ? { unit } : {}),
    src: a.src,
    at: a.e,
    faceSrc: fc.src,
    face: fc.e,
  };
  checkStripNums(o, cx);
  return o;
}

/** 수직선 칸 계산에 넘길 매개변수. 세로 띠는 단위를 숫자 줄 끝이 아니라 띠 위에 따로 적어(폭이 모자람) 넘기지 않는다 */
const nlOf = (o: StripObj): NLParams => ({
  min: o.min,
  max: o.max,
  step: o.step,
  ...(o.label !== undefined ? { label: o.label } : {}),
  ...(o.unit && o.dir === 'x' ? { unit: o.unit } : {}),
  points: [],
});

// ---- 자리(px) ----
// 가로 띠: 그림 영역 가로 끝(f.l~f.r)이 min~max, 띠 선은 상자 아래에서 19px 위. 세로 띠: 그림 영역 세로 끝(아래 f.b~위 f.t)이
// min~max, 띠 선은 상자 오른쪽에서 30px 안쪽. 그림 영역 끝과 맞춰 두면 띠 범위를 축 범위와 같게 둔 장면(리프트 높이 = y)에서
// 그래프의 점과 띠의 표식이 같은 높이에 선다.

/** 띠 선의 가로 띠 y · 세로 띠 x(상자 끝에서) */
const LINE_FROM_EDGE = { x: 19, y: 30 };
/** 띠(길) 두께 */
const BAND = 5;

interface StripGeo {
  /** min 의 px · max 의 px(띠 방향) */
  a: number;
  b: number;
  /** 띠 선의 가로질러 자리(가로 띠는 y, 세로 띠는 x) */
  line: number;
}
function geo(o: StripObj, box: Box, f: Frame): StripGeo {
  return o.dir === 'x'
    ? { a: f.l, b: f.r, line: box.h - LINE_FROM_EDGE.x }
    : { a: f.b, b: f.t, line: box.w - LINE_FROM_EDGE.y };
}
/** 수직선 그림 x(SVG 단위) → 띠 위 px. 수직선의 양끝 여백을 xOf(0)·xOf(끝 칸)으로 읽어 비율로 옮긴다 */
function nlToPx(o: StripObj, g: StripGeo, u: number): number {
  const p = nlOf(o);
  const k = num(div(sub(q(String(o.max)), q(String(o.min))), q(o.step)));
  const [u0, u1] = [xOf(p, 0), xOf(p, k)];
  return g.a + ((u - u0) / (u1 - u0)) * (g.b - g.a);
}
/** 띠 위 값(칸 사이 값 포함) → px */
const valPx = (o: StripObj, g: StripGeo, v: number) =>
  g.a + ((v - o.min) / (o.max - o.min)) * (g.b - g.a);

// ---- 값 ----

/** 표식 값(읽는 값과 같은 셈)과 방향 부호. 방향은 분수로 정확히 구해지면 그 부호(속도 0 인 순간을 놓치지 않게) */
function valueAndFace(p: CoordParams, s: CoordState, o: StripObj): { v: number; face: -1 | 0 | 1 } {
  const v = readoutVal(p, s, o.at).n;
  const fv = readoutVal(p, s, o.face);
  const sg = fv.q
    ? Number(fv.q[0] > 0n) - Number(fv.q[0] < 0n)
    : Math.abs(fv.n) < 1e-12
      ? 0
      : Math.sign(fv.n);
  return { v, face: (Number.isFinite(fv.n) ? sg : 0) as -1 | 0 | 1 };
}

/** 지금 상태의 표식: 값·방향 부호·띠 위 px(상자 크기 box 에서) */
export function stripAt(
  p: CoordParams,
  s: CoordState,
  box: Box,
): { v: number; face: -1 | 0 | 1; px: number } {
  const o = p.strip as StripObj;
  const m = valueAndFace(p, s, o);
  const g = geo(o, box, frame(box, p));
  return { ...m, px: valPx(o, g, m.v) };
}

// ---- 그리기 ----

type Pt = [number, number];
const P = (x: number, y: number) => `${r1(x)} ${r1(y)}`;
/** 원(지름 2r) 경로 */
const ring = (cx: number, cy: number, r: number) =>
  `M${P(cx + r, cy)}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`;
const lines = (segs: Pt[][]) =>
  segs.map((seg) => seg.map((q, i) => `${i ? 'L' : 'M'}${P(q[0], q[1])}`).join('')).join('');

/**
 * 걷는 사람(단색 선 그림, 키 20px). 발 = (X, Y). dir 1 은 오른쪽을 보고 걷는 모습(몸을 앞으로 기울이고 앞팔·앞발, 얼굴
 * 앞 꺾쇠), −1 은 그 거울, 0 은 정면으로 선 모습(좌우 대칭·꺾쇠 없음 — 돌아서는 순간의 속도 0)
 */
function walker(X: number, Y: number, dir: -1 | 0 | 1): string {
  const m = (dx: number, dy: number): Pt => [X + dir * dx, Y + dy];
  if (dir === 0) {
    const s = (dx: number, dy: number): Pt => [X + dx, Y + dy];
    return (
      ring(X, Y - 16.5, 3) +
      lines([
        [s(0, -13.5), s(0, -6.5)],
        [s(-3, 0), s(0, -6.5), s(3, 0)],
        [s(-3.5, -7.5), s(0, -11.5), s(3.5, -7.5)],
      ])
    );
  }
  const [hx, hy] = m(1.5, -16.5);
  return (
    ring(hx, hy, 3) +
    lines([
      [m(0.8, -13.2), m(-0.5, -6.5)],
      [m(-4, 0), m(-0.5, -6.5), m(3.5, 0)],
      [m(-3, -8.5), m(0.4, -11.5), m(4, -8)],
      [m(7, -14.5), m(9.5, -12), m(7, -9.5)],
    ])
  );
}

/** 리프트 칸의 반폭(세로 띠 숫자가 이 바깥에서 시작한다) */
const LIFT_HALF = 7;
/** 리프트 칸(가로 14 · 세로 16)과 안의 방향 표시: ▲ 오름 · ▼ 내림 · = 멈춤 */
function lift(X: number, Y: number, dir: -1 | 0 | 1): { cab: string; mark: string } {
  const cab = `M${P(X - LIFT_HALF, Y - 8)}h${2 * LIFT_HALF}v16h${-2 * LIFT_HALF}Z`;
  const mark =
    dir === 0
      ? lines([
          [
            [X - 4, Y - 1.5],
            [X + 4, Y - 1.5],
          ],
          [
            [X - 4, Y + 1.5],
            [X + 4, Y + 1.5],
          ],
        ])
      : lines([
          [
            [X - 4, Y + 2.5 * dir],
            [X, Y - 2.5 * dir],
            [X + 4, Y + 2.5 * dir],
          ],
        ]);
  return { cab, mark };
}

/** 그릴 목록 기여(그림 영역 밖 층). 표식 자리가 정의 안 되면 빈 경로(key 는 그대로) */
export function drawStrip(cx: DrawCtx): void {
  const { p, s, f, box, outer } = cx;
  const o = p.strip;
  if (!o) return;
  const g = geo(o, box, f);
  const m = valueAndFace(p, s, o);
  const ok = Number.isFinite(m.v);
  const at = valPx(o, g, m.v);
  if (o.dir === 'x') {
    outer.push({
      t: 'path',
      key: 'sw',
      d: ok ? walker(at, g.line - BAND / 2, m.face) : '',
      cls: 'smark',
    });
    return;
  }
  const l = ok ? lift(g.line, at, m.face) : { cab: '', mark: '' };
  outer.push({ t: 'path', key: 'sc', d: l.cab, cls: 'scab' });
  outer.push({ t: 'path', key: 'sw', d: l.mark, cls: 'smark' });
}

export interface StripView {
  dir: 'x' | 'y';
  /** 띠(길) 경로 */
  band: string;
  /** 칸마다 눈금 자리(띠 방향 px) */
  ticks: number[];
  /** 눈금 금 경로 */
  tickD: string;
  nums: { x: number; y: number; text: string; anchor: 'middle' | 'start' }[];
  /** 세로 띠의 단위(띠 위) */
  unit?: { x: number; y: number; text: string };
}

/** 띠·눈금·숫자(화면이 한 번 그리는 것 — 매개변수와 상자 크기로만 정해진다) */
export function stripView(p: CoordParams, box: Box): StripView {
  const o = p.strip as StripObj;
  const g = geo(o, box, frame(box, p));
  const ts = nlTicks(nlOf(o));
  const ticks = ts.map((t) => r1(nlToPx(o, g, t.x)));
  const h = BAND / 2;
  if (o.dir === 'x') {
    const y = g.line;
    return {
      dir: 'x',
      band: `M${P(g.a, y - h)}H${r1(g.b)}V${r1(y + h)}H${r1(g.a)}Z`,
      ticks,
      tickD: ticks.map((x) => `M${P(x, y + h)}v4`).join(''),
      // 가운데 맞춤이 상자 밖으로 나가면(마지막 숫자 + 단위) 상자 안으로 당긴다
      nums: ts.flatMap((t, k) => {
        if (!t.label) return [];
        const w = labelWidth(t.label);
        const x = Math.min(box.w - 1 - w / 2, Math.max(1 + w / 2, ticks[k] as number));
        return [{ x: r1(x), y: r1(y + h + 13.5), text: t.label, anchor: 'middle' as const }];
      }),
    };
  }
  const x = g.line;
  return {
    dir: 'y',
    band: `M${P(x - h, g.b)}V${r1(g.a)}H${r1(x + h)}V${r1(g.b)}Z`,
    ticks,
    // 눈금 금은 띠 왼쪽(그림 쪽)에 — 숫자 바로 앞에 두면 금이 빼기 기호처럼 읽혀 '4' 가 '−4' 로 보였다(헤드리스 캡처)
    tickD: ticks.map((y) => `M${P(x - h - 4, y)}h4`).join(''),
    nums: ts.flatMap((t, k) =>
      t.label
        ? [
            {
              // 리프트 칸(반폭 7)이 지나가도 숫자를 덮지 않게 칸 오른쪽 끝 바깥에서
              x: r1(x + LIFT_HALF + 1.5),
              y: r1((ticks[k] as number) + 4),
              text: t.label,
              anchor: 'start' as const,
            },
          ]
        : [],
    ),
    ...(o.unit ? { unit: { x: r1(x), y: r1(g.b - 6), text: `(${o.unit})` } } : {}),
  };
}

/**
 * 숫자 간격(가장 좁은 화면): 가로 띠는 이웃 숫자 글자가 겹치지 않게(수직선 nlTicks 는 자기 그림 폭 320 으로 재므로 띠 폭에서
 * 다시 잰다), 세로 띠는 이웃 숫자 사이가 MIN_VGAP 이상이고 숫자가 띠 폭(상자 끝) 안. 축척 같게로 그림이 납작해지면 걸린다
 */
function checkStripNums(o: StripObj, cx: ParseCtx): void {
  const box = { w: NARROW_BOX_W, h: MIN_BOX_H };
  const v = stripView({ x: cx.x, y: cx.y, equal: cx.equal, strip: o } as CoordParams, box);
  v.nums.forEach((n, i) => {
    const m = v.nums[i + 1];
    if (o.dir === 'x') {
      if (m && m.x - n.x < (labelWidth(n.text) + labelWidth(m.text)) / 2 + MIN_HGAP)
        fail(
          '좌표 strip',
          `가로 띠 숫자가 겹침 (${n.text}·${m.text}) — label 간격을 키우거나 범위를 좁게`,
        );
      return;
    }
    if (n.x + labelWidth(n.text) > box.w)
      fail(
        '좌표 strip',
        `세로 띠 숫자 '${n.text}' 이 띠 폭을 넘음 — 두세 자리 숫자까지(단위는 띠 위에 따로 적힌다)`,
      );
    if (m && Math.abs(m.y - n.y) < MIN_VGAP)
      fail(
        '좌표 strip',
        `세로 띠 숫자가 겹침 (${n.text}·${m.text}, 가장 좁은 화면에서 ${Math.abs(m.y - n.y).toFixed(1)}px) — label 간격을 키우세요`,
      );
  });
}

// ---- 무거운 형식 검사·검산 ----

/** 표식을 움직이는 것(자리 읽는 값 + 방향 읽는 값) */
function stripDeps(p: CoordParams, o: StripObj): Deps {
  const out: Deps = { pts: new Set(), sliders: new Set() };
  for (const e of [o.at, o.face]) {
    const m = readoutMovers(p, e);
    for (const id of m.points) out.pts.add(id);
    for (const id of m.sliders) out.sliders.add(id);
  }
  return out;
}
/** 무거운 검사가 늘어놓는 상태 상한(목표 판정 상한과 같은 값) */
const STRIP_STATES = 2000;
const symText = (sym: Record<string, string>) =>
  Object.entries(sym)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

/**
 * 무거운 형식 검사: 닿는 모든 상태(끄는 점 칸 × 슬라이더 칸, 상한을 넘으면 고르게 덜어 냄)에서 표식이 띠 안이고 방향이
 * 정의되는가 — 띠 밖 표식은 상자 끝을 넘어 잘리거나 다른 그림을 덮는다
 */
export function checkStrip(p: CoordParams): void {
  const o = p.strip;
  if (!o) return;
  for (const q0 of depStates(p, stripDeps(p, o), STRIP_STATES)) {
    const m = valueAndFace(p, q0.s, o);
    const fv = readoutVal(p, q0.s, o.face).n;
    const where = symText(q0.sym);
    if (!Number.isFinite(m.v) || m.v < o.min - 1e-9 || m.v > o.max + 1e-9)
      fail(
        '좌표 strip at',
        `표식이 띠 밖 (${o.src} = ${Number.isFinite(m.v) ? Number(m.v.toPrecision(6)) : '정의 안 됨'}${where ? ` — ${where}` : ''}, 띠는 ${o.min}~${o.max})`,
      );
    if (!Number.isFinite(fv))
      fail(
        '좌표 strip face',
        `방향 ${o.faceSrc} 가 정의 안 되는 자리${where ? ` — ${where}` : ''}`,
      );
  }
}

/**
 * 검산(원칙 P7): 닿는 상태마다 ① 표식 값 = sympy 가 읽는 값의 원문 식(readoutSym — 끄는 점은 상태 기호, 곡선은 원문
 * 식)으로 따로 낸 값 ② 방향 부호 = 그 방향 식의 sign. 앱이 구한 값을 식에 옮겨 적지 않는다
 */
export function stripChecks(p: CoordParams, out: WidgetCheck[]): void {
  const o = p.strip;
  if (!o) return;
  const st = depStates(p, stripDeps(p, o));
  const ms = st.map((q0) => valueAndFace(p, q0.s, o));
  out.push({
    name: `길 띠 표식 ${o.src}`,
    kind: 'parity',
    expr: readoutSym(p, o.at).expr,
    points: st.map((q0) => q0.sym),
    values: ms.map((m) => (Number.isFinite(m.v) ? m.v : null)),
  });
  out.push({
    name: `길 띠 방향 ${o.faceSrc}`,
    kind: 'parity',
    expr: `sign(${readoutSym(p, o.face).expr})`,
    points: st.map((q0) => q0.sym),
    values: ms.map((m) => m.face),
  });
}
