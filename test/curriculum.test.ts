import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Curriculum } from '../src/content/types.ts';

const cur: Curriculum = JSON.parse(readFileSync('content/curriculum.json', 'utf8'));

test('103단원, ID 중복 없음', () => {
  assert.equal(cur.units.length, 103);
  assert.equal(new Set(cur.units.map((u) => u.id)).size, 103);
});

test('선수 단원은 목록에서 먼저 나온다 (순환 없음)', () => {
  const seen = new Set<string>();
  for (const u of cur.units) {
    for (const p of u.prereq) assert.ok(seen.has(p), `${u.id} ← ${p}`);
    seen.add(u.id);
  }
});

test('수능 46문항 모두 주 단원이 있다', () => {
  const labels = new Set(cur.units.flatMap((u) => u.suneung));
  const want = [
    ...Array.from({ length: 22 }, (_, i) => `공통 ${i + 1}`),
    ...['확통', '미적', '기하'].flatMap((s) =>
      Array.from({ length: 8 }, (_, i) => `${s} ${i + 23}`),
    ),
  ];
  for (const w of want) assert.ok(labels.has(w), w);
});
