// 목표 판정 시점(조각 ② 리뷰 M3): 끌어서 놓으면 바로, 키·버튼은 마지막 입력 뒤 잠깐 멈추거나 포커스가 떠날 때 한 번.
// 키를 누를 때마다 판정하면 연타로 숨긴 정답을 더듬어 찾고(지나가며 닿은 자리도 맞았다고 셈), 8칸 이동만으로
// 힌트가 뜬다. 좌표평면·도형판이 같은 판정기(goalJudge)를 쓰므로 여기서 한 번에 고정한다.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { GOAL_HINT_AFTER, type GoalProgress } from '../src/lesson/goal.ts';
import { GOAL_KEY_IDLE_MS, goalJudge } from '../src/lesson/widgets/useGoal.ts';

function setup(need = 1) {
  const judged: GoalProgress[] = [];
  let done = 0;
  const j = goalJudge(need, {
    judged: (g) => judged.push(g),
    done: () => done++,
  });
  return { j, judged, done: () => done };
}

test('키·버튼 연타: 멈출 때까지 판정하지 않고, 멈추면 마지막 자리 하나만 판정(힌트 횟수도 1)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { j, judged } = setup();
    for (let k = 0; k < GOAL_HINT_AFTER + 2; k++) {
      j.later(() => []);
      mock.timers.tick(GOAL_KEY_IDLE_MS - 100);
    }
    assert.equal(judged.length, 0);
    mock.timers.tick(100);
    assert.equal(judged.length, 1);
    assert.equal(judged[0]?.tries, 1);
    assert.equal(j.get().tries, 1);
  } finally {
    mock.timers.reset();
  }
});

test('키로 숨긴 정답 위를 지나쳐 멈추면 미달성(지나간 자리는 세지 않음)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { j, done } = setup();
    j.later(() => ['0']);
    mock.timers.tick(200);
    j.later(() => []);
    mock.timers.tick(GOAL_KEY_IDLE_MS);
    assert.equal(j.get().done, false);
    assert.equal(done(), 0);
  } finally {
    mock.timers.reset();
  }
});

test('포커스가 떠나면 바로 한 번 판정하고, 그 뒤 타이머는 아무것도 하지 않음', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { j, judged, done } = setup();
    j.later(() => ['0']);
    j.flush();
    assert.equal(judged.length, 1);
    assert.equal(j.get().done, true);
    assert.equal(done(), 1);
    mock.timers.tick(GOAL_KEY_IDLE_MS * 2);
    assert.equal(judged.length, 1);
    // 미룬 판정이 없을 때 포커스가 떠나도 판정하지 않음(손 뗀 횟수가 늘지 않음)
    j.flush();
    assert.equal(judged.length, 1);
  } finally {
    mock.timers.reset();
  }
});

test('끌어서 놓으면 바로 판정하고, 기다리던 키 판정은 버린다(지금 자리가 최신)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { j, judged } = setup();
    j.later(() => ['0']);
    j.release([]);
    mock.timers.tick(GOAL_KEY_IDLE_MS);
    assert.equal(judged.length, 1);
    assert.equal(j.get().done, false);
    assert.equal(j.get().tries, 1);
  } finally {
    mock.timers.reset();
  }
});

test('완료 알림은 한 번만, 취소하면 미룬 판정은 사라짐', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { j, done } = setup(2);
    j.release(['a']);
    j.release(['b']);
    j.release(['a']);
    assert.equal(done(), 1);
    const k = setup();
    k.j.later(() => ['0']);
    k.j.cancel();
    mock.timers.tick(GOAL_KEY_IDLE_MS);
    assert.equal(k.j.get().tries, 0);
    assert.equal(k.done(), 0);
  } finally {
    mock.timers.reset();
  }
});

test('키로 옮긴 뒤 0.6초 안에 끌기 시작: 시작 때 flush 로 키 자리를 판정하고, 끄는 동안 타이머가 터지지 않음', () => {
  // 좌표평면·도형판은 끌기 시작(onStart)과 슬라이더 pointerdown 에서 flush 한다. 키가 만든 자리는 그 순간의
  // 자리(n)로 잡혀 있어, 끄는 중 자리를 판정하지 않는다
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { j, judged } = setup();
    j.later(() => ['0']);
    mock.timers.tick(300);
    j.flush(); // 끌기 시작
    assert.equal(judged.length, 1);
    assert.equal(judged[0]?.done, true);
    mock.timers.tick(GOAL_KEY_IDLE_MS * 2); // 끄는 동안
    assert.equal(judged.length, 1);
    j.release([]); // 손 뗌
    assert.equal(judged.length, 2);
  } finally {
    mock.timers.reset();
  }
});
