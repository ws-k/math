import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY, gradeCard, isDue, isInWrongNote } from '../src/lib/srs.ts';

const now = new Date(2026, 10, 13, 15, 0).getTime();
const today0 = new Date(2026, 10, 13).getTime();

test('처음 맞으면 3일 뒤', () => {
  const s = gradeCard(undefined, 'right', now);
  assert.equal(s.box, 2);
  assert.equal(s.due, today0 + 3 * DAY);
});

test('처음 애매하거나 틀리면 내일', () => {
  assert.equal(gradeCard(undefined, 'unsure', now).due, today0 + DAY);
  const w = gradeCard(undefined, 'wrong', now);
  assert.equal(w.box, 1);
  assert.equal(w.due, today0 + DAY);
  assert.equal(w.lapses, 1);
});

test('맞을 때마다 상자가 오르고 간격이 늘어난다', () => {
  let s = gradeCard(undefined, 'wrong', now); // 1
  s = gradeCard(s, 'right', now); // 2 → 3일
  assert.equal(s.due, today0 + 3 * DAY);
  s = gradeCard(s, 'right', now); // 3 → 7일
  assert.equal(s.due, today0 + 7 * DAY);
  s = gradeCard(s, 'right', now); // 4 → 14일
  s = gradeCard(s, 'right', now); // 5 → 30일
  assert.equal(s.box, 5);
  assert.equal(s.due, today0 + 30 * DAY);
  s = gradeCard(s, 'right', now); // 졸업
  assert.equal(s.box, 6);
  assert.equal(s.due, null);
});

test('애매하면 상자 유지, 내일', () => {
  let s = gradeCard(undefined, 'right', now);
  s = gradeCard(s, 'unsure', now);
  assert.equal(s.box, 2);
  assert.equal(s.due, today0 + DAY);
});

test('틀리면 1번 상자로', () => {
  let s = gradeCard(undefined, 'right', now);
  s = gradeCard(s, 'right', now);
  s = gradeCard(s, 'wrong', now);
  assert.equal(s.box, 1);
  assert.equal(s.lapses, 1);
});

test('isDue: 오늘 안에 복습일이면 true', () => {
  const s = gradeCard(undefined, 'wrong', now);
  assert.equal(isDue(s, now), false);
  assert.equal(isDue(s, now + DAY), true);
  assert.equal(isDue({ ...s, due: null }, now + 100 * DAY), false);
});

test('오답 노트: 마지막 결과가 틀림·애매일 때', () => {
  assert.equal(isInWrongNote(gradeCard(undefined, 'wrong', now)), true);
  assert.equal(isInWrongNote(gradeCard(undefined, 'unsure', now)), true);
  assert.equal(isInWrongNote(gradeCard(gradeCard(undefined, 'wrong', now), 'right', now)), false);
});

test('기록이 쌓인다', () => {
  const s = gradeCard(gradeCard(undefined, 'wrong', now), 'right', now + 1);
  assert.deepEqual(
    s.history.map((h) => h.r),
    ['wrong', 'right'],
  );
});
