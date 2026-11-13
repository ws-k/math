import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addUser,
  type CoordParams,
  coordChecks,
  dragPoint,
  draw,
  frame,
  goalMet,
  grade,
  gridAt,
  initial,
  keyMove,
  moveUser,
  parseCoord,
  pointXY,
  readout,
  removeUser,
  snapMult,
  tickText,
  toPx,
} from '../src/lesson/widgets/coord.ts';

const secantRaw = () => ({
  mode: 'explore',
  x: { min: 0, max: 1.6, step: '1/5' },
  y: { min: 0, max: 8, step: 1 },
  objects: [
    { id: 'fg', curve: 'x**5', label: '$y=x^5$' },
    { id: 'P', point: { on: 'fg', x: 1 }, name: 'P' },
    { id: 'Q', point: { on: 'fg', x: 1.5, drag: 'x', snap: '1/20' }, name: 'Q' },
    { secant: ['P', 'Q'] },
    { readout: 'slope(P,Q)', label: '할선 기울기' },
  ],
  goal: { approach: ['Q', 'P'] },
});

const tangentRaw = () => ({
  mode: 'line',
  x: { min: -2, max: 3, step: 1 },
  y: { min: -3, max: 4, step: 1 },
  objects: [
    { id: 'f', curve: '(x+1)*(x-1)' },
    { id: 'A', point: { on: 'f', x: 1 }, name: 'A' },
  ],
  task: { line: { tangent: { curve: 'f', at: 1 } } },
});

const BOX = { w: 340, h: 260 };

test('parse: 이름 붙은 객체와 참조를 타입 붙은 값으로', () => {
  const p = parseCoord(secantRaw());
  assert.equal(p.mode, 'explore');
  assert.deepEqual(
    p.objects.map((o) => o.kind),
    ['curve', 'point', 'point', 'secant', 'readout'],
  );
  assert.deepEqual(p.goal, { approach: ['Q', 'P'], within: 0 });
  const q = p.objects[2];
  assert.ok(q?.kind === 'point' && q.i === 30 && q.snapN === 0.05);
});

for (const [name, f] of [
  ['모르는 칸', (r: Record<string, unknown>) => (r.colour = 1)],
  [
    '모르는 객체 종류',
    (r: Record<string, unknown>) => (r.objects as unknown[]).push({ circle: 'x' }),
  ],
  [
    '앞에 없는 점을 가리킴',
    (r: Record<string, unknown>) => (r.objects as unknown[]).push({ secant: ['P', 'R'] }),
  ],
  [
    '곡선 식에 모르는 변수',
    (r: Record<string, unknown>) =>
      (((r.objects as { curve?: string }[])[0] as { curve: string }).curve = 'a*x**5'),
  ],
  [
    '곡선 식에 ^',
    (r: Record<string, unknown>) =>
      (((r.objects as { curve: string }[])[0] as { curve: string }).curve = 'x^5'),
  ],
  [
    '끄는 칸 위가 아닌 점',
    (r: Record<string, unknown>) =>
      (((r.objects as { point?: { x: number } }[])[2] as { point: { x: number } }).point.x = 1.53),
  ],
  ['explore 가 아닌데 goal', (r: Record<string, unknown>) => (r.mode = 'plot')],
  [
    '이름 중복',
    (r: Record<string, unknown>) =>
      (((r.objects as { id?: string }[])[2] as { id: string }).id = 'P'),
  ],
] as const) {
  test(`parse 오류: ${name}`, () => {
    const r = secantRaw() as unknown as Record<string, unknown>;
    f(r);
    assert.throws(() => parseCoord(r));
  });
}

test('parse 오류: 과제 조건', () => {
  const cases: [string, (r: Record<string, unknown>) => void][] = [
    ['찍기 모드 칸이 너무 많음', (r) => (r.x = { min: -10, max: 10, step: 1 })],
    ['직선 과제인데 π 칸', (r) => (r.x = { min: 0, max: 'pi', step: 'pi/6' })],
    [
      '접선과 기울기를 함께',
      (r) =>
        (r.task = {
          line: { tangent: { curve: 'f', at: 1 }, slope: { value: '2', check: '1+1' } },
        }),
    ],
    ['모드에 안 맞는 과제', (r) => (r.task = { pointsOn: { curve: 'f', count: 2 } })],
    ['과제 없음', (r) => delete r.task],
    ['답을 베낀 검산식', (r) => (r.task = { line: { slope: { value: '2', check: '2' } } })],
  ];
  for (const [name, f] of cases) {
    const r = tangentRaw() as unknown as Record<string, unknown>;
    f(r);
    assert.throws(() => parseCoord(r), name);
  }
});

