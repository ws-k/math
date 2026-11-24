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
import { FIRST, scopedKey } from '../src/app/profile.ts';
import { resetRanges } from '../src/app/reset.ts';
import { memStore } from './app-fixture.ts';

const memBase = memStore;

/**
 * 네이티브 사본 대신 메모리(키 → JSON 문자열). 쪽 나누기는 문자열 길이로 잰다.
 * fail 에 'put'·'del'·'keys'·'read' 를 넣으면 그 일이 실패하고, 'put <키>' 는 그 키만 실패한다.
 * hang 에 넣은 일은 답이 영영 오지 않는다(네이티브가 멈춘 경우).
 */
function memBridge() {
  const files = new Map<string, string>();
  const ops: string[] = [];
  const sorted = () => [...files.keys()].sort();
  const never = new Promise<never>(() => {});
  const b: BackupBridge & {
    files: typeof files;
    ops: string[];
    fail: Set<string>;
    hang: Set<string>;
    skipped: string[];
  } = {
    files,
    ops,
    fail: new Set(),
    hang: new Set(),
    skipped: [],
    async put(key, json) {
      ops.push(`put ${key}`);
      if (b.hang.has('put')) return never;
      if (b.fail.has('put') || b.fail.has(`put ${key}`)) throw new Error('디스크 가득');
      files.set(key, json);
    },
    async del(prefixes, keys) {
      ops.push(`del ${prefixes.join(',')}|${keys.join(',')}`);
      if (b.hang.has('del')) return never;
      if (b.fail.has('del')) throw new Error('지우기 실패');
      for (const k of [...files.keys()]) if (prefixes.some((p) => k.startsWith(p))) files.delete(k);
      for (const k of keys) files.delete(k);
    },
    async keys() {
      if (b.hang.has('keys')) return never;
      if (b.fail.has('keys')) throw new Error('읽기 실패');
      return sorted();
    },
    async read(after, maxBytes) {
      ops.push(`read ${after ?? ''}`);
      if (b.hang.has('read')) return never;
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
      const next = last !== undefined && last !== rest.at(-1) ? last : null;
      return { entries, next, skipped: after === null ? b.skipped : [] };
    },
  };
  return b;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n: number) => {
  for (let i = 0; i < n; i++) await tick();
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 약속이 지금 풀렸는가(거절은 'rejected') */
const state = async (p: Promise<unknown>) => {
  const marker = Symbol();
  const r = await Promise.race([
    p.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    ),
    tick().then(() => marker),
  ]);
  return r === marker ? 'pending' : r;
};
const sameAsIdb = (base: { data: Map<string, unknown> }, br: { files: Map<string, string> }) =>
  assert.deepEqual(
    [...br.files.entries()].sort(),
    [...base.data.entries()]
      .filter(([k]) => k !== BACKUP_MARKER)
      .map(([k, v]) => [k, JSON.stringify(v)])
      .sort(),
  );

/** 앞으로 손으로 풀어 줄 약속 — 시작 도중에 다른 쓰기를 끼워 넣으려고 */
function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** 표식 키만 쓰기가 실패하는 저장소(다른 키는 그대로) */
function failMarkerWrites(base: BaseStore, on: { fail: boolean }) {
  const set = base.set.bind(base);
  base.set = async (k, v) => {
    if (on.fail && k === BACKUP_MARKER) throw new Error('quota');
    return set(k, v);
  };
}

test('표식 키는 기기 공통 키이고, 다른 기능과 겹치지 않는 이름이다', () => {
  assert.equal(scopedKey('kid', BACKUP_MARKER), BACKUP_MARKER);
  assert.equal(BACKUP_MARKER, 'native-backup-marker');
});

test('쓰기·지우기는 IndexedDB 가 끝난 뒤 사본에도 같은 JSON 문자열로 간다', async () => {
  const base = memBase();
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start().done;
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
  await b.start().done;
  await assert.rejects(b.raw.set('settings', { pen: true }));
  await tick();
  assert.equal(br.files.has('settings'), false);
});

test('범위 지우기(프로필 삭제·단원 초기화)가 사본에도 한 번에 반영된다', async () => {
  const base = memBase();
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start().done;
  for (const k of ['card:u1/1', 'card:u2/1', 'ink:u1:a:note', 'lesson:u1', '@kid/card:u1/1'])
    await b.raw.set(k, 1);
  // 단원 초기화 모양: 접두어 둘 + 낱개 키 하나
  await b.raw.delPrefix(['card:u1/', 'ink:u1:'], ['lesson:u1']);
  // 프로필 삭제 모양: 그 사람 접두어 전체
  await b.raw.delPrefix(['@kid/']);
  await tick();
  assert.deepEqual([...br.files.keys()].sort(), ['card:u2/1']);
  assert.deepEqual([...base.data.keys()].sort(), ['card:u2/1', BACKUP_MARKER]);
});

