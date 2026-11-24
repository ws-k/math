// 앱 껍데기(iOS 앱) 안에서 열렸는지에 따라 달라지는 것들.
// dist 는 웹(PWA)과 앱이 한 벌을 같이 쓴다 — 빌드를 둘로 나누면 한쪽만 고치는 일이 생겨서, 실행 중에 알아낸다.

/**
 * iOS 앱이 웹뷰에 넣어 주는 메시지 처리기 이름(ios/Math/WebView.swift 의 Coordinator.messageName).
 * Safari·홈 화면 앱에는 window.webkit.messageHandlers 자체가 없고, 다른 앱의 웹뷰라면 이 이름이 없다.
 */
export const HANDLER = 'mathApp';

export type MaybeWebkit = { webkit?: { messageHandlers?: Record<string, unknown> } } | undefined;

export interface NativeHandler {
  postMessage(m: unknown): unknown;
}

/**
 * 앱의 메시지 처리기. 앱인지 판단(isNativeApp)과 기록 사본 다리(backup.ts)가 이 하나를 기준으로 쓴다 —
 * 기준이 둘이면 "앱이라 막는 화면을 띄웠는데 다리는 없다" 같은 어긋남이 생긴다.
 */
export function nativeHandler(w: MaybeWebkit = globalThis as MaybeWebkit): NativeHandler | null {
  const h = w?.webkit?.messageHandlers?.[HANDLER] as Partial<NativeHandler> | undefined;
  return typeof h?.postMessage === 'function' ? (h as NativeHandler) : null;
}

export function isNativeApp(w: MaybeWebkit = globalThis as MaybeWebkit): boolean {
  return nativeHandler(w) !== null;
}

/**
 * 설정 화면의 저장 안내. 웹은 홈 화면 앱으로 열면 영구 저장이 허용될 수 있어 그렇게 안내하지만,
 * 앱은 이미 홈 화면에 있어 같은 안내가 틀린 말이 된다. 앱에서 persist() 는 false 로 나온다(시뮬레이터 실측).
 */
export function storageNote(persisted: boolean, app: boolean): string {
  if (persisted) return '영구 저장이 허용되어 기기 안 기록이 지워지지 않아요.';
  if (app) return '기록은 이 기기의 앱 안에 저장돼요. 앱을 지우면 기록도 함께 지워져요.';
  return '영구 저장이 아직 허용되지 않았어요. 홈 화면에 추가해서 열면 허용될 수 있어요.';
}

// 빌드 도구가 커밋 해시를 넣는다(scripts/esbuild-shared.mjs). 테스트처럼 넣지 않고 묶으면 개발 중으로 본다
const BUILD_ID = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

/** 설정 화면 맨 아래 빌드 표시 — 앱에 옛 dist 가 실렸는지 눈으로 바로 알 수 있게 */
export function buildLabel(id: string = BUILD_ID): string {
  if (id === 'dev') return '빌드 개발 중';
  if (id.endsWith('+')) return `빌드 ${id} (커밋 안 된 변경 포함)`;
  return `빌드 ${id}`;
}
