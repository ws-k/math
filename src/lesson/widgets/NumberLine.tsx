// 수직선 화면. 상태 → 그릴 것은 numberLine.ts(nlDraw)가 정하고, 여기서는 그리기만 한다.
// 끄는 동안은 useWidgetDrag 가 SVG 를 직접 고치고(React 렌더 없음, P8), 놓을 때 한 번 상태를 바꾼다.
// 손잡이는 한 번에 하나만 잡힌다(P9): 손가락 둘이 두 점을 동시에 끌면 놓는 순서에 따라 한쪽 결과가 사라진다.
//
// 점프: 점을 다음 도착 칸에 '놓으면' 화살표가 생긴다(P2·P3). 판정 시점은 좌표평면·도형판과 같은 판정기(useGoal) —
// 손을 떼면 바로, 방향키·◀▶ 는 멈춘 뒤 0.6초(연타로 도착 칸을 지나가기만 해도 맞았다고 세지 않게).
// 두 번 놓치면(엉뚱한 칸·그냥 누르기) ◀▶ 단추가 나온다(P4 — 끌기가 어려운 사람의 신호, count·저울과 같은 기준).
// 점 찍기 점의 ◀▶ 는 예전처럼 늘 보인다: 점 찍기는 '확인'으로 채점해 놓을 때 판정이 없고, 지금 26장면의 화면을 그대로 둔다.
import { useEffect, useRef, useState } from 'react';
import { FAILS_FOR_TAP } from '../drag.ts';
import { LRich, Tex } from '../ui.tsx';
import { DragHandle } from './DragHandle.tsx';
import { applyDrawing } from './draw.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  cellOfHandle,
  ineqTex,
  JUMPER,
  jumpEnds,
  jumpHits,
  type NLParams,
  type NLState,
  nlActive,
  nlDrag,
  nlDraw,
  nlGrade,
  nlHeight,
  nlInit,
  nlKey,
  nlLine,
  nlRegion,
  nlSliderValues,
  nlTicks,
  valueAt,
  W,
  xOf,
} from './numberLine.ts';
import { num } from './q.ts';
import { useGoal } from './useGoal.ts';
import { useWidgetDrag } from './useWidgetDrag.ts';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };

const TAP_ON = '끌기가 어려우면 눌러도 돼요. ◀ ▶ 로 한 칸씩 옮기면 돼요.';

