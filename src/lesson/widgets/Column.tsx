// 세로셈 가족 화면. 세 모드 모두 '손으로 하는 일 = 그 계산의 뜻'이다(원칙 P1, D3 시안 승인):
//   긴 나눗셈 = 손잡이를 위로 끌어 나누는 수 토막을 쌓기(덜어 내기) + 다음 자리 수를 끌어 내려 쓰기 ·
//   조립제법 = 아래 줄 수를 오른쪽 위 칸으로 끌어 올리기(× 근) · 나눗셈 사다리 = 수 카드를 놓아 두 수를 함께 나누기.
// 끄는 동안은 그 요소의 transform·속성만 직접 고친다(React 렌더 0회, P8). 판정은 손을 뗀 뒤 한 번(P3) — 끄는 동안에는
// 맞다/틀리다 색이 없고, 막대를 넘친 토막의 빗금·손가락 밑 칸의 테두리처럼 '지금 어디인가'만 보인다.
// 그냥 누르기·놓친 끌기가 두 번이면 '눌러도 돼요'(P4, 시안의 plainTap). 키보드는 처음부터 된다.
// 판정·칸 자리·안내 글은 모두 column.ts 에 있고 여기서는 그리기만 한다.
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { centerOf, clamp, FAILS_FOR_TAP, inBox, isTap } from '../drag.ts';
import { landAt } from '../fly.ts';
import { reducedMotion } from '../ui.tsx';
import { useDrag } from '../useDrag.ts';
import {
  type ColumnParams,
  fmt,
  jo,
  L_QMAX,
  L_ROW,
  L_W,
  type LadderParams,
  LD_AX,
  LD_BX,
  LD_LX,
  LD_RY,
  type LdState,
  type LongParams,
  type LState,
  ladderApply,
  ladderDone,
  ladderInit,
  ladderResult,
  ladderText,
  ldHeight,
  longBar,
  longBringSpot,
  longJudge,
  longNext,
  longPlan,
  longResult,
  longText,
  longView,
  type Msg,
  S_AX,
  S_H,
  S_Y,
  type SState,
  type SynthParams,
  synthCols,
  synthDone,
  synthInit,
  synthLabels,
  synthPlace,
  synthSum,
  synthText,
  synthView,
} from './column.ts';
import { useDropDrag } from './dropDrag.ts';
import type { WidgetProps } from './index.tsx';
import './column.css';

/** 놓을 수 없는 곳에 놓았을 때 제자리로 돌아가는 시간 */
const FLY_MS = 220;
/** 조립제법: 곱한 값이 올라간 뒤 더한 값이 내려오기까지(시안 380ms) — 두 일이 차례로 보이게 */
const SUM_MS = 380;
const TAP_ON = '끌기가 어려우면 눌러도 돼요.';

export function Column({ params: p, onDone, onMiss }: WidgetProps<ColumnParams>) {
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  if (p.mode === 'long') return <LongDiv p={p} finish={finish} onMiss={onMiss} />;
  if (p.mode === 'synth') return <Synth p={p} finish={finish} onMiss={onMiss} />;
  return <Ladder p={p} finish={finish} onMiss={onMiss} />;
}

type Part<P> = { p: P; finish(): void; onMiss(): void };

/**
 * 그냥 누르기·놓친 끌기를 센다. 첫 번째는 끄는 법(drag), 두 번째(FAILS_FOR_TAP)에 '눌러도 돼요'(tapOn)로 바꾸고
 * 그때부터 누르기로도 된다 — 한 번은 실수일 수 있고 두 번이면 끌기가 어려운 사람의 신호로 본다(count·저울과 같은 기준).
 */
function useFails(say: (m: Msg) => void) {
  const [fails, setFails] = useState(0);
  return {
    tapMode: fails >= FAILS_FOR_TAP,
    miss(m: Msg, tapOn: string) {
      const f = fails + 1;
      setFails(f);
      say(f === FAILS_FOR_TAP ? { text: `${TAP_ON} ${tapOn}`, cls: '' } : m);
    },
  };
}

/**
 * 끌다가 제자리로 돌아와 놓아도 끌기다(누르기가 아니다) — 뗀 자리만 보면 '한 토막 올려 넘치는 걸 보고 도로 0 으로'
 * 같은 끌기가 누르기로 잘못 읽혔다(1 ÷ 20 의 몫 0 자리, 헤드리스 실측). 끄는 동안 한 번이라도 TAP_PX 를 넘었는지 쥔다.
 */
