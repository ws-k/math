// 분수 조각 화면. 상태 → 그릴 것은 fraction.ts(fDraw)가 정하고 여기서는 그리기만 한다.
// 끄는 것 두 가지: 아래 막대 묶음(위 막대로 끌어 놓으면 합치기·놓기)과 다시 자르기 슬라이더.
// 둘 다 끄는 동안에는 applyDrawing 으로 SVG 만 고치고(React 렌더 없음), 놓을 때 한 번 상태를 바꾼다.
// 슬라이더도 조각 칸을 최대 수만큼 미리 그려 두고 보이기만 바꾸므로 직접 고치기가 된다.
// 탭 대체: '위로 보내기'·'한 조각 놓기' 버튼, 슬라이더 옆 −·+ 버튼, 곱 손잡이의 ± 버튼.
import { useContext, useEffect, useRef, useState } from 'react';
import { DragGuard } from '../dragGuard.ts';
import { Tex } from '../ui.tsx';
import { DragHandle } from './DragHandle.tsx';
import { applyDrawing } from './draw.ts';
import {
  divMax,
  dropDy,
  type FParams,
  type FState,
  type FView,
  fDone,
  fDraw,
  fHeight,
  fInit,
  fMerge,
  fMulDrag,
  fMulMax,
  fRowB,
  fSay,
  fTex,
  MUL,
  W,
} from './fraction.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import { useSvgDrag, useWidgetDrag } from './useWidgetDrag.ts';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };
const inB = (k: string) => /^(B|GB|UB):/.test(k);

export function Fraction({ params: p, onDone, onMiss }: WidgetProps<FParams>) {
  const [s, setS] = useState<FState>(() => fInit(p));
  const [msg, setMsg] = useState<Msg>({ text: '', cls: '' });
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const draw = (v: FView) => fDraw(p, v);

  const settle = (n: FState) => {
    setS(n);
    if (!done.current && fDone(p, n)) {
      done.current = true;
      onDone();
    }
  };
  const send = (base: FState): FState => {
    const r = fMerge(p, base);
    setMsg({ text: fSay(p, r.s, r.ok), cls: r.ok ? 'ok' : 'bad' });
    if (r.ok) settle(r.s);
    else onMiss();
    return r.ok ? r.s : base;
  };

  const still = !!p.still;
  const canSend = still
    ? false
    : p.mode === 'add' || p.mode === 'sub'
      ? !s.merged
      : p.mode === 'div' && s.placed < divMax(p);
  const drag = useWidgetDrag<FView>(root, { s, off: null }, draw, (v) => {
    // 위 막대 쪽으로 충분히 올려 놓았을 때만 보내기. 아니면 제자리로 돌아간다
    const sent = v.off && v.off[1] < dropDy(p) ? send(v.s) : v.s;
    return { s: sent, off: null };
  });
  const bgrp = useRef<SVGGElement>(null);
  const g = drag((v, dx, dy) => ({ s: v.s, off: canSend ? [dx, dy] : null }));
  useSvgDrag(bgrp, g);

  const d = draw({ s, off: null });
  const reset = () => {
    setS(fInit(p));
    setMsg({ text: '', cls: '' });
  };

  return (
    <div className="wgt fr" ref={root}>
      <div className="wgt-head" aria-live="polite">
        <Tex tex={fTex(p, s)} />
      </div>
      {p.mode === 'mul' ? (
        <MulBoard p={p} s={s} settle={settle} />
      ) : (
        <svg viewBox={`0 0 ${W} ${fHeight(p)}`} className="wgt-svg">
          <title>분수 조각</title>
          <Marks marks={d.marks.filter((m) => !inB(m.k) && m.k !== 'bgrp')} />
          <g
            ref={bgrp}
            data-k="bgrp"
            transform="translate(0 0)"
            className={canSend ? 'fgrab' : undefined}
            style={canSend ? { touchAction: 'none' } : undefined}
          >
            {/* 막대가 44 단위라 누르는 영역을 56 이상으로 넓힌다 */}
            <rect
              x={8}
              y={fRowB(p) - 10}
              width={W - 16}
              height={fHeight(p) - fRowB(p) + 6}
              fill="transparent"
            />
            <Marks marks={d.marks.filter((m) => inB(m.k))} />
          </g>
        </svg>
      )}
      {p.cut && p.mode !== 'mul' && <CutSlider p={p} s={s} settle={settle} lock={s.merged} />}
      <div className="wgt-ctl" hidden={still}>
        {(p.mode === 'add' || p.mode === 'sub') && (
          <button type="button" className="lbtn soft" disabled={!canSend} onClick={() => send(s)}>
            {p.mode === 'add' ? '아래 조각 위로 보내기' : '아래만큼 덜어 내기'}
          </button>
        )}
        {p.mode === 'div' && (
          <button type="button" className="lbtn soft" disabled={!canSend} onClick={() => send(s)}>
            한 조각 놓기
          </button>
        )}
        {p.mode === 'compare' &&
          ([1, 0, -1] as const).map((v) => (
            <button
              type="button"
              key={v}
              className="lbtn soft"
              disabled={done.current}
              onClick={() => {
                if (fDone(p, { ...s, pick: v })) {
                  setMsg({ text: '맞아요.', cls: 'ok' });
                  settle({ ...s, pick: v });
                } else {
                  setMsg({ text: '다시 보세요. 같은 크기 조각으로 잘라 세면 보여요.', cls: 'bad' });
                  onMiss();
                }
              }}
            >
              {v > 0 ? '위가 더 커요' : v === 0 ? '같아요' : '아래가 더 커요'}
            </button>
          ))}
        <button type="button" className="lbtn quiet" onClick={reset}>
          처음부터 다시
        </button>
      </div>
      <div className={`toast ${msg.cls}`} aria-live="polite">
        {msg.text}
      </div>
    </div>
  );
}

