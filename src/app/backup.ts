// 앱 전용 학습 기록 사본. 원본은 IndexedDB 그대로이고, 쓰기·지우기가 끝날 때마다 같은 내용을
// iOS 앱의 파일(ios/Math/Backup.swift, 키 하나에 파일 하나)에도 적는다.
// 왜: 앱 웹뷰에서 persist() 가 false 로 나오고(시뮬레이터 실측), WebKit 이 저장소를 지우지 않는다는 공식 보장이 없다.
// 시작할 때 IndexedDB 가 지워졌으면 사본에서 되살린다. 웹(PWA)에서는 다리가 없어 이 모듈 전체가 빠진다.

import type { RawStore } from './profile.ts';
import { HANDLER } from './shell.ts';

/**
 * 표식 키(기기 공통 키). "이 IndexedDB 는 사본과 맞춰진 적이 있다"는 뜻이라 사본에는 넣지 않는다.
 * WebKit 이 저장소를 지우면 표식도 함께 사라지므로, 표식이 없는데 사본이 있으면 지워진 것으로 본다.
 * 표식이 있으면 IndexedDB 가 맞다(사용자가 초기화해서 비었을 수도 있으니 사본으로 되살리면 안 된다).
 */
export const BACKUP_MARKER = 'backup';

interface Marker {
  /** 사본 쓰기가 실패한 적 있다 — 키 수가 같아도 사본 값이 옛것일 수 있어 다음 시작에 통째로 다시 뜬다 */
  dirty?: boolean;
}

/** 네이티브 사본. 메시지는 보낸 순서대로 처리된다(Swift 쪽 직렬 큐) */
export interface BackupBridge {
  /** json 은 JSON.stringify 결과 그대로 파일에 적힌다 */
  put(key: string, json: string): Promise<void>;
  /** 접두어 범위와 낱개 키를 지운다 */
  del(prefixes: string[], keys: string[]): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  /**
   * after 다음 키부터 maxBytes 언저리까지 한 쪽. 큰 필기를 한 번에 넘기면 메모리가 두 배로 들고
   * 답 하나가 너무 커져서 나눠 받는다(키 하나가 maxBytes 보다 크면 그 키만 한 쪽).
   */
  read(
    after: string | null,
    maxBytes: number,
  ): Promise<{ entries: [string, string][]; next: string | null }>;
}

/** IndexedDB 저장소 + 되살리기용 채우기 */
export interface BaseStore extends RawStore {
  /** 없는 키만 한 트랜잭션에서 채운다(이미 있는 키는 IndexedDB 가 이긴다). skip 이 참인 키는 건너뛴다 */
  fill(entries: [string, unknown][], skip: (key: string) => boolean): Promise<void>;
}

/** kept 맞음 · seeded 첫 사본 · reseeded 다시 뜸 · restored 되살림 · error 읽기 오류(아무것도 안 함) */
export type StartResult = 'kept' | 'seeded' | 'reseeded' | 'restored' | 'error';

const PAGE_BYTES = 2_000_000;

const toJson = (v: unknown) => JSON.stringify(v) ?? 'null';
const isDirty = (m: unknown) => (m as Marker | null)?.dirty === true;
const sameKeys = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const s = new Set(b);
  return a.every((k) => s.has(k));
};

