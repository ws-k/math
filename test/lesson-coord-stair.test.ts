// 좌표평면 계단 표시 {stair:['P','Q']}(요청 64 — 3-가): 두 점 사이 가로 변(P 에서 Q 의 x 까지)과 세로 변(그 끝에서 Q 까지),
// 꺾인 곳의 직각 꺾쇠, 두 변의 길이 글자(축 단위). 할선 기울기 = 세로 길이 ÷ 가로 길이를 그림에서 읽게 한다.
// 본보기: math2-diff-coefficient secant(자동차 s=t² — Q 를 P 쪽으로 끌면 계단이 작아지며 평균 빠르기가 모임).
// 단원 JSON 은 고치지 않는다(단원 적용은 3-나) — 이 파일의 시험 장면으로 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordState,
  coordChecks,
  coordDef,
  draw,
  frame,
  type Item,
  initial,
  labelWidth,
  nameWidth,
  parseCoord,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

const secantRaw = (stair: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: '7/2', step: '1/2', name: '시간', unit: '초' },
  y: { min: 0, max: 10, step: 1, name: '거리', unit: 'm' },
  objects: [
    { id: 'f', curve: 'x**2', label: '$s=t^2$' },
    { id: 'P', point: { on: 'f', x: 1 }, name: 'P' },
    { id: 'Q', point: { on: 'f', x: 3, drag: 'x', snap: '1/10' }, name: 'Q' },
    { secant: ['P', 'Q'] },
    { stair: ['P', 'Q'], ...stair },
    { readout: 'slope(P,Q)', label: 'P~Q 평균 빠르기' },
  ],
  ...over,
});

const atQ = (p: ReturnType<typeof parseCoord>, i: number): CoordState => {
  const s = initial(p);
  return { ...s, pts: { ...s.pts, Q: { i, j: 0 } } };
};
const its = (p: ReturnType<typeof parseCoord>, s: CoordState) => draw(p, s, BOX).items;
const one = (xs: Item[], key: string) => {
  const it = xs.find((x) => x.key === key);
  assert.ok(it, key);
  return it;
};
const nums = (d: string) => (d.match(/-?[\d.]+/g) ?? []).map(Number);

test('계단: P 에서 가로로 Q 의 x 까지, 거기서 세로로 Q 까지 — 꺾인 곳에 직각 꺾쇠', () => {
  const p = parseCoord(secantRaw());
  const f = frame(BOX, p);
  const xs = its(p, atQ(p, 30));
  const leg = one(xs, 'z4');
  assert.ok(leg.t === 'path');
  const [PX, PY] = toPx(p, f, 1, 1);
  const [CX, CY] = toPx(p, f, 3, 1);
  const [QX, QY] = toPx(p, f, 3, 9);
  const n = nums(leg.d);
  const want = [PX, PY, CX, CY, QX, QY];
  assert.equal(n.length, 6, leg.d);
  assert.ok(
    want.every((w, i) => Math.abs((n[i] ?? Number.NaN) - w) < 0.06),
    leg.d,
  );
  assert.equal(leg.cls, 'stair');
  const mark = one(xs, 'zq4');
  assert.ok(mark.t === 'path' && mark.d !== '' && mark.cls === 'rmark');
});

test('길이 글자: 가로 = |Δx| 와 가로 단위, 세로 = |Δy| 와 세로 단위 — Q 를 P 왼쪽으로 끌어도 길이(음수 아님)', () => {
  const p = parseCoord(secantRaw());
  const txt = (s: CoordState) =>
    ['zx4', 'zy4'].map((k) => {
      const it = one(its(p, s), k);
      assert.ok(it.t === 'label');
      return it.hidden ? null : it.text;
    });
  assert.deepEqual(txt(atQ(p, 30)), ['2 초', '8 m']);
  assert.deepEqual(txt(atQ(p, 15)), ['0.5 초', '1.25 m']);
  // Q 가 P 왼쪽(t=0.5): 가로 0.5, 세로 0.75 — 그림의 변 방향이 부호를 보인다
  assert.deepEqual(txt(atQ(p, 5)), ['0.5 초', '0.75 m']);
  // 소수 자리 digits(기본 2)
  const q = parseCoord(secantRaw({ digits: 1 }));
  const it = one(its(q, atQ(q, 11)), 'zy4');
  assert.ok(it.t === 'label');
  assert.equal(it.text, '0.2 m');
});

