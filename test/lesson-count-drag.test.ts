// 경우의 수 직접 조작(줄 세우기·선 잇기·벤 분류)의 모델. 화면(Count.tsx)은 손을 뗀 자리를 이 함수들에 넘기기만 한다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  type CountParams,
  type CState,
  cDone,
  cInit,
  cLabel,
  cLink,
  countDef,
  cTotal,
  L_W,
  lFactors,
  lGeom,
  lGroups,
  lMove,
  lSpotAt,
  pDegree,
  pGeom,
  pHit,
  V_H,
  V_W,
  vCheck,
  vCounts,
  vElems,
  viewOf,
  vPos,
  vPut,
  vRegionAt,
  vSlots,
  vTruth,
} from '../src/lesson/widgets/count.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => countDef.parse(raw) as CountParams;

// ---- 줄 세우기(list) ----

const L3 = parse({ mode: 'list', items: ['A', 'B', 'C'], k: 3 });
const L42 = parse({ mode: 'list', items: ['A', 'B', 'C', 'D'], k: 2 });

const moves = (p: CountParams, seq: [number, number | 'wait'][], s0 = cInit(p)) => {
  let s = s0;
  const res: string[] = [];
  for (const [i, to] of seq) {
    const r = lMove(p, s, i, to);
    s = r.s;
    res.push(r.res);
  }
  return { s, res };
};

test('어떤 부품으로 그릴지: list·pick k=2·venn 만 직접 조작, 나머지는 누르기 그대로', () => {
  assert.equal(viewOf(L3), 'line');
  assert.equal(viewOf(parse({ mode: 'pick', items: ['A', 'B', 'C'], k: 2 })), 'pair');
  assert.equal(viewOf(parse({ mode: 'pick', items: ['A', 'B', 'C', 'D'], k: 3 })), 'tap');
  assert.equal(viewOf(parse({ mode: 'repeat', items: ['O', 'X'], k: 3 })), 'tap');
  assert.equal(viewOf(parse({ mode: 'tree', items: ['A', 'B'], k: 2 })), 'tree');
  assert.equal(viewOf(parse({ mode: 'pascal', rows: 3 })), 'pascal');
});

test('줄 세우기: 빈 줄에 세우고, 줄이 다 차면 그 순서가 한 경우로 적힌다', () => {
  assert.deepEqual(cInit(L3).seat, [null, null, null]);
  const { s, res } = moves(L3, [
    [0, 0],
    [1, 1],
    [2, 2],
  ]);
  assert.deepEqual(res, ['move', 'move', 'new']);
  assert.deepEqual(s.seat, [0, 1, 2]);
  assert.deepEqual(
    s.found.map((k) => cLabel(L3, k)),
    ['ABC'],
  );
});

test('줄 세우기: 줄 안에서 옮기면 두 자리가 맞바뀌고, 새 줄이면 쌓이고 이미 있는 줄은 막힌다', () => {
  const full = moves(L3, [
    [0, 0],
    [1, 1],
    [2, 2],
  ]).s;
  // A 를 둘째 자리로 → B 와 맞바뀜: BAC
  const a = lMove(L3, full, 0, 1);
  assert.equal(a.res, 'new');
  assert.deepEqual(a.s.seat, [1, 0, 2]);
  assert.equal(a.key, '1,0,2');
  // 다시 바꾸면 ABC — 이미 찾은 줄이라 적지 않는다(자리는 그대로 바뀐다)
  const b = lMove(L3, a.s, 0, 0);
  assert.equal(b.res, 'dup');
  assert.equal(b.key, '0,1,2');
  assert.deepEqual(b.s.seat, [0, 1, 2]);
  assert.equal(b.s.found.length, 2);
  // 같은 자리에 놓기는 아무 일도 아님
  assert.equal(lMove(L3, b.s, 0, 0).res, 'none');
});

test('줄 세우기: 줄 밖에서 찬 자리로 들어오면 원래 있던 것은 줄 밖으로, 줄 밖으로 끌면 빠진다', () => {
  const s = moves(L42, [
    [0, 0],
    [1, 1],
  ]).s; // AB
  const r = lMove(L42, s, 2, 0); // C 가 첫째 자리로 → A 는 줄 밖
  assert.equal(r.res, 'new');
  assert.deepEqual(r.s.seat, [2, 1]);
  const out = lMove(L42, r.s, 1, 'wait');
  assert.equal(out.res, 'move');
  assert.deepEqual(out.s.seat, [2, null]);
  // 줄 밖에 있는 것을 줄 밖으로: 아무 일도 아님
  assert.equal(lMove(L42, out.s, 3, 'wait').res, 'none');
});

