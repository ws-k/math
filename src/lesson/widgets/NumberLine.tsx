// 수직선 화면. 상태 → 그릴 것은 numberLine.ts(nlDraw)가 정하고, 여기서는 그리기만 한다.
// 끄는 동안은 useWidgetDrag 가 SVG 를 직접 고치고(React 렌더 없음), 놓을 때 한 번 상태를 바꾼다.
// 끌기의 탭 대체: 고른 점을 '◀ 한 칸'·'한 칸 ▶' 버튼으로 옮긴다(손잡이를 누르거나 끌면 그 점이 골라진다).
import { useRef, useState } from 'react';
import { Tex } from '../ui.tsx';
import { DragHandle } from './DragHandle.tsx';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  cellOfHandle,
  ineqTex,
  jumpEnds,
  type NLParams,
  type NLState,
  nlDrag,
  nlDraw,
  nlGrade,
  nlHeight,
  nlInit,
  nlKey,
  nlLine,
  nlRegion,
  nlTicks,
  valueAt,
  W,
  xOf,
} from './numberLine.ts';
import { num } from './q.ts';
import { useWidgetDrag } from './useWidgetDrag.ts';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };

export function NumberLine({ params: p, onDone, onMiss }: WidgetProps<NLParams>) {
  const [s, setS] = useState<NLState>(() => nlInit(p));
  const handles = [
    ...p.points.filter((x) => x.drag).map((x) => ({ id: x.id, name: x.label ?? x.id })),
    ...(p.data?.drag ? p.data.values.map((_, i) => ({ id: `d${i}`, name: `자료 ${i + 1}` })) : []),
    ...(s.iv ? [{ id: 'iv', name: '끝점' }] : []),
  ];
  const [sel, setSel] = useState<string | null>(handles[0]?.id ?? null);
  const [msg, setMsg] = useState<Msg>({ text: '', cls: '' });
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const draw = (x: NLState) => nlDraw(p, x);
  const finish = () => {
    if (done) return;
    setDone(true);
    onDone();
  };
  const commit = (n: NLState) => {
    setS(n);
    // 과제·점프가 없는 부품은 한 번 만져 보면 목표를 이룬 것으로 본다(gate 장면이 막히지 않게)
    if (!p.task && !p.jumps) finish();
    return n;
  };
  const drag = useWidgetDrag(root, s, draw, commit);
  const d = draw(s);
  const line = nlLine(p);

  const step = (id: string, key: string) => {
    const n = nlKey(p, s, id, key);
    if (!n) return false;
    setSel(id);
    commit(n);
    return true;
  };
  const check = () => {
    if (nlGrade(p, s)) {
      setMsg({ text: '맞아요.', cls: 'ok' });
      finish();
    } else {
      setMsg({ text: '아직 아니에요. 다시 옮겨 보세요.', cls: 'bad' });
      onMiss();
    }
  };
  const ends = jumpEnds(p);
  const selName = handles.find((h) => h.id === sel)?.name;

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
            <g key={i} className="nl-jump" visibility={i < s.jump ? 'visible' : 'hidden'}>
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
          const k = cellOfHandle(s, h.id);
          const m = d.marks.find((x) => x.k === `h:${h.id}`);
          const [, x = '0', y = '0'] =
            String(m?.a.transform).match(/\(([-\d.]+) ([-\d.]+)\)/) ?? [];
          const v = valueAt(p, k);
          const g = drag((st, dx) => nlDrag(p, st, h.id, dx));
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
              onStart={g.onStart}
              onMove={g.onMove}
              onEnd={(dx, dy, c) => {
                g.onEnd(dx, dy, c);
                setSel(h.id);
              }}
            />
          );
        })}
        <Marks marks={d.marks.filter((m) => m.k === 'iv-top')} />
      </svg>
      <div className="wgt-read" aria-live="polite">
        {Object.entries(d.texts).map(([k, t]) => (
          <span key={k} data-t={k} className={`num t-${k.replace(/[:]/g, '-')}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="wgt-ctl">
        {sel && (
          <>
            <button
              type="button"
              className="lbtn soft"
              aria-label={`${selName} 한 칸 왼쪽`}
              onClick={() => step(sel, 'ArrowLeft')}
            >
              ◀ 한 칸
            </button>
            <button
              type="button"
              className="lbtn soft"
              aria-label={`${selName} 한 칸 오른쪽`}
              onClick={() => step(sel, 'ArrowRight')}
            >
              한 칸 ▶
            </button>
          </>
        )}
        {s.iv && (
          <>
            <button
              type="button"
              className="lbtn soft"
              aria-pressed={s.iv.open}
              onClick={() => s.iv && commit({ ...s, iv: { ...s.iv, open: !s.iv.open } })}
            >
              {s.iv.open ? '빈 점(○)' : '찬 점(●)'}
            </button>
            <button
              type="button"
              className="lbtn soft"
              onClick={() =>
                s.iv &&
                commit({ ...s, iv: { ...s.iv, dir: s.iv.dir === 'left' ? 'right' : 'left' } })
              }
            >
              {s.iv.dir === 'left' ? '◀ 왼쪽으로' : '오른쪽으로 ▶'}
            </button>
          </>
        )}
        {p.jumps && s.jump < ends.length && (
          <button
            type="button"
            className="lbtn blue wide"
            onClick={() => {
              const n = { ...s, jump: s.jump + 1 };
              setS(n);
              if (n.jump === ends.length) finish();
            }}
          >
            {s.jump === 0 ? '첫 번째 이동 보기' : '다음 이동 보기'}
          </button>
        )}
        {p.task && (
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
