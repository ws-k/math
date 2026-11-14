import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFingerGesture, FINGER_GRACE_MS } from '../src/ink/finger.ts';

test('한 손가락은 바로 쓰기, 떼면 획 끝', () => {
  const g = createFingerGesture();
  assert.equal(g.down(1, 0, 0, 0), 'draw');
  assert.equal(g.move(1, 10, 0), null);
  assert.deepEqual(g.up(1, 100), { kind: 'end' });
});

test('두 번째 손가락이 짧은 시간 안에 닿으면 획 취소 → 여러 손가락 동작', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  assert.equal(g.down(2, 50, 0, FINGER_GRACE_MS - 10), 'cancel');
  assert.equal(g.down(3, 100, 0, FINGER_GRACE_MS), 'multi');
});

test('늦게 닿은 두 번째 손가락은 무시하고 획은 계속', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  assert.equal(g.down(2, 50, 0, FINGER_GRACE_MS + 50), 'ignore');
  assert.equal(g.move(2, 80, 40), null);
  assert.deepEqual(g.up(2, 300), { kind: 'none' });
  assert.deepEqual(g.up(1, 400), { kind: 'end' });
});

test('여러 손가락 끌기: 손가락 중심이 움직인 만큼 돌려주고, 다 떼면 전체 이동을 알려 준다', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  g.down(2, 100, 0, 20);
  // 중심(50,0) → 손가락 1만 아래로 40 → 중심 20 아래로
  assert.deepEqual(g.move(1, 0, 40), { dx: 0, dy: 20 });
  assert.deepEqual(g.move(2, 100, 40), { dx: 0, dy: 20 });
  assert.deepEqual(g.up(1, 200), { kind: 'none' });
  // 손가락 수가 바뀌어도 중심이 튀지 않는다: 남은 손가락 2 기준으로 다시 잰다
  assert.deepEqual(g.move(2, 100, 50), { dx: 0, dy: 10 });
  assert.deepEqual(g.up(2, 300), { kind: 'gesture', dx: 0, dy: 50, dt: 300, fingers: 2 });
});

test('여러 손가락 동작이 끝나면 다음 한 손가락은 다시 쓰기', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  g.down(2, 10, 0, 10);
  g.up(1, 50);
  g.up(2, 60);
  assert.equal(g.down(3, 0, 0, 1000), 'draw');
});

test('쓰던 손가락을 떼고 무시한 손가락만 남아도 다음 손가락은 쓰기', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  g.down(2, 50, 0, 400);
  g.up(1, 500);
  assert.equal(g.down(3, 0, 0, 600), 'draw');
});

test('쓰는 중 무시하던 손가락만 취소되면 그 손가락만 빠지고 획은 계속', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  g.down(2, 50, 0, FINGER_GRACE_MS + 50);
  assert.deepEqual(g.cancel(2), { kind: 'none' });
  // 쓰던 손가락은 아직 쓰는 중 — 새 손가락은 무시(새 획 시작 아님)
  assert.equal(g.down(3, 80, 0, FINGER_GRACE_MS + 100), 'ignore');
  assert.deepEqual(g.up(1, 500), { kind: 'end' });
});

test('쓰던 손가락 자신이 취소되면 획 마무리', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  assert.deepEqual(g.cancel(1), { kind: 'end' });
  assert.equal(g.down(2, 0, 0, 100), 'draw');
});

test('여러 손가락 동작 중 취소는 알림 없이 전체 초기화', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  g.down(2, 100, 0, 20);
  g.move(1, -200, 0);
  assert.deepEqual(g.cancel(1), { kind: 'none' });
  assert.deepEqual(g.up(2, 300), { kind: 'none' });
  assert.equal(g.down(3, 0, 0, 400), 'draw');
});

test('reset 하면 처음부터', () => {
  const g = createFingerGesture();
  g.down(1, 0, 0, 0);
  g.down(2, 10, 0, 10);
  g.reset();
  assert.deepEqual(g.up(2, 20), { kind: 'none' });
  assert.equal(g.down(5, 0, 0, 100), 'draw');
});
