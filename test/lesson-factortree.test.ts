import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type FactorTreeParams,
  factorTreeDef,
  ftDone,
  ftDoneMsg,
  ftHeight,
  ftInit,
  ftLayout,
  ftLeafSets,
  ftMoveFrom,
  ftNextLeaf,
  ftPad,
  ftPrime,
  ftRedoMsg,
  ftResult,
  ftSelect,
  ftSplit,
  josa,
  TREE_W,
  type TState,
} from '../src/lesson/widgets/factorTree.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => factorTreeDef.parse(raw) as FactorTreeParams;
const P72 = parse({ n: 72 });

/** 수 n 이 든 첫 끝 마디(아직 안 쪼갠 마디)를 골라 d 로 쪼갠다. d 가 'pr' 이면 소수로 확정 */
function act(s: TState, n: number, d: number | 'pr') {
  const id = s.nodes.findIndex((x) => x.n === n && !x.kids && !x.prime);
  assert.ok(id >= 0, `${n} 끝 마디 없음`);
  const sel = ftSelect(s, id);
  return d === 'pr' ? ftPrime(sel.s) : ftSplit(sel.s, d);
}

function run(p: FactorTreeParams, steps: [number, number | 'pr'][]) {
  let s = ftInit(p);
  for (const [n, d] of steps) {
    const r = act(s, n, d);
    assert.ok(r.ok, `${n} ${d}: ${r.msg.text}`);
    s = r.s;
  }
  return s;
}

/** 72 를 8 × 9 로 시작한 나무(시안의 완료 화면) */
const TREE_89: [number, number | 'pr'][] = [
  [72, 8],
  [8, 2],
  [4, 2],
  [9, 3],
  [2, 'pr'],
  [2, 'pr'],
  [2, 'pr'],
  [3, 'pr'],
  [3, 'pr'],
];
/** 72 를 2 × 36 으로 시작한 나무(시안의 '다른 방법으로 다시') */
const TREE_236: [number, number | 'pr'][] = [
  [72, 2],
  [36, 6],
  [6, 2],
  [6, 3],
  [2, 'pr'],
  [2, 'pr'],
  [3, 'pr'],
  [2, 'pr'],
  [3, 'pr'],
];

test('처음: 뿌리 하나, 고른 마디 없음, 숫자판은 꺼져 있음', () => {
  const s = ftInit(P72);
  assert.deepEqual(s.nodes, [{ n: 72, kids: null, prime: false, parent: null }]);
  assert.equal(s.sel, null);
  assert.deepEqual(ftPad(s), { digits: [2, 3, 4, 5, 6, 7, 8, 9], enabled: false });
});

test('수를 고르면 숫자판이 켜지는데, 나누어떨어지는 수만 켜지지는 않는다(P3 — 정답 목록을 미리 안 보임)', () => {
  const r = ftSelect(ftInit(P72), 0);
  assert.equal(r.s.sel, 0);
  assert.equal(r.msg.text, "72 를 어떤 수로 나눌까요? 더 못 쪼개면 '소수예요'.");
  // 5·7 처럼 72 를 못 나누는 수도 똑같이 눌린다 — 판정은 누른 뒤에
  assert.deepEqual(ftPad(r.s), { digits: [2, 3, 4, 5, 6, 7, 8, 9], enabled: true });
  // 같은 마디를 다시 누르면 고르기 풀림
  assert.equal(ftSelect(r.s, 0).s.sel, null);
});

test('쪼개기: 나누어떨어지면 (나눈 수, 몫) 두 마디가 생기고 고르기가 풀린다', () => {
  const r = act(ftInit(P72), 72, 8);
  assert.equal(r.ok, true);
  assert.equal(r.msg.text, '72 = 8 × 9. 끝의 수를 눌러 계속 쪼개요.');
  assert.equal(r.msg.cls, '');
  assert.equal(r.say, '72 는 8 곱하기 9');
  assert.deepEqual(
    r.s.nodes.map((x) => x.n),
    [72, 8, 9],
  );
  assert.deepEqual(r.s.nodes[0]?.kids, [1, 2]);
  assert.equal(r.s.nodes[1]?.parent, 0);
  assert.equal(r.s.sel, null);
});

