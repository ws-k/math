// 수직선 2-라(추가형 옵션): 범위 확대·소수 눈금·칸 폭 하한, 두 줄, 양쪽 막힌·두 조각 구간, 무리수 점(P10),
// 편차 막대·분산·표준편차·점 무게, 진리집합 비교, 점프 화살표 이름표 겹침. 화면 없이 모델만 본다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  isJumper,
  JUMPER,
  JUMPER2,
  jumpHits,
  type NLParams,
  nearestCell,
  nlActive,
  nlDrag,
  nlDraw,
  nlGrade,
  nlHandleText,
  nlHeadTex,
  nlHeight,
  nlInit,
  nlIwFlip,
  nlJumpArcs,
  nlJumpCount,
  nlKey,
  nlNarrowScale,
  nlRegion,
  nlSets,
  nlTicks,
  nlTicks2,
  numberLineDef,
  xOf,
} from '../src/lesson/widgets/numberLine.ts';
import { type NLSet, relation, setPy, setText } from '../src/lesson/widgets/numberLineSet.ts';
import { nearestHandle } from '../src/lesson/widgets/numberLineWire.ts';
import { q } from '../src/lesson/widgets/q.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => numberLineDef.parse(raw) as NLParams;
const labels = (p: NLParams) => nlTicks(p).flatMap((t) => (t.label === undefined ? [] : [t.label]));
const names = (p: NLParams) => numberLineDef.checks(p).map((c) => c.name);

// ---- 범위 확대·소수 눈금·칸 폭 하한 ----

test('범위 확대: 정수 끝 1000 너머(5000원)도 되고, 숫자가 겹치면 숫자 간격을 넓힌다(글자 폭 기준)', () => {
  const p = parse({ min: 0, max: 5000, step: '100', label: '500' });
  // 500 간격이면 "5,000" 다섯 글자가 27 단위마다 — 겹치므로 두 배로
  assert.deepEqual(labels(p), ['0', '1,000', '2,000', '3,000', '4,000', '5,000']);
  assert.throws(() => parse({ min: 0, max: 2_000_000, step: '100000' }), /수직선 max/);
});

test('지금 단원 36장면의 눈금 숫자는 그대로다(글자 폭 기준을 더해도 넓어지는 장면이 없다)', () => {
  const dir = join(import.meta.dirname, '../content/units');
  let n = 0;
  for (const f of readdirSync(dir)) {
    const u = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const s of u.lesson?.scenes ?? []) {
      if (s.widget?.type !== 'numberLine') continue;
      n++;
      const p = parse(s.widget.params);
      // 2-다 까지의 규칙: 숫자 13개 넘으면 ceil(개수/12) 배
      const step = q(p.step);
      let every = Number(p.label ? q(p.label)[0] : 1) / Number(p.label ? q(p.label)[1] : 1);
      if (!p.label && Number(step[0]) / Number(step[1]) > 1)
        every = Number(step[0]) / Number(step[1]);
      const count = (p.max - p.min) / every;
      if (count > 12) every *= Math.ceil(count / 12);
      const old = nlTicks(p).filter((_, k) => {
        const v = p.min + (k * Number(step[0])) / Number(step[1]);
        return Math.abs((v - p.min) / every - Math.round((v - p.min) / every)) < 1e-9;
      }).length;
      assert.equal(labels(p).length, old, `${u.id}/${s.id}`);
    }
  }
  assert.equal(n, 36);
});

test('소수 눈금(decimal): 눈금 숫자·읽는 값이 소수 글자, 유한소수가 아닌 칸은 오류', () => {
  const p = parse({
    min: 0,
    max: 2,
    step: '1/10',
    label: '1/2',
    decimal: true,
    points: [{ id: 'P', at: '0', drag: true }],
    task: { type: 'point', point: 'P', answer: '13/10', check: '1+3*Rational(1,10)' },
  });
  assert.deepEqual(labels(p), ['0', '0.5', '1', '1.5', '2']);
  const s = { ...nlInit(p), pts: { P: 13 } };
  assert.equal(nlDraw(p, s).texts['pt:P'], 'P = 1.3');
  assert.equal(nlGrade(p, s), true);
  assert.throws(() => parse({ min: 0, max: 1, step: '1/3', decimal: true }), /소수/);
  // 점프 이동도 소수로 적을 수 있어야 한다
  const j = parse({
    min: 0,
    max: 2,
    step: '1/10',
    decimal: true,
    jumps: { start: '0', moves: ['3/10', '1/2'] },
  });
  assert.equal(nlDraw(j, { ...nlInit(j), jump: 2 }).texts.jump, '0 + 0.3 + 0.5 = 0.8');
});

