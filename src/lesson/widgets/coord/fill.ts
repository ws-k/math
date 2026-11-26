// 칠하기 객체 {id?, fill:{top, bottom?, x:[a, b 또는 점]}, look?, sign?, name?, nameAt?, hide?}: 위 경계와 아래 경계
// (곡선 또는 수평선 y=값, 아래는 기본 가로축) 사이를 칠한다. 밭·강·길처럼 수학 객체(곡선과 축 사이 영역)가 곧 그림이
// 되게(원칙 R1).
// - 오른쪽 끝을 끄는 점으로 두면 그 점의 x 까지 칠한다(산책: 시각을 끌면 그때까지 걸은 만큼).
// - sign 이면 위 경계가 아래보다 위인 곳·아래인 곳을 다른 색으로 — 속도의 부호(가는 쪽·오는 쪽)가 색으로 보이게.
// - id 가 있으면 읽는 값 net(부호 있는 합)·abs(부호 뗀 합)가 이 영역을 가리킨다. 그때만 합을 분수로 정확히 내려고
//   위−아래가 다항식인지, 부호가 바뀌는 곳이 모두 유리수인지 형식 검사에서 본다(검산 항목도 그 읽는 값이 낸다).
import { exactOf, varsOf } from '../../expr.ts';
import { arr, fail, obj, oneOf, optStr } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { add, cmp, mul, neg, qi, sub } from '../q.ts';
import { ID, numExpr } from './common.ts';
import { fAt, wholeCurve } from './curve.ts';
import { clampY, r1, toPx } from './frame.ts';
import { noFollow, pointOf, pointQ, pointXY, xCells } from './point.ts';
import { polyIntegral, polyOf, rationalRoots, rootsBetween } from './poly.ts';
import type {
  Axis,
  CoordParams,
  CoordState,
  Edge,
  FillArea,
  FillObj,
  Frame,
  KindDef,
  Look,
  ParseCtx,
  PointObj,
} from './types.ts';

const LOOKS = ['plain', 'soil', 'water', 'road'] as const satisfies readonly Look[];
/** 이름표 글자 수 상한(그림 안 짧은 이름: 밭·강·길·땅) */
const NAME_MAX = 6;
/** 식 글자로 쓰는 상수 이름 — 곡선 이름과 헷갈리지 않게 */
const CONSTS = new Set(['pi', 'E']);
const Z: Rational = [0n, 1n];

const isName = (v: unknown): v is string =>
  typeof v === 'string' && ID.test(v.trim()) && !CONSTS.has(v.trim());

/** 경계 하나: 그리기용 Edge 와, 합을 정확히 낼 때 쓰는 다항식·sympy 글자 */
interface EdgeIn {
  e: Edge;
  src: string;
  /** x 의 다항식(분수 계수). 다항식이 아니면 null, 슬라이더를 쓰면 'slider' */
  poly: Rational[] | null | 'slider';
}

/** 경계: 앞에 나온 곡선 이름이면 곡선, 아니면 수(수평선 y=값) */
function edge(v: unknown, at: string, cx: ParseCtx): EdgeIn {
  if (isName(v)) {
    const c = wholeCurve(cx.curveRef(v.trim(), at), at, '칠하기 경계');
    const slider = [...varsOf(c.node)].some((n) => n !== 'x');
    return { e: { curve: c.id }, src: c.expr, poly: slider ? 'slider' : polyOf(c.node, {}) };
  }
  const n = numExpr(v, at);
  const q = exactOf(n.src);
  return { e: { n: n.n }, src: n.src, poly: q ? (q[0] === 0n ? [] : [q]) : null };
}

const edgeY = (p: CoordParams, s: CoordState, e: Edge, x: number) =>
  'curve' in e ? fAt(p, s, e.curve, x) : e.n;

/** 끝 점이 닿는 x 칸(번호)과 그 간격. 끄는 점은 점의 칸 전부(xCells), 끌 수 없는 점은 제자리 한 칸 */
function endCells(pt: PointObj, axis: Axis) {
  const c = xCells(axis, pt);
  return pt.drag === 'none' ? { ...c, i0: pt.i, i1: pt.i } : c;
}

