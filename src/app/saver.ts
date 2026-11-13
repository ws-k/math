// 저장 대기열. IndexedDB 쓰기는 용량 부족·사생활 모드 등으로 실패할 수 있는데, 실패를 삼키면
// 학생이 쓴 필기가 조용히 사라진다. 그래서 키마다 "아직 못 쓴 최신 값"을 쥐고 있다가 다시 시도하고,
// 실패 중인지 화면이 알 수 있게 알린다. 같은 키는 한 번에 하나만 써서 오래된 값이 새 값을 덮지 않게 한다.

export interface Saver {
  save(key: string, value: unknown): void;
  /** 지금 저장에 실패해 다시 시도하는 중인가 */
  failing(): boolean;
  subscribe(f: () => void): () => void;
}

export function createSaver(
  write: (key: string, value: unknown) => Promise<void>,
  o: { retryMs: number; later?: (f: () => void, ms: number) => void },
): Saver {
  const later = o.later ?? ((f, ms) => setTimeout(f, ms));
  const pending = new Map<string, unknown>();
  const busy = new Set<string>();
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  let wasFailing = false;
  const notify = () => {
    const now = failed.size > 0;
    if (now === wasFailing) return;
    wasFailing = now;
    for (const f of listeners) f();
  };

  const pump = (key: string) => {
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
    save(key, value) {
      pending.set(key, value);
      // 실패 중인 키는 다시 시도 타이머가 이어 쓴다(바로 또 쓰면 실패를 연달아 쌓는다)
      if (!failed.has(key)) pump(key);
    },
    failing: () => failed.size > 0,
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}
