// 저장 대기열. IndexedDB 쓰기는 용량 부족·사생활 모드 등으로 실패할 수 있는데, 실패를 삼키면
// 학생이 쓴 필기가 조용히 사라진다. 그래서 키마다 "아직 못 쓴 최신 값"을 쥐고 있다가 다시 시도하고,
// 실패 중인지 화면이 알 수 있게 알린다. 같은 키는 한 번에 하나만 써서 오래된 값이 새 값을 덮지 않게 한다.

export interface Saver {
  save(key: string, value: unknown): void;
  /** 쥐고 있는 값이 모두 써질 때까지 기다린다(프로필 바꾸기 전에). 실패 중이면 성공할 때까지 */
  idle(): Promise<void>;
  /** 지금 저장에 실패해 다시 시도하는 중인가 */
  failing(): boolean;
  /** 실제 저장 키가 prefix 로 시작하는 쥔 값을 버린다(지운 프로필의 값이 다시 시도로 되살아나지 않게) */
  discard(prefix: string): void;
  subscribe(f: () => void): () => void;
}

export function createSaver(
  write: (key: string, value: unknown) => Promise<void>,
  o: {
    retryMs: number;
    later?: (f: () => void, ms: number) => void;
    /**
     * 키를 실제 저장 키로(프로필 접두어). save() 를 부른 순간 바꿔 쥐므로, 쓰기 전에 프로필이 바뀌어도
     * 다시 시도까지 처음 프로필로 써진다.
     */
    scope?: (key: string) => string;
  },
): Saver {
  const later = o.later ?? ((f, ms) => setTimeout(f, ms));
  const pending = new Map<string, unknown>();
  const busy = new Set<string>();
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  let waiters: (() => void)[] = [];
  const settle = () => {
    if (pending.size > 0 || busy.size > 0) return;
    const ws = waiters;
    waiters = [];
    for (const w of ws) w();
  };
  /** 버린 접두어. 이미 쓰는 중이던 값이 실패해 다시 시도로 돌아와도 여기서 버린다 */
  const discarded = new Set<string>();
  const dropped = (key: string) => [...discarded].some((p) => key.startsWith(p));
  let wasFailing = false;
  const notify = () => {
    const now = failed.size > 0;
    if (now === wasFailing) return;
    wasFailing = now;
    for (const f of listeners) f();
  };

  const pump = (key: string) => {
    if (dropped(key)) {
      pending.delete(key);
      failed.delete(key);
      notify();
      settle();
      return;
    }
    if (busy.has(key) || !pending.has(key)) return;
    const value = pending.get(key);
    pending.delete(key);
    busy.add(key);
    write(key, value).then(
      () => {
        busy.delete(key);
        failed.delete(key);
        notify();
        pump(key);
        settle();
      },
      () => {
        busy.delete(key);
        // 그 사이 새 값이 왔으면 그것을, 아니면 실패한 값을 다시 쓴다
        if (!pending.has(key)) pending.set(key, value);
        failed.add(key);
        notify();
        later(() => pump(key), o.retryMs);
      },
    );
  };

  return {
    save(rawKey, value) {
      const key = o.scope ? o.scope(rawKey) : rawKey;
      if (dropped(key)) return;
      pending.set(key, value);
      // 실패 중인 키는 다시 시도 타이머가 이어 쓴다(바로 또 쓰면 실패를 연달아 쌓는다)
      if (!failed.has(key)) pump(key);
    },
    idle() {
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
        settle();
      });
    },
    failing: () => failed.size > 0,
    discard(prefix) {
      if (!prefix) return; // 첫 프로필(접두어 없음)은 지우지 않는다 — 빈 접두어는 모든 키다
      discarded.add(prefix);
      for (const k of [...pending.keys()]) if (k.startsWith(prefix)) pending.delete(k);
      for (const k of [...failed]) if (k.startsWith(prefix)) failed.delete(k);
      notify();
      settle();
    },
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}