test('줄 세우기: 모두 찾으면 끝, 찾은 수 = 늘어놓은 수 = 곱', () => {
  for (const p of [L3, L42, parse({ mode: 'list', items: ['A', 'B', 'C', 'D'], k: 3 })]) {
    let s = cInit(p);
    for (const key of allKeys(p)) {
      // 자리를 하나씩 비우고 다시 채워 그 줄을 만든다
      for (let j = 0; j < (p.k ?? 0); j++) {
        const cur = s.seat[j];
        if (cur !== null && cur !== undefined) s = lMove(p, s, cur, 'wait').s;
      }
      key.split(',').forEach((i, j) => {
        s = lMove(p, s, Number(i), j).s;
      });
    }
    assert.equal(s.found.length, cTotal(p));
    assert.equal(cDone(p, s), true);
    assert.equal(
      lFactors(p).reduce((a, b) => a * b, 1),
      cTotal(p),
    );
  }
  assert.deepEqual(lFactors(L3), [3, 2, 1]);
  assert.deepEqual(lFactors(L42), [4, 3]);
});

test('줄 세우기: 다 찾은 뒤 첫째 자리별로 묶는다(묶음 수 × 묶음 크기 = 모든 경우)', () => {
  const found = ['2,1,0', '0,2,1', '1,0,2', '0,1,2', '2,0,1', '1,2,0'];
  const g = lGroups(L3, found);
  assert.deepEqual(
    g.map((x) => x.head),
    [0, 1, 2],
  );
  assert.deepEqual(g[0]?.keys, ['0,1,2', '0,2,1']);
  assert.ok(g.every((x) => x.keys.length === 2));
});

test('줄 세우기 판: 칩 44px 이상, 판 안에 들고, 놓은 자리 판정', () => {
  for (const [n, k] of [
    [3, 3],
    [4, 2],
    [4, 4],
    [5, 2],
    [6, 1],
  ] as const) {
    const g = lGeom(n, k);
    assert.ok(g.chip >= 44, `${n},${k} 칩 ${g.chip}`);
    for (const x of [...g.waitX, ...g.seatX]) {
      assert.ok(x - g.chip / 2 >= 0 && x + g.chip / 2 <= L_W, `${n},${k} x=${x}`);
    }
    // 이웃 칩이 겹치지 않음
    for (const xs of [g.waitX, g.seatX])
      for (let i = 1; i < xs.length; i++)
        assert.ok((xs[i] as number) - (xs[i - 1] as number) >= g.chip, `${n},${k} 간격`);
    g.seatX.forEach((x, s) => {
      assert.equal(lSpotAt(g, x, g.seatY), s);
      assert.equal(lSpotAt(g, x + g.chip / 2, g.seatY + 20), s);
    });
    assert.equal(lSpotAt(g, L_W / 2, g.waitY), 'wait');
    assert.equal(lSpotAt(g, L_W / 2, g.h + 80), null);
  }
});

// ---- 선 잇기(pick k=2) ----

const P4 = parse({ mode: 'pick', items: ['A', 'B', 'C', 'D'], k: 2 });

test('선 잇기: 두 점을 이으면 한 쌍, 반대 방향으로 다시 그어도 같은 선이라 막힌다', () => {
  let s = cInit(P4);
  const a = cLink(P4, s, 0, 1);
  assert.equal(a.res, 'new');
  assert.equal(a.key, '0,1');
  s = a.s;
  const b = cLink(P4, s, 1, 0);
  assert.equal(b.res, 'dup');
  assert.equal(b.key, '0,1');
  assert.equal(b.s.found.length, 1);
  assert.equal(cLink(P4, s, 2, 2).res, 'self');
});

