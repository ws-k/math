import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../src/generators/rng.ts';
import { ratStr } from '../src/lesson/widgets/q.ts';
import {
  type SimParams,
  simActLabel,
  simBars,
  simBlocks,
  simCategories,
  simFrame,
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

test('버튼의 읽는 이름은 기구에 맞는 동사(동전·주사위는 던지기, 주머니는 뽑기)', () => {
  assert.equal(simActLabel('coin', 1), '동전 1번 던지기');
  assert.equal(simActLabel('die', 100), '주사위 100번 던지기');
  assert.equal(simActLabel('bag', 10), '공 10번 뽑기');
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
