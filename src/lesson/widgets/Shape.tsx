// 도형판 화면. 상태 → 그릴 것은 shape.ts(shDraw)가 정하고 여기서는 그리기만 한다.
// 꼭짓점·잘라 낸 조각을 끄는 동안은 SVG 직접 고치기, 놓을 때 한 번 상태를 바꾼다.
// 탭 대체: 자유 점은 고른 점을 화살표 버튼으로 한 칸씩, 선분·원 위 점은 점마다 ◀▶, 잘라 옮기기는 '조각 옮기기' 버튼.
// 조각 여러 개(pieces): 조각을 끌어 옮기고, 톡 누르면(거의 안 움직이고 뗌) 90° 돌린다 — 돌리기 단추를 따로 찾지 않고
// 조각을 만지는 손으로 바로. 고른 조각은 화살표 버튼·'돌리기' 버튼, 키보드는 방향키·Enter/Space/R 로도 된다.
// 목표(goal)는 놓을 때(commit)만 판정한다 — 끄는 도중 지나간 자리는 세지 않는다(원칙 P3).
// 방향키·화살표 버튼은 누를 때마다가 아니라 멈추거나 포커스가 떠날 때 한 번(useGoal — 연타로 더듬지 않게).
import { type KeyboardEvent, useRef, useState } from 'react';
import { LRich } from '../ui.tsx';
import type { DragHandlers } from '../useDrag.ts';
import { DragHandle } from './DragHandle.tsx';
import { GoalLine } from './GoalLine.tsx';
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
  shPieceAtTarget,
  shPieceDrag,
  shPieceKey,
  shPiecesDone,
  shPieceTurn,
  W,
} from './shape.ts';
import { useGoal } from './useGoal.ts';
import { useSvgDrag, useWidgetDrag } from './useWidgetDrag.ts';

