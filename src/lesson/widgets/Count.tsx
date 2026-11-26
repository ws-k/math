// 경우의 수 화면. 움직임이 곧 수학인 셋은 손으로 옮긴다(2026-11-23 결정 D1, 원칙 P1):
//   순서 있는 나열 = 칩을 자리에 세우고 자리 바꾸기(Line) · 두 개 고르기 = 두 개를 선으로 잇기(Pairs) ·
//   벤 다이어그램 = 원소 카드를 영역에 넣어 분류(VennSort).
// 셋 이상 고르기·중복 나열은 누르기(Lister), 수형도·파스칼은 '보여 주기'라 누르기 그대로다.
// 끄는 동안은 useDrag 가 프레임마다 부르는 onMove 에서 그 요소의 transform·속성만 직접 고친다(React 렌더 0회, P8).
// 손을 떼면 놓은 자리를 count.ts(lSpotAt·pHit·vRegionAt)로 한 번 판정하고 상태를 바꾼다(P3) — 끄는 도중에는 맞다/틀리다
// 신호가 없다. 누르기는 첫 번부터 고르기로 동작하고(화면 낭독기의 두 번 두드리기가 누르기로 오기 때문 — tapStep),
// 안내 글만 두 번째에 '눌러도 돼요'를 띄운다(P4). 키보드는 처음부터 늘 된다.
// 결론 글(곱·나눗셈 식)은 안내 칸(토스트)이 아니라 읽는 값 줄에 둔다 — 다 찾은 뒤 다른 안내가 와도 지워지지 않게.
// 문구는 중립어('자리'·'경우'·'짝')이고 장면이 words 칸으로 바꾼다(count.ts CWords).
// 끌어 놓기 손 처리(들기·따라오기·놓기)는 저울과 같이 쓰는 dropDrag.ts, 놓은 뒤 날아가기는 fly.ts 에 있다.
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { centerOf, FAILS_FOR_TAP, isTap } from '../drag.ts';
import { landAt, useSettleFx } from '../fly.ts';
import { useDrag } from '../useDrag.ts';
import {
  CARD_FONT,
  CHIP_FONT,
  type CountParams,
  type CState,
  cardInner,
  cDone,
  chipInner,
  cInit,
  cLabel,
  cLink,
  cPascal,
  cTap,
  cTotal,
  cTree,
  fitPx,
  L_W,
  LABEL_MIN,
  lDone,
  lGeom,
  lGroups,
  lMove,
  lSeats,
  lShort,
  lSpotAt,
  NODE_FONT,
  nodeInner,
  pDegree,
  pDone,
  pGeom,
  pHit,
  tapStep,
  V_A,
  V_B,
  V_CARD,
  V_DECK,
  V_H,
  V_W,
  type VReg,
  vCheck,
  vCounts,
  vDeck,
  vElems,
  viewOf,
  vNames,
  vPos,
  vPut,
  vRegionAt,
} from './count.ts';
import { useDropDrag } from './dropDrag.ts';
import type { WidgetProps } from './index.tsx';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };

/** 놓은 뒤 새 자리로 미끄러져 가는 시간 */
const FLY_MS = 220;
/** 이미 찾은 경우·짝을 깜빡이는 시간 */
const FLASH_MS = 900;
/** '눌러도 돼요' 안내의 앞말(두 번째 누르기·놓친 끌기에서) */
const TAP_ON = '끌기가 어려우면 눌러도 돼요.';

/** 처음 안내(토스트 한 줄). 장면이 words.intro 로 바꾼다 */
const INTRO: Partial<Record<ReturnType<typeof viewOf>, string>> = {
  line: '위에서 끌어 아래 자리에 놓아 보세요.',
  pair: '하나에서 다른 하나까지 끌어 이어 보세요.',
  venn: '아래 카드를 끌어 알맞은 곳에 넣어 보세요.',
};
const introOf = (p: CountParams) => p.words?.intro ?? INTRO[viewOf(p)] ?? '';

export function Count({ params: p, onDone, onMiss }: WidgetProps<CountParams>) {
  const view = viewOf(p);
  const [s, setS] = useState<CState>(() => cInit(p));
  const [msg, setMsg] = useState<Msg>({ text: introOf(p), cls: '' });
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
  // 직접 조작 셋은 안내 칸을 자기 자리(목록 아래, '처음부터 다시' 위)에 둔다
  return (
    <div className="wgt ct">
      {body}
      {view === 'line' || view === 'pair' || view === 'venn' ? null : toast}
    </div>
  );
}

