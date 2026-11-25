// 세로셈 가족을 등록한 뒤: 레슨 형식 검사(validateLesson)가 이 부품 장면을 받아들이고, 장면에서 나온 검산 항목이
// sympy 를 통과하는가. 시험 장면은 단원 JSON 이 아니라 여기 둔다(공용 받침 test/*-fixture.ts 에 올릴지는 메인이 정한다).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, Scene } from '../src/lesson/types.ts';
import { goodLesson } from './lesson-fixture.ts';
import { runChecks } from './widget-verify.ts';

const explore = (id: string, params: Record<string, unknown>): Scene => ({
  kind: 'explore',
  id,
  title: '세로셈 해 보기',
  widget: { type: 'column', params },
});

const SCENES: Scene[] = [
  explore('cl-long', { mode: 'long', dividend: 3, divisor: 11, decimal: true }),
  explore('cl-int', { mode: 'long', dividend: 156, divisor: 12 }),
  explore('cl-synth', { mode: 'synth', coeffs: [1, 0, -2, 1], root: 2 }),
  explore('cl-ladder', { mode: 'ladder', numbers: [12, 18] }),
];

const lesson = (scenes: Scene[]): Lesson => {
  const l = goodLesson();
  const solve = l.scenes.find((x) => x.kind === 'solve') as Scene;
  return { ...l, scenes: [...structuredClone(scenes), solve] };
};

test('세로셈 장면: 형식 오류 없음, 장면마다 검산 항목, sympy 통과', () => {
  const r = validateLesson('fx', lesson(SCENES), { problems: 30 });
  assert.deepEqual(r.errors, []);
  for (const s of SCENES)
    assert.ok(
      r.items.some((it) => it.ref.startsWith(`fx/lesson:${s.id}:`)),
      `${s.id} 검산 항목 없음`,
    );
  const items = r.items
    .filter((it) => SCENES.some((s) => it.ref.startsWith(`fx/lesson:${s.id}:`)))
    .map(({ ref, unit: _u, ...rest }) => ({ name: ref, ...rest }));
  const v = runChecks(items as Parameters<typeof runChecks>[0]);
  assert.ok(v.ok, v.out);
});

test('세로셈 장면: 자릿수 상한을 넘는 매개변수는 레슨 형식 오류', () => {
  const r = validateLesson(
    'fx',
    lesson([explore('cl-wide', { mode: 'long', dividend: 1, divisor: 7, decimal: true })]),
    { problems: 30 },
  );
  assert.ok(
    r.errors.some((e) => /칸이라 판에 안 들어감/.test(e)),
    r.errors.join('\n'),
  );
});
