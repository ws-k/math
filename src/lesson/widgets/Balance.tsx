// 저울 화면. 상태 → 그릴 것은 balance.ts(view) 가 정하고, 여기서는 그리기만 한다.
// 버튼으로만 바뀌는 부품이라 끌기가 없고, 상태가 바뀔 때만 다시 그린다.
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Rich } from '../../app/Rich.tsx';
import { fill, formatValue } from '../format.ts';
import { Tex } from '../ui.tsx';
import {
  apply,
  type BalanceOp,
  type BalanceParams,
  type BalanceState,
  enabled,
  initial,
  opLabel,
  view,
} from './balance.ts';
import type { WidgetProps } from './index.tsx';

/** 한쪽만 바꿔 기울인 뒤 되돌리기까지(미리보기와 같은 2.2초) */
const UNDO_MS = 2200;
/** 기울기 각도. 접시 높이 차는 저울 폭의 sin(각)·150/380 배 → cqw 로 */
const TILT_DEG = 9;
const PAN_CQW = Math.sin((TILT_DEG * Math.PI) / 180) * 100 * (150 / 380);

function Cup() {
  return (
    <div className="cup">
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
    </div>
  );
}

export function Balance({ params: p, onDone }: WidgetProps<BalanceParams>) {
  const [s, setS] = useState<BalanceState>(() => initial(p));
  const [msg, setMsg] = useState<{ text: string; cls: '' | 'ok' | 'bad' }>({
    text: p.intro,
    cls: '',
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = (o: BalanceOp) => {
    const n = apply(s, o);
    const v = view(n);
    setS(n);
    setMsg({ text: fill(o.say, v.vars), cls: o.side === 'both' ? 'ok' : 'bad' });
    if (v.solved) onDone();
    if (o.side !== 'both' && o.undo) {
      const before = s;
      const undo = o.undo;
      timer.current = setTimeout(() => {
        setS(before);
        setMsg({ text: fill(undo, view(before).vars), cls: '' });
      }, UNDO_MS);
    }
  };
  const reset = () => {
    clearTimeout(timer.current);
    setS(initial(p));
    setMsg({ text: p.intro, cls: '' });
  };

  const v = view(s);
  // 가벼워진 쪽이 올라간다. tilt -1 = 왼쪽이 올라감 → 막대는 시계 방향으로 돈다.
  const deg = -s.tilt * TILT_DEG;
  const panY = (dir: 1 | -1) => ({
    transform: `translateY(${dir * s.tilt * PAN_CQW}cqw)`,
  });
  const coin = (n: number) => formatValue(String(n), { unit: p.unit });
  const both = p.ops.filter((o) => o.side === 'both');
  const one = p.ops.filter((o) => o.side !== 'both');
  return (
    <>
      <div className="scale">
        <svg viewBox="0 0 380 230" aria-hidden="true">
          <path d="M190 52 L190 214" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
          <rect x="130" y="210" width="120" height="12" rx="6" fill="var(--ink)" />
          <g className="beam" style={{ transform: `rotate(${deg}deg)` }}>
            <rect x="40" y="47" width="300" height="10" rx="5" fill="var(--ink)" />
          </g>
          <circle cx="190" cy="52" r="10" fill="var(--primary)" />
        </svg>
        <div className="pan l" style={panY(1)}>
          <div className="hang" />
          <div className="items">
            {Array.from({ length: s.a }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 같은 모양 컵의 자리 번호
              <Cup key={i} />
            ))}
            {s.b > 0 && <div className="won num">{coin(s.b)}</div>}
          </div>
          <div className="plate" />
        </div>
        <div className="pan r" style={panY(-1)}>
          <div className="hang" />
          <div className="items">
            <div className="won num" key={s.c}>
              {coin(s.c)}
            </div>
          </div>
          <div className="plate" />
        </div>
      </div>
      <div aria-live="polite">
        <Tex tex={v.tex} className={`scale-eq${s.tilt ? ' ne' : ''}`} />
      </div>
      <div className={`toast ${msg.cls}`} aria-live="polite">
        <Rich inline emph src={msg.text} />
      </div>
      <div className="actions">
        <div className="row2" style={{ '--cols': both.length } as CSSProperties}>
          {both.map((o) => (
            <button
              type="button"
              key={opLabel(o)}
              className="lbtn blue"
              disabled={!enabled(s, o)}
              onClick={() => press(o)}
            >
              {opLabel(o)}
            </button>
          ))}
        </div>
        {one.map((o) => (
          <button
            type="button"
            key={opLabel(o)}
            className="lbtn redline"
            disabled={!enabled(s, o)}
            onClick={() => press(o)}
          >
            {opLabel(o)}
          </button>
        ))}
        <button type="button" className="lbtn quiet" onClick={reset}>
          처음부터 다시
        </button>
      </div>
    </>
  );
}
