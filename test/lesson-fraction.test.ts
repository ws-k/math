import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type FParams,
  fDone,
  fDraw,
  fInit,
  fit,
  fMerge,
  fractionDef,
  fTex,
  lcmIn,
} from '../src/lesson/widgets/fraction.ts';
import { q } from '../src/lesson/widgets/q.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => fractionDef.parse(raw) as FParams;
const ADD = parse({ shape: 'bar', mode: 'add', a: '1/2', b: '1/3', cut: { min: 2, max: 12 } });

test('다시 자르기: 칸 수가 분모의 배수일 때만 같은 크기 조각으로 셀 수 있다', () => {
  assert.deepEqual(fit(q('1/2'), null), { den: 2, n: 1, fits: true });
  assert.deepEqual(fit(q('1/2'), 6), { den: 6, n: 3, fits: true });
  assert.deepEqual(fit(q('1/3'), 4), { den: 3, n: 1, fits: false });
  assert.equal(lcmIn(ADD), 6);
});

test('덧셈: 크기가 다르면 합쳐지지 않고, 공통분모로 자르면 합쳐진다', () => {
  const s = fInit(ADD);
  assert.equal(s.d, null);
  assert.equal(fMerge(ADD, s).ok, false);
  assert.equal(fMerge(ADD, { ...s, d: 4 }).ok, false);
  const m = fMerge(ADD, { ...s, d: 6 });
  assert.equal(m.ok, true);
  assert.equal(m.s.merged, true);
  assert.equal(fDone(ADD, m.s), true);
  assert.equal(fTex(ADD, m.s), '\\frac{3}{6}+\\frac{2}{6}=\\frac{5}{6}');
  // 12로 잘라도 합쳐진다(더 작은 6이 있다는 안내는 화면이 덧붙인다)
  assert.equal(
    fTex(ADD, fMerge(ADD, { ...s, d: 12 }).s),
    '\\frac{6}{12}+\\frac{4}{12}=\\frac{10}{12}=\\frac{5}{6}',
  );
  assert.equal(fTex(ADD, s), '\\frac{1}{2}+\\frac{1}{3}');
});

test('그릴 목록: 조각 칸은 늘 같은 키(최대 칸 수만큼)로, 안 쓰는 칸은 숨긴다', () => {
  const s = fInit(ADD);
  const d0 = fDraw(ADD, { s, off: null });
  const d6 = fDraw(ADD, { s: { ...s, d: 6 }, off: null });
  assert.deepEqual(
    d0.marks.map((m) => m.k),
    d6.marks.map((m) => m.k),
  );
  assert.equal(mark(d0, 'A:0')?.a.visibility, 'visible');
  assert.equal(mark(d0, 'A:2')?.a.visibility, 'hidden'); // 1/2 → 두 칸
  assert.equal(mark(d6, 'A:5')?.a.visibility, 'visible'); // 6칸
  assert.match(String(mark(d6, 'A:2')?.a.class), /fa/); // 3/6 → 셋째 칸까지 칠함
  assert.doesNotMatch(String(mark(d6, 'A:3')?.a.class), /fa/);
  // 끄는 중에는 아래 막대 묶음만 움직인다
  assert.equal(
    fDraw(ADD, { s, off: [5, -20] }).marks.find((m) => m.k === 'bgrp')?.a.transform,
    'translate(5 -20)',
  );
});

test('뺄셈·비교·곱·나눗셈', () => {
  const SUB = parse({ shape: 'circle', mode: 'sub', a: '3/4', b: '1/6', cut: { min: 2, max: 24 } });
  const m = fMerge(SUB, { ...fInit(SUB), d: 12 });
  assert.equal(fTex(SUB, m.s), '\\frac{9}{12}-\\frac{2}{12}=\\frac{7}{12}');

  const CMP = parse({
    shape: 'bar',
    mode: 'compare',
    a: '2/3',
    b: '3/5',
    cut: { min: 2, max: 15 },
  });
  assert.equal(fDone(CMP, { ...fInit(CMP), pick: 1 }), true);
  assert.equal(fDone(CMP, { ...fInit(CMP), pick: -1 }), false);

  const MUL = parse({ shape: 'bar', mode: 'mul', a: '2/3', b: '3/4' });
  const s = fInit(MUL);
  assert.equal(fDone(MUL, s), false);
  assert.equal(fDone(MUL, { ...s, wa: 2, hb: 3 }), true);
  assert.equal(
    fTex(MUL, { ...s, wa: 2, hb: 3 }),
    '\\frac{2}{3}\\times\\frac{3}{4}=\\frac{6}{12}=\\frac{1}{2}',
  );

  const DIV = parse({ shape: 'bar', mode: 'div', a: '3/2', b: '1/4' });
  const t = fInit(DIV);
  assert.equal(fMerge(DIV, t).s.placed, 1);
  assert.equal(fDone(DIV, { ...t, placed: 6 }), true);
  assert.equal(fTex(DIV, { ...t, placed: 6 }), '\\frac{3}{2}\\div\\frac{1}{4}=6');
});

test('검산 항목이 sympy 를 통과하고, 값을 망가뜨리면 실패한다', () => {
  const ps = [
    ADD,
    parse({ shape: 'bar', mode: 'sub', a: '3/4', b: '1/6', cut: { min: 2, max: 12 } }),
    parse({ shape: 'bar', mode: 'compare', a: '2/3', b: '3/5', cut: { min: 2, max: 15 } }),
    parse({ shape: 'bar', mode: 'mul', a: '2/3', b: '3/4' }),
    parse({ shape: 'bar', mode: 'div', a: '3/2', b: '1/3' }),
  ];
  for (const p of ps) {
    const r = runChecks(fractionDef.checks(p));
    assert.ok(r.ok, r.out);
  }
  assert.equal(runChecks(tamper(fractionDef.checks(ADD))).ok, false);
});

test('parse: 모르는 칸, 합칠 수 없는 범위, 범위 밖 값은 오류', () => {
  assert.throws(
    () => parse({ shape: 'bar', mode: 'add', a: '1/2', b: '1/3', colour: 1 }),
    /모르는 칸/,
  );
  // 자르는 범위에 공통분모가 없으면 목표에 닿을 수 없다
  assert.throws(
    () => parse({ shape: 'bar', mode: 'add', a: '1/2', b: '1/3', cut: { min: 2, max: 5 } }),
    /공통/,
  );
  assert.throws(() => parse({ shape: 'bar', mode: 'add', a: '1/2', b: '1/3' }), /공통/);
  assert.throws(
    () => parse({ shape: 'bar', mode: 'sub', a: '1/3', b: '1/2', cut: { min: 2, max: 6 } }),
    /작/,
  );
  assert.throws(() => parse({ shape: 'bar', mode: 'mul', a: '3/2', b: '1/2' }), /1 이하/);
  assert.throws(
    () => parse({ shape: 'bar', mode: 'add', a: '1/13', b: '1/2', cut: { min: 2, max: 12 } }),
    /분모/,
  );
});

test('그림만(still): 슬라이더·검산 없이 두 분수만 보인다(질문 장면의 그림)', () => {
  const p = parse({ shape: 'bar', mode: 'add', a: '1/2', b: '1/3', still: true });
  assert.equal(p.still, true);
  assert.deepEqual(fractionDef.checks(p), []);
  assert.equal(fTex(p, fInit(p)), '\\frac{1}{2}+\\frac{1}{3}');
  assert.throws(
    () =>
      parse({
        shape: 'bar',
        mode: 'add',
        a: '1/2',
        b: '1/3',
        still: true,
        cut: { min: 2, max: 6 },
      }),
    /still/,
  );
});
