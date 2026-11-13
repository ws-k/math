// 좌표평면 화면. 무엇을 어디에 그릴지는 coord.ts 의 draw(상태 → 그릴 목록)가 정하고, 여기서는
// ① 처음·상태가 바뀔 때 React 로 그리고 ② 끄는 동안에는 같은 목록을 DOM 에 직접 적용한다(React 렌더 없음).
// 상태는 손을 뗄 때 한 번만 바꾼다.
//
// 손 조작: 손잡이 끌기(손가락·펜·마우스, Pointer Events + capture), 빈 칸 누르기(점 찍기·직선 손잡이 옮기기),
// 손으로 긋기(sketch, '그리기 시작'을 누른 뒤에만). 모든 끌기에는 버튼·방향키 대체가 있다(긋기는 예외).
// touch-action:none 은 손잡이와, 긋는 중인 그림 영역에만 건다 — 그래야 그래프 위에서도 페이지가 스크롤된다.
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { EDGE, nearest } from '../drag.ts';
import { HANDLE_HIT, Handle, handleAt } from '../Handle.tsx';
import { LRich } from '../ui.tsx';
import { useDrag } from '../useDrag.ts';
import {
  addUser,
  type Box,
  type CoordParams,
  type CoordState,
  type Drawing,
  dragPoint,
  draw,
  frame,
  freeSpot,
  goalMet,
  grade,
  grid,
  gridAt,
  initial,
  keyMove,
  moveUser,
  type PointObj,
  removeUser,
  toWorld,
} from './coord.ts';
import type { WidgetProps } from './index.tsx';

/** 이만큼 움직이지 않고 떼면 '누르기'(탭)로 본다 */
const TAP_PX = 8;
/** 처음 그릴 때(크기를 재기 전·서버 렌더) 쓰는 크기 */
const BOX0: Box = { w: 340, h: 260 };

type Ctx =
  | { kind: 'handle'; key: string; x: number; y: number }
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'stroke'; x: number; y: number };

