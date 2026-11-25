// 보이는 것 더하기(그릴 목록의 일부): 점선·연장선, 원 위 호, 각 호·직각 네모, 그림 위 값(tag).
// 모두 상태에서 다시 계산하는 표시라 끄는 동안 applyDrawing 이 그대로 따라 고친다(키는 늘 그대로, 안 보이면 visibility).
import { type Mark, r2 } from '../draw.ts';
import { ccwAngle, measureValue, round, unitText } from './measure.ts';
import { P, shGeom, X, Y } from './model.ts';
import type { ShapeParams, ShMeasure, ShState } from './types.ts';

type XY = { x: number; y: number };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
/** 화면 좌표의 점 */
const scr = (p: ShapeParams, q: XY) => ({ x: X(p, q.x), y: Y(p, q.y) });
/** 화면에서 점 o 로부터 (수학 방향의) 각 t° 로 d 만큼 — 화면 y 는 아래로 자라 sin 을 뺀다 */
const polar = (o: XY, t: number, d: number) => ({
  x: r2(o.x + d * Math.cos(rad(t))),
  y: r2(o.y - d * Math.sin(rad(t))),
});
/** 수학 방향의 각(도): 점 o 에서 q 쪽 */
const dirOf = (o: XY, q: XY) => deg(Math.atan2(q.y - o.y, q.x - o.x));
const HIDE = { visibility: 'hidden' } as const;

/**
 * 원호 path. 시작 각 t0 에서 시계 반대 방향으로 sweep 도. 화면은 y 가 뒤집혀 수학의 시계 반대 방향이 SVG 의
 * 음의 방향(sweep-flag 0)이다.
 */
function arcPath(o: XY, r: number, t0: number, sweep: number) {
  const a = polar(o, t0, r);
  const b = polar(o, t0 + sweep, r);
  return `M ${a.x} ${a.y} A ${r2(r)} ${r2(r)} 0 ${sweep > 180 ? 1 : 0} 0 ${b.x} ${b.y}`;
}

/** 선분 하나: 점선이면 class 에 dash, 연장선이면 격자 테두리까지 늘인 직선(두 점이 겹치면 숨김) */
export function segMark(p: ShapeParams, s: ShState, i: number, a: string, b: string): Mark {
  const st = p.segStyle?.[i];
  const A = P(s, a);
  const B = P(s, b);
  const cls = st?.dash ? 'sh-seg dash' : 'sh-seg';
  if (!st?.extend) {
    return {
      k: `seg${i}`,
      tag: 'line',
      a: { x1: X(p, A.x), y1: Y(p, A.y), x2: X(p, B.x), y2: Y(p, B.y), class: cls },
    };
  }
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  if (Math.hypot(dx, dy) < 1e-12)
    return { k: `seg${i}`, tag: 'line', a: { x1: 0, y1: 0, x2: 0, y2: 0, class: cls, ...HIDE } };
  // 직선 A + t·(B−A) 가 격자 상자 [0,w]×[0,h] 안에 드는 t 범위(리앙-바스키 자르기)
  let lo = Number.NEGATIVE_INFINITY;
  let hi = Number.POSITIVE_INFINITY;
  for (const [d, q, max] of [
    [dx, A.x, p.grid.w],
    [dy, A.y, p.grid.h],
  ] as const) {
    if (Math.abs(d) < 1e-12) continue;
    const t1 = (0 - q) / d;
    const t2 = (max - q) / d;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  }
  const E = { x: A.x + lo * dx, y: A.y + lo * dy };
  const F = { x: A.x + hi * dx, y: A.y + hi * dy };
  return {
    k: `seg${i}`,
    tag: 'line',
    a: {
      x1: X(p, E.x),
      y1: Y(p, E.y),
      x2: X(p, F.x),
      y2: Y(p, F.y),
      class: cls,
      visibility: 'visible',
    },
  };
}

/** 원 위 호: 중심 c, 반지름 |c from|, from 에서 to 까지 시계 반대 방향 */
export function arcMarks(p: ShapeParams, s: ShState): Mark[] {
  const u = shGeom(p).u;
  return (p.arcs ?? []).map((a, i) => {
    const O = P(s, a.c);
    const F = P(s, a.from);
    const sweep = ccwAngle(F, O, P(s, a.to));
    const r = Math.hypot(F.x - O.x, F.y - O.y) * u;
    if (sweep === null || r < 1e-9)
      return { k: `arc${i}`, tag: 'path', a: { d: 'M 0 0', class: 'sh-arc', ...HIDE } };
    return {
      k: `arc${i}`,
      tag: 'path',
      a: { d: arcPath(scr(p, O), r, dirOf(O, F), sweep), class: 'sh-arc', visibility: 'visible' },
    };
  });
}

/** 각 표시 반지름(px): 호 16, 직각 네모 한 변 11 — 격자 한 칸(가장 작게 13.75px)보다 크지 않게 */
const ARC_R = 16;
const RIGHT = 11;

