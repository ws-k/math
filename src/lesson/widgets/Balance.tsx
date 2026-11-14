// 저울 화면. 접시 위 물건(컵·동전·묶음)을 손으로 끌어 바닥에 내리고 다시 올린다.
// 무엇이 어디에 있고 무엇을 옮길 수 있는지, 얼마나 기우는지는 balance.ts(board·layout·moveItem·tiltDeg)가
// 정하고 여기서는 그리기와 손 처리만 한다. 끄는 동안은 useDrag 가 프레임마다 부르는 onMove 에서 그 물건의
// transform 만 직접 고친다(React 렌더 0회). 손을 떼면 놓인 자리로 결과를 한 번 정하고 상태를 바꾼다 —
// 그때 막대 기울기는 CSS 전환으로 움직인다(매 프레임 계산이 필요 없는 움직임이라).
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flyFrom } from '../fly.ts';
import { formatValue } from '../format.ts';
import { LRich, Tex } from '../ui.tsx';
import { useDrag } from '../useDrag.ts';
import {
  type BalanceParams,
  type Board,
  board0,
  coinOf,
  guide0,
  heavier,
  type Item,
  layout,
  moveItem,
  talk,
  tiltDeg,
  view,
} from './balance.ts';
import type { WidgetProps } from './index.tsx';

/** 이만큼 못 움직였으면 끌기가 아니라 누르기로 본다 */
const TAP_PX = 8;
/** 끌기를 이만큼 놓치면 '눌러서 옮기기'를 켠다 */
const FAILS_FOR_TAP = 2;
/**
 * 받침점에서 접시 끈이 걸린 자리까지 거리(viewBox 단위)와 그림 폭. 접시(폭 48%)의 가운데는 그림 폭의
 * 24% 자리라 받침점(190)에서 190 − 0.24 × 380 만큼 떨어져 있다 — 막대 끝(150)으로 계산하면 끈이 막대를 뚫는다.
 */
const VIEW_W = 380;
const ARM = 190 - 0.24 * VIEW_W;
/** 옮긴 물건이 새 자리로 날아가는 시간 */
const FLY_MS = 260;
/** 접시 위 동전 한 줄에 놓는 최대 개수(가장 좁은 화면의 접시 폭) */
const ROW_MAX = 7;
/** 놓는 자리 판정: 접시 상자를 이만큼 넓혀 본다(손가락이 접시 가장자리에 걸쳐도 접시 위로) */
const PAN_SLOP = 16;

type Where = 'pan' | 'floor';

/** 화면 글. x 를 담는 그릇은 단원마다 커피·공책·구슬이라 이름 대신 'x' 로, 동전은 돈이 아니면 '추'로 */
const words = (p: BalanceParams) => ({ coin: p.unit === '원' ? '동전' : '추' });
const lockSay = (p: BalanceParams, lock: NonNullable<Item['lock']>) =>
  ({
    cup: 'x 는 무게를 몰라 하나씩은 못 내려요. 왼쪽에 x 만 남고 수평이면 나눠서 내릴 수 있어요.',
    last: 'x 하나는 남겨 둬요. x 하나의 값을 찾는 저울이에요.',
    split: `묶음을 모두 접시에 올린 뒤에 낱개 ${words(p).coin}을 되돌릴 수 있어요.`,
  })[lock];
/** 옮기려다 아무 일도 안 일어났을 때 안내 */
const MISS_SAY = {
  pan: '접시 밖으로 끌어 놓으면 내려가요.',
  floor: '같은 쪽 접시 위로 끌어 놓으면 올라가요.',
};
/** 단원 글이 짚지 않은 상태에서의 안내 */
const plain = (h: -1 | 0 | 1) =>
  h === 0
    ? '수평이에요. 양쪽 무게가 같아요.'
    : `${h > 0 ? '왼쪽' : '오른쪽'}이 더 무거워 내려갔어요.`;

