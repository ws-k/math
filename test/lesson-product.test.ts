// 곱의 미분 레슨: 부품 모델 결과 스냅샷 + 일부러 틀리게 바꾸면 검산이 실패하는지.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Unit } from '../src/content/types.ts';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, Scene } from '../src/lesson/types.ts';

const unit: Unit = JSON.parse(readFileSync('content/units/math2-diff-product-rule.json', 'utf8'));
const fresh = () => structuredClone(unit.lesson) as Lesson;
const scene = <K extends Scene['kind']>(l: Lesson, id: string) =>
  l.scenes.find((s) => s.id === id) as Extract<Scene, { kind: K }>;

function verify(l: Lesson) {
  const r = validateLesson(unit.id, l, { problems: unit.problems.length });
  assert.deepEqual(r.errors, []);
  const dir = mkdtempSync(join(tmpdir(), 'pr-'));
  const f = join(dir, 'p.json');
  writeFileSync(f, JSON.stringify(r.items));
  return spawnSync('.venv/bin/python', ['verify/verify.py', f], { encoding: 'utf8' });
}

test('레슨이 옛 개념·예제를 대신한다(옛 칸 없음, 예제 3개는 직접 풀기로)', () => {
  assert.equal(unit.concept, undefined);
  assert.equal(unit.examples, undefined);
  assert.equal(scene<'solve'>(fresh(), 'try').items.length, 3);
});

test('부품 모델 결과 스냅샷(좌표평면·넓이 모형 검산 항목)', () => {
  const r = validateLesson(unit.id, fresh(), { problems: unit.problems.length });
  const w = r.items
    .filter((i) => /lesson:(secant|area|tangent):/.test(i.ref))
    .map((i) => {
      const o = { ...i } as Record<string, unknown>;
      delete o.unit;
      // parity 값 목록은 길어 개수만 본다(값 자체는 sympy 가 검산)
      if (o.kind === 'parity') o.values = (o.values as unknown[]).length;
      if (o.kind === 'parity') o.points = (o.points as unknown[]).length;
      return o;
    });
  assert.deepEqual(w, [
    {
      ref: `${unit.id}/lesson:secant:곡선 f 계산`,
      kind: 'parity',
      expr: 'x**2',
      points: 9,
      values: 9,
    },
    {
      ref: `${unit.id}/lesson:secant:곡선 g 계산`,
      kind: 'parity',
      expr: 'x**3',
      points: 9,
      values: 9,
    },
    {
      ref: `${unit.id}/lesson:secant:곡선 fg 계산`,
      kind: 'parity',
      expr: 'x**2*x**3',
      points: 9,
      values: 9,
    },
    {
      ref: `${unit.id}/lesson:secant:곡선 fg 미분`,
      kind: 'parity',
      expr: 'diff(x**2*x**3,x)',
      points: 9,
      values: 9,
    },
    { ref: `${unit.id}/lesson:area:가로 계산`, kind: 'parity', expr: 'x**2', points: 9, values: 9 },
    { ref: `${unit.id}/lesson:area:세로 계산`, kind: 'parity', expr: 'x**3', points: 9, values: 9 },
    {
      ref: `${unit.id}/lesson:area:띠 합의 극한`,
      kind: 'parity',
      expr: 'diff((x**2)*(x**3),x)',
      points: 9,
      values: 9,
    },
    {
      ref: `${unit.id}/lesson:area:곱의 미분 값`,
      answer: '5',
      answerType: 'fraction',
      check: 'diff((x**2)*(x**3),x).subs(x,1)',
    },
    {
      ref: `${unit.id}/lesson:tangent:곡선 f 계산`,
      kind: 'parity',
      expr: '(x+1)*(x-1)',
      points: 9,
      values: 9,
    },
    {
      ref: `${unit.id}/lesson:tangent:곡선 f 미분`,
      kind: 'parity',
      expr: 'diff((x+1)*(x-1),x)',
      points: 9,
      values: 9,
    },
    {
      ref: `${unit.id}/lesson:tangent:접선 기울기`,
      answer: '2',
      answerType: 'fraction',
      check: 'diff((x+1)*(x-1),x).subs(x,1)',
    },
    {
      ref: `${unit.id}/lesson:tangent:접점`,
      answer: '0',
      answerType: 'fraction',
      check: '((x+1)*(x-1)).subs(x,1)',
    },
    {
      ref: `${unit.id}/lesson:tangent:풀 수 있나`,
      kind: 'plot',
      view: { x: ['-2', '3'], y: ['-3', '4'], sx: '1', sy: '1' },
      task: 'line',
      slope: '2',
      through: ['1', '0'],
    },
  ]);
});

test('그대로면 검산 통과', () => {
  const r = verify(fresh());
  assert.equal(r.status, 0, r.stdout);
});

for (const [name, f] of [
  [
    '글에 넣는 값(곱의 미분 값)이 틀림',
    (l: Lesson) => ((l.values?.fg1 as { value: string }).value = '6'),
  ],
  [
    '질문 보기 값이 검산식과 다름',
    (l: Lesson) => ((scene<'question'>(l, 'hook').choices[0] as { value: string }).value = '7'),
  ],
  [
    '틀린 곳 찾기의 고친 식에서 속미분을 빠뜨림',
    (l: Lesson) =>
      ((scene<'spot'>(l, 'traps').items[1] as { fix: { sym: string } }).fix.sym =
        '3*(x**2-3)**2*2'),
  ],
  [
    '틀린 곳 찾기의 틀린 식이 사실은 맞음',
    (l: Lesson) => {
      const it = scene<'spot'>(l, 'traps').items[0] as { tokens: unknown[] };
      it.tokens = [
        { sym: 'diff((2*x+1)*(x**2+3),x)' },
        { sep: '=' },
        { sym: '6*x**2+2*x+6', bad: true },
      ];
    },
  ],
  [
    '직접 풀기 답이 틀림',
    (l: Lesson) => ((scene<'solve'>(l, 'try').items[2] as { answer: string }).answer = '12'),
  ],
] as const) {
  test(`일부러 틀리면 검산 실패: ${name}`, () => {
    const l = fresh();
    f(l);
    const r = verify(l);
    assert.equal(r.status, 1, r.stdout);
  });
}
