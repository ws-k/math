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