test('두 점이 겹치면 계단·꺾쇠·글자를 모두 숨기고, 세로 변이 0 이면 세로 변과 꺾쇠·세로 글자만 숨긴다', () => {
  const p = parseCoord(secantRaw());
  const xs = its(p, atQ(p, 10));
  const leg = one(xs, 'z4');
  assert.ok(leg.t === 'path' && leg.d === '');
  const m = one(xs, 'zq4');
  assert.ok(m.t === 'path' && m.d === '');
  for (const k of ['zx4', 'zy4']) {
    const it = one(xs, k);
    assert.ok(it.t === 'label' && it.hidden);
  }
  // 같은 높이 두 점(가로 선분 하나)
  const h = parseCoord({
    ...secantRaw(),
    objects: [
      { id: 'A', point: { x: 0, y: 2 }, name: 'A' },
      { id: 'B', point: { x: 2, y: 2, drag: 'xy' }, name: 'B' },
      { stair: ['A', 'B'] },
    ],
  });
  const ys = its(h, initial(h));
  const d = one(ys, 'z2');
  assert.ok(d.t === 'path' && nums(d.d).length === 4);
  const zq = one(ys, 'zq2');
  assert.ok(zq.t === 'path' && zq.d === '');
  const zy = one(ys, 'zy2');
  const zx = one(ys, 'zx2');
  assert.ok(zy.t === 'label' && zy.hidden && zx.t === 'label' && !zx.hidden);
});

test('끄는 동안 렌더 0회의 바탕: Q 를 옮겨도 key 가 같고 경로·글자만 바뀐다', () => {
  const p = parseCoord(secantRaw());
  const a = its(p, atQ(p, 30));
  const b = its(p, atQ(p, 12));
  assert.deepEqual(
    a.map((x) => x.key),
    b.map((x) => x.key),
  );
  const ta = one(a, 'zy4');
  const tb = one(b, 'zy4');
  assert.ok(ta.t === 'label' && tb.t === 'label' && ta.text !== tb.text);
});

test('글자는 그림 안: 변 바깥쪽에 두되 그림 끝을 넘으면 안쪽으로 당긴다', () => {
  const p = parseCoord(secantRaw());
  const f = frame(BOX, p);
  for (const i of [0, 5, 15, 30, 35]) {
    for (const k of ['zx4', 'zy4']) {
      const it = one(its(p, atQ(p, i)), k);
      assert.ok(it.t === 'label');
      if (it.hidden) continue;
      assert.ok(it.x >= f.l - 0.5 && it.y <= f.b + 0.5 && it.y - 10 >= f.t - 0.5, `${i} ${k}`);
    }
  }
});

test('형식 오류: 같은 점 두 번 · 늘 같은 두 점(겹친 고정 점) · 숨긴 점 · 모르는 칸 · 같은 계단 두 번', () => {
  assert.throws(() => parseCoord(secantRaw({ stair: ['P', 'P'] })), /같은 점/);
  assert.throws(() => parseCoord(secantRaw({ stair: ['P', 'Z'] })), /앞에 없는 점 Z/);
  assert.throws(() => parseCoord(secantRaw({ wide: 1 })), /모르는 칸 wide/);
  assert.throws(() => parseCoord(secantRaw({ digits: 7 })), /digits/);
  // 숨긴 점(맞힌 뒤 공개)은 가리키지 못한다 — 계단 글자가 숨긴 자리를 드러낸다
  const hidden = {
    ...secantRaw(),
    objects: [
      ...secantRaw().objects.slice(0, 3),
      { id: 'H', point: { x: 2, y: 4 }, hide: true },
      { stair: ['P', 'H'] },
    ],
    goal: { approach: ['Q', 'P'] },
  };
  assert.throws(() => parseCoord(hidden), /숨긴 점 H/);
  const fixed = {
    ...secantRaw(),
    objects: [
      { id: 'A', point: { x: 1, y: 2 } },
      { id: 'B', point: { x: 1, y: 5 } },
      { stair: ['A', 'B'] },
    ],
  };
  assert.throws(() => parseCoord(fixed), /가로 변이 늘 0/);
  const twice = {
    ...secantRaw(),
    objects: [...secantRaw().objects, { stair: ['Q', 'P'] }],
  };
  assert.throws(() => parseCoord(twice), /같은 계단이 두 번/);
  // 끄는 점에 기대면 닿는 자리 중 하나라도 보이면 된다(무거운 검사)
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(secantRaw())));
});

