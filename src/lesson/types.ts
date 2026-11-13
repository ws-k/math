// 레슨 데이터 형식. 단원 JSON 의 `lesson` 칸 모양이다.
// 검사기(scripts/content-check.ts)가 Node 로 직접 읽으므로 .tsx 가 아닌 .ts 로 둔다.
//
// 원칙: 앱이 보여 주거나 채점하는 값은 검산 칸에서 만든다. 그래서 보기 글자는 value+format 으로,
// 틀린 곳 찾기의 수식 글자는 sym(계산식)으로, 저울 버튼 글자는 op·value 로 앱이 만들어 낸다 —
// 작성자가 화면 글자를 따로 적으면 검산한 값과 보이는 값이 어긋날 틈이 생긴다.

import type { Example } from '../content/types.ts';

export interface Lesson {
  /** 예상 소요 분. 도입 장면의 "약 N분"으로 보인다 */
  minutes: number;
  scenes: Scene[];
}

/** 부품 지정. type 으로 등록부(widgets/specs.ts)에서 형식 검사·검산 항목 생성을 찾는다 */
export interface WidgetSpec {
  type: string;
  params: Record<string, unknown>;
}

interface Base {
  /** 진행 저장 키. 단원 안에서 겹치면 안 된다 */
  id: string;
  /** 제목 위 작은 꼬리표(오늘의 질문·손으로 해 보기·지름길 …) */
  chip?: string;
  /** 제목. 줄바꿈은 \n */
  title: string;
  lead?: string;
  /** 카드 아래 덧붙이는 글 */
  after?: string;
}

export interface IntroScene extends Base {
  kind: 'intro';
  /** 꼬리표. "약 N분"·"직접 해 보기 N번"은 앱이 레슨에서 세어 덧붙인다 */
  meta?: string[];
}

/** 보기 하나. 화면 글자는 value 를 format 규칙으로 바꿔 만든다 */
export interface Choice {
  /** 기약분수 "a/b" 또는 정수. check 를 sympy 로 계산한 값과 같아야 한다 */
  value: string;
  /** 이 보기 값이 나오는 계산(정답 보기는 문제 조건으로, 오답 보기는 흔한 실수로) */
  check: string;
  /** 오답 보기를 골랐을 때 왜 틀렸는지. 오답 보기에는 필수 */
  feedback?: string;
}

/** 수를 화면 글자로: 반올림 자리수, 천 단위 쉼표, 단위 */
export interface NumFormat {
  digits?: number;
  unit?: string;
}

export interface QuestionScene extends Base {
  kind: 'question';
  widget?: WidgetSpec;
  choices: Choice[];
  format?: NumFormat;
  /** 정답 보기 번호(0부터) */
  answer: number;
  /** 문제 조건으로 정답을 계산하는 sympy 식 */
  answerCheck: string;
  /** 맞힌 뒤 펼쳐지는 첫 줄 */
  reveal: string;
  /** 번호 붙은 생각의 흐름 */
  thoughts?: string[];
  /** 펼친 내용의 마지막 줄 */
  conclude?: string;
}

export interface ExploreScene extends Base {
  kind: 'explore';
  widget: WidgetSpec;
}

export interface TermsScene extends Base {
  kind: 'terms';
  terms: { term: string; body: string }[];
  aside?: string;
}

/** 틀린 곳 찾기의 토큰: 누를 수 있는 식 조각, 또는 등호 */
export type SpotToken = { sym: string; bad?: true } | { sep: '=' };

export interface SpotItem {
  prompt: string;
  /**
   * identity: 토큰으로 만든 등식은 항등식이 아니어야 하고 fix 는 항등식이어야 한다(식 변형 실수).
   * equivalent: from 과 fix 의 해가 같고, 토큰 등식의 해는 달라야 한다(방정식 변형 실수).
   */
  mode: 'identity' | 'equivalent';
  /** equivalent 일 때 변형 전 방정식(누를 수 없음, 화살표 앞에 보인다) */
  from?: string;
  tokens: SpotToken[];
  fix: { sym: string; body: string };
}

export interface SpotScene extends Base {
  kind: 'spot';
  items: SpotItem[];
}

export type SolveItem = Example & {
  /** 힌트 버튼을 누르면 보이는 한 줄 */
  hint?: string;
  /** 답 칸이 비었을 때 보이는 글자(단위 등) */
  placeholder?: string;
};

export interface SolveScene extends Base {
  kind: 'solve';
  items: SolveItem[];
}

export interface SummaryScene extends Base {
  kind: 'summary';
  points: string[];
  /** 끝 표시의 굵은 한 줄 */
  done?: string;
  /** 끝 표시 아래 안내. {{problems}} 는 이 단원 연습문제 수로 바뀐다 */
  next?: string;
}

export type Scene =
  | IntroScene
  | QuestionScene
  | ExploreScene
  | TermsScene
  | SpotScene
  | SolveScene
  | SummaryScene;

export type SceneKind = Scene['kind'];
