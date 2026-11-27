// 수직선 2-다: 점프 = 점을 그만큼 끌어 옮기기(P2), 점 여러 개 과제(요청 32), 슬라이더로 움직이는 점(요청 81).
// 화면 없이 모델만 본다 — 끄는 동안의 그림·손을 뗀 자리 판정·검산 항목이 모두 numberLine.ts 의 순수 함수에서 나온다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  JUMPER,
  jumpFrom,
  jumpHits,
  jumpTarget,
  type NLParams,
  type NLState,
  nlActive,
  nlDrag,
  nlDraw,
  nlGrade,
  nlInit,
  nlKey,
  nlSliderValues,
  numberLineDef,
} from '../src/lesson/widgets/numberLine.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => numberLineDef.parse(raw) as NLParams;
/** 다음 점프를 마친 상태(화면은 판정기가 센 수를 jump 에 넣는다) */
const landed = (s: NLState, n: number): NLState => ({ ...s, jump: n });

const JUMP = parse({ min: -3, max: 8, step: '1', jumps: { start: '5', moves: ['-7', '3'] } });

test('점프: 처음엔 끄는 점(j)이 출발점에 있고 다음 도착 칸이 정해진다', () => {
  const s = nlInit(JUMP);
  assert.equal(s.pts[JUMPER], 8); // 5 − (−3)
  assert.equal(jumpFrom(JUMP, s), 8);
  assert.equal(jumpTarget(JUMP, s), 1); // 5 − 7 = −2
  assert.equal(jumpTarget(JUMP, landed(s, 1)), 4); // −2 + 3 = 1
  assert.equal(jumpTarget(JUMP, landed(s, 2)), null);
  // 점프 중에는 끄는 손잡이가 점프 점 하나뿐
  assert.deepEqual(
    nlActive(JUMP, s).map((h) => h.id),
    [JUMPER],
  );
  assert.deepEqual(nlActive(JUMP, landed(s, 2)), []);
});

test('점프 판정은 손을 뗀 자리만: 다음 도착 칸이면 그 점프 번호, 아니면 없음(지나간 칸은 세지 않는다)', () => {
  const s = nlInit(JUMP);
  // 끄는 중 상태(nlDrag)는 판정하지 않는다 — 판정은 놓은 상태에만 부른다
  const unit = (320 - 48) / 11;
  const passing = nlDrag(JUMP, s, JUMPER, -unit * 7);
  assert.equal(passing.pts[JUMPER], 1);
  assert.deepEqual(jumpHits(JUMP, passing), ['0']);
  assert.deepEqual(jumpHits(JUMP, nlDrag(JUMP, s, JUMPER, -unit * 6)), []);
  assert.deepEqual(jumpHits(JUMP, s), []); // 제자리
  // 첫 점프를 마친 뒤에는 그 자리(−2)에서 +3 이 다음
  const one = landed(passing, 1);
  assert.deepEqual(jumpHits(JUMP, nlDrag(JUMP, one, JUMPER, unit * 3)), ['1']);
  // 엉뚱한 칸에 놓아도 출발점은 그대로(마지막 도착점)
  const off = nlDrag(JUMP, one, JUMPER, unit * 5);
  assert.equal(jumpFrom(JUMP, off), 1);
  assert.equal(jumpTarget(JUMP, off), 4);
  // 방향키도 같은 칸 이동
  assert.equal(nlKey(JUMP, s, JUMPER, 'ArrowLeft')?.pts[JUMPER], 7);
});

test('점프 글: 마친 만큼의 식과 다음 이동을 "= ?" 로, 다 뛰면 값. 지금 자리 글은 끄는 동안 바뀐다', () => {
  const s = nlInit(JUMP);
  assert.equal(nlDraw(JUMP, s).texts.jump, '5 − 7 = ?');
  assert.equal(nlDraw(JUMP, landed(s, 1)).texts.jump, '5 − 7 + 3 = ?');
  assert.equal(nlDraw(JUMP, landed(s, 2)).texts.jump, '5 − 7 + 3 = 1');
  assert.equal(nlDraw(JUMP, s).texts.jnow, '지금 5');
  assert.equal(nlDraw(JUMP, nlDrag(JUMP, s, JUMPER, -50)).texts.jnow, '지금 3');
  assert.equal(nlDraw(JUMP, landed(s, 2)).texts.jnow, undefined);
  // 출발점 고리는 점프가 남았을 때만, 다 뛴 점은 손잡이가 아니라 그냥 점
  assert.equal(mark(nlDraw(JUMP, s), 'jfrom')?.a.visibility, 'visible');
  assert.equal(mark(nlDraw(JUMP, landed(s, 2)), 'jfrom')?.a.visibility, 'hidden');
  assert.equal(mark(nlDraw(JUMP, landed(s, 2)), 'jdot')?.a.visibility, 'visible');
});

