// 좌표평면 조각 ③-가: 축 이름·단위, 축척 같게, 읽는 값 단위 유도, 칠하기(재질·이름표·맞힌 뒤), 구분구적 직사각형
// (큰 어림·작은 어림 동시, 단조 곡선만, 정확한 분수 합). 본보기는 math2-definite 의 밭(강가 y=x²/30, 가로 0~30 m).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CoordParams,
  type CoordState,
  coordChecks,
  coordDef,
  draw,
  frame,
  goalHits,
  initial,
  MIN_BOX_H,
  NARROW_BOX_W,
  narrowFrame,
  parseCoord,
  readout,
  rootsBetween,
} from '../src/lesson/widgets/coord.ts';
import { q } from '../src/lesson/widgets/q.ts';
import { runChecks, tamper } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

const fieldRaw = () => ({
  mode: 'explore',
  equal: true,
  x: { min: 0, max: 30, step: 10, unit: 'm' },
  y: { min: -2, max: 30, step: 10, unit: 'm' },
  sliders: [{ id: 'n', min: 1, max: 30, step: 1, value: 1, label: '$n$' }],
  objects: [
    { id: 'f', curve: 'x**2/30' } as Record<string, unknown>,
    { fill: { top: 30, bottom: 'f', x: [0, 30] }, look: 'water', name: '강' },
    { fill: { top: 'f', x: [0, 30] }, look: 'soil', name: '밭' },
    { fill: { top: 0, bottom: -2, x: [0, 30] }, look: 'road', name: '길' },
    { id: 'R', rects: { of: 'f', x: [0, 30], n: 'n' } },
    { readout: 'sums(R)', label: '조각 넓이 합', digits: 0 },
  ],
});

const withN = (p: CoordParams, n: number): CoordState => ({ ...initial(p), vars: { n } });
const ro = (p: CoordParams, s: CoordState, k = 0) => draw(p, s, BOX).readouts[k]?.text;

test('축 이름·단위: 축 끝 글자와 읽는 값 단위(가로 → x, 세로 → y, 기울기 → 세로/가로)', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, name: '시간', unit: '분' },
    y: { min: 0, max: 16, step: 4, unit: 'm' },
    objects: [
      { id: 'f', curve: 'x**2' },
      { id: 'P', point: { on: 'f', x: 1, drag: 'x' } },
      { id: 'Q', point: { on: 'f', x: 3 } },
      { readout: 'x(P)', label: '시각' },
      { readout: 'y(P)', label: '높이' },
      { readout: 'slope(P,Q)', label: '평균 빠르기' },
    ],
  });
  assert.equal(p.x.name, '시간');
  assert.equal(p.x.unit, '분');
  const d = draw(p, initial(p), BOX);
  assert.deepEqual(
    d.readouts.map((r) => r.text),
    ['1 분', '1 m', '4 m/분'],
  );
  // 축 끝 글자는 그림 영역 오른쪽에 자리를 비워 둔다(눈금 글자와 겹치지 않게)
  assert.ok(frame(BOX, p).r < frame(BOX).r);
});

test('가로·세로 단위가 같으면 기울기는 단위 없음(m/m 이 아니라) — slopeUnit 이 있으면 그것', () => {
  const raw = (y: Record<string, unknown>) => ({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, unit: 'm' },
    y: { min: 0, max: 16, step: 4, unit: 'm', ...y },
    objects: [
      { id: 'f', curve: 'x**2' },
      { id: 'P', point: { on: 'f', x: 1 } },
      { id: 'Q', point: { on: 'f', x: 3 } },
      { readout: 'slope(P,Q)', label: '기울기' },
    ],
  });
  const p = parseCoord(raw({}));
  assert.equal(draw(p, initial(p), BOX).readouts[0]?.text, '4');
  const q2 = parseCoord(raw({ slopeUnit: '%' }));
  assert.equal(draw(q2, initial(q2), BOX).readouts[0]?.text, '4 %');
});

