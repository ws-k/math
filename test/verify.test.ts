import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function runVerify(items: object[]) {
  const dir = mkdtempSync(join(tmpdir(), 'verify-'));
  const f = join(dir, 'p.json');
  writeFileSync(f, JSON.stringify(items));
  return spawnSync('.venv/bin/python', ['verify/verify.py', f], { encoding: 'utf8' });
}

const base = { unit: 'u', ref: 'u/p1' };

test('맞는 답은 통과', () => {
  const r = runVerify([
    { ...base, answer: '8', answerType: 'int', check: 'diff((x+2)*(2*x**2-x-2), x).subs(x, 1)' },
    { ...base, answer: '11/12', answerType: 'fraction', check: 'Rational(2,3)+Rational(1,4)' },
    { ...base, answer: '6x^2+6x-4', answerType: 'expr', check: 'diff(2*x**3+3*x**2-4*x-4, x)' },
    {
      ...base,
      answer: '3',
      answerType: 'choice',
      check: '8',
      choiceChecks: ['6', '7', '8', '9', '10'],
    },
    { ...base, answer: '5', answerType: 'int', check: 'sol = solve(2*x-10, x)\nans = sol[0]' },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, it] of [
  ['틀린 정수 답', { answer: '9', answerType: 'int', check: '8' }],
  ['약분 안 된 분수 답', { answer: '2/4', answerType: 'fraction', check: 'Rational(1,2)' }],
  [
    '틀린 보기 번호',
    { answer: '2', answerType: 'choice', check: '8', choiceChecks: ['6', '7', '8', '9', '10'] },
  ],
  [
    '같은 값 보기가 둘',
    { answer: '3', answerType: 'choice', check: '8', choiceChecks: ['6', '8', '8', '9', '10'] },
  ],
  ['검산식 오류', { answer: '1', answerType: 'int', check: 'undefined_fn(3)' }],
  ['정수가 아닌 값', { answer: '1', answerType: 'int', check: 'Rational(3,2)' }],
] as const) {
  test(`실패해야 함: ${name}`, () => {
    const r = runVerify([{ ...base, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}

const spot = { unit: 'u', ref: 'u/lesson:traps:1', kind: 'spot' };

test('틀린 곳 찾기(spot): 틀린 식은 성립하지 않고 고친 식은 성립하면 통과', () => {
  const r = runVerify([
    { ...spot, mode: 'identity', wrong: '-(x-3)=-x-3', fixed: '-(x-3)=-x+3' },
    { ...spot, mode: 'equivalent', from: 'x/2+1=x/3', wrong: '3*x+1=2*x', fixed: '3*x+6=2*x' },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /레슨/);
});

for (const [name, it] of [
  [
    'identity: 틀린 식이 사실은 항등식',
    { mode: 'identity', wrong: '2*(x+1)=2*x+2', fixed: '-(x-3)=-x+3' },
  ],
  ['identity: 고친 식이 틀림', { mode: 'identity', wrong: '-(x-3)=-x-3', fixed: '-(x-3)=-x-2' }],
  [
    'equivalent: 고친 식의 해가 다름',
    { mode: 'equivalent', from: 'x/2+1=x/3', wrong: '3*x+1=2*x', fixed: '3*x+1=2*x' },
  ],
  [
    'equivalent: 틀린 식의 해가 같음',
    { mode: 'equivalent', from: 'x/2+1=x/3', wrong: '6*x+12=4*x', fixed: '3*x+6=2*x' },
  ],
  ['등호가 없는 식', { mode: 'identity', wrong: '-(x-3)', fixed: '-(x-3)=-x+3' }],
] as const) {
  test(`실패해야 함(spot): ${name}`, () => {
    const r = runVerify([{ ...spot, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}

const equiv = { unit: 'u', ref: 'u/lesson:scale:연산1', kind: 'equiv' };

test('식 변형(equiv): 같은 해면 expect=true, 다른 해면 expect=false 가 통과', () => {
  const r = runVerify([
    { ...equiv, before: '3*x+1000=13000', after: '3*x=12000', expect: true },
    { ...equiv, before: '3*x+1000=13000', after: '3*x=13000', expect: false },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, it] of [
  ['양쪽 연산인데 해가 바뀜', { before: '3*x+1000=13000', after: '3*x=13000', expect: true }],
  ['한쪽 연산인데 해가 그대로', { before: '3*x+1000=13000', after: '3*x=12000', expect: false }],
] as const) {
  test(`실패해야 함(equiv): ${name}`, () => {
    const r = runVerify([{ ...equiv, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}

test('같은 식 대조(sameeq)와 근삿값(approx)', () => {
  const ok = runVerify([
    { ...base, kind: 'sameeq', a: '3*x+1000=13000', b: '3*x=13000-1000' },
    { ...base, kind: 'approx', expr: 'sqrt(2)', value: '1.41', digits: 2 },
    { ...base, kind: 'approx', expr: '-sqrt(3)', value: '-1.7', digits: 1 },
  ]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  for (const bad of [
    { kind: 'sameeq', a: '3*x+1000=13000', b: '3*x+1000=14000' },
    // 해는 같아도(x=4000) 숫자가 다른 식은 다른 식
    { kind: 'sameeq', a: '3*x+1000=13000', b: '6*x+2000=26000' },
    { kind: 'approx', expr: 'sqrt(2)', value: '1.42', digits: 2 },
  ]) {
    const r = runVerify([{ ...base, ...bad }]);
    assert.equal(r.status, 1, JSON.stringify(bad) + r.stdout);
  }
});

const parity = { unit: 'u', ref: 'u/lesson:graph:parity', kind: 'parity' };

test('식 일치(parity): TS 값과 sympy 값이 같고 정의 안 되는 자리가 같으면 통과', () => {
  const r = runVerify([
    {
      ...parity,
      expr: '1/x',
      points: [{ x: '-2' }, { x: '0' }, { x: '1/2' }],
      values: [-0.5, null, 2],
    },
    {
      ...parity,
      expr: 'log(x)+a',
      points: [
        { x: '-1', a: '1' },
        { x: 'E', a: '1' },
      ],
      values: [null, 2],
    },
    { ...parity, expr: 'diff(x**5,x)', points: [{ x: '1' }], values: [5] },
    { ...parity, expr: 'tan(x)', points: [{ x: 'pi/2' }, { x: 'pi/4' }], values: [null, 1] },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, it] of [
  ['값이 다름', { expr: 'x**2', points: [{ x: '3' }], values: [9.0001] }],
  ['TS 는 정의 안 됨, sympy 는 값', { expr: 'x**2', points: [{ x: '3' }], values: [null] }],
  ['TS 는 값, sympy 는 정의 안 됨', { expr: 'sqrt(x)', points: [{ x: '-4' }], values: [2] }],
  ['점과 값 개수가 다름', { expr: 'x', points: [{ x: '1' }], values: [1, 2] }],
] as const) {
  test(`실패해야 함(parity): ${name}`, () => {
    const r = runVerify([{ ...parity, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}

const plot = {
  unit: 'u',
  ref: 'u/lesson:graph:과제',
  kind: 'plot',
  view: { x: ['-2', '3'], y: ['-3', '4'], sx: '1', sy: '1' },
};

test('좌표 과제(plot): 범위 안 격자로 답을 낼 수 있으면 통과', () => {
  const r = runVerify([
    { ...plot, task: 'point', x: '1+1', y: 'diff(x**2,x).subs(x,1)' },
    { ...plot, task: 'pointsOn', curve: 'x**2-1', count: 3 },
    { ...plot, task: 'line', slope: '2', through: ['1', '0'] },
    { ...plot, task: 'line', slope: '1/2' },
    { ...plot, task: 'line', intercept: '-1', slope: '-1' },
    { ...plot, task: 'sketch', curve: 'x/2', tol: '1/2' },
    {
      ...plot,
      view: { x: ['0', '2*pi'], y: ['-1', '1'], sx: 'pi/6', sy: '1/2' },
      task: 'pointsOn',
      curve: 'sin(x)',
      count: 5,
    },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, it] of [
  ['점이 범위 밖', { task: 'point', x: '2+2', y: '0' }],
  ['점이 격자 위가 아님', { task: 'point', x: '1/2', y: '0' }],
  ['곡선 위 격자점이 모자람', { task: 'pointsOn', curve: 'x**2-1', count: 6 }],
  ['격자점 2개를 지나는 직선이 없음', { task: 'line', slope: '2', through: ['1/4', '0'] }],
  ['허용 오차가 격자보다 큼', { task: 'sketch', curve: 'x/2', tol: '2' }],
  ['곡선이 화면 밖', { task: 'sketch', curve: 'x**3', tol: '1/2' }],
] as const) {
  test(`실패해야 함(plot): ${name}`, () => {
    const r = runVerify([{ ...plot, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}
