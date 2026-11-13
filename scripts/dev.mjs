// 개발 서버: node scripts/dev.mjs [--host]
// --host 면 같은 와이파이의 휴대폰에서 열 수 있게 0.0.0.0 에 띄우고 LAN 주소를 알려 준다.
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { copyStatic, options, root } from './esbuild-shared.mjs';

const PORT = 5173;
const lan = process.argv.includes('--host');
// 프로젝트 폴더 전체를 서빙하면 reference/ 같은 개인 자료까지 LAN 에 열리므로 별도 폴더만 연다.
const outdir = join(root, '.cache/dev');

copyStatic(outdir);
const ctx = await esbuild.context(options({ outdir, dev: true }));
await ctx.watch();
const { port } = await ctx.serve({
  servedir: outdir,
  port: PORT,
  host: lan ? '0.0.0.0' : '127.0.0.1',
});

console.log(`\n  로컬:  http://localhost:${port}`);
if (lan) {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  LAN:   http://${a.address}:${port}`);
    }
  }
}
console.log('');
