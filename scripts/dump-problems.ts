// npm run verify 1단계: 형식 검사 → 검산할 항목을 .cache/problems.json 으로.
// 사용법: node scripts/dump-problems.ts [--unit <단원 id>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkContent } from './content-check.ts';

const ui = process.argv.indexOf('--unit');
const only = ui > 0 ? process.argv[ui + 1] : undefined;
const out = only ? `.cache/problems-${only}.json` : '.cache/problems.json';
const { errors, warnings, items, units } = checkContent('.', 200, only);
if (errors.length) {
  console.error(`형식 검사 실패 ${errors.length}건:`);
  for (const e of errors.slice(0, 80)) console.error(`  - ${e}`);
  process.exit(1);
}
if (warnings.length) {
  // 글 속 숫자는 검산 밖이다. 답·해처럼 꼭 맞아야 하는 숫자는 {{값}} 으로 바꾸고, 나머지는 눈으로 확인한다
  console.log(
    `경고 ${warnings.length}건(레슨 수식 속 손으로 적은 숫자 — {{…}} 로 바꿀 수 있으면 바꾸기):`,
  );
  for (const w of warnings) console.log(`  - ${w}`);
}
mkdirSync('.cache', { recursive: true });
writeFileSync(out, JSON.stringify(items));
console.log(`형식 검사 통과: 단원 ${units.length}개, 검산 항목 ${items.length}개 → ${out}`);
