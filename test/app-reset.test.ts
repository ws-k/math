import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isResetKey, resetRanges, scopedResetMatch } from '../src/app/reset.ts';

const keys = [
  'card:m1-int/1',
  'card:m1-int2/1',
  'lesson:m1-int',
  'lesson:m1-int2',
  'ink:m1-int:3:note',
  'ink:m1-int:lesson:s1:q1',
  'ink:m1-int2:3:note',
  'last',
  'settings',
];

test('단원 초기화: 그 단원의 문제 기록·레슨 진행·필기만, 이름이 비슷한 단원은 남긴다', () => {
  assert.deepEqual(
    keys.filter((k) => isResetKey(k, 'm1-int')),
    ['card:m1-int/1', 'lesson:m1-int', 'ink:m1-int:3:note', 'ink:m1-int:lesson:s1:q1'],
  );
});

test('전체 초기화: 학습 기록과 이어 하기는 지우고 설정은 남긴다', () => {
  assert.deepEqual(
    keys.filter((k) => isResetKey(k, null)),
    keys.filter((k) => k !== 'settings'),
  );
});

test('프로필: 첫 프로필은 다른 사람(@…) 키를 건드리지 않고, 다른 프로필은 자기 접두어만', () => {
  const first = scopedResetMatch('first', null);
  assert.equal(first('card:a/1'), true);
  assert.equal(first('@p-1/card:a/1'), false);
  assert.equal(first('profiles'), false);
  const other = scopedResetMatch('p-1', 'a');
  assert.equal(other('@p-1/card:a/1'), true);
  assert.equal(other('card:a/1'), false);
  assert.equal(other('@p-2/card:a/1'), false);
});

test('범위 규칙과 키 규칙이 같은 키를 고른다', () => {
  for (const unitId of ['m1-int', null]) {
    const { prefixes, keys: one } = resetRanges(unitId);
    const byRange = keys.filter((k) => prefixes.some((p) => k.startsWith(p)) || one.includes(k));
    assert.deepEqual(
      byRange,
      keys.filter((k) => isResetKey(k, unitId)),
    );
  }
});
