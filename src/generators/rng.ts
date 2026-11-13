// 시드가 같으면 항상 같은 문제가 나오도록 하는 작은 난수 생성기 (mulberry32).

export interface Rng {
  /** 0 이상 1 미만 */
  next(): number;
  /** lo 이상 hi 이하 정수 */
  int(lo: number, hi: number): number;
  pick<T>(arr: readonly T[]): T;
  /** 0 이 아닌 정수 (lo..hi 범위에서 0 제외) */
  nonzero(lo: number, hi: number): number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick: 빈 배열');
      return arr[int(0, arr.length - 1)] as (typeof arr)[number];
    },
    nonzero: (lo, hi) => {
      for (;;) {
        const v = int(lo, hi);
        if (v !== 0) return v;
      }
    },
  };
}
