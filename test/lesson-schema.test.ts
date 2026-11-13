import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, Scene } from '../src/lesson/types.ts';
import { goodLesson as good } from './lesson-fixture.ts';

const ctx = { problems: 30 };
const run = (l: unknown) => validateLesson('u', l, ctx);
const with_ = (f: (l: Lesson) => void) => {
  const l = good();
  f(l);
  return run(l);
};
const scene = <K extends Scene['kind']>(l: Lesson, kind: K) =>
  l.scenes.find((s) => s.kind === kind) as Extract<Scene, { kind: K }>;

test('올바른 레슨은 오류가 없다', () => {
  const r = run(good());
  assert.deepEqual(r.errors, []);
});

test('질문 장면: 보기 검산(choice) + 보기 값마다 fraction 항목', () => {
  const r = run(good());
  const q = r.items.filter((i) => i.ref.startsWith('u/lesson:hook'));
  assert.deepEqual(q[0], {
    ref: 'u/lesson:hook',
    unit: 'u',
    answer: '2',
    answerType: 'choice',
    check: 'solve(Eq(3*x+1000,13000),x)[0]',
    choiceChecks: ['(13000-1000)/4', 'solve(Eq(3*x+1000,13000),x)[0]', 'solve(Eq(3*x,13000),x)[0]'],
  });
  assert.deepEqual(q[3], {
    ref: 'u/lesson:hook:보기3',
    unit: 'u',
    answer: '13000/3',
    answerType: 'fraction',
    check: 'solve(Eq(3*x,13000),x)[0]',
  });
  assert.equal(q.length, 4);
});

test('틀린 곳 찾기: 토큰을 이어 붙인 식을 spot 항목으로', () => {
  const r = run(good());
  const s = r.items.filter((i) => 'kind' in i && i.kind === 'spot');
  assert.deepEqual(s, [
    {
      ref: 'u/lesson:traps:1',
      unit: 'u',
      kind: 'spot',
      mode: 'identity',
      wrong: '-(x-3)=-x-3',
      fixed: '-(x-3)=-x+3',
    },
    {
      ref: 'u/lesson:traps:2',
      unit: 'u',
      kind: 'spot',
      mode: 'equivalent',
      from: 'x/2+1=x/3',
      wrong: '3*x+1=2*x',
      fixed: '3*x+6=2*x',
    },
  ]);
});

test('직접 풀기: 예제와 같은 검산 항목', () => {
  const r = run(good());
  assert.equal(r.items.filter((i) => i.ref.startsWith('u/lesson:try:')).length, 2);
});

for (const [name, f] of [
  ['레슨이 객체가 아님', null],
  ['장면 id 중복', (l: Lesson) => ((l.scenes[1] as Scene).id = 'start')],
  ['모르는 장면 종류', (l: Lesson) => ((l.scenes[0] as { kind: string }).kind = 'video')],
  ['모르는 칸', (l: Lesson) => ((l.scenes[0] as unknown as Record<string, unknown>).color = 1)],
  ['빈 제목', (l: Lesson) => ((l.scenes[0] as Scene).title = ' ')],
  ['수식 오류', (l: Lesson) => ((l.scenes[0] as Scene).lead = '$\\frac{1}$')],
  ['강조 짝 안 맞음', (l: Lesson) => ((l.scenes[0] as Scene).lead = '**a')],
  ['분 수가 0', (l: Lesson) => (l.minutes = 0)],
  ['보기 1개', (l: Lesson) => scene(l, 'question').choices.splice(1)],
  ['정답 번호 범위 밖', (l: Lesson) => (scene(l, 'question').answer = 3)],
  ['오답 보기에 피드백 없음', (l: Lesson) => delete scene(l, 'question').choices[0]?.feedback],
  ['답을 베낀 검산식', (l: Lesson) => (scene(l, 'question').answerCheck = '4000')],
  [
    '답을 베낀 보기 검산식',
    (l: Lesson) => ((scene(l, 'question').choices[0] as { check: string }).check = '3000'),
  ],
  [
    '보기 값 형식',
    (l: Lesson) => ((scene(l, 'question').choices[0] as { value: string }).value = '3,000'),
  ],
  [
    '틀린 토큰이 둘',
    (l: Lesson) => ((scene(l, 'spot').items[0]?.tokens[0] as { bad?: true }).bad = true),
  ],
  ['등호 없음', (l: Lesson) => scene(l, 'spot').items[0]?.tokens.splice(1, 1)],
  ['equivalent 인데 from 없음', (l: Lesson) => delete scene(l, 'spot').items[1]?.from],
  ['식에 ^', (l: Lesson) => ((scene(l, 'spot').items[1] as { from?: string }).from = 'x^2=1')],
  ['직접 풀기 1개뿐', (l: Lesson) => scene(l, 'solve').items.splice(1)],
  [
    '직접 풀기 답이 식',
    (l: Lesson) => ((scene(l, 'solve').items[0] as { answerType: string }).answerType = 'expr'),
  ],
  ['모르는 치환 이름', (l: Lesson) => (scene(l, 'summary').next = '{{nope}}')],
  [
    '모르는 부품',
    (l: Lesson) =>
      l.scenes.push({ kind: 'explore', id: 'w', title: 't', widget: { type: 'nope', params: {} } }),
  ],
] as const) {
  test(`오류여야 함: ${name}`, () => {
    const r = typeof f === 'function' ? with_(f) : run(f);
    assert.ok(r.errors.length > 0, '오류가 없음');
  });
}
