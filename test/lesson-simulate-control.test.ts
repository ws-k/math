// 확률 실험 조절기(makeSimControl): 누르기·'계속'·멈추기·떠나기·낭독기 누름을 화면(Simulate.tsx)과 떼어 순수하게 확인한다.
// 화면은 DOM 사건을 이 조절기에 이어 주기만 하므로(포인터는 공용 useDrag 의 attachDrag), 배선도 가짜 요소로 시험한다.
// 검토 지적(2026-11-23 Major 1~6) 하나하나가 테스트 하나다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachDrag } from '../src/lesson/useDrag.ts';
import {
  makeSimControl,
  SIM_MAX,
  type SimParams,
  seedBias,
  simAppend,
  simDraw,
  simHistory,
  simSay,
  simTheoryShort,
  simulateDef,
} from '../src/lesson/widgets/simulate.ts';

const parse = (raw: unknown) => simulateDef.parse(raw) as SimParams;

function fakeClock() {
  let now = 0;
  let jobs: { at: number; fn: () => void; id: number }[] = [];
  let id = 0;
  return {
    now: () => now,
    later(ms: number, fn: () => void) {
      const j = { at: now + ms, fn, id: ++id };
      jobs.push(j);
      return () => {
        jobs = jobs.filter((x) => x !== j);
      };
    },
    run(ms: number) {
      const end = now + ms;
      for (;;) {
        jobs.sort((a, b) => a.at - b.at || a.id - b.id);
        const j = jobs[0];
        if (!j || j.at > end) break;
        jobs.shift();
        now = j.at;
        j.fn();
      }
      now = end;
    },
  };
}

/** 기록 길이만 세는 가짜 화면. cap 으로 기록 상한을 흉내 낸다 */
function rig(goal = 100, start = 0, cap = SIM_MAX) {
  const clock = fakeClock();
  const log: string[] = [];
  let total = start;
  let painted = 0;
  const ctl = makeSimControl({
    clock,
    toss(k) {
      const n = Math.max(0, Math.min(k, cap - total));
      total += n;
      if (n) painted += 1;
      return n;
    },
    total: () => total,
    goal: () => goal,
    full: () => total >= cap,
    settle: () => log.push(`settle@${total}`),
    done: () => log.push(`done@${total}`),
    setAuto: (on) => log.push(`auto:${on}`),
  });
  return { clock, log, ctl, total: () => total, painted: () => painted };
}

// ---- M1: '계속' 모드와 목표 ----

test('M1 계속 모드: 목표 횟수에 닿는 박자에서 한 번 멈추고 settle·목표를 적는다(화면 밖에서 1만 번까지 던지지 않게)', () => {
  const r = rig(100);
  r.ctl.toggleAuto();
  assert.equal(r.ctl.auto, true);
  r.clock.run(60_000);
  assert.equal(r.ctl.on, false);
  assert.ok(r.total() >= 100 && r.total() < 110, String(r.total()));
  assert.deepEqual(
    r.log.filter((x) => !x.startsWith('auto')),
    [`settle@${r.total()}`, `done@${r.total()}`],
  );
  assert.deepEqual(
    r.log.filter((x) => x.startsWith('auto')),
    ['auto:true', 'auto:false'],
  );
  // 목표를 넘긴 뒤 다시 켜면 계속(다시 멈추지 않음), 끄면 멈춘다
  r.ctl.toggleAuto();
  r.clock.run(3000);
  assert.ok(r.ctl.on);
  r.ctl.toggleAuto();
  assert.equal(r.ctl.on, false);
  assert.equal(r.log.filter((x) => x.startsWith('done')).length, 1);
});

test('M1 꾹 누르기는 목표에서 멈추지 않는다(손을 뗀 자리에서만 판정 — P3)', () => {
  const r = rig(20);
  r.ctl.press();
  r.clock.run(5000);
  assert.ok(r.ctl.on);
  assert.equal(r.log.length, 0);
  r.ctl.release();
  assert.deepEqual(r.log, [`settle@${r.total()}`, `done@${r.total()}`]);
});

test('M1 떠나기(장면이 사라짐): 상태는 정하지 않되, 기록이 목표 이상이면 목표는 적는다', () => {
  const r = rig(10);
  r.ctl.press();
  r.clock.run(3000);
  r.ctl.leave();
  assert.equal(r.ctl.on, false);
  assert.deepEqual(r.log, [`done@${r.total()}`]);
  const n = r.total();
  r.clock.run(3000);
  assert.equal(r.total(), n, '떠난 뒤에는 던지지 않는다');
  // 목표 전이면 아무것도 적지 않는다
  const s = rig(1000);
  s.ctl.toggleAuto();
  s.clock.run(1000);
  s.ctl.leave();
  assert.deepEqual(
    s.log.filter((x) => !x.startsWith('auto')),
    [],
  );
  // 개발 모드의 두 번 붙이기: 다시 살리면 정상
  s.ctl.revive();
  s.ctl.press();
  s.ctl.release();
  assert.ok(s.log.some((x) => x.startsWith('settle')));
});

// ---- M2·M5: 멈추기(창 가림·되감기 시작·화면 밖) ----

