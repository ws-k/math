import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../src/generators/rng.ts';
import {
  fracAns,
  fracTex,
  gcd,
  lcm,
  paren,
  polySym,
  polyTex,
  reduce,
} from '../src/generators/util.ts';

test('같은 시드면 같은 수열', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.int(1, 100), b.int(1, 100));
});

test('int 는 범위 안', () => {
  const r = makeRng(1);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(-3, 3);
    assert.ok(v >= -3 && v <= 3 && Number.isInteger(v));
  }
});

test('gcd·lcm', () => {
  assert.equal(gcd(12, 18), 6);
  assert.equal(gcd(-4, 6), 2);
  assert.equal(lcm(4, 6), 12);
});

test('reduce 는 부호를 분자로', () => {
  assert.deepEqual(reduce(6, -8), { n: -3, d: 4 });
  assert.deepEqual(reduce(0, 5), { n: 0, d: 1 });
});

test('fracTex', () => {
  assert.equal(fracTex(3, 4), '\\frac{3}{4}');
  assert.equal(fracTex(-6, 8), '-\\frac{3}{4}');
  assert.equal(fracTex(8, 4), '2');
  assert.equal(fracTex(5, 3, { mixed: true }), '1\\frac{2}{3}');
  assert.equal(fracTex(-5, 3, { mixed: true }), '-1\\frac{2}{3}');
  assert.equal(fracTex(2, 3, { mixed: true }), '\\frac{2}{3}');
});

test('fracAns 는 기약분수 문자열', () => {
  assert.equal(fracAns(10, 6), '5/3');
  assert.equal(fracAns(-4, 2), '-2');
});

test('polyTex·polySym (높은 차수부터)', () => {
  assert.equal(polyTex([2, -1, -2]), '2x^2-x-2');
  assert.equal(polyTex([1, 0, 3]), 'x^2+3');
  assert.equal(polyTex([-1, 1]), '-x+1');
  assert.equal(polyTex([0, 0]), '0');
  assert.equal(polyTex([3, 0, 0, -4], 't'), '3t^3-4');
  assert.equal(polySym([2, -1, -2]), '2*x**2 - 1*x - 2');
  assert.equal(polySym([0, 5]), '5');
});

test('paren 은 음수만 괄호', () => {
  assert.equal(paren(-3), '(-3)');
  assert.equal(paren(3), '3');
});