function Cup({ atom }: { atom: string }) {
  return (
    <span className="cup" data-atom={atom}>
      <svg viewBox="0 0 34 38" aria-hidden="true">
        <path d="M3 6h22l-2.4 26a4 4 0 0 1-4 3.6H9.4a4 4 0 0 1-4-3.6z" fill="var(--primary)" />
        <path
          d="M25 11h3.5a4.5 4.5 0 0 1 0 9H24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
        />
        <rect x="1" y="3" width="26" height="5" rx="2.5" fill="var(--ink)" />
      </svg>
      <span>x</span>
    </span>
  );
}

/** 지금 화면에 있는 낱개(동전·컵)의 자리. 상태가 바뀐 뒤 낱개마다 옛 자리에서 날려 보내려고 잰다 */
function atomRects(host: ParentNode | null | undefined): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  for (const el of host?.querySelectorAll<HTMLElement>('[data-atom]') ?? [])
    m.set(el.dataset.atom as string, el.getBoundingClientRect());
  return m;
}

/** 끄는 중 표시(data-)를 이 저울 안에서만 지운다 */
function clearLift(host: Element | null | undefined) {
  for (const h of host?.querySelectorAll<HTMLElement>('[data-lift],[data-dragging]') ?? []) {
    delete h.dataset.lift;
    delete h.dataset.dragging;
  }
}

interface PieceProps {
  item: Item;
  side: 'l' | 'r';
  at: Where;
  label: string;
  /** 부품 안에서 지금 끄는 물건이 있나(동시 끌기 1개) */
  busy: RefObject<boolean>;
  onDrop(item: Item, side: 'l' | 'r', at: Where, el: HTMLElement, dx: number, dy: number): void;
  onKey(item: Item, side: 'l' | 'r', at: Where, e: KeyboardEvent): void;
  onActivate(item: Item, side: 'l' | 'r', at: Where): void;
}

/** 끄는 물건 하나. 물건마다 useDrag 를 붙이려고 컴포넌트로 뺐다(훅은 반복문에서 못 부른다) */
function Piece({ item, side, at, label, busy, onDrop, onKey, onActivate }: PieceProps) {
  const ref = useRef<HTMLButtonElement>(null);
  /** 이 물건이 끌기를 잡았을 때 그 요소. 끄는 도중 물건이 사라져도(ref 가 비어도) 정리할 수 있게 쥐어 둔다 */
  const held = useRef<HTMLElement | null>(null);
  useDrag(ref, {
    pick: () => !busy.current,
    onStart() {
      const el = ref.current;
      if (!el) return;
      busy.current = true;
      held.current = el;
      for (const a of el.getAnimations({ subtree: true })) a.cancel();
      // 끄는 물건이 다른 접시·바닥 아래로 숨지 않게 그 물건이 든 칸을 위로 올린다(속성은 data- 로 —
      // className 을 직접 고치면 React 가 다시 그릴 때 지워진다)
      el.dataset.dragging = '';
      for (const h of [
        el.closest<HTMLElement>('.pan'),
        el.closest<HTMLElement>('.scale, .bal-floor'),
      ])
        if (h) h.dataset.lift = '';
    },
    onMove(dx, dy) {
      const el = held.current;
      if (!el) return;
      // 옮길 수 없는 물건은 살짝만 따라와 '걸려 있다'는 느낌만 준다
      const k = item.can ? 1 : 0.15;
      el.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    },
    onEnd(dx, dy, cancelled) {
      const el = held.current;
      held.current = null;
      // 잠금은 요소가 남아 있든 없든 먼저 푼다 — 끄는 도중 물건이 사라지면 ref 는 이미 비어 있다
      if (!el) return;
      busy.current = false;
      clearLift(el.closest('.bal'));
      if (cancelled || !el.isConnected) {
        el.style.transform = '';
        return;
      }
      onDrop(item, side, at, el, dx, dy);
    },
  });
  return (
    <button
      ref={ref}
      type="button"
      data-key={item.key}
      className={`bal-piece is-${item.kind}${item.bundle ? ' bundle' : ''}${item.can ? '' : ' locked'}`}
      aria-label={label}
      onKeyDown={(e) => onKey(item, side, at, e)}
      // 손가락·펜 끌기와 누르기는 useDrag 가 맡는다. 여기서는 키보드(Enter·Space)와 화면 낭독기의 '누르기'
      // (detail 0)만 받는다 — 끌고 난 뒤 따라오는 click 으로 한 번 더 옮겨지지 않게.
      onClick={(e: MouseEvent) => {
        if (e.detail === 0) onActivate(item, side, at);
      }}
    >
      {item.kind === 'cup' ? (
        <Cup atom={item.key} />
      ) : (
        item.atoms.map((a) => <i key={a} className="coin" data-atom={a} />)
      )}
    </button>
  );
}