function useMoved() {
  const far = useRef(false);
  return {
    reset() {
      far.current = false;
    },
    see(dx: number, dy: number) {
      if (!isTap(dx, dy)) far.current = true;
    },
    tap: (dx: number, dy: number) => !far.current && isTap(dx, dy),
  };
}

function Toast({ msg, extra }: { msg: Msg; extra?: ReactNode }) {
  return (
    <div className={`toast ${msg.cls}`} aria-live="polite">
      {msg.text}
      {extra}
    </div>
  );
}

/** 이번 그림에서 처음 나온 칸(방금 적힌 몫·곱·남은 수)만 떠오르게 — 처음 그릴 때와 다시 그릴 때는 가만히 */
function useFresh(keys: string[]) {
  const seen = useRef<Set<string> | null>(null);
  const prev = seen.current;
  useEffect(() => {
    seen.current = new Set(keys);
  });
  return (k: string) => prev !== null && !prev.has(k);
}

// ---- 긴 나눗셈 ----

function LongDiv({ p, finish, onMiss }: Part<LongParams>) {
  const [pl] = useState(() => longPlan(p));
  const [s, setS] = useState<LState>({ k: 0, phase: 'q' });
  /** 쌓은 토막 수(손을 뗀 값). 끄는 동안의 값은 그림에만 있다 */
  const [q, setQ] = useState(0);
  const [msg, setMsg] = useState<Msg>({ text: longText.intro(pl), cls: '' });
  const [live, setLive] = useState('');
  const fails = useFails(setMsg);
  const bar = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const v = longView(pl, s);
  const fresh = useFresh(v.cells.map((c) => c.key));
  const g = longBar(pl);
  const d = p.divisor;
  const cur = s.phase === 'q' ? pl.steps[s.k] : pl.steps[s.k - 1];
  // 되풀이로 끝나면 막대는 돌아온 수(마지막 남은 수 옆에 0 을 내린 30)를 빈 채로 — 처음과 같은 수가 다시 왔다는 것만 보이게
  const back = s.phase === 'done' && pl.end === 'repeat';
  const n = back ? (cur?.r ?? 0) * 10 : (cur?.n ?? 0);

  /** 막대 그림(틀·토막·손잡이)을 토막 수 k 로. 끄는 동안 프레임마다 직접 부르고, 그린 뒤에도 늘 맞춰 둔다 */
  const paint = (k: number) => {
    const el = bar.current;
    if (!el) return;
    const top = g.by - n * g.s;
    el.querySelectorAll<HTMLElement>('[data-blk]').forEach((b, i) => {
      const y = g.by - (i + 1) * g.bh;
      b.style.display = i < k ? '' : 'none';
      b.style.top = `${y + 1}px`;
      b.style.height = `${g.bh - 2}px`;
      // 막대를 넘은 토막: 정답 신호가 아니라 '길이가 모자라다'는 사실 그대로(빗금, 중립색)
      if (y < top - 0.5) b.dataset.over = '';
      else delete b.dataset.over;
    });
    const h = handle.current;
    if (h) {
      // 바닥에서도 판 밖으로 안 나가게
      h.style.top = `${clamp(g.by - k * g.bh, 24, g.h - 26)}px`;
      const t = h.querySelector('[data-t]');
      const m = h.querySelector('[data-m]');
      if (t) t.textContent = `${d}×${k}`;
      if (m) m.textContent = `= ${k * d}`;
      h.setAttribute('aria-valuenow', String(k));
      h.setAttribute('aria-valuetext', `토막 ${k}개, ${d} 곱하기 ${k} 는 ${k * d}`);
    }
  };
  const shownQ = s.phase === 'q' ? q : back ? 0 : (cur?.q ?? 0);
  useLayoutEffect(() => paint(shownQ));

  const judge = (k: number) => {
    const res = longJudge(pl, s.k, k);
    setMsg(longText.judge(pl, s.k, k));
    if (res !== 'ok') {
      onMiss();
      return;
    }
    const st = pl.steps[s.k];
    const next = longNext(pl, s);
    setS(next);
    if (next.phase === 'bring') {
      const b = longBringSpot(pl, next.k);
      setLive(`몫 ${st?.q}, 남은 수 ${st?.r}. 다음 ${b.digit} 을 내리세요.`);
    } else {
      setLive(longText.end(pl).text);
      finish();
    }
  };

  const start = useRef(0);
  const dragged = useRef(0);
  const moved = useMoved();
  useDrag(handle, {
    pick: () => s.phase === 'q' && !busy.current,
    onStart() {
      busy.current = true;
      moved.reset();
      start.current = q;
      dragged.current = q;
      handle.current?.setAttribute('data-lift', '');
    },
    onMove(dx, dy) {
      moved.see(dx, dy);
      // 위로 끈 만큼 토막 한 개 높이마다 하나씩
      const k = clamp(start.current + Math.round(-dy / g.bh), 0, L_QMAX);
      if (k === dragged.current) return;
      dragged.current = k;
      paint(k);
    },
    onEnd(dx, dy, cancelled) {
      busy.current = false;
      handle.current?.removeAttribute('data-lift');
      const k = dragged.current;
      if (cancelled) return paint(q);
      if (moved.tap(dx, dy)) {
        paint(q);
        if (!fails.tapMode)
          fails.miss(
            { text: '손잡이를 누른 채 위로 끌어 보세요.', cls: '' },
            '막대에서 덜어 낼 높이를 누르세요.',
          );
        return;
      }
      paint(k);
      setQ(k);
      judge(k);
    },
  });

  const onKey = (e: React.KeyboardEvent) => {
    if (s.phase !== 'q') return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setQ(Math.min(L_QMAX, q + 1));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setQ(Math.max(0, q - 1));
    // Enter·Space 는 단추의 click(detail 0)이 정하기로 받는다 — 여기서도 받으면 한 번 눌러 두 번 판정된다
    else return;
    e.preventDefault();
  };

  // 눌러서 하기(P4): 막대 빈 곳을 누르면 그 높이까지 토막을 채우고 바로 판정
  const tapBar = (e: React.MouseEvent) => {
    if (!fails.tapMode || s.phase !== 'q' || handle.current?.contains(e.target as Node)) return;
    const r = bar.current?.getBoundingClientRect();
    if (!r) return;
    const k = clamp(Math.round((g.by - (e.clientY - r.top)) / g.bh), 0, L_QMAX);
    setQ(k);
    judge(k);
  };

  const drop = () => {
    const next = longNext(pl, s);
    setS(next);
    setQ(0);
    if (next.phase === 'done') {
      const m = longText.end(pl);
      setMsg(m);
      setLive(m.text);
      finish();
    } else {
      const t = longText.dropped(pl, next.k);
      setMsg({ text: t, cls: '' });
      setLive(t);
    }
  };

  const reset = () => {
    setS({ k: 0, phase: 'q' });
    setQ(0);
    setMsg({ text: longText.intro(pl), cls: '' });
    setLive('처음부터 다시');
  };

  const res = s.phase === 'done' && pl.end === 'repeat' ? longResult(pl) : null;
  const bring = s.phase === 'bring' ? longBringSpot(pl, s.k) : null;
  const top = g.by - n * g.s;
  return (
    <div className="wgt cl">
      <div className="cl-long">
        <div className="cl-dg" style={{ width: v.w, height: v.h }}>
          <svg width={v.w} height={v.h} aria-hidden="true">
            <path d={`M44 ${L_ROW(0) - 18} Q53 ${L_ROW(0)} 44 ${L_ROW(0) + 18}`} />
            <path d={`M44 ${L_ROW(0) - 18} H${v.w - 4}`} />
          </svg>
          {v.cells.map((c) => (
            <span
              key={c.key}
              className={`cl-c ${c.cls.join(' ')}${fresh(c.key) ? ' new' : ''}`}
              style={{ left: c.x, top: c.y }}
            >
              {c.text}
            </span>
          ))}
          {v.lines.map((l) => (
            <span
              key={l.key}
              className={`cl-uline${fresh(l.key) ? ' new' : ''}`}
              style={{ left: l.x0, width: l.x1 - l.x0, top: l.y }}
            />
          ))}
          {bring && (
            <>
              <span
                className="cl-slot"
                data-slot=""
                style={{ left: bring.to.x, top: bring.to.y }}
              />
              <BringBtn
                key={s.k}
                spot={bring}
                busy={busy}
                tapMode={fails.tapMode}
                onDrop={drop}
                onTap={() =>
                  fails.miss(
                    { text: `${bring.digit} 을 누른 채 아래 점선 칸까지 끌어 보세요.`, cls: '' },
                    `${bring.digit} 을 한 번 누르면 내려가요.`,
                  )
                }
                onMissed={() => {
                  fails.miss(
                    { text: longText.missBring(pl, s.k), cls: 'bad' },
                    `${bring.digit} 을 한 번 누르면 내려가요.`,
                  );
                  onMiss();
                }}
              />
            </>
          )}
        </div>
        {/* 덜어 내기 막대: 지금 나누는 수 n 의 길이 안에 d 짜리 토막을 몇 개 쌓을 수 있나 = 몫 */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: 막대 누르기는 끌기가 어려운 사람의 대체(P4) — 키보드는 손잡이의 방향키가 맡는다 */}
        <div
          className={`cl-bar${s.phase === 'done' ? ' done' : ''}`}
          ref={bar}
          style={{ width: g.w, height: g.h }}
          onClick={tapBar}
        >
          <div className="cl-frame" style={{ left: g.w - 124, top, height: n * g.s }} />
          <div className="cl-nlab" style={{ left: g.w - 124, top: top - 22 }}>
            {n}
          </div>
          {Array.from({ length: L_QMAX }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 토막 자리 번호
            <div key={i} data-blk="" className="cl-blk" style={{ left: g.w - 120 }}>
              {d}
            </div>
          ))}
          <button
            ref={handle}
            type="button"
            role="slider"
            className="cl-hdl"
            hidden={s.phase !== 'q'}
            style={{ left: g.w - 70 }}
            aria-label={`${n} 에서 ${d} 덜어 내기. 위아래 화살표로 토막 수를 바꾸고 Enter 로 정하기`}
            aria-valuemin={0}
            aria-valuemax={L_QMAX}
            aria-valuenow={shownQ}
            onKeyDown={onKey}
            onClick={(e) => {
              // 화면 낭독기의 두 번 두드리기(detail 0)는 지금 토막 수로 정하기
              if (e.detail === 0) judge(q);
            }}
          >
            <span data-t="" />
            <small data-m="" />
          </button>
        </div>
      </div>
      {p.decimal && (
        <div className="cl-trail">
          남은 수{' '}
          {v.trail.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 남은 수가 나온 차례
            <span key={i}>
              {i > 0 && '→'}
              <span className={`cl-r${v.trailRep?.includes(i) ? ' rep' : ''}`}>{r}</span>
            </span>
          ))}
        </div>
      )}
      <Toast
        msg={msg}
        extra={
          res && (
            <>
              <br />
              {p.dividend} ÷ {d} = {res.int}.{res.non}
              {res.rep.split('').map((ch, i, a) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 되풀이 자리 숫자
                <span key={i} className={i === 0 || i === a.length - 1 ? 'cl-ov' : ''}>
                  {ch}
                </span>
              ))}
            </>
          )
        }
      />
      <button type="button" className="lbtn quiet" onClick={reset}>
        처음부터 다시
      </button>
      <div className="cl-sr" aria-live="polite">
        {live}
      </div>
    </div>
  );
}