/** 다시 자르기 슬라이더. 끄는 동안(input)은 그림만 직접 고치고, 놓을 때(change) 상태를 바꾼다 */
function CutSlider({
  p,
  s,
  settle,
  lock,
}: {
  p: FParams;
  s: FState;
  settle(n: FState): void;
  lock: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const guard = useContext(DragGuard);
  // 처리기는 한 번만 붙인다. 최신 상태·매개변수는 ref 로 읽는다 — 렌더마다 붙였다 떼면 떼는 순간
  // '끄는 중' 표시가 풀려(다른 끌기가 진행 중이어도) 하단 '계속하기'가 열려 버린다(헤드리스 실측).
  const latest = useRef({ s, p, settle });
  latest.current = { s, p, settle };
  const cut = p.cut as { min: number; max: number };
  useEffect(() => {
    const el = ref.current;
    if (el) el.value = String(s.d ?? cut.min);
  }, [s.d, cut.min]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.closest('.wgt');
    let held = false;
    const val = () => Number(el.value);
    const input = () => {
      const { s: cs, p: cp } = latest.current;
      if (root) applyDrawing(root, fDraw(cp, { s: { ...cs, d: val() }, off: null }));
    };
    const change = () => latest.current.settle({ ...latest.current.s, d: val() });
    const down = () => {
      held = true;
      guard(true);
    };
    const up = () => {
      if (!held) return;
      held = false;
      guard(false);
    };
    el.addEventListener('input', input);
    el.addEventListener('change', change);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('input', input);
      el.removeEventListener('change', change);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      up();
    };
  }, [guard]);
  const bump = (by: number) => {
    const v = Math.min(cut.max, Math.max(cut.min, (s.d ?? cut.min - by) + by));
    settle({ ...s, d: v });
  };
  return (
    <div className="fcut">
      <div className="fcut-label">
        다시 자르기 · <b data-t="cut">{s.d === null ? '처음 그대로' : `한 칸을 ${s.d}조각으로`}</b>
      </div>
      <div className="fcut-row">
        <button
          type="button"
          className="lbtn soft"
          aria-label="한 조각 덜 자르기"
          disabled={lock || (s.d ?? cut.min) <= cut.min}
          onClick={() => bump(-1)}
        >
          −
        </button>
        <input
          ref={ref}
          type="range"
          min={cut.min}
          max={cut.max}
          step={1}
          defaultValue={s.d ?? cut.min}
          disabled={lock}
          aria-label="한 칸을 몇 조각으로 자를까요"
          aria-valuetext={s.d === null ? '처음 그대로' : `${s.d}조각`}
        />
        <button
          type="button"
          className="lbtn soft"
          aria-label="한 조각 더 자르기"
          disabled={lock || (s.d ?? cut.min - 1) >= cut.max}
          onClick={() => bump(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** 곱 넓이 모형: 가로(a)·세로(b) 손잡이를 끌어 칠한다. 겹친 칸이 곱이다 */
function MulBoard({ p, s, settle }: { p: FParams; s: FState; settle(n: FState): void }) {
  const root = useRef<HTMLDivElement>(null);
  const draw = (v: FView) => fDraw(p, v);
  const drag = useWidgetDrag<FView>(root, { s, off: null }, draw, (v) => {
    settle(v.s);
    return v;
  });
  const d = draw({ s, off: null });
  const { x0, y0, S } = MUL;
  const la = fMulMax(p, 'wa');
  const lb = fMulMax(p, 'hb');
  const set = (id: 'wa' | 'hb', k: number) => {
    const max = fMulMax(p, id);
    settle({ ...s, [id]: Math.min(max, Math.max(0, k)) });
  };
  const key = (id: 'wa' | 'hb') => (k: string) => {
    const v = s[id];
    const m: Record<string, number> = {
      ArrowRight: v + 1,
      ArrowUp: v - 1,
      ArrowLeft: v - 1,
      ArrowDown: v + 1,
    };
    if (id === 'wa') {
      m.ArrowUp = v + 1;
      m.ArrowDown = v - 1;
    }
    const n = m[k];
    if (n === undefined) return false;
    set(id, n);
    return true;
  };
  const tr = (k: string) => {
    const t = String(d.marks.find((m) => m.k === k)?.a.transform);
    const [, x = '0', y = '0'] = t.match(/\(([-\d.]+) ([-\d.]+)\)/) ?? [];
    return { x: Number(x), y: Number(y) };
  };
  return (
    <div ref={root} className="fmul">
      <svg viewBox={`0 0 ${W} ${MUL.y0 + S + 16}`} className="wgt-svg">
        <title>분수의 곱 넓이 모형</title>
        <rect x={x0} y={y0} width={S} height={S} className="funit" />
        <Marks marks={d.marks.filter((m) => !m.k.startsWith('h:'))} />
        {Array.from({ length: la - 1 }, (_, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: 칸 선 순서는 분모에서 고정
            key={`v${i}`}
            x1={x0 + ((i + 1) * S) / la}
            y1={y0}
            x2={x0 + ((i + 1) * S) / la}
            y2={y0 + S}
            className="fgrid"
          />
        ))}
        {Array.from({ length: lb - 1 }, (_, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: 위와 같음
            key={`h${i}`}
            x1={x0}
            y1={y0 + ((i + 1) * S) / lb}
            x2={x0 + S}
            y2={y0 + ((i + 1) * S) / lb}
            className="fgrid"
          />
        ))}
        {(['wa', 'hb'] as const).map((id) => {
          const h = drag((v, dx, dy) => ({ s: fMulDrag(p, v.s, id, dx, dy), off: null }));
          const at = tr(`h:${id}`);
          return (
            <DragHandle
              key={id}
              k={`h:${id}`}
              x={at.x}
              y={at.y}
              label={id === 'wa' ? '가로로 칠할 칸' : '세로로 칠할 칸'}
              value={s[id]}
              min={0}
              max={fMulMax(p, id)}
              valueText={id === 'wa' ? `가로 ${s.wa}/${la}` : `세로 ${s.hb}/${lb}`}
              onKey={key(id)}
              onStart={h.onStart}
              onMove={h.onMove}
              onEnd={h.onEnd}
            />
          );
        })}
      </svg>
      <div className="wgt-read" aria-live="polite">
        {(['wa', 'hb', 'ov'] as const).map((k) => (
          <span key={k} data-t={k} className={`num t-${k}`}>
            {d.texts[k]}
          </span>
        ))}
      </div>
      {/* 접은 화면에서는 ± 넷을 한 줄에(widgets.css .one-row — 넓은 화면은 그대로 줄바꿈) */}
      <div className="wgt-ctl one-row">
        <button type="button" className="lbtn soft" onClick={() => set('wa', s.wa - 1)}>
          가로 −
        </button>
        <button type="button" className="lbtn soft" onClick={() => set('wa', s.wa + 1)}>
          가로 +
        </button>
        <button type="button" className="lbtn soft" onClick={() => set('hb', s.hb - 1)}>
          세로 −
        </button>
        <button type="button" className="lbtn soft" onClick={() => set('hb', s.hb + 1)}>
          세로 +
        </button>
      </div>
    </div>
  );
}
