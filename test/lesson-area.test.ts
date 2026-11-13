import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  areaChecks,
  cellTex,
  type GrowParams,
  growLimit,
  growSteps,
  growView,
  initialTiles,
  lenSym,
  parseArea,
  rectangle,
  snapLen,
  splitTotal,
  type Tile,
  type TilesParams,
  XLEN,
} from '../src/lesson/widgets/areaModel.ts';

const grow = () =>
  parseArea({
    mode: 'grow',
    w: 'x**2',
    h: 'x**3',
    wLabel: '$f(x)=x^2$',
    hLabel: '$g(x)=x^3$',
    at: 1,
    max: '1/2',
    step: '1/20',
  }) as GrowParams;

test('split: 칸 넓이와 그 합 = 처음 곱(분배법칙)', () => {
  const p = parseArea({ mode: 'split', w: ['10', '3'], h: ['10', '2'] });
  assert.ok(p.mode === 'split');
  assert.equal(cellTex(p, 1, 0), '20');
  assert.deepEqual(splitTotal(p).value, '156');
  assert.deepEqual(areaChecks(p), [
    { name: '칸 넓이 합', answer: '156', answerType: 'fraction', check: '(10+3)*(10+2)' },
  ]);
  const q = parseArea({ mode: 'split', w: ['x', '2'], h: ['x', '3'] });
  assert.ok(q.mode === 'split');
  assert.equal(cellTex(q, 0, 0), 'x^{2}');
  assert.equal(cellTex(q, 1, 0), '3x');
  assert.equal(cellTex(q, 0, 1), '2x');
  assert.deepEqual(areaChecks(q)[0], {
    name: '칸 넓이 합',
    answer: '(x)*(x)+(2)*(x)+(x)*(3)+(2)*(3)',
    answerType: 'expr',
    check: 'expand((x+2)*(x+3))',
  });
});

test('grow: Δx 를 줄이면 모서리/Δx → 0, 띠 합/Δx → (fg)′', () => {
  const p = grow();
  assert.equal(growSteps(p), 10);
  const big = growView(p, 10);
  assert.ok(Math.abs(big.dw - 1.25) < 1e-12);
  assert.ok(Math.abs(big.right + big.top + big.corner - (1.5 ** 5 - 1)) < 1e-9);
  const small = growView(p, 1);
  assert.ok(small.cornerRate < big.cornerRate / 10);
  assert.ok(Math.abs(small.stripsRate - 5) < 0.5);
  const zero = growView(p, 0);
  assert.equal(zero.stripsRate, 5);
  assert.equal(zero.cornerRate, 0);
  assert.equal(growLimit(p), '5');
});

test('grow 검산 항목: 가로·세로·극한 parity + 곱의 미분 값은 sympy diff 와 대조', () => {
  const c = areaChecks(grow());
  assert.deepEqual(
    c.map((i) => i.name),
    ['가로 계산', '세로 계산', '띠 합의 극한', '곱의 미분 값'],
  );
  assert.deepEqual(c[3], {
    name: '곱의 미분 값',
    answer: '5',
    answerType: 'fraction',
    check: 'diff((x**2)*(x**3),x).subs(x,1)',
  });
});

test('grow 형식 오류: 줄어드는 길이·정수배 아닌 간격·모르는 칸', () => {
  const base = {
    mode: 'grow',
    w: 'x**2',
    h: 'x**3',
    wLabel: 'a',
    hLabel: 'b',
    at: 1,
    max: '1/2',
    step: '1/20',
  };
  assert.throws(() => parseArea({ ...base, w: '2-x' }));
  assert.throws(() => parseArea({ ...base, step: '1/3' }));
  assert.throws(() => parseArea({ ...base, colour: 1 }));
  assert.throws(() => parseArea({ ...base, mode: 'pie' }));
});

