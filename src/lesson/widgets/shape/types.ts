// 도형판 타입과 상수. 다른 모든 shape/ 파일이 이것을 가져온다(아래층).
import type { GoalCommon, GoalNum, GoalShape } from '../../goal.ts';

/** 원 위 점: 중심과 반지름(수 — 0.5 단위, 또는 고정 점 id — 그 점까지 거리, 컴퍼스로 √2 옮기기) */
export type ShOn =
  | { seg: [string, string] }
  | { circle: [string, number | string] }
  /** curves 의 번호(곡선 위 점 — deg 는 매개변수) */
  | { curve: number };
/** 곡선: 중심 c, 반지름 a(가로)·b(세로). 쌍곡선은 가로로 벌어진 두 갈래 x²/a² − y²/b² = 1 */
export type ShCurve =
  | { ellipse: { c: string; a: number; b: number } }
  | { hyperbola: { c: string; a: number; b: number } };
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
  /**
   * 따라오는 점(모양 지키며 끌기): x·y 를 다른 점의 x·y 로 받는다. 직사각형의 한 꼭짓점을 끌면 이웃 꼭짓점이
   * 가로·세로만 따라와 직사각형이 그대로다 — 꼭짓점 넷을 따로 끌게 하면 '넓이 12 인 직사각형' 대신 아무 사각형이 된다.
   */
  follow?: { x?: string; y?: string };
  /** 마주 보는 점: of 를 점 about 에 대해 점대칭, 또는 직선 across 에 대해 선대칭한 자리. 늘 계산한다 */
  mirror?: { of: string; about: string } | { of: string; across: [string, string] };
  /** 끄는 자유 점이 닿는 격자 범위(양끝 포함). 없으면 격자 전체 — 끄는 점이 셋 이상일 때 판정 자리를 줄인다 */
  range?: { x: [number, number]; y: [number, number] };
}
/**
 * 측정값. sum·diff·ratio·sq·sin 의 수는 앞 측정값의 번호(길이·각·제곱만 — 묶은 값을 다시 묶지 않아 순환·긴 이름이 없다).
 * diff 는 |a − b|(이차곡선 정의가 차의 크기라 부호를 두지 않는다). arc 는 arcs 의 번호(호 길이), around 는
 * circles 의 번호(원주), sq 는 길이의 제곱(AB²), sin 은 각의 사인(사인법칙 BC ÷ sin A).
 */
export type ShMeasure = (
  | { len: [string, string] }
  | { angle: [string, string, string] }
  | { area: number }
  | { sum: number[] }
  | { diff: [number, number] }
  | { ratio: [number, number] }
  | { arc: number }
  | { around: number }
  | { sq: number }
  | { sin: number }
) &
  ShMeasureOpts;
/** 측정값을 보이는 방법 */
export interface ShMeasureOpts {
  /** 이름 대신 적는 글(가로·세로·∠A) */
  label?: string;
  /** 그림 위에도 값을 적는다(길이는 변 바깥, 넓이는 가운데, 각은 꼭짓점 안쪽, 호는 호 바깥) */
  tag?: true;
  /** 각: 꼭짓점에 각 호(직각이면 네모)를 그린다 */
  mark?: true;
  /** 각: A 에서 C 로 시계 반대 방향으로 잰 각(0°~360°) — 180° 넘는 오목한 각을 재려고. 없으면 작은 쪽(0°~180°) */
  ccw?: true;
}
/** 원(반지름이 수, 또는 through 점까지 거리 — 끄는 점이면 컴퍼스처럼 원이 늘고 준다) */
export type ShCircle = { c: string; r: number } | { c: string; through: string };
/** 선분 그리기 방법: 점선(숨은 선·보조선), 연장선(격자 끝까지 늘인 직선) */
export interface ShSegStyle {
  dash?: true;
  extend?: true;
}
/** 길이 단위(넓이는 제곱) */
export const UNITS = ['mm', 'cm', 'm', 'km'] as const;
/** 목표가 견주는 것: 수, 또는 다른 측정값의 번호(PF = PH) */
export type ShIs = { num: GoalNum } | { of: number };
/** 목표: of 는 measures 의 번호(보이는 측정값만 목표로 — 학습자가 읽을 수 있어야 맞출 수 있다) */
export type ShGoal = GoalShape<number, ShIs> & GoalCommon;

export interface ShapeParams {
  grid: { w: number; h: number };
  points: ShPoint[];
  polygons: string[][];
  circles: ShCircle[];
  segments: [string, string][];
  /** segments 와 같은 차례의 그리기 방법(객체로 적은 선분이 하나라도 있을 때만) */
  segStyle?: ShSegStyle[];
  /** 곡선(타원·쌍곡선) — 그 위 점은 on: { curve: 번호 } */
  curves?: ShCurve[];
  /** 원 위 호(중심 c, from 에서 to 까지 시계 반대 방향) — 강조해 그리고 길이를 잴 수 있다 */
  arcs?: { c: string; from: string; to: string }[];
  /** 길이 단위(없으면 단위 없이) */
  unit?: (typeof UNITS)[number];
  measures: ShMeasure[];
  digits: number;
  cut?: { piece: string[]; rest: string[]; by: [number, number]; result: [number, number][] };
  /** 끌어 옮기고 돌리는 조각들(piece.ts) */
  pieces?: ShPiece[];
  /** 조각으로 채울 빈 틀(점선, 격자점 목록) */
  outline?: [number, number][];
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
  /** 조각마다 자리(pieces 가 있을 때만) */
  pcs?: ShPose[];
}
/** 조각의 자리: 시계 반대 방향 90° 돌린 횟수 t(0~3), 옮긴 격자 칸 d */
export interface ShPose {
  t: number;
  d: [number, number];
}
/** 조각: 처음 꼭짓점 at, 목표 꼭짓점 to(형식 검사가 돌리고 옮겨 닿는 자리 pose 를 찾아 둔다) */
export interface ShPiece {
  at: [number, number][];
  to: [number, number][];
  pose: ShPose;
}

export const W = 320;
export const CIRCLE_STEP = 15;
