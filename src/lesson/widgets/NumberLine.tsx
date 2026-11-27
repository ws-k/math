// 수직선 화면. 상태 → 그릴 것은 numberLine.ts(nlDraw), 손짓 → 상태·판정·안내의 순서는 numberLineWire.ts(배선)가
// 정하고, 여기서는 그 둘을 React 에 잇기만 한다. 끄는 동안은 useWidgetDrag 가 SVG 를 직접 고치고(React 렌더 없음, P8),
// 놓을 때 한 번 상태를 바꾼다. 손잡이·슬라이더는 한 번에 하나만 잡힌다(P9 — 배선의 busy).
//
// 점프: 점을 다음 도착 칸에 '놓으면' 화살표가 생긴다(P2·P3). 두 번 놓치면 ◀▶ 단추가 나온다(P4).
// 점 찍기 점의 ◀▶ 는 예전처럼 늘 보인다: 점 찍기는 '확인'으로 채점해 놓을 때 판정이 없고, 지금 26장면의 화면을 그대로 둔다.
// 2-라: 두 줄(아래 줄 축·눈금), 진리집합 줄(nlSets)과 머리글의 조건(nlHeadTex), 두 끝 구간 고르기(끝점 둘 + 왼쪽 끝·
// 오른쪽 끝·바깥 단추 — 글은 고정, 상태는 aria-pressed), 점프 두 벌(둘째 벌은 다른 줄·색), 화살표 이름표 자리
// (nlJumpArcs — 겹치면 생략)는 모두 모델이 정하고 여기서는 그리기만 한다.
// 손잡이 누르는 영역이 겹치면(두 끝이 이웃 칸) 손가락에 가장 가까운 손잡이가 잡힌다(pickAt).
import { useEffect, useRef, useState } from 'react';
import { clamp, tapMode } from '../drag.ts';
import { Tex } from '../ui.tsx';
import { DragHandle } from './DragHandle.tsx';
import { applyDrawing } from './draw.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  cellOfHandle,
  isJumper,
  isTopMark,
  type NLParams,
  type NLState,
  nlActive,
  nlGrade,
  nlHandleText,
  nlHeadTex,
  nlHeight,
  nlInit,
  nlIwFlip,
  nlJumpArcs,
  nlJumpCount,
  nlJumper,
  nlLine,
  nlLine2,
  nlRegion,
  nlSets,
  nlSliderValues,
  nlTicks,
  nlTicks2,
  valueAt,
  W,
} from './numberLine.ts';
import { type NLMsg, nearestHandle, nlWire } from './numberLineWire.ts';
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
    Math.max(1, nlJumpCount(p)),
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
  const jumping = st.jump < nlJumpCount(p);
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

  /** 마지막으로 눌린 손가락(포인터) — 더 가까운 손잡이로 누름을 넘길 때 같은 손가락으로 잡게 */
  const pointer = useRef(0);
  useEffect(() => {
    const el = root.current;
    const note = (e: PointerEvent) => {
      pointer.current = e.pointerId;
    };
    el?.addEventListener('pointerdown', note, true);
    return () => el?.removeEventListener('pointerdown', note, true);
  }, []);
  /**
   * 누른 자리에서 이 손잡이(id)를 잡을까. 누름은 맨 위에 그려진 손잡이가 받으므로, 누르는 영역이 겹친 곳에서 다른
   * 손잡이가 손가락에 더 가까우면 그 손잡이에 같은 누름을 다시 보내고 여기서는 거절한다(그 손잡이가 포인터를 잡는다)
   */
  const pickAt = (id: string, x: number, y: number) => {
    if (!w.pick()) return false;
    const hs = [...(root.current?.querySelectorAll<SVGGElement>('g[data-k^="h:"]') ?? [])].map(
      (g) => {
        const b = g.getBoundingClientRect();
        return {
          id: (g.dataset.k ?? '').slice(2),
          x: b.left + b.width / 2,
          y: b.top + b.height / 2,
          g,
        };
      },
    );
    const best = nearestHandle(hs, { x, y });
    if (!best || best === id) return true;
    hs.find((h) => h.id === best)
      ?.g.querySelector('.svg-handle')
      ?.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: pointer.current,
          clientX: x,
          clientY: y,
          isPrimary: true,
          button: 0,
          bubbles: true,
          cancelable: true,
        }),
      );
    return false;
  };

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
      ? nlJumper(p, st)
      : null
    : handles.some((h) => h.id === sel)
      ? sel
      : (handles[0]?.id ?? null);
  const arrowsName = handles.find((h) => h.id === arrows)?.name;
  const arcs = nlJumpArcs(p);
  const line2 = nlLine2(p);
  const head = nlHeadTex(p);
  const reads = Object.entries(d.texts).filter(([k]) => k !== 'slider');

  return (
    <div className="wgt nl" ref={root}>
      {head.length > 0 && (
        <div className="wgt-head nl-head">
          {head.map((t) => (
            <Tex key={t} tex={t} />
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${nlHeight(p)}`} className="wgt-svg">
        <title>수직선</title>
        <line x1={4} y1={line} x2={W - 4} y2={line} className="nl-axis" />
        <Ticks ticks={nlTicks(p)} y={line} />
        {p.second && (
          <>
            <line x1={4} y1={line2} x2={W - 4} y2={line2} className="nl-axis" />
            <Ticks ticks={nlTicks2(p)} y={line2} />
          </>
        )}
        <Marks marks={nlSets(p)} />
        <Marks marks={nlRegion(p)} />
        {arcs.map((a, i) => (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: 점프 순서는 매개변수에서 고정
            key={i}
            className={a.set === 2 ? 'nl-jump two' : 'nl-jump'}
            visibility={i < st.jump ? 'visible' : 'hidden'}
          >
            <path d={a.d} />
            <polygon points={a.arrow} />
            {a.label && (
              <text x={a.label.x} y={a.label.y}>
                {a.label.text}
              </text>
            )}
          </g>
        ))}
        <Marks marks={d.marks.filter((m) => !m.k.startsWith('h:') && !isTopMark(m.k))} />
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
              valueText={nlHandleText(p, st, h.id)}
              onKey={(key) => step(h.id, key)}
              {...(isJumper(h.id) ? { onBlur: judge.flush } : {})}
              pick={(px, py) => pickAt(h.id, px, py)}
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
        <Marks marks={d.marks.filter((m) => isTopMark(m.k))} />
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
              {...(isJumper(arrows) ? { onBlur: judge.flush } : {})}
            >
              ◀ 한 칸
            </button>
            <button
              type="button"
              className="lbtn soft"
              aria-label={`${arrowsName} 한 칸 오른쪽`}
              onClick={() => step(arrows, 'ArrowRight')}
              {...(isJumper(arrows) ? { onBlur: judge.flush } : {})}
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
        {st.iw && (
          // 세 단추를 한 줄에(382 폭에서 두 줄씩 접히면 '확인'이 아래 고정 단추에 가린다 — 헤드리스 실측).
          // 글은 고정이고 지금 상태는 눌림(aria-pressed)으로만 — 글이 상태에 따라 바뀌면 '누르면 무엇이 되는지'와
          // '지금 무엇인지'가 헷갈린다(검토). 눌린 모양은 CSS(.nl-iw [aria-pressed=true])
          <div className="nl-iw">
            <button
              type="button"
              className="lbtn soft"
              aria-pressed={st.iw.aOpen}
              aria-label="왼쪽 끝 빈 점"
              onClick={() => setS({ ...s, iw: nlIwFlip(st, 'lo').iw ?? null })}
            >
              왼쪽 ○
            </button>
            <button
              type="button"
              className="lbtn soft"
              aria-pressed={st.iw.bOpen}
              aria-label="오른쪽 끝 빈 점"
              onClick={() => setS({ ...s, iw: nlIwFlip(st, 'hi').iw ?? null })}
            >
              오른쪽 ○
            </button>
            <button
              type="button"
              className="lbtn soft"
              aria-pressed={st.iw.out}
              aria-label="바깥 두 조각"
              onClick={() => setS({ ...s, iw: nlIwFlip(st, 'out').iw ?? null })}
            >
              바깥
            </button>
          </div>
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

/** 한 줄의 눈금·숫자(단위는 모델이 마지막 숫자 뒤에 붙여 준다 — 숫자 간격을 정할 때 그 폭까지 본다) */
function Ticks({ ticks, y }: { ticks: { x: number; label?: string }[]; y: number }) {
  return (
    <>
      {ticks.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 눈금 순서는 매개변수에서 고정
        <g key={i}>
          <line x1={t.x} y1={y - 6} x2={t.x} y2={y + 6} className="nl-tick" />
          {t.label !== undefined && (
            <text x={t.x} y={y + 26} className="nl-num">
              {t.label}
            </text>
          )}
        </g>
      ))}
    </>
  );
}
