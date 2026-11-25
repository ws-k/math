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

// 2-마: 부등호·÷·등식 아닌 식(value)·!·C·P·∑·∫·lim
const spotWith = (items: unknown[]) =>
  with_((l) => {
    scene(l, 'spot').items = items as never;
  });
const ineqItem = () => ({
  prompt: '음수로 나눴어요',
  mode: 'equivalent',
  from: '-2*x<6',
  tokens: [{ sym: 'x' }, { sep: '<', bad: true }, { sym: '-3' }],
  fix: { sym: '>', body: '음수로 나누면 방향이 바뀌어요' },
});
const valueItem = () => ({
  prompt: '나눗셈을 곱셈으로',
  mode: 'value',
  from: '(3/4)÷(2/5)',
  tokens: [{ sym: '3/4' }, { sym: '*(2/5)', bad: true }],
  fix: { sym: '*(5/2)', body: '나누는 수를 뒤집어요' },
});

test('틀린 곳 찾기 기호 1차: 부등호 토큰·등식 아닌 식·새 기호를 spot 항목으로', () => {
  const r = spotWith([
    ineqItem(),
    valueItem(),
    {
      prompt: '최소공배수',
      mode: 'value',
      check: 'lcm(24, 36)',
      tokens: [{ sym: '2*2' }, { sym: '*3', bad: true }],
      fix: { sym: '*3*2*3', body: '남은 몫도 곱해요' },
    },
  ]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.items.filter((i) => 'kind' in i && i.kind === 'spot'),
    [
      {
        ref: 'u/lesson:traps:1',
        unit: 'u',
        kind: 'spot',
        mode: 'equivalent',
        from: '-2*x<6',
        wrong: 'x<-3',
        fixed: 'x>-3',
      },
      {
        ref: 'u/lesson:traps:2',
        unit: 'u',
        kind: 'spot',
        mode: 'value',
        from: '(3/4)÷(2/5)',
        wrong: '3/4*(2/5)',
        fixed: '3/4*(5/2)',
      },
      {
        ref: 'u/lesson:traps:3',
        unit: 'u',
        kind: 'spot',
        mode: 'value',
        check: 'lcm(24, 36)',
        wrong: '2*2*3',
        fixed: '2*2*3*2*3',
      },
    ],
  );
  const sym = (wrong: string, fix: string) => ({
    prompt: 'p',
    mode: 'identity',
    tokens: [{ sym: wrong.split('=')[0] }, { sep: '=' }, { sym: wrong.split('=')[1], bad: true }],
    fix: { sym: fix, body: 'b' },
  });
  const pairs: [string, string][] = [
    ['factorial(5)/factorial(3)=factorial(2)', '20'],
    ['binomial(6,3)=ff(6,3)', 'ff(6,3)/factorial(3)'],
    ['Sum(2*k,(k,1,n))=n**2', 'n*(n+1)'],
    ['Integral(x**3,x)=x**4/4', 'x**4/4+C'],
    ["Limit(Abs(x)/x,x,0,'+')=-1", '1'],
    ['Limit(1/x,x,oo)=oo', '0'],
    ['(3/4)÷(2/5)=3/4*(2/5)', '3/4*(5/2)'],
    ['0.1+0.2=0.03', '0.3'],
  ];
  for (const [w, f] of pairs) assert.deepEqual(spotWith([sym(w, f)]).errors, [], w);
});

