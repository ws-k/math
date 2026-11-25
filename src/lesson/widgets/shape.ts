// 도형판 부품의 입구(순수 모델). 화면(Shape.tsx)·검산(checks)·테스트는 이 파일만 가져온다.
// 실제 코드는 shape/ 폴더에 나뉘어 있다 — 기능이 늘 때 한 파일이 1,000줄을 넘어 읽기 어려워지지 않게(좌표평면과 같은 꼴).
//   types(타입·상수) ← 아래층
//   model(좌표·상태·끌기·방향키·수선의 발) · measure(측정값 계산·이름·글)
//   goal(목표 판정·닿는 자리 늘어놓기) · draw(그릴 목록) · checks(sympy 검산) · parse(형식 검사) · deep(늘어놓는 형식 검사)
//
// 점은 격자점(정수 좌표)에 붙고, 제약이 있으면 선분 위의 격자점이나 원 위(15° 간격)로만 움직인다.
// 길이·각·넓이는 앱이 부동소수로 계산해 digits 자리로 반올림해 보이고, checks 가 같은 점에서 sympy 로
// 정확한 값을 계산해 반올림이 맞는지 대조한다(approx). 격자점만 쓰는 넓이는 분수로 정확히 대조한다.
// 잘라 옮기기(cut): 조각(piece)을 끌어 by 만큼 옮기면 다른 모양(result)이 되고 넓이는 그대로임을 보인다.
// 목표(goal, 조각 ②): 측정값 하나를 목표값으로("넓이를 20으로") 또는 여러 값에 한 번씩("60°·90°·120°").
// 공통 규칙(손을 뗀 자리만 판정·진행 표시·힌트)은 src/lesson/goal.ts.
// 측정값 묶기(요청 106): 앞 측정값들의 합·차·비도 측정값(PF+PG, |PF−PG|, AD÷AB)이고, 목표는 수 대신 다른
// 측정값과 견줄 수 있다(PF = PH). 이차곡선의 정의·닮음비를 "읽어서 계산"이 아니라 "끌어서 같게"로 보이려는 것.
// 수선의 발(foot): 끄는 점에서 고정 직선에 내린 발 — 상태의 일부로 늘 다시 계산해 끄는 점을 따라온다.
import { shapeChecks } from './shape/checks.ts';
import { shapeDeep } from './shape/deep.ts';
import { parseShape } from './shape/parse.ts';
import type { ShapeParams } from './shape/types.ts';
import type { WidgetDef } from './specs.ts';

export { shDraw } from './shape/draw.ts';
export { shGoalHits, shGoalNeed } from './shape/goal.ts';
export { shMeasures } from './shape/measure.ts';
export { shDone, shDrag, shGeom, shInit, shKey, shUnit } from './shape/model.ts';
export {
  shPieceDrag,
  shPieceDrop,
  shPieceKey,
  shPieceMatch,
  shPiecePts,
  shPiecesDone,
  shPieceTurn,
} from './shape/piece.ts';
export type {
  ShapeParams,
  ShGoal,
  ShIs,
  ShMeasure,
  ShOn,
  ShPiece,
  ShPoint,
  ShPose,
  ShState,
} from './shape/types.ts';
export { W } from './shape/types.ts';

export const shapeDef: WidgetDef<ShapeParams> = {
  parse: parseShape,
  deep: shapeDeep,
  checks: shapeChecks,
  texts: (p) => [
    ...(p.note ? [p.note] : []),
    ...(p.done ? [p.done] : []),
    ...(p.goal ? [p.goal.hint] : []),
  ],
  hasGoal: (p) => !!p.cut || !!p.goal || !!p.pieces,
};
