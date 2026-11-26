// 확률 실험 조절기(makeSimControl): '던지기·10번·100번' 누름과 목표·기록 상한 판정을 화면(Simulate.tsx)과 떼어
// 순수하게 확인한다. 화면은 단추의 click 을 이 조절기에 이어 주기만 한다(키보드 Enter·Space·낭독기 활성화도 click).
// 그 밖에 검토 지적(2026-11-23 Major 4·6)의 그림·형식 검사 테스트가 남아 있다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  makeSimControl,
  SIM_MAX,
  SIM_STEPS,
  type SimParams,
  seedBias,
  simAppend,
  simDraw,
  simHistory,
  simSay,
  simStepLabel,
  simTheoryShort,
  simulateDef,
} from '../src/lesson/widgets/simulate.ts';

const parse = (raw: unknown) => simulateDef.parse(raw) as SimParams;

/** 기록 길이만 세는 가짜 화면. cap 으로 기록 상한을 흉내 낸다 */
function rig(goal = 100, start = 0, cap = SIM_MAX) {
  const log: string[] = [];
  let total = start;
  const ctl = makeSimControl({
    toss(k) {
      const n = Math.max(0, Math.min(k, cap - total));
      total += n;
      return n;
    },
    total: () => total,
    goal: () => goal,
    full: () => total >= cap,
    settle: () => log.push(`settle@${total}`),
    done: () => log.push(`done@${total}`),
  });
  return { log, ctl, total: () => total };
}

// ---- 한 번 누르면 정해진 만큼(2026-11-26 PM: 꾹 누르기 대신 '10번·100번') ----

test('한 번 누르면 그만큼만 던지고 상태는 한 번만 정한다(누를 때마다 settle 1번 — 렌더 1번)', () => {
  const r = rig(1000);
  assert.equal(r.ctl.toss(1), 1);
  assert.equal(r.ctl.toss(10), 10);
  assert.equal(r.ctl.toss(100), 100);
  assert.equal(r.total(), 111);
  assert.deepEqual(r.log, ['settle@1', 'settle@11', 'settle@111']);
});

test('목표: 단추 한 번으로 목표를 넘겨도(95 → 105) 그 자리에서 한 번 적고, 다시 넘겨도 또 적지 않는다', () => {
  const r = rig(100, 95);
  r.ctl.toss(10);
  assert.deepEqual(r.log, ['settle@105', 'done@105']);
  r.ctl.toss(100);
  assert.equal(r.log.filter((x) => x.startsWith('done')).length, 1);
  // 딱 맞게 닿아도(0 → 100) 목표
  const s = rig(100);
  s.ctl.toss(100);
  assert.deepEqual(s.log, ['settle@100', 'done@100']);
  // 목표 전이면 적지 않는다
  const u = rig(100);
  for (let i = 0; i < 9; i++) u.ctl.toss(10);
  assert.equal(u.log.filter((x) => x.startsWith('done')).length, 0);
  u.ctl.toss(1);
  u.ctl.toss(10);
  assert.deepEqual(u.log.slice(-2), ['settle@101', 'done@101']);
});

test('기록 상한: 남은 만큼만 던지고(9950 에서 100번 → 50), 가득 차면 누름이 아무 일도 안 한다', () => {
  const r = rig(10, SIM_MAX - 50);
  assert.equal(r.ctl.toss(100), 50);
  assert.equal(r.total(), SIM_MAX);
  assert.equal(r.ctl.full, true);
  const n = r.log.length;
  assert.equal(r.ctl.toss(1), 0);
  assert.equal(r.ctl.toss(100), 0);
  assert.equal(r.log.length, n, '가득 찬 뒤에는 settle 도 없다');
});

// ---- 같은 시드면 같은 기록 ----