test('첫 프로필의 전체 초기화는 사본에서도 다른 프로필(@kid/) 기록을 건드리지 않는다', async () => {
  const base = memBase();
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start().done;
  for (const k of ['card:u1/1', 'last', 'settings', '@kid/card:u1/1', '@kid/ink:u1:a:note'])
    await b.raw.set(k, 1);
  const { prefixes, keys } = resetRanges(null);
  await b.raw.delPrefix(
    prefixes.map((p) => scopedKey(FIRST, p)),
    keys.map((k) => scopedKey(FIRST, k)),
  );
  await tick();
  assert.deepEqual([...br.files.keys()].sort(), [
    '@kid/card:u1/1',
    '@kid/ink:u1:a:note',
    'settings',
  ]);
  sameAsIdb(base, br);
});

test('표식이 있고 사본이 없으면 IndexedDB 기준으로 첫 사본을 뜬다(표식은 사본에 넣지 않는다)', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', { due: 3 });
  base.data.set('settings', { pen: true });
  const br = memBridge();
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'reseeded');
  assert.deepEqual([...br.files.entries()].sort(), [
    ['card:u1/1', '{"due":3}'],
    ['settings', '{"pen":true}'],
  ]);
});

test('표식이 있으면 사본을 보기 전에 바로 그려도 된다(맞추기는 뒤에서)', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  const br = memBridge();
  const gate = deferred<void>();
  const keys = br.keys.bind(br);
  br.keys = async () => {
    await gate.promise;
    return keys();
  };
  const s = createBackup(base, br).start();
  assert.equal(await state(s.ready), 'resolved');
  assert.equal(await state(s.done), 'pending');
  gate.resolve();
  assert.equal(await s.done, 'kept');
});

test('표식이 있으면 사본 키 목록을 못 읽어도 그린다 — 대신 더럽다고 적어 다음에 다시 뜬다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  br.fail.add('keys');
  const s = createBackup(base, br).start();
  await s.ready;
  assert.equal(await s.done, 'error');
  await tick();
  assert.deepEqual(base.data.get(BACKUP_MARKER), { dirty: true });
});

test('표식도 사본도 없으면(이 기능 전의 기록) IndexedDB 로 첫 사본을 뜨고 표식을 남긴다', async () => {
  const base = memBase();
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  const s = createBackup(base, br).start();
  // 되살릴 사본이 없으니 기다리지 않고 그린다
  await s.ready;
  assert.equal(await s.done, 'seeded');
  assert.deepEqual([...br.files.keys()], ['card:u1/1']);
  assert.ok(base.data.has(BACKUP_MARKER));
});

test('첫 사본 뒤 표식 쓰기가 실패하면 이 세션에서는 사본에 적지 않는다', async () => {
  const base = memBase();
  const on = { fail: true };
  failMarkerWrites(base, on);
  const br = memBridge();
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'error');
  await b.raw.set('card:u1/9', 1);
  await ticks(3);
  assert.equal(br.files.has('card:u1/9'), false);
});

test('첫 사본을 뜨다 실패하면 더러운 표식을 남긴다 — 다음 시작은 되살리지 않고 IndexedDB 로 다시 뜬다', async () => {
  const base = memBase();
  base.data.set('card:u1/1', 1);
  base.data.set('card:u1/2', 2);
  const br = memBridge();
  br.fail.add('put card:u1/2');
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'error');
  // 반쯤 뜬 사본(card:u1/1)이 남은 채 이 세션에서 지운다 — 사본에는 안 간다
  await b.raw.del('card:u1/1');
  await ticks(3);
  assert.ok(br.files.has('card:u1/1'));
  assert.deepEqual(base.data.get(BACKUP_MARKER), { dirty: true });
  br.fail.clear();
  assert.equal(await createBackup(base, br).start().done, 'reseeded');
  assert.equal(base.data.has('card:u1/1'), false);
  sameAsIdb(base, br);
});

test('표식이 있고 키가 같으면 아무것도 다시 쓰지 않는다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'kept');
  assert.deepEqual(br.ops, []);
});

test('표식이 있는데 키가 어긋나면 IndexedDB 가 맞다 — 사본을 다시 뜨고 사본에만 남은 키를 지운다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  br.files.set('card:old/1', '9'); // 사본에만 남은 키(지우기가 사본에 못 간 경우)
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'reseeded');
  assert.deepEqual([...br.files.keys()], ['card:u1/1']);
});

