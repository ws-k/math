// 저울 화면. 접시 위 물건(컵·동전·묶음)을 손으로 끌어 바닥에 내리고 다시 올린다.
// 무엇이 어디에 있고 무엇을 옮길 수 있는지, 얼마나 기우는지는 balance.ts(layout·move·tiltDeg)가 정하고
// 여기서는 그리기와 손 처리만 한다. 끄는 동안은 useDrag 가 프레임마다 부르는 onMove 에서 그 물건의
// transform 만 직접 고친다(React 렌더 0회). 손을 떼면 놓인 자리로 결과를 한 번 정하고 상태를 바꾼다 —
// 그때 막대 기울기는 CSS 전환으로 움직인다(매 프레임 계산이 필요 없는 움직임이라).
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { formatValue } from '../format.ts';
import { LRich, reducedMotion, Tex } from '../ui.tsx';
import { useDrag } from '../useDrag.ts';
import {
  type BalanceParams,
  type BalanceState,
  coinOf,
  heavier,
  type Item,
  initial,
  layout,
  type Move,
  move,
  talk,
  tiltDeg,
  view,
} from './balance.ts';
import type { WidgetProps } from './index.tsx';

/** 이만큼 못 움직였으면 끌기가 아니라 누르기로 본다 */
const TAP_PX = 8;
/** 끌기를 이만큼 놓치면(옮기려다 아무 일도 안 일어남) '눌러서 옮기기'를 켠다. 재생기의 '넘어가기' 기준과 같다 */
const FAILS_FOR_TAP = 2;
/**
 * 받침점에서 접시 끈이 걸린 자리까지 거리(viewBox 단위)와 그림 폭. 접시(폭 48%)의 가운데는 그림 폭의
 * 24% 자리라 받침점(190)에서 190 − 0.24 × 380 만큼 떨어져 있다 — 막대 끝(150)으로 계산하면 끈이 막대를 뚫는다.
 */
const VIEW_W = 380;
const ARM = 190 - 0.24 * VIEW_W;
/** 옮긴 물건이 새 자리로 날아가는 시간 */
const FLY_MS = 260;

/** 옮길 수 없는 물건을 만졌을 때 안내(화면 글) */
const LOCK_SAY: Record<NonNullable<Item['lock']>, string> = {
  cup: '컵은 무게를 몰라 하나씩은 못 내려요. 왼쪽에 컵만 남고 수평이면 나눠서 내릴 수 있어요.',
  last: '컵 하나는 남겨 둬요. 컵 하나의 값을 찾는 저울이에요.',
  split: '묶음을 모두 접시에 올린 뒤에 되돌릴 수 있어요.',
};
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

