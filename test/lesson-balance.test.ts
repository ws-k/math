import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type BalanceParams,
  type BalanceState,
  balanceDef,
  coinOf,
  eqSym,
  heavier,
  initial,
  layout,
  type Move,
  move,
  reachable,
  solutionOf,
  talk,
  tiltDeg,
  view,
} from '../src/lesson/widgets/balance.ts';
import { runChecks, tamper } from './widget-verify.ts';

// m1-linear-eq 의 저울: 커피 3잔 + 쿠키 1,000원 = 13,000원
const P: BalanceParams = {
  unit: '원',
  left: { x: 3, c: 1000 },
  right: { c: 13000 },
  intro: '쿠키 값부터 덜어 내 볼까요?',
  ops: [
    { op: 'sub', value: 1000, side: 'both', say: '수평 그대로. 커피 {{a}}잔 = {{c}}원.' },
    { op: 'div', value: 3, side: 'both', say: '$x = {{x}}$' },
    { op: 'sub', value: 1000, side: 'left', say: '기울었어요!', undo: '다시 수평이에요.' },
  ],
};
// e-proportion 의 저울: 4x = 60(빼기 없이 나누기만)
const Q: BalanceParams = {
  unit: '개',
  left: { x: 4, c: 0 },
  right: { c: 60 },
  intro: '외항의 곱과 내항의 곱',
  ops: [
    { op: 'div', value: 4, side: 'both', say: '$x = {{x}}$' },
    { op: 'div', value: 4, side: 'left', say: '기울었어요!', undo: '다시 수평.' },
  ],
};

const off = (side: 'l' | 'r', bundle = false): Move => ({ side, dir: 'off', bundle });
const on = (side: 'l' | 'r', bundle = false): Move => ({ side, dir: 'on', bundle });
/** 차례로 옮긴다. 막힌 움직임이면 테스트 실패 */
function run(p: BalanceParams, s: BalanceState, ...ms: Move[]): BalanceState {
  return ms.reduce((cur, m) => {
    const n = move(p, cur, m);
    assert.ok(n, `막힘: ${JSON.stringify(m)} @ ${JSON.stringify(cur)}`);
    return n;
  }, s);
}
const counts = (s: BalanceState) => [s.cups, s.l, s.r];

test('무게를 낱개로: 동전 하나 = 1,000원, 컵 하나 = 해(4,000원)', () => {
  assert.equal(coinOf(P), 1000);
  assert.equal(solutionOf(P), 4000);
  assert.deepEqual(initial(P), { cups: 3, l: 1, r: 13, split: null });
  // 나누기 몫(15)까지 낱개로 나타낼 수 있게 동전 크기를 잡는다
  assert.equal(coinOf(Q), 15);
});

test('왼쪽만 1,000 내리면 왼쪽이 올라가고 식이 ≠ — 실수가 아니라 과정이라 그대로 남는다', () => {
  const s = run(P, initial(P), off('l'));
  assert.deepEqual(counts(s), [3, 0, 13]);
  assert.equal(heavier(P, s), -1);
  assert.equal(view(P, s).tex, '3x\\neq 13000');
  // 오른쪽이 무거우면 막대가 시계 방향(양수)으로 돈다
  assert.ok(tiltDeg(P, s) > 0);
});

test('오른쪽도 내리면 수평, 3x=12000 — 그리고 컵만 남아 세 묶음으로 나뉜다', () => {
  const s = run(P, initial(P), off('l'), off('r'));
  assert.deepEqual(counts(s), [3, 0, 12]);
  assert.equal(heavier(P, s), 0);
  assert.equal(tiltDeg(P, s), 0);
  assert.equal(view(P, s).tex, '3x=12000');
  assert.equal(s.split, 12);
  const lay = layout(P, s);
  assert.deepEqual(
    lay.pan.r.map((i) => i.n),
    [4, 4, 4],
  );
  assert.deepEqual(
    lay.pan.l.map((i) => i.kind),
    ['cup', 'cup', 'cup'],
  );
});

test('순서는 자유: 오른쪽부터 내려도 같은 수평에 닿는다', () => {
  const s = run(P, initial(P), off('r'), off('l'));
  assert.deepEqual(counts(s), [3, 0, 12]);
});