test('할선: Q 를 P 로 끌면 접선이 되고, 읽는 기울기는 미분값(극한)', () => {
  const p = parseCoord(secantRaw());
  let s = initial(p);
  const ro = p.objects[4];
  assert.ok(ro?.kind === 'readout');
  const slope0 = readout(p, s, ro.expr);
  assert.ok(Math.abs(slope0 - (1.5 ** 5 - 1) / 0.5) < 1e-9);
  assert.equal(draw(p, s, BOX).items.find((i) => i.key === 'l3')?.t, 'line');
  assert.equal(goalMet(p, s), false);
  // P 자리(x=1)로 끌기
  const f = frame(BOX);
  const [px, py] = toPx(p, f, 1, 1);
  s = dragPoint(p, s, 'Q', px + 1, py, BOX);
  assert.deepEqual(pointXY(p, s, 'Q'), [1, 1]);
  assert.equal(goalMet(p, s), true);
  assert.ok(Math.abs(readout(p, s, ro.expr) - 5) < 1e-12);
  const line = draw(p, s, BOX).items.find((i) => i.key === 'l3');
  assert.ok(line?.t === 'line' && line.cls === 'tan' && !line.hidden);
  // 그릴 목록의 항목 key 는 상태가 바뀌어도 같다(끄는 동안 직접 적용하려고)
  assert.deepEqual(
    draw(p, s, BOX).items.map((i) => i.key),
    draw(p, initial(p), BOX).items.map((i) => i.key),
  );
});

test('끌기: 한 칸이 너무 작으면 몇 칸씩 묶어 움직인다(1·2·5·10 배)', () => {
  assert.equal(snapMult(10, 8), 1);
  assert.equal(snapMult(5, 8), 2);
  assert.equal(snapMult(2, 8), 5);
  assert.equal(snapMult(0.5, 8), 20);
});

test('방향키: 곡선 위 점은 끄는 간격 한 칸, 범위 밖으로 안 나감', () => {
  const p = parseCoord(secantRaw());
  const s = initial(p);
  const r = keyMove(p, s, 'Q', 'ArrowLeft');
  assert.ok(r);
  assert.equal(pointXY(p, r, 'Q')[0], 1.45);
  let t = s;
  for (let k = 0; k < 10; k++) t = keyMove(p, t, 'Q', 'ArrowRight') ?? t;
  assert.equal(pointXY(p, t, 'Q')[0], 1.6);
  assert.equal(keyMove(p, s, 'Q', 'a'), null);
});

test('직선 과제: 접선의 기울기·접점은 곡선에서 계산하고, 두 손잡이로 채점', () => {
  const p = parseCoord(tangentRaw());
  assert.ok(p.task?.kind === 'line');
  assert.deepEqual(p.task.tangent, { curve: 'f', at: '1', slope: '2', y: '0' });
  const s = initial(p);
  assert.equal(s.user.length, 2);
  assert.equal(grade(p, s).ok, false);
  const right = {
    ...s,
    user: [
      { i: 0, j: -2 },
      { i: 2, j: 2 },
    ],
  };
  assert.equal(grade(p, right).ok, true);
  const parallel = {
    ...s,
    user: [
      { i: 0, j: 0 },
      { i: 1, j: 2 },
    ],
  };
  assert.match(grade(p, parallel).why, /기울기는 맞아요/);
  const vertical = {
    ...s,
    user: [
      { i: 1, j: 0 },
      { i: 1, j: 2 },
    ],
  };
  assert.match(grade(p, vertical).why, /세로선/);
  // 그리는 동안 기울기가 늘 보인다
  assert.deepEqual(
    draw(p, right, BOX).readouts.find((r) => r.key === 'uslope'),
    { key: 'uslope', label: '그린 직선의 기울기', text: '2' },
  );
});

test('검산 항목: 곡선 parity, 미분 parity, 접선 기울기·접점은 sympy diff·subs 와 대조, 풀 수 있나', () => {
  const p = parseCoord(tangentRaw());
  const c = coordChecks(p);
  const names = c.map((i) => i.name);
  assert.deepEqual(names, ['곡선 f 계산', '곡선 f 미분', '접선 기울기', '접점', '풀 수 있나']);
  assert.deepEqual(c[2], {
    name: '접선 기울기',
    answer: '2',
    answerType: 'fraction',
    check: 'diff((x+1)*(x-1),x).subs(x,1)',
  });
  assert.deepEqual(c[4], {
    name: '풀 수 있나',
    kind: 'plot',
    view: { x: ['-2', '3'], y: ['-3', '4'], sx: '1', sy: '1' },
    task: 'line',
    slope: '2',
    through: ['1', '0'],
  });
  const par = c[0] as { values: (number | null)[]; points: Record<string, string>[] };
  assert.equal(par.points.length, 9);
  assert.equal(par.values[0], 3);
});