test('검산: 닿는 상태마다 가로·세로 길이 = sympy Abs(원문 식의 차)', () => {
  const p = parseCoord(secantRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('계단'));
  assert.deepEqual(
    cs.map((c) => c.name),
    ['계단 P-Q 가로', '계단 P-Q 세로'],
  );
  const v = cs[1] as { expr: string; points: unknown[] };
  // 곡선 식 x**2 가 그대로(앱이 구한 y 를 옮겨 적지 않음)
  assert.match(v.expr, /Abs\(.*x\*\*2/);
  assert.equal(v.points.length, 36);
  const r = runChecks(coordChecks(p));
  assert.ok(r.ok, r.out);
  // 앱 값을 비틀면 잡힌다
  const bad = cs.map((c) => ({
    ...c,
    values: (c as { values: number[] }).values.map((x, k) => (k === 3 ? x + 0.1 : x)),
  }));
  const r2 = runChecks(bad);
  assert.equal(r2.ok, false);
});

/** 그린 글자 항목의 상자(왼쪽 위 기준) — 계단 글자는 11px 굵게(labelWidth), 점 이름표는 13px 굵게(nameWidth) */
const box = (it: Item) => {
  assert.ok(it.t === 'label');
  const w = it.cls === 'zlen' ? labelWidth(it.text) : nameWidth(it.text);
  return { l: it.x, t: it.y - 10, r: it.x + w, b: it.y + 3 };
};
const hit = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

test('글자 자리: 계단 글자는 점을 피해 변의 다른 쪽으로, 점 이름표는 계단 글자를 피한다(이름표 자리 고르기의 장애물)', () => {
  // A 오른쪽 위(이름표 첫 자리)가 짧은 가로 변 위 글자 '0.25' 자리와 겹치는 장면
  const raw = {
    mode: 'explore',
    x: { min: 0, max: 4, step: '1/4' },
    y: { min: 0, max: 4, step: '1/4' },
    objects: [
      { id: 'A', point: { x: 1, y: 2 }, name: 'A' },
      { id: 'B', point: { x: '5/4', y: 1 }, name: 'B' },
      { stair: ['A', 'B'] },
    ],
  };
  const p = parseCoord(raw);
  const xs = draw(p, initial(p), { w: 298, h: 200 }).items;
  const zx = one(xs, 'zx2');
  const nameA = one(xs, 'n0');
  assert.ok(!hit(box(zx), box(nameA)), `${JSON.stringify(zx)} ${JSON.stringify(nameA)}`);
  assert.doesNotThrow(() => coordDef.deep?.(p));
});

test('secant 꼴: Q 가 닿는 모든 칸에서 계단 글자가 이름표·점·서로와 겹치지 않는다(무거운 검사 통과)', () => {
  const p = parseCoord(secantRaw());
  assert.doesNotThrow(() => coordDef.deep?.(p));
  for (let i = 0; i <= 35; i++) {
    const xs = draw(p, atQ(p, i), { w: 298, h: 200 }).items;
    const zs = ['zx4', 'zy4'].map((k) => one(xs, k)).filter((it) => it.t === 'label' && !it.hidden);
    const names = ['n1', 'n2'].map((k) => one(xs, k));
    for (const z of zs) for (const n of names) assert.ok(!hit(box(z), box(n)), `Q 칸 ${i}`);
  }
});

test('무거운 검사: 계단 글자가 어느 쪽에 두어도 다른 점과 겹치면 형식 오류', () => {
  // 가로 변(A→(2,2)) 위·아래 글자 자리 여섯 곳(틈 7·17·27px)을 점 넷이 막는다 — 세로 한 칸 1/8 = 5px
  const raw = {
    mode: 'explore',
    x: { min: 0, max: 4, step: '1/4' },
    y: { min: 0, max: 4, step: '1/8' },
    objects: [
      { id: 'A', point: { x: 1, y: 2 } },
      { id: 'B', point: { x: 2, y: 1 } },
      { id: 'C', point: { x: '3/2', y: '19/8' } },
      { id: 'D', point: { x: '3/2', y: '13/8' } },
      { id: 'E', point: { x: '3/2', y: '23/8' } },
      { id: 'G', point: { x: '3/2', y: '9/8' } },
      { stair: ['A', 'B'] },
    ],
  };
  assert.throws(() => coordDef.deep?.(parseCoord(raw)), /계단 A-B 글자.*겹침/);
});

test('따라오는 끝점이 그림 밖이면 계단을 통째로 숨긴다(그림 안 글자만 홀로 뜨지 않게)', () => {
  const raw = {
    ...secantRaw(),
    objects: [
      ...secantRaw().objects.slice(0, 3),
      { id: 'H', point: { x: 'x(Q)', y: 'y(Q)+1' } },
      { stair: ['P', 'H'] },
    ],
  };
  const p = parseCoord(raw);
  // Q x=3 → H y=10(그림 끝 안) · Q x=3.5 → H y=13.25(밖)
  const inView = its(p, atQ(p, 30));
  const out = its(p, atQ(p, 35));
  assert.ok(((one(inView, 'z4') as { d: string }).d ?? '') !== '');
  const leg = one(out, 'z4');
  assert.ok(leg.t === 'path' && leg.d === '');
  for (const k of ['zq4']) {
    const it = one(out, k);
    assert.ok(it.t === 'path' && it.d === '');
  }
  for (const k of ['zx4', 'zy4']) {
    const it = one(out, k);
    assert.ok(it.t === 'label' && it.hidden);
  }
});

test('무거운 검사: 닿는 상태의 길이가 digits 자리로 정확히 안 적히면 오류(반올림한 길이로 기울기를 셈하게 되지 않게)', () => {
  // snap 1/10 → Δy = x²−1 은 소수 둘째 자리까지 — digits 1 이면 0.21 을 0.2 로 적는다
  assert.throws(() => coordDef.deep?.(parseCoord(secantRaw({ digits: 1 }))), /digits 를 올리/);
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(secantRaw())));
});