test('축 단위 형식 오류: 넓이 단위를 정할 수 없을 때(가로·세로 단위가 다르고 덮어쓰기 없음)', () => {
  const raw = (y: Record<string, unknown>) => ({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, unit: '시' },
    y: { min: 0, max: 8, step: 1, ...y },
    sliders: [{ id: 'n', min: 1, max: 8, step: 1, value: 2, label: 'n' }],
    objects: [
      { id: 'v', curve: '8-2*x' },
      { id: 'R', rects: { of: 'v', x: [0, 4], n: 'n' } },
      { readout: 'big(R)', label: '큰 어림' },
    ],
  });
  assert.throws(() => parseCoord(raw({ unit: 'km/시' })), /넓이 단위/);
  // 한쪽만 단위가 있어도 넓이 단위가 정해지지 않는다
  assert.throws(() => parseCoord(raw({})), /넓이 단위/);
  const p = parseCoord(raw({ unit: 'km/시', areaUnit: 'km' }));
  // n=2: 왼쪽 끝 높이 8·4 × 폭 2 = 24
  assert.equal(ro(p, initial(p)), '24 km');
});

test('축척 같게: 가로·세로 한 칸의 화면 길이가 같고, 남는 폭은 가운데로', () => {
  const p = parseCoord(fieldRaw());
  const f = frame(BOX, p);
  const ux = (f.r - f.l) / 30;
  const uy = (f.b - f.t) / 32;
  assert.ok(Math.abs(ux - uy) < 1e-9);
  const base = frame(BOX);
  // 세로가 모자라 세로에 맞추고, 가로는 줄어 가운데에 놓인다
  assert.equal(f.t, base.t);
  assert.equal(f.b, base.b);
  assert.ok(f.l > base.l);
});

test('가장 좁은 화면의 그림 영역(narrowFrame): 상자 298×200 에 축 글자·축척 같게를 반영한 실제 폭', () => {
  const p = parseCoord(fieldRaw());
  assert.deepEqual(narrowFrame(p), frame({ w: NARROW_BOX_W, h: MIN_BOX_H }, p));
  // 밭: 단위 (m) 자리를 비우고(폭 226.5) 축척 같게로 세로(160px, 32칸)에 맞춰 가로 30칸 = 150px
  const f = narrowFrame(p);
  assert.ok(Math.abs(f.r - f.l - 150) < 1e-9);
});

test('그림이 너무 작아지는 축 조합은 형식 오류(가장 좁은 화면 기본 그림 250×160 의 절반 아래)', () => {
  // 축척 같게 + 가로 40·세로 2 칸 범위: 세로 그림이 12.5px
  const raw = (y: Record<string, unknown>) => ({
    mode: 'explore',
    equal: true,
    x: { min: 0, max: 40, step: 10 },
    y,
    objects: [{ id: 'f', curve: 'x/40' }],
  });
  assert.throws(() => parseCoord(raw({ min: 0, max: 2, step: 1 })), /그림이 너무 작음/);
  // 세로 범위를 넓히면 그림 높이가 80px 이상 — 통과
  assert.doesNotThrow(() => parseCoord(raw({ min: 0, max: 20, step: 10 })));
  // 세로로 긴 축척 같게(가로 2·세로 40): 그림 폭이 8px
  assert.throws(
    () =>
      parseCoord({
        mode: 'explore',
        equal: true,
        x: { min: 0, max: 2, step: 1 },
        y: { min: 0, max: 40, step: 10 },
        objects: [{ id: 'f', curve: 'x' }],
      }),
    /그림이 너무 작음/,
  );
});

test('축 끝 글자는 글자 수가 아니라 폭(labelWidth)으로 제한 — 이름8+단위8 은 그림 폭을 57px 로 줄여 오류', () => {
  const raw = (x: Record<string, unknown>, y: Record<string, unknown> = {}) => ({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, ...x },
    y: { min: 0, max: 4, step: 1, ...y },
    objects: [{ id: 'f', curve: 'x' }],
  });
  assert.throws(
    () => parseCoord(raw({ name: '가나다라마바사아', unit: '자차카타파하가나' })),
    /축 끝 글자/,
  );
  // 한글 8자 이름만(88px)도 폭 상한을 넘는다
  assert.throws(() => parseCoord(raw({ name: '가나다라마바사아' })), /축 끝 글자/);
  // 세로축 글자도 같은 상한
  assert.throws(() => parseCoord(raw({}, { name: '가나다라마바사아' })), /축 끝 글자/);
  // 시간(분)·속력(km/시)은 통과
  assert.doesNotThrow(() =>
    parseCoord(raw({ name: '시간', unit: '분' }, { name: '속력', unit: 'km/시' })),
  );
});

