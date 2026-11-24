// dev.mjs 와 build.mjs 가 함께 쓰는 esbuild 설정. 두 곳의 결과가 어긋나지 않게 한 곳에 둔다.
import { execFileSync } from 'node:child_process';
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
export const contentPlugin = {
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

/**
 * git 출력 → 빌드 표시. 커밋 안 된 변경이 섞였으면 해시만으로는 무엇이 들어갔는지 알 수 없어 + 를 붙인다.
 * git 을 못 쓰면 'unknown' — 빌드 표시 때문에 빌드가 멈추지는 않게 한다.
 */
export function formatBuildId(hash, porcelain) {
  const h = hash.trim();
  if (!h) return 'unknown';
  return porcelain.trim() ? `${h}+` : h;
}

/**
 * 빌드 결과(웹 dist·iOS 앱)에 들어가는 경로. 이 안의 변경만 + 로 친다.
 * 추적 안 하는 새 파일도 센다 — 새 단원 JSON 처럼 커밋 전에도 contentPlugin 이 폴더를 읽어 바로 묶기 때문이다.
 * 반대로 outputs/ 같은 로컬 산출물은 앱에 안 들어가니 여기 넣지 않는다.
 */
export const BUILD_INPUTS = [
  'src',
  'content',
  'public',
  'index.html',
  'ios',
  'scripts',
  'package.json',
  'package-lock.json',
];

/** 지금 커밋으로 만든 빌드 표시 */
export function buildId() {
  const git = (args) => {
    try {
      return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' });
    } catch {
      return '';
    }
  };
  return formatBuildId(
    git(['rev-parse', '--short', 'HEAD']),
    git(['status', '--porcelain', '--', ...BUILD_INPUTS]),
  );
}

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
      // 배포 빌드에 커밋 해시를 찍어 설정 화면에 보여 준다(앱에 옛 dist 가 실리는 일을 눈으로 잡게)
      __BUILD__: JSON.stringify(dev ? 'dev' : buildId()),
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
