// 세로셈 가족(긴 나눗셈·조립제법·나눗셈 사다리)의 모델. 화면(Column.tsx)은 손을 뗀 결과를 이 함수들에 넘기기만 한다.
// 시험 장면은 단원 JSON 이 아니라 이 파일 안에 둔다(레인 규칙 — 단원 적용은 4-마).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type ColumnParams,
  columnDef,
  jo,
  L_ROW,
  L_X0,
  type LadderParams,
  type LongParams,
  ladderApply,
  ladderDone,
  ladderInit,
  ladderResult,
  longBringSpot,
  longJudge,
  longNext,
  longPlan,
  longView,
  type SynthParams,
  synthInit,
  synthPlace,
  synthSum,
  synthView,
} from '../src/lesson/widgets/column.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => columnDef.parse(raw) as ColumnParams;
const long = (raw: object) => parse({ mode: 'long', ...raw }) as LongParams;
const synth = (raw: object) => parse({ mode: 'synth', ...raw }) as SynthParams;
const ladder = (raw: object) => parse({ mode: 'ladder', ...raw }) as LadderParams;

const steps = (p: LongParams) => longPlan(p).steps.map(({ n, q, r }) => [n, q, r]);

// ---- 조사 ----

test('수 뒤 조사: 받침(ㄹ 포함)에 따라 고른다', () => {
  assert.equal(`3 ${jo(3, '으로')}`, '3 으로');
  assert.equal(`2 ${jo(2, '으로')}`, '2 로');
  assert.equal(`8 ${jo(8, '으로')}`, '8 로'); // 팔 — ㄹ 받침은 '로'
  assert.equal(`30 ${jo(30, '을')}`, '30 을');
  assert.equal(`22 ${jo(22, '을')}`, '22 를');
  assert.equal(`11 ${jo(11, '이')}`, '11 이');
  assert.equal(`9 ${jo(9, '이')}`, '9 가');
  assert.equal(`80 ${jo(80, '이')}`, '80 이');
  assert.equal(`0 ${jo(0, '은')}`, '0 은');
  assert.equal(`5 ${jo(5, '은')}`, '5 는');
  assert.equal(`0 ${jo(0, '이에요')}`, '0 이에요');
  assert.equal(`5 ${jo(5, '이에요')}`, '5 예요');
});

// ---- 긴 나눗셈: 단계 ----

test('3 ÷ 11 소수: 30→2 남 8, 80→7 남 3, 남은 수가 처음 3 으로 돌아와 되풀이', () => {
  const p = long({ dividend: 3, divisor: 11, decimal: true });
  const pl = longPlan(p);
  assert.deepEqual(steps(p), [
    [30, 2, 8],
    [80, 7, 3],
  ]);
  assert.equal(pl.end, 'repeat');
  assert.equal(pl.repFrom, 0);
  assert.equal(pl.digits, '3000'); // 시안과 같은 3 . 0 0 0 (마지막 0 은 되풀이를 보려고 내리는 칸)
});

test('3 ÷ 8 소수: 나머지가 0 이 되어 끝난다(0.375)', () => {
  const p = long({ dividend: 3, divisor: 8, decimal: true });
  assert.deepEqual(steps(p), [
    [30, 3, 6],
    [60, 7, 4],
    [40, 5, 0],
  ]);
  assert.equal(longPlan(p).end, 'zero');
});

test('1 ÷ 6: 되풀이는 처음 수가 아니라 앞에 나온 4 부터', () => {
  const p = long({ dividend: 1, divisor: 6, decimal: true });
  assert.deepEqual(steps(p), [
    [10, 1, 4],
    [40, 6, 4],
  ]);
  assert.equal(longPlan(p).repFrom, 1);
});

test('1 ÷ 20: 몫 0 인 자리는 곱·뺄셈 줄 없이 다음 0 을 같은 줄에 내린다', () => {
  const p = long({ dividend: 1, divisor: 20, decimal: true });
  const pl = longPlan(p);
  assert.deepEqual(steps(p), [
    [10, 0, 10],
    [100, 5, 0],
  ]);
  assert.deepEqual(
    pl.steps.map((s) => s.row),
    [0, 0],
  );
  assert.equal(pl.rows, 3);
});

test('156 ÷ 12 정수: 15 부터 시작(앞자리 1 은 12 보다 작음), 몫 13 나머지 0', () => {
  const p = long({ dividend: 156, divisor: 12 });
  const pl = longPlan(p);
  assert.deepEqual(steps(p), [
    [15, 1, 3],
    [36, 3, 0],
  ]);
  assert.deepEqual(
    pl.steps.map((s) => s.c),
    [1, 2],
  );
  assert.equal(pl.end, 'int');
});