test('칸 폭 하한(검토 M1): 끄는 것이 있는 수직선은 모두 가장 좁은 화면 한 칸이 7px 이상 — 옛 범위·분수 칸도 예외 없음', () => {
  // 100칸 = 272/100 × 298/320 ≈ 2.5px — 보여 주기만이면 되고, 끄는 점이 있으면 오류
  assert.throws(
    () => parse({ min: 0, max: 100, step: '1', points: [{ id: 'P', at: '0', drag: true }] }),
    /7px/,
  );
  parse({ min: 0, max: 100, step: '1', points: [{ id: 'A', at: '50' }] });
  assert.throws(() => parse({ min: 0, max: 101, step: '1' }), /100칸/);
  // 분수 40칸(≈6.3px)도 이제 오류(예전엔 옛 옵션이면 통과). 16칸이면 통과
  const ruler = { min: 0, max: 1, points: [{ id: 'P', at: '0', drag: true }] };
  assert.throws(() => parse({ ...ruler, step: '1/40' }), /7px/);
  parse({ ...ruler, step: '1/16' });
  // 끄는 구간 끝점: 20칸이면 통과, 50칸이면 오류
  const iv = { type: 'interval', ineq: 'x<1000', answer: { at: '1000', dir: 'left', open: true } };
  parse({ min: 0, max: 2000, step: '100', task: iv });
  assert.throws(() => parse({ min: 0, max: 2000, step: '40', task: iv }), /7px/);
});

test('칸 폭 배율(검토 M2): 키 큰 그림은 382×580 에서 높이 상한으로 줄어든다 — 누르는 지름이 44px 미만이면 오류', () => {
  const short = parse({ min: 0, max: 10, step: '1', points: [{ id: 'P', at: '0', drag: true }] });
  assert.equal(nlNarrowScale(short), 298 / 320); // 폭이 정한다
  const tall = {
    min: 0,
    max: 10,
    step: '1',
    jumps: { start: '0', moves: ['2'] },
    sets: [
      { name: 'A', cond: 'x>1', lo: { at: '1', open: true } },
      { name: 'B', cond: 'x>2', lo: { at: '2', open: true } },
      { name: 'C', cond: 'x>3', lo: { at: '3', open: true } },
    ],
    data: {
      values: ['0', '1', '2', '3', '4', '5', '6'],
      weights: [1, 1, 1, 1, 1, 1, 1],
      show: ['mean'],
    },
    second: { min: '0', max: '20', step: '2' },
  };
  const p = parse({ ...tall, jumps: undefined });
  // 보여 주기만이면 된다. 배율은 높이 상한 209 ÷ 그림 높이
  assert.equal(nlNarrowScale(p), 209 / nlHeight(p));
  assert.ok(nlNarrowScale(p) * 56 < 44);
  assert.throws(() => parse(tall), /44px/);
});

// ---- 두 줄 수직선 ----

const TWO = parse({
  min: 0,
  max: 2,
  step: '1/3',
  label: '1',
  unit: 'L',
  second: { min: '0', max: '6', step: '1', unit: '컵' },
  points: [{ id: 'P', at: '0', drag: true }],
  task: { type: 'point', point: 'P', answer: '2/3', check: 'Rational(2)/3' },
});

test('두 줄: 아래 줄은 같은 길이의 다른 눈금(단위는 마지막 숫자 뒤), 점의 아래 줄 값(정확한 분수)을 함께 읽는다', () => {
  assert.deepEqual(
    nlTicks2(TWO).map((t) => t.label),
    ['0', '1', '2', '3', '4', '5', '6 컵'],
  );
  // 아래 줄 끝과 위 줄 끝이 같은 x
  assert.equal(nlTicks2(TWO).at(-1)?.x, xOf(TWO, 6));
  const s = { ...nlInit(TWO), pts: { P: 2 } };
  assert.equal(nlDraw(TWO, s).texts['pt:P'], 'P = 2/3 L ↔ 2 컵');
  // 아래 줄의 점(이음선 끝)도 끄는 동안 같은 x 로 움직인다
  assert.equal(mark(nlDraw(TWO, s), 'p2:P')?.a.cx, xOf(TWO, 2));
});

test('두 줄 검산: 답 칸의 아래 줄 값 = sympy 가 두 줄의 끝 값(매개변수 원문)으로 따로 비례 계산한 값', () => {
  const cs = numberLineDef.checks(TWO);
  assert.deepEqual(names(TWO), ['점 찍기', '두 줄 P']);
  const c = cs[1] as { answer: string; check: string };
  assert.equal(c.answer, '2');
  // 답을 옮겨 적지 않고 과제의 답(위 줄 2/3)과 두 줄의 끝 값을 늘어놓는다
  assert.notEqual(c.check.trim(), 'Integer(2)');
  assert.match(c.check, /Rational\(2,3\)/);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  assert.equal(runChecks(tamper([cs[1] as (typeof cs)[number]])).ok, false);
  assert.throws(
    () => parse({ min: 0, max: 2, step: '1', second: { min: '0', max: '5', step: '2' } }),
    /나누어/,
  );
});

// ---- 양쪽 막힌·두 조각 구간 ----

