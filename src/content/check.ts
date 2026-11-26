// 형식 검사와 검산 항목의 공용 부분. 단원 검사(scripts/content-check.ts)와 레슨 검사(src/lesson/schema.ts)가
// 같은 규칙을 쓰도록 한 곳에 둔다 — 두 벌이면 한쪽만 고쳐져 레슨 답이 더 느슨하게 검사될 수 있다.
import { renderRich } from '../lib/math.ts';
import type { Example, Problem } from './types.ts';

/** 답과 검산식을 비교하는 기존 항목(int·fraction·expr·choice) */
export interface AnswerCheck {
  ref: string;
  unit: string;
  answer: string;
  answerType: string;
  check: string;
  choiceChecks?: string[];
}

/**
 * 틀린 곳 찾기: 틀린 식은 성립하지 않고 고친 식은 성립하는가. 식은 등식·부등식(<,>,<=,>=), value 면 관계 없는 식.
 * value 의 기준은 보이는 식 from 이나 숨은 sympy 검산식 check 하나
 */
export interface SpotCheck {
  ref: string;
  unit: string;
  kind: 'spot';
  mode: 'identity' | 'equivalent' | 'value';
  from?: string;
  check?: string;
  wrong: string;
  fixed: string;
}

/** 식 변형 전후가 같은 해를 갖는가(expect=true) 또는 달라지는가(expect=false) */
export interface EquivCheck {
  ref: string;
  unit: string;
  kind: 'equiv';
  before: string;
  after: string;
  expect: boolean;
}

/** 두 등식이 같은 식인가(왼쪽−오른쪽이 같다). 장면마다 따로 적은 같은 방정식이 어긋나지 않았나 */
export interface SameEqCheck {
  ref: string;
  unit: string;
  kind: 'sameeq';
  a: string;
  b: string;
}

/** 무리수 근삿값: expr 을 digits 자리에서 반올림(0.5 는 0 에서 먼 쪽)하면 value 인가 */
export interface ApproxCheck {
  ref: string;
  unit: string;
  kind: 'approx';
  expr: string;
  value: string;
  digits: number;
}

/**
 * 그래프 계산기(src/lesson/expr.ts)와 sympy 가 같은 식을 같은 값으로 계산하는가. points 의 각 점에서
 * TS 가 낸 값(values, 정의 안 되면 null)과 sympy 값이 상대오차 1e-9 안이고, 정의 안 되는 자리가 같아야 한다.
 */
export interface ParityCheck {
  ref: string;
  unit: string;
  kind: 'parity';
  expr: string;
  points: Record<string, string>[];
  values: (number | null)[];
}

/** 좌표 화면(격자 칸 간격·범위). 모두 sympy 식 글자 */
export interface PlotView {
  x: [string, string];
  y: [string, string];
  sx: string;
  sy: string;
}

/** 좌표 찍기·그리기 과제가 풀 수 있는 문제인가(범위 안 격자로 답을 낼 수 있나) */
export type PlotCheck = {
  ref: string;
  unit: string;
  kind: 'plot';
  view: PlotView;
} & (
  | { task: 'point'; x: string; y: string }
  | { task: 'pointsOn'; curve: string; count: number }
  | { task: 'line'; slope?: string; through?: [string, string]; intercept?: string }
  | { task: 'sketch'; curve: string; tol: string }
);

/**
 * 값이 방정식의 해인가. 미지수는 하나여야 하고(이름은 상관없음), 값이 해 집합 안에 있으면 된다(첫 해가 아니어도).
 * digits 가 있으면 근삿값: 어느 실수 해를 그 자리에서 반올림한 값이 value 와 같으면 된다.
 */
export interface RootCheck {
  ref: string;
  unit: string;
  kind: 'root';
  eq: string;
  value: string;
  digits?: number;
}

/**
 * 부품 목표 판정(원칙 P7). 끌기·슬라이더로 닿는 모든 상태(states: 상태 기호 → 정확한 값 글자)에서
 * 앱이 목표마다 '닿았다'고 본 상태 번호(hits)가 sympy 가 다시 판정한 것과 같은가(verify.py check_goal).
 * of 는 재는 값의 성분(점 자리 목표면 x·y 둘), roots 면 그 식(x 의 식)의 서로 다른 실근 개수를 값으로 쓴다.
 * targets 는 목표마다 성분별 견줄 식(상태 기호를 써도 됨 — 다른 읽는 값과 견줄 때).
 * 목표마다 need 곳 이상 닿아야 하고, tol(허용 오차) 이 0 이 아니면 정확히 need 곳이어야 한다(원칙 P10).
 */
export interface GoalCheck {
  ref: string;
  unit: string;
  kind: 'goal';
  of: { expr: string; roots?: true }[];
  targets: string[][];
  tol: string;
  states: Record<string, string>[];
  hits: number[][];
  need: number;
}

