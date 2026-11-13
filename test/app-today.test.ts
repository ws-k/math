import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dueText, todayPlan, unitProgress, wrongNote } from '../src/app/today.ts';
import { type CardState, DAY } from '../src/lib/srs.ts';
import { prob, unit } from './app-fixture.ts';

const now = new Date(2026, 10, 13, 15, 0).getTime();
const today0 = new Date(2026, 10, 13).getTime();

function card(due: number | null, last: CardState['last'] = 'right', t = now - DAY): CardState {
  return { box: 2, due, lapses: 0, last, history: [{ t, r: last }] };
}

const a = unit('a', [prob('1'), prob('2'), prob('3'), prob('4')]);
const b = unit('b', [prob('1')]);

test('복습일이 된 카드만, 오래된 순으로', () => {
  const cards = {
    'a/1': card(today0 + DAY), // 내일 — 아님
    'a/2': card(today0), // 오늘
    'b/1': card(today0 - 2 * DAY), // 지난 것
    'a/3': card(null), // 졸업
  };
  const p = todayPlan({ cards, units: [a, b], lastUnitId: null, now, goal: 10 });
  assert.deepEqual(p.due, ['b/1', 'a/2']);
  assert.deepEqual(p.fresh, []);
});

test('새 문제는 진행 중인 단원에서, 하루 목표에서 복습 수를 뺀 만큼', () => {
  const cards = { 'a/1': card(today0), 'b/1': card(today0) };
  const p = todayPlan({ cards, units: [a, b], lastUnitId: 'a', now, goal: 4 });
  assert.deepEqual(p.due, ['a/1', 'b/1']);
  assert.deepEqual(p.fresh, ['a/2', 'a/3']);
});

test('목표보다 복습이 많아도 복습은 다 보여 주고 새 문제는 0', () => {
  const cards = { 'a/1': card(today0), 'b/1': card(today0) };
  const p = todayPlan({ cards, units: [a, b], lastUnitId: 'a', now, goal: 1 });
  assert.equal(p.due.length, 2);
  assert.equal(p.fresh.length, 0);
});

test('콘텐츠가 없는 단원의 카드는 빼고 센다', () => {
  const cards = { 'gone/1': card(today0) };
  assert.deepEqual(todayPlan({ cards, units: [a], lastUnitId: null, now, goal: 5 }).due, []);
});

test('단원 진행률: 마지막 채점이 맞음인 단원 문제 수', () => {
  const cards = { 'a/1': card(today0), 'a/2': card(today0, 'wrong'), 'b/1': card(today0) };
  assert.deepEqual(unitProgress(a, cards), { done: 1, total: 4 });
});

test('오답 노트: 틀림·애매함, 최근 채점 순', () => {
  const cards = {
    'a/1': card(today0, 'wrong', now - 3 * DAY),
    'a/2': card(today0, 'unsure', now - DAY),
    'a/3': card(today0, 'right', now),
  };
  assert.deepEqual(wrongNote(cards, [a]), ['a/2', 'a/1']);
});

test('오답 노트: 콘텐츠(단원·문제)가 없는 카드는 뺀다', () => {
  const cards = {
    'a/1': card(today0, 'wrong'),
    'a/없는문제': card(today0, 'wrong'),
    'gone/1': card(today0, 'wrong'),
  };
  assert.deepEqual(wrongNote(cards, [a, b]), ['a/1']);
});

test('복습일 문구: 시각이 아니라 날짜(0시) 차이로 센다', () => {
  const late = new Date(2026, 10, 13, 23, 30).getTime();
  // 밤 11시 반에 채점해도 내일 복습이면 "1일 뒤" — 시간 차로 반올림하면 0일이 돼 버린다
  assert.equal(dueText(card(today0 + DAY), late), '1일 뒤에 다시 봐요');
  assert.equal(dueText(card(today0 + 3 * DAY), now), '3일 뒤에 다시 봐요');
  assert.equal(dueText(card(today0), late), '오늘 다시 봐요');
  assert.equal(dueText(card(today0 - 2 * DAY), now), '오늘 다시 봐요');
  assert.equal(dueText(card(null), now), '이 문제는 졸업했어요');
});
