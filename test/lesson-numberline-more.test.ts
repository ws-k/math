// 수직선 2-라(추가형 옵션): 범위 확대·소수 눈금·칸 폭 하한, 두 줄, 양쪽 막힌·두 조각 구간, 무리수 점(P10),
// 편차 막대·분산·표준편차·점 무게, 진리집합 비교, 점프 화살표 이름표 겹침. 화면 없이 모델만 본다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  type NLParams,
  nearestCell,
  nlDrag,
  nlDraw,
  nlGrade,
  nlInit,
  nlIwFlip,
  nlJumpArcs,
  nlRegion,
  nlSets,
  nlTicks,
  nlTicks2,
  numberLineDef,
  xOf,
} from '../src/lesson/widgets/numberLine.ts';
import { type NLSet, relation, setPy, setText } from '../src/lesson/widgets/numberLineSet.ts';
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

test('칸 폭 하한: 새 범위(60칸 넘게·끝 1000 너머·소수)에서 끄는 것이 있으면 가장 좁은 화면 한 칸이 7px 이상', () => {
  // 100칸 = 272/100 × 298/320 ≈ 2.5px — 보여 주기만이면 되고, 끄는 점이 있으면 오류
  assert.throws(
    () => parse({ min: 0, max: 100, step: '1', points: [{ id: 'P', at: '0', drag: true }] }),
    /7px/,
  );
  parse({ min: 0, max: 100, step: '1', points: [{ id: 'A', at: '50' }] });
  assert.throws(() => parse({ min: 0, max: 101, step: '1' }), /100칸/);
  // 소수 40칸(≈6.3px)에 끄는 점 → 오류. 같은 칸을 분수로 쓰는 옛 장면(m2-repeating-decimal ruler)은 그대로 통과
  const ruler = { min: 0, max: 1, step: '1/40', points: [{ id: 'P', at: '0', drag: true }] };
  assert.throws(() => parse({ ...ruler, decimal: true }), /7px/);
  parse(ruler);
  // 끝 1000 너머 + 끄는 구간 끝점: 20칸이면 통과, 50칸이면 오류
  const iv = { type: 'interval', ineq: 'x<1000', answer: { at: '1000', dir: 'left', open: true } };
  parse({ min: 0, max: 2000, step: '100', task: iv });
  assert.throws(() => parse({ min: 0, max: 2000, step: '40', task: iv }), /7px/);
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

test('두 줄: 아래 줄은 같은 길이의 다른 눈금, 점의 아래 줄 값(정확한 분수)을 함께 읽는다', () => {
  assert.deepEqual(
    nlTicks2(TWO).map((t) => t.label),
    ['0', '1', '2', '3', '4', '5', '6'],
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

test('두 끝 구간 고르기: 끝점 둘을 끌고 빈 점/찬 점·사이/바깥을 골라야 정답, 끝점이 엇갈려도 왼쪽부터 읽는다', () => {
  const s = nlInit(OUT);
  assert.ok(s.iw);
  assert.equal(nlGrade(OUT, s), false);
  // 처음 모양: 두 끝이 서로 다른 칸, 찬 점, 사이
  assert.notEqual(s.iw.a, s.iw.b);
  const right = { ...s, iw: { a: 4, b: 8, aOpen: true, bOpen: true, out: true } };
  assert.equal(nlGrade(OUT, right), true);
  assert.equal(nlDraw(OUT, right).texts.iv, 'x < −1 또는 x > 3');
  // 엇갈려 놓아도(ib 가 왼쪽) 같은 구간
  assert.equal(
    nlGrade(OUT, { ...s, iw: { a: 8, b: 4, aOpen: true, bOpen: true, out: true } }),
    true,
  );
  assert.equal(nlGrade(OUT, { ...right, iw: { ...right.iw, out: false } }), false);
  assert.equal(nlGrade(OUT, { ...right, iw: { ...right.iw, bOpen: false } }), false);
  // 끄는 손잡이 둘 — 끌면 칸에 붙는다
  assert.equal(nlDrag(OUT, s, 'ia', 9999).iw?.a, 10);
  // 단추는 '왼쪽 끝'·'오른쪽 끝'(지금 놓인 자리 기준)을 바꾼다 — 엇갈려 있으면 ib 의 점을 바꾼다
  const crossed = { ...s, iw: { a: 8, b: 4, aOpen: false, bOpen: false, out: false } };
  assert.equal(nlIwFlip(crossed, 'lo').iw?.bOpen, true);
  assert.equal(nlIwFlip(crossed, 'hi').iw?.aOpen, true);
  assert.equal(nlIwFlip(crossed, 'out').iw?.out, true);
});

test('두 끝 구간 검산: 정답 = solveset, 왼쪽·오른쪽 끝·사이/바깥을 하나씩 바꾼 것은 모두 다르다', () => {
  assert.deepEqual(names(OUT), [
    '구간',
    '구간 왼쪽 끝 반대',
    '구간 오른쪽 끝 반대',
    '구간 안팎 반대',
  ]);
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