test('틀린 쪼개기는 누른 뒤에만 알리고, 나무는 그대로(P3)', () => {
  const s = ftSelect(ftInit(P72), 0).s;
  const r5 = ftSplit(s, 5);
  assert.equal(r5.ok, false);
  assert.deepEqual(r5.msg, { text: '72 ÷ 5 는 나누어떨어지지 않아요 (나머지 2).', cls: 'bad' });
  assert.equal(r5.s, s);
  // 자기보다 크거나 같은 수
  const s6 = ftSelect(act(ftInit(P72), 72, 6).s, 1).s; // 6
  assert.equal(ftSplit(s6, 8).msg.text, '6 보다 작은 수로 나눠요.');
  assert.equal(
    ftSplit(s6, 6).msg.text,
    "6 ÷ 6 = 1 — 1 은 조각이 아니에요. 더 못 쪼개면 '소수예요'.",
  );
  // 고른 마디가 없으면 아무 일 없음
  assert.equal(ftSplit(ftInit(P72), 2).ok, false);
});

test('소수예요: 소수면 동그라미, 아니면 "나누어떨어지는 수가 있어요"', () => {
  const s = act(ftInit(P72), 72, 8).s;
  const bad = ftPrime(ftSelect(s, 2).s); // 9
  assert.deepEqual(bad.msg, {
    text: '9 는 1 과 9 말고도 나누어떨어지는 수가 있어요.',
    cls: 'bad',
  });
  assert.equal(bad.ok, false);
  const s2 = act(s, 8, 2).s;
  const good = act(s2, 2, 'pr');
  assert.equal(good.ok, true);
  assert.deepEqual(good.msg, { text: '2 는 1 과 2 로만 나뉘는 소수예요. 동그라미!', cls: 'ok' });
  assert.equal(good.s.nodes[3]?.prime, true);
});

test('이미 쪼갠 수·동그라미 친 수를 누르면 안내만', () => {
  const s = act(ftInit(P72), 72, 8).s;
  const r = ftSelect(s, 0);
  assert.equal(r.s.sel, null);
  assert.equal(r.msg.text, '72 는 이미 쪼갰어요. 나무 맨 끝의 수를 골라요.');
  const s2 = act(act(s, 8, 2).s, 2, 'pr').s;
  assert.equal(ftSelect(s2, 3).msg.text, '2 는 이미 동그라미 친 소수예요.');
});

test('끝까지: 잎이 모두 소수면 끝, 결과는 작은 소수부터·거듭제곱', () => {
  const s = run(P72, TREE_89);
  assert.equal(ftDone(s), true);
  const r = ftResult(s);
  assert.deepEqual(r.flat, [2, 2, 2, 3, 3]);
  assert.deepEqual(r.pow, [
    [2, 3],
    [3, 2],
  ]);
  assert.equal(r.flatTex, '72=2\\times2\\times2\\times3\\times3');
  assert.equal(r.powTex, '=2^{3}\\times3^{2}');
  assert.equal(r.powText, '2³ × 3²');
  assert.equal(r.say, '72 는 2 곱하기 2 곱하기 2 곱하기 3 곱하기 3');
  assert.equal(ftDone(run(P72, TREE_89.slice(0, -1))), false);
});

test('다른 방법으로 다시: 모양이 달라도 잎이 같으면 "지난번 나무도"', () => {
  const first = ftResult(run(P72, TREE_89));
  const second = ftResult(run(P72, TREE_236));
  assert.notEqual(first.shape, second.shape);
  assert.deepEqual(ftDoneMsg(first, null), {
    text: '모든 끝이 소수예요. 다르게 쪼개도 같을까요? 다시 해 봐요.',
    cls: 'ok',
  });
  assert.deepEqual(ftDoneMsg(second, first), {
    text: '지난번 나무도 2³ × 3² — 다르게 쪼개도 같은 소수 조각이 남아요.',
    cls: 'ok',
  });
  // 같은 모양으로 다시 했으면 비교 문장 대신 처음 문장(좌우만 바꾼 것도 같은 모양)
  assert.equal(ftDoneMsg(first, first).text, ftDoneMsg(first, null).text);
  const mirror = ftResult(run(P72, [[72, 9], ...TREE_89.slice(1)] as [number, number | 'pr'][]));
  assert.equal(mirror.shape, first.shape);
});

