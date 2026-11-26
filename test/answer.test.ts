import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerText, CIRCLED, compareAnswer } from '../src/lib/answer.ts';

// 문제 화면(정답 보기)·레슨({{answer}})·형식 검사가 같은 답 글자를 쓴다(검토 M5)
test('answerText: 정답 표기가 있으면 그것, 객관식이면 ①~⑤, 아니면 답 그대로', () => {
  assert.equal(CIRCLED[2], '③');
  assert.equal(
    answerText({ answer: '1637/2000', answerType: 'fraction', answerTex: '$0.8185$' }),
    '$0.8185$',
  );
  assert.equal(answerText({ answer: '4', answerType: 'choice' }), '④');
  assert.equal(answerText({ answer: '12', answerType: 'int' }), '12');
});

test('정수', () => {
  assert.equal(compareAnswer('8', '8', 'int'), 'correct');
  assert.equal(compareAnswer(' 8 ', '8', 'int'), 'correct');
  assert.equal(compareAnswer('−3', '-3', 'int'), 'correct');
  assert.equal(compareAnswer('7', '8', 'int'), 'wrong');
  assert.equal(compareAnswer('', '8', 'int'), 'invalid');
  assert.equal(compareAnswer('abc', '8', 'int'), 'invalid');
});

test('분수: 약분 전·대분수·소수도 값이 같으면 정답', () => {
  assert.equal(compareAnswer('5/3', '5/3', 'fraction'), 'correct');
  assert.equal(compareAnswer('10/6', '5/3', 'fraction'), 'correct');
  assert.equal(compareAnswer('1 2/3', '5/3', 'fraction'), 'correct');
  assert.equal(compareAnswer('-1 2/3', '-5/3', 'fraction'), 'correct');
  assert.equal(compareAnswer('0.5', '1/2', 'fraction'), 'correct');
  assert.equal(compareAnswer('2', '2', 'fraction'), 'correct');
  assert.equal(compareAnswer('4/3', '5/3', 'fraction'), 'wrong');
  assert.equal(compareAnswer('1/0', '5/3', 'fraction'), 'invalid');
});

test('오지선다', () => {
  assert.equal(compareAnswer('3', '3', 'choice'), 'correct');
  assert.equal(compareAnswer('③', '3', 'choice'), 'correct');
  assert.equal(compareAnswer('2', '3', 'choice'), 'wrong');
  assert.equal(compareAnswer('6', '3', 'choice'), 'invalid');
});

test('식은 자동 비교하지 않는다', () => {
  assert.equal(compareAnswer('2x+1', '2x+1', 'expr'), 'unknown');
});
