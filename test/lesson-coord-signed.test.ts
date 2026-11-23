// 좌표평면 조각 ③ 나머지: 부호별 칠하기, 끝이 점을 따라가는 칠하기, 칠한 영역의 부호 있는 합(net)·부호 뗀 합(abs),
// 두 곡선 사이 칠하기의 넓이. 본보기는 math2-area-distance 의 산책(v=4−2t, 0~4시간)과 도로·강 사이 땅.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  absCheckSym,
  type CoordParams,
  type CoordState,
  coordChecks,
  coordDef,
  draw,
  goalHits,
  initial,
  parseCoord,
  rationalRoots,
} from '../src/lesson/widgets/coord.ts';
import { q } from '../src/lesson/widgets/q.ts';
import { runChecks, tamper } from './widget-verify.ts';

const BOX = { w: 298, h: 209 };

const walkRaw = (over: Record<string, unknown> = {}) => ({
  mode: 'explore',
  x: { min: 0, max: 4, step: 1, name: '시간', unit: '시간' },
  y: { min: -4, max: 4, step: 2, name: '속도', unit: 'km/시', areaUnit: 'km' },
  objects: [
    { id: 'v', curve: '4-2*x' } as Record<string, unknown>,
    { id: 'B', point: { on: 'v', x: 1, drag: 'x', snap: '1/4' } },
    { id: 'F', fill: { top: 'v', x: [0, 'B'] }, sign: true },
    { readout: 'x(B)', label: '시각' },
    { readout: 'net(F)', label: '집 기준 위치' },
    { readout: 'abs(F)', label: '걸은 거리' },
  ],
  ...over,
});

/** B 를 시각 t 에 놓은 상태(곡선 위 점의 칸 번호 = t ÷ 1/4) */
const at = (p: CoordParams, t: number): CoordState => ({
  ...initial(p),
  pts: { B: { i: Math.round(t * 4), j: 0 } },
});
const texts = (p: CoordParams, s: CoordState) => draw(p, s, BOX).readouts.map((r) => r.text);
const paths = (p: CoordParams, s: CoordState) =>
  draw(p, s, BOX).fills.flatMap((it) => (it.t === 'path' ? [[it.key, it.cls, it.d] as const] : []));

test('부호별 칠하기: 위 경계가 아래 경계보다 위인 곳(+)과 아래인 곳(−)을 다른 경로·색으로', () => {
  const p = parseCoord(walkRaw());
  // t=3: 0~2 는 가는 쪽(+), 2~3 은 오는 쪽(−)
  const d = paths(p, at(p, 3));
  assert.deepEqual(
    d.map(([k, cls, path]) => [k, cls, path.length > 0]),
    [
      ['f2', 'fillr pos', true],
      ['f2n', 'fillr neg', true],
    ],
  );
  // t=1: 아직 가는 중 — 오는 쪽 경로는 비지만 항목은 남는다(끄는 동안 key 가 바뀌지 않게)
  const d1 = paths(p, at(p, 1));
  assert.deepEqual(
    d1.map(([k, , path]) => [k, path.length > 0]),
    [
      ['f2', true],
      ['f2n', false],
    ],
  );
  // 경계를 넘는 곳(t=2)에서 끊긴다: 오는 쪽 경로의 왼쪽 끝 x 가 t=2 의 화면 자리
  const neg = d.find(([k]) => k === 'f2n')?.[2] ?? '';
  const pos = d.find(([k]) => k === 'f2')?.[2] ?? '';
  const xs = (s: string) => [...s.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
  assert.ok(Math.abs(Math.min(...xs(neg)) - Math.max(...xs(pos))) < 0.2);
});

test('끝이 점을 따라가는 칠하기: B 를 0 에 두면 비고, 옮기면 그만큼 칠한다', () => {
  const p = parseCoord(walkRaw());
  assert.ok(paths(p, at(p, 0)).every(([, , d]) => d === ''));
  const w = (t: number) => {
    const d = paths(p, at(p, t))[0]?.[2] ?? '';
    const xs = [...d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(w(1) > 0);
  assert.ok(Math.abs(w(2) - 2 * w(1)) < 0.5);
});

test('읽는 값 net·abs: 부호 있는 합 = 집 기준 위치, 부호 뗀 합 = 걸은 거리(속도 0 인 곳에서 끊어서)', () => {
  const p = parseCoord(walkRaw());
  assert.deepEqual(texts(p, at(p, 1)), ['1 시간', '3 km', '3 km']);
  assert.deepEqual(texts(p, at(p, 2)), ['2 시간', '4 km', '4 km']);
  // t=3: 4 km 갔다가 1 km 돌아옴 — 위치 3, 거리 5
  assert.deepEqual(texts(p, at(p, 3)), ['3 시간', '3 km', '5 km']);
  assert.deepEqual(texts(p, at(p, 4)), ['4 시간', '0 km', '8 km']);
  // t=1/4: 15/16 — 반올림이 값을 바꾸면 ≈
  assert.deepEqual(texts(p, at(p, 0.25)).slice(1), ['≈ 0.94 km', '≈ 0.94 km']);
});

test('두 곡선 사이 칠하기의 넓이: 위 − 아래를 교점부터 교점까지(고정 구간)', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -2, max: 3, step: 1 },
    y: { min: -1, max: 9, step: 1 },
    objects: [
      { id: 'c', curve: 'x**2' },
      { id: 'l', curve: 'x+2' },
      { id: 'L', fill: { top: 'l', bottom: 'c', x: [-1, 2] }, look: 'soil', name: '땅' },
      { readout: 'abs(L)', label: '넓이', frac: true },
      { readout: 'net(L)', label: '부호 있는 합', frac: true },
    ],
  });
  assert.deepEqual(texts(p, initial(p)), ['9/2', '9/2']);
});

