import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  flipSign,
  moved,
  sideSym,
  type TermDragParams,
  termDragDef,
} from '../src/lesson/widgets/termDrag.ts';

const P: TermDragParams = { lhs: ['3*x', '+1000'], rhs: ['13000'], move: 1, note: '이항' };

test('flipSign: 부호를 뒤집고, 부호 없는 항은 + 로 본다', () => {
  assert.equal(flipSign('+1000'), '-1000');
  assert.equal(flipSign('-3*x'), '+3*x');
  assert.equal(flipSign('3*x'), '-3*x');
});

test('moved: 고른 항이 등호 건너편 끝으로 가며 부호가 바뀐다', () => {
  assert.deepEqual(moved(P), { lhs: ['3*x'], rhs: ['13000', '-1000'] });
});

test('sideSym: 한쪽 변을 이어 붙인 식(맨 앞 + 는 뗀다)', () => {
  assert.equal(sideSym(['+3*x', '-1']), '3*x-1');
});

test('checks: 옮긴 식은 동치, 부호를 안 바꾸면 동치가 아님', () => {
  assert.deepEqual(termDragDef.checks(P), [
    {
      name: '옮기기',
      kind: 'equiv',
      before: '3*x+1000=13000',
      after: '3*x=13000-1000',
      expect: true,
    },
    {
      name: '부호 그대로',
      kind: 'equiv',
      before: '3*x+1000=13000',
      after: '3*x=13000+1000',
      expect: false,
    },
  ]);
});

test('parse: 형식 오류', () => {
  assert.doesNotThrow(() => termDragDef.parse(P));
  assert.throws(() => termDragDef.parse({ ...P, move: 2 }));
  assert.throws(() => termDragDef.parse({ ...P, lhs: ['3*x', '1000'] }));
  assert.throws(() => termDragDef.parse({ ...P, rhs: [] }));
  assert.throws(() => termDragDef.parse({ ...P, extra: 1 }));
  assert.throws(() => termDragDef.parse({ ...P, lhs: ['3x', '+1'] }));
});

test('layout: 옮기기 전·후 보일 항(부호 포함)을 화면과 검산이 같이 쓴다', async () => {
  const { layout } = await import('../src/lesson/widgets/termDrag.ts');
  assert.deepEqual(layout(P, false), {
    lhs: [
      { key: 'l0', sym: '3*x', mover: false },
      { key: 'mover', sym: '+1000', mover: true },
    ],
    rhs: [{ key: 'r0', sym: '13000', mover: false }],
  });
  assert.deepEqual(layout(P, true), {
    lhs: [{ key: 'l0', sym: '3*x', mover: false }],
    rhs: [
      { key: 'r0', sym: '13000', mover: false },
      { key: 'mover', sym: '-1000', mover: true },
    ],
  });
  // 맨 앞 항을 옮기면: 옮기기 전엔 + 없이, 남은 첫 항은 제 부호대로
  const Q: TermDragParams = { lhs: ['2*x', '+5'], rhs: ['7'], move: 0, note: 'n' };
  assert.deepEqual(
    layout(Q, false).lhs.map((t) => t.sym),
    ['2*x', '+5'],
  );
  assert.deepEqual(
    layout(Q, true).lhs.map((t) => t.sym),
    ['5'],
  );
  assert.deepEqual(
    layout(Q, true).rhs.map((t) => t.sym),
    ['7', '-2*x'],
  );
  assert.throws(() => layout({ ...Q, move: 5 }, false));
});

test('equation: 부품이 그리는 처음 식', () => {
  assert.equal(termDragDef.equation?.(P), '3*x+1000=13000');
});

test('vars: 설명 글의 {{from}}·{{to}} 는 옮기기 전·후 항(검산한 식에서 만든다)', async () => {
  const { termDragDef } = await import('../src/lesson/widgets/termDrag.ts');
  const p = { lhs: ['3*x', '+1000'], rhs: ['13000'], move: 1, note: 'n' };
  assert.deepEqual(termDragDef.vars?.(p), { from: '+1,000', to: '−1,000' });
});
