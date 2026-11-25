// 측정값 계산(부동소수)·이름·종류·내용 열쇠·화면 글. 판정용 정확한 값은 goal.ts, sympy 식은 checks.ts.
import { P } from './model.ts';
import type { ShapeParams, ShCircle, ShMeasure, ShState } from './types.ts';

type XY = { x: number; y: number };

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (l < 1e-12) return null;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l));
  return (Math.acos(cos) * 180) / Math.PI;
}
/** B 에서 BA 를 시계 반대 방향으로 돌려 BC 에 닿는 각(0°~360°). 두 점이 꼭짓점과 겹치면 null */
export function ccwAngle(a: XY, b: XY, c: XY): number | null {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  if (Math.hypot(ux, uy) < 1e-12 || Math.hypot(vx, vy) < 1e-12) return null;
  const t = (Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180) / Math.PI;
  // −0 과 아주 작은 음수(부동소수 찌꺼기)는 0 으로 — 360 으로 보이지 않게
  return t < -1e-9 ? t + 360 : Math.max(0, t);
}
/** 원의 반지름(수, 또는 through 점까지 거리) */
export const circleR = (s: ShState, c: ShCircle) =>
  'r' in c ? c.r : dist(P(s, c.c), P(s, c.through));
export const shoelace = (ps: { x: number; y: number }[]) => {
  let t = 0;
  ps.forEach((a, i) => {
    const b = ps[(i + 1) % ps.length] as { x: number; y: number };
    t += a.x * b.y - b.x * a.y;
  });
  return Math.abs(t) / 2;
};

/** digits 자리 반올림 글자(ASCII, 뒤 0 없앰)와 정확히 떨어지는가 */
export function round(v: number, digits: number): { s: string; exact: boolean } {
  const k = 10 ** digits;
  const r = Math.round(v * k + (v >= 0 ? 1e-9 : -1e-9)) / k;
  const s = String(Number(r.toFixed(digits)));
  return { s: s === '-0' ? '0' : s, exact: Math.abs(v - r) < 1e-9 };
}
export const shown = (v: number, digits: number, unit = '') => {
  const r = round(v, digits);
  return `${r.exact ? '=' : '≈'} ${r.s.replace('-', '−')}${unit}`;
};

/** 묶은 측정값(합·차·비·제곱·사인)의 항 번호. 길이·각·넓이·호·원주는 빈 목록 */
export const operands = (m: ShMeasure): number[] =>
  'sum' in m
    ? m.sum
    : 'diff' in m
      ? m.diff
      : 'ratio' in m
        ? m.ratio
        : 'sq' in m
          ? [m.sq]
          : 'sin' in m
            ? [m.sin]
            : [];
export const sub = (p: ShapeParams, i: number) => p.measures[i] as ShMeasure;

export function measureValue(p: ShapeParams, s: ShState, m: ShMeasure): number | null {
  if ('len' in m) return dist(P(s, m.len[0]), P(s, m.len[1]));
  if ('angle' in m) {
    const [a, b, c] = m.angle.map((id) => P(s, id)) as [XY, XY, XY];
    return m.ccw ? ccwAngle(a, b, c) : angleAt(a, b, c);
  }
  if ('area' in m) return shoelace((p.polygons[m.area] ?? []).map((id) => P(s, id)));
  if ('arc' in m) {
    // 호 길이 = 반지름 × 중심각(라디안). 반지름은 중심에서 from 까지
    const a = arcOf(p, m.arc);
    const t = ccwAngle(P(s, a.from), P(s, a.c), P(s, a.to));
    return t === null ? null : (dist(P(s, a.c), P(s, a.from)) * t * Math.PI) / 180;
  }
  if ('around' in m) return 2 * Math.PI * circleR(s, p.circles[m.around] as ShCircle);
  const v = operands(m).map((i) => measureValue(p, s, sub(p, i)));
  if (v.some((x) => x === null)) return null;
  const [a, b] = v as [number, number];
  if ('sq' in m) return a * a;
  if ('sin' in m) return Math.sin((a * Math.PI) / 180);
  if ('sum' in m) return (v as number[]).reduce((t, x) => t + x, 0);
  if ('diff' in m) return Math.abs(a - b);
  // 분모 길이가 0(두 점이 겹침)이면 비를 정할 수 없다 — 각을 정할 수 없을 때와 같은 글
  return b < 1e-12 ? null : a / b;
}

