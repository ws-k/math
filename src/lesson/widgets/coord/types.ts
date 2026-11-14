// 좌표평면 부품의 타입 전부. 맨 아래층이라 다른 coord/ 파일을 가져오지 않는다 —
// 객체 파일·검사·그리기가 모두 이 타입을 같이 쓰므로, 여기서 위층을 부르면 순환이 생긴다.
//
// 객체 종류를 더할 때: 그 종류의 interface 를 여기 두고 CoordObj 에 이어 붙인다(kinds.ts 가 빠진 종류를 타입 오류로 알려 준다).
import type { GridPt } from '../../grade.ts';
import type { Node, Rational } from '../../sym.ts';
import type { WidgetCheck } from '../specs.ts';

export type Mode = 'explore' | 'plot' | 'line' | 'connect' | 'sketch';
export type Tone = 'main' | 'soft' | 'accent';

export interface Axis {
  /** 원문(sympy 식 글자) — 검산에 그대로 넘긴다 */
  min: string;
  max: string;
  step: string;
  lo: number;
  hi: number;
  /** 칸 간격(수) */
  st: number;
  /** 칸 간격이 유리수면 분수, π 가 든 간격이면 null */
  exact: Rational | null;
}

/** 채점 목표값: 앱이 쓰는 값(value)과 그 값을 문제 조건으로 계산하는 sympy 식(check) */
export interface Target {
  value: string;
  check: string;
}

export interface CurveObj {
  kind: 'curve';
  id: string;
  expr: string;
  node: Node;
  /** 범례 글(Rich) */
  label?: string;
  tone: Tone;
}
export interface PointObj {
  kind: 'point';
  id: string;
  /** 곡선 위 점이면 곡선 id. 아니면 칸 위 점 */
  on?: string;
  drag: 'none' | 'x' | 'xy';
  /** 곡선 위 점이 x 로 움직이는 간격(원문). 칸 위 점은 칸 간격 */
  snap: string;
  snapN: number;
  /** 처음 자리(칸 번호) */
  i: number;
  j: number;
  /** 그림 위 이름(P, Q). 짧은 글자 */
  name?: string;
}
export interface SecantObj {
  kind: 'secant';
  a: string;
  b: string;
}
export interface TangentObj {
  kind: 'tangent';
  on: string;
  at: string;
}
export type ReadoutExpr =
  | { f: 'slope'; a: string; b: string }
  | { f: 'deriv'; curve: string; at: string }
  | { f: 'x' | 'y'; at: string }
  | { f: 'value'; slider: string };
export interface ReadoutObj {
  kind: 'readout';
  src: string;
  expr: ReadoutExpr;
  label: string;
  digits: number;
}
export type CoordObj = CurveObj | PointObj | SecantObj | TangentObj | ReadoutObj;

export interface Slider {
  id: string;
  min: number;
  max: number;
  step: number;
  stepSrc: string;
  value: number;
  label: string;
}

export type Task =
  | { kind: 'point'; x: Target; y: Target; i: number; j: number }
  | { kind: 'pointsOn'; curve: string; count: number }
  | {
      kind: 'line';
      slope?: Target;
      through?: { x: Target; y: Target };
      intercept?: Target;
      tangent?: { curve: string; at: string; slope: string; y: string };
    }
  | { kind: 'sketch'; curve: string; tol: string; tolN: number };

export interface Goal {
  approach: [string, string];
  /** 이만큼 가까워지면 목표(세계 x 거리). 0 이면 겹쳐야 */
  within: number;
}

export interface CoordParams {
  mode: Mode;
  x: Axis;
  y: Axis;
  objects: CoordObj[];
  sliders: Slider[];
  task?: Task;
  goal?: Goal;
  /** 처음 안내(Rich) */
  intro?: string;
  /** 목표를 이뤘을 때(Rich) */
  done?: string;
  /** 직선 그리기의 두 손잡이 처음 자리(칸 번호) */
  start?: [GridPt, GridPt];
}

// ---- 상태 ----

export interface CoordState {
  vars: Record<string, number>;
  /** 움직이는 점의 칸 번호(곡선 위 점은 i 만 쓴다) */
  pts: Record<string, GridPt>;
  /** 찍은 점(plot·connect) 또는 직선 손잡이 두 개(line) */
  user: GridPt[];
  /** 그은 선(세계 좌표). sketch */
  stroke: [number, number][];
}

