// 도형판 부품의 모델(순수). 화면(Shape.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 점은 격자점(정수 좌표)에 붙고, 제약이 있으면 선분 위의 격자점이나 원 위(15° 간격)로만 움직인다.
// 길이·각·넓이는 앱이 부동소수로 계산해 digits 자리로 반올림해 보이고, checks 가 같은 점에서 sympy 로
// 정확한 값을 계산해 반올림이 맞는지 대조한다(approx). 격자점만 쓰는 넓이는 분수로 정확히 대조한다.
// 잘라 옮기기(cut): 조각(piece)을 끌어 by 만큼 옮기면 다른 모양(result)이 되고 넓이는 그대로임을 보인다.
import { arr, fail, int, obj, optStr, str } from '../parse.ts';
import { reduce } from '../sym.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import { ratStr } from './q.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type ShOn = { seg: [string, string] } | { circle: [string, number] };
export interface ShPoint {
  id: string;
  x?: number;
  y?: number;
  /** 원 위 점의 각도(도, 15의 배수) */
  deg?: number;
  drag: boolean;
  on?: ShOn;
}
export type ShMeasure =
  | { len: [string, string] }
  | { angle: [string, string, string] }
  | { area: number };
export interface ShapeParams {
  grid: { w: number; h: number };
  points: ShPoint[];
  polygons: string[][];
  circles: { c: string; r: number }[];
  segments: [string, string][];
  measures: ShMeasure[];
  digits: number;
  cut?: { piece: string[]; rest: string[]; by: [number, number]; result: [number, number][] };
  /** 화면 위 안내 한 줄(선택) */
  note?: string;
}
export interface ShState {
  pts: Record<string, { x: number; y: number; deg?: number }>;
  /** 잘라 낸 조각의 이동(격자 칸) */
  cut: [number, number];
}

export const W = 320;
const CIRCLE_STEP = 15;

// ---- 좌표 ----

export function shUnit(p: ShapeParams) {
  return Math.min(288 / p.grid.w, 220 / p.grid.h);
}
export function shGeom(p: ShapeParams) {
  const u = shUnit(p);
  const ox = (W - p.grid.w * u) / 2;
  const oy = 16 + p.grid.h * u;
  return { u, ox, oy, h: oy + 16 };
}
const X = (p: ShapeParams, x: number) => r2(shGeom(p).ox + x * shGeom(p).u);
const Y = (p: ShapeParams, y: number) => r2(shGeom(p).oy - y * shGeom(p).u);
const rad = (d: number) => (d * Math.PI) / 180;

function circlePos(s: ShState, on: { circle: [string, number] }, deg: number) {
  const c = s.pts[on.circle[0]] as { x: number; y: number };
  const r = on.circle[1];
  return { x: c.x + r * Math.cos(rad(deg)), y: c.y + r * Math.sin(rad(deg)), deg };
}

