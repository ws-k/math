// 넓이 모형 화면. 무엇을 어디에 그릴지는 areaModel.ts(growDraw·tilesDraw)가 정하고, 끄는 동안에는
// 그 결과를 DOM 에 직접 적용한다(React 렌더 없음). 상태는 손을 뗄 때 한 번 바꾼다.
// 끌기마다 버튼·방향키 대체가 있다: grow 는 'Δx 줄이기·늘리기', tiles 는 '고르고 판을 눌러 놓기'.
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { nearest } from '../drag.ts';
import { HANDLE_HIT, Handle, handleAt } from '../Handle.tsx';
import { symToTex } from '../sym.ts';
import { LRich, Tex } from '../ui.tsx';
import { useDrag } from '../useDrag.ts';
import {
  type AreaParams,
  cellTex,
  fitTiles,
  type GrowParams,
  growBox,
  growDraw,
  growSteps,
  growStops,
  initialTiles,
  lenSym,
  placeAt,
  rectangle,
  type SplitParams,
  sideLabel,
  splitTotal,
  type Tile,
  type TilesParams,
  tileAt,
  tilesDraw,
  tilesLayout,
} from './areaModel.ts';
import { useCompact } from './compact.ts';
import type { WidgetProps } from './index.tsx';

/** 상자 폭을 재는 훅. 렌더 중에는 window·DOM 을 읽지 않는다(서버 렌더·스모크 테스트) */
function useWidth(w0: number) {
  const host = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(w0);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const n = Math.round(el.clientWidth);
      if (n) setW(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { host, w };
}

export function AreaModel(props: WidgetProps<AreaParams>) {
  const p = props.params;
  if (p.mode === 'split') return <Split {...props} params={p} />;
  if (p.mode === 'grow') return <Grow {...props} params={p} />;
  return <Tiles {...props} params={p} />;
}

// ---- split: 칸을 눌러 넓이 열기 ----

function Split({ params: p, onDone }: WidgetProps<SplitParams>) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const total = splitTotal(p);
  const all = open.size === p.w.length * p.h.length;
  // 칸 크기: 수면 그 비율, x 가 든 항은 같은 크기(길이를 모르는 수)
  const size = (t: string) => {
    const n = Number(t);
    return Number.isFinite(n) ? Math.max(1, n) : 6;
  };
  const cols = p.w.map(size);
  const rows = p.h.map(size);
  return (
    <>
      <div
        className="split"
        style={{
          gridTemplateColumns: `auto ${cols.map((c) => `${c}fr`).join(' ')}`,
        }}
      >
        <span />
        {p.w.map((t, c) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 항 순서는 데이터에서 고정
          <span key={`w${c}`} className="side">
            <Tex tex={symToTex(t)} />
          </span>
        ))}
        {p.h.map((t, r) => [
          // biome-ignore lint/suspicious/noArrayIndexKey: 항 순서는 데이터에서 고정
          <span key={`h${r}`} className="side" style={{ minHeight: `${rows[r] ?? 1}em` }}>
            <Tex tex={symToTex(t)} />
          </span>,
          ...p.w.map((_, c) => {
            const k = `${r}:${c}`;
            const shown = open.has(k);
            return (
              <button
                type="button"
                key={k}
                className={`cell${shown ? ' open' : ''}`}
                aria-label={`${r + 1}행 ${c + 1}열 넓이`}
                onClick={() => {
                  const n = new Set(open);
                  n.add(k);
                  setOpen(n);
                  if (n.size === p.w.length * p.h.length) onDone();
                }}
              >
                {shown ? <Tex tex={cellTex(p, r, c)} /> : '?'}
              </button>
            );
          }),
        ])}
      </div>
      <div className={`toast ${all ? 'ok' : ''}`} aria-live="polite">
        {all ? (
          <>
            <Tex tex={`${symToTex(total.product)}=${symToTex(total.value ?? total.sum)}`} />
            {p.done && <LRich inline src={p.done} />}
          </>
        ) : (
          p.intro && <LRich inline src={p.intro} />
        )}
      </div>
    </>
  );
}

// ---- grow: 모서리를 끌어 Δx 바꾸기 ----