test('1번 단추를 100번 누른 것과 100번 단추를 한 번 누른 것은 같은 기록(같은 시드)', () => {
  const p = parse({ device: 'die', n: 2, seed: 5, goal: 200 });
  const run = (presses: number[]) => {
    const h = simHistory(p);
    const ctl = makeSimControl({
      toss: (k) => simAppend(p, h, k),
      total: () => h.cats.length,
      goal: () => p.goal,
      full: () => h.cats.length >= SIM_MAX,
      settle() {},
      done() {},
    });
    for (const k of presses) ctl.toss(k);
    return h;
  };
  const ones = run(Array.from({ length: 100 }, () => 1));
  const hundred = run([100]);
  // 10 + 1×10 + 10×8 = 100
  const mixed = run([10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10]);
  assert.equal(hundred.cats.length, 100);
  assert.equal(mixed.cats.length, 100);
  assert.deepEqual(ones.raws, hundred.raws);
  assert.deepEqual(ones.cats, hundred.cats);
  assert.deepEqual(mixed.raws, hundred.raws);
});

// ---- 단추 글 ----

test('단추 셋: 1번은 기구의 동사, 10번·100번은 짧은 글 + 낭독기는 동사까지(무엇을 10번 하는지)', () => {
  assert.deepEqual(SIM_STEPS, [1, 10, 100]);
  const coin = parse({ device: 'coin', n: 1, seed: 1 });
  const bag = parse({
    device: 'bag',
    bag: [
      { label: '빨강', count: 1 },
      { label: '파랑', count: 2 },
    ],
    seed: 1,
  });
  const tr = parse({ device: 'trial', p: '1/3', n: 2, seed: 1 });
  assert.deepEqual(
    SIM_STEPS.map((k) => simStepLabel(coin, k)),
    [
      { text: '던지기', aria: '1번 던지기' },
      { text: '10번', aria: '10번 던지기' },
      { text: '100번', aria: '100번 던지기' },
    ],
  );
  assert.deepEqual(simStepLabel(bag, 10), { text: '10번', aria: '10번 꺼내기' });
  assert.deepEqual(simStepLabel(tr, 1), { text: '해 보기', aria: '1번 해 보기' });
});

test('M4 그림·낭독: 가득 차면 "기록이 가득 찼어요(10000번)", 되감은 자리는 그대로', () => {
  const p = parse({ device: 'coin', n: 2, seed: 7 });
  const h = simHistory(p);
  simAppend(p, h, SIM_MAX);
  assert.equal(
    simDraw(p, h, SIM_MAX, { theory: true, compact: true }).texts.cap,
    `기록이 가득 찼어요(${SIM_MAX}번)`,
  );
  assert.match(simSay(p, h, SIM_MAX), /^기록이 가득 찼어요\(10000번\)\. /);
  assert.match(simDraw(p, h, 37, { theory: true, compact: true }).texts.cap ?? '', /^37번째 · /);
});

// ---- M6: 접은 표의 이론 칸과 글 길이 ----

test('M6 접은 표 이론 칸: 다섯 글자 넘는 분수는 퍼센트로(정확한 분수는 넓은 표·검산에)', () => {
  assert.equal(simTheoryShort([1n, 36n]), '1/36');
  assert.equal(simTheoryShort([5n, 36n]), '5/36');
  assert.equal(simTheoryShort([73n, 648n]), '11.3%');
  assert.equal(simTheoryShort([1n, 1024n]), '0.1%');
});

test('M6 형식 검사: 주머니 공 이름·trial 이름은 세 글자까지, 공 이름 첫 글자는 겹치지 않게(결과 그림이 첫 글자)', () => {
  const two = (a: string, b: string) => ({
    device: 'bag',
    bag: [
      { label: a, count: 1 },
      { label: b, count: 2 },
    ],
    seed: 1,
  });
  assert.ok(parse(two('흰 공', '검은공')));
  assert.throws(() => parse(two('빨간 공', '파랑')), /label/);
  assert.throws(() => parse(two('파랑', '파란색')), /첫 글자/);
  assert.throws(
    () => parse({ device: 'trial', p: '1/3', n: 3, label: '골인 성공', seed: 1 }),
    /label/,
  );
});

