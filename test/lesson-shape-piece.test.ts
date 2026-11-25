// 도형판 3-다: 조각 여러 개 끌어 옮기기·돌리기(pieces). 조각은 격자 칸 단위로 옮기고 90° 씩 돌린다 —
// 격자점 둘레로 90° 돌리면 꼭짓점이 다시 격자점이라 넓이가 정확히 그대로다(돌려도 넓이 불변).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type ShapeParams,
  shapeDef,
  shDraw,
  shInit,
  shPieceDrag,
  shPieceDrop,
  shPieceKey,
  shPieceMatch,
  shPiecePts,
  shPiecesDone,
  shPieceTurn,
  shUnit,
} from '../src/lesson/widgets/shape.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => shapeDef.parse(raw) as ShapeParams;

// 직각삼각형 두 조각으로 빈 정사각형 틀 채우기. 둘째 조각은 거꾸로 놓여 있어 돌려야 맞는다
const rawTwo = () => ({
  grid: { w: 8, h: 8 },
  points: [] as unknown[],
  pieces: [
    {
      at: [
        [0, 0],
        [2, 0],
        [0, 2],
      ],
      to: [
        [4, 2],
        [6, 2],
        [4, 4],
      ],
    },
    {
      at: [
        [0, 5],
        [2, 5],
        [0, 7],
      ],
      to: [
        [6, 2],
        [6, 4],
        [4, 4],
      ],
    },
  ],
  outline: [
    [4, 2],
    [6, 2],
    [6, 4],
    [4, 4],
  ],
  note: '두 조각을 끌어 빈 틀을 채워 보세요. 조각을 톡 누르면 돌아가요.',
});

const area = (ps: { x: number; y: number }[]) =>
  Math.abs(
    ps.reduce((t, a, i) => {
      const b = ps[(i + 1) % ps.length] as { x: number; y: number };
      return t + a.x * b.y - b.x * a.y;
    }, 0),
  ) / 2;

test('조각 끌기: 격자 칸 단위로 옮기고 격자 밖으로는 못 나감', () => {
  const p = parse(rawTwo());
  const s = shInit(p);
  const u = shUnit(p);
  const t = shPieceDrag(p, s, 0, u * 3.8, u * -2.2);
  assert.deepEqual(shPiecePts(p, t, 0), [
    { x: 4, y: 2 },
    { x: 6, y: 2 },
    { x: 4, y: 4 },
  ]);
  const far = shPieceDrag(p, s, 0, u * 99, u * -99);
  assert.deepEqual(shPiecePts(p, far, 0), [
    { x: 6, y: 6 },
    { x: 8, y: 6 },
    { x: 6, y: 8 },
  ]);
  assert.deepEqual(shPiecePts(p, shPieceKey(p, s, 0, 'ArrowRight') ?? s, 0)[0], { x: 1, y: 0 });
  assert.equal(shPieceKey(p, s, 0, 'a'), null);
});

test('조각 돌리기: 90° 씩, (격자 가운데에서는) 넷이면 제자리, 돌려도 넓이 그대로', () => {
  const p = parse(rawTwo());
  let s = shInit(p);
  const a0 = area(shPiecePts(p, s, 1));
  const seen: string[] = [];
  for (let k = 0; k < 4; k++) {
    s = shPieceTurn(p, s, 1);
    const pts = shPiecePts(p, s, 1);
    assert.equal(area(pts), a0);
    for (const q of pts) {
      assert.ok(Number.isInteger(q.x) && Number.isInteger(q.y), '격자점');
      assert.ok(q.x >= 0 && q.x <= 8 && q.y >= 0 && q.y <= 8, '격자 안');
    }
    seen.push(JSON.stringify(pts));
  }
  assert.equal(new Set(seen).size, 4);
  assert.deepEqual(shPiecePts(p, s, 1), shPiecePts(p, shInit(p), 1));
});