test('선 잇기: 모두 이으면 끝, 끝점마다 선 n−1 개', () => {
  let s: CState = cInit(P4);
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) s = cLink(P4, s, b, a).s;
  assert.equal(s.found.length, 6);
  assert.equal(cDone(P4, s), true);
  assert.deepEqual(pDegree(P4, s.found), [3, 3, 3, 3]);
  assert.deepEqual(pDegree(P4, ['0,1']), [1, 1, 0, 0]);
});

test('선 잇기 판: 점이 판 안, 서로 넉넉히 떨어지고, 손 뗀 자리에서 가장 가까운 점', () => {
  for (let n = 2; n <= 6; n++) {
    const g = pGeom(n);
    assert.ok(g.r * 2 >= 44);
    for (const [x, y] of g.pos) {
      assert.ok(x - g.r >= 0 && x + g.r <= g.w && y - g.r >= 0 && y + g.r <= g.h, `${n}`);
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const [x1, y1] = g.pos[i] as [number, number];
        const [x2, y2] = g.pos[j] as [number, number];
        assert.ok(Math.hypot(x1 - x2, y1 - y2) >= 2 * g.r + 20, `${n}: ${i}-${j}`);
      }
    const [x0, y0] = g.pos[1] as [number, number];
    assert.equal(pHit(g, x0 + 5, y0 - 5, 0), 1);
    assert.equal(pHit(g, x0, y0, 1), -1); // 시작한 점 위에서 떼면 잇지 않음
    assert.equal(pHit(g, g.w / 2, g.h / 2, -1), -1);
  }
});

// ---- 벤 분류(venn) ----

const V = parse({
  mode: 'venn',
  sets: {
    names: ['12의 약수', '8의 약수'],
    a: ['1', '2', '3', '4', '6', '12'],
    b: ['1', '2', '4', '8'],
  },
});
const VU = parse({
  mode: 'venn',
  sets: {
    names: ['짝수', '3의 배수'],
    a: ['2', '4', '6'],
    b: ['3', '6'],
    u: ['1', '2', '3', '4', '5', '6'],
  },
});

test('벤: 분류할 원소는 전체집합(없으면 합집합)을 수 차례로 — a 다음 b 순서가 답을 흘리지 않게', () => {
  assert.deepEqual(vElems(V), ['1', '2', '3', '4', '6', '8', '12']);
  assert.deepEqual(vElems(VU), ['1', '2', '3', '4', '5', '6']);
  const t = vElems(V).map((x) => vTruth(V, x));
  assert.deepEqual(t, ['ab', 'ab', 'a', 'ab', 'a', 'b', 'a']);
  assert.equal(vTruth(VU, '5'), 'out');
});

test('벤 판: 영역 판정은 놓은 자리의 기하로', () => {
  const slots = vSlots();
  for (const reg of ['a', 'ab', 'b', 'out'] as const) {
    assert.ok(slots[reg].length >= 4, `${reg} 자리 ${slots[reg].length}`);
    for (const [x, y] of slots[reg]) assert.equal(vRegionAt(x, y), reg);
  }
  assert.equal(vRegionAt(V_W / 2, V_H + 30), 'deck');
  assert.equal(vRegionAt(-30, 40), null);
});

test('벤 판: 같은 칸 카드는 서로 겹치지 않고, 판 안에 든다', () => {
  const slots = vSlots();
  const all = Object.values(slots).flat();
  for (const [x, y] of all) assert.ok(x - 22 >= 0 && x + 22 <= V_W && y - 22 >= 0 && y + 22 <= V_H);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const [x1, y1] = all[i] as [number, number];
      const [x2, y2] = all[j] as [number, number];
      assert.ok(Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) >= 46, `${i}-${j}`);
    }
});

test('벤: 카드를 놓으면 그 칸 자리에 차례로 줄 맞춰 서고, 빠지면 앞으로 당겨진다', () => {
  let s = cInit(V);
  assert.ok(s.where.every((w) => w === null));
  s = vPut(V, s, 0, 'ab').s;
  s = vPut(V, s, 1, 'ab').s;
  const slot = vSlots().ab;
  assert.deepEqual(vPos(V, s, 0), slot[0]);
  assert.deepEqual(vPos(V, s, 1), slot[1]);
  s = vPut(V, s, 0, 'a').s;
  assert.deepEqual(vPos(V, s, 1), slot[0]);
  // 더미로 되돌리기
  s = vPut(V, s, 0, null).s;
  assert.equal(s.where[0], null);
  // 칸이 다 차면 더 넣지 못한다(자리가 없어 겹치게 되므로)
  let f = cInit(V);
  const cap = vSlots().ab.length;
  const elems = vElems(V);
  for (let i = 0; i < Math.min(cap, elems.length); i++) f = vPut(V, f, i, 'ab').s;
  if (elems.length > cap) assert.equal(vPut(V, f, cap, 'ab').res, 'full');
});

