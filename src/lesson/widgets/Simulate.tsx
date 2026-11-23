// 확률 실험 화면(시안 outputs/widgets-v2/prob/toss.html). '던지기'를 한 번 누르면 한 번, 꾹 누르고 있으면 점점 빠르게
// 계속 던진다. 막대 = 나온 비율, 점선 = 이론값. '되감기'는 지난 기록을 지우지 않고 앞뒤로 훑는다.
// 누르는 동안·되감는 동안은 React 를 다시 그리지 않고 simDraw 의 그릴 목록을 applyDrawing 으로 직접 적용한다(P8) —
// 손을 떼면 한 번만 상태를 바꾼다. 그래서 기록·되감기 자리(t)는 ref 에 두고, 렌더는 ref 를 그대로 그린다
// (도중에 부모가 다시 그려도 지금 기록 그대로 나오게).
// 막대 높이 축척은 이론값에서 정해 고정한다 — 던질 때마다 축척이 바뀌면 막대가 이론값에 다가가는 모습이 안 보인다.
// 접은 화면(382×580)은 그림을 낮추고, 표를 결과가 열인 가로 표로 바꿔 한 화면에 넣는다(simulate.ts simFrame·simBlocks).
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useCompact } from './compact.ts';
import { applyDrawing } from './draw.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import {
  makeHold,
  SIM_MAX,
  SIM_TABLE_MAX,
  type SimHistory,
  type SimParams,
  simActLabel,
  simAppend,
  simAt,
  simAxis,
  simBlocks,
  simCategories,
  simDraw,
  simFrame,
  simHistory,
  simLastFrame,
  simSay,
} from './simulate.ts';

