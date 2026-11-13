// 단위원 화면. 상태 → 그릴 것은 unitCircle.ts(ucDraw)가 정하고 여기서는 그리기만 한다.
// 원 위 점을 끌면(끄는 동안은 SVG 직접 고치기) 가장 가까운 각도에 붙는다. 탭 대체: '◀ 각 줄이기'·'각 늘리기 ▶'.
import { useRef, useState } from 'react';
import { DragHandle } from './DragHandle.tsx';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  angles,
  type UCParams,
  type UCState,
  ucCurve,
  ucDrag,
  ucDraw,
  ucGeom,
  ucKey,
  W,
} from './unitCircle.ts';
import { useWidgetDrag } from './useWidgetDrag.ts';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };

export function UnitCircle({ params: p, onDone, onMiss }: WidgetProps<UCParams>) {
  const [s, setS] = useState<UCState>({ deg: p.start });
  const [msg, setMsg] = useState<Msg>({ text: '', cls: '' });
  const done = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const draw = (x: UCState) => ucDraw(p, x);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const commit = (n: UCState) => {
    setS(n);
    if (!p.task) finish();
    return n;
  };
  const drag = useWidgetDrag(root, s, draw, commit);
  const h = drag((st, dx, dy) => ucDrag(p, st, dx, dy));
  const d = draw(s);
  const g = ucGeom(p);
  const at = String(d.marks.find((m) => m.k === 'h:P')?.a.transform).match(
    /\(([-\d.]+) ([-\d.]+)\)/,
  );
  const step = (key: string) => {
    const n = ucKey(p, s, key);
    if (!n) return false;
    commit(n);
    return true;
  };
  const check = () => {
    if (p.task && s.deg === p.task.answer) {
      setMsg({ text: '맞아요.', cls: 'ok' });
      finish();
    } else {
      setMsg({ text: '아직 아니에요. 점을 더 돌려 보세요.', cls: 'bad' });
      onMiss();
    }
  };
  return (
    <div className="wgt uc" ref={root}>
      <svg viewBox={`0 0 ${W} ${g.h}`} className="wgt-svg">
        <title>단위원</title>
        <line x1={g.cx - g.R - 14} y1={g.cy} x2={g.cx + g.R + 14} y2={g.cy} className="uc-axis" />
        <line x1={g.cx} y1={g.cy - g.R - 14} x2={g.cx} y2={g.cy + g.R + 14} className="uc-axis" />
        <circle cx={g.cx} cy={g.cy} r={g.R} className="uc-circle" />
        {angles(p).map((a) => (
          <circle
            key={a}
            cx={g.cx + g.R * Math.cos((a * Math.PI) / 180)}
            cy={g.cy - g.R * Math.sin((a * Math.PI) / 180)}
            r={2.5}
            className="uc-tick"
          />
        ))}
        {p.unroll && (
          <>
            <line x1={g.gx} y1={g.cy} x2={g.gx + g.gw + 6} y2={g.cy} className="uc-axis" />
            <line x1={g.gx} y1={g.cy - g.R - 8} x2={g.gx} y2={g.cy + g.R + 8} className="uc-axis" />
            <path d={ucCurve(p)} className="uc-ghost" />
            <text x={g.gx + g.gw} y={g.cy + 18}>
              360°
            </text>
          </>
        )}
        <Marks marks={d.marks.filter((m) => m.k !== 'h:P')} />
        <DragHandle
          k="h:P"
          x={Number(at?.[1] ?? 0)}
          y={Number(at?.[2] ?? 0)}
          label="원 위의 점"
          value={s.deg}
          min={0}
          max={359}
          valueText={d.texts.ang ?? ''}
          onKey={step}
          onStart={h.onStart}
          onMove={h.onMove}
          onEnd={h.onEnd}
        />
      </svg>
      <div className="wgt-read" aria-live="polite">
        {Object.entries(d.texts).map(([k, t]) => (
          <span key={k} data-t={k} className={`num t-${k}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="wgt-ctl">
        <button type="button" className="lbtn soft" onClick={() => step('ArrowLeft')}>
          ◀ 각 줄이기
        </button>
        <button type="button" className="lbtn soft" onClick={() => step('ArrowRight')}>
          각 늘리기 ▶
        </button>
        {p.task && (
          <button type="button" className="lbtn blue wide" onClick={check} disabled={done.current}>
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
