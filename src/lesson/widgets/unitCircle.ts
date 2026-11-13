// 단위원 부품의 모델(순수). 화면(UnitCircle.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 각도는 "도" 정수로 들고 다닌다(스냅 간격이 360 을 나누므로 늘 정수). 특수각(30°·45°의 배수)은 √ 가 든
// 정확한 값을 표에서, 나머지는 소수 셋째 자리 근삿값을 보인다 — 둘 다 checks 가 sympy 의 sin·cos 와 대조한다.
// 그래프로 펼치기(unroll): 원 위 점의 높이(sin)가 오른쪽 그래프의 같은 높이로 이어져 사인 곡선을 그린다.
import { LITERAL } from '../../content/check.ts';
import { arr, fail, int, obj, oneOf, str } from '../parse.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type Trig = 'sin' | 'cos' | 'tan';
export interface UCParams {
  unit: 'deg' | 'rad';
  /** 처음 각도(도) */
  start: number;
  /** 'special' = 30°·45°의 배수, 숫자 = 그 간격(도) */
  snap: 'special' | number;
  show: Trig[];
  unroll?: boolean;
  /** 각도 맞히기 과제: 답(도)과 그 답을 계산하는 sympy 식(도 단위) */
  task?: { answer: number; check: string };
}
export interface UCState {
  deg: number;
}

export const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export const W = 320;

/** 닿을 수 있는 각도들(오름차순) */
export function angles(p: UCParams): number[] {
  if (p.snap === 'special') return SPECIAL;
  const step = p.snap;
  return Array.from({ length: 360 / step }, (_, i) => i * step);
}

const norm = (d: number) => ((d % 360) + 360) % 360;
const circDist = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 360 - d);
};

export function ucSnap(p: UCParams, deg: number): number {
  let best = 0;
  let bd = Number.POSITIVE_INFINITY;
  for (const a of angles(p)) {
    const d = circDist(a, deg);
    if (d < bd - 1e-9) {
      best = a;
      bd = d;
    }
  }
  return best;
}

export function ucKey(p: UCParams, s: UCState, key: string): UCState | null {
  const as = angles(p);
  const i = as.indexOf(s.deg);
  const n = as.length;
  if (key === 'Home') return { deg: 0 };
  if (key === 'ArrowRight' || key === 'ArrowUp') return { deg: as[(i + 1) % n] as number };
  if (key === 'ArrowLeft' || key === 'ArrowDown') return { deg: as[(i - 1 + n) % n] as number };
  return null;
}

// ---- 그림 배치 ----

export function ucGeom(p: UCParams) {
  return p.unroll
    ? { cx: 84, cy: 108, R: 64, gx: 172, gw: 140, h: 216 }
    : { cx: 160, cy: 124, R: 100, gx: 0, gw: 0, h: 248 };
}
const rad = (d: number) => (d * Math.PI) / 180;
export function pointAt(p: UCParams, deg: number) {
  const g = ucGeom(p);
  return { x: r2(g.cx + g.R * Math.cos(rad(deg))), y: r2(g.cy - g.R * Math.sin(rad(deg))) };
}

/** 끌기: 시작 각도의 점에서 (dx,dy) 만큼 옮긴 곳의 각도를 재어 스냅 */
export function ucDrag(p: UCParams, s: UCState, dx: number, dy: number): UCState {
  const g = ucGeom(p);
  const a = pointAt(p, s.deg);
  const x = a.x + dx - g.cx;
  const y = g.cy - (a.y + dy);
  if (Math.hypot(x, y) < 1) return s;
  return { deg: ucSnap(p, (Math.atan2(y, x) * 180) / Math.PI) };
}

// ---- 값 ----

const SIN_Q1: Record<number, string> = {
  0: '0',
  30: '1/2',
  45: 'sqrt(2)/2',
  60: 'sqrt(3)/2',
  90: '1',
};
const TAN_HALF: Record<number, string | null> = {
  0: '0',
  30: 'sqrt(3)/3',
  45: '1',
  60: 'sqrt(3)',
  90: null,
  120: '-sqrt(3)',
  135: '-1',
  150: '-sqrt(3)/3',
};
const neg = (s: string) => (s === '0' ? s : s.startsWith('-') ? s.slice(1) : `-${s}`);

