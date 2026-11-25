// 곡선(타원·쌍곡선)과 곡선 위 점. 곡선 위 점은 격자점이 아닌 자리(칸 밖 점)를 원 위 점처럼 15° 간격의
// 매개변수 t 로 움직인다: 타원 (a cos t, b sin t), 쌍곡선 (a / cos t, b tan t)(가로로 벌어진 두 갈래).
// 예전에는 곡선 위에 마침 놓인 격자점 몇 곳으로 대신해 '곡선 위가 아닌데 맞았다'고 세는 자리가 생겼다(요청 106·묶음 다).
// 격자 밖으로 나가는 t(쌍곡선 끝 쪽)와 점이 무한히 먼 t(쌍곡선 90°·270°)는 건너뛴다 — 닿는 자리를 처음 상태로 미리 정한다.
import { arr, fail, int, obj } from '../../parse.ts';
import type { ShapeParams, ShCurve, ShState } from './types.ts';

type XY = { x: number; y: number };
export const CURVE_STEP = 15;
const rad = (d: number) => (d * Math.PI) / 180;

export const shapeOf = (cv: ShCurve) => ('ellipse' in cv ? cv.ellipse : cv.hyperbola);

/** 곡선 cv 위 매개변수 deg 의 자리(쌍곡선 90°·270° 는 없음 → null) */
export function curveAt(s: ShState, cv: ShCurve, deg: number): XY | null {
  const { c, a, b } = shapeOf(cv);
  // model.P 를 쓰지 않는다 — model 이 이 파일을 가져와서(서로 가져오면 읽는 차례가 꼬인다)
  const o = s.pts[c] as XY;
  const t = rad(deg);
  if ('ellipse' in cv) return { x: o.x + a * Math.cos(t), y: o.y + b * Math.sin(t) };
  if (deg % 180 === 90) return null;
  return { x: o.x + a / Math.cos(t), y: o.y + b * Math.tan(t) };
}

/** 격자 안에 드는 매개변수들(0°부터 15° 간격). 중심은 고정 점이라 처음 상태로 한 번 정하면 된다 */
export function curveSteps(p: ShapeParams, s: ShState, i: number): number[] {
  const cv = (p.curves ?? [])[i] as ShCurve;
  const out: number[] = [];
  for (let d = 0; d < 360; d += CURVE_STEP) {
    const q = curveAt(s, cv, d);
    if (q && q.x > -1e-9 && q.x < p.grid.w + 1e-9 && q.y > -1e-9 && q.y < p.grid.h + 1e-9)
      out.push(d);
  }
  return out;
}

/** sympy 점 식. o 는 중심 점 식, t 는 도(수 또는 상태 기호) */
export function curveSym(cv: ShCurve, o: string, t: string, num: (v: number) => string): string {
  const { a, b } = shapeOf(cv);
  if ('ellipse' in cv)
    return `Point((${o}).x + ${num(a)}*cos(rad(${t})), (${o}).y + ${num(b)}*sin(rad(${t})))`;
  return `Point((${o}).x + ${num(a)}/cos(rad(${t})), (${o}).y + ${num(b)}*tan(rad(${t})))`;
}

/** 0.5 단위 양수 */
const half = (v: unknown, at: string) => {
  if (typeof v !== 'number' || !Number.isInteger(v * 2) || v < 0.5 || v > 16)
    return fail(at, `0.5~16 사이 0.5 단위 수가 아님 (${String(v)})`);
  return v;
};

/** 곡선 읽기. 중심은 앞에 적은 고정 점(fixed 가 확인) */
export function parseCurves(
  raw: unknown,
  need: (v: unknown, at: string) => string,
  fixed: (id: string, at: string) => string,
): ShCurve[] {
  return arr(raw, '도형판 curves', 1, 2).map((rc, i) => {
    const at = `도형판 곡선${i + 1}`;
    const o = obj(rc, at, [], ['ellipse', 'hyperbola']);
    const kind = o.ellipse !== undefined ? 'ellipse' : 'hyperbola';
    if ((o.ellipse === undefined) === (o.hyperbola === undefined))
      fail(at, 'ellipse 나 hyperbola 중 하나');
    const e = obj(o[kind], `${at} ${kind}`, ['c', 'a', 'b']);
    const shape = {
      c: fixed(need(e.c, `${at} c`), `${at} c`),
      a: half(e.a, `${at} a`),
      b: half(e.b, `${at} b`),
    };
    return kind === 'ellipse' ? { ellipse: shape } : { hyperbola: shape };
  });
}

/** 형식 검사(곡선과 그 위 점을 다 읽은 뒤): 타원은 격자 안에, 곡선 위 점의 처음 자리는 닿는 자리 중 하나 */
export function checkCurves(p: ShapeParams, s: ShState) {
  (p.curves ?? []).forEach((cv, i) => {
    if (!('ellipse' in cv)) return;
    const { c, a, b } = cv.ellipse;
    const o = s.pts[c] as XY;
    if (o.x - a < 0 || o.x + a > p.grid.w || o.y - b < 0 || o.y + b > p.grid.h)
      fail(`도형판 곡선${i + 1}`, '타원이 격자 밖으로 나감 — 중심이나 a·b 를 바꾸세요');
  });
  for (const pt of p.points) {
    if (!pt.on || !('curve' in pt.on)) continue;
    const at = `도형판 ${pt.id}`;
    const i = int(pt.on.curve, `${at} on.curve`, 0, (p.curves?.length ?? 0) - 1);
    const steps = curveSteps(p, s, i);
    if (!steps.includes(pt.deg as number))
      fail(`${at} deg`, `곡선 위 격자 안 자리가 아님(${steps.join('·')}° 중 하나)`);
    // 끌어도 제자리인 손잡이는 뜻 없는 끌기(원칙 P1)
    if (pt.drag && steps.length < 2)
      fail(
        at,
        '곡선 위에서 격자 안에 닿는 자리가 하나뿐이라 움직일 곳이 없음 — 곡선이나 격자를 바꾸세요',
      );
  }
}
