// IndexedDB 얇은 래퍼. 키 하나에 값 하나(진행 카드·설정·쪽마다 필기)만 넣는 단순한 저장소.
// localStorage 는 5MB 언저리에서 막히고 동기라 필기 저장에 맞지 않아 IndexedDB 를 쓴다.

import { createScopedStore, FIRST, type RawStore, scopedKey } from './profile.ts';
import { createSaver } from './saver.ts';

const DB = 'math-rebuild';
const STORE = 'kv';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = f(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 쓰기는 요청 성공(onsuccess)이 아니라 트랜잭션 완료(oncomplete)에서 끝난 것으로 본다.
 * 요청이 성공해도 디스크에 쓰다가 용량 부족 등으로 트랜잭션이 중단(abort)될 수 있어서다.
 */
async function write(f: (s: IDBObjectStore) => IDBRequest): Promise<void> {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('저장 트랜잭션 중단'));
    tx.onerror = () => reject(tx.error);
    f(tx.objectStore(STORE));
  });
}

/** prefix 로 시작하는 키 범위 (문자열 키 순서상 prefix 뒤에 오는 가장 큰 글자까지) */
const range = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}￿`);

const raw: RawStore = {
  get<T>(key: string): Promise<T | undefined> {
    return run('readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
  },
  set(key: string, value: unknown): Promise<void> {
    return write((s) => s.put(value, key));
  },
  del(key: string): Promise<void> {
    return write((s) => s.delete(key));
  },
  async keys(prefix = ''): Promise<string[]> {
    const ks = await run('readonly', (s) => s.getAllKeys(prefix ? range(prefix) : undefined));
    return ks as string[];
  },
  /** prefix 로 시작하는 키와 값 전부. 한 트랜잭션 안에서 읽어 키와 값이 어긋나지 않게 한다. */
  async entries<T>(prefix: string): Promise<[string, T][]> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const out: [string, T][] = [];
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor(range(prefix));
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(out);
        out.push([c.key as string, c.value as T]);
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  },
};

let profile = FIRST;
/** 지금 학습자 프로필. 바꿀 때는 profile.ts 의 switchProfile 순서를 따른다 */
export const currentProfile = () => profile;
export const setCurrentProfile = (id: string) => {
  profile = id;
};

/** 지금 프로필의 키만 보이는 저장소(읽기). 화면 코드는 프로필을 모른 채 이것을 쓴다 */
export const store = createScopedStore(raw, currentProfile);

/**
 * 앱의 모든 저장은 이것을 거친다 — 실패하면 쥐고 있다가 다시 시도하고, 화면 위 경고로 알린다.
 * 프로필 접두어는 save() 순간에 붙여 쥔다(저장 도중 프로필이 바뀌어도 섞이지 않게).
 */
export const saver = createSaver(raw.set, {
  retryMs: 3000,
  scope: (k) => scopedKey(profile, k),
});

/** 홈 화면 앱에서도 저장소가 지워지지 않게 "영구 저장"을 요청한다. 결과(허용 여부)를 돌려준다. */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
