// 쪽 하나 = 스크롤되는 내용 상자 + 그 위에 얹는 필기 엔진.
// 펜 입력은 엔진이 React 밖에서 캔버스에 직접 그린다. 여기서는 만들고/없애고/저장만 한다 —
// 그리는 동안 React 상태를 건드리면 렌더가 끼어들어 획이 끊겨 보이기 때문이다.
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { createInkSurface } from '../ink/surface.ts';
import type { Background, InkDoc, InkSurface, Tool } from '../ink/types.ts';
import { saver, store } from './store.ts';

/** 도구 막대가 "마지막으로 펜을 댄 쪽"에 실행 취소 등을 보내기 위한 연결 고리 */
export interface InkControl {
  register(key: string, s: InkSurface): void;
  unregister(key: string): void;
  penActive(key: string, active: boolean): void;
}

const SAVE_DELAY = 400;
/**
 * 교재 쪽 내용을 배치하는 고정 폭(CSS px). 쪽 폭이 기기·방향마다 달라도 글자 줄바꿈이 같아야
 * 종이 좌표로 저장한 필기가 늘 같은 글자 위에 얹힌다. 그래서 이 폭으로 배치한 뒤 쪽 폭에 맞게
 * 통째로 확대·축소한다(transform 이라 글자와 필기가 같은 비율로 움직인다).
 */
export const FIT_WIDTH = 460;

export function InkPage(p: {
  inkKey: string;
  grow: boolean;
  tool: Tool;
  background: Background;
  ctl: InkControl;
  /** 내용을 FIT_WIDTH 로 배치하고 쪽 폭에 맞춰 축소·확대할지 (글자가 있는 쪽 = true) */
  fit?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const fitBox = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const surf = useRef<InkSurface | null>(null);
  // 엔진은 쪽이 바뀔 때만 다시 만든다. 도구·배경은 아래 효과에서 setTool 등으로 바꾸므로
  // 만드는 효과의 의존성에 넣지 않고 최신 값을 ref 로 읽는다.
  const latest = useRef({ tool: p.tool, background: p.background });
  latest.current = { tool: p.tool, background: p.background };
  const { inkKey, grow, ctl } = p;

  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: InkDoc | null = null;
    const flush = () => {
      clearTimeout(timer);
      // 실패하면 saver 가 값을 쥐고 다시 시도한다(화면 위에 경고)
      if (pending) saver.save(inkKey, pending);
      pending = null;
    };
    // iOS 는 홈 화면 앱을 예고 없이 내리므로 화면이 가려질 때 바로 저장한다.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);

    void store.get<InkDoc>(inkKey).then((saved) => {
      const el = host.current;
      if (dead || !el) return;
      // 새 쪽은 지금 보이는 내용 높이만큼의 종이로 시작한다(종이 너비 = 1000).
      const height = (el.scrollHeight / Math.max(1, el.clientWidth)) * 1000;
      const s = createInkSurface(el, {
        doc: saved ?? { strokes: [], height },
        grow,
        background: latest.current.background,
        tool: latest.current.tool,
        onChange(doc) {
          pending = doc;
          clearTimeout(timer);
          timer = setTimeout(flush, SAVE_DELAY);
        },
        onPenActive(active) {
          ctl.penActive(inkKey, active);
        },
      });
      surf.current = s;
      ctl.register(inkKey, s);
    });
    return () => {
      dead = true;
      // destroy 가 그리던 획을 마무리하며 onChange 를 부르므로, 그 뒤에 flush 해야 그 획까지 저장된다
      surf.current?.destroy();
      surf.current = null;
      flush();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      ctl.unregister(inkKey);
    };
  }, [inkKey, grow, ctl]);

  useEffect(() => {
    surf.current?.setTool(p.tool);
  }, [p.tool]);
  useEffect(() => {
    surf.current?.setBackground(p.background);
  }, [p.background]);

  const { fit } = p;
  useLayoutEffect(() => {
    const sc = scroll.current;
    const el = host.current;
    const box = fitBox.current;
    if (!fit || !sc || !el || !box) return;
    const apply = () => {
      const w = sc.clientWidth;
      if (w === 0) return; // 숨긴 쪽 — 보이게 되면 크기가 바뀌어 다시 불린다
      const k = w / FIT_WIDTH;
      el.style.transform = `scale(${k})`;
      // 내용이 짧아도 쪽 끝까지 필기할 수 있게 (줄어든 뒤 높이 = 보이는 쪽 높이)
      el.style.minHeight = `${sc.clientHeight / k}px`;
      // transform 은 배치 크기를 바꾸지 않으므로, 바깥 상자 높이를 줄어든 높이로 맞춰 스크롤 길이를 맞춘다
      box.style.height = `${el.offsetHeight * k}px`;
    };
    const ro = new ResizeObserver(apply);
    ro.observe(sc);
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [fit]);

  const hostEl = (
    <div ref={host} className={`page-host ${fit ? 'fit' : ''} ${p.className ?? ''}`}>
      {p.children}
    </div>
  );
  return (
    <div ref={scroll} className="page-scroll">
      {fit ? (
        <div ref={fitBox} className="page-fit">
          {hostEl}
        </div>
      ) : (
        hostEl
      )}
    </div>
  );
}
