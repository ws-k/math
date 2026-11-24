// 앱 시작 문(main.tsx): 기록 사본과 맞춰 "그려도 된다"가 나와야 화면을 그린다.
// 되살리기가 실패하거나 너무 오래 걸리면 빈 기록으로 그리지 않고 막는 화면(다시 시도)을 보인다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type BootView, boot } from '../src/app/boot.ts';

/** 손으로 돌리는 시계 — 15초를 실제로 기다리지 않게 */
function clock() {
  let now = 0;
  const timers: { at: number; f: () => void; on: boolean }[] = [];
  return {
    timer(f: () => void, ms: number) {
      const t = { at: now + ms, f, on: true };
      timers.push(t);
      return () => {
        t.on = false;
      };
    },
    advance(ms: number) {
      now += ms;
      for (const t of timers)
        if (t.on && t.at <= now) {
          t.on = false;
          t.f();
        }
    },
  };
}

function deferred() {
  let resolve: () => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function harness(readies: Promise<void>[]) {
  const c = clock();
  const seen: (BootView | 'app')[] = [];
  let retry: () => void = () => {};
  let calls = 0;
  boot({
    ready: () => readies[Math.min(calls++, readies.length - 1)] as Promise<void>,
    app: () => seen.push('app'),
    screen: (v, r) => {
      seen.push(v);
      retry = r;
    },
    timer: c.timer,
  });
  return { c, seen, retry: () => retry(), calls: () => calls };
}

test('바로 그려도 되면 불러오는 중 화면 없이 앱을 그린다', async () => {
  const h = harness([Promise.resolve()]);
  await tick();
  h.c.advance(20_000);
  assert.deepEqual(h.seen, ['app']);
});

test('되살리는 데 시간이 걸리면 불러오는 중 화면을 보이고, 끝나면 앱을 그린다', async () => {
  const d = deferred();
  const h = harness([d.promise]);
  h.c.advance(1000);
  assert.deepEqual(h.seen, ['loading']);
  d.resolve();
  await tick();
  assert.deepEqual(h.seen, ['loading', 'app']);
});

test('되살리기가 실패하면 앱을 그리지 않고 실패 화면 — 다시 시도로 다시 돌린다', async () => {
  const first = deferred();
  const second = deferred();
  const h = harness([first.promise, second.promise]);
  first.reject(new Error('읽기 실패'));
  await tick();
  assert.deepEqual(h.seen, ['failed']);
  h.retry();
  assert.deepEqual(h.seen, ['failed', 'loading']);
  assert.equal(h.calls(), 2);
  second.resolve();
  await tick();
  assert.deepEqual(h.seen, ['failed', 'loading', 'app']);
});

test('답이 아예 없으면 15초 뒤 실패 화면이고, 앱은 끝내 그리지 않는다', async () => {
  const h = harness([new Promise<void>(() => {})]);
  h.c.advance(14_999);
  assert.deepEqual(h.seen, ['loading']);
  h.c.advance(1);
  assert.deepEqual(h.seen, ['loading', 'failed']);
  h.c.advance(60_000);
  await tick();
  assert.equal(h.seen.includes('app'), false);
});

test('실패 화면이 뜬 뒤 늦게 되살리기가 끝나면 그때 앱을 그린다', async () => {
  const d = deferred();
  const h = harness([d.promise]);
  h.c.advance(15_000);
  assert.deepEqual(h.seen, ['loading', 'failed']);
  d.resolve();
  await tick();
  assert.deepEqual(h.seen, ['loading', 'failed', 'app']);
});

test('다시 시도 중에 앞선 시도의 시간 초과·실패가 늦게 와도 화면을 바꾸지 않는다', async () => {
  const first = deferred();
  const second = deferred();
  const h = harness([first.promise, second.promise]);
  h.c.advance(15_000);
  h.retry();
  first.reject(new Error('늦은 실패'));
  await tick();
  assert.deepEqual(h.seen, ['loading', 'failed', 'loading']);
  h.c.advance(14_000);
  assert.deepEqual(h.seen, ['loading', 'failed', 'loading']);
  h.c.advance(1_000);
  assert.deepEqual(h.seen, ['loading', 'failed', 'loading', 'failed']);
});

test('앱을 그린 뒤에는 다시 그리지도 막는 화면을 띄우지도 않는다', async () => {
  const d = deferred();
  const h = harness([d.promise]);
  h.c.advance(15_000);
  d.resolve();
  await tick();
  h.retry();
  h.c.advance(30_000);
  await tick();
  assert.deepEqual(h.seen, ['loading', 'failed', 'app']);
});
