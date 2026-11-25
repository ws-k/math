// 끌어 놓기 공용 장치: 물건 하나를 손으로 들어 다른 칸에 놓는 부품(count 의 칩·카드, 저울의 컵·동전)이 같이 쓴다.
// 끄는 동안은 그 요소의 transform 만 직접 고치고(React 렌더 0회, P8), 손을 떼면 놓인 자리 그대로 onDrop 에 넘긴다 —
// 어느 칸에 놓였는지는 부품마다 판이 달라 받는 쪽이 정한다(P3: 끄는 도중에는 맞다/틀리다 신호가 없다).
// 두 부품이 같은 손 처리를 따로 들고 있으면 한쪽만 고쳐지기 쉬워(취소 처리·잠금 풀기) 한 곳에 둔다.
// 놓은 뒤 날아가기(FLIP)는 fly.ts, 누르기·놓친 끌기 기준(TAP_PX·FAILS_FOR_TAP)과 상자 판정은 drag.ts 에 있다.
import { type RefObject, useRef } from 'react';
import { type DragHandlers, useDrag } from '../useDrag.ts';

export interface DropOpts {
  /** 부품 안에서 지금 끄는 것이 있나(동시 끌기 1개, P9). 부품의 물건들이 한 ref 를 나눠 쓴다 */
  busy: { current: boolean };
  /** 끌 수 없는 상태(더미 아래 장·다 맞힌 뒤). 잡지 않으므로 그 자리 쓸기는 페이지 스크롤로 남는다 */
  locked?: boolean | undefined;
  /** 끄는 동안 요소의 transform(누른 곳에서 움직인 거리 dx·dy, 화면 px) */
  follow(dx: number, dy: number): string;
  /**
   * 들어 올린 표시. 없으면 요소에 data-lift. 속성은 data- 로 — className 을 직접 고치면 React 가 다시 그릴 때 지워진다.
   * 저울은 끄는 물건이 다른 접시·바닥 아래로 숨지 않게 든 칸까지 올린다.
   */
  lift?(el: HTMLElement): void;
  /** 들어 올린 표시 지우기. 취소여도 부른다 */
  land?(el: HTMLElement): void;
  /** 손을 뗐을 때. el 은 아직 놓인 자리(transform)에 있다 — 자리를 잰 뒤 transform 을 지우는 건 받는 쪽 */
  onDrop(el: HTMLElement, dx: number, dy: number): void;
}

const liftSelf = (el: HTMLElement) => {
  el.dataset.lift = '';
};
const landSelf = (el: HTMLElement) => {
  delete el.dataset.lift;
};

/**
 * useDropDrag 의 알맹이(React 없이 시험하려고 뺐다). target = 끌 요소, get = 지금 설정(부품이 다시 그려질 때마다
 * 바뀐다 — 놓을 때는 마지막으로 그린 부품의 onDrop 을 쓴다).
 */
export function dropDrag(target: () => HTMLElement | null, get: () => DropOpts): DragHandlers {
  /** 끌기를 잡은 요소. 끄는 도중 요소가 사라져도(ref 가 비어도) 정리할 수 있게 쥐어 둔다 */
  let held: HTMLElement | null = null;
  return {
    pick() {
      const o = get();
      return !o.busy.current && !o.locked;
    },
    onStart() {
      const el = target();
      if (!el) return;
      const o = get();
      o.busy.current = true;
      held = el;
      // 아직 날아오는 중(놓은 뒤 FLIP)이면 멈춘다 — 저울 동전처럼 안쪽 요소가 따로 날아오기도 해서 안쪽까지
      for (const a of el.getAnimations({ subtree: true })) a.cancel();
      (o.lift ?? liftSelf)(el);
    },
    onMove(dx, dy) {
      if (held) held.style.transform = get().follow(dx, dy);
    },
    onEnd(dx, dy, cancelled) {
      const el = held;
      held = null;
      const o = get();
      // 잠금은 요소가 남아 있든 없든 먼저 푼다 — 끄는 도중 요소가 사라지면 ref 는 이미 비어 있다
      o.busy.current = false;
      if (!el) return;
      (o.land ?? landSelf)(el);
      if (cancelled || !el.isConnected) {
        el.style.transform = '';
        return;
      }
      o.onDrop(el, dx, dy);
    },
  };
}

/** 요소 하나에 끌어 놓기를 붙인다. 물건마다 하나씩이라 부품은 물건을 컴포넌트로 뺀다(훅은 반복문에서 못 부른다) */
export function useDropDrag(ref: RefObject<HTMLElement | null>, opts: DropOpts) {
  const latest = useRef(opts);
  latest.current = opts;
  // 손잡이 묶음은 한 번만 만든다 — 다시 그릴 때마다 새로 만들면 끄는 중 쥐어 둔 요소(held)를 잃는다
  const h = useRef<DragHandlers | null>(null);
  h.current ??= dropDrag(
    () => ref.current,
    () => latest.current,
  );
  useDrag(ref, h.current);
}
