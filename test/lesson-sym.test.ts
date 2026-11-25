import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evalRational,
  parseSpot,
  parseSym,
  spotTex,
  symToTex,
  texToSym,
} from '../src/lesson/sym.ts';

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

test("미분 기호: diff(식, x) → {식}' (x 로만 미분)", () => {
  assert.equal(symToTex('diff(x**2*(x+1),x)'), "\\left\\{x^{2}(x+1)\\right\\}'");
  assert.equal(symToTex('2*diff(x**3,x)'), "2\\left\\{x^{3}\\right\\}'");
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
  'diff(x**2*(x+1),x)',
  'diff((x**2-3)**3,x)+1',
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
    'diff(x**2)',
    'diff(x**2,y)',
    'diff(x**2,2)',
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

// ---- 틀린 곳 찾기 식의 기호(2-마): spotTex·parseSpot ----
// 그래프·표·수직선이 읽는 식(parseSym·symToTex)은 그대로 두고, 틀린 곳 찾기에서만 새 기호를 읽는다 —
// 계산기(expr.ts)·좌표평면이 모르는 기호가 그쪽 식으로 새어 들어가지 않게.

test('÷: 우선순위·결합은 / 와 같고(파이썬), 분수 칸은 그대로 분수', () => {
  assert.equal(spotTex('(3/4)÷(2/5)'), '\\frac{3}{4}\\div\\frac{2}{5}');
  assert.equal(spotTex('6÷2'), '6\\div 2');
  assert.equal(spotTex('6÷2*3'), '6\\div 2\\times 3');
  assert.equal(spotTex('6÷(2*3)'), '6\\div(2\\times 3)');
  assert.equal(spotTex('(1+2)÷3'), '(1+2)\\div 3');
  // 괄호 앞 곱셈은 기존 규칙 그대로 숨긴다(2(x+1) 과 같게)
  assert.equal(spotTex('2*(6÷3)'), '2(6\\div 3)');
  assert.equal(spotTex('-(6÷3)'), '-(6\\div 3)');
  assert.equal(spotTex('(6÷3)/2'), '\\frac{6\\div 3}{2}');
});

test('계승 ! · 조합 C · 순열 P', () => {
  assert.equal(spotTex('factorial(5)'), '5!');
  assert.equal(spotTex('factorial(n+1)'), '(n+1)!');
  assert.equal(spotTex('factorial(5)/factorial(3)'), '\\frac{5!}{3!}');
  assert.equal(spotTex('factorial(n)**2'), '(n!)^{2}');
  assert.equal(spotTex('2*factorial(3)'), '2\\times 3!');
  assert.equal(spotTex('binomial(6,3)'), '{}_{6}\\mathrm{C}_{3}');
  assert.equal(spotTex('ff(n,r)'), '{}_{n}\\mathrm{P}_{r}');
  assert.equal(spotTex('2*binomial(6,3)'), '2\\times{}_{6}\\mathrm{C}_{3}');
});

test('∑: 몸통이 덧셈이면 괄호, 곱셈이 뒤따르면 ∑ 를 괄호로(몸통에 붙어 읽히지 않게)', () => {
  assert.equal(spotTex('Sum(k**2,(k,1,n))'), '\\sum_{k=1}^{n}k^{2}');
  assert.equal(spotTex('Sum(2*k-1,(k,1,n))'), '\\sum_{k=1}^{n}(2k-1)');
  assert.equal(spotTex('Sum(k,(k,1,n))+n'), '\\sum_{k=1}^{n}k+n');
  assert.equal(spotTex('2*Sum(k,(k,1,n))'), '2\\sum_{k=1}^{n}k');
  assert.equal(spotTex('Sum(k,(k,1,n))*2'), '(\\sum_{k=1}^{n}k)\\times 2');
  assert.equal(spotTex('Sum(1/2**k,(k,1,oo))'), '\\sum_{k=1}^{\\infty}\\frac{1}{2^{k}}');
});

test('∫: 정적분·부정적분(적분상수 C), 몸통이 덧셈이면 괄호', () => {
  assert.equal(spotTex('Integral(x**2,(x,0,3))'), '\\int_{0}^{3}x^{2}\\,dx');
  assert.equal(spotTex('Integral(x**3,x)'), '\\int x^{3}\\,dx');
  assert.equal(spotTex('Integral(x+1,x)'), '\\int (x+1)\\,dx');
  assert.equal(spotTex('x**4/4+C'), '\\frac{x^{4}}{4}+C');
});

test('lim: 양쪽 극한 x→a, 한쪽 극한 a+ · a-, x→∞', () => {
  assert.equal(spotTex('Limit(sin(x)/x,x,0)'), '\\lim_{x\\to 0}\\frac{\\sin(x)}{x}');
  assert.equal(spotTex("Limit(Abs(x)/x,x,0,'+')"), '\\lim_{x\\to 0+}\\frac{\\left|x\\right|}{x}');
  assert.equal(spotTex("Limit(1/x,x,-1,'-')"), '\\lim_{x\\to -1-}\\frac{1}{x}');
  assert.equal(spotTex('Limit(1/x,x,oo)'), '\\lim_{x\\to\\infty}\\frac{1}{x}');
  assert.equal(spotTex('Limit(x**2+1,x,1)'), '\\lim_{x\\to 1}(x^{2}+1)');
});

const SPOT_SAMPLES = [
  ...SAMPLES,
  '(3/4)÷(2/5)',
  '6÷2*3',
  '6÷(2*3)',
  '2*(6÷3)',
  '-(6÷3)',
  '(6÷3)/2',
  '(1+2)÷3',
  'factorial(5)/factorial(3)',
  'factorial(n+1)*factorial(r)',
  'factorial(n)**2',
  '2*factorial(3)',
  'x*factorial(n)',
  'binomial(6,3)*ff(4,2)',
  '2*binomial(n,2)',
  'Sum(k**2,(k,1,n))',
  'Sum(2*k-1,(k,1,n))+n',
  'Sum(k,(k,1,n))*2',
  'x*Sum(k,(k,1,n))*2',
  '-Sum(k,(k,1,n))*2',
  '6÷Sum(k,(k,1,n))*2',
  'Sum(Abs(k-1),(k,1,n))-1',
  'Sum(1/2**k,(k,1,oo))',
  'sqrt(Sum(k,(k,1,n)))',
  'Integral(x**2,(x,0,3))',
  'Integral(x**3,x)+C',
  'Integral(x+1,x)*2',
  'Integral(Integral(x*y,x),y)',
  'Limit(sin(x)/x,x,0)',
  "Limit(Abs(x)/x,x,0,'+')",
  "Limit(1/x,x,-1,'-')+1",
  'Limit(1/x,x,oo)*3',
  'Limit(x**2+1,x,-oo)',
  'Limit(Sum(1/2**k,(k,1,n)),n,oo)',
];

test('왕복(틀린 곳 찾기 기호): TeX 에서 기호를 걷어 낸 식 = 원래 식(구조까지)', () => {
  for (const s of SPOT_SAMPLES) {
    const back = texToSym(spotTex(s));
    assert.deepEqual(parseSpot(back), parseSpot(s), `${s} → ${spotTex(s)} → ${back}`);
  }
});

test('틀린 곳 찾기 기호는 계산기 식(parseSym·symToTex)에서는 거부', () => {
  for (const s of [
    '6÷2',
    'factorial(3)',
    'binomial(6,3)',
    'ff(6,3)',
    'Sum(k,(k,1,n))',
    'Integral(x,x)',
    'Limit(x,x,0)',
    'oo',
    'C',
  ])
    assert.throws(() => symToTex(s), s);
});

test('틀린 곳 찾기 기호의 잘못된 꼴은 예외', () => {
  for (const s of [
    'Sum(k,k)',
    'Sum(k,(2,1,n))',
    'Sum(k,(k,1))',
    'Integral(x,2)',
    'Integral(x,(x,0))',
    'Limit(x,x)',
    'Limit(x,2,0)',
    "Limit(x,x,0,'*')",
    "Limit(x,x,0,'+','-')",
    "'+'",
    "sin('+')",
    'factorial(1,2)',
    'binomial(6)',
    '6÷',
    'x<1',
  ])
    assert.throws(() => spotTex(s), s);
});