test('칠하기 형식 오류: 부호별 칠하기 + 재질, 끝 점이 시작보다 왼쪽으로 감, 없는 점', () => {
  const objs = walkRaw().objects;
  const with3 = (o: Record<string, unknown>) =>
    parseCoord(walkRaw({ objects: [objs[0], objs[1], o] }));
  // 색이 곧 부호라 무늬 재질과 함께 쓰지 않는다
  assert.throws(
    () => with3({ id: 'F', fill: { top: 'v', x: [0, 'B'] }, sign: true, look: 'soil' }),
    /부호별 칠하기/,
  );
  assert.throws(() => with3({ id: 'F', fill: { top: 'v', x: [0, 4] }, sign: 1 }), /true 만/);
  // B 는 0 까지 끌 수 있는데 시작이 1 이면 끝이 시작보다 왼쪽으로 간다
  assert.throws(() => with3({ fill: { top: 'v', x: [1, 'B'] } }), /시작보다 왼쪽/);
  assert.throws(() => with3({ fill: { top: 'v', x: [0, 'Q'] } }), /앞에 없는 점/);
  // 끝 점은 오른쪽 끝에만(시작은 수)
  assert.throws(() => with3({ fill: { top: 'v', x: ['B', 4] } }), /수가 아님|시작은 수/);
  assert.doesNotThrow(() => with3({ fill: { top: 'v', x: [0, 'B'] } }));
});

