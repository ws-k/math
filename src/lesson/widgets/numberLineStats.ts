// 수직선 자료 점의 통계(순수): 평균·중앙값·분산·표준편차, 점 무게(값마다 개수).
// 분수로 정확히 센다 — 화면 글자가 '약'을 붙일지(정확히 떨어지는지)를 반올림 전에 알아야 하고, 검산(sympy)과
// 한 자리도 어긋나지 않게 하려고. 표준편차만 제곱근이라 제곱수가 아니면 부동소수로 근삿값을 낸다(검산은 approx).
import { add, cmp, div, mul, num, type Q, qi, sub } from './q.ts';

export interface Stats {
  mean: Q;
  median: Q;
  /** 분산(모분산 — 편차 제곱의 평균, 중학교 정의) */
  var: Q;
  /** 표준편차. 분산이 분수의 제곱이면 정확한 분수, 아니면 null(근삿값은 sdNum) */
  sd: Q | null;
  sdNum: number;
}

/** 값마다 개수(무게). 무게가 없으면 모두 1 */
export function statsOf(values: Q[], weights?: number[]): Stats {
  const ws = values.map((_, i) => BigInt(weights?.[i] ?? 1));
  const n = ws.reduce((a, b) => a + b, 0n);
  const total = values.reduce((acc, v, i) => add(acc, mul(v, [ws[i] as bigint, 1n])), qi(0));
  const mean = div(total, [n, 1n]);
  // 중앙값: 개수만큼 늘어놓은 것의 가운데(값 순서대로 누적 개수로 찾는다 — 999개를 실제로 펼치지 않는다)
  const order = values.map((v, i) => [v, ws[i] as bigint] as const).sort((a, b) => cmp(a[0], b[0]));
  const nth = (k: bigint): Q => {
    let seen = 0n;
    for (const [v, w] of order) {
      seen += w;
      if (k < seen) return v;
    }
    return order.at(-1)?.[0] ?? qi(0);
  };
  const median = div(add(nth((n - 1n) / 2n), nth(n / 2n)), qi(2));
  const sq = values.reduce((acc, v, i) => {
    const d = sub(v, mean);
    return add(acc, mul(mul(d, d), [ws[i] as bigint, 1n]));
  }, qi(0));
  const vr = div(sq, [n, 1n]);
  return { mean, median, var: vr, sd: sqrtQ(vr), sdNum: Math.sqrt(num(vr)) };
}

function isqrt(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // 큰 수에서 부동소수 어림이 한두 칸 어긋날 수 있어 맞춘다
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x * x === n ? x : null;
}
/** 기약분수의 제곱근이 분수면 그 값, 아니면 null */
export function sqrtQ([a, b]: Q): Q | null {
  const ra = isqrt(a);
  const rb = isqrt(b);
  return ra === null || rb === null ? null : [ra, rb];
}
