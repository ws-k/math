// src/generators/<단원 id>.ts 파일들을 모아 registry.ts 를 다시 쓴다.
// 여러 사람이 동시에 단원을 추가해도 손으로 고치는 공용 목록이 없게 하려는 것(합칠 때 이 스크립트만 다시 돌리면 된다).
// 사용법: node scripts/gen-registry.ts   (test/registry.test.ts 가 최신인지 확인한다)
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'src', 'generators');
const LIB = new Set(['index.ts', 'registry.ts', 'rng.ts', 'types.ts', 'util.ts']);

export function registrySource(files: string[]): string {
  const units = files.filter((f) => f.endsWith('.ts') && !LIB.has(f)).sort();
  const name = (f: string) => `g_${f.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`;
  return [
    '// 자동 생성 파일 — 손으로 고치지 마세요. node scripts/gen-registry.ts 로 다시 만듭니다.',
    "import type { Generator } from './types.ts';",
    ...units.map((f) => `import { generators as ${name(f)} } from './${f}';`),
    '',
    `export const unitGenerators: Generator[] = [${units.map((f) => `...${name(f)}`).join(', ')}];`,
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  writeFileSync(join(dir, 'registry.ts'), registrySource(readdirSync(dir)));
  console.log('src/generators/registry.ts 를 다시 만들었어요.');
}
