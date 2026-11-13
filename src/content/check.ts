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

/** 틀린 곳 찾기: 틀린 식은 성립하지 않고 고친 식은 성립하는가 */
export interface SpotCheck {
  ref: string;
  unit: string;
  kind: 'spot';
  mode: 'identity' | 'equivalent';
  from?: string;
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

export type CheckItem = AnswerCheck | SpotCheck | EquivCheck | SameEqCheck | ApproxCheck;

const TYPES = new Set(['int', 'fraction', 'expr', 'choice']);
/** 계산 없이 숫자만 적은 검산식 (예: "8", "5/3", "Rational(5,3)") */
export const LITERAL =
  /^\s*(-?\d+(\s*\/\s*\d+)?|Rational\(\s*-?\d+\s*,\s*\d+\s*\)|Integer\(\s*-?\d+\s*\))\s*$/;

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
