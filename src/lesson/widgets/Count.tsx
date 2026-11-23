// 경우의 수 화면. 움직임이 곧 수학인 셋은 손으로 옮긴다(2026-11-23 결정 D1, 원칙 P1):
//   순서 있는 나열 = 칩을 줄에 세우고 자리 바꾸기(Line) · 두 개 고르기 = 두 점을 선으로 잇기(Pairs) ·
//   벤 다이어그램 = 원소 카드를 영역에 넣어 분류(VennSort).
// 셋 이상 고르기·중복 나열은 누르기(Lister), 수형도·파스칼은 '보여 주기'라 누르기 그대로다.
// 끄는 동안은 useDrag 가 프레임마다 부르는 onMove 에서 그 요소의 transform·속성만 직접 고친다(React 렌더 0회, P8).
// 손을 떼면 놓은 자리를 count.ts(lSpotAt·pHit·vRegionAt)로 한 번 판정하고 상태를 바꾼다(P3) — 끄는 도중에는 맞다/틀리다
// 신호가 없다. 그냥 누르기를 두 번 하면(끌기를 못 하는 신호) '눌러서 하기'가 켜진다(P4). 키보드는 처음부터 늘 된다.
// 같은 끌어 놓기가 저울(Balance.tsx)에도 있다 — 공용으로 꺼내는 것은 1-사 묶음 몫이라 여기서는 이 부품 안에 둔다.
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flyFrom } from '../fly.ts';
import { useDrag } from '../useDrag.ts';
import {
  type CountParams,
  type CState,
  cDone,
  cInit,
  cLabel,
  cLink,
  cPascal,
  cTap,
  cTotal,
  cTree,
  L_W,
  lFactors,
  lGeom,
  lGroups,
  lMove,
  lSpotAt,
  pDegree,
  pGeom,
  pHit,
  V_A,
  V_B,
  V_DECK,
  V_H,
  V_W,
  type VReg,
  vCheck,
  vCounts,
  vDeck,
  vElems,
  viewOf,
  vPos,
  vPut,
  vRegionAt,
} from './count.ts';
import type { WidgetProps } from './index.tsx';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };

/** 이만큼 못 움직였으면 끌기가 아니라 누르기로 본다(저울과 같은 값) */
const TAP_PX = 8;
/** 그냥 누르기·놓친 끌기가 이만큼이면 '눌러서 하기'를 켠다(P4 — 저울·'넘어가기'와 같은 기준) */
const FAILS_FOR_TAP = 2;
/** 놓은 뒤 새 자리로 미끄러져 가는 시간 */
const FLY_MS = 220;
/** 이미 찾은 줄·선을 깜빡이는 시간 */
const FLASH_MS = 900;
/** 자리 이름. 나열은 4! = 24 가 손으로 찾는 상한이라 넷째까지면 된다 */
const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];

/** 처음 안내(토스트 한 줄). 단원 글(lead)이 자세히 말하고, 여기서는 무엇을 끄는지만 */
const INTRO: Partial<Record<ReturnType<typeof viewOf>, string>> = {
  line: '위에서 끌어 아래 줄에 세워 보세요.',
  pair: '한 점에서 다른 점까지 끌어 선을 그어 보세요.',
  venn: '아래 카드를 끌어 알맞은 곳에 넣어 보세요.',
};

export function Count({ params: p, onDone, onMiss }: WidgetProps<CountParams>) {
  const view = viewOf(p);
  const [s, setS] = useState<CState>(() => cInit(p));
  const [msg, setMsg] = useState<Msg>({ text: INTRO[view] ?? '', cls: '' });
  const done = useRef(false);
  const settle = (n: CState) => {
    setS(n);
    if (!done.current && cDone(p, n)) {
      done.current = true;
      onDone();
    }
  };
  const toast = (
    <div className={`toast ${msg.cls}`} aria-live="polite">
      {msg.text}
    </div>
  );
  const part = { p, s, settle, say: setMsg, onMiss, toast };
  const body =
    view === 'line' ? (
      <Line {...part} />
    ) : view === 'pair' ? (
      <Pairs {...part} />
    ) : view === 'venn' ? (
      <VennSort {...part} />
    ) : view === 'pascal' ? (
      <Pascal p={p} s={s} settle={settle} say={setMsg} />
    ) : view === 'tree' ? (
      <Tree p={p} s={s} settle={settle} />
    ) : (
      <Lister p={p} s={s} settle={settle} say={setMsg} onMiss={onMiss} />
    );
  // 직접 조작 셋은 안내 칸을 자기 자리(목록과 '처음부터 다시' 사이)에 둔다
  return (
    <div className="wgt ct">
      {body}
      {view === 'line' || view === 'pair' || view === 'venn' ? null : toast}
    </div>
  );
}

type Part = { p: CountParams; s: CState; settle(n: CState): void };
type Drag = Part & { say(m: Msg): void; onMiss(): void; toast: ReactNode };

