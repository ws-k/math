import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../src/generators/rng.ts';
import {
  eul,
  fracAns,
  fracTex,
  gcd,
  ieyo,
  jo,
  lastSound,
  lcm,
  paren,
  polySym,
  polyTex,
  reduce,
  ro,
} from '../src/generators/util.ts';

// ---- 조사 도우미(3-바, 요청 18): 생성기마다 복제돼 규칙이 갈리던 것을 한곳으로 ----
test('끝소리: 수는 끝자리(영·일·삼·육·칠·팔 받침, 일·칠·팔은 ㄹ), 0 으로 끝나면 십·백·천·만이라 받침', () => {
  for (const [v, b, r] of [
    [3, true, false],
    [2, false, false],
    [7, true, true],
    [10, true, false],
    [-8, true, true],
    [1000, true, false],
    [0.5, false, false],
    [0.1, true, true],
    ['1,000', true, false],
  ] as const)
    assert.deepEqual(lastSound(v), { batchim: b, rieul: r }, String(v));
});

test('끝소리: TeX 는 읽는 소리대로 — 분수는 분자(b분의 a), 거듭제곱은 "제곱", 괄호·근호는 안쪽 끝, ° 는 도', () => {
  for (const [v, b] of [
    ['\\frac{3}{4}', true],
    ['-\\frac{2}{3}', false],
    ['\\dfrac{7}{2}', true],
    ['(\\frac{1}{2})', true],
    ['x^2', true],
    ['2^{10}', true],
    ['\\sqrt{3}', true],
    ['\\sqrt{2}', false],
    ['(-3)', true],
    ['\\{1,2,3\\}', true],
    ['30^\\circ', false],
    ['x', false],
    ['\\pi', false],
    ['3개', false],
    ['3명', true],
  ] as const)
    assert.equal(lastSound(v).batchim, b, v);
  // 검토 m2: 분수 분자는 중괄호 짝으로 꺼낸다(분자에 { } 가 있어도), 글자 n·m·l·r 은 엔·엠·엘·알 받침
  // (l·r 은 ㄹ), 단위(cm · 3 m · \mathrm{…})는 받침 없음 그대로
  for (const [v, b] of [
    ['\\frac{x^{2}}{3}', true],
    ['\\frac{\\sqrt{3}}{2}', true],
    ['\\sqrt{\\frac{1}{2}}', true],
    ['n', true],
    ['a_n', true],
    ['2m', true],
    ['cm', false],
    ['3 m', false],
    ['\\mathrm{cm}', false],
    ['\\ln', false],
  ] as const)
    assert.equal(lastSound(v).batchim, b, v);
  assert.equal(ro('l'), '로');
  assert.equal(ro('r'), '로');
  assert.equal(ro('n'), '으로');
  // 분수 값은 (분자, 분모) 로도 — 약분한 분자의 소리
  assert.equal(ieyo(6, 4), '이에요');
  assert.equal(ieyo(4, 6), '예요');
});

test('jo: 짝 조사 고르기(으로/로 는 ㄹ 받침이면 로)', () => {
  assert.equal(jo(3, '을/를'), '을');
  assert.equal(jo(2, '을/를'), '를');
  assert.equal(jo(3, '이에요/예요'), '이에요');
  assert.equal(jo(4, '이에요/예요'), '예요');
  assert.equal(jo(3, '으로/로'), '으로');
  assert.equal(jo(7, '으로/로'), '로');
  assert.equal(jo(2, '으로/로'), '로');
  assert.equal(jo(6, '과/와'), '과');
  assert.equal(jo(9, '은/는'), '는');
  assert.equal(jo(1, '이/가'), '이');
  assert.equal(jo(5, '이라/라'), '라');
  assert.equal(jo(0, '이었어요/였어요'), '이었어요');
  assert.equal(eul('x^2'), '을');
  assert.equal(ro('\\frac{1}{8}'), '로');
});

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