export function shInit(p: ShapeParams): ShState {
  const pts: ShState['pts'] = {};
  const s: ShState = { pts, cut: [0, 0] };
  // 원 위 점은 중심이 먼저 있어야 하므로 두 번에 나눠 놓는다
  for (const pt of p.points) if (pt.deg === undefined) pts[pt.id] = { x: pt.x ?? 0, y: pt.y ?? 0 };
  for (const pt of p.points)
    if (pt.deg !== undefined && pt.on && 'circle' in pt.on)
      pts[pt.id] = circlePos(s, pt.on, pt.deg);
  return s;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** 점 id 를 world 좌표 (tx,ty) 쪽으로 옮긴 상태(제약·격자·범위 적용) */
function place(p: ShapeParams, s: ShState, id: string, tx: number, ty: number): ShState {
  const pt = p.points.find((x) => x.id === id);
  if (!pt) return s;
  let n: { x: number; y: number; deg?: number };
  if (pt.on && 'seg' in pt.on) {
    const a = s.pts[pt.on.seg[0]] as { x: number; y: number };
    const b = s.pts[pt.on.seg[1]] as { x: number; y: number };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const N = gcd(dx, dy);
    const t = ((tx - a.x) * dx + (ty - a.y) * dy) / (dx * dx + dy * dy);
    const k = Math.min(N, Math.max(0, Math.round(t * N)));
    n = { x: a.x + (k * dx) / N, y: a.y + (k * dy) / N };
  } else if (pt.on && 'circle' in pt.on) {
    const c = s.pts[pt.on.circle[0]] as { x: number; y: number };
    const deg =
      Math.round((Math.atan2(ty - c.y, tx - c.x) * 180) / Math.PI / CIRCLE_STEP) * CIRCLE_STEP;
    n = circlePos(s, pt.on, ((deg % 360) + 360) % 360);
  } else {
    n = {
      x: Math.min(p.grid.w, Math.max(0, Math.round(tx))),
      y: Math.min(p.grid.h, Math.max(0, Math.round(ty))),
    };
  }
  return { ...s, pts: { ...s.pts, [id]: n } };
}

/** 끌기: 시작 상태 s 에서 점(또는 'cut' 조각)을 화면 거리 (dx,dy)(SVG 단위)만큼 */
export function shDrag(p: ShapeParams, s: ShState, id: string, dx: number, dy: number): ShState {
  const u = shUnit(p);
  if (id === 'cut') {
    const cx = Math.max(-p.grid.w, Math.min(p.grid.w, Math.round(s.cut[0] + dx / u))) || 0;
    const cy = Math.max(-p.grid.h, Math.min(p.grid.h, Math.round(s.cut[1] - dy / u))) || 0;
    return { ...s, cut: [cx, cy] };
  }
  const cur = s.pts[id];
  if (!cur) return s;
  return place(p, s, id, cur.x + dx / u, cur.y - dy / u);
}

/** 방향키 이동: 자유 점은 격자 한 칸, 선분 위는 다음 격자점, 원 위는 15° */
export function shKey(p: ShapeParams, s: ShState, id: string, key: string): ShState | null {
  const d: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
  };
  const v = d[key];
  if (!v) return null;
  const pt = p.points.find((x) => x.id === id);
  const cur = s.pts[id];
  if (!pt || !cur) return null;
  if (pt.on && 'circle' in pt.on) {
    const deg = ((((cur.deg ?? 0) + (v[0] + v[1]) * CIRCLE_STEP) % 360) + 360) % 360;
    return { ...s, pts: { ...s.pts, [id]: circlePos(s, pt.on, deg) } };
  }
  if (pt.on && 'seg' in pt.on) {
    const a = s.pts[pt.on.seg[0]] as { x: number; y: number };
    const b = s.pts[pt.on.seg[1]] as { x: number; y: number };
    const N = gcd(b.x - a.x, b.y - a.y);
    const sx = (b.x - a.x) / N;
    const sy = (b.y - a.y) / N;
    const dir = v[0] + v[1];
    return place(p, s, id, cur.x + dir * sx, cur.y + dir * sy);
  }
  return place(p, s, id, cur.x + v[0], cur.y + v[1]);
}

export const shDone = (p: ShapeParams, s: ShState) =>
  !!p.cut && s.cut[0] === p.cut.by[0] && s.cut[1] === p.cut.by[1];

// ---- 계산 ----

const P = (s: ShState, id: string) => s.pts[id] as { x: number; y: number; deg?: number };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (l < 1e-12) return null;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l));
  return (Math.acos(cos) * 180) / Math.PI;
}
const shoelace = (ps: { x: number; y: number }[]) => {
  let t = 0;
  ps.forEach((a, i) => {
    const b = ps[(i + 1) % ps.length] as { x: number; y: number };
    t += a.x * b.y - b.x * a.y;
  });
  return Math.abs(t) / 2;
};

/** digits 자리 반올림 글자(ASCII, 뒤 0 없앰)와 정확히 떨어지는가 */
function round(v: number, digits: number): { s: string; exact: boolean } {
  const k = 10 ** digits;
  const r = Math.round(v * k + (v >= 0 ? 1e-9 : -1e-9)) / k;
  const s = String(Number(r.toFixed(digits)));
  return { s: s === '-0' ? '0' : s, exact: Math.abs(v - r) < 1e-9 };
}
const shown = (v: number, digits: number, unit = '') => {
  const r = round(v, digits);
  return `${r.exact ? '=' : '≈'} ${r.s.replace('-', '−')}${unit}`;
};