test('다시 쪼갤 때 권하는 첫 쪼개기는 지난번과 다른, 가장 고른 두 수', () => {
  const first = ftResult(run(P72, TREE_236));
  assert.equal(ftRedoMsg(P72, [first]), '이번엔 처음과 다른 수로 쪼개 볼까요? 예: 8 × 9.');
  const r89 = ftResult(run(P72, TREE_89));
  assert.equal(ftRedoMsg(P72, [r89]), '이번엔 처음과 다른 수로 쪼개 볼까요? 예: 6 × 12.');
});

test('어떻게 쪼개 시작해도 끝에 남는 소수 조각은 한 가지(닿는 나무를 모두 늘어놓음)', () => {
  assert.deepEqual(ftLeafSets(72), [[2, 2, 2, 3, 3]]);
  assert.deepEqual(ftLeafSets(60), [[2, 2, 3, 5]]);
  assert.deepEqual(ftLeafSets(44), [[2, 2, 11]]);
});

test('배치: 잎은 같은 간격, 부모는 두 자식 가운데, 층 높이 44, 상자 안', () => {
  const s = run(P72, TREE_236);
  const pos = ftLayout(s);
  assert.equal(pos.length, s.nodes.length);
  assert.equal(pos[0]?.y, 22);
  // 잎 5개: 왼쪽부터 폭/5 간격(2 · 2 3 · 3 2)
  const w = TREE_W / 5;
  assert.equal(pos[1]?.x, w * 0.5);
  const h = ftHeight(P72);
  assert.equal(h, 222);
  for (const [i, p] of pos.entries()) {
    assert.ok(p.x >= 25 && p.x <= TREE_W - 25, `x ${i} ${p.x}`);
    assert.ok(p.y >= 22 && p.y <= h - 22, `y ${i} ${p.y}`);
    const kids = s.nodes[i]?.kids;
    if (kids) {
      const [a, b] = kids.map((k) => pos[k] as { x: number });
      assert.equal(p.x, ((a?.x ?? 0) + (b?.x ?? 0)) / 2);
    }
  }
  // 가장 깊은 나무(2 로만 쪼갬): 5층 = 소인수 5개
  const deep = run(P72, [
    [72, 2],
    [36, 2],
    [18, 2],
    [9, 3],
  ]);
  assert.equal(Math.max(...ftLayout(deep).map((p) => p.y)), 22 + 4 * 44);
});

test('형식 검사: 소인수 5개까지(96 은 6개라 접은 화면을 넘침), 숫자판으로 끝까지 쪼갤 수 있는 수', () => {
  assert.doesNotThrow(() => parse({ n: 72 }));
  assert.doesNotThrow(() => parse({ n: 60 }));
  assert.doesNotThrow(() => parse({ n: 44 }));
  assert.throws(() => parse({ n: 96 }), /소인수 6개.*5개까지/);
  assert.throws(() => parse({ n: 97 }), /소수/);
  assert.throws(() => parse({ n: 121 }), /숫자판/);
  assert.throws(() => parse({ n: 8 }), /한 가지/);
  assert.throws(() => parse({ n: 35 }), /한 가지/);
  assert.throws(() => parse({ n: 1000 }));
  assert.throws(() => parse({ n: 72.5 }));
  assert.throws(() => parse({ n: 72, colour: 'red' }), /모르는 칸/);
});

test('검산: 잎 = sympy factorint, 소수 판정 = sympy isprime', () => {
  const cs = factorTreeDef.checks(P72);
  assert.deepEqual(cs[0], {
    name: '잎 = 소인수분해',
    answer: '1',
    answerType: 'int',
    check: 'int(factorint(72) == {2: 3, 3: 2})',
  });
  assert.equal(cs[1]?.name, '소수 판정');
  const v = runChecks(cs);
  assert.ok(v.ok, v.out);
  assert.equal(runChecks(tamper(cs)).ok, false);
  // 잎을 잘못 낸 모델이면 걸린다
  const forged = cs.map((c, i) =>
    i === 0 && 'check' in c ? { ...c, check: 'int(factorint(72) == {2: 2, 3: 3})' } : c,
  );
  assert.equal(runChecks(forged).ok, false);
  for (const n of [60, 44, 84, 210])
    assert.ok(runChecks(factorTreeDef.checks(parse({ n }))).ok, String(n));
});

test('목표가 있는 부품(끝까지 쪼개기), 글 칸 없음', () => {
  assert.equal(factorTreeDef.hasGoal?.(P72), true);
  assert.deepEqual(factorTreeDef.texts(P72), []);
});