function sinExact(deg: number): string | null {
  const d = norm(deg);
  const r = d % 180;
  const ref = r <= 90 ? r : 180 - r;
  const v = SIN_Q1[ref];
  if (v === undefined) return null;
  return d >= 180 ? neg(v) : v;
}

/** 특수각의 정확한 값(sympy 식 글자). 특수각이 아니면 null. tan 이 정의되지 않으면 tan: null */
export function exact(deg: number): { sin: string; cos: string; tan: string | null } | null {
  const s = sinExact(deg);
  const c = sinExact(deg + 90);
  if (s === null || c === null) return null;
  const t = TAN_HALF[norm(deg) % 180];
  return { sin: s, cos: c, tan: t === undefined ? null : t };
}

/** sympy 식 글자 → 화면 글자(√, 진짜 빼기표) */
const pretty = (s: string) => s.replace(/sqrt\((\d+)\)/g, '√$1').replace(/^-/, '−');

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** 도 → 라디안 글자(π/6 등)와 sympy 식 */
function radParts(deg: number): { text: string; sym: string } {
  if (deg === 0) return { text: '0', sym: '0' };
  const g = gcd(deg, 180);
  const n = deg / g;
  const d = 180 / g;
  const top = n === 1 ? 'π' : `${n}π`;
  const sym = `${n === 1 ? '' : `${n}*`}pi${d === 1 ? '' : `/${d}`}`;
  return { text: d === 1 ? top : `${top}/${d}`, sym };
}
export const radText = (deg: number) => radParts(deg).text;

/** 근삿값: 소수 셋째 자리(0.5 는 0 에서 먼 쪽). −0 은 0 */
function approx(v: number): string {
  const r = Math.round(Math.abs(v) * 1000 + 1e-9) / 1000;
  const s = r.toFixed(3);
  return v < 0 && r !== 0 ? `-${s}` : s;
}

function valueText(f: Trig, deg: number): string {
  const e = exact(deg);
  if (e) {
    const v = e[f];
    return v === null ? `${f} θ 는 정할 수 없어요` : `${f} θ = ${pretty(v)}`;
  }
  const x = rad(deg);
  if (f === 'tan' && Math.abs(Math.cos(x)) < 1e-12) return `${f} θ 는 정할 수 없어요`;
  const v = f === 'sin' ? Math.sin(x) : f === 'cos' ? Math.cos(x) : Math.tan(x);
  return `${f} θ ≈ ${pretty(approx(v))}`;
}

const angText = (p: UCParams, deg: number) =>
  p.unit === 'rad' ? `θ = ${radText(deg)} (${deg}°)` : `θ = ${deg}°`;

// ---- 그릴 목록 ----

export function ucDraw(p: UCParams, s: UCState): Drawing {
  const g = ucGeom(p);
  const P = pointAt(p, s.deg);
  const marks: Mark[] = [
    { k: 'radL', tag: 'line', a: { x1: g.cx, y1: g.cy, x2: P.x, y2: P.y, class: 'uc-rad' } },
    { k: 'cosL', tag: 'line', a: { x1: g.cx, y1: g.cy, x2: P.x, y2: g.cy, class: 'uc-cos' } },
    { k: 'sinL', tag: 'line', a: { x1: P.x, y1: g.cy, x2: P.x, y2: P.y, class: 'uc-sin' } },
  ];
  // 각을 나타내는 작은 호(0° 에서 θ 까지, 반시계)
  const ar = 22;
  const end = { x: r2(g.cx + ar * Math.cos(rad(s.deg))), y: r2(g.cy - ar * Math.sin(rad(s.deg))) };
  marks.push({
    k: 'arc',
    tag: 'path',
    a: {
      d:
        s.deg === 0
          ? 'M0 0'
          : `M${g.cx + ar} ${g.cy}A${ar} ${ar} 0 ${s.deg > 180 ? 1 : 0} 0 ${end.x} ${end.y}`,
      class: 'uc-arc',
    },
  });
  if (p.unroll) {
    const gx = (d: number) => r2(g.gx + (d / 360) * g.gw);
    const gy = (d: number) => r2(g.cy - g.R * Math.sin(rad(d)));
    let d = `M${gx(0)} ${gy(0)}`;
    for (let t = 5; t <= s.deg; t += 5) d += `L${gx(t)} ${gy(t)}`;
    d += `L${gx(s.deg)} ${gy(s.deg)}`;
    marks.push({ k: 'trace', tag: 'path', a: { d, class: 'uc-trace' } });
    marks.push({
      k: 'link',
      tag: 'line',
      a: { x1: P.x, y1: P.y, x2: gx(s.deg), y2: P.y, class: 'uc-link' },
    });
    marks.push({
      k: 'gP',
      tag: 'circle',
      a: { cx: gx(s.deg), cy: gy(s.deg), r: 6, class: 'uc-gp' },
    });
  }
  marks.push({ k: 'h:P', tag: 'g', a: { transform: `translate(${P.x} ${P.y})` } });
  const texts: Record<string, string> = { ang: angText(p, s.deg) };
  for (const f of p.show) texts[f] = valueText(f, s.deg);
  return { marks, texts };
}

