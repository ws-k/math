// npm run verify 1단계: 형식 검사 → 검산할 항목을 .cache/problems.json 으로.
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkContent } from './content-check.ts';

const out = process.argv[2] ?? '.cache/problems.json';
const { errors, items, units } = checkContent('.');
if (errors.length) {
  console.error(`형식 검사 실패 ${errors.length}건:`);
  for (const e of errors.slice(0, 80)) console.error(`  - ${e}`);
  process.exit(1);
}
mkdirSync('.cache', { recursive: true });
writeFileSync(out, JSON.stringify(items));
console.log(`형식 검사 통과: 단원 ${units.length}개, 검산 항목 ${items.length}개`);
