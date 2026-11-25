// 측정값 계산(부동소수)·이름·종류·내용 열쇠·화면 글. 판정용 정확한 값은 goal.ts, sympy 식은 checks.ts.
import { P } from './model.ts';
import type { ShapeParams, ShMeasure, ShState } from './types.ts';

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

/** 묶은 측정값(합·차·비)의 항 번호. 길이·각·넓이는 빈 목록 */
export const operands = (m: ShMeasure): number[] =>
  'sum' in m ? m.sum : 'diff' in m ? m.diff : 'ratio' in m ? m.ratio : [];
export const sub = (p: ShapeParams, i: number) => p.measures[i] as ShMeasure;

export function measureValue(p: ShapeParams, s: ShState, m: ShMeasure): number | null {
  if ('len' in m) return dist(P(s, m.len[0]), P(s, m.len[1]));
  if ('angle' in m) return angleAt(P(s, m.angle[0]), P(s, m.angle[1]), P(s, m.angle[2]));
  if ('area' in m) return shoelace((p.polygons[m.area] ?? []).map((id) => P(s, id)));
  const v = operands(m).map((i) => measureValue(p, s, sub(p, i)));
  if (v.some((x) => x === null)) return null;
  const [a, b] = v as [number, number];
  if ('sum' in m) return (v as number[]).reduce((t, x) => t + x, 0);
  if ('diff' in m) return Math.abs(a - b);
  // 분모 길이가 0(두 점이 겹침)이면 비를 정할 수 없다 — 각을 정할 수 없을 때와 같은 글
  return b < 1e-12 ? null : a / b;
}

/** 측정값의 종류(같은 종류끼리만 묶고 견준다 — 길이와 각을 더하거나 같다고 하면 뜻이 없다) */
export function measureKind(p: ShapeParams, m: ShMeasure): 'len' | 'angle' | 'area' | 'ratio' {
  if ('len' in m) return 'len';
  if ('angle' in m) return 'angle';
  if ('area' in m) return 'area';
  if ('ratio' in m) return 'ratio';
  return measureKind(p, sub(p, operands(m)[0] as number));
}

/** 화면에 적는 측정값 이름(PF, ∠ABC, PF + PG, |PF − PG|, AD ÷ AB) */
export function measureName(p: ShapeParams, m: ShMeasure): string {
  if ('len' in m) return m.len.join('');
  if ('angle' in m) return `∠${m.angle.join('')}`;
  if ('area' in m) return '넓이';
  const n = operands(m).map((i) => measureName(p, sub(p, i)));
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
    return `angle:${[a, c].sort().join(b)}`;
  }
  if ('area' in m) {
    // 다각형은 어느 꼭짓점부터·어느 방향으로 적어도 같은 모양
    const v = p.polygons[m.area] ?? [];
    const rots = [v, [...v].reverse()].flatMap((w) =>
      w.map((_, i) => [...w.slice(i), ...w.slice(0, i)].join('')),
    );
    return `area:${rots.sort()[0]}`;
  }
  const ks = operands(m).map((i) => measureKey(p, sub(p, i)));
  if ('ratio' in m) return `ratio(${ks.join('/')})`;
  return `${'sum' in m ? 'sum' : 'diff'}(${ks.sort().join(',')})`;
}

/** 측정 글들(화면에 보이는 그대로) */
export function shMeasures(p: ShapeParams, s: ShState): string[] {
  return p.measures.map((m) => {
    const v = measureValue(p, s, m);
    const name = measureName(p, m);
    if (v === null) return `${name} 은 정할 수 없어요`;
    return `${name} ${shown(v, p.digits, measureKind(p, m) === 'angle' ? '°' : '')}`;
  });
}

export const cutArea = (s: ShState, ids: string[]) => shoelace(ids.map((id) => P(s, id)));
