import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canNext,
  complete,
  dockLabel,
  initialState,
  lessonKey,
  next,
  restore,
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
  // 끝에서 누르면 처음으로(완료 기록은 남긴다)
  const r = next(L, s);
  assert.equal(r.shown, 1);
  assert.deepEqual(r.done, ['b']);
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
