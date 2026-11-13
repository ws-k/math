import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHistory, eraseAt } from '../src/ink/history.ts';
import { createTapDetector } from '../src/ink/tap.ts';
import type { Stroke } from '../src/ink/types.ts';

function stroke(x: number, y = 0): Stroke {
  return { tool: 'pen', color: '#000', base: 3, pts: [x, y, 0, 0.5, x + 10, y, 16, 0.5] };
}

test('처음 상태: 되돌릴 것도 다시 할 것도 없다', () => {
  const h = createHistory([stroke(0)]);
  assert.equal(h.current.length, 1);
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), false);
  assert.equal(h.undo(), false);
  assert.equal(h.redo(), false);
});

test('획 추가 → 실행 취소 → 다시 실행', () => {
  const a = stroke(0);
  const h = createHistory([]);
  h.commit([a]);
  assert.deepEqual(h.current, [a]);
  assert.equal(h.undo(), true);
  assert.deepEqual(h.current, []);
  assert.equal(h.canRedo(), true);
  assert.equal(h.redo(), true);
  assert.deepEqual(h.current, [a]);
});

test('새로 쓰면 다시 실행 목록은 사라진다', () => {
  const h = createHistory([]);
  h.commit([stroke(0)]);
  h.undo();
  h.commit([stroke(50)]);
  assert.equal(h.canRedo(), false);
});

test('바뀐 게 없으면(같은 배열) 기록하지 않는다', () => {
  const h = createHistory([stroke(0)]);
  h.commit(h.current as Stroke[]);
  assert.equal(h.canUndo(), false);
});

test('전체 지우기도 한 번에 되돌린다', () => {
  const h = createHistory([stroke(0), stroke(100)]);
  h.commit([]);
  assert.equal(h.current.length, 0);
  h.undo();
  assert.equal(h.current.length, 2);
});

test('기록 개수 한도를 넘으면 오래된 것부터 버린다', () => {
  const h = createHistory([], 3);
  for (let i = 0; i < 5; i++) h.commit([...h.current, stroke(i * 20)]);
  let n = 0;
  while (h.undo()) n++;
  assert.equal(n, 3);
  assert.equal(h.current.length, 2);
});

test('지우개: 닿은 획 전체를 빼고, 안 닿으면 같은 배열을 돌려준다', () => {
  const a = stroke(0, 0);
  const b = stroke(0, 100);
  const list = [a, b];
  assert.equal(eraseAt(list, 500, 500, 5), list);
  assert.deepEqual(eraseAt(list, 5, 2, 5), [b]);
});

test('한 번 문지르기 = 실행 취소 한 단위', () => {
  const a = stroke(0, 0);
  const b = stroke(0, 100);
  const h = createHistory([a, b]);
  let working: readonly Stroke[] = h.current;
  working = eraseAt(working, 5, 0, 5);
  working = eraseAt(working, 5, 100, 5);
  h.commit(working);
  assert.equal(h.current.length, 0);
  h.undo();
  assert.deepEqual(h.current, [a, b]);
});

const P = (id: number, x = 0, y = 0) => ({ id, x, y });

test('두 손가락 탭 = 2, 세 손가락 탭 = 3', () => {
  const d = createTapDetector();
  d.down([P(1), P(2)], 0);
  assert.equal(d.up(0, 120), 2);
  d.down([P(1)], 1000);
  d.down([P(2), P(3)], 1020);
  assert.equal(d.up(2, 1100), 0);
  assert.equal(d.up(0, 1110), 3);
});

test('한 손가락은 탭으로 치지 않는다', () => {
  const d = createTapDetector();
  d.down([P(1)], 0);
  assert.equal(d.up(0, 50), 0);
});

test('오래 누르거나 움직이면 탭이 아니다', () => {
  const d = createTapDetector();
  d.down([P(1), P(2)], 0);
  assert.equal(d.up(0, 400), 0);
  d.down([P(1), P(2)], 1000);
  d.move([P(1, 40, 0)], 1050);
  assert.equal(d.up(0, 1100), 0);
});

test('조금 흔들리는 건 괜찮다', () => {
  const d = createTapDetector();
  d.down([P(1), P(2)], 0);
  d.move([P(1, 3, 2)], 30);
  assert.equal(d.up(0, 100), 2);
});

test('무효 처리하면 모두 뗄 때까지 탭이 아니고, 그다음은 다시 받는다', () => {
  const d = createTapDetector();
  d.down([P(1), P(2)], 0);
  d.invalidate();
  assert.equal(d.up(0, 100), 0);
  d.down([P(1), P(2)], 500);
  assert.equal(d.up(0, 600), 2);
});
