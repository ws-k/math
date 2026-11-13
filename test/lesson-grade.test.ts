import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  closeTo,
  gradeLine,
  gradePoint,
  gradePointsOn,
  gradeSketch,
  SKETCH_COVER,
  SKETCH_HIT,
} from '../src/lesson/grade.ts';

test('점 찍기: 격자 칸 번호가 같아야(정수 비교)', () => {
  assert.equal(gradePoint([{ i: 2, j: 3 }], { i: 2, j: 3 }).ok, true);
  assert.equal(gradePoint([{ i: 2, j: 2 }], { i: 2, j: 3 }).ok, false);
  // 점을 여러 개 찍었으면 틀린 것으로(하나만 찍는 과제)
  assert.equal(
    gradePoint(
      [
        { i: 2, j: 3 },
        { i: 0, j: 0 },
      ],
      { i: 2, j: 3 },
    ).ok,
    false,
  );
  assert.equal(gradePoint([], { i: 2, j: 3 }).ok, false);
});

test('closeTo: f(x) 비교만 상대오차 1e-9', () => {
  assert.equal(closeTo(0.1 + 0.2, 0.3), true);
  assert.equal(closeTo(1e12 + 1, 1e12), true);
  assert.equal(closeTo(1.001, 1), false);
  assert.equal(closeTo(Number.NaN, 1), false);
});

test('곡선 위 점 k개: 점마다 곡선 위, x 가 겹치지 않고, k개', () => {
  const on = (p: { i: number; j: number }) => closeTo(p.j, p.i * p.i - 1);
  const pts = [
    { i: -1, j: 0 },
    { i: 0, j: -1 },
    { i: 2, j: 3 },
  ];
  assert.deepEqual(gradePointsOn(pts, on, 3), { ok: true, on: 3, dupX: false, total: 3 });
  assert.equal(gradePointsOn(pts.slice(0, 2), on, 3).ok, false);
  assert.equal(gradePointsOn([...pts.slice(0, 2), { i: 2, j: 2 }], on, 3).ok, false);
  // 같은 x 에 두 점이면(세로로 찍기) 함수의 그래프가 아니다
  const dup = gradePointsOn([...pts, { i: 2, j: 3 }], on, 3);
  assert.equal(dup.dupX, true);
  assert.equal(dup.ok, false);
  // 더 많이 찍어도 모두 곡선 위면 통과
  assert.equal(gradePointsOn([...pts, { i: 1, j: 0 }], on, 3).ok, true);
});

test('직선: 두 손잡이의 기울기·지나는 점·y절편을 분수로 정확히', () => {
  const one: [bigint, bigint] = [1n, 1n];
  const tan = { slope: '2', through: ['1', '0'] as [string, string] };
  const r = gradeLine({ i: 0, j: -2 }, { i: 2, j: 2 }, one, one, tan);
  assert.equal(r.ok, true);
  assert.equal(r.slope, '2');
  const wrongSlope = gradeLine({ i: 0, j: -1 }, { i: 1, j: 0 }, one, one, tan);
  assert.equal(wrongSlope.ok, false);
  assert.equal(wrongSlope.slopeOk, false);
  assert.equal(wrongSlope.throughOk, true);
  const missP = gradeLine({ i: 0, j: 0 }, { i: 1, j: 2 }, one, one, tan);
  assert.equal(missP.slopeOk, true);
  assert.equal(missP.throughOk, false);
  // 세로선은 기울기가 없다
  const v = gradeLine({ i: 1, j: 0 }, { i: 1, j: 2 }, one, one, tan);
  assert.equal(v.vertical, true);
  assert.equal(v.ok, false);
  // 칸 간격 1/2: 칸 번호 (0,0)→(1,1) 은 기울기 1
  const half: [bigint, bigint] = [1n, 2n];
  assert.equal(gradeLine({ i: 0, j: 0 }, { i: 1, j: 1 }, half, half, { slope: '1' }).ok, true);
  // y절편
  assert.equal(
    gradeLine({ i: 1, j: 1 }, { i: 2, j: 3 }, one, one, { intercept: '-1', slope: '2' }).ok,
    true,
  );
  assert.equal(gradeLine({ i: 1, j: 1 }, { i: 2, j: 3 }, one, one, { intercept: '1' }).ok, false);
});

test('곡선 긋기: 범위를 충분히 덮고 대부분 허용 오차 안이면 통과', () => {
  const f = (x: number) => x / 2;
  const along = (g: (x: number) => number, from: number, to: number) =>
    Array.from({ length: 60 }, (_, k) => {
      const x = from + ((to - from) * k) / 59;
      return [x, g(x)] as [number, number];
    });
  assert.equal(SKETCH_HIT, 0.85);
  assert.equal(SKETCH_COVER, 0.8);
  assert.equal(gradeSketch(along(f, -2, 3), f, -2, 3, 0.5).ok, true);
  // 조금 흔들려도(허용 오차 안) 통과
  assert.equal(
    gradeSketch(
      along((x) => x / 2 + 0.3, -2, 3),
      f,
      -2,
      3,
      0.5,
    ).ok,
    true,
  );
  // 범위의 절반만 그렸으면 실패
  const half = gradeSketch(along(f, -2, 0.5), f, -2, 3, 0.5);
  assert.equal(half.ok, false);
  assert.ok(half.coverage < 0.8);
  // 다른 곡선이면 실패
  assert.equal(
    gradeSketch(
      along((x) => x, -2, 3),
      f,
      -2,
      3,
      0.5,
    ).ok,
    false,
  );
  // 거꾸로(오른쪽에서 왼쪽으로) 그어도 같다
  assert.equal(gradeSketch(along(f, 3, -2), f, -2, 3, 0.5).ok, true);
  assert.equal(gradeSketch([], f, -2, 3, 0.5).ok, false);
});
