// 선분 {segment:[끝, 끝]} · 화살표 {arrow:[꼬리, 머리]}. 끝은 앞에 나온 점 이름 또는 좌표 식 [x, y](슬라이더 이름만).
// 예전 단원은 벡터를 x/4+Abs(sqrt(x*(4-x)))-sqrt(x*(4-x)) 같은 꼼수 곡선(구간 밖에서 허수가 되게 해 자름)으로 그려
// x 가 같은 두 끝(세로 벡터)을 그릴 수 없었고 화살촉도 없었다. 두 종류는 같은 항목(화살대 line + 화살촉 path)을
// 그리고 화살표만 화살촉을 채우므로, line.ts(할선·접선)처럼 한 파일에 둔다.
//
// 끄는 동안 React 를 다시 그리지 않는다: 항목은 늘 같은 key(화살대 g<순번>, 화살촉 g<순번>h)로 두고, 길이가 0 이면
// 숨김(hidden)·빈 경로로만 바꾼다 — 끄는 중 직접 적용(Coord.tsx apply)이 그 값을 그대로 넣는다.
import { compile, evalNum, exactStr, varsOf } from '../../expr.ts';
import { GOAL_MAX_STATES } from '../../goal.ts';
import { arr, fail, obj, oneOf, str } from '../../parse.ts';
import type { Node } from '../../sym.ts';
import { near } from './common.ts';
import { hidden0, narrowFrame, r1, toPx } from './frame.ts';
import { pointXY } from './point.ts';
import { sliderSym, sliderValues } from './slider.ts';
import type {
  ArrowObj,
  CheckCtx,
  CoordParams,
  CoordState,
  DrawCtx,
  KindDef,
  ParseCtx,
  SegEnd,
  SegmentObj,
} from './types.ts';

type SegObj = SegmentObj | ArrowObj;

const TONES = ['main', 'soft', 'accent'] as const;
/** 화살촉 길이·반폭(px). 화살대 굵기 2.6px 보다 확실히 넓어야 방향이 보인다 */
const HEAD_L = 9;
const HEAD_W = 4.5;
/**
 * 가장 좁은 화면에서 화살표 길이 하한(px): 화살촉 9px + 화살대 7px. 이보다 짧으면 화살촉만 남아 '얼마나 갔는가'
 * (벡터의 크기)가 안 보인다 — 끝이 끄는 점이면 길이가 손에 달려 있어 검사하지 않는다(짧아지면 화살촉을 줄임).
 */
export const MIN_ARROW_PX = 16;

const endText = (e: SegEnd) => ('pt' in e ? e.pt : `(${e.x},${e.y})`);

function parseEnd(v: unknown, at: string, cx: ParseCtx): SegEnd {
  if (typeof v === 'string') return { pt: cx.pointRef(v, at).id };
  const [rx, ry] = arr(v, at, 2, 2);
  const one = (r: unknown, w: string) => {
    const src = typeof r === 'number' ? exactStr(r) : str(r, w).replace(/\s+/g, '');
    try {
      // 끝 좌표는 슬라이더로만 움직인다(x 를 쓰면 곡선이지 끝이 아니다)
      return {
        src,
        node: compile(
          src,
          cx.sliders.map((sl) => sl.id),
        ),
      };
    } catch (e) {
      return fail(w, (e as Error).message);
    }
  };
  const x = one(rx, `${at} x`);
  const y = one(ry, `${at} y`);
  return { x: x.src, y: y.src, nx: x.node, ny: y.node };
}

/** 식에 쓰인 슬라이더 id(식 구조에서 — 글자 검색은 'k' 가 다른 이름 속에 든 것도 센다) */
const slidersIn = (n: Node, cx: Pick<ParseCtx, 'sliders'>) => {
  const vs = varsOf(n);
  return cx.sliders.map((sl) => sl.id).filter((id) => vs.has(id));
};
const endSliders = (e: SegEnd, cx: Pick<ParseCtx, 'sliders'>): string[] =>
  'pt' in e ? [] : [...new Set([...slidersIn(e.nx, cx), ...slidersIn(e.ny, cx)])];

interface Combo {
  num: Record<string, number>;
  sym: Record<string, string>;
  text: string;
}