function Cup() {
  return (
    <span className="cup">
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

type Where = 'pan' | 'floor';

interface PieceProps {
  item: Item;
  side: 'l' | 'r';
  at: Where;
  label: string;
  /** 부품 안에서 지금 끄는 물건이 있나(동시 끌기 1개) */
  busy: RefObject<boolean>;
  onDrop(item: Item, side: 'l' | 'r', at: Where, el: HTMLElement, dx: number, dy: number): void;
  onKey(item: Item, e: KeyboardEvent): void;
}

/** 끄는 물건 하나. 물건마다 useDrag 를 붙이려고 컴포넌트로 뺐다(훅은 반복문에서 못 부른다) */
function Piece({ item, side, at, label, busy, onDrop, onKey }: PieceProps) {
  const ref = useRef<HTMLButtonElement>(null);
  /** 끌기를 잡은 건 이 물건인가(다른 물건이 끄는 중에 눌렸으면 무시) */
  const mine = useRef(false);
  useDrag(ref, {
    pick: () => !busy.current,
    onStart() {
      const el = ref.current;
      if (!el) return;
      busy.current = true;
      mine.current = true;
      for (const a of el.getAnimations()) a.cancel();
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
      const el = ref.current;
      if (!el || !mine.current) return;
      // 옮길 수 없는 물건은 살짝만 따라와 '걸려 있다'는 느낌만 준다
      const k = item.move ? 1 : 0.15;
      el.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    },
    onEnd(dx, dy, cancelled) {
      const el = ref.current;
      if (!el || !mine.current) return;
      mine.current = false;
      busy.current = false;
      delete el.dataset.dragging;
      for (const h of el.ownerDocument.querySelectorAll<HTMLElement>('[data-lift]'))
        delete h.dataset.lift;
      if (cancelled) {
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
      className={`bal-piece is-${item.kind}${item.n > 1 ? ' bundle' : ''}${item.move ? '' : ' locked'}`}
      aria-label={label}
      onKeyDown={(e) => onKey(item, e)}
    >
      {item.kind === 'cup' ? (
        <Cup />
      ) : (
        Array.from({ length: item.n }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 묶음 안 같은 모양 동전의 자리 번호
          <i key={i} className="coin" />
        ))
      )}
    </button>
  );
}

type Msg = { text: string; vars: Record<string, string>; cls: '' | 'ok' };

export function Balance({ params: p, onDone, onMiss }: WidgetProps<BalanceParams>) {
  // 한쪽만 내린 상태는 실수가 아니라 과정이다 — 틀린 시도(onMiss)로 세지 않고, 저절로 되돌리지도 않는다.
  // 틀린 시도로 세는 것은 '옮기려다 아무 일도 안 일어난 끌기'뿐이다(항 끌기 부품과 같은 기준) — 관문 장면에서
  // 끌기를 못 해 막힌 사람에게 '넘어가기'가 열리게.
  const [g, setG] = useState(() => {
    const s0 = initial(p);
    return {
      s: s0,
      /** 마지막으로 수평이던 상태. 단원 글(ops)이 짚은 조작인지 이것을 기준으로 본다 */
      anchor: s0,
      msg: { text: p.intro, vars: view(p, s0).vars, cls: '' } as Msg,
    };
  });
  const [fails, setFails] = useState(0);
  const tapMode = fails >= FAILS_FOR_TAP;
  const busy = useRef(false);
  const scale = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  /** 상태가 바뀐 뒤 새 자리에서 시작할 날아가기(옛 자리)와, 키보드로 옮겼을 때 다시 잡을 초점 */
  const fly = useRef<{ key: string; from: DOMRect }[]>([]);
  const focusKey = useRef<string | null>(null);
  const gRef = useRef(g);
  gRef.current = g;

  useLayoutEffect(() => {
    const host = root.current;
    const list = fly.current;
    fly.current = [];
    if (host && !reducedMotion())
      for (const f of list) {
        const el = host.querySelector<HTMLElement>(`[data-key="${f.key}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        el.animate(
          [
            { transform: `translate(${f.from.left - r.left}px,${f.from.top - r.top}px)` },
            { transform: 'none' },
          ],
          { duration: FLY_MS, easing: 'cubic-bezier(.3,.7,.3,1)' },
        );
      }
    if (host && focusKey.current) {
      host.querySelector<HTMLElement>(`[data-key="${focusKey.current}"]`)?.focus();
      focusKey.current = null;
    }
  });

  /** 옮긴 결과를 반영한다. from = 날아가기 시작할 자리(끌어 놓은 자리). 없으면 옮겨진 물건의 지금 자리 */
  const commit = useCallback(
    (next: BalanceState, from?: DOMRect) => {
      const { s, anchor } = gRef.current;
      const where = (st: BalanceState) => {
        const lay = layout(p, st);
        const m = new Map<string, string>();
        for (const [w, sides] of Object.entries(lay))
          for (const [side, items] of Object.entries(sides))
            for (const it of items as Item[]) m.set(it.key, `${w}${side}`);
        return m;
      };
      const before = where(s);
      const after = where(next);
      const moved = [...after.keys()].filter((k) => after.get(k) !== before.get(k));
      const host = root.current;
      fly.current = moved.flatMap((key) => {
        const r =
          from ?? host?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.getBoundingClientRect();
        return r ? [{ key, from: r }] : [];
      });
      const v = view(p, next);
      const t = talk(p, anchor, s, next);
      setG({
        s: next,
        anchor: v.level ? next : anchor,
        msg: t
          ? { text: t.text, vars: v.vars, cls: t.tone }
          : { text: plain(heavier(p, next)), vars: v.vars, cls: '' },
      });
      if (v.solved) onDone();
      return moved;
    },
    [p, onDone],
  );

  const say = (text: string) => setG((x) => ({ ...x, msg: { text, vars: {}, cls: '' } }));

  /** 이 물건을 반대쪽(접시↔바닥)으로 — 누르기·키보드용 */
  const toggle = (item: Item) => {
    if (!item.move) {
      if (item.lock) say(LOCK_SAY[item.lock]);
      return false;
    }
    const n = move(p, gRef.current.s, item.move);
    if (!n) return false;
    return commit(n);
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
    el.style.transform = '';
    const back = () => {
      if (!reducedMotion())
        el.animate(
          [
            {
              transform: `translate(${rect.left - el.getBoundingClientRect().left}px,${rect.top - el.getBoundingClientRect().top}px)`,
            },
            { transform: 'none' },
          ],
          { duration: FLY_MS, easing: 'cubic-bezier(.3,.7,.3,1)' },
        );
    };
    const tap = Math.hypot(dx, dy) < TAP_PX;
    if (!item.move) {
      back();
      if (item.lock) say(LOCK_SAY[item.lock]);
      return;
    }
    const miss = () => {
      setFails((f) => f + 1);
      onMiss();
      say(at === 'pan' ? MISS_SAY.pan : MISS_SAY.floor);
    };
    if (tap) {
      // 누르기는 끌기를 못 하는 사람의 신호로 본다. '눌러서 옮기기'가 켜진 뒤에는 누르면 옮긴다
      if (tapMode) toggle(item);
      else miss();
      return;
    }
    // 놓은 자리: 저울 그림의 왼쪽 반/오른쪽 반이면 그 접시 위, 그림 밖이면 바닥
    const box = scale.current?.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const inScale = !!box && cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom;
    const zone: 'l' | 'r' | 'out' =
      !box || !inScale ? 'out' : cx < box.left + box.width / 2 ? 'l' : 'r';
    const want: Move['dir'] | null =
      at === 'pan' ? (zone === 'out' ? 'off' : null) : zone === side ? 'on' : null;
    const n = want === item.move.dir ? move(p, gRef.current.s, item.move) : null;
    if (!n) {
      back();
      miss();
      return;
    }
    commit(n, rect);
  };

  const onKey = (item: Item, e: KeyboardEvent) => {
    const dir = e.key === 'ArrowDown' ? 'off' : e.key === 'ArrowUp' ? 'on' : null;
    const click = e.key === 'Enter' || e.key === ' ';
    if (!dir && !click) return;
    e.preventDefault();
    if (dir && item.move && item.move.dir !== dir) return;
    const moved = toggle(item);
    if (moved && moved.length > 0) focusKey.current = moved[0] ?? null;
  };

  const reset = () => {
    const s0 = initial(p);
    setG({ s: s0, anchor: s0, msg: { text: p.intro, vars: view(p, s0).vars, cls: '' } });
  };

  const { s, msg } = g;
  const v = view(p, s);
  const deg = tiltDeg(p, s);
  // 막대가 deg 만큼 돌면 끈이 걸린 자리는 ARM × sin(deg) 만큼 오르내린다. 왼쪽은 반대로
  const drop = Math.sin((deg * Math.PI) / 180) * (ARM / VIEW_W) * 100;
  const lay = layout(p, s);
  // 접시 아래 동전 합계. 동전이 많아도 세지 않고 읽을 수 있게(컵은 값을 모르니 뺀다)
  const money = (n: number) => formatValue(String(n * coinOf(p)), { unit: p.unit });
  const name = (item: Item, side: 'l' | 'r', at: Where) => {
    const where = `${side === 'l' ? '왼쪽' : '오른쪽'} ${at === 'pan' ? '접시' : '바닥'}`;
    const what = item.kind === 'cup' ? '컵 x' : item.n > 1 ? `동전 ${item.n}개 묶음` : '동전';
    const how = item.move ? (at === 'pan' ? ', 아래 방향키로 내리기' : ', 위 방향키로 올리기') : '';
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
      />
    ));
  return (
    <div className="bal" ref={root}>
      <div className="scale" ref={scale}>
        <svg viewBox="0 0 380 230" aria-hidden="true">
          <path d="M190 52 L190 214" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
          <rect x="130" y="210" width="120" height="12" rx="6" fill="var(--ink)" />
          <g className="beam" style={{ transform: `rotate(${deg}deg)` }}>
            <rect x="40" y="47" width="300" height="10" rx="5" fill="var(--ink)" />
          </g>
          <circle cx="190" cy="52" r="10" fill="var(--primary)" />
        </svg>
        <div className="pan l" style={{ transform: `translateY(${-drop}cqw)` }}>
          <div className="hang" />
          <div className="items">{pieces(lay.pan.l, 'l', 'pan')}</div>
          <div className="plate" />
          <div className="pan-sum num">{s.l > 0 && money(s.l)}</div>
        </div>
        <div className="pan r" style={{ transform: `translateY(${drop}cqw)` }}>
          <div className="hang" />
          <div className="items">{pieces(lay.pan.r, 'r', 'pan')}</div>
          <div className="plate" />
          <div className="pan-sum num">{s.r > 0 && money(s.r)}</div>
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
