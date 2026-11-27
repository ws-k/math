// 객체 종류 목록 — 나눠 주는 곳(parse·draw·checks·texts)이 보는 단 하나의 표.
// 종류를 더할 때는 종류 파일을 만들고 여기에 한 줄을 보탠다. CoordObj 에 있는 종류가 빠지면 타입 오류가 난다.
import { barsKind } from './bars.ts';
import { ciKind } from './ci.ts';
import { curveKind } from './curve.ts';
import { fillKind } from './fill.ts';
import { secantKind, tangentKind } from './line.ts';
import { rightKind, stairKind, vlineKind } from './mark.ts';
import { shadeKind } from './normal.ts';
import { pointKind } from './point.ts';
import { readoutKind } from './readout.ts';
import { rectsKind } from './rects.ts';
import { arrowKind, segmentKind } from './segment.ts';
import type { CoordObj, KindDef } from './types.ts';

/**
 * 열쇠 = kind = 매개변수 객체에서 그 종류를 알아보는 열쇠 이름.
 * 적는 순서가 알아보는 순서다(한 객체에 열쇠가 둘이면 앞 종류로 읽고, 형식 검사가 남는 열쇠를 거른다).
 */
export const KINDS: { [K in CoordObj['kind']]: KindDef<Extract<CoordObj, { kind: K }>> } = {
  curve: curveKind,
  point: pointKind,
  secant: secantKind,
  tangent: tangentKind,
  readout: readoutKind,
  fill: fillKind,
  rects: rectsKind,
  segment: segmentKind,
  arrow: arrowKind,
  bars: barsKind,
  shade: shadeKind,
  ci: ciKind,
  vline: vlineKind,
  right: rightKind,
  stair: stairKind,
};

/** 객체의 종류 정의. 종류별 정의를 공통 모양으로 다루려고 한 번 넓혀 준다(KindDef 는 메서드 꼴이라 안전) */
export const kindOf = (o: CoordObj) => KINDS[o.kind] as KindDef<CoordObj>;
