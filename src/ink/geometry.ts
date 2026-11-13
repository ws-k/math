// 필기 계산(순수 함수). 획의 점은 [x, y, t(ms), pressure] 를 이어 붙인 평평한 배열.

export interface WidthOptions {
  /** 기본 굵기(종이 좌표 단위) */
  base: number;
}

const MIN_RATIO = 0.55;
const MAX_RATIO = 1.5;
/** 이 속도(종이 단위/ms)에서 가장 가늘어진다 */
const FAST = 1.6;
const TAPER = 4;

/** 필압이 실제로 변하는가 (0.5·0 고정인 펜은 필압 없음으로 본다) */
export function hasVaryingPressure(pts: ArrayLike<number>): boolean {
  let lo = 1;
  let hi = 0;
  for (let i = 3; i < pts.length; i += 4) {
    const p = pts[i] as number;
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  return hi - lo > 0.05;
}

/**
 * 점마다 굵기. 필압이 없으면 속도로 만든다: 천천히 → 굵게, 빠르게 → 가늘게.
 * 속도는 앞뒤로 부드럽게(지수 평균) 해서 굵기가 튀지 않게 한다.
 */
export function strokeWidths(pts: ArrayLike<number>, opt: WidthOptions): number[] {
  const n = pts.length / 4;
  const out: number[] = new Array(n);
  if (n === 0) return out;
  const usePressure = hasVaryingPressure(pts);
  let v = 0;
  for (let i = 0; i < n; i++) {
    let speed = v;
    if (i > 0) {
      const dx = (pts[i * 4] as number) - (pts[i * 4 - 4] as number);
      const dy = (pts[i * 4 + 1] as number) - (pts[i * 4 - 3] as number);
      const dt = Math.max(1, (pts[i * 4 + 2] as number) - (pts[i * 4 - 2] as number));
      speed = Math.hypot(dx, dy) / dt;
    }
    v = i === 0 ? speed : v * 0.75 + speed * 0.25;
    const k = Math.min(1, v / FAST);
    let ratio = MAX_RATIO - (MAX_RATIO - MIN_RATIO) * Math.sqrt(k);
    if (usePressure) {
      const p = pts[i * 4 + 3] as number;
      ratio = ratio * 0.4 + (MIN_RATIO + (MAX_RATIO - MIN_RATIO) * p) * 0.6;
    }
    out[i] = opt.base * ratio;
  }
  // 시작·끝을 살짝 가늘게
  for (let i = 0; i < Math.min(TAPER, n); i++) {
    const f = 0.55 + 0.45 * (i / TAPER);
    out[i] = (out[i] as number) * f;
    const j = n - 1 - i;
    if (j > i) out[j] = (out[j] as number) * f;
  }
  return out;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** (x, y) 반지름 r 안에 획이 지나가는가 (획 단위 지우개) */
export function strokeHit(pts: ArrayLike<number>, x: number, y: number, r: number): boolean {
  const n = pts.length / 4;
  if (n === 1) return Math.hypot((pts[0] as number) - x, (pts[1] as number) - y) <= r;
  for (let i = 1; i < n; i++) {
    const d = distToSegment(
      x,
      y,
      pts[i * 4 - 4] as number,
      pts[i * 4 - 3] as number,
      pts[i * 4] as number,
      pts[i * 4 + 1] as number,
    );
    if (d <= r) return true;
  }
  return false;
}
