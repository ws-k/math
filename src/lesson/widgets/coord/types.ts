// 좌표평면 부품의 타입 전부. 맨 아래층이라 다른 coord/ 파일을 가져오지 않는다 —
// 객체 파일·검사·그리기가 모두 이 타입을 같이 쓰므로, 여기서 위층을 부르면 순환이 생긴다.
//
// 객체 종류를 더할 때: 그 종류의 interface 를 여기 두고 CoordObj 에 이어 붙인다(kinds.ts 가 빠진 종류를 타입 오류로 알려 준다).
import type { GoalNum } from '../../goal.ts';
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
  /** 축 이름(축 끝 글자 '시간(분)' 의 '시간'). 눈금 숫자는 세계 좌표 그대로라 실제 값을 적으려면 좌표를 실제 단위로 둔다 */
  name?: string;
  /** 단위(m·분·km/시). 읽는 값의 단위는 여기서 저절로 정해진다(readout.ts unitOf) — 읽는 값마다 적지 않아 어긋날 수 없다 */
  unit?: string;
  /** 세로축만: 넓이(가로×세로)·기울기(세로/가로) 단위 덮어쓰기. 시간×(km/시)=km 처럼 저절로 만든 단위가 어색할 때 한 번 */
  areaUnit?: string;
  slopeUnit?: string;
}

/** 채점 목표값: 앱이 쓰는 값(value)과 그 값을 문제 조건으로 계산하는 sympy 식(check) */
export interface Target {
  value: string;
  check: string;
}

/**
 * 조각 함수의 한 조각: x 가 [lo, hi] 안이면 y = 식. 끝은 닫힘(그 값을 가짐 — 찬 점 ●) 또는 열림(빈 점 ○).
 * lo = hi 면 한 점(닫힘·닫힘만) — 구멍 자리에 따로 정한 함숫값.
 */
export interface Piece {
  y: string;
  node: Node;
  lo: number;
  hi: number;
  /** 검산용 원문(sympy 글자) */
  loSrc: string;
  hiSrc: string;
  loOpen: boolean;
  hiOpen: boolean;
}