/** 이 요소들의 지금 화면 자리. 상태가 바뀐 뒤 옛 자리에서 새 자리로 미끄러져 가게(FLIP) 잰다 */
function rectsOf(host: ParentNode | null | undefined, sel: string, attr: string) {
  const m = new Map<string, DOMRect>();
  for (const el of host?.querySelectorAll<HTMLElement>(sel) ?? [])
    m.set(el.getAttribute(attr) as string, el.getBoundingClientRect());
  return m;
}

/** 옮긴 뒤 한 번: 옛 자리에서 날려 보내고, 키보드로 옮겼으면 초점을 다시 잡는다 */
function useSettleFx(host: RefObject<HTMLElement | null>, sel: string, attr: string) {
  const fly = useRef<Map<string, DOMRect> | null>(null);
  useLayoutEffect(() => {
    const old = fly.current;
    fly.current = null;
    if (!old || !host.current) return;
    for (const el of host.current.querySelectorAll<HTMLElement>(sel)) {
      const r = old.get(el.getAttribute(attr) as string);
      if (r) flyFrom(el, r, { duration: FLY_MS });
    }
  });
  return {
    /** 상태를 바꾸기 직전에 부른다. dropped = 끌어 놓은 요소의 놓인 자리(손 뗀 자리에서 날아가게) */
    mark(dropped?: [string, DOMRect]) {
      fly.current = rectsOf(host.current, sel, attr);
      if (dropped) fly.current.set(dropped[0], dropped[1]);
    },
  };
}

/** 이 요소를 잠깐 깜빡인다(이미 찾은 줄·선). 상태가 아니라 속성만 — 다시 그리지 않는다 */
function flash(host: ParentNode | null | undefined, key: string) {
  for (const el of host?.querySelectorAll<Element>(`[data-k="${key}"]`) ?? []) {
    el.removeAttribute('data-flash');
    // 같은 줄을 연달아 다시 만들어도 처음부터 깜빡이게 한 번 그려 낸다
    void (el as HTMLElement).getBoundingClientRect();
    el.setAttribute('data-flash', '');
    setTimeout(() => el.removeAttribute('data-flash'), FLASH_MS);
  }
}

/** 놓은 요소의 가운데를 판 좌표로. 판은 폭에 맞춰 늘고 주니 폭 비율(scale)로 되돌린다 */
function boardPoint(board: HTMLElement, r: DOMRect, w: number, scaleY: boolean) {
  const b = board.getBoundingClientRect();
  const k = w / b.width;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return [(cx - b.left) * k, (cy - b.top) * (scaleY ? k : 1)] as const;
}

type DragBtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrop'> & {
  /** 부품 안에서 지금 끄는 것이 있나(동시 끌기 1개, P9) */
  busy: RefObject<boolean>;
  /** 끌 수 없는 상태(더미 아래 장·다 맞힌 뒤) */
  locked?: boolean;
  /** 손을 뗐을 때. el 은 아직 놓인 자리(transform)에 있다 — 자리를 잰 뒤 transform 을 지우는 건 받는 쪽 */
  onDrop(el: HTMLElement, dx: number, dy: number): void;
  /** 키보드 Enter·Space 와 화면 낭독기의 '누르기'(click detail 0). 손가락 누르기는 onDrop 이 받는다 */
  onActivate(): void;
};

/** 끌 수 있는 단추 하나(줄 세우기 칩·벤 카드). 단추마다 useDrag 를 붙이려고 컴포넌트로 뺐다 */
function DragBtn({ busy, locked, onDrop, onActivate, ...rest }: DragBtnProps) {
  const ref = useRef<HTMLButtonElement>(null);
  /** 끌기를 잡은 요소. 끄는 도중 단추가 사라져도(ref 가 비어도) 정리할 수 있게 쥐어 둔다 */
  const held = useRef<HTMLElement | null>(null);
  useDrag(ref, {
    pick: () => !busy.current && !locked,
    onStart() {
      const el = ref.current;
      if (!el) return;
      busy.current = true;
      held.current = el;
      for (const a of el.getAnimations()) a.cancel();
      // 속성은 data- 로 — className 을 직접 고치면 React 가 다시 그릴 때 지워진다
      el.dataset.lift = '';
    },
    onMove(dx, dy) {
      const el = held.current;
      if (el) el.style.transform = `translate(${dx}px,${dy}px) scale(1.06)`;
    },
    onEnd(dx, dy, cancelled) {
      const el = held.current;
      held.current = null;
      busy.current = false;
      if (!el) return;
      delete el.dataset.lift;
      if (cancelled || !el.isConnected) {
        el.style.transform = '';
        return;
      }
      onDrop(el, dx, dy);
    },
  });
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      onClick={(e) => {
        if (e.detail === 0) onActivate();
      }}
    />
  );
}

/** 그냥 누르기·놓친 끌기를 세고, 두 번이면 '눌러서 하기'를 켠다. 켜는 순간 안내를 토스트에 */
function useTapFallback(say: (m: Msg) => void, how: string, again: string) {
  const [fails, setFails] = useState(0);
  const tapMode = fails >= FAILS_FOR_TAP;
  return {
    tapMode,
    /** 끌기를 못 한 한 번. 켜졌으면 true */
    miss(text = again) {
      const n = fails + 1;
      setFails(n);
      // 안내는 토스트 하나로(따로 한 줄을 더 쓰면 접은 화면에서 카드가 넘친다 — 시안 측정)
      say({ text: n >= FAILS_FOR_TAP ? `끌기가 어려우면 눌러도 돼요. ${how}` : text, cls: '' });
      return n >= FAILS_FOR_TAP;
    },
  };
}

