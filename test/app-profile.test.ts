import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createScopedStore,
  FIRST,
  normalizeProfiles,
  type RawStore,
  scopedKey,
  switchProfile,
} from '../src/app/profile.ts';
import { createSaver } from '../src/app/saver.ts';

/** 메모리 저장소(IndexedDB 대신). 키 순서는 IndexedDB 처럼 문자열 순 */
function memStore(): RawStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const sorted = (prefix: string) => [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
  return {
    data,
    get: async (k) => data.get(k) as never,
    set: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
    keys: async (p = '') => sorted(p),
    entries: async (p) => sorted(p).map((k) => [k, data.get(k)] as [string, never]),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('첫 프로필은 접두어 없이(기존 데이터 그대로), 새 프로필은 @id/ 접두어', () => {
  assert.equal(scopedKey(FIRST, 'card:u/p1'), 'card:u/p1');
  assert.equal(scopedKey('kid', 'card:u/p1'), '@kid/card:u/p1');
});

test('기기 공통 키(프로필 목록·현재 프로필)는 프로필과 상관없이 같은 키', () => {
  assert.equal(scopedKey('kid', 'profiles'), 'profiles');
  assert.equal(scopedKey('kid', 'profile'), 'profile');
});

test('접두어 조회가 다른 프로필의 값을 읽지 않는다', async () => {
  const raw = memStore();
  raw.data.set('card:u/1', 'first-1');
  raw.data.set('@kid/card:u/1', 'kid-1');
  raw.data.set('@kid/card:u/2', 'kid-2');
  raw.data.set('settings', 'first-s');
  let cur = FIRST;
  const s = createScopedStore(raw, () => cur);
  assert.deepEqual(await s.entries('card:'), [['card:u/1', 'first-1']]);
  assert.deepEqual(await s.keys(), ['card:u/1', 'settings']);
  cur = 'kid';
  assert.deepEqual(await s.entries('card:'), [
    ['card:u/1', 'kid-1'],
    ['card:u/2', 'kid-2'],
  ]);
  assert.equal(await s.get('settings'), undefined);
  assert.deepEqual(await s.keys(), ['card:u/1', 'card:u/2']);
});

test('저장은 save() 를 부른 순간의 프로필로 고정된다(쓰기 전에 바뀌어도)', async () => {
  const raw = memStore();
  let cur = FIRST;
  let release: () => void = () => {};
  const saver = createSaver(
    (k, v) =>
      new Promise<void>((r) => {
        release = () => {
          raw.data.set(k, v);
          r();
        };
      }),
    { retryMs: 1, later: () => {}, scope: (k) => scopedKey(cur, k) },
  );
  saver.save('ink:a', 1);
  cur = 'kid';
  release();
  await tick();
  assert.equal(raw.data.get('ink:a'), 1);
  assert.equal(raw.data.has('@kid/ink:a'), false);
});

test('다시 시도도 처음 프로필로', async () => {
  const raw = memStore();
  let cur = FIRST;
  let fail = true;
  const timers: (() => void)[] = [];
  const saver = createSaver(
    async (k, v) => {
      if (fail) throw new Error('quota');
      raw.data.set(k, v);
    },
    { retryMs: 1, later: (f) => void timers.push(f), scope: (k) => scopedKey(cur, k) },
  );
  saver.save('ink:a', 1);
  await tick();
  cur = 'kid';
  fail = false;
  for (const f of timers.splice(0)) f();
  await tick();
  assert.equal(raw.data.get('ink:a'), 1);
  assert.equal(raw.data.has('@kid/ink:a'), false);
});

test('idle: 쓰는 중이면 끝날 때까지 기다리고, 비었으면 바로', async () => {
  let release: () => void = () => {};
  const saver = createSaver(
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
    { retryMs: 1, later: () => {} },
  );
  await saver.idle();
  saver.save('a', 1);
  let done = false;
  void saver.idle().then(() => {
    done = true;
  });
  await tick();
  assert.equal(done, false);
  release();
  await tick();
  await tick();
  assert.equal(done, true);
});

test('전환 순서: 홈으로 → 저장 비우기 대기 → 프로필 변경. 대기 중 저장은 옛 프로필로', async () => {
  const raw = memStore();
  let cur = FIRST;
  const queue: (() => void)[] = [];
  const release = () => queue.shift()?.();
  const saver = createSaver(
    (k, v) =>
      new Promise<void>((r) => {
        queue.push(() => {
          raw.data.set(k, v);
          r();
        });
      }),
    { retryMs: 1, later: () => {}, scope: (k) => scopedKey(cur, k) },
  );
  const log: string[] = [];
  saver.save('ink:a', 1);
  const p = switchProfile('kid', {
    goHome: () => log.push('home'),
    idle: () => saver.idle(),
    setCurrent: (id) => {
      log.push(`set:${id}`);
      cur = id;
    },
  });
  // 홈으로 가며 사라지는 화면이 마지막 필기를 저장한다 — 아직 옛 프로필
  saver.save('ink:b', 2);
  await tick();
  assert.deepEqual(log, ['home']);
  release();
  await tick();
  release();
  await p;
  assert.deepEqual(log, ['home', 'set:kid']);
  assert.equal(raw.data.get('ink:b'), 2);
  assert.equal(raw.data.has('@kid/ink:b'), false);
  saver.save('ink:c', 3);
  release();
  await tick();
  assert.equal(raw.data.get('@kid/ink:c'), 3);
});

test('normalizeProfiles: 첫 프로필은 늘 있고, 깨진 항목은 버린다', () => {
  assert.deepEqual(normalizeProfiles(undefined), [{ id: FIRST, name: '나' }]);
  assert.deepEqual(
    normalizeProfiles([{ id: 'kid', name: '아이' }, { id: 3 }, { id: 'a b', name: 'x' }]),
    [
      { id: FIRST, name: '나' },
      { id: 'kid', name: '아이' },
    ],
  );
  assert.deepEqual(normalizeProfiles([{ id: FIRST, name: '엄마' }]), [{ id: FIRST, name: '엄마' }]);
});
