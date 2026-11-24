import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../src/generators/rng.ts';
import { ratStr } from '../src/lesson/widgets/q.ts';
import {
  type SimParams,
  simActLabel,
  simAppend,
  simAt,
  simBars,
  simBlocks,
  simCategories,
  simCountsAt,
  simFrame,
  simHistory,
  simInit,
  simRun,
  simulateDef,
} from '../src/lesson/widgets/simulate.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => simulateDef.parse(raw) as SimParams;

test('이론값: 모든 경우를 늘어놓아 센 확률', () => {
  const coin2 = parse({ device: 'coin', n: 2, seed: 1 });
  assert.deepEqual(
    simCategories(coin2).map((c) => [c.label, ratStr(c.prob)]),
    [
      ['앞 0개', '1/4'],
      ['앞 1개', '1/2'],
      ['앞 2개', '1/4'],
    ],
  );
  const dice = parse({ device: 'die', n: 2, seed: 1 });
  assert.equal(ratStr(simCategories(dice).find((c) => c.label === '7')?.prob ?? [0n, 1n]), '1/6');
  const bag = parse({
    device: 'bag',
    bag: [
      { label: '빨강', count: 3 },
      { label: '파랑', count: 2 },
    ],
    seed: 1,
  });
  assert.deepEqual(
    simCategories(bag).map((c) => ratStr(c.prob)),
    ['3/5', '2/5'],
  );
});

test('시행: 같은 시드면 같은 결과, 많이 던지면 이론값에 가까워진다', () => {
  const die = parse({ device: 'die', seed: 7 });
  const a = simRun(die, simInit(die), makeRng(7), 3000);
  const b = simRun(die, simInit(die), makeRng(7), 3000);
  assert.deepEqual(a, b);
  assert.equal(a.trials, 3000);
  for (const c of a.counts) assert.ok(Math.abs(c / 3000 - 1 / 6) < 0.03, String(c));
});

test('막대 그림: 비율 막대와 이론값 표시가 같은 축척', () => {
  const coin = parse({ device: 'coin', seed: 3 });
  const s = { counts: [3, 1], trials: 4 };
  const bars = simBars(coin, s);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.label, '앞');
  assert.equal(bars[0]?.freq, 0.75);
  assert.equal(bars[0]?.theory, 0.5);
  assert.equal(bars[0]?.text, '3번 (75%)');
});

test('검산 항목이 sympy 를 통과하고, 값을 망가뜨리면 실패한다', () => {
  const ps = [
    parse({ device: 'coin', seed: 1 }),
    parse({ device: 'coin', n: 3, seed: 1 }),
    parse({ device: 'die', seed: 1 }),
    parse({ device: 'die', n: 2, seed: 1 }),
    parse({
      device: 'bag',
      bag: [
        { label: '빨강', count: 3 },
        { label: '파랑', count: 2 },
      ],
      seed: 1,
    }),
  ];
  for (const p of ps) {
    const r = runChecks(simulateDef.checks(p));
    assert.ok(r.ok, r.out);
  }
  assert.equal(runChecks(tamper(simulateDef.checks(ps[3] as SimParams))).ok, false);
});

test('parse: 모르는 칸·기구에 맞지 않는 칸·개수 범위는 오류', () => {
  assert.throws(() => parse({ device: 'coin', seed: 1, x: 1 }), /모르는 칸/);
  assert.throws(() => parse({ device: 'coin', seed: 1, bag: [] }), /bag/);
  assert.throws(() => parse({ device: 'die', n: 3, seed: 1 }), /n/);
  assert.throws(() => parse({ device: 'bag', seed: 1 }), /bag/);
});

// ---- 좁고 낮은 화면(접은 화면 382×580) 배치 ----