test('구간 모양 4가지의 글자·sympy 식·포함 관계', () => {
  const f = (v: ReturnType<typeof q>) =>
    v[1] === 1n ? String(v[0]).replace('-', '−') : `${v[0]}/${v[1]}`;
  const inn: NLSet = { lo: { at: '-1', open: true }, hi: { at: '3', open: false } };
  // 바깥 두 조각: 끝점의 빈 점/찬 점은 그 끝점이 드는지(찬 점이면 x ≤ −1 · x ≥ 3) — 그림의 점 모양과 같은 뜻
  const out: NLSet = { lo: { at: '-1', open: true }, hi: { at: '3', open: true }, out: true };
  assert.equal(setText({ ...inn, out: true }, f), 'x < −1 또는 x ≥ 3');
  assert.equal(setText(inn, f), '−1 < x ≤ 3');
  assert.equal(setText(out, f), 'x < −1 또는 x > 3');
  assert.equal(setText({ lo: { at: '2', open: false } }, f), 'x ≥ 2');
  assert.equal(setPy(inn), 'Interval(Integer(-1), Integer(3), True, False)');
  assert.equal(
    setPy(out),
    'Union(Interval(-oo, Integer(-1), True, True), Interval(Integer(3), oo, True, True))',
  );
  // 3 은 out 에서 빠진다(빈 점)
  assert.equal(relation({ lo: { at: '4', open: true } }, out), 'sub');
  assert.equal(relation({ lo: { at: '3', open: false } }, out), 'none');
  assert.equal(relation(inn, { lo: { at: '-1', open: true } }), 'sub');
  assert.equal(relation({ lo: { at: '-1', open: true } }, inn), 'sup');
  assert.equal(relation(inn, { ...inn }), 'eq');
  // 끝점이 같아도 빈 점·찬 점이 다르면 포함
  assert.equal(
    relation(inn, { lo: { at: '-1', open: false }, hi: { at: '3', open: false } }),
    'sub',
  );
});

test('보여 주기 구간 out: 바깥 두 조각(양쪽 화살촉), lo < hi 가 아니면 오류', () => {
  const p = parse({
    min: -5,
    max: 5,
    step: '1',
    region: { lo: { at: '-1', open: true }, hi: { at: '3', open: true }, out: true },
  });
  const m = (k: string) => nlRegion(p).find((x) => x.k === k);
  assert.equal(m('rg-seg2')?.a.visibility, 'visible');
  assert.equal(m('rg-al')?.a.visibility, 'visible');
  assert.equal(m('rg-ar')?.a.visibility, 'visible');
  assert.equal(m('rg-seg')?.a.x2, xOf(p, 4));
  assert.throws(
    () =>
      parse({
        min: -5,
        max: 5,
        step: '1',
        region: { lo: { at: '3', open: true }, hi: { at: '3', open: true } },
      }),
    /lo/,
  );
  assert.throws(
    () => parse({ min: -5, max: 5, step: '1', region: { lo: { at: '1', open: true }, out: true } }),
    /out/,
  );
});

const OUT = parse({
  min: -5,
  max: 5,
  step: '1',
  task: {
    type: 'interval',
    ineq: 'Abs(x-1)>2',
    answer: { lo: { at: '-1', open: true }, hi: { at: '3', open: true }, out: true },
  },
});

test('두 끝 구간 고르기: 끝점 둘을 끌고 빈 점/찬 점·사이/바깥을 골라야 정답', () => {
  const s = nlInit(OUT);
  assert.ok(s.iw);
  assert.equal(nlGrade(OUT, s), false);
  // 처음 모양: 두 끝이 서로 다른 칸, 찬 점, 사이
  assert.notEqual(s.iw.a, s.iw.b);
  const right = { ...s, iw: { a: 4, b: 8, aOpen: true, bOpen: true, out: true } };
  assert.equal(nlGrade(OUT, right), true);
  assert.equal(nlDraw(OUT, right).texts.iv, 'x < −1 또는 x > 3');
  assert.equal(nlGrade(OUT, { ...right, iw: { ...right.iw, out: false } }), false);
  assert.equal(nlGrade(OUT, { ...right, iw: { ...right.iw, bOpen: false } }), false);
  // 끝점은 엇갈리거나 같은 칸에 겹치지 않는다(검토 — 겹치면 한 점·빈 집합이 되어 '구간'이 아니다): 왼쪽 끝(ia)은
  // 오른쪽 끝(ib) 바로 앞에서 멈추고, 오른쪽 끝은 왼쪽 끝 바로 뒤에서 멈춘다
  assert.ok(s.iw.a < s.iw.b);
  assert.equal(nlDrag(OUT, s, 'ia', 9999).iw?.a, s.iw.b - 1);
  assert.equal(nlDrag(OUT, s, 'ib', -9999).iw?.b, s.iw.a + 1);
  assert.equal(nlDrag(OUT, s, 'ib', 9999).iw?.b, 10);
  const near = { ...s, iw: { ...s.iw, a: 6, b: 7 } };
  assert.equal(nlKey(OUT, near, 'ia', 'ArrowRight')?.iw?.a, 6);
  assert.equal(nlKey(OUT, near, 'ib', 'ArrowLeft')?.iw?.b, 7);
  // 낭독 이름은 자리(왼쪽 끝·오른쪽 끝), 값 글자는 수직선 글자 그대로
  assert.deepEqual(
    nlActive(OUT, s).map((h) => h.name),
    ['왼쪽 끝', '오른쪽 끝'],
  );
  assert.equal(nlHandleText(OUT, s, 'ia'), '왼쪽 끝 −2');
  // 단추: 왼쪽 끝·오른쪽 끝의 빈 점, 사이/바깥
  assert.equal(nlIwFlip(s, 'lo').iw?.aOpen, true);
  assert.equal(nlIwFlip(s, 'hi').iw?.bOpen, true);
  assert.equal(nlIwFlip(s, 'out').iw?.out, true);
});