type Part = { p: CountParams; s: CState; settle(n: CState): void };
type Drag = Part & { say(m: Msg): void; onMiss(): void; toast: ReactNode };

/** 이 요소를 잠깐 깜빡인다(이미 찾은 경우·짝). 상태가 아니라 속성만 — 다시 그리지 않는다 */
function flash(host: ParentNode | null | undefined, key: string) {
  for (const el of host?.querySelectorAll<Element>(`[data-k="${key}"]`) ?? []) {
    el.removeAttribute('data-flash');
    // 같은 경우를 연달아 다시 만들어도 처음부터 깜빡이게 한 번 그려 낸다
    void (el as HTMLElement).getBoundingClientRect();
    el.setAttribute('data-flash', '');
    setTimeout(() => el.removeAttribute('data-flash'), FLASH_MS);
  }
}

/** 놓은 요소의 가운데를 판 좌표로. 판은 폭에 맞춰 늘고 주니 폭 비율로 되돌린다(scaleY: 세로도 같은 비율인 판) */
function boardPoint(board: HTMLElement, r: DOMRect, w: number, scaleY: boolean) {
  const b = board.getBoundingClientRect();
  const k = w / b.width;
  const [cx, cy] = centerOf(r);
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

/** 끌 수 있는 단추 하나(줄 세우기 칩·벤 카드). 단추마다 useDropDrag 를 붙이려고 컴포넌트로 뺐다 */
function DragBtn({ busy, locked, onDrop, onActivate, ...rest }: DragBtnProps) {
  const ref = useRef<HTMLButtonElement>(null);
  // 들어 올린 칩은 살짝 커져 손가락 밑에서도 '들었다'가 보인다(표시는 기본 data-lift)
  useDropDrag(ref, {
    busy,
    locked,
    follow: (dx, dy) => `translate(${dx}px,${dy}px) scale(1.06)`,
    onDrop,
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

/**
 * 누르기 고르기와 '눌러도 돼요' 안내(tapStep). tap = 손가락 누르기(안내를 세고 띄움), key = 키보드·낭독기(세지 않음),
 * miss = 놓친 끌기(세고, 두 번째에 '눌러도 돼요'). quiet 이면(다 찾은 뒤) 안내 없이 고르기만.
 */
function useTaps(say: (m: Msg) => void, how: string) {
  const [t, setT] = useState<{ fails: number; pick: number | null }>({ fails: 0, pick: null });
  const step = (i: number, count: boolean, quiet: boolean, drag: string) => {
    const r = tapStep(count ? t : { ...t, fails: FAILS_FOR_TAP + 1 }, i);
    setT({ fails: count ? r.fails : t.fails, pick: r.pick });
    if (!quiet && r.hint) say({ text: r.hint === 'drag' ? drag : `${TAP_ON} ${how}`, cls: '' });
    return r;
  };
  return {
    pick: t.pick,
    setPick: (pick: number | null) => setT((x) => ({ ...x, pick })),
    tap: (i: number, quiet: boolean, drag: string) => step(i, true, quiet, drag),
    key: (i: number) => step(i, false, true, ''),
    miss(text: string) {
      const fails = t.fails + 1;
      setT({ ...t, fails });
      say({ text: fails === FAILS_FOR_TAP ? `${TAP_ON} ${how}` : text, cls: '' });
    },
    reset: () => setT({ fails: t.fails, pick: null }),
  };
}

// ---- 줄 세우기(list) ----

function Line({ p, s, settle, say, onMiss, toast }: Drag) {
  const items = p.items ?? [];
  const k = p.k ?? 0;
  const g = lGeom(items.length, k);
  const seats = lSeats(p);
  const finished = cDone(p, s);
  const board = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const fx = useSettleFx(board, 'data-chip', FLY_MS);
  const [live, setLive] = useState('');
  const taps = useTaps(say, '하나를 누르고, 갈 자리를 누르세요.');
  const pick = taps.pick;
  const spotName = (st: CState, i: number) => {
    const at = st.seat.indexOf(i);
    return at >= 0 ? `${seats[at]} 자리` : (p.words?.wait ?? '남은 것');
  };
  const lineText = (st: CState) =>
    st.seat.map((x) => (x === null ? '빈자리' : items[x])).join(', ');

  /** 옮겼으면 true. 판정 글은 놓은 뒤 한 번만(P3) */
  const commit = (i: number, to: number | 'wait', dropped?: DOMRect): boolean => {
    const r = lMove(p, s, i, to);
    if (r.res === 'none') return false;
    fx.mark(dropped && [[String(i), dropped]]);
    settle(r.s);
    setLive(`지금 자리: ${lineText(r.s)}`);
    // 다 찾은 뒤에는 안내를 더 띄우지 않는다 — 결론은 읽는 값 줄에 남아 있다
    if (finished) return true;
    const label = r.key ? lShort(p, r.key) : '';
    if (r.res === 'new')
      say(cDone(p, r.s) ? { text: '', cls: '' } : { text: `${label} — 새 경우예요.`, cls: 'ok' });
    else if (r.res === 'dup') {
      // 꽉 찬 줄에서 자리를 바꾸다 지나가는 중복은 자연스러운 과정이라 틀린 시도(onMiss)로 세지 않는다
      say({ text: `${label} — 이미 찾은 경우예요.`, cls: 'bad' });
      flash(board.current?.parentElement, r.key as string);
    } else
      say({
        text: r.s.seat.some((x) => x !== null) ? '빈자리를 채우면 한 경우가 적혀요.' : '',
        cls: '',
      });
    return true;
  };
  const spotOf = (i: number) => {
    const at = s.seat.indexOf(i);
    return at >= 0 ? at : ('wait' as const);
  };
  /** 누르기·키보드로 고르기. 다른 칩을 누르면 고른 칩이 그 칩 자리로 */
  const choose = (r: { pick: number | null; pair?: [number, number] }, i: number) => {
    if (r.pair) commit(r.pair[0], spotOf(r.pair[1]));
    else if (r.pick === i) setLive(`${items[i]} 골랐어요. 갈 자리를 고르세요.`);
  };
  const toSpot = (to: number | 'wait') => {
    if (pick === null) return;
    commit(pick, to);
    taps.setPick(null);
  };

  const onDrop = (i: number) => (el: HTMLElement, dx: number, dy: number) => {
    const { rect, back } = landAt(el, FLY_MS);
    if (isTap(dx, dy)) {
      back();
      choose(taps.tap(i, finished, '누른 채 아래 자리까지 끌어 보세요.'), i);
      return;
    }
    const host = board.current;
    if (!host) return back();
    const [x, y] = boardPoint(host, rect, L_W, false);
    const to = lSpotAt(g, x, y);
    if (to !== null && commit(i, to, rect)) return;
    back();
    if (to === null && !finished) {
      taps.miss('아래 자리 위나 위쪽 칸에 놓아 보세요.');
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
      else setLive('빈자리가 없어요. 자리의 것을 위 방향키로 빼거나 Enter 로 골라 바꾸세요.');
    } else if (e.key === 'ArrowUp' && at >= 0) to = 'wait';
    else if (e.key === 'Escape') taps.setPick(null);
    if (to === null) return;
    e.preventDefault();
    commit(i, to);
  };

  const reset = () => {
    fx.mark();
    taps.reset();
    settle(cInit(p));
    setLive('처음부터 다시');
    say({ text: introOf(p), cls: '' });
  };

  const pct = (x: number, w: number) => `calc(${(x / L_W) * 100}% - ${w / 2}px)`;
  const groups = finished && k >= 2 ? lGroups(p, s.found) : null;
  return (
    <>
      <div className="ct-line" ref={board} style={{ height: g.h }}>
        <span className="ct-zlabel" style={{ top: 0 }}>
          {p.words?.wait ?? '남은 것'}
        </span>
        <button
          type="button"
          tabIndex={-1}
          className="ct-wait"
          aria-label={p.words?.wait ?? '남은 것'}
          style={{ top: g.waitTop, height: g.waitBottom - g.waitTop }}
          onClick={() => toSpot('wait')}
        />
        <span className="ct-zlabel" style={{ top: g.waitBottom + 6 }}>
          자리 — 왼쪽이 {seats[0]}
        </span>
        {g.seatX.map((x, j) => (
          <button
            type="button"
            tabIndex={-1}
            // biome-ignore lint/suspicious/noArrayIndexKey: 자리 번호
            key={j}
            className="ct-seat"
            aria-label={`${seats[j]} 자리`}
            style={{ left: pct(x, g.box), top: g.seatY - g.box / 2, width: g.box, height: g.box }}
            onClick={() => toSpot(j)}
          >
            <span className="ct-ord" style={{ top: g.box + 2 }}>
              {seats[j]}
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
              style={{
                left: pct(x, g.chip),
                top: y - g.chip / 2,
                width: g.chip,
                height: g.chip,
                fontSize: fitPx(name, chipInner(g.chip), CHIP_FONT) ?? LABEL_MIN,
              }}
              aria-label={`${name}, ${spotName(s, i)}`}
              aria-pressed={pick === i}
              busy={busy}
              onDrop={onDrop(i)}
              onActivate={() => choose(taps.key(i), i)}
              onKeyDown={onKey(i)}
            >
              {name}
            </DragBtn>
          );
        })}
      </div>
      <div className="wgt-read">
        {finished ? (
          <span className="num ct-done">{lDone(p)}</span>
        ) : (
          <span className="num">찾은 경우 {s.found.length}가지</span>
        )}
      </div>
      {groups ? (
        <div className="ct-groups" style={{ '--cols': groups.length } as CSSProperties}>
          {groups.map((gr) => (
            <div key={gr.head} className="ct-g">
              <span className="ct-gh">
                {seats[0]} {items[gr.head]}
              </span>
              {gr.keys.map((f) => (
                <span key={f} className="ct-case">
                  {lShort(p, f)}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="ct-found tight">
          {s.found.map((f) => (
            <span key={f} className="ct-case" data-k={f}>
              {lShort(p, f)}
            </span>
          ))}
        </div>
      )}
      {toast}
      <button type="button" className="lbtn quiet" onClick={reset}>
        처음부터 다시
      </button>
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
  const finished = cDone(p, s);
  const svg = useRef<SVGSVGElement>(null);
  const rubber = useRef<SVGLineElement>(null);
  const busy = useRef(false);
  /** 방금 그은 선(한 번 그려지듯 나타나게) */
  const fresh = useRef<string | null>(null);
  const [live, setLive] = useState('');
  const taps = useTaps(say, '두 개를 차례로 누르면 이어져요.');
  const pick = taps.pick;
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
    const label = pairLabel(r.key as string);
    if (r.res === 'dup') {
      flash(svg.current?.parentElement, r.key as string);
      // 다 이은 뒤에는 안내·틀린 시도로 세지 않는다(결론 줄이 그대로 남게)
      if (finished) return;
      say({
        text: `${items[a]}→${items[b]}, ${items[b]}→${items[a]} 모두 같은 짝이에요. 이미 이었어요.`,
        cls: 'bad',
      });
      onMiss();
      return;
    }
    fresh.current = r.key as string;
    settle(r.s);
    setLive(`${label} 이었어요. 찾은 짝 ${r.s.found.length}가지.`);
    say(cDone(p, r.s) ? { text: '', cls: '' } : { text: `${label} — 새 짝이에요.`, cls: 'ok' });
  };
  const choose = (r: { pick: number | null; pair?: [number, number] }, i: number) => {
    if (r.pair) link(r.pair[0], r.pair[1]);
    else if (r.pick === i) setLive(`${items[i]} 잡았어요. 이을 것을 고르세요.`);
  };
  const onKey = (i: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(taps.key(i), i);
    } else if (e.key === 'Escape') taps.setPick(null);
    else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      // 점 사이 초점 옮기기(이웃 점) — Tab 을 여러 번 누르지 않아도 되게
      e.preventDefault();
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      svg.current?.querySelector<SVGGElement>(`[data-node="${(i + d + n) % n}"]`)?.focus();
    }
  };
  const reset = () => {
    fresh.current = null;
    taps.reset();
    settle(cInit(p));
    setLive('처음부터 다시');
    say({ text: introOf(p), cls: '' });
  };
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: 점(단추)들을 한 무리로 읽히게 — SVG 라 fieldset 을 쓸 수 없다 */}
      <svg
        ref={svg}
        viewBox={`0 0 ${g.w} ${g.h}`}
        className="ct-pairs"
        role="group"
        aria-label={`${n}개. 두 개를 선으로 이으면 한 짝`}
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
                ? `, 이은 것 ${s.found
                    .filter((k) => k.split(',').includes(String(i)))
                    .map((k) => items[Number(k.split(',').find((x) => x !== String(i)))])
                    .join(', ')}`
                : ''
            }`}
            onKey={onKey(i)}
            onActivate={() => choose(taps.key(i), i)}
            onRelease={(h, moved) => {
              if (!moved) choose(taps.tap(i, finished, '누른 채 다른 하나까지 끌어 보세요.'), i);
              else if (h >= 0) link(i, h);
              else if (!finished) {
                taps.miss('다른 하나 위에서 손을 떼면 이어져요.');
                onMiss();
              }
            }}
          />
        ))}
      </svg>
      <div className="wgt-read">
        {finished ? (
          <span className="num ct-done">{pDone(p)}</span>
        ) : (
          <span className="num">찾은 짝 {s.found.length}가지</span>
        )}
      </div>
      <div className="ct-found tight">
        {s.found.map((f) => (
          <span key={f} className="ct-case" data-k={f}>
            {pairLabel(f)}
          </span>
        ))}
      </div>
      {toast}
      <button type="button" className="lbtn quiet" onClick={reset}>
        처음부터 다시
      </button>
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
  /** 고무줄 선·손가락 밑 표시를 감춘다(시작점 근처로 돌아왔을 때도) */
  const hide = () => {
    rubber.current?.setAttribute('visibility', 'hidden');
    setHot(-1);
    ref.current?.removeAttribute('data-hot');
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
      if (!cur || !r) return;
      if (isTap(dx, dy)) return hide();
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
      const moved = !isTap(dx, dy);
      const [px, py] = cur ? toSvg(cur.x + dx, cur.y + dy) : [x, y];
      hide();
      d.current = null;
      busy.current = false;
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
      {/* 키보드 초점 고리: 고른 점(칠함)과 헷갈리지 않게 바깥에 점선 고리로 */}
      <circle className="ct-fring" cx={x} cy={y} r={g.r + 6} />
      <circle className="ct-dot" cx={x} cy={y} r={g.r} />
      <text
        className="ct-name mid-text"
        x={x}
        y={y}
        style={{ fontSize: fitPx(name, nodeInner(g.r), NODE_FONT) ?? LABEL_MIN }}
      >
        {name}
      </text>
      {deg !== undefined && (
        <g className="ct-deg">
          <circle cx={x + g.r * 0.78} cy={y - g.r * 0.78} r={11} />
          <text className="mid-text" x={x + g.r * 0.78} y={y - g.r * 0.78}>
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
  const read = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const fx = useSettleFx(board, 'data-card', FLY_MS);
  const [live, setLive] = useState('');
  /** 키보드로 넣은 뒤 다시 잡을 카드, 다 맞힌 뒤 결론 줄로 초점 */
  const focusCard = useRef<number | null>(null);
  const focusRead = useRef(false);
  const taps = useTaps(say, '카드를 누르고 아래에서 넣을 곳을 고르세요.');
  const pick = taps.pick;
  const NAME = vNames(p);
  const half = V_CARD / 2;
  // 다 맞힌 뒤에는 더미 줄이 필요 없어 판을 그림 높이로 줄인다(그 자리에 결론 글)
  const H = s.solved ? V_H : V_H + V_DECK;

  useLayoutEffect(() => {
    if (focusCard.current === null) return;
    board.current?.querySelector<HTMLElement>(`[data-card="${focusCard.current}"]`)?.focus();
    focusCard.current = null;
  });
  useEffect(() => {
    if (s.solved && focusRead.current) {
      focusRead.current = false;
      read.current?.focus();
    }
  }, [s.solved]);

  const wrongSay = (n: number) => ({
    text: `${n}개가 제자리가 아니에요. 빨간 테두리 카드를 옮겨 보세요.`,
    cls: 'bad' as const,
  });
  const put = (e: number, to: VReg | null, dropped?: DOMRect): boolean => {
    const r = vPut(p, s, e, to);
    if (r.res === 'full') {
      say({ text: '그 칸은 자리가 다 찼어요. 다른 카드를 먼저 옮겨 보세요.', cls: '' });
      return false;
    }
    if (r.res === 'none') return false;
    fx.mark(dropped && [[String(e), dropped]]);
    settle(r.s);
    setLive(`${el[e]}, ${to ? NAME[to] : '더미'}에 놓음.`);
    // 틀린 카드를 옮기면 남은 틀린 수로 안내를 고친다(다시 '확인하기'로만 판정)
    if (r.s.wrong.length) say(wrongSay(r.s.wrong.length));
    else
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
      say(wrongSay(r.s.wrong.length));
      onMiss();
    } else {
      focusRead.current = true;
      say({ text: '모두 제자리예요!', cls: 'ok' });
    }
  };
  const open = (r: { pick: number | null }, e: number) => {
    if (r.pick === e) say({ text: `${el[e]} — 어디에 넣을까요?`, cls: '' });
  };
  const choose = (to: VReg) => {
    if (pick === null) return;
    const e = pick;
    taps.setPick(null);
    focusCard.current = e;
    put(e, to);
  };
  /** 누르기: 고른 카드를 다시 누르면 닫기, 다른 카드를 누르면 그 카드로 바꿔 열기 */
  const select = (r: { pick: number | null; pair?: [number, number] }, e: number) => {
    if (r.pair) {
      taps.setPick(e);
      say({ text: `${el[e]} — 어디에 넣을까요?`, cls: '' });
    } else open(r, e);
  };

  const onDrop = (e: number) => (node: HTMLElement, dx: number, dy: number) => {
    const { rect, back } = landAt(node, FLY_MS);
    if (isTap(dx, dy)) {
      back();
      const r = taps.tap(e, false, '카드를 누른 채 넣을 곳까지 끌어 보세요.');
      // 처음 두 번은 안내 글이 '어디에 넣을까요'를 덮지 않게 안내만 보인다(넣을 곳 단추는 열린다)
      if (r.hint === null) select(r, e);
      else if (r.pair) taps.setPick(e);
      return;
    }
    const host = board.current;
    if (!host) return back();
    const [x, y] = boardPoint(host, rect, V_W, true);
    const to = vRegionAt(x, y);
    if (to !== null && put(e, to === 'deck' ? null : to, rect)) return;
    back();
    if (to === null) {
      taps.miss('그림 안에 놓아 보세요.');
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
                <span className="ct-left num" style={{ marginLeft: V_CARD + 12 }}>
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
              // key: 다른 카드로 바꿔 열면 단추 무리를 새로 그려 첫 단추에 다시 초점(autoFocus)이 가게
              // biome-ignore lint/a11y/useSemanticElements: 단추 넷을 한 무리로 읽히게(fieldset 은 모양이 깨진다)
              <div key={pick} className="ct-choose" role="group" aria-label={`${el[pick]} 넣을 곳`}>
                {(['a', 'ab', 'b', 'out'] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    className="lbtn soft"
                    onClick={() => choose(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        focusCard.current = pick;
                        taps.setPick(null);
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
                left: `calc(${(cx / V_W) * 100}% - ${half}px)`,
                top: `calc(${(cy / H) * 100}% - ${half}px)`,
                width: V_CARD,
                height: V_CARD,
                fontSize: fitPx(x, cardInner(), CARD_FONT) ?? LABEL_MIN,
                zIndex: w === null ? 3 - Math.min(Math.max(deck.indexOf(e), 0), 2) : undefined,
              }}
              tabIndex={under ? -1 : 0}
              aria-hidden={under || undefined}
              aria-label={`${x}, ${w ? NAME[w] : '아직 안 넣음'}${s.wrong.includes(e) ? ', 제자리가 아님' : ''}`}
              busy={busy}
              locked={under || s.solved}
              onDrop={onDrop(e)}
              onActivate={() => {
                if (!s.solved) select(taps.key(e), e);
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') taps.setPick(null);
              }}
            >
              {x}
            </DragBtn>
          );
        })}
      </div>
      {s.solved && (
        <div className="wgt-read ct-vread" aria-live="polite" ref={read} tabIndex={-1}>
          <span className="num">
            {NAME.a} {c.a} · 둘 다 {c.ab} · {NAME.b} {c.b}
            {sets.u ? ` · ${NAME.out} ${c.out}` : ''}
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
