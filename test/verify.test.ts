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
