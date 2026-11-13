import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type PadKey, pressKey } from '../src/app/numpad.ts';

const type = (keys: PadKey[], start = '') => keys.reduce(pressKey, start);

test('숫자를 차례로 붙인다', () => {
  assert.equal(type(['1', '2', '0']), '120');
});

test('− 는 부호를 뒤집는다(어디서 눌러도 맨 앞)', () => {
  assert.equal(type(['3', '-']), '-3');
  assert.equal(type(['3', '-', '-']), '3');
});

test('분수 막대는 한 번만, 숫자 뒤에만', () => {
  assert.equal(type(['/']), '');
  assert.equal(type(['-', '/']), '-');
  assert.equal(type(['7', '/', '/', '4']), '7/4');
});

test('소수점은 한 번만, 맨 앞이면 0. 으로, 분수와 섞지 않는다', () => {
  assert.equal(type(['.']), '0.');
  assert.equal(type(['1', '.', '5', '.']), '1.5');
  assert.equal(type(['1', '/', '.']), '1/');
  assert.equal(type(['1', '.', '5', '/']), '1.5');
});

test('지우기와 전부 지우기', () => {
  assert.equal(type(['1', '2', 'back']), '1');
  assert.equal(type(['back']), '');
  assert.equal(type(['1', '2', 'clear']), '');
});

test('너무 길면 더 받지 않는다', () => {
  const keys = Array.from({ length: 20 }, () => '9' as PadKey);
  assert.equal(type(keys).length, 12);
});
