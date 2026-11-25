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

// 2-마 기호 1차. 기호마다 "틀린 식은 성립 안 함 · 고친 식은 성립" 하는 짝(통과)과, 그 판정이 뒤집힌 짝(실패)을 둔다.
// sympy 를 한 번만 띄우려고 실패 짝도 한 번에 넣고, ref 마다 실패 목록에 이름이 오르는지 본다.
const SPOT_OK: [string, object][] = [
  [
    '부등호 < >(수끼리, 부등호가 틀린 곳)',
    { mode: 'identity', wrong: '2/3>3/4', fixed: '2/3<3/4' },
  ],
  [
    '부등호 ≥(미지수 하나, 모든 실수에서 성립)',
    { mode: 'identity', wrong: 'x**2>=2*x', fixed: 'x**2+1>=2*x' },
  ],
  [
    '부등호: 음수로 나누고 방향을 안 바꿈(해 집합 비교)',
    { mode: 'equivalent', from: '-2*x<6', wrong: 'x<-3', fixed: 'x>-3' },
  ],
  ['부등호 ≤', { mode: 'equivalent', from: '-3*x>=9', wrong: 'x>=-3', fixed: 'x<=-3' }],
  ['÷', { mode: 'identity', wrong: '(3/4)÷(2/5)=(3/4)*(2/5)', fixed: '(3/4)÷(2/5)=(3/4)*(5/2)' }],
  [
    '등식 아닌 식(보이는 식에서 바꿈)',
    { mode: 'value', from: '(3/4)÷(2/5)', wrong: '(3/4)*(2/5)', fixed: '(3/4)*(5/2)' },
  ],
  [
    '등식 아닌 식(숨은 검산식)',
    { mode: 'value', check: 'lcm(24, 36)', wrong: '2*2*3', fixed: '2*2*3*2*3' },
  ],
  [
    '계승 !',
    {
      mode: 'identity',
      wrong: 'factorial(5)/factorial(3)=factorial(2)',
      fixed: 'factorial(5)/factorial(3)=20',
    },
  ],
  ['조합 C', { mode: 'identity', wrong: 'binomial(6,3)=ff(6,3)', fixed: 'binomial(6,3)=20' }],
  ['순열 P(문자)', { mode: 'identity', wrong: 'ff(n,2)=n**2', fixed: 'ff(n,2)=n*(n-1)' }],
  ['∑', { mode: 'identity', wrong: 'Sum(2*k,(k,1,n))=n**2', fixed: 'Sum(2*k,(k,1,n))=n*(n+1)' }],
  [
    '∫ 정적분',
    { mode: 'identity', wrong: 'Integral(x**2,(x,0,3))=27', fixed: 'Integral(x**2,(x,0,3))=9' },
  ],
  [
    '∫ 부정적분: 적분상수 C 를 빠뜨림',
    { mode: 'identity', wrong: 'Integral(x**3,x)=x**4/4', fixed: 'Integral(x**3,x)=x**4/4+C' },
  ],
  [
    '∫ 부정적분: 원시함수가 틀림',
    { mode: 'identity', wrong: 'Integral(x**3,x)=x**4+C', fixed: 'Integral(x**3,x)=x**4/4+C' },
  ],
  ['lim', { mode: 'identity', wrong: 'Limit(sin(x)/x,x,0)=0', fixed: 'Limit(sin(x)/x,x,0)=1' }],
  [
    // 화면의 x→0 은 양쪽 극한 — sympy 기본(오른쪽)으로 읽으면 틀린 식이 성립해 버린다
    'lim: 양쪽 극한이 없으면 한쪽 극한으로',
    { mode: 'identity', wrong: 'Limit(Abs(x)/x,x,0)=1', fixed: "Limit(Abs(x)/x,x,0,'+')=1" },
  ],
  ['lim x→∞', { mode: 'identity', wrong: 'Limit(1/x,x,oo)=1', fixed: 'Limit(1/x,x,oo)=0' }],
  ['소수(정확히 분수로)', { mode: 'identity', wrong: '0.1+0.2=0.03', fixed: '0.1+0.2=0.3' }],
  [
    // 글자 그대로의 분수로 읽어 0.1+0.2 와 0.30000000000000004 를 다른 수로 본다(부동소수 근삿값에 기대지 않게)
    '소수: 아주 조금 다른 수',
    { mode: 'identity', wrong: '0.1+0.2=0.30000000000000004', fixed: '0.1+0.2=3/10' },
  ],
  // ---- 검토 반영(M2~M4·m7) ----
  [
    '∫: ln|x| (실수 변수로 미분)',
    { mode: 'identity', wrong: 'Integral(1/x,x)=log(x)', fixed: 'Integral(1/x,x)=log(Abs(x))+C' },
  ],
  [
    '∫: 거듭제곱 공식(문자 n)',
    {
      mode: 'identity',
      wrong: 'Integral(x**n,x)=x**(n+1)+C',
      fixed: 'Integral(x**n,x)=x**(n+1)/(n+1)+C',
    },
  ],
  [
    '무한대끼리는 같은 무한대인지로',
    { mode: 'identity', wrong: 'Limit(1/x**2,x,0)=0', fixed: 'Limit(1/x**2,x,0)=oo' },
  ],
  [
    'lim: 진동해서 없는 극한(AccumBounds)',
    { mode: 'identity', wrong: 'Limit(sin(1/x),x,0)=0', fixed: 'Limit(x*sin(1/x),x,0)=0' },
  ],
  [
    'lim: 없는 극한에 0 을 곱해도 없음',
    { mode: 'identity', wrong: 'Limit(Abs(x)/x,x,0)*0=0', fixed: "Limit(Abs(x)/x,x,0,'+')*0=0" },
  ],
  [
    'lim: 양쪽 극한이 다른 무한대면 없음',
    { mode: 'identity', wrong: 'Limit(1/x,x,0)=oo', fixed: "Limit(1/x,x,0,'+')=oo" },
  ],
  [
    'lim: 극한점이 π/2',
    { mode: 'identity', wrong: 'Limit(tan(x),x,pi/2)=oo', fixed: "Limit(tan(x),x,pi/2,'-')=oo" },
  ],
];

