import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSaver } from '../src/app/saver.ts';

/** 손으로 돌리는 타이머 */
function fakeTimer() {
  const q: (() => void)[] = [];
  return {
    set: (f: () => void) => {
      q.push(f);
    },
    run() {
      const fs = q.splice(0);
      for (const f of fs) f();
    },
    get size() {
      return q.length;
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('성공하면 한 번 쓰고 끝', async () => {
  const wrote: [string, unknown][] = [];
  const t = fakeTimer();
  const s = createSaver(async (k, v) => void wrote.push([k, v]), { retryMs: 10, later: t.set });
  s.save('a', 1);
  await tick();
  assert.deepEqual(wrote, [['a', 1]]);
  assert.equal(s.failing(), false);
  assert.equal(t.size, 0);
});

test('실패하면 경고 상태가 되고, 값을 쥐고 있다가 다시 시도한다', async () => {
  let fail = true;
  const wrote: unknown[] = [];
  const t = fakeTimer();
  const s = createSaver(
    async (_k, v) => {
      if (fail) throw new Error('quota');
      wrote.push(v);
    },
    { retryMs: 10, later: t.set },
  );
  const seen: boolean[] = [];
  s.subscribe(() => seen.push(s.failing()));
  s.save('a', 1);
  await tick();
  assert.equal(s.failing(), true);
  assert.equal(t.size, 1);
  fail = false;
  t.run();
  await tick();
  assert.deepEqual(wrote, [1]);
  assert.equal(s.failing(), false);
  assert.deepEqual(seen, [true, false]);
});

test('다시 시도 전에 새 값이 오면 새 값만 쓴다', async () => {
  let fail = true;
  const wrote: unknown[] = [];
  const t = fakeTimer();
  const s = createSaver(
    async (_k, v) => {
      if (fail) throw new Error('x');
      wrote.push(v);
    },
    { retryMs: 10, later: t.set },
  );
  s.save('a', 1);
  await tick();
  s.save('a', 2);
  fail = false;
  await tick();
  t.run();
  await tick();
  assert.deepEqual(wrote, [2]);
});

test('쓰는 도중 새 값이 오면 끝난 뒤 이어서 쓴다(순서가 뒤집히지 않게)', async () => {
  const wrote: unknown[] = [];
  let release: () => void = () => {};
  const s = createSaver(
    (_k, v) =>
      new Promise<void>((r) => {
        release = () => {
          wrote.push(v);
          r();
        };
      }),
    { retryMs: 10, later: () => {} },
  );
  s.save('a', 1);
  s.save('a', 2);
  release();
  await tick();
  release();
  await tick();
  assert.deepEqual(wrote, [1, 2]);
});

test('discard: 지운 프로필의 쥐고 있는 값(다시 시도 대기 포함)을 버린다', async () => {
  let fail = true;
  const wrote: [string, unknown][] = [];
  const t = fakeTimer();
  const s = createSaver(
    async (k, v) => {
      if (fail) throw new Error('x');
      wrote.push([k, v]);
    },
    { retryMs: 10, later: t.set },
  );
  s.save('@kid/ink:a', 1);
  s.save('ink:b', 2);
  await tick();
  assert.equal(s.failing(), true);
  s.discard('@kid/');
  fail = false;
  t.run();
  await tick();
  assert.deepEqual(wrote, [['ink:b', 2]]);
  assert.equal(s.failing(), false);
});
