// 도형판 3-다: 곡선(타원·쌍곡선)과 곡선 위 점 — 격자점이 아닌 자리(칸 밖 점)를 끌어 이차곡선의 정의
// (PF + PG 는 늘 2a, |PF − PG| 는 늘 2a)를 "끌어서 같게" 본다. 예전에는 곡선 위에 마침 놓인 격자점 몇 곳으로 대신했다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type ShapeParams,
  shapeDef,
  shDrag,
  shDraw,
  shGoalHits,
  shInit,
  shKey,
  shMeasures,
  shUnit,
} from '../src/lesson/widgets/shape.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;
const full = (raw: unknown) => {
  const p = parse(raw);
  shapeDef.deep?.(p);
  return p;
};

const ellipseRaw = () => ({
  grid: { w: 10, h: 8 },
  points: [
    { id: 'O', x: 5, y: 4, aux: true },
    { id: 'F', x: 1, y: 4 },
    { id: 'G', x: 9, y: 4 },
    { id: 'P', deg: 30, drag: true, on: { curve: 0 } },
  ],
  curves: [{ ellipse: { c: 'O', a: 5, b: 3 } }],
  segments: [
    ['P', 'F'],
    ['P', 'G'],
  ],
  measures: [{ len: ['P', 'F'] }, { len: ['P', 'G'] }, { sum: [0, 1] }],
  digits: 2,
  goal: { value: { of: 0, is: { of: 1 }, places: 2 }, hint: '두 길이가 같은 곳' },
});

test('타원 위 점: 어디로 끌어도 PF + PG = 10(2a), 곡선을 따라만 움직임', () => {
  const p = full(ellipseRaw());
  let s = shInit(p);
  for (let k = 0; k < 24; k++) {
    const m = shMeasures(p, s);
    assert.equal(m[2], 'PF + PG = 10', `${k}: ${m.join(' | ')}`);
    const P = s.pts.P as { x: number; y: number };
    assert.ok(Math.abs((P.x - 5) ** 2 / 25 + (P.y - 4) ** 2 / 9 - 1) < 1e-9, '타원 위');
    const t = shKey(p, s, 'P', 'ArrowRight');
    assert.ok(t);
    s = t;
  }
  // 끌기: 손가락에서 가장 가까운 곡선 위 자리로(맨 위 꼭짓점 (5,7) 쪽)
  const u = shUnit(p);
  const P0 = shInit(p).pts.P as { x: number; y: number };
  const t = shDrag(p, shInit(p), 'P', (5 - P0.x) * u, -(7.4 - P0.y) * u);
  assert.equal(t.pts.P?.deg, 90);
  assert.deepEqual(shGoalHits(p, t), ['P:5,7']);
  const d = shDraw(p, t);
  // 반지름 a·b 는 격자 한 칸(27.5px)의 5배·3배
  assert.match(String(mark(d, 'curve0')?.a.d), /^M [\d.]+ [\d.]+ A 137.5 82.5 /);
});

test('타원: sympy 가 곡선 위 자리를 다시 계산(측정값·목표 판정)', () => {
  const p = full(ellipseRaw());
  const cs = shapeDef.checks(p);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

const hyperRaw = () => ({
  grid: { w: 10, h: 8 },
  points: [
    { id: 'O', x: 5, y: 4, aux: true },
    { id: 'F', x: 0, y: 4 },
    { id: 'G', x: 10, y: 4 },
    { id: 'P', deg: 0, drag: true, on: { curve: 0 } },
  ],
  curves: [{ hyperbola: { c: 'O', a: 3, b: 4 } }],
  measures: [{ len: ['P', 'F'] }, { len: ['P', 'G'] }, { diff: [0, 1] }],
  digits: 2,
});

test('쌍곡선 위 점: 격자 안 자리만, 두 갈래 모두, |PF − PG| = 6(2a)', () => {
  const p = full(hyperRaw());
  let s = shInit(p);
  const seen = new Set<number>();
  for (let k = 0; k < 30; k++) {
    const P = s.pts.P as { x: number; y: number; deg?: number };
    seen.add(P.deg as number);
    assert.ok(P.x >= -1e-9 && P.x <= 10 + 1e-9 && P.y >= -1e-9 && P.y <= 8 + 1e-9, '격자 안');
    assert.equal(shMeasures(p, s)[2], '|PF − PG| = 6');
    s = shKey(p, s, 'P', 'ArrowRight') ?? s;
  }
  // 90°·270° 는 점이 무한히 멀어 없고, 오른쪽·왼쪽 갈래가 다 나온다
  assert.ok(!seen.has(90) && !seen.has(270));
  assert.ok(seen.has(0) && seen.has(180));
  const r = runChecks(shapeDef.checks(p));
  assert.ok(r.ok, r.out);
});

test('곡선 형식 오류', () => {
  const bad = (f: (r: ReturnType<typeof ellipseRaw>) => void) => {
    const r = ellipseRaw();
    f(r);
    return () => full(r);
  };
  assert.throws(
    bad((r) => {
      r.curves = [{ ellipse: { c: 'O', a: 6, b: 3 } }];
    }),
    /격자 밖/,
  );
  assert.throws(
    bad((r) => {
      (r.points[3] as { on: object }).on = { curve: 1 };
    }),
    /curve/,
  );
  assert.throws(
    bad((r) => {
      Object.assign(r.points[0] as object, { drag: true, aux: undefined });
    }),
    /고정/,
  );
  const h = hyperRaw();
  (h.points[3] as { deg: number }).deg = 90;
  assert.throws(() => full(h), /deg/);
});