test('틀린 곳 찾기 기호 1차: 틀린 식은 성립 안 함 · 고친 식은 성립', () => {
  const r = runVerify(SPOT_OK.map(([n, it]) => ({ ...spot, ref: `u/lesson:ok:${n}`, ...it })));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

const SPOT_BAD: [string, object][] = [
  ['부등호: 틀린 식이 사실은 참', { mode: 'identity', wrong: '2/3<3/4', fixed: '2/3<3/4' }],
  ['부등호: 고친 식이 거짓', { mode: 'identity', wrong: '2/3>3/4', fixed: '2/3>=3/4' }],
  [
    '부등호: 틀린 식의 해 집합이 같음',
    { mode: 'equivalent', from: '-2*x<6', wrong: '-x<3', fixed: 'x>-3' },
  ],
  ['부등호: 미지수 둘은 판정 안 함', { mode: 'identity', wrong: 'a>b', fixed: 'a**2+b**2>=2*a*b' }],
  ['부등호 둘', { mode: 'identity', wrong: '1<2<3', fixed: '1<2' }],
  ['÷: 고친 식이 틀림', { mode: 'identity', wrong: '6÷2=2', fixed: '6÷2*3=1' }],
  [
    '등식 아닌 식: 틀린 식의 값이 같음',
    { mode: 'value', from: '(3/4)÷(2/5)', wrong: '(3/4)*(5/2)', fixed: '(3/4)*(5/2)' },
  ],
  [
    '등식 아닌 식: 고친 식의 값이 다름',
    { mode: 'value', check: 'lcm(24, 36)', wrong: '2*2*3', fixed: '2*2*3*3' },
  ],
  ['등식 아닌 식에 등호', { mode: 'value', check: '72', wrong: '2*2*3=12', fixed: '72' }],
  [
    '등식 아닌 식: from·check 둘 다',
    { mode: 'value', from: '72', check: '72', wrong: '12', fixed: '72' },
  ],
  [
    '조합: 고친 식이 틀림',
    { mode: 'identity', wrong: 'binomial(6,3)=120', fixed: 'binomial(6,3)=ff(6,3)' },
  ],
  [
    '∑: 고친 식이 틀림',
    { mode: 'identity', wrong: 'Sum(k,(k,1,n))=n', fixed: 'Sum(k,(k,1,n))=n**2/2' },
  ],
  [
    '∫: 고친 식에 C 가 없음',
    { mode: 'identity', wrong: 'Integral(x**3,x)=x**4', fixed: 'Integral(x**3,x)=x**4/4' },
  ],
  [
    'lim: 양쪽 극한이 없는데 고친 식으로',
    { mode: 'identity', wrong: 'Limit(Abs(x)/x,x,0)=0', fixed: 'Limit(Abs(x)/x,x,0)=1' },
  ],
  [
    '소수: 부동소수 오차 수를 고친 식으로',
    { mode: 'identity', wrong: '0.1+0.2=0.03', fixed: '0.1+0.2=0.30000000000000004' },
  ],
  // ---- 검토 반영: '증명 못 함'을 '틀림'으로 넘기지 않는다(M2~M4·m7) ----
  [
    '∫: 부정적분에 x 를 곱한 식(미분해도 적분이 남음)',
    { mode: 'identity', wrong: 'x*Integral(1,x)=x+C', fixed: 'x*Integral(1,x)=x**2+C' },
  ],
  [
    '∫: 부정적분이 든 부등식',
    { mode: 'identity', wrong: 'Integral(2*x,x)<0', fixed: 'Integral(2*x,x)>=0' },
  ],
  [
    '부등호: 참인데 sympy 가 풀지 못함(ConditionSet) — 틀린 식으로 넘기지 않음',
    { mode: 'identity', wrong: 'Abs(x+1)<=Abs(x)+1', fixed: 'x**2>=0' },
  ],
  [
    '부등호: 정의되는 곳에서는 늘 참 — 반례 없음',
    { mode: 'identity', wrong: '1/x**2>0', fixed: 'x**2>=0' },
  ],
  [
    '부등호: 문자 n 의 계승(자연수 문맥은 판정 안 함)',
    { mode: 'identity', wrong: 'factorial(n)>=n', fixed: 'factorial(n)>0' },
  ],
  [
    // ff(n,2) 는 읽자마자 n(n−1) 로 풀려 식 구조로는 못 알아본다 — 글자로 막는다
    '부등호: 문자 n 의 순열(읽자마자 풀리는 ff)',
    { mode: 'identity', wrong: 'ff(n,2)<0', fixed: 'ff(n,2)>=0' },
  ],
  [
    '부등호(equivalent): sympy 가 풀지 못함',
    { mode: 'equivalent', from: 'E**x>=x+1', wrong: 'x>0', fixed: 'E**x-x>=1' },
  ],
  ['equivalent: 미지수가 다름', { mode: 'equivalent', from: '2*x<6', wrong: 'x>3', fixed: 'y<3' }],
  [
    // sympy 1.14 는 왼쪽 극한을 ∞ 로 낸다(실제 0) — 수치로 대 보아 어긋나면 판정하지 않는다
    'lim: sympy 가 틀린 한쪽 극한(수치와 어긋남)',
    { mode: 'identity', wrong: "Limit(2**(1/x),x,0,'-')=oo", fixed: "Limit(2**(1/x),x,0,'-')=0" },
  ],
  [
    'lim: 양쪽 극한인데 한쪽을 sympy 가 틀림',
    { mode: 'identity', wrong: 'Limit(2**(-1/x),x,0)=1', fixed: 'Limit(2**(-1/x),x,0)=0' },
  ],
  [
    'lim: 한쪽이 실수 밖(√) — 한쪽 극한으로 적어야',
    { mode: 'identity', wrong: 'Limit(sqrt(x),x,0)=1', fixed: 'Limit(sqrt(x),x,0)=0' },
  ],
  [
    'lim: 없는 극한끼리 빼도 0 이 아님',
    {
      mode: 'identity',
      wrong: 'Limit(Abs(x)/x,x,0)=1',
      fixed: 'Limit(Abs(x)/x,x,0)-Limit(Abs(x)/x,x,0)=0',
    },
  ],
];

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('틀린 곳 찾기 기호 1차: 판정이 뒤집힌 짝은 하나하나 실패', () => {
  const r = runVerify(SPOT_BAD.map(([n, it]) => ({ ...spot, ref: `u/lesson:bad:${n}`, ...it })));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  for (const [n] of SPOT_BAD) assert.match(r.stdout, new RegExp(`lesson:bad:${reEscape(n)}:`), n);
  assert.match(r.stdout, new RegExp(`실패 ${SPOT_BAD.length}건`));
});

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

// 원 위 15° 간격 자리의 각: cos 값이 겹근호 식이라 sympy simplify 가 120 과 같음을 증명하지 못했다(요청 106 묶음).
// 고친 뒤에도 정말 다른 값은 같다고 하지 않아야 한다 — 30자리까지 같은 가까운 값으로 확인한다.
const onCircle = (d: string) => `Point(4 + 3*cos(rad(${d})), 4 + 3*sin(rad(${d})))`;
const [cA, cB, cC] = [onCircle('15'), onCircle('pt_B_d'), onCircle('135')];
const inscribed = `deg(acos((${cA} - ${cB}).dot(${cC} - ${cB}) / (${cA}.distance(${cB})*${cC}.distance(${cB}))))`;
const arcStates = ['45', '195', '300'].map((d) => ({ pt_B_d: d }));

test('목표 판정(goal): 겹근호로 나오는 각(120°·60°)과 근호 값도 정확히 같다고 본다', () => {
  const r = runVerify([
    {
      ...goal,
      of: [{ expr: inscribed }],
      targets: [['120'], ['60']],
      tol: '0',
      states: arcStates,
      hits: [[0], [1, 2]],
      need: 1,
    },
    // 겹근호 √(2+√3) 과 (√6+√2)/2
    {
      ...goal,
      of: [{ expr: 'sqrt(2+sqrt(3))*pt_R_x' }],
      targets: [['(sqrt(6)+sqrt(2))/2']],
      tol: '0',
      states: [{ pt_R_x: '1' }, { pt_R_x: '2' }],
      hits: [[0]],
      need: 1,
    },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const [name, target] of [
  // 30자리까지 같아 빠른 길(수치 비교)을 지나 기호 확인까지 가는 반례들
  ['유리수만큼 다른 값', '120 + 1/10**40'],
  ['근호만큼 다른 값', '120 + sqrt(2)/10**40'],
  ['cos 값이 아주 조금 다른 각', 'deg(acos(-1/2 + 1/10**40))'],
] as const) {
  test(`실패해야 함(goal): 겹근호 각과 ${name}을 같다고 하지 않음`, () => {
    const r = runVerify([
      {
        ...goal,
        of: [{ expr: inscribed }],
        targets: [[target]],
        tol: '0',
        states: arcStates,
        hits: [[0]],
        need: 1,
      },
    ]);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /앱 판정 \[\[0\]\] ≠ sympy 판정 \[\[\]\]/);
  });
}

// ---- 검토 지적(75896c3) 보강 ----

// 상태 기호를 차례로 넣으면 x/√(x²+y²) 에 x=0 이 먼저 들어가 0/|y| = 0 이 되고, 그다음 y=0 이 들어가도 0 으로 남아
// P 가 A 와 겹친 자리(각을 정할 수 없음)의 ∠PAB 가 90° 로 나왔다. 한꺼번에 넣어야 0/0 이 드러난다
test('목표 판정(goal): 상태 기호는 한꺼번에 대입(P 가 꼭짓점과 겹친 자리의 각은 정할 수 없음)', () => {
  const angle =
    'deg(acos((Point(pt_P_x, pt_P_y) - Point(0, 0)).dot(Point(10, 0) - Point(0, 0)) / (Point(pt_P_x, pt_P_y).distance(Point(0, 0))*Point(10, 0).distance(Point(0, 0)))))';
  const r = runVerify([
    {
      ...goal,
      of: [{ expr: angle }],
      targets: [['90']],
      tol: '0',
      states: [
        { pt_P_x: '0', pt_P_y: '0' },
        { pt_P_x: '0', pt_P_y: '3' },
      ],
      hits: [[1]],
      need: 1,
    },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// 각이 π 의 유리수배가 아니어도 합·차가 딱 떨어지는 경우(acos(3/5)+acos(4/5) = π/2): cos(차) = 1 을 대수적으로 보인다
test('같은 값: π 의 유리수배가 아닌 각들의 합도 정확히 같다고 보고, 아주 조금 다른 값은 아니라고 봄', () => {
  const ok = runVerify([
    {
      ...base,
      answer: 'pi/2',
      answerType: 'expr',
      check: 'acos(Rational(3,5))+acos(Rational(4,5))',
    },
    {
      ...base,
      answer: 'pi/4',
      answerType: 'expr',
      check: 'atan(Rational(1,2))+atan(Rational(1,3))',
    },
    {
      ...base,
      answer: '90',
      answerType: 'expr',
      check: 'deg(acos(3*sqrt(10)/10)) + deg(acos(sqrt(10)/10))',
    },
  ]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  for (const check of [
    'acos(Rational(3,5))+acos(Rational(4,5)) + Rational(1,10**40)',
    'acos(Rational(3,5))+acos(Rational(4,5)+Rational(1,10**40))',
  ]) {
    const r = runVerify([{ ...base, answer: 'pi/2', answerType: 'expr', check }]);
    assert.equal(r.status, 1, check + r.stdout);
  }
});

/** verify.py 의 함수를 직접 불러 결과를 찍는다(검산 항목으로는 앞 단계 simplify 가 먼저 붙잡혀 닿을 수 없는 경우) */
function runPy(code: string) {
  return spawnSync(
    '.venv/bin/python',
    [
      '-c',
      `import sys; sys.path.insert(0, 'verify')\nimport verify as V\nfrom sympy import *\n${code}`,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
}

test('최소다항식 차수가 상한을 넘으면 증명하지 않고 바로 실패(몇 분씩 붙잡히지 않게) — 까닭 글', () => {
  // 소수 여섯 개의 제곱근 합: 최소다항식이 128차라 sympy 가 90초 넘게 걸렸다(5개·64차는 3초)
  const r = runPy(
    `s = sum(sqrt(q) for q in [2,3,5,7,11,13])
try:
    print(V._exact_zero(sqrt(expand(s**2)) - s))
except V.ProofTooHard as e:
    print('TOO HARD', e)`,
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /TOO HARD .*차수/);
  // 차수 어림이 지나쳐 쉬운 증명을 막지 않음: π/7 족 sin 셋은 한 원분체 안이라 각각 곱해 어림하면 안 된다
  const ok = runVerify([
    {
      ...base,
      answer: 'sqrt(7)/8',
      answerType: 'expr',
      check: 'sin(pi/7)*sin(2*pi/7)*sin(3*pi/7)',
    },
  ]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test('목표 판정(goal): 증명이 너무 어려운 상태는 어느 상태인지 글로 실패', () => {
  const r = runPy(
    `s = '+'.join(f'sqrt({q})' for q in [2,3,5,7,11,13])
it = {'of': [{'expr': 'pt_R_x*0 + ' + s}], 'targets': [[s]], 'tol': '0', 'states': [{'pt_R_x': '1'}], 'hits': [[0]], 'need': 1}
_old = V.equal
V.equal = lambda a, b: (_ for _ in ()).throw(V.ProofTooHard('최소다항식 차수 상한'))
print(V.check_goal(it))`,
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /상태 0 .*pt_R_x.*차수/);
});

test('역삼각함수 하나를 증명하다 난 오류가 나머지 증명을 버리지 않음', () => {
  // acos(1/2 + sin(1)²+cos(1)²−1) 은 그 각 하나만 따로 보면 최소다항식을 못 구하지만(sin(1) 은 대수적 수가 아님)
  // 다른 각(겹근호 120°)을 π 의 분수배로 바꾼 뒤 simplify 가 정리할 수 있다
  const ins45 = inscribed.replaceAll('pt_B_d', '45');
  const r = runVerify([
    {
      ...base,
      answer: 'pi',
      answerType: 'expr',
      check: `acos(Rational(1,2) + sin(1)**2 + cos(1)**2 - 1) + (${ins45})*pi/180`,
    },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// equal 을 강화한 효과(겹근호 각을 정확히 같다고 봄)가 목표 판정 밖의 길에서도 맞게 드는가
test('같은 값 강화: 보기 중복·식 답·항등식(spot) 길', () => {
  const ins45 = inscribed.replaceAll('pt_B_d', '45');
  const ok = runVerify([
    { ...base, answer: '120', answerType: 'expr', check: ins45 },
    {
      ...base,
      answer: '2',
      answerType: 'choice',
      check: '120',
      choiceChecks: ['60', ins45, '90', '150', '30'],
    },
    { ...spot, mode: 'identity', wrong: `${ins45}=60`, fixed: `${ins45}=120` },
  ]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  for (const [name, it] of [
    // 겹근호 각 보기가 정답 120 과 같은 값 — 같은 값 보기가 둘
    [
      '보기 중복',
      {
        ...base,
        answer: '1',
        answerType: 'choice',
        check: '120',
        choiceChecks: ['120', ins45, '90', '150', '30'],
      },
    ],
    ['식 답이 다름', { ...base, answer: '60', answerType: 'expr', check: ins45 }],
    ['틀린 식이 사실은 항등식', { ...spot, mode: 'identity', wrong: `${ins45}=120`, fixed: '1=1' }],
  ] as const) {
    const r = runVerify([it]);
    assert.equal(r.status, 1, name + r.stdout);
  }
});
