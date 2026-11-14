// 도형판 화면. 상태 → 그릴 것은 shape.ts(shDraw)가 정하고 여기서는 그리기만 한다.
// 꼭짓점·잘라 낸 조각을 끄는 동안은 SVG 직접 고치기, 놓을 때 한 번 상태를 바꾼다.
// 탭 대체: 고른 점을 화살표 버튼으로 한 칸씩, 잘라 옮기기는 '조각 옮기기' 버튼.
// 목표(goal)는 놓을 때(commit)만 판정한다 — 끄는 도중 지나간 자리는 세지 않는다(원칙 P3).
import { useRef, useState } from 'react';
import { type GoalProgress, goalLine, goalRelease, goalStart } from '../goal.ts';
import { LRich } from '../ui.tsx';
import { DragHandle } from './DragHandle.tsx';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  type ShapeParams,
  type ShState,
  shDone,
  shDrag,
  shDraw,
  shGeom,
  shGoalHits,
  shGoalNeed,
  shInit,
  shKey,
  W,
} from './shape.ts';
import { useSvgDrag, useWidgetDrag } from './useWidgetDrag.ts';

export function Shape({ params: p, onDone }: WidgetProps<ShapeParams>) {
  const [s, setS] = useState<ShState>(() => shInit(p));
  const handles = p.points.filter((x) => x.drag);
  const [sel, setSel] = useState<string | null>(handles[0]?.id ?? null);
  const done = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const draw = (x: ShState) => shDraw(p, x);
  const [prog, setProg] = useState<GoalProgress>(goalStart);
  const progRef = useRef(prog);
  const need = shGoalNeed(p);
  const commit = (n: ShState) => {
    setS(n);
    if (p.goal) {
      const g = goalRelease(progRef.current, shGoalHits(p, n), need);
      progRef.current = g;
      setProg(g);
      if (g.done && !done.current) {
        done.current = true;
        onDone();
      }
      return n;
    }
    // 잘라 옮기기는 조각이 제자리에 가야, 목표가 없으면 한 번 만져 보면 목표를 이룬 것으로 본다
    if (!done.current && (p.cut ? shDone(p, n) : true)) {
      done.current = true;
      onDone();
    }
    return n;
  };
  const drag = useWidgetDrag(root, s, draw, commit);
  const piece = useRef<SVGPolygonElement>(null);
  useSvgDrag(
    piece,
    drag((st, dx, dy) => shDrag(p, st, 'cut', dx, dy)),
  );
  const d = draw(s);
  const g = shGeom(p);
  const step = (id: string, key: string) => {
    const n = shKey(p, s, id, key);
    if (!n) return false;
    setSel(id);
    commit(n);
    return true;
  };
  const selPt = handles.find((h) => h.id === sel);
  const free = selPt && !selPt.on;
  const pos = (k: string) => {
    const m = String(d.marks.find((x) => x.k === k)?.a.transform).match(/\(([-\d.]+) ([-\d.]+)\)/);
    return { x: Number(m?.[1] ?? 0), y: Number(m?.[2] ?? 0) };
  };
  const cutMark = d.marks.find((m) => m.k === 'cutp');
  return (
    <div className="wgt sh" ref={root}>
      {p.note && <LRich src={p.note} className="wgt-note" />}
      <svg viewBox={`0 0 ${W} ${g.h}`} className="wgt-svg">
        <title>도형판</title>
        {Array.from({ length: p.grid.w + 1 }, (_, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: 격자선 순서는 고정
            key={`x${i}`}
            x1={g.ox + i * g.u}
            y1={g.oy}
            x2={g.ox + i * g.u}
            y2={g.oy - p.grid.h * g.u}
            className="sh-grid"
          />
        ))}
        {Array.from({ length: p.grid.h + 1 }, (_, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: 위와 같음
            key={`y${i}`}
            x1={g.ox}
            y1={g.oy - i * g.u}
            x2={g.ox + p.grid.w * g.u}
            y2={g.oy - i * g.u}
            className="sh-grid"
          />
        ))}
        <Marks marks={d.marks.filter((m) => !m.k.startsWith('h:') && m.k !== 'cutp')} />
        {p.cut && cutMark && (
          <polygon
            ref={piece}
            data-k="cutp"
            points={String(cutMark.a.points)}
            className={String(cutMark.a.class)}
            style={{ touchAction: 'none' }}
          />
        )}
        {handles.map((h) => {
          const at = pos(`h:${h.id}`);
          const g2 = drag((st, dx, dy) => shDrag(p, st, h.id, dx, dy));
          return (
            <DragHandle
              key={h.id}
              k={`h:${h.id}`}
              x={at.x}
              y={at.y}
              label={`점 ${h.id}`}
              value={s.pts[h.id]?.x ?? 0}
              min={0}
              max={p.grid.w}
              valueText={`점 ${h.id}`}
              onKey={(key) => step(h.id, key)}
              onStart={g2.onStart}
              onMove={g2.onMove}
              onEnd={(dx, dy, c) => {
                g2.onEnd(dx, dy, c);
                setSel(h.id);
              }}
            />
          );
        })}
      </svg>
      <div className="wgt-read" aria-live="polite">
        {Object.entries(d.texts).map(([k, t]) => (
          <span key={k} data-t={k} className="num">
            {t}
          </span>
        ))}
      </div>
      {p.goal && <GoalLine p={p} prog={prog} need={need} />}
      <div className="wgt-ctl">
        {sel &&
          free &&
          (
            [
              ['ArrowLeft', '←'],
              ['ArrowUp', '↑'],
              ['ArrowDown', '↓'],
              ['ArrowRight', '→'],
            ] as const
          ).map(([k, t]) => (
            <button
              type="button"
              key={k}
              className="lbtn soft arrow"
              aria-label={`점 ${sel} ${t} 한 칸`}
              onClick={() => step(sel, k)}
            >
              {t}
            </button>
          ))}
        {sel && selPt?.on && (
          <>
            <button type="button" className="lbtn soft" onClick={() => step(sel, 'ArrowLeft')}>
              ◀ 점 {sel}
            </button>
            <button type="button" className="lbtn soft" onClick={() => step(sel, 'ArrowRight')}>
              점 {sel} ▶
            </button>
          </>
        )}
        {p.cut && (
          <button
            type="button"
            className="lbtn soft wide"
            onClick={() => {
              const c = p.cut;
              if (!c) return;
              commit(shDone(p, s) ? { ...s, cut: [0, 0] } : { ...s, cut: [c.by[0], c.by[1]] });
            }}
          >
            {shDone(p, s) ? '조각 되돌리기' : '조각 옮기기'}
          </button>
        )}
      </div>
    </div>
  );
}

/** 목표 줄: 진행("3곳 중 2곳")과 완료·힌트 글. 처음 안내는 위쪽 note 가 맡는다 */
function GoalLine({ p, prog, need }: { p: ShapeParams; prog: GoalProgress; need: number }) {
  const line = goalLine(prog, need, { done: p.done, hint: p.goal?.hint });
  return (
    <>
      {line.progress && <p className="gprog num">{line.progress}</p>}
      <div className={`toast ${line.cls}`} aria-live="polite">
        {line.text && <LRich inline src={line.text} />}
      </div>
    </>
  );
}
