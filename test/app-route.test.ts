import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRoute, routeHash } from '../src/app/route.ts';

test('빈 해시와 #/ 는 홈', () => {
  assert.deepEqual(parseRoute(''), { name: 'home' });
  assert.deepEqual(parseRoute('#'), { name: 'home' });
  assert.deepEqual(parseRoute('#/'), { name: 'home' });
});

test('지도·오답 노트·설정', () => {
  assert.deepEqual(parseRoute('#/map'), { name: 'map' });
  assert.deepEqual(parseRoute('#/wrong'), { name: 'wrong' });
  assert.deepEqual(parseRoute('#/settings'), { name: 'settings' });
});

test('단원 쪽과 문제 쪽', () => {
  assert.deepEqual(parseRoute('#/unit/m1-linear-eq'), {
    name: 'unit',
    unitId: 'm1-linear-eq',
    pid: null,
    side: 'text',
  });
  assert.deepEqual(parseRoute('#/unit/m1-linear-eq/b01'), {
    name: 'unit',
    unitId: 'm1-linear-eq',
    pid: 'b01',
    side: 'text',
  });
});

test('공책 쪽은 ?side=note', () => {
  assert.deepEqual(parseRoute('#/unit/u/b01?side=note'), {
    name: 'unit',
    unitId: 'u',
    pid: 'b01',
    side: 'note',
  });
  assert.equal(parseRoute('#/unit/u?side=note').name, 'unit');
});

test('생성 문제 id(콜론 포함)도 왕복된다', () => {
  const r = { name: 'unit', unitId: 'u', pid: 'gen:lin-eq-basic:42', side: 'note' } as const;
  assert.deepEqual(parseRoute(routeHash(r)), r);
});

test('모르는 주소는 홈으로', () => {
  assert.deepEqual(parseRoute('#/nope/x'), { name: 'home' });
  assert.deepEqual(parseRoute('#/unit'), { name: 'home' });
});

test('routeHash: 기본값은 생략', () => {
  assert.equal(routeHash({ name: 'home' }), '#/');
  assert.equal(routeHash({ name: 'unit', unitId: 'u', pid: null, side: 'text' }), '#/unit/u');
  assert.equal(
    routeHash({ name: 'unit', unitId: 'u', pid: null, side: 'note' }),
    '#/unit/u?side=note',
  );
});
