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
  ftPad,
  ftPrime,
  ftRedoMsg,
  ftResult,
  ftSelect,
  ftSplit,
  ftStartMsg,
  type Msg,
  type Step,
  TREE_W,
  type TState,
} from './factorTree.ts';
import type { WidgetProps } from './index.tsx';
import './factorTree.css';

const MOVE_MS = 280;
type Pt = { x: number; y: number };

export function FactorTree({ params: p, onDone, onMiss }: WidgetProps<FactorTreeParams>) {
  const [s, setS] = useState<TState>(() => ftInit(p));
  const [msg, setMsg] = useState<Msg>(ftStartMsg);
  const [say, setSay] = useState('');
  /** 처음 끝낸 나무. 다시 쪼갠 나무를 이것과 견준다 */
  const [prev, setPrev] = useState<FtResult | null>(null);
  /** 나무를 새로 시작한 횟수. 마디 key 에 넣어 옛 나무의 자리에서 미끄러져 나오지 않게 한다 */
  const [gen, setGen] = useState(0);
  const reached = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  /** 지난번 그린 마디 자리(나무 좌표). 새로 그린 뒤 여기서부터 움직인다 */
  const shown = useRef<{ gen: number; pos: Pt[] } | null>(null);

  const done = ftDone(s);
  const pos = ftLayout(s);
  const h = ftHeight(p);
  const pad = ftPad(s);

  useLayoutEffect(() => {
    const old = shown.current;
    shown.current = { gen, pos };
    const el = box.current;
    if (!el || !old || old.gen !== gen || reducedMotion()) return;
    // 새 마디는 부모의 옛 자리에서 나온다(부모도 옛 자리가 없으면 제자리)
    const from = pos.map((to, i) => {
      if (old.pos[i]) return old.pos[i] as Pt;
      const par = s.nodes[i]?.parent;
      return (par != null && old.pos[par]) || to;
    });
    if (from.every((f, i) => f.x === pos[i]?.x && f.y === pos[i]?.y)) return;
    const nodes = [...el.querySelectorAll<HTMLElement>('[data-nd]')];
    const lines = [...el.querySelectorAll<SVGLineElement>('[data-edge]')];
    // 마디 자리는 상자 폭에 대한 비율이라, 화면 px 로 옮길 때 실제 폭 / TREE_W 를 곱한다
    const k = el.clientWidth / TREE_W;
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const u = Math.min(1, (t - t0) / MOVE_MS);
      const e = 1 - (1 - u) ** 3;
      const at = (i: number): Pt => {
        const f = from[i] as Pt;
        const to = pos[i] as Pt;
        return { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e };
      };
      for (const nd of nodes) {
        const i = Number(nd.dataset.nd);
        const c = at(i);
        const to = pos[i] as Pt;
        nd.style.transform = u < 1 ? `translate(${(c.x - to.x) * k}px,${c.y - to.y}px)` : '';
      }
      for (const ln of lines) {
        const [a, b] = (ln.dataset.edge as string).split('-').map(Number) as [number, number];
        const pa = at(a);
        const pb = at(b);
        ln.setAttribute('x1', String(pa.x));
        ln.setAttribute('y1', String(pa.y));
        ln.setAttribute('x2', String(pb.x));
        ln.setAttribute('y2', String(pb.y));
      }
      if (u < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  const apply = (r: Step) => {
    if (!r.ok && r.msg.cls === 'bad') onMiss();
    if (r.say) setSay(r.say);
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

  const restart = (keepPrev: boolean, text: string) => {
    if (!keepPrev) setPrev(null);
    setS(ftInit(p));
    setGen((g) => g + 1);
    setMsg({ text, cls: '' });
    setSay('');
  };

  const res = done ? ftResult(s) : null;
  // 화면 낭독기·Tab 은 위층부터, 같은 층은 왼쪽부터 읽게 마디를 자리 순으로 놓는다(만든 순서가 아니라)
  const order = s.nodes
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = pos[a] as Pt;
      const pb = pos[b] as Pt;
      return pa.y - pb.y || pa.x - pb.x;
    });

  return (
    <div className="wgt ft">
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
        <button
          type="button"
          className="ft-reset"
          aria-label="처음부터 다시"
          onClick={() => restart(false, ftStartMsg().text)}
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
        {order.map((i) => {
          const x = s.nodes[i] as TState['nodes'][number];
          const at = pos[i] as Pt;
          const kids = x.kids?.map((c) => s.nodes[c]?.n);
          const leaf = !x.kids && !x.prime;
          return (
            <button
              type="button"
              key={`${gen}:${i}`}
              data-nd={i}
              className={`ft-nd${x.kids ? ' split' : x.prime ? ' pr' : ''}${s.sel === i ? ' sel' : ''}`}
              style={{ left: `${(at.x / TREE_W) * 100}%`, top: at.y }}
              aria-pressed={leaf ? s.sel === i : undefined}
              aria-label={
                kids
                  ? `${x.n}, ${kids[0]} 곱하기 ${kids[1]} 로 쪼갬`
                  : x.prime
                    ? `${x.n}, 소수`
                    : `${x.n}, 아직 쪼갤 수 있는지 모름`
              }
              disabled={done}
              onClick={() => apply(ftSelect(s, i))}
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
            onClick={() => restart(true, ftRedoMsg(p, res))}
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
              onClick={() => apply(ftSplit(s, d))}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className="pr"
            disabled={!pad.enabled}
            onClick={() => apply(ftPrime(s))}
          >
            소수예요
          </button>
        </div>
      )}
      <div className={`toast ${msg.cls}`} aria-live="polite">
        {msg.text}
      </div>
      <div className="ft-sr" aria-live="polite">
        {say}
      </div>
    </div>
  );
}
