// 확률 실험의 '직접 던지기'(조각 ④ · 1-나): 기록·되감기·그릴 목록, 그리고 난수가 고르게 나오는지.
// 화면은 되감는 동안 React 를 거치지 않고 그릴 목록(simDraw)을 직접 적용하므로, 여기서 목록을 순수하게 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../src/generators/rng.ts';
import {
  SIM_MAX,
  type SimParams,
  simAppend,
  simAt,
  simCategories,
  simCountsAt,
  simDraw,
  simHistory,
  simSay,
  simulateDef,
} from '../src/lesson/widgets/simulate.ts';

const parse = (raw: unknown) => simulateDef.parse(raw) as SimParams;
const coin2 = parse({ device: 'coin', n: 2, seed: 7 });

// ---- 기록과 되감기 ----

test('기록: 한 번씩 던지든 몰아 던지든 같은 시드면 같은 기록(1번·10번·100번 단추를 어떻게 섞어 눌렀는지와 무관)', () => {
  const a = simHistory(coin2);
  for (const k of [1, 1, 2, 5, 5, 1, 2]) simAppend(coin2, a, k);
  const b = simHistory(coin2);
  simAppend(coin2, b, 17);
  assert.equal(a.cats.length, 17);
  assert.deepEqual(a.cats, b.cats);
  assert.deepEqual(a.raws, b.raws);
});

test('되감기: 앞의 t 번만 센다. 기록은 지우지 않아 앞뒤로 오가도 같은 막대', () => {
  const h = simHistory(coin2);
  simAppend(coin2, h, 120);
  const at37 = simCountsAt(coin2, h, 37);
  assert.equal(
    at37.reduce((x, y) => x + y, 0),
    37,
  );
  simCountsAt(coin2, h, 120);
  assert.deepEqual(simCountsAt(coin2, h, 37), at37);
  assert.equal(h.cats.length, 120);
  // 되감은 자리에서 다시 던지면 끝에 이어 쌓는다 — 되감지 않고 던진 것과 같은 기록
  simAppend(coin2, h, 10);
  const plain = simHistory(coin2);
  simAppend(coin2, plain, 130);
  assert.deepEqual(h.cats, plain.cats);
  assert.deepEqual(simCountsAt(coin2, h, 0), [0, 0, 0]);
});

test(`기록은 ${SIM_MAX}번까지: 넘게 던지려 하면 거기서 멈추고 몇 번 던졌는지 알린다`, () => {
  const h = simHistory(coin2);
  assert.equal(simAppend(coin2, h, SIM_MAX - 2), SIM_MAX - 2);
  assert.equal(simAppend(coin2, h, 5), 2);
  assert.equal(simAppend(coin2, h, 1), 0);
  assert.equal(h.cats.length, SIM_MAX);
});

// ---- 그릴 목록 ----

const view = (p: SimParams, n: number, t: number, theory: boolean) => {
  const h = simHistory(p);
  simAppend(p, h, n);
  return simDraw(p, h, t, { theory, compact: true });
};

test('그릴 목록: 같은 기록·같은 자리면 같은 그림(되감기 재현), 막대 높이 = 앞 t 번의 비율', () => {
  const a = view(coin2, 120, 37, true);
  const b = view(coin2, 120, 37, true);
  assert.deepEqual(a, b);
  assert.equal(a.texts.read, '던진 횟수 37번');
  assert.equal(a.texts.rew, '37/120번');
  assert.match(a.texts.cap ?? '', /^37번째 · 앞 [0-2]개$/);
  const end = view(coin2, 120, 120, true);
  assert.equal(end.texts.rew, '120번');
  assert.match(end.texts.cap ?? '', /^방금 · /);
  // 막대 셋의 비율 글자 합이 앞 37번을 센 것과 같다
  const h = simHistory(coin2);
  simAppend(coin2, h, 120);
  const counts = simCountsAt(coin2, h, 37);
  counts.forEach((c, i) => {
    assert.equal(a.texts[`pct:${i}`], `${Math.round((c / 37) * 100)}%`);
  });
});

