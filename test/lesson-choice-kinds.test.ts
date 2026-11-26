// 질문 보기의 새 꼴(3-바): 숫자 뒤 π · 식·구간 보기 · 글자 보기.
// 원칙은 수 보기와 같다 — 화면 글자는 검산하는 바로 그 데이터에서 만든다(π 는 계수 value, 식은 sym 을 relTex 로,
// 글자는 손으로 쓰되 정답 여부를 조건식 when 으로 검산).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choiceLabel, formatValue, numSplit } from '../src/lesson/format.ts';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, QuestionScene, Scene } from '../src/lesson/types.ts';
import { goodLesson as good } from './lesson-fixture.ts';

const question = (l: Lesson) =>
  l.scenes.find((s) => s.kind === 'question') as Extract<Scene, { kind: 'question' }>;
const withQ = (f: (q: QuestionScene) => void) => {
  const l = good();
  f(question(l));
  return validateLesson('u', l, { problems: 30 });
};
const hook = (items: { ref: string }[]) => items.filter((i) => i.ref.startsWith('u/lesson:hook'));

test('π 보기: 계수 value 에 π 를 붙여 그리고, 보기 값 검산은 check 를 π 로 나눠 견준다', () => {
  assert.equal(formatValue('36', { pi: true }), '36π');
  assert.equal(formatValue('1', { pi: true }), 'π');
  assert.equal(formatValue('-1', { pi: true }), '−π');
  // 분수 계수는 π 를 분자에(검토 M4 — PM 기본값): 4π/3 · π/3 · −2π/3
  assert.equal(formatValue('4/3', { pi: true, unit: ' cm³' }), '4π/3 cm³');
  assert.equal(formatValue('1/3', { pi: true }), 'π/3');
  assert.equal(formatValue('-2/3', { pi: true }), '−2π/3');
  // 수 덩어리는 π 와 분모까지 한 덩어리(줄바꿈이 2π 와 /3 사이에 생기지 않게)
  assert.deepEqual(numSplit('4π/3 cm³'), ['4π/3', ' cm³']);
  assert.deepEqual(numSplit('36π cm³'), ['36π', ' cm³']);
  assert.deepEqual(numSplit('4/3가지'), ['4/3', '가지']);
  assert.equal(formatValue('0', { pi: true }), '0');
  const r = withQ((q) => {
    q.choices = [
      { value: '36', check: '4*pi*3**3/3' },
      { value: '27', check: 'pi*3**3', feedback: '4/3 을 빠뜨렸어요' },
    ];
    q.format = { pi: true, unit: ' cm³' };
    q.answer = 0;
    q.answerCheck = 'Rational(4,3)*pi*3**3';
  });
  assert.deepEqual(r.errors, []);
  const items = hook(r.items);
  assert.deepEqual(items[0], {
    ref: 'u/lesson:hook',
    unit: 'u',
    answer: '1',
    answerType: 'choice',
    check: 'Rational(4,3)*pi*3**3',
    choiceChecks: ['4*pi*3**3/3', 'pi*3**3'],
  });
  assert.deepEqual(items[1], {
    ref: 'u/lesson:hook:보기1',
    unit: 'u',
    answer: '36',
    answerType: 'fraction',
    check: '(4*pi*3**3/3)/pi',
  });
});

