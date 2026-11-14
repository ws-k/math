import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/app/settings.ts';

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
