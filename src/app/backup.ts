// 앱 전용 학습 기록 사본. 원본은 IndexedDB 그대로이고, 쓰기·지우기가 끝날 때마다 같은 내용을
// iOS 앱의 파일(ios/Math/Backup.swift, 키 하나에 파일 하나)에도 적는다.
// 왜: 앱 웹뷰에서 persist() 가 false 로 나오고(시뮬레이터 실측), WebKit 이 저장소를 지우지 않는다는 공식 보장이 없다.
// 시작할 때 IndexedDB 가 지워졌으면 사본에서 되살린다. 웹(PWA)에서는 다리가 없어 이 모듈 전체가 빠진다.

import type { RawStore } from './profile.ts';
import { type MaybeWebkit, nativeHandler } from './shell.ts';

/**
 * 표식 키(기기 공통 키). "이 IndexedDB 는 사본과 맞춰진 적이 있다"는 뜻이라 사본에는 넣지 않는다.
 * WebKit 이 저장소를 지우면 표식도 함께 사라지므로, 표식이 없는데 사본이 있으면 지워진 것으로 본다.
 * 표식이 있으면 IndexedDB 가 맞다(사용자가 초기화해서 비었을 수도 있으니 사본으로 되살리면 안 된다).
 * 이름이 길고 구체적인 것은 다른 기능의 키와 우연히 겹치면 지워진 것을 못 알아채서다.
 */
export const BACKUP_MARKER = 'native-backup-marker';

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
  keys(): Promise<string[]>;
  /**
   * after 다음 키부터 maxBytes 언저리까지 한 쪽. 답 하나가 너무 커지지 않게 나눠 받는다
   * (키 하나가 maxBytes 보다 크면 그 키만 한 쪽). skipped 는 네이티브가 읽지 못해 건너뛴 키(UTF-8 이 아닌 파일 등).
   */
  read(
    after: string | null,
    maxBytes: number,
  ): Promise<{ entries: [string, string][]; next: string | null; skipped?: string[] }>;
}

/** IndexedDB 저장소 + 되살리기용 채우기 */
export interface BaseStore extends RawStore {
  /** 없는 키만 한 트랜잭션에서 채운다(이미 있는 키는 IndexedDB 가 이긴다). skip 이 참인 키는 건너뛴다 */
  fill(entries: [string, unknown][], skip: (key: string) => boolean): Promise<void>;
}

/** kept 맞음 · seeded 첫 사본 · reseeded 다시 뜸 · restored 되살림 · error 실패(아래 설명) */
export type StartResult = 'kept' | 'seeded' | 'reseeded' | 'restored' | 'error';

/** 시작 맞추기 하나 */
export interface Start {
  /**
   * 화면을 그려도 되면 풀린다. 되살리기가 실패했거나 지워졌는지 알 수 없으면 거절된다 —
   * 그때 그리면 빈 기록으로 시작하고, 그 뒤 쓰기가 사본까지 덮을 수 있다.
   */
  ready: Promise<void>;
  /** 맞추기가 다 끝난 결과. 거절되지 않는다 */
  done: Promise<StartResult>;
}

const PAGE_BYTES = 2_000_000;
/** 네이티브 답 하나를 이만큼 기다려도 안 오면 멈춘 것으로 본다(오래 걸리는 되살리기 전체가 아니라 답 하나 기준) */
const STALL_MS = 15_000;
/** 시작 맞추기 동안 쌓아 둘 일의 상한. 넘으면 버린다 — 맞추기가 안 끝나는 동안 메모리가 끝없이 늘지 않게 */
const MAX_QUEUE = 500;

const toJson = (v: unknown) => JSON.stringify(v) ?? 'null';
const isDirty = (m: unknown) => (m as Marker | null)?.dirty === true;
const sameKeys = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const s = new Set(b);
  return a.every((k) => s.has(k));
};
const mine = (keys: string[]) => keys.filter((k) => k !== BACKUP_MARKER);

/** 네이티브가 답하지 않음 */
class Stalled extends Error {}
/** 이 세션에서 사본을 껐다 — 하던 맞추기도 그만둔다(이미 알렸으니 다시 알리지 않는다) */
class Stopped extends Error {}

/**
 * 사본 상태:
 * - pending: 시작 맞추기 중. 사본에 보낼 일을 쌓아 둔다
 * - on: 표식이 확인됐다. 보낼 일을 바로 보낸다
 * - off: 이 세션에서는 사본에 적지 않는다(표식을 확인 못 한 채 그렸거나, 네이티브가 멈췄거나, 일이 넘쳤다)
 */