test('1203 ÷ 12: 중간 몫 0 이 둘(100 나머지 3)', () => {
  const p = long({ dividend: 1203, divisor: 12 });
  assert.deepEqual(steps(p), [
    [12, 1, 0],
    [0, 0, 0],
    [3, 0, 3],
  ]);
});

test('판정(손을 뗀 뒤 한 번): 0 개·넘침·한 번 더·맞음', () => {
  const pl = longPlan(long({ dividend: 3, divisor: 11, decimal: true }));
  assert.equal(longJudge(pl, 0, 0), 'empty');
  assert.equal(longJudge(pl, 0, 3), 'over');
  assert.equal(longJudge(pl, 0, 1), 'more');
  assert.equal(longJudge(pl, 0, 2), 'ok');
  // 들어가지 않는 자리는 0 개가 맞다(1 ÷ 20 의 10)
  const z = longPlan(long({ dividend: 1, divisor: 20, decimal: true }));
  assert.equal(longJudge(z, 0, 0), 'ok');
  assert.equal(longJudge(z, 0, 1), 'over');
});

test('진행: 몫 → 0 내리기 → 몫 … 되풀이면 마지막에 한 번 더 내리고 끝', () => {
  const pl = longPlan(long({ dividend: 3, divisor: 11, decimal: true }));
  let s = { k: 0, phase: 'q' as const } as ReturnType<typeof longNext>;
  const seq: string[] = [];
  while (s.phase !== 'done') {
    s = longNext(pl, s);
    seq.push(`${s.k}${s.phase}`);
  }
  assert.deepEqual(seq, ['1bring', '1q', '2bring', '2done']);
  // 끝나는 나눗셈은 마지막 몫 뒤에 내릴 것이 없다
  const t = longPlan(long({ dividend: 3, divisor: 8, decimal: true }));
  let u = { k: 2, phase: 'q' } as ReturnType<typeof longNext>;
  u = longNext(t, u);
  assert.deepEqual(u, { k: 3, phase: 'done' });
});

// ---- 긴 나눗셈: 화면 칸(시안 long-drag.html 과 같은 자리) ----

const at = (v: ReturnType<typeof longView>, x: number, y: number) =>
  v.cells.filter((c) => c.x === x && c.y === y);

test('처음 화면(3 ÷ 11): 3 . 0 0 0 — 첫 0 은 진하고 나머지는 흐림, 몫 줄에 0 .', () => {
  const pl = longPlan(long({ dividend: 3, divisor: 11, decimal: true }));
  const v = longView(pl, { k: 0, phase: 'q' });
  const top = v.cells.filter((c) => c.y === L_ROW(0) && c.x >= L_X0);
  assert.deepEqual(
    top.map((c) => [c.x, c.text, c.cls.includes('faint')]),
    [
      [58, '3', false],
      [72, '.', false],
      [86, '0', false],
      [106, '0', true],
      [126, '0', true],
    ],
  );
  const q = v.cells.filter((c) => c.cls.includes('q'));
  assert.deepEqual(
    q.map((c) => [c.x, c.text]),
    [
      [58, '0'],
      [72, '.'],
    ],
  );
  // 지금 나누는 수 30 을 칠한다
  assert.deepEqual(
    v.cells.filter((c) => c.cls.includes('cur')).map((c) => c.x),
    [58, 86],
  );
});

test('몫 2 를 정한 뒤: 22 와 밑줄, 남은 8, 0 을 내릴 점선 칸', () => {
  const pl = longPlan(long({ dividend: 3, divisor: 11, decimal: true }));
  const v = longView(pl, { k: 1, phase: 'bring' });
  assert.deepEqual(
    at(v, 86, 14).map((c) => c.text),
    ['2'],
  );
  assert.deepEqual(
    [...at(v, 58, L_ROW(1)), ...at(v, 86, L_ROW(1))].map((c) => c.text),
    ['2', '2'],
  );
  assert.deepEqual(
    at(v, 86, L_ROW(2)).map((c) => c.text),
    ['8'],
  );
  assert.equal(v.lines.length, 1);
  assert.deepEqual(longBringSpot(pl, 1), {
    from: { x: 106, y: L_ROW(0) },
    to: { x: 106, y: L_ROW(2) },
    digit: '0',
  });
  assert.deepEqual(v.trail, [3, 8]);
});

test('끝(3 ÷ 11): 몫 0.27…, 처음 30 과 마지막 30 을 되풀이로 칠한다', () => {
  const pl = longPlan(long({ dividend: 3, divisor: 11, decimal: true }));
  const v = longView(pl, { k: 2, phase: 'done' });
  assert.deepEqual(
    v.cells.filter((c) => c.cls.includes('q')).map((c) => c.text),
    ['0', '.', '2', '7', '…'],
  );
  const rep = v.cells.filter((c) => c.cls.includes('rep'));
  assert.deepEqual(
    rep.map((c) => [c.x, c.y, c.text]),
    [
      [58, L_ROW(0), '3'],
      [86, L_ROW(0), '0'],
      [106, L_ROW(4), '3'],
      [126, L_ROW(4), '0'],
    ],
  );
  assert.deepEqual(v.trail, [3, 8, 3]);
});

