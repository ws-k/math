import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardKey,
  flip,
  genPid,
  inkKey,
  isGenPid,
  pageNumber,
  parseCardKey,
  problemIndex,
  resolveProblem,
} from '../src/app/pages.ts';
import { prob, unit } from './app-fixture.ts';

const u = unit('m1-linear-eq', [
  prob('b01', { generator: 'lin-eq-basic', seed: 1 }),
  prob('b02', { generator: 'lin-eq-paren', seed: 2 }),
  prob('s01'),
]);

test('카드 키는 단원/문제, 되돌릴 수 있다(생성 문제의 콜론 포함)', () => {
  assert.equal(cardKey('u', 'b01'), 'u/b01');
  assert.deepEqual(parseCardKey('u/gen:a:1'), { unitId: 'u', pid: 'gen:a:1' });
  assert.equal(parseCardKey('잘못된키'), null);
});

test('필기 키: 쪽마다 따로', () => {
  assert.equal(inkKey('u', 'b01', 'text'), 'ink:u:b01:text');
  assert.equal(inkKey('u', 'b01', 'note'), 'ink:u:b01:note');
  assert.equal(inkKey('u', null, 'text'), 'ink:u:concept');
  assert.equal(inkKey('u', null, 'note'), 'ink:u:examples');
});

test('문제 찾기: 단원 문제, 생성 문제, 없는 문제', () => {
  assert.equal(resolveProblem(u, 'b02')?.id, 'b02');
  const g = resolveProblem(u, genPid('lin-eq-basic', 7));
  assert.equal(g?.id, 'gen:lin-eq-basic:7');
  assert.equal(g?.generator, 'lin-eq-basic');
  assert.equal(resolveProblem(u, 'zzz'), null);
  assert.equal(resolveProblem(u, 'gen:없는생성기:1'), null);
  assert.equal(resolveProblem(u, 'gen:lin-eq-basic:abc'), null);
});

test('문제 위치: 생성 문제는 같은 생성기의 첫 문제 자리', () => {
  assert.equal(problemIndex(u, 'b01'), 0);
  assert.equal(problemIndex(u, 's01'), 2);
  assert.equal(problemIndex(u, genPid('lin-eq-paren', 9)), 1);
  assert.equal(problemIndex(u, 'zzz'), -1);
});

test('펼친 책: 한 번 넘기면 다음 문제(양쪽이 함께)', () => {
  assert.deepEqual(flip(u, null, 'text', 1, 'spread'), { pid: 'b01', side: 'text' });
  assert.deepEqual(flip(u, 'b01', 'note', 1, 'spread'), { pid: 'b02', side: 'text' });
  assert.deepEqual(flip(u, 'b01', 'text', -1, 'spread'), { pid: null, side: 'text' });
  assert.equal(flip(u, null, 'text', -1, 'spread'), null);
  assert.equal(flip(u, 's01', 'text', 1, 'spread'), null);
});

test('한 쪽씩: 교재 → 공책 → 다음 문제 교재', () => {
  assert.deepEqual(flip(u, 'b01', 'text', 1, 'single'), { pid: 'b01', side: 'note' });
  assert.deepEqual(flip(u, 'b01', 'note', 1, 'single'), { pid: 'b02', side: 'text' });
  assert.deepEqual(flip(u, 'b02', 'text', -1, 'single'), { pid: 'b01', side: 'note' });
  assert.deepEqual(flip(u, null, 'note', 1, 'single'), { pid: 'b01', side: 'text' });
  assert.equal(flip(u, 's01', 'note', 1, 'single'), null);
});

test('생성 문제에서 넘기면 원래 자리 다음 문제로', () => {
  assert.deepEqual(flip(u, genPid('lin-eq-basic', 3), 'text', 1, 'spread'), {
    pid: 'b02',
    side: 'text',
  });
});

test('쪽 번호: 단원 첫 쪽이 1, 문제마다 두 쪽', () => {
  assert.equal(pageNumber(u, null, 'text'), 1);
  assert.equal(pageNumber(u, null, 'note'), 2);
  assert.equal(pageNumber(u, 'b01', 'text'), 3);
  assert.equal(pageNumber(u, 's01', 'note'), 8);
});

test('생성 문제 판별: 복습 카드에 넣지 않으려고', () => {
  assert.equal(isGenPid(genPid('lin-eq-basic', 3)), true);
  assert.equal(isGenPid('b01'), false);
});
