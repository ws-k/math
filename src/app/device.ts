// 기기 설정: 사람(프로필)이 아니라 이 기기에 딸린 값. 펜이 있는지는 기기의 성질이라
// 아이·어른 누가 쓰든 같아야 한다 — 프로필별로 두면 펜을 본 뒤에도 다른 사람 프로필은 손가락 쓰기가 켜진 채 남는다.

/** 저장 키. profile.ts 의 기기 공통 키에 들어 있어 프로필 접두어가 붙지 않는다 */
export const DEVICE_KEY = 'device';

export interface DeviceSettings {
  /** 손가락(한 손가락)으로도 필기할지. 펜이 없는 기기를 위해 기본 켜짐 */
  fingerInk: boolean;
  /** 이 기기에서 펜을 본 적 있는지 — 처음 볼 때 한 번만 손가락 쓰기를 끄려고 기억한다 */
  penSeen: boolean;
}

export const DEFAULT_DEVICE: DeviceSettings = { fingerInk: true, penSeen: false };

/** 저장소 값은 깨졌거나 비었을 수 있어 항상 기본값으로 메운다 */
export function normalizeDevice(raw: unknown): DeviceSettings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    fingerInk: typeof r.fingerInk === 'boolean' ? r.fingerInk : DEFAULT_DEVICE.fingerInk,
    penSeen: typeof r.penSeen === 'boolean' ? r.penSeen : DEFAULT_DEVICE.penSeen,
  };
}

/**
 * 펜이 감지됐을 때 바꿀 설정. 펜이 있으면 손가락은 스크롤·손바닥이어야 해서 처음 한 번만 손가락 쓰기를 끈다.
 * 그 뒤에 사용자가 다시 켰다면 그 선택을 존중한다(바꿀 게 없으면 null).
 */
export function penDetected(d: DeviceSettings): DeviceSettings | null {
  if (d.penSeen) return null;
  return { penSeen: true, fingerInk: false };
}