test('두 끝 구간 검산: 정답 = solveset. 한 가지씩 바꾼 구간 비교는 늘 달라 뜻이 없어 두지 않는다(검토)', () => {
  assert.deepEqual(names(OUT), ['구간']);
  const r = runChecks(numberLineDef.checks(OUT));
  assert.ok(r.ok, r.out);
  // 사이 구간(−1 ≤ x ≤ 3)도
  const inn = parse({
    min: -5,
    max: 5,
    step: '1',
    task: {
      type: 'interval',
      ineq: 'Abs(x-1)<=2',
      answer: { lo: { at: '-1', open: false }, hi: { at: '3', open: false } },
    },
  });
  assert.ok(runChecks(numberLineDef.checks(inn)).ok);
  // 틀린 정답은 sympy 가 잡는다
  const bad = parse({
    min: -5,
    max: 5,
    step: '1',
    task: {
      type: 'interval',
      ineq: 'Abs(x-1)>2',
      answer: { lo: { at: '-1', open: false }, hi: { at: '3', open: true }, out: true },
    },
  });
  assert.equal(runChecks(numberLineDef.checks(bad)).ok, false);
});

// ---- 무리수 점(P10) ----

test('무리수 고정 점: 식 그대로의 자리(√2·π·log₂5)에 그리고, 읽는 값은 근삿값(sympy approx 로 검산)', () => {
  const p = parse({
    min: 0,
    max: 4,
    step: '1',
    points: [
      { id: 'A', at: 'sqrt(2)', label: '√2' },
      { id: 'B', at: 'pi', label: 'π' },
      { id: 'C', at: 'log(5,2)' },
    ],
  });
  const d = nlDraw(p, nlInit(p));
  assert.ok(Math.abs(Number(mark(d, 'fx:A')?.a.cx) - (24 + (Math.SQRT2 / 4) * 272)) < 0.01);
  assert.equal(d.texts['pt:A'], '√2 ≈ 1.41');
  assert.equal(d.texts['pt:B'], 'π ≈ 3.14');
  assert.equal(d.texts['pt:C'], 'C ≈ 2.32');
  const cs = numberLineDef.checks(p);
  assert.deepEqual(names(p), ['무리수 점 A', '무리수 점 B', '무리수 점 C']);
  assert.ok(runChecks(cs).ok);
  assert.equal(runChecks(tamper(cs)).ok, false);
  // 끄는 점은 칸 위 값만, 유리수는 "a/b" 로, 범위 밖은 오류
  assert.throws(
    () => parse({ min: 0, max: 4, step: '1', points: [{ id: 'A', at: 'sqrt(2)', drag: true }] }),
    /칸/,
  );
  assert.throws(
    () => parse({ min: 0, max: 4, step: '1', points: [{ id: 'A', at: 'sqrt(4)' }] }),
    /유리수/,
  );
  assert.throws(
    () => parse({ min: 0, max: 4, step: '1', points: [{ id: 'A', at: 'sqrt(20)' }] }),
    /범위/,
  );
});

const NEAR = parse({
  min: 0,
  max: 3,
  step: '1/10',
  decimal: true,
  label: '1/2',
  points: [{ id: 'P', at: '0', drag: true }],
  task: { type: 'point', point: 'P', near: 'sqrt(2)' },
});

test('무리수 점 찍기(near): 정답 칸은 무리수에 가장 가까운 칸 하나(허용 오차 = 반 칸), 가까워짐 신호는 없다', () => {
  assert.equal(NEAR.task?.type === 'point' ? NEAR.task.answer : '', '7/5');
  const s = nlInit(NEAR);
  assert.equal(nlGrade(NEAR, { ...s, pts: { P: 14 } }), true);
  assert.equal(nlGrade(NEAR, { ...s, pts: { P: 15 } }), false);
  // 이웃 칸에 가도 그림·글자가 정답 쪽을 알려 주지 않는다(P3) — 읽는 값은 점 자리뿐
  assert.deepEqual(nlDraw(NEAR, { ...s, pts: { P: 13 } }).texts, { 'pt:P': 'P = 1.3' });
  // 칸 경계(반 칸)에 너무 붙은 값은 앱 부동소수와 sympy 가 갈릴 수 있어 정답 칸을 정하지 않는다
  assert.equal(nearestCell(NEAR, 1.45 + 1e-13), null);
  assert.equal(nearestCell(NEAR, Math.SQRT2), 14);
});

