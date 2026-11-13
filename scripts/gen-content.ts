// 단원 JSON 의 기초 문제 중 생성기로 만든 것(b01~)을 다시 찍어 넣는다.
// 손으로 쓴 기초 문제가 있으면 그만큼 덜 찍는다. 시드는 고정이라 여러 번 돌려도 결과가 같다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Problem, Unit } from '../src/content/types.ts';
import { generate } from '../src/generators/index.ts';

const BASIC = 15;
const only = process.argv[2];
for (const f of readdirSync('content/units').filter((f) => f.endsWith('.json'))) {
  const path = `content/units/${f}`;
  const u: Unit = JSON.parse(readFileSync(path, 'utf8'));
  if (only && u.id !== only) continue;
  if (!u.generators?.length) continue;
  const kept = u.problems.filter((p) => !p.generator);
  const need = BASIC - kept.filter((p) => p.level === '기초').length;
  const made: Problem[] = [];
  for (let i = 0; i < need; i++) {
    const g = u.generators[i % u.generators.length] as string;
    const seed = 1000 + i;
    made.push(generate(g, seed, `b${String(i + 1).padStart(2, '0')}`));
  }
  u.problems = [...made, ...kept];
  writeFileSync(path, `${JSON.stringify(u, null, 2)}\n`);
  console.log(`${u.id}: 생성 ${made.length}개 + 직접 작성 ${kept.length}개`);
}
