// 수직선 화면. 상태 → 그릴 것은 numberLine.ts(nlDraw), 손짓 → 상태·판정·안내의 순서는 numberLineWire.ts(배선)가
// 정하고, 여기서는 그 둘을 React 에 잇기만 한다. 끄는 동안은 useWidgetDrag 가 SVG 를 직접 고치고(React 렌더 없음, P8),
// 놓을 때 한 번 상태를 바꾼다. 손잡이·슬라이더는 한 번에 하나만 잡힌다(P9 — 배선의 busy).
//
// 점프: 점을 다음 도착 칸에 '놓으면' 화살표가 생긴다(P2·P3). 두 번 놓치면 ◀▶ 단추가 나온다(P4).
// 점 찍기 점의 ◀▶ 는 예전처럼 늘 보인다: 점 찍기는 '확인'으로 채점해 놓을 때 판정이 없고, 지금 26장면의 화면을 그대로 둔다.
import { useEffect, useRef, useState } from 'react';
import { clamp, tapMode } from '../drag.ts';
import { Tex } from '../ui.tsx';
import { DragHandle } from './DragHandle.tsx';
import { applyDrawing } from './draw.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  cellOfHandle,
  ineqTex,
  JUMPER,
  jumpEnds,
  type NLParams,
  type NLState,
  nlActive,
  nlGrade,
  nlHeight,
  nlInit,
  nlLine,
  nlRegion,
  nlSliderValues,
  nlTicks,
  valueAt,
  W,
  xOf,
} from './numberLine.ts';
import { type NLMsg, nlWire } from './numberLineWire.ts';
import { num } from './q.ts';
import { SliderRow } from './SliderRow.tsx';
import { useGoal } from './useGoal.ts';
import { useWidgetDrag } from './useWidgetDrag.ts';

export function NumberLine({ params: p, onDone, onMiss }: WidgetProps<NLParams>) {
  const [s, setS] = useState<NLState>(() => nlInit(p));
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<NLMsg>({ text: '', cls: '' });
  const [done, setDone] = useState(false);
  /** 점프를 놓친 횟수. 눌러서 하기(◀▶)를 보일지만 정한다 — 세는 일은 배선이 한다 */
  const [fails, setFails] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const live = useRef(s);
  /** 장면 끝은 한 번만(배선·슬라이더·확인이 여러 번 불러도) */
  const ended = useRef(false);
  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setDone(true);
    onDone();
  };
  // 배선은 한 번만 만든다(끄는 중 잡은 손잡이·놓침 수를 다시 그릴 때 잃지 않게). 바깥 콜백은 최신 것을 부른다
  const cb = useRef({ finish, onMiss });
  cb.current = { finish, onMiss };
  const wire = useRef<ReturnType<typeof nlWire> | null>(null);
  /** 다 뛰었을 때 키보드 초점이 이 부품 안에 있었나(뛰는 점 손잡이가 사라지면 초점을 다음 할 일로 옮긴다) */
  const refocus = useRef(false);
  const { prog, judge } = useGoal(
    Math.max(1, p.jumps?.moves.length ?? 0),
    () => {
      // 판정 순간(손잡이가 아직 있을 때) 초점이 부품 안이면 키보드·◀▶ 로 하던 사람이다. 손가락으로 한 사람은 초점이
      // 바깥(body)이라 옮기지 않는다 — 옮기면 손가락 사용자에게 뜬금없는 초점 테두리가 보인다(헤드리스 실측)
      const a = document.activeElement;
      refocus.current = !!root.current && !!a && root.current.contains(a);
      wire.current?.onDone();
    },
    (g) => wire.current?.onJudge(g),
  );
  wire.current ??= nlWire(p, {
    judge,
    live,
    setState: setS,
    say: setMsg,
    onMiss: () => cb.current.onMiss(),
    finish: () => cb.current.finish(),
    setFails,
  });
  const w = wire.current;
  // 마친 점프 수는 판정기가 센 것 하나만 믿는다(상태에 따로 들면 둘이 어긋날 수 있다)
  const st: NLState = { ...s, jump: prog.seen.length };
  live.current = st;
  const jumping = !!p.jumps && st.jump < p.jumps.moves.length;
  const drag = useWidgetDrag(root, st, w.draw, w.release);
  const d = w.draw(st);
  const line = nlLine(p);

  // 다 뛰어 뛰는 점 손잡이가 사라졌다: 초점이 그 안에 있었으면 다음 할 일(나온 점 P, 없으면 결과 식)로
  useEffect(() => {
    if (jumping || !refocus.current) return;
    refocus.current = false;
    const next =
      root.current?.querySelector<SVGElement>('.svg-handle') ??
      root.current?.querySelector<HTMLElement>('.wgt-read');
    next?.focus();
  }, [jumping]);

  const step = (id: string, key: string) => {
    const ok = w.step(id, key);
    if (ok) setSel(id);
    return ok;
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

  // 슬라이더: 움직이는 동안은 그림만 직접 고치고(P8) 놓을 때(change) 한 번 상태로. 손 처리는 좌표평면과 같은 SliderRow
  const values = nlSliderValues(p);
  const slider = p.slider && (
    <SliderRow
      label={p.slider.label}
      min={0}
      max={values.length - 1}
      step={1}
      value={st.sl}
      text={d.texts.slider ?? ''}
      h={{
        grab() {
          if (w.busy.current) return false;
          w.busy.current = true;
          return true;
        },
        release() {
          w.busy.current = false;
        },
        input(v) {
          // 칸 번호로만(범위 밖·소수가 와도 가장 가까운 칸)
          const n = { ...live.current, sl: clamp(Math.round(v), 0, values.length - 1) };
          live.current = n;
          const dr = w.draw(n);
          if (root.current) applyDrawing(root.current, dr);
          return dr.texts.slider;
        },
        change() {
          setS(live.current);
          if (!p.task && !p.jumps) finish();
        },
      }}
    />
  );

  const handles = nlActive(p, st);
  // ◀▶ 가 옮기는 점: 점프 중이면 (두 번 놓친 뒤) 뛰는 점, 아니면 고른 점(처음엔 첫 손잡이)
  const arrows = jumping
    ? tapMode(fails)
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
          const g = drag((s0, dx) => w.move(s0, h.id, dx));
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
              {...(h.id === JUMPER ? { onBlur: judge.flush } : {})}
              pick={() => w.pick()}
              onStart={() => {
                w.grab(h.id);
                g.onStart();
              }}
              onMove={g.onMove}
              onEnd={(dx, dy, c) => {
                g.onEnd(dx, dy, c);
                w.letGo();
                setSel(h.id);
              }}
            />
          );
        })}
        <Marks marks={d.marks.filter((m) => m.k === 'iv-top')} />
      </svg>
      {/* 다 뛴 뒤 초점을 받을 수 있게(tabIndex −1 — 탭 순서에는 넣지 않는다) */}
      <div className="wgt-read" aria-live="polite" tabIndex={-1}>
        {reads.map(([k, t]) => (
          <span key={k} data-t={k} className={`num t-${k.replace(/[:]/g, '-')}`}>
            {t}
          </span>
        ))}
      </div>
      {slider}
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
