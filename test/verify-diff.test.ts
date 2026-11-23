// 검산 기준선 비교(scripts/verify-diff.ts)의 비교 규칙
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffItems, diffProblems, diffScenes } from '../scripts/verify-diff.ts';

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

test('diffProblems: 기존 문제가 사라지거나 내용이 바뀌면 잡고, 새 id 는 통과시킨다', () => {
  const p1 = { id: 'p01', q: '$1+1$', answer: '2' };
  const p2 = { id: 'p02', q: '$2+2$', answer: '4' };
  const v1 = { id: 'p01', q: '$3+3$', answer: '6' };
  const v = { id: 'v', problems: [v1] };
  const base = [{ id: 'u', problems: [p1, p2] }, v];
  // 문제 하나 지움 → 사라짐으로 잡힘
  assert.deepEqual(diffProblems(base, [{ id: 'u', problems: [p1] }, v]), {
    removed: ['u/p02'],
    changed: [],
    added: [],
  });
  // 글자 하나 바꿈(같은 id) → 바뀜으로 잡힘. 다른 단원의 같은 id 는 따로 본다
  const v1Edited = { ...v1, q: '$3+3$.' }; // 검산 항목엔 안 잡히는 문제 글
  assert.deepEqual(
    diffProblems(base, [
      { id: 'u', problems: [p1, p2] },
      { id: 'v', problems: [v1Edited] },
    ]),
    {
      removed: [],
      changed: ['v/p01'],
      added: [],
    },
  );
  // 새 id 추가 → 사라짐·바뀜 없이 새로 생긴 것으로만
  const p3 = { id: 'p03', q: '$5+5$', answer: '10' };
  assert.deepEqual(diffProblems(base, [{ id: 'u', problems: [p1, p2, p3] }, v]), {
    removed: [],
    changed: [],
    added: ['u/p03'],
  });
  // problems 가 없는 단원도 받는다
  assert.deepEqual(diffProblems([{ id: 'w' }], [{ id: 'w' }]), {
    removed: [],
    changed: [],
    added: [],
  });
});
