// 확률 실험 화면(시안 outputs/widgets-v2/prob/toss.html). '던지기'를 한 번 누르면 한 번, 꾹 누르고 있으면 점점 빠르게
// 계속 던진다. 막대 = 나온 비율, 점선 = 이론값. '되감기'는 지난 기록을 지우지 않고 앞뒤로 훑는다.
// 누르는 동안·되감는 동안은 React 를 다시 그리지 않고 simDraw 의 그릴 목록을 applyDrawing 으로 직접 적용한다(P8) —
// 손을 떼면 한 번만 상태를 바꾼다. 그래서 기록·되감기 자리(t)는 ref 에 두고, 렌더는 ref 를 그대로 그린다
// (도중에 부모가 다시 그려도 지금 기록 그대로 나오게).
// 막대 높이 축척은 이론값에서 정해 고정한다 — 던질 때마다 축척이 바뀌면 막대가 이론값에 다가가는 모습이 안 보인다.
// 접은 화면(382×580)은 그림을 낮추고, 표를 결과가 열인 가로 표로 바꿔 한 화면에 넣는다(simulate.ts simFrame·simBlocks).
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useDrag } from '../useDrag.ts';
import { useCompact } from './compact.ts';
import { applyDrawing } from './draw.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import { ratStr } from './q.ts';
import {
  makeSimControl,
  SIM_MAX,
  SIM_TABLE_MAX,
  type SimHistory,
  type SimParams,
  simActLabel,
  simAppend,
  simAt,
  simAxis,
  simBars,
  simBlocks,
  simCategories,
  simCountsAt,
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
  const sliderId = useId();

  // 처리기(조절기·되감기)는 한 번만 만들고 최신 값은 ref 로 읽는다 — 렌더마다 새로 만들면 누르는 도중의
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
  const ctlRef = useRef<ReturnType<typeof makeSimControl> | null>(null);
  if (!ctlRef.current)
    ctlRef.current = makeSimControl({
      clock,
      toss(k, first) {
        const { p: cp, live: lv } = latest.current;
        const added = simAppend(cp, lv.h, k);
        // 던지면 기록 맨 끝에 잇고 되감던 자리도 맨 끝으로. 가득 차서 못 던졌으면 되감던 자리를 그대로 둔다
        if (added === 0) return 0;
        lv.t = lv.h.cats.length;
        if (first && !ctlRef.current?.auto) goBtn.current?.classList.add('holding');
        paint(first);
        return added;
      },
      total: () => latest.current.live.h.cats.length,
      goal: () => latest.current.p.goal,
      full: () => latest.current.live.h.cats.length >= SIM_MAX,
      // 손을 뗀 뒤 한 번: 상태로 정하고, 낭독기에 요약을 한 번 읽힌다(목표 판정은 조절기가)
      settle() {
        goBtn.current?.classList.remove('holding');
        const { p: cp, live: lv } = latest.current;
        if (sr.current) sr.current.textContent = simSay(cp, lv.h, lv.t);
        commit();
      },
      done: () => latest.current.onDone(),
      setAuto,
    });
  const ctl = ctlRef.current;
  // 손가락·펜·마우스는 공용 끌기 장치로: 첫 손가락만, 포인터 잡기, 터치 스크롤 막기, 누르는 동안 '계속하기' 잠금
  useDrag(goBtn, ctl.drag);

  // 그린 뒤마다 직접 고칠 것(슬라이더의 현재 값)을 지금 기록에 맞춘다 — 슬라이더는 값을 React 가 쥐지 않는다
  useLayoutEffect(() => paint(false));
  // 장면을 떠나면 멈춘다(타이머가 남아 없는 화면을 고치지 않게 — 기록이 목표 이상이면 목표는 적는다).
  // 창이 가려지거나(다른 앱·탭) 초점을 잃거나 장면이 화면 밖으로 밀려나도 멈춘다 — 안 보이는 곳에서 '계속'이
  // 기록 상한까지 던지지 않게. 개발 모드의 두 번 붙이기에도 되살아나게 붙을 때 revive
  useEffect(() => {
    const c = ctlRef.current;
    if (!c) return;
    c.revive();
    const stop = () => c.stop();
    const hidden = () => {
      if (document.visibilityState === 'hidden') c.stop();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', stop);
    window.addEventListener('pagehide', stop);
    const el = root.current;
    const io =
      el && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((es) => {
            if (es.some((e) => !e.isIntersecting)) c.stop();
          })
        : null;
    if (el) io?.observe(el);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', stop);
      window.removeEventListener('pagehide', stop);
      io?.disconnect();
      c.leave();
    };
  }, []);
  // 되감기: 끄는 동안(input)은 그림만, 놓을 때(change) 한 번 상태로. 잡는 순간(pointerdown·keydown) 던지던 것은 멈춘다.
  // TODO(공용화): 분수 조각의 자르기 슬라이더(Fraction.tsx)와 같은 배선이다 — 세 번째로 쓰는 곳이 생기면 공용으로 꺼낸다
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
    const grab = () => ctlRef.current?.stop();
    el.addEventListener('input', input);
    el.addEventListener('change', change);
    el.addEventListener('pointerdown', grab);
    el.addEventListener('keydown', grab);
    return () => {
      el.removeEventListener('input', input);
      el.removeEventListener('change', change);
      el.removeEventListener('pointerdown', grab);
      el.removeEventListener('keydown', grab);
    };
  });

  const d = simDraw(p, live.h, live.t, { theory, compact });
  const bars = simBars(p, { counts: simCountsAt(p, live.h, live.t), trials: live.t });
  const cats = simCategories(p);
  const total = live.h.cats.length;
  const { W, H } = simFrame(compact);
  const lf = simLastFrame(p);
  const axis = simAxis(p);
  const verbLabel = simActLabel(p);
  const table = cats.length <= SIM_TABLE_MAX;
  const full = total >= SIM_MAX;
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
              disabled={auto}
              onClick={() => !ctl.on && setSize(m)}
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
          disabled={full}
          onClick={() => ctl.toggleAuto()}
          onKeyDown={(e) => {
            // Enter 를 누르고 있으면 click 이 거듭 와서 켜고 끄기가 깜박인다 — 반복은 무시
            if (e.repeat && isPress(e)) e.preventDefault();
          }}
        >
          {compact ? '계속' : '계속 던지기'}
        </button>
        <button
          ref={goBtn}
          type="button"
          className="lbtn blue sim-go"
          disabled={full}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (!isPress(e)) return;
            e.preventDefault();
            if (!e.repeat) ctl.press();
          }}
          onKeyUp={(e) => {
            if (!isPress(e)) return;
            e.preventDefault();
            ctl.release();
          }}
          onBlur={() => ctl.release()}
          // 포인터·키 없이 오는 누름(화면 낭독기의 '활성화')만 한 번 던지기 — 조절기가 가른다
          onClick={() => ctl.click()}
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
                        {bars[i]?.theoryShort}
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
                  {theory && <td className="num">이론 {ratStr(c.prob)}</td>}
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
        {/* <output> 은 저절로 읽히는 칸이라 되감는 동안 숫자를 하나하나 읽었다 — 보통 글자로(요약은 sim-sr 이 한 번) */}
        <span className="num sim-rew-v" data-t="rew">
          {d.texts.rew}
        </span>
      </div>
      {/* 손을 뗄 때만 채운다(settle) — 누르는 동안 바뀌는 글자를 낭독기가 하나하나 읽지 않게 */}
      <div className="sim-sr" ref={sr} aria-live="polite" />
    </div>
  );
}