for (const [name, item] of [
  [
    '등호를 틀린 곳으로',
    { ...ineqItem(), tokens: [{ sym: 'x' }, { sep: '=', bad: true }, { sym: '-3' }] },
  ],
  ['부등호 자리에 식을 끼움', { ...ineqItem(), fix: { sym: 'x', body: 'b' } }],
  ['부등호를 같은 부등호로 고침', { ...ineqItem(), fix: { sym: '<', body: 'b' } }],
  [
    '식 자리에 부등호를 끼움',
    {
      ...ineqItem(),
      tokens: [{ sym: 'x', bad: true }, { sep: '<' }, { sym: '-3' }],
      fix: { sym: '>', body: 'b' },
    },
  ],
  ['고친 조각에 부등호', { ...valueItem(), fix: { sym: '<(5/2)', body: 'b' } }],
  [
    '모르는 관계',
    { ...ineqItem(), tokens: [{ sym: 'x' }, { sep: '!=', bad: true }, { sym: '-3' }] },
  ],
  [
    'value 에 관계 토큰',
    { ...valueItem(), tokens: [{ sym: '3/4', bad: true }, { sep: '=' }, { sym: '1' }] },
  ],
  ['value 에 from·check 둘 다 없음', (({ from: _, ...it }) => it)(valueItem())],
  ['value 에 from·check 둘 다', { ...valueItem(), check: '15/8' }],
  ['value 의 from 이 등식', { ...valueItem(), from: '(3/4)÷(2/5)=15/8' }],
  ['value 의 check 가 빈 글', (({ from: _, ...it }) => ({ ...it, check: ' ' }))(valueItem())],
  ['identity 에 check', { ...ineqItem(), mode: 'identity', from: undefined, check: '1' }],
  ['equivalent 의 from 이 관계 없는 식', { ...ineqItem(), from: '-2*x' }],
  ['모르는 mode', { ...valueItem(), mode: 'approx' }],
  ['계산기에 없는 이름', { ...valueItem(), from: 'lcm(24,36)' }],
] as const) {
  test(`오류여야 함(틀린 곳 찾기 기호 1차): ${name}`, () => {
    assert.ok(spotWith([item]).errors.length > 0, '오류가 없음');
  });
}

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
    '고친 조각에 등식 전체를 적음',
    (l: Lesson) =>
      ((scene(l, 'spot').items[0] as { fix: { sym: string } }).fix.sym = '-(x-3)=-x+3'),
  ],
  ['직접 풀기 id 중복', (l: Lesson) => ((scene(l, 'solve').items[1] as { id: string }).id = 'p1')],
  [
    '화면이 채우지 않는 칸에 {{…}}',
    (l: Lesson) =>
      ((scene(l, 'solve').items[0] as { placeholder?: string }).placeholder = '{{problems}}'),
  ],
  [
    '약분되는 보기 값',
    (l: Lesson) => ((scene(l, 'question').choices[0] as { value: string }).value = '6000/2'),
  ],
  ['없는 공유 식을 가리킴', (l: Lesson) => (scene(l, 'question').eq = 'nope')],
  [
    '근삿값인데 자리수와 다른 소수',
    (l: Lesson) => {
      const q = scene(l, 'question');
      q.format = { digits: 2, approx: true };
      for (const c of q.choices) c.value = '1.5';
    },
  ],
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

test('공유 식·값: 질문 정답이 식의 해인지, 부품이 같은 식인지 항목을 만든다', () => {
  const l = good();
  l.equations = { coffee: '3*x+1000=13000' };
  l.values = { coffee: { value: '4000', check: 'solve(Eq(3*x+1000,13000),x)[0]' } };
  const q = scene(l, 'question');
  q.eq = 'coffee';
  q.widget = {
    type: 'table',
    params: {
      unit: '원',
      rows: [
        { label: '커피', value: '3*x' },
        { label: '쿠키', value: '1000' },
      ],
      total: { label: '합계', value: '13000' },
      sum: true,
    },
    eq: 'coffee',
  };
  scene(l, 'terms').terms[0] = { term: '해', body: '$x = {{coffee}}$' };
  const r = run(l);
  assert.deepEqual(r.errors, []);
  const refs = r.items.map((i) => i.ref);
  assert.ok(refs.includes('u/lesson:hook:식의 해'));
  assert.ok(refs.includes('u/lesson:hook:같은 식'));
  assert.ok(refs.includes('u/lesson:값:coffee'));
  assert.ok(!r.warnings.some((w) => w.includes('terms')));
  // 질문의 정답은 식의 해 집합 안에 있어야 한다(미지수 이름·첫 해에 기대지 않는다)
  assert.deepEqual(
    r.items.find((i) => i.ref === 'u/lesson:hook:식의 해'),
    { ref: 'u/lesson:hook:식의 해', unit: 'u', kind: 'root', eq: '3*x+1000=13000', value: '4000' },
  );
});

test('글 값은 레슨 식(eq)에서 검산식을 만든다 — 같은 방정식을 손으로 다시 적지 않게', () => {
  const l = good();
  l.equations = { coffee: '3*x+1000=13000' };
  l.values = { coffee: { value: '4000', eq: 'coffee' } };
  const r = run(l);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.items.find((i) => i.ref === 'u/lesson:값:coffee'),
    { ref: 'u/lesson:값:coffee', unit: 'u', kind: 'root', eq: '3*x+1000=13000', value: '4000' },
  );
  for (const bad of [
    { value: '4000', eq: 'nope' },
    { value: '4000', eq: 'coffee', check: 'solve(Eq(3*x+1000,13000),x)[0]' },
    { value: '4000' },
  ]) {
    const l2 = good();
    l2.equations = { coffee: '3*x+1000=13000' };
    l2.values = { coffee: bad as never };
    assert.ok(run(l2).errors.length > 0, JSON.stringify(bad));
  }
});