/** 쓰인 슬라이더가 닿는 값의 모든 조합(검산·형식 검사가 늘어놓는 상태) */
function combos(ids: string[], cx: Pick<ParseCtx, 'sliders'>, at: string): Combo[] {
  let acc: Combo[] = [{ num: {}, sym: {}, text: '' }];
  for (const id of ids) {
    const sl = cx.sliders.find((s) => s.id === id);
    if (!sl) continue;
    const vs = sliderValues(sl);
    if (acc.length * vs.length > GOAL_MAX_STATES)
      fail(at, `슬라이더 칸 조합이 ${GOAL_MAX_STATES}개를 넘어 끝 자리를 다 확인할 수 없음`);
    acc = acc.flatMap((c) =>
      vs.map(({ k, v }) => ({
        num: { ...c.num, [id]: v },
        sym: { ...c.sym, [id]: sliderSym(sl, k) },
        text: `${c.text}${c.text ? ', ' : ''}${id}=${v}`,
      })),
    );
  }
  return acc;
}

/**
 * 형식 검사 중 끝 좌표(수). 끌 수 없는 칸 위 점과 좌표 식만 셀 수 있다 — 끄는 점·곡선 위 점은 자리가 손·슬라이더에
 * 달려 null(화면 밖·길이 검사를 건너뜀. 끄는 점은 칸 안에서만 움직이고 곡선 위 점은 clipPath 가 자른다)
 */
function endAt(e: SegEnd, cx: ParseCtx, env: Record<string, number>): [number, number] | null {
  if ('pt' in e) {
    const o = cx.points.get(e.pt);
    if (!o || o.on || o.drag !== 'none') return null;
    return [o.i * cx.x.st, o.j * cx.y.st];
  }
  return [evalNum(e.nx, env), evalNum(e.ny, env)];
}

function parseSeg<K extends SegObj['kind']>(kind: K, ro: unknown, at: string, cx: ParseCtx) {
  const c = obj(ro, at, [kind], ['tone', 'label']);
  const [ra, rb] = arr(c[kind], `${at} ${kind}`, 2, 2);
  const a = parseEnd(ra, `${at} ${kind}1`, cx);
  const b = parseEnd(rb, `${at} ${kind}2`, cx);
  const o = {
    kind,
    a,
    b,
    tone: c.tone === undefined ? 'main' : oneOf(c.tone, `${at} tone`, TONES),
    ...(c.label !== undefined ? { label: str(c.label, `${at} label`) } : {}),
    ref: `${endText(a)}→${endText(b)}`,
  } as Extract<SegObj, { kind: K }>;
  checkEnds(o, at, cx);
  return o;
}

/**
 * 화면 밖 끝(슬라이더 값마다 — 화살촉이 잘리면 방향이 안 보임), 늘 같은 두 끝(그릴 것이 없음),
 * 가장 좁은 화면에서 MIN_ARROW_PX 보다 짧은 0 아닌 화살표.
 */
function checkEnds(o: SegObj, at: string, cx: ParseCtx): void {
  const ids = [...new Set([...endSliders(o.a, cx), ...endSliders(o.b, cx)])];
  const f = narrowFrame(cx);
  const pxX = (f.r - f.l) / (cx.x.hi - cx.x.lo);
  const pxY = (f.b - f.t) / (cx.y.hi - cx.y.lo);
  let moved = false;
  let known = true;
  for (const cb of combos(ids, cx, at)) {
    const env = { ...cx.env0, ...cb.num };
    const pa = endAt(o.a, cx, env);
    const pb = endAt(o.b, cx, env);
    for (const q of [pa, pb]) {
      if (!q) continue;
      const [x, y] = q;
      const inside =
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        x >= cx.x.lo - 1e-9 &&
        x <= cx.x.hi + 1e-9 &&
        y >= cx.y.lo - 1e-9 &&
        y <= cx.y.hi + 1e-9;
      if (!inside)
        fail(at, `화면 밖 끝 (${x}, ${y})${cb.text ? ` — ${cb.text}` : ''} (축 범위 안이어야 함)`);
    }
    if (!pa || !pb) {
      known = false;
      continue;
    }
    if (near(pa[0], pb[0]) && near(pa[1], pb[1])) continue;
    moved = true;
    const len = Math.hypot((pb[0] - pa[0]) * pxX, (pb[1] - pa[1]) * pxY);
    if (o.kind === 'arrow' && len < MIN_ARROW_PX)
      fail(
        at,
        `가장 좁은 화면에서 화살표가 ${len.toFixed(1)}px${cb.text ? `(${cb.text})` : ''} — ${MIN_ARROW_PX}px 이상(화살촉만 남아 크기가 안 보임)`,
      );
  }
  if (known && !moved) fail(at, `두 끝이 같음 (${o.ref}) — 그릴 것이 없음`);
}