test('무리수 점 찍기 검산: sympy 가 정확한 √2 로 "답 칸은 반 칸 안, 이웃 칸은 밖"을 되풀이(P10)', () => {
  const cs = numberLineDef.checks(NEAR);
  assert.deepEqual(names(NEAR), ['무리수 점 찍기', '무리수 점 찍기 이웃']);
  // 검산식은 매개변수 원문(sqrt(2))을 쓴다
  assert.ok(cs.every((c) => 'check' in c && String(c.check).includes('(sqrt(2))')));
  assert.ok(runChecks(cs).ok, runChecks(cs).out);
  // 앱이 칸을 하나 잘못 골랐다면 sympy 가 잡는다
  const wrong = cs.map((c) =>
    'check' in c ? { ...c, check: String(c.check).replace('Rational(7,5)', 'Rational(3,2)') } : c,
  );
  assert.equal(runChecks(wrong).ok, false);
  // 유리수 near·처음 자리가 답·칸 밖은 오류
  const base = { min: 0, max: 3, step: '1/10', points: [{ id: 'P', at: '0', drag: true }] };
  assert.throws(
    () => parse({ ...base, task: { type: 'point', point: 'P', near: '1/3' } }),
    /유리수/,
  );
  assert.throws(
    () =>
      parse({
        ...base,
        points: [{ id: 'P', at: '7/5', drag: true }],
        task: { type: 'point', point: 'P', near: 'sqrt(2)' },
      }),
    /처음/,
  );
  assert.throws(() => parse({ ...base, task: { type: 'point', point: 'P', near: 'pi' } }), /범위/);
});

// ---- 편차 막대·분산·표준편차·점 무게 ----

test('편차 막대·분산·표준편차: 막대는 평균에서 각 자료까지, 값은 분수로 정확히(제곱수면 표준편차도 정확)', () => {
  const p = parse({
    min: 0,
    max: 15,
    step: '1',
    data: { values: ['1', '5', '7', '9', '13'], show: ['mean', 'dev', 'var', 'sd'], drag: true },
  });
  const s = nlInit(p);
  const d = nlDraw(p, s);
  assert.equal(d.texts.var, '분산 16');
  assert.equal(d.texts.sd, '표준편차 4');
  const bar = mark(d, 'dev0');
  assert.equal(bar?.a.x1, xOf(p, 7)); // 평균 7
  assert.equal(bar?.a.x2, xOf(p, 1));
  assert.match(String(bar?.a.class), /neg/);
  assert.match(String(mark(d, 'dev4')?.a.class), /pos/);
  // 자료 하나를 끌면 막대·값이 같이 바뀐다(끄는 동안 직접 적용되는 그림 목록)
  const t = nlDraw(p, nlDrag(p, s, 'd4', -(272 / 15) * 6)); // 13 → 7
  assert.equal(t.texts.mean, '평균 5.8');
  assert.equal(t.texts.sd, '표준편차 약 2.7');
  assert.deepEqual(names(p), ['평균', '분산', '표준편차']);
  const cs = numberLineDef.checks(p);
  assert.ok(runChecks(cs).ok);
  assert.equal(runChecks(tamper(cs.slice(1))).ok, false);
});

const WEIGHT = parse({
  min: 0,
  max: 10,
  step: '1',
  data: {
    values: ['0', '3', '6'],
    weights: [3, 2, 1],
    show: ['mean', 'median', 'var', 'sd'],
    drag: true,
  },
});

test('점 무게: 값마다 점 하나 + 개수(원 안 글자), 평균·중앙값·분산은 개수만큼 센다', () => {
  const s = nlInit(WEIGHT);
  const d = nlDraw(WEIGHT, s);
  assert.equal(mark(d, 'dw0')?.text, '3');
  assert.match(String(mark(d, 'dw0')?.a.class), /mid-text/);
  assert.equal(d.texts.mean, '평균 2');
  assert.equal(d.texts.median, '중앙값 1.5');
  assert.equal(d.texts.var, '분산 5');
  assert.equal(d.texts.sd, '표준편차 약 2.2');
  // 끌면 그 값의 개수가 통째로 옮겨 간다: 0(3개) → 2
  const t = nlDraw(WEIGHT, nlDrag(WEIGHT, s, 'd0', (272 / 10) * 2));
  assert.equal(t.texts.mean, '평균 3');
  const cs = numberLineDef.checks(WEIGHT);
  assert.deepEqual(names(WEIGHT), ['평균', '중앙값', '분산', '표준편차']);
  assert.ok(runChecks(cs).ok, runChecks(cs).out);
  assert.equal(runChecks(tamper(cs)).ok, false);
  // 개수는 값과 같은 수만큼, 1~99 정수, 같은 값을 두 번 적지 않는다
  const base = { min: 0, max: 10, step: '1' };
  assert.throws(
    () => parse({ ...base, data: { values: ['1', '2'], weights: [1], show: ['mean'] } }),
    /weights/,
  );
  assert.throws(
    () => parse({ ...base, data: { values: ['1', '2'], weights: [1, 0], show: ['mean'] } }),
    /weights/,
  );
  assert.throws(
    () => parse({ ...base, data: { values: ['1', '1'], weights: [1, 2], show: ['mean'] } }),
    /같은 값/,
  );
});

