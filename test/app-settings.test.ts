import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, normalizeSettings, penDetected } from '../src/app/settings.ts';

test('저장된 값이 없으면 기본값(하루 목표 10개, 검정 펜)', () => {
  const s = normalizeSettings(undefined);
  assert.deepEqual(s, DEFAULT_SETTINGS);
  assert.equal(s.dailyGoal, 10);
  assert.deepEqual(s.tool, { kind: 'pen', color: '#1b1b1b', size: 1 });
  assert.equal(s.background, 'none');
});

test('일부만 있거나 이상한 값은 기본값으로 채운다', () => {
  const s = normalizeSettings({ dailyGoal: 25, background: 'weird', tool: { size: 9 } });
  assert.equal(s.dailyGoal, 25);
  assert.equal(s.background, 'none');
  assert.equal(s.tool.size, 1);
  assert.equal(normalizeSettings({ dailyGoal: -3 }).dailyGoal, 10);
  assert.equal(normalizeSettings({ background: 'grid' }).background, 'grid');
});

test('손가락 쓰기는 기본 켜짐, 펜은 아직 못 봄', () => {
  const s = normalizeSettings(undefined);
  assert.equal(s.fingerInk, true);
  assert.equal(s.penSeen, false);
  const t = normalizeSettings({ fingerInk: false, penSeen: true });
  assert.equal(t.fingerInk, false);
  assert.equal(t.penSeen, true);
  assert.equal(normalizeSettings({ fingerInk: 'no', penSeen: 1 }).fingerInk, true);
  assert.equal(normalizeSettings({ fingerInk: 'no', penSeen: 1 }).penSeen, false);
});

test('펜을 처음 보면 손가락 쓰기를 한 번만 끈다', () => {
  const first = penDetected(DEFAULT_SETTINGS);
  assert.ok(first);
  assert.equal(first.fingerInk, false);
  assert.equal(first.penSeen, true);
  // 그 뒤 사용자가 다시 켜면 펜을 또 써도 그대로 둔다
  assert.equal(penDetected({ ...first, fingerInk: true }), null);
});
