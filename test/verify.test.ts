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
    // 2/3 처럼 소수로 딱 떨어지지 않는 분수도 정확히 읽어야 한다
    { ...plot, task: 'line', slope: '2/3', through: ['0', '0'] },
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

const root = { unit: 'u', ref: 'u/lesson:hook:식의 해', kind: 'root' };

test('식의 해(root): 미지수 하나인 방정식의 해 집합에 값이 있으면 통과(첫 해가 아니어도)', () => {
  const r = runVerify([
    { ...root, eq: 'x**2=4', value: '-2' },
    { ...root, eq: '3*t+1000=13000', value: '4000' },
    { ...root, eq: 'x**2=2', value: '-1.41', digits: 2 },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, it] of [
  ['해가 아님', { eq: 'x**2=4', value: '3' }],
  ['미지수가 둘', { eq: 'x+y=4', value: '2' }],
  ['근삿값이 어느 해와도 안 맞음', { eq: 'x**2=2', value: '1.42', digits: 2 }],
] as const) {
  test(`실패해야 함(root): ${name}`, () => {
    const r = runVerify([{ ...root, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}

// 요청 36: 검산식 안의 정수끼리 나눗셈(2**5*2**3/2**4)이 파이썬 실수(16.0)가 되어 정수 답과 어긋나던 것.
// 정수 ÷ 정수만 분수로 읽는다 — 소수(0.5)나 sympy 값의 나눗셈은 원래대로
test('정수끼리 나눗셈은 분수로 읽는다(한 줄·여러 줄 모두)', () => {
  const r = runVerify([
    { ...base, answer: '16', answerType: 'int', check: '2**5*2**3/2**4' },
    { ...base, answer: '7/2', answerType: 'fraction', check: '(3+4)/2' },
    { ...base, answer: '0', answerType: 'fraction', check: '(-3+3)/2' },
    { ...base, answer: '1/3', answerType: 'fraction', check: 'a = 1\nb = 3\nans = a/b' },
    { ...base, answer: '3', answerType: 'int', check: 'int(10/3)' },
    { ...base, answer: '3', answerType: 'int', check: 'sum(1 for k in range(9) if k % 3 == 0)' },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('실패해야 함: 분수로 읽어도 답이 다르면', () => {
  const r = runVerify([{ ...base, answer: '3', answerType: 'int', check: '7/2' }]);
  assert.equal(r.status, 1, r.stdout);
});

test('많은 항목은 나눠 동시에 검산해도 결과(합계·실패 목록)가 같다', () => {
  const items = Array.from({ length: 400 }, (_, i) => ({
    unit: `u${i % 7}`,
    ref: `u${i % 7}/p${i}`,
    answer: String(i * 2),
    answerType: 'int',
    check: `${i}*2`,
  }));
  items[123] = { ...items[123], answer: '1' } as (typeof items)[number];
  const r = runVerify(items);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /합계: 399 \/ 400/);
  assert.match(r.stdout, /실패 1건:\n {2}- u4\/p123: 검산값 246 ≠ 답 1/);
});

// 부품 목표 판정(goal): 끌기·슬라이더로 닿는 모든 상태에서 앱이 '닿았다'고 본 상태 번호가 sympy 판정과 같은가
const goal = { unit: 'u', ref: 'u/lesson:g:목표', kind: 'goal' };
const cs = Array.from({ length: 10 }, (_, k) => ({ c: String(k - 2) }));
const quarters = Array.from({ length: 9 }, (_, k) => ({ pt_R_x: `${k}/4` }));

test('목표 판정(goal): 실근 개수·허용 오차·다른 읽는 값과 견주기', () => {
  const r = runVerify([
    // x²−4x+c 의 서로 다른 실근이 하나 = c=4 (상태 번호 6)
    {
      ...goal,
      of: [{ expr: 'x**2-4*x+c', roots: true }],
      targets: [['1']],
      tol: '0',
      states: cs,
      hits: [[6]],
      need: 1,
    },
    // 무리수 목표: √3 에 1/8 안으로 닿는 자리는 7/4 하나뿐
    {
      ...goal,
      of: [{ expr: 'pt_R_x' }],
      targets: [['sqrt(3)']],
      tol: '1/8',
      states: quarters,
      hits: [[7]],
      need: 1,
    },
    // 여러 곳 가 보기 + 다른 상태 기호와 견주기(R 의 접선 기울기 = 평균 기울기 3 → x=1)
    {
      ...goal,
      of: [{ expr: 'diff(x**3,x).subs(x,pt_R_x)' }],
      targets: [['(8-(-1))/(2-(-1))'], ['0']],
      tol: '0',
      states: quarters,
      hits: [[4], [0]],
      need: 1,
    },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, it] of [
  [
    '앱 판정이 sympy 와 다름',
    { of: [{ expr: 'x**2-4*x+c', roots: true }], targets: [['1']], states: cs, hits: [[5]] },
  ],
  [
    '닿을 수 없는 목표',
    { of: [{ expr: 'x**2-4*x+c', roots: true }], targets: [['3']], states: cs, hits: [[]] },
  ],
  [
    '허용 오차 안의 자리가 둘(정답 자리가 하나가 아님)',
    {
      of: [{ expr: 'pt_R_x' }],
      targets: [['sqrt(3)']],
      tol: '1/2',
      states: quarters,
      hits: [[6, 7, 8]],
    },
  ],
] as const) {
  test(`실패해야 함(goal): ${name}`, () => {
    const r = runVerify([{ ...goal, tol: '0', need: 1, ...it }]);
    assert.equal(r.status, 1, r.stdout);
  });
}

test('목표 판정(goal): 곡선 식의 소수는 분수로 읽는다(0.1·3 이 3/10 과 정확히 같게)', () => {
  // 앱은 소수 계수를 분수로 정확히 계산한다(expr.ts evalExact). sympy 가 소수를 실수(Float)로 읽으면
  // 0.1·3 = 0.30000000000000004 가 되어 앱과 다른 판정을 낸다
  const r = runVerify([
    {
      ...goal,
      of: [{ expr: '0.1*pt_R_x' }],
      targets: [['3/10']],
      tol: '0',
      states: [{ pt_R_x: '3' }, { pt_R_x: '2' }],
      hits: [[0]],
      need: 1,
    },
    {
      ...goal,
      of: [{ expr: '0.5*x**2-0.5*c', roots: true }],
      targets: [['1']],
      tol: '0',
      states: [{ c: '0' }, { c: '1' }],
      hits: [[0]],
      need: 1,
    },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
