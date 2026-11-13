// 확률 실험 화면. 던지기 버튼(1·10·100번)으로만 다룬다(끌기 없음). 막대 = 나온 비율, 점선 = 이론값.
// 막대 높이 축척은 이론값에서 정해 고정한다 — 던질 때마다 축척이 바뀌면 막대가 이론값에 다가가는 모습이 안 보인다.
import { useRef, useState } from 'react';
import { makeRng } from '../../generators/rng.ts';
import type { WidgetProps } from './index.tsx';
import { type SimParams, type SimState, simBars, simInit, simRun } from './simulate.ts';

const W = 320;
const H = 190;
const X0 = 34;
const TOP = 16;
const BASE = 150;

export function Simulate({ params: p, onDone }: WidgetProps<SimParams>) {
  const [s, setS] = useState<SimState>(() => simInit(p));
  const resets = useRef(0);
  const rng = useRef(makeRng(p.seed));
  const done = useRef(false);
  const bars = simBars(p, s);
  const ymax = Math.min(1, Math.ceil(Math.max(...bars.map((b) => b.theory)) * 2 * 10) / 10);
  const bw = (W - X0 - 8) / bars.length;
  const y = (v: number) => BASE - (Math.min(v, ymax) / ymax) * (BASE - TOP);
  const run = (times: number) => {
    const n = simRun(p, s, rng.current, times);
    setS(n);
    if (!done.current && n.trials >= p.goal) {
      done.current = true;
      onDone();
    }
  };
  const reset = () => {
    resets.current += 1;
    rng.current = makeRng(p.seed + resets.current * 7919);
    setS(simInit(p));
  };
  const what = p.device === 'coin' ? '동전' : p.device === 'die' ? '주사위' : '공';
  return (
    <div className="wgt sim">
      <svg viewBox={`0 0 ${W} ${H}`} className="wgt-svg">
        <title>확률 실험 결과 막대그래프</title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={X0} y1={y(t * ymax)} x2={W - 6} y2={y(t * ymax)} className="sim-grid" />
            <text x={X0 - 16} y={y(t * ymax) + 4} className="sim-ax">
              {Math.round(t * ymax * 100)}%
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = X0 + i * bw + bw * 0.15;
          const w = bw * 0.7;
          return (
            <g key={b.label}>
              <rect x={x} y={y(b.freq)} width={w} height={BASE - y(b.freq)} className="sim-bar" />
              <line
                x1={x - 3}
                y1={y(b.theory)}
                x2={x + w + 3}
                y2={y(b.theory)}
                className="sim-theory"
              />
              <text x={x + w / 2} y={BASE + 18} className="sim-lab">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="wgt-read" aria-live="polite">
        <span className="num">던진 횟수 {s.trials}번</span>
        <span className="sim-legend">막대 = 나온 비율 · 점선 = 이론값</span>
      </div>
      <table className="sim-table">
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td className="num">{b.text}</td>
              <td className="num">이론 {b.theoryText}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="wgt-ctl">
        {[1, 10, 100].map((t) => (
          <button type="button" key={t} className="lbtn blue" onClick={() => run(t)}>
            {what} {t}번
          </button>
        ))}
        <button type="button" className="lbtn quiet wide" onClick={reset}>
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
