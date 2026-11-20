import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  areaChecks,
  BOARD,
  cellTex,
  FOLD_BUDGET,
  fitTiles,
  type GrowParams,
  growBox,
  growLimit,
  growSteps,
  growView,
  initialTiles,
  lenSym,
  parseArea,
  placeAt,
  type Rect,
  rectangle,
  snapLen,
  splitTotal,
  type Tile,
  type TilesParams,
  tileAt,
  tileFactorings,
  tilesDraw,
  tilesLayout,
  tilesSides,
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

test('넓이 모형 범례: 이름이 이미 "가로"·"세로"로 시작하면 다시 붙이지 않는다(m3-poly-mul grow 의 "가로 가로 x")', async () => {
  const { sideLabel } = await import('../src/lesson/widgets/areaModel.ts');
  assert.equal(sideLabel('가로', '가로 $x$'), '가로 $x$');
  assert.equal(sideLabel('가로', '$f(x)=x^2$'), '가로 $f(x)=x^2$');
  assert.equal(sideLabel('세로', '세로$x$'), '세로$x$');
});

// ---- 좁고 낮은 화면(접은 화면 382×580) 배치 ----

const tilesP = (tiles: { x2: number; x: number; one: number }, factor: string) =>
  parseArea({ mode: 'tiles', tiles, factor }) as TilesParams;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
/** 접은 화면 부품 폭(382 화면에서 298px)에서 처음 그림 */
const foldDraw = (p: TilesParams, width = 298) => {
  const L = tilesLayout(p, width, true);
  return { L, d: tilesDraw(initialTiles(p), L.u, L) };
};

