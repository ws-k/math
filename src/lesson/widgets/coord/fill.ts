// 칠하기 객체 {fill:{top, bottom?, x:[a,b]}, look?, name?, nameAt?, hide?}: 위 경계와 아래 경계(곡선 또는 수평선
// y=값, 아래는 기본 가로축) 사이를 칠한다. 밭·강·길처럼 수학 객체(곡선과 축 사이 영역)가 곧 그림이 되게(원칙 R1).
// 숫자를 보이지 않으므로 검산 항목이 없다 — 넓이 값은 구분구적(rects)·읽는 값이 맡는다.
import { arr, fail, obj, oneOf, optStr } from '../../parse.ts';
import { ID, numExpr } from './common.ts';
import { fAt } from './curve.ts';
import { r1, toPx } from './frame.ts';
import type {
  CoordParams,
  CoordState,
  Edge,
  FillObj,
  Frame,
  KindDef,
  Look,
  ParseCtx,
} from './types.ts';

const LOOKS = ['plain', 'soil', 'water', 'road'] as const satisfies readonly Look[];
/** 이름표 글자 수 상한(그림 안 짧은 이름: 밭·강·길·땅) */
const NAME_MAX = 6;
/** 식 글자로 쓰는 상수 이름 — 곡선 이름과 헷갈리지 않게 */
const CONSTS = new Set(['pi', 'E']);

/** 경계: 앞에 나온 곡선 이름이면 곡선, 아니면 수(수평선 y=값) */
function edge(v: unknown, at: string, cx: ParseCtx): Edge {
  if (typeof v === 'string' && ID.test(v.trim()) && !CONSTS.has(v.trim()))
    return { curve: cx.curveRef(v.trim(), at).id };
  const e = numExpr(v, at);
  return { y: e.src, n: e.n };
}

const edgeY = (p: CoordParams, s: CoordState, e: Edge, x: number) =>
  'curve' in e ? fAt(p, s, e.curve, x) : e.n;

/** 칠할 영역의 꼭짓점(px): 위 경계를 왼쪽 → 오른쪽, 아래 경계를 오른쪽 → 왼쪽. 정의 안 되는 자리는 건너뛴다 */
function polygon(p: CoordParams, s: CoordState, o: FillObj, f: Frame): [number, number][] {
  const n = Math.max(40, Math.round((f.r - f.l) / 3));
  const span = f.b - f.t;
  const xs = Array.from({ length: n + 1 }, (_, k) => o.lo + ((o.hi - o.lo) * k) / n);
  const side = (e: Edge, order: number[]) =>
    order.flatMap((x) => {
      const y = edgeY(p, s, e, x);
      if (!Number.isFinite(y)) return [];
      const [X, Y] = toPx(p, f, x, y);
      // 화면 밖으로 멀리 간 값은 잘라 둔다(잘린 부분은 clipPath 가 가린다) — 곡선 경로와 같은 까닭
      return [[X, Math.max(f.t - span, Math.min(f.b + span, Y))] as [number, number]];
    });
  return [...side(o.top, xs), ...side(o.bottom, [...xs].reverse())];
}

/** 다각형 무게중심(px). 넓이가 거의 0 이면 꼭짓점 평균 */
function centroid(pts: [number, number][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length] as [number, number];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  });
  if (Math.abs(a) < 1e-6) {
    const m = pts.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
    return [m[0] / pts.length, m[1] / pts.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** 이름표 글자(12px)의 세로 가운데를 기준선으로 옮기는 값 */
const TAG_BASELINE = 4;

export const fillKind: KindDef<FillObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['fill'], ['look', 'name', 'nameAt', 'hide']);
    if (c.hide !== undefined && c.hide !== true) fail(`${at} hide`, 'true 만');
    const r = obj(c.fill, `${at} fill`, ['top', 'x'], ['bottom']);
    const [ra, rb] = arr(r.x, `${at} fill.x`, 2, 2);
    const a = numExpr(ra, `${at} fill.x`);
    const b = numExpr(rb, `${at} fill.x`);
    if (!(b.n > a.n)) fail(`${at} fill.x`, '끝이 시작보다 커야 함');
    if (a.n < cx.x.lo - 1e-9 || b.n > cx.x.hi + 1e-9) fail(`${at} fill.x`, '화면 밖');
    const name = optStr(c.name, `${at} name`);
    if (name !== undefined && (!name.trim() || [...name].length > NAME_MAX))
      fail(`${at} name`, `1~${NAME_MAX}자`);
    let nameAt: [number, number] | undefined;
    if (c.nameAt !== undefined) {
      if (name === undefined) fail(`${at} nameAt`, 'name 이 있을 때만');
      const [nx, ny] = arr(c.nameAt, `${at} nameAt`, 2, 2);
      nameAt = [numExpr(nx, `${at} nameAt`).n, numExpr(ny, `${at} nameAt`).n];
    }
    return {
      kind: 'fill',
      top: edge(r.top, `${at} fill.top`, cx),
      bottom: r.bottom === undefined ? { y: '0', n: 0 } : edge(r.bottom, `${at} fill.bottom`, cx),
      from: a.src,
      to: b.src,
      lo: a.n,
      hi: b.n,
      look: c.look === undefined ? 'plain' : oneOf(c.look, `${at} look`, LOOKS),
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(nameAt ? { nameAt } : {}),
      ...(c.hide === true ? { hide: true as const } : {}),
    };
  },
  draw(o, k, { p, s, f, fills, tags }) {
    // 맞힌 뒤 칠하기: 이루기 전에는 경로·이름표 자리를 아예 비운다(숨긴 정답과 같은 규칙 — 자리가 DOM 에 남지 않게)
    const show = !(o.hide && !s.solved);
    const pts = show ? polygon(p, s, o, f) : [];
    const d = pts.length ? `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z` : '';
    fills.push({ t: 'path', key: `f${k}`, d, cls: `fillr ${o.look}`, look: o.look });
    if (!o.name) return;
    const ok = pts.length > 2;
    const [X, Y] = !ok ? [0, 0] : o.nameAt ? toPx(p, f, ...o.nameAt) : centroid(pts);
    tags.push({
      t: 'label',
      key: `n${k}`,
      x: r1(X),
      y: r1(Y + (ok ? TAG_BASELINE : 0)),
      text: o.name,
      hidden: !ok,
      cls: 'tag',
    });
  },
  texts: (o) => (o.name ? [o.name] : []),
};
