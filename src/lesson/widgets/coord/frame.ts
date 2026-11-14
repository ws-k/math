// 세계 좌표 ↔ 화면 px, 화면 숫자·눈금 글자, 격자. 어떤 객체 종류에도 매이지 않는 그리기 바탕이라
// 아래층에 둔다 — 객체 파일·과제·손 조작이 모두 이 변환을 같이 쓴다.
import type { Axis, Box, CoordParams, Frame, Grid } from './types.ts';

/** 화면 숫자: 자리수만큼, 음수는 진짜 빼기 기호, 정의 안 되면 — */
export function fmtNum(v: number, digits: number): string {
  if (!Number.isFinite(v)) return '—';
  let t = v.toFixed(digits);
  if (digits > 0) t = t.replace(/\.?0+$/, '');
  if (/^-0(\.0*)?$/.test(t)) t = '0';
  return t.replace('-', '−');
}

// ---- 화면 좌표 ----

/** 그림 영역(눈금 글자 자리를 뺀 안쪽) */
export const frame = (b: Box): Frame => ({ l: 34, r: b.w - 14, t: 14, b: b.h - 26 });

export function toPx(p: CoordParams, f: Frame, x: number, y: number): [number, number] {
  return [
    f.l + ((x - p.x.lo) / (p.x.hi - p.x.lo)) * (f.r - f.l),
    f.b - ((y - p.y.lo) / (p.y.hi - p.y.lo)) * (f.b - f.t),
  ];
}
export function toWorld(p: CoordParams, f: Frame, px: number, py: number): [number, number] {
  return [
    p.x.lo + ((px - f.l) / (f.r - f.l)) * (p.x.hi - p.x.lo),
    p.y.lo + ((f.b - py) / (f.b - f.t)) * (p.y.hi - p.y.lo),
  ];
}

/** 끄는 간격의 배수: 한 간격이 minPx 보다 작으면 1·2·5·10… 배로 묶는다(손떨림에 값이 튀지 않게) */
export function snapMult(stepPx: number, minPx: number): number {
  for (const k of [1, 2, 5, 10, 20, 50]) if (stepPx * k >= minPx) return k;
  return 100;
}
/** 곡선 위 점을 끌 때 한 간격의 최소 픽셀 */
export const MIN_SNAP_PX = 8;

export const iRange = (lo: number, hi: number, st: number) => [
  Math.ceil(lo / st - 1e-9),
  Math.floor(hi / st + 1e-9),
];

// ---- 그릴 목록 공용 ----

export const r1 = (v: number) => Math.round(v * 10) / 10;

/** (x0,y0) 를 지나고 기울기 m 인 직선을 그림 영역 가로 끝까지 */
export function fullLine(p: CoordParams, f: Frame, x0: number, y0: number, m: number) {
  const [X1, Y1] = toPx(p, f, p.x.lo, y0 + m * (p.x.lo - x0));
  const [X2, Y2] = toPx(p, f, p.x.hi, y0 + m * (p.x.hi - x0));
  return { x1: r1(X1), y1: r1(Y1), x2: r1(X2), y2: r1(Y2) };
}

export const hidden0 = { x1: 0, y1: 0, x2: 0, y2: 0 };

// ---- 눈금 ----

/** 칸 간격이 π 의 유리수 배인가: 그 배수(분자, 분모) */
function piRatio(step: number): [number, number] | null {
  const r = step / Math.PI;
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(r * d);
    if (n > 0 && Math.abs(r * d - n) < 1e-9) return [n, d];
  }
  return null;
}

const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : Math.abs(a));

/** 칸 번호 k 의 눈금 글자(1/2·π/6·2π 등) */
export function tickText(a: Axis, k: number): string {
  if (k === 0) return '0';
  if (a.exact) {
    const [n, d] = a.exact;
    const num = BigInt(k) * n;
    const g = BigInt(gcdN(Number(num < 0n ? -num : num), Number(d)));
    const nn = num / g;
    const dd = d / g;
    return (dd === 1n ? `${nn}` : `${nn}/${dd}`).replace('-', '−');
  }
  const pr = piRatio(a.st);
  if (!pr) return fmtNum(k * a.st, 2);
  const n = k * pr[0];
  const g = gcdN(Math.abs(n), pr[1]);
  const nn = n / g;
  const dd = pr[1] / g;
  const head = nn === 1 ? 'π' : nn === -1 ? '−π' : `${String(nn).replace('-', '−')}π`;
  return dd === 1 ? head : `${head}/${dd}`;
}

/** 격자선과 눈금 글자(글자는 서로 28px 이상 떨어지게 몇 칸 걸러). 크기에만 달려 끄는 동안 바뀌지 않는다 */
export function grid(p: CoordParams, box: Box): Grid {
  const f = frame(box);
  const make = (a: Axis, len: number, horiz: boolean) => {
    const [k0, k1] = iRange(a.lo, a.hi, a.st) as [number, number];
    const per = (a.st / (a.hi - a.lo)) * len;
    const every = Math.max(1, Math.ceil(28 / per));
    const out: Grid['xs'] = [];
    for (let k = k0; k <= k1; k++) {
      const [X, Y] = horiz ? toPx(p, f, k * a.st, p.y.lo) : toPx(p, f, p.x.lo, k * a.st);
      out.push({
        px: r1(horiz ? X : Y),
        k,
        label: k % every === 0 ? tickText(a, k) : null,
        axis: k === 0,
      });
    }
    return out;
  };
  return { xs: make(p.x, f.r - f.l, true), ys: make(p.y, f.b - f.t, false) };
}
