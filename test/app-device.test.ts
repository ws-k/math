import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_DEVICE, DEVICE_KEY, normalizeDevice, penDetected } from '../src/app/device.ts';
import { scopedKey } from '../src/app/profile.ts';

test('손가락 쓰기는 기본 켜짐, 펜은 아직 못 봄', () => {
  assert.deepEqual(normalizeDevice(undefined), { fingerInk: true, penSeen: false });
  assert.deepEqual(DEFAULT_DEVICE, { fingerInk: true, penSeen: false });
  assert.deepEqual(normalizeDevice({ fingerInk: false, penSeen: true }), {
    fingerInk: false,
    penSeen: true,
  });
  assert.deepEqual(normalizeDevice({ fingerInk: 'no', penSeen: 1 }), DEFAULT_DEVICE);
});

test('펜을 처음 보면 손가락 쓰기를 한 번만 끈다', () => {
  assert.deepEqual(penDetected(DEFAULT_DEVICE), { fingerInk: false, penSeen: true });
  // 그 뒤 사용자가 다시 켜면 펜을 또 써도 그대로 둔다
  assert.equal(penDetected({ fingerInk: true, penSeen: true }), null);
});

test('기기 설정은 누가 쓰든 같은 키(이 기기 기준)', () => {
  assert.equal(scopedKey('kid', DEVICE_KEY), DEVICE_KEY);
  assert.equal(scopedKey('first', DEVICE_KEY), DEVICE_KEY);
});