test('net·abs 형식 오류: 없는·이름 없는 칠하기, 숨긴 칠하기, 다항식 아님, 슬라이더 곡선, 무리수 근', () => {
  const one = (objects: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
    parseCoord({
      mode: 'explore',
      x: { min: 0, max: 4, step: 1 },
      y: { min: -4, max: 4, step: 1 },
      sliders: [{ id: 'a', min: 1, max: 3, step: 1, value: 1, label: 'a' }],
      objects,
      ...extra,
    });
  const ro = (s: string) => ({ readout: s, label: '합' });
  assert.throws(() => one([{ id: 'v', curve: '4-2*x' }, ro('net(F)')]), /앞에 없는 칠하기/);
  // 숨긴 칠하기(맞힌 뒤)의 넓이를 읽으면 맞히기 전에 답이 보인다
  assert.throws(
    () =>
      one(
        [
          { id: 'v', curve: '4-2*x' },
          { id: 'F', fill: { top: 'v', x: [0, 2] }, hide: true },
          ro('abs(F)'),
        ],
        { goal: { value: { of: 'value(a)', is: 2 }, hint: 'a 를 2 로' } },
      ),
    /숨긴 칠하기/,
  );
  assert.throws(
    () =>
      one([
        { id: 'v', curve: 'sqrt(x)' },
        { id: 'F', fill: { top: 'v', x: [0, 4] } },
      ]),
    /다항식/,
  );
  assert.throws(
    () =>
      one([
        { id: 'v', curve: 'a*x' },
        { id: 'F', fill: { top: 'v', x: [0, 4] } },
      ]),
    /슬라이더/,
  );
  // x²−2 는 0~4 안에서 √2 에서 부호가 바뀐다 — 부호 뗀 합을 분수로 정확히 끊을 수 없다
  assert.throws(
    () =>
      one([
        { id: 'v', curve: 'x**2-2' },
        { id: 'F', fill: { top: 'v', x: [0, 4] } },
      ]),
    /구간 안 무리수 근/,
  );
  // 이름(id)이 없는 칠하기는 다항식 아니어도 된다(넓이를 읽지 않음)
  assert.doesNotThrow(() =>
    one([{ id: 'v', curve: 'sqrt(x)' }, { fill: { top: 'v', x: [0, 4] } }]),
  );
});

test('abs 는 목표로 못 씀(검산이 상태마다 끊는 자리를 다시 찾아야 함) — net 은 됨', () => {
  assert.throws(
    () => parseCoord(walkRaw({ goal: { value: { of: 'abs(F)', is: 8 }, hint: '돌아올 때까지' } })),
    /부호 뗀 합/,
  );
  assert.doesNotThrow(() =>
    parseCoord(
      walkRaw({ goal: { value: { of: 'net(F)', is: 0, places: 2 }, hint: '집에 있는 때' } }),
    ),
  );
});

test('net 목표: 집 기준 위치가 0 인 두 때(출발·귀가) — 앱 판정 = sympy 판정', () => {
  const p = parseCoord(
    walkRaw({ goal: { value: { of: 'net(F)', is: 0, places: 2 }, hint: '집에 있는 때' } }),
  );
  coordDef.deep?.(p);
  assert.equal(goalHits(p, at(p, 0)).length, 1);
  assert.equal(goalHits(p, at(p, 4)).length, 1);
  assert.notDeepEqual(goalHits(p, at(p, 0)), goalHits(p, at(p, 4)));
  assert.deepEqual(goalHits(p, at(p, 2)), []);
  const gc = coordChecks(p).filter((c) => c.name === '목표 판정');
  const ok = runChecks(gc);
  assert.ok(ok.ok, ok.out);
});

test('net·abs 검산: 닿는 모든 끝 자리에서 앱 값 = sympy integrate(abs 는 sympy 가 찾은 근에서 끊어)', () => {
  const p = parseCoord(walkRaw());
  const cs = coordChecks(p).filter((c) => c.name.startsWith('칠하기 F'));
  // B 는 0~4 를 1/4 씩: 17자리 × 두 값
  assert.equal(cs.length, 17 * 2);
  const abs3 = cs.find((c) => c.name === '칠하기 F 부호 뗀 합 x=3');
  assert.ok(abs3 && 'answer' in abs3);
  assert.equal(abs3.answer, '5');
  const ok = runChecks(cs);
  assert.ok(ok.ok, ok.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
  // abs 검산이 근에서 끊는지: 부호 있는 합(3)을 답으로 적으면 잡는다
  assert.equal(runChecks([{ ...abs3, answer: '3' }]).ok, false);
});

test('고정 구간 칠하기의 net·abs 검산은 한 번씩', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -2, max: 3, step: 1 },
    y: { min: -1, max: 9, step: 1 },
    objects: [
      { id: 'c', curve: 'x**2' },
      { id: 'l', curve: 'x+2' },
      { id: 'L', fill: { top: 'l', bottom: 'c', x: [-1, 2] } },
      { readout: 'abs(L)', label: '넓이' },
    ],
  });
  const cs = coordChecks(p).filter((c) => c.name.startsWith('칠하기 L'));
  assert.deepEqual(
    cs.map((c) => ('answer' in c ? [c.name, c.answer] : [])),
    [['칠하기 L 부호 뗀 합', '9/2']],
  );
  assert.ok(runChecks(cs).ok);
});

