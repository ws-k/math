// 앱(iOS)의 시작 문. 기록 사본과 맞춰 "그려도 된다"(backup.ts 의 Start.ready)가 나와야 화면(App)을 그린다.
// 왜: IndexedDB 가 지워진 채 되살리기가 실패·지연됐는데 그려 버리면 빈 기록으로 시작하고, 그 뒤 쓰기가 사본까지
// 덮는다. 그래서 그 경우엔 App 을 아예 그리지 않고 막는 화면(불러오는 중 → 실패·다시 시도)만 보인다.
// 화면 그리기와 시계는 바깥에서 넣는다 — 15초 기다림과 늦게 오는 답을 node 테스트로 돌려 보려고.

export type BootView = 'loading' | 'failed';

export interface BootDeps {
  /** 그려도 되면 풀리는 약속. 다시 시도마다 다시 부른다(진행 중이면 같은 약속을 돌려줘도 된다) */
  ready: () => Promise<unknown>;
  /** App 을 그린다. 한 번만 불린다 */
  app: () => void;
  /** 막는 화면을 그린다 */
  screen: (view: BootView, retry: () => void) => void;
  /** 이만큼 기다려도 안 끝나면 실패 화면. 그 뒤에 끝나도 그때 그린다 */
  timeoutMs?: number;
  /** 이보다 빨리 끝나면 불러오는 중 화면을 띄우지 않는다 — 표식이 있으면 수 ms 라 글자가 번쩍이지 않게 */
  quietMs?: number;
  /** 시계(테스트용). 취소 함수를 돌려준다 */
  timer?: (f: () => void, ms: number) => () => void;
}

const realTimer = (f: () => void, ms: number) => {
  const t = setTimeout(f, ms);
  return () => clearTimeout(t);
};

export function boot(d: BootDeps): void {
  const timer = d.timer ?? realTimer;
  const timeoutMs = d.timeoutMs ?? 15_000;
  const quietMs = d.quietMs ?? 300;
  let mounted = false;
  let attempt = 0;

  const run = (first: boolean) => {
    const mine = ++attempt;
    // 앞선 시도의 시간 초과·실패가 늦게 와도 지금 화면을 바꾸지 않게, 지금 시도인지 묻는다
    const current = () => !mounted && mine === attempt;
    const cancels: (() => void)[] = [];
    const stop = () => {
      for (const c of cancels) c();
    };
    if (first) cancels.push(timer(() => current() && d.screen('loading', retry), quietMs));
    else d.screen('loading', retry); // 누른 다시 시도에는 바로 반응이 보여야 한다
    cancels.push(timer(() => current() && d.screen('failed', retry), timeoutMs));
    d.ready().then(
      () => {
        // 어느 시도든 끝나면 그린다 — 실패 화면 뒤에 늦게 끝난 되살리기도(그때까지 App 은 그린 적 없다)
        if (mounted) return;
        mounted = true;
        stop();
        d.app();
      },
      () => {
        if (!current()) return;
        stop();
        d.screen('failed', retry);
      },
    );
  };
  const retry = () => {
    if (!mounted) run(false);
  };
  run(true);
}