/** 합을 분수로 정확히 낼 준비(id 가 있는 칠하기만). 안 되면 형식 오류 */
function parseArea(
  at: string,
  top: EdgeIn,
  bottom: EdgeIn,
  aSrc: string,
  bSrc: string | null,
  bMax: Rational | null,
): FillArea {
  for (const [w, e] of [
    ['top', top],
    ['bottom', bottom],
  ] as const) {
    if (e.poly === 'slider')
      fail(`${at} fill.${w}`, '넓이를 읽는 칠하기의 경계에는 슬라이더를 쓰지 않음');
    if (e.poly === null)
      fail(
        `${at} fill.${w}`,
        `넓이를 읽는 칠하기의 경계가 x 의 다항식이 아님(${e.src}) — 합을 분수로 정확히 낼 수 없음`,
      );
  }
  const tp = top.poly as Rational[];
  const bp = bottom.poly as Rational[];
  const diff = Array.from({ length: Math.max(tp.length, bp.length) }, (_, i) =>
    sub(tp[i] ?? Z, bp[i] ?? Z),
  );
  const a = exactOf(aSrc);
  if (!a) return fail(`${at} fill.x`, '넓이를 읽는 칠하기의 시작은 유리수');
  if (!bMax) return fail(`${at} fill.x`, '넓이를 읽는 칠하기의 끝은 유리수(끝 점의 끄는 간격도)');
  let cuts: Rational[] = [];
  if (cmp(bMax, a) > 0) {
    const all = rationalRoots(diff);
    const n = rootsBetween(diff, a, bMax);
    // 0 인 다항식(위 = 아래)은 넓이가 늘 0 — 끊을 곳이 없다
    if (n !== null) {
      if (!all) return fail(at, `위−아래의 계수가 너무 커서 부호가 바뀌는 곳을 찾을 수 없음`);
      cuts = all.filter((r) => cmp(r, a) > 0 && cmp(r, bMax) < 0);
      if (cuts.length !== n)
        fail(
          at,
          `위−아래가 구간 안 무리수 근에서 부호가 바뀜(구간 안 근 ${n}곳 중 유리수 ${cuts.length}곳) — 부호 뗀 합을 분수로 끊을 수 없음(곡선·구간을 바꾸세요)`,
        );
    }
  }
  return {
    diff,
    diffSrc: `(${top.src})-(${bottom.src})`,
    a,
    aSrc,
    b: bSrc === null ? null : bMax,
    bSrc,
    cuts,
  };
}

/** 지금 칠하는 오른쪽 끝(점을 따라가면 그 점의 x) */
const endX = (p: CoordParams, s: CoordState, o: FillObj) =>
  o.toPt ? pointXY(p, s, o.toPt)[0] : o.hi;

/**
 * 끝 b 까지 칠한 영역의 합(정확한 분수): 부호 있는 합과 부호 뗀 합(부호가 바뀌는 곳에서 끊어 조각마다 부호를 떼고 더함).
 * 끝이 시작 이하면 둘 다 0(아직 칠한 곳이 없음).
 */
export function fillSumsAt(o: FillObj, b: Rational): { net: Rational; abs: Rational } {
  const ar = o.area as FillArea;
  if (cmp(b, ar.a) <= 0) return { net: Z, abs: Z };
  const pts = [ar.a, ...ar.cuts.filter((r) => cmp(r, b) < 0), b];
  let net = Z;
  let abs = Z;
  for (let k = 0; k + 1 < pts.length; k++) {
    const v = polyIntegral(ar.diff, pts[k] as Rational, pts[k + 1] as Rational);
    net = add(net, v);
    abs = add(abs, v[0] < 0n ? neg(v) : v);
  }
  return { net, abs };
}

/** 지금 상태의 합. 넓이를 읽지 않는 칠하기이거나 끝 점의 x 가 정확한 분수가 아니면 null */
export function fillSums(
  p: CoordParams,
  s: CoordState,
  o: FillObj,
): { net: Rational; abs: Rational } | null {
  const ar = o.area;
  if (!ar) return null;
  const b = o.toPt ? pointQ(p, s, o.toPt)[0] : ar.b;
  return b ? fillSumsAt(o, b) : null;
}

export const fillOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is FillObj => o.kind === 'fill' && o.id === id) as FillObj;

/** 칠하기가 바라보는 가로 표본(시작 ~ 지금 끝). 끝이 시작 이하면 빈 목록 */
function samples(lo: number, hi: number, f: Frame): number[] {
  if (!(hi > lo)) return [];
  const n = Math.max(40, Math.round((f.r - f.l) / 3));
  return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n);
}