/** 내려 쓸 수(글자는 20px 이지만 누르는 칸은 44px). 내릴 때마다 새로 만든다(key) — 날아오던 자리가 남지 않게 */
function BringBtn(props: {
  spot: ReturnType<typeof longBringSpot>;
  busy: { current: boolean };
  tapMode: boolean;
  onDrop(): void;
  onTap(): void;
  onMissed(): void;
}) {
  const { spot } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const near = (dx: number, dy: number) =>
    Math.hypot(spot.to.x - (spot.from.x + dx), spot.to.y - (spot.from.y + dy)) < 26;
  const slot = () => ref.current?.parentElement?.querySelector<HTMLElement>('[data-slot]');
  const moved = useMoved();
  useDropDrag(ref, {
    busy: props.busy,
    lift(el) {
      el.dataset.lift = '';
      moved.reset();
    },
    follow(dx, dy) {
      moved.see(dx, dy);
      // 손가락 밑이 점선 칸이면 칸 테두리만 진하게(어디인가 — 맞다는 신호 아님)
      const s = slot();
      if (s) s.toggleAttribute('data-over', near(dx, dy));
      return `translate(${dx}px,${dy}px) scale(1.06)`;
    },
    land(el) {
      delete el.dataset.lift;
      slot()?.removeAttribute('data-over');
    },
    onDrop(el, dx, dy) {
      const { back } = landAt(el, FLY_MS);
      if (moved.tap(dx, dy)) {
        back();
        if (props.tapMode) props.onDrop();
        else props.onTap();
        return;
      }
      if (near(dx, dy)) return props.onDrop();
      back();
      props.onMissed();
    },
  });
  return (
    <button
      ref={ref}
      type="button"
      className="cl-bring"
      style={{ left: spot.from.x, top: spot.from.y }}
      aria-label={`내려 쓸 ${spot.digit}. Enter 로 내리기`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          props.onDrop();
        }
      }}
      onClick={(e) => {
        // Enter·Space 와 화면 낭독기의 누르기(detail 0). 손가락 누르기는 onDrop 이 받는다
        if (e.detail === 0) props.onDrop();
      }}
    >
      {spot.digit}
    </button>
  );
}