test('정수 156 ÷ 12: 몫 1 은 5 위, 3 은 6 위. 앞자리 위는 비움', () => {
  const pl = longPlan(long({ dividend: 156, divisor: 12 }));
  const v = longView(pl, { k: 2, phase: 'done' });
  assert.deepEqual(
    v.cells.filter((c) => c.cls.includes('q')).map((c) => [c.x, c.text]),
    [
      [78, '1'],
      [98, '3'],
    ],
  );
  assert.deepEqual(v.trail, []);
});

// ---- 긴 나눗셈: 형식 검사(자릿수 상한) ----

test('긴 나눗셈 자릿수 상한: 나눠지는 수 5자리·나누는 수 두 자리·칸 폭·줄 수', () => {
  assert.doesNotThrow(() => long({ dividend: 10010, divisor: 91 })); // 5자리 정수
  assert.throws(() => long({ dividend: 100000, divisor: 7 }), /1~99999/);
  assert.throws(() => long({ dividend: 7, divisor: 100 }), /2~99/);
  // 1/7 = 0.142857… — 되풀이까지 0 이 일곱 개라 판 폭을 넘는다
  assert.throws(() => long({ dividend: 1, divisor: 7, decimal: true }), /칸/);
  // 12345 ÷ 11 은 곱·뺄셈이 네 번 — 접은 화면 높이를 넘는다
  assert.throws(() => long({ dividend: 12345, divisor: 11 }), /줄/);
  assert.throws(() => long({ dividend: 3, divisor: 11 }), /나눠지는 수가 나누는 수보다/);
  assert.throws(() => long({ dividend: 8, divisor: 4, decimal: true }), /나누어떨어/);
  assert.throws(() => long({ dividend: 3, divisor: 11, colour: 1 }), /모르는 칸 colour/);
});

// ---- 조립제법 ----

const S1 = { coeffs: [1, 0, -2, 1], root: 2 };

test('조립제법 x³ − 2x + 1 ÷ (x − 2): 첫 계수 내리기 → 곱해 올리기·더하기 세 번 → 나머지 5', () => {
  const p = synth(S1);
  let s = synthInit(p);
  let r = synthPlace(p, s, 'bot', 0);
  assert.equal(r.res, 'first');
  s = r.s;
  for (const [j, want] of [
    [1, 2],
    [2, 2],
    [3, 5],
  ] as const) {
    r = synthPlace(p, s, 'mid', j);
    assert.equal(r.res, 'up');
    assert.equal(r.s.bot[j], null); // 더한 값은 잠깐 뒤에 내려온다
    s = synthSum(p, r.s);
    assert.equal(s.bot[j], want);
  }
  assert.equal(s.k, 4);
  assert.deepEqual(s.mid, [null, 2, 4, 4]);
  const v = synthView(p, s);
  assert.equal(v.quotient, 'x² + 2x + 2');
  assert.equal(v.remainder, 5);
  assert.equal(v.fa, '2³ − 2×2 + 1 = 5');
});

test('조립제법 틀린 칸: 이유만 말하고 그대로', () => {
  const p = synth(S1);
  const s0 = synthInit(p);
  assert.equal(synthPlace(p, s0, 'mid', 1).res, 'wrongFirst');
  const s1 = synthPlace(p, s0, 'bot', 0).s;
  assert.equal(synthPlace(p, s1, 'bot', 1).res, 'wrongBot');
  assert.equal(synthPlace(p, s1, 'mid', 2).res, 'wrongCol');
  assert.deepEqual(synthPlace(p, s1, 'mid', 2).s, s1);
});

test('조립제법 음수 근: (−2)³ 처럼 괄호', () => {
  const p = synth({ coeffs: [1, 0, -3, 4], root: -2 });
  let s = synthPlace(p, synthInit(p), 'bot', 0).s;
  for (const j of [1, 2, 3]) s = synthSum(p, synthPlace(p, s, 'mid', j).s);
  const v = synthView(p, s);
  assert.equal(v.remainder, 2);
  assert.equal(v.fa, '(−2)³ − 3×(−2) + 4 = 2');
  assert.equal(v.divisor, 'x + 2');
});

