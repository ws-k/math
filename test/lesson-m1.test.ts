// 실제 일차방정식 레슨: 부품 모델 결과 스냅샷 + 일부러 틀리게 바꾸면 검산이 실패하는지.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Unit } from '../src/content/types.ts';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, Scene } from '../src/lesson/types.ts';

const unit: Unit = JSON.parse(readFileSync('content/units/m1-linear-eq.json', 'utf8'));
const fresh = () => structuredClone(unit.lesson) as Lesson;
const scene = <K extends Scene['kind']>(l: Lesson, id: string) =>
  l.scenes.find((s) => s.id === id) as Extract<Scene, { kind: K }>;

function verify(l: Lesson) {
  const r = validateLesson(unit.id, l, { problems: unit.problems.length });
  assert.deepEqual(r.errors, []);
  const dir = mkdtempSync(join(tmpdir(), 'm1-'));
  const f = join(dir, 'p.json');
  writeFileSync(f, JSON.stringify(r.items));
  return spawnSync('.venv/bin/python', ['verify/verify.py', f], { encoding: 'utf8' });
}

test('부품 모델 결과 스냅샷(저울·항 끌기 검산 항목)', () => {
  const r = validateLesson(unit.id, fresh(), { problems: unit.problems.length });
  const w = r.items.filter((i) => /lesson:(scale|move):/.test(i.ref));
  assert.deepEqual(
    w.map((i) => ({ ...i, unit: undefined })),
    [
      {
        ref: 'm1-linear-eq/lesson:scale:연산1',
        kind: 'equiv',
        before: '3*x+1000=13000',
        after: '3*x=12000',
        expect: true,
      },
      {
        ref: 'm1-linear-eq/lesson:scale:연산2',
        kind: 'equiv',
        before: '3*x+1000=13000',
        after: '3*x=13000',
        expect: false,
      },
      {
        ref: 'm1-linear-eq/lesson:scale:연산3',
        kind: 'equiv',
        before: '3*x=12000',
        after: 'x=4000',
        expect: true,
      },
      {
        ref: 'm1-linear-eq/lesson:scale:해',
        answer: '4000',
        answerType: 'int',
        check: 'solve(Eq(3*x+1000, 13000), x)[0]',
      },
      {
        ref: 'm1-linear-eq/lesson:move:옮기기',
        kind: 'equiv',
        before: '3*x+1000=13000',
        after: '3*x=13000-1000',
        expect: true,
      },
      {
        ref: 'm1-linear-eq/lesson:move:부호 그대로',
        kind: 'equiv',
        before: '3*x+1000=13000',
        after: '3*x=13000+1000',
        expect: false,
      },
    ].map((i) => ({ ...i, unit: undefined })),
  );
});

test('그대로면 검산 통과', () => {
  const r = verify(fresh());
  assert.equal(r.status, 0, r.stdout);
});

for (const [name, f] of [
  [
    '보기 값이 검산식과 다름',
    (l: Lesson) => {
      const c = scene<'question'>(l, 'hook').choices[0] as { value: string };
      c.value = '3500';
    },
  ],
  [
    '정답 번호가 틀림',
    (l: Lesson) => {
      const q = scene<'question'>(l, 'hook');
      q.answer = 0;
      // 형식 검사(오답 보기 피드백 필수)를 넘겨 sympy 까지 가게 한다
      (q.choices[1] as { feedback?: string }).feedback = '가';
    },
  ],
  [
    '틀린 곳 찾기의 고친 식이 틀림',
    (l: Lesson) => {
      const it = scene<'spot'>(l, 'traps').items[0] as { fix: { sym: string } };
      it.fix.sym = '-(x-3)=-x-3+1';
    },
  ],
  [
    '틀린 곳 찾기의 틀린 식이 사실은 맞음',
    (l: Lesson) => {
      const it = scene<'spot'>(l, 'traps').items[1] as { tokens: unknown[] };
      it.tokens = [{ sym: '3*x' }, { sym: '+6', bad: true }, { sep: '=' }, { sym: '2*x' }];
    },
  ],
  [
    '직접 풀기 답이 틀림',
    (l: Lesson) => {
      const it = scene<'solve'>(l, 'try').items[0] as { answer: string };
      it.answer = '6';
    },
  ],
] as const) {
  test(`일부러 틀리면 검산 실패: ${name}`, () => {
    const l = fresh();
    f(l);
    const r = verify(l);
    assert.equal(r.status, 1, r.stdout);
  });
}
