// 앱 전용 학습 기록 사본: IndexedDB(원본) 쓰기·지우기를 네이티브 파일(사본)에도 적고, 시작할 때 맞춘다.
// 네이티브 다리(window.webkit.messageHandlers.mathApp)와 IndexedDB 는 메모리 가짜로 바꿔 끼운다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BACKUP_MARKER,
  type BackupBridge,
  type BaseStore,
  createBackup,
  nativeBridge,
} from '../src/app/backup.ts';
import { scopedKey } from '../src/app/profile.ts';

/** IndexedDB 대신 메모리. 키 순서는 IndexedDB 처럼 문자열 순, fill 은 없는 키만 채운다 */
function memBase(): BaseStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const sorted = (prefix: string) => [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
  return {
    data,
    get: async (k) => data.get(k) as never,
    set: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
    async delPrefix(prefixes, keys = []) {
      for (const k of [...data.keys()]) if (prefixes.some((p) => k.startsWith(p))) data.delete(k);
      for (const k of keys) data.delete(k);
    },
    keys: async (p = '') => sorted(p),
    entries: async (p) => sorted(p).map((k) => [k, data.get(k)] as [string, never]),
    async fill(entries, skip) {
      for (const [k, v] of entries) if (!skip(k) && !data.has(k)) data.set(k, v);
    },
  };
}

/** 네이티브 사본 대신 메모리(키 → JSON 문자열). 쪽 나누기는 문자열 길이로 잰다 */
function memBridge() {
  const files = new Map<string, string>();
  const ops: string[] = [];
  const sorted = () => [...files.keys()].sort();
  const b: BackupBridge & { files: typeof files; ops: string[]; fail: Set<string> } = {
    files,
    ops,
    fail: new Set(),
    async put(key, json) {
      ops.push(`put ${key}`);
      if (b.fail.has('put')) throw new Error('디스크 가득');
      files.set(key, json);
    },
    async del(prefixes, keys) {
      ops.push(`del ${prefixes.join(',')}|${keys.join(',')}`);
      for (const k of [...files.keys()]) if (prefixes.some((p) => k.startsWith(p))) files.delete(k);
      for (const k of keys) files.delete(k);
    },
    async clear() {
      ops.push('clear');
      files.clear();
    },
    async keys() {
      if (b.fail.has('keys')) throw new Error('읽기 실패');
      return sorted();
    },
    async read(after, maxBytes) {
      ops.push(`read ${after ?? ''}`);
      if (b.fail.has('read')) throw new Error('읽기 실패');
      const rest = sorted().filter((k) => after === null || k > after);
      const entries: [string, string][] = [];
      let bytes = 0;
      for (const k of rest) {
        const json = files.get(k) as string;
        if (entries.length > 0 && bytes + json.length > maxBytes) break;
        entries.push([k, json]);
        bytes += json.length;
      }
      const last = entries.at(-1)?.[0];
      return { entries, next: last !== undefined && last !== rest.at(-1) ? last : null };
    },
  };
  return b;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** 앞으로 손으로 풀어 줄 약속 — 시작 도중에 다른 쓰기를 끼워 넣으려고 */
function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('표식 키는 기기 공통 키다(프로필 접두어가 붙지 않는다)', () => {
  assert.equal(scopedKey('kid', BACKUP_MARKER), BACKUP_MARKER);
});

test('쓰기·지우기는 IndexedDB 가 끝난 뒤 사본에도 같은 JSON 문자열로 간다', async () => {
  const base = memBase();
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start();
  const ink = { strokes: [{ tool: 'pen', color: '#222', base: 2.5, pts: [1.25, 2, 30, 0.5] }] };
  await b.raw.set('ink:u1:p1:note', ink);
  assert.equal(br.files.get('ink:u1:p1:note'), JSON.stringify(ink));
  await b.raw.del('ink:u1:p1:note');
  await tick();
  assert.equal(br.files.has('ink:u1:p1:note'), false);
});

test('IndexedDB 쓰기가 실패하면 사본에 보내지 않는다(원본에 없는 값이 사본에 생기지 않게)', async () => {
  const base = memBase();
  base.set = async () => {
    throw new Error('quota');
  };
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start();
  await assert.rejects(b.raw.set('settings', { pen: true }));
  await tick();
  assert.equal(br.files.has('settings'), false);
});

test('범위 지우기(프로필 삭제·단원 초기화)가 사본에도 한 번에 반영된다', async () => {
  const base = memBase();
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start();
  for (const k of ['card:u1/1', 'card:u2/1', 'ink:u1:a:note', 'lesson:u1', '@kid/card:u1/1'])
    await b.raw.set(k, 1);
  // 단원 초기화 모양: 접두어 둘 + 낱개 키 하나
  await b.raw.delPrefix(['card:u1/', 'ink:u1:'], ['lesson:u1']);
  // 프로필 삭제 모양: 그 사람 접두어 전체
  await b.raw.delPrefix(['@kid/']);
  await tick();
  assert.deepEqual([...br.files.keys()].sort(), ['card:u2/1']);
  assert.deepEqual([...base.data.keys()].sort(), [BACKUP_MARKER, 'card:u2/1']);
});

test('표식이 있고 사본이 없으면 IndexedDB 기준으로 첫 사본을 뜬다(표식은 사본에 넣지 않는다)', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', { due: 3 });
  base.data.set('settings', { pen: true });
  const br = memBridge();
  const b = createBackup(base, br);
  assert.equal(await b.start(), 'reseeded');
  assert.deepEqual([...br.files.entries()].sort(), [
    ['card:u1/1', '{"due":3}'],
    ['settings', '{"pen":true}'],
  ]);
});