test('칠하기: 곡선과 축·수평선 사이, 재질과 이름표, 그림 바탕(격자 아래)에 그린다', () => {
  const p = parseCoord(fieldRaw());
  const d = draw(p, initial(p), BOX);
  assert.equal(d.fills.length, 3);
  assert.deepEqual(
    d.fills.map((it) => (it.t === 'path' ? [it.look, it.d.length > 0] : null)),
    [
      ['water', true],
      ['soil', true],
      ['road', true],
    ],
  );
  const tags = d.items.filter((it) => it.t === 'label' && it.cls === 'tag');
  assert.deepEqual(
    tags.map((it) => (it.t === 'label' ? it.text : '')),
    ['강', '밭', '길'],
  );
  // 이름표는 칠한 영역 안(밭의 무게중심 x=22.5, y=9 → 그림 영역 안쪽)
  const f = frame(BOX, p);
  for (const t of tags)
    if (t.t === 'label') assert.ok(t.x > f.l && t.x < f.r && t.y > f.t && t.y < f.b + 1);
});

test('칠하기 형식 오류: 모르는 재질·범위 밖·맞힌 뒤 칠하기인데 목표 없음', () => {
  const raw = fieldRaw();
  const one = (o: Record<string, unknown>) =>
    parseCoord({ ...raw, objects: [raw.objects[0], o] as Record<string, unknown>[] });
  assert.throws(() => one({ fill: { top: 'f', x: [0, 30] }, look: 'lava' }), /look/);
  assert.throws(() => one({ fill: { top: 'f', x: [0, 40] } }), /화면 밖/);
  assert.throws(() => one({ fill: { top: 'g', x: [0, 30] } }), /곡선|수가 아님/);
  assert.throws(() => one({ fill: { top: 'f', x: [0, 30] }, hide: true }), /목표/);
});

test('맞힌 뒤 칠하기(hide): 목표를 이루기 전에는 경로가 비고, 이루면 칠한다', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1 },
    y: { min: 0, max: 8, step: 1 },
    sliders: [{ id: 'a', min: 0, max: 4, step: 1, value: 0, label: 'a' }],
    objects: [
      { id: 'f', curve: 'x+a' },
      { fill: { top: 'f', x: [0, 2] }, name: '땅', look: 'soil', hide: true },
    ],
    goal: { value: { of: 'value(a)', is: 2 }, hint: 'a 를 2 로' },
  });
  const s = initial(p);
  const before = draw(p, s, BOX);
  assert.equal(before.fills[0]?.t === 'path' && before.fills[0].d, '');
  const tag = before.items.find((it) => it.t === 'label');
  assert.ok(tag?.t === 'label' && tag.hidden);
  const after = draw(p, { ...s, solved: true }, BOX);
  assert.ok(after.fills[0]?.t === 'path' && after.fills[0].d.length > 0);
});

test('구분구적: n 조각의 큰 어림·작은 어림을 정확한 분수로, 읽는 값은 작은 ~ 큰 + 넓이 단위', () => {
  const p = parseCoord(fieldRaw());
  // n=30: 큰 어림 Σk²/30 (k=1..30) = 1891/6 ≈ 315, 작은 어림 Σk²/30 (k=0..29) = 1711/6 ≈ 285
  assert.equal(ro(p, withN(p, 30)), '≈ 285 ~ 315 m²');
  // n=1: 높이 30 짜리 한 조각과 높이 0 짜리 한 조각 — 정확히 떨어지면 ≈ 를 붙이지 않는다
  assert.equal(ro(p, withN(p, 1)), '0 ~ 900 m²');
  const r = draw(p, withN(p, 30), BOX).readouts[0];
  assert.deepEqual(
    r?.parts?.map((x) => x.cls),
    ['', 'lo', '', 'hi', ''],
  );
});