test('다항식의 유리수 근: 서로 다른 근을 작은 것부터(0 인 다항식은 null)', () => {
  const poly = (...cs: (number | string)[]) => cs.map((c) => q(c));
  assert.deepEqual(rationalRoots(poly(4, -2)), [q(2)]);
  // x² − x − 2 = (x+1)(x−2)
  assert.deepEqual(rationalRoots(poly(-2, -1, 1)), [q(-1), q(2)]);
  // x³ − x² : 중근 0 은 하나로
  assert.deepEqual(rationalRoots(poly(0, 0, -1, 1)), [q(0), q(1)]);
  // 분수 계수 x²/30 − 1/30·x : 근 0, 1
  assert.deepEqual(rationalRoots(poly(0, '-1/30', '1/30')), [q(0), q(1)]);
  // 2x − 1 : 근 1/2
  assert.deepEqual(rationalRoots(poly(-1, 2)), [q('1/2')]);
  // x² − 2 : 유리수 근 없음
  assert.deepEqual(rationalRoots(poly(-2, 0, 1)), []);
  assert.deepEqual(rationalRoots(poly(5)), []);
  assert.equal(rationalRoots([]), null);
  // 공약수로 먼저 나눈다: 1000000(x² − 4) 는 상수항이 상한(10⁶)을 넘지만 x² − 4 와 근이 같다
  assert.deepEqual(rationalRoots(poly(-4000000, 0, 1000000)), [q(-2), q(2)]);
  // 공약수로 나눠도 계수가 상한을 넘으면 null(형식 검사가 막는다)
  assert.equal(rationalRoots(poly(10_000_000, -10_000_001, 1)), null);
});

test('abs 검산식 단독: 세 실근 삼차식(x³−3x+1)도 근을 모두 찾아 끊는다(solve 는 근을 버렸다)', () => {
  // 앱에서는 무리수 근이라 형식 오류지만, 검산식이 근을 빠뜨리지 않는지는 따로 본다
  // ∫_{-2}^{2}|x³−3x+1|dx ≈ 5.680 — 근을 하나도 못 찾으면 |∫ f| = 4
  const expr = absCheckSym('x**3-3*x+1', '-2', '2');
  const item = (value: string) => ({
    name: 'abs 삼차',
    kind: 'approx' as const,
    expr,
    digits: 3,
    value,
  });
  const ok = runChecks([item('5.680')]);
  assert.ok(ok.ok, ok.out);
  assert.equal(runChecks([item('4.000')]).ok, false);
});

test('소수 계수 곡선의 net·abs 검산도 분수로(nsimplify) — 0.30000000000000004 로 어긋나지 않게', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1 },
    y: { min: -2, max: 2, step: 1 },
    objects: [
      { id: 'v', curve: '0.1*(4-2*x)*3' },
      { id: 'B', point: { on: 'v', x: 1, drag: 'x', snap: '1/2' } },
      { id: 'F', fill: { top: 'v', x: [0, 'B'] } },
      { readout: 'net(F)', label: '위치' },
      { readout: 'abs(F)', label: '거리' },
    ],
  });
  const cs = coordChecks(p).filter((c) => c.name.startsWith('칠하기 F'));
  assert.equal(cs.length, 9 * 2);
  const ok = runChecks(cs);
  assert.ok(ok.ok, ok.out);
});

test('형식 오류: 부호별·끝 점 칠하기의 이름표는 자리(nameAt) 필수, 끝 점이 시작을 못 넘음, 같은 읽는 값 두 번', () => {
  const objs = walkRaw().objects;
  const with3 = (o: Record<string, unknown>, more: Record<string, unknown>[] = []) =>
    parseCoord(walkRaw({ objects: [objs[0], objs[1], o, ...more] }));
  // 부호별 칠하기는 위·아래가 엇갈린 꼬인 다각형이라 무게중심이 그림 밖으로 튄다
  assert.throws(() => with3({ fill: { top: 'v', x: [0, 4] }, sign: true, name: '길' }), /nameAt/);
  // 끝을 끄는 칠하기는 끄는 동안 이름표가 흔들린다
  assert.throws(() => with3({ fill: { top: 'v', x: [0, 'B'] }, name: '길' }), /nameAt/);
  assert.doesNotThrow(() =>
    with3({ fill: { top: 'v', x: [0, 'B'] }, sign: true, name: '길', nameAt: [1, 1] }),
  );
  // 고정 칠하기는 무게중심 그대로
  assert.doesNotThrow(() => with3({ fill: { top: 'v', x: [0, 2] }, name: '길' }));
  // 끌 수 없는 점이 시작 자리에 있으면 늘 빈 칠하기
  assert.throws(
    () =>
      parseCoord(
        walkRaw({
          objects: [
            objs[0],
            { id: 'B', point: { on: 'v', x: 0 } },
            { fill: { top: 'v', x: [0, 'B'] } },
          ],
        }),
      ),
    /칠할 곳이 없음/,
  );
  assert.throws(
    () =>
      with3({ id: 'F', fill: { top: 'v', x: [0, 'B'] } }, [
        { readout: 'net(F)', label: '위치' },
        { readout: 'net( F )', label: '위치 또' },
      ]),
    /같은 읽는 값/,
  );
});