test('나누기: 양쪽에서 세 묶음 중 두 묶음씩 내리면 x 하나 = 4,000원', () => {
  const base = run(P, initial(P), off('l'), off('r'));
  const one = run(P, base, off('l', true));
  assert.equal(heavier(P, one), -1);
  const s = run(P, base, off('l', true), off('l', true), off('r', true), off('r', true));
  assert.deepEqual(counts(s), [1, 0, 4]);
  const v = view(P, s);
  assert.equal(v.solved, true);
  assert.equal(v.tex, 'x=4000');
  assert.equal(v.vars.x, '4000');
  // 내린 것은 바닥에: 왼쪽 동전 1 + 컵 2, 오른쪽 동전 1 + 묶음 2(4개씩)
  const lay = layout(P, s);
  assert.deepEqual(
    lay.floor.l.map((i) => [i.kind, i.n]),
    [
      ['cup', 1],
      ['cup', 1],
      ['coin', 1],
    ],
  );
  assert.deepEqual(
    lay.floor.r.map((i) => i.n),
    [4, 4, 1],
  );
});

test('막힌 움직임: 낱개 단계의 컵, 마지막 컵, 묶음 중의 낱개', () => {
  const s0 = initial(P);
  // 무게를 모르는 컵은 낱개로 못 내린다(나누기 묶음일 때만)
  assert.equal(move(P, s0, off('l', true)), null);
  assert.equal(
    layout(P, s0)
      .pan.l.filter((i) => i.kind === 'cup')
      .every((i) => i.move === null),
    true,
  );
  // 없는 것은 못 올린다
  assert.equal(move(P, s0, on('r')), null);
  const base = run(P, s0, off('l'), off('r'));
  const last = run(P, base, off('l', true), off('l', true));
  assert.equal(move(P, last, off('l', true)), null);
  // 묶음을 하나라도 내린 동안엔 바닥의 낱개 동전을 못 올린다
  const mid = run(P, base, off('r', true));
  assert.equal(move(P, mid, on('r')), null);
  // 묶음이 다 올라가 있으면 낱개를 올릴 수 있고, 그러면 묶음이 풀린다
  const back = run(P, base, on('r'));
  assert.deepEqual(counts(back), [3, 0, 13]);
  assert.equal(back.split, null);
});

test('빼기가 없는 저울(4x=60)은 처음부터 네 묶음', () => {
  const s0 = initial(Q);
  assert.deepEqual(s0, { cups: 4, l: 0, r: 4, split: 4 });
  const s = run(Q, s0, off('l', true), off('l', true), off('l', true));
  assert.equal(heavier(Q, s), -1);
  const done = run(Q, s, off('r', true), off('r', true), off('r', true));
  assert.equal(view(Q, done).solved, true);
  assert.equal(view(Q, done).vars.x, '15');
});

test('기울기: 무게 차이가 클수록 더 기울고, 상한이 있다', () => {
  const s0 = initial(P);
  const a = tiltDeg(P, run(P, s0, off('l')));
  const b = tiltDeg(P, run(P, s0, off('l'), off('r', false), on('r')));
  assert.equal(a, b);
  const many = run(P, s0, off('r'), off('r'), off('r'), off('r'));
  // 왼쪽이 무거우면 반시계(음수), 더 많이 뺐으니 더 크게
  assert.ok(tiltDeg(P, many) < 0);
  assert.ok(Math.abs(tiltDeg(P, many)) > Math.abs(a));
  const all = run(P, s0, ...Array.from({ length: 13 }, () => off('r')));
  assert.ok(Math.abs(tiltDeg(P, all)) <= 14);
});

test('안내 글: 한쪽만 → 그 연산의 say, 되돌려 놓으면 undo, 양쪽 → say, 그 밖은 없음(null)', () => {
  const s0 = initial(P);
  const left = run(P, s0, off('l'));
  assert.deepEqual(talk(P, s0, s0, left), { text: '기울었어요!', tone: '' });
  assert.deepEqual(talk(P, s0, left, s0), { text: '다시 수평이에요.', tone: '' });
  const level = run(P, left, off('r'));
  assert.deepEqual(talk(P, s0, left, level), {
    text: '수평 그대로. 커피 {{a}}잔 = {{c}}원.',
    tone: 'ok',
  });
  // 오른쪽만 내린 상태는 연산 목록에 없으니 부품의 기본 글(null)
  assert.equal(talk(P, s0, s0, run(P, s0, off('r'))), null);
  // 번갈아 내려 중간 수평(2x=8000)을 거쳐 x 하나에 닿아도 목표 글
  const two = run(P, level, off('l', true), off('r', true));
  assert.equal(talk(P, level, run(P, level, off('l', true)), two), null);
  const done = run(P, two, off('l', true), off('r', true));
  assert.deepEqual(talk(P, two, run(P, two, off('l', true)), done), {
    text: '$x = {{x}}$',
    tone: 'ok',
  });
});

