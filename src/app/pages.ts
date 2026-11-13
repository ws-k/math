// 단원 안의 문제 순서와 키. 문제 화면 = 문제 카드 + 풀이 노트(필기는 노트에만).
import type { Level, Problem, Unit } from '../content/types.ts';
import { generate } from '../generators/index.ts';

/** 진행 카드 키. 생성 문제 id 에 콜론이 있어 구분자는 첫 '/' 하나만 쓴다. */
export const cardKey = (unitId: string, pid: string) => `${unitId}/${pid}`;

export function parseCardKey(key: string): { unitId: string; pid: string } | null {
  const i = key.indexOf('/');
  if (i <= 0 || i === key.length - 1) return null;
  return { unitId: key.slice(0, i), pid: key.slice(i + 1) };
}

/**
 * 풀이 노트 필기 키. 예전 책 화면의 "공책 쪽" 키를 그대로 쓴다 — 이미 쓴 풀이가 새 화면에서도 이어진다.
 * 문제 글 위 필기(…:text)는 없앴다: 화면 폭마다 글자 줄바꿈이 달라 필기가 글자와 어긋나서다.
 */
export const noteKey = (unitId: string, pid: string) => `ink:${unitId}:${pid}:note`;

const GEN = /^gen:([^:]+):(\d+)$/;

/** "같은 유형 더 풀기" 문제는 저장하지 않고 생성기 이름+시드로 다시 만든다(주소만으로 복원). */
export const genPid = (genId: string, seed: number) => `gen:${genId}:${seed}`;

/** 생성 문제인가 — 매번 새로 만드는 연습이라 복습 카드(SRS)에 넣지 않는다 */
export const isGenPid = (pid: string) => GEN.test(pid);

export function resolveProblem(unit: Unit, pid: string): Problem | null {
  const m = pid.match(GEN);
  if (!m) return unit.problems.find((p) => p.id === pid) ?? null;
  try {
    return generate(m[1] as string, Number(m[2]), pid);
  } catch {
    return null;
  }
}

/** 단원 문제 순서에서의 자리. 생성 문제는 같은 생성기를 쓰는 첫 문제 자리로 친다. */
export function problemIndex(unit: Unit, pid: string): number {
  const m = pid.match(GEN);
  if (m) return unit.problems.findIndex((p) => p.generator === m[1]);
  return unit.problems.findIndex((p) => p.id === pid);
}

/** 이전(-1)·다음(1) 문제 id. 끝이거나 모르는 문제면 null */
export function step(unit: Unit, pid: string, dir: 1 | -1): string | null {
  const i = problemIndex(unit, pid);
  if (i < 0) return null;
  return unit.problems[i + dir]?.id ?? null;
}

const LEVELS: Level[] = ['기초', '표준', '수능형', '응용'];

/** 단원 홈의 수준별 문제 목록. n 은 단원 안 문제 번호(1부터) */
export function levelGroups(
  unit: Unit,
): { level: Level; items: { n: number; problem: Problem }[] }[] {
  return LEVELS.map((level) => ({
    level,
    items: unit.problems
      .map((problem, i) => ({ n: i + 1, problem }))
      .filter((x) => x.problem.level === level),
  })).filter((g) => g.items.length > 0);
}
