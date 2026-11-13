// 경우의 수 화면. 끌기 없이 누르기로만 다룬다(고르는 일은 탭이 맞다 — 끌기는 옮기면 뜻이 바뀌는 것에만).
// 상태 → 보일 것은 count.ts 가 정하고(경우 키·라벨·수형도·파스칼 수·벤 영역), 여기서는 그리기만 한다.
import { useId, useRef, useState } from 'react';
import {
  type CountParams,
  type CState,
  cDone,
  cInit,
  cLabel,
  cPascal,
  cTap,
  cTotal,
  cTree,
  cVenn,
} from './count.ts';
import type { WidgetProps } from './index.tsx';

type Msg = { text: string; cls: '' | 'ok' | 'bad' };

export function Count({ params: p, onDone, onMiss }: WidgetProps<CountParams>) {
  const [s, setS] = useState<CState>(() => cInit(p));
  const [msg, setMsg] = useState<Msg>({ text: '', cls: '' });
  const done = useRef(false);
  const settle = (n: CState) => {
    setS(n);
    if (!done.current && cDone(p, n)) {
      done.current = true;
      onDone();
    }
  };
  const body =
    p.mode === 'pascal' ? (
      <Pascal p={p} s={s} settle={settle} say={setMsg} />
    ) : p.mode === 'venn' ? (
      <Venn p={p} s={s} settle={settle} />
    ) : p.mode === 'tree' ? (
      <Tree p={p} s={s} settle={settle} />
    ) : (
      <Lister p={p} s={s} settle={settle} say={setMsg} onMiss={onMiss} />
    );
  return (
    <div className="wgt ct">
      {body}
      <div className={`toast ${msg.cls}`} aria-live="polite">
        {msg.text}
      </div>
    </div>
  );
}

type Part = { p: CountParams; s: CState; settle(n: CState): void };

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

function Venn({ p, s, settle }: Part) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sets = p.sets as NonNullable<CountParams['sets']>;
  const v = cVenn(p);
  const A = { cx: 120, cy: 100, r: 78 };
  const B = { cx: 200, cy: 100, r: 78 };
  const regions = [
    ['a', `${sets.names[0]}에만`, v.only.a],
    ['ab', '둘 다', v.both],
    ['b', `${sets.names[1]}에만`, v.only.b],
  ] as const;
  const place = (xs: readonly string[], cx: number) =>
    xs.map((x, i) => (
      <text key={x} x={cx} y={100 - ((xs.length - 1) * 18) / 2 + i * 18 + 5} className="ct-vel">
        {x}
      </text>
    ));
  const nA = sets.a.length;
  const nB = sets.b.length;
  return (
    <>
      <svg viewBox="0 0 320 200" className="wgt-svg ct-venn">
        <title>벤 다이어그램</title>
        <defs>
          <clipPath id={`ca${id}`}>
            <circle {...A} />
          </clipPath>
          <mask id={`nb${id}`}>
            <rect width="320" height="200" fill="white" />
            <circle {...B} fill="black" />
          </mask>
          <mask id={`na${id}`}>
            <rect width="320" height="200" fill="white" />
            <circle {...A} fill="black" />
          </mask>
        </defs>
        <circle
          {...A}
          mask={`url(#nb${id})`}
          className={`ct-reg${s.region === 'a' ? ' on' : ''}`}
        />
        <circle
          {...B}
          mask={`url(#na${id})`}
          className={`ct-reg${s.region === 'b' ? ' on' : ''}`}
        />
        <circle
          {...B}
          clipPath={`url(#ca${id})`}
          className={`ct-reg${s.region === 'ab' ? ' on' : ''}`}
        />
        <circle {...A} className="ct-ring" />
        <circle {...B} className="ct-ring" />
        <text x={A.cx - 50} y={20} className="ct-vname">
          {sets.names[0]}
        </text>
        <text x={B.cx + 50} y={20} className="ct-vname">
          {sets.names[1]}
        </text>
        {place(v.only.a, 88)}
        {place(v.both, 160)}
        {place(v.only.b, 232)}
      </svg>
      <div className="wgt-ctl">
        {regions.map(([k, name]) => (
          <button
            type="button"
            key={k}
            className={`lbtn soft${s.region === k ? ' blue' : ''}`}
            aria-pressed={s.region === k}
            onClick={() => settle({ ...s, region: k })}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="wgt-read" aria-live="polite">
        {s.region && (
          <span className="num">
            {regions.find((r) => r[0] === s.region)?.[1]}:{' '}
            {regions.find((r) => r[0] === s.region)?.[2].length}개
          </span>
        )}
        {s.region === 'ab' && (
          <span className="num">
            둘 중 하나라도: {nA} + {nB} − {v.both.length} = {v.union}개
          </span>
        )}
      </div>
    </>
  );
}
