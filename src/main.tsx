import 'katex/dist/katex.min.css';
import './app/app.css';
import './lesson/lesson.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { BootScreen } from './app/BootScreen.tsx';
import { boot } from './app/boot.ts';
import { isNativeApp } from './app/shell.ts';
import { startBackup } from './app/store.ts';

const el = document.getElementById('root');
const root = el ? createRoot(el) : null;
const render = () => root?.render(<App />);

if (isNativeApp()) {
  // 앱에서만: 기록 사본과 먼저 맞춘다. 지워진 IndexedDB 를 되살리는 중이거나 실패했으면 App 을 그리지 않는다 —
  // 빈 기록으로 그리면 첫 화면이 빈 기록을 읽고, 그 뒤 쓰기가 사본까지 덮는다(boot.ts).
  boot({
    ready: () => startBackup()?.ready ?? Promise.resolve(),
    app: render,
    screen: (view, retry) => root?.render(<BootScreen view={view} retry={retry} />),
  });
} else render();

// 개발 중에만: 파일을 고치면 esbuild 가 알려 주는 대로 새로 고침.
if (__DEV__) {
  const es = new EventSource('/esbuild');
  es.addEventListener('change', () => location.reload());
  // 새로 고칠 때마다 연결이 닫히지 않고 쌓이면 브라우저의 동시 연결 수가 차서 글꼴 요청이 멈춘다
  window.addEventListener('pagehide', () => es.close());
}
