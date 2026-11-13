// 부품 6종이 레슨 형식 검사(validateLesson)를 통과하고, 만든 검산 항목이 sympy 를 통과하는지.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson } from '../src/lesson/types.ts';
import { widgetDefs } from '../src/lesson/widgets/specs.ts';
import { runChecks } from './widget-verify.ts';
import { WIDGET_SCENES, widgetLessons } from './widgets-fixture.ts';

test('부품 6종이 등록부에 있다', () => {
  for (const t of ['numberLine', 'fraction', 'unitCircle', 'shape', 'count', 'simulate'])
    assert.ok(widgetDefs[t], t);
});

test('부품 시험 레슨: 형식 오류 없음, 모든 부품이 검산 항목을 낸다', () => {
  const rs = widgetLessons().map((l) => validateLesson('fx', l, { problems: 30 }));
  const r = { errors: rs.flatMap((x) => x.errors), items: rs.flatMap((x) => x.items) };
  assert.deepEqual(r.errors, []);
  for (const s of WIDGET_SCENES)
    assert.ok(
      r.items.some((it) => it.ref.startsWith(`fx/lesson:${s.id}:`)),
      `${s.id} 검산 항목 없음`,
    );
  const items = r.items
    .filter((it) => WIDGET_SCENES.some((s) => it.ref.startsWith(`fx/lesson:${s.id}:`)))
    .map(({ ref, unit: _u, ...rest }) => ({ name: ref, ...rest }));
  const v = runChecks(items as Parameters<typeof runChecks>[0]);
  assert.ok(v.ok, v.out);
});

test('부품 매개변수의 모르는 칸은 레슨 형식 오류로 잡힌다', () => {
  const l = widgetLessons()[0] as Lesson;
  const s = l.scenes.find((x) => x.id === 'fr-add');
  if (s?.kind === 'explore') (s.widget.params as Record<string, unknown>).colour = 'red';
  const r = validateLesson('fx', l, { problems: 30 });
  assert.ok(
    r.errors.some((e) => /모르는 칸 colour/.test(e)),
    r.errors.join('\n'),
  );
});
