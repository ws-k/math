// 확률 실험 화면(시안 outputs/widgets-v2/prob/toss.html). '던지기'·'10번'·'100번' 단추를 누를 때마다 그만큼 던진다
// (2026-11-26 PM: 꾹 누르면 계속 던지던 자동 반복은 없앴다 — simulate.ts SIM_STEPS). 막대 = 나온 비율, 점선 = 이론값.
// '되감기'는 지난 기록을 지우지 않고 앞뒤로 훑는다. 100번을 눌러도 기록에 한꺼번에 붙이고 상태는 한 번만 바꾼다 —
// 막대가 한 번에 뛰어 보이지 않게 하는 것은 .sim-bar 의 CSS 전환(0.25초, 움직임 줄이기면 없음)이라 그동안 렌더 0(P8).
// 되감는 동안은 React 를 다시 그리지 않고 simDraw 의 그릴 목록을 applyDrawing 으로 직접 적용하고 놓을 때 한 번 상태로.
// 그래서 기록·되감기 자리(t)는 ref 에 두고, 렌더는 ref 를 그대로 그린다(도중에 부모가 다시 그려도 지금 기록 그대로).
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
import { useCompact } from './compact.ts';
import { applyDrawing } from './draw.ts';
import type { WidgetProps } from './index.tsx';
import { Marks } from './Marks.tsx';
import { ratStr } from './q.ts';
import {
  makeSimControl,
  SIM_MAX,
  SIM_STEPS,
  SIM_TABLE_MAX,
  type SimHistory,
  type SimParams,
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
  simStepLabel,
} from './simulate.ts';

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
  const root = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const lastSvg = useRef<SVGSVGElement>(null);
  const sr = useRef<HTMLDivElement>(null);
  const sliderId = useId();

  // 처리기(조절기·되감기)는 한 번만 만들고 최신 값은 ref 로 읽는다 — 조절기는 '목표를 이미 적었는가'를 쥐고 있어
  // 렌더마다 새로 만들면 목표를 넘긴 뒤 누를 때마다 다시 적는다
  const latest = useRef({ p, live, theory, compact, onDone });
  latest.current = { p, live, theory, compact, onDone };

  /** 지금 기록·자리를 화면에 직접 적용(React 렌더 없음). anim 이면 마지막 결과가 한 번 뒤집힌다(누를 때마다) */
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
      toss(k) {
        const { p: cp, live: lv } = latest.current;
        const added = simAppend(cp, lv.h, k);
        // 던지면 기록 맨 끝에 잇고 되감던 자리도 맨 끝으로. 가득 차서 못 던졌으면 되감던 자리를 그대로 둔다
        if (added === 0) return 0;
        lv.t = lv.h.cats.length;
        // 먼저 DOM 에 바로 적용해 막대의 CSS 전환과 결과 뒤집기를 시작하고, 상태는 settle 에서 한 번
        paint(true);
        return added;
      },
      total: () => latest.current.live.h.cats.length,
      goal: () => latest.current.p.goal,
      full: () => latest.current.live.h.cats.length >= SIM_MAX,
      // 누를 때마다 한 번: 상태로 정하고, 낭독기에 요약을 한 번 읽힌다(목표 판정은 조절기가)
      settle() {
        const { p: cp, live: lv } = latest.current;
        if (sr.current) sr.current.textContent = simSay(cp, lv.h, lv.t);
        commit();
      },
      done: () => latest.current.onDone(),
    });
  const ctl = ctlRef.current;

  // 그린 뒤마다 직접 고칠 것(슬라이더의 현재 값)을 지금 기록에 맞춘다 — 슬라이더는 값을 React 가 쥐지 않는다
  useLayoutEffect(() => paint(false));
  // 되감기: 끄는 동안(input)은 그림만, 놓을 때(change) 한 번 상태로.
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
    el.addEventListener('input', input);
    el.addEventListener('change', change);
    return () => {
      el.removeEventListener('input', input);
      el.removeEventListener('change', change);
    };
  });

  const d = simDraw(p, live.h, live.t, { theory, compact });
  const bars = simBars(p, { counts: simCountsAt(p, live.h, live.t), trials: live.t });
  const cats = simCategories(p);
  const total = live.h.cats.length;
  const { W, H } = simFrame(compact);
  const lf = simLastFrame(p);
  const axis = simAxis(p);
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
              onClick={() => setSize(m)}
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
        {SIM_STEPS.map((k) => {
          const l = simStepLabel(p, k);
          return (
            <button
              key={k}
              type="button"
              className={`lbtn ${k === 1 ? 'blue' : 'soft'} sim-go`}
              aria-label={l.aria}
              disabled={full}
              onKeyDown={(e) => {
                // Enter 를 누르고 있으면 브라우저가 click 을 거듭 보내 자동 반복이 된다(2026-11-26 에 없앤 것) — 반복은 무시
                if (e.repeat && isPress(e)) e.preventDefault();
              }}
              // 포인터·키보드(Enter·Space)·낭독기 활성화 모두 click 하나로 온다
              onClick={() => ctl.toss(k)}
            >
              {l.text}
            </button>
          );
        })}
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
      {/* 누를 때마다·되감기를 놓을 때 한 번 채운다(settle) — 바뀌는 글자를 낭독기가 하나하나 읽지 않게 */}
      <div className="sim-sr" ref={sr} aria-live="polite" />
    </div>
  );
}
