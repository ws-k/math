import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutMode } from '../src/app/layout.ts';

test('펼침·가로(951×585)는 펼친 책', () => {
  assert.equal(layoutMode(951, 585), 'spread');
});

test('펼침·세로(669×867)와 접음(382×580)은 한 쪽씩', () => {
  assert.equal(layoutMode(669, 867), 'single');
  assert.equal(layoutMode(382, 580), 'single');
});

test('경계: 너비 800 이상 그리고 높이의 1.2배 이상이어야 펼친 책', () => {
  assert.equal(layoutMode(800, 600), 'spread'); // 800 = 1.2 × 666.6… 이상
  assert.equal(layoutMode(799, 500), 'single'); // 너비 부족
  assert.equal(layoutMode(960, 801), 'single'); // 960 < 1.2 × 801
  assert.equal(layoutMode(960, 800), 'spread'); // 정확히 1.2배
});
