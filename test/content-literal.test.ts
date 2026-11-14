import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LITERAL } from '../src/content/check.ts';

// 검산식이 '답을 그대로 적은 값'인지. 답 자체(정수·기약분수)만 막고, 약분이 남은 분수는 계산으로 본다 —
// 생성기가 Rational(360, n) 에 n 을 넣으면 Rational(360,8) 이 되는데 이것은 360÷8 을 계산하는 식이다(요청 24·113).
test('답 그대로(정수·기약분수)는 막는다', () => {
  for (const s of [
    '8',
    '-3',
    ' 5/3 ',
    '-7/2',
    'Rational(5,3)',
    'Rational( -1 , 4 )',
    'Integer(8)',
    '0',
  ])
    assert.equal(LITERAL.test(s), true, s);
});

test('약분이 남은 분수는 계산식으로 본다', () => {
  for (const s of ['Rational(360,8)', '20/8', 'Rational(-6,4)', '0/5', 'Rational(4,2)'])
    assert.equal(LITERAL.test(s), false, s);
});

test('분모가 1 인 분수는 답 그대로로 본다', () => {
  for (const s of ['8/1', 'Rational(8,1)']) assert.equal(LITERAL.test(s), true, s);
});

test('계산이 든 식은 그대로 통과', () => {
  for (const s of ['2+3', 'Integer(8)/20', '360*Rational(1,8)', 'sqrt(2)', 'Rational(1,2)+1'])
    assert.equal(LITERAL.test(s), false, s);
});
