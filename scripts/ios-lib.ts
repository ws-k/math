// scripts/ios.mjs 의 판정 규칙. 시뮬레이터·xcodebuild 를 부르지 않는 순수 함수라 테스트로 고정한다.

/** 앱 스킴 출처. ios/Math/BundleSchemeHandler.swift 의 scheme·host 와 같아야 한다 */
export const APP_ORIGIN = 'mathrebuild://localhost';

/**
 * dist 안 파일 목록(dist 기준 상대 경로) → 앱에 실으면 안 되는 이유들. 빈 배열이면 실어도 된다.
 * Xcode 는 dist 가 비어도 그대로 묶어 빈 앱을 만들 수 있어 빌드 전에 여기서 막는다.
 */
export function distProblems(files: string[] | null): string[] {
  if (!files) return ['dist 폴더가 없어요'];
  const out: string[] = [];
  for (const f of ['index.html', 'main.js', 'main.css'])
    if (!files.includes(f)) out.push(`${f} 가 없어요`);
  if (!files.some((f) => f.startsWith('fonts/'))) out.push('fonts/ 에 글꼴이 없어요');
  return out;
}

export interface SelfcheckVerdict {
  ok: boolean;
  /** 실패 이유 — 하나라도 있으면 앱이 제대로 못 돈다 */
  problems: string[];
  /** 실패는 아니지만 기록해 둘 값(영구 저장 허용 여부 등) */
  notes: string[];
}

/**
 * 앱 자가 점검 결과(Documents/selfcheck.json) 판정.
 * persist·isSecureContext 는 자체 스킴에서 어떻게 나올지 몰라 실측하려는 값이라 실패로 치지 않고 notes 로만 남긴다.
 */
export function judgeSelfcheck(r: Record<string, unknown>): SelfcheckVerdict {
  const problems: string[] = [];
  if ('error' in r) problems.push(`점검 실행 실패: ${String(r.error)}`);
  if (r.origin !== APP_ORIGIN)
    problems.push(`출처가 ${APP_ORIGIN} 가 아니에요: ${String(r.origin)}`);
  if (r.nativeDetected !== true)
    problems.push('앱 감지(window.webkit.messageHandlers.mathApp)가 안 돼요');
  if (r.indexedDB !== true)
    problems.push(`IndexedDB 쓰고 읽기 실패: ${JSON.stringify(r.indexedDB ?? null)}`);
  const fonts =
    typeof r.fonts === 'object' && r.fonts !== null ? (r.fonts as Record<string, unknown>) : {};
  const names = Object.keys(fonts);
  if (names.length === 0) problems.push('글꼴 점검 결과가 없어요');
  const broken = names.filter((f) => fonts[f] !== true);
  if (broken.length) problems.push(`글꼴이 안 불러와져요: ${broken.join(', ')}`);

  const notes = ['isSecureContext', 'persist', 'persistedAfter', 'language', 'safeArea'].map(
    (k) => `${k}: ${JSON.stringify(r[k])}`,
  );
  return { ok: problems.length === 0, problems, notes };
}

/**
 * 스토어용 dist 가 지금 커밋으로 깨끗하게 만든 것인지. main.js 에 찍힌 빌드 표시(esbuild-shared.mjs 의
 * __BUILD__)로 판단한다. 옛 dist 나 커밋 안 된 변경이 실리면 어떤 코드가 나갔는지 되짚을 수 없어 막는다.
 */
export function buildProblems(mainJs: string, head: string): string[] {
  if (mainJs.includes(`"${head}"`)) return [];
  if (mainJs.includes(`"${head}+"`))
    return [`커밋 안 된 변경이 섞인 빌드예요(${head}+) — 커밋한 뒤 다시 만드세요`];
  return [`dist 가 지금 커밋(${head})으로 만든 게 아니에요 — npm run build 로 다시 만드세요`];
}
