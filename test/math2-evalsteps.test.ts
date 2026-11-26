// 생성기 풀이의 대입 과정 글자(math2-indefinite evalSteps — 부정적분·정적분·넓이 세 단원이 같이 쓴다).
// 계수 −1 인 거듭제곱 항에 양수를 넣으면 "-1^3" 으로 보여 (−1)³ 인지 −(1³) 인지 흐렸다(요청 80) — 거듭제곱을 괄호로 묶는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evalSteps } from '../src/generators/math2-indefinite.ts';

test('맨 앞 항의 계수가 −1 인 거듭제곱에 양수를 넣으면 −(1³) 처럼 거듭제곱을 묶는다', () => {
  // -x^3 - 3x^2 + 3x + 2 에 x=1
  assert.equal(evalSteps([-1, -3, 3, 2], 1), '-(1^3)-3\\cdot 1^2+3\\cdot 1+2');
  // -x^2 - 4x - 7 에 x=3
  assert.equal(evalSteps([-1, -4, -7], 3), '-(3^2)-4\\cdot 3-7');
});

test('그 밖의 꼴은 그대로: 가운데 항(빼기로 읽힘)·음수 대입(이미 괄호)·일차 항·계수가 −1 이 아닌 항', () => {
  assert.equal(evalSteps([1, -1, 0, 0], 2), '2^3-2^2');
  assert.equal(evalSteps([2, -1, 0], 2), '2\\cdot 2^2-2');
  assert.equal(evalSteps([-1, 0, 0], -2), '-(-2)^2');
  assert.equal(evalSteps([-1, -1], 1), '-1-1');
  assert.equal(evalSteps([-2, 0, 1], 3), '-2\\cdot 3^2+1');
  assert.equal(evalSteps([1, 0, 0], 3), '3^2');
  assert.equal(evalSteps([-1, 0, 5], 0), '5');
});