export function createBackup(
  base: BaseStore,
  bridge: BackupBridge,
  o: { onError?: (e: unknown) => void; pageBytes?: number } = {},
): { raw: RawStore; start(): Promise<StartResult> } {
  const report = (e: unknown) => o.onError?.(e);
  /**
   * 시작 맞추기(start)가 끝날 때까지 사본에 보낼 일을 쌓아 둔다. 다시 뜨기는 IndexedDB 를 한 번 읽어 보내는데,
   * 그 사이 끝난 쓰기를 바로 보내면 늦게 도착한 옛 값이 덮는다. 쌓아 둔 일을 맞추기 뒤에 순서대로 보내면
   * 각 일이 "그 키의 최신 값/지움"이라 결과가 마지막 상태와 같아진다.
   */
  let queue: (() => Promise<void>)[] | null = [];
  /** 시작 맞추기 동안 쓰거나 지운 키·접두어. 되살리기가 이 키들을 옛 사본 값으로 덮거나 되살리지 않게 */
  const touchedKeys = new Set<string>();
  const touchedPrefixes: string[] = [];
  const touched = (k: string) => touchedKeys.has(k) || touchedPrefixes.some((p) => k.startsWith(p));
  /** 표식이 있다고 확인됐는가. 읽기 오류로 시작했으면 모른다 — 그때 표식을 만들면 지워진 IndexedDB 를 맞다고 믿게 된다 */
  let markerKnown = false;
  let dirtyMarked = false;

  const failed = (e: unknown) => {
    report(e);
    if (!markerKnown || dirtyMarked) return;
    dirtyMarked = true;
    base.set(BACKUP_MARKER, { dirty: true } satisfies Marker).catch((err: unknown) => {
      dirtyMarked = false;
      report(err);
    });
  };
  const mirror = (op: () => Promise<void>) => {
    if (queue) queue.push(op);
    else op().catch(failed);
  };
  const touch = (keys: string[], prefixes: string[] = []) => {
    if (!queue) return;
    for (const k of keys) touchedKeys.add(k);
    touchedPrefixes.push(...prefixes);
  };

  const raw: RawStore = {
    get: <T>(k: string) => base.get<T>(k),
    keys: (p?: string) => base.keys(p),
    entries: <T>(p: string) => base.entries<T>(p),
    async set(key, value) {
      touch([key]);
      // IndexedDB 가 받은 순간의 값으로 적는다(넘긴 객체가 뒤에 바뀌어도 원본과 같게)
      const json = toJson(value);
      await base.set(key, value);
      if (key !== BACKUP_MARKER) mirror(() => bridge.put(key, json));
    },
    async del(key) {
      touch([key]);
      await base.del(key);
      mirror(() => bridge.del([], [key]));
    },
    async delPrefix(prefixes, keys = []) {
      touch(keys, prefixes);
      await base.delPrefix(prefixes, keys);
      mirror(() => bridge.del(prefixes, keys));
    },
  };

  /** IndexedDB 전체로 사본을 통째 다시 뜬다. 메시지가 순서대로 처리되므로 기다리지 않고 한꺼번에 보낸다 */
  async function reseed() {
    const all = (await base.entries<unknown>('')).filter(([k]) => k !== BACKUP_MARKER);
    await Promise.all([bridge.clear(), ...all.map(([k, v]) => bridge.put(k, toJson(v)))]);
  }

  async function restore() {
    // 다 읽은 뒤에 채운다 — 읽다 실패하면 반만 되살린 상태를 만들지 않는다
    const got: [string, string][] = [];
    let after: string | null = null;
    do {
      const page = await bridge.read(after, o.pageBytes ?? PAGE_BYTES);
      got.push(...page.entries);
      after = page.next;
    } while (after !== null);
    const parsed: [string, unknown][] = [];
    for (const [k, json] of got) {
      if (k === BACKUP_MARKER) continue;
      try {
        parsed.push([k, JSON.parse(json)]);
      } catch (e) {
        report(e); // 깨진 파일 하나 때문에 나머지를 버리지 않는다
      }
    }
    await base.fill(parsed, touched);
  }

  async function sync(): Promise<StartResult> {
    const [marker, idbKeys, backupKeys] = await Promise.all([
      base.get<Marker>(BACKUP_MARKER),
      base.keys(),
      bridge.keys(),
    ]);
    const mine = idbKeys.filter((k) => k !== BACKUP_MARKER);
    let result: StartResult;
    if (marker !== undefined) {
      if (!isDirty(marker) && sameKeys(mine, backupKeys)) {
        markerKnown = true;
        return 'kept';
      }
      await reseed();
      result = 'reseeded';
    } else if (backupKeys.length === 0) {
      await reseed();
      result = 'seeded';
    } else {
      await restore();
      result = 'restored';
    }
    // 표식은 맞추기가 다 끝난 뒤에 — 중간에 앱이 꺼지면 다음 시작에 같은 판정을 다시 한다
    await base.set(BACKUP_MARKER, {} satisfies Marker);
    markerKnown = true;
    return result;
  }

  return {
    raw,
    async start() {
      let result: StartResult;
      try {
        result = await sync();
      } catch (e) {
        report(e);
        result = 'error';
      }
      const q = queue ?? [];
      queue = null;
      touchedKeys.clear();
      touchedPrefixes.length = 0;
      for (const op of q) op().catch(failed);
      return result;
    },
  };
}

type Post = { postMessage(m: unknown): unknown };
type MaybeWebkit = { webkit?: { messageHandlers?: Record<string, unknown> } } | undefined;

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** 앱의 네이티브 다리. 웹(처리기 없음)이면 null — 웹 동작은 바뀌지 않는다 */
export function nativeBridge(w: MaybeWebkit = globalThis as MaybeWebkit): BackupBridge | null {
  const h = w?.webkit?.messageHandlers?.[HANDLER] as Post | undefined;
  if (typeof h?.postMessage !== 'function') return null;
  // 답을 주는 처리기(WKScriptMessageHandlerWithReply)라 postMessage 가 약속을 돌려준다
  const post = (m: unknown) => Promise.resolve(h.postMessage(m));
  const done = async (m: unknown) => {
    await post(m);
  };
  return {
    put: (key, json) => done({ op: 'put', key, json }),
    del: (prefixes, keys) => done({ op: 'del', prefixes, keys }),
    clear: () => done({ op: 'clear' }),
    async keys() {
      const r = await post({ op: 'keys' });
      if (!isStrings(r)) throw new Error('사본 키 목록 모양이 이상해요');
      return r;
    },
    async read(after, maxBytes) {
      const r = (await post({ op: 'read', after, maxBytes })) as {
        entries?: unknown;
        next?: unknown;
      } | null;
      const entries = r?.entries;
      const next = r?.next ?? null;
      const ok =
        Array.isArray(entries) &&
        entries.every((e) => isStrings(e) && e.length === 2) &&
        (next === null || typeof next === 'string');
      if (!ok) throw new Error('사본 읽기 답 모양이 이상해요');
      return { entries: entries as [string, string][], next: next as string | null };
    },
  };
}