test('조각이 모두 목표 자리에 가면 끝(돌린 조각은 돌린 뒤 모양으로 판정)', () => {
  const p = parse(rawTwo());
  const s = shInit(p);
  const u = shUnit(p);
  assert.equal(shPiecesDone(p, s), false);
  const a = shPieceDrop(shPieceDrag(p, s, 0, u * 4, u * -2));
  assert.equal(shPiecesDone(p, a), false);
  // 돌리지 않고 옮기기만 하면 모양이 틀 자리와 다름
  const wrong = shPieceDrag(p, a, 1, u * 4, u * 3);
  assert.equal(shPiecesDone(p, wrong), false);
  const turned = shPieceTurn(p, shPieceTurn(p, a, 1), 1);
  const at = shPiecePts(p, turned, 1);
  const want = { x: 6, y: 4 };
  // 직각 꼭짓점을 (6,4) 로 옮기는 칸 수
  const right = at.find((q) => at.filter((r) => r.x === q.x || r.y === q.y).length === 3) as {
    x: number;
    y: number;
  };
  const moving = shPieceDrag(p, turned, 1, (want.x - right.x) * u, -(want.y - right.y) * u);
  // 끄는 동안(손을 떼기 전)은 맞은 자리여도 판정하지 않는다 — 초록으로 칠하지도 않음(P3)
  assert.equal(shPiecesDone(p, moving), false);
  assert.doesNotMatch(String(mark(shDraw(p, moving), 'pc1')?.a.class), /done/);
  const done = shPieceDrop(moving);
  assert.equal(shPiecesDone(p, done), true);
  const d = shDraw(p, done);
  assert.match(String(mark(d, 'pc1')?.a.class), /done/);
  assert.equal(d.texts.pieces, '조각 넓이의 합 = 4 · 빈 틀 넓이 = 4');
});

test('돌려 놓아도 같은 모양(정사각형 조각)이면 목표로 봄 — 꼭짓점 자리로 판정', () => {
  const p = parse({
    grid: { w: 6, h: 4 },
    points: [{ id: 'O', x: 0, y: 0, aux: true }],
    pieces: [
      {
        at: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
        to: [
          [3, 1],
          [5, 1],
          [5, 3],
          [3, 3],
        ],
      },
    ],
  });
  const u = shUnit(p);
  const s = shPieceTurn(p, shInit(p), 0);
  const pts = shPiecePts(p, s, 0);
  const minX = Math.min(...pts.map((q) => q.x));
  const minY = Math.min(...pts.map((q) => q.y));
  const t = shPieceDrop(shPieceDrag(p, s, 0, (3 - minX) * u, -(1 - minY) * u));
  assert.equal(shPiecesDone(p, t), true);
});

test('검산: 돌려 옮긴 조각 넓이 = 처음 넓이(sympy rotate), 조각 합 = 틀 넓이', () => {
  const p = parse(rawTwo());
  const cs = shapeDef.checks(p);
  assert.ok(cs.some((c) => c.name.includes('돌려 옮긴')));
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
  assert.equal(shapeDef.hasGoal?.(p), true);
});

test('조각 형식 오류', () => {
  const bad = (f: (r: ReturnType<typeof rawTwo>) => void) => {
    const r = rawTwo();
    f(r);
    return () => parse(r);
  };
  const setTo = (r: ReturnType<typeof rawTwo>, i: number, to: number[][]) => {
    (r.pieces[i] as { to: number[][] }).to = to;
  };
  assert.throws(
    bad((r) =>
      setTo(r, 0, [
        [7, 2],
        [9, 2],
        [7, 4],
      ]),
    ),
    /격자 밖/,
  );
  // 뒤집어야(거울상) 닿는 자리는 돌리기·옮기기로 못 감(두 변이 다른 직각삼각형)
  assert.throws(
    bad((r) => {
      (r.pieces[0] as { at: number[][] }).at = [
        [0, 0],
        [2, 0],
        [0, 1],
      ];
      setTo(r, 0, [
        [6, 2],
        [4, 2],
        [6, 3],
      ]);
      r.outline = undefined as never;
    }),
    /돌리고 옮겨서/,
  );
  assert.throws(
    bad((r) => {
      r.outline = [
        [4, 2],
        [7, 2],
        [7, 4],
        [4, 4],
      ];
    }),
    /넓이/,
  );
  assert.throws(
    bad((r) => {
      setTo(r, 0, r.pieces[0]?.at as number[][]);
      setTo(r, 1, r.pieces[1]?.at as number[][]);
      r.outline = undefined as never;
    }),
    /처음 자리/,
  );
  assert.throws(
    bad((r) => {
      r.points.push({ id: 'O', x: 0, y: 0 });
      Object.assign(r, { cut: { piece: ['O'], rest: ['O'], by: [1, 0], result: [] } });
    }),
    /pieces/,
  );
  assert.throws(
    bad((r) => {
      r.points.push({ id: 'P', x: 1, y: 1, drag: true });
    }),
    /끄는 점/,
  );
});