/** 측정값의 종류(같은 종류끼리만 묶고 견준다 — 길이와 각을 더하거나 같다고 하면 뜻이 없다) */
export function measureKind(p: ShapeParams, m: ShMeasure): 'len' | 'angle' | 'area' | 'ratio' {
  if ('len' in m || 'arc' in m || 'around' in m) return 'len';
  if ('angle' in m) return 'angle';
  // 길이의 제곱은 넓이와 같은 단위(m²) — 정사각형 넓이와 AB² 를 견줄 수 있다
  if ('area' in m || 'sq' in m) return 'area';
  // 길이 ÷ sin 은 길이(사인법칙의 2R) — 단위를 붙이고 길이와 견줄 수 있다
  if ('ratio' in m && 'sin' in sub(p, m.ratio[1])) return 'len';
  if ('ratio' in m || 'sin' in m) return 'ratio';
  return measureKind(p, sub(p, operands(m)[0] as number));
}

/** 화면에 적는 측정값 이름(PF, ∠ABC, PF + PG, |PF − PG|, AD ÷ AB) */
export function measureName(p: ShapeParams, m: ShMeasure): string {
  if (m.label) return m.label;
  if ('len' in m) return m.len.join('');
  if ('angle' in m) return `∠${m.angle.join('')}`;
  if ('area' in m) return '넓이';
  if ('arc' in m) {
    const a = arcOf(p, m.arc);
    return `호 ${a.from}${a.to}`;
  }
  if ('around' in m) return '원주';
  const n = operands(m).map((i) => measureName(p, sub(p, i)));
  if ('sq' in m) return `${n[0]}²`;
  if ('sin' in m) return `sin ${n[0]}`;
  if ('sum' in m) return n.join(' + ');
  if ('diff' in m) return `|${n[0]} − ${n[1]}|`;
  return `${n[0]} ÷ ${n[1]}`;
}

/**
 * 측정값의 내용(적은 순서와 무관): PF 와 FP, ∠FPG 와 ∠GPF, 항 순서만 다른 합·차는 같은 열쇠. 비는 순서가 뜻이다.
 * 번호가 달라도 내용이 같은 측정값끼리 묶거나 견주면 늘 같은 값이라 끌어서 볼 것이 없다.
 */
export function measureKey(p: ShapeParams, m: ShMeasure): string {
  if ('len' in m) return `len:${[...m.len].sort().join('')}`;
  if ('angle' in m) {
    const [a, b, c] = m.angle;
    // 시계 반대 방향으로 잰 각은 차례가 뜻이다(∠ABC 와 ∠CBA 는 합이 360°)
    return m.ccw ? `angle-ccw:${a}${b}${c}` : `angle:${[a, c].sort().join(b)}`;
  }
  if ('arc' in m) {
    const a = arcOf(p, m.arc);
    return `arc:${a.c}${a.from}${a.to}`;
  }
  if ('around' in m) return `around:${m.around}`;
  if ('area' in m) {
    // 다각형은 어느 꼭짓점부터·어느 방향으로 적어도 같은 모양
    const v = p.polygons[m.area] ?? [];
    const rots = [v, [...v].reverse()].flatMap((w) =>
      w.map((_, i) => [...w.slice(i), ...w.slice(0, i)].join('')),
    );
    return `area:${rots.sort()[0]}`;
  }
  const ks = operands(m).map((i) => measureKey(p, sub(p, i)));
  if ('sq' in m) return `sq(${ks[0]})`;
  if ('sin' in m) return `sin(${ks[0]})`;
  if ('ratio' in m) return `ratio(${ks.join('/')})`;
  return `${'sum' in m ? 'sum' : 'diff'}(${ks.sort().join(',')})`;
}

/** 측정 글들(화면에 보이는 그대로) */
export function shMeasures(p: ShapeParams, s: ShState): string[] {
  return p.measures.map((m) => {
    const v = measureValue(p, s, m);
    const name = measureName(p, m);
    if (v === null) return `${name} 은 정할 수 없어요`;
    return `${name} ${shown(v, p.digits, unitText(p, m))}`;
  });
}

/** 값 뒤에 붙는 단위 글: 각 °, 길이 " m", 넓이·제곱 " m²", 비는 없음 */
export function unitText(p: ShapeParams, m: ShMeasure): string {
  const k = measureKind(p, m);
  if (k === 'angle') return '°';
  if (!p.unit || k === 'ratio') return '';
  return k === 'area' ? ` ${p.unit}²` : ` ${p.unit}`;
}

export const arcOf = (p: ShapeParams, i: number) =>
  (p.arcs ?? [])[i] as { c: string; from: string; to: string };

export const cutArea = (s: ShState, ids: string[]) => shoelace(ids.map((id) => P(s, id)));