function Grow({ params: p, onDone }: WidgetProps<GrowParams>) {
  const { host, w } = useWidth(320);
  // 접은 화면은 상자가 낮아 손잡이 멈춤 자리 사이가 6px 남짓(math2: Δx 1/40 칸 10개)으로 촘촘해진다. 그래도 둔다:
  // 끌면 가장 가까운 멈춤 자리로 붙고 끝을 넘겨 끌면 끝 자리에 멈추며, 목표는 'Δx 를 이만큼 이하로'라 모서리 쪽으로
  // 끌기만 해도 이룬다. 한 칸씩 정확히 옮기는 일은 늘 보이는 'Δx 줄이기·늘리기' 버튼과 방향키가 맡는다
  const box = growBox(w, useCompact());
  const steps = growSteps(p);
  const [k, setK] = useState(steps);
  const live = useRef(k);
  live.current = k;
  const svg = useRef<SVGSVGElement>(null);
  const els = useRef(new Map<string, Element>());
  const [reached, setReached] = useState(false);
  const boxRef = useRef(box);
  boxRef.current = box;
  const start = useRef({ x: 0, y: 0 });

  const reg = (key: string) => (el: Element | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };
  const apply = (n: number) => {
    const d = growDraw(p, n, boxRef.current);
    for (const r of d.rects) {
      const el = els.current.get(r.key);
      if (!el) continue;
      el.setAttribute('x', String(r.x));
      el.setAttribute('y', String(r.y));
      el.setAttribute('width', String(r.w));
      el.setAttribute('height', String(r.h));
    }
    const he = els.current.get('h') as HTMLElement | undefined;
    if (he) he.style.transform = handleAt(d.handle.x, d.handle.y);
    els.current.get('h')?.setAttribute('aria-valuenow', String(d.d));
    for (const r of d.readouts) {
      const el = els.current.get(`r:${r.key}`);
      if (el) el.textContent = r.text;
    }
  };
  const commit = (n: number) => {
    live.current = n;
    setK(n);
    if (!reached && n * p.stepN <= p.goal + 1e-12) {
      setReached(true);
      onDone();
    }
  };

  useDrag(host, {
    pick(cx, cy) {
      const r = svg.current?.getBoundingClientRect();
      if (!r) return false;
      const at = { x: cx - r.left, y: cy - r.top };
      const h = growDraw(p, live.current, boxRef.current).handle;
      if (!nearest([h], at, HANDLE_HIT)) return false;
      start.current = at;
      return true;
    },
    onMove(dx, dy) {
      const at = { x: start.current.x + dx, y: start.current.y + dy };
      const s = nearest(growStops(p, boxRef.current), at, Number.POSITIVE_INFINITY);
      if (s && s.k !== live.current) {
        live.current = s.k;
        apply(s.k);
      }
    },
    onEnd(_dx, _dy, cancelled) {
      if (cancelled) {
        live.current = k;
        apply(k);
        return;
      }
      commit(live.current);
    },
  });

  const onKey = (e: KeyboardEvent) => {
    const d: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    const s = d[e.key];
    if (s === undefined) return;
    e.preventDefault();
    commit(Math.min(steps, Math.max(1, k + s)));
  };

  const dr = growDraw(p, k, box);
  return (
    <>
      <div ref={host} className="area-host">
        <svg
          ref={svg}
          className="area"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
        >
          <title>넓이 모형</title>
          {dr.rects.map((r) => (
            <rect
              key={r.key}
              ref={reg(r.key)}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              className={r.cls}
            />
          ))}
        </svg>
        <Handle
          ref={reg('h')}
          x={dr.handle.x}
          y={dr.handle.y}
          label="x 늘리기(Δx)"
          value={dr.d}
          min={p.stepN}
          max={p.maxN}
          valueText={`Δx ${dr.readouts[0]?.text ?? ''}`}
          onKey={onKey}
        />
      </div>
      <div className="legend">
        <span className="lg base">
          <i aria-hidden="true" />
          <LRich inline src={sideLabel('가로', p.wLabel)} /> ·{' '}
          <LRich inline src={sideLabel('세로', p.hLabel)} />
        </span>
      </div>
      <div className="readouts grow-ro">
        {dr.readouts.map((r) => (
          <div key={r.key} className={`ro ${r.key}`}>
            <LRich inline src={r.label} />
            <b className="num" ref={reg(`r:${r.key}`)}>
              {r.text}
            </b>
          </div>
        ))}
      </div>
      <div className={`toast ${reached ? 'ok' : ''}`} aria-live="polite">
        <LRich inline src={(reached ? p.done : p.intro) ?? ''} />
      </div>
      <div className="row2">
        <button type="button" className="lbtn soft" disabled={k <= 1} onClick={() => commit(k - 1)}>
          Δx 줄이기
        </button>
        <button
          type="button"
          className="lbtn soft"
          disabled={k >= steps}
          onClick={() => commit(k + 1)}
        >
          Δx 늘리기
        </button>
      </div>
    </>
  );
}

