import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addSample, emptyStats } from '../src/app/pendiag.ts';

test('필압 최소·최대, 기울기, 프레임당 점 수를 모은다', () => {
  let s = emptyStats();
  assert.equal(s.events, 0);
  s = addSample(s, { pointerType: 'pen', pressure: 0.3, tiltX: 10, tiltY: -5, coalesced: 2 });
  s = addSample(s, { pointerType: 'pen', pressure: 0.8, tiltX: 20, tiltY: -3, coalesced: 4 });
  assert.equal(s.pointerType, 'pen');
  assert.equal(s.pressureMin, 0.3);
  assert.equal(s.pressureMax, 0.8);
  assert.equal(s.tiltX, 20);
  assert.equal(s.tiltY, -3);
  assert.equal(s.events, 2);
  assert.equal(s.coalescedLast, 4);
  assert.equal(s.coalescedMax, 4);
  assert.equal(s.coalescedAvg, 3);
});
