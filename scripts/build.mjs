// 배포용 빌드: dist/ 에 압축된 번들 + index.html + manifest. 모든 경로가 ./ 상대라
// GitHub Pages 의 하위 경로(/저장소이름/)에서도 그대로 열린다.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { copyStatic, options, root } from './esbuild-shared.mjs';

const outdir = join(root, 'dist');
rmSync(outdir, { recursive: true, force: true });
await esbuild.build(options({ outdir, dev: false }));
copyStatic(outdir);
console.log(`빌드 완료: ${outdir}`);
