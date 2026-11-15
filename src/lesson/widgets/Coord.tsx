// 좌표평면 화면. 무엇을 어디에 그릴지는 coord.ts 의 draw(상태 → 그릴 목록)가 정하고, 여기서는
// ① 처음·상태가 바뀔 때 React 로 그리고 ② 끄는 동안에는 같은 목록을 DOM 에 직접 적용한다(React 렌더 없음).
// 상태는 손을 뗄 때 한 번만 바꾼다. 목표 판정도 손을 뗄 때만 한다(원칙 P3 — 끄는 도중 지나간 자리는 세지 않음).
// 방향키·◀▶ 버튼·슬라이더 키는 누를 때마다가 아니라 멈추거나 포커스가 떠날 때 한 번 판정한다(useGoal).
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
  AXIS_LABEL_GAP,
  addUser,
  axisLabel,
  type Box,
  type CoordParams,
  type CoordState,
  type Drawing,
  dragPoint,
  draw,
  frame,
  freeSpot,
  goalHits,
  goalNeed,
  grade,
  grid,
  gridAt,
  type Item,
  initial,
  keyMove,
  labelWidth,
  MIN_BOX_H,
  moveUser,
  type PointObj,
  removeUser,
  sliderSnap,
  toWorld,
} from './coord.ts';
import { GoalLine } from './GoalLine.tsx';
import type { WidgetProps } from './index.tsx';
import { useGoal } from './useGoal.ts';

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
  const doneRef = useRef(false);
  const need = goalNeed(p);
  const clip = useId();
  /** 끄는 동안의 상태(화면에 직접 적용한 것). 손을 떼면 setSt 로 넘긴다 */
  const live = useRef(st);
  const els = useRef(new Map<string, Element>());
  const ctx = useRef<Ctx | null>(null);
  /** 슬라이더를 손으로 끄는 중(pointerdown ~ 손 뗌) */
  const sliding = useRef(false);
  // 끄는 도중에 다른 까닭(목표 판정 글 등)으로 다시 그려져도 끄는 중 상태를 처음 상태로 되돌리지 않는다
  if (!ctx.current && !sliding.current) live.current = st;
  const boxRef = useRef(box);
  boxRef.current = box;
  // 목표를 이루면 숨긴 정답(곡선·목표 점)을 그린다. 키 판정은 타이머에서 오므로 최신 상태(live)에 붙인다
  const { prog, judge } = useGoal(need, onDone, (g) => {
    if (!g.done || live.current.solved) return;
    const n = { ...live.current, solved: true };
    live.current = n;
    setSt(n);
  });

  // 크기: 폭은 카드 폭, 높이는 폭의 0.78배를 화면 높이의 36% 안으로(최소 200). 접은 화면(382×580)에서
  // 그림·읽는 값·목표 글·◀▶ 버튼이 위 막대와 '계속하기' 사이(약 444px)에 함께 들어가게 — 절반(290)이면 넘쳤다.
  // 렌더 중에는 window 를 읽지 않는다(서버 렌더·스모크 테스트)
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      if (!w) return;
      const maxH = Math.max(MIN_BOX_H, Math.round(window.innerHeight * 0.36));
      const h = Math.min(maxH, Math.max(MIN_BOX_H, Math.round(w * 0.78)));
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
    for (const it of [...d.fills, ...d.items]) {
      const el = m.get(it.key);
      if (!el) continue;
      if (it.t === 'path') {
        el.setAttribute('d', it.d);
        // 조각이 좁아지면 테두리를 가늘게(rect … thin) — 끄는 동안 바뀌는 유일한 class
        el.setAttribute('class', it.cls);
      } else if (it.t === 'line') {
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
      if (r.parts)
        r.parts.forEach((pt, i) => {
          const el = m.get(`r:${r.key}:${i}`);
          if (el) el.textContent = pt.text;
        });
      else {
        const el = m.get(`r:${r.key}`);
        if (el) el.textContent = r.text;
      }
    }
  };

  const local = (cx: number, cy: number) => {
    const r = svg.current?.getBoundingClientRect();
    return r ? { x: cx - r.left, y: cy - r.top } : { x: 0, y: 0 };
  };

  /**
   * 손을 뗀 자리를 상태로. explore 의 목표 판정도 여기서만 한다 — 끌어 놓기(hand)는 바로,
   * 키·버튼(key)은 멈추거나 포커스가 떠날 때 마지막 자리 하나만(연타로 숨긴 정답을 더듬지 않게)
   */
  const settle = (n: CoordState, via: 'hand' | 'key' = 'hand') => {
    if (p.mode === 'explore') {
      if (!p.goal && !doneRef.current) {
        // 목표가 없는 탐색은 한 번 만져 보면 끝
        doneRef.current = true;
        setDone(true);
        if (p.done) setMsg({ text: p.done, cls: 'ok' });
        onDone();
      }
    } else if (msg.cls) setMsg({ text: p.intro ?? '', cls: '' });
    live.current = n;
    setSt(n);
    if (p.mode === 'explore' && p.goal) {
      // 미룬 판정은 이 키가 만든 자리(n)를 본다 — 판정 전에 끌기가 시작돼도 끄는 중 자리를 보지 않게
      if (via === 'key') judge.later(() => goalHits(p, n));
      else judge.release(goalHits(p, n));
    }
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

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
      // 키·버튼으로 옮기고 0.6초가 안 돼 끌기 시작하면, 기다리던 판정을 끌기 전 자리로 지금 끝낸다
      // (타이머가 끄는 도중에 터지면 판정 글이 바뀌며 다시 그려진다 — 끄는 동안 렌더 0회 규칙)
      judge.flush();
      const c = ctx.current;
      if (c?.kind === 'stroke') {
        const f = frame(boxRef.current, p);
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
        const f = frame(b, p);
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
      const [wx, wy] = toWorld(p, frame(b, p), c.x, c.y);
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
    settle(n, 'key');
  };

  const check = () => {
    const v = grade(p, st);
    if (v.ok) {
      setMsg({ text: p.done ?? '맞아요.', cls: 'ok' });
      // 맞히면 숨긴 정답 곡선을 그린다(손그리기 과제의 정답 공개)
      if (!st.solved) {
        const n = { ...st, solved: true };
        live.current = n;
        setSt(n);
      }
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
      // 손으로 끈 슬라이더(pointerdown ~ 놓을 때의 change)만 '손 뗌'으로 바로 판정한다. 나머지 change —
      // 방향키, 그리고 키 이벤트 없이 change 만 보내는 보조기기 — 는 키처럼 멈출 때 한 번만 판정한다
      let hand = false;
      const up = () => {
        sliding.current = false;
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        // 놓을 때의 change 는 pointerup 바로 뒤에 온다 — 그것까지 손으로 치고 끝낸다
        setTimeout(() => {
          hand = false;
        }, 0);
      };
      const ptr = () => {
        hand = true;
        // 손으로 끌기 시작: 기다리던 키 판정을 지금 끝내고(끄는 도중 터지지 않게), 손 뗄 때까지 끄는 중
        judge.flush();
        sliding.current = true;
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      };
      const input = () => {
        // 제외 값(밑 a=1 등)은 움직이던 쪽으로 건너뛴다
        const v = sliderSnap(s, Number(el.value), live.current.vars[s.id] ?? s.value);
        if (v !== Number(el.value)) el.value = String(v);
        live.current = {
          ...live.current,
          vars: { ...live.current.vars, [s.id]: v },
        };
        apply(draw(p, live.current, boxRef.current));
        const out = els.current.get(`s:${s.id}`);
        if (out) out.textContent = el.value;
      };
      const change = () => {
        sliding.current = false;
        settleRef.current(live.current, hand ? 'hand' : 'key');
      };
      const blur = () => judge.flush();
      el.addEventListener('pointerdown', ptr);
      el.addEventListener('input', input);
      el.addEventListener('change', change);
      el.addEventListener('blur', blur);
      offs.push(() => {
        el.removeEventListener('pointerdown', ptr);
        el.removeEventListener('input', input);
        el.removeEventListener('change', change);
        el.removeEventListener('blur', blur);
        up();
      });
    }
    return () => {
      for (const o of offs) o();
    };
  }, [p]);

  const d = useMemo(() => draw(p, st, box), [p, st, box]);
  const g = useMemo(() => grid(p, box), [p, box]);
  const f = frame(box, p);
  const xName = axisLabel(p.x);
  const yName = axisLabel(p.y);
  const looks = new Set(d.fills.flatMap((it) => (it.t === 'path' && it.look ? [it.look] : [])));

  /** 그릴 목록 항목 하나(칠하기·조각·곡선·점·이름표 공용). 끄는 동안 apply 가 같은 key 로 DOM 을 고친다 */
  const node = (it: Item) => {
    if (it.t === 'path')
      return (
        <path
          key={it.key}
          ref={reg(it.key)}
          d={it.d}
          className={it.cls}
          // 무늬 재질(흙·물결)은 이 그림만의 무늬를 가리킨다 — 화면에 좌표평면이 둘이어도 id 가 겹치지 않게
          fill={it.look === 'soil' || it.look === 'water' ? `url(#${clip}-${it.look})` : undefined}
        />
      );
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
        className={it.cls ?? 'pname'}
        textAnchor={it.cls === 'tag' ? 'middle' : undefined}
        visibility={it.hidden ? 'hidden' : 'visible'}
      >
        {it.text}
      </text>
    );
  };
  const dragPts = p.objects.filter((o): o is PointObj => o.kind === 'point' && o.drag === 'x');
  // 숨긴 정답 곡선의 범례는 맞힌 뒤에
  const legend = p.objects.filter((o) => o.kind === 'curve' && o.label && !(o.hide && !st.solved));

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
            {/* 넓은 영역의 재질 무늬: 흙(밭고랑 줄)·물(물결). 좁은 띠(길)·조각은 단색이라 무늬가 없다 */}
            {looks.has('soil') && (
              <pattern id={`${clip}-soil`} width="8" height="6" patternUnits="userSpaceOnUse">
                <rect width="8" height="6" className="pat-soil" />
                <line x1="0" y1="5" x2="8" y2="5" className="pat-soil-line" />
              </pattern>
            )}
            {looks.has('water') && (
              <pattern id={`${clip}-water`} width="12" height="8" patternUnits="userSpaceOnUse">
                <rect width="12" height="8" className="pat-water" />
                <path d="M0 5 q3 -2.5 6 0 t6 0" className="pat-water-line" />
              </pattern>
            )}
          </defs>
          {d.fills.length > 0 && <g clipPath={`url(#${clip})`}>{d.fills.map(node)}</g>}
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
            {/* 축 끝 글자: 가로는 마지막 눈금 글자 오른쪽(frame 이 그 자리를 비워 둠), 세로는 그림 위 왼쪽 */}
            {xName && (
              <text x={f.r + AXIS_LABEL_GAP} y={f.b + 17} className="axname">
                {xName}
              </text>
            )}
            {yName && (
              // 눈금 숫자 열 위에 오른쪽 맞춤('30' 위 '(m)'). 그 열보다 길면 상자 왼쪽 끝부터
              <text
                x={labelWidth(yName) <= f.l - 6 ? f.l - 6 : 0}
                y={f.t - 6}
                textAnchor={labelWidth(yName) <= f.l - 6 ? 'end' : 'start'}
                className="axname"
              >
                {yName}
              </text>
            )}
          </g>
          <g clipPath={`url(#${clip})`}>{d.items.map(node)}</g>
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
            onBlur={judge.flush}
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
              {r.parts ? (
                // 작은 어림 ~ 큰 어림: 조각 색과 같은 색 글자로(초록 = 작은, 노랑 = 큰)
                <b className="num">
                  {r.parts.map((pt, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: 조각 수가 고정(5개)이라 순번이 곧 자리
                      key={i}
                      ref={reg(`r:${r.key}:${i}`)}
                      className={pt.cls || undefined}
                    >
                      {pt.text}
                    </span>
                  ))}
                </b>
              ) : (
                <b className="num" ref={reg(`r:${r.key}`)}>
                  {r.text}
                </b>
              )}
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
      {p.mode === 'explore' && p.goal ? (
        <GoalLine
          prog={prog}
          need={need}
          texts={{ intro: p.intro, done: p.done, hint: p.goal.hint }}
        />
      ) : (
        <div className={`toast ${msg.cls}`} aria-live="polite">
          {msg.text && <LRich inline src={msg.text} />}
        </div>
      )}
      {/* 버튼이 하나도 없으면(슬라이더만 있는 탐색) 칸을 두지 않는다 — 빈 칸도 카드 간격(14px)을 먹어 접은 화면에서 넘친다 */}
      {(dragPts.length > 0 || p.mode !== 'explore') && (
        <div className="actions">
          {dragPts.length > 0 && (
            <div className="row2">
              {dragPts.flatMap((o) => [
                <button
                  type="button"
                  key={`${o.id}-`}
                  className="lbtn soft"
                  onClick={() => settle(keyMove(p, st, o.id, 'ArrowLeft') ?? st, 'key')}
                  onBlur={judge.flush}
                >
                  {o.name ?? o.id} 왼쪽으로
                </button>,
                <button
                  type="button"
                  key={`${o.id}+`}
                  className="lbtn soft"
                  onClick={() => settle(keyMove(p, st, o.id, 'ArrowRight') ?? st, 'key')}
                  onBlur={judge.flush}
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
      )}
    </>
  );
}
