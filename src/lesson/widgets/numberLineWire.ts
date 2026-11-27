// 수직선 화면의 배선(React 밖): 손잡이 잡기·놓기·키 이동이 상태·목표 판정·안내 글로 이어지는 순서.
// 화면(NumberLine.tsx)에서 떼어 둔 까닭: 판정기(useGoal)의 미룬 키 판정, 끌기 그림(useWidgetDrag), 놓침 세기가
// 한 손짓 안에서 얽혀 순서가 틀리면 화면이 옛 상태로 굳는다(검토 M2 — 키로 도착 칸에 둔 직후 잡으면 그 판정이
// 끌기 도중 끝나 손잡이가 사라지고, 취소된 끌기가 옛 점프 수로 그림을 덮었다). 여기 두면 테스트가 같은 순서로 부른다.
//
// 판정 규칙: 손을 떼면 바로(P3), 키·◀▶ 는 멈춘 뒤 한 번(useGoal). 놓침(엉뚱한 칸·그냥 누르기)만 세어 두 번째에
// 눌러서 하기를 켠다(P4, drag.ts missHint). 키는 세지 않는다 — 키를 쓰는 사람은 이미 끌기 말고 다른 길로 하고 있다.
import { missHint, TAP_ON } from '../drag.ts';
import type { GoalProgress } from '../goal.ts';
import {
  cellOfHandle,
  JUMPER,
  jumpGuide,
  jumpHits,
  type NLParams,
  type NLState,
  nlDrag,
  nlDraw,
  nlKey,
} from './numberLine.ts';
import type { GoalJudge } from './useGoal.ts';

export type NLMsg = { text: string; cls: '' | 'ok' | 'bad' };

export interface NLWireDeps {
  judge: GoalJudge;
  /** 최신 상태. 렌더를 기다리지 않고 바로 읽고 쓴다(끄는 중·미룬 판정이 렌더 사이에 온다) */
  live: { current: NLState };
  /** 상태 반영(화면은 setState) */
  setState(s: NLState): void;
  /** 안내 한 줄(낭독기가 읽는 aria-live 칸) */
  say(m: NLMsg): void;
  onMiss(): void;
  /** 장면 끝(여러 번 불려도 화면이 한 번만 반영) */
  finish(): void;
  /** 놓침 수가 바뀜(눌러서 하기 단추를 보일지 화면이 정한다) */
  setFails(n: number): void;
}

/** 눌러서 하기에서 무엇을 누르나 */
const TAP_HOW = '◀ ▶ 로 한 칸씩 옮기면 돼요.';

export function nlWire(p: NLParams, d: NLWireDeps) {
  /** 부품 안에서 끄는 중인가(손잡이·슬라이더 공용, P9) */
  const busy = { current: false };
  /** 지금 끄는 손잡이와 잡은 칸(제자리에 놓으면 '그냥 누르기') */
  let active: { id: string; from: number } | null = null;
  let fails = 0;
  /** 지금 기다리는 판정이 키에서 온 것인가(손으로 놓은 판정은 놓을 때 바로 안내한다) */
  let viaKey = false;
  const jumpsDone = () => d.judge.get().seen.length;
  /** 마친 점프 수는 판정기 것 하나만 믿는다 — 끌기가 시작할 때 붙잡은 옛 상태에도 늘 지금 수를 넣어 그린다(M2) */
  const now = (s: NLState): NLState => ({ ...s, jump: jumpsDone() });
  const put = (n: NLState) => {
    d.live.current = n;
    d.setState(n);
  };
  const miss = (n: NLState, from: number) => {
    fails++;
    d.setFails(fails);
    d.onMiss();
    const moved = n.pts[JUMPER] !== from;
    const g = jumpGuide(p, n);
    const head =
      moved && g
        ? `그 자리가 아니에요. 출발점 ${g.from} 에서 ${g.dir}으로 ${g.amt} 만큼 옮겨요.`
        : '점을 끌어서 옮겨요.';
    d.say({
      text: missHint(fails) === 'tap' ? `${head} ${TAP_ON} ${TAP_HOW}` : head,
      cls: moved ? 'bad' : '',
    });
  };

  return {
    busy,
    jumpsDone,
    /** 끄는 동안·놓은 뒤 그림(useWidgetDrag 에 넘긴다) */
    draw: (s: NLState) => nlDraw(p, now(s)),
    /** 끄는 동안의 상태(시작 상태에서 dx 만큼) */
    move: (s: NLState, id: string, dx: number) => nlDrag(p, now(s), id, dx),
    /** 누른 순간 잡을지(동시 끌기 1개) */
    pick: () => !busy.current,
    grab(id: string) {
      busy.current = true;
      active = { id, from: cellOfHandle(d.live.current, id) };
      // 키로 옮긴 자리의 판정이 기다리는 중이면 지금 끝낸다 — 끄는 도중 타이머가 터지지 않게
      if (id === JUMPER) d.judge.flush();
    },
    letGo() {
      busy.current = false;
      active = null;
    },
    /** 놓은 상태 반영(useWidgetDrag 의 commit). 점프하는 점이면 그 자리를 판정 */
    release(n0: NLState): NLState {
      const n = now(n0);
      put(n);
      const a = active;
      if (a?.id === JUMPER) {
        const hit = jumpHits(p, n);
        viaKey = false;
        d.judge.release(hit);
        if (!hit.length) miss(n, a.from);
      } else if (!p.task && !p.jumps) d.finish(); // 과제·점프가 없으면 한 번 만져 보면 끝
      return now(n);
    },
    /** 방향키·◀▶ 한 칸. 다루지 않는 키면 false */
    step(id: string, key: string): boolean {
      const n = nlKey(p, now(d.live.current), id, key);
      if (!n) return false;
      put(n);
      if (id === JUMPER) {
        viaKey = true;
        d.judge.later(() => jumpHits(p, now(d.live.current)));
      } else if (!p.task && !p.jumps) d.finish();
      return true;
    },
    /** 판정마다(useGoal onJudge): 새로 도착했으면 안내를 비우고, 키 판정이 '아님'이면 낭독되게 알린다 */
    onJudge(g: GoalProgress) {
      const before = d.live.current.jump;
      d.live.current = { ...d.live.current, jump: g.seen.length };
      if (g.done) return;
      if (g.seen.length > before) d.say({ text: '', cls: '' });
      else if (viaKey) d.say({ text: '아직 도착 칸이 아니에요.', cls: '' });
    },
    /** 다 뛰었다(useGoal onDone). 점 찍기 과제가 있으면 그 점이 이제 나오고 '확인'으로 끝낸다 */
    onDone() {
      if (p.task) d.say({ text: '', cls: '' });
      else {
        d.say({ text: '다 옮겼어요.', cls: 'ok' });
        d.finish();
      }
    },
  };
}
