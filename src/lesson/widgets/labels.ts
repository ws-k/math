// 점 이름표 자리 고르기(순수). 좌표평면·도형판이 같이 쓴다.
// 이름표를 늘 점의 오른쪽 위에 두면 두 점이 가까울 때 글자가 겹치고(삼각형의 P 가 C 에 닿을 때),
// 그림 맨 위의 점은 이름표가 그림 밖으로 나가 잘린다. 그래서 오른쪽 위 → 왼쪽 위 → 오른쪽 아래 → 왼쪽 아래 →
// 위 → 아래 차례로 놓아 보고, 그림 안에 들면서 앞서 놓은 이름표·다른 점과 겹치지 않는 첫 자리를 쓴다.
// 끄는 동안 매 프레임 부르므로(이름표도 같이 움직인다) 점 몇 개짜리 간단한 셈으로 둔다.

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface LabelOpts {
  /** 글자 한 자 폭·이름표 높이(px) */
  charW: number;
  h: number;
  /** 점 가운데에서 이름표 상자까지 가로·세로 틈 */
  gx: number;
  gy: number;
  /** 피할 점의 반지름(점 자리를 이만큼 넓혀 겹침을 본다) */
  dotR: number;
}

const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const inside = (a: Rect, o: Rect) => a.l >= o.l && a.r <= o.r && a.t >= o.t && a.b <= o.b;

/**
 * 점마다 이름표 상자(왼쪽 위 꼭짓점과 폭·높이)를 고른다. pins 의 차례대로 놓는다 — 앞 이름표가 먼저 자리를 잡는다.
 * dots 는 피할 점들(이름표의 제 점도 들어 있어도 된다: 후보 자리는 모두 제 점에서 틈만큼 떨어져 있다).
 */
export function placeLabels(
  pins: readonly { x: number; y: number; n: number }[],
  dots: readonly { x: number; y: number }[],
  bounds: Rect,
  o: LabelOpts,
): Rect[] {
  const placed: Rect[] = [];
  const dotBox = dots.map((d) => ({
    l: d.x - o.dotR,
    t: d.y - o.dotR,
    r: d.x + o.dotR,
    b: d.y + o.dotR,
  }));
  for (const p of pins) {
    const w = o.charW * p.n;
    const xs = { e: p.x + o.gx, w: p.x - o.gx - w, c: p.x - w / 2 };
    const ys = { n: p.y - o.gy - o.h, s: p.y + o.gy };
    const cands: Rect[] = (
      [
        [xs.e, ys.n],
        [xs.w, ys.n],
        [xs.e, ys.s],
        [xs.w, ys.s],
        [xs.c, ys.n - 2],
        [xs.c, ys.s + 2],
      ] as const
    ).map(([l, t]) => ({ l, t, r: l + w, b: t + o.h }));
    const ok = (c: Rect, dotsToo: boolean) =>
      inside(c, bounds) &&
      !placed.some((q) => hit(c, q)) &&
      !(dotsToo && dotBox.some((d) => hit(c, d)));
    const pick =
      cands.find((c) => ok(c, true)) ??
      cands.find((c) => ok(c, false)) ??
      cands.find((c) => inside(c, bounds)) ??
      (cands[0] as Rect);
    placed.push(pick);
  }
  return placed;
}