test('그릴 목록: 아직 안 던졌으면 막대 0, 안내 글', () => {
  const d = view(coin2, 0, 0, true);
  assert.equal(d.texts.cap, '아직 안 던졌어요');
  assert.equal(d.texts.rew, '0번');
  const bar = d.marks.find((m) => m.k === 'b:0');
  assert.equal(bar?.a.height, 0);
});

test('질문 장면에서 맞히기 전: 그릴 목록에 이론값(점선·이론 글자)이 아예 없다', () => {
  const hidden = view(coin2, 50, 50, false);
  assert.equal(
    hidden.marks.some((m) => m.k.startsWith('t:')),
    false,
  );
  assert.equal(
    Object.values(hidden.texts).some((t) => t.includes('1/2') || t.includes('1/4')),
    false,
  );
  const shown = view(coin2, 50, 50, true);
  assert.equal(shown.marks.filter((m) => m.k.startsWith('t:')).length, 3);
});

test('마지막 결과 그림: 동전마다 앞/뒤 글자, 되감으면 그 자리의 결과', () => {
  const h = simHistory(coin2);
  simAppend(coin2, h, 5);
  const raw = h.raws[2] as number[];
  const d = simDraw(coin2, h, 3, { theory: true, compact: true });
  raw.forEach((v, j) => {
    assert.equal(d.last.find((m) => m.k === `lt:${j}`)?.text, v ? '앞' : '뒤');
  });
  assert.equal(d.last.filter((m) => m.k.startsWith('lc:')).length, 2);
});

test('표본평균: 표본이 커져 막대가 많으면(21개) 결과 이름은 정수 자리에만', () => {
  const p = simAt(parse({ device: 'die', sizes: [1, 2, 4], seed: 3 }), 4);
  assert.equal(simCategories(p).length, 21);
  const d = view(p, 30, 30, true);
  const labs = d.marks.filter((m) => m.k.startsWith('l:') && m.a.visibility !== 'hidden');
  assert.deepEqual(
    labs.map((m) => m.text),
    ['1', '2', '3', '4', '5', '6'],
  );
});

test('누른 뒤 낭독기 요약: 마지막 결과, 횟수, 결과마다 "이름: 횟수"(이름 끝의 "번"과 횟수가 붙어 읽히지 않게)', () => {
  const h = simHistory(coin2);
  simAppend(coin2, h, 3);
  assert.match(
    simSay(coin2, h, 3),
    /^앞 \d개\. 던진 횟수 3번\. 앞 0개: \d번, 앞 1개: \d번, 앞 2개: \d번$/,
  );
  const tr = parse({ device: 'trial', p: '1/3', n: 2, label: '명중', seed: 1 });
  const ht = simHistory(tr);
  simAppend(tr, ht, 1);
  assert.match(simSay(tr, ht, 1), /명중 0번: \d번, 명중 1번: \d번/);
  assert.equal(simSay(coin2, h, 0), '');
});

// ---- 난수가 고르게 나오는가 ----
// 시안(prob/toss.html)에서 동전 두 개 63번에 '앞 0개'가 44%(이론 25%)로 보였다. 난수기(mulberry32)가 치우쳤는지,
// 그 시드가 운 나쁜 줄기였는지를 가른다: 많이 던지면 이론값에 붙고(카이제곱), 시드 여러 개의 앞 100번 퍼짐이
// 이항분포 그대로면 난수기는 고르다 — 남는 것은 시드 하나의 운이다.

/** 카이제곱 임계값(유의수준 0.1%) — Wilson–Hilferty 근사 */
const chiCrit = (df: number) => {
  const z = 3.09;
  return df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
};
const chi = (p: SimParams, N: number) => {
  const h = simHistory(p);
  simAppend(p, h, Math.min(N, SIM_MAX));
  const counts = simCountsAt(p, h, h.cats.length);
  const n = h.cats.length;
  const probs = simCategories(p).map((c) => Number(c.prob[0]) / Number(c.prob[1]));
  let x2 = 0;
  probs.forEach((q, i) => {
    if (q > 0) x2 += ((counts[i] ?? 0) - n * q) ** 2 / (n * q);
  });
  return { x2, df: probs.filter((q) => q > 0).length - 1 };
};

