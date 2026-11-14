// 읽는 값 객체 {readout:'slope(P,Q)', label}: 식 글자 형식 검사·값 계산·화면 숫자 한 줄.
// 그림 위에는 아무것도 그리지 않고 readouts 목록에만 보탠다.
import { fail, int, obj, str } from '../../parse.ts';
import { dfAt } from './curve.ts';
import { fmtNum } from './frame.ts';
import { coincide, pointOf, pointXY } from './point.ts';
import type { CoordParams, CoordState, KindDef, ReadoutExpr, ReadoutObj } from './types.ts';

const SLOPE_RE = /^slope\((\w+),(\w+)\)$/;
const DERIV_RE = /^deriv\((\w+),(\w+)\)$/;
const XY_RE = /^([xy])\((\w+)\)$/;
const VALUE_RE = /^value\((\w+)\)$/;

function readoutExpr(s: string, at: string): ReadoutExpr {
  const t = s.replace(/\s+/g, '');
  let m = t.match(SLOPE_RE);
  if (m) return { f: 'slope', a: m[1] as string, b: m[2] as string };
  m = t.match(DERIV_RE);
  if (m) return { f: 'deriv', curve: m[1] as string, at: m[2] as string };
  m = t.match(XY_RE);
  if (m) return { f: m[1] as 'x' | 'y', at: m[2] as string };
  m = t.match(VALUE_RE);
  if (m) return { f: 'value', slider: m[1] as string };
  return fail(at, `slope(P,Q)·deriv(f,P)·x(P)·y(P)·value(a) 중 하나가 아님 (${s})`);
}

/** 읽는 값(수). 할선의 두 점이 겹치면 그 곡선의 접선 기울기(극한) */
export function readout(p: CoordParams, s: CoordState, e: ReadoutExpr): number {
  switch (e.f) {
    case 'slope': {
      const c = coincide(p, s, e.a, e.b);
      const [x1, y1] = pointXY(p, s, e.a);
      if (c) return dfAt(p, s, c, x1);
      const [x2, y2] = pointXY(p, s, e.b);
      return x1 === x2 ? Number.NaN : (y2 - y1) / (x2 - x1);
    }
    case 'deriv':
      return dfAt(p, s, e.curve, pointXY(p, s, e.at)[0]);
    case 'x':
      return pointXY(p, s, e.at)[0];
    case 'y':
      return pointXY(p, s, e.at)[1];
    case 'value':
      return s.vars[e.slider] ?? Number.NaN;
  }
}

export const readoutKind: KindDef<ReadoutObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['readout', 'label'], ['digits']);
    const src = str(c.readout, `${at} readout`);
    const e = readoutExpr(src, at);
    if (e.f === 'slope') {
      cx.pointRef(e.a, at);
      cx.pointRef(e.b, at);
    } else if (e.f === 'deriv') {
      const cv = cx.curveRef(e.curve, at);
      if (cx.pointRef(e.at, at).on !== cv.id) fail(at, '접점이 그 곡선 위 점이 아님');
    } else if (e.f === 'value') {
      if (!cx.sliders.some((s) => s.id === e.slider)) fail(at, `없는 슬라이더 ${e.slider}`);
    } else cx.pointRef(e.at, at);
    return {
      kind: 'readout',
      src,
      expr: e,
      label: str(c.label, `${at} label`),
      digits: c.digits === undefined ? 2 : int(c.digits, `${at} digits`, 0, 4),
    };
  },
  draw(o, k, { p, s, readouts }) {
    readouts.push({
      key: `r${k}`,
      label: o.label,
      text: fmtNum(readout(p, s, o.expr), o.digits),
    });
  },
  derivOf(p, o) {
    if (o.expr.f === 'deriv') return o.expr.curve;
    if (o.expr.f === 'slope') {
      const a = pointOf(p, o.expr.a);
      if (a.on && a.on === pointOf(p, o.expr.b).on) return a.on;
    }
    return undefined;
  },
  texts: (o) => [o.label],
};
