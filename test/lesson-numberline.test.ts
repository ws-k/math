import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type NLParams,
  nlDrag,
  nlDraw,
  nlGrade,
  nlInit,
  nlKey,
  nlStats,
  numberLineDef,
} from '../src/lesson/widgets/numberLine.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => numberLineDef.parse(raw) as NLParams;

const POINT = parse({
  min: -2,
  max: 4,
  step: '1/2',
  points: [{ id: 'P', at: '0', drag: true }],
  task: { type: 'point', point: 'P', answer: '3/2', check: 'Rational(1,2)+1' },
});

test('수직선 점: 칸 번호로 저장하고 끌면 가장 가까운 칸에 붙는다', () => {
  const s = nlInit(POINT);
  assert.equal(s.pts.P, 4); // (0 − (−2)) ÷ 1/2
  // 한 칸 = (320 − 2·24) / 12 = 22.67 단위. 1.4칸 끌면 1칸, 범위 밖이면 끝에 멈춘다
  assert.equal(nlDrag(POINT, s, 'P', 22.67 * 1.4).pts.P, 5);
  assert.equal(nlDrag(POINT, s, 'P', -9999).pts.P, 0);
  assert.equal(nlDrag(POINT, s, 'P', 9999).pts.P, 12);
  assert.equal(nlKey(POINT, s, 'P', 'ArrowRight')?.pts.P, 5);
  assert.equal(nlKey(POINT, s, 'P', 'Home')?.pts.P, 0);
  assert.equal(nlKey(POINT, s, 'P', 'x'), null);
});

test('점 찍기 채점: 답 칸에 있을 때만', () => {
  const s = nlInit(POINT);
  assert.equal(nlGrade(POINT, s), false);
  assert.equal(nlGrade(POINT, { ...s, pts: { P: 7 } }), true); // −2 + 7/2 = 3/2
  assert.equal(nlDraw(POINT, { ...s, pts: { P: 7 } }).texts['pt:P'], 'P = 3/2');
});

test('그릴 목록: 손잡이 위치가 칸 번호에서 나온다', () => {
  const s = nlInit(POINT);
  const d = nlDraw(POINT, s);
  assert.match(String(mark(d, 'h:P')?.a.transform), /^translate\(114\.67 /);
});

const DATA = parse({
  min: 0,
  max: 10,
  step: '1',
  data: { values: ['2', '3', '3', '4', '10'], drag: true, show: ['mean', 'median'], digits: 1 },
});

test('자료 점: 평균·중앙값(분수로 정확히), 하나를 끌면 평균만 크게 움직인다', () => {
  const s = nlInit(DATA);
  assert.deepEqual(nlStats(DATA, s), { mean: '22/5', median: '3' });
  const t = nlDrag(DATA, s, 'd4', -(272 / 10) * 6); // 10 → 4
  assert.deepEqual(nlStats(DATA, t), { mean: '16/5', median: '3' });
  assert.equal(nlDraw(DATA, s).texts.mean, '평균 4.4');
  assert.equal(nlDraw(DATA, s).texts.median, '중앙값 3');
});

const IV = parse({
  min: -5,
  max: 5,
  step: '1',
  task: { type: 'interval', ineq: '2*x+1<7', answer: { at: '3', dir: 'left', open: true } },
});

test('구간 고르기: 끝점·방향·빈 점이 모두 맞아야 정답', () => {
  const s = nlInit(IV);
  assert.ok(s.iv);
  assert.equal(nlGrade(IV, s), false);
  const right = { ...s, iv: { at: 8, dir: 'left' as const, open: true } };
  assert.equal(nlGrade(IV, right), true);
  assert.equal(nlGrade(IV, { ...right, iv: { ...right.iv, open: false } }), false);
  assert.equal(nlDraw(IV, right).texts.iv, 'x < 3');
});

const JUMP = parse({ min: -3, max: 8, step: '1', jumps: { start: '5', moves: ['-7', '3'] } });

test('점프 화살표: 한 번씩 펼치고 마지막 도착점', () => {
  const s = nlInit(JUMP);
  assert.equal(s.jump, 0);
  const d = nlDraw(JUMP, { ...s, jump: 2 });
  assert.equal(d.texts.jump, '5 − 7 + 3 = 1');
});

test('검산 항목이 sympy 를 통과하고, 값을 망가뜨리면 실패한다', () => {
  for (const p of [POINT, DATA, IV, JUMP]) {
    const cs = numberLineDef.checks(p);
    assert.ok(cs.length > 0);
    const r = runChecks(cs);
    assert.ok(r.ok, r.out);
  }
  assert.equal(runChecks(tamper(numberLineDef.checks(POINT))).ok, false);
  assert.equal(runChecks(tamper(numberLineDef.checks(DATA))).ok, false);
});

test('parse: 모르는 칸·칸 밖 값·범위 밖 점프는 오류', () => {
  const base = { min: 0, max: 4, step: '1' };
  assert.throws(() => parse({ ...base, colour: 'red' }), /모르는 칸/);
  assert.throws(() => parse({ ...base, points: [{ id: 'P', at: '1/3' }] }), /칸/);
  assert.throws(() => parse({ ...base, jumps: { start: '3', moves: ['2'] } }), /범위/);
  assert.throws(() => parse({ ...base, step: '3' }), /나누어/);
  assert.throws(
    () =>
      parse({
        ...base,
        points: [{ id: 'P', at: '0', drag: true }],
        task: { type: 'point', point: 'P', answer: '2', check: '2' },
      }),
    /그대로/,
  );
});