export function Coord({ params: p, onDone, onMiss }: WidgetProps<CoordParams>) {
  const host = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<Box>(BOX0);
  const [st, setSt] = useState<CoordState>(() => initial(p));
  const [sketching, setSketching] = useState(false);
  const [msg, setMsg] = useState<{ text: string; cls: '' | 'ok' | 'bad' }>({
    text: p.intro ?? '',
    cls: '',
  });
  const [done, setDone] = useState(false);
  const clip = useId();
  /** 끄는 동안의 상태(화면에 직접 적용한 것). 손을 떼면 setSt 로 넘긴다 */
  const live = useRef(st);
  live.current = st;
  const els = useRef(new Map<string, Element>());
  const ctx = useRef<Ctx | null>(null);
  const boxRef = useRef(box);
  boxRef.current = box;

  // 크기: 폭은 카드 폭, 높이는 폭의 0.78배를 화면 높이의 절반 안으로(낮은 화면에서 부품이 화면을 다 덮지 않게).
  // 렌더 중에는 window 를 읽지 않는다(서버 렌더·스모크 테스트)
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      if (!w) return;
      const maxH = Math.max(220, Math.round(window.innerHeight * 0.5));
      const h = Math.min(maxH, Math.max(200, Math.round(w * 0.78)));
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const reg = (key: string) => (el: Element | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };

  /** 그릴 목록을 DOM 에 바로 적용(끄는 동안). React 가 다음에 그릴 값과 같은 값이다 */
  const apply = (d: Drawing) => {
    const m = els.current;
    for (const it of d.items) {
      const el = m.get(it.key);
      if (!el) continue;
      if (it.t === 'path') el.setAttribute('d', it.d);
      else if (it.t === 'line') {
        el.setAttribute('x1', String(it.x1));
        el.setAttribute('y1', String(it.y1));
        el.setAttribute('x2', String(it.x2));
        el.setAttribute('y2', String(it.y2));
        el.setAttribute('class', it.cls);
        el.setAttribute('visibility', it.hidden ? 'hidden' : 'visible');
      } else if (it.t === 'dot') {
        el.setAttribute('cx', String(it.x));
        el.setAttribute('cy', String(it.y));
        el.setAttribute('visibility', it.hidden ? 'hidden' : 'visible');
      } else {
        el.setAttribute('x', String(it.x));
        el.setAttribute('y', String(it.y));
        el.setAttribute('visibility', it.hidden ? 'hidden' : 'visible');
      }
    }
    for (const h of d.handles) {
      const el = m.get(`h:${h.key}`);
      if (!el) continue;
      (el as HTMLElement).style.transform = handleAt(h.x, h.y);
      el.setAttribute('aria-valuenow', String(h.value));
      el.setAttribute('aria-valuetext', h.valueText);
    }
    for (const r of d.readouts) {
      const el = m.get(`r:${r.key}`);
      if (el) el.textContent = r.text;
    }
  };

  const local = (cx: number, cy: number) => {
    const r = svg.current?.getBoundingClientRect();
    return r ? { x: cx - r.left, y: cy - r.top } : { x: 0, y: 0 };
  };

  const settle = (n: CoordState) => {
    live.current = n;
    setSt(n);
    if (p.mode === 'explore') {
      const ok = p.goal ? goalMet(p, n) : true;
      if (ok && !done) {
        setDone(true);
        if (p.done) setMsg({ text: p.done, cls: 'ok' });
        onDone();
      }
    } else if (msg.cls) setMsg({ text: p.intro ?? '', cls: '' });
  };

  const gridMode = p.mode === 'plot' || p.mode === 'connect' || p.mode === 'line';

  // 손잡이(HTML)와 그림(SVG)을 함께 감싼 상자에서 받는다 — 손잡이는 SVG 밖에 겹쳐 있다
  useDrag(host, {
    pick(cx, cy) {
      const at = local(cx, cy);
      if (p.mode === 'sketch') {
        if (!sketching) return false;
        ctx.current = { kind: 'stroke', ...at };
        return true;
      }
      const hs = draw(p, live.current, boxRef.current).handles;
      const h = nearest(hs, at, HANDLE_HIT);
      if (h) {
        ctx.current = { kind: 'handle', key: h.key, ...at };
        return true;
      }
      if (gridMode) {
        ctx.current = { kind: 'tap', ...at };
        return true;
      }
      return false;
    },
    // 빈 칸 누르기(탭)로 시작한 터치는 스크롤로 남긴다 — 그래프 위에서도 페이지를 내릴 수 있게
    holdTouch: () => ctx.current?.kind !== 'tap',
    onStart() {
      const c = ctx.current;
      if (c?.kind === 'stroke') {
        const f = frame(boxRef.current);
        live.current = { ...live.current, stroke: [toWorld(p, f, c.x, c.y)] };
        apply(draw(p, live.current, boxRef.current));
      }
    },
    onMove(dx, dy) {
      const c = ctx.current;
      if (!c || c.kind === 'tap') return;
      const b = boxRef.current;
      // 그림 밖으로 끌어도 가장자리에 붙인다(화면 가장자리 20px 은 iOS 뒤로 가기 쓸기 자리)
      const x = Math.min(b.w - EDGE / 2, Math.max(EDGE / 2, c.x + dx));
      const y = Math.min(b.h, Math.max(0, c.y + dy));
      const s = live.current;
      if (c.kind === 'stroke') {
        const f = frame(b);
        live.current = { ...s, stroke: [...s.stroke, toWorld(p, f, x, y)] };
      } else if (c.key.startsWith('u')) {
        live.current = moveUser(p, s, Number(c.key.slice(1)), x, y, b);
      } else live.current = dragPoint(p, s, c.key, x, y, b);
      apply(draw(p, live.current, b));
    },
    onEnd(dx, dy, cancelled) {
      const c = ctx.current;
      ctx.current = null;
      if (!c) return;
      const b = boxRef.current;
      if (cancelled) {
        // 시스템이 끌기를 빼앗았다(전화·홈 쓸기): 반영하지 않고 처음 상태로
        live.current = st;
        apply(draw(p, st, b));
        return;
      }
      const tap = Math.hypot(dx, dy) < TAP_PX;
      if (c.kind === 'stroke') {
        settle(live.current);
        return;
      }
      if (c.kind === 'handle') {
        // 찍은 점을 그냥 누르면 지운다(찍기 모드). 직선 손잡이는 지우지 않는다
        if (tap && c.key.startsWith('u') && p.mode !== 'line') {
          settle(removeUser(st, Number(c.key.slice(1))));
          return;
        }
        settle(live.current);
        return;
      }
      if (!tap) return;
      const [wx, wy] = toWorld(p, frame(b), c.x, c.y);
      const g = gridAt(p, wx, wy);
      if (p.mode === 'line') {
        // 빈 곳을 누르면 가까운 손잡이가 그 칸으로 온다(끌기 대체)
        const [a, bb] = st.user as [{ i: number; j: number }, { i: number; j: number }];
        const da = Math.hypot(a.i - g.i, a.j - g.j);
        const db = Math.hypot(bb.i - g.i, bb.j - g.j);
        const n = da <= db ? 0 : 1;
        if ((n === 0 ? bb : a).i === g.i && (n === 0 ? bb : a).j === g.j) return;
        settle({ ...st, user: st.user.map((u, k) => (k === n ? g : u)) });
      } else settle(addUser(st, g));
    },
  });

  const onKey = (key: string) => (e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && key.startsWith('u') && p.mode !== 'line') {
      e.preventDefault();
      settle(removeUser(st, Number(key.slice(1))));
      return;
    }
    const n = keyMove(p, st, key, e.key);
    if (!n) return;
    e.preventDefault();
    settle(n);
  };

  const check = () => {
    const v = grade(p, st);
    if (v.ok) {
      setMsg({ text: p.done ?? '맞아요.', cls: 'ok' });
      if (!done) {
        setDone(true);
        onDone();
      }
    } else {
      setMsg({ text: v.why, cls: 'bad' });
      onMiss();
    }
  };

  // 슬라이더: 움직이는 동안은 직접 적용, 놓을 때 상태로(React 렌더는 놓을 때 한 번)
  const sliderRefs = useRef(new Map<string, HTMLInputElement>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: 슬라이더 목록은 매개변수에서 고정. 최신 상태는 live 로 읽는다
  useEffect(() => {
    const offs: (() => void)[] = [];
    for (const s of p.sliders) {
      const el = sliderRefs.current.get(s.id);
      if (!el) continue;
      const input = () => {
        live.current = {
          ...live.current,
          vars: { ...live.current.vars, [s.id]: Number(el.value) },
        };
        apply(draw(p, live.current, boxRef.current));
        const out = els.current.get(`s:${s.id}`);
        if (out) out.textContent = el.value;
      };
      const change = () => settle(live.current);
      el.addEventListener('input', input);
      el.addEventListener('change', change);
      offs.push(() => {
        el.removeEventListener('input', input);
        el.removeEventListener('change', change);
      });
    }
    return () => {
      for (const o of offs) o();
    };
  }, [p]);

  const d = useMemo(() => draw(p, st, box), [p, st, box]);
  const g = useMemo(() => grid(p, box), [p, box]);
  const f = frame(box);
  const dragPts = p.objects.filter((o): o is PointObj => o.kind === 'point' && o.drag === 'x');
  const legend = p.objects.filter((o) => o.kind === 'curve' && o.label);

  const touch = p.mode === 'sketch' && sketching ? 'none' : 'manipulation';
  return (
    <>
      <div ref={host} className="coord-host">
        {/* role="img" 를 달지 않는다 — img 는 자식을 읽지 않아 안의 손잡이(slider)가 사라진다 */}
        <svg
          ref={svg}
          className={`coord m-${p.mode}${sketching ? ' sketching' : ''}`}
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          style={{ touchAction: touch }}
        >
          <title>좌표평면</title>
          <defs>
            <clipPath id={clip}>
              <rect x={f.l} y={f.t} width={f.r - f.l} height={f.b - f.t} />
            </clipPath>
          </defs>
          <g className="grid">
            {g.xs.map((t) => (
              <line
                key={`gx${t.k}`}
                x1={t.px}
                y1={f.t}
                x2={t.px}
                y2={f.b}
                className={t.axis ? 'axis' : ''}
              />
            ))}
            {g.ys.map((t) => (
              <line
                key={`gy${t.k}`}
                x1={f.l}
                y1={t.px}
                x2={f.r}
                y2={t.px}
                className={t.axis ? 'axis' : ''}
              />
            ))}
          </g>
          <g className="ticks">
            {g.xs.map(
              (t) =>
                t.label !== null && (
                  <text key={`tx${t.k}`} x={t.px} y={f.b + 17} textAnchor="middle">
                    {t.label}
                  </text>
                ),
            )}
            {g.ys.map(
              (t) =>
                t.label !== null && (
                  <text key={`ty${t.k}`} x={f.l - 6} y={t.px + 4} textAnchor="end">
                    {t.label}
                  </text>
                ),
            )}
          </g>
          <g clipPath={`url(#${clip})`}>
            {d.items.map((it) => {
              if (it.t === 'path')
                return <path key={it.key} ref={reg(it.key)} d={it.d} className={it.cls} />;
              if (it.t === 'line')
                return (
                  <line
                    key={it.key}
                    ref={reg(it.key)}
                    x1={it.x1}
                    y1={it.y1}
                    x2={it.x2}
                    y2={it.y2}
                    className={it.cls}
                    visibility={it.hidden ? 'hidden' : 'visible'}
                  />
                );
              if (it.t === 'dot')
                return (
                  <circle
                    key={it.key}
                    ref={reg(it.key)}
                    cx={it.x}
                    cy={it.y}
                    r={5}
                    className={it.cls}
                    visibility={it.hidden ? 'hidden' : 'visible'}
                  />
                );
              return (
                <text
                  key={it.key}
                  ref={reg(it.key)}
                  x={it.x}
                  y={it.y}
                  className="pname"
                  visibility={it.hidden ? 'hidden' : 'visible'}
                >
                  {it.text}
                </text>
              );
            })}
          </g>
        </svg>
        {d.handles.map((h) => (
          <Handle
            key={h.key}
            ref={reg(`h:${h.key}`)}
            x={h.x}
            y={h.y}
            label={h.label}
            value={h.value}
            min={h.min}
            max={h.max}
            valueText={h.valueText}
            onKey={onKey(h.key)}
          />
        ))}
      </div>
      {legend.length > 0 && (
        <div className="legend">
          {legend.map(
            (o) =>
              o.kind === 'curve' && (
                <span key={o.id} className={`lg ${o.tone}`}>
                  <i aria-hidden="true" />
                  <LRich inline src={o.label as string} />
                </span>
              ),
          )}
        </div>
      )}
      {d.readouts.length > 0 && (
        <div className="readouts">
          {d.readouts.map((r) => (
            <div key={r.key} className="ro">
              <LRich inline src={r.label} />
              <b className="num" ref={reg(`r:${r.key}`)}>
                {r.text}
              </b>
            </div>
          ))}
        </div>
      )}
      {p.sliders.map((s) => (
        <label key={s.id} className="cslider">
          <LRich inline src={s.label} />
          <input
            ref={(el) => {
              if (el) sliderRefs.current.set(s.id, el);
              else sliderRefs.current.delete(s.id);
            }}
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            defaultValue={s.value}
          />
          <b className="num" ref={reg(`s:${s.id}`)}>
            {st.vars[s.id]}
          </b>
        </label>
      ))}
      <div className={`toast ${msg.cls}`} aria-live="polite">
        {msg.text && <LRich inline src={msg.text} />}
      </div>
      <div className="actions">
        {dragPts.length > 0 && (
          <div className="row2">
            {dragPts.flatMap((o) => [
              <button
                type="button"
                key={`${o.id}-`}
                className="lbtn soft"
                onClick={() => settle(keyMove(p, st, o.id, 'ArrowLeft') ?? st)}
              >
                {o.name ?? o.id} 왼쪽으로
              </button>,
              <button
                type="button"
                key={`${o.id}+`}
                className="lbtn soft"
                onClick={() => settle(keyMove(p, st, o.id, 'ArrowRight') ?? st)}
              >
                {o.name ?? o.id} 오른쪽으로
              </button>,
            ])}
          </div>
        )}
        {(p.mode === 'plot' || p.mode === 'connect') && (
          <div className="row2">
            <button
              type="button"
              className="lbtn soft"
              onClick={() => {
                const g0 = freeSpot(p, st);
                if (g0) settle(addUser(st, g0));
              }}
            >
              점 더하기
            </button>
            <button
              type="button"
              className="lbtn soft"
              disabled={st.user.length === 0}
              onClick={() => settle({ ...st, user: [] })}
            >
              모두 지우기
            </button>
          </div>
        )}
        {p.mode === 'sketch' && (
          <button
            type="button"
            className="lbtn soft"
            aria-pressed={sketching}
            onClick={() => {
              if (sketching) settle({ ...st, stroke: [] });
              setSketching(true);
            }}
          >
            {sketching ? '지우고 다시 긋기' : '그리기 시작'}
          </button>
        )}
        {p.mode !== 'explore' && (
          <button type="button" className="lbtn blue" onClick={check}>
            확인하기
          </button>
        )}
      </div>
    </>
  );
}
