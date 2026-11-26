// 직접 풀기(solve) 문항의 새 꼴(3-바): 객관식 보기 · 정답 표기(answerTex).
// 레슨 원칙(보이는 값 = 검산한 값)대로 보기 글자·정답 표기도 검산한 수와 같은 수인지 본다 — 문제(problems)는
// 보기 글자를 따로 검산하지 않지만, 레슨은 화면 글자를 데이터에서 만들거나 대조하는 쪽으로 간다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { texNumber } from '../src/lesson/format.ts';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, Scene, SolveItem } from '../src/lesson/types.ts';
import { goodLesson as good } from './lesson-fixture.ts';

const solveItem = (l: Lesson) =>
  (l.scenes.find((s) => s.kind === 'solve') as Extract<Scene, { kind: 'solve' }>)
    .items[0] as SolveItem;
const withItem = (f: (it: SolveItem) => void) => {
  const l = good();
  f(solveItem(l));
  return validateLesson('u', l, { problems: 30 });
};
const choiceItem = (it: SolveItem) => {
  Object.assign(it, {
    q: '가장 큰 수는?',
    answerType: 'choice',
    answer: '4',
    choices: ['$-3$', '$-\\frac{1}{2}$', '$0$', '$2.5$', '$1\\frac{1}{2}$'],
    choiceChecks: ['-3', 'Rational(-1,2)', 'Integer(0)', 'Rational(5,2)', '1+Rational(1,2)'],
    check: 'Max(-3, Rational(-1,2), 0, Rational(5,2), Rational(3,2))',
  });
};

test('texNumber: 수 하나만 적은 TeX 를 기약분수 글자로, 아니면 null', () => {
  assert.equal(texNumber('$-3$'), '-3');
  assert.equal(texNumber('$2.5$'), '5/2');
  assert.equal(texNumber('$-\\frac{2}{4}$'), '-1/2');
  assert.equal(texNumber('$\\dfrac{3}{4}$'), '3/4');
  assert.equal(texNumber('$1\\frac{1}{2}$'), '3/2');
  assert.equal(texNumber('$-1\\frac{1}{2}$'), '-3/2');
  assert.equal(texNumber('$0.8185$'), '1637/2000');
  for (const s of ['3', '$x$', '$3$개', '$1+2$', '$\\frac{1}{0}$', '$3$ 또는 $4$'])
    assert.equal(texNumber(s), null, s);
  // 검토 m7: 천 단위 {,} 는 받고, 대분수의 분자≥분모·앞자리 0 은 거부(손으로 적다 틀린 꼴)
  assert.equal(texNumber('$1{,}000$'), '1000');
  assert.equal(texNumber('$-12{,}345.5$'), '-24691/2');
  for (const s of [
    '$1\\frac{3}{2}$',
    '$1\\frac{2}{2}$',
    '$03$',
    '$00.5$',
    '$0\\frac{1}{2}$',
    '$1{,}00$',
  ])
    assert.equal(texNumber(s), null, s);
  assert.equal(texNumber('$0.5$'), '1/2');
  assert.equal(texNumber('$0$'), '0');
});

test('객관식: 보기 5개, 보기 글자마다 그 보기 검산값과 같은 수인지 항목', () => {
  const r = withItem(choiceItem);
  assert.deepEqual(r.errors, []);
  const items = r.items.filter((i) => i.ref.startsWith('u/lesson:try:p1'));
  assert.deepEqual(items[0], {
    ref: 'u/lesson:try:p1',
    unit: 'u',
    answer: '4',
    answerType: 'choice',
    check: 'Max(-3, Rational(-1,2), 0, Rational(5,2), Rational(3,2))',
    choiceChecks: ['-3', 'Rational(-1,2)', 'Integer(0)', 'Rational(5,2)', '1+Rational(1,2)'],
  });
  assert.deepEqual(items[2], {
    ref: 'u/lesson:try:p1:보기2',
    unit: 'u',
    answer: '-1/2',
    answerType: 'fraction',
    check: 'Rational(-1,2)',
  });
  assert.equal(items.length, 6);
});

test('정답 표기·객관식의 {{answer}} 가 수식 안이면 까닭을 밝혀 알린다(KaTeX 오류로 흐리지 않게)', () => {
  const r = withItem((it) => {
    it.answerTex = '$2$';
    it.steps = [{ title: 't', body: '$x={{answer}}$' }];
  });
  assert.ok(
    r.errors.some((e) => e.includes('{{answer}} 를 수식 밖에')),
    r.errors.join('\n'),
  );
});

test('정답 표기(answerTex): 답과 같은 수면 통과, {{answer}} 는 그 표기로 채운다', () => {
  const r = withItem((it) => {
    Object.assign(it, {
      answer: '1637/2000',
      answerType: 'fraction',
      answerTex: '$0.8185$',
      check: 'Rational(3413,10000)+Rational(4772,10000)',
      steps: [{ title: '더하기', body: '답은 {{answer}} 예요.' }],
    });
  });
  assert.deepEqual(r.errors, []);
});

for (const [name, f] of [
  [
    '객관식 보기가 수 하나가 아님',
    (it: SolveItem) => {
      choiceItem(it);
      (it.choices as string[])[0] = '$-3$ 과 $3$';
    },
  ],
  [
    '객관식 보기 4개',
    (it: SolveItem) => {
      choiceItem(it);
      it.choices = it.choices?.slice(0, 4) ?? null;
      it.choiceChecks = it.choiceChecks?.slice(0, 4);
    },
  ],
  [
    '객관식에 answerTex',
    (it: SolveItem) => {
      choiceItem(it);
      it.answerTex = '$2.5$';
    },
  ],
  [
    '정답 표기가 답과 다른 수',
    (it: SolveItem) => {
      it.answerTex = '$3$';
    },
  ],
  [
    '정답 표기가 수가 아님',
    (it: SolveItem) => {
      it.answerTex = '$x=2$';
    },
  ],
  [
    // 검토 m6: 정답 표기($…$)·보기 번호(④)는 수식 안에 들어가면 깨진다 — 바로 알린다
    '정답 표기가 있는데 {{answer}} 가 수식 안',
    (it: SolveItem) => {
      it.answer = '2';
      it.answerTex = '$2$';
      it.steps = [{ title: 't', body: '$x={{answer}}$' }];
    },
  ],
  [
    '객관식인데 {{answer}} 가 수식 안',
    (it: SolveItem) => {
      choiceItem(it);
      it.steps = [{ title: 't', body: '답은 $\\text{{{answer}}}$' }];
    },
  ],
  [
    '객관식 아닌데 보기',
    (it: SolveItem) => {
      it.choices = ['$1$', '$2$', '$3$', '$4$', '$5$'];
    },
  ],
] as const) {
  test(`오류여야 함(직접 풀기 꼴): ${name}`, () => {
    assert.ok(withItem(f).errors.length > 0, '오류가 없음');
  });
}