function measureValue(p: ShapeParams, s: ShState, m: ShMeasure): number | null {
  if ('len' in m) return dist(P(s, m.len[0]), P(s, m.len[1]));
  if ('angle' in m) return angleAt(P(s, m.angle[0]), P(s, m.angle[1]), P(s, m.angle[2]));
  return shoelace((p.polygons[m.area] ?? []).map((id) => P(s, id)));
}

/** 측정 글들(화면에 보이는 그대로) */
export function shMeasures(p: ShapeParams, s: ShState): string[] {
  return p.measures.map((m) => {
    const v = measureValue(p, s, m);
    if ('len' in m) return `${m.len.join('')} ${shown(v as number, p.digits)}`;
    if ('angle' in m)
      return v === null
        ? `∠${m.angle.join('')} 은 정할 수 없어요`
        : `∠${m.angle.join('')} ${shown(v, p.digits, '°')}`;
    return `넓이 ${shown(v as number, p.digits)}`;
  });
}

const cutArea = (s: ShState, ids: string[]) => shoelace(ids.map((id) => P(s, id)));

// ---- 그릴 목록 ----

const pts = (p: ShapeParams, ps: { x: number; y: number }[]) =>
  ps.map((a) => `${X(p, a.x)},${Y(p, a.y)}`).join(' ');

export function shDraw(p: ShapeParams, s: ShState): Drawing {
  const marks: Mark[] = [];
  p.polygons.forEach((poly, i) => {
    marks.push({
      k: `poly${i}`,
      tag: 'polygon',
      a: {
        points: pts(
          p,
          poly.map((id) => P(s, id)),
        ),
        class: `sh-poly t${i % 3}`,
        visibility: p.cut ? 'hidden' : 'visible',
      },
    });
  });
  p.circles.forEach((c, i) => {
    const o = P(s, c.c);
    marks.push({
      k: `circ${i}`,
      tag: 'circle',
      a: { cx: X(p, o.x), cy: Y(p, o.y), r: r2(c.r * shUnit(p)), class: 'sh-circle' },
    });
  });
  p.segments.forEach(([a, b], i) => {
    const A = P(s, a);
    const B = P(s, b);
    marks.push({
      k: `seg${i}`,
      tag: 'line',
      a: { x1: X(p, A.x), y1: Y(p, A.y), x2: X(p, B.x), y2: Y(p, B.y), class: 'sh-seg' },
    });
  });
  if (p.cut) {
    const c = p.cut;
    marks.push({
      k: 'cutr',
      tag: 'polygon',
      a: {
        points: pts(
          p,
          c.rest.map((id) => P(s, id)),
        ),
        class: 'sh-poly t0',
      },
    });
    // 조각의 원래 자리(점선)와 옮겨 가는 조각
    marks.push({
      k: 'cuto',
      tag: 'polygon',
      a: {
        points: pts(
          p,
          c.piece.map((id) => P(s, id)),
        ),
        class: 'sh-ghost',
      },
    });
    marks.push({
      k: 'cutp',
      tag: 'polygon',
      a: {
        points: pts(
          p,
          c.piece.map((id) => ({ x: P(s, id).x + s.cut[0], y: P(s, id).y + s.cut[1] })),
        ),
        class: shDone(p, s) ? 'sh-piece done' : 'sh-piece',
      },
    });
  }
  for (const pt of p.points) {
    const a = P(s, pt.id);
    const x = X(p, a.x);
    const y = Y(p, a.y);
    marks.push(
      pt.drag
        ? { k: `h:${pt.id}`, tag: 'g', a: { transform: `translate(${x} ${y})` } }
        : { k: `pt:${pt.id}`, tag: 'circle', a: { cx: x, cy: y, r: 4, class: 'sh-pt' } },
    );
    marks.push({
      k: `lab:${pt.id}`,
      tag: 'text',
      a: { x: r2(x + 12), y: r2(y - 10), class: 'sh-lab' },
      text: pt.id,
    });
  }
  const texts: Record<string, string> = {};
  shMeasures(p, s).forEach((t, i) => {
    texts[`m${i}`] = t;
  });
  if (p.cut) {
    const whole = shoelace((p.polygons[0] ?? []).map((id) => P(s, id)));
    const moved = cutArea(s, p.cut.rest) + cutArea(s, p.cut.piece);
    const a = round(whole, p.digits).s;
    texts.area =
      s.cut[0] === 0 && s.cut[1] === 0
        ? `넓이 = ${a}`
        : `넓이 = ${a} → 옮긴 뒤 넓이 = ${round(moved, p.digits).s}`;
  }
  return { marks, texts };
}