/** 칠할 영역의 꼭짓점(px): 위 경계를 왼쪽 → 오른쪽, 아래 경계를 오른쪽 → 왼쪽. 정의 안 되는 자리는 건너뛴다 */
function polygon(
  p: CoordParams,
  s: CoordState,
  o: FillObj,
  f: Frame,
  xs: number[],
): [number, number][] {
  const side = (e: Edge, order: number[]) =>
    order.flatMap((x) => {
      const y = edgeY(p, s, e, x);
      if (!Number.isFinite(y)) return [];
      const [X, Y] = toPx(p, f, x, y);
      return [[X, clampY(f, Y)] as [number, number]];
    });
  return [...side(o.top, xs), ...side(o.bottom, [...xs].reverse())];
}

/**
 * 위 − 아래의 부호가 같은 구간들. 표본 사이에서 부호가 바뀌면 직선으로 이은 0 자리에서 끊는다 —
 * 끊는 자리가 그림에서 한두 px 어긋나도 색 경계일 뿐 값(읽는 값은 분수로 정확히)과는 상관없다.
 */
function signRuns(xs: number[], d: (x: number) => number): { sign: number; xs: number[] }[] {
  const pts = xs.flatMap((x) => {
    const v = d(x);
    return Number.isFinite(v) ? [[x, v] as const] : [];
  });
  if (!pts.length) return [];
  const out: { sign: number; xs: number[] }[] = [];
  let [px, pd] = pts[0] as readonly [number, number];
  let sg = Math.sign(pd);
  let cur = [px];
  for (const [x, v] of pts.slice(1)) {
    const s = Math.sign(v);
    if (s !== 0 && sg !== 0 && s !== sg) {
      const xc = pd === 0 ? px : px + ((x - px) * pd) / (pd - v);
      if (cur[cur.length - 1] !== xc) cur.push(xc);
      out.push({ sign: sg, xs: cur });
      cur = [xc];
      sg = s;
    } else if (sg === 0) sg = s;
    cur.push(x);
    px = x;
    pd = v;
  }
  out.push({ sign: sg, xs: cur });
  return out;
}

