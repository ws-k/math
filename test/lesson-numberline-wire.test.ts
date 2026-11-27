// 수직선 화면 배선(numberLineWire.ts): 손을 뗀 자리 판정·놓침 세기·키 판정 미루기·동시 끌기 잠금.
// React 없이 실제 판정기(goalJudge)와 끌기 알맹이(widgetDrag)를 그대로 엮어, 화면이 밟는 순서대로 불러 본다.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { TAP_ON } from '../src/lesson/drag.ts';
import { type Drawing, mark } from '../src/lesson/widgets/draw.ts';
import {
  JUMPER,
  type NLParams,
  type NLState,
  nlInit,
  numberLineDef,
} from '../src/lesson/widgets/numberLine.ts';
import { type NLMsg, nlWire } from '../src/lesson/widgets/numberLineWire.ts';
import { GOAL_KEY_IDLE_MS, goalJudge } from '../src/lesson/widgets/useGoal.ts';
import { widgetDrag } from '../src/lesson/widgets/useWidgetDrag.ts';

const parse = (raw: unknown) => numberLineDef.parse(raw) as NLParams;
/** 0 에서 +2 두 번(0 → 2 → 4) */
const TWO = parse({ min: 0, max: 8, step: '1', jumps: { start: '0', moves: ['2', '2'] } });

function rig(p: NLParams) {
  const log = {
    msgs: [] as NLMsg[],
    misses: 0,
    finished: 0,
    fails: [] as number[],
    painted: [] as Drawing[],
  };
  const live = { current: nlInit(p) };
  // 판정기와 배선이 서로를 부른다(판정기 콜백은 배선을 만든 뒤에 불린다)
  let w: ReturnType<typeof nlWire>;
  const judge = goalJudge(p.jumps?.moves.length ?? 1, {
    judged: (g) => w.onJudge(g),
    done: () => w.onDone(),
  });
  w = nlWire(p, {
    judge,
    live,
    setState: (s) => {
      live.current = s;
    },
    say: (m) => log.msgs.push(m),
    onMiss: () => log.misses++,
    finish: () => log.finished++,
    setFails: (n) => log.fails.push(n),
  });
  const start = { current: live.current };
  const drag = widgetDrag<NLState>({
    get: () => live.current,
    start,
    draw: w.draw,
    commit: w.release,
    paint: (d) => log.painted.push(d),
  });
  const last = () => log.msgs[log.msgs.length - 1];
  return { w, judge, live, drag, log, last };
}

/** 화면이 손잡이 하나를 끄는 순서: 잡기 → 끌기 → 놓기(SVG 단위 dx) */
function handDrag(r: ReturnType<typeof rig>, id: string, cells: number, unit: number) {
  r.w.grab(id);
  const g = r.drag((s, dx) => r.w.move(s, id, dx));
  g.onStart();
  g.onMove(cells * unit * 0.5, 0);
  g.onEnd(cells * unit, 0, false);
  r.w.letGo();
}
const U = 272 / 8;

test('배선: 도착 칸에 놓으면 점프 하나, 다 뛰면 "다 옮겼어요" 와 장면 끝(한 번만)', () => {
  const r = rig(TWO);
  handDrag(r, JUMPER, 2, U);
  assert.equal(r.w.jumpsDone(), 1);
  handDrag(r, JUMPER, 2, U);
  assert.equal(r.w.jumpsDone(), 2);
  assert.deepEqual(r.last(), { text: '다 옮겼어요.', cls: 'ok' });
  assert.equal(r.log.finished, 1);
  assert.equal(r.log.misses, 0);
});

test('배선: 엉뚱한 칸 — 첫 번째는 출발점을 짚어 주고, 두 번째도 "그 자리가 아니에요." 먼저 + 눌러서 하기', () => {
  const r = rig(TWO);
  handDrag(r, JUMPER, 3, U);
  assert.deepEqual(r.last(), {
    text: '그 자리가 아니에요. 출발점 0 에서 오른쪽으로 2 만큼 옮겨요.',
    cls: 'bad',
  });
  assert.deepEqual(r.log.fails, [1]);
  // 엉뚱한 칸(3)에서 다시 끌어 또 엉뚱한 칸(4) — 출발점은 그대로 0
  handDrag(r, JUMPER, 1, U);
  const m = r.last()?.text ?? '';
  assert.ok(m.startsWith('그 자리가 아니에요. 출발점 0 에서'), m);
  assert.ok(m.includes(TAP_ON), m);
  assert.deepEqual(r.log.fails, [1, 2]);
  assert.equal(r.log.misses, 2);
  assert.equal(r.w.jumpsDone(), 0);
});