test('표식도 사본도 없으면(이 기능 전의 기록) IndexedDB 로 첫 사본을 뜨고 표식을 남긴다', async () => {
  const base = memBase();
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  const b = createBackup(base, br);
  assert.equal(await b.start(), 'seeded');
  assert.deepEqual([...br.files.keys()], ['card:u1/1']);
  assert.ok(base.data.has(BACKUP_MARKER));
});

test('표식이 있고 키가 같으면 아무것도 다시 쓰지 않는다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  const b = createBackup(base, br);
  assert.equal(await b.start(), 'kept');
  assert.deepEqual(br.ops, []);
});

test('표식이 있는데 키가 어긋나면 IndexedDB 가 맞다 — 사본을 통째 다시 뜬다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  br.files.set('card:old/1', '9'); // 사본에만 남은 키(지우기가 사본에 못 간 경우)
  const b = createBackup(base, br);
  assert.equal(await b.start(), 'reseeded');
  assert.deepEqual([...br.files.keys()], ['card:u1/1']);
});

test('표식이 없고 사본이 있으면(IndexedDB 가 지워짐) 사본에서 되살리고, 이미 있는 키는 IndexedDB 가 이긴다', async () => {
  const base = memBase();
  base.data.set('settings', { pen: false }); // 지워진 뒤 새로 생긴 값
  const br = memBridge();
  const ink = {
    strokes: [{ tool: 'pen', color: '#000', base: 1, pts: [0.1, 0.2, 16, 1] }],
    height: 1400,
  };
  br.files.set('ink:u1:p1:note', JSON.stringify(ink));
  br.files.set('@kid/card:u1/1', '{"due":2}');
  br.files.set('settings', '{"pen":true}');
  const b = createBackup(base, br, { pageBytes: 10 }); // 쪽을 잘게 나눠 여러 번 읽게
  assert.equal(await b.start(), 'restored');
  assert.deepEqual(base.data.get('ink:u1:p1:note'), ink); // JSON 왕복
  assert.deepEqual(base.data.get('@kid/card:u1/1'), { due: 2 });
  assert.deepEqual(base.data.get('settings'), { pen: false });
  assert.ok(base.data.has(BACKUP_MARKER));
  assert.ok(br.ops.filter((o) => o.startsWith('read')).length >= 3);
  // 되살린 값을 사본에 다시 쓰지 않는다(이미 사본에 있는 값이다)
  assert.equal(br.ops.filter((o) => o.startsWith('put') || o === 'clear').length, 0);
});

test('사본 읽기 오류: 되살리지도, 사본을 다시 뜨지도, 표식을 남기지도 않는다', async () => {
  for (const where of ['keys', 'read']) {
    const base = memBase();
    const br = memBridge();
    br.files.set('card:u1/1', '1');
    br.fail.add(where);
    const b = createBackup(base, br);
    assert.equal(await b.start(), 'error');
    assert.equal(base.data.size, 0, where);
    assert.equal(br.ops.filter((o) => o.startsWith('put') || o === 'clear').length, 0, where);
    assert.deepEqual([...br.files.keys()], ['card:u1/1'], where);
  }
});

test('읽기 오류 뒤에도 쓰기는 사본에 간다 — 다음 시작에 다시 맞출 수 있게', async () => {
  const base = memBase();
  const br = memBridge();
  br.fail.add('keys');
  const b = createBackup(base, br);
  await b.start();
  await b.raw.set('settings', 1);
  await tick();
  assert.equal(br.files.get('settings'), '1');
});

