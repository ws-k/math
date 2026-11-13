import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellText, type TableParams, tableDef } from '../src/lesson/widgets/table.ts';

const P: TableParams = {
  unit: '원',
  rows: [
    { label: '아메리카노 × 3', value: '3*x' },
    { label: '버터 쿠키 × 1', value: '1000' },
  ],
  total: { label: '합계', value: '13000' },
  sum: true,
};

test('칸 글자: 계산식은 값으로, 미지수가 든 칸은 ?', () => {
  assert.equal(cellText({ label: 'a', value: '2*1500' }, '원'), '3,000원');
  assert.equal(cellText({ label: 'a', value: '3*x' }, '원'), '?');
  assert.equal(cellText({ label: 'a' }, '원'), '?');
});

test('합계 관계: 미지수가 있으면 방정식으로 내보낸다', () => {
  assert.equal(tableDef.equation?.(P), '3*x+1000=13000');
  assert.deepEqual(tableDef.checks(P), []);
});

test('합계 관계: 모두 숫자면 합이 맞는지 검산 항목', () => {
  const Q: TableParams = {
    unit: '원',
    rows: [
      { label: 'a', value: '4000*3' },
      { label: 'b', value: '1000' },
    ],
    total: { label: '합계', value: '13000' },
    sum: true,
  };
  assert.equal(tableDef.equation?.(Q), undefined);
  assert.deepEqual(tableDef.checks(Q), [
    { name: '합계', answer: '13000', answerType: 'fraction', check: '(4000*3)+(1000)' },
  ]);
});

test('parse: 칸은 계산식만, 합계 관계는 total 이 있어야', () => {
  assert.doesNotThrow(() => tableDef.parse(P));
  assert.throws(() => tableDef.parse({ ...P, rows: [{ label: 'a', value: '3x' }] }));
  assert.throws(() => tableDef.parse({ ...P, total: undefined }));
  assert.throws(() => tableDef.parse({ ...P, total: { label: '합계', value: 'x' } }));
});
