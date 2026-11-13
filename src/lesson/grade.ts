// 좌표평면 찍기·그리기 채점(순수). 화면(Coord.tsx)이 손을 뗀 결과를 넘기면 맞았는지와 그 까닭을 돌려준다.
// 점은 격자 칸 번호(정수)로 다룬다 — 화면 픽셀이나 부동소수 좌표로 비교하면 0.1+0.2 같은 찌꺼기로
// 맞는 답이 틀린다. 직선은 칸 번호 × 칸 간격(유리수)으로 기울기를 분수로 정확히 구해 answer.ts 로 비교한다.
// 곡선 위인지(y = f(x))만 sin·√ 같은 무리수가 나와 상대오차로 본다.
import { compareAnswer } from '../lib/answer.ts';
import { type Rational, ratStr, reduce } from './sym.ts';

export interface GridPt {
  i: number;
  j: number;
}

/** f(x) 비교: 상대오차 1e-9(0 근처는 절대오차) */
export const closeTo = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/** 점 하나 찍기: 하나만 찍었고 칸 번호가 같아야 */
export function gradePoint(user: GridPt[], target: GridPt) {
  const p = user[0];
  return { ok: user.length === 1 && !!p && p.i === target.i && p.j === target.j };
}

/** 곡선 위 점 k개(점 잇기도 같다): 모든 점이 곡선 위, x 가 겹치지 않고, k개 이상 */
export function gradePointsOn(user: GridPt[], onCurve: (p: GridPt) => boolean, count: number) {
  const on = user.filter(onCurve).length;
  const dupX = new Set(user.map((p) => p.i)).size !== user.length;
  return { ok: !dupX && on === user.length && on >= count, on, dupX, total: user.length };
}

export interface LineTarget {
  slope?: string;
  through?: [string, string];
  intercept?: string;
}

const mul = (a: Rational, b: Rational) => reduce(a[0] * b[0], a[1] * b[1]);
const sub = (a: Rational, b: Rational) => reduce(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const div = (a: Rational, b: Rational) => reduce(a[0] * b[1], a[1] * b[0]);
const int = (n: number): Rational => [BigInt(n), 1n];
const same = (a: Rational, s: string) => compareAnswer(ratStr(a), s, 'fraction') === 'correct';

/** 분수 글자 → Rational (형식 검사를 거친 "a/b"·정수) */
function rat(s: string): Rational {
  const [n, d = '1'] = s.split('/');
  return reduce(BigInt(n as string), BigInt(d));
}

/**
 * 두 손잡이(칸 번호)로 그린 직선. sx·sy 는 칸 간격(유리수). 조건마다 맞았는지를 따로 돌려줘
 * 화면이 "기울기는 맞고 점을 안 지나요" 처럼 알려 줄 수 있게 한다.
 */
export function gradeLine(a: GridPt, b: GridPt, sx: Rational, sy: Rational, t: LineTarget) {
  const x1 = mul(int(a.i), sx);
  const y1 = mul(int(a.j), sy);
  const x2 = mul(int(b.i), sx);
  const y2 = mul(int(b.j), sy);
  if (a.i === b.i)
    return { ok: false, vertical: true, slope: null, slopeOk: false, throughOk: false };
  const m = div(sub(y2, y1), sub(x2, x1));
  const slopeOk = t.slope === undefined || same(m, t.slope);
  let throughOk = true;
  if (t.through) {
    // 점 P 가 직선 위: yP − y1 = m(xP − x1)
    const [px, py] = t.through.map(rat) as [Rational, Rational];
    throughOk = same(sub(py, y1), ratStr(mul(m, sub(px, x1))));
  }
  const interceptOk = t.intercept === undefined || same(sub(y1, mul(m, x1)), t.intercept);
  return {
    ok: slopeOk && throughOk && interceptOk,
    vertical: false,
    slope: ratStr(m),
    slopeOk,
    throughOk,
    interceptOk,
  };
}

/** 곡선 긋기 통과 문턱: 덮은 표본 가운데 허용 오차 안 비율, x 범위를 덮은 비율. 실기기에서 조정한다 */
export const SKETCH_HIT = 0.85;
export const SKETCH_COVER = 0.8;
const SKETCH_N = 21;

/**
 * 손으로 그은 선(세계 좌표 점들)을 x 표본 21곳에서 곡선과 견준다. 표본 x 를 지나는 선분이 있으면 그곳의
 * y(여러 번 지나면 곡선에 가장 가까운 것)를 쓴다. 덮은 비율과 허용 오차 안 비율이 둘 다 문턱을 넘어야 통과.
 */
export function gradeSketch(
  stroke: [number, number][],
  f: (x: number) => number,
  x0: number,
  x1: number,
  tol: number,
) {
  let covered = 0;
  let hits = 0;
  for (let k = 0; k < SKETCH_N; k++) {
    const x = x0 + ((x1 - x0) * k) / (SKETCH_N - 1);
    const fx = f(x);
    let best: number | null = null;
    for (let s = 0; s + 1 < stroke.length; s++) {
      const [ax, ay] = stroke[s] as [number, number];
      const [bx, by] = stroke[s + 1] as [number, number];
      const lo = Math.min(ax, bx);
      const hi = Math.max(ax, bx);
      if (x < lo || x > hi) continue;
      const y = ax === bx ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax);
      if (best === null || Math.abs(y - fx) < Math.abs(best - fx)) best = y;
    }
    if (best === null) continue;
    covered++;
    if (Math.abs(best - fx) <= tol) hits++;
  }
  const coverage = covered / SKETCH_N;
  const within = covered ? hits / covered : 0;
  return { ok: coverage >= SKETCH_COVER && within >= SKETCH_HIT, coverage, within };
}