const clock = {
  now: () => performance.now(),
  later(ms: number, fn: () => void) {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};
const isPress = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

export function Simulate({ params: p0, onDone, answered }: WidgetProps<SimParams>) {
  const compact = useCompact();
  // 질문 장면은 맞히기 전까지 이론값(표의 칸·그림의 점선·점선 범례 글)을 뺀다 — '앞 1개 이론 1/2' 칸과
  // 50% 눈금에 딱 놓인 점선이 답을 그대로 보여 줬다(m2-probability hook). 탐색 장면(answered 없음)은 비율이
  // 이론값에 다가가는 것을 보는 게 목적이라 늘 보인다
  const theory = answered !== false;
  const [size, setSize] = useState(p0.n);
  const p = simAt(p0, size);
  // 기록은 표본 크기마다 따로(크기를 바꿔도 앞 크기의 기록이 남아 퍼짐을 견줄 수 있게), 되감기 자리도 크기마다
  const hists = useRef(new Map<number, { h: SimHistory; t: number }>());
  const live = (() => {
    const had = hists.current.get(size);
    if (had) return had;
    const x = { h: simHistory(p), t: 0 };
    hists.current.set(size, x);
    return x;
  })();
  const [, commit] = useReducer((n: number) => n + 1, 0);
  const [auto, setAuto] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const lastSvg = useRef<SVGSVGElement>(null);
  const goBtn = useRef<HTMLButtonElement>(null);
  const sr = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const gone = useRef(false);
  const src = useRef<'press' | 'auto' | null>(null);
  const sliderId = useId();

  // 처리기(누르고 있기·되감기)는 한 번만 만들고 최신 값은 ref 로 읽는다 — 렌더마다 새로 만들면 누르는 도중의
  // 박자 조절기가 버려진다
  const latest = useRef({ p, live, theory, compact, onDone });
  latest.current = { p, live, theory, compact, onDone };

  /** 지금 기록·자리를 화면에 직접 적용(React 렌더 없음). anim 이면 마지막 결과가 한 번 뒤집힌다 */
  const paint = (anim: boolean) => {
    const { p: cp, live: lv, theory: th, compact: cm } = latest.current;
    const el = root.current;
    if (!el) return;
    const d = simDraw(cp, lv.h, lv.t, { theory: th, compact: cm });
    applyDrawing(el, { marks: [...d.marks, ...d.last], texts: d.texts });
    const s = slider.current;
    if (s) {
      const total = lv.h.cats.length;
      s.max = String(total);
      s.value = String(lv.t);
      s.disabled = total === 0;
      s.setAttribute('aria-valuetext', `${lv.t}번째까지`);
    }
    const g = lastSvg.current;
    if (anim && g) {
      g.classList.remove('flip');
      g.getBoundingClientRect(); // 같은 움직임을 처음부터 다시 돌리려면 한 번 배치를 읽어야 한다
      g.classList.add('flip');
    }
  };
  /** 손을 뗀 뒤 한 번: 상태로 정하고, 낭독기에 요약을 한 번 읽히고, 목표(던진 횟수)를 본다 */
  const settle = () => {
    src.current = null;
    if (gone.current) return; // 떠나는 중에 멈춘 것은 상태·목표로 적지 않는다
    goBtn.current?.classList.remove('holding');
    const { p: cp, live: lv, onDone: od } = latest.current;
    if (sr.current) sr.current.textContent = simSay(cp, lv.h, lv.t);
    setAuto(false);
    commit();
    if (!done.current && lv.h.cats.length >= cp.goal) {
      done.current = true;
      od();
    }
  };
  const hold = useRef<ReturnType<typeof makeHold> | null>(null);
  if (!hold.current)
    hold.current = makeHold(
      clock,
      (k, first) => {
        const { p: cp, live: lv } = latest.current;
        const added = simAppend(cp, lv.h, k);
        lv.t = lv.h.cats.length; // 던지면 늘 기록 맨 끝에 잇고, 되감던 자리는 맨 끝으로 돌아간다
        if (added > 0) paint(first);
        return added === k && lv.h.cats.length < SIM_MAX;
      },
      settle,
    );
  const h = hold.current;

  // 그린 뒤마다 직접 고칠 것(슬라이더의 현재 값)을 지금 기록에 맞춘다 — 슬라이더는 값을 React 가 쥐지 않는다
  useLayoutEffect(() => paint(false));
  // 장면을 떠나면 누르던 것을 멈춘다(타이머가 남아 없는 화면을 고치지 않게). 개발 모드의 두 번 붙이기에도 되살아나게
  // 붙을 때 표시를 다시 끈다
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      hold.current?.stop();
    };
  }, []);
  // 되감기: 끄는 동안(input)은 그림만, 놓을 때(change) 한 번 상태로
  useEffect(() => {
    const el = slider.current;
    if (!el) return;
    const input = () => {
      latest.current.live.t = Number(el.value);
      paint(false);
    };
    const change = () => {
      input();
      const { p: cp, live: lv } = latest.current;
      if (sr.current) sr.current.textContent = simSay(cp, lv.h, lv.t);
      commit();
    };
    el.addEventListener('input', input);
    el.addEventListener('change', change);
    return () => {
      el.removeEventListener('input', input);
      el.removeEventListener('change', change);
    };
  });

  const press = () => {
    if (h.on) return;
    src.current = 'press';
    goBtn.current?.classList.add('holding');
    h.start();
  };
  const release = () => {
    if (src.current === 'press') h.stop();
  };
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 기본 동작(글자 고르기·확대경·초점 옮기기)을 막고, 손가락이 단추 밖으로 미끄러져도 뗄 때까지 이 단추가 받는다
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 합성 이벤트 등 잡을 포인터가 없으면 그냥 둔다(뗄 때 pointerup 이 이 단추에 온다)
    }
    press();
  };
  const toggleAuto = () => {
    if (src.current === 'auto') return h.stop();
    if (h.on) return;
    src.current = 'auto';
    setAuto(true);
    h.start();
  };

  const d = simDraw(p, live.h, live.t, { theory, compact });
  const cats = simCategories(p);
  const total = live.h.cats.length;
  const { W, H } = simFrame(compact);
  const lf = simLastFrame(p);
  const axis = simAxis(p);
  const verbLabel = simActLabel(p);
  const table = cats.length <= SIM_TABLE_MAX;
  return (
    <div className="wgt sim" ref={root}>
      {p0.sizes && p0.sizes.length > 1 && (
        <fieldset className="sim-sizes">
          <legend className="sim-sr">표본 크기</legend>
          {p0.sizes.map((m) => (
            <button
              type="button"
              key={m}
              className={`lbtn ${m === size ? 'blue' : 'soft'}`}
              aria-pressed={m === size}
              onClick={() => !h.on && setSize(m)}
            >
              표본 {m}개
            </button>
          ))}
        </fieldset>
      )}
      <div className="sim-toss">
        <div className="sim-last">
          <svg
            ref={lastSvg}
            className="sim-last-svg"
            width={lf.W}
            height={lf.H}
            viewBox={`0 0 ${lf.W} ${lf.H}`}
            aria-hidden="true"
          >
            <Marks marks={d.last} />
          </svg>
          <span className="sim-cap num" data-t="cap">
            {d.texts.cap}
          </span>
        </div>
        {/* 길게 누르기 어려운 사람용: 켜 두면 손을 대지 않아도 계속, 다시 누르면 멈춘다 */}
        <button
          type="button"
          className="lbtn soft sim-auto"
          aria-pressed={auto}
          onClick={toggleAuto}
        >
          {compact ? '계속' : '계속 던지기'}
        </button>
        <button
          ref={goBtn}
          type="button"
          className="lbtn blue sim-go"
          onPointerDown={onDown}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (!isPress(e)) return;
            e.preventDefault();
            if (!e.repeat) press();
          }}
          onKeyUp={(e) => {
            if (!isPress(e)) return;
            e.preventDefault();
            release();
          }}
          onBlur={release}
          onClick={(e) => {
            // 키·포인터 없이 오는 누름(화면 낭독기의 '활성화')은 한 번 던지기. 손가락·마우스·키는 위에서 이미 던졌다
            if (e.detail !== 0 || h.on) return;
            press();
            release();
          }}
        >
          {verbLabel}
          <small>꾹 누르면 계속</small>
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="wgt-svg">
        <title>확률 실험 결과 막대그래프</title>
        <Marks marks={d.marks} />
      </svg>
      <div className="wgt-read">
        <span className="num" data-t="read">
          {d.texts.read}
        </span>
        <span className="sim-legend">
          {compact
            ? `막대 비율${theory ? ' · 점선 이론' : ''}`
            : `막대 = 나온 비율${theory ? ' · 점선 = 이론값' : ''}`}
        </span>
      </div>
      {table &&
        (compact ? (
          // 결과가 열인 가로 표. 이름 줄이 그림의 결과 이름과 같은 순서라 위아래로 맞춰 읽는다
          simBlocks(cats.length).map((idx) => (
            <table key={idx[0]} className="sim-table fold">
              <tbody>
                <tr>
                  <th scope="row">{axis}</th>
                  {idx.map((i) => (
                    <th key={i} scope="col">
                      {cats[i]?.short}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th scope="row">비율</th>
                  {idx.map((i) => (
                    <td key={i} className="num" data-t={`pct:${i}`}>
                      {d.texts[`pct:${i}`]}
                    </td>
                  ))}
                </tr>
                {theory && (
                  <tr>
                    <th scope="row">이론</th>
                    {idx.map((i) => (
                      <td key={i} className="num">
                        {ratText(cats[i]?.prob)}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          ))
        ) : (
          <table className="sim-table">
            <tbody>
              {cats.map((c, i) => (
                <tr key={c.label}>
                  <th scope="row">{c.label}</th>
                  <td className="num" data-t={`cnt:${i}`}>
                    {d.texts[`cnt:${i}`]}
                  </td>
                  {theory && <td className="num">이론 {ratText(c.prob)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      <div className="sim-rew">
        <label htmlFor={sliderId}>되감기</label>
        <input
          ref={slider}
          id={sliderId}
          type="range"
          min={0}
          max={total}
          step={1}
          defaultValue={live.t}
          disabled={total === 0}
          aria-valuetext={`${live.t}번째까지`}
        />
        <output htmlFor={sliderId} className="num" data-t="rew">
          {d.texts.rew}
        </output>
      </div>
      {/* 손을 뗄 때만 채운다(settle) — 누르는 동안 바뀌는 글자를 낭독기가 하나하나 읽지 않게 */}
      <div className="sim-sr" ref={sr} aria-live="polite" />
    </div>
  );
}

const ratText = (q: readonly [bigint, bigint] | undefined) =>
  !q ? '' : q[1] === 1n ? String(q[0]) : `${q[0]}/${q[1]}`;