// ---- 검산 ----

/** sympy 점 식 */
function pointSym(p: ShapeParams, s: ShState, id: string): string {
  const pt = p.points.find((x) => x.id === id) as ShPoint;
  const a = P(s, id);
  if (pt.on && 'circle' in pt.on) {
    const c = P(s, pt.on.circle[0]);
    const r = pt.on.circle[1];
    return `Point(${c.x} + ${r}*cos(rad(${a.deg})), ${c.y} + ${r}*sin(rad(${a.deg})))`;
  }
  return `Point(${a.x}, ${a.y})`;
}
const shoelaceSym = (ps: string[]) =>
  `Abs(${ps
    .map((a, i) => {
      const b = ps[(i + 1) % ps.length];
      return `(${a}).x*(${b}).y - (${b}).x*(${a}).y`;
    })
    .join(' + ')})/2`;

function measureChecks(p: ShapeParams, s: ShState, tag: string): WidgetCheck[] {
  const out: WidgetCheck[] = [];
  const ps = (id: string) => pointSym(p, s, id);
  p.measures.forEach((m, i) => {
    const v = measureValue(p, s, m);
    if (v === null) return;
    let expr: string;
    if ('len' in m) expr = `${ps(m.len[0])}.distance(${ps(m.len[1])})`;
    else if ('angle' in m) {
      const [a, b, c] = m.angle.map(ps) as [string, string, string];
      expr = `deg(acos((${a} - ${b}).dot(${c} - ${b}) / (${a}.distance(${b})*${c}.distance(${b}))))`;
    } else expr = shoelaceSym((p.polygons[m.area] ?? []).map(ps));
    out.push({
      name: `${tag} 측정${i + 1}`,
      kind: 'approx',
      expr,
      value: round(v, p.digits).s,
      digits: p.digits,
    });
  });
  return out;
}

/** 격자점 넓이의 정확한 분수(2배 넓이는 정수) */
const latticeArea = (ps: { x: number; y: number }[]) =>
  ratStr(reduce(BigInt(Math.round(shoelace(ps) * 2)), 2n));

// ---- 형식 검사 ----

const ID = /^[A-Z]$/;