// ---- 조립제법 ----

type Slot = { row: 'mid' | 'bot'; j: number; x: number; y: number };

function Synth({ p, finish, onMiss }: Part<SynthParams>) {
  const [s, setS] = useState<SState>(() => synthInit(p));
  /** 곱한 값이 올라가고 더한 값이 내려오기 전(그동안은 잡지 않는다) */
  const [pending, setPending] = useState(false);
  const [picked, setPicked] = useState(false);
  const [msg, setMsg] = useState<Msg>({ text: synthText.intro(p), cls: '' });
  const [live, setLive] = useState('');
  const fails = useFails(setMsg);
  const board = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const CX = synthCols(p);
  const labels = synthLabels(p);
  const done = synthDone(p, s);
  const view = synthView(p, s);
  const fresh = useFresh([
    ...s.mid.map((v, j) => (v === null ? '' : `m${j}`)),
    ...s.bot.map((v, j) => (v === null ? '' : `b${j}`)),
  ]);
  const step = CX.length > 1 ? (CX[1] as number) - (CX[0] as number) : 60;

  const slots: Slot[] = [];
  for (let j = 1; j < CX.length; j++)
    if (s.mid[j] === null) slots.push({ row: 'mid', j, x: CX[j] as number, y: S_Y.mid });
  for (let j = 0; j < CX.length; j++)
    if (s.bot[j] === null) slots.push({ row: 'bot', j, x: CX[j] as number, y: S_Y.bot });
  /** 지금 옮길 수: 처음엔 위 줄의 첫 계수, 그다음부터는 아래 줄 맨 끝 수 */
  const act = done
    ? null
    : s.k === 0
      ? { j: 0, y: S_Y.top, v: p.coeffs[0] as number }
      : { j: s.k - 1, y: S_Y.bot, v: s.bot[s.k - 1] as number };

  const place = (row: 'mid' | 'bot', j: number) => {
    const r = synthPlace(p, s, row, j);
    if (r.res === 'first') {
      setS(r.s);
      setMsg({ text: synthText.first(p), cls: '' });
      return;
    }
    if (r.res === 'up') {
      setS(r.s);
      setPending(true);
      const sum = () => {
        timer.current = null;
        const n = synthSum(p, r.s);
        setS(n);
        setPending(false);
        setMsg(synthText.summed(p, n));
        setLive(synthSummedLive(p, n));
        if (synthDone(p, n)) finish();
      };
      if (reducedMotion()) sum();
      else timer.current = setTimeout(sum, SUM_MS);
      return;
    }
    setMsg({ text: synthText.wrong(p, r.res), cls: 'bad' });
    onMiss();
  };

  const nearest = (x: number, y: number) => {
    let best: Slot | null = null;
    let bd = 34;
    for (const sl of slots) {
      const dd = Math.hypot(sl.x - x, sl.y - y);
      if (dd < bd) {
        bd = dd;
        best = sl;
      }
    }
    return best;
  };

  const tapAct = () => {
    if (fails.tapMode) {
      setPicked(!picked);
      setMsg({
        text: picked ? '수를 누르고, 놓을 빈칸을 누르세요.' : '이제 놓을 빈칸을 누르세요.',
        cls: '',
      });
      return;
    }
    fails.miss(
      { text: '수를 누른 채 빈칸까지 끌어 보세요.', cls: '' },
      '수를 누르고, 놓을 빈칸을 누르세요.',
    );
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
    setPicked(false);
    setS(synthInit(p));
    setMsg({ text: synthText.intro(p), cls: '' });
    setLive('처음부터 다시');
  };

  const mul = (v: number) =>
    s.k === 0 ? fmt(v) : `${fmt(v)} × ${p.root < 0 ? `(${fmt(p.root)})` : p.root}`;
  return (
    <div className="wgt cl">
      <div className="cl-sg" ref={board} style={{ height: S_H }}>
        <svg width={L_W} height={S_H} aria-hidden="true">
          <path d={`M52 18 V122 H${L_W}`} />
          {done && <path d={`M${(CX.at(-1) as number) - step / 2} 128 V176`} />}
        </svg>
        {labels.map((t, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 차수 자리
          <span key={j} className="cl-lab" style={{ left: CX[j], top: 6, width: step }}>
            {t}
          </span>
        ))}
        <span className="cl-num a" style={{ left: S_AX, top: S_Y.top }}>
          {fmt(p.root)}
        </span>
        <span className="cl-lab" style={{ left: S_AX, top: 66 }}>
          {view.divisor.replace(/ /g, '')}=0
        </span>
        {p.coeffs.map((v, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 계수 자리
          <span key={`t${j}`} className="cl-num" style={{ left: CX[j], top: S_Y.top }}>
            {fmt(v)}
          </span>
        ))}
        {slots.map((sl) => (
          <button
            key={`${sl.row}${sl.j}`}
            type="button"
            className="cl-sslot"
            data-sslot={`${sl.row}${sl.j}`}
            style={{ left: sl.x, top: sl.y }}
            aria-label={`${sl.row === 'mid' ? '가운데' : '맨 아래'} 줄 ${labels[sl.j]} 칸`}
            onClick={() => {
              if (!picked || pending) return;
              setPicked(false);
              place(sl.row, sl.j);
            }}
          />
        ))}
        {s.mid.map((v, j) =>
          v === null ? null : (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 계수 자리
              key={`m${j}`}
              className={`cl-num${fresh(`m${j}`) ? ' new' : ''}`}
              style={{ left: CX[j], top: S_Y.mid }}
            >
              {fmt(v)}
            </span>
          ),
        )}
        {s.bot.map((v, j) =>
          v === null ? null : (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 계수 자리
              key={`b${j}`}
              className={`cl-num${done && j === CX.length - 1 ? ' rem' : ''}${fresh(`b${j}`) ? ' new' : ''}`}
              style={{ left: CX[j], top: S_Y.bot }}
            >
              {fmt(v)}
            </span>
          ),
        )}
        {act && (
          <SynthAct
            key={s.k}
            x={CX[act.j] as number}
            y={act.y}
            text={fmt(act.v)}
            ghost={mul(act.v)}
            picked={picked}
            locked={pending}
            busy={busy}
            nearest={nearest}
            onPlace={place}
            onTap={tapAct}
            onNowhere={() => {
              fails.miss(
                { text: '빈칸 위에서 손을 떼요.', cls: '' },
                '수를 누르고, 놓을 빈칸을 누르세요.',
              );
              onMiss();
            }}
            onKeyPick={() => {
              setPicked(true);
              setMsg({ text: '놓을 빈칸으로 가서 Enter.', cls: '' });
              board.current?.querySelector<HTMLElement>('[data-sslot]')?.focus();
            }}
          />
        )}
      </div>
      <div className={`cl-res${done ? ' done' : ''}`}>
        {done ? (
          <>
            몫 {view.quotient} · 나머지 {fmt(view.remainder as number)}
            <div className="f">
              f({fmt(p.root)}) = {view.fa} — 마지막 칸과 같아요
            </div>
          </>
        ) : (
          <>
            <span className="faint">
              몫{' '}
              {s.bot
                .slice(0, -1)
                .map((v) => (v === null ? '□' : fmt(v)))
                .join(' ')}{' '}
              · 나머지 □
            </span>
            <div className="f">아래 줄이 몫의 계수, 맨 끝이 나머지</div>
          </>
        )}
      </div>
      <Toast msg={msg} />
      <button type="button" className="lbtn quiet" onClick={reset}>
        처음부터 다시
      </button>
      <div className="cl-sr" aria-live="polite">
        {live}
      </div>
    </div>
  );
}