test('구분구적 그리기: 큰·작은 조각 경로 두 개(조각 수만큼 사각형), n 이 바뀌어도 항목 key 가 같다(끄는 동안 직접 적용)', () => {
  const p = parseCoord(fieldRaw());
  const keys = (n: number) => {
    const d = draw(p, withN(p, n), BOX);
    return [...d.fills, ...d.items].map((it) => it.key);
  };
  assert.deepEqual(keys(1), keys(30));
  const d = draw(p, withN(p, 7), BOX);
  const rects = d.items.filter((it) => it.t === 'path' && it.cls.startsWith('rect'));
  assert.equal(rects.length, 2);
  // 큰 어림은 7조각, 작은 어림은 첫 조각 높이가 f(0)=0 이라 6조각(높이 0 은 그리지 않음 — 가로축 위 선이 됨)
  assert.deepEqual(
    rects.map((it) => (it.t === 'path' ? it.d.split('M').length - 1 : 0)),
    [7, 6],
  );
  // 큰 어림을 먼저(아래), 작은 어림을 위에 — 노란 띠가 곧 두 어림의 차이
  assert.deepEqual(
    rects.map((it) => (it.t === 'path' ? it.cls.split(' ')[1] : '')),
    ['big', 'small'],
  );
});

test('구분구적: 내려가는 곡선이면 큰 어림이 왼쪽 끝 합', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, unit: 'm' },
    y: { min: 0, max: 8, step: 1, unit: 'm' },
    sliders: [{ id: 'n', min: 1, max: 8, step: 1, value: 2, label: 'n' }],
    objects: [
      { id: 'v', curve: '8-2*x' },
      { id: 'R', rects: { of: 'v', x: [0, 4], n: 'n' } },
      { readout: 'big(R)', label: '큰' },
      { readout: 'small(R)', label: '작은' },
      { readout: 'gap(R)', label: '차이' },
    ],
  });
  // n=2: 왼쪽 끝 높이 8·4 → 큰 24, 오른쪽 끝 4·0 → 작은 8, 차이 16
  assert.deepEqual(
    draw(p, initial(p), BOX).readouts.map((r) => r.text),
    ['24 m²', '8 m²', '16 m²'],
  );
});

test('구분구적: 조각 수를 모르는 상태(슬라이더 값 없음)면 읽는 값은 NaN·— (끝없이 돌지 않음)', () => {
  const raw = fieldRaw();
  const p = parseCoord({
    ...raw,
    objects: [...raw.objects, { readout: 'gap(R)', label: '차이', digits: 0 }],
  });
  const s = { ...initial(p), vars: {} };
  const ro = p.objects.find((o) => o.kind === 'readout' && o.expr.f === 'gap');
  assert.ok(ro?.kind === 'readout');
  assert.ok(Number.isNaN(readout(p, s, ro.expr)));
  assert.deepEqual(
    draw(p, s, BOX).readouts.map((r) => r.text),
    ['— ~ —', '—'],
  );
});

test('구분구적 형식 오류: 단조가 아님·다항식 아님·슬라이더 곡선·조각이 너무 좁음·n 이 정수 아님', () => {
  const base = (curve: string, rects: Record<string, unknown>, sl?: Record<string, unknown>) => ({
    mode: 'explore',
    x: { min: -2, max: 6, step: 1 },
    y: { min: -2, max: 30, step: 2 },
    sliders: [{ id: 'n', min: 1, max: 20, step: 1, value: 1, label: 'n', ...sl }],
    objects: [
      { id: 'f', curve },
      { id: 'R', rects: { of: 'f', x: [0, 4], n: 'n', ...rects } },
    ],
  });
  // x(x-2) 는 0~4 에서 내려갔다 오른다(x=1 에서 꺾임) — 오른쪽 끝 합이 큰 어림이 아니다
  assert.throws(() => parseCoord(base('x*(x-2)', {})), /기울기가 0 인 곳이 구간 안에 1곳/);
  // x³ 은 [-1,1] 에서 계속 오르지만 x=0 에서 기울기 0 — 끝점에서만 허용한다는 사실대로 알린다
  assert.throws(
    () => parseCoord({ ...base('x**3', { x: [-1, 1] }), y: { min: -2, max: 30, step: 2 } }),
    /끝점에서만/,
  );
  // 곡선이 가로축 아래로 가면 노란·초록 띠가 뒤집힌다(높이가 음수) — 형식 오류
  assert.throws(() => parseCoord(base('x-1', {})), /가로축 아래/);
  assert.doesNotThrow(() => parseCoord(base('x', {})));
  // 구간 끝에서만 기울기 0 인 곡선은 괜찮다(x² 는 0~4 에서 계속 오름)
  assert.doesNotThrow(() => parseCoord(base('x**2', {})));
  assert.throws(() => parseCoord(base('sqrt(x+1)', {})), /다항식/);
  assert.throws(() => parseCoord(base('x*n', {})), /슬라이더/);
  // 가로 400 중 0~4 를 20조각: 가장 좁은 화면에서 조각 폭이 1px 도 안 됨
  assert.throws(
    () => parseCoord({ ...base('x**2', {}), x: { min: 0, max: 400, step: 20 } }),
    /조각 폭/,
  );
  assert.throws(() => parseCoord(base('x**2', {}, { min: 0 })), /1 이상의 정수/);
  assert.throws(() => parseCoord(base('x**2', {}, { step: '1/2', max: 10 })), /1 이상의 정수/);
  assert.throws(() => parseCoord(base('x**2', { n: 'k' })), /슬라이더/);
});

