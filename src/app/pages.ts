// 단원 안의 쪽 배치. 단원 = [개념 쪽, 예제 쪽] 다음에 문제마다 [교재 쪽, 공책 쪽] 두 쪽.
// 펼친 책은 두 쪽을 한 번에 넘기고, 한 쪽씩 보는 화면은 한 쪽씩 넘긴다.
import type { Problem, Unit } from '../content/types.ts';
import { generate } from '../generators/index.ts';
import type { LayoutMode } from './layout.ts';
import type { Side } from './route.ts';

/** 진행 카드 키. 생성 문제 id 에 콜론이 있어 구분자는 첫 '/' 하나만 쓴다. */
export const cardKey = (unitId: string, pid: string) => `${unitId}/${pid}`;

export function parseCardKey(key: string): { unitId: string; pid: string } | null {
  const i = key.indexOf('/');
  if (i <= 0 || i === key.length - 1) return null;
  return { unitId: key.slice(0, i), pid: key.slice(i + 1) };
}

/** 쪽마다 필기를 따로 저장한다. pid 가 null 이면 단원 첫 두 쪽(개념·예제). */
export function inkKey(unitId: string, pid: string | null, side: Side): string {
  if (pid === null) return `ink:${unitId}:${side === 'text' ? 'concept' : 'examples'}`;
  return `ink:${unitId}:${pid}:${side}`;
}

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

/** 펼침 번호: 0 = 단원 첫 펼침, 1.. = 문제 */
function spreadIndex(unit: Unit, pid: string | null): number {
  return pid === null ? 0 : problemIndex(unit, pid) + 1;
}

export function flip(
  unit: Unit,
  pid: string | null,
  side: Side,
  dir: 1 | -1,
  mode: LayoutMode,
): { pid: string | null; side: Side } | null {
  const idx = spreadIndex(unit, pid);
  if (idx < 0) return null;
  const count = unit.problems.length + 1;
  const at = (i: number) => (i === 0 ? null : (unit.problems[i - 1] as Problem).id);
  if (mode === 'spread') {
    const next = idx + dir;
    return next < 0 || next >= count ? null : { pid: at(next), side: 'text' };
  }
  const pos = idx * 2 + (side === 'note' ? 1 : 0) + dir;
  if (pos < 0 || pos >= count * 2) return null;
  return { pid: at(Math.floor(pos / 2)), side: pos % 2 === 0 ? 'text' : 'note' };
}

export function pageNumber(unit: Unit, pid: string | null, side: Side): number {
  return Math.max(0, spreadIndex(unit, pid)) * 2 + (side === 'note' ? 2 : 1);
}
