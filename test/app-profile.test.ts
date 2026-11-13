import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createProfileSwitch,
  createScopedStore,
  FIRST,
  normalizeProfiles,
  type RawStore,
  scopedKey,
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

test('첫 프로필의 "모든 키" 조회에 기기 공통 키(profiles·profile)가 섞이지 않는다', async () => {
  const raw = memStore();
  raw.data.set('profiles', []);
  raw.data.set('profile', 'kid');
  raw.data.set('settings', 1);
  const s = createScopedStore(raw, () => FIRST);
  assert.deepEqual(await s.keys(), ['settings']);
  assert.deepEqual(await s.entries('pro'), []);
});

/**
 * 실제 React 정리 순서를 그대로 흉내 낸다:
 *  1) request(id) → App 이 <Screen> 대신 빈 자리표시를 그린다(커밋)
 *  2) 같은 커밋에서 사라지는 <Screen> 의 정리(cleanup)가 먼저 돈다 — InkPage 가 마지막 필기를 저장
 *  3) 그다음 App 의 effect 가 commit() 을 부른다 — 모듈 변수와 React 상태를 한 번에 바꾼다
 */
test('전환: 사라지는 화면의 마지막 저장은 옛 프로필로, 그 뒤 저장은 새 프로필로', async () => {
  const raw = memStore();
  let cur = FIRST;
  const saver = createSaver(async (k, v) => void raw.data.set(k, v), {
    retryMs: 1,
    later: () => {},
    scope: (k) => scopedKey(cur, k),
  });
  const log: string[] = [];
  let state: { profile: string; leaving: string | null } = { profile: FIRST, leaving: null };
  const sw = createProfileSwitch({
    setModule: (id) => {
      log.push(`module:${id}`);
      cur = id;
    },
    setState: (u) => {
      state = u(state);
      log.push(`state:${state.profile}/${state.leaving}`);
    },
    persist: (id) => saver.save('profile', id),
    goHome: () => log.push('home'),
  });
  sw.request('kid');
  assert.deepEqual(state, { profile: FIRST, leaving: 'kid' });
  // 2) 사라지는 화면의 정리: 아직 모듈 변수는 옛 프로필
  saver.save('ink:a', 1);
  // 3) App effect
  sw.commit('kid');
  assert.equal(cur, 'kid');
  assert.deepEqual(state, { profile: 'kid', leaving: null });
  // 새 사람 화면이 앞 사람 주소(단원·레슨)로 열리면 그 주소가 새 사람의 '이어서 하기'로 저장된다 — 홈부터
  assert.deepEqual(log, ['state:first/kid', 'home', 'module:kid', 'state:kid/null']);
  saver.save('ink:b', 2);
  await tick();
  assert.equal(raw.data.get('ink:a'), 1);
  assert.equal(raw.data.get('@kid/ink:b'), 2);
  assert.equal(raw.data.get('profile'), 'kid');
  // 같은 프로필로의 요청은 아무것도 하지 않는다(화면을 괜히 내렸다 올리지 않게)
  sw.request('kid');
  assert.deepEqual(state, { profile: 'kid', leaving: null });
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

test('프로필 목록 바꾸기: 추가(새 id)·이름 바꾸기·삭제(첫 프로필은 못 지움)', async () => {
  const { addProfile, renameProfile, removeProfile, cleanName } = await import(
    '../src/app/profile.ts'
  );
  const base = [{ id: FIRST, name: '나' }];
  const added = addProfile(base, '  아이  ', () => 'p-abc');
  assert.deepEqual(added, [
    { id: FIRST, name: '나' },
    { id: 'p-abc', name: '아이' },
  ]);
  // 같은 id 가 나오면 다시 만든다
  let n = 0;
  const twice = addProfile(added, '둘째', () => (n++ === 0 ? 'p-abc' : 'p-def'));
  assert.equal(twice[2]?.id, 'p-def');
  assert.deepEqual(renameProfile(added, 'p-abc', '첫째'), [
    { id: FIRST, name: '나' },
    { id: 'p-abc', name: '첫째' },
  ]);
  assert.deepEqual(removeProfile(added, 'p-abc'), base);
  assert.deepEqual(removeProfile(added, FIRST), added);
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName('a'.repeat(30))?.length, 12);
});