// ---- 진리집합 비교 ----

const SETS = parse({
  min: -2,
  max: 6,
  step: '1',
  sets: [
    { name: 'P', cond: '2*x-1>5', lo: { at: '3', open: true } },
    { name: 'Q', cond: 'x>1', lo: { at: '1', open: true } },
  ],
  compare: true,
});

test('진리집합 비교: 두 집합을 줄을 나눠 그리고, 포함 관계를 읽는다', () => {
  const ms = nlSets(SETS);
  const y0 = Number(ms.find((m) => m.k === 'set0-seg')?.a.y1);
  const y1 = Number(ms.find((m) => m.k === 'set1-seg')?.a.y1);
  assert.notEqual(y0, y1);
  assert.equal(ms.find((m) => m.k === 'set0-name')?.text, 'P');
  assert.equal(nlDraw(SETS, nlInit(SETS)).texts.rel, 'P ⊂ Q');
  assert.equal(numberLineDef.hasGoal?.(SETS), false);
});

test('진리집합 검산: 그린 집합 = solveset(조건), 포함 관계는 sympy 가 조건에서 따로(is_subset)', () => {
  assert.deepEqual(names(SETS), ['진리집합 P', '진리집합 Q', '포함 관계']);
  const cs = numberLineDef.checks(SETS);
  assert.ok(runChecks(cs).ok, runChecks(cs).out);
  // 그림을 잘못 그리면(x > 2) 잡힌다
  const bad = parse({
    min: -2,
    max: 6,
    step: '1',
    sets: [{ name: 'P', cond: '2*x-1>5', lo: { at: '2', open: true } }],
  });
  assert.equal(runChecks(numberLineDef.checks(bad)).ok, false);
  assert.throws(
    () =>
      parse({
        min: -2,
        max: 6,
        step: '1',
        sets: [{ name: 'P', cond: 'x>1', lo: { at: '1', open: true } }],
        compare: true,
      }),
    /compare/,
  );
});

// ---- 점프 화살표 이름표 ----

test('점프 이름표: 겹치는 작은 점프의 이름표는 생략한다(이동은 읽는 값 식에 다 있다) — calc-seq-limit geo', () => {
  const p = parse({
    min: -1,
    max: 1,
    step: '1/16',
    label: '1/2',
    jumps: { start: '1', moves: ['-3/2', '3/4', '-3/8', '3/16'] },
  });
  const arcs = nlJumpArcs(p);
  assert.deepEqual(
    arcs.map((a) => a.label?.text ?? null),
    ['−3/2', '+3/4', null, null],
  );
  assert.equal(
    nlDraw(p, { ...nlInit(p), jump: 4 }).texts.jump,
    '1 − 3/2 + 3/4 − 3/8 + 3/16 = 1/16',
  );
});

test('점프 이름표: 지금 단원의 점프 장면 어디서도 이름표가 겹치지 않고, 겹치지 않는 장면은 모두 그대로 보인다', () => {
  const dir = join(import.meta.dirname, '../content/units');
  for (const f of readdirSync(dir)) {
    const u = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const s of u.lesson?.scenes ?? []) {
      if (s.widget?.type !== 'numberLine' || !s.widget.params.jumps) continue;
      const arcs = nlJumpArcs(parse(s.widget.params));
      const shown = arcs.flatMap((a) => (a.label ? [a.label] : []));
      for (const [i, a] of shown.entries())
        for (const b of shown.slice(i + 1))
          assert.ok(
            Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || a.y !== b.y,
            `${u.id}/${s.id}: ${a.text} · ${b.text}`,
          );
      if (u.id !== 'calc-seq-limit') assert.equal(shown.length, arcs.length, `${u.id}/${s.id}`);
    }
  }
});

// ---- 검토 반영(C1·M3~M5·Minor) ----

test('C1: 소수 눈금 + 두 줄 + 슬라이더 점에서 아래 줄 값이 유한소수가 아니면 형식 오류, 그림은 멈추지 않는다', {
  timeout: 3000,
}, () => {
  const raw = {
    min: 0,
    max: 3,
    step: '3',
    decimal: true,
    second: { min: '0', max: '1', step: '1/2' },
    slider: { id: 't', min: '0', max: '1', step: '1/2', value: '0', label: '$t$' },
    points: [{ id: 'P', follow: 't' }],
  };
  // t = 1/2 → 아래 줄 1/6(유한소수 아님)
  assert.throws(() => parse(raw), /유한소수/);
  // 형식 검사를 거치지 않은 매개변수로 그려도(안전망) 분수 글자로 끝난다
  const p = { ...raw, points: [{ id: 'P', drag: false, follow: 't' }] } as unknown as NLParams;
  const t = nlDraw(p, { ...nlInit(p), sl: 1 }).texts['pt:P'];
  assert.match(String(t), /1\/6/);
});