test('접은 화면 표: 결과가 6가지 넘으면 고르게 두 줄로(주사위 두 개 합 11가지가 세로 11줄 330px 이던 것)', () => {
  assert.deepEqual(simBlocks(2), [[0, 1]]);
  assert.deepEqual(simBlocks(6), [[0, 1, 2, 3, 4, 5]]);
  assert.deepEqual(simBlocks(11), [
    [0, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
  ]);
  assert.deepEqual(simBlocks(7), [
    [0, 1, 2, 3],
    [4, 5, 6],
  ]);
});

test('접은 화면 표의 비율 칸은 퍼센트만(횟수는 위 줄의 던진 횟수로)', () => {
  const coin = parse({ device: 'coin', seed: 3 });
  assert.equal(simBars(coin, { counts: [3, 1], trials: 4 })[0]?.pct, '75%');
  assert.equal(simBars(coin, simInit(coin))[1]?.pct, '0%');
});

test('던지기 단추 글은 기구에 맞는 동사(동전·주사위는 던지기, 주머니는 꺼내기, 성공 횟수는 해 보기)', () => {
  assert.equal(simActLabel(parse({ device: 'coin', seed: 1 })), '던지기');
  assert.equal(simActLabel(parse({ device: 'die', n: 2, seed: 1 })), '던지기');
  assert.equal(
    simActLabel(
      parse({
        device: 'bag',
        bag: [
          { label: '빨강', count: 1 },
          { label: '파랑', count: 2 },
        ],
        seed: 1,
      }),
    ),
    '꺼내기',
  );
  assert.equal(simActLabel(parse({ device: 'trial', p: '1/3', n: 5, seed: 1 })), '해 보기');
});

// ---- 새 기구: 여러 번 꺼내기 · 비복원 · 성공 횟수 · 표본평균 (조각 ④ 요청 41·83·100) ----

const bag12 = [
  { label: '빨강', count: 1 },
  { label: '파랑', count: 2 },
];
const bag23 = [
  { label: '빨강', count: 2 },
  { label: '파랑', count: 3 },
];
const table = (p: SimParams) => simCategories(p).map((c) => [c.label, ratStr(c.prob)]);

test('주머니 여러 번 꺼내기(다시 넣음): 셀 색이 나온 횟수별 확률 = 독립시행', () => {
  // 빨강 1·파랑 2 에서 다시 넣으며 3번: P(빨강 r번) = 3Cr (1/3)^r (2/3)^(3−r)
  const p = parse({ device: 'bag', bag: bag12, draws: 3, count: '빨강', seed: 1 });
  assert.deepEqual(table(p), [
    ['빨강 0번', '8/27'],
    ['빨강 1번', '4/9'],
    ['빨강 2번', '2/9'],
    ['빨강 3번', '1/27'],
  ]);
});

test('주머니 비복원 추출: 꺼낸 공을 다시 넣지 않으면 확률이 달라진다', () => {
  // 빨강 2·파랑 3 에서 2개를 차례로(다시 넣지 않음): 0개 3/5·2/4, 2개 2/5·1/4
  const p = parse({ device: 'bag', bag: bag23, draws: 2, replace: false, count: '빨강', seed: 1 });
  assert.deepEqual(table(p), [
    ['빨강 0번', '3/10'],
    ['빨강 1번', '3/5'],
    ['빨강 2번', '1/10'],
  ]);
  // 다시 넣으면 2/5 × 2/5
  const back = parse({ device: 'bag', bag: bag23, draws: 2, count: '빨강', seed: 1 });
  assert.equal(table(back)[2]?.[1], '4/25');
  // 실제로 다시 넣지 않는다: 한 번에 꺼낸 공들은 서로 다른 공(빨강 2개뿐이라 3번 꺼내면 빨강 3번은 없다).
  // 일어날 수 없는 결과는 막대에서 뺀다(늘 0 인 막대는 '아직 안 나왔다'로 읽힌다)
  const p3 = parse({ device: 'bag', bag: bag23, draws: 3, replace: false, count: '빨강', seed: 4 });
  assert.deepEqual(
    simCategories(p3).map((c) => c.label),
    ['빨강 0번', '빨강 1번', '빨강 2번'],
  );
  const h = simHistory(p3);
  simAppend(p3, h, 2000);
  assert.ok(h.raws.every((r) => r.filter((c) => c === 0).length <= 2));
  assert.equal(
    simCountsAt(p3, h, 2000).reduce((a, b) => a + b, 0),
    2000,
  );
});

test('성공 횟수 기구: 확률 p 인 시행을 n 번 할 때 성공 횟수 = 이항분포', () => {
  const p = parse({ device: 'trial', p: '1/3', n: 3, seed: 1 });
  assert.deepEqual(table(p), [
    ['성공 0번', '8/27'],
    ['성공 1번', '4/9'],
    ['성공 2번', '2/9'],
    ['성공 3번', '1/27'],
  ]);
  const half = parse({ device: 'trial', p: '1/2', n: 4, label: '명중', seed: 1 });
  assert.equal(ratStr(simCategories(half)[2]?.prob ?? [0n, 1n]), '3/8');
  assert.equal(half.label, '명중');
});

test('표본평균 실험: 표본 크기를 고르면 그 크기의 주사위 평균별 확률', () => {
  const p = parse({ device: 'die', sizes: [1, 2, 4], seed: 1 });
  assert.equal(p.n, 1);
  assert.deepEqual(
    simCategories(simAt(p, 1)).map((c) => c.label),
    ['1', '2', '3', '4', '5', '6'],
  );
  const two = simCategories(simAt(p, 2));
  assert.deepEqual(
    two.map((c) => c.label),
    ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6'],
  );
  assert.equal(ratStr(two[5]?.prob ?? [0n, 1n]), '1/6');
  const four = simCategories(simAt(p, 4));
  assert.equal(four[10]?.label, '3.5');
  assert.equal(ratStr(four[10]?.prob ?? [0n, 1n]), '73/648');
  // 표본마다 기록이 따로(같은 시드라도 크기가 다르면 다른 줄기)
  const h1 = simHistory(simAt(p, 1));
  const h2 = simHistory(simAt(p, 2));
  simAppend(simAt(p, 1), h1, 5);
  simAppend(simAt(p, 2), h2, 5);
  assert.notDeepEqual(
    h1.raws.map((r) => r[0]),
    h2.raws.map((r) => r[0]),
  );
});

test('새 기구의 검산 항목이 sympy 를 통과하고(따로 늘어놓아 셈), 값을 망가뜨리면 실패한다', () => {
  const ps = [
    parse({ device: 'bag', bag: bag12, draws: 3, count: '빨강', seed: 1 }),
    parse({ device: 'bag', bag: bag23, draws: 2, replace: false, count: '빨강', seed: 1 }),
    parse({ device: 'trial', p: '1/3', n: 3, seed: 1 }),
    parse({ device: 'die', sizes: [1, 2, 4], seed: 1 }),
  ];
  // 장면 하나 안에서 이름이 겹치면 검산 항목 ref 가 겹친다(장면이 다르면 ref 앞에 장면 id 가 붙어 괜찮다)
  for (const p of ps) {
    const names = simulateDef.checks(p).map((c) => c.name);
    assert.equal(new Set(names).size, names.length, `검산 이름이 겹침: ${names}`);
  }
  const all = ps.flatMap((p, i) =>
    simulateDef.checks(p).map((c) => ({ ...c, name: `${i}:${c.name}` })),
  );
  const r = runChecks(all);
  assert.ok(r.ok, r.out);
  for (const p of ps) assert.equal(runChecks(tamper(simulateDef.checks(p))).ok, false);
});

test('성공 횟수 검산식은 이항분포 닫힌 식 binomial(n,r)·p^r·(1−p)^(n−r) — 앱은 2^n 가지를 늘어놓아 세므로 서로 다른 길', () => {
  const c = simulateDef.checks(parse({ device: 'trial', p: '1/3', n: 3, seed: 1 }));
  assert.equal(
    (c[2] as { check?: string })?.check,
    'binomial(3, 2)*Rational(1, 3)**2*(1-Rational(1, 3))**1',
  );
});

test('지금 있는 기구의 검산 항목은 그대로(이름·답·검산식 — verify:diff 차이 0)', () => {
  const c = simulateDef.checks(parse({ device: 'coin', n: 2, seed: 7, goal: 100 }));
  assert.deepEqual(c[1], {
    name: '이론값 앞 1개',
    answer: '1/2',
    answerType: 'fraction',
    check: 'Rational(len([1 for v0 in range(2) for v1 in range(2) if v0+v1 == 1]), 2**2)',
  });
  const b = simulateDef.checks(parse({ device: 'bag', bag: bag12, seed: 13 }));
  assert.deepEqual(b[0], {
    name: '이론값 빨강',
    answer: '1/3',
    answerType: 'fraction',
    check: 'Rational(1, 1+2)',
  });
});

test('parse: 새 칸의 범위와 기구에 맞지 않는 칸은 오류', () => {
  // 여러 번 꺼내기는 셀 색이 있어야 하고, 셀 색은 주머니에 있는 이름이어야 한다
  assert.throws(() => parse({ device: 'bag', bag: bag12, draws: 2, seed: 1 }), /count/);
  assert.throws(
    () => parse({ device: 'bag', bag: bag12, draws: 2, count: '노랑', seed: 1 }),
    /count/,
  );
  // 한 번만 꺼내면 다시 넣든 말든 같다 — 뜻 없는 칸
  assert.throws(() => parse({ device: 'bag', bag: bag12, replace: false, seed: 1 }), /replace/);
  assert.throws(() => parse({ device: 'bag', bag: bag12, count: '빨강', seed: 1 }), /count/);
  // 다시 넣지 않으면 공 수보다 많이 꺼낼 수 없다
  assert.throws(
    () => parse({ device: 'bag', bag: bag12, draws: 4, replace: false, count: '빨강', seed: 1 }),
    /draws/,
  );
  assert.throws(
    () => parse({ device: 'bag', bag: bag12, draws: 5, count: '빨강', seed: 1 }),
    /draws/,
  );
  // 성공 확률은 0 과 1 사이 기약분수, 시행 1~10번
  assert.throws(() => parse({ device: 'trial', p: '1', n: 3, seed: 1 }), /p/);
  assert.throws(() => parse({ device: 'trial', p: '2/4', n: 3, seed: 1 }), /p/);
  assert.throws(() => parse({ device: 'trial', p: '1/3', n: 11, seed: 1 }), /n/);
  assert.throws(() => parse({ device: 'trial', n: 3, seed: 1 }), /p/);
  assert.throws(() => parse({ device: 'coin', p: '1/3', seed: 1 }), /모르는 칸/);
  // 표본평균: 주사위만, 크기 1~4 를 겹치지 않게 작은 것부터, n 과 같이 쓰지 않는다
  assert.throws(() => parse({ device: 'die', sizes: [2, 1], seed: 1 }), /sizes/);
  assert.throws(() => parse({ device: 'die', sizes: [1, 5], seed: 1 }), /sizes/);
  assert.throws(() => parse({ device: 'die', n: 2, sizes: [1, 2], seed: 1 }), /sizes/);
  assert.throws(() => parse({ device: 'coin', sizes: [1, 2], seed: 1 }), /모르는 칸/);
});

test('접은 화면 그림은 넓은 화면보다 낮고, 결과 이름이 그림 안에 든다', () => {
  const wide = simFrame(false);
  const fold = simFrame(true);
  assert.deepEqual(wide, { W: 320, H: 190, TOP: 16, BASE: 150 });
  assert.ok(fold.H <= 150, String(fold.H));
  assert.equal(fold.W, wide.W);
  // 결과 이름(BASE + 18 에 쓰는 12px 글자)이 그림 높이 안, 막대 높이는 90 이상
  assert.ok(fold.BASE + 18 + 4 <= fold.H);
  assert.ok(fold.BASE - fold.TOP >= 90);
});