test('점프 + 점 찍기 과제: 점은 점프를 다 마친 뒤에 나온다(같은 칸 근처의 두 손잡이가 겹치지 않게)', () => {
  const p = parse({
    min: 0,
    max: 24,
    step: '1',
    label: '4',
    points: [{ id: 'P', at: '1', drag: true }],
    jumps: { start: '0', moves: ['6', '6', '6', '6'] },
    task: { type: 'point', point: 'P', answer: '12', check: 'ilcm(4,6)' },
  });
  const s = nlInit(p);
  assert.deepEqual(
    nlActive(p, s).map((h) => h.id),
    [JUMPER],
  );
  assert.equal(mark(nlDraw(p, s), 'pl:P')?.a.visibility, 'hidden');
  assert.equal(nlDraw(p, s).texts['pt:P'], undefined);
  const done = landed(s, 4);
  assert.deepEqual(
    nlActive(p, done).map((h) => h.id),
    ['P'],
  );
  assert.equal(mark(nlDraw(p, done), 'pl:P')?.a.visibility, 'visible');
  assert.equal(nlGrade(p, { ...done, pts: { ...done.pts, P: 12 } }), true);
});

test('점프 검산: 닿는 도착점마다 sympy 가 매개변수(출발·이동)에서 따로 더한 값과 같다', () => {
  const p = parse({
    min: -1,
    max: 1,
    step: '1/16',
    label: '1/2',
    jumps: { start: '1', moves: ['-3/2', '3/4', '-3/8', '3/16'] },
  });
  const cs = numberLineDef.checks(p);
  assert.deepEqual(
    cs.map((c) => c.name),
    ['점프 1 도착', '점프 2 도착', '점프 3 도착', '점프 도착'],
  );
  assert.deepEqual(
    cs.map((c) => ('answer' in c ? c.answer : '')),
    ['-1/2', '1/4', '-1/8', '1/16'],
  );
  // 검산식은 앱이 더한 값을 옮겨 적지 않고 매개변수 글자를 늘어놓는다
  assert.equal(
    'check' in (cs[1] as object) ? (cs[1] as { check: string }).check : '',
    '(Integer(1))+(Rational(-3,2))+(Rational(3,4))',
  );
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('점프 형식: 0 만큼 뛰는 이동은 오류(놓지 않아도 도착이라 판정이 뜻이 없다)', () => {
  assert.throws(
    () => parse({ min: 0, max: 4, step: '1', jumps: { start: '1', moves: ['0'] } }),
    /0/,
  );
});

test('점프·과제는 목표가 있는 부품(afterGoal 을 쓸 수 있음), 자료만 있으면 없다', () => {
  assert.equal(numberLineDef.hasGoal?.(JUMP), true);
  const data = parse({ min: 0, max: 10, step: '1', data: { values: ['2', '3'], show: ['mean'] } });
  assert.equal(numberLineDef.hasGoal?.(data), false);
});

// ---- 점 여러 개 과제(요청 32 — 부등호 양변에 음수를 곱하면 두 점의 순서가 뒤집힌다) ----

const FLIP = parse({
  min: -6,
  max: 6,
  step: '1',
  points: [
    { id: 'A', at: '2', label: 'a' },
    { id: 'B', at: '5', label: 'b' },
    { id: 'P', at: '5', drag: true, label: '−b' },
    { id: 'Q', at: '2', drag: true, label: '−a' },
  ],
  task: {
    type: 'points',
    answers: [
      { point: 'P', answer: '-5', check: '5*(-1)' },
      { point: 'Q', answer: '-2', check: '2*(-1)' },
    ],
  },
});

test('점 여러 개 과제: 모든 점이 제 답 칸에 있어야 정답', () => {
  const s = nlInit(FLIP);
  assert.equal(nlGrade(FLIP, s), false);
  const cell = (v: number) => v + 6;
  const one = { ...s, pts: { ...s.pts, P: cell(-5) } };
  assert.equal(nlGrade(FLIP, one), false);
  assert.equal(nlGrade(FLIP, { ...one, pts: { ...one.pts, Q: cell(-2) } }), true);
  // 끌 수 있는 손잡이는 두 점
  assert.deepEqual(
    nlActive(FLIP, s).map((h) => h.id),
    ['P', 'Q'],
  );
});

test('점 여러 개 과제 검산: 점마다 하나씩, 값을 망가뜨리면 실패', () => {
  const cs = numberLineDef.checks(FLIP);
  assert.deepEqual(
    cs.map((c) => c.name),
    ['점 찍기 P', '점 찍기 Q'],
  );
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('점 여러 개 과제 형식: 끌 수 없는 점·같은 점 두 번·처음 자리가 답이면 오류', () => {
  const base = {
    min: -6,
    max: 6,
    step: '1',
    points: [
      { id: 'A', at: '2' },
      { id: 'P', at: '0', drag: true },
      { id: 'Q', at: '1', drag: true },
    ],
  };
  const task = (answers: unknown) => parse({ ...base, task: { type: 'points', answers } });
  assert.throws(
    () =>
      task([
        { point: 'A', answer: '-2', check: '2*(-1)' },
        { point: 'P', answer: '-1', check: '1*(-1)' },
      ]),
    /끌 수 있는/,
  );
  assert.throws(
    () =>
      task([
        { point: 'P', answer: '-2', check: '2*(-1)' },
        { point: 'P', answer: '-1', check: '1*(-1)' },
      ]),
    /중복/,
  );
  assert.throws(
    () =>
      task([
        { point: 'P', answer: '0', check: '1-1' },
        { point: 'Q', answer: '-1', check: '1*(-1)' },
      ]),
    /처음/,
  );
  assert.throws(() => task([{ point: 'P', answer: '-2', check: '2*(-1)' }]), /2/);
});

test('점 그림: 고정 점도 점이 보이고, 같은 칸에 점이 여럿이면 이름표를 위로 쌓는다', () => {
  const s = nlInit(FLIP);
  const d = nlDraw(FLIP, s);
  assert.equal(mark(d, 'fx:A')?.tag, 'circle');
  assert.equal(mark(d, 'fx:P'), undefined); // 끄는 점은 손잡이가 그린다
  const y = (k: string) => Number(mark(d, k)?.a.y);
  // A·Q 가 2 에, B·P 가 5 에 — 나중 점의 이름표가 한 줄 위
  assert.equal(y('pl:A'), y('pl:B'));
  assert.ok(y('pl:Q') < y('pl:A'));
  assert.ok(y('pl:P') < y('pl:B'));
  // 옮기면 쌓기가 풀린다(끄는 동안 직접 적용되는 그림 목록에서 나온다)
  const moved = nlDraw(FLIP, nlDrag(FLIP, s, 'Q', -100));
  assert.equal(Number(mark(moved, 'pl:Q')?.a.y), y('pl:A'));
});

// ---- 슬라이더로 움직이는 점(요청 81) ----

const SLIDE = parse({
  min: -4,
  max: 6,
  step: '1',
  slider: { id: 't', min: '0', max: '4', step: '1/2', value: '0', label: '시각 $t$' },
  points: [{ id: 'P', follow: 't**2-4*t', label: 'P' }],
});

test('슬라이더 점: 슬라이더 칸마다 식으로 정확한 자리(칸 위가 아니어도 됨)', () => {
  assert.deepEqual(nlSliderValues(SLIDE), ['0', '1/2', '1', '3/2', '2', '5/2', '3', '7/2', '4']);
  const s = nlInit(SLIDE);
  assert.equal(s.sl, 0);
  assert.equal(nlDraw(SLIDE, s).texts['pt:P'], 'P = 0');
  assert.equal(nlDraw(SLIDE, { ...s, sl: 1 }).texts['pt:P'], 'P = −7/4');
  assert.equal(nlDraw(SLIDE, { ...s, sl: 1 }).texts.slider, 't = 1/2');
  // 자리는 값 비율로(−7/4 는 −4 에서 9/4 칸) — 끄는 손잡이가 아니라 그냥 점
  const x = Number(mark(nlDraw(SLIDE, { ...s, sl: 1 }), 'fx:P')?.a.cx);
  assert.equal(x, Math.round((24 + (9 / 4) * 27.2) * 100) / 100);
  assert.deepEqual(nlActive(SLIDE, s), []);
});

test('슬라이더 점 검산: 닿는 슬라이더 값마다 sympy 가 식에 넣은 값과 같다', () => {
  const cs = numberLineDef.checks(SLIDE);
  assert.equal(cs.length, 9);
  assert.equal(cs[1]?.name, '슬라이더 점 P (t=1/2)');
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('슬라이더 점 형식: 수직선 밖으로 나가거나 분수가 아닌 값, 모르는 글자는 오류', () => {
  const base = {
    min: -4,
    max: 6,
    step: '1',
    slider: { id: 't', min: '0', max: '4', step: '1', value: '0', label: 't' },
  };
  assert.throws(() => parse({ ...base, points: [{ id: 'P', follow: 't**2' }] }), /범위/);
  assert.throws(() => parse({ ...base, points: [{ id: 'P', follow: 'sqrt(t)' }] }), /분수/);
  assert.throws(() => parse({ ...base, points: [{ id: 'P', follow: 'x+1' }] }), /변수/);
  // 슬라이더 없이 follow, follow 와 drag 를 함께는 오류
  assert.throws(
    () => parse({ min: 0, max: 4, step: '1', points: [{ id: 'P', follow: '1' }] }),
    /슬라이더/,
  );
  assert.throws(
    () => parse({ ...base, points: [{ id: 'P', follow: 't', drag: true, at: '0' }] }),
    /follow/,
  );
});
