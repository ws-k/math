// 슬라이더 줄 하나(이름 · 막대 · 값 글자). 좌표평면·수직선 공용 — 모양(lesson.css .cslider)과 손 처리(sliderInput.ts)를
// 한 벌로 두어 두 부품의 슬라이더가 같은 높이·같은 손 느낌이게 한다. 값은 처음 한 번만 정하고(defaultValue) 그 뒤로는
// 손이 움직인 값을 브라우저가 쥔다 — 끄는 동안 React 가 value 를 되돌려 쓰지 않게(P8).
import { useEffect, useRef } from 'react';
import { LRich } from '../ui.tsx';
import { attachSlider, type SliderHandlers } from './sliderInput.ts';

export interface SliderRowProps {
  /** 이름(수식 가능: "시각 $t$") */
  label: string;
  min: number;
  max: number;
  step: number;
  /** 처음 값 */
  value: number;
  /** 지금 값 글자(옆 숫자·낭독 글자). 끄는 동안은 input 이 돌려준 글자로 직접 고친다 */
  text: string;
  h: SliderHandlers;
}

export function SliderRow(p: SliderRowProps) {
  const input = useRef<HTMLInputElement>(null);
  const out = useRef<HTMLElement>(null);
  const h = useRef(p.h);
  h.current = p.h;
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    return attachSlider(
      el,
      () => out.current,
      () => h.current,
    );
  }, []);
  return (
    <label className="cslider">
      <LRich inline src={p.label} />
      <input
        ref={input}
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        defaultValue={p.value}
        aria-valuetext={p.text}
      />
      <b className="num" ref={out}>
        {p.text}
      </b>
    </label>
  );
}
