import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CountParams,
  cDone,
  cInit,
  cLabel,
  countDef,
  cPascal,
  cTap,
  cTotal,
  cTree,
  cVenn,
} from '../src/lesson/widgets/count.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => countDef.parse(raw) as CountParams;
const LIST = parse({ mode: 'list', items: ['A', 'B', 'C'], k: 2 });
const PICK = parse({ mode: 'pick', items: ['A', 'B', 'C'], k: 2 });
const REP = parse({ mode: 'repeat', items: ['앞', '뒤'], k: 3 });

const taps = (p: CountParams, seq: number[]) => {
  let s = cInit(p);
  const res: string[] = [];
  for (const i of seq) {
    const r = cTap(p, s, i);
    s = r.s;
    res.push(r.res);
  }
  return { s, res };
};

test('나열(순서 O): 같은 것을 두 번 고를 수 없고, 같은 순서는 중복', () => {
  assert.equal(cTotal(LIST), 6);
  const { s, res } = taps(LIST, [0, 1, 1, 0, 0, 0, 1]);
  assert.deepEqual(res, ['add', 'new', 'add', 'new', 'add', 'skip', 'dup']);
  assert.deepEqual(
    s.found.map((f) => cLabel(LIST, f)),
    ['AB', 'BA'],
  );
  assert.equal(cDone(LIST, s), false);
  const all = taps(LIST, [0, 1, 1, 0, 0, 2, 2, 0, 1, 2, 2, 1]);
  assert.equal(cDone(LIST, all.s), true);
});

test('고르기(순서 X): 고른 순서가 달라도 같은 경우', () => {
  assert.equal(cTotal(PICK), 3);
  const { res } = taps(PICK, [0, 1, 1, 0]);
  assert.deepEqual(res, ['add', 'new', 'add', 'dup']);
});

test('중복(순서 O, 같은 것 여러 번)', () => {
  assert.equal(cTotal(REP), 8);
  const { s, res } = taps(REP, [0, 0, 1]);
  assert.deepEqual(res, ['add', 'add', 'new']);
  assert.equal(cLabel(REP, s.found[0] as string), '앞 → 앞 → 뒤');
});

test('수형도: 단계마다 가지가 펼쳐지고 끝 가지 수가 경우의 수', () => {
  const T = parse({ mode: 'tree', items: ['A', 'B', 'C'], k: 2 });
  const t = cTree(T);
  assert.equal(t.leaves, 6);
  assert.equal(t.levels.length, 2);
  assert.equal(t.levels[1]?.length, 6);
  assert.equal(cDone(T, { ...cInit(T), open: 2 }), true);
});

test('파스칼 삼각형: 위 두 수의 합', () => {
  assert.deepEqual(cPascal(4).at(-1), [1, 4, 6, 4, 1]);
  const P = parse({ mode: 'pascal', rows: 4 });
  const s = cInit(P);
  assert.equal(cDone(P, s), false);
  assert.equal(cDone(P, { ...s, rev: [true, true, true, true, true] }), true);
});

test('벤 다이어그램: 영역별 원소와 합집합 수', () => {
  const V = parse({
    mode: 'venn',
    sets: { names: ['수학', '과학'], a: ['가', '나', '다', '라'], b: ['다', '라', '마'] },
  });
  const v = cVenn(V);
  assert.deepEqual(v.only.a, ['가', '나']);
  assert.deepEqual(v.both, ['다', '라']);
  assert.deepEqual(v.only.b, ['마']);
  assert.equal(v.union, 5);
});

test('검산 항목이 sympy 를 통과하고, 값을 망가뜨리면 실패한다', () => {
  const ps = [
    LIST,
    PICK,
    REP,
    parse({ mode: 'tree', items: ['A', 'B', 'C'], k: 2, repeat: true }),
    parse({ mode: 'pascal', rows: 5 }),
    parse({ mode: 'venn', sets: { names: ['A', 'B'], a: ['1', '2', '3'], b: ['3', '4'] } }),
  ];
  for (const p of ps) {
    const r = runChecks(countDef.checks(p));
    assert.ok(r.ok, r.out);
  }
  assert.equal(runChecks(tamper(countDef.checks(LIST))).ok, false);
});

test('parse: 모르는 칸·k 범위·모드에 맞지 않는 칸은 오류', () => {
  assert.throws(() => parse({ mode: 'list', items: ['A', 'B'], k: 2, z: 1 }), /모르는 칸/);
  assert.throws(() => parse({ mode: 'list', items: ['A', 'B'], k: 3 }), /k/);
  assert.throws(() => parse({ mode: 'pascal', rows: 4, items: ['A'] }), /모르는 칸/);
  assert.throws(() => parse({ mode: 'list', items: ['A', 'A'], k: 1 }), /중복/);
  // 경우가 너무 많으면 손으로 다 찾을 수 없다
  assert.throws(() => parse({ mode: 'repeat', items: ['1', '2', '3', '4'], k: 3 }), /많/);
});