type Mode = 'pending' | 'on' | 'off';

export function createBackup(
  base: BaseStore,
  bridge: BackupBridge,
  o: {
    onError?: (e: unknown) => void;
    pageBytes?: number;
    stallMs?: number;
    maxQueue?: number;
  } = {},
): { raw: RawStore; start(): Start } {
  const report = (e: unknown) => o.onError?.(e);
  const pageBytes = o.pageBytes ?? PAGE_BYTES;
  const stallMs = o.stallMs ?? STALL_MS;
  const maxQueue = o.maxQueue ?? MAX_QUEUE;

  let mode: Mode = 'pending';
  /**
   * 시작 맞추기가 끝날 때까지 사본에 보낼 일을 쌓아 둔다. 다시 뜨기는 IndexedDB 를 읽어 보내는데,
   * 그 사이 끝난 쓰기를 바로 보내면 늦게 도착한 옛 값이 덮는다. 쌓아 둔 일을 맞추기 뒤에 순서대로 보내면
   * 각 일이 "그 키의 최신 값/지움"이라 결과가 마지막 상태와 같아진다.
   */
  let queue: (() => Promise<void>)[] = [];
  /**
   * 시작 맞추기 동안 지운 키·접두어. 되살리기가 이 키들을 옛 사본 값으로 되살리지 않게.
   * 쓴 키는 넣지 않는다 — IndexedDB 쓰기가 실패했으면 사본 값으로 되살려야 하고, 성공했으면
   * fill 이 같은 트랜잭션 안에서 키가 있는지 보고 건너뛴다(BaseStore.fill).
   */
  const deletedKeys = new Set<string>();
  const deletedPrefixes: string[] = [];
  const deleted = (k: string) => deletedKeys.has(k) || deletedPrefixes.some((p) => k.startsWith(p));
  /** 표식이 있다고 확인됐는가. 모르는 채 표식을 만들면(더럽다고라도) 지워진 IndexedDB 를 맞다고 믿게 된다 */
  let markerKnown = false;
  let dirtyMarked = false;
  /** 진행 중인 맞추기. 다시 시도가 겹치면 새로 시작하지 않고 이것을 기다린다(되살리기 둘이 섞이지 않게) */
  let inflight: Start | null = null;

  const markDirty = () => {
    if (!markerKnown || dirtyMarked) return;
    dirtyMarked = true;
    base.set(BACKUP_MARKER, { dirty: true } satisfies Marker).catch((err: unknown) => {
      dirtyMarked = false;
      report(err);
    });
  };
  const failed = (e: unknown) => {
    report(e);
    markDirty();
  };
  /** 이 세션의 사본을 끈다. 쌓아 둔 일은 버리고, 표식을 알면 더럽다고 남겨 다음 시작에 통째로 다시 뜨게 */
  const abandon = (why?: unknown) => {
    if (mode === 'off') return;
    mode = 'off';
    queue = [];
    if (why !== undefined) report(why);
    markDirty();
  };
  const mirror = (op: () => Promise<void>) => {
    if (mode === 'on') op().catch(failed);
    else if (mode === 'pending') {
      if (queue.length >= maxQueue)
        abandon(new Error('시작 맞추기가 끝나지 않아 사본에 보낼 일이 넘쳤어요'));
      else queue.push(op);
    }
  };
  const forget = (keys: string[], prefixes: string[] = []) => {
    if (mode !== 'pending') return;
    for (const k of keys) deletedKeys.add(k);
    deletedPrefixes.push(...prefixes);
  };

  /** 네이티브 답을 기다린다. 한 답이 stallMs 넘게 안 오면 멈춘 것으로 본다 */
  const call = <T>(p: Promise<T>): Promise<T> => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const stall = new Promise<never>((_, reject) => {
      t = setTimeout(() => reject(new Stalled('네이티브 사본이 답하지 않아요')), stallMs);
    });
    return Promise.race([p, stall]).finally(() => clearTimeout(t));
  };
  const alive = () => {
    if (mode === 'off') throw new Stopped();
  };

  /**
   * 알려진 한계: IndexedDB 트랜잭션이 끝난 뒤 사본 파일을 쓰기 전에 앱이 죽으면 그 키의 사본 값은 하나 옛것이다.
   * 표식이 있는 한 IndexedDB 가 이기므로 문제는 IndexedDB 까지 지워졌을 때뿐이고, 그때 마지막 한 번의 쓰기를 잃는다.
   */
  const raw: RawStore = {
    get: <T>(k: string) => base.get<T>(k),
    keys: (p?: string) => base.keys(p),
    entries: <T>(p: string) => base.entries<T>(p),
    async set(key, value) {
      // IndexedDB 가 받은 순간의 값으로 적는다(넘긴 객체가 뒤에 바뀌어도 원본과 같게)
      const json = toJson(value);
      await base.set(key, value);
      if (key !== BACKUP_MARKER) mirror(() => bridge.put(key, json));
    },
    async del(key) {
      forget([key]);
      await base.del(key);
      mirror(() => bridge.del([], [key]));
    },
    async delPrefix(prefixes, keys = []) {
      forget(keys, prefixes);
      await base.delPrefix(prefixes, keys);
      mirror(() => bridge.del(prefixes, keys));
    },
  };

  /**
   * 사본을 IndexedDB 에 맞춘다: keys 의 지금 값을 쪽 크기 묶음으로 보내고(한 묶음씩 기다린다),
   * 그다음 사본에만 있는 키를 지운다. 통째로 지우고 다시 쓰지 않는 것은 그 사이 앱이 죽으면 사본이 비기 때문이고,
   * 한꺼번에 보내지 않는 것은 큰 필기가 메모리에 다 올라오고 네이티브 큐가 한 번에 밀리기 때문이다.
   */
  async function reconcile(keys: string[]) {
    let batch: Promise<void>[] = [];
    let bytes = 0;
    for (const k of keys) {
      alive();
      const v = await base.get(k);
      // 그 사이 지워졌다 — 그 지움은 쌓아 둔 일이 사본에 보낸다
      if (v === undefined) continue;
      const json = toJson(v);
      batch.push(call(bridge.put(k, json)));
      bytes += json.length;
      if (bytes >= pageBytes) {
        await Promise.all(batch);
        batch = [];
        bytes = 0;
      }
    }
    await Promise.all(batch);
    alive();
    const [idbKeys, backupKeys] = await Promise.all([base.keys(), call(bridge.keys())]);
    const have = new Set(idbKeys);
    const extra = backupKeys.filter((k) => !have.has(k));
    if (extra.length > 0) await call(bridge.del([], extra));
  }

  async function restore() {
    // 쪽마다 바로 해석하고 문자열은 버린다 — 문자열과 값을 동시에 다 들고 있지 않게.
    // 채우기는 다 읽은 뒤 한 번에: 읽다 실패하면 반만 되살린 상태를 만들지 않는다
    const parsed: [string, unknown][] = [];
    let after: string | null = null;
    do {
      const page: Awaited<ReturnType<BackupBridge['read']>> = await call(
        bridge.read(after, pageBytes),
      );
      for (const [k, json] of page.entries) {
        if (k === BACKUP_MARKER) continue;
        try {
          parsed.push([k, JSON.parse(json)]);
        } catch (e) {
          report(e); // 깨진 파일 하나 때문에 나머지를 버리지 않는다
        }
      }
      if (page.skipped && page.skipped.length > 0)
        report(new Error(`사본 파일을 읽지 못해 건너뛰었어요: ${page.skipped.join(', ')}`));
      after = page.next;
    } while (after !== null);
    await base.fill(parsed, deleted);
  }

  /** 맞추기가 끝났다. 이 세션에서 사본을 껐거나 실패를 겪었으면 더럽다고 남긴다(다음 시작에 다시 뜨게) */
  async function confirm(prev: Marker | undefined) {
    const next: Marker = mode === 'off' || dirtyMarked ? { dirty: true } : {};
    if (prev === undefined || isDirty(prev) !== isDirty(next)) await base.set(BACKUP_MARKER, next);
    markerKnown = true;
  }

  /** 빠른 판정(표식 → 키 목록) 뒤 실행. open 은 "그려도 된다" */
  async function sync(open: () => void): Promise<StartResult> {
    // 표식은 따로 먼저 읽는다 — 다른 읽기가 실패해도 표식이 있는지는 알 수 있게
    const marker = await base.get<Marker>(BACKUP_MARKER);
    if (marker !== undefined) {
      // IndexedDB 가 맞다. 바로 그리고 사본은 뒤에서 맞춘다
      markerKnown = true;
      open();
      const [idbKeys, backupKeys] = await Promise.all([base.keys(), call(bridge.keys())]);
      if (!isDirty(marker) && sameKeys(mine(idbKeys), backupKeys)) {
        await confirm(marker);
        return 'kept';
      }
      await reconcile(mine(idbKeys));
      await confirm(marker);
      return 'reseeded';
    }
    const [idbKeys, backupKeys] = await Promise.all([base.keys(), call(bridge.keys())]);
    if (backupKeys.length === 0) {
      // 되살릴 것이 없다(이 기능 전의 기록이거나 처음 설치) — 그리고 첫 사본을 뜬다
      open();
      await reconcile(mine(idbKeys));
      await confirm(undefined);
      return 'seeded';
    }
    await restore();
    // 되살리기 전부터 IndexedDB 에 있던 키는 IndexedDB 가 이겼으니 그 값을 사본에도 적는다(사본 = IndexedDB)
    await reconcile(mine(idbKeys));
    await confirm(undefined);
    return 'restored';
  }

  /** 맞추기 뒤 쌓아 둔 일 처리 */
  function settle(ok: boolean, opened: boolean, e?: unknown) {
    if (ok || markerKnown) {
      // 표식이 있으면 실패해도 사본은 계속 쓴다(IndexedDB 가 맞으니). 다만 사본이 어긋났으니 다음에 다시 뜬다
      if (!ok) {
        if (e instanceof Stalled) abandon();
        else markDirty();
      }
      if (mode === 'pending') {
        mode = 'on';
        const q = queue;
        queue = [];
        for (const op of q) op().catch(failed);
      }
      deletedKeys.clear();
      deletedPrefixes.length = 0;
      return;
    }
    // 표식 없이 이미 그렸다(첫 사본 실패): 이 세션의 쓰기를 사본에 보내지 않는다.
    // 사본이 비어 있던 경우라 IndexedDB 가 맞다 — 더러운 표식을 남겨, 다음 시작이 반쯤 뜬 사본을
    // "지워진 IndexedDB 의 사본"으로 알고 이 세션에서 지운 키를 되살리지 않게 한다
    if (opened) {
      abandon();
      markerKnown = true;
      markDirty();
    }
    // 그리지 않고 막혀 있다(되살리기 실패): 다시 시도를 기다린다. 화면이 없으니 쌓이는 일도 없다
  }

  return {
    raw,
    start() {
      if (inflight) return inflight;
      let open: () => void = () => {};
      let refuse: (e: unknown) => void = () => {};
      let opened = false;
      const ready = new Promise<void>((res, rej) => {
        open = () => {
          opened = true;
          res();
        };
        refuse = rej;
      });
      // 아무도 기다리지 않는 거절이 처리 안 된 오류로 튀지 않게(기다리는 쪽에는 그대로 거절된다)
      ready.catch(() => {});
      const done = sync(() => open()).then(
        (r) => {
          open();
          settle(true, opened);
          return r;
        },
        (e: unknown) => {
          if (!(e instanceof Stopped)) report(e);
          refuse(e);
          settle(false, opened, e);
          return 'error' as const;
        },
      );
      const s: Start = {
        ready,
        done: done.finally(() => {
          inflight = null;
        }),
      };
      inflight = s;
      return s;
    },
  };
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** 앱의 네이티브 다리. 웹(처리기 없음)이면 null — 웹 동작은 바뀌지 않는다 */
export function nativeBridge(w: MaybeWebkit = globalThis as MaybeWebkit): BackupBridge | null {
  const h = nativeHandler(w);
  if (!h) return null;
  // 답을 주는 처리기(WKScriptMessageHandlerWithReply)라 postMessage 가 약속을 돌려준다
  const post = (m: unknown) => Promise.resolve(h.postMessage(m));
  const done = async (m: unknown) => {
    await post(m);
  };
  return {
    put: (key, json) => done({ op: 'put', key, json }),
    del: (prefixes, keys) => done({ op: 'del', prefixes, keys }),
    async keys() {
      const r = await post({ op: 'keys' });
      if (!isStrings(r)) throw new Error('사본 키 목록 모양이 이상해요');
      return r;
    },
    async read(after, maxBytes) {
      const r = (await post({ op: 'read', after, maxBytes })) as {
        entries?: unknown;
        next?: unknown;
        skipped?: unknown;
      } | null;
      const entries = r?.entries;
      const next = r?.next ?? null;
      const skipped = r?.skipped ?? [];
      const ok =
        Array.isArray(entries) &&
        entries.every((e) => isStrings(e) && e.length === 2) &&
        (next === null || typeof next === 'string') &&
        isStrings(skipped);
      if (!ok) throw new Error('사본 읽기 답 모양이 이상해요');
      return { entries: entries as [string, string][], next: next as string | null, skipped };
    },
  };
}