export type CheckItem =
  | GoalCheck
  | RootCheck
  | AnswerCheck
  | SpotCheck
  | EquivCheck
  | SameEqCheck
  | ApproxCheck
  | ParityCheck
  | PlotCheck;

const TYPES = new Set(['int', 'fraction', 'expr', 'choice']);
/** 숫자만 적은 식: 정수 · a/b · Rational(a,b) · Integer(a). 분자·분모를 꺼낸다 */
const NUM_ONLY =
  /^\s*(?:(-?\d+)(?:\s*\/\s*(\d+))?|Rational\(\s*(-?\d+)\s*,\s*(\d+)\s*\)|Integer\(\s*(-?\d+)\s*\))\s*$/;
const gcdN = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcdN(b, a % b));

/**
 * 계산 없이 답을 그대로 적은 검산식 (예: "8", "5/3", "Rational(5,3)", "8/1").
 * 약분이 남은 분수("Rational(360,8)", "20/8")는 계산으로 본다 — 생성기가 Rational(360, n) 에 n 을 넣은
 * 꼴이라 답(45)을 베낀 것이 아니다(요청 24·113). 정규식이 아니라 test 를 가진 객체인 까닭: 약분 여부는
 * 정규식으로 못 가려서. 부르는 곳(LITERAL.test)은 그대로 둔다.
 */
export const LITERAL = {
  test(s: string): boolean {
    const m = s.match(NUM_ONLY);
    if (!m) return false;
    const n = m[1] ?? m[3] ?? m[5];
    const d = m[2] ?? m[4];
    if (d === undefined) return true;
    const dn = BigInt(d);
    if (dn === 0n) return false;
    return gcdN(BigInt(n as string), dn) === 1n;
  },
};

export function texOk(where: string, s: string | undefined | null, errors: string[], emph = false) {
  if (s == null) return;
  try {
    renderRich(s, true, { emph });
  } catch (e) {
    errors.push(`${where}: 수식 오류 — ${(e as Error).message.split('\n')[0]}`);
  }
}

/** 검산식이 비었거나 답을 그대로 베꼈으면 오류 */
export function checkExpr(where: string, check: unknown, errors: string[]) {
  if (typeof check !== 'string' || !check.trim()) errors.push(`${where}: 검산식 없음`);
  else if (LITERAL.test(check))
    errors.push(`${where}: 검산식이 답을 그대로 적은 값임 — 문제 조건으로 계산하는 식이어야 함`);
}

export function checkAnswerShape(where: string, p: Problem | Example, errors: string[]) {
  if (!TYPES.has(p.answerType)) errors.push(`${where}: answerType 이상 (${p.answerType})`);
  if (!p.check?.trim()) errors.push(`${where}: check(검산식) 없음`);
  else if (LITERAL.test(p.check))
    errors.push(`${where}: check 가 답을 그대로 적은 값임 — 문제 조건으로 계산하는 식이어야 함`);
  if (p.answerType === 'int' && !/^-?\d+$/.test(p.answer))
    errors.push(`${where}: int 답 형식 (${p.answer})`);
  if (p.answerType === 'fraction' && !/^-?\d+(\/\d+)?$/.test(p.answer))
    errors.push(`${where}: fraction 답은 "a/b" 꼴 (${p.answer})`);
  if (p.answerType === 'choice') {
    if (!/^[1-5]$/.test(p.answer)) errors.push(`${where}: choice 답은 1~5 (${p.answer})`);
    if (p.choices?.length !== 5) errors.push(`${where}: 보기 5개 필요`);
    if (p.choiceChecks?.length !== 5) errors.push(`${where}: choiceChecks 5개 필요`);
  }
  if (!p.steps?.length) errors.push(`${where}: 풀이 단계 없음`);
  for (const [i, st] of (p.steps ?? []).entries()) {
    if (!st.title?.trim() || !st.body?.trim())
      errors.push(`${where}: ${i + 1}단계 제목/본문 비어 있음`);
    texOk(`${where} ${i + 1}단계`, st.title, errors);
    texOk(`${where} ${i + 1}단계`, st.body, errors);
  }
  texOk(`${where} 문제`, p.q, errors);
  texOk(`${where} 팁`, p.tip, errors);
  for (const c of p.concepts ?? []) texOk(`${where} 개념`, c, errors);
  for (const c of p.choices ?? []) texOk(`${where} 보기`, c, errors);
  if ('answerTex' in p) texOk(`${where} 정답표기`, p.answerTex, errors);
}

export const answerItem = (ref: string, unit: string, p: Problem | Example): AnswerCheck => ({
  ref,
  unit,
  answer: p.answer,
  answerType: p.answerType,
  check: p.check,
  ...(p.choiceChecks ? { choiceChecks: p.choiceChecks } : {}),
});
