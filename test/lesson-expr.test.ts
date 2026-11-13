import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compile,
  derivative,
  evalExact,
  evalNum,
  paritySamples,
  toSym,
} from '../src/lesson/expr.ts';
import { parseSym } from '../src/lesson/sym.ts';

const num = (s: string, env: Record<string, number> = {}) => evalNum(parseSym(s), env);

test('evalNum: 사칙·거듭제곱·함수·상수', () => {
  assert.equal(num('2+3*4'), 14);
  assert.equal(num('2**3**2'), 512);
  assert.equal(num('-x**2', { x: 3 }), -9);
  assert.ok(Math.abs(num('sin(pi/6)') - 0.5) < 1e-12);
  assert.ok(Math.abs(num('exp(1)') - Math.E) < 1e-12);
  assert.ok(Math.abs(num('log(8,2)') - 3) < 1e-12);
  assert.equal(num('Abs(x-5)', { x: 2 }), 3);
  assert.equal(num('sqrt(9)'), 3);
});

test('evalNum: 정의 안 되는 값은 NaN(sympy 의 실수 아님·zoo 와 맞춘다)', () => {
  for (const [s, env] of [
    ['1/x', { x: 0 }],
    ['log(x)', { x: 0 }],
    ['log(x)', { x: -1 }],
    ['sqrt(x)', { x: -4 }],
    ['x**(1/3)', { x: -8 }],
    ['x**-1', { x: 0 }],
    ['tan(pi/2)', {}],
    ['log(2,1)', {}],
    ['10**400', {}],
  ] as const)
    assert.ok(Number.isNaN(num(s, env)), s);
});

test('compile: 선언한 변수만 받는다(모르는 이름은 거부)', () => {
  assert.doesNotThrow(() => compile('a*x**2', ['x', 'a']));
  assert.throws(() => compile('a*x**2', ['x']), /a/);
  assert.throws(() => compile('x^2', ['x']));
});

test('evalExact: 다항·유리식을 분수로 정확히(함수가 있으면 null)', () => {
  assert.deepEqual(evalExact(parseSym('x**2-1/3'), { x: [1n, 2n] }), [-1n, 12n]);
  assert.deepEqual(evalExact(parseSym('(x+1)*(x-1)'), { x: [1n, 1n] }), [0n, 1n]);
  assert.equal(evalExact(parseSym('1/x'), { x: [0n, 1n] }), null);
  assert.equal(evalExact(parseSym('sin(x)'), { x: [0n, 1n] }), null);
});

test('derivative: 기본 규칙(값으로 확인)', () => {
  const d = (s: string, x: number) => evalNum(derivative(parseSym(s), 'x'), { x });
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
  assert.ok(near(d('x**5', 1), 5));
  assert.ok(near(d('x**2*x**3', 2), 80));
  assert.ok(near(d('(x+1)*(x-1)', 1), 2));
  assert.ok(near(d('(x**2-3)**3', 1), 24));
  assert.ok(near(d('1/x', 2), -0.25));
  assert.ok(near(d('sin(x)', 0), 1));
  assert.ok(near(d('exp(2*x)', 0), 2));
  assert.ok(near(d('log(x)', 4), 0.25));
  assert.ok(near(d('sqrt(x)', 4), 0.25));
  assert.ok(near(d('2**x', 0), Math.LN2));
  assert.ok(near(d('x**x', 1), 1));
  assert.throws(() => derivative(parseSym('Abs(x)'), 'x'));
});

test('derivative: 다항식이면 정확한 분수로 계산된다', () => {
  assert.deepEqual(evalExact(derivative(parseSym('(x+1)*(x-1)'), 'x'), { x: [1n, 1n] }), [2n, 1n]);
  assert.deepEqual(evalExact(derivative(parseSym('x**3/3'), 'x'), { x: [1n, 2n] }), [1n, 4n]);
});

test('toSym: 식 구조 → sympy 글자(다시 읽으면 같은 값)', () => {
  for (const s of ['x**2-2*(x+1)', '-x**2', 'sin(x)/x', 'log(8,2)', '2**3**2', 'x-(-3)']) {
    const back = toSym(parseSym(s));
    assert.equal(num(back, { x: 1.7 }), num(s, { x: 1.7 }), `${s} → ${back}`);
  }
});

test('paritySamples: 범위 안 표본 점 9개, 각 점에서 TS 값(정의 안 되면 null)', () => {
  const s = paritySamples('1/x', ['x'], { x: [-2, 2] }, {});
  assert.equal(s.points.length, 9);
  assert.deepEqual(s.points[4], { x: '0' });
  assert.equal(s.values[4], null);
  assert.equal(s.values[0], -0.5);
  const t = paritySamples('a*x', ['x', 'a'], { x: [0, 1] }, { a: '3' });
  assert.deepEqual(t.points[8], { x: '1', a: '3' });
  assert.equal(t.values[8], 3);
});
