// 다각형 셈(순수): 모양의 열쇠·겹친 넓이. 조각 채우기(piece.ts)의 형식 검사가 쓴다 — 조각 목표 자리가 서로
// 겹치거나 빈 틀 밖으로 나가면 '다 채웠다'가 틀을 채운 것이 아니게 된다(리뷰 M3).
type XY = { x: number; y: number };

/**
 * 다각형 모양의 열쇠: 둘레를 도는 꼭짓점 차례를 어느 꼭짓점부터·어느 방향으로 적어도 같은 글자.
 * 꼭짓점 모음만 견주면 모음이 같은 거울상(뒤집은 모양)이 같다고 나온다(리뷰 Minor 1).
 */
export function polyKey(ps: XY[]): string {
  const ids = ps.map((q) => `${q.x},${q.y}`);
  const runs = [ids, [...ids].reverse()].flatMap((w) =>
    w.map((_, i) => [...w.slice(i), ...w.slice(0, i)].join(' ')),
  );
  return runs.sort()[0] as string;
}

const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const signedArea = (ps: XY[]) =>
  ps.reduce((t, a, i) => {
    const b = ps[(i + 1) % ps.length] as XY;
    return t + a.x * b.y - b.x * a.y;
  }, 0) / 2;

/** 점 q 가 삼각형 abc(시계 반대 방향) 안 또는 변 위 */
const inTri = (q: XY, a: XY, b: XY, c: XY) =>
  cross(a, b, q) >= 0 && cross(b, c, q) >= 0 && cross(c, a, q) >= 0;

/** 단순 다각형을 삼각형들로(귀 자르기). 꼭짓점이 일직선인 곳은 넘긴다 */
export function triangulate(ps: XY[]): [XY, XY, XY][] {
  let v = signedArea(ps) < 0 ? [...ps].reverse() : [...ps];
  const out: [XY, XY, XY][] = [];
  let guard = 0;
  while (v.length > 3 && guard++ < 1000) {
    let cut = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i + v.length - 1) % v.length] as XY;
      const b = v[i] as XY;
      const c = v[(i + 1) % v.length] as XY;
      const turn = cross(a, b, c);
      if (turn < 0) continue;
      if (turn === 0) {
        v = v.filter((_, j) => j !== i);
        cut = true;
        break;
      }
      if (v.some((q) => q !== a && q !== b && q !== c && inTri(q, a, b, c))) continue;
      out.push([a, b, c]);
      v = v.filter((_, j) => j !== i);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (v.length === 3 && cross(v[0] as XY, v[1] as XY, v[2] as XY) !== 0)
    out.push([v[0], v[1], v[2]] as [XY, XY, XY]);
  return out;
}

/** 볼록 다각형 a 를 볼록 다각형 b(시계 반대 방향) 안쪽으로 자른 것(서덜랜드–호지먼) */
function clip(a: XY[], b: XY[]): XY[] {
  let out = a;
  for (let i = 0; i < b.length && out.length; i++) {
    const p = b[i] as XY;
    const q = b[(i + 1) % b.length] as XY;
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const c = inp[j] as XY;
      const d = inp[(j + 1) % inp.length] as XY;
      const cin = cross(p, q, c) >= 0;
      const din = cross(p, q, d) >= 0;
      if (cin) out.push(c);
      if (cin !== din) {
        const t = cross(p, q, c) / (cross(p, q, c) - cross(p, q, d));
        out.push({ x: c.x + t * (d.x - c.x), y: c.y + t * (d.y - c.y) });
      }
    }
  }
  return out;
}

/** 두 단순 다각형이 겹친 넓이(변·꼭짓점만 닿으면 0) */
export function overlapArea(a: XY[], b: XY[]): number {
  let t = 0;
  for (const ta of triangulate(a))
    for (const tb of triangulate(b)) {
      const c = clip(ta, tb);
      if (c.length >= 3) t += Math.abs(signedArea(c));
    }
  return t;
}

export const areaOf = (ps: XY[]) => Math.abs(signedArea(ps));
