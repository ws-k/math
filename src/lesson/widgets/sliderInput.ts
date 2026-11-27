// 슬라이더 줄(이름 · 막대 · 값 글자) 공용 장치. 좌표평면과 수직선이 같이 쓴다 — 두 부품이 같은 손 처리를 따로 들면
// 한쪽만 고쳐지기 쉽다(손으로 놓음/키 놓음 구분, 끄는 중 직접 적용, 낭독 글자).
//
// 끄는 동안은 React 렌더 없이(P8) 부품의 input 이 그림을 직접 고치고, 돌려준 글자로 옆 숫자·aria-valuetext 를 고친다.
// 놓음(change)은 손으로 끈 것(pointerdown ~ 놓을 때의 change)이면 hand — 목표 판정을 바로 하고, 나머지 change(방향키,
// 키 이벤트 없이 change 만 보내는 보조기기)는 키처럼 멈출 때 한 번 판정하게 hand=false 로 알린다.
import { setText } from './draw.ts';

/** 슬라이더 글자: 검산기(verify.py)가 기호로 미리 둔 글자 중 수식에 흔한 것. x·y(축)·e·i(상수)는 뺀다 */
export const SLIDER_ID = /^[abcdhkmnpqrst]$/;
export const SLIDER_ID_MSG = '식에 쓸 수 있는 한 글자(a·b·c·d·h·k·m·n·p·q·r·s·t)';

export interface SliderHandlers {
  /**
   * 손가락·마우스로 잡기 시작. false 면 이 손짓을 받지 않는다(부품 안에서 다른 것을 끄는 중, P9) — 막대가 움직여도
   * 값을 되돌리고 놓음도 알리지 않는다
   */
  grab?(): boolean;
  /** 잡았던 손을 뗌(pointerup·pointercancel) */
  release?(): void;
  /** 움직이는 중의 값(숫자가 아니면 부르지 않는다). 돌려준 글자를 옆 숫자·낭독 글자로 쓴다 */
  input(v: number, el: HTMLInputElement): string | undefined;
  /** 놓음. hand = 손으로 끈 것 */
  change(hand: boolean): void;
  blur?(): void;
}

/**
 * 입력 요소에 붙이고 떼는 함수를 돌려준다(React 없이 시험하려고 뺐다). get 은 늘 최신 손잡이 — 부품이 다시 그려져도
 * 한 번 붙인 듣기를 다시 걸지 않고 마지막으로 그린 부품의 처리를 부른다(옛 처리를 붙잡으면 장면 끝 여부 등이 낡는다).
 */
export function attachSlider(
  el: HTMLInputElement,
  out: () => Element | null,
  get: () => SliderHandlers,
  win: Window = window,
): () => void {
  let hand = false;
  /** 이 손짓을 거절했나(그동안 값은 잡기 전 값으로 되돌린다) */
  let refused: string | null = null;
  const up = () => {
    win.removeEventListener('pointerup', up);
    win.removeEventListener('pointercancel', up);
    if (refused !== null) {
      el.value = refused;
      refused = null;
      return;
    }
    get().release?.();
    // 놓을 때의 change 는 pointerup 바로 뒤에 온다 — 그것까지 손으로 치고 끝낸다
    setTimeout(() => {
      hand = false;
    }, 0);
  };
  const down = (e: Event) => {
    win.addEventListener('pointerup', up);
    win.addEventListener('pointercancel', up);
    if (get().grab?.() === false) {
      e.preventDefault();
      refused = el.value;
      return;
    }
    hand = true;
  };
  const input = () => {
    if (refused !== null) {
      el.value = refused;
      return;
    }
    const v = Number(el.value);
    if (el.value === '' || !Number.isFinite(v)) return;
    const t = get().input(v, el);
    if (t === undefined) return;
    const o = out();
    if (o) setText(o, t);
    // 화면 낭독기도 원시 값(칸 번호·0.785…) 대신 보이는 글자(t = 3/2·π/4)를 읽게
    el.setAttribute('aria-valuetext', t);
  };
  const change = () => {
    if (refused !== null) return;
    get().change(hand);
  };
  const blur = () => get().blur?.();
  el.addEventListener('pointerdown', down);
  el.addEventListener('input', input);
  el.addEventListener('change', change);
  el.addEventListener('blur', blur);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('input', input);
    el.removeEventListener('change', change);
    el.removeEventListener('blur', blur);
    win.removeEventListener('pointerup', up);
    win.removeEventListener('pointercancel', up);
  };
}