test('배선: 움직이지 않고 누르기만 하면 끄는 법을 알려 주고 놓침으로 센다', () => {
  const r = rig(TWO);
  handDrag(r, JUMPER, 0, U);
  assert.deepEqual(r.last(), { text: '점을 끌어서 옮겨요.', cls: '' });
  assert.deepEqual(r.log.fails, [1]);
});

test('배선: 동시 끌기 1개 — 잡은 동안 다른 손잡이는 거절, 놓으면 다시 받는다', () => {
  const r = rig(TWO);
  assert.equal(r.w.pick(), true);
  r.w.grab(JUMPER);
  assert.equal(r.w.pick(), false);
  r.w.letGo();
  assert.equal(r.w.pick(), true);
});

test('배선: 키는 멈춘 뒤 판정 — 도착 칸이 아니면 낭독되는 안내, 도착 칸이면 점프', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const r = rig(TWO);
    r.w.step(JUMPER, 'ArrowRight');
    assert.equal(r.w.jumpsDone(), 0); // 바로 판정하지 않는다
    mock.timers.tick(GOAL_KEY_IDLE_MS);
    assert.deepEqual(r.last(), { text: '아직 도착 칸이 아니에요.', cls: '' });
    assert.equal(r.log.misses, 0); // 키는 놓침으로 세지 않는다(눌러서 하기를 켜는 신호가 아니다)
    r.w.step(JUMPER, 'ArrowRight');
    mock.timers.tick(GOAL_KEY_IDLE_MS);
    assert.equal(r.w.jumpsDone(), 1);
  } finally {
    mock.timers.reset();
  }
});

test('배선(검토 M2): 키로 도착 칸에 둔 직후 점을 잡으면 그 판정을 먼저 끝내고, 끌기가 취소돼도 그림은 새 점프 수로', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const one = parse({ min: 0, max: 8, step: '1', jumps: { start: '0', moves: ['2'] } });
    const r = rig(one);
    r.w.step(JUMPER, 'ArrowRight');
    r.w.step(JUMPER, 'ArrowRight');
    // 0.6초가 지나기 전에 손가락으로 잡는다 → 기다리던 키 판정이 지금 끝나 마지막 점프가 끝난다
    r.w.grab(JUMPER);
    assert.equal(r.w.jumpsDone(), 1);
    // 다 뛰어 손잡이가 사라지면 끌기는 취소로 끝난다(attachDrag 정리) — 이때 그린 그림이 옛 점프 수면 화면이 굳는다
    const g = r.drag((s, dx) => r.w.move(s, JUMPER, dx));
    g.onStart();
    g.onMove(U, 0);
    g.onEnd(U, 0, true);
    r.w.letGo();
    for (const d of r.log.painted) {
      assert.equal(mark(d, 'jdot')?.a.visibility, 'visible');
      assert.equal(mark(d, 'jfrom')?.a.visibility, 'hidden');
      assert.equal(d.texts.jnow, undefined);
      assert.equal(d.texts.jump, '0 + 2 = 2');
    }
    assert.ok(r.log.painted.length >= 2);
  } finally {
    mock.timers.reset();
  }
});

test('배선: 점 찍기 과제가 있으면 다 뛰어도 장면을 끝내지 않는다(확인으로 끝낸다)', () => {
  const p = parse({
    min: 0,
    max: 8,
    step: '1',
    points: [{ id: 'P', at: '1', drag: true }],
    jumps: { start: '0', moves: ['2'] },
    task: { type: 'point', point: 'P', answer: '4', check: '2*2' },
  });
  const r = rig(p);
  handDrag(r, JUMPER, 2, U);
  assert.equal(r.w.jumpsDone(), 1);
  assert.equal(r.log.finished, 0);
  // P 끌기는 판정 없이 상태만(확인 단추가 채점)
  handDrag(r, 'P', 3, U);
  assert.equal(r.live.current.pts.P, 4);
  assert.equal(r.log.finished, 0);
});

test('배선: 과제·점프가 없는 부품은 한 번 만지면 끝', () => {
  const p = parse({ min: 0, max: 8, step: '1', points: [{ id: 'P', at: '1', drag: true }] });
  const r = rig(p);
  handDrag(r, 'P', 1, U);
  assert.equal(r.log.finished, 1);
});
