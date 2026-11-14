import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOAL_HINT_AFTER, goalLine, goalRelease, goalStart, sameVal } from '../src/lesson/goal.ts';

test('여러 곳 가 보기: 닿은 곳을 모아 다 모이면 끝, 같은 곳을 두 번 세지 않음', () => {
  let g = goalStart();
  g = goalRelease(g, ['0'], 3);
  g = goalRelease(g, ['0'], 3);
  assert.deepEqual(g.seen, ['0']);
  assert.equal(g.done, false);
  g = goalRelease(g, ['2'], 3);
  g = goalRelease(g, ['1'], 3);
  assert.equal(g.done, true);
  assert.deepEqual(g.seen, ['0', '1', '2']);
});

test('손을 뗀 자리만 본다: 판정 없이 지나간 자리는 진행에 들지 않음', () => {
  // 끄는 도중(onMove)에는 goalRelease 를 부르지 않는다 — 놓은 자리가 목표 밖이면 미달성
  let g = goalStart();
  g = goalRelease(g, [], 1);
  assert.equal(g.done, false);
  assert.equal(g.tries, 1);
});

test('끝난 뒤에는 더 바뀌지 않음', () => {
  const g = goalRelease(goalStart(), ['0'], 1);
  assert.equal(g.done, true);
  assert.equal(goalRelease(g, [], 1), g);
});

test(`손을 ${GOAL_HINT_AFTER}번 떼도 못 이루면 힌트, 그 전에는 처음 안내`, () => {
  const texts = { intro: '처음', done: '끝', hint: '힌트' };
  let g = goalStart();
  for (let k = 0; k < GOAL_HINT_AFTER - 1; k++) g = goalRelease(g, [], 1);
  assert.deepEqual(goalLine(g, 1, texts), { text: '처음', cls: '', progress: null });
  g = goalRelease(g, [], 1);
  assert.deepEqual(goalLine(g, 1, texts), { text: '힌트', cls: '', progress: null });
  g = goalRelease(g, ['0'], 1);
  assert.deepEqual(goalLine(g, 1, texts), { text: '끝', cls: 'ok', progress: null });
});

test('진행 표시는 목표가 여럿일 때만 "3곳 중 2곳"', () => {
  let g = goalRelease(goalStart(), ['a'], 3);
  g = goalRelease(g, ['b'], 3);
  assert.equal(goalLine(g, 3, { hint: 'h' }).progress, '3곳 중 2곳');
  assert.equal(goalLine(g, 1, { hint: 'h' }).progress, null);
});

test('목표에 닿지 않은 자리에서는 가까워도 같은 글(가까워짐 신호 없음)', () => {
  const texts = { intro: '처음', hint: '힌트' };
  const far = goalRelease(goalStart(), [], 1);
  const near = goalRelease(goalStart(), [], 1);
  assert.deepEqual(goalLine(far, 1, texts), goalLine(near, 1, texts));
});

test('sameVal: 둘 다 분수면 정확히, 아니면 상대오차 1e-9, 허용 오차가 있으면 그 안', () => {
  assert.equal(sameVal({ n: 0.5, q: [1n, 2n] }, { n: 0.5000000001, q: [1n, 2n] }, 0), true);
  assert.equal(
    sameVal({ n: 1 / 3, q: [1n, 3n] }, { n: 0.3333333333, q: [3333333333n, 10000000000n] }, 0),
    false,
  );
  assert.equal(sameVal({ n: Math.SQRT2, q: null }, { n: Math.sqrt(2), q: null }, 0), true);
  assert.equal(sameVal({ n: 1.75, q: [7n, 4n] }, { n: Math.sqrt(3), q: null }, 0), false);
  assert.equal(sameVal({ n: 1.75, q: [7n, 4n] }, { n: Math.sqrt(3), q: null }, 0.1), true);
  assert.equal(sameVal({ n: Number.NaN, q: null }, { n: Number.NaN, q: null }, 0), false);
});
