// 설정. 저장소에서 읽은 값은 예전 버전이거나 깨졌을 수 있어 항상 기본값으로 메운다.
import type { Background, SizeLevel, Tool, ToolKind } from '../ink/types.ts';

export interface Settings {
  /** 하루 목표 문제 수(복습 + 새 문제) */
  dailyGoal: number;
  tool: Tool;
  background: Background;
  /** 손가락(한 손가락)으로도 필기할지. 펜이 없는 기기를 위해 기본 켜짐 */
  fingerInk: boolean;
  /** 이 기기에서 펜을 본 적 있는지 — 처음 볼 때 한 번만 손가락 쓰기를 끄려고 기억한다 */
  penSeen: boolean;
}

export const PEN_COLORS = ['#1b1b1b', '#1f4fbf', '#c0392b'] as const;
export const HIGHLIGHT_COLOR = '#f5d33b';

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 10,
  tool: { kind: 'pen', color: PEN_COLORS[0], size: 1 },
  background: 'none',
  fingerInk: true,
  penSeen: false,
};

const KINDS: ToolKind[] = ['pen', 'highlighter', 'eraser'];
const BGS: Background[] = ['none', 'grid', 'lines'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function normalizeSettings(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  const t = isObj(r.tool) ? r.tool : {};
  const d = DEFAULT_SETTINGS;
  const goal = r.dailyGoal;
  return {
    dailyGoal:
      typeof goal === 'number' && Number.isInteger(goal) && goal > 0 && goal <= 200
        ? goal
        : d.dailyGoal,
    tool: {
      kind: KINDS.includes(t.kind as ToolKind) ? (t.kind as ToolKind) : d.tool.kind,
      color: typeof t.color === 'string' ? t.color : d.tool.color,
      size: t.size === 0 || t.size === 1 || t.size === 2 ? (t.size as SizeLevel) : d.tool.size,
    },
    background: BGS.includes(r.background as Background)
      ? (r.background as Background)
      : d.background,
    fingerInk: typeof r.fingerInk === 'boolean' ? r.fingerInk : d.fingerInk,
    penSeen: typeof r.penSeen === 'boolean' ? r.penSeen : d.penSeen,
  };
}

/**
 * 펜이 감지됐을 때 바꿀 설정. 펜이 있으면 손가락은 스크롤·손바닥이어야 해서 처음 한 번만 손가락 쓰기를 끈다.
 * 그 뒤에 사용자가 다시 켰다면 그 선택을 존중한다(바꿀 게 없으면 null).
 */
export function penDetected(s: Settings): Settings | null {
  if (s.penSeen) return null;
  return { ...s, penSeen: true, fingerInk: false };
}
