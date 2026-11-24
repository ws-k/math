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
 * 앱 자가 점검 결과(Documents/selfcheck.json) 판정. head 는 지금 커밋(짧은 해시).
 * persist·isSecureContext 는 자체 스킴에서 어떻게 나올지 몰라 실측하려는 값이라 실패로 치지 않고 notes 로만 남긴다.
 */
export function judgeSelfcheck(r: Record<string, unknown>, head: string): SelfcheckVerdict {
  const problems: string[] = [];
  if ('error' in r) problems.push(`점검 실행 실패: ${String(r.error)}`);
  // 옛 앱이 깔린 채로 점검하면 통과해도 지금 코드에 대한 결과가 아니다. + 는 개발 중 빌드라 허용한다
  if (r.build !== head && r.build !== `${head}+`)
    problems.push(
      `앱에 실린 빌드가 지금 커밋(${head})이 아니에요: ${JSON.stringify(r.build ?? null)} — npm run ios:sim 으로 다시 까세요`,
    );
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
  // 기록 사본(ios/Math/Backup.swift) 길목이 답하는지. 마지막 성공 시각은 새로 깐 직후엔 없을 수 있어 보고만 한다
  const b = r.backup as { count?: unknown } | undefined;
  if (typeof b?.count !== 'number')
    problems.push(`기록 사본 상태를 못 읽어요: ${JSON.stringify(r.backup ?? null)}`);
  // 스킴 처리기의 dist 밖 막기(BundleSchemeHandler.file(for:)). %2f 는 주소 정리에서 안 풀려 처리기까지 '..' 가 간다
  if (r.traversal !== 404)
    problems.push(
      `dist 밖 파일 요청(/..%2fInfo.plist)이 404 가 아니에요: ${JSON.stringify(r.traversal ?? null)}`,
    );

  const notes = [
    'build',
    'isSecureContext',
    'persist',
    'persistedAfter',
    'language',
    'safeArea',
    'backup',
  ].map((k) => `${k}: ${JSON.stringify(r[k])}`);
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

/**
 * `xcrun simctl list devices -j` 결과 → 이 UDID 를 써도 되는지(null 이면 된다).
 * 같은 맥에 다른 프로젝트 시뮬레이터(PS … 등)도 켜져 있어, UDID 를 잘못 넣으면 남의 기기에 앱을 깔고
 * 기록을 지운다. 그래서 이 저장소 기기 이름(Math …)으로 시작하는지 먼저 본다.
 */
export function simulatorProblem(list: unknown, udid: string): string | null {
  const devices = (list as { devices?: Record<string, { udid?: string; name?: string }[]> })
    ?.devices;
  const found = Object.values(devices ?? {})
    .flat()
    .find((d) => d?.udid === udid);
  if (!found)
    return `시뮬레이터 ${udid} 가 없어요 — xcrun simctl list devices 로 UDID 를 확인하세요`;
  if (!found.name?.startsWith('Math'))
    return `MATH_IOS_SIM_UDID(${udid})는 "${found.name}" 이에요 — 이름이 Math 로 시작하는 시뮬레이터만 써요`;
  return null;
}