test('점 찍기: 탭으로 더하고, 같은 자리는 한 번만, 눌러서 지우고, 끌어 옮긴다', () => {
  const p = parseCoord({
    mode: 'plot',
    x: { min: -2, max: 3, step: 1 },
    y: { min: -3, max: 4, step: 1 },
    objects: [{ id: 'f', curve: 'x**2-1' }],
    task: { pointsOn: { curve: 'f', count: 3 } },
  });
  let s = initial(p);
  s = addUser(s, gridAt(p, -1.2, 0.3));
  s = addUser(s, gridAt(p, -1, 0));
  assert.deepEqual(s.user, [{ i: -1, j: 0 }]);
  s = addUser(s, { i: 0, j: -1 });
  s = addUser(s, { i: 2, j: 2 });
  assert.match(grade(p, s).why, /곡선 위에 있지 않은 점이 1개/);
  const f = frame(BOX);
  const [px, py] = toPx(p, f, 2, 3);
  s = moveUser(p, s, 2, px, py, BOX);
  assert.equal(grade(p, s).ok, true);
  s = removeUser(s, 0);
  assert.match(grade(p, s).why, /3개 이상/);
  // 범위 밖을 누르면 가장 가까운 칸 점(범위 안)
  assert.deepEqual(gridAt(p, 9, 9), { i: 3, j: 4 });
});

test('점 하나 찍기: 목표 칸 번호는 검산식 값/칸 간격과 같아야(검산 항목)', () => {
  const p = parseCoord({
    mode: 'plot',
    x: { min: 0, max: '2*pi', step: 'pi/6' },
    y: { min: -1, max: 1, step: '1/2' },
    objects: [{ id: 'f', curve: 'sin(x)' }],
    task: {
      point: {
        x: { value: 'pi/6', check: 'asin(Rational(1,2))' },
        y: { value: '1/2', check: 'sin(pi/6)' },
      },
    },
  });
  assert.ok(p.task?.kind === 'point' && p.task.i === 1 && p.task.j === 1);
  const c = coordChecks(p);
  assert.deepEqual(
    c.filter((i) => i.name.startsWith('목표')),
    [
      { name: '목표 x', answer: 'pi/6', answerType: 'expr', check: 'asin(Rational(1,2))' },
      { name: '목표 y', answer: '1/2', answerType: 'fraction', check: 'sin(pi/6)' },
      {
        name: '목표 x 칸',
        answer: '1',
        answerType: 'int',
        check: 'sympify("(asin(Rational(1,2)))/(pi/6)")',
      },
      { name: '목표 y 칸', answer: '1', answerType: 'int', check: 'sympify("(sin(pi/6))/(1/2)")' },
    ],
  );
  assert.equal(grade(p, { ...initial(p), user: [{ i: 1, j: 1 }] }).ok, true);
});

test('눈금 글자: 분수 칸·π 칸', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: '2*pi', step: 'pi/6' },
    y: { min: -1, max: 1, step: '1/2' },
    objects: [{ id: 'f', curve: 'sin(x)' }],
  }) as CoordParams;
  assert.equal(tickText(p.x, 1), 'π/6');
  assert.equal(tickText(p.x, 3), 'π/2');
  assert.equal(tickText(p.x, 6), 'π');
  assert.equal(tickText(p.x, 12), '2π');
  assert.equal(tickText(p.y, -1), '−1/2');
  assert.equal(tickText(p.y, 2), '1');
});

test('곡선 긋기: 그은 선을 곡선과 견준다', () => {
  const p = parseCoord({
    mode: 'sketch',
    x: { min: -2, max: 3, step: 1 },
    y: { min: -3, max: 4, step: 1 },
    objects: [{ id: 'f', curve: 'x/2' }],
    task: { sketch: { curve: 'f', tol: '1/2' } },
  });
  const stroke = Array.from({ length: 40 }, (_, k) => {
    const x = -2 + (5 * k) / 39;
    return [x, x / 2 + 0.2] as [number, number];
  });
  assert.equal(grade(p, { ...initial(p), stroke }).ok, true);
  assert.match(grade(p, { ...initial(p), stroke: stroke.slice(0, 15) }).why, /끝까지/);
  assert.throws(() =>
    parseCoord({
      mode: 'sketch',
      x: { min: -2, max: 3, step: 1 },
      y: { min: -3, max: 4, step: 1 },
      objects: [{ id: 'f', curve: 'x/2' }],
      task: { sketch: { curve: 'f', tol: 2 } },
    }),
  );
});

test('슬라이더: 곡선 식에 쓰는 값, 과제 곡선에는 못 씀', () => {
  const raw = {
    mode: 'explore',
    x: { min: -2, max: 2, step: 1 },
    y: { min: -4, max: 4, step: 1 },
    sliders: [{ id: 'a', min: -2, max: 2, step: '1/2', value: 1, label: '$a$' }],
    objects: [{ id: 'f', curve: 'a*x**2' }],
  };
  const p = parseCoord(raw);
  const s = initial(p);
  assert.deepEqual(s.vars, { a: 1 });
  const c = coordChecks(p);
  assert.deepEqual((c[0] as { points: Record<string, string>[] }).points[0], { x: '-2', a: '1' });
});
