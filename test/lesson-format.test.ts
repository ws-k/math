import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fill,
  formatValue,
  handsOnCount,
  numSplit,
  relTex,
  splitRel,
  spotEquation,
  spotFixed,
  symToTex,
  tokenTex,
} from '../src/lesson/format.ts';
import type { Lesson } from '../src/lesson/types.ts';

test('formatValue: 반올림·천 단위 쉼표·단위', () => {
  assert.equal(formatValue('4000', { unit: '원' }), '4,000원');
  assert.equal(formatValue('13000/3', { unit: '원', digits: 0 }), '4,333원');
  assert.equal(formatValue('-7/2', { digits: 1 }), '−3.5');
  assert.equal(formatValue('5', {}), '5');
});

test('numSplit: 보기 글자를 수와 단위로 — 수(4,096) 안에서 줄이 갈리지 않게 화면이 나눠 그린다', () => {
  // Safari 는 keep-all 에서도 '4,096가지' 를 쉼표 뒤에서 갈랐다(4, / 096가지)
  assert.deepEqual(numSplit('4,096가지'), ['4,096', '가지']);
  assert.deepEqual(numSplit('−3.5'), ['−3.5', '']);
  assert.deepEqual(numSplit('13/4 cm'), ['13/4', ' cm']);
  assert.deepEqual(numSplit('12,000원'), ['12,000', '원']);
  assert.equal(numSplit('가지'), null);
});

test('formatValue: 반올림해 0 이 되면 −0 이 아니라 0', () => {
  assert.equal(formatValue('-1/3', { digits: 0 }), '0');
  assert.equal(formatValue('-1/300', { digits: 1 }), '0.0');
  assert.equal(formatValue('-1/2', { digits: 0 }), '−1');
});

test('formatValue: 소수 값도 받는다(무리수 근삿값 보기)', () => {
  assert.equal(formatValue('1.41', { digits: 2 }), '1.41');
  assert.equal(formatValue('-0.5', {}), '−1/2');
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
  assert.equal(symToTex('x/2+1'), '\\frac{x}{2}+1');
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

test('spotEquation·spotFixed: 부등호 토큰이 틀린 곳이면 고친 조각도 부등호로 끼운다', () => {
  const toks = [{ sym: 'x' }, { sep: '<' as const, bad: true as const }, { sym: '-3' }];
  assert.equal(spotEquation(toks), 'x<-3');
  assert.equal(spotEquation(spotFixed(toks, '>')), 'x>-3');
  assert.equal(spotEquation([{ sym: '2*x' }, { sep: '>=' }, { sym: '-6', bad: true }]), '2*x>=-6');
  // 등식 아닌 식: 관계 토큰 없이 이어 붙인 식
  assert.equal(spotEquation([{ sym: '3/4*(2/5)', bad: true }, { sym: '+1' }]), '3/4*(2/5)+1');
});

test('tokenTex: 토큰 하나의 글자 — 곱셈·÷ 로 이어지는 조각(×2/5)도 그린다', () => {
  assert.equal(tokenTex('-(x-3)'), '-(x-3)');
  assert.equal(tokenTex('+3'), '+3');
  assert.equal(tokenTex('*(2/5)', true), '\\times\\frac{2}{5}');
  assert.equal(tokenTex('*3', true), '\\times 3');
  assert.equal(tokenTex('÷2', true), '\\div 2');
  assert.equal(tokenTex('÷(2/5)', true), '\\div\\frac{2}{5}');
  // / 로 이어지는 조각은 분수 칸을 나눠 그릴 수 없다
  assert.throws(() => tokenTex('/2', true));
  assert.throws(() => tokenTex('**2', true));
  assert.throws(() => tokenTex('*', true));
  // 이어지는 조각의 괄호는 곱셈 오른쪽 자리 규칙 그대로(괄호가 사라지면 3×x+2 처럼 다른 식으로 보인다)
  assert.equal(tokenTex('*(x+2)', true), '\\times(x+2)');
  // 쪽의 첫 토큰은 ×·÷ 로 시작할 수 없고, +·− 는 부호다
  assert.throws(() => tokenTex('*3'));
  assert.equal(tokenTex('-1/2'), '\\frac{-1}{2}');
  // 이어지는 +·− 조각은 이어 붙인 식처럼(부호가 분자 안에 들어가지 않게)
  assert.equal(tokenTex('+7*4/2'), '\\frac{+7\\times 4}{2}');
  assert.equal(tokenTex('+7*4/2', true), '+\\frac{7\\times 4}{2}');
  assert.equal(tokenTex('-(1/12)', true), '-\\frac{1}{12}');
  assert.equal(tokenTex('+-3', true), '+(-3)');
  assert.equal(tokenTex('÷(2*3)', true), '\\div(2\\times 3)');
  assert.equal(tokenTex('*-2', true), '\\times(-2)');
});

test('splitRel: 관계 기호 하나로 나누기(없으면 식 하나, 둘 이상이면 예외)', () => {
  assert.deepEqual(splitRel('x<=-3'), ['x', '<=', '-3']);
  assert.deepEqual(splitRel('-(x-3)=-x+3'), ['-(x-3)', '=', '-x+3']);
  assert.deepEqual(splitRel('2*x'), ['2*x']);
  assert.deepEqual(splitRel("Limit(1/x,x,0,'+')>=1"), ["Limit(1/x,x,0,'+')", '>=', '1']);
  assert.throws(() => splitRel('1<x<3'));
});

test('relTex: 등식은 예전과 같은 글자, 부등식·관계 없는 식·새 기호도 그린다', () => {
  assert.equal(relTex('-(x-3)=-x+3'), '-(x-3)=-x+3');
  assert.equal(relTex('x/2+1=x/3'), '\\frac{x}{2}+1=\\frac{x}{3}');
  assert.equal(relTex('2/3>3/4'), '\\frac{2}{3}>\\frac{3}{4}');
  assert.equal(relTex('x<-3'), 'x<-3');
  assert.equal(relTex('x<=-3'), 'x\\le -3');
  assert.equal(relTex('x**2+1>=2*x'), 'x^{2}+1\\ge 2x');
  assert.equal(relTex('(3/4)÷(2/5)'), '\\frac{3}{4}\\div\\frac{2}{5}');
  assert.equal(relTex('Integral(x**3,x)=x**4/4+C'), '\\int x^{3}\\,dx=\\frac{x^{4}}{4}+C');
  assert.equal(
    relTex("Limit(Abs(x)/x,x,0,'+')=1"),
    '\\lim_{x\\to 0+}\\frac{\\left|x\\right|}{x}=1',
  );
  assert.throws(() => relTex('1<2<3'));
  assert.throws(() => relTex('x=<1'));
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

test('symToTex: 곱셈 기호를 빼먹은 꼴은 거부(sympy 가 못 읽는다)', () => {
  assert.throws(() => symToTex('3x'));
  assert.throws(() => symToTex('2(x+1)'));
  assert.throws(() => symToTex('(x)(x)'));
  assert.doesNotThrow(() => symToTex('2*(x+1)'));
});
