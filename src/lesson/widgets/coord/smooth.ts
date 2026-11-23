// 형식 검사(coordDef.deep): 미분이 쓰이는 조각 곡선(접선·deriv·겹친 할선)에서, 그 위의 점이 닿는 칸 중
// 매끄럽지 않은 조각 끝(끊긴 경계·꺾인 점·한 점 조각·정의역 끝)이 있으면 오류.
// 그 자리에서 앱은 그 x 의 조각을 미분해 한쪽 미분을 '접선 기울기'로 보이는데, sympy diff(Piecewise) 도 같은 한쪽 값을
// 내므로 검산(parity)은 같다고 통과시킨다 — 수학적으로 틀린 그림이 검산을 빠져나가지 않게 여기서 막는다.
// 작성자는 range·snap 으로 그 칸을 뺀다. 점이 닿는 칸·슬라이더 값을 늘어놓으므로 무거운 검사 쪽(deep)에 둔다.
import { fail } from '../../parse.ts';
import { derivUsed } from './checks.ts';
import { curveVars } from './curve.ts';
import { roughAt } from './piece.ts';
import { worldX, xCells } from './point.ts';
import { sliderCombos } from './slider.ts';
import type { CoordParams } from './types.ts';

export function checkSmooth(p: CoordParams): void {
  const deriv = derivUsed(p);
  for (const c of p.objects) {
    if (c.kind !== 'curve' || c.pieces === undefined || !deriv.has(c.id)) continue;
    const pieces = c.pieces;
    const used = curveVars(c);
    const ids = p.sliders.map((sl) => sl.id).filter((id) => used.has(id));
    const at = `좌표 곡선 ${c.id}`;
    const combos = sliderCombos(p.sliders, ids, at);
    for (const o of p.objects) {
      if (o.kind !== 'point' || o.on !== c.id) continue;
      const { i0, i1 } = o.drag === 'none' ? { i0: o.i, i1: o.i } : xCells(p.x, o);
      for (let i = i0; i <= i1; i++) {
        const x = worldX(p, o, i);
        for (const cb of combos) {
          const env = Object.fromEntries(p.sliders.map((sl) => [sl.id, sl.value]));
          const why = roughAt(pieces, x, { ...env, ...cb.num });
          if (why)
            fail(
              at,
              `x=${x} 은 매끄럽지 않은 조각 끝(${why}) — 점 ${o.id} 가 닿는데 접선·기울기(미분)가 쓰여 한쪽 미분이 보임${cb.text ? ` (${cb.text})` : ''}. range·snap 으로 그 칸을 빼세요`,
            );
        }
      }
    }
  }
}