const synthSummedLive = (p: SynthParams, s: SState) =>
  synthDone(p, s)
    ? `나머지 ${fmt(s.bot.at(-1) as number)}, f(${fmt(p.root)}) 도 같아요`
    : synthText.summedSr(p, s);

/**
 * 지금 옮길 수. 원래 수는 제자리에 남고(아래 cl-num), 들어 올린 단추에는 '값 × 근'이 따라간다 —
 * 옮기는 동안 무엇을 하는지(곱해서 올리기)가 보이게(시안 synth.html 의 그림자).
 */
function SynthAct(props: {
  x: number;
  y: number;
  text: string;
  ghost: string;
  picked: boolean;
  locked: boolean;
  busy: { current: boolean };
  nearest(x: number, y: number): Slot | null;
  onPlace(row: 'mid' | 'bot', j: number): void;
  onTap(): void;
  onNowhere(): void;
  onKeyPick(): void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const host = () => ref.current?.parentElement;
  const mark = (sl: Slot | null) => {
    for (const el of host()?.querySelectorAll<HTMLElement>('[data-sslot]') ?? [])
      el.toggleAttribute('data-over', !!sl && el.dataset.sslot === `${sl.row}${sl.j}`);
  };
  const moved = useMoved();
  useDropDrag(ref, {
    busy: props.busy,
    locked: props.locked,
    lift(el) {
      el.dataset.lift = '';
      moved.reset();
    },
    follow(dx, dy) {
      moved.see(dx, dy);
      mark(props.nearest(props.x + dx, props.y + dy));
      return `translate(${dx}px,${dy}px)`;
    },
    land(el) {
      delete el.dataset.lift;
      mark(null);
    },
    onDrop(el, dx, dy) {
      const { back } = landAt(el, FLY_MS);
      if (moved.tap(dx, dy)) return props.onTap();
      const sl = props.nearest(props.x + dx, props.y + dy);
      back();
      if (!sl) return props.onNowhere();
      props.onPlace(sl.row, sl.j);
    },
  });
  return (
    <>
      <span className="cl-num" style={{ left: props.x, top: props.y }}>
        {props.text}
      </span>
      <button
        ref={ref}
        type="button"
        className={`cl-num act${props.picked ? ' sel' : ''}`}
        style={{ left: props.x, top: props.y }}
        aria-label={`${props.text}. Enter 로 잡고 놓을 칸을 고르세요`}
        aria-pressed={props.picked}
        onClick={(e) => {
          if (e.detail === 0 && !props.locked) props.onKeyPick();
        }}
      >
        {props.text}
        <span className="cl-ghost" aria-hidden="true">
          {props.ghost}
        </span>
      </button>
    </>
  );
}

// ---- 나눗셈 사다리 ----

function Ladder({ p, finish, onMiss }: Part<LadderParams>) {
  const [s, setS] = useState<LdState>(() => ladderInit(p));
  const [finished, setFinished] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>({ text: ladderText.intro(p), cls: '' });
  const [live, setLive] = useState('');
  const fails = useFails(setMsg);
  const board = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const rows = s.rows.length;
  const h = ldHeight(rows);
  const fresh = useFresh(s.rows.map((_, r) => `r${r}`));

  const apply = (card: number) => {
    const m = ladderText.apply(s, card);
    const r = ladderApply(s, card);
    setMsg(m);
    if (r.res !== 'ok') return onMiss();
    setS(r.s);
    const [a, b] = r.s.rows.at(-1) as [number, number];
    setLive(`${card} ${jo(card, '으로')} 함께 나눠 ${a} ${jo(a, '과')} ${b}`);
  };
  const onFinish = () => {
    const m = ladderText.done(s);
    setMsg(m);
    if (ladderDone(s) === 'still') return onMiss();
    setFinished(true);
    setLive('최대공약수와 최소공배수가 나왔어요');
    finish();
  };
  const reset = () => {
    setS(ladderInit(p));
    setFinished(false);
    setSel(null);
    setMsg({ text: ladderText.intro(p), cls: '' });
    setLive('처음부터 다시');
  };

  let path = '';
  s.rows.forEach((_, r) => {
    if (finished && r === rows - 1) return;
    const y = LD_RY(r);
    path += `M108 ${y - 20} Q116 ${y} 108 ${y + 22} M108 ${y + 22} H254 `;
  });
  // L자: 왼쪽 줄 전체 + 맨 아래 남은 두 수 — 최소공배수에 들어가는 조각이 한 번에 보이게
  const ell = finished
    ? `M50 ${LD_RY(0) - 24} H106 V${LD_RY(rows - 1) - 24} H250 V${LD_RY(rows - 1) + 24} H50 Z`
    : '';
  const result = finished ? ladderResult(s) : null;
  return (
    <div className="wgt cl">
      <div className="cl-lg" ref={board} style={{ height: h }}>
        <svg width={L_W} height={h} aria-hidden="true">
          <path d={path} />
          {ell && <path className="ell" d={ell} />}
        </svg>
        {s.rows.map(([a, b], r) => {
          const c = `cl-n${finished && r === rows - 1 ? ' rest' : ''}${fresh(`r${r}`) ? ' new' : ''}`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: 줄 차례
            <span key={r}>
              <span className={c} style={{ left: LD_AX, top: LD_RY(r) }}>
                {a}
              </span>
              <span className={c} style={{ left: LD_BX, top: LD_RY(r) }}>
                {b}
              </span>
            </span>
          );
        })}
        {s.divs.map((d, r) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 줄 차례
            key={r}
            className={`cl-n dv${finished ? ' gcd' : ''}`}
            style={{ left: LD_LX, top: LD_RY(r) }}
          >
            {d}
          </span>
        ))}
        {!finished && (
          <button
            type="button"
            className="cl-target"
            data-target=""
            style={{ left: LD_LX, top: LD_RY(rows - 1) }}
            aria-label={`${s.rows.at(-1)?.join('와 ')} 을 함께 나눌 수 칸`}
            onClick={() => {
              if (sel === null) return;
              const c = sel;
              setSel(null);
              apply(c);
            }}
          />
        )}
      </div>
      {!finished && (
        <>
          {/* 첫 카드를 놓은 뒤에는 뺀다 — 할 일은 이미 알았고, 줄이 넷이면 이 한 줄 때문에 접은 화면을 넘쳤다(24·36 실측) */}
          {s.divs.length === 0 && (
            <div className="cl-trayhint">두 수를 함께 나눌 수를 왼쪽 점선 칸에 놓아요</div>
          )}
          <div className="cl-tray">
            {p.cards.map((c) => (
              <LadderChip
                key={c}
                card={c}
                sel={sel === c}
                busy={busy}
                board={board}
                onApply={() => apply(c)}
                onTap={() => {
                  if (fails.tapMode) return setSel(sel === c ? null : c);
                  fails.miss(
                    { text: '카드를 누른 채 점선 칸까지 끌어 보세요.', cls: '' },
                    '카드를 누르고, 점선 칸을 누르세요.',
                  );
                }}
                onNowhere={() => {
                  fails.miss(
                    { text: '카드를 맨 아래 줄 왼쪽 점선 칸 위에서 놓아요.', cls: '' },
                    '카드를 누르고, 점선 칸을 누르세요.',
                  );
                  onMiss();
                }}
              />
            ))}
          </div>
          <button type="button" className="lbtn cl-done" onClick={onFinish}>
            더 함께 나눌 수 없어요
          </button>
        </>
      )}
      {result && (
        <div className="cl-ldres">
          <span className="g">
            최대공약수 = {result.divs.join(' × ')}
            {result.divs.length > 1 ? ` = ${result.g}` : ''}
          </span>{' '}
          <span className="tag">왼쪽 줄</span>
          <br />
          <span className="l">
            최소공배수 = {[...result.divs, ...result.rest].join(' × ')} = {result.l}
          </span>{' '}
          <span className="tag">L자</span>
        </div>
      )}
      <Toast msg={msg} />
      <button type="button" className="lbtn quiet" onClick={reset}>
        처음부터 다시
      </button>
      <div className="cl-sr" aria-live="polite">
        {live}
      </div>
    </div>
  );
}

