import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkContent } from '../scripts/content-check.ts';
import { prob, unit } from './app-fixture.ts';
import { goodLesson } from './lesson-fixture.ts';

const ID = 't-lesson';

/** 임시 폴더에 단원 하나짜리 콘텐츠를 만든다 */
function root(extra: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  mkdirSync(join(dir, 'content/units'), { recursive: true });
  const cu = { id: ID, course: 'm1', title: 't', prereq: [], topics: [], keyFormula: null };
  writeFileSync(join(dir, 'content/curriculum.json'), JSON.stringify({ courses: [], units: [cu] }));
  const problems = Array.from({ length: 30 }, (_, i) =>
    prob(`p${i}`, {
      level: i < 15 ? '기초' : i < 25 ? '표준' : '수능형',
      check: '2-1',
      steps: [{ title: 'a', body: 'b' }],
    }),
  );
  const u = { ...unit(ID, problems), concept: undefined, examples: undefined, ...extra };
  writeFileSync(join(dir, `content/units/${ID}.json`), JSON.stringify(u));
  return dir;
}

test('레슨만 있는 단원도 통과하고, 레슨 검산 항목이 모인다', () => {
  const r = checkContent(root({ lesson: goodLesson() }), 1, ID);
  assert.deepEqual(r.errors, []);
  assert.ok(r.items.some((i) => i.ref === `${ID}/lesson:hook`));
  assert.ok(r.items.some((i) => i.ref === `${ID}/lesson:traps:1`));
});

test('레슨도 개념도 없으면 오류', () => {
  const r = checkContent(root({}), 1, ID);
  assert.ok(r.errors.some((e) => e.includes('레슨도 개념도 없음')));
});

test('레슨 형식 오류가 단원 검사 오류로 올라온다', () => {
  const l = goodLesson();
  l.minutes = 0;
  const r = checkContent(root({ lesson: l }), 1, ID);
  assert.ok(r.errors.length > 0);
});

test('레슨이 있는 단원에 옛 개념·예제가 남아 있으면 오류(설명은 둘 중 하나)', () => {
  const r = checkContent(
    root({ lesson: goodLesson(), concept: [{ heading: 'a', body: 'b' }] }),
    1,
    ID,
  );
  assert.ok(r.errors.some((e) => e.includes('옛 concept·examples')));
});