/**
 * 각 표시(mark: true): 호와 직각 네모를 둘 다 두고 하나만 보인다(키가 늘 있어야 끄는 동안 바꿔 보일 수 있다).
 * 작은 쪽 각은 두 변 사이 180° 이하 쪽, ccw 각은 A 에서 시계 반대 방향 쪽(오목각이면 큰 호).
 */
export function angleMarks(p: ShapeParams, s: ShState): Mark[] {
  const out: Mark[] = [];
  p.measures.forEach((m, i) => {
    if (!('angle' in m) || !m.mark) return;
    const [A, B, C] = m.angle.map((id) => P(s, id)) as [XY, XY, XY];
    const ccw = ccwAngle(A, B, C);
    const v = measureValue(p, s, m);
    const o = scr(p, B);
    let arc: Mark['a'] = { d: 'M 0 0', class: 'sh-angle', ...HIDE };
    let box: Mark['a'] = { d: 'M 0 0', class: 'sh-angle', ...HIDE };
    if (ccw !== null && v !== null) {
      // 작은 쪽 각이 시계 방향이면 C 에서 시작해 A 로
      const start = m.ccw || ccw <= 180 ? dirOf(B, A) : dirOf(B, C);
      if (Math.abs(v - 90) < 1e-9) {
        const a = polar(o, start, RIGHT);
        const c = polar(o, start + 90, RIGHT);
        const d = polar(o, start + 45, RIGHT * Math.SQRT2);
        box = {
          d: `M ${a.x} ${a.y} L ${d.x} ${d.y} L ${c.x} ${c.y}`,
          class: 'sh-angle',
          visibility: 'visible',
        };
      } else if (v > 1e-9)
        arc = { d: arcPath(o, ARC_R, start, v), class: 'sh-angle', visibility: 'visible' };
    }
    out.push({ k: `ang${i}`, tag: 'path', a: arc }, { k: `rt${i}`, tag: 'path', a: box });
  });
  return out;
}

/** 그림 위 값(tag): 값과 단위만(이름은 아래 읽는 줄에 있다) */
export function tagMarks(p: ShapeParams, s: ShState): Mark[] {
  const shownPts = p.points.filter((pt) => !pt.aux).map((pt) => scr(p, P(s, pt.id)));
  // 그림의 가운데(보이는 점들의 평균) — 변의 값을 그림 바깥쪽에 두려고
  const mid = shownPts.length
    ? {
        x: shownPts.reduce((t, q) => t + q.x, 0) / shownPts.length,
        y: shownPts.reduce((t, q) => t + q.y, 0) / shownPts.length,
      }
    : { x: 0, y: 0 };
  const out: Mark[] = [];
  p.measures.forEach((m, i) => {
    if (!m.tag) return;
    const v = measureValue(p, s, m);
    const at = v === null ? null : tagAt(p, s, m, mid);
    const text = v === null ? '' : `${round(v, p.digits).s.replace('-', '−')}${unitText(p, m)}`;
    out.push({
      k: `tag${i}`,
      tag: 'text',
      // 글자 기준선이 아래쪽이라 가운데로 보이게 4px 내린다
      a: at
        ? { x: r2(at.x), y: r2(at.y + 4), class: 'sh-tag', visibility: 'visible' }
        : { x: 0, y: 0, class: 'sh-tag', ...HIDE },
      text,
    });
  });
  return out;
}

const OUT = 13;

function tagAt(p: ShapeParams, s: ShState, m: ShMeasure, mid: XY): XY | null {
  if ('len' in m) {
    const a = scr(p, P(s, m.len[0]));
    const b = scr(p, P(s, m.len[1]));
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1e-9) return c;
    // 변에 수직인 두 방향 중 그림 가운데에서 먼 쪽
    let n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    if ((c.x - mid.x) * n.x + (c.y - mid.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    return { x: c.x + n.x * OUT, y: c.y + n.y * OUT };
  }
  if ('area' in m) {
    const ps = (p.polygons[m.area] ?? []).map((id) => scr(p, P(s, id)));
    return {
      x: ps.reduce((t, q) => t + q.x, 0) / ps.length,
      y: ps.reduce((t, q) => t + q.y, 0) / ps.length,
    };
  }
  if ('angle' in m) {
    const [A, B, C] = m.angle.map((id) => P(s, id)) as [XY, XY, XY];
    const ccw = ccwAngle(A, B, C);
    if (ccw === null) return null;
    const v = m.ccw ? ccw : Math.min(ccw, 360 - ccw);
    const start = m.ccw || ccw <= 180 ? dirOf(B, A) : dirOf(B, C);
    return polar(scr(p, B), start + v / 2, ARC_R + 16);
  }
  if ('arc' in m) {
    const a = (p.arcs ?? [])[m.arc];
    if (!a) return null;
    const O = P(s, a.c);
    const F = P(s, a.from);
    const sweep = ccwAngle(F, O, P(s, a.to));
    if (sweep === null) return null;
    const r = Math.hypot(F.x - O.x, F.y - O.y) * shGeom(p).u;
    return polar(scr(p, O), dirOf(O, F) + sweep / 2, r + OUT + 2);
  }
  return null;
}
