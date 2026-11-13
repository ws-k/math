import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  apply,
  type BalanceParams,
  balanceDef,
  enabled,
  initial,
  opLabel,
  view,
} from '../src/lesson/widgets/balance.ts';

const P: BalanceParams = {
  unit: '원',
  left: { x: 3, c: 1000 },
  right: { c: 13000 },
  intro: '쿠키 값부터 덜어 내 볼까요?',
  ops: [
    { op: 'sub', value: 1000, side: 'both', say: '커피 {{a}}잔 = {{c}}원.' },
    { op: 'div', value: 3, side: 'both', say: '$x = {{x}}$' },
    { op: 'sub', value: 1000, side: 'left', say: '기울었어요!', undo: '되돌렸어요.' },
  ],
};
const [SUB, DIV, TRAP] = P.ops as [
  BalanceParams['ops'][0],
  BalanceParams['ops'][0],
  BalanceParams['ops'][0],
];

test('양쪽 연산은 수평 그대로, 한쪽만 하면 기운다', () => {
  const s0 = initial(P);
  assert.deepEqual(s0, { a: 3, b: 1000, c: 13000, tilt: 0 });
  assert.deepEqual(apply(s0, SUB), { a: 3, b: 0, c: 12000, tilt: 0 });
  assert.deepEqual(apply(apply(s0, SUB), DIV), { a: 1, b: 0, c: 4000, tilt: 0 });
  // 왼쪽이 가벼워지면 왼쪽 접시가 올라간다(음수 기울기)
  assert.deepEqual(apply(s0, TRAP), { a: 3, b: 0, c: 13000, tilt: -1 });
});

test('버튼 활성화: 덜어 낼 것이 있을 때만 빼기, 상수가 없고 나누어떨어질 때만 나누기, 기울면 모두 막힘', () => {
  const s0 = initial(P);
  assert.deepEqual(
    P.ops.map((o) => enabled(s0, o)),
    [true, false, true],
  );
  const s1 = apply(s0, SUB);
  assert.deepEqual(
    P.ops.map((o) => enabled(s1, o)),
    [false, true, false],
  );
  const s2 = apply(s1, DIV);
  assert.deepEqual(
    P.ops.map((o) => enabled(s2, o)),
    [false, false, false],
  );
  const t = apply(s0, TRAP);
  assert.deepEqual(
    P.ops.map((o) => enabled(t, o)),
    [false, false, false],
  );
});

test('버튼 글자는 연산과 값에서 만든다', () => {
  assert.deepEqual(P.ops.map(opLabel), ['양쪽 −1,000', '양쪽 ÷3', '왼쪽에서만 −1,000 해 보기']);
});

test('view: 식과 안내 글의 치환 값', () => {
  const s1 = apply(initial(P), SUB);
  assert.equal(view(initial(P)).tex, '3x+1000=13000');
  assert.equal(view(s1).tex, '3x=12000');
  assert.equal(view(apply(initial(P), TRAP)).tex, '3x\\neq 13000');
  assert.equal(view(apply(s1, DIV)).tex, 'x=4000');
  assert.deepEqual(view(s1).vars, { a: '3', b: '0', c: '12,000', x: '12000' });
  assert.equal(view(apply(s1, DIV)).solved, true);
});

test('checks: 닿을 수 있는 모든 버튼 연산의 전후 식(양쪽=동치, 한쪽=비동치)과 목표 해', () => {
  const cs = balanceDef.checks(P);
  assert.deepEqual(cs, [
    { name: '연산1', kind: 'equiv', before: '3*x+1000=13000', after: '3*x=12000', expect: true },
    { name: '연산2', kind: 'equiv', before: '3*x+1000=13000', after: '3*x=13000', expect: false },
    { name: '연산3', kind: 'equiv', before: '3*x=12000', after: 'x=4000', expect: true },
    {
      name: '해',
      answer: '4000',
      answerType: 'int',
      check: 'solve(Eq(3*x+1000, 13000), x)[0]',
    },
  ]);
});

test('parse: 형식 오류', () => {
  assert.doesNotThrow(() => balanceDef.parse(P));
  const bad = (f: (p: BalanceParams) => void) => {
    const p = structuredClone(P);
    f(p);
    return () => balanceDef.parse(p);
  };
  assert.throws(bad((p) => (p.left.x = 0)));
  assert.throws(bad((p) => ((p as unknown as Record<string, unknown>).relation = '<')));
  assert.throws(bad((p) => delete (p.ops[2] as { undo?: string }).undo));
  assert.throws(bad((p) => ((p.ops[1] as { value: number }).value = 0)));
  // 버튼으로 x 하나만 남길 수 없으면(목표에 닿지 못하면) 오류
  assert.throws(bad((p) => p.ops.splice(1, 1)));
});

test('화면 식과 검산 식이 같은 eqSym 에서 나온다', async () => {
  const { eqSym } = await import('../src/lesson/widgets/balance.ts');
  const s0 = initial(P);
  assert.equal(eqSym(s0), '3*x+1000=13000');
  assert.equal(view(s0).tex, '3x+1000=13000');
  assert.equal(view(apply(s0, TRAP)).tex, '3x\\neq 13000');
  assert.equal(balanceDef.equation?.(P), '3*x+1000=13000');
});