test('다시 뜨기는 통째로 지우지 않고, 쪽 크기만큼 묶어 한 묶음씩 기다리며 보낸 뒤 남은 키를 지운다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, { dirty: true });
  for (let i = 0; i < 6; i++) base.data.set(`card:u1/${i}`, 'aaaa'); // JSON 6글자
  const br = memBridge();
  br.files.set('card:old/1', '9');
  let flying = 0;
  let most = 0;
  const put = br.put.bind(br);
  br.put = async (k, j) => {
    flying++;
    most = Math.max(most, flying);
    await tick();
    flying--;
    return put(k, j);
  };
  const b = createBackup(base, br, { pageBytes: 10 }); // 두 개씩 한 묶음
  assert.equal(await b.start().done, 'reseeded');
  assert.equal(most, 2);
  assert.equal(br.ops.includes('clear'), false);
  // 지우기는 다 보낸 뒤에, 사본에만 있는 키만
  assert.equal(br.ops.at(-1), 'del |card:old/1');
  sameAsIdb(base, br);
  assert.deepEqual(base.data.get(BACKUP_MARKER), {});
});

test('다시 뜨다 일부 키 사본 쓰기가 실패하면 표식을 더럽게 남기고, 쓰기는 계속 사본에 간다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  for (const k of ['card:u1/1', 'card:u1/2', 'card:u1/3']) base.data.set(k, 1);
  const br = memBridge();
  br.fail.add('put card:u1/2');
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'error');
  await tick();
  assert.deepEqual(base.data.get(BACKUP_MARKER), { dirty: true });
  await b.raw.set('settings', 1);
  await tick();
  assert.equal(br.files.get('settings'), '1');
  // 다음 시작에 통째로 다시 떠서 맞춘다
  br.fail.clear();
  assert.equal(await createBackup(base, br).start().done, 'reseeded');
  sameAsIdb(base, br);
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
  assert.equal(await b.start().done, 'restored');
  assert.deepEqual(base.data.get('ink:u1:p1:note'), ink); // JSON 왕복
  assert.deepEqual(base.data.get('@kid/card:u1/1'), { due: 2 });
  assert.deepEqual(base.data.get('settings'), { pen: false });
  assert.ok(base.data.has(BACKUP_MARKER));
  assert.ok(br.ops.filter((o) => o.startsWith('read')).length >= 3);
  // 되살린 값은 다시 쓰지 않고, IndexedDB 가 이긴 키만 사본에 다시 적는다
  assert.deepEqual(
    br.ops.filter((o) => o.startsWith('put')),
    ['put settings'],
  );
});

test('되살린 뒤 사본은 IndexedDB 와 같다(IndexedDB 가 이긴 값도 사본에 간다)', async () => {
  const base = memBase();
  base.data.set('settings', { pen: false });
  base.data.set('card:new/1', 5); // 사본에 없던 키
  const br = memBridge();
  br.files.set('settings', '{"pen":true}');
  br.files.set('card:u1/1', '1');
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'restored');
  sameAsIdb(base, br);
});

test('되살리기가 끝나기 전에는 그리면 안 된다', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  const gate = deferred<void>();
  const read = br.read.bind(br);
  br.read = async (after, max) => {
    await gate.promise;
    return read(after, max);
  };
  const s = createBackup(base, br).start();
  assert.equal(await state(s.ready), 'pending');
  gate.resolve();
  await s.ready;
  assert.equal(await s.done, 'restored');
  assert.equal(base.data.get('card:u1/1'), 1);
});

test('깨진 사본 파일 하나는 건너뛰고 나머지를 되살린다(깨진 파일은 사본에서 치운다)', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  br.files.set('card:u1/2', '{not json');
  br.files.set('card:u1/3', '3');
  const errors: unknown[] = [];
  const b = createBackup(base, br, { onError: (e) => errors.push(e) });
  assert.equal(await b.start().done, 'restored');
  assert.equal(base.data.get('card:u1/1'), 1);
  assert.equal(base.data.get('card:u1/3'), 3);
  assert.equal(base.data.has('card:u1/2'), false);
  assert.equal(errors.length, 1);
  sameAsIdb(base, br);
});

test('네이티브가 못 읽고 건너뛴 파일(UTF-8 아님)은 알리고 나머지를 되살린다', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  br.skipped = ['card:u1/2'];
  const errors: unknown[] = [];
  const b = createBackup(base, br, { onError: (e) => errors.push(e) });
  assert.equal(await b.start().done, 'restored');
  assert.equal(base.data.get('card:u1/1'), 1);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /card:u1\/2/);
});

