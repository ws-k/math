import 'katex/dist/katex.min.css';
import './app/app.css';
import './lesson/lesson.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

// 개발 중에만: 파일을 고치면 esbuild 가 알려 주는 대로 새로 고침.
if (__DEV__) {
  const es = new EventSource('/esbuild');
  es.addEventListener('change', () => location.reload());
  // 새로 고칠 때마다 연결이 닫히지 않고 쌓이면 브라우저의 동시 연결 수가 차서 글꼴 요청이 멈춘다
  window.addEventListener('pagehide', () => es.close());
}
