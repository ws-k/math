import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardKey,
  genPid,
  isGenPid,
  levelGroups,
  noteKey,
  parseCardKey,
  problemIndex,
  resolveProblem,
  step,
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

test('필기 키: 풀이 노트만(옛 공책 쪽 키를 그대로 써서 쌓인 필기가 이어진다)', () => {
  assert.equal(noteKey('u', 'b01'), 'ink:u:b01:note');
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

test('이전·다음 문제: 끝에서는 null', () => {
  assert.equal(step(u, 'b01', 1), 'b02');
  assert.equal(step(u, 'b02', -1), 'b01');
  assert.equal(step(u, 'b01', -1), null);
  assert.equal(step(u, 's01', 1), null);
  assert.equal(step(u, 'zzz', 1), null);
});

test('생성 문제에서 넘기면 원래 자리 앞뒤 문제로', () => {
  assert.equal(step(u, genPid('lin-eq-basic', 3), 1), 'b02');
  assert.equal(step(u, genPid('lin-eq-paren', 3), -1), 'b01');
});

test('수준별 묶음: 단원 문제 순서를 지키며 수준마다', () => {
  const v = unit('v', [
    prob('a', { level: '기초' }),
    prob('b', { level: '표준' }),
    prob('c', { level: '기초' }),
    prob('d', { level: '응용' }),
  ]);
  assert.deepEqual(
    levelGroups(v).map((g) => [g.level, g.items.map((x) => `${x.n}:${x.problem.id}`)]),
    [
      ['기초', ['1:a', '3:c']],
      ['표준', ['2:b']],
      ['응용', ['4:d']],
    ],
  );
});

test('생성 문제 판별: 복습 카드에 넣지 않으려고', () => {
  assert.equal(isGenPid(genPid('lin-eq-basic', 3)), true);
  assert.equal(isGenPid('b01'), false);
});
