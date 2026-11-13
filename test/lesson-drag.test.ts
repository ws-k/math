import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clamp, crossedSign, edgeSafe, keyStep, nearest, snap } from '../src/lesson/drag.ts';

test('snap: 가장 가까운 칸으로(간격 기준점 min)', () => {
  assert.equal(snap(0.26, 0.5), 0.5);
  assert.equal(snap(-0.74, 0.5), -0.5);
  assert.equal(snap(7, 3, 1), 7);
  assert.equal(snap(5.4, 3, 1), 4);
});

test('clamp: 범위 안으로', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('keyStep: 방향키 한 칸, 범위 밖으로 안 나감', () => {
  assert.equal(keyStep(2, 'ArrowRight', 1, 0, 3), 3);
  assert.equal(keyStep(3, 'ArrowUp', 1, 0, 3), 3);
  assert.equal(keyStep(2, 'ArrowLeft', 0.5, 0, 3), 1.5);
  assert.equal(keyStep(2, 'Home', 1, 0, 3), 0);
  assert.equal(keyStep(2, 'End', 1, 0, 3), 3);
  assert.equal(keyStep(2, 'a', 1, 0, 3), null);
});

test('crossedSign: 칩 가운데가 등호를 완전히 넘었을 때만', () => {
  const eq = { left: 100, right: 120 };
  assert.equal(crossedSign(130, eq, 'right'), true);
  assert.equal(crossedSign(115, eq, 'right'), false);
  assert.equal(crossedSign(90, eq, 'left'), true);
  assert.equal(crossedSign(105, eq, 'left'), false);
});

test('nearest: 겹친 손잡이는 가장 가까운 것, 반경 밖이면 없음', () => {
  const hs = [
    { id: 'P', x: 0, y: 0 },
    { id: 'Q', x: 10, y: 0 },
  ];
  assert.equal(nearest(hs, { x: 7, y: 1 }, 28)?.id, 'Q');
  assert.equal(nearest(hs, { x: 4, y: 0 }, 28)?.id, 'P');
  assert.equal(nearest(hs, { x: 100, y: 0 }, 28), null);
});

test('edgeSafe: 손잡이를 화면 가장자리에서 20px 이상 떨어뜨린다', () => {
  assert.equal(edgeSafe(5, 400), 20);
  assert.equal(edgeSafe(395, 400), 380);
  assert.equal(edgeSafe(200, 400), 200);
});