test('타일로 만들 수 있는 직사각형의 짧은 변·긴 변', () => {
  const a = tilesSides(tilesP({ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)'));
  assert.ok(near(a.short, XLEN + 2) && near(a.long, XLEN + 3), JSON.stringify(a));
  const b = tilesSides(tilesP({ x2: 2, x: 5, one: 3 }, '(2*x+3)*(x+1)'));
  assert.ok(near(b.short, XLEN + 1) && near(b.long, 2 * XLEN + 3), JSON.stringify(b));
});

test('넓은 화면 타일 배치는 그대로(정사각 판 BOARD, 한 칸 34px 까지, 쌓기 없음)', () => {
  const p = tilesP({ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)');
  assert.deepEqual(tilesLayout(p, 600, false), {
    u: 34,
    board: { w: BOARD, h: BOARD },
    stack: false,
  });
  assert.deepEqual(tilesLayout(p, 298, false), {
    u: 298 / BOARD,
    board: { w: BOARD, h: BOARD },
    stack: false,
  });
});

test('접은 화면: 판은 만들 직사각형에 맞게 줄이고 같은 타일은 한 더미로 — 그림 전체 300px 안, 누르는 곳 44px', () => {
  for (const [tiles, factor] of [
    [{ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)'],
    [{ x2: 1, x: 6, one: 9 }, '(x+3)**2'],
    [{ x2: 2, x: 5, one: 3 }, '(2*x+3)*(x+1)'],
  ] as const) {
    const { L, d } = foldDraw(tilesP(tiles, factor));
    assert.equal(L.stack, true);
    assert.ok(d.height <= 300, `${factor} 높이 ${d.height}`);
    // 한 칸(1 타일)이 넓은 배치를 접은 폭에 넣은 것(298/BOARD ≈ 26.6px)보다 크다
    assert.ok(L.u >= 28, `${factor} 한 칸 ${L.u}`);
    // 놓는 곳에서 누를 수 있는 것은 더미마다 맨 위 하나 — 나머지는 아래에 깔림
    const top = d.rects.filter((r) => !r.under);
    assert.deepEqual(
      top.map((r) => r.cls),
      ['tile x2', 'tile x', 'tile one'],
    );
    assert.deepEqual(
      top.map((r) => r.count),
      [tiles.x2, tiles.x, tiles.one],
    );
    // 더미 자리는 비어도 늘 같은 곳(세운 x 자리 포함 넷) — 돌리거나 다 꺼내도 칸이 옮겨 다니지 않게
    assert.deepEqual(
      d.slots?.map((s) => s.cls),
      ['slot x2', 'slot x', 'slot x rot', 'slot one'],
    );
    for (const r of top)
      assert.ok(
        d.slots?.some((s) => s.x === r.x && s.y === r.y),
        r.cls,
      );
    for (const r of top) {
      const h = r.hit ?? r;
      assert.ok(h.w >= 44 && h.h >= 44, `${r.cls} 누르는 영역 ${h.w}×${h.h}`);
      assert.ok(h.x >= 0 && h.x + h.w <= 298, `${r.cls} 가로 ${h.x}~${h.x + h.w}`);
      assert.ok(h.y > d.board.h, `${r.cls} 판과 겹침`);
    }
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++) {
        const a = top[i]?.hit as Rect;
        const b = top[j]?.hit as Rect;
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x, `${top[i]?.cls}·${top[j]?.cls} 겹침`);
      }
  }
});

test('접은 화면 판: 두 방향 다 들어가는 판이 너무 작아지면(ac) 긴 변을 가로로 눕힌 판', () => {
  const sq = foldDraw(tilesP({ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)'));
  // 가로로도 세로로도 직사각형이 들어간다
  assert.ok(sq.L.board.h >= XLEN + 3 && sq.L.board.w >= XLEN + 3);
  const ac = foldDraw(tilesP({ x2: 2, x: 5, one: 3 }, '(2*x+3)*(x+1)'));
  assert.ok(ac.L.board.w >= 2 * XLEN + 3, `판 가로 ${ac.L.board.w}`);
  assert.ok(ac.L.board.h >= XLEN + 1 && ac.L.board.h < 2 * XLEN + 3, `판 세로 ${ac.L.board.h}`);
  // 판 크기는 px 로도
  assert.ok(Math.abs(ac.d.board.w - ac.L.board.w * ac.L.u) < 0.2);
});

test('접은 화면 판 모양은 답을 드러내지 않는다: 답으로 정하는 건 칸 크기뿐, 판 높이는 그림 높이 예산을 다 쓴다', () => {
  for (const [tiles, factor] of [
    [{ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)'],
    [{ x2: 1, x: 6, one: 9 }, '(x+3)**2'],
    [{ x2: 2, x: 5, one: 3 }, '(2*x+3)*(x+1)'],
    [{ x2: 1, x: 2, one: 1 }, '(x+1)**2'],
  ] as const) {
    const { L, d } = foldDraw(tilesP(tiles, factor));
    assert.ok(Math.abs(d.height - FOLD_BUDGET) <= 1, `${factor} 그림 높이 ${d.height}`);
    // 판 가로는 부품 폭 전체
    assert.ok(Math.abs(d.board.w - 298) < 0.2, `${factor} 판 폭 ${d.board.w}`);
    // 판 높이는 칸 크기에서만 나온다(높이 예산 ÷ 칸 − 놓는 곳 한 줄) — 답의 변 길이에 따로 맞추지 않는다
    assert.ok(Math.abs(L.board.h - ((FOLD_BUDGET - 18) / L.u - XLEN)) < 1e-9, `${factor}`);
  }
  // 눕힌 판(ac)도 짧은 변 + 1칸에 딱 맞춘 납작한 판이 아니다
  const ac = foldDraw(tilesP({ x2: 2, x: 5, one: 3 }, '(2*x+3)*(x+1)'));
  assert.ok(ac.L.board.h > XLEN + 1 + 1.2, `ac 판 높이 ${ac.L.board.h}`);
});

test('접은 화면 더미: 폭이 좁아 칸이 작아져도(x 하나 돌린 상태) 누르는 영역 44px 이 서로 안 겹치고 폭 안', () => {
  for (const width of [298, 260, 230]) {
    const p = tilesP({ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)');
    const L = tilesLayout(p, width, true);
    const t = initialTiles(p).map((q, k) => (k === 1 ? { ...q, rot: true } : q));
    const d = tilesDraw(t, L.u, L);
    const top = d.rects.filter((r) => !r.under);
    assert.equal(top.length, 4, `${width}`);
    const hits = top.map((r) => r.hit as Rect).sort((a, b) => a.x - b.x);
    for (const h of hits) {
      assert.ok(h.w >= 44 && h.h >= 44, `${width} ${h.w}×${h.h}`);
      assert.ok(h.x >= 0 && h.x + h.w <= width, `${width} 가로 ${h.x}~${h.x + h.w}`);
    }
    for (let i = 1; i < hits.length; i++) {
      const a = hits[i - 1] as Rect;
      const b = hits[i] as Rect;
      assert.ok(a.x + a.w <= b.x + 1e-9, `${width} 겹침 ${a.x + a.w} > ${b.x}`);
    }
  }
});

test('판 크기가 바뀌면(접기·펴기·회전) 판 밖 타일 정리: 놓인 묶음을 통째로 왼쪽 위로, 그래도 안 들어가는 것만 놓는 곳으로', () => {
  const L = (a: number, b: number) => ({ a, b });
  const x2 = (x: { a: number; b: number }, y: { a: number; b: number }): Tile => ({
    kind: 'x2',
    rot: false,
    at: { x, y },
  });
  const one = (x: { a: number; b: number }, y: { a: number; b: number }): Tile => ({
    kind: 'one',
    rot: false,
    at: { x, y },
  });
  const free: Tile = { kind: 'one', rot: false, at: null };
  // 넓은 판(11.2) 오른쪽 아래에 x² + 1 을 붙여 놓았다가 판이 6.6×6.6 으로 줄면: 묶음째 (0,0) 쪽으로, 붙은 모양 그대로
  const before = [x2(L(1, 3), L(1, 2)), one(L(2, 3), L(1, 2)), free];
  const after = fitTiles(before, { w: 6.6, h: 6.6 });
  assert.deepEqual(after[0]?.at, { x: L(0, 0), y: L(0, 0) });
  assert.deepEqual(after[1]?.at, { x: L(1, 0), y: L(0, 0) });
  assert.equal(after[2]?.at, null);
  // 다 들어가 있으면 그대로(같은 배열 — 다시 그리지 않게)
  assert.equal(fitTiles(after, { w: 6.6, h: 6.6 }), after);
  // 당겨도 판보다 큰 묶음이면 넘치는 타일만 놓는 곳으로
  const wide = [x2(L(0, 0), L(0, 0)), x2(L(1, 0), L(0, 0)), x2(L(2, 0), L(0, 0))];
  const cut = fitTiles(wide, { w: 6, h: 6 });
  assert.deepEqual(
    cut.map((t) => t.at !== null),
    [true, true, false],
  );
});

test('타일 인수 쌍: 형식 검사와 판 크기가 같은 목록을 쓴다', () => {
  assert.deepEqual(tileFactorings(tilesP({ x2: 2, x: 5, one: 3 }, '(2*x+3)*(x+1)')), [
    { a1: 1, b1: 1, a2: 2, b2: 3 },
    { a1: 2, b1: 3, a2: 1, b2: 1 },
  ]);
  assert.equal(tileFactorings({ mode: 'tiles', x2: 1, x: 1, one: 1, factor: 'x' }).length, 0);
});

test('접은 화면 놓기: 줄인 판 밖으로 나가면 놓는 곳으로', () => {
  const board = { w: 9.2, h: 4.6 };
  const x2: Tile = { kind: 'x2', rot: false, at: null };
  assert.deepEqual(placeAt(x2, 0, 0, 30, board), { x: { a: 0, b: 0 }, y: { a: 0, b: 0 } });
  // x² 둘을 세로로 쌓으면 판(4.6) 밖
  assert.equal(placeAt(x2, 0, XLEN * 30, 30, board), null);
  // 가로로 나란히는 들어간다
  assert.deepEqual(placeAt(x2, XLEN * 30, 0, 30, board), {
    x: { a: 1, b: 0 },
    y: { a: 0, b: 0 },
  });
});

test('접은 화면 더미: 고른 타일이 늘 맨 위, 돌린 x 는 따로 쌓고, 판 위 타일은 제자리', () => {
  const p = tilesP({ x2: 1, x: 5, one: 6 }, '(x+2)*(x+3)');
  const L = tilesLayout(p, 298, true);
  // 1번(x 첫째)을 돌리고, x² 는 판 위, 2번(x 둘째)을 고름
  const t = initialTiles(p).map((q, k) =>
    k === 1
      ? { ...q, rot: true }
      : k === 0
        ? { ...q, at: { x: { a: 0, b: 0 }, y: { a: 0, b: 0 } } }
        : q,
  );
  const d = tilesDraw(t, L.u, { ...L, sel: 2 });
  const top = d.rects.filter((r) => !r.under && !r.placed);
  assert.deepEqual(
    top.map((r) => [r.cls, r.n, r.count]),
    [
      ['tile x', 2, 4],
      ['tile x', 1, 1],
      ['tile one', 11, 6],
    ],
  );
  const xr = top[0] as Rect;
  assert.equal(tileAt(d.rects, xr.x + 2, xr.y + 2)?.n, 2);
  assert.equal(tileAt(d.rects, 5, 5)?.n, 0);
  assert.equal(tileAt(d.rects, d.board.w - 2, d.board.h - 2), undefined);
});

test('grow 그림 상자: 접은 화면에서는 낮게(읽는 값 6칸·버튼까지 한 화면), 넓은 화면은 그대로', () => {
  assert.deepEqual(growBox(298, false), { w: 298, h: 238 });
  assert.deepEqual(growBox(600, false), { w: 600, h: 320 });
  const f = growBox(298, true);
  assert.equal(f.w, 298);
  assert.ok(f.h <= 175 && f.h >= 150, String(f.h));
});
