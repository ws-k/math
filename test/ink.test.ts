import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasVaryingPressure, strokeHit, strokeWidths } from '../src/ink/geometry.ts';

function line(n: number, dx: number, dtMs: number, p = 0.5) {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(i * dx, 0, i * dtMs, p);
  return pts;
}

test('천천히 그은 획이 빠르게 그은 획보다 굵다', () => {
  const slow = strokeWidths(line(30, 1, 16), { base: 3 });
  const fast = strokeWidths(line(30, 12, 16), { base: 3 });
  const mid = (a: number[]) => a[15] as number;
  assert.ok(mid(slow) > mid(fast), `${mid(slow)} > ${mid(fast)}`);
});

test('굵기 개수 = 점 개수, 범위 안', () => {
  const w = strokeWidths(line(20, 5, 8), { base: 3 });
  assert.equal(w.length, 20);
  for (const v of w) assert.ok(v > 0 && v <= 3 * 1.6);
});

test('시작과 끝은 가늘게', () => {
  const w = strokeWidths(line(30, 2, 16), { base: 3 });
  assert.ok((w[0] as number) < (w[15] as number));
  assert.ok((w[29] as number) < (w[15] as number));
});

test('점 하나짜리 획도 굵기를 낸다', () => {
  assert.equal(strokeWidths([0, 0, 0, 0.5], { base: 3 }).length, 1);
});

test('필압 변화 감지: 0.5 고정·0 고정은 필압 없음', () => {
  assert.equal(hasVaryingPressure(line(10, 1, 1, 0.5)), false);
  assert.equal(hasVaryingPressure(line(10, 1, 1, 0)), false);
  const pts = line(10, 1, 1);
  for (let i = 0; i < 10; i++) pts[i * 4 + 3] = 0.2 + i * 0.07;
  assert.equal(hasVaryingPressure(pts), true);
});

test('필압이 변하면 굵기에 반영', () => {
  const pts = line(30, 2, 16);
  for (let i = 0; i < 30; i++) pts[i * 4 + 3] = i < 15 ? 0.1 : 1;
  const w = strokeWidths(pts, { base: 3 });
  assert.ok((w[10] as number) < (w[22] as number));
});

test('지우개 판정: 선분 가까이면 맞음', () => {
  const pts = [0, 0, 0, 0.5, 100, 0, 1, 0.5];
  assert.equal(strokeHit(pts, 50, 3, 5), true);
  assert.equal(strokeHit(pts, 50, 20, 5), false);
  assert.equal(strokeHit(pts, 110, 0, 5), false);
  assert.equal(strokeHit([10, 10, 0, 0.5], 12, 11, 5), true);
});
