// 검산 기준선 비교(scripts/verify-diff.ts)의 비교 규칙
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffItems, diffScenes } from '../scripts/verify-diff.ts';

test('diffItems: 사라짐·새로 생김·바뀜을 ref 로 가른다', () => {
  const base = [
    { ref: 'u/a', unit: 'u', answer: '1' },
    { ref: 'u/b', unit: 'u', answer: '2' },
    { ref: 'u/c', unit: 'u', answer: '3' },
  ];
  const now = [
    { ref: 'u/a', unit: 'u', answer: '1' },
    { ref: 'u/b', unit: 'u', answer: '20' },
    { ref: 'u/d', unit: 'u', answer: '4' },
  ];
  assert.deepEqual(diffItems(base, now), { gone: ['u/c'], added: ['u/d'], changed: ['u/b'] });
  assert.deepEqual(diffItems(base, base), { gone: [], added: [], changed: [] });
});

test('diffScenes: 장면 id 가 사라지면 잡는다(새 장면은 괜찮다)', () => {
  assert.deepEqual(diffScenes(['u/a', 'u/b'], ['u/a', 'u/c']), {
    removed: ['u/b'],
    added: ['u/c'],
  });
});