test('구분구적 검산: 닿는 모든 n 의 두 합 = sympy summation, 넓이 = integrate', () => {
  const p = parseCoord(fieldRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('조각 R'));
  assert.equal(cs.length, 30 * 2 + 2);
  // 큰·작은 배정의 독립 검증: 닿는 모든 n 에서 앱의 작은 어림 ≤ sympy 정적분 ≤ 앱의 큰 어림
  const order = cs.find((c) => c.name.includes('≤ 넓이 ≤'));
  assert.ok(order && 'answer' in order);
  assert.equal(runChecks([order]).ok, true);
  // 배정이 뒤바뀐(큰 어림 자리에 작은 어림) 항목은 검산이 잡는다
  const bad = { ...order, check: order.check.replaceAll('1891/6', '1/6') };
  assert.equal(runChecks([bad]).ok, false);
  const big30 = cs.find((c) => c.name === '조각 R 큰 어림 n=30');
  assert.ok(big30 && 'answer' in big30);
  assert.equal(big30.answer, '1891/6');
  const area = cs.find((c) => c.name === '조각 R 넓이');
  assert.ok(area && 'answer' in area);
  assert.equal(area.answer, '300');
  const ok = runChecks(cs);
  assert.ok(ok.ok, ok.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

test('구분구적 목표: 두 어림의 차이 180·90·30 가 보기(n=5·10·30) — 앱 판정 = sympy 판정', () => {
  const raw = fieldRaw();
  const p = parseCoord({
    ...raw,
    objects: [...raw.objects, { readout: 'gap(R)', label: '차이', digits: 0 }],
    goal: { visit: { of: 'gap(R)', at: [180, 90, 30] }, hint: '조각을 늘려 보세요' },
  });
  coordDef.deep?.(p);
  assert.deepEqual(goalHits(p, withN(p, 5)), ['0']);
  assert.deepEqual(goalHits(p, withN(p, 10)), ['1']);
  assert.deepEqual(goalHits(p, withN(p, 30)), ['2']);
  assert.deepEqual(goalHits(p, withN(p, 4)), []);
  const gc = coordChecks(p).filter((c) => c.name === '목표 판정');
  const ok = runChecks(gc);
  assert.ok(ok.ok, ok.out);
});

test('다항식 구간 실근: 열린 구간 (a,b) 안의 서로 다른 실근 수(끝점 근은 빼고)', () => {
  const poly = (...cs: number[]) => cs.map((c) => q(c));
  // x(x-2) = x²-2x : 근 0, 2
  assert.equal(rootsBetween(poly(0, -2, 1), q(0), q(4)), 1);
  assert.equal(rootsBetween(poly(0, -2, 1), q(-1), q(4)), 2);
  assert.equal(rootsBetween(poly(0, -2, 1), q(0), q(2)), 0);
  // 2x : 근 0 이 끝점
  assert.equal(rootsBetween(poly(0, 2), q(0), q(30)), 0);
  // (x-1)² : 중근 1 은 하나로
  assert.equal(rootsBetween(poly(1, -2, 1), q(0), q(3)), 1);
  assert.equal(rootsBetween(poly(5), q(0), q(3)), 0);
  assert.equal(rootsBetween([], q(0), q(3)), null);
});