test('끌기로 닿는 상태 목록: 낱개 단계 28 + 묶음 단계에서 새로 8(컵 2·1개 × 오른쪽 12·8·4·0)', () => {
  const all = reachable(P);
  assert.equal(all.length, 28 + 8);
  assert.equal(new Set(all.map((s) => eqSym(P, s))).size, all.length);
});

test('checks: 닿는 모든 상태 — 수평은 처음 식과 해가 같고, 기운 쪽은 해를 넣어 확인, 그리고 목표 해', () => {
  const cs = balanceDef.checks(P);
  assert.equal(cs.length, reachable(P).length - 1 + 1);
  assert.deepEqual(
    cs.find((c) => c.name === '수평 3*x=12000'),
    {
      name: '수평 3*x=12000',
      kind: 'equiv',
      before: '3*x+1000=13000',
      after: '3*x=12000',
      expect: true,
    },
  );
  assert.deepEqual(
    cs.find((c) => c.name === '기욺 3*x=13000'),
    {
      name: '기욺 3*x=13000',
      answer: '-1',
      answerType: 'int',
      check: 'sign((3*x)-(13000)).subs(x, solve(Eq(3*x+1000, 13000), x)[0])',
    },
  );
  assert.deepEqual(
    cs.find((c) => c.name === '해'),
    {
      name: '해',
      answer: '4000',
      answerType: 'int',
      check: 'solve(Eq(3*x+1000, 13000), x)[0]',
    },
  );
});

test('checks 를 sympy 로 실제 검산(세 단원 매개변수) — 값을 망가뜨리면 실패', () => {
  const S: BalanceParams = {
    unit: '원',
    left: { x: 3, c: 200 },
    right: { c: 1400 },
    intro: '200원부터',
    ops: [
      { op: 'sub', value: 200, side: 'both', say: '수평' },
      { op: 'div', value: 3, side: 'both', say: '$x = {{x}}$' },
      { op: 'sub', value: 200, side: 'left', say: '기울', undo: '수평' },
    ],
  };
  const cs = [P, Q, S].flatMap((p, i) =>
    balanceDef.checks(p).map((c) => ({ ...c, name: `${i}:${c.name}` })),
  );
  const ok = runChecks(cs);
  assert.ok(ok.ok, ok.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('parse: 형식 오류', () => {
  assert.doesNotThrow(() => balanceDef.parse(P));
  assert.doesNotThrow(() => balanceDef.parse(Q));
  const bad = (f: (p: BalanceParams) => void) => {
    const p = structuredClone(P);
    f(p);
    return () => balanceDef.parse(p);
  };
  assert.throws(bad((p) => (p.left.x = 0)));
  assert.throws(bad((p) => ((p as unknown as Record<string, unknown>).relation = '<')));
  assert.throws(bad((p) => delete (p.ops[2] as { undo?: string }).undo));
  // 끌기 저울은 덜기·나누기만(더하기·곱하기는 저울 밖에서 물건을 가져와야 해서)
  assert.throws(bad((p) => ((p.ops[0] as { op: string }).op = 'add')));
  // 나누기는 컵 수로만(컵 하나를 남기는 나누기)
  assert.throws(bad((p) => ((p.ops[1] as { value: number }).value = 2)));
  // 해가 자연수가 아니면 무게로 못 나타낸다
  assert.throws(bad((p) => (p.right.c = 13001)));
  // 동전이 너무 많으면 접시에 다 못 올린다
  assert.throws(bad((p) => (p.right.c = 100000)));
  // 끌어서 x 하나만 남길 수 없으면(나누기 없음) 오류
  assert.throws(bad((p) => p.ops.splice(1, 1)));
  // 같은 연산 두 번
  assert.throws(bad((p) => p.ops.push(structuredClone(p.ops[0] as BalanceParams['ops'][0]))));
  // 단위는 비워도 된다(단위 없는 비례식)
  assert.doesNotThrow(bad((p) => (p.unit = '')));
});

test('화면 식과 검산 식이 같은 eqSym 에서 나온다', () => {
  const s0 = initial(P);
  assert.equal(eqSym(P, s0), '3*x+1000=13000');
  assert.equal(view(P, s0).tex, '3x+1000=13000');
  assert.equal(balanceDef.equation?.(P), '3*x+1000=13000');
  assert.deepEqual(view(P, s0).vars, { a: '3', b: '1,000', c: '13,000', x: '13000' });
});
