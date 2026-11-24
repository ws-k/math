// iOS 껍데기 앱: node scripts/ios.mjs <sim|selfcheck|check|archive>
//   sim        dist 점검 → 시뮬레이터용 빌드 → 설치 → 실행 (npm run ios:sim 이 웹 빌드 뒤 부른다)
//   selfcheck  설치된 앱을 -selfcheck 로 다시 켜서 자가 점검 결과(JSON)를 읽고 통과·실패를 낸다
//   check      스토어용 dist 점검(파일·빌드 커밋) — archive 가 먼저 부른다
//   archive    check → 기기용 Release Archive → Xcode Organizer 열기 (서명·계정 필요, PM 몫)
// Xcode 빌드 단계에서 npm 을 돌리지 않고 여기서 나눠 부르는 이유: Xcode 환경엔 node 경로가 없고,
// 검산(약 2분)이 매 빌드마다 붙는다. 그래서 웹 빌드는 npm 스크립트가 먼저 끝내 둔다.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { buildProblems, distProblems, judgeSelfcheck, simulatorProblem } from './ios-lib.ts';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const project = join(root, 'ios/Math.xcodeproj');
const derived = join(root, '.cache/ios');
// 이 저장소의 시뮬레이터는 "Math - iPhone Duo" 하나로 정해 두었다. 'booted' 는 여러 대가 켜져 있으면
// 엉뚱한 기기를 고르므로 쓰지 않고 항상 UDID 로 가리킨다. 환경 변수 이름에 MATH_ 를 붙인 이유:
// 다른 프로젝트 스크립트가 쓰는 흔한 이름(IOS_SIM_UDID)이 셸에 남아 있으면 남의 기기를 가리키게 된다
const UDID = process.env.MATH_IOS_SIM_UDID ?? 'D4D16B43-BE3A-4C00-9108-F8D251DEE16D';

/** 번들 ID 는 Base.xcconfig 한 곳에만 적고 여기서 읽는다(두 곳에 적으면 어긋난다) */
function bundleId() {
  const conf = readFileSync(join(root, 'ios/Config/Base.xcconfig'), 'utf8');
  const m = conf.match(/^PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(\S+)/m);
  if (!m?.[1]) fail('Base.xcconfig 에 PRODUCT_BUNDLE_IDENTIFIER 가 없어요');
  return m[1];
}

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