/** 사인 곡선 전체(옅게, 화면이 한 번 그린다) */
export function ucCurve(p: UCParams): string {
  const g = ucGeom(p);
  let d = '';
  for (let t = 0; t <= 360; t += 5)
    d += `${t ? 'L' : 'M'}${r2(g.gx + (t / 360) * g.gw)} ${r2(g.cy - g.R * Math.sin(rad(t)))}`;
  return d;
}

// ---- 형식 검사·검산 ----

export const unitCircleDef: WidgetDef<UCParams> = {
  parse(raw) {
    const o = obj(raw, '단위원', ['unit', 'start', 'snap', 'show'], ['unroll', 'task']);
    let snap: UCParams['snap'];
    if (o.snap === 'special') snap = 'special';
    else {
      snap = int(o.snap, '단위원 snap', 5, 90);
      if (360 % snap !== 0) fail('단위원 snap', `360 을 나누어떨어지게 하는 간격이 아님 (${snap})`);
    }
    const p: UCParams = {
      unit: oneOf(o.unit, '단위원 unit', ['deg', 'rad'] as const),
      start: int(o.start, '단위원 start', 0, 359),
      snap,
      show: arr(o.show, '단위원 show', 1, 3).map((v) =>
        oneOf(v, '단위원 show', ['sin', 'cos', 'tan'] as const),
      ),
    };
    if (o.unroll !== undefined) {
      if (typeof o.unroll !== 'boolean') fail('단위원 unroll', 'true/false 만');
      if (o.unroll) p.unroll = true;
    }
    if (!angles(p).includes(p.start)) fail('단위원 start', '스냅 각도가 아님');
    if (o.task !== undefined) {
      const t = obj(o.task, '단위원 task', ['answer', 'check']);
      const answer = int(t.answer, '단위원 task.answer', 0, 359);
      if (!angles(p).includes(answer)) fail('단위원 task.answer', '스냅으로 닿을 수 없는 각도');
      if (answer === p.start) fail('단위원 task', '처음 각도가 이미 답');
      const check = str(t.check, '단위원 task.check');
      if (LITERAL.test(check)) fail('단위원 task.check', '검산식이 답을 그대로 적은 값임');
      p.task = { answer, check };
    }
    return p;
  },
  checks(p) {
    const out: WidgetCheck[] = [];
    for (const deg of angles(p)) {
      const e = exact(deg);
      for (const f of p.show) {
        const c = `${f}(rad(${deg}))`;
        if (e) {
          const v = e[f];
          // 정할 수 없는 tan 은 화면이 "정할 수 없어요"로 보인다 — sympy 도 무한대(zoo)여야 맞다
          if (v === null)
            out.push({
              name: `${deg}° ${f}`,
              answer: '1',
              answerType: 'int',
              check: `1 if ${c} == zoo else 0`,
            });
          else out.push({ name: `${deg}° ${f}`, answer: v, answerType: 'expr', check: c });
        } else {
          const x = rad(deg);
          if (f === 'tan' && Math.abs(Math.cos(x)) < 1e-12) continue;
          const v = f === 'sin' ? Math.sin(x) : f === 'cos' ? Math.cos(x) : Math.tan(x);
          out.push({ name: `${deg}° ${f}`, kind: 'approx', expr: c, value: approx(v), digits: 3 });
        }
      }
      if (p.unit === 'rad')
        out.push({
          name: `${deg}° 라디안`,
          answer: radParts(deg).sym,
          answerType: 'expr',
          check: `rad(${deg})`,
        });
    }
    if (p.task)
      out.push({
        name: '각도 과제',
        answer: String(p.task.answer),
        answerType: 'int',
        check: p.task.check,
      });
    return out;
  },
  texts: () => [],
};