test('사본 읽기 오류: 되살리지도, 사본을 다시 뜨지도, 표식을 남기지도, 그려도 된다고 하지도 않는다', async () => {
  for (const where of ['keys', 'read']) {
    const base = memBase();
    const br = memBridge();
    br.files.set('card:u1/1', '1');
    br.fail.add(where);
    const s = createBackup(base, br).start();
    assert.equal(await s.done, 'error');
    await assert.rejects(s.ready);
    assert.equal(base.data.size, 0, where);
    assert.equal(br.ops.filter((o) => o.startsWith('put') || o.startsWith('del')).length, 0, where);
    assert.deepEqual([...br.files.keys()], ['card:u1/1'], where);
  }
});

test('표식을 못 읽으면(IndexedDB 오류) 모르는 상태다 — 그리지 않는다', async () => {
  const base = memBase();
  base.get = async () => {
    throw new Error('IndexedDB 열기 실패');
  };
  const br = memBridge();
  const s = createBackup(base, br).start();
  assert.equal(await s.done, 'error');
  await assert.rejects(s.ready);
});

test('읽기 오류로 시작했으면 쓰기를 사본에 보내지 않는다 — 다시 시도해서 되살리면 그때부터 보낸다', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  br.fail.add('keys');
  const b = createBackup(base, br);
  assert.equal(await b.start().done, 'error');
  await b.raw.set('settings', 1);
  await ticks(3);
  assert.equal(br.files.has('settings'), false);
  assert.equal(base.data.has(BACKUP_MARKER), false);
  // 다시 시도
  br.fail.clear();
  const again = b.start();
  await again.ready;
  assert.equal(await again.done, 'restored');
  await tick();
  sameAsIdb(base, br);
});

test('되살려 채운 뒤 표식 쓰기가 실패하면 그리지 않고, 다시 시도하면 된다', async () => {
  const base = memBase();
  const on = { fail: true };
  failMarkerWrites(base, on);
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  const b = createBackup(base, br);
  const s = b.start();
  assert.equal(await s.done, 'error');
  await assert.rejects(s.ready);
  assert.equal(base.data.has(BACKUP_MARKER), false);
  on.fail = false;
  const again = b.start();
  await again.ready;
  assert.equal(await again.done, 'restored');
  assert.equal(base.data.get('card:u1/1'), 1);
  assert.ok(base.data.has(BACKUP_MARKER));
});

test('되살리는 중에 다시 시도하면 새로 시작하지 않고 하던 것을 기다린다', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  const gate = deferred<void>();
  const read = br.read.bind(br);
  br.read = async (after, max) => {
    await gate.promise;
    return read(after, max);
  };
  const b = createBackup(base, br);
  const first = b.start();
  await tick();
  const second = b.start();
  assert.equal(second.ready, first.ready);
  gate.resolve();
  assert.equal(await second.done, 'restored');
  assert.equal(br.ops.filter((o) => o.startsWith('read')).length, 1);
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
  const started = b.start().done;
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

test('경합: 되살리는 도중 IndexedDB 쓰기가 실패한 키는 사본 값으로 되살린다(건너뛰지 않는다)', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '"old"');
  const gate = deferred<void>();
  const read = br.read.bind(br);
  br.read = async (after, max) => {
    await gate.promise;
    return read(after, max);
  };
  const set = base.set.bind(base);
  let failing = true;
  base.set = async (k, v) => {
    if (failing && k === 'card:u1/1') throw new Error('quota');
    return set(k, v);
  };
  const b = createBackup(base, br);
  const started = b.start().done;
  await tick();
  await assert.rejects(b.raw.set('card:u1/1', 'new'));
  failing = false;
  gate.resolve();
  assert.equal(await started, 'restored');
  assert.equal(base.data.get('card:u1/1'), 'old');
});

test('경합: 첫 사본을 뜨는 도중 들어온 쓰기는 뜬 뒤 사본에 덮인다(옛 값으로 남지 않는다)', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 'old');
  const br = memBridge();
  const gate = deferred<void>();
  const get = base.get.bind(base);
  base.get = async <T>(k: string) => {
    const snap = await get<T>(k); // 이 순간의 값을 읽어 두고
    if (k !== BACKUP_MARKER) await gate.promise; // 사본에 보내기 전에 다른 쓰기가 끼어든다
    return snap;
  };
  const b = createBackup(base, br);
  const started = b.start().done;
  await ticks(3);
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
  await b.start().done;
  br.fail.add('put');
  await b.raw.set('card:u1/1', 2);
  await ticks(2);
  assert.equal(errors.length, 1);
  br.fail.delete('put');
  // 키 수는 같아도(사본에 옛 값이 있을 수 있다) 표식이 더럽다고 하면 다시 뜬다
  br.files.set('card:u1/1', '1');
  const again = createBackup(base, br);
  assert.equal(await again.start().done, 'reseeded');
  assert.equal(br.files.get('card:u1/1'), '2');
  assert.equal(await createBackup(base, br).start().done, 'kept');
});