const pathOf = (pts: [number, number][]) =>
  pts.length > 2 ? `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z` : '';

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
    const c = obj(ro, at, ['fill'], ['id', 'look', 'name', 'nameAt', 'hide', 'sign']);
    if (c.hide !== undefined && c.hide !== true) fail(`${at} hide`, 'true 만');
    if (c.sign !== undefined && c.sign !== true) fail(`${at} sign`, 'true 만');
    const id = c.id === undefined ? undefined : cx.named(c.id, `${at} id`);
    const r = obj(c.fill, `${at} fill`, ['top', 'x'], ['bottom']);
    const [ra, rb] = arr(r.x, `${at} fill.x`, 2, 2);
    if (isName(ra) && cx.points.has(ra.trim()))
      fail(`${at} fill.x`, '점을 따라가는 것은 끝(오른쪽)만 — 시작은 수');
    const a = numExpr(ra, `${at} fill.x`);
    // 끝: 앞에 나온 점 이름이면 그 점의 x 를 따라간다
    let pt: PointObj | undefined;
    let b: { src: string; n: number } | undefined;
    let hi: number;
    let bMax: Rational | null;
    if (isName(rb)) {
      pt = noFollow(cx.pointRef(rb.trim(), `${at} fill.x`), `${at} fill.x`, '칠하기 끝');
      const { i0, i1, step, stepN } = endCells(pt, cx.x);
      if (i0 * stepN < a.n - 1e-9)
        fail(
          `${at} fill.x`,
          `끝 점 ${pt.id} 이 시작보다 왼쪽으로 갈 수 있음(점이 닿는 가장 왼쪽 ${i0 * stepN}) — 시작을 그 자리 이하로`,
        );
      // 끝이 끝내 시작을 넘지 못하면 늘 빈 칠하기다(끌 수 없는 점이 시작 자리에 있는 경우 등)
      if (!(i1 * stepN > a.n + 1e-9))
        fail(
          `${at} fill.x`,
          `끝 점 ${pt.id} 이 닿는 가장 오른쪽(${i1 * stepN})이 시작 이하 — 칠할 곳이 없음`,
        );
      hi = i1 * stepN;
      bMax = step ? mul(qi(i1), step) : null;
    } else {
      b = numExpr(rb, `${at} fill.x`);
      if (!(b.n > a.n)) fail(`${at} fill.x`, '끝이 시작보다 커야 함');
      hi = b.n;
      bMax = exactOf(b.src);
    }
    if (a.n < cx.x.lo - 1e-9 || hi > cx.x.hi + 1e-9) fail(`${at} fill.x`, '화면 밖');
    const look = c.look === undefined ? 'plain' : oneOf(c.look, `${at} look`, LOOKS);
    if (c.sign === true && look !== 'plain')
      fail(`${at} look`, '부호별 칠하기는 색이 곧 부호라 재질(무늬)과 함께 쓰지 않음');
    const name = optStr(c.name, `${at} name`);
    if (name !== undefined && (!name.trim() || [...name].length > NAME_MAX))
      fail(`${at} name`, `1~${NAME_MAX}자`);
    let nameAt: [number, number] | undefined;
    if (c.nameAt !== undefined) {
      if (name === undefined) fail(`${at} nameAt`, 'name 이 있을 때만');
      const [nx, ny] = arr(c.nameAt, `${at} nameAt`, 2, 2);
      nameAt = [numExpr(nx, `${at} nameAt`).n, numExpr(ny, `${at} nameAt`).n];
    }
    // 무게중심 이름표는 모양이 고정된 영역에만: 부호별 칠하기는 위·아래가 엇갈려 꼬인 다각형이라 넓이가 거의 지워져
    // 무게중심이 그림 밖으로 튀고, 끝을 끄는 칠하기는 끄는 동안 이름표가 따라 흔들린다
    if (name !== undefined && nameAt === undefined && (c.sign === true || isName(rb)))
      fail(
        `${at} nameAt`,
        '부호별 칠하기·끝 점을 따라가는 칠하기에 이름표를 달려면 자리(nameAt)를 적으세요',
      );
    const top = edge(r.top, `${at} fill.top`, cx);
    const bottom =
      r.bottom === undefined
        ? { e: { n: 0 }, src: '0', poly: [] }
        : edge(r.bottom, `${at} fill.bottom`, cx);
    const o: FillObj = {
      kind: 'fill',
      ...(id !== undefined ? { id } : {}),
      top: top.e,
      bottom: bottom.e,
      lo: a.n,
      hi,
      ...(pt ? { toPt: pt.id } : {}),
      ...(c.sign === true ? { sign: true as const } : {}),
      look,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(nameAt ? { nameAt } : {}),
      ...(c.hide === true ? { hide: true as const } : {}),
    };
    if (id !== undefined) {
      o.area = parseArea(at, top, bottom, a.src, b ? b.src : null, bMax);
      cx.fills.set(id, o);
    }
    return o;
  },
  draw(o, k, { p, s, f, fills, tags }) {
    // 맞힌 뒤 칠하기: 이루기 전에는 경로·이름표 자리를 아예 비운다(숨긴 정답과 같은 규칙 — 자리가 DOM 에 남지 않게)
    const show = !(o.hide && !s.solved);
    const xs = show ? samples(o.lo, endX(p, s, o), f) : [];
    const pts = polygon(p, s, o, f, xs);
    if (o.sign) {
      // 끄는 동안 경로가 생기거나 사라지면 직접 적용이 못 따라가므로 두 경로를 늘 둔다(빈 경로 = 그 부호의 곳이 없음)
      const d = (x: number) => edgeY(p, s, o.top, x) - edgeY(p, s, o.bottom, x);
      let pos = '';
      let ng = '';
      for (const run of signRuns(xs, d)) {
        if (run.sign > 0) pos += pathOf(polygon(p, s, o, f, run.xs));
        else if (run.sign < 0) ng += pathOf(polygon(p, s, o, f, run.xs));
      }
      fills.push({ t: 'path', key: `f${k}`, d: pos, cls: 'fillr pos' });
      fills.push({ t: 'path', key: `f${k}n`, d: ng, cls: 'fillr neg' });
    } else
      fills.push({ t: 'path', key: `f${k}`, d: pathOf(pts), cls: `fillr ${o.look}`, look: o.look });
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

/** 끝 점이 닿는 자리마다의 끝 x(분수) — 검산이 닿는 모든 자리에서 합을 대조하려고. 고정 끝이면 하나 */
export function fillEnds(p: CoordParams, o: FillObj): Rational[] {
  const ar = o.area as FillArea;
  if (!o.toPt) return [ar.b as Rational];
  const { i0, i1, step } = endCells(pointOf(p, o.toPt), p.x);
  if (!step) return [];
  return Array.from({ length: i1 - i0 + 1 }, (_, k) => mul(qi(i0 + k), step));
}
