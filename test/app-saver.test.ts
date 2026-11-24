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

test('drop: 고른 키의 쥔 값만 한 번 버리고, 그 뒤 새로 저장하는 건 받는다', async () => {
  let fail = true;
  const wrote: [string, unknown][] = [];
  const t = fakeTimer();
  const s = createSaver(
    async (k, v) => {
      if (fail) throw new Error('quota');
      wrote.push([k, v]);
    },
    { retryMs: 10, later: t.set },
  );
  s.save('card:a/1', 1);
  s.save('settings', 2);
  await tick();
  s.drop((k) => k.startsWith('card:'));
  fail = false;
  t.run();
  await tick();
  assert.deepEqual(wrote, [['settings', 2]]);
  s.save('card:a/1', 3);
  await tick();
  assert.deepEqual(wrote.at(-1), ['card:a/1', 3]);
  assert.equal(s.failing(), false);
});

test('drop: 쓰는 중인 키는 그 쓰기가 끝나면 풀리고, 실패해도 다시 쥐지 않는다. 다른 키 실패는 기다리지 않는다', async () => {
  const t = fakeTimer();
  const w: { finish?: (ok: boolean) => void } = {};
  const calls: string[] = [];
  const s = createSaver(
    (k) =>
      calls.push(k) && k === 'settings'
        ? Promise.reject(new Error('quota'))
        : new Promise<void>((res, rej) => {
            w.finish = (ok) => (ok ? res() : rej(new Error('quota')));
          }),
    { retryMs: 10, later: t.set },
  );
  s.save('settings', 1); // 계속 실패하는 다른 키
  s.save('card:a/1', 2); // 쓰는 중
  await tick();
  let done = false;
  void s
    .drop((k) => k.startsWith('card:'))
    .then(() => {
      done = true;
    });
  await tick();
  assert.equal(done, false);
  w.finish?.(false);
  await tick();
  assert.equal(done, true);
  t.run();
  await tick();
  assert.equal(calls.filter((k) => k === 'card:a/1').length, 1);
  void s.drop((k) => k === 'settings');
  assert.equal(s.failing(), false);
});
