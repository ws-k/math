// dev.mjs 와 build.mjs 가 함께 쓰는 esbuild 설정. 두 곳의 결과가 어긋나지 않게 한 곳에 둔다.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const unitsDir = join(contentDir, 'units');

/**
 * `import content from 'virtual:content'` → 커리큘럼 + 모든 단원 JSON.
 * 단원 파일이 늘어도 import 목록을 손으로 고치지 않게 폴더를 읽어 만든다.
 * 앱을 처음 열 때 전체 단원이 함께 내려와 오프라인에서도 바로 보인다(설계 8장).
 */
const contentPlugin = {
  name: 'content',
  setup(build) {
    build.onResolve({ filter: /^virtual:content$/ }, () => ({
      path: 'content',
      namespace: 'virtual',
    }));
    build.onLoad({ filter: /.*/, namespace: 'virtual' }, () => {
      const files = readdirSync(unitsDir)
        .filter((f) => f.endsWith('.json'))
        .sort();
      const lines = [
        `import curriculum from ${JSON.stringify(join(contentDir, 'curriculum.json'))};`,
      ];
      files.forEach((f, i) => {
        lines.push(`import u${i} from ${JSON.stringify(join(unitsDir, f))};`);
      });
      lines.push(
        `export default { curriculum, units: [${files.map((_, i) => `u${i}`).join(', ')}] };`,
      );
      return { contents: lines.join('\n'), loader: 'js', resolveDir: root, watchDirs: [unitsDir] };
    });
  },
};

export function options({ outdir, dev }) {
  return {
    absWorkingDir: root,
    entryPoints: { main: join(root, 'src/main.tsx') },
    bundle: true,
    outdir,
    format: 'esm',
    target: ['safari16'],
    jsx: 'automatic',
    // KaTeX 글꼴을 앱에 넣어 외부 CDN 없이 수식이 보이게 한다. CSS 안의 url() 은 상대 경로로 남아
    // GitHub Pages 하위 경로에서도 그대로 동작한다.
    loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
    assetNames: 'fonts/[name]-[hash]',
    minify: !dev,
    sourcemap: dev,
    define: {
      __DEV__: String(dev),
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
    },
    plugins: [contentPlugin],
    logLevel: 'info',
  };
}

/** index.html 과 public/ 의 파일을 결과 폴더로 복사 */
export function copyStatic(outdir) {
  mkdirSync(outdir, { recursive: true });
  cpSync(join(root, 'index.html'), join(outdir, 'index.html'));
  cpSync(join(root, 'public'), outdir, { recursive: true });
}