type Msg = { text: string; vars: Record<string, string>; cls: '' | 'ok' };

export function Balance({ params: p, onDone, onMiss }: WidgetProps<BalanceParams>) {
  // 한쪽만 내린 상태는 실수가 아니라 과정이다 — 틀린 시도(onMiss)로 세지 않고, 저절로 되돌리지도 않는다.
  // 틀린 시도로 세는 것은 '실제로 끌었는데 아무 일도 안 일어난 끌기'뿐이다(항 끌기 부품과 같은 기준) —
  // 누르기는 '눌러서 옮기기'만 켠다.
  const fresh = useCallback(() => {
    const b = board0(p);
    return {
      b,
      guide: guide0(p),
      msg: { text: p.intro, vars: view(p, b.s).vars, cls: '' } as Msg,
    };
  }, [p]);
  const [g, setG] = useState(fresh);
  const [fails, setFails] = useState(0);
  const tapMode = fails >= FAILS_FOR_TAP;
  const busy = useRef(false);
  const pans = { l: useRef<HTMLDivElement>(null), r: useRef<HTMLDivElement>(null) };
  const root = useRef<HTMLDivElement>(null);
  /** 상태가 바뀐 뒤 낱개마다 날아가기 시작할 옛 자리와, 키보드로 옮겼을 때 다시 잡을 초점 */
  const fly = useRef<Map<string, DOMRect> | null>(null);
  const focusKey = useRef<string | null>(null);
  const gRef = useRef(g);
  gRef.current = g;

  // 부품이 사라질 때 끄는 중 표시가 남지 않게(저울 밖의 칸에는 손대지 않는다)
  useEffect(() => {
    const host = root.current;
    return () => {
      busy.current = false;
      clearLift(host);
    };
  }, []);

  useLayoutEffect(() => {
    const host = root.current;
    const old = fly.current;
    fly.current = null;
    if (host && old)
      // 낱개(동전·컵)마다 옛 자리에서 새 자리로 — 옮긴 물건은 놓은 자리에서, 묶음으로 묶이거나 풀린 동전은
      // 원래 있던 자리에서 묶음 자리로 옮겨 간다. 자리가 그대로인 것은 움직이지 않는다
      for (const el of host.querySelectorAll<HTMLElement>('[data-atom]')) {
        const r = old.get(el.dataset.atom as string);
        if (r) flyFrom(el, r, { duration: FLY_MS });
      }
    if (host && focusKey.current) {
      host.querySelector<HTMLElement>(`[data-key="${focusKey.current}"]`)?.focus();
      focusKey.current = null;
    }
  });

  /** 옮긴 배치를 반영한다. dropped = 끌어 놓은 물건의 낱개 자리(놓은 그 자리에서 날아가게) */
  const commit = (next: Board, dropped?: Map<string, DOMRect>) => {
    const { guide } = gRef.current;
    const rects = atomRects(root.current);
    for (const [k, r] of dropped ?? []) rects.set(k, r);
    fly.current = rects;
    const v = view(p, next.s);
    const t = talk(p, guide, next.s);
    setG({
      b: next,
      guide: t.guide,
      msg: t.say
        ? { text: t.say.text, vars: v.vars, cls: t.say.tone }
        : { text: plain(heavier(p, next.s)), vars: v.vars, cls: '' },
    });
    if (v.solved) onDone();
  };

  const say = (text: string) => setG((x) => ({ ...x, msg: { text, vars: {}, cls: '' } }));

  /** 이 물건을 반대쪽(접시↔바닥)으로 — 누르기·키보드·화면 낭독기용. 옮겼으면 새 배치 */
  const toggle = (item: Item): Board | null => {
    if (busy.current) return null;
    if (!item.can) {
      if (item.lock) say(lockSay(p, item.lock));
      return null;
    }
    const n = moveItem(p, gRef.current.b, item.key);
    if (n) commit(n);
    return n;
  };

  /** 키보드로 옮긴 뒤 초점: 같은 접시(또는 바닥)에 남은 물건, 없으면 옮긴 그 물건 */
  const refocus = (n: Board, item: Item, side: 'l' | 'r', at: Where) => {
    focusKey.current = n[at][side][0] ?? item.key;
  };

  const onActivate = (item: Item, side: 'l' | 'r', at: Where) => {
    const n = toggle(item);
    if (n) refocus(n, item, side, at);
  };

  const onKey = (item: Item, side: 'l' | 'r', at: Where, e: KeyboardEvent) => {
    const want = e.key === 'ArrowDown' ? 'pan' : e.key === 'ArrowUp' ? 'floor' : null;
    if (!want) return;
    e.preventDefault();
    // 아래 = 접시에서 내리기, 위 = 바닥에서 올리기. 반대 방향 키는 무시
    if (want === at) onActivate(item, side, at);
  };

  const onDrop = (
    item: Item,
    side: 'l' | 'r',
    at: Where,
    el: HTMLElement,
    dx: number,
    dy: number,
  ) => {
    const rect = el.getBoundingClientRect();
    const dropped = atomRects(el);
    el.style.transform = '';
    const back = () => flyFrom(el, rect, { duration: FLY_MS });
    const tap = Math.hypot(dx, dy) < TAP_PX;
    if (!item.can) {
      back();
      if (item.lock) say(lockSay(p, item.lock));
      return;
    }
    if (tap) {
      // 누르기는 끌기를 못 하는 사람의 신호로 본다(틀린 시도는 아님). '눌러서 옮기기'가 켜진 뒤에는 누르면 옮긴다
      if (tapMode) toggle(item);
      else {
        setFails((f) => f + 1);
        say(MISS_SAY[at]);
      }
      return;
    }
    // 놓은 자리: 접시 상자(조금 넓혀서) 안이면 그 접시 위, 어느 접시에도 안 걸리면 바닥
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const over = (['l', 'r'] as const).find((sd) => {
      const b = pans[sd].current?.getBoundingClientRect();
      return (
        !!b &&
        cx >= b.left - PAN_SLOP &&
        cx <= b.right + PAN_SLOP &&
        cy >= b.top - PAN_SLOP &&
        cy <= b.bottom + PAN_SLOP
      );
    });
    const ok = at === 'pan' ? over === undefined : over === side;
    const n = ok ? moveItem(p, gRef.current.b, item.key) : null;
    if (!n) {
      back();
      setFails((f) => f + 1);
      onMiss();
      say(MISS_SAY[at]);
      return;
    }
    commit(n, dropped);
  };

  const reset = () => {
    busy.current = false;
    clearLift(root.current);
    fly.current = atomRects(root.current);
    setG(fresh());
  };

  const { b, msg } = g;
  const v = view(p, b.s);
  const deg = tiltDeg(p, b.s);
  // 막대가 deg 만큼 돌면 끈이 걸린 자리는 ARM × sin(deg) 만큼 오르내린다. 왼쪽은 반대로
  const drop = Math.sin((deg * Math.PI) / 180) * (ARM / VIEW_W) * 100;
  const lay = layout(p, b);
  const w = words(p);
  // 접시 아래 동전 합계. 동전이 많아도 세지 않고 읽을 수 있게(컵은 값을 모르니 뺀다)
  const money = (n: number) => formatValue(String(n * coinOf(p)), { unit: p.unit });
  const name = (item: Item, side: 'l' | 'r', at: Where) => {
    const where = `${side === 'l' ? '왼쪽' : '오른쪽'} ${at === 'pan' ? '접시' : '바닥'}`;
    const what =
      item.kind === 'cup' ? 'x' : item.bundle ? `${w.coin} ${item.atoms.length}개 묶음` : w.coin;
    const how = !item.can
      ? ', 지금은 옮길 수 없음'
      : at === 'pan'
        ? ', 아래 방향키나 Enter 로 내리기'
        : ', 위 방향키나 Enter 로 올리기';
    return `${where}의 ${what}${how}`;
  };
  const pieces = (items: Item[], side: 'l' | 'r', at: Where) =>
    items.map((it) => (
      <Piece
        key={it.key}
        item={it}
        side={side}
        at={at}
        label={name(it, side, at)}
        busy={busy}
        onDrop={onDrop}
        onKey={onKey}
        onActivate={onActivate}
      />
    ));
  /** 낱개 동전만 놓인 접시는 줄마다 고르게(13개면 7·6) — 한 줄만 길고 맨 위에 하나 떠 있지 않게 */
  const cols = (items: Item[]) => {
    if (!items.length || items.some((i) => i.kind !== 'coin' || i.bundle)) return undefined;
    const rows = Math.ceil(items.length / ROW_MAX);
    return { '--cols': Math.ceil(items.length / rows) } as CSSProperties;
  };
  return (
    <div className="bal" ref={root}>
      <div className="scale">
        <svg viewBox="0 0 380 230" aria-hidden="true">
          <path d="M190 52 L190 214" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
          <rect x="130" y="210" width="120" height="12" rx="6" fill="var(--ink)" />
          <g className="beam" style={{ transform: `rotate(${deg}deg)` }}>
            <rect x="40" y="47" width="300" height="10" rx="5" fill="var(--ink)" />
          </g>
          <circle cx="190" cy="52" r="10" fill="var(--primary)" />
        </svg>
        <div className="pan l" ref={pans.l} style={{ transform: `translateY(${-drop}cqw)` }}>
          <div className="hang" />
          <div className="items" style={cols(lay.pan.l)}>
            {pieces(lay.pan.l, 'l', 'pan')}
          </div>
          <div className="plate" />
          <div className="pan-sum num">{b.s.l > 0 && money(b.s.l)}</div>
        </div>
        <div className="pan r" ref={pans.r} style={{ transform: `translateY(${drop}cqw)` }}>
          <div className="hang" />
          <div className="items" style={cols(lay.pan.r)}>
            {pieces(lay.pan.r, 'r', 'pan')}
          </div>
          <div className="plate" />
          <div className="pan-sum num">{b.s.r > 0 && money(b.s.r)}</div>
        </div>
      </div>
      <div className="bal-floor">
        <div className="bal-tray">{pieces(lay.floor.l, 'l', 'floor')}</div>
        <div className="bal-tray">{pieces(lay.floor.r, 'r', 'floor')}</div>
      </div>
      <div aria-live="polite">
        <Tex tex={v.tex} className={`scale-eq${v.level ? '' : ' ne'}`} />
      </div>
      <div className={`toast ${msg.cls}`} aria-live="polite">
        <LRich inline src={msg.text} vars={msg.vars} />
      </div>
      {tapMode && (
        <p className="bal-hint">
          끌기가 어려우면 눌러도 돼요. 접시 위 물건을 누르면 내려가고, 바닥의 물건을 누르면
          올라가요.
        </p>
      )}
      <button type="button" className="lbtn quiet" onClick={reset}>
        처음부터 다시
      </button>
    </div>
  );
}
