// 도형판 타입과 상수. 다른 모든 shape/ 파일이 이것을 가져온다(아래층).
import type { GoalCommon, GoalNum, GoalShape } from '../../goal.ts';

export type ShOn = { seg: [string, string] } | { circle: [string, number] };
export interface ShPoint {
  id: string;
  x?: number;
  y?: number;
  /** 원 위 점의 각도(도, 15의 배수) */
  deg?: number;
  drag: boolean;
  on?: ShOn;
  /** 보조점: 그리지 않는 고정 점(선분 위 점의 끝·선분 끝·수선의 발 직선으로만). 설명 없는 점 이름이 그림에 나오지 않게 */
  aux?: true;
  /** 수선의 발: from 에서 직선 line(고정 점 둘)에 내린 발. 자리는 적지 않고 늘 계산한다 */
  foot?: { from: string; line: [string, string] };
}
/**
 * 측정값. sum·diff·ratio 의 수는 앞 측정값의 번호(길이·각만 — 묶은 값을 다시 묶지 않아 순환·긴 이름이 없다).
 * diff 는 |a − b|(이차곡선 정의가 차의 크기라 부호를 두지 않는다).
 */
export type ShMeasure =
  | { len: [string, string] }
  | { angle: [string, string, string] }
  | { area: number }
  | { sum: number[] }
  | { diff: [number, number] }
  | { ratio: [number, number] };
/** 목표가 견주는 것: 수, 또는 다른 측정값의 번호(PF = PH) */
export type ShIs = { num: GoalNum } | { of: number };
/** 목표: of 는 measures 의 번호(보이는 측정값만 목표로 — 학습자가 읽을 수 있어야 맞출 수 있다) */
export type ShGoal = GoalShape<number, ShIs> & GoalCommon;

export interface ShapeParams {
  grid: { w: number; h: number };
  points: ShPoint[];
  polygons: string[][];
  circles: { c: string; r: number }[];
  segments: [string, string][];
  measures: ShMeasure[];
  digits: number;
  cut?: { piece: string[]; rest: string[]; by: [number, number]; result: [number, number][] };
  /** 화면 위 안내 한 줄(선택) */
  note?: string;
  goal?: ShGoal;
  /** 목표를 이뤘을 때 글(Rich) */
  done?: string;
}
export interface ShState {
  pts: Record<string, { x: number; y: number; deg?: number }>;
  /** 잘라 낸 조각의 이동(격자 칸) */
  cut: [number, number];
}

export const W = 320;
export const CIRCLE_STEP = 15;
