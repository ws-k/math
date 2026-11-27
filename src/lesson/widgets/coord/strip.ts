// 길 띠 strip(3-가): 좌표평면 아래(가로)나 오른쪽(세로)에 붙는 1차원 띠와 그 위 표식 하나.
// 속도 그래프를 보면서 '그래서 지금 어디 있나'를 길 위에서 보게 한다(trip: 집 기준 위치, move: 리프트 높이).
//   자리 = 읽는 값 at — 같은 글자의 읽는 값 객체가 있어야 한다. 화면 숫자와 표식이 늘 같은 값이고, 표식만 따로 보이는
//          값(숨긴 정답의 실마리)이 생기지 않는다. 단위도 그 읽는 값의 단위(readout.ts unitOf) 하나 — 따로 적지 않아
//          숫자 줄과 띠가 다른 단위를 말할 수 없다
//   모양 = 진행 방향 face 의 부호. 가로 띠는 걷는 사람(+ 오른쪽을 봄, − 좌우를 뒤집음, 0 정면으로 섬 — 돌아서는 순간의
//          속도 0 이 그림으로 보인다), 세로 띠는 리프트 칸(▲ 오름 · ▼ 내림 · = 멈춤). 방향은 자리의 변화율이어야 하므로
//          움직이는 것이 겹치고, 이웃 칸에서 자리가 느는 쪽과 방향 부호가 맞아야 한다(형식 검사)
// 눈금·숫자는 수직선(numberLine.ts)의 칸 계산(cellCount·xOf·nlTicks)을 읽어 쓰기만 한다 — 두 그림의 숫자 간격이 어긋나지
// 않게. 끄는 동안에는 표식 경로 글자와 방향 낭독 글자만 바뀐다(그릴 목록 outer 의 같은 key — React 렌더 0회, P8).
// 띠·눈금은 매개변수로 정해져 화면이 한 번 그린다(stripView).
import { GOAL_MAX_STATES, growStates } from '../../goal.ts';
import { fail, int, obj, oneOf, rationalStr, str } from '../../parse.ts';
import { cellCount, type NLParams, nlTicks, xOf } from '../numberLine.ts';
import { div, isInt, num, q, sub } from '../q.ts';
import type { WidgetCheck } from '../specs.ts';
import { frame, labelWidth, MIN_BOX_H, NARROW_BOX_W, r1, type View } from './frame.ts';
import { goalHits, goalMovers } from './goal.ts';
import { initial } from './model.ts';
import { type Deps, depStates, pointOpts } from './point.ts';
import { parseReadoutExpr, readoutMovers, readoutSym, readoutVal, unitOf } from './readout.ts';
import { sliderOpts } from './slider.ts';
import { symText } from './stat.ts';
import type {
  Box,
  CoordObj,
  CoordParams,
  CoordState,
  DrawCtx,
  Frame,
  ParseCtx,
  ReadoutExpr,
  StateOpt,
  StripObj,
} from './types.ts';

/** 띠 칸 수 상한(수직선과 같은 100칸) */
const MAX_STRIP_CELLS = 100;
/** 띠 끝 값의 크기 상한(수직선과 같은 ±1,000,000) */
const END_MAX = 1_000_000;
/**
 * 띠에 쓰는 읽는 값: 한 자리를 가리키는 수(점 좌표·슬라이더·식·기울기·미분계수·부호 있는 합·구분구적 어림 하나).
 * 개수(roots·meet·cover)는 자리가 아니고, 두 값(sums)·부호 뗀 합(abs — 끊는 곳이 상태마다 달라 sympy 가 한 식으로
 * 되풀이 못 함)·통계 넓이(area·prob — 검산이 자기 항목으로 따로 감)는 표식 검산식을 한 식으로 적을 수 없다
 */
const FORMS: ReadoutExpr['f'][] = [
  'x',
  'y',
  'value',
  'calc',
  'slope',
  'deriv',
  'net',
  'big',
  'small',
  'gap',
];
const FORMS_TEXT = 'x·y·value·식·slope·deriv·net·big·small·gap';
/** 이웃한 세로 띠 숫자(11px) 사이 최소 간격(px) */
const MIN_VGAP = 12;
/** 이웃한 가로 띠 숫자 글자 사이 최소 틈(px) */
const MIN_HGAP = 2;

const KEYS = { req: ['dir', 'min', 'max', 'step', 'at'], opt: ['label', 'face'] };

