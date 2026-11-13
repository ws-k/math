import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { registrySource } from '../scripts/gen-registry.ts';

test('생성기 목록(registry.ts)이 src/generators 폴더와 같다 — 다르면 node scripts/gen-registry.ts', () => {
  const now = readFileSync('src/generators/registry.ts', 'utf8');
  assert.equal(now, registrySource(readdirSync('src/generators')));
});