/** 셸 없이 바로 실행(인자에 공백·따옴표가 있어도 안전). 실패하면 멈춘다 */
function run(cmd, args, { quiet = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} 실패${quiet ? `\n${r.stderr}` : ''}`);
  return r.stdout ?? '';
}

function listFiles(dir) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(dir, join(d.parentPath, d.name)));
}

function checkDist() {
  const problems = distProblems(listFiles(dist));
  if (problems.length)
    fail(`dist 를 앱에 실을 수 없어요 (npm run build 먼저):\n    ${problems.join('\n    ')}`);
}

function headCommit() {
  return run('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { quiet: true }).trim();
}

/** 시뮬레이터를 건드리기 전에 이 저장소 기기(이름이 Math …)인지 확인한다. 아니면 아무것도 안 하고 멈춘다 */
function checkSimulator() {
  const out = run('xcrun', ['simctl', 'list', 'devices', '-j'], { quiet: true });
  let list;
  try {
    list = JSON.parse(out);
  } catch {
    list = null;
  }
  const problem = simulatorProblem(list, UDID);
  if (problem) fail(problem);
}

function sim(extra = []) {
  checkSimulator();
  checkDist();
  run('xcodebuild', [
    '-project',
    project,
    '-scheme',
    'Math',
    '-configuration',
    'Debug',
    '-destination',
    `id=${UDID}`,
    '-derivedDataPath',
    derived,
    '-quiet',
    'build',
  ]);
  // 꺼져 있으면 켜고 다 켜질 때까지 기다린다(이미 켜져 있으면 바로 돌아온다)
  run('xcrun', ['simctl', 'bootstatus', UDID, '-b'], { quiet: true });
  run('xcrun', [
    'simctl',
    'install',
    UDID,
    join(derived, 'Build/Products/Debug-iphonesimulator/Math.app'),
  ]);
  launch(extra);
  console.log(`\n  ✓ 시뮬레이터(${UDID})에서 실행 — 커밋 ${headCommit()}\n`);
}

function launch(extra = []) {
  // 이미 떠 있으면 새 인자(-selfcheck)가 안 먹으므로 먼저 끈다. 안 떠 있으면 실패해도 상관없다
  spawnSync('xcrun', ['simctl', 'terminate', UDID, bundleId()], { stdio: 'ignore' });
  run('xcrun', ['simctl', 'launch', UDID, bundleId(), ...extra], { quiet: true });
}

async function selfcheck() {
  checkSimulator();
  const head = headCommit();
  const data = run('xcrun', ['simctl', 'get_app_container', UDID, bundleId(), 'data'], {
    quiet: true,
  }).trim();
  // 빈 출력이면 아래 경로가 이 저장소 기준 상대 경로(Documents/…)가 돼 엉뚱한 파일을 지운다. 지우기 전에 멈춘다
  if (!data || !isAbsolute(data))
    fail(
      `앱 데이터 폴더를 못 찾았어요(${JSON.stringify(data)}) — 앱이 깔려 있나요? npm run ios:sim 먼저`,
    );
  const file = join(data, 'Documents/selfcheck.json');
  rmSync(file, { force: true });
  // 지금 커밋을 넘겨 앱이 실제로 내주는 main.js 에 그 빌드 표시가 찍혔는지 재게 한다(SelfCheck.swift)
  launch(['-selfcheck', '-selfcheckHead', head]);
  // 앱이 웹을 다 불러온 뒤 점검을 돌려 파일을 쓴다. 보통 1~2초, 넉넉히 30초까지 기다린다
  const until = Date.now() + 30_000;
  while (!existsSync(file)) {
    if (Date.now() > until)
      fail('30초 안에 자가 점검 결과가 안 나왔어요(앱이 죽었거나 웹을 못 불러옴)');
    await new Promise((r) => setTimeout(r, 300));
  }
  const result = JSON.parse(readFileSync(file, 'utf8'));
  console.log(JSON.stringify(result, null, 2));
  const v = judgeSelfcheck(result, head);
  console.log(`\n  ${v.notes.join('\n  ')}`);
  if (!v.ok) fail(`자가 점검 실패:\n    ${v.problems.join('\n    ')}`);
  console.log('\n  ✓ 자가 점검 통과\n');
}

function check() {
  checkDist();
  const problems = buildProblems(readFileSync(join(dist, 'main.js'), 'utf8'), headCommit());
  if (problems.length) fail(problems.join('\n    '));
  console.log(`\n  ✓ dist 점검 통과 — 커밋 ${headCommit()}\n`);
}

function archive() {
  check();
  const out = join(derived, `Math-${headCommit()}.xcarchive`);
  run('xcodebuild', [
    '-project',
    project,
    '-scheme',
    'Math',
    '-configuration',
    'Release',
    '-destination',
    'generic/platform=iOS',
    '-archivePath',
    out,
    '-allowProvisioningUpdates',
    'archive',
  ]);
  // Archive 파일을 열면 Xcode Organizer 가 받아서 목록에 올린다. 거기서 Distribute → TestFlight
  run('open', [out]);
  console.log(`\n  ✓ Archive 완료: ${out}\n    Organizer 에서 Distribute App → TestFlight\n`);
}

const cmd = process.argv[2];
if (cmd === 'sim') sim();
else if (cmd === 'selfcheck') await selfcheck();
else if (cmd === 'check') check();
else if (cmd === 'archive') archive();
else fail('쓰는 법: node scripts/ios.mjs <sim|selfcheck|check|archive>');
