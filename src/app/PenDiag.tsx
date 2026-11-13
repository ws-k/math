// 펜 진단(설계 7-2). 실제 기기에서 오는 값을 보고 필기 굵기를 다듬으려고 둔다.
// 매 이벤트마다 React 를 다시 그리지 않도록 글자는 ref 로 직접 바꾼다.
import { useEffect, useRef } from 'react';
import { addSample, emptyStats, type PenStats } from './pendiag.ts';

const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : '-');

function format(s: PenStats): string {
  return [
    `pointerType   ${s.pointerType}`,
    `pressure      최소 ${f2(s.pressureMin)} · 최대 ${f2(s.pressureMax)}`,
    `tiltX / tiltY ${s.tiltX} / ${s.tiltY}`,
    `묶인 점 수     지금 ${s.coalescedLast} · 최대 ${s.coalescedMax} · 평균 ${s.coalescedAvg.toFixed(1)}`,
    `이벤트 수      ${s.events}`,
    `devicePixelRatio ${window.devicePixelRatio}`,
    `화면 크기      ${window.innerWidth} × ${window.innerHeight}`,
  ].join('\n');
}

export function PenDiag() {
  const pad = useRef<HTMLCanvasElement>(null);
  const out = useRef<HTMLPreElement>(null);
  const stats = useRef(emptyStats());

  useEffect(() => {
    const c = pad.current;
    const o = out.current;
    if (!c || !o) return;
    const ctx = c.getContext('2d');
    const fit = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * devicePixelRatio;
      c.height = r.height * devicePixelRatio;
      o.textContent = format(stats.current);
    };
    fit();
    let last: { x: number; y: number } | null = null;
    const sample = (e: PointerEvent) => {
      const list = e.getCoalescedEvents?.() ?? [];
      stats.current = addSample(stats.current, {
        pointerType: e.pointerType,
        pressure: e.pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        coalesced: Math.max(1, list.length),
      });
      o.textContent = format(stats.current);
      if (!ctx) return;
      const r = c.getBoundingClientRect();
      ctx.strokeStyle = e.pointerType === 'pen' ? '#1f4fbf' : '#999';
      ctx.lineWidth = 1 + e.pressure * 4 * devicePixelRatio;
      ctx.lineCap = 'round';
      for (const p of list.length ? list : [e]) {
        const pt = {
          x: (p.clientX - r.left) * devicePixelRatio,
          y: (p.clientY - r.top) * devicePixelRatio,
        };
        if (last) {
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
        last = pt;
      }
    };
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      last = null;
      sample(e);
    };
    const move = (e: PointerEvent) => {
      if (e.buttons || e.pressure > 0) sample(e);
    };
    const up = () => {
      last = null;
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    window.addEventListener('resize', fit);
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const reset = () => {
    stats.current = emptyStats();
    const c = pad.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    if (out.current) out.current.textContent = format(stats.current);
  };

  return (
    <section className="pendiag">
      <h2>펜 진단</h2>
      <p>아래 칸에 펜으로 그어 보세요. 나온 값을 알려 주시면 굵기를 기기에 맞춥니다.</p>
      <canvas ref={pad} className="pendiag-pad" />
      <pre ref={out} className="pendiag-out" />
      <button type="button" className="btn" onClick={reset}>
        다시 재기
      </button>
    </section>
  );
}