export interface CurveObj {
  kind: 'curve';
  id: string;
  /** 검산·sympy 에 넘기는 식 글자. 조각 곡선이면 Piecewise(…) */
  expr: string;
  /**
   * 곡선 식(TS 계산용). 조각 곡선이면 첫 조각의 식일 뿐이라 직접 쓰면 안 된다 — 값은 curve.ts fAt·curveExact,
   * 식을 통째로 다루는 곳(다항식·칠하기·구분구적·과제)은 형식 검사가 조각 곡선을 막는다(curve.ts wholeCurve)
   */
  node: Node;
  /** 조각 함수·구간만 그리기(한 기제: 구간만 그리기는 조각 하나). 없으면 x 전체에서 식 하나 */
  pieces?: Piece[];
  /** 범례 글(Rich) */
  label?: string;
  tone: Tone;
  /** 정답 곡선: 목표·과제를 이루기 전에는 그리지 않는다(맞힌 뒤 공개) */
  hide?: true;
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
  /**
   * 끄는 x 범위(칸 번호, 양 끝 포함). 끌기·방향키·목표 검산이 모두 이 칸 안만 본다(point.ts xCells) —
   * '크기 0 인 삼각형'처럼 뜻이 없는 자리를 목표가 세지 않게(요청 127), 평균값 정리의 R 을 [P,Q] 안에(요청 139)
   */
  cells?: [number, number];
  /** 그림 위 이름(P, Q). 짧은 글자 */
  name?: string;
  /** 목표 점: 목표·과제를 이루기 전에는 그리지 않는다(맞힌 뒤 공개). 끄는 점은 숨기지 못한다 */
  hide?: true;
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
  /** 구분구적 조각의 작은 어림 ~ 큰 어림(화면 한 줄). 목표에는 못 씀(값이 둘) */
  | { f: 'sums'; rects: string }
  /** 큰 어림·작은 어림·두 어림의 차이(정확한 분수) */
  | { f: 'big' | 'small' | 'gap'; rects: string }
  /**
   * 칠한 영역의 (위 − 아래) 합(정확한 분수). net = 부호 있는 합(속도 → 위치), abs = 부호 뗀 합(속도 → 움직인 거리,
   * 위·아래가 바뀌는 곳에서 끊어 조각마다 부호를 떼고 더함). abs 는 목표에 못 씀(검산이 상태마다 끊을 곳을 다시 찾아야 함)
   */
  | { f: 'net' | 'abs'; fill: string }
  | { f: 'slope'; a: string; b: string }
  | { f: 'deriv'; curve: string; at: string }
  | { f: 'x' | 'y'; at: string }
  | { f: 'value'; slider: string }
  /** 곡선(x 의 다항식)이 가로축과 만나는 서로 다른 점의 개수 = f(x)=0 의 서로 다른 실근 개수 */
  | { f: 'roots'; curve: string }
  /** 두 곡선(다항식)의 교점 개수 = f(x)=g(x) 의 서로 다른 실근 개수 */
  | { f: 'meet'; a: string; b: string }
  /** 슬라이더로 계산하는 식 값(판별식 b**2-4*a*c 등) */
  | { f: 'calc'; src: string; node: Node };
export interface ReadoutObj {
  kind: 'readout';
  src: string;
  expr: ReadoutExpr;
  label: string;
  digits: number;
  /** 유리수면 분수로 보인다(1/2 — 글이 분수로 말하는 값을 0.5 로 보이지 않게). 무리수면 digits 자리 소수 */
  frac?: true;
}
/** 칠하기의 위·아래 경계: 곡선 또는 수평선 y = 값 */
export type Edge = { curve: string } | { n: number };
/** 칠하기 재질. 무늬(soil·water)는 넓은 영역에만 — 좁은 띠(길)·조각은 단색이어야 무늬가 잡음이 되지 않는다 */
export type Look = 'plain' | 'soil' | 'water' | 'road';
/**
 * 칠한 영역의 합을 분수로 정확히 내는 데 필요한 것 — 읽는 값(net·abs)이 가리키는 칠하기(id 가 있는 것)만 갖는다.
 * 위 − 아래는 x 의 다항식이고, 구간 안에서 부호가 바뀌는 곳(근)은 모두 유리수여야 한다(abs 를 그 자리에서 끊으려고).
 */
export interface FillArea {
  /** 위 − 아래(계수, 낮은 차수부터) */
  diff: Rational[];
  /** 검산용 sympy 글자 (위)-(아래) */
  diffSrc: string;
  a: Rational;
  aSrc: string;
  /** 오른쪽 끝(고정일 때). 점을 따라가면 null — 그 점의 x */
  b: Rational | null;
  bSrc: string | null;
  /** 끝이 닿을 수 있는 가장 오른쪽까지의 유리수 근(구간 안, 작은 것부터) */
  cuts: Rational[];
}
/** 칠하기 {id?, fill:{top, bottom?, x:[a, b 또는 점]}, look?, sign?, name?, nameAt?, hide?}: 위 경계와 아래 경계(기본 가로축) 사이 */
export interface FillObj {
  kind: 'fill';
  /** 읽는 값 net·abs 가 가리키는 이름. 있을 때만 area 를 셈한다 */
  id?: string;
  top: Edge;
  bottom: Edge;
  /** 가로 구간(그리기용 수). 끝이 점을 따라가면 hi 는 그 점이 닿는 가장 오른쪽 */
  lo: number;
  hi: number;
  /** 오른쪽 끝이 이 점의 x 를 따라간다(시각을 끌면 그때까지 칠함) */
  toPt?: string;
  /** 부호별 칠하기: 위 경계가 아래보다 위인 곳(pos)과 아래인 곳(neg)을 다른 색으로 — 색이 곧 부호라 재질은 plain 만 */
  sign?: true;
  area?: FillArea;
  look: Look;
  /** 그림 안 이름표(밭·강·길) */
  name?: string;
  /** 이름표 자리(세계 좌표). 없으면 칠한 영역의 무게중심 */
  nameAt?: [number, number];
  /** 맞힌 뒤 칠하기: 목표·과제를 이루기 전에는 그리지 않는다 */
  hide?: true;
}
/**
 * 구분구적 직사각형 {id, rects:{of, x:[a,b], n}}: [a,b] 를 폭이 같은 n 조각으로 나눠 큰 어림·작은 어림을 함께 그린다.
 * 곡선은 구간에서 계속 오르거나 계속 내리는 다항식만 — 그래야 조각마다 양 끝 높이 중 큰 쪽이 그 조각의 가장 높은 곳이라
 * '큰 어림 ≥ 넓이 ≥ 작은 어림'이 늘 맞는다.
 */
export interface RectsObj {
  kind: 'rects';
  id: string;
  of: string;
  from: string;
  to: string;
  a: Rational;
  b: Rational;
  /** 조각 수: 슬라이더 이름 또는 고정 수 */
  n: { slider: string } | { count: number };
  /** 구간에서 오르는 곡선인가(오르면 큰 어림 = 오른쪽 끝 높이) */
  rising: boolean;
}
/** 선분·화살표의 끝: 앞에 나온 점, 또는 좌표 식 [x, y](슬라이더 이름만 — 슬라이더를 따라 움직임, k·a 의 끝 (2k, k)) */
export type SegEnd = { pt: string } | { x: string; y: string; nx: Node; ny: Node };
/** 선분 {segment:[끝, 끝]} · 화살표 {arrow:[꼬리, 머리]}(벡터). 곡선 꼼수 식 없이 세로 벡터도 그린다 */
interface SegBase {
  a: SegEnd;
  b: SegEnd;
  tone: Tone;
  /** 범례 글(Rich) */
  label?: string;
  /** 검산 항목 이름·중복 검사용 글자(O→(2*k,k)) */
  ref: string;
}
export interface SegmentObj extends SegBase {
  kind: 'segment';
}
export interface ArrowObj extends SegBase {
  kind: 'arrow';
}
export type CoordObj =
  | CurveObj
  | PointObj
  | SecantObj
  | TangentObj
  | ReadoutObj
  | FillObj
  | RectsObj
  | SegmentObj
  | ArrowObj;

export interface Slider {
  id: string;
  min: number;
  max: number;
  step: number;
  stepSrc: string;
  /** min 원문(검산·정확한 값 계산용) */
  minSrc: string;
  value: number;
  label: string;
  /** 닿지 못하게 건너뛰는 값(밑 a≠1 등). 슬라이더 칸 위의 값 */
  exclude: number[];
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

/** 옛 형식 목표: 끄는 점이 상대 점에 다가가기(할선 → 접선). 힌트는 선택 */
export interface ApproachGoal {
  approach: [string, string];
  /** 이만큼 가까워지면 목표(세계 x 거리). 0 이면 겹쳐야 */
  within: number;
  hint?: string;
}

/** 목표가 견주는 값: 수(GoalNum) 또는 다른 읽는 값 */
export type GoalIs = { num: GoalNum } | { of: ReadoutExpr };

/**
 * 새 목표(조각 ②). 공통 틀은 src/lesson/goal.ts. 판정은 goalHits(손을 뗀 상태 하나 → 닿은 목표 열쇠들).
 *   visit  여러 곳 가 보기: of 가 at 의 값마다 한 번씩 되게(열쇠 = 곳 번호)
 *   value  값 맞추기: of 가 is 가 되는 자리 places 곳(열쇠 = 그 자리)
 *   place  점 자리 맞추기: 끄는 점을 (x,y) 에. x·y 는 문제의 답이라 검산식(check)을 함께 적는다
 */
export type NewGoal = { hint: string; tol: { src: string; n: number } } & (
  | { kind: 'visit'; of: ReadoutExpr; at: GoalNum[] }
  | { kind: 'value'; of: ReadoutExpr; is: GoalIs; places: number }
  | { kind: 'place'; point: string; x?: Target; y?: Target; i?: number; j?: number }
);

export type Goal = ApproachGoal | NewGoal;

export interface CoordParams {
  mode: Mode;
  x: Axis;
  y: Axis;
  /** 축척 같게: 가로·세로 한 칸의 화면 길이를 같게(지도·밭처럼 모양이 곧 정보일 때). '한 칸 = 10 m' 같은 말은 이때만 */
  equal?: true;
  objects: CoordObj[];
  sliders: Slider[];
  task?: Task;
  goal?: Goal;
  /** 목표가 보는 끄는 점 id. 이 점은 끌 때 칸을 묶지 않는다(snapMult 1 — 좁은 화면에서도 목표 칸을 건너뛰지 않게) */
  goalPts?: string[];
  /** 처음 안내(Rich) */
  intro?: string;
  /** 목표를 이뤘을 때(Rich) */
  done?: string;
  /** 직선 그리기의 두 손잡이 처음 자리(칸 번호) */
  start?: [GridPt, GridPt];
}

// ---- 상태 ----

export interface CoordState {
  /** 목표·과제를 이뤘나 — 숨긴 정답 곡선·목표 점을 이때부터 그린다 */
  solved: boolean;
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
  | { t: 'path'; key: string; d: string; cls: string; look?: Look }
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
  | {
      t: 'label';
      key: string;
      x: number;
      y: number;
      text: string;
      hidden: boolean;
      /** 없으면 점 이름(pname). 'tag' 는 칠한 영역의 이름표(가운데 맞춤) */
      cls?: string;
    };

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

/** 읽는 값 한 줄. parts 가 있으면 조각마다 색을 달리 그린다(작은 어림 ~ 큰 어림) — text 는 그 조각을 이은 것 */
export interface ReadoutLine {
  key: string;
  label: string;
  text: string;
  parts?: { text: string; cls: string }[];
}

export interface Drawing {
  /** 격자 아래에 깔리는 칠하기(밭·강·길) — 격자선이 그 위로 보여 칸을 셀 수 있게 */
  fills: Item[];
  items: Item[];
  handles: HandleItem[];
  readouts: ReadoutLine[];
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
  /** 구분구적 조각(읽는 값 sums·big·small·gap 이 가리킨다) */
  rects: Map<string, RectsObj>;
  /** 이름 붙은 칠하기(읽는 값 net·abs 가 가리킨다) */
  fills: Map<string, FillObj>;
  /** 축척 같게(조각 폭 상한을 셀 때 그림 영역이 달라진다) */
  equal: boolean;
  /** 새 이름을 검사하고 등록한다(중복이면 형식 오류) */
  named(id: unknown, at: string): string;
  /**
   * 앞에 나온 곡선·점. 숨긴 정답(hide)은 다른 객체가 가리키지 못한다 — 그 점의 이름표·접선·읽는 값이
   * 숨긴 자리를 드러낸다. 목표·과제는 parse.ts 에서 숨긴 것도 가리킬 수 있다.
   */
  curveRef(v: unknown, at: string): CurveObj;
  pointRef(v: unknown, at: string): PointObj;
}

/** 그리는 중의 공용 자리. 객체는 순서대로 여기에 쌓는다(그 순서가 곧 그리는 순서) */
export interface DrawCtx {
  p: CoordParams;
  s: CoordState;
  f: Frame;
  /** 격자 아래 칠하기 */
  fills: Item[];
  /** 격자 위, 곡선·점 아래(구분구적 조각 — 곡선이 조각에 가리지 않게) */
  shapes: Item[];
  items: Item[];
  /** 맨 위 이름표(칠한 영역 이름 — 조각·곡선에 가리지 않게) */
  tags: Item[];
  handles: HandleItem[];
  readouts: Drawing['readouts'];
  /** 자리를 나중에 고를 점 이름표(점 px 자리와 함께) — 다른 이름표·점과 겹치지 않게 draw 가 한꺼번에 놓는다 */
  pins: { it: Extract<Item, { t: 'label' }>; x: number; y: number }[];
  /** 이름표가 피할 점 자리(px) */
  spots: { x: number; y: number }[];
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