test('레슨에 식이 있으면 식을 그리는 부품은 eq 필수(다른 식이면 eq:false 로 밝힌다)', () => {
  const make = (eq: string | false | undefined) => {
    const l = good();
    l.equations = { coffee: '3*x+1000=13000' };
    scene(l, 'question').widget = {
      type: 'table',
      params: {
        unit: '원',
        rows: [{ label: '커피', value: '3*x' }],
        total: { label: '합계', value: '12000' },
        sum: true,
      },
      ...(eq === undefined ? {} : { eq }),
    };
    return run(l);
  };
  assert.ok(make(undefined).errors.some((e) => e.includes('eq')));
  assert.deepEqual(make(false).errors, []);
});

test('글 속 숫자 경고: 수식 밖 일반 글의 숫자도 알린다({{…}} 로 넣은 값은 빼고)', () => {
  const l = good();
  (l.scenes[0] as Scene).lead = '커피 3잔이 12,000원이고 문제는 {{problems}}개예요.';
  const r = run(l);
  assert.ok(r.warnings.some((w) => w.includes('12,000')));
  assert.ok(!r.warnings.some((w) => w.includes('30')));
});

test('근삿값 보기: 보기마다 approx 항목', () => {
  const l = good();
  const q = scene(l, 'question');
  q.format = { digits: 2, approx: true };
  q.choices = [
    { value: '1.41', check: 'sqrt(2)' },
    { value: '1.73', check: 'sqrt(3)', feedback: '3의 제곱근이에요.' },
  ];
  q.answer = 0;
  q.answerCheck = 'sqrt(8)/2';
  const r = run(l);
  assert.deepEqual(r.errors, []);
  const a = r.items.filter((i) => 'kind' in i && i.kind === 'approx');
  assert.deepEqual(a[0], {
    ref: 'u/lesson:hook:보기1',
    unit: 'u',
    kind: 'approx',
    expr: 'sqrt(2)',
    value: '1.41',
    digits: 2,
  });
});

// 결론 글 공개 옵션(조각 ②): afterGoal 이면 카드 아래 글(after)을 목표를 이룬 뒤에 보인다 —
// 결론을 먼저 읽고 조작하지 않게. 목표가 있는 부품에만(없으면 한 번 만지자마자 보여 미루는 뜻이 없다)
const coordExplore = (goal: boolean) => ({
  kind: 'explore' as const,
  id: 'g',
  title: 't',
  after: '결론',
  afterGoal: true as const,
  widget: {
    type: 'coord',
    params: {
      mode: 'explore',
      x: { min: -1, max: 5, step: 1 },
      y: { min: -6, max: 10, step: 1 },
      sliders: [{ id: 'c', min: -2, max: 7, step: 1, value: 0, label: '$c$' }],
      objects: [{ id: 'f', curve: 'x**2-4*x+c' }],
      ...(goal ? { goal: { value: { of: 'roots(f)', is: 1 }, hint: '닿기만 하게' } } : {}),
    },
  },
});

test('afterGoal: 목표가 있는 부품이면 통과하고 목표 판정 항목이 생긴다', () => {
  const r = with_((l) => l.scenes.splice(2, 0, coordExplore(true)));
  assert.deepEqual(r.errors, []);
  assert.ok(
    r.items.some((i) => i.ref === 'u/lesson:g:목표 판정' && 'kind' in i && i.kind === 'goal'),
  );
});

for (const [name, f] of [
  ['목표 없는 부품에 afterGoal', (l: Lesson) => l.scenes.splice(2, 0, coordExplore(false))],
  [
    'afterGoal 인데 after 가 없음',
    (l: Lesson) => {
      const { after: _a, ...s } = coordExplore(true);
      l.scenes.splice(2, 0, s);
    },
  ],
  [
    'afterGoal 은 true 만',
    (l: Lesson) =>
      l.scenes.splice(2, 0, { ...coordExplore(true), afterGoal: false as unknown as true }),
  ],
] as const) {
  test(`오류여야 함(afterGoal): ${name}`, () => {
    assert.ok(with_(f).errors.length > 0, '오류가 없음');
  });
}