test('많이 던지면 모든 기구가 이론값에 붙는다(카이제곱, 시드 여러 개)', () => {
  const ps = [
    { device: 'coin', n: 1 },
    { device: 'coin', n: 2 },
    { device: 'coin', n: 4 },
    { device: 'die', n: 1 },
    { device: 'die', n: 2 },
    {
      device: 'bag',
      bag: [
        { label: '빨강', count: 2 },
        { label: '파랑', count: 3 },
        { label: '노랑', count: 5 },
      ],
    },
    {
      device: 'bag',
      bag: [
        { label: '빨강', count: 2 },
        { label: '파랑', count: 3 },
      ],
      draws: 2,
      replace: false,
      count: '빨강',
    },
    {
      device: 'bag',
      bag: [
        { label: '빨강', count: 1 },
        { label: '파랑', count: 2 },
      ],
      draws: 3,
      count: '빨강',
    },
    { device: 'trial', p: '1/3', n: 5 },
  ];
  for (const raw of ps)
    for (const seed of [5, 7, 11, 13, 21, 23, 27]) {
      const { x2, df } = chi(parse({ ...raw, seed }), SIM_MAX);
      assert.ok(
        x2 < chiCrit(df),
        `${JSON.stringify(raw)} seed ${seed}: χ²=${x2.toFixed(1)} df=${df}`,
      );
    }
  for (const m of [1, 2, 4]) {
    const { x2, df } = chi(simAt(parse({ device: 'die', sizes: [1, 2, 4], seed: 9 }), m), SIM_MAX);
    assert.ok(x2 < chiCrit(df), `표본 ${m}: χ²=${x2.toFixed(1)}`);
  }
});

test('시드 2000개의 앞 100번: 퍼짐이 이항분포 그대로(난수기가 앞쪽에서 치우치지 않음)', () => {
  // 동전 두 개에서 '앞 1개' 횟수 ~ B(100, 1/2): 평균 50, 분산 25. 3σ 넘게 벗어나는 시드는 이론상 약 0.3%
  const S = 2000;
  const xs: number[] = [];
  for (let s = 0; s < S; s++) {
    const p = parse({ device: 'coin', n: 2, seed: s });
    const h = simHistory(p);
    simAppend(p, h, 100);
    xs.push(simCountsAt(p, h, 100)[1] ?? 0);
  }
  const mean = xs.reduce((a, b) => a + b, 0) / S;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / S;
  assert.ok(Math.abs(mean - 50) < 0.4, `평균 ${mean}`);
  assert.ok(Math.abs(v - 25) < 3, `분산 ${v}`);
  const far = xs.filter((x) => Math.abs(x - 50) >= 15).length / S;
  assert.ok(far < 0.01, `3σ 밖 ${far}`);
});

test('한 번 던질 때 동전 두 개는 서로 독립이고, 앞뒤 던지기끼리도 독립', () => {
  const h = simHistory(coin2);
  simAppend(coin2, h, SIM_MAX);
  const cell = [0, 0, 0, 0];
  let same = 0;
  h.raws.forEach((r, i) => {
    const c = (r[0] as number) * 2 + (r[1] as number);
    cell[c] = (cell[c] ?? 0) + 1;
    if (i > 0 && (h.raws[i - 1] as number[])[1] === r[0]) same += 1;
  });
  const n = h.raws.length;
  const x2 = cell.reduce((a, c) => a + (c - n / 4) ** 2 / (n / 4), 0);
  assert.ok(x2 < chiCrit(3), `칸 ${cell}`);
  // 앞 던지기의 둘째 동전과 다음 던지기의 첫째 동전이 같은 비율 ≈ 1/2
  assert.ok(Math.abs(same / (n - 1) - 0.5) < 0.02, String(same / (n - 1)));
});

test('난수기 자체(mulberry32)도 같은 시드면 같은 수열', () => {
  const a = makeRng(7);
  const b = makeRng(7);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});
