import type { BootView } from './boot.ts';

/**
 * 앱 시작 때 기록을 되살리는 동안·실패했을 때 App 대신 보이는 화면(boot.ts).
 * App 을 그리지 않는 것이 핵심이라 여기서는 저장소를 전혀 건드리지 않는다.
 */
export function BootScreen({ view, retry }: { view: BootView; retry: () => void }) {
  return (
    <main className="page boot" aria-live="polite">
      {view === 'loading' ? (
        <p className="muted">기록을 불러오는 중이에요…</p>
      ) : (
        <>
          <p>기록을 불러오지 못했어요.</p>
          <button type="button" className="btn primary big" onClick={retry}>
            다시 시도
          </button>
          <p className="muted boot-hint">기기 저장 공간이 부족하면 생길 수 있어요.</p>
        </>
      )}
    </main>
  );
}
