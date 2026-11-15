// 부품 목표의 판정 시점과 React 배선. 좌표평면·도형판이 같이 쓴다 — 판정 규칙(goal.ts)이 같아도
// "언제 판정하나"가 부품마다 다르면 학습자가 두 규칙을 익혀야 한다.
//
// 끌어서 놓으면 바로 판정한다(원칙 P3, 손을 뗀 자리). 키·◀▶ 버튼은 한 번 누를 때마다가 아니라 마지막 입력 뒤
// GOAL_KEY_IDLE_MS 동안 멈추거나 포커스가 떠날 때 그 자리 하나만 판정한다: 누를 때마다 판정하면 연타로 숨긴
// 정답 위를 지나가기만 해도 맞았다고 세고(더듬어 찾기), 여덟 칸 움직이기만 해도 힌트가 뜬다(리뷰 M3).
import { useEffect, useRef, useState } from 'react';
import { type GoalProgress, goalRelease, goalStart } from '../goal.ts';

/** 키·버튼 입력이 이만큼 멈추면 그 자리를 '손을 뗀 자리'로 본다 */
export const GOAL_KEY_IDLE_MS = 600;

export interface GoalJudge {
  /** 손을 뗀 자리: 바로 판정. 기다리던 키 판정은 버린다(지금 자리가 최신이다) */
  release(hits: readonly string[]): void;
  /** 키·버튼 한 번: 판정을 미룬다. 멈추거나(flush) 포커스가 떠나면 마지막에 넘긴 자리 하나만 판정 */
  later(hits: () => readonly string[]): void;
  /** 미룬 판정을 지금(포커스가 떠남). 미룬 것이 없으면 아무것도 안 함 */
  flush(): void;
  /** 미룬 판정을 버린다(화면이 사라짐) */
  cancel(): void;
  get(): GoalProgress;
}

/**
 * 판정기(React 밖 — 타이머만 쓴다). judged 는 판정할 때마다, done 은 처음 이뤘을 때 한 번.
 * hits 를 함수로 받는 것은 판정하는 순간의 최신 자리를 보게 하려는 것이다.
 */
export function goalJudge(
  need: number,
  on: { judged(g: GoalProgress): void; done(): void },
): GoalJudge {
  let g = goalStart();
  let pending: (() => readonly string[]) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const judge = (hits: readonly string[]) => {
    const was = g.done;
    g = goalRelease(g, hits, need);
    on.judged(g);
    if (g.done && !was) on.done();
  };
  const flush = () => {
    stop();
    const h = pending;
    pending = null;
    if (h) judge(h());
  };
  return {
    release(hits) {
      stop();
      pending = null;
      judge(hits);
    },
    later(hits) {
      pending = hits;
      stop();
      timer = setTimeout(flush, GOAL_KEY_IDLE_MS);
    },
    flush,
    cancel() {
      stop();
      pending = null;
    },
    get: () => g,
  };
}

/**
 * 부품의 목표 배선: 진행 상태(화면 글용)와 판정기. onJudge 는 판정마다(좌표평면이 숨긴 정답을 그릴 때),
 * onDone 은 처음 이뤘을 때 한 번(장면 완료 기록). 두 함수는 최신 것을 부른다(타이머가 옛 함수를 잡지 않게).
 */
export function useGoal(
  need: number,
  onDone: () => void,
  onJudge?: (g: GoalProgress) => void,
): { prog: GoalProgress; judge: GoalJudge } {
  const [prog, setProg] = useState<GoalProgress>(goalStart);
  const cb = useRef({ onDone, onJudge });
  cb.current = { onDone, onJudge };
  const ref = useRef<GoalJudge | null>(null);
  if (!ref.current)
    ref.current = goalJudge(need, {
      judged(g) {
        setProg(g);
        cb.current.onJudge?.(g);
      },
      done: () => cb.current.onDone(),
    });
  const judge = ref.current;
  useEffect(() => () => judge.cancel(), [judge]);
  return { prog, judge };
}