/** 형식 검사 앞부분: 띠의 방향만(객체를 읽기 전에 그림 영역을 정해야 칸·이름표 검사가 같은 영역으로 센다) */
export function stripDir(v: unknown): { dir: 'x' | 'y' } {
  const c = obj(v, '좌표 strip', ['dir'], [...KEYS.req, ...KEYS.opt]);
  return { dir: oneOf(c.dir, '좌표 strip dir', ['x', 'y'] as const) };
}

/** 띠에 쓰는 읽는 값 하나를 읽는다 */
function formOf(v: unknown, at: string, cx: ParseCtx): { src: string; e: ReadoutExpr } {
  const src = str(v, at).replace(/\s+/g, '');
  const e = parseReadoutExpr(src, at, cx);
  if (!FORMS.includes(e.f))
    fail(at, `${src} 는 띠에 못 씀 — 한 자리를 가리키는 수(${FORMS_TEXT})만`);
  return { src, e };
}

const ratOf = (v: unknown, at: string) => rationalStr(typeof v === 'number' ? String(v) : v, at);

/** 읽는 값 객체가 화면에 있는가(공백 무시) */
const shown = (objects: CoordObj[], src: string) =>
  objects.some((o) => o.kind === 'readout' && o.src.replace(/\s+/g, '') === src);