// ---- 낭독 요약·공 색 ----

test('결과가 많으면(7가지 이상) 낭독 요약은 마지막 결과·횟수·가장 많이 나온 것만', () => {
  const p = parse({ device: 'die', n: 2, seed: 3 });
  const h = simHistory(p);
  simAppend(p, h, 50);
  const s = simSay(p, h, 50);
  assert.match(s, /^합 \d+\. 던진 횟수 50번\. 가장 많이 나온 것 \d+: \d+번$/);
});

test('공 색: 이름에 색 낱말이 있으면 그 색, 없으면 기본', () => {
  const p = parse({
    device: 'bag',
    bag: [
      { label: '빨강', count: 1 },
      { label: '흰 공', count: 1 },
      { label: 'A', count: 1 },
    ],
    seed: 1,
  });
  const h = simHistory(p);
  simAppend(p, h, 40);
  const cls = new Set<string>();
  for (let t = 1; t <= 40; t++) {
    const c = simDraw(p, h, t, { theory: true, compact: true }).last.find((m) => m.k === 'lc:0');
    cls.add(String(c?.a.class));
  }
  assert.deepEqual([...cls].sort(), ['sim-ball', 'sim-ball red', 'sim-ball white']);
});

// ---- 시드 치우침 자동 검사 ----

test('seedBias: 앞쪽이 이론값에서 3σ 넘게 벗어나거나 이론상 1등 막대가 1등이 아니면 문제로 알린다', () => {
  // 시안에서 '앞 0개' 44% 로 보인 바로 그 줄기(앱에서는 63번에 '앞 2개' 28번, z 3.6)
  const bad = seedBias(parse({ device: 'coin', n: 2, seed: 7, goal: 100 }));
  assert.equal(bad.ok, false);
  assert.ok(
    bad.problems.some((x) => /앞 2개/.test(x)),
    bad.problems.join(' / '),
  );
  const good = seedBias(parse({ device: 'coin', n: 2, seed: 5, goal: 100 }));
  assert.deepEqual(good, { ok: true, problems: [] });
  // 표본평균은 크기마다 본다
  const m = seedBias(parse({ device: 'die', sizes: [1, 2], seed: 3, goal: 100 }));
  assert.equal(typeof m.ok, 'boolean');
});

test('seedBias 예민함: 편차(3σ) 검사는 고른 시드를 드물게만 거르고, 1등 검사는 결과끼리 확률이 가까울 때 자주 걸린다', () => {
  const rate = (raw: object, kind: string) => {
    let hit = 0;
    for (let s = 0; s < 200; s++) {
      const r = seedBias(parse({ ...raw, seed: s }));
      if (r.problems.some((x) => x.includes(kind))) hit += 1;
    }
    return hit / 200;
  };
  const coin2 = { device: 'coin', n: 2, goal: 100 };
  const dice = { device: 'die', n: 2, goal: 200 };
  assert.ok(rate(coin2, 'σ') < 0.08, '동전 둘 편차');
  assert.ok(rate(dice, 'σ') < 0.2, '주사위 둘 편차(11가지 × 10번마다라 조금 더 걸림)');
  // 주사위 둘의 7(6/36)은 6·8(5/36)과 가까워 200번에도 셋에 하나 꼴로 1등이 아니다 — 그 줄기는 "어떤 합이 가장 자주
  // 나올까요" 장면을 실제로 엉뚱하게 이끄므로 걸러지는 게 맞다. 그래도 절반 넘게는 통과해 고를 시드가 충분하다
  const top = rate(dice, '1등');
  assert.ok(top > 0.15 && top < 0.5, String(top));
  assert.equal(rate(coin2, '1등'), 0);
});
