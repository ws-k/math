// 그릴 목록(상태 → 표시). 화면(Shape.tsx)은 이것을 그리기만 한다.
import { type Drawing, type Mark, r2 } from '../draw.ts';
import { placeLabels } from '../labels.ts';
import { angleMarks, arcMarks, curveMarks, segMark, tagMarks } from './look.ts';
import { circleR, cutArea, round, shMeasures, shoelace } from './measure.ts';
import { P, shDone, shGeom, shUnit, X, Y } from './model.ts';
import { pieceAtTarget, piecesArea, shPiecePts } from './piece.ts';
import { type ShapeParams, type ShState, W } from './types.ts';

/** 이름표(13px 굵게, 대문자 한 자) 상자. 틈은 예전 자리(가운데가 점에서 오른쪽 12, 기준선이 위 10)와 같게 */
export const LABEL = { charW: 9, h: 13, gx: 7.5, gy: 7, dotR: 6 };

export const pts = (p: ShapeParams, ps: { x: number; y: number }[]) =>
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
      a: { cx: X(p, o.x), cy: Y(p, o.y), r: r2(circleR(s, c) * shUnit(p)), class: 'sh-circle' },
    });
  });
  marks.push(...curveMarks(p, s), ...arcMarks(p, s));
  p.segments.forEach(([a, b], i) => {
    marks.push(segMark(p, s, i, a, b));
  });
  marks.push(...angleMarks(p, s));
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
  if (p.pieces) {
    // 빈 틀(점선) 위에 조각들. 조각은 화면(Shape.tsx)이 끄는 요소로 따로 그린다(키 pc<번호>)
    if (p.outline)
      marks.push({
        k: 'outline',
        tag: 'polygon',
        a: {
          points: pts(
            p,
            p.outline.map(([x, y]) => ({ x, y })),
          ),
          class: 'sh-ghost',
        },
      });
    p.pieces.forEach((_, i) => {
      marks.push({
        k: `pc${i}`,
        tag: 'polygon',
        a: {
          points: pts(p, shPiecePts(p, s, i)),
          class: `sh-piece c${i % 3}${pieceAtTarget(p, s, i) ? ' done' : ''}`,
        },
      });
    });
  }
  // 보조점은 그리지 않는다(점·이름표 모두)
  const shownPts = p.points.filter((pt) => !pt.aux);
  const at = shownPts.map((pt) => ({ x: X(p, P(s, pt.id).x), y: Y(p, P(s, pt.id).y) }));
  // 이름표: 가까운 점끼리 겹치지 않고 그림 안에(labels.ts). 아무것도 겹치지 않으면 예전처럼 점의 오른쪽 위
  const labs = placeLabels(
    // 이름표 폭은 글자 수만큼(F′ 은 두 자)
    at.map((q, i) => ({ ...q, n: (shownPts[i] as { id: string }).id.length })),
    at,
    { l: 0, t: 0, r: W, b: shGeom(p).h },
    LABEL,
  );
  shownPts.forEach((pt, i) => {
    const { x, y } = at[i] as { x: number; y: number };
    const r = labs[i] as { l: number; t: number; r: number };
    marks.push(
      pt.drag
        ? { k: `h:${pt.id}`, tag: 'g', a: { transform: `translate(${x} ${y})` } }
        : { k: `pt:${pt.id}`, tag: 'circle', a: { cx: x, cy: y, r: 4, class: 'sh-pt' } },
    );
    marks.push({
      k: `lab:${pt.id}`,
      tag: 'text',
      // 가운데 맞춤 글자(.wgt-svg text)라 상자 가운데에 둔다
      a: { x: r2((r.l + r.r) / 2), y: r2(r.t + 10), class: 'sh-lab' },
      text: pt.id,
    });
  });
  // 그림 위 값은 점·이름표 위에(가려지지 않게) 맨 나중에
  marks.push(...tagMarks(p, s));
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
  if (p.pieces) {
    const outline = p.outline
      ? ` · 빈 틀 넓이 = ${round(shoelace(p.outline.map(([x, y]) => ({ x, y }))), p.digits).s}`
      : '';
    texts.pieces = `조각 넓이의 합 = ${round(piecesArea(p, s), p.digits).s}${outline}`;
  }
  return { marks, texts };
}