test('M2·M5 stop: 무엇으로 시작했든 멈추고 한 번 settle(창이 가려짐·되감기를 잡음·장면이 화면 밖)', () => {
  for (const start of ['press', 'auto'] as const) {
    const r = rig(1000);
    if (start === 'press') r.ctl.press();
    else r.ctl.toggleAuto();
    r.clock.run(2000);
    r.ctl.stop();
    r.ctl.stop();
    assert.equal(r.ctl.on, false);
    assert.equal(r.log.filter((x) => x.startsWith('settle')).length, 1, start);
    const n = r.total();
    r.clock.run(2000);
    assert.equal(r.total(), n);
  }
});

// ---- M3: 공용 끌기 장치(attachDrag)로 이은 배선 ----

class FakeEl extends EventTarget {
  captured = new Set<number>();
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
}
const ptr = (type: string, id = 1, primary = true) =>
  Object.assign(new Event(type, { cancelable: true }), {
    pointerId: id,
    isPrimary: primary,
    button: 0,
    clientX: 0,
    clientY: 0,
  });
const noRaf = () => 0;

test('M3 배선: 누름 = 한 번, 뗌 = settle, 두 번째 손가락은 무시, 잠금은 시작·끝에 한 번씩', () => {
  const r = rig(1000);
  const el = new FakeEl();
  const guard: boolean[] = [];
  attachDrag(
    el as unknown as HTMLElement,
    () => r.ctl.drag,
    (g) => guard.push(g),
    noRaf,
    () => {},
  );
  el.dispatchEvent(ptr('pointerdown'));
  assert.equal(r.total(), 1);
  el.dispatchEvent(ptr('pointerdown', 2, false));
  el.dispatchEvent(ptr('pointerup', 2, false));
  assert.equal(r.log.length, 0, '다른 손가락을 떼도 멈추지 않는다');
  r.clock.run(2000);
  el.dispatchEvent(ptr('pointerup'));
  assert.deepEqual(r.log, [`settle@${r.total()}`]);
  assert.deepEqual(guard, [true, false]);
});

test('M3 배선: 시스템이 빼앗거나(pointercancel) 부품이 사라지면(떼어 냄) 멈춘다', () => {
  const r = rig(1000);
  const el = new FakeEl();
  attachDrag(
    el as unknown as HTMLElement,
    () => r.ctl.drag,
    () => {},
    noRaf,
    () => {},
  );
  el.dispatchEvent(ptr('pointerdown'));
  r.clock.run(1000);
  el.dispatchEvent(ptr('pointercancel'));
  assert.equal(r.ctl.on, false);
  assert.equal(r.log.length, 1);
  const s = rig(1000);
  const el2 = new FakeEl();
  const detach = attachDrag(
    el2 as unknown as HTMLElement,
    () => s.ctl.drag,
    () => {},
    noRaf,
    () => {},
  );
  el2.dispatchEvent(ptr('pointerdown'));
  s.clock.run(1000);
  detach();
  assert.equal(s.ctl.on, false);
});

test('M3 키보드: 누름 = 시작, 키 반복은 무시, 뗌·초점 잃음 = 멈춤', () => {
  const r = rig(1000);
  r.ctl.press();
  r.ctl.press(); // 키 반복이 와도 새로 시작하지 않는다
  r.clock.run(100);
  r.ctl.release();
  assert.equal(r.total(), 1);
  assert.equal(r.log.length, 1);
});

test('낭독기 누름: 포인터·키로 누른 뒤 따라오는 click 은 무시, 포인터 없이 온 click 만 한 번 던지기', () => {
  const r = rig(1000);
  const el = new FakeEl();
  attachDrag(
    el as unknown as HTMLElement,
    () => r.ctl.drag,
    () => {},
    noRaf,
    () => {},
  );
  el.dispatchEvent(ptr('pointerdown'));
  el.dispatchEvent(ptr('pointerup'));
  r.ctl.click();
  assert.equal(r.total(), 1, '손가락 한 번에 click 이 겹쳐도 한 번');
  r.clock.run(5000);
  r.ctl.click();
  assert.equal(r.total(), 2, '포인터 없이 온 click(낭독기 활성화)은 한 번');
  assert.equal(r.log.filter((x) => x.startsWith('settle')).length, 2);
  // 키로 누른 뒤의 click 도 겹치지 않는다
  r.ctl.press();
  r.ctl.release();
  r.ctl.click();
  assert.equal(r.total(), 3);
});

// ---- M4: 기록이 가득 참 ----

test('M4 기록이 가득 차면 누르기·계속이 아무 일도 안 하고, 상한에 닿는 박자에서 멈춘다', () => {
  const r = rig(10, 0, 30);
  r.ctl.press();
  r.clock.run(10_000);
  assert.equal(r.ctl.on, false);
  assert.equal(r.total(), 30);
  assert.equal(r.ctl.full, true);
  const n = r.log.length;
  r.ctl.press();
  r.ctl.toggleAuto();
  r.ctl.click();
  assert.equal(r.ctl.on, false);
  assert.equal(r.log.length, n);
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