export function Shape({ params: p, onDone }: WidgetProps<ShapeParams>) {
  const [s, setS] = useState<ShState>(() => shInit(p));
  const handles = p.points.filter((x) => x.drag);
  // 고른 것: 끄는 점 id 또는 조각 'pc<번호>'
  const [sel, setSel] = useState<string | null>(
    handles[0]?.id ?? (p.pieces?.length ? 'pc0' : null),
  );
  const done = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const draw = (x: ShState) => shDraw(p, x);
  const need = shGoalNeed(p);
  const { prog, judge } = useGoal(need, onDone);
  const commit = (n: ShState, via: 'hand' | 'key' = 'hand') => {
    setS(n);
    if (p.goal) {
      if (via === 'key') judge.later(() => shGoalHits(p, n));
      else judge.release(shGoalHits(p, n));
      return n;
    }
    // 잘라 옮기기는 조각이 제자리에 가야, 목표가 없으면 한 번 만져 보면 목표를 이룬 것으로 본다
    // 조각 여러 개는 모든 조각이 목표 자리를 채워야
    const reached = p.cut ? shDone(p, n) : p.pieces ? shPiecesDone(p, n) : true;
    if (!done.current && reached) {
      done.current = true;
      onDone();
    }
    return n;
  };
  const base = useWidgetDrag(root, s, draw, commit);
  // 끌기 시작 때 기다리던 키·버튼 판정을 지금 끝낸다(좌표평면과 같은 규칙 — 끄는 도중 타이머가 터지지 않게)
  const drag = (move: Parameters<typeof base>[0]) => {
    const h = base(move);
    return {
      ...h,
      onStart() {
        judge.flush();
        h.onStart();
      },
    };
  };
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
    commit(n, 'key');
    return true;
  };
  const selPt = handles.find((h) => h.id === sel);
  const free = selPt && !selPt.on;
  const selPc = sel?.startsWith('pc') ? Number(sel.slice(2)) : null;
  const pieceStep = (i: number, key: string) => {
    const n = key === 'turn' ? shPieceTurn(p, s, i) : shPieceKey(p, s, i, key);
    if (!n) return false;
    setSel(`pc${i}`);
    commit(n, 'key');
    return true;
  };
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
        <Marks
          marks={d.marks.filter(
            (m) => !m.k.startsWith('h:') && m.k !== 'cutp' && !/^pc\d/.test(m.k),
          )}
        />
        {p.cut && cutMark && (
          <polygon
            ref={piece}
            data-k="cutp"
            points={String(cutMark.a.points)}
            className={String(cutMark.a.class)}
            style={{ touchAction: 'none' }}
          />
        )}
        {p.pieces?.map((_, i) => {
          const m = d.marks.find((x) => x.k === `pc${i}`);
          const g2 = drag((st, dx, dy) => shPieceDrag(p, st, i, dx, dy));
          return (
            <PieceEl
              // biome-ignore lint/suspicious/noArrayIndexKey: 조각 순서는 고정
              key={i}
              k={`pc${i}`}
              points={String(m?.a.points)}
              className={String(m?.a.class)}
              label={`조각 ${i + 1}: 끌어서 옮기고, 누르면 돌아가요`}
              onKey={(key) => pieceStep(i, key)}
              onFocus={() => setSel(`pc${i}`)}
              onBlur={judge.flush}
              h={{
                onStart: g2.onStart,
                onMove: g2.onMove,
                onEnd(dx, dy, c) {
                  setSel(`pc${i}`);
                  // 톡 누르기(거의 안 움직임)는 돌리기 — 끌기로 본 자리(제자리)를 반영하지 않고 돌린 상태로
                  if (!c && Math.hypot(dx, dy) < TAP) commit(shPieceTurn(p, s, i));
                  else g2.onEnd(dx, dy, c);
                },
              }}
            />
          );
        })}
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
              valueText={handleText(h, s.pts[h.id])}
              onKey={(key) => step(h.id, key)}
              onBlur={judge.flush}
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
      {p.goal && <GoalLine prog={prog} need={need} texts={{ done: p.done, hint: p.goal.hint }} />}
      {/* 조각 채우기: 몇 조각이 자리를 찾았는지와 다 채운 뒤 글. 상태는 손을 뗄 때만 바뀌어 끄는 도중엔 그대로(P3) */}
      {p.pieces && (
        <GoalLine
          prog={{
            seen: p.pieces.flatMap((_, i) => (shPieceAtTarget(p, s, i) ? [String(i)] : [])),
            tries: 0,
            done: shPiecesDone(p, s),
          }}
          need={p.pieces.length}
          texts={{ done: p.done }}
        />
      )}
      <div className={`wgt-ctl${selPc !== null ? ' pc' : ''}`}>
        {sel &&
          (free || selPc !== null) &&
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
              aria-label={`${selPc !== null ? `조각 ${selPc + 1}` : `점 ${sel}`} ${t} 한 칸`}
              onClick={() => (selPc !== null ? pieceStep(selPc, k) : step(sel, k))}
              onBlur={judge.flush}
            >
              {t}
            </button>
          ))}
        {/* 선분·원 위 끄는 점은 점마다 ◀▶(끌기 대체) — 고른 점 하나만 두면 손가락으로 끌 수 없을 때
            다른 점을 고를 길이 없다(사다리꼴 장면의 C) */}
        {handles
          .filter((h) => h.on)
          .flatMap((h) => [
            <button
              type="button"
              key={`${h.id}-`}
              className="lbtn soft"
              onClick={() => step(h.id, 'ArrowLeft')}
              onBlur={judge.flush}
            >
              ◀ 점 {h.id}
            </button>,
            <button
              type="button"
              key={`${h.id}+`}
              className="lbtn soft"
              onClick={() => step(h.id, 'ArrowRight')}
              onBlur={judge.flush}
            >
              점 {h.id} ▶
            </button>,
          ])}
        {selPc !== null && (
          <button
            type="button"
            // 화살표와 한 줄에(접은 화면에서 줄 하나를 아낀다)
            className="lbtn soft arrow"
            aria-label={`조각 ${selPc + 1} 돌리기`}
            onClick={() => pieceStep(selPc, 'turn')}
            onBlur={judge.flush}
          >
            ⟲
          </button>
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

/** 톡 누르기로 보는 움직임 상한(SVG 단위 — 격자 한 칸의 절반보다 작게, 손가락이 조금 흔들려도 돌리기로) */
const TAP = 6;

/**
 * 끄는 조각 하나. 조각마다 끌기 훅이 하나씩 있어야 해서(반복문 안에서 훅을 부를 수 없다) 컴포넌트로 뗐다.
 * 그리는 자리는 손을 뗄 때 React 가, 끄는 동안은 applyDrawing 이 data-k 로 찾아 points 를 직접 고친다.
 */
function PieceEl(props: {
  k: string;
  points: string;
  className: string;
  label: string;
  h: DragHandlers;
  onKey(key: string): boolean;
  onFocus(): void;
  onBlur(): void;
}) {
  const ref = useRef<SVGPolygonElement>(null);
  useSvgDrag(ref, props.h);
  const key = (e: KeyboardEvent) => {
    const k = e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R' ? 'turn' : e.key;
    if (props.onKey(k)) e.preventDefault();
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG 다각형이라 <button> 으로 바꿀 수 없다
    <polygon
      ref={ref}
      data-k={props.k}
      points={props.points}
      className={props.className}
      role="button"
      tabIndex={0}
      aria-label={props.label}
      onKeyDown={key}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      style={{ touchAction: 'none' }}
    />
  );
}

/**
 * 손잡이를 화면 낭독기가 읽는 값: 자리. 이름(aria-label "점 D") 바로 뒤에 읽힌다 — 이름만 두 번 읽으면
 * 키로 옮겨도 어디에 있는지 알 수 없다. 원 위 점은 각도, 나머지는 격자 좌표(좌표평면 손잡이와 같은 꼴)
 */
function handleText(
  h: { on?: ShapeParams['points'][number]['on'] },
  at: { x: number; y: number; deg?: number } | undefined,
): string {
  if (!at) return '';
  if (h.on && 'circle' in h.on) return `${at.deg ?? 0}°`;
  // 곡선 위 점은 매개변수 각이 학습자에게 뜻이 없어 자리(소수 한 자리)로
  if (h.on && 'curve' in h.on)
    return `x ${Math.round(at.x * 10) / 10}, y ${Math.round(at.y * 10) / 10}`.replace(/-/g, '−');
  return `x ${at.x}, y ${at.y}`.replace(/-/g, '−');
}