test('조사: 숫자 끝 자리 읽기에 받침이 있으면 은·을, 으로는 ㄹ 받침이 아닐 때만', () => {
  // 0 영·3 삼·6 육 = 받침(ㄹ 아님) / 1 일·7 칠·8 팔 = ㄹ 받침 / 2 이·4 사·5 오·9 구 = 받침 없음
  const ds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.deepEqual(
    ds.map((d) => josa(d, '은')),
    ['은', '은', '는', '은', '는', '는', '은', '은', '은', '는'],
  );
  assert.deepEqual(
    ds.map((d) => josa(d, '을')),
    ['을', '을', '를', '을', '를', '를', '을', '을', '을', '를'],
  );
  assert.deepEqual(
    ds.map((d) => josa(d, '으로')),
    ['으로', '로', '로', '으로', '로', '로', '으로', '로', '로', '로'],
  );
  assert.equal(josa(72, '을'), '를');
  assert.equal(josa(36, '으로'), '으로');
  // 쪼개기 글: "8 ÷ 7 은"(칠)
  const s8 = ftSelect(act(ftInit(P72), 72, 8).s, 1).s;
  assert.equal(ftSplit(s8, 7).msg.text, '8 ÷ 7 은 나누어떨어지지 않아요 (나머지 1).');
  assert.equal(act(ftInit(P72), 72, 2).say, '72 는 2 곱하기 36');
  const s3 = act(act(ftInit(P72), 72, 8).s, 9, 3).s;
  assert.equal(act(s3, 3, 'pr').msg.text, '3 은 1 과 3 으로만 나뉘는 소수예요. 동그라미!');
});

test('2 에 더 큰 수를 누르면 "작은 수로" 대신 소수예요를 권한다(숫자판에 2 보다 작은 수가 없음)', () => {
  const s = ftSelect(act(ftInit(P72), 72, 2).s, 1).s; // 2
  assert.deepEqual(ftSplit(s, 3).msg, {
    text: "2 는 더 쪼갤 수 없어요. '소수예요'를 눌러요.",
    cls: 'bad',
  });
});

test('셋째 나무: 권하는 첫 쪼개기는 앞의 두 나무 어느 것과도 다르다', () => {
  const first = ftResult(run(P72, TREE_236)); // 2 × 36
  const second = ftResult(run(P72, TREE_89)); // 8 × 9
  assert.equal(ftRedoMsg(P72, [second, first]), '이번엔 처음과 다른 수로 쪼개 볼까요? 예: 6 × 12.');
});

test('형식 검사: 쪼개다 숫자판으로 못 쪼개는 합성수가 나오면 오류', () => {
  assert.throws(() => parse({ n: 121 }), /숫자판\(2~9\)으로 못 쪼개는 121/);
  assert.throws(() => parse({ n: 242 }), /숫자판\(2~9\)으로 못 쪼개는 121/);
});

test('포커스: 동그라미 뒤에는 자리 순으로 다음 남은 끝 마디(끝까지 가면 처음으로 돌아감)', () => {
  // 72 → 8, 9 → 8 → 2, 4. 자리 순(위층부터, 왼쪽부터): 9(1층), 2·4(2층)
  const s = act(act(ftInit(P72), 72, 8).s, 8, 2).s;
  const id = (n: number) => s.nodes.findIndex((x) => x.n === n && !x.kids);
  assert.equal(ftNextLeaf(s, id(2)), id(4));
  assert.equal(ftNextLeaf(s, id(4)), id(9));
  assert.equal(ftNextLeaf(run(P72, TREE_89), 3), null);
});

test('움직임 출발점: 움직이던 중간 자리에서 이어 가고, 새 마디는 부모의 지금 자리에서 나온다', () => {
  const s1 = act(ftInit(P72), 72, 8).s;
  const mid = [
    { x: 149, y: 22 },
    { x: 90, y: 50 },
    { x: 200, y: 50 },
  ];
  const s2 = act(s1, 8, 2).s;
  const from = ftMoveFrom(mid, s2);
  assert.deepEqual(from?.slice(0, 3), mid);
  assert.deepEqual(from?.[3], mid[1]);
  assert.deepEqual(from?.[4], mid[1]);
  // 지난 자리가 없으면(처음·새 나무) 움직이지 않는다
  assert.equal(ftMoveFrom(null, s2), null);
});