test('M3: 숫자 간격은 1·2·5×10ⁿ(분수 칸이면 label 배수 다음 정수), 범위에 0 이 있으면 0 기준', () => {
  assert.deepEqual(labels(parse({ min: 0, max: 70, step: '1' })), [
    '0',
    '10',
    '20',
    '30',
    '40',
    '50',
    '60',
    '70',
  ]);
  const z = labels(parse({ min: -3, max: 17, step: '1' }));
  assert.equal(z[0], '−2');
  assert.ok(z.includes('0') && !z.includes('−3'));
  assert.deepEqual(labels(parse({ min: 0, max: 6, step: '1/4', label: '1/4' })), [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
  ]);
});

test('Minor: 단위 글자도 숫자 간격에 든다 — 마지막 숫자 뒤 단위가 옆 숫자와 겹치면 넓힌다', () => {
  assert.equal(labels(parse({ min: 0, max: 10, step: '1' })).length, 11);
  const u = labels(parse({ min: 0, max: 10, step: '1', unit: '킬로미터' }));
  assert.deepEqual(u, ['0', '2', '4', '6', '8', '10 킬로미터']);
});

test('M4: 두 줄 검산 — 과제가 없으면 끄는 점의 처음 자리와 양 끝, 슬라이더 점은 슬라이더 값마다', () => {
  const free = parse({
    min: 0,
    max: 2,
    step: '1/3',
    second: { min: '0', max: '6', step: '1' },
    points: [{ id: 'P', at: '1/3', drag: true }],
  });
  assert.deepEqual(names(free), ['두 줄 P', '두 줄 왼쪽 끝', '두 줄 오른쪽 끝']);
  assert.ok(runChecks(numberLineDef.checks(free)).ok);
  const fol = parse({
    min: 0,
    max: 4,
    step: '1',
    second: { min: '0', max: '8', step: '2' },
    slider: { id: 't', min: '0', max: '2', step: '1', value: '0', label: '$t$' },
    points: [{ id: 'P', follow: 't**2' }],
  });
  assert.deepEqual(
    names(fol).filter((n) => n.startsWith('두 줄')),
    ['두 줄 P (t=0)', '두 줄 P (t=1)', '두 줄 P (t=2)'],
  );
  const cs = numberLineDef.checks(fol);
  assert.ok(runChecks(cs).ok, runChecks(cs).out);
});

test('M5: 부등식 1~2개(연립) — 구간 과제·진리집합 조건, 머리글에 둘 다, 검산은 두 해의 교집합', () => {
  const p = parse({
    min: -2,
    max: 6,
    step: '1',
    task: {
      type: 'interval',
      ineq: ['x>1', 'x<=4'],
      answer: { lo: { at: '1', open: true }, hi: { at: '4', open: false } },
    },
  });
  assert.equal(nlHeadTex(p).length, 2);
  const cs = numberLineDef.checks(p);
  assert.match(
    String((cs[0] as { check: string }).check),
    /Intersection\(solveset\(x>1, x, S\.Reals\), solveset\(x<=4, x, S\.Reals\)\)/,
  );
  assert.ok(runChecks(cs).ok, runChecks(cs).out);
  // 부등식 하나(옛 꼴 글자)는 검산식이 예전 그대로(verify:diff 변화 없음)
  const one = parse({
    min: -5,
    max: 5,
    step: '1',
    task: { type: 'interval', ineq: '2*x+1<7', answer: { at: '3', dir: 'left', open: true } },
  });
  assert.equal(
    (numberLineDef.checks(one)[0] as { check: string }).check,
    '1 if solveset(2*x+1<7, x, S.Reals) == Interval(-oo, Integer(3), True, True) else 0',
  );
  assert.throws(
    () =>
      parse({
        min: 0,
        max: 5,
        step: '1',
        task: {
          type: 'interval',
          ineq: ['x>1', 'x<4', 'x<3'],
          answer: { at: '1', dir: 'right', open: true },
        },
      }),
    /1~2/,
  );
  // 진리집합 조건도 연립, 머리글에 이름과 조건
  const st = parse({
    min: -2,
    max: 6,
    step: '1',
    sets: [
      {
        name: 'P',
        cond: ['x>1', 'x<=3'],
        lo: { at: '1', open: true },
        hi: { at: '3', open: false },
      },
    ],
  });
  assert.deepEqual(nlHeadTex(st), ['P:\\ x>1,\\ x\\le3']);
  assert.ok(runChecks(numberLineDef.checks(st)).ok);
});