// 같은 모양 조각 둘(1×2 막대)과 목표 자리 둘
const rawTwins = () => ({
  grid: { w: 8, h: 6 },
  points: [] as unknown[],
  pieces: [
    {
      at: [
        [0, 0],
        [2, 0],
        [2, 1],
        [0, 1],
      ],
      to: [
        [4, 2],
        [6, 2],
        [6, 3],
        [4, 3],
      ],
    },
    {
      at: [
        [0, 4],
        [2, 4],
        [2, 5],
        [0, 5],
      ],
      to: [
        [4, 3],
        [6, 3],
        [6, 4],
        [4, 4],
      ],
    },
  ],
  outline: [
    [4, 2],
    [6, 2],
    [6, 4],
    [4, 4],
  ],
});

test('같은 모양 두 조각을 한 목표 자리에 겹쳐 놓으면 한 곳만 채운 것(일대일 짝) — 먼저 놓인 조각만 초록', () => {
  const p = parse(rawTwins());
  const s = shInit(p);
  const u = shUnit(p);
  const one = shPieceDrop(shPieceDrag(p, s, 0, u * 4, u * -2));
  const both = shPieceDrop(shPieceDrag(p, one, 1, u * 4, u * 2));
  assert.deepEqual(shPieceMatch(p, both), [true, false]);
  assert.equal(shPiecesDone(p, both), false);
  const d = shDraw(p, both);
  assert.match(String(mark(d, 'pc0')?.a.class), /done/);
  assert.doesNotMatch(String(mark(d, 'pc1')?.a.class), /done/);
  // 둘째를 다른 자리로 옮기면 다 채움(같은 모양끼리 자리를 바꿔 놓아도 됨)
  const fill = shPieceDrop(shPieceDrag(p, one, 1, u * 4, u * 1));
  assert.deepEqual(shPieceMatch(p, fill), [true, true]);
  assert.equal(shPiecesDone(p, fill), true);
});

test('끄는 조각이 다른 조각이 차지한 자리를 지나가도 그 조각의 초록은 그대로', () => {
  const p = parse(rawTwins());
  const s = shInit(p);
  const u = shUnit(p);
  // 조각 1 을 먼저 목표 0 자리에 두고, 조각 0 을 그 위로 끄는 중
  const placed = shPieceDrop(shPieceDrag(p, s, 1, u * 4, u * 2));
  const over = shPieceDrag(p, placed, 0, u * 4, u * -2);
  assert.deepEqual(shPieceMatch(p, over), [false, true]);
});

test('조각 형식 오류(채우기): 목표 자리 중복·틀 밖·목표끼리 겹침·거울상', () => {
  const twin = (f: (r: ReturnType<typeof rawTwins>) => void) => {
    const r = rawTwins();
    f(r);
    return () => parse(r);
  };
  const setTo = (r: ReturnType<typeof rawTwins>, i: number, to: number[][]) => {
    (r.pieces[i] as { to: number[][] }).to = to;
  };
  // 같은 자리 둘(꼭짓점 차례를 바꿔 적어도 같은 자리)
  assert.throws(
    twin((r) =>
      setTo(r, 1, [
        [6, 3],
        [4, 3],
        [4, 2],
        [6, 2],
      ]),
    ),
    /같은 목표 자리/,
  );
  // 틀 밖(넓이 합은 같지만 한 조각이 틀을 벗어남)
  assert.throws(
    twin((r) =>
      setTo(r, 1, [
        [6, 2],
        [8, 2],
        [8, 3],
        [6, 3],
      ]),
    ),
    /빈 틀 밖/,
  );
  // 목표끼리 반쯤 겹침(틀 없이)
  assert.throws(
    twin((r) => {
      r.outline = undefined as never;
      setTo(r, 1, [
        [5, 2],
        [7, 2],
        [7, 3],
        [5, 3],
      ]);
    }),
    /겹침/,
  );
  // 거울상: 꼭짓점 모음은 같아도 모양이 뒤집힌 조각(왼쪽이 파인 직사각형 ↔ 오른쪽이 다르게 파인 것).
  // 꼭짓점 모음만 견주면 통과해 버려, 둘레를 도는 차례로 견준다
  const P = [
    [0, 0],
    [4, 0],
    [4, 2],
    [0, 2],
    [1, 1],
    [3, 1],
  ] as [number, number][];
  const one = (to: [number, number][]) => () =>
    parse({ grid: { w: 8, h: 6 }, points: [], pieces: [{ at: P, to }] });
  assert.throws(one(P.map(([x, y]) => [7 - x, y + 2])), /돌리고 옮겨서/);
  // 같은 꼭짓점 모음의 180° 돌린 자리는 된다
  assert.doesNotThrow(one(P.map(([x, y]) => [7 - x, 4 - y])));
});
