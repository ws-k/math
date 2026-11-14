// 직선 객체 두 종류 — 할선 {secant:[P,Q]} 과 접선 {tangent:{on, at}}. 둘은 같은 'line' 항목(key l<순번>)을 그리고
// 할선은 두 점이 겹치면 접선으로 바뀌므로, 그리는 코드를 한 함수로 같이 두려고 한 파일에 묶었다.
import { derivative } from '../../expr.ts';
import { arr, fail, obj } from '../../parse.ts';
import { dfAt } from './curve.ts';
import { fullLine, hidden0 } from './frame.ts';
import { coincide, pointOf, pointXY } from './point.ts';
import type { DrawCtx, KindDef, SecantObj, TangentObj } from './types.ts';

function drawLine(o: SecantObj | TangentObj, k: number, { p, s, f, items }: DrawCtx) {
  let ln: { x1: number; y1: number; x2: number; y2: number } | null = null;
  let tangent = o.kind === 'tangent';
  if (o.kind === 'secant') {
    const [x1, y1] = pointXY(p, s, o.a);
    const [x2, y2] = pointXY(p, s, o.b);
    const c = coincide(p, s, o.a, o.b);
    if (c) {
      // 두 점이 겹치면 할선의 극한 = 접선
      const m = dfAt(p, s, c, x1);
      if (Number.isFinite(m)) ln = fullLine(p, f, x1, y1, m);
      tangent = true;
    } else if (x1 !== x2 && [y1, y2].every(Number.isFinite))
      ln = fullLine(p, f, x1, y1, (y2 - y1) / (x2 - x1));
  } else {
    const [x0, y0] = pointXY(p, s, o.at);
    const m = dfAt(p, s, o.on, x0);
    if (Number.isFinite(m) && Number.isFinite(y0)) ln = fullLine(p, f, x0, y0, m);
  }
  items.push({
    t: 'line',
    key: `l${k}`,
    ...(ln ?? hidden0),
    cls: tangent ? 'tan' : 'sec',
    hidden: !ln,
  });
}

export const secantKind: KindDef<SecantObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['secant']);
    const [a, b] = arr(c.secant, `${at} secant`, 2, 2);
    return { kind: 'secant', a: cx.pointRef(a, at).id, b: cx.pointRef(b, at).id };
  },
  draw: drawLine,
  derivOf(p, o) {
    const a = pointOf(p, o.a);
    if (a.on && a.on === pointOf(p, o.b).on) return a.on;
    return undefined;
  },
};

export const tangentKind: KindDef<TangentObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['tangent']);
    const t = obj(c.tangent, `${at} tangent`, ['on', 'at']);
    const cv = cx.curveRef(t.on, `${at} on`);
    const pt = cx.pointRef(t.at, `${at} at`);
    if (pt.on !== cv.id) fail(at, `접점 ${pt.id} 가 곡선 ${cv.id} 위의 점이 아님`);
    try {
      derivative(cv.node, 'x');
    } catch (e) {
      fail(at, (e as Error).message);
    }
    return { kind: 'tangent', on: cv.id, at: pt.id };
  },
  draw: drawLine,
  derivOf: (_p, o) => o.on,
};
