// 펜 진단 값 모으기(설계 7-2). 실제 기기 값을 보고 필기 굵기를 다듬기 위한 것.

export interface PenSample {
  pointerType: string;
  pressure: number;
  tiltX: number;
  tiltY: number;
  /** 이 pointermove 한 번에 묶여 온 점 수(getCoalescedEvents) */
  coalesced: number;
}

export interface PenStats {
  pointerType: string;
  pressureMin: number;
  pressureMax: number;
  tiltX: number;
  tiltY: number;
  events: number;
  coalescedLast: number;
  coalescedMax: number;
  coalescedAvg: number;
}

export function emptyStats(): PenStats {
  return {
    pointerType: '-',
    pressureMin: Number.POSITIVE_INFINITY,
    pressureMax: Number.NEGATIVE_INFINITY,
    tiltX: 0,
    tiltY: 0,
    events: 0,
    coalescedLast: 0,
    coalescedMax: 0,
    coalescedAvg: 0,
  };
}

export function addSample(s: PenStats, p: PenSample): PenStats {
  const events = s.events + 1;
  return {
    pointerType: p.pointerType,
    pressureMin: Math.min(s.pressureMin, p.pressure),
    pressureMax: Math.max(s.pressureMax, p.pressure),
    tiltX: p.tiltX,
    tiltY: p.tiltY,
    events,
    coalescedLast: p.coalesced,
    coalescedMax: Math.max(s.coalescedMax, p.coalesced),
    coalescedAvg: s.coalescedAvg + (p.coalesced - s.coalescedAvg) / events,
  };
}
