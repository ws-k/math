// 항 끌기 화면. 칩을 등호 건너편으로 끌면 부호가 바뀐다. 탭 대체 버튼("끌기 어려우면 눌러서 보내기")이 늘 있다.
// 끄는 동안은 useDrag 가 프레임마다 한 번 부르는 onMove 에서 칩의 transform 만 직접 고친다(React 렌더 없음).
// 손을 떼면 상태(옮겼나)를 한 번 바꾸고, 바뀐 자리에서 원래 자리로 되짚어 오는 애니메이션(FLIP)을 건다.
// 보일 항과 부호는 layout()(검산과 같은 함수)이 정한다 — 화면이 따로 늘어놓지 않는다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { crossedSign } from '../drag.ts';
import { LRich, reducedMotion, Tex } from '../ui.tsx';
import { useDrag } from '../useDrag.ts';
import type { WidgetProps } from './index.tsx';
import { layout, type ShownTerm, type TermDragParams, termDragDef, termTex } from './termDrag.ts';

/** 칩 글자가 바뀌는 시점: 날아가는 중간쯤(미리보기와 같은 0.2초) */
const LABEL_MS = 200;
/** 이만큼 끌고 놓쳤으면 '틀린 시도'로 센다(살짝 건드린 것은 세지 않는다) */
const MISS_PX = 24;

type Rect = { left: number; top: number };

export function TermDrag({ params: p, onDone, onMiss }: WidgetProps<TermDragParams>) {
  const [flipped, setFlipped] = useState(false);
  const [labelFlipped, setLabelFlipped] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const eq = useRef<HTMLSpanElement>(null);
  /** 상태가 바뀐 뒤 새 자리에서 시작할 애니메이션(옛 자리, 포물선 여부) */
  const pending = useRef<{ first: Rect; arc: boolean } | null>(null);
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  const animateFrom = (first: Rect, arc: boolean) => {
    const el = chip.current;
    if (!el || reducedMotion()) return;
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const frames = arc
      ? [
          { transform: `translate(${dx}px,${dy}px)` },
          { transform: `translate(${dx / 2}px,-34px)`, offset: 0.5 },
          { transform: 'none' },
        ]
      : [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }];
    el.animate(frames, { duration: arc ? 560 : 320, easing: 'cubic-bezier(.3,.7,.3,1)' });
  };

  const toggle = (first: Rect, arc: boolean) => {
    pending.current = { first, arc };
    const next = !flippedRef.current;
    setFlipped(next);
    if (next) onDone();
  };

  useLayoutEffect(() => {
    const pd = pending.current;
    pending.current = null;
    if (pd) animateFrom(pd.first, pd.arc);
  });

  useEffect(() => {
    if (reducedMotion()) {
      setLabelFlipped(flipped);
      return;
    }
    const t = setTimeout(() => setLabelFlipped(flipped), LABEL_MS);
    return () => clearTimeout(t);
  }, [flipped]);

  const crossed = () => {
    const c = chip.current?.getBoundingClientRect();
    const e = eq.current?.getBoundingClientRect();
    if (!c || !e) return false;
    return crossedSign((c.left + c.right) / 2, e, flippedRef.current ? 'left' : 'right');
  };

  // 끄는 중 표시는 data- 속성으로 — className 을 직접 고치면 React 가 다시 그릴 때 지워진다
  useDrag(chip, {
    onStart() {
      const el = chip.current;
      if (!el) return;
      for (const a of el.getAnimations()) a.cancel();
      el.dataset.dragging = '';
    },
    onMove(dx, dy) {
      const el = chip.current;
      if (!el) return;
      el.style.transform = `translate(${dx}px,${dy}px)`;
      if (crossed()) el.dataset.ready = '';
      else delete el.dataset.ready;
    },
    onEnd(dx, dy, cancelled) {
      const el = chip.current;
      if (!el) return;
      const go = !cancelled && crossed();
      const first = el.getBoundingClientRect();
      el.style.transform = '';
      delete el.dataset.dragging;
      delete el.dataset.ready;
      if (go) toggle(first, false);
      else {
        animateFrom(first, false);
        if (!cancelled && !flippedRef.current && Math.hypot(dx, dy) > MISS_PX) onMiss();
      }
    },
  });

  const shown = layout(p, flipped);
  const mover = layout(p, labelFlipped);
  const label = [...mover.lhs, ...mover.rhs].find((t) => t.mover)?.sym ?? '';
  const term = (t: ShownTerm) =>
    t.mover ? (
      <button
        type="button"
        key={t.key}
        ref={chip}
        className={`mover num${labelFlipped ? ' flipped' : ''}`}
        aria-label={`${label} 옮기기`}
        // 손가락·펜 끌기는 useDrag 가 맡는다. 클릭은 키보드(Enter·Space, detail=0)만 받아 옮긴다 —
        // 끌고 난 뒤 따라오는 click 으로 한 번 더 옮겨지지 않게.
        onClick={(e) => {
          if (e.detail === 0 && chip.current) toggle(chip.current.getBoundingClientRect(), true);
        }}
      >
        <Tex tex={termTex(label)} />
      </button>
    ) : (
      <Tex key={t.key} tex={termTex(t.sym)} />
    );
  // 칩이 등호 건너편으로 가도 같은 DOM 노드로 남아야 끌기 처리기가 붙어 있다. 그래서 줄 전체를 key 붙은
  // 한 목록(배열 하나)으로 만들어 React 가 칩을 "옮기게"(새로 만들지 않게) 한다. key 는 원래 자리 번호다.
  return (
    <>
      <div className="jumpline">
        {[
          ...shown.lhs.map(term),
          <span className="eqsign" ref={eq} key="eq">
            <Tex tex="=" />
          </span>,
          ...shown.rhs.map(term),
        ]}
      </div>
      <button
        type="button"
        className="lbtn soft"
        onClick={() => {
          if (chip.current) toggle(chip.current.getBoundingClientRect(), true);
        }}
      >
        {flipped ? '되돌리기' : '끌기 어려우면 눌러서 보내기'}
      </button>
      <div aria-live="polite">{flipped && <LRich src={p.note} vars={termDragDef.vars?.(p)} />}</div>
    </>
  );
}