test('경합: 되살리는 도중 들어온 쓰기·지우기가 이긴다(옛 사본 값이 덮거나 되살리지 않는다)', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '"old"');
  br.files.set('card:u1/2', '"old"');
  br.files.set('ink:u1:a:note', '"old"');
  const gate = deferred<void>();
  const read = br.read.bind(br);
  br.read = async (after, max) => {
    await gate.promise;
    return read(after, max);
  };
  const b = createBackup(base, br);
  const started = b.start();
  await tick();
  // 시작 직후(되살리기가 사본을 읽는 중) 쓰기와 지우기
  const w1 = b.raw.set('card:u1/1', 'new');
  const w2 = b.raw.del('card:u1/2');
  const w3 = b.raw.delPrefix(['ink:u1:']);
  await Promise.all([w1, w2, w3]);
  gate.resolve();
  assert.equal(await started, 'restored');
  await tick();
  assert.equal(base.data.get('card:u1/1'), 'new');
  assert.equal(base.data.has('card:u1/2'), false);
  assert.equal(base.data.has('ink:u1:a:note'), false);
  // 사본도 결국 IndexedDB 와 같다
  assert.deepEqual([...br.files.entries()], [['card:u1/1', '"new"']]);
});

test('경합: 첫 사본을 뜨는 도중 들어온 쓰기는 뜬 뒤 사본에 덮인다(옛 값으로 남지 않는다)', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 'old');
  const br = memBridge();
  const gate = deferred<void>();
  const entries = base.entries.bind(base);
  base.entries = async <T>(p: string) => {
    const snap = await entries<T>(p); // 이 순간의 값을 읽어 두고
    await gate.promise; // 사본에 보내기 전에 다른 쓰기가 끼어든다
    return snap;
  };
  const b = createBackup(base, br);
  const started = b.start();
  await tick();
  await b.raw.set('card:u1/1', 'new');
  await b.raw.set('card:u1/9', 'added');
  gate.resolve();
  assert.equal(await started, 'reseeded');
  await tick();
  assert.deepEqual([...br.files.entries()].sort(), [
    ['card:u1/1', '"new"'],
    ['card:u1/9', '"added"'],
  ]);
});

test('사본 쓰기가 실패하면 표식에 남겨 다음 시작에 통째로 다시 뜬다', async () => {
  const base = memBase();
  const br = memBridge();
  const errors: unknown[] = [];
  const b = createBackup(base, br, { onError: (e) => errors.push(e) });
  await b.start();
  br.fail.add('put');
  await b.raw.set('card:u1/1', 2);
  await tick();
  await tick();
  assert.equal(errors.length, 1);
  br.fail.delete('put');
  // 키 수는 같아도(사본에 옛 값이 있을 수 있다) 표식이 더럽다고 하면 다시 뜬다
  br.files.set('card:u1/1', '1');
  const again = createBackup(base, br);
  assert.equal(await again.start(), 'reseeded');
  assert.equal(br.files.get('card:u1/1'), '2');
  assert.equal(await createBackup(base, br).start(), 'kept');
});

test('읽기 오류로 시작했으면 사본 쓰기 실패가 표식을 만들지 않는다(지워진 IndexedDB 를 맞다고 믿게 되므로)', async () => {
  const base = memBase();
  const br = memBridge();
  br.fail.add('keys');
  const b = createBackup(base, br);
  await b.start();
  br.fail.add('put');
  await b.raw.set('x', 1);
  await tick();
  await tick();
  assert.equal(base.data.has(BACKUP_MARKER), false);
});

test('nativeBridge: 웹(처리기 없음)에서는 null — 웹 동작은 그대로', () => {
  assert.equal(nativeBridge({}), null);
  assert.equal(nativeBridge(undefined), null);
  assert.equal(nativeBridge({ webkit: { messageHandlers: {} } }), null);
});

test('nativeBridge: 앱에서는 메시지 처리기로 보내고 답을 받는다', async () => {
  const sent: unknown[] = [];
  const replies: Record<string, unknown> = {
    put: true,
    del: true,
    clear: true,
    keys: ['a', 'b'],
    read: { entries: [['a', '1']], next: null },
  };
  const w = {
    webkit: {
      messageHandlers: {
        mathApp: {
          postMessage(m: { op: string }) {
            sent.push(m);
            return Promise.resolve(replies[m.op]);
          },
        },
      },
    },
  };
  const br = nativeBridge(w);
  assert.ok(br);
  await br.put('k', '{"a":1}');
  await br.del(['p:'], ['k']);
  await br.clear();
  assert.deepEqual(await br.keys(), ['a', 'b']);
  assert.deepEqual(await br.read(null, 100), { entries: [['a', '1']], next: null });
  assert.deepEqual(sent, [
    { op: 'put', key: 'k', json: '{"a":1}' },
    { op: 'del', prefixes: ['p:'], keys: ['k'] },
    { op: 'clear' },
    { op: 'keys' },
    { op: 'read', after: null, maxBytes: 100 },
  ]);
});

test('nativeBridge: 답 모양이 이상하면 읽기 오류로 본다(엉뚱한 값으로 되살리지 않게)', async () => {
  const w = {
    webkit: {
      messageHandlers: { mathApp: { postMessage: () => Promise.resolve({ nope: 1 }) } },
    },
  };
  const br = nativeBridge(w);
  assert.ok(br);
  await assert.rejects(br.keys());
  await assert.rejects(br.read(null, 1));
});
