// 소인수분해 나무 화면(D3 시안 안 1). 나무 끝의 수를 누르고 숫자판에서 나눌 수를 누르면 갈라진다. 끌기가 없어
// 모든 조작이 단추라 Tab·Enter 로 그대로 된다(키보드 대체를 따로 두지 않는 까닭). 판정·글·자리는 모두
// factorTree.ts 가 정하고 여기서는 그리기만 한다.
//
// 쪼갤 때 새 마디가 부모 자리에서 미끄러져 나오고 기존 마디도 새 자리로 옮겨 간다(0.28초). React 는 마지막 자리를
// 한 번 그리고, 그 뒤 requestAnimationFrame 이 마디의 transform 과 가지(SVG 선)의 끝점만 직접 고친다 — 프레임마다
// 상태를 바꿔 다시 그리면 렌더가 애니메이션을 끊는다. 마디와 가지를 한 루프에서 같이 움직여야 선이 마디에서 떨어지지 않는다.
import { useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion, Tex } from '../ui.tsx';
import {
  type FactorTreeParams,
  type FtResult,
  ftDone,
  ftDoneMsg,
  ftHeight,
  ftInit,
  ftLayout,
  ftMoveFrom,
  ftNextLeaf,
  ftOrder,
  ftPad,
  ftPrime,
  ftRedoMsg,
  ftResult,
  ftSelect,
  ftSplit,
  ftStartMsg,
  josa,
  type Msg,
  type Step,
  TREE_W,
  type TState,
} from './factorTree.ts';
import type { WidgetProps } from './index.tsx';
import './factorTree.css';

const MOVE_MS = 280;
type Pt = { x: number; y: number };
/** 조작 뒤 키보드 포커스를 옮길 곳: 마디 번호, 또는 '다른 방법으로 다시' 단추 */
type FocusTo = number | 'redo';

