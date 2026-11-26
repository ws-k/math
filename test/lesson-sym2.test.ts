// 틀린 곳 찾기 기호 2차(3-바): 허수 i · 중복조합 H · 도(°) · t 로 미분 · 논리(역·대우).
// 1차 기호 시험(lesson-sym.test.ts)과 같은 틀 — 그리는 글자, 그 글자에서 되읽은 식 = 원래 식(구조까지), 계산기 식에서는 거부.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLogicSpot, parseSpot, spotTex, symToTex, texToSym } from '../src/lesson/sym.ts';

test('허수 i: sympy 이름 I 를 i 로, 곱셈은 숨긴다(2i · √2i)', () => {
  assert.equal(spotTex('I'), 'i');
  assert.equal(spotTex('(3+2*I)*(3-2*I)'), '(3+2i)(3-2i)');
  assert.equal(spotTex('I**2'), 'i^{2}');
  assert.equal(spotTex('sqrt(2)*I'), '\\sqrt{2}i');
  assert.equal(spotTex('I*2'), 'i\\times 2');
});

test('중복조합 H: ₙHᵣ (조합 C 와 같은 자리 표기)', () => {
  assert.equal(spotTex('H(3,4)'), '{}_{3}\\mathrm{H}_{4}');
  assert.equal(spotTex('2*H(3,4)'), '2\\times{}_{3}\\mathrm{H}_{4}');
  assert.equal(spotTex('H(n,r)'), '{}_{n}\\mathrm{H}_{r}');
});

test('도(°): rad(30) 을 30° 로(sympy rad 는 도를 라디안으로 바꾼다), 식이면 괄호', () => {
  assert.equal(spotTex('sin(rad(30))'), '\\sin(30^{\\circ})');
  assert.equal(spotTex('rad(x+30)'), '(x+30)^{\\circ}');
  assert.equal(spotTex('2*rad(45)'), '2\\times 45^{\\circ}');
  assert.equal(spotTex('cos(rad(60))**2'), '\\cos(60^{\\circ})^{2}');
});

test('t 로 미분: x 는 예전처럼 {…}′, 다른 글자는 d/dt(…)', () => {
  assert.equal(spotTex('diff(x**2,x)'), "\\left\\{x^{2}\\right\\}'");
  assert.equal(spotTex('diff(t**3+t,t)'), '\\frac{d}{dt}\\left(t^{3}+t\\right)');
  assert.equal(spotTex('2*diff(t**2,t)'), '2\\times\\frac{d}{dt}\\left(t^{2}\\right)');
  // d/dt(…) 는 오른쪽이 열린 꼴이라(뒤에 붙은 것까지 미분하는 것처럼 읽힘 — 검토 M1) 거듭제곱 밑이면 { } 로,
  // 곱셈 왼쪽이면 괄호로 묶는다
  assert.equal(spotTex('diff(t+1,t)**2'), '\\left\\{\\frac{d}{dt}\\left(t+1\\right)\\right\\}^{2}');
  assert.equal(spotTex('diff(t**2,t)*t'), '(\\frac{d}{dt}\\left(t^{2}\\right))t');
  assert.equal(
    spotTex('sqrt(diff(t**2,t)**2+diff(t**3,t)**2)'),
    '\\sqrt{\\left\\{\\frac{d}{dt}\\left(t^{2}\\right)\\right\\}^{2}+\\left\\{\\frac{d}{dt}\\left(t^{3}\\right)\\right\\}^{2}}',
  );
  // 미분할 글자가 d 거나 몸통에 d 가 있으면 d/dt 와 헷갈린다
  for (const s of ['diff(d*t,t)', 'diff(t,d)', 'diff(t,2)']) assert.throws(() => spotTex(s), s);
});

test('논리: p→q · ~p, 명제는 글자나 그 부정끼리만', () => {
  assert.equal(spotTex('Implies(p,q)'), 'p\\to q');
  assert.equal(spotTex('Implies(Not(q),Not(p))'), '\\sim q\\to\\sim p');
  assert.equal(spotTex('Not(p)'), '\\sim p');
  for (const s of [
    'Implies(p,Implies(q,r))',
    'Implies(x+1,q)',
    'Not(2)',
    'Implies(p,q)+1',
    '2*Not(p)',
    'Not(Not(p))',
    'Implies(p)',
  ])
    assert.throws(() => spotTex(s), s);
  assert.equal(isLogicSpot('Implies(p,q)'), true);
  assert.equal(isLogicSpot('Not(p)'), true);
  assert.equal(isLogicSpot('p'), false);
  assert.equal(isLogicSpot('x+1'), false);
});

const SAMPLES = [
  'I',
  '(3+2*I)*(3-2*I)',
  'I**2+1',
  'sqrt(2)*I',
  'I*2',
  '-2*I',
  'pi*I',
  'sqrt(-2)*sqrt(-3)',
  'H(3,4)',
  '2*H(n,2)',
  'H(3,4)*binomial(6,2)',
  'sin(rad(30))',
  'sin(rad(30))**2+cos(rad(30))**2',
  'rad(x+30)',
  '2*rad(45)',
  'tan(rad(45))*2',
  'diff(t**3+t,t)',
  '2*diff(t**2,t)',
  'diff(t**2,t)*t',
  'diff(sin(2*t),t)+1',
  'diff(diff(t**3,t),t)',
  'diff(t**2,t)**2',
  'sqrt(diff(t**2,t)**2+diff(t**3,t)**2)',
  'diff(t**2,t)*diff(t,t)',
  '6÷diff(t**2,t)*t',
  'diff(x**2,x)**2',
  'diff(diff(t**3,t)**2,t)',
  'Implies(p,q)',
  'Implies(Not(q),Not(p))',
  'Implies(q,p)',
  'Not(p)',
];

test('왕복(기호 2차): TeX 에서 기호를 걷어 낸 식 = 원래 식(구조까지)', () => {
  for (const s of SAMPLES) {
    const back = texToSym(spotTex(s));
    assert.deepEqual(parseSpot(back), parseSpot(s), `${s} → ${spotTex(s)} → ${back}`);
  }
});

test('기호 2차도 계산기 식(parseSym·symToTex)에서는 거부', () => {
  for (const s of ['I', 'H(3,4)', 'rad(30)', 'diff(t**2,t)', 'Implies(p,q)', 'Not(p)'])
    assert.throws(() => symToTex(s), s);
});