// ---- 줄 세우기(list) ----

function Line({ p, s, settle, say, onMiss, toast }: Drag) {
  const items = p.items ?? [];
  const k = p.k ?? 0;
  const g = lGeom(items.length, k);
  const total = cTotal(p);
  const finished = cDone(p, s);
  const board = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const fx = useSettleFx(board, '[data-chip]', 'data-chip');
  const [pick, setPick] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const tap = useTapFallback(
    say,
    '하나를 누르고, 갈 자리를 누르세요.',
    '누른 채 아래 줄의 자리까지 끌어 보세요.',
  );
  const spotName = (st: CState, i: number) => {
    const at = st.seat.indexOf(i);
    return at >= 0 ? `${ORD[at]} 자리` : '줄 밖';
  };
  const lineText = (st: CState) =>
    st.seat.map((x) => (x === null ? '빈자리' : items[x])).join(', ');

  /** 옮겼으면 true. 판정 글은 놓은 뒤 한 번만(P3) */
  const commit = (i: number, to: number | 'wait', dropped?: DOMRect): boolean => {
    const r = lMove(p, s, i, to);
    if (r.res === 'none') return false;
    fx.mark(dropped ? [String(i), dropped] : undefined);
    settle(r.s);
    setLive(`지금 줄: ${lineText(r.s)}`);
    const label = r.key ? cLabel(p, r.key) : '';
    if (r.res === 'new') {
      if (cDone(p, r.s)) {
        const f = lFactors(p);
        say({ text: `${f.map((x, j) => `${ORD[j]} ${x}`).join(' × ')} = ${total}`, cls: 'ok' });
      } else say({ text: `${label} — 새 줄이에요.`, cls: 'ok' });
    } else if (r.res === 'dup') {
      say({ text: `${label} — 이미 찾은 줄이에요.`, cls: 'bad' });
      flash(board.current?.parentElement, r.key as string);
      onMiss();
    } else if (!finished)
      // 다 찾은 뒤에는 결론(곱셈) 글을 그대로 둔다
      say({
        text: r.s.seat.some((x) => x !== null) ? '빈자리를 채우면 한 줄이 적혀요.' : '',
        cls: '',
      });
    return true;
  };

  const choose = (i: number) => {
    if (pick === null) {
      setPick(i);
      setLive(`${items[i]} 골랐어요. 갈 자리를 고르세요.`);
    } else if (pick === i) setPick(null);
    else {
      const at = s.seat.indexOf(i);
      commit(pick, at >= 0 ? at : 'wait');
      setPick(null);
    }
  };
  const toSpot = (to: number | 'wait') => {
    if (pick === null) return;
    commit(pick, to);
    setPick(null);
  };

  const onDrop = (i: number) => (el: HTMLElement, dx: number, dy: number) => {
    const rect = el.getBoundingClientRect();
    el.style.transform = '';
    const back = () => flyFrom(el, rect, { duration: FLY_MS });
    if (Math.hypot(dx, dy) < TAP_PX) {
      back();
      if (tap.tapMode) choose(i);
      else tap.miss();
      return;
    }
    const host = board.current;
    if (!host) return back();
    const [x, y] = boardPoint(host, rect, L_W, false);
    const to = lSpotAt(g, x, y);
    if (to !== null && commit(i, to, rect)) return;
    back();
    if (to === null) {
      tap.miss('줄의 자리 위나 위쪽 칸에 놓아 보세요.');
      onMiss();
    }
  };

  const onKey = (i: number) => (e: KeyboardEvent) => {
    const at = s.seat.indexOf(i);
    let to: number | 'wait' | null = null;
    if (e.key === 'ArrowLeft' && at > 0) to = at - 1;
    else if (e.key === 'ArrowRight' && at >= 0 && at < k - 1) to = at + 1;
    else if (e.key === 'ArrowDown' && at < 0) {
      const f = s.seat.indexOf(null);
      if (f >= 0) to = f;
      else setLive('빈자리가 없어요. 줄에 선 것을 위 방향키로 빼거나 Enter 로 골라 바꾸세요.');
    } else if (e.key === 'ArrowUp' && at >= 0) to = 'wait';
    else if (e.key === 'Escape') setPick(null);
    if (to === null) return;
    e.preventDefault();
    commit(i, to);
  };

  const pct = (x: number) => `calc(${(x / L_W) * 100}% - ${g.chip / 2}px)`;
  const groups = finished && k >= 2 ? lGroups(p, s.found) : null;
  return (
    <>
      <div className="ct-line" ref={board} style={{ height: g.h }}>
        <span className="ct-zlabel" style={{ top: 0 }}>
          줄 밖
        </span>
        <button
          type="button"
          tabIndex={-1}
          className="ct-wait"
          aria-label="줄 밖"
          style={{ top: g.waitTop, height: g.waitBottom - g.waitTop }}
          onClick={() => toSpot('wait')}
        />
        <span className="ct-zlabel" style={{ top: g.waitBottom + 6 }}>
          줄 — 왼쪽이 첫째
        </span>
        {g.seatX.map((x, j) => (
          <button
            type="button"
            tabIndex={-1}
            // biome-ignore lint/suspicious/noArrayIndexKey: 자리 번호
            key={j}
            className="ct-seat"
            aria-label={`${ORD[j]} 자리`}
            style={{
              left: `calc(${(x / L_W) * 100}% - ${g.box / 2}px)`,
              top: g.seatY - g.box / 2,
              width: g.box,
              height: g.box,
            }}
            onClick={() => toSpot(j)}
          >
            <span className="ct-ord" style={{ top: g.box + 2 }}>
              {ORD[j]}
            </span>
          </button>
        ))}
        {items.map((name, i) => {
          const at = s.seat.indexOf(i);
          const [x, y] = at >= 0 ? [g.seatX[at] ?? 0, g.seatY] : [g.waitX[i] ?? 0, g.waitY];
          return (
            <DragBtn
              // biome-ignore lint/suspicious/noArrayIndexKey: 물건 순서는 매개변수에서 고정
              key={i}
              data-chip={i}
              className={`ct-chip${pick === i ? ' sel' : ''}`}
              style={{ left: pct(x), top: y - g.chip / 2, width: g.chip, height: g.chip }}
              aria-label={`${name}, ${spotName(s, i)}`}
              aria-pressed={pick === i}
              busy={busy}
              onDrop={onDrop(i)}
              onActivate={() => choose(i)}
              onKeyDown={onKey(i)}
            >
              {name}
            </DragBtn>
          );
        })}
      </div>
      <div className="wgt-read">
        <span className="num">
          {finished ? `모두 ${total}가지예요` : `찾은 경우 ${s.found.length}가지`}
        </span>
      </div>
      {groups ? (
        <div className="ct-groups" style={{ '--cols': groups.length } as CSSProperties}>
          {groups.map((gr) => (
            <div key={gr.head} className="ct-g">
              <span className="ct-gh">
                {ORD[0]} {items[gr.head]}
              </span>
              {gr.keys.map((f) => (
                <span key={f} className="ct-case">
                  {cLabel(p, f)}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="ct-found tight">
          {s.found.map((f) => (
            <span key={f} className="ct-case" data-k={f}>
              {cLabel(p, f)}
            </span>
          ))}
        </div>
      )}
      {toast}
      <div className="ct-sr" aria-live="polite">
        {live}
      </div>
    </>
  );
}

// ---- 선 잇기(pick k=2) ----

function Pairs({ p, s, settle, say, onMiss, toast }: Drag) {
  const items = p.items ?? [];
  const n = items.length;
  const g = pGeom(n);
  const total = cTotal(p);
  const finished = cDone(p, s);
  const svg = useRef<SVGSVGElement>(null);
  const rubber = useRef<SVGLineElement>(null);
  const busy = useRef(false);
  /** 방금 그은 선(한 번 그려지듯 나타나게) */
  const fresh = useRef<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const tap = useTapFallback(
    say,
    '두 점을 차례로 누르면 이어져요.',
    '누른 채 다른 점까지 끌어 보세요.',
  );
  const deg = pDegree(p, s.found);
  // 목록 글자는 붙여 쓴다('빨1·빨2') — 짝이 10~15개라 한 줄에 하나라도 더 들어가게
  const pairLabel = (key: string) =>
    key
      .split(',')
      .map((x) => items[Number(x)])
      .join('·');

  const link = (a: number, b: number) => {
    const r = cLink(p, s, a, b);
    if (r.res === 'self') return;
    const label = cLabel(p, r.key as string);
    if (r.res === 'dup') {
      say({
        text: `${items[a]}→${items[b]}, ${items[b]}→${items[a]} 모두 같은 선이에요. 이미 이었어요.`,
        cls: 'bad',
      });
      flash(svg.current?.parentElement, r.key as string);
      onMiss();
      return;
    }
    fresh.current = r.key as string;
    settle(r.s);
    setLive(`${label} 이었어요. 찾은 짝 ${r.s.found.length}가지.`);
    if (cDone(p, r.s))
      say({
        text: `점마다 선 ${n - 1}개 × ${n}개 = ${n * (n - 1)}, 선 하나를 양 끝에서 두 번 셌으니 ÷ 2 = ${total}`,
        cls: 'ok',
      });
    else say({ text: `${label} — 새 짝이에요.`, cls: 'ok' });
  };
  const choose = (i: number) => {
    if (pick === null) {
      setPick(i);
      setLive(`${items[i]} 잡았어요. 이을 점을 고르세요.`);
    } else if (pick === i) setPick(null);
    else {
      setPick(null);
      link(pick, i);
    }
  };
  const onKey = (i: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(i);
    } else if (e.key === 'Escape') setPick(null);
    else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      // 점 사이 초점 옮기기(이웃 점) — Tab 을 여러 번 누르지 않아도 되게
      e.preventDefault();
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      svg.current?.querySelector<SVGGElement>(`[data-node="${(i + d + n) % n}"]`)?.focus();
    }
  };
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: 점(단추)들을 한 무리로 읽히게 — SVG 라 fieldset 을 쓸 수 없다 */}
      <svg
        ref={svg}
        viewBox={`0 0 ${g.w} ${g.h}`}
        className="ct-pairs"
        role="group"
        aria-label={`점 ${n}개. 두 점을 선으로 이으면 한 쌍`}
      >
        {s.found.map((key) => {
          const [a, b] = key.split(',').map(Number) as [number, number];
          const [x1, y1] = g.pos[a] as [number, number];
          const [x2, y2] = g.pos[b] as [number, number];
          const len = Math.hypot(x2 - x1, y2 - y1);
          return (
            <line
              key={key}
              data-k={key}
              className={`ct-edge${fresh.current === key ? ' new' : ''}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              style={{ strokeDasharray: len, '--len': len } as CSSProperties}
            />
          );
        })}
        <line ref={rubber} className="ct-rubber" visibility="hidden" />
        {items.map((name, i) => (
          <PairNode
            // biome-ignore lint/suspicious/noArrayIndexKey: 물건 순서는 매개변수에서 고정
            key={i}
            i={i}
            name={name}
            g={g}
            svg={svg}
            rubber={rubber}
            busy={busy}
            picked={pick === i}
            deg={finished ? deg[i] : undefined}
            label={`${name}${
              deg[i]
                ? `, 이은 점 ${s.found
                    .filter((k) => k.split(',').includes(String(i)))
                    .map((k) => items[Number(k.split(',').find((x) => x !== String(i)))])
                    .join(', ')}`
                : ''
            }`}
            onKey={onKey(i)}
            onActivate={() => choose(i)}
            onRelease={(h, moved) => {
              if (!moved) {
                if (tap.tapMode) choose(i);
                else tap.miss();
              } else if (h >= 0) link(i, h);
              else {
                tap.miss('다른 점 위에서 손을 떼면 이어져요.');
                onMiss();
              }
            }}
          />
        ))}
      </svg>
      <div className="wgt-read">
        <span className="num">
          {finished ? `모두 ${total}가지예요` : `찾은 짝 ${s.found.length}가지`}
        </span>
      </div>
      <div className="ct-found tight">
        {s.found.map((f) => (
          <span key={f} className="ct-case" data-k={f}>
            {pairLabel(f)}
          </span>
        ))}
      </div>
      {toast}
      <div className="ct-sr" aria-live="polite">
        {live}
      </div>
    </>
  );
}

interface PairNodeProps {
  i: number;
  name: string;
  g: ReturnType<typeof pGeom>;
  svg: RefObject<SVGSVGElement | null>;
  rubber: RefObject<SVGLineElement | null>;
  busy: RefObject<boolean>;
  picked: boolean;
  /** 다 이은 뒤 이 점에 이은 선 수 */
  deg?: number | undefined;
  label: string;
  onKey(e: KeyboardEvent<SVGGElement>): void;
  onActivate(): void;
  /** 손을 뗀 자리에서 가장 가까운 다른 점(없으면 −1), 움직였는지 */
  onRelease(h: number, moved: boolean): void;
}

/** 점 하나. 끄는 동안 고무줄 선의 끝과 '지금 손가락 밑 점' 표시만 직접 고친다(정답 신호가 아니다) */
function PairNode({ i, name, g, svg, rubber, busy, picked, deg, label, ...h }: PairNodeProps) {
  const ref = useRef<SVGGElement>(null);
  const d = useRef<{ x: number; y: number; inv: DOMMatrix | null; hot: number } | null>(null);
  const [x, y] = g.pos[i] as [number, number];
  const toSvg = (cx: number, cy: number) => {
    const m = d.current?.inv;
    if (!m) return [x, y] as const;
    const pt = new DOMPoint(cx, cy).matrixTransform(m);
    return [pt.x, pt.y] as const;
  };
  const setHot = (j: number) => {
    const cur = d.current;
    if (!cur || cur.hot === j) return;
    svg.current?.querySelector(`[data-node="${cur.hot}"]`)?.removeAttribute('data-hot');
    if (j >= 0) svg.current?.querySelector(`[data-node="${j}"]`)?.setAttribute('data-hot', '');
    cur.hot = j;
  };
  const stop = () => {
    rubber.current?.setAttribute('visibility', 'hidden');
    setHot(-1);
    ref.current?.removeAttribute('data-hot');
    d.current = null;
    busy.current = false;
  };
  useDrag(ref, {
    pick: () => !busy.current,
    onStart(cx, cy) {
      busy.current = true;
      d.current = { x: cx, y: cy, inv: svg.current?.getScreenCTM()?.inverse() ?? null, hot: -1 };
    },
    onMove(dx, dy) {
      const cur = d.current;
      const r = rubber.current;
      if (!cur || !r || Math.hypot(dx, dy) < TAP_PX) return;
      const [px, py] = toSvg(cur.x + dx, cur.y + dy);
      r.setAttribute('x1', String(x));
      r.setAttribute('y1', String(y));
      r.setAttribute('x2', String(px));
      r.setAttribute('y2', String(py));
      r.setAttribute('visibility', 'visible');
      ref.current?.setAttribute('data-hot', '');
      setHot(pHit(g, px, py, i));
    },
    onEnd(dx, dy, cancelled) {
      const cur = d.current;
      const moved = Math.hypot(dx, dy) >= TAP_PX;
      const [px, py] = cur ? toSvg(cur.x + dx, cur.y + dy) : [x, y];
      stop();
      if (cancelled) return;
      h.onRelease(moved ? pHit(g, px, py, i) : -1, moved);
    },
  });
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 <button> 을 쓸 수 없다
    <g
      ref={ref}
      data-node={i}
      className={`ct-node${picked ? ' sel' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={picked}
      onKeyDown={h.onKey}
      onClick={(e) => {
        if (e.detail === 0) h.onActivate();
      }}
    >
      <circle cx={x} cy={y} r={g.r} />
      <text x={x} y={y}>
        {name}
      </text>
      {deg !== undefined && (
        <g className="ct-deg">
          <circle cx={x + g.r * 0.78} cy={y - g.r * 0.78} r={11} />
          <text x={x + g.r * 0.78} y={y - g.r * 0.78}>
            {deg}
          </text>
        </g>
      )}
    </g>
  );
}

// ---- 벤 분류(venn) ----

function VennSort({ p, s, settle, say, onMiss, toast }: Drag) {
  const sets = p.sets as NonNullable<CountParams['sets']>;
  const el = vElems(p);
  const deck = vDeck(p, s);
  const mask = `ct-notA${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const board = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const fx = useSettleFx(board, '[data-card]', 'data-card');
  /** '넣을 곳' 단추를 연 카드(키보드·눌러서 하기) */
  const [pick, setPick] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const focusCard = useRef<number | null>(null);
  const tap = useTapFallback(
    say,
    '카드를 누르고 아래에서 넣을 곳을 고르세요.',
    '카드를 누른 채 넣을 곳까지 끌어 보세요.',
  );
  const NAME: Record<VReg, string> = {
    a: `${sets.names[0]}에만`,
    ab: '둘 다',
    b: `${sets.names[1]}에만`,
    out: '둘 다 아님',
  };
  // 다 맞힌 뒤에는 더미 줄이 필요 없어 판을 그림 높이로 줄인다(그 자리에 결론 글)
  const H = s.solved ? V_H : V_H + V_DECK;

  useLayoutEffect(() => {
    if (focusCard.current === null) return;
    board.current?.querySelector<HTMLElement>(`[data-card="${focusCard.current}"]`)?.focus();
    focusCard.current = null;
  });

  const put = (e: number, to: VReg | null, dropped?: DOMRect): boolean => {
    const r = vPut(p, s, e, to);
    if (r.res === 'full') {
      say({ text: '그 칸은 자리가 다 찼어요. 다른 카드를 먼저 옮겨 보세요.', cls: '' });
      return false;
    }
    if (r.res === 'none') return false;
    fx.mark(dropped ? [String(e), dropped] : undefined);
    settle(r.s);
    setLive(`${el[e]}, ${to ? NAME[to] : '더미'}에 놓음.`);
    if (!r.s.wrong.length)
      say({
        text: vDeck(p, r.s).length ? '' : "다 넣었으면 '확인하기'를 눌러 보세요.",
        cls: '',
      });
    return true;
  };
  const check = () => {
    const r = vCheck(p, s);
    settle(r.s);
    if (r.s.wrong.length) {
      say({
        text: `${r.s.wrong.length}개가 제자리가 아니에요. 빨간 테두리 카드를 옮겨 보세요.`,
        cls: 'bad',
      });
      onMiss();
    } else say({ text: '모두 제자리예요!', cls: 'ok' });
  };
  const open = (e: number) => {
    if (s.solved) return;
    setPick(e);
    // 더미 맨 위 카드는 넣을 곳 단추에 가려지므로 무엇을 넣는지 안내 칸에 적는다
    say({ text: `${el[e]} — 어디에 넣을까요?`, cls: '' });
  };
  const choose = (to: VReg) => {
    if (pick === null) return;
    const e = pick;
    setPick(null);
    focusCard.current = e;
    put(e, to);
  };

  const onDrop = (e: number) => (node: HTMLElement, dx: number, dy: number) => {
    const rect = node.getBoundingClientRect();
    node.style.transform = '';
    const back = () => flyFrom(node, rect, { duration: FLY_MS });
    if (Math.hypot(dx, dy) < TAP_PX) {
      back();
      if (tap.tapMode) open(e);
      else tap.miss();
      return;
    }
    const host = board.current;
    if (!host) return back();
    const [x, y] = boardPoint(host, rect, V_W, true);
    const to = vRegionAt(x, y);
    if (to !== null && put(e, to === 'deck' ? null : to, rect)) return;
    back();
    if (to === null) {
      tap.miss('그림 안에 놓아 보세요.');
      onMiss();
    }
  };

  const c = vCounts(p);
  const comp = s.solved && sets.u;
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: 카드·단추를 한 무리로 읽히게(fieldset 은 판 모양을 깨뜨린다) */}
      <div
        className="ct-vboard"
        ref={board}
        role="group"
        aria-label={`벤 다이어그램: ${sets.names[0]}, ${sets.names[1]}${sets.u ? ', 전체집합 U' : ''}`}
        style={{ aspectRatio: `${V_W} / ${H}` } as CSSProperties}
      >
        <svg viewBox={`0 0 ${V_W} ${V_H}`} aria-hidden="true">
          <defs>
            <mask id={mask}>
              <rect width={V_W} height={V_H} fill="white" />
              <circle cx={V_A.cx} cy={V_A.cy} r={V_A.r} fill="black" />
            </mask>
          </defs>
          <rect className="ct-urect" x={1} y={1} width={V_W - 2} height={V_H - 2} rx={14} />
          {comp && (
            <rect
              className="ct-comp"
              x={1}
              y={1}
              width={V_W - 2}
              height={V_H - 2}
              rx={14}
              mask={`url(#${mask})`}
            />
          )}
          <circle className="ct-ring" cx={V_A.cx} cy={V_A.cy} r={V_A.r} />
          <circle className="ct-ring" cx={V_B.cx} cy={V_B.cy} r={V_B.r} />
          <text className="ct-vname" x={8} y={16} textAnchor="start">
            {sets.names[0]}
          </text>
          <text className="ct-vname" x={V_W - 8} y={16} textAnchor="end">
            {sets.names[1]}
          </text>
          {sets.u && (
            <text className="ct-vname" x={V_W / 2} y={16} textAnchor="middle">
              U
            </text>
          )}
        </svg>
        {!s.solved && (
          <div
            className="ct-vdeck"
            style={{ top: `${(V_H / H) * 100}%`, height: `${(V_DECK / H) * 100}%` }}
          >
            {pick === null ? (
              <>
                <span className="ct-left num">
                  {deck.length ? `남은 카드 ${deck.length}장` : '다 넣었어요'}
                </span>
                <button
                  type="button"
                  className="lbtn blue"
                  disabled={deck.length > 0}
                  onClick={check}
                >
                  확인하기
                </button>
              </>
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: 단추 넷을 한 무리로 읽히게(fieldset 은 모양이 깨진다)
              <div className="ct-choose" role="group" aria-label={`${el[pick]} 넣을 곳`}>
                {(['a', 'ab', 'b', 'out'] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    className="lbtn soft"
                    onClick={() => choose(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        focusCard.current = pick;
                        setPick(null);
                      }
                    }}
                    // biome-ignore lint/a11y/noAutofocus: 넣을 곳을 열면 첫 단추로 바로 옮겨야 키보드로 이어 고를 수 있다
                    autoFocus={r === 'a'}
                  >
                    {NAME[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {el.map((x, e) => {
          const w = s.where[e] ?? null;
          const under = w === null && deck[0] !== e;
          const [cx, cy] = vPos(p, s, e);
          return (
            <DragBtn
              key={x}
              data-card={e}
              className={`ct-card${under ? ' under' : ''}${pick === e ? ' sel' : ''}`}
              data-wrong={s.wrong.includes(e) ? '' : undefined}
              style={{
                left: `calc(${(cx / V_W) * 100}% - 22px)`,
                top: `calc(${(cy / H) * 100}% - 22px)`,
                zIndex: w === null ? 3 - Math.min(Math.max(deck.indexOf(e), 0), 2) : undefined,
              }}
              tabIndex={under ? -1 : 0}
              aria-hidden={under || undefined}
              aria-label={`${x}, ${w ? NAME[w] : '아직 안 넣음'}${s.wrong.includes(e) ? ', 제자리가 아님' : ''}`}
              busy={busy}
              locked={under || s.solved}
              onDrop={onDrop(e)}
              onActivate={() => open(e)}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') setPick(null);
              }}
            >
              {x}
            </DragBtn>
          );
        })}
      </div>
      {s.solved && (
        <div className="wgt-read ct-vread" aria-live="polite">
          <span className="num">
            {NAME.a} {c.a} · 둘 다 {c.ab} · {NAME.b} {c.b}
            {sets.u ? ` · 둘 다 아님 ${c.out}` : ''}
          </span>
          <span className="num">
            둘 중 하나라도: {c.nA} + {c.nB} − {c.ab} = {c.union}개
          </span>
          {sets.u && (
            <span className="num">
              {sets.names[0]}의 여집합(칠한 곳): {c.u} − {c.nA} = {c.compA}개
            </span>
          )}
        </div>
      )}
      {toast}
      <div className="ct-sr" aria-live="polite">
        {live}
      </div>
    </>
  );
}

// ---- 누르기(셋 이상 고르기·중복 나열) · 수형도 · 파스칼 ----

function Lister({ p, s, settle, say, onMiss }: Part & { say(m: Msg): void; onMiss(): void }) {
  const items = p.items ?? [];
  const k = p.k ?? 0;
  const total = cTotal(p);
  const finished = cDone(p, s);
  const tap = (i: number) => {
    const r = cTap(p, s, i);
    if (r.res === 'skip') return;
    settle(r.s);
    if (r.res === 'new') {
      const last = r.s.found.at(-1) as string;
      say({ text: `${cLabel(p, last)} — 새로운 경우예요.`, cls: 'ok' });
    } else if (r.res === 'dup') {
      say({ text: '이미 찾은 경우예요.', cls: 'bad' });
      onMiss();
    } else say({ text: '', cls: '' });
  };
  return (
    <>
      <div className="ct-slots" aria-live="polite">
        {Array.from({ length: k }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 고르는 칸 자리 번호
          <span key={i} className={`ct-slot${i < s.sel.length ? ' on' : ''}`}>
            {i < s.sel.length ? items[s.sel[i] as number] : ''}
          </span>
        ))}
      </div>
      <div className="ct-items">
        {items.map((it, i) => (
          <button
            type="button"
            // biome-ignore lint/suspicious/noArrayIndexKey: 물건 순서는 매개변수에서 고정
            key={i}
            className="lbtn soft ct-item"
            disabled={finished || (p.mode !== 'repeat' && s.sel.includes(i))}
            onClick={() => tap(i)}
          >
            {it}
          </button>
        ))}
      </div>
      <div className="wgt-read">
        <span className="num">
          찾은 경우 {s.found.length}가지{finished ? ` · 모두 ${total}가지예요` : ''}
        </span>
      </div>
      <div className="ct-found">
        {s.found.map((f) => (
          <span key={f} className="ct-case">
            {cLabel(p, f)}
          </span>
        ))}
      </div>
      {s.sel.length > 0 && (
        <button type="button" className="lbtn quiet" onClick={() => settle({ ...s, sel: [] })}>
          고른 것 지우기
        </button>
      )}
    </>
  );
}

function Tree({ p, s, settle }: Part) {
  const t = cTree(p);
  const items = p.items ?? [];
  const k = p.k ?? 0;
  const ROW = 22;
  const H = Math.max(t.leaves * ROW, 60) + 10;
  const colW = 260 / Math.max(k, 1);
  const ys = t.levels.map((lv) => lv.map((_, i) => 5 + (i + 0.5) * ((H - 10) / lv.length)));
  return (
    <>
      <svg viewBox={`0 0 320 ${H}`} className="wgt-svg ct-tree">
        <title>수형도</title>
        <circle cx={20} cy={H / 2} r={5} className="ct-root" />
        {t.levels.map((lv, d) =>
          lv.map((node, i) => {
            const x = 20 + (d + 1) * colW;
            const y = ys[d]?.[i] ?? 0;
            const px = 20 + d * colW;
            const py = d === 0 ? H / 2 : (ys[d - 1]?.[node.parent] ?? 0);
            return (
              <g key={node.id} visibility={d < s.open ? 'visible' : 'hidden'} className="ct-branch">
                <line x1={px + 6} y1={py} x2={x - 14} y2={y} />
                <text x={x} y={y + 5}>
                  {items[node.item]}
                </text>
              </g>
            );
          }),
        )}
      </svg>
      <div className="wgt-read" aria-live="polite">
        <span className="num">
          {s.open === 0
            ? '아직 펼치지 않았어요'
            : s.open < k
              ? `${s.open}단계까지 ${t.levels[s.open - 1]?.length ?? 0}갈래`
              : `끝 가지 ${t.leaves}개 = 모든 경우 ${t.leaves}가지`}
        </span>
      </div>
      <div className="wgt-ctl">
        <button
          type="button"
          className="lbtn blue wide"
          disabled={s.open >= k}
          onClick={() => settle({ ...s, open: s.open + 1 })}
        >
          {s.open === 0 ? '첫 단계 펼치기' : '다음 단계 펼치기'}
        </button>
      </div>
    </>
  );
}

function Pascal({ p, s, settle, say }: Part & { say(m: Msg): void }) {
  const rows = p.rows ?? 0;
  const t = cPascal(rows);
  return (
    <>
      <div className="ct-pascal">
        {t.map((row, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 행 번호
          <div className="ct-prow" key={r}>
            {row.map((v, j) => {
              const last = r === rows;
              const open = !last || s.rev[j];
              return last ? (
                <button
                  type="button"
                  // biome-ignore lint/suspicious/noArrayIndexKey: 칸 번호
                  key={j}
                  className={`ct-pcell btn${open ? ' on' : ''}`}
                  aria-label={open ? String(v) : `${r}행 ${j}번째 칸 열기`}
                  onClick={() => {
                    const up = t[r - 1] ?? [];
                    say({ text: `위의 두 수 ${up[j - 1] ?? 0} + ${up[j] ?? 0} = ${v}`, cls: 'ok' });
                    settle({ ...s, rev: s.rev.map((x, i) => x || i === j) });
                  }}
                >
                  {open ? v : '?'}
                </button>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: 칸 번호
                <span key={j} className="ct-pcell num">
                  {v}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="wgt-read">
        <span className="num">맨 아래 줄의 ? 를 눌러 채워 보세요</span>
      </div>
    </>
  );
}