test('조립제법 형식 검사: 차수 2~4, 첫 계수 0 아님, 근 0 아님, 칸에 들어가는 수(3글자)', () => {
  assert.doesNotThrow(() => synth({ coeffs: [2, -3, 1], root: 1 }));
  assert.throws(() => synth({ coeffs: [1, 1], root: 1 }), /3~5/);
  assert.throws(() => synth({ coeffs: [0, 1, 1], root: 1 }), /첫 계수/);
  assert.throws(() => synth({ coeffs: [1, 1, 1], root: 0 }), /-9~9|0 이 아닌/);
  assert.throws(() => synth({ coeffs: [9, 9, 9, 9, 9], root: 9 }), /글자/);
});

// ---- 나눗셈 사다리 ----

test('사다리 12·18: 2 → 6·9, 3 → 2·3, 더 없음 → 최대공약수 6 · 최소공배수 36', () => {
  const p = ladder({ numbers: [12, 18] });
  let s = ladderInit(p);
  let r = ladderApply(s, 2);
  assert.equal(r.res, 'ok');
  s = r.s;
  assert.deepEqual(s.rows.at(-1), [6, 9]);
  assert.equal(ladderDone(s), 'still');
  r = ladderApply(s, 2);
  assert.equal(r.res, 'one'); // 6 은 나뉘지만 9 는 아님
  r = ladderApply(s, 5);
  assert.equal(r.res, 'none');
  s = ladderApply(s, 3).s;
  assert.equal(ladderDone(s), 'done');
  assert.deepEqual(ladderResult(s), { g: 6, l: 36, divs: [2, 3], rest: [2, 3] });
});

test('사다리: 나누는 차례가 달라도 최대공약수·최소공배수는 같다', () => {
  const p = ladder({ numbers: [12, 18] });
  const a = ladderApply(ladderApply(ladderInit(p), 3).s, 2).s;
  assert.deepEqual(ladderResult(a), { g: 6, l: 36, divs: [3, 2], rest: [2, 3] });
});

test('사다리 형식 검사: 서로소 거부, 카드에 없는 공약수 거부, 줄 수 상한', () => {
  assert.throws(() => ladder({ numbers: [8, 9] }), /서로소/);
  assert.throws(() => ladder({ numbers: [22, 33] }), /11/);
  assert.doesNotThrow(() => ladder({ numbers: [22, 33], cards: [2, 3, 11] }));
  assert.throws(() => ladder({ numbers: [12, 18], cards: [2, 4] }), /소수/);
  assert.throws(() => ladder({ numbers: [64, 128] }), /줄/);
});

// ---- 검산(sympy divmod·div·gcd·lcm) ----

const SCENES: unknown[] = [
  { mode: 'long', dividend: 3, divisor: 11, decimal: true },
  { mode: 'long', dividend: 3, divisor: 8, decimal: true },
  { mode: 'long', dividend: 1, divisor: 6, decimal: true },
  { mode: 'long', dividend: 1, divisor: 20, decimal: true },
  { mode: 'long', dividend: 156, divisor: 12 },
  { mode: 'long', dividend: 1203, divisor: 12 },
  { mode: 'long', dividend: 10010, divisor: 91 },
  { mode: 'synth', coeffs: [1, 0, -2, 1], root: 2 },
  { mode: 'synth', coeffs: [1, 0, -3, 4], root: -2 },
  { mode: 'synth', coeffs: [2, -3, 0, 0, 1], root: 1 },
  { mode: 'ladder', numbers: [12, 18] },
  { mode: 'ladder', numbers: [30, 45] },
];

test('검산 항목: 단계별 몫·나머지 = sympy divmod/div, 사다리 = gcd/lcm', () => {
  const cs = SCENES.flatMap((raw, i) =>
    columnDef.checks(parse(raw)).map((c) => ({ ...c, name: `s${i}:${c.name}` })),
  );
  // 긴 나눗셈은 단계마다 몫·나머지 둘, 조립제법은 아래 줄 칸마다, 사다리는 둘
  assert.ok(cs.some((c) => c.name === 's0:1단계 몫'));
  assert.ok(cs.some((c) => c.name === 's7:나머지'));
  assert.ok(cs.some((c) => c.name === 's10:최소공배수'));
  const v = runChecks(cs);
  assert.ok(v.ok, v.out);
  // 검산이 실제로 값을 본다: 답을 망가뜨리면 실패
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('검산식은 단계 값을 베끼지 않고 매개변수에서 계산한다', () => {
  const cs = columnDef.checks(long({ dividend: 3, divisor: 11, decimal: true }));
  const q1 = cs.find((c) => c.name === '1단계 몫');
  assert.ok(q1 && 'check' in q1 && typeof q1.check === 'string');
  assert.match(q1.check, /divmod\(3\*10\*\*1/);
  const sc = columnDef.checks(synth(S1)).find((c) => c.name === '몫');
  assert.ok(sc && 'check' in sc && typeof sc.check === 'string');
  assert.match(sc.check, /^div\(/);
});
