// 앱 껍데기(iOS) 안에서 열렸는지에 따라 달라지는 것: 앱 감지, 설정 화면 저장 문구, 빌드 표시
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLabel, isNativeApp, storageNote } from '../src/app/shell.ts';

test('isNativeApp: iOS 앱의 메시지 처리기(mathApp)가 있을 때만 앱', () => {
  const app = { webkit: { messageHandlers: { mathApp: { postMessage() {} } } } };
  assert.equal(isNativeApp(app), true);
  // Safari·홈 화면 앱: webkit.messageHandlers 가 없다
  assert.equal(isNativeApp({}), false);
  // 다른 앱의 웹뷰에 열렸으면(처리기는 있지만 우리 것이 아님) 앱이 아니다
  assert.equal(isNativeApp({ webkit: { messageHandlers: {} } }), false);
  assert.equal(isNativeApp(undefined), false);
});

test('storageNote: 웹은 영구 저장 여부와 홈 화면 안내', () => {
  assert.equal(storageNote(true, false), '영구 저장이 허용되어 기기 안 기록이 지워지지 않아요.');
  assert.match(storageNote(false, false), /홈 화면에 추가/);
});

test('storageNote: 앱에서는 홈 화면 안내를 하지 않는다(앱은 이미 홈 화면에 있다)', () => {
  assert.doesNotMatch(storageNote(false, true), /홈 화면/);
  assert.doesNotMatch(storageNote(true, true), /홈 화면/);
  assert.match(storageNote(false, true), /앱을 지우면/);
});

test('buildLabel: 커밋 해시를 보여 주고, 개발 중이면 그렇게 말한다', () => {
  assert.equal(buildLabel('a1b2c3d'), '빌드 a1b2c3d');
  assert.equal(buildLabel('a1b2c3d+'), '빌드 a1b2c3d+ (커밋 안 된 변경 포함)');
  assert.equal(buildLabel('dev'), '빌드 개발 중');
});
