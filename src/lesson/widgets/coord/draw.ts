// 그릴 목록 draw: 객체를 순서대로 종류 표(kinds.ts)에 나눠 주고, 그 뒤에 과제 모드의 그릴 것을 쌓는다.
// 끄는 동안의 갱신은 draw(매개변수, 상태, 크기) → 그릴 목록 하나로 한다. 화면은 이 목록을 React 로 처음 그리고,
// 끄는 동안에는 같은 목록을 DOM 에 직접 적용한다(React 렌더 없음) — 두 갈래로 그리면 어긋난다.
import { placeLabels } from '../labels.ts';
import { frame, r1 } from './frame.ts';
import { kindOf } from './kinds.ts';
import { drawTask } from './task.ts';
import type { Box, CoordParams, CoordState, DrawCtx, Drawing } from './types.ts';

/** 점 이름표(.pname 13px 굵게) 상자: 한 자 약 9px, 높이 13px. 틈은 예전 자리(점에서 오른쪽 10·위 10 기준선)와 같게 */
const LABEL = { charW: 9, h: 13, gx: 10, gy: 7, dotR: 6 };
/** 상자 윗변에서 글자 기준선까지 */
const LABEL_ASCENT = 10;

/**
 * (매개변수, 상태, 크기) → 그릴 것 전부. 화면의 처음 그리기와 끄는 동안의 직접 적용이 이 함수 하나를 쓴다.
 * 끄는 동안 항목이 생기거나 사라지면 직접 적용이 못 따라가므로, 항목은 늘 같은 key 로 두고 hidden 으로 숨긴다.
 */
export function draw(p: CoordParams, s: CoordState, box: Box): Drawing {
  const f = frame(box, p);
  const cx: DrawCtx = {
    p,
    s,
    f,
    fills: [],
    shapes: [],
    items: [],
    tags: [],
    handles: [],
    readouts: [],
    pins: [],
    spots: [],
  };
  for (const [k, o] of p.objects.entries()) kindOf(o).draw?.(o, k, cx);
  drawTask(cx);
  // 이름표: 겹치지 않고 그림(잘라 내는 영역) 안에 드는 자리. 아무것도 겹치지 않으면 예전처럼 점의 오른쪽 위
  const rects = placeLabels(
    cx.pins.map((q) => ({ x: q.x, y: q.y, n: [...q.it.text].length })),
    cx.spots,
    f,
    LABEL,
  );
  cx.pins.forEach((q, i) => {
    const r = rects[i];
    if (!r) return;
    q.it.x = r1(r.l);
    q.it.y = r1(r.t + LABEL_ASCENT);
  });
  // 층: 칠하기(격자 아래, 따로) · 조각 · 곡선·점·직선 · 영역 이름표 — 객체 순서와 상관없이 곡선이 조각에, 이름표가 조각에 가리지 않게
  return {
    fills: cx.fills,
    items: [...cx.shapes, ...cx.items, ...cx.tags],
    handles: cx.handles,
    readouts: cx.readouts,
  };
}
