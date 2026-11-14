// 검산 coordChecks: 미분이 쓰이는 곡선을 먼저 모은 뒤, 객체를 순서대로 종류 표(kinds.ts)에 나눠 주고
// 과제 검산을 맨 뒤에 쌓는다. 항목 순서가 검산 기준선(verify:diff)의 비교 열쇠라 이 순서를 지킨다.
import { exactStr } from '../../expr.ts';
import type { WidgetCheck } from '../specs.ts';
import { goalChecks } from './goal.ts';
import { kindOf } from './kinds.ts';
import { taskChecks, taskDerivOf } from './task.ts';
import type { CheckCtx, CoordParams } from './types.ts';

/** 미분이 쓰이는 곡선(접선·할선 극한·deriv 읽기·접선 과제) */
function derivUsed(p: CoordParams): Set<string> {
  const out = new Set<string>();
  for (const o of p.objects) {
    const c = kindOf(o).derivOf?.(p, o);
    if (c !== undefined) out.add(c);
  }
  const tc = taskDerivOf(p);
  if (tc !== undefined) out.add(tc);
  return out;
}

export function coordChecks(p: CoordParams): WidgetCheck[] {
  const cx: CheckCtx = {
    p,
    vars: ['x', ...p.sliders.map((s) => s.id)],
    fixed: Object.fromEntries(p.sliders.map((s) => [s.id, exactStr(s.value)])),
    range: { x: [p.x.min, p.x.max] },
    deriv: derivUsed(p),
    out: [],
  };
  for (const o of p.objects) kindOf(o).checks?.(o, cx);
  taskChecks(p, cx.out);
  goalChecks(p, cx.out);
  return cx.out;
}
