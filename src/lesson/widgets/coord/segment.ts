// 선분 {segment:[끝, 끝]} · 화살표 {arrow:[꼬리, 머리]}. 끝은 앞에 나온 점 이름 또는 좌표 식 [x, y](슬라이더 이름만).
// 예전 단원은 벡터를 x/4+Abs(sqrt(x*(4-x)))-sqrt(x*(4-x)) 같은 꼼수 곡선(구간 밖에서 허수가 되게 해 자름)으로 그려
// x 가 같은 두 끝(세로 벡터)을 그릴 수 없었고 화살촉도 없었다. 두 종류는 같은 항목(화살대 line + 화살촉 path)을
// 그리고 화살표만 화살촉을 채우므로, line.ts(할선·접선)처럼 한 파일에 둔다.
//
// 끄는 동안 React 를 다시 그리지 않는다: 항목은 늘 같은 key(화살대 g<순번>, 화살촉 g<순번>h)로 두고, 길이가 0 이면
// 숨김(hidden)·빈 경로로만 바꾼다 — 끄는 중 직접 적용(Coord.tsx apply)이 그 값을 그대로 넣는다.
import { compile, evalNum, exactStr, varsOf } from '../../expr.ts';
import { arr, fail, obj, oneOf, str } from '../../parse.ts';
import type { Node } from '../../sym.ts';
import { near } from './common.ts';
import { curveNum, curveVars } from './curve.ts';
import { hidden0, narrowFrame, r1, toPx } from './frame.ts';
import { pointOf, pointXY } from './point.ts';
import { sliderCombos } from './slider.ts';
import {
  type ArrowObj,
  type CheckCtx,
  type CoordParams,
  type CoordState,
  type DrawCtx,
  type KindDef,
  type ParseCtx,
  type PointObj,
  type SegEnd,
  type SegmentObj,
  TONES,
} from './types.ts';

type SegObj = SegmentObj | ArrowObj;

/** 화살촉 길이·반폭(px). 화살대 굵기 2.6px 보다 확실히 넓어야 방향이 보인다 */
const HEAD_L = 9;
const HEAD_W = 4.5;
/**
 * 가장 좁은 화면에서 화살표 길이 하한(px): 화살촉 9px + 화살대 7px. 이보다 짧으면 화살촉만 남아 '얼마나 갔는가'
 * (벡터의 크기)가 안 보인다 — 끝이 끄는 점이면 길이가 손에 달려 있어 검사하지 않는다(짧아지면 화살촉을 줄임).
 */
export const MIN_ARROW_PX = 16;
/**
 * 머리 끝이 점이면 화살촉 끝을 점 가장자리까지 물린다(px). 끄는 점은 손잡이의 보이는 원 반지름 11.5
 * (lesson.css .handle .dot 20px + 바깥 그림자 1.5px) — 물리지 않으면 화살촉 9px 가 손잡이 밑에 다 가려진다.
 * 끌 수 없는 점은 점 반지름 5 + 테두리 2px 의 절반 = 6
 */
const PULL_HANDLE = 11.5;
const PULL_DOT = 6;
const pullOf = (o: PointObj | undefined) => (!o ? 0 : o.drag === 'none' ? PULL_DOT : PULL_HANDLE);

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
/** 끝 자리를 움직이는 슬라이더: 좌표 식의 슬라이더, 끌 수 없는 곡선 위 점이면 그 곡선의 슬라이더 */
function endSliders(e: SegEnd, cx: Pick<ParseCtx, 'sliders' | 'points' | 'curves'>): string[] {
  if (!('pt' in e)) return [...new Set([...slidersIn(e.nx, cx), ...slidersIn(e.ny, cx)])];
  const o = cx.points.get(e.pt);
  const c = o?.on ? cx.curves.get(o.on) : undefined;
  if (o?.drag !== 'none' || !c) return [];
  const used = curveVars(c);
  return cx.sliders.map((sl) => sl.id).filter((id) => used.has(id));
}

/**
 * 형식 검사 중 끝 좌표(수). 좌표 식·끌 수 없는 칸 위 점·끌 수 없는 곡선 위 점(그 곡선 값)은 셀 수 있다.
 * 끄는 점은 자리가 손에 달려 null(화면 밖·길이 검사를 건너뜀 — 칸 안에서만 움직인다)
 */