export function NumberLine({ params: p, onDone, onMiss }: WidgetProps<NLParams>) {
  const [s, setS] = useState<NLState>(() => nlInit(p));
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>({ text: '', cls: '' });
  const [done, setDone] = useState(false);
  /** 점프를 놓친 횟수(엉뚱한 칸에 놓기·그냥 누르기). FAILS_FOR_TAP 이면 ◀▶ 가 나온다 */
  const [fails, setFails] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  /** 부품 안에서 끄는 중인가(손잡이·슬라이더 공용, P9) */
  const busy = useRef(false);
  /** 지금 끄는 손잡이와 그 손잡이를 잡은 칸(제자리에 놓으면 '그냥 누르기'로 센다) */
  const active = useRef<{ id: string; from: number } | null>(null);
  const moves = p.jumps?.moves.length ?? 0;
  const finish = () => {
    if (done) return;
    setDone(true);
    onDone();
  };
  const { prog, judge } = useGoal(
    Math.max(1, moves),
    () => {
      // 다 뛰었다. 점 찍기 과제가 있으면 그 점이 이제 나오고 '확인'으로 끝낸다
      if (p.task) setMsg({ text: '', cls: '' });
      else {
        setMsg({ text: '다 옮겼어요.', cls: 'ok' });
        finish();
      }
    },
    (g) => {
      if (!g.done && g.seen.length > live.current.jump) setMsg({ text: '', cls: '' });
    },
  );
  // 마친 점프 수는 판정기가 센 것 하나만 믿는다(상태에 따로 들면 둘이 어긋날 수 있다)
  const st: NLState = { ...s, jump: prog.seen.length };
  const live = useRef(st);
  live.current = st;
  const jumpsDone = () => judge.get().seen.length;
  const jumping = !!p.jumps && st.jump < moves;

  /** 놓은 상태 반영(끌기). 점프하는 점이면 그 자리를 판정한다 */
  const release = (n0: NLState) => {
    const n = { ...n0, jump: jumpsDone() };
    setS(n);
    live.current = n;
    const a = active.current;
    if (a?.id === JUMPER) {
      const hit = jumpHits(p, n);
      judge.release(hit);
      if (!hit.length) {
        const f = fails + 1;
        setFails(f);
        const moved = n.pts[JUMPER] !== a.from;
        setMsg({
          text:
            f === FAILS_FOR_TAP
              ? TAP_ON
              : moved
                ? '그 자리가 아니에요. 다시 옮겨 보세요.'
                : '점을 끌어서 옮겨요.',
          cls: moved && f !== FAILS_FOR_TAP ? 'bad' : '',
        });
        onMiss();
      }
    } else if (!p.task && !p.jumps) finish(); // 과제·점프가 없는 부품은 한 번 만져 보면 목표를 이룬 것으로 본다
    return n;
  };
  const drag = useWidgetDrag(root, st, (x: NLState) => nlDraw(p, x), release);
  const d = nlDraw(p, st);
  const line = nlLine(p);

  const step = (id: string, key: string) => {
    const n = nlKey(p, live.current, id, key);
    if (!n) return false;
    setSel(id);
    setS(n);
    live.current = n;
    // 키·단추는 멈춘 뒤 그 자리 하나만 판정(연타로 도착 칸을 지나가도 세지 않게)
    if (id === JUMPER) judge.later(() => jumpHits(p, live.current));
    else if (!p.task && !p.jumps) finish();
    return true;
  };
  const check = () => {
    if (nlGrade(p, st)) {
      setMsg({ text: '맞아요.', cls: 'ok' });
      finish();
    } else {
      setMsg({ text: '아직 아니에요. 다시 옮겨 보세요.', cls: 'bad' });
      onMiss();
    }
  };

  // 슬라이더: 움직이는 동안은 그림만 직접 고치고(P8) 놓을 때(change) 한 번 상태로
  const values = nlSliderValues(p);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 슬라이더는 매개변수에서 고정. 최신 상태는 live 로 읽는다
  useEffect(() => {
    const el = slider.current;
    if (!el) return;
    const up = () => {
      busy.current = false;
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const down = (e: PointerEvent) => {
      // 다른 손가락이 점을 끄는 중이면 슬라이더는 잡지 않는다(P9)
      if (busy.current) {
        e.preventDefault();
        return;
      }
      busy.current = true;
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };
    const input = () => {
      const n = { ...live.current, sl: Number(el.value) };
      live.current = n;
      const d = nlDraw(p, n);
      if (root.current) applyDrawing(root.current, d);
      // 화면 낭독기도 칸 번호(3) 대신 보이는 값(t = 3/2)을 읽게 — 끄는 동안은 렌더 없이 직접 고친다
      el.setAttribute('aria-valuetext', d.texts.slider ?? '');
    };
    const change = () => {
      setS(live.current);
      if (!p.task && !p.jumps) finish();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('input', input);
    el.addEventListener('change', change);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('input', input);
      el.removeEventListener('change', change);
      up();
    };
  }, [p]);

  const handles = nlActive(p, st);
  const tapMode = fails >= FAILS_FOR_TAP;
  // ◀▶ 가 옮기는 점: 점프 중이면 (놓친 뒤) 점프하는 점, 아니면 고른 점(처음엔 첫 손잡이)
  const arrows = jumping
    ? tapMode
      ? JUMPER
      : null
    : handles.some((h) => h.id === sel)
      ? sel
      : (handles[0]?.id ?? null);
  const arrowsName = handles.find((h) => h.id === arrows)?.name;
  const ends = jumpEnds(p);
  const reads = Object.entries(d.texts).filter(([k]) => k !== 'slider');

  return (
    <div className="wgt nl" ref={root}>
      {p.task?.type === 'interval' && (
        <div className="wgt-head">
          <Tex tex={ineqTex(p.task.ineq)} />
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${nlHeight(p)}`} className="wgt-svg">
        <title>수직선</title>
        <line x1={4} y1={line} x2={W - 4} y2={line} className="nl-axis" />
        {nlTicks(p).map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 눈금 순서는 매개변수에서 고정
          <g key={i}>
            <line x1={t.x} y1={line - 6} x2={t.x} y2={line + 6} className="nl-tick" />
            {t.label !== undefined && (
              <text x={t.x} y={line + 26} className="nl-num">
                {t.label}
              </text>
            )}
          </g>
        ))}
        <Marks marks={nlRegion(p)} />
        {ends.map(([a, b], i) => {
          const x1 = xOf(p, 0) + ((num(a) - p.min) / (p.max - p.min)) * (W - 48);
          const x2 = xOf(p, 0) + ((num(b) - p.min) / (p.max - p.min)) * (W - 48);
          const y = line - 4;
          const top = y - 34;
          const dir = x2 > x1 ? 1 : -1;
          const mv = p.jumps?.moves[i] ?? '';
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: 점프 순서는 매개변수에서 고정
            <g key={i} className="nl-jump" visibility={i < st.jump ? 'visible' : 'hidden'}>
              <path d={`M${x1} ${y} Q${(x1 + x2) / 2} ${top} ${x2} ${y}`} />
              <polygon points={`${x2},${y} ${x2 - dir * 9},${y - 9} ${x2 - dir * 2},${y - 12}`} />
              <text x={(x1 + x2) / 2} y={top + 8}>
                {mv.startsWith('-') ? `−${mv.slice(1)}` : `+${mv}`}
              </text>
            </g>
          );
        })}
        <Marks marks={d.marks.filter((m) => !m.k.startsWith('h:') && m.k !== 'iv-top')} />
        {handles.map((h) => {
          const k = cellOfHandle(st, h.id);
          const m = d.marks.find((x) => x.k === `h:${h.id}`);
          const [, x = '0', y = '0'] =
            String(m?.a.transform).match(/\(([-\d.]+) ([-\d.]+)\)/) ?? [];
          const v = valueAt(p, k);
          const g = drag((s0, dx) => nlDrag(p, s0, h.id, dx));
          const jumper = h.id === JUMPER;
          return (
            <DragHandle
              key={h.id}
              k={`h:${h.id}`}
              x={Number(x)}
              y={Number(y)}
              label={h.name}
              value={num(v)}
              min={p.min}
              max={p.max}
              valueText={`${h.name} ${num(v)}`}
              onKey={(key) => step(h.id, key)}
              {...(jumper ? { onBlur: judge.flush } : {})}
              pick={() => !busy.current}
              onStart={() => {
                busy.current = true;
                active.current = { id: h.id, from: k };
                // 슬라이더는 손잡이를 끄는 동안 잡히지 않게(렌더 없이 DOM 으로 — 모양은 그대로)
                if (slider.current) slider.current.style.pointerEvents = 'none';
                // 키로 옮긴 자리의 판정이 기다리는 중이면 지금 끝낸다(끄는 도중 터지지 않게)
                if (jumper) judge.flush();
                g.onStart();
              }}
              onMove={g.onMove}
              onEnd={(dx, dy, c) => {
                busy.current = false;
                if (slider.current) slider.current.style.pointerEvents = '';
                g.onEnd(dx, dy, c);
                active.current = null;
                setSel(h.id);
              }}
            />
          );
        })}
        <Marks marks={d.marks.filter((m) => m.k === 'iv-top')} />
      </svg>
      <div className="wgt-read" aria-live="polite">
        {reads.map(([k, t]) => (
          <span key={k} data-t={k} className={`num t-${k.replace(/[:]/g, '-')}`}>
            {t}
          </span>
        ))}
      </div>
      {p.slider && (
        <label className="nl-slider">
          <LRich inline src={p.slider.label} />
          <input
            ref={slider}
            type="range"
            min={0}
            max={values.length - 1}
            step={1}
            defaultValue={st.sl}
            aria-valuetext={d.texts.slider}
          />
          <b className="num" data-t="slider">
            {d.texts.slider}
          </b>
        </label>
      )}
      <div className="wgt-ctl">
        {arrows && (
          <>
            <button
              type="button"
              className="lbtn soft"
              aria-label={`${arrowsName} 한 칸 왼쪽`}
              onClick={() => step(arrows, 'ArrowLeft')}
              {...(arrows === JUMPER ? { onBlur: judge.flush } : {})}
            >
              ◀ 한 칸
            </button>
            <button
              type="button"
              className="lbtn soft"
              aria-label={`${arrowsName} 한 칸 오른쪽`}
              onClick={() => step(arrows, 'ArrowRight')}
              {...(arrows === JUMPER ? { onBlur: judge.flush } : {})}
            >
              한 칸 ▶
            </button>
          </>
        )}
        {st.iv && (
          <>
            <button
              type="button"
              className="lbtn soft"
              aria-pressed={st.iv.open}
              onClick={() => {
                if (!st.iv) return;
                setS({ ...s, iv: { ...st.iv, open: !st.iv.open } });
              }}
            >
              {st.iv.open ? '빈 점(○)' : '찬 점(●)'}
            </button>
            <button
              type="button"
              className="lbtn soft"
              onClick={() => {
                if (!st.iv) return;
                setS({ ...s, iv: { ...st.iv, dir: st.iv.dir === 'left' ? 'right' : 'left' } });
              }}
            >
              {st.iv.dir === 'left' ? '◀ 왼쪽으로' : '오른쪽으로 ▶'}
            </button>
          </>
        )}
        {p.task && !jumping && (
          <button type="button" className="lbtn blue wide" onClick={check} disabled={done}>
            확인
          </button>
        )}
      </div>
      <div className={`toast ${msg.cls}`} aria-live="polite">
        {msg.text}
      </div>
    </div>
  );
}
