// iOS 껍데기 스크립트(scripts/ios.mjs)의 판정 규칙: dist 점검, 자가 점검 결과 판정, 시뮬레이터 확인
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distProblems, judgeSelfcheck, simulatorProblem } from '../scripts/ios-lib.ts';

const goodDist = [
  'index.html',
  'main.js',
  'main.css',
  'manifest.webmanifest',
  'fonts/KaTeX_Main-x.woff2',
];

test('distProblems: 웹 결과물이 다 있으면 문제 없음', () => {
  assert.deepEqual(distProblems(goodDist), []);
});

test('distProblems: dist 가 없거나 빠진 파일·글꼴을 하나씩 짚는다', () => {
  assert.deepEqual(distProblems(null), ['dist 폴더가 없어요']);
  assert.deepEqual(distProblems(['index.html', 'main.css']), [
    'main.js 가 없어요',
    'fonts/ 에 글꼴이 없어요',
  ]);
});

const goodCheck = {
  origin: 'mathrebuild://localhost',
  isSecureContext: true,
  persist: false,
  nativeDetected: true,
  indexedDB: true,
  fonts: { KaTeX_Main: true, KaTeX_Math: true },
  backup: { count: 3, lastSuccess: '2026-11-24T01:02:03Z' },
  build: 'a1b2c3d',
  traversal: 404,
};
const HEAD = 'a1b2c3d';

test('judgeSelfcheck: 글꼴·IndexedDB·출처·앱 감지가 맞으면 통과(persist 는 참고값)', () => {
  const r = judgeSelfcheck(goodCheck, HEAD);
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
  // 영구 저장·보안 출처는 실패로 치지 않고 보고만 한다 — 앱이 켜지는 데는 지장이 없다
  assert.ok(r.notes.some((n) => n.includes('persist') && n.includes('false')));
  assert.ok(r.notes.some((n) => n.includes('isSecureContext') && n.includes('true')));
});

test('judgeSelfcheck: 하나라도 어긋나면 실패하고 무엇이 어긋났는지 적는다', () => {
  const r = judgeSelfcheck(
    {
      ...goodCheck,
      origin: 'null',
      nativeDetected: false,
      indexedDB: { error: 'UnknownError' },
      fonts: { KaTeX_Main: true, KaTeX_Math: false },
    },
    HEAD,
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems, [
    '출처가 mathrebuild://localhost 가 아니에요: null',
    '앱 감지(window.webkit.messageHandlers.mathApp)가 안 돼요',
    'IndexedDB 쓰고 읽기 실패: {"error":"UnknownError"}',
    '글꼴이 안 불러와져요: KaTeX_Math',
  ]);
});

test('judgeSelfcheck: 점검 자체가 실패했거나 비었으면 실패', () => {
  assert.equal(judgeSelfcheck({ error: 'JS 예외' }, HEAD).ok, false);
  assert.equal(judgeSelfcheck({}, HEAD).ok, false);
  assert.equal(judgeSelfcheck({ ...goodCheck, fonts: {} }, HEAD).ok, false);
});

test('judgeSelfcheck: 기록 사본 상태(파일 수·마지막 성공 시각)를 보고하고, 사본 길목이 안 되면 실패', () => {
  const r = judgeSelfcheck(goodCheck, HEAD);
  assert.ok(r.notes.some((n) => n.startsWith('backup:') && n.includes('2026-11-24T01:02:03Z')));
  // 아직 한 번도 안 썼으면(새로 깐 직후) 시각이 없을 수 있다 — 실패는 아니다
  assert.equal(
    judgeSelfcheck({ ...goodCheck, backup: { count: 0, lastSuccess: null } }, HEAD).ok,
    true,
  );
  const bad = judgeSelfcheck({ ...goodCheck, backup: { error: '권한 없음' } }, HEAD);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.problems, ['기록 사본 상태를 못 읽어요: {"error":"권한 없음"}']);
  assert.equal(judgeSelfcheck({ ...goodCheck, backup: undefined }, HEAD).ok, false);
});

test('judgeSelfcheck: 앱에 실린 빌드가 지금 커밋이어야 통과(커밋 안 된 변경 + 는 개발 중이라 허용)', () => {
  assert.ok(judgeSelfcheck(goodCheck, HEAD).notes.includes('build: "a1b2c3d"'));
  assert.equal(judgeSelfcheck({ ...goodCheck, build: 'a1b2c3d+' }, HEAD).ok, true);
  // 옛 앱이 깔려 있으면 점검 결과가 지금 코드에 대한 것이 아니다
  const old = judgeSelfcheck({ ...goodCheck, build: null }, HEAD);
  assert.equal(old.ok, false);
  assert.deepEqual(old.problems, [
    '앱에 실린 빌드가 지금 커밋(a1b2c3d)이 아니에요: null — npm run ios:sim 으로 다시 까세요',
  ]);
});

test('judgeSelfcheck: dist 밖 파일(/..%2fInfo.plist)이 404 가 아니면 실패', () => {
  const r = judgeSelfcheck({ ...goodCheck, traversal: 200 }, HEAD);
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems, ['dist 밖 파일 요청(/..%2fInfo.plist)이 404 가 아니에요: 200']);
  assert.equal(judgeSelfcheck({ ...goodCheck, traversal: undefined }, HEAD).ok, false);
});

// xcrun simctl list devices -j 의 모양(런타임별 기기 목록)
const simList = {
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-27-1': [
      { udid: 'AAA', name: 'Math - iPhone Duo', state: 'Booted' },
      { udid: 'BBB', name: 'PS - iPhone 17', state: 'Booted' },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
      { udid: 'CCC', name: 'Math iPad', state: 'Shutdown' },
    ],
  },
};

test('simulatorProblem: 이름이 Math 로 시작하는 기기면 통과(런타임이 달라도)', () => {
  assert.equal(simulatorProblem(simList, 'AAA'), null);
  assert.equal(simulatorProblem(simList, 'CCC'), null);
});

test('simulatorProblem: 다른 프로젝트 기기거나 없는 UDID 면 막는다', () => {
  assert.equal(
    simulatorProblem(simList, 'BBB'),
    'MATH_IOS_SIM_UDID(BBB)는 "PS - iPhone 17" 이에요 — 이름이 Math 로 시작하는 시뮬레이터만 써요',
  );
  assert.equal(
    simulatorProblem(simList, 'ZZZ'),
    '시뮬레이터 ZZZ 가 없어요 — xcrun simctl list devices 로 UDID 를 확인하세요',
  );
  // simctl 출력이 깨졌으면 확인할 수 없으니 막는다
  assert.equal(
    simulatorProblem({}, 'AAA'),
    '시뮬레이터 AAA 가 없어요 — xcrun simctl list devices 로 UDID 를 확인하세요',
  );
});
