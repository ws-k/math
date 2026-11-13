import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySwipe } from '../src/app/swipe.ts';

test('왼쪽으로 쓸면 다음(1), 오른쪽으로 쓸면 이전(-1)', () => {
  assert.equal(classifySwipe({ dx: -120, dy: 10, dt: 200 }), 1);
  assert.equal(classifySwipe({ dx: 120, dy: -10, dt: 200 }), -1);
});

test('짧거나 세로로 기울었거나 느리면 넘기지 않는다', () => {
  assert.equal(classifySwipe({ dx: -30, dy: 0, dt: 100 }), 0);
  assert.equal(classifySwipe({ dx: -100, dy: 90, dt: 200 }), 0);
  assert.equal(classifySwipe({ dx: -200, dy: 0, dt: 1500 }), 0);
});
