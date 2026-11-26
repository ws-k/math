// 레슨 글 규칙 다듬기(3-바): 글 값의 소수 · 강조(==…==) 안 수식 · 글 속 숫자 경고에서 이름·꼬리표 빼기.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLesson } from '../src/lesson/schema.ts';
import type { Lesson, Scene } from '../src/lesson/types.ts';
import { renderRich } from '../src/lib/math.ts';
import { goodLesson as good } from './lesson-fixture.ts';

const run = (l: Lesson) => validateLesson('u', l, { problems: 30 });

test('글 값(values)은 소수도 받는다: 글에는 소수 그대로, 검산 항목은 같은 수의 기약분수', () => {
  const l = good();
  l.values = {
    side: { value: '1.4', check: 'Rational(14, 10)' },
    area: { value: '1.96', check: 'Rational(14,10)**2' },
  };
  (l.scenes[0] as Scene).lead = '한 변 {{side}} 이면 넓이 {{area}} 예요.';
  const r = run(l);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.items.find((i) => i.ref === 'u/lesson:값:area'),
    {
      ref: 'u/lesson:값:area',
      unit: 'u',
      answer: '49/25',
      answerType: 'fraction',
      check: 'Rational(14,10)**2',
    },
  );
  for (const bad of ['1.', '.5', '1.4.1', '1,4']) {
    const l2 = good();
    l2.values = { side: { value: bad, check: 'Rational(14, 10)' } };
    assert.ok(run(l2).errors.length > 0, bad);
  }
});

test('강조(==…==) 안에 수식을 둘 수 있다 — 강조 칸이 수식 덩어리를 통째로 감싼다', () => {
  const html = renderRich('넓이는 ==$\\pi r^2$ 에 비례==해요', true, { emph: true });
  assert.match(
    html,
    /^넓이는 <span class="hl"><span class="katex">.*<\/span> 에 비례<\/span>해요$/s,
  );
  // 수식이 없을 때는 예전과 같은 글자
  assert.equal(
    renderRich('a ==b== c **d**', true, { emph: true }),
    'a <span class="hl">b</span> c <b>d</b>',
  );
  // 짝이 안 맞거나 가운데 수식($$…$$)을 감싸면 오류
  for (const s of ['==a $x$', 'a $x$==', '==a $$x$$ b=='])
    assert.throws(() => renderRich(s, true, { emph: true }), s);
  // 굵게(**)는 예전처럼 수식을 넘지 못한다(요청은 강조만)
  assert.throws(() => renderRich('**a $x$ b**', true, { emph: true }));
  const l = good();
  (l.scenes[0] as Scene).lead = '==호의 길이 $l$ 은 중심각에 정비례==해요.';
  assert.deepEqual(run(l).errors, []);
});

test('글 속 숫자 경고: 낱말에 붙은 수(고1·빨1·P1)와 "함정 N" 꼬리표는 세지 않는다', () => {
  const l = good();
  (l.scenes[0] as Scene).lead =
    '**함정 2** · 고1 때 빨1·파2 공과 P12 를 제2사분면에서 3개, 사과5개·k2 를 골라요.';
  const w = run(l).warnings.filter((x) => x.includes('리드'));
  // 허용 목록만 빼고(검토 m1) 낱말에 붙었어도 셈한 값일 수 있는 수(사과5개·k2)는 그대로 알린다
  assert.deepEqual(
    w.map((x) => x.replace(/.*글 속 숫자 /, '')),
    ['3', '5', '2'],
  );
});