test('벤: 확인하기 — 틀린 카드만 표시하고, 옮기면 그 표시가 지워지고, 다 맞으면 끝', () => {
  let s = cInit(VU);
  const el = vElems(VU);
  el.forEach((x, i) => {
    s = vPut(VU, s, i, x === '5' ? 'a' : vTruth(VU, x)).s;
  });
  const c1 = vCheck(VU, s);
  assert.deepEqual(c1.s.wrong, [el.indexOf('5')]);
  assert.equal(cDone(VU, c1.s), false);
  s = vPut(VU, c1.s, el.indexOf('5'), 'out').s;
  assert.deepEqual(s.wrong, []);
  const c2 = vCheck(VU, s);
  assert.equal(c2.s.solved, true);
  assert.equal(cDone(VU, c2.s), true);
  // 더미에 남은 카드가 있으면 확인하지 않는다
  assert.equal(vCheck(VU, cInit(VU)).s.solved, false);
});

test('벤: 영역별 개수·합집합·여집합', () => {
  assert.deepEqual(vCounts(V), { a: 3, ab: 3, b: 1, out: 0, nA: 6, nB: 4, union: 7 });
  assert.deepEqual(vCounts(VU), {
    a: 2,
    ab: 1,
    b: 1,
    out: 2,
    nA: 3,
    nB: 2,
    union: 4,
    u: 6,
    compA: 3,
  });
});

test('벤 parse: 전체집합 u 는 선택, a·b 를 모두 품어야 하고, 칸에 다 들어가야 한다', () => {
  assert.throws(
    () => parse({ mode: 'venn', sets: { names: ['A', 'B'], a: ['1'], b: ['2'], u: ['1'] } }),
    /전체집합/,
  );
  assert.throws(
    () =>
      parse({ mode: 'venn', sets: { names: ['A', 'B'], a: ['1'], b: ['2'], u: ['1', '2', '1'] } }),
    /중복/,
  );
  const many = ['1', '2', '3', '4', '5', '6', '7', '8'];
  assert.throws(
    () => parse({ mode: 'venn', sets: { names: ['A', 'B'], a: many, b: many } }),
    /자리/,
  );
});

test('벤 검산: 전체집합이 있으면 여집합·밖 수도 sympy 로, 없으면 예전 두 항목 그대로', () => {
  assert.deepEqual(
    countDef.checks(V).map((c) => c.name),
    ['합집합', '교집합'],
  );
  const cs = countDef.checks(VU);
  assert.deepEqual(
    cs.map((c) => c.name),
    ['합집합', '교집합', '여집합', '밖'],
  );
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
});

// ---- 지금 단원 JSON 그대로 ----

test('지금 단원 JSON 의 count 장면이 모두 그대로 읽히고 검산 항목 이름이 그대로다', () => {
  const dir = join(import.meta.dirname, '../content/units');
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const u = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const sc of u.lesson?.scenes ?? []) {
      if (sc.widget?.type !== 'count') continue;
      n++;
      const p = parse(sc.widget.params);
      const names = countDef.checks(p).map((c) => c.name);
      if (p.mode === 'venn') assert.deepEqual(names, ['합집합', '교집합'], `${f} ${sc.id}`);
      else if (p.mode !== 'pascal') assert.deepEqual(names, ['모든 경우'], `${f} ${sc.id}`);
    }
  }
  assert.equal(n, 19);
});

function allKeys(p: CountParams): string[] {
  const n = p.items?.length ?? 0;
  const k = p.k ?? 0;
  const out: string[] = [];
  const go = (cur: number[]) => {
    if (cur.length === k) {
      out.push(cur.join(','));
      return;
    }
    for (let i = 0; i < n; i++) if (!cur.includes(i)) go([...cur, i]);
  };
  go([]);
  return out;
}
