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
  const at = (re: RegExp) =>
    r.items.filter((i) => re.test(i.ref)).map((i) => ({ ...i, unit: undefined }));
  // 저울은 끌기로 닿는 모든 상태(36개, 처음 상태 제외 35개)를 검산한다 — 대표 항목과 개수만 고정
  const scale = at(/lesson:scale:/);
  assert.equal(scale.length, 35 + 2);
  const pick = (name: string) => scale.find((i) => i.ref === `m1-linear-eq/lesson:scale:${name}`);
  assert.deepEqual(
    ['수평 3*x=12000', '기욺 3*x=13000', '수평 x=4000', '해', '같은 식'].map(pick),
    [
      {
        ref: 'm1-linear-eq/lesson:scale:수평 3*x=12000',
        kind: 'equiv',
        before: '3*x+1000=13000',
        after: '3*x=12000',
        expect: true,
      },
      {
        ref: 'm1-linear-eq/lesson:scale:기욺 3*x=13000',
        answer: '-1',
        answerType: 'int',
        check: 'sign((3*x)-(13000)).subs(x, solve(Eq(3*x+1000, 13000), x)[0])',
      },
      {
        ref: 'm1-linear-eq/lesson:scale:수평 x=4000',
        kind: 'equiv',
        before: '3*x+1000=13000',
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
        ref: 'm1-linear-eq/lesson:scale:같은 식',
        kind: 'sameeq',
        a: '3*x+1000=13000',
        b: '3*x+1000=13000',
      },
    ].map((i) => ({ ...i, unit: undefined })),
  );
  assert.deepEqual(
    at(/lesson:move:/),
    [
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
      {
        ref: 'm1-linear-eq/lesson:move:같은 식',
        kind: 'sameeq',
        a: '3*x+1000=13000',
        b: '3*x+1000=13000',
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
      it.fix.sym = '-3+1';
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
    // bad 표시를 엉뚱한 토큰으로 옮기면 고친 식(그 토큰만 바꿔 끼운 식)이 성립하지 않는다
    '틀린 곳 찾기의 bad 가 엉뚱한 토큰',
    (l: Lesson) => {
      const it = scene<'spot'>(l, 'traps').items[0] as { tokens: { bad?: true }[] };
      delete it.tokens[3]?.bad;
      (it.tokens[2] as { bad?: true }).bad = true;
    },
  ],
  [
    '저울 오른쪽만 다른 숫자(장면 간 어긋남)',
    (l: Lesson) => {
      const w = scene<'explore'>(l, 'scale').widget.params as { right: { c: number } };
      w.right.c = 16000;
    },
  ],
  [
    '영수증 합계만 다른 숫자',
    (l: Lesson) => {
      const w = scene<'question'>(l, 'hook').widget?.params as { total: { value: string } };
      w.total.value = '14000';
    },
  ],
  [
    '항 끌기 항만 다른 숫자',
    (l: Lesson) => {
      const w = scene<'explore'>(l, 'move').widget.params as { lhs: string[] };
      w.lhs[1] = '+1001';
    },
  ],
  [
    '글에 넣는 값(해)이 틀림',
    (l: Lesson) => {
      (l.values?.coffee as { value: string }).value = '5000';
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

test('수식 속 손으로 적은 숫자는 경고로 나오고, {{…}} 로 넣은 값은 경고가 없다', () => {
  const r = validateLesson(unit.id, fresh(), { problems: unit.problems.length });
  assert.ok(r.warnings.length > 0);
  assert.ok(!r.warnings.some((w) => w.includes('{{')));
  assert.ok(r.warnings.some((w) => w.includes('2x = 14')));
});