// ---- tiles: 타일을 끌어 직사각형 만들기 ----

function Tiles({ params: p, onDone, onMiss }: WidgetProps<TilesParams>) {
  const { host, w } = useWidth(320);
  // 한 칸 크기·판: 넓은 화면은 폭에 맞추되 34px 까지(판이 화면 높이를 넘지 않게), 접은 화면은 판을 줄이고
  // 놓는 곳을 더미로(areaModel.ts tilesLayout)
  const layout = tilesLayout(p, w, useCompact());
  const u = layout.u;
  const [tiles, setTiles] = useState<Tile[]>(() => initialTiles(p));
  const [sel, setSel] = useState<number | null>(null);
  const [made, setMade] = useState(false);
  // 판 위에 놓으려다 판 밖으로 나가 놓는 곳으로 돌아왔나 — 왜 튕겼는지 한 줄로 알린다(접은 화면의 줄인 판에서
  // 세로로 쌓다 넘치는 경우 등). 다음 손놀림에서 지운다
  const [bounced, setBounced] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const els = useRef(new Map<number, Element>());
  const grab = useRef<{ n: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const uRef = useRef(u);
  uRef.current = u;
  // 판 크기가 바뀌면(접기·펴기·회전·주소창) 판 밖에 남은 타일을 정리한다. 이미 이룬 목표(made)는 그대로 둔다
  const bw = layout.board.w;
  const bh = layout.board.h;
  useEffect(() => {
    setTiles((t) => fitTiles(t, { w: bw, h: bh }));
  }, [bw, bh]);

  const d = tilesDraw(tiles, u, { ...layout, sel });
  const local = (cx: number, cy: number) => {
    const r = svg.current?.getBoundingClientRect();
    return r ? { x: cx - r.left, y: cy - r.top } : { x: 0, y: 0 };
  };
  const hit = (x: number, y: number) => tileAt(d.rects, x, y);

  const update = (n: Tile[]) => {
    setTiles(n);
    const r = rectangle(n);
    if (r && !made) {
      setMade(true);
      onDone();
    }
  };
  /** n 번 타일을 판 위 px(왼쪽 위)에 놓기. 판 밖이면 놓는 곳으로 */
  const put = (n: number, x: number, y: number) => {
    const t = tiles[n] as Tile;
    const onBoard = y < d.trayTop - 6;
    const at = onBoard ? placeAt(t, x, y, uRef.current, layout.board) : null;
    setBounced(onBoard && !at);
    update(tiles.map((q, k) => (k === n ? { ...q, at } : q)));
  };

  useDrag(svg, {
    pick(cx, cy) {
      const at = local(cx, cy);
      const r = hit(at.x, at.y);
      grab.current = r ? { n: r.n, x: at.x, y: at.y, ox: at.x - r.x, oy: at.y - r.y } : null;
      // 빈 판을 누른 것도 받는다: 고른 타일을 그 자리에 놓기(끌기 대체)
      return !!r || (sel !== null && at.y < d.trayTop);
    },
    onStart(cx, cy) {
      if (!grab.current) {
        const at = local(cx, cy);
        grab.current = { n: -1, x: at.x, y: at.y, ox: 0, oy: 0 };
      }
    },
    onMove(dx, dy) {
      const g = grab.current;
      if (!g || g.n < 0) return;
      els.current.get(g.n)?.setAttribute('transform', `translate(${dx} ${dy})`);
    },
    onEnd(dx, dy, cancelled) {
      const g = grab.current;
      grab.current = null;
      if (!g) return;
      if (g.n >= 0) els.current.get(g.n)?.removeAttribute('transform');
      if (cancelled) return;
      setBounced(false);
      const tap = Math.hypot(dx, dy) < 8;
      if (g.n < 0) {
        if (tap && sel !== null) {
          put(sel, g.x, g.y);
          setSel(null);
        }
        return;
      }
      if (tap) {
        // 판 위 타일을 누르면 놓는 곳으로, 놓는 곳 타일을 누르면 고르기
        if ((tiles[g.n] as Tile).at)
          update(tiles.map((q, k) => (k === g.n ? { ...q, at: null } : q)));
        else setSel(sel === g.n ? null : g.n);
        return;
      }
      put(g.n, g.x - g.ox + dx, g.y - g.oy + dy);
      setSel(null);
    },
  });

  const rect = rectangle(tiles);
  const selTile = sel === null ? null : tiles[sel];
  return (
    <>
      <div ref={host} className="area-host">
        <svg
          ref={svg}
          className="tiles"
          width={w}
          height={d.height}
          viewBox={`0 0 ${w} ${d.height}`}
          style={{ touchAction: 'none' }}
        >
          <title>대수 타일</title>
          <rect x={0} y={0} width={d.board.w} height={d.board.h} className="board" />
          <line x1={0} y1={d.trayTop - 7} x2={w} y2={d.trayTop - 7} className="tray-line" />
          {/* 접은 화면 더미 자리: 비어도 점선 칸을 남겨 돌린 x·다 꺼낸 x² 가 돌아갈 곳을 보인다 */}
          {d.slots?.map((r) => (
            <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} className={r.cls} />
          ))}
          {d.rects.map((r) =>
            r.under ? (
              // 더미 아래에 깔린 타일(접은 화면): 맨 위 것을 끌어 가면 드러나도록 그리기만 한다(역할·포커스 없음)
              <rect
                key={r.key}
                ref={(el) => {
                  if (el) els.current.set(r.n, el);
                  else els.current.delete(r.n);
                }}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                className={r.cls}
              />
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button 요소를 쓸 수 없다
              <rect
                key={r.key}
                ref={(el) => {
                  if (el) els.current.set(r.n, el);
                  else els.current.delete(r.n);
                }}
                role="button"
                tabIndex={0}
                aria-label={`${(tiles[r.n] as Tile).kind === 'x2' ? 'x²' : (tiles[r.n] as Tile).kind === 'x' ? 'x' : '1'} 타일${r.placed ? '(판 위)' : ''}${(r.count ?? 1) > 1 ? `(놓는 곳에 ${r.count}개)` : ''}`}
                aria-pressed={sel === r.n}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                className={`${r.cls}${sel === r.n ? ' sel' : ''}`}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  setSel(sel === r.n ? null : r.n);
                }}
              />
            ),
          )}
          {/* 더미 개수(접은 화면). 누르는 것은 타일이라 손가락을 가로채지 않게(CSS pointer-events). 개수는 맨 위 타일의
              읽는 이름에 들어 있어 화면 낭독기에는 숨긴다(숫자만 따로 읽히지 않게) */}
          {d.rects
            .filter((r) => (r.count ?? 1) > 1)
            .map((r) => (
              // biome-ignore lint/a11y/noAriaHiddenOnFocusable: SVG g 는 포커스를 받지 않는데 규칙이 잘못 짚는다
              <g key={`c${r.key}`} className="stack-n" aria-hidden="true">
                <circle cx={r.x + r.w} cy={r.y} r={9} />
                <text x={r.x + r.w} y={r.y + 4}>
                  {r.count}
                </text>
              </g>
            ))}
        </svg>
      </div>
      <div className={`toast ${rect ? 'ok' : ''}`} aria-live="polite">
        {rect ? (
          <>
            <Tex tex={`${symToTex(`(${lenSym(rect.w)})*(${lenSym(rect.h)})`)}`} />{' '}
            {p.done && <LRich inline src={p.done} />}
          </>
        ) : (
          <LRich
            inline
            src={
              bounced
                ? '판 밖으로 나가서 놓는 곳으로 돌아왔어요.'
                : sel !== null
                  ? '판의 빈 곳을 누르면 고른 타일이 그 자리로 가요.'
                  : (p.intro ?? '타일을 끌어 빈틈없는 직사각형을 만들어 보세요.')
            }
          />
        )}
      </div>
      <div className="row2">
        <button
          type="button"
          className="lbtn soft"
          disabled={selTile?.kind !== 'x'}
          onClick={() => {
            if (sel === null) return;
            update(tiles.map((q, k) => (k === sel ? { ...q, rot: !q.rot, at: null } : q)));
          }}
        >
          x 타일 돌리기
        </button>
        <button
          type="button"
          className="lbtn quiet"
          onClick={() => {
            setTiles(initialTiles(p));
            setSel(null);
            if (!made) onMiss();
          }}
        >
          처음부터 다시
        </button>
      </div>
    </>
  );
}
