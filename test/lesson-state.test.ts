import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canNext,
  canSkip,
  complete,
  dockLabel,
  initialState,
  lessonKey,
  next,
  restore,
  SKIP_AFTER,
  skip,
  toSaved,
} from '../src/lesson/state.ts';
import type { Lesson } from '../src/lesson/types.ts';

const L: Lesson = {
  minutes: 10,
  scenes: [
    { kind: 'intro', id: 'a', title: 't' },
    {
      kind: 'explore',
      id: 'b',
      title: 't',
      widget: { type: 'x', params: {} },
      gate: true,
    },
    { kind: 'terms', id: 'c', title: 't', terms: [] },
  ],
};

test('처음엔 첫 장면만 보이고 시작하기', () => {
  const s = initialState();
  assert.equal(s.shown, 1);
  assert.equal(dockLabel(L, s), '시작하기');
  assert.equal(canNext(L, s), true);
});

test('다음 장면을 하나씩 쌓고, 끝에서는 처음부터 다시 보기', () => {
  let s = next(L, initialState());
  assert.equal(s.shown, 2);
  assert.equal(dockLabel(L, s), '계속하기');
  s = complete(s, 'b');
  s = next(L, s);
  assert.equal(s.shown, 3);
  assert.equal(dockLabel(L, s), '처음부터 다시 보기');
  // 끝에서 누르면 처음으로. 다시 보기는 처음 배우는 것처럼 — gate 도 다시 걸리게 완료 기록을 비운다
  const r = next(L, s);
  assert.equal(r.shown, 1);
  assert.deepEqual(r.done, []);
});

test('gate 장면은 끝내기 전에는 넘어가지 않는다', () => {
  const s = next(L, initialState());
  assert.equal(canNext(L, s), false);
  assert.equal(next(L, s), s);
  assert.equal(canNext(L, complete(s, 'b')), true);
});

test('complete 는 같은 장면을 두 번 넣지 않는다', () => {
  const s = complete(complete(initialState(), 'b'), 'b');
  assert.deepEqual(s.done, ['b']);
});

test('저장은 장면 id 로, 되살릴 때 모르는 id 는 버린다', () => {
  const s = complete(next(L, initialState()), 'b');
  assert.deepEqual(toSaved(L, s), { at: 'b', done: ['b'] });
  assert.deepEqual(restore(L, { at: 'b', done: ['b', 'zz'] }), { shown: 2, done: ['b'] });
  assert.deepEqual(restore(L, { at: 'zz', done: 'x' }), initialState());
  assert.deepEqual(restore(L, null), initialState());
});

test('저장 키', () => {
  assert.equal(lessonKey('m1-linear-eq'), 'lesson:m1-linear-eq');
});

test('restore: 저장된 자리 앞에 끝내지 않은 gate 가 있으면 그 gate 에서 멈춘다', () => {
  const L2: Lesson = { ...L, scenes: [...L.scenes, { kind: 'intro', id: 'd', title: 't' }] };
  assert.deepEqual(restore(L2, { at: 'd', done: [] }), { shown: 2, done: [] });
  assert.deepEqual(restore(L2, { at: 'd', done: ['b'] }), {
    shown: 4,
    done: ['b'],
    finished: true,
  });
});

test('넘어가기: gate 에서 두 번 실패하면 끝낸 것으로 치고 다음 장면으로', () => {
  const s = next(L, initialState());
  assert.equal(SKIP_AFTER, 2);
  assert.equal(canSkip(L, s, 1), false);
  assert.equal(canSkip(L, s, 2), true);
  // 넘어간 장면은 '끝냄'이 아니라 '넘어감'으로 따로 적는다(나중에 다시 볼 장면을 알 수 있게)
  assert.deepEqual(skip(L, s), { shown: 3, done: [], skipped: ['b'], finished: true });
  assert.deepEqual(toSaved(L, skip(L, s)), { at: 'c', done: [], skipped: ['b'], finished: true });
  // 넘어간 gate 는 되살릴 때 다시 막지 않는다
  assert.deepEqual(restore(L, { at: 'c', done: [], skipped: ['b'] }), {
    shown: 3,
    done: [],
    skipped: ['b'],
    finished: true,
  });
  // gate 가 아니거나 이미 끝낸 장면은 넘어가기가 없다
  assert.equal(canSkip(L, initialState(), 5), false);
  assert.equal(canSkip(L, complete(s, 'b'), 5), false);
});

test('끝까지 본 적이 있으면 finished — 처음부터 다시 봐도 남고, 저장·복원된다', () => {
  let s = complete(next(L, initialState()), 'b');
  assert.equal(s.finished, undefined);
  s = next(L, s);
  assert.equal(s.finished, true);
  const again = next(L, s);
  assert.deepEqual(again, { shown: 1, done: [], finished: true });
  assert.deepEqual(toSaved(L, again), { at: 'a', done: [], finished: true });
  assert.deepEqual(restore(L, { at: 'a', done: [], finished: true }), {
    shown: 1,
    done: [],
    finished: true,
  });
});

test('lessonProgress: 지도·홈에 보일 레슨 상태', async () => {
  const { lessonProgress } = await import('../src/lesson/state.ts');
  assert.deepEqual(lessonProgress(L, undefined), { started: false, finished: false, at: 0 });
  assert.deepEqual(lessonProgress(L, { at: 'b', done: [] }), {
    started: true,
    finished: false,
    at: 2,
  });
  assert.deepEqual(lessonProgress(L, { at: 'a', done: [], finished: true }), {
    started: true,
    finished: true,
    at: 1,
  });
});

test('옛 기록: 마지막 장면에 있으면 finished 가 없어도 끝낸 것으로', async () => {
  const { lessonProgress } = await import('../src/lesson/state.ts');
  assert.deepEqual(restore(L, { at: 'c', done: ['b'] }), { shown: 3, done: ['b'], finished: true });
  assert.deepEqual(lessonProgress(L, { at: 'c', done: ['b'] }), {
    started: true,
    finished: true,
    at: 3,
  });
});

test('레슨 필기 옛 키(장면:번호) → 새 키(장면:문제 id)로 한 번 옮긴다', async () => {
  const { legacyInkKey, lessonInkKey, migrateInk } = await import('../src/lesson/inkKeys.ts');
  assert.equal(legacyInkKey('u', 'try', 0), 'ink:u:lesson:try:1');
  assert.equal(lessonInkKey('u', 'try', 'taxi'), 'ink:u:lesson:try:taxi');
  const data = new Map<string, unknown>([['ink:u:lesson:try:1', 'old']]);
  const s = {
    get: async <T>(k: string) => data.get(k) as T | undefined,
    set: async (k: string, v: unknown) => void data.set(k, v),
    del: async (k: string) => void data.delete(k),
  };
  await migrateInk(s, 'ink:u:lesson:try:1', 'ink:u:lesson:try:taxi');
  assert.equal(data.get('ink:u:lesson:try:taxi'), 'old');
  assert.equal(data.has('ink:u:lesson:try:1'), false);
  // 새 키가 이미 있으면 옛 값으로 덮지 않는다. 옛 값이 없으면 아무것도 안 한다
  data.set('ink:u:lesson:try:2', 'older');
  data.set('ink:u:lesson:try:paren', 'new');
  await migrateInk(s, 'ink:u:lesson:try:2', 'ink:u:lesson:try:paren');
  assert.equal(data.get('ink:u:lesson:try:paren'), 'new');
  await migrateInk(s, 'ink:u:lesson:try:9', 'ink:u:lesson:try:x');
  assert.equal(data.has('ink:u:lesson:try:x'), false);
});