function endAt(
  e: SegEnd,
  cx: Pick<ParseCtx, 'points' | 'curves' | 'x' | 'y'>,
  env: Record<string, number>,
): [number, number] | null {
  if ('pt' in e) {
    const o = cx.points.get(e.pt);
    if (o?.drag !== 'none') return null;
    if (!o.on) return [o.i * cx.x.st, o.j * cx.y.st];
    const c = cx.curves.get(o.on);
    const x = o.i * o.snapN;
    return c ? [x, curveNum(c, { ...env, x })] : null;
  }
  return [evalNum(e.nx, env), evalNum(e.ny, env)];
}

/**
 * 중복 비교 열쇠: 끝을 좌표로 풀어(끝이 쓰는 슬라이더의 모든 칸에서) 견준다 — 같은 자리를 [0,0] 과 'O' 로,
 * '4/2' 와 2 로 다르게 적어도 같은 선분이다. 끄는 점 끝은 그 점 이름. 선분은 방향이 없어 두 끝을 정렬하고,
 * 화살표는 꼬리·머리 순서가 뜻이라 그대로(반대 방향 화살표는 다른 벡터)
 */
export function segKey(o: SegmentObj | ArrowObj, cx: ParseCtx): string {
  const sig = (e: SegEnd) => {
    const ids = endSliders(e, cx);
    const vals = sliderCombos(cx.sliders, ids, '좌표 선분').map((cb) => {
      const q = endAt(e, cx, { ...cx.env0, ...cb.num });
      return q ? q.map((v) => Number(v.toPrecision(12))).join(',') : null;
    });
    return vals.includes(null)
      ? `pt:${'pt' in e ? e.pt : ''}`
      : `${ids.join('')}[${vals.join(';')}]`;
  };
  const ends = [sig(o.a), sig(o.b)];
  return `${o.kind} ${(o.kind === 'segment' ? ends.sort() : ends).join(' ')}`;
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
  for (const cb of sliderCombos(cx.sliders, ids, at)) {
    const env = { ...cx.env0, ...cb.num };
    const pa = endAt(o.a, cx, env);
    const pb = endAt(o.b, cx, env);
    // 꼬리 끝은 점 밑에 묻혀도 괜찮다 — 화살촉만 물리므로 길이에서 머리 쪽 물림을 뺀다
    const pull = o.kind === 'arrow' && 'pt' in o.b ? pullOf(cx.points.get(o.b.pt)) : 0;
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
    const len = Math.hypot((pb[0] - pa[0]) * pxX, (pb[1] - pa[1]) * pxY) - pull;
    if (o.kind === 'arrow' && len < MIN_ARROW_PX)
      fail(
        at,
        `가장 좁은 화면에서 화살표가 ${len.toFixed(1)}px${pull ? `(머리 점 물림 ${pull}px 뺌)` : ''}${cb.text ? `(${cb.text})` : ''} — ${MIN_ARROW_PX}px 이상(화살촉만 남아 크기가 안 보임)`,
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
  const arrow = o.kind === 'arrow';
  // 머리 끝이 점이면 화살촉 끝을 점 가장자리까지 물린다(손잡이·점에 가려지지 않게)
  const pull = arrow && 'pt' in o.b ? pullOf(pointOf(p, o.b.pt)) : 0;
  const Lv = L - pull;
  const show = ok && (arrow ? Lv >= 1 : L >= 0.5);
  let ln = show ? { x1: r1(X1), y1: r1(Y1), x2: r1(X2), y2: r1(Y2) } : hidden0;
  let head = '';
  if (show && arrow) {
    const ux = (X2 - X1) / L;
    const uy = (Y2 - Y1) / L;
    const tx = X2 - ux * pull;
    const ty = Y2 - uy * pull;
    // 끄는 점 끝이라 짧아지면 화살촉도 줄인다(화살촉이 꼬리 뒤로 삐져나가지 않게)
    const hl = Math.min(HEAD_L, Lv * 0.6);
    const hw = (HEAD_W * hl) / HEAD_L;
    const bx = tx - ux * hl;
    const by = ty - uy * hl;
    head = `M${r1(tx)} ${r1(ty)}L${r1(bx - uy * hw)} ${r1(by + ux * hw)}L${r1(bx + uy * hw)} ${r1(by - ux * hw)}Z`;
    // 화살대는 화살촉 밑(1px 겹침)에서 끝낸다 — 굵은 선 끝이 뾰족한 머리를 뭉개지 않게
    ln = { ...ln, x2: r1(tx - ux * (hl - 1)), y2: r1(ty - uy * (hl - 1)) };
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
      const cs = sliderCombos(p.sliders, ids, `${name} ${o.ref}`);
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
