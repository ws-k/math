// 그릴 목록 draw: 객체를 순서대로 종류 표(kinds.ts)에 나눠 주고, 그 뒤에 과제 모드의 그릴 것을 쌓는다.
// 끄는 동안의 갱신은 draw(매개변수, 상태, 크기) → 그릴 목록 하나로 한다. 화면은 이 목록을 React 로 처음 그리고,
// 끄는 동안에는 같은 목록을 DOM 에 직접 적용한다(React 렌더 없음) — 두 갈래로 그리면 어긋난다.
import { frame } from './frame.ts';
import { kindOf } from './kinds.ts';
import { drawTask } from './task.ts';
import type { Box, CoordParams, CoordState, DrawCtx, Drawing } from './types.ts';

/**
 * (매개변수, 상태, 크기) → 그릴 것 전부. 화면의 처음 그리기와 끄는 동안의 직접 적용이 이 함수 하나를 쓴다.
 * 끄는 동안 항목이 생기거나 사라지면 직접 적용이 못 따라가므로, 항목은 늘 같은 key 로 두고 hidden 으로 숨긴다.
 */
export function draw(p: CoordParams, s: CoordState, box: Box): Drawing {
  const cx: DrawCtx = { p, s, f: frame(box), items: [], handles: [], readouts: [] };
  for (const [k, o] of p.objects.entries()) kindOf(o).draw?.(o, k, cx);
  drawTask(cx);
  return { items: cx.items, handles: cx.handles, readouts: cx.readouts };
}