export function FactorTree({ params: p, onDone, onMiss }: WidgetProps<FactorTreeParams>) {
  const [s, setS] = useState<TState>(() => ftInit(p));
  const [msg, setMsg] = useState<Msg>(ftStartMsg);
  const [say, setSay] = useState('');
  /** 처음 끝낸 나무. 다시 쪼갠 나무를 이것과 견준다 */
  const [prev, setPrev] = useState<FtResult | null>(null);
  /** 나무를 새로 시작한 횟수. 마디 key 에 넣어 옛 나무의 자리에서 미끄러져 나오지 않게 한다 */
  const [gen, setGen] = useState(0);
  const reached = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const redo = useRef<HTMLButtonElement>(null);
  /** 지금 화면에 보이는 마디 자리(나무 좌표). 움직이는 동안 프레임마다 고쳐 써서, 중간에 또 쪼개면 거기서 이어 간다 */
  const shown = useRef<{ gen: number; pos: Pt[] } | null>(null);
  const focusTo = useRef<FocusTo | null>(null);

  const done = ftDone(s);
  const pos = ftLayout(s);
  const h = ftHeight(p);
  const pad = ftPad(s);

  // 마디가 늘 때(쪼갬)와 새 나무일 때만 움직인다. 고르기·동그라미처럼 자리가 그대로인 다시 그리기에서는 돌던 움직임을
  // 끊지 않는다 — 의존값 없이 매번 돌면 0.28초 안에 다시 그릴 때 정리 함수가 움직임을 멈춰 마디·가지가 중간에 굳었다
  // biome-ignore lint/correctness/useExhaustiveDependencies: pos·s 는 nodes.length·gen 이 같으면 자리가 같다(의도한 의존값)
  useLayoutEffect(() => {
    const last = shown.current?.gen === gen ? shown.current.pos : null;
    const from = reducedMotion() ? null : ftMoveFrom(last, s);
    const cur = { gen, pos: from ? [...from] : pos };
    shown.current = cur;
    const el = box.current;
    if (!el || !from || from.every((f, i) => f.x === pos[i]?.x && f.y === pos[i]?.y)) {
      cur.pos = pos;
      return;
    }
    const nodes = [...el.querySelectorAll<HTMLElement>('[data-nd]')];
    const lines = [...el.querySelectorAll<SVGLineElement>('[data-edge]')];
    // 마디 자리는 상자 폭에 대한 비율이라, 화면 px 로 옮길 때 실제 폭 / TREE_W 를 곱한다
    const k = el.clientWidth / TREE_W;
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const u = Math.min(1, (t - t0) / MOVE_MS);
      const e = 1 - (1 - u) ** 3;
      cur.pos = pos.map((to, i) => {
        const f = from[i] as Pt;
        return { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e };
      });
      for (const nd of nodes) {
        const i = Number(nd.dataset.nd);
        const c = cur.pos[i] as Pt;
        const to = pos[i] as Pt;
        nd.style.transform = u < 1 ? `translate(${(c.x - to.x) * k}px,${c.y - to.y}px)` : '';
      }
      for (const ln of lines) {
        const [a, b] = (ln.dataset.edge as string).split('-').map(Number) as [number, number];
        const pa = cur.pos[a] as Pt;
        const pb = cur.pos[b] as Pt;
        ln.setAttribute('x1', String(pa.x));
        ln.setAttribute('y1', String(pa.y));
        ln.setAttribute('x2', String(pb.x));
        ln.setAttribute('y2', String(pb.y));
      }
      if (u < 1) raf = requestAnimationFrame(frame);
    };
    // 첫 프레임은 지금 바로 — 새로 그린 끝 자리가 한 번이라도 화면에 찍히지 않게
    frame(t0);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [gen, s.nodes.length]);

  // 누른 단추가 꺼지거나(숫자판) 사라지면(다 끝남) 키보드 포커스가 문서 밖으로 빠진다 — 다음에 누를 곳으로 옮긴다
  useLayoutEffect(() => {
    const to = focusTo.current;
    focusTo.current = null;
    if (to === null) return;
    const el =
      to === 'redo' ? redo.current : box.current?.querySelector<HTMLElement>(`[data-nd="${to}"]`);
    el?.focus({ preventScroll: true });
  });

  /** 포커스가 이 부품 안에 있을 때만(키보드로 조작 중) 옮긴다. 손가락·마우스로 누른 사람의 화면은 건드리지 않는다 */
  const moveFocus = (to: FocusTo | null) => {
    if (to !== null && root.current?.contains(document.activeElement)) focusTo.current = to;
  };

  const apply = (r: Step, kind: 'select' | 'split' | 'prime') => {
    if (!r.ok && r.msg.cls === 'bad') onMiss();
    if (r.say) setSay(r.say);
    if (r.ok && kind === 'split') moveFocus(r.s.nodes.length - 2);
    if (r.ok && kind === 'prime' && s.sel !== null) moveFocus(ftNextLeaf(r.s, s.sel) ?? 'redo');
    if (r.ok && ftDone(r.s) && !ftDone(s)) {
      const res = ftResult(r.s);
      setS(r.s);
      setMsg(ftDoneMsg(res, prev));
      setSay(res.say);
      if (!prev) setPrev(res);
      if (!reached.current) {
        reached.current = true;
        onDone();
      }
      return;
    }
    setS(r.s);
    setMsg(r.msg);
  };

  /** 새 나무. 처음 끝낸 나무(prev)는 남긴다 — 두 번째 나무 도중에 처음부터 다시 해도 견줄 나무가 있어야 한다 */
  const restart = (text: string) => {
    moveFocus(0);
    setS(ftInit(p));
    setGen((g) => g + 1);
    setMsg({ text, cls: '' });
    setSay('');
  };

  const res = done ? ftResult(s) : null;

  return (
    <div className="wgt ft" ref={root}>
      <div className="ft-tree" ref={box} style={{ height: h }}>
        <svg
          className="ft-edges"
          viewBox={`0 0 ${TREE_W} ${h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {s.nodes.flatMap((x, i) =>
            (x.kids ?? []).map((c) => (
              <line
                // biome-ignore lint/suspicious/noArrayIndexKey: 마디 번호가 곧 id — 마디는 지우지 않고 늘기만 한다
                key={`${gen}:${i}-${c}`}
                data-edge={`${i}-${c}`}
                x1={pos[i]?.x}
                y1={pos[i]?.y}
                x2={pos[c]?.x}
                y2={pos[c]?.y}
              />
            )),
          )}
        </svg>
        {/* 화면 낭독기·Tab 은 위층부터, 같은 층은 왼쪽부터 읽게 마디를 자리 순으로 놓는다(만든 순서가 아니라) */}
        {ftOrder(s).map((i) => {
          const x = s.nodes[i] as TState['nodes'][number];
          const at = pos[i] as Pt;
          const kids = x.kids?.map((c) => s.nodes[c]?.n as number);
          const leaf = !x.kids && !x.prime;
          return (
            <button
              type="button"
              key={`${gen}:${i}`}
              data-nd={i}
              className={`ft-nd${x.kids ? ' ft-split' : x.prime ? ' ft-pr' : ''}${s.sel === i ? ' ft-sel' : ''}`}
              style={{ left: `${(at.x / TREE_W) * 100}%`, top: at.y }}
              aria-pressed={leaf ? s.sel === i : undefined}
              aria-label={
                kids
                  ? `${x.n}, ${kids[0]} 곱하기 ${kids[1]} ${josa(kids[1] as number, '으로')} 쪼갬`
                  : x.prime
                    ? `${x.n}, 소수`
                    : `${x.n}, 아직 쪼갤 수 있는지 모름`
              }
              disabled={done}
              onClick={() => apply(ftSelect(s, i), 'select')}
            >
              {x.n}
            </button>
          );
        })}
      </div>
      {res ? (
        <>
          <div className="ft-res">
            <Tex tex={res.flatTex} />
            <br />
            <Tex tex={res.powTex} />
          </div>
          <button
            type="button"
            className="lbtn ft-redo"
            ref={redo}
            onClick={() => restart(ftRedoMsg(p, prev ? [res, prev] : [res]))}
          >
            다른 방법으로 다시 쪼개기
          </button>
        </>
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: 숫자판은 단추 묶음이라 fieldset(양식)이 아니다 — 시안과 같은 group
        <div className="ft-pad" role="group" aria-label="나눌 수">
          {pad.digits.map((d) => (
            <button
              type="button"
              key={d}
              disabled={!pad.enabled}
              onClick={() => apply(ftSplit(s, d), 'split')}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className="ft-pr"
            disabled={!pad.enabled}
            onClick={() => apply(ftPrime(s), 'prime')}
          >
            소수예요
          </button>
        </div>
      )}
      {/* 처음부터 다시는 나무 오른쪽 위에 보이지만 Tab 순서는 맨 뒤 — 나무·숫자판을 다 지나서 만나게 */}
      <button
        type="button"
        className="ft-reset"
        aria-label="처음부터 다시"
        onClick={() => restart(ftStartMsg().text)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      </button>
      <div className={`toast ${msg.cls}`} aria-live="polite">
        {msg.text}
      </div>
      <div className="ft-sr" aria-live="polite">
        {say}
      </div>
    </div>
  );
}
