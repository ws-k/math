import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evalRational, parseSym, symToTex, texToSym } from '../src/lesson/sym.ts';

test('곱셈: 숫자끼리·숫자가 뒤에 오면 ×, 아니면 숨긴다', () => {
  assert.equal(symToTex('2*3*4'), '2\\times 3\\times 4');
  assert.equal(symToTex('x*2'), 'x\\times 2');
  assert.equal(symToTex('3*x+1'), '3x+1');
  assert.equal(symToTex('2*(x+1)'), '2(x+1)');
  assert.equal(symToTex('x*y'), 'xy');
});

test('거듭제곱: 지수는 통째로 위첨자, 밑이 식이면 괄호', () => {
  assert.equal(symToTex('x**2*3'), 'x^{2}\\times 3');
  assert.equal(symToTex('2**(x+1)'), '2^{x+1}');
  assert.equal(symToTex('x**-1'), 'x^{-1}');
  assert.equal(symToTex('(x+1)**2'), '(x+1)^{2}');
  assert.equal(symToTex('(-2)**2'), '(-2)^{2}');
  assert.equal(symToTex('-2**2'), '-2^{2}');
});

test('부호: 음수가 곱셈·덧셈 오른쪽에 오면 괄호', () => {
  assert.equal(symToTex('-2*-3'), '-2\\times(-3)');
  assert.equal(symToTex('x+-3'), 'x+(-3)');
  assert.equal(symToTex('x-(-3)'), 'x-(-3)');
  assert.equal(symToTex('-(x-3)'), '-(x-3)');
  assert.equal(symToTex('+1000'), '+1000');
  assert.equal(symToTex('-x'), '-x');
});

test('나눗셈은 분수로', () => {
  assert.equal(symToTex('x/2+1'), '\\frac{x}{2}+1');
  assert.equal(symToTex('2*x/3'), '\\frac{2x}{3}');
  assert.equal(symToTex('2*(1/3)'), '2\\times\\frac{1}{3}');
});

test('함수·상수: 제곱근·삼각·지수·로그·절댓값·π·e', () => {
  assert.equal(symToTex('sqrt(2)'), '\\sqrt{2}');
  assert.equal(symToTex('2*sqrt(3)'), '2\\sqrt{3}');
  assert.equal(symToTex('sin(x)**2+cos(x)**2'), '\\sin(x)^{2}+\\cos(x)^{2}');
  assert.equal(symToTex('tan(pi/4)'), '\\tan(\\frac{\\pi}{4})');
  assert.equal(symToTex('exp(2*x)'), 'e^{2x}');
  assert.equal(symToTex('log(x)'), '\\ln(x)');
  assert.equal(symToTex('log(8, 2)'), '\\log_{2}(8)');
  assert.equal(symToTex('Abs(x-1)'), '\\left|x-1\\right|');
  assert.equal(symToTex('pi*x'), '\\pi x');
  assert.equal(symToTex('E**2'), 'e^{2}');
});

const SAMPLES = [
  '2*3*4',
  'x*2',
  'x**2*3',
  '2**(x+1)',
  'x**-1',
  '-2*-3',
  '3*x+1000',
  '-(x-3)',
  '-(2*x)',
  'x/2+1',
  '(x/2)*3',
  '2*(x/3)',
  'x**2-2*(x+1)',
  'a-(b+c)',
  'a+(b+c)',
  'x*(2*y)',
  '3+-2*x',
  '-x**2',
  '(-x)**2',
  '2**3**2',
  '(2**3)**2',
  'sqrt(x+1)/2',
  'sin(x)*cos(x)',
  'exp(x)*x',
  'log(8,2)+log(x)',
  'Abs(-3)*x',
  'pi*r**2',
  '1/(1/2)',
  '+3*x',
  '--3',
];

test('왕복: TeX 에서 기호를 걷어 낸 식 = 원래 식(구조까지)', () => {
  for (const s of SAMPLES) {
    const back = texToSym(symToTex(s));
    assert.deepEqual(parseSym(back), parseSym(s), `${s} → ${symToTex(s)} → ${back}`);
  }
});

test('지원하지 않는 꼴은 예외', () => {
  for (const bad of [
    'x^2',
    'import os',
    '',
    '3x',
    '2(x+1)',
    '(x)(x)',
    'x(x+1)',
    'foo(x)',
    'f',
    'sqrt(1,2)',
    'x==2',
    'x=2',
    '2**',
    '(x+1',
    'X',
  ])
    assert.throws(() => symToTex(bad), bad);
});

test('evalRational: 숫자만 있는 식을 분수로 정확히 계산', () => {
  assert.deepEqual(evalRational(parseSym('3*4000+1000')), [13000n, 1n]);
  assert.deepEqual(evalRational(parseSym('13000/3')), [13000n, 3n]);
  assert.deepEqual(evalRational(parseSym('-6/4')), [-3n, 2n]);
  assert.deepEqual(evalRational(parseSym('2**-2')), [1n, 4n]);
  assert.deepEqual(evalRational(parseSym('0.25*4')), [1n, 1n]);
  assert.throws(() => evalRational(parseSym('x+1')));
  assert.throws(() => evalRational(parseSym('sqrt(2)')));
  assert.throws(() => evalRational(parseSym('1/0')));
});
