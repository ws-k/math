import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill, formatValue, handsOnCount, spotEquation, symToTex } from '../src/lesson/format.ts';
import type { Lesson } from '../src/lesson/types.ts';

test('formatValue: 반올림·천 단위 쉼표·단위', () => {
  assert.equal(formatValue('4000', { unit: '원' }), '4,000원');
  assert.equal(formatValue('13000/3', { unit: '원', digits: 0 }), '4,333원');
  assert.equal(formatValue('-7/2', { digits: 1 }), '−3.5');
  assert.equal(formatValue('5', {}), '5');
});

test('formatValue: 자리수가 없으면 정수가 아닌 값은 분수로', () => {
  assert.equal(formatValue('13000/3', {}), '13000/3');
});

test('fill: {{이름}} 을 값으로 바꾸고 모르는 이름은 오류', () => {
  assert.equal(fill('연습문제 {{problems}}개', { problems: '30' }), '연습문제 30개');
  assert.throws(() => fill('{{nope}}', {}));
});

test('symToTex: 곱셈 기호를 숨기고 거듭제곱을 위첨자로', () => {
  assert.equal(symToTex('3*x+1'), '3x+1');
  assert.equal(symToTex('-(x-3)'), '-(x-3)');
  assert.equal(symToTex('x**2-2*(x+1)'), 'x^{2}-2(x+1)');
  assert.equal(symToTex('x/2+1'), 'x/2+1');
  assert.equal(symToTex('2*3'), '2\\times 3');
});

test('symToTex: 허용하지 않은 글자는 거부(^ 는 sympy 에서 XOR)', () => {
  assert.throws(() => symToTex('x^2'));
  assert.throws(() => symToTex('import os'));
  assert.throws(() => symToTex(''));
});

test('spotEquation: 토큰을 이어 붙여 검산할 등식을 만든다', () => {
  assert.equal(
    spotEquation([{ sym: '-(x-3)' }, { sep: '=' }, { sym: '-x' }, { sym: '-3', bad: true }]),
    '-(x-3)=-x-3',
  );
});

test('handsOnCount: 손 조작이 있는 장면 수', () => {
  const l: Lesson = {
    minutes: 20,
    scenes: [
      { kind: 'intro', id: 'a', title: 't' },
      { kind: 'terms', id: 'b', title: 't', terms: [] },
      { kind: 'explore', id: 'c', title: 't', widget: { type: 'x', params: {} } },
      { kind: 'spot', id: 'd', title: 't', items: [] },
      { kind: 'summary', id: 'e', title: 't', points: [] },
    ],
  };
  assert.equal(handsOnCount(l), 2);
});
