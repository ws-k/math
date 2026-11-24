// 빌드 커밋 표시(scripts/esbuild-shared.mjs 의 formatBuildId)와 옛 dist 막기(scripts/ios-lib.ts 의 buildProblems)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILD_INPUTS, formatBuildId } from '../scripts/esbuild-shared.mjs';
import { buildProblems } from '../scripts/ios-lib.ts';

test('formatBuildId: 깨끗한 작업 폴더면 해시만, 커밋 안 된 변경이 있으면 + 를 붙인다', () => {
  assert.equal(formatBuildId('a1b2c3d', ''), 'a1b2c3d');
  assert.equal(formatBuildId('a1b2c3d\n', ' M src/app/App.tsx\n'), 'a1b2c3d+');
  // git 이 없거나 저장소가 아니면 모른다고 적는다(빌드는 멈추지 않는다)
  assert.equal(formatBuildId('', ''), 'unknown');
});

test('formatBuildId: 아직 커밋 안 한 새 파일(??)도 앱에 들어가므로 + 를 붙인다', () => {
  // 새 단원 JSON 은 contentPlugin 이 폴더를 읽어 바로 묶는다 — 해시만 찍으면 그 커밋에 없는 내용이 실린다
  assert.equal(formatBuildId('a1b2c3d', '?? content/units/x.json\n'), 'a1b2c3d+');
});

test('BUILD_INPUTS: 빌드에 들어가는 것만 본다(outputs/ 같은 로컬 산출물은 변경으로 안 친다)', () => {
  for (const p of ['src', 'content', 'public', 'index.html', 'package-lock.json'])
    assert.ok(BUILD_INPUTS.includes(p), p);
  assert.ok(!BUILD_INPUTS.includes('outputs'));
});

test('buildProblems: dist 가 지금 커밋으로 깨끗하게 만든 것이면 문제 없음', () => {
  assert.deepEqual(buildProblems('var x="a1b2c3d";', 'a1b2c3d'), []);
});

test('buildProblems: 옛 커밋의 dist 이거나 커밋 안 된 변경이 섞였으면 막는다', () => {
  assert.deepEqual(buildProblems('var x="0000000";', 'a1b2c3d'), [
    'dist 가 지금 커밋(a1b2c3d)으로 만든 게 아니에요 — npm run build 로 다시 만드세요',
  ]);
  assert.deepEqual(buildProblems('var x="a1b2c3d+";', 'a1b2c3d'), [
    '커밋 안 된 변경이 섞인 빌드예요(a1b2c3d+) — 커밋한 뒤 다시 만드세요',
  ]);
});