test('tiles: 빈틈·겹침 없이 놓으면 직사각형, 가로·세로가 인수', () => {
  const p = parseArea({
    mode: 'tiles',
    tiles: { x2: 1, x: 3, one: 2 },
    factor: '(x+1)*(x+2)',
  }) as TilesParams;
  const t = initialTiles(p);
  assert.equal(t.length, 6);
  assert.equal(rectangle(t), null);
  // x² 를 (0,0), x 세운 것 둘을 오른쪽(가로 x+1·x+2 자리), 누운 x 하나를 아래, 1 두 개를 모서리
  const L = (a: number, b: number) => ({ a, b });
  const placed: Tile[] = [
    { kind: 'x2', rot: false, at: { x: L(0, 0), y: L(0, 0) } },
    { kind: 'x', rot: true, at: { x: L(1, 0), y: L(0, 0) } },
    { kind: 'x', rot: true, at: { x: L(1, 1), y: L(0, 0) } },
    { kind: 'x', rot: false, at: { x: L(0, 0), y: L(1, 0) } },
    { kind: 'one', rot: false, at: { x: L(1, 0), y: L(1, 0) } },
    { kind: 'one', rot: false, at: { x: L(1, 1), y: L(1, 0) } },
  ];
  const r = rectangle(placed);
  assert.deepEqual(r, { w: L(1, 2), h: L(1, 1) });
  assert.equal(lenSym(L(1, 2)), 'x+2');
  // 하나를 빼면(빈틈) 직사각형이 아니다
  const gap = placed.map((x, k) => (k === 5 ? { ...x, at: { x: L(2, 0), y: L(1, 0) } } : x));
  assert.equal(rectangle(gap), null);
  // 겹치면 아니다
  const over = placed.map((x, k) => (k === 5 ? { ...x, at: { x: L(1, 0), y: L(1, 0) } } : x));
  assert.equal(rectangle(over), null);
  assert.deepEqual(areaChecks(p), [
    { name: '인수분해', answer: '(x+1)*(x+2)', answerType: 'expr', check: '1*x**2+3*x+2' },
  ]);
});

test('tiles: 자리 붙이기와 만들 수 없는 타일', () => {
  assert.deepEqual(snapLen(XLEN + 1.1), { a: 1, b: 1 });
  assert.deepEqual(snapLen(0.2), { a: 0, b: 0 });
  assert.throws(() =>
    parseArea({ mode: 'tiles', tiles: { x2: 1, x: 1, one: 1 }, factor: '(x+1)*(x+1)' }),
  );
});

test('grow 그릴 목록: 조각 넷의 key 는 Δx 가 바뀌어도 같고, 손잡이 자리 중 가장 가까운 것을 고른다', async () => {
  const { growDraw, growStops } = await import('../src/lesson/widgets/areaModel.ts');
  const p = grow();
  const box = { w: 300, h: 300 };
  const a = growDraw(p, 10, box);
  const b = growDraw(p, 1, box);
  assert.deepEqual(
    a.rects.map((r) => r.key),
    b.rects.map((r) => r.key),
  );
  // 가장 크게 늘린 것도 상자 안
  assert.ok(a.handle.x <= 300 && a.handle.y >= 0);
  assert.ok(b.rects[3] && a.rects[3] && b.rects[3].w < a.rects[3].w);
  assert.equal(growStops(p, box).length, 10);
  assert.equal(a.readouts.find((r) => r.key === 'dx')?.text, '0.5');
});

test('tiles 놓기: 판 밖이면 놓는 곳으로, 판 안이면 a·x+b 자리로', async () => {
  const { placeAt, tilesDraw, BOARD } = await import('../src/lesson/widgets/areaModel.ts');
  const u = 20;
  const t: Tile = { kind: 'x', rot: false, at: null };
  assert.deepEqual(placeAt(t, XLEN * u + 3, u * 1.1, u), { x: { a: 1, b: 0 }, y: { a: 0, b: 1 } });
  assert.equal(placeAt(t, (BOARD - 1) * u, 0, u), null);
  const d = tilesDraw(
    [t, { kind: 'one', rot: false, at: { x: { a: 0, b: 0 }, y: { a: 0, b: 0 } } }],
    u,
  );
  assert.equal(d.rects[0]?.placed, false);
  assert.ok((d.rects[0]?.y ?? 0) >= d.trayTop);
  assert.deepEqual(d.rects[1], {
    key: 't1',
    n: 1,
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    cls: 'tile one',
    placed: true,
  });
});