function endXY(p: CoordParams, s: CoordState, e: SegEnd): [number, number] {
  if ('pt' in e) return pointXY(p, s, e.pt);
  return [evalNum(e.nx, s.vars), evalNum(e.ny, s.vars)];
}

function drawSeg(o: SegObj, k: number, { p, s, f, items }: DrawCtx) {
  const [x1, y1] = endXY(p, s, o.a);
  const [x2, y2] = endXY(p, s, o.b);
  const ok = [x1, y1, x2, y2].every(Number.isFinite);
  const [X1, Y1] = ok ? toPx(p, f, x1, y1) : [0, 0];
  const [X2, Y2] = ok ? toPx(p, f, x2, y2) : [0, 0];
  const L = Math.hypot(X2 - X1, Y2 - Y1);
  const show = ok && L >= 0.5;
  const arrow = o.kind === 'arrow';
  let ln = show ? { x1: r1(X1), y1: r1(Y1), x2: r1(X2), y2: r1(Y2) } : hidden0;
  let head = '';
  if (show && arrow) {
    // 끄는 점 끝이라 짧아지면 화살촉도 줄인다(화살촉이 꼬리 뒤로 삐져나가지 않게)
    const hl = Math.min(HEAD_L, L * 0.6);
    const hw = (HEAD_W * hl) / HEAD_L;
    const ux = (X2 - X1) / L;
    const uy = (Y2 - Y1) / L;
    const bx = X2 - ux * hl;
    const by = Y2 - uy * hl;
    head = `M${r1(X2)} ${r1(Y2)}L${r1(bx - uy * hw)} ${r1(by + ux * hw)}L${r1(bx + uy * hw)} ${r1(by - ux * hw)}Z`;
    // 화살대는 화살촉 밑(1px 겹침)에서 끝낸다 — 굵은 선 끝이 뾰족한 머리를 뭉개지 않게
    ln = { ...ln, x2: r1(X2 - ux * (hl - 1)), y2: r1(Y2 - uy * (hl - 1)) };
  }
  items.push({ t: 'line', key: `g${k}`, ...ln, cls: `seg ${o.tone}`, hidden: !show });
  if (arrow) items.push({ t: 'path', key: `g${k}h`, d: head, cls: `ahead ${o.tone}` });
}

/** 검산: 슬라이더 식 끝 좌표마다 닿는 슬라이더 값 전부에서 앱 계산 = sympy(parity). 점·고정 수 끝은 다른 곳·글자 그대로 */
function segChecks(o: SegObj, { p, out }: CheckCtx) {
  const name = o.kind === 'arrow' ? '화살표' : '선분';
  const ends: [SegEnd, string][] =
    o.kind === 'arrow'
      ? [
          [o.a, '꼬리'],
          [o.b, '머리'],
        ]
      : [
          [o.a, '끝1'],
          [o.b, '끝2'],
        ];
  for (const [e, side] of ends) {
    if ('pt' in e) continue;
    for (const [src, node, ax] of [
      [e.x, e.nx, 'x'],
      [e.y, e.ny, 'y'],
    ] as const) {
      const ids = slidersIn(node, p);
      if (ids.length === 0) continue;
      const cs = combos(ids, p, `${name} ${o.ref}`);
      out.push({
        name: `${name} ${o.ref} ${side} ${ax}`,
        kind: 'parity',
        expr: src,
        points: cs.map((c) => c.sym),
        values: cs.map((c) => {
          const v = evalNum(node, c.num);
          return Number.isNaN(v) ? null : v;
        }),
      });
    }
  }
}

const texts = (o: SegObj) => (o.label ? [o.label] : []);

export const segmentKind: KindDef<SegmentObj> = {
  parse: (ro, at, cx) => parseSeg('segment', ro, at, cx),
  draw: drawSeg,
  checks: segChecks,
  texts,
};

export const arrowKind: KindDef<ArrowObj> = {
  parse: (ro, at, cx) => parseSeg('arrow', ro, at, cx),
  draw: drawSeg,
  checks: segChecks,
  texts,
};
