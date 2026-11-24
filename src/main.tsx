import 'katex/dist/katex.min.css';
import './app/app.css';
import './lesson/lesson.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { isNativeApp } from './app/shell.ts';
import { startBackup } from './app/store.ts';

const root = document.getElementById('root');
const render = () => {
  if (root) createRoot(root).render(<App />);
};

if (isNativeApp()) {
  // 앱에서만: 기록 사본과 먼저 맞춘다(IndexedDB 가 지워졌으면 되살림). 그린 뒤에 되살리면 첫 화면이 빈 기록을 읽는다.
  // 네이티브 답이 끝내 안 오면 흰 화면에 갇히므로 오래 걸려도 15초 뒤에는 그린다 — 되살리기는 그 뒤 쓰기를 덮지 않는다.
  void Promise.race([startBackup(), new Promise((r) => setTimeout(r, 15_000))]).then(render);
} else render();

// 개발 중에만: 파일을 고치면 esbuild 가 알려 주는 대로 새로 고침.
if (__DEV__) {
  const es = new EventSource('/esbuild');
  es.addEventListener('change', () => location.reload());
  // 새로 고칠 때마다 연결이 닫히지 않고 쌓이면 브라우저의 동시 연결 수가 차서 글꼴 요청이 멈춘다
  window.addEventListener('pagehide', () => es.close());
}