test('사본 지우기가 실패해도 표식에 남겨 다음 시작에 다시 뜬다', async () => {
  const base = memBase();
  const br = memBridge();
  const b = createBackup(base, br);
  await b.start().done;
  await b.raw.set('card:u1/1', 1);
  await tick();
  br.fail.add('del');
  await b.raw.del('card:u1/1');
  await ticks(2);
  assert.deepEqual(base.data.get(BACKUP_MARKER), { dirty: true });
  br.fail.clear();
  assert.equal(await createBackup(base, br).start().done, 'reseeded');
  assert.equal(br.files.has('card:u1/1'), false);
});

test('네이티브가 시작 맞추기에 끝내 답하지 않으면 쌓아 둔 일을 버리고 이 세션은 사본을 끈다(한 번만 알림)', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  base.data.set('card:u1/1', 1);
  const br = memBridge();
  br.hang.add('keys');
  const errors: unknown[] = [];
  const b = createBackup(base, br, { onError: (e) => errors.push(e), stallMs: 20 });
  const s = b.start();
  await s.ready;
  await b.raw.set('card:u1/2', 2);
  assert.equal(await s.done, 'error');
  await b.raw.set('card:u1/3', 3);
  await b.raw.del('card:u1/1');
  await ticks(3);
  assert.equal(br.ops.length, 0);
  assert.equal(errors.length, 1);
  assert.deepEqual(base.data.get(BACKUP_MARKER), { dirty: true });
});

test('시작 맞추기 동안 쌓이는 일은 끝없이 늘지 않는다 — 넘치면 버리고 사본을 끈다', async () => {
  const base = memBase();
  base.data.set(BACKUP_MARKER, {});
  const br = memBridge();
  const gate = deferred<void>();
  const keys = br.keys.bind(br);
  br.keys = async () => {
    await gate.promise;
    return keys();
  };
  const errors: unknown[] = [];
  const b = createBackup(base, br, { onError: (e) => errors.push(e), maxQueue: 3 });
  const s = b.start();
  await s.ready;
  for (let i = 0; i < 5; i++) await b.raw.set(`card:u1/${i}`, i);
  gate.resolve();
  await s.done;
  await b.raw.set('card:u1/9', 9);
  await ticks(3);
  assert.equal(br.ops.filter((o) => o.startsWith('put')).length, 0);
  assert.equal(errors.length, 1);
  assert.deepEqual(base.data.get(BACKUP_MARKER), { dirty: true });
});

test('늦게 답하는 네이티브도 기다린다(멈춤 판정은 한 번의 답 기준)', async () => {
  const base = memBase();
  const br = memBridge();
  br.files.set('card:u1/1', '1');
  const read = br.read.bind(br);
  br.read = async (after, max) => {
    await sleep(5);
    return read(after, max);
  };
  const b = createBackup(base, br, { stallMs: 50, pageBytes: 1 });
  for (let i = 2; i < 30; i++) br.files.set(`card:u1/${i}`, String(i)); // 쪽 30개, 합쳐 150ms 남짓
  assert.equal(await b.start().done, 'restored');
});

test('nativeBridge: 웹(처리기 없음)에서는 null — 웹 동작은 그대로', () => {
  assert.equal(nativeBridge({}), null);
  assert.equal(nativeBridge(undefined), null);
  assert.equal(nativeBridge({ webkit: { messageHandlers: {} } }), null);
  assert.equal(nativeBridge({ webkit: { messageHandlers: { mathApp: {} } } }), null);
});

test('nativeBridge: 앱에서는 메시지 처리기로 보내고 답을 받는다', async () => {
  const sent: unknown[] = [];
  const replies: Record<string, unknown> = {
    put: true,
    del: true,
    keys: ['a', 'b'],
    read: { entries: [['a', '1']], next: null, skipped: ['c'] },
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
  assert.deepEqual(await br.keys(), ['a', 'b']);
  assert.deepEqual(await br.read(null, 100), {
    entries: [['a', '1']],
    next: null,
    skipped: ['c'],
  });
  assert.deepEqual(sent, [
    { op: 'put', key: 'k', json: '{"a":1}' },
    { op: 'del', prefixes: ['p:'], keys: ['k'] },
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