/** 형식 검사 뒷부분(객체를 다 읽은 뒤): 칸·숫자 간격·자리 읽는 값(과 그 단위)·방향 읽는 값 */
export function parseStrip(v: unknown, cx: ParseCtx, objects: CoordObj[]): StripObj {
  const at = '좌표 strip';
  // face 는 필수지만 선택 칸으로 받는다 — 빠졌을 때 '칸 없음' 대신 왜 필요한지 말하려고
  const c = obj(v, at, KEYS.req, KEYS.opt);
  const { dir } = stripDir(v);
  const min = int(c.min, `${at} min`, -END_MAX, END_MAX);
  const max = int(c.max, `${at} max`, -END_MAX, END_MAX);
  const step = ratOf(c.step, `${at} step`);
  // 칸 규칙은 수직선과 같은 함수로(step > 0 · max > min · 나누어떨어짐 · 칸 수 상한)
  cellCount(String(min), String(max), step, at, MAX_STRIP_CELLS);
  const label = c.label === undefined ? undefined : ratOf(c.label, `${at} label`);
  if (label !== undefined && !(num(q(label)) > 0)) fail(`${at} label`, '0 보다 커야 함');
  if (label !== undefined && !isInt(div(q(label), q(step))))
    fail(`${at} label`, `칸 간격(${step})의 배수여야 함`);
  const a = formOf(c.at, `${at} at`, cx);
  // 화면 숫자와 표식이 같은 값이게 — 같은 글자의 읽는 값 객체(공백 무시)가 있어야
  if (!shown(objects, a.src))
    fail(
      `${at} at`,
      `${a.src} 와 같은 글자의 읽는 값 객체가 없음 — 표식 자리는 화면에 보이는 읽는 값이어야(숫자와 표식이 같은 값)`,
    );
  // 단위는 그 읽는 값의 단위(읽는 값 객체가 이미 같은 셈으로 형식 검사를 통과했다)
  const u = unitOf(cx, a.e);
  if (typeof u === 'object') fail(`${at} at`, u.error);
  if (c.face === undefined)
    fail(
      `${at} face`,
      '진행 방향(속도) 읽는 값이 필요함 — 표식 모양(오른쪽·왼쪽·멈춤)이 방향을 말한다',
    );
  const fc = formOf(c.face, `${at} face`, cx);
  const o: StripObj = {
    dir,
    min,
    max,
    step,
    ...(label !== undefined ? { label } : {}),
    ...(typeof u === 'string' ? { unit: u } : {}),
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
/**
 * 띠 위 값(칸 사이 값 포함) → px. 띠 끝(min~max)에 묶는다 — 무거운 검사가 닿는 모든 상태에서 띠 안을 확인하지만,
 * 그 검사를 빠져나간 값(부동소수 찌꺼기 등)이 와도 표식이 상자 밖·다른 그림 위로 가지 않게
 */
const valPx = (o: StripObj, g: StripGeo, v: number) =>
  g.a + ((Math.min(o.max, Math.max(o.min, v)) - o.min) / (o.max - o.min)) * (g.b - g.a);

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

const markOf = (p: CoordParams, o: StripObj, s: CoordState, box: Box, f: Frame) => {
  const m = valueAndFace(p, s, o);
  return { ...m, px: valPx(o, geo(o, box, f), m.v) };
};

/** 띠가 없는 좌표평면에서 부르면 부르는 쪽의 잘못(화면은 p.strip 이 있을 때만 부른다) */
const stripOf = (p: CoordParams): StripObj => {
  if (!p.strip) throw new Error('길 띠가 없는 좌표평면');
  return p.strip;
};

/** 지금 상태의 표식: 값·방향 부호·띠 위 px(상자 크기 box 에서) */
export function stripAt(
  p: CoordParams,
  s: CoordState,
  box: Box,
): { v: number; face: -1 | 0 | 1; px: number } {
  return markOf(p, stripOf(p), s, box, frame(box, p));
}

/** 방향 낭독 글자(화면 낭독기가 표식 그림 대신 읽는다) */
const SAY = {
  x: { 1: '오른쪽으로 걷는 중', 0: '멈춤', [-1]: '왼쪽으로 걷는 중' },
  y: { 1: '오르는 중', 0: '멈춤', [-1]: '내려가는 중' },
} as const;

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

/** 리프트 칸의 반폭(세로 띠 숫자·단위가 이 바깥에서 시작한다) */
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
  const m = markOf(p, o, s, box, f);
  const ok = Number.isFinite(m.v);
  if (o.dir === 'x')
    outer.push({
      t: 'path',
      key: 'sw',
      d: ok ? walker(m.px, g.line - BAND / 2, m.face) : '',
      cls: 'smark',
    });
  else {
    const l = ok ? lift(g.line, m.px, m.face) : { cab: '', mark: '' };
    outer.push({ t: 'path', key: 'sc', d: l.cab, cls: 'scab' });
    outer.push({ t: 'path', key: 'sw', d: l.mark, cls: 'smark' });
  }
  // 그림이 말하는 방향을 낭독기에도(글자는 보이지 않게 — CSS .sdir). 끄는 동안 apply 가 글자를 바꿔 넣는다
  outer.push({
    t: 'label',
    key: 'sd',
    x: 0,
    y: 0,
    text: ok ? SAY[o.dir][m.face] : '',
    hidden: false,
    cls: 'sdir',
  });
}

export interface StripView {
  dir: 'x' | 'y';
  /** 띠 묶음의 낭독 이름('길 띠: 집 기준 위치' — 자리 읽는 값의 이름) */
  name: string;
  /** 띠(길) 경로 */
  band: string;
  /** 칸마다 눈금 자리(띠 방향 px) */
  ticks: number[];
  /** 눈금 금 경로 */
  tickD: string;
  nums: { x: number; y: number; text: string; anchor: 'middle' | 'start' }[];
  /** 세로 띠의 단위(숫자 줄 위) */
  unit?: { x: number; y: number; text: string };
}

/** 띠·눈금·숫자(화면이 한 번 그리는 것 — 매개변수와 상자 크기로만 정해진다) */
export function stripView(p: CoordParams, box: Box): StripView {
  const o = stripOf(p);
  const ro = p.objects.find((x) => x.kind === 'readout' && x.src.replace(/\s+/g, '') === o.src);
  // 이름은 낭독용 글 — 수식 표시($)만 떼고 그대로
  const name = `길 띠: ${(ro?.kind === 'readout' ? ro.label : o.src).replace(/\$/g, '')}`;
  return { ...viewOf(o, p, box), name };
}

function viewOf(o: StripObj, v: View, box: Box): Omit<StripView, 'name'> {
  const g = geo(o, box, frame(box, v));
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
  // 숫자·단위 열은 리프트 칸(반폭 7) 오른쪽 끝 바깥 — 칸이 맨 위·맨 아래에 와도 덮지 않게
  const col = r1(x + LIFT_HALF + 1.5);
  return {
    dir: 'y',
    band: `M${P(x - h, g.b)}V${r1(g.a)}H${r1(x + h)}V${r1(g.b)}Z`,
    ticks,
    // 눈금 금은 띠 왼쪽(그림 쪽)에 — 숫자 바로 앞에 두면 금이 빼기 기호처럼 읽혀 '4' 가 '−4' 로 보였다(헤드리스 캡처)
    tickD: ticks.map((y) => `M${P(x - h - 4, y)}h4`).join(''),
    nums: ts.flatMap((t, k) =>
      t.label
        ? [{ x: col, y: r1((ticks[k] as number) + 4), text: t.label, anchor: 'start' as const }]
        : [],
    ),
    // 단위는 맨 위 숫자 한 줄 위(괄호 없이 — 띠 폭이 좁다)
    ...(o.unit ? { unit: { x: col, y: r1(g.b - 7), text: o.unit } } : {}),
  };
}

/**
 * 숫자 간격(가장 좁은 화면): 가로 띠는 이웃 숫자 글자가 겹치지 않게(수직선 nlTicks 는 자기 그림 폭 320 으로 재므로 띠 폭에서
 * 다시 잰다), 세로 띠는 이웃 숫자 사이가 MIN_VGAP 이상이고 숫자·단위가 띠 폭(상자 끝) 안. 축척 같게로 그림이 납작해지면 걸린다
 */
function checkStripNums(o: StripObj, cx: ParseCtx): void {
  const box = { w: NARROW_BOX_W, h: MIN_BOX_H };
  const v = viewOf(o, { x: cx.x, y: cx.y, equal: cx.equal, strip: o }, box);
  if (v.unit && v.unit.x + labelWidth(v.unit.text) > box.w)
    fail(
      '좌표 strip',
      `세로 띠 단위 '${v.unit.text}' 이 띠 폭을 넘음(${(box.w - v.unit.x).toFixed(1)}px 안이어야) — 세로축 단위를 짧게`,
    );
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

// ---- 형식 검사(움직이는 것)·무거운 형식 검사·검산 ----

const moversOf = (p: CoordParams, e: ReadoutExpr): Deps => {
  const m = readoutMovers(p, e);
  return { pts: new Set(m.points), sliders: new Set(m.sliders) };
};
const union = (...ds: Deps[]): Deps => ({
  pts: new Set(ds.flatMap((d) => [...d.pts])),
  sliders: new Set(ds.flatMap((d) => [...d.sliders])),
});
/** 표식을 움직이는 것(자리 읽는 값 + 방향 읽는 값) */
const stripDeps = (p: CoordParams, o: StripObj) => union(moversOf(p, o.at), moversOf(p, o.face));
const depsText = (d: Deps) => [...d.sliders, ...d.pts].join('·') || '없음';
const both = (a: Deps, b: Deps, id: string) =>
  (a.pts.has(id) && b.pts.has(id)) || (a.sliders.has(id) && b.sliders.has(id));

/**
 * 형식 검사(매개변수를 다 읽은 뒤): 방향은 자리의 변화율이므로 둘을 움직이는 것이 하나라도 겹쳐야 한다 — 안 겹치면 표식이
 * 움직이는 동안 모양이 그대로이거나, 제자리에서 모양만 바뀐다
 */
export function checkStripMovers(p: CoordParams): void {
  const o = p.strip;
  if (!o) return;
  const a = moversOf(p, o.at);
  const f = moversOf(p, o.face);
  if (![...a.pts, ...a.sliders].some((id) => both(a, f, id)))
    fail(
      '좌표 strip face',
      `방향 ${o.faceSrc} 를 움직이는 것(${depsText(f)})이 자리 ${o.src} 를 움직이는 것(${depsText(a)})과 겹치지 않음 — 방향은 자리가 바뀌는 빠르기(속도)여야`,
    );
}

type Row = { s: CoordState; sym: Record<string, string> };
/** 늘어놓은 상태들과, 움직이는 것마다의 칸 수·보폭(이웃 칸을 찾으려고 — growStates 는 뒤에 붙인 것이 가장 빨리 바뀐다) */
interface Grid {
  rows: Row[];
  dims: { id: string; n: number; stride: number }[];
}

/**
 * 움직이는 것이 닿는 모든 상태(덜어 내지 않는다). 상한(목표와 같은 GOAL_MAX_STATES)을 넘으면 형식 오류 — 덜어 내면
 * 건너뛴 칸에서 표식이 띠 밖으로 나가는 것을 놓친다
 */
function allStates(p: CoordParams, d: Deps, what: string): Grid {
  const opts: { id: string; o: StateOpt[] }[] = [];
  for (const id of d.sliders) {
    const sl = p.sliders.find((x) => x.id === id);
    if (sl) opts.push({ id, o: sliderOpts(sl) });
  }
  for (const id of d.pts) opts.push({ id, o: pointOpts(p, id) });
  const n = opts.reduce((k, x) => k * x.o.length, 1);
  if (n > GOAL_MAX_STATES)
    fail(
      '좌표 strip',
      `길 띠 ${what}이 바라보는 상태가 ${n}개 — ${GOAL_MAX_STATES}개 이하로(닿는 모든 상태에서 띠 안·방향을 확인). 슬라이더·끄는 점의 칸을 줄이세요`,
    );
  let rows: Row[] = [{ s: initial(p), sym: {} }];
  for (const x of opts) rows = growStates(rows, x.o, '좌표 strip');
  let stride = 1;
  const dims: Grid['dims'] = [];
  for (const x of [...opts].reverse()) {
    dims.unshift({ id: x.id, n: x.o.length, stride });
    stride *= x.o.length;
  }
  return { rows, dims };
}

/**
 * 무거운 형식 검사:
 *  ① 닿는 모든 상태에서 표식이 띠 안이고 방향이 정의되는가 — 띠 밖 표식은 띠 끝에 묶여 거짓 자리를 말한다
 *  ② 자리와 방향을 함께 움직이는 것마다 이웃 칸에서 자리가 는 쪽과 방향 부호가 어긋나지 않는가 — 어긋나면 걷는 사람이 뒤로
 *     걷는다(두 칸 중 한쪽이라도 맞으면 그 사이에 돌아섰다고 본다)
 *  ③ 정답 신호 금지(P3): checkStripGoal
 */
export function checkStrip(p: CoordParams): void {
  const o = p.strip;
  if (!o) return;
  const grid = allStates(p, stripDeps(p, o), '표식');
  const ms = grid.rows.map((r) => valueAndFace(p, r.s, o));
  grid.rows.forEach((r, k) => {
    const m = ms[k] as (typeof ms)[number];
    const fv = readoutVal(p, r.s, o.face).n;
    const where = symText(r.sym);
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
  });
  const a = moversOf(p, o.at);
  const f = moversOf(p, o.face);
  for (const d of grid.dims) {
    if (!both(a, f, d.id)) continue;
    grid.rows.forEach((r, k) => {
      if (Math.floor(k / d.stride) % d.n === d.n - 1) return;
      const k1 = k + d.stride;
      const m0 = ms[k] as (typeof ms)[number];
      const m1 = ms[k1] as (typeof ms)[number];
      const dv = m1.v - m0.v;
      if (Math.abs(dv) <= 1e-12 * Math.max(1, Math.abs(m0.v))) return;
      const sg = Math.sign(dv);
      if (m0.face !== sg && m1.face !== sg)
        fail(
          '좌표 strip face',
          `자리 ${o.src} 의 증감(${sg > 0 ? '늚' : '줆'})과 방향 ${o.faceSrc} 의 부호가 어긋남 (${symText(r.sym)} → ${symText((grid.rows[k1] as Row).sym)}) — 방향은 자리가 바뀌는 빠르기(속도)여야`,
        );
    });
  }
  checkStripGoal(p, o);
}

/**
 * 정답 신호 금지(P3): 목표가 있고 방향 읽는 값이 화면에 없으면, 목표를 이룬 상태에 멈춘 모습(방향 0)이 없어야 한다 —
 * 있으면 끄는 도중 표식이 멈추는 자리가 곧 정답이다. 속도 숫자가 화면에 보이면 그 숫자가 이미 말하므로 괜찮다
 */
function checkStripGoal(p: CoordParams, o: StripObj): void {
  if (!p.goal || shown(p.objects, o.faceSrc)) return;
  const g = goalMovers(p);
  const d = union(moversOf(p, o.face), { pts: new Set(g.points), sliders: new Set(g.sliders) });
  for (const r of allStates(p, d, '방향과 목표').rows) {
    if (goalHits(p, r.s).length === 0 || valueAndFace(p, r.s, o).face !== 0) continue;
    fail(
      '좌표 strip face',
      `정답 신호: 목표를 이룬 자리(${symText(r.sym)})에서 방향 ${o.faceSrc} 가 0 이라 멈춘 모습이 끄는 도중 정답을 알려 줌(P3) — ${o.faceSrc} 를 읽는 값으로 화면에 보이거나 목표를 바꾸세요`,
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
  const ms = st.map((r) => valueAndFace(p, r.s, o));
  out.push({
    name: `길 띠 표식 ${o.src}`,
    kind: 'parity',
    expr: readoutSym(p, o.at).expr,
    points: st.map((r) => r.sym),
    values: ms.map((m) => (Number.isFinite(m.v) ? m.v : null)),
  });
  out.push({
    name: `길 띠 방향 ${o.faceSrc}`,
    kind: 'parity',
    expr: `sign(${readoutSym(p, o.face).expr})`,
    points: st.map((r) => r.sym),
    values: ms.map((m) => m.face),
  });
}
