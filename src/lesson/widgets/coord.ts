// 좌표평면 부품의 입구. 화면(Coord.tsx)·검산(checks)·채점(grade.ts)·테스트는 이 파일만 가져온다.
// 실제 코드는 coord/ 폴더에 객체 종류별로 나뉘어 있다 — 그림 객체가 늘어날 때 종류 하나가 파일 하나가 되게.
//   types(타입) · common(형식 검사 도우미) · frame(px 변환·눈금) ← 아래층
//   curve(+ piece: 조각 함수·구간만 그리기) · point · line(할선·접선) · readout · fill(칠하기) · rects(구분구적)
//     ← 객체 종류마다 형식 검사·그리기·검산 몫
//   kinds(종류 표) · task(과제) · goal(목표) · model(상태·손 조작) · parse · draw · checks ← 나눠 주는 곳
//   slider(슬라이더) · poly(다항식·실근 개수) ← 목표가 값을 분수로 정확히 견주려고 쓰는 도우미
//
// 매개변수는 "이름 붙은 객체 + 참조" 목록이다:
//   {id:'f', curve:'x**2'} · {id:'P', point:{on:'f', x:1}} · {secant:['P','Q']} ·
//   {tangent:{on:'f', at:'P'}} · {readout:'slope(P,Q)', label:'…'} ·
//   {fill:{top:'f', x:[0,30]}, look:'soil', name:'밭'} · {id:'R', rects:{of:'f', x:[0,30], n:'n'}} ·
//   {id:'F', fill:{top:'v', x:[0,'B']}, sign:true} + {readout:'net(F)'}·{readout:'abs(F)'}
import { compareAnswer } from '../../lib/answer.ts';
import { parseSym } from '../sym.ts';
import { coordChecks } from './coord/checks.ts';
import { checkReachable, goalTexts } from './coord/goal.ts';
import { kindOf } from './coord/kinds.ts';
import { parseCoord } from './coord/parse.ts';
import { checkPolyCurves } from './coord/readout.ts';
import type { CoordParams } from './coord/types.ts';
import type { WidgetDef } from './specs.ts';

export { coordChecks } from './coord/checks.ts';
export { MAX_CELLS, MAX_SNAPS } from './coord/common.ts';
export { dfAt, fAt } from './coord/curve.ts';
export { draw } from './coord/draw.ts';
export {
  AXIS_LABEL_GAP,
  axisLabel,
  fmtNum,
  frame,
  grid,
  labelWidth,
  MIN_BOX_H,
  MIN_PLOT,
  MIN_SNAP_PX,
  NARROW_BOX_W,
  narrowFrame,
  snapMult,
  tickText,
  toPx,
  toWorld,
} from './coord/frame.ts';
export { goalHits, goalMet, goalNeed } from './coord/goal.ts';
export {
  addUser,
  dragPoint,
  freeSpot,
  gridAt,
  initial,
  keyMove,
  moveUser,
  removeUser,
} from './coord/model.ts';
export { parseCoord } from './coord/parse.ts';
export { pointXY } from './coord/point.ts';
export { polyOf, rationalRoots, rootCount, rootsBetween } from './coord/poly.ts';
export { absCheckSym, readout, readoutVal, unitOf } from './coord/readout.ts';
export { MIN_RECT_PX, sumsAt } from './coord/rects.ts';
export { sliderSnap, sliderText } from './coord/slider.ts';
export { grade, lineTarget, userSlope } from './coord/task.ts';
export type {
  Axis,
  Box,
  CoordObj,
  CoordParams,
  CoordState,
  CurveObj,
  Drawing,
  Edge,
  FillObj,
  Frame,
  Goal,
  GoalIs,
  Grid,
  HandleItem,
  Item,
  Look,
  Mode,
  NewGoal,
  PointObj,
  ReadoutExpr,
  ReadoutLine,
  ReadoutObj,
  RectsObj,
  SecantObj,
  Slider,
  TangentObj,
  Target,
  Task,
  Tone,
  Verdict,
} from './coord/types.ts';

/** 목표 값끼리 비교(앱 채점에 쓰는 값이 분수 글자로 같은가) — 테스트용 */
export const sameValue = (a: string, b: string) => compareAnswer(a, b, 'fraction') === 'correct';

export const coordDef: WidgetDef<CoordParams> = {
  parse: parseCoord,
  // 무거운 형식 검사(값 조합·닿는 상태를 늘어놓음)는 검사기에서만 — 화면은 장면을 열 때 parse 만 한다
  deep(p) {
    checkPolyCurves(p);
    checkReachable(p);
  },
  checks: coordChecks,
  texts(p) {
    const out: string[] = [];
    if (p.intro) out.push(p.intro);
    if (p.done) out.push(p.done);
    for (const s of p.sliders) out.push(s.label);
    for (const o of p.objects) out.push(...(kindOf(o).texts?.(o) ?? []));
    out.push(...goalTexts(p));
    return out;
  },
  // 결론 글을 목표 뒤로 미룰 수 있는 부품인가(장면 afterGoal). 과제 모드는 '확인하기'가 목표다
  hasGoal: (p) => p.goal !== undefined || p.task !== undefined,
};

/** 범례 등에서 식 글자를 다시 읽을 때 */
export const parseExpr = parseSym;
