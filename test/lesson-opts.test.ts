import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optColumns } from '../src/lesson/optCols.ts';

test('보기 단추 열 수: 한 줄에 들면 보기 수 그대로', () => {
  // 접은 화면 카드 안쪽 폭 298, 간격 6 — 단추 하나 70 까지 넷이 한 줄
  assert.equal(optColumns(4, 70, 298, 6), 4);
  assert.equal(optColumns(3, 90, 298, 6), 3);
});

test('보기 단추 열 수: 한 줄을 넘치면 반씩 두 줄(넷 → 2열), 그래도 넘치면 한 열', () => {
  // prob-normal binom: '0.0228' 넷이 339px > 298px 로 카드 밖까지 나갔다
  assert.equal(optColumns(4, 75, 298, 6), 2);
  assert.equal(optColumns(3, 120, 298, 6), 2);
  assert.equal(optColumns(5, 80, 298, 6), 3);
  assert.equal(optColumns(4, 200, 298, 6), 1);
});

test('보기 단추 열 수: 반으로도 안 들면 2열을 거쳐 한 열(여섯 → 3열 → 2열 → 1열)', () => {
  // 3열은 넘치지만(3×95+12=297 > 290) 2열은 드는(2×95+6=196) 폭
  assert.equal(optColumns(6, 95, 290, 6), 2);
  assert.equal(optColumns(5, 140, 290, 6), 2);
  assert.equal(optColumns(6, 300, 290, 6), 1);
});

test('보기 단추 열 수: 폭을 아직 모르면(0, 서버 렌더) 보기 수 그대로', () => {
  assert.equal(optColumns(4, 75, 0, 6), 4);
  assert.equal(optColumns(2, 0, 298, 6), 2);
});
