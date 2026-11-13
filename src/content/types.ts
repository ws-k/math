// 콘텐츠 데이터 형식. content/units/<id>.json 과 content/curriculum.json 의 모양을 정의한다.

export type Level = '기초' | '표준' | '수능형' | '응용';

/** int: 정수, fraction: 기약분수 "a/b"(정수도 허용), expr: 식, choice: 오지선다 번호 "1"~"5" */
export type AnswerType = 'int' | 'fraction' | 'expr' | 'choice';

export interface Step {
  title: string;
  body: string;
}

export interface Problem {
  id: string;
  level: Level;
  q: string;
  choices: string[] | null;
  answer: string;
  answerType: AnswerType;
  /** 화면에 보여 줄 정답(LaTeX 포함 가능). 없으면 answer 를 그대로 보여 준다. */
  answerTex?: string;
  /** sympy 문법의 검산식. 계산 결과가 answer 와 같아야 한다. */
  check: string;
  /** choice 문제일 때 각 보기의 값(sympy 문법). 정답 번호의 값만 check 와 같아야 한다. */
  choiceChecks?: string[];
  figure?: string | null;
  /** 필요한 개념·공식 (힌트) */
  concepts?: string[];
  steps: Step[];
  tip?: string;
  /** 생성기로 만든 문제면 생성기 이름과 시드 */
  generator?: string;
  seed?: number;
}

export interface Example {
  q: string;
  concepts?: string[];
  steps: Step[];
  tip?: string;
  answer: string;
  answerType: AnswerType;
  check: string;
  choices?: string[] | null;
  choiceChecks?: string[];
}

export interface Unit {
  id: string;
  course: string;
  unit: string;
  title: string;
  prereq: string[];
  suneung: string[];
  hours: number;
  concept: { heading: string; body: string }[];
  formulas: string[];
  examples: Example[];
  generators: string[];
  problems: Problem[];
}

export type Track = 'common' | 'prob' | 'calc' | 'geo';

export interface CurriculumUnit {
  id: string;
  course: string;
  title: string;
  prereq: string[];
  topics: string[];
  keyFormula: string | null;
  hours: number;
  track: Track;
  /** 이 단원이 주 단원인 수능 문항 (예: "공통 5") */
  suneung: string[];
  /** 이 단원이 풀이 도구로 쓰이는 수능 문항 */
  suneungTools: string[];
}

export interface Curriculum {
  courses: { id: string; name: string; track: Track }[];
  units: CurriculumUnit[];
}