// ---- 화면 좌표 ----

export interface Box {
  w: number;
  h: number;
}
export interface Frame {
  l: number;
  r: number;
  t: number;
  b: number;
}

// ---- 채점 ----

export interface Verdict {
  ok: boolean;
  /** 화면에 보일 까닭(틀렸을 때). 맞으면 p.done 을 보인다 */
  why: string;
}

// ---- 그릴 목록 ----

export type Item =
  | { t: 'path'; key: string; d: string; cls: string }
  | {
      t: 'line';
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      cls: string;
      hidden: boolean;
    }
  | { t: 'dot'; key: string; x: number; y: number; cls: string; hidden: boolean }
  | { t: 'label'; key: string; x: number; y: number; text: string; hidden: boolean };

export interface HandleItem {
  key: string;
  x: number;
  y: number;
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
}

export interface Drawing {
  items: Item[];
  handles: HandleItem[];
  readouts: { key: string; label: string; text: string }[];
}

// ---- 눈금 ----

export interface Grid {
  xs: { px: number; k: number; label: string | null; axis: boolean }[];
  ys: { px: number; k: number; label: string | null; axis: boolean }[];
}

// ---- 객체 종류 하나가 맡는 일 ----
// 종류마다 형식 검사·그리기·검산·글 모음이 파일 곳곳에 흩어져 있으면, 종류 하나를 더할 때 여러 곳을 고쳐야 한다.
// 그래서 한 종류의 몫을 이 모양 하나로 묶고, 나눠 주는 곳(parse·draw·checks)은 종류를 모른 채 돌기만 한다.

/** 형식 검사 중 앞에서 읽은 것들. 객체는 앞에 나온 객체만 참조할 수 있다 */
export interface ParseCtx {
  x: Axis;
  y: Axis;
  sliders: Slider[];
  /** 곡선 식에 쓸 수 있는 변수(x 와 슬라이더) */
  vars: string[];
  /** 슬라이더 처음 값(곡선 위 점이 정의되는지 볼 때) */
  env0: Record<string, number>;
  curves: Map<string, CurveObj>;
  points: Map<string, PointObj>;
  /** 새 이름을 검사하고 등록한다(중복이면 형식 오류) */
  named(id: unknown, at: string): string;
  curveRef(v: unknown, at: string): CurveObj;
  pointRef(v: unknown, at: string): PointObj;
}

/** 그리는 중의 공용 자리. 객체는 순서대로 여기에 쌓는다(그 순서가 곧 그리는 순서) */
export interface DrawCtx {
  p: CoordParams;
  s: CoordState;
  f: Frame;
  items: Item[];
  handles: HandleItem[];
  readouts: Drawing['readouts'];
}

/** 검산 중의 공용 자리 */
export interface CheckCtx {
  p: CoordParams;
  /** 곡선 식에 쓰는 변수(x 와 슬라이더) */
  vars: string[];
  /** 슬라이더는 처음 값으로 고정해 견준다 */
  fixed: Record<string, string>;
  range: { x: [string, string] };
  /** 미분이 쓰이는 곡선 id */
  deriv: Set<string>;
  out: WidgetCheck[];
}

/**
 * 객체 종류 하나. 매개변수 객체에서 이 종류를 알아보는 열쇠 이름은 kinds.ts 의 KINDS 열쇠(= kind)와 같다.
 * 메서드 꼴로 적는 까닭: 종류별 정의(KindDef<CurveObj>)를 KindDef<CoordObj> 로 한데 다룰 수 있게(매개변수 쌍변성).
 */
export interface KindDef<O extends CoordObj> {
  /** 형식 검사. 다른 객체가 참조할 수 있게 ParseCtx 의 표에 등록하는 것도 여기서 한다 */
  parse(raw: unknown, at: string, cx: ParseCtx): O;
  /** 그릴 목록 기여. k 는 객체 순번(그릴 목록 key 의 숫자) */
  draw?(o: O, k: number, cx: DrawCtx): void;
  /** 검산 항목 기여 */
  checks?(o: O, cx: CheckCtx): void;
  /** 이 객체가 미분을 쓰는 곡선 id(접선·할선 극한 등). 없으면 undefined */
  derivOf?(p: CoordParams, o: O): string | undefined;
  /** 문구 검사에 넘길 글 */
  texts?(o: O): string[];
}