/** 수 카드 하나. 놓은 뒤에는 늘 카드 줄로 돌아온다(카드는 몇 번이든 다시 쓴다) */
function LadderChip(props: {
  card: number;
  sel: boolean;
  busy: { current: boolean };
  board: { current: HTMLDivElement | null };
  onApply(): void;
  onTap(): void;
  onNowhere(): void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const box = useRef<{ chip: DOMRect; target: DOMRect } | null>(null);
  const moved = useMoved();
  const target = () => props.board.current?.querySelector<HTMLElement>('[data-target]');
  /** 카드 가운데가 점선 칸(옆 16·위아래 14 여유 — 시안의 40·36 반경)에 들었나 */
  const over = (dx: number, dy: number) => {
    const b = box.current;
    if (!b) return false;
    const [cx, cy] = centerOf(b.chip);
    return inBox(cx + dx, cy + dy, b.target, 14);
  };
  useDropDrag(ref, {
    busy: props.busy,
    lift(el) {
      el.dataset.lift = '';
      moved.reset();
      const t = target();
      box.current = t
        ? { chip: el.getBoundingClientRect(), target: t.getBoundingClientRect() }
        : null;
    },
    follow(dx, dy) {
      moved.see(dx, dy);
      target()?.toggleAttribute('data-over', over(dx, dy));
      return `translate(${dx}px,${dy}px) scale(1.06)`;
    },
    land(el) {
      delete el.dataset.lift;
      target()?.removeAttribute('data-over');
    },
    onDrop(el, dx, dy) {
      const hit = over(dx, dy);
      const { back } = landAt(el, FLY_MS);
      back();
      if (moved.tap(dx, dy)) return props.onTap();
      if (hit) props.onApply();
      else props.onNowhere();
    },
  });
  return (
    <button
      ref={ref}
      type="button"
      className={`cl-chip${props.sel ? ' sel' : ''}`}
      aria-label={`수 카드 ${props.card}. Enter 로 지금 줄에 놓기`}
      aria-pressed={props.sel}
      onClick={(e) => {
        if (e.detail === 0) props.onApply();
      }}
    >
      {props.card}
    </button>
  );
}