test('식·구간 보기: sym 을 틀린 곳 찾기 식처럼 그리고, 보기 식 전체를 한 항목으로 검산', () => {
  assert.deepEqual(choiceLabel({ sym: 'x>-3' }, {}), { tex: 'x>-3' });
  assert.deepEqual(choiceLabel({ sym: '-1<x<=3' }, {}), { tex: '-1<x\\le 3' });
  assert.deepEqual(choiceLabel({ sym: '2*x+1' }, {}), { tex: '2x+1' });
  const r = withQ((q) => {
    q.choices = [
      { sym: 'x>-3' },
      { sym: 'x<-3', feedback: '음수로 나누면 방향이 바뀌어요' },
      { sym: '-3<x<3', feedback: '한쪽만 막혀요' },
    ];
    q.format = undefined;
    q.answer = 0;
    q.answerCheck = 'solveset(-2*x<6, x, S.Reals)';
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(hook(r.items), [
    {
      ref: 'u/lesson:hook',
      unit: 'u',
      kind: 'choicesym',
      answer: '1',
      check: 'solveset(-2*x<6, x, S.Reals)',
      choices: ['x>-3', 'x<-3', '-3<x<3'],
    },
  ]);
});

test('글자 보기: 손으로 쓴 글자, 정답은 answerCheck 값 v 에 대한 조건 when 으로', () => {
  assert.deepEqual(choiceLabel({ text: '양의 상관', when: 'v>0' }, {}), { text: '양의 상관' });
  const r = withQ((q) => {
    q.choices = [
      { text: '양의 상관', when: 'v>0' },
      { text: '음의 상관', when: 'v<0', feedback: '한쪽이 늘면 다른 쪽도 늘어요' },
      { text: '상관없음', when: 'Eq(v,0)', feedback: '점들이 한 방향으로 모여요' },
    ];
    q.format = undefined;
    q.answer = 0;
    q.answerCheck = 'Rational(8,10)';
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(hook(r.items), [
    {
      ref: 'u/lesson:hook',
      unit: 'u',
      kind: 'choicewhen',
      answer: '1',
      check: 'Rational(8,10)',
      whens: ['v>0', 'v<0', 'Eq(v,0)'],
    },
  ]);
});

for (const [name, f] of [
  [
    '보기 꼴이 섞임',
    (q: QuestionScene) => {
      q.choices[0] = { sym: 'x>1', feedback: 'f' } as never;
    },
  ],
  [
    '식 보기에 format',
    (q: QuestionScene) => {
      q.choices = [{ sym: 'x>1' }, { sym: 'x<1', feedback: 'f' }];
      q.answer = 0;
    },
  ],
  [
    '식 보기의 관계 기호가 셋',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ sym: '1<x<2<3' }, { sym: 'x<1', feedback: 'f' }];
      q.answer = 0;
    },
  ],
  [
    '이어 쓴 부등식의 방향이 엇갈림',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ sym: '1<x>3' }, { sym: 'x<1', feedback: 'f' }];
      q.answer = 0;
    },
  ],
  [
    '식 보기 글자가 같음',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ sym: 'x>1' }, { sym: 'x > 1', feedback: 'f' }];
      q.answer = 0;
    },
  ],
  [
    '글자 보기에 when 없음',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ text: '참' } as never, { text: '거짓', when: 'Not(v)', feedback: 'f' }];
      q.answer = 0;
    },
  ],
  [
    '글자 보기 글자가 같음',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [
        { text: '참', when: 'v' },
        { text: '참', when: 'Not(v)', feedback: 'f' },
      ];
      q.answer = 0;
    },
  ],
  [
    'π 보기에 근삿값',
    (q: QuestionScene) => {
      q.format = { pi: true, approx: true, digits: 1 };
    },
  ],
  [
    'π 보기에 식의 해(eq)',
    (q: QuestionScene) => {
      q.format = { pi: true };
      q.eq = 'coffee';
    },
  ],
  [
    '글자 보기에 식의 해(eq)',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [
        { text: '참', when: 'v' },
        { text: '거짓', when: 'Not(v)', feedback: 'f' },
      ];
      q.answer = 0;
      q.eq = 'coffee';
    },
  ],
  // ---- 검토 반영(M2·m4·m5) ----
  [
    '글자 보기 조건에 v 가 없음(늘 같은 참·거짓)',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [
        { text: '참', when: '1>0' },
        { text: '거짓', when: 'Not(v)', feedback: 'f' },
      ];
      q.answer = 0;
    },
  ],
  [
    '식 보기 answerCheck 가 정답 보기를 베낌',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ sym: 'x>-3' }, { sym: 'x<-3', feedback: 'f' }];
      q.answer = 0;
      q.answerCheck = 'x > -3';
    },
  ],
  [
    '식 보기 answerCheck 가 집합을 그대로 적음',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ sym: 'x>-3' }, { sym: 'x<-3', feedback: 'f' }];
      q.answer = 0;
      q.answerCheck = 'Interval.open(-3, oo)';
    },
  ],
  [
    '식 보기들의 미지수 글자가 다름',
    (q: QuestionScene) => {
      q.format = undefined;
      q.choices = [{ sym: 'x>-3' }, { sym: 'y<-3', feedback: 'f' }];
      q.answer = 0;
      q.answerCheck = 'solveset(-2*x<6, x, S.Reals)';
    },
  ],
  [
    'π 보기 검산식이 여러 줄',
    (q: QuestionScene) => {
      q.format = { pi: true };
      q.choices = [
        { value: '36', check: 'r = 3\nans = 4*pi*r**3/3' },
        { value: '27', check: 'pi*3**3', feedback: 'f' },
      ];
      q.answer = 0;
      q.answerCheck = 'Rational(4,3)*pi*3**3';
    },
  ],
] as const) {
  test(`오류여야 함(질문 보기 꼴): ${name}`, () => {
    const l = good();
    l.equations = { coffee: '3*x+1000=13000' };
    f(question(l));
    assert.ok(validateLesson('u', l, { problems: 30 }).errors.length > 0, '오류가 없음');
  });
}