export const shapeDef: WidgetDef<ShapeParams> = {
  parse(raw) {
    const o = obj(
      raw,
      '도형판',
      ['grid', 'points'],
      ['polygons', 'circles', 'segments', 'measures', 'digits', 'cut', 'note'],
    );
    const g = obj(o.grid, '도형판 grid', ['w', 'h']);
    const grid = { w: int(g.w, '도형판 grid.w', 2, 16), h: int(g.h, '도형판 grid.h', 2, 12) };
    const ids = new Set<string>();
    const need = (id: unknown, at: string) => {
      const v = str(id, at);
      if (!ids.has(v)) fail(at, `없는 점 ${v}`);
      return v;
    };
    const points: ShPoint[] = arr(o.points, '도형판 points', 1, 10).map((rp, i) => {
      const at = `도형판 점${i + 1}`;
      const x = obj(rp, at, ['id'], ['x', 'y', 'deg', 'drag', 'on']);
      const id = str(x.id, `${at} id`);
      if (!ID.test(id)) fail(`${at} id`, '대문자 한 글자');
      if (ids.has(id)) fail(`${at} id`, `중복 (${id})`);
      if (x.drag !== undefined && typeof x.drag !== 'boolean') fail(`${at} drag`, 'true/false 만');
      const pt: ShPoint = { id, drag: x.drag === true };
      if (x.on !== undefined) {
        const on = obj(x.on, `${at} on`, [], ['seg', 'circle']);
        if (on.seg !== undefined) {
          const sg = arr(on.seg, `${at} on.seg`, 2, 2).map((v, j) =>
            need(v, `${at} on.seg${j + 1}`),
          );
          pt.on = { seg: [sg[0] as string, sg[1] as string] };
        } else if (on.circle !== undefined) {
          const c = arr(on.circle, `${at} on.circle`, 2, 2);
          pt.on = { circle: [need(c[0], `${at} 원 중심`), int(c[1], `${at} 반지름`, 1, 12)] };
        } else fail(`${at} on`, 'seg 나 circle 이 필요');
      }
      if (pt.on && 'circle' in pt.on) {
        const deg = int(x.deg, `${at} deg`, 0, 345);
        if (deg % CIRCLE_STEP) fail(`${at} deg`, `${CIRCLE_STEP}의 배수가 아님`);
        pt.deg = deg;
      } else {
        const cx = int(x.x, `${at} x`, -99, 99);
        const cy = int(x.y, `${at} y`, -99, 99);
        if (cx < 0 || cx > grid.w || cy < 0 || cy > grid.h) fail(at, `격자 밖 (${cx}, ${cy})`);
        pt.x = cx;
        pt.y = cy;
        if (x.deg !== undefined) fail(`${at} deg`, '원 위 점에만');
      }
      ids.add(id);
      return pt;
    });
    const p: ShapeParams = {
      grid,
      points,
      polygons: (o.polygons === undefined ? [] : arr(o.polygons, '도형판 polygons', 0, 4)).map(
        (pl, i) =>
          arr(pl, `도형판 다각형${i + 1}`, 3, 8).map((v, j) =>
            need(v, `도형판 다각형${i + 1} 점${j + 1}`),
          ),
      ),
      circles: (o.circles === undefined ? [] : arr(o.circles, '도형판 circles', 0, 3)).map(
        (rc, i) => {
          const c = obj(rc, `도형판 원${i + 1}`, ['c', 'r']);
          return { c: need(c.c, `도형판 원${i + 1} c`), r: int(c.r, `도형판 원${i + 1} r`, 1, 12) };
        },
      ),
      segments: (o.segments === undefined ? [] : arr(o.segments, '도형판 segments', 0, 8)).map(
        (rs, i) => {
          const sg = arr(rs, `도형판 선분${i + 1}`, 2, 2).map((v, j) =>
            need(v, `도형판 선분${i + 1} 점${j + 1}`),
          );
          return [sg[0], sg[1]] as [string, string];
        },
      ),
      measures: [],
      digits: o.digits === undefined ? 1 : int(o.digits, '도형판 digits', 0, 3),
    };
    const note = optStr(o.note, '도형판 note');
    if (note !== undefined) p.note = note;
    p.measures = (o.measures === undefined ? [] : arr(o.measures, '도형판 measures', 0, 6)).map(
      (rm, i) => {
        const at = `도형판 측정${i + 1}`;
        const m = obj(rm, at, [], ['len', 'angle', 'area']);
        if (m.len !== undefined) {
          const l = arr(m.len, `${at} len`, 2, 2).map((v) => need(v, `${at} len`));
          return { len: [l[0], l[1]] as [string, string] };
        }
        if (m.angle !== undefined) {
          const l = arr(m.angle, `${at} angle`, 3, 3).map((v) => need(v, `${at} angle`));
          return { angle: [l[0], l[1], l[2]] as [string, string, string] };
        }
        return { area: int(m.area, `${at} area`, 0, p.polygons.length - 1) };
      },
    );
    for (const pt of points)
      if (pt.on && 'seg' in pt.on) {
        const [a, b] = pt.on.seg.map((id) => points.find((x) => x.id === id) as ShPoint);
        if (a?.drag || b?.drag || a?.on || b?.on)
          fail(`도형판 ${pt.id}`, '선분 끝점은 고정된 격자점이어야 함');
        if (gcd((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0)) < 2)
          fail(`도형판 ${pt.id}`, '선분 위 격자점이 양끝뿐이라 움직일 곳이 없음');
      } else if (pt.on && 'circle' in pt.on) {
        const c = points.find((x) => x.id === (pt.on as { circle: [string, number] }).circle[0]);
        if (c?.drag || c?.on) fail(`도형판 ${pt.id}`, '원 중심은 고정된 격자점이어야 함');
      }
    if (o.cut !== undefined) {
      const c = obj(o.cut, '도형판 cut', ['piece', 'rest', 'by', 'result']);
      if (points.some((x) => x.drag || x.on))
        fail('도형판 cut', '잘라 옮기기에는 끄는 점·제약 점을 두지 않음');
      if (!p.polygons.length) fail('도형판 cut', '잘라 낼 다각형(polygons 첫째)이 있어야 함');
      const ids2 = (v: unknown, at: string) =>
        arr(v, at, 3, 8).map((x, j) => need(x, `${at}${j + 1}`));
      const by = arr(c.by, '도형판 cut.by', 2, 2).map((v, j) =>
        int(v, `도형판 cut.by${j + 1}`, -16, 16),
      );
      const result = arr(c.result, '도형판 cut.result', 3, 8).map((rv, j) => {
        const v = arr(rv, `도형판 결과 점${j + 1}`, 2, 2);
        return [
          int(v[0], `도형판 결과 점${j + 1} x`, 0, grid.w),
          int(v[1], `도형판 결과 점${j + 1} y`, 0, grid.h),
        ] as [number, number];
      });
      p.cut = {
        piece: ids2(c.piece, '도형판 조각 점'),
        rest: ids2(c.rest, '도형판 나머지 점'),
        by: [by[0] as number, by[1] as number],
        result,
      };
      if (p.cut.by[0] === 0 && p.cut.by[1] === 0) fail('도형판 cut.by', '옮기는 거리가 0');
      const s = shInit(p);
      const whole = shoelace((p.polygons[0] as string[]).map((id) => P(s, id)));
      const parts = cutArea(s, p.cut.rest) + cutArea(s, p.cut.piece);
      const res = shoelace(result.map(([x, y]) => ({ x, y })));
      if (Math.abs(whole - parts) > 1e-9) fail('도형판 cut', '조각+나머지 넓이가 처음 넓이와 다름');
      if (Math.abs(whole - res) > 1e-9)
        fail('도형판 cut.result', '결과 모양의 넓이가 처음 넓이와 다름');
    }
    return p;
  },
  checks(p) {
    const s = shInit(p);
    const out = measureChecks(p, s, '처음');
    if (p.cut) {
      const c = p.cut;
      const ps = (id: string) => pointSym(p, s, id);
      const whole = latticeArea((p.polygons[0] as string[]).map((id) => P(s, id)));
      // 화면이 보이는 "처음 넓이"(앱 계산)가 sympy 의 조각+나머지, 그리고 결과 모양의 넓이와 같은가
      out.push({
        name: '처음 넓이 = 조각+나머지',
        answer: whole,
        answerType: 'fraction',
        check: `${shoelaceSym(c.rest.map(ps))} + ${shoelaceSym(c.piece.map(ps))}`,
      });
      out.push({
        name: '처음 넓이 = 옮긴 모양',
        answer: whole,
        answerType: 'fraction',
        check: shoelaceSym(c.result.map(([x, y]) => `Point(${x}, ${y})`)),
      });
      out.push({
        name: '옮긴 조각 = 결과 모양 안',
        answer: whole,
        answerType: 'fraction',
        check: `${shoelaceSym(c.rest.map(ps))} + ${shoelaceSym(c.piece.map((id) => `(${ps(id)} + Point(${c.by[0]}, ${c.by[1]}))`))}`,
      });
    }
    return out;
  },
  texts: (p) => (p.note ? [p.note] : []),
};