test('Minor: 편차 막대는 평균과 함께만, 점 무게는 개수까지 낭독', () => {
  assert.throws(
    () => parse({ min: 0, max: 10, step: '1', data: { values: ['1', '2'], show: ['dev'] } }),
    /mean/,
  );
  const s = nlInit(WEIGHT);
  assert.deepEqual(
    nlActive(WEIGHT, s).map((h) => h.name),
    ['자료 1(3개)', '자료 2(2개)', '자료 3(1개)'],
  );
  assert.equal(nlHandleText(WEIGHT, s, 'd1'), '자료 2(2개) 3');
});

test('Minor: 이름표는 같은 칸만이 아니라 글자 폭만큼 가까우면 위로 쌓는다(무리수 점·잘게 나뉜 칸)', () => {
  const p = parse({
    min: 0,
    max: 10,
    step: '1/4',
    points: [
      { id: 'A', at: 'sqrt(2)', label: '√2' },
      { id: 'B', at: '3/2' },
      { id: 'C', at: '8' },
    ],
  });
  const d = nlDraw(p, nlInit(p));
  const y = (k: string) => Number(mark(d, k)?.a.y);
  assert.notEqual(y('pl:A'), y('pl:B'));
  assert.equal(y('pl:A'), y('pl:C'));
  // 쌓인 층까지 그림 안
  assert.ok(Math.min(y('pl:A'), y('pl:B')) >= 10);
});

test('Minor: 두 손잡이의 누르는 영역이 겹치면 누른 자리에서 가장 가까운 손잡이가 잡힌다', () => {
  const hs = [
    { id: 'ia', x: 100, y: 50 },
    { id: 'ib', x: 107, y: 50 },
  ];
  assert.equal(nearestHandle(hs, { x: 105, y: 52 }), 'ib');
  assert.equal(nearestHandle(hs, { x: 101, y: 52 }), 'ia');
});

// ---- 점프 두 벌(요청 13 — 공배수: 4씩·6씩 뛰어 처음 만나는 자리) ----

const J2 = parse({
  min: 0,
  max: 24,
  step: '1',
  label: '4',
  points: [{ id: 'P', at: '1', drag: true }],
  jumps: { start: '0', moves: ['4', '4', '4'] },
  jumps2: { start: '0', moves: ['6', '6'] },
  task: { type: 'point', point: 'P', answer: '12', check: 'ilcm(4,6)' },
});

test('점프 두 벌: 첫 벌을 다 뛰면 둘째 벌의 점이 나오고, 다 뛰면 점 찍기 P 가 나온다(끄는 방식은 점프와 같다)', () => {
  assert.equal(nlJumpCount(J2), 5);
  const s = nlInit(J2);
  assert.equal(s.pts[JUMPER2], 0);
  assert.ok(isJumper(JUMPER) && isJumper(JUMPER2) && !isJumper('P'));
  assert.deepEqual(
    nlActive(J2, s).map((h) => h.id),
    [JUMPER],
  );
  const three = { ...s, jump: 3 };
  assert.deepEqual(
    nlActive(J2, three).map((h) => h.id),
    [JUMPER2],
  );
  assert.deepEqual(
    nlActive(J2, { ...s, jump: 5 }).map((h) => h.id),
    ['P'],
  );
  // 둘째 벌 판정: 6 칸에 놓으면 점프 번호 3
  const on6 = { ...three, pts: { ...three.pts, [JUMPER2]: 6 } };
  assert.deepEqual(jumpHits(J2, on6), ['3']);
  assert.deepEqual(jumpHits(J2, { ...three, pts: { ...three.pts, [JUMPER]: 6 } }), []);
  // 식 두 줄, 지금 자리는 뛰는 점을 따라
  const d = nlDraw(J2, on6);
  assert.equal(d.texts.jump, '0 + 4 + 4 + 4 = 12');
  assert.equal(d.texts.jump2, '0 + 6 = ?');
  assert.equal(d.texts.jnow, '지금 6');
  // 화살표: 둘째 벌은 다른 줄(더 높은 호)
  const arcs = nlJumpArcs(J2);
  assert.deepEqual(
    arcs.map((a) => a.set),
    [1, 1, 1, 2, 2],
  );
  assert.ok((arcs[3]?.label?.y ?? 0) < (arcs[0]?.label?.y ?? 0));
});

test('점프 두 벌 검산·형식: 도착점마다(점프2 …), 첫 벌 없이 둘째 벌만은 오류, 도착이 범위 밖이면 오류', () => {
  assert.deepEqual(names(J2), [
    '점 찍기',
    '점프 1 도착',
    '점프 2 도착',
    '점프 도착',
    '점프2 1 도착',
    '점프2 도착',
  ]);
  const cs = numberLineDef.checks(J2);
  assert.ok(runChecks(cs).ok, runChecks(cs).out);
  assert.throws(
    () => parse({ min: 0, max: 24, step: '1', jumps2: { start: '0', moves: ['6'] } }),
    /jumps2/,
  );
  assert.throws(
    () =>
      parse({
        min: 0,
        max: 24,
        step: '1',
        jumps: { start: '0', moves: ['4'] },
        jumps2: { start: '0', moves: ['30'] },
      }),
    /범위/,
  );
});
