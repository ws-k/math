// 도형판 파일들이 같이 쓰는 작은 셈. 한곳에 두어 같은 셈이 파일마다 조금씩 달라지지 않게 한다(리뷰 Minor 8).
// model·measure 를 가져오지 않는다 — curve.ts(model 이 가져오는 파일)도 이것을 쓰므로 서로 가져오는 고리가 생긴다.
import { fail } from '../../parse.ts';
import { reduce } from '../../sym.ts';
import { ratStr } from '../q.ts';
import { areaOf } from './geom.ts';

export const rad = (d: number) => (d * Math.PI) / 180;

/** 0.5 단위 양수(반지름 2.5·곡선 반지름 3.5) — 그보다 잘게 나누면 격자에서 눈으로 읽을 수 없다 */
export function half(v: unknown, at: string, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v * 2) || v < 0.5 || v > max)
    return fail(at, `0.5~${max} 사이 0.5 단위 수가 아님 (${String(v)})`);
  return v;
}

/** 격자점 다각형 넓이의 정확한 분수(2배 넓이는 정수) */
export const latticeArea = (ps: { x: number; y: number }[]) =>
  ratStr(reduce(BigInt(Math.round(areaOf(ps) * 2)), 2n));

/** 다각형 넓이의 sympy 식(꼭짓점 식들로, 신발끈 공식) */
export const shoelaceSym = (ps: string[]) =>
  `Abs(${ps
    .map((a, i) => {
      const b = ps[(i + 1) % ps.length];
      return `(${a}).x*(${b}).y - (${b}).x*(${a}).y`;
    })
    .join(' + ')})/2`;
