// 좌표평면 목표(조각 ②): 슬라이더 목표·값 맞추기·여러 곳 가 보기·점 자리 목표, 숨긴 정답, 읽는 값(실근 개수 등),
// 슬라이더 제외 값. 판정은 모델 함수(goalHits)로 보고, 손을 뗀 자리만 판정하는 규칙은 goal.ts(goalRelease)가 맡는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { goalRelease, goalStart } from '../src/lesson/goal.ts';
import { parseSym } from '../src/lesson/sym.ts';
import {
  type CoordParams,
  type CoordState,
  coordChecks,
  coordDef,
  dragPoint,
  draw,
  frame,
  goalHits,
  goalNeed,
  initial,
  keyMove,
  NARROW_BOX_W,
  parseCoord,
  polyOf,
  readout,
  rootCount,
  sliderSnap,
  toPx,
} from '../src/lesson/widgets/coord.ts';
import { runChecks } from './widget-verify.ts';

const BOX = { w: 340, h: 260 };

const doubleRaw = () => ({
  mode: 'explore',
  x: { min: -1, max: 5, step: 1 },
  y: { min: -6, max: 10, step: 1 },
  sliders: [{ id: 'c', min: -2, max: 7, step: 1, value: 0, label: '$c$' }],
  objects: [
    { id: 'f', curve: 'x**2-4*x+c' },
    { readout: 'roots(f)', label: '근의 개수' },
  ],
  goal: { value: { of: 'roots(f)', is: 1 }, hint: '곡선이 가로축에 닿기만 하게' },
});

const withC = (p: CoordParams, c: number): CoordState => ({
  ...initial(p),
  vars: { ...initial(p).vars, c },
});

test('읽는 값: roots(f) 는 서로 다른 실근 개수(스투름), 식 값은 슬라이더로 계산', () => {
  const raw = doubleRaw();
  raw.sliders.push(
    { id: 'a', min: 1, max: 3, step: 1, value: 1, label: 'a' },
    { id: 'b', min: -4, max: 4, step: 1, value: -4, label: 'b' },
  );
  const p = parseCoord({
    ...raw,
    objects: [...raw.objects, { readout: 'b**2-4*a*c', label: '판별식' }],
  });
  const [ro, calc] = p.objects.filter((o) => o.kind === 'readout');
  assert.ok(ro?.kind === 'readout' && calc?.kind === 'readout');
  assert.equal(readout(p, withC(p, 3), ro.expr), 2);
  assert.equal(readout(p, withC(p, 4), ro.expr), 1);
  assert.equal(readout(p, withC(p, 5), ro.expr), 0);
  assert.equal(readout(p, withC(p, 3), calc.expr), 16 - 12);
});

test('읽는 값: meet(f,g) 는 교점 개수 — 세 번 만나는 자리', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -3, max: 3, step: 1 },
    y: { min: -4, max: 4, step: 1 },
    sliders: [{ id: 'k', min: -4, max: 4, step: 1, value: 3, label: '$k$' }],
    objects: [
      { id: 'f', curve: 'x**3-3*x' },
      { id: 'g', curve: 'k' },
      { readout: 'meet(f,g)', label: '교점 개수' },
    ],
    goal: { value: { of: 'meet(f,g)', is: 3 }, hint: '가로선을 가운데로' },
  });
  const ro = p.objects[2];
  assert.ok(ro?.kind === 'readout');
  const at = (k: number) => readout(p, { ...initial(p), vars: { k } }, ro.expr);
  assert.deepEqual([at(-3), at(-2), at(0), at(2), at(3)], [1, 2, 3, 2, 1]);
  assert.deepEqual(goalHits(p, { ...initial(p), vars: { k: 1 } }), ['0']);
  assert.deepEqual(goalHits(p, { ...initial(p), vars: { k: 2 } }), []);
});

test('슬라이더 목표: 중근(실근 하나)이 되는 c 에서만 닿고, 판정은 손을 뗀 자리만', () => {
  const p = parseCoord(doubleRaw());
  assert.equal(goalNeed(p), 1);
  assert.deepEqual(goalHits(p, withC(p, 4)), ['0']);
  assert.deepEqual(goalHits(p, withC(p, 3)), []);
  // c=4 를 지나 5 에서 놓으면(끄는 동안 판정하지 않으므로) 미달성
  let g = goalStart();
  g = goalRelease(g, goalHits(p, withC(p, 5)), goalNeed(p));
  assert.equal(g.done, false);
  g = goalRelease(g, goalHits(p, withC(p, 4)), goalNeed(p));
  assert.equal(g.done, true);
});

test('여러 자리: y(P)=0 인 자리 두 곳(places)', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -6, max: 4, step: 1 },
    y: { min: -16, max: 10, step: 2 },
    objects: [
      { id: 'f', curve: '(x-3)*(x+5)' },
      { id: 'P', point: { on: 'f', x: 0, drag: 'x' }, name: 'P' },
    ],
    goal: { value: { of: 'y(P)', is: 0, places: 2 }, hint: '두 괄호 중 하나가 0' },
  });
  assert.equal(goalNeed(p), 2);
  const at = (i: number) => ({ ...initial(p), pts: { P: { i, j: 0 } } });
  assert.equal(goalHits(p, at(3)).length, 1);
  assert.equal(goalHits(p, at(0)).length, 0);
  let g = goalStart();
  for (const i of [3, 3, -5]) g = goalRelease(g, goalHits(p, at(i)), goalNeed(p));
  assert.equal(g.done, true);
});

const mvtRaw = () => ({
  mode: 'explore',
  x: { min: -2, max: 3, step: '1/2' },
  y: { min: -2, max: 9, step: 1 },
  objects: [
    { id: 'f', curve: 'x**3' },
    { id: 'P', point: { on: 'f', x: -1 }, name: 'P' },
    { id: 'Q', point: { on: 'f', x: 2 }, name: 'Q' },
    { secant: ['P', 'Q'] },
    { id: 'R', point: { on: 'f', x: '-1/2', drag: 'x', snap: '1/4' }, name: 'R' },
    { tangent: { on: 'f', at: 'R' } },
    { id: 'C', point: { on: 'f', x: 1 }, name: 'C', hide: true },
  ],
  goal: { value: { of: 'deriv(f,R)', is: 'slope(P,Q)' }, hint: '두 기울기 3' },
});

test('값 맞추기: 다른 읽는 값과 견주기(접선 기울기 = 평균 기울기), 닿는 자리는 x=1 뿐(구간 안)', () => {
  const p = parseCoord(mvtRaw());
  const at = (i: number) => ({ ...initial(p), pts: { ...initial(p).pts, R: { i, j: 0 } } });
  assert.deepEqual(goalHits(p, at(4)), ['0']);
  assert.deepEqual(goalHits(p, at(-4)), ['0']);
  assert.deepEqual(goalHits(p, at(3)), []);
});

test('숨긴 목표 점: 맞히기 전 그릴 목록에 좌표가 없고, 맞힌 뒤 보인다', () => {
  const p = parseCoord(mvtRaw());
  const s0 = initial(p);
  const hid = draw(p, s0, BOX).items.filter((i) => i.key === 'd6' || i.key === 'n6');
  assert.equal(hid.length, 2);
  for (const it of hid) {
    assert.ok(it.t === 'dot' || it.t === 'label');
    assert.equal(it.hidden, true);
    assert.equal(it.x, 0);
    assert.equal(it.y, 0);
  }
  const shown = draw(p, { ...s0, solved: true }, BOX).items.find((i) => i.key === 'd6');
  assert.ok(shown?.t === 'dot' && !shown.hidden && shown.x > 0);
  // 그릴 목록의 key 는 숨김과 상관없이 같다(끄는 동안 직접 적용)
  assert.deepEqual(
    draw(p, s0, BOX).items.map((i) => i.key),
    draw(p, { ...s0, solved: true }, BOX).items.map((i) => i.key),
  );
});

test('숨긴 정답 곡선: 맞히기 전 경로가 비고 범례도 숨긴다', () => {
  const p = parseCoord({
    mode: 'sketch',
    x: { min: -2, max: 2, step: 1 },
    y: { min: -1, max: 4, step: 1 },
    objects: [{ id: 'f', curve: 'x**2', label: '$y=x^2$', hide: true }],
    task: { sketch: { curve: 'f', tol: '1/2' } },
  });
  const c = draw(p, initial(p), BOX).items.find((i) => i.key === 'c0');
  assert.ok(c?.t === 'path' && c.d === '');
  const c2 = draw(p, { ...initial(p), solved: true }, BOX).items.find((i) => i.key === 'c0');
  assert.ok(c2?.t === 'path' && c2.d.length > 10);
});

test('가까워짐 신호 없음: 목표에 닿지 않은 두 자리의 그릴 목록은 끄는 점·읽는 값 말고 같다', () => {
  const p = parseCoord(mvtRaw());
  const at = (i: number) => ({ ...initial(p), pts: { ...initial(p).pts, R: { i, j: 0 } } });
  const near = draw(p, at(3), BOX);
  const far = draw(p, at(-6), BOX);
  const cls = (d: typeof near) => d.items.map((i) => ('cls' in i ? i.cls : i.key));
  assert.deepEqual(cls(near), cls(far));
  const hidden = (d: typeof near) => d.items.map((i) => ('hidden' in i ? i.hidden : null));
  assert.deepEqual(hidden(near), hidden(far));
});

test('점 자리 목표: 끄는 점을 (x,y) 에 — 두 직선의 교점', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -1, max: 5, step: 1 },
    y: { min: -1, max: 6, step: 1 },
    objects: [
      { id: 'f', curve: 'x+1' },
      { id: 'g', curve: '-x+5' },
      { id: 'P', point: { x: 0, y: 0, drag: 'xy' }, name: 'P' },
    ],
    goal: {
      place: {
        point: 'P',
        x: { value: '2', check: 'solve(Eq(x+1,-x+5),x)[0]' },
        y: { value: '3', check: '2+1' },
      },
      hint: '두 식이 같아지는 x',
    },
  });
  const at = (i: number, j: number) => ({ ...initial(p), pts: { P: { i, j } } });
  assert.deepEqual(goalHits(p, at(2, 3)), ['0']);
  assert.deepEqual(goalHits(p, at(2, 2)), []);
  assert.deepEqual(goalHits(p, at(3, 3)), []);
});

test('여러 곳 가 보기: x(P) 가 2·3·4 인 곳을 한 번씩', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 5, step: 1 },
    y: { min: 0, max: 30, step: 5 },
    objects: [
      { id: 'f', curve: 'x**2' },
      { id: 'P', point: { on: 'f', x: 1, drag: 'x' }, name: 'P' },
    ],
    goal: { visit: { of: 'x(P)', at: [2, 3, 4] }, hint: '오른쪽으로' },
  });
  assert.equal(goalNeed(p), 3);
  const at = (i: number) => ({ ...initial(p), pts: { P: { i, j: 0 } } });
  assert.deepEqual(goalHits(p, at(3)), ['1']);
  assert.deepEqual(goalHits(p, at(1)), []);
});

test('슬라이더 제외 값: 끌어서 닿으면 움직이던 쪽으로 한 칸 더, 방향키도 건너뜀', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1 },
    y: { min: -3, max: 3, step: 1 },
    sliders: [
      { id: 'a', min: '1/2', max: 3, step: '1/2', value: 2, label: '밑 $a$', exclude: [1] },
    ],
    objects: [{ id: 'f', curve: 'log(x,a)' }],
  });
  const sl = p.sliders[0];
  assert.ok(sl);
  assert.equal(sliderSnap(sl, 1, 1.5), 0.5);
  assert.equal(sliderSnap(sl, 1, 0.5), 1.5);
  assert.equal(sliderSnap(sl, 1.4, 2), 1.5);
  assert.equal(sliderSnap(sl, 0.9, 0.5), 1.5);
});

for (const [name, raw] of [
  [
    '닿을 수 없는 슬라이더 목표',
    { ...doubleRaw(), goal: { value: { of: 'roots(f)', is: 3 }, hint: 'h' } },
  ],
  ['힌트 없는 새 목표', { ...doubleRaw(), goal: { value: { of: 'roots(f)', is: 1 } } }],
  [
    '다항식이 아닌 곡선의 실근 개수',
    {
      ...doubleRaw(),
      objects: [
        { id: 'f', curve: 'sin(x)+c' },
        { readout: 'roots(f)', label: 'n' },
      ],
    },
  ],
  [
    '어떤 슬라이더 값에서 다항식이 아닌 곡선의 실근 개수(x^n, n=3/2)',
    {
      ...doubleRaw(),
      sliders: [{ id: 'n', min: 1, max: 3, step: '1/2', value: 2, label: 'n' }],
      objects: [
        { id: 'f', curve: 'x**n-1' },
        { readout: 'roots(f)', label: 'n' },
      ],
      goal: undefined,
    },
  ],
  [
    '유리수 목표에 허용 오차',
    { ...mvtRaw(), goal: { value: { of: 'x(R)', is: '1/2' }, tol: '1/8', hint: 'h' } },
  ],
  [
    '유리수 가 볼 곳에 허용 오차',
    { ...doubleRaw(), goal: { visit: { of: 'value(c)', at: [1, 3] }, tol: '1/2', hint: 'h' } },
  ],
  [
    '목표·과제 없는 장면의 숨긴 곡선(드러날 때가 없음)',
    {
      mode: 'explore',
      x: { min: -2, max: 2, step: 1 },
      y: { min: -1, max: 4, step: 1 },
      objects: [{ id: 'f', curve: 'x**2', hide: true }],
    },
  ],
  [
    '목표·과제 없는 장면의 숨긴 점',
    {
      mode: 'explore',
      x: { min: -2, max: 2, step: 1 },
      y: { min: -1, max: 4, step: 1 },
      objects: [
        { id: 'f', curve: 'x**2' },
        { id: 'C', point: { on: 'f', x: 1 }, hide: true },
      ],
    },
  ],
  [
    '닿을 수 없는 가 볼 곳',
    { ...doubleRaw(), goal: { visit: { of: 'value(c)', at: [1, 8] }, hint: 'h' } },
  ],
  [
    '제외 값이 처음 값',
    {
      ...doubleRaw(),
      sliders: [{ id: 'c', min: -2, max: 7, step: 1, value: 0, label: 'c', exclude: [0] }],
    },
  ],
  [
    '처음 자리가 이미 목표(한 번 만지면 끝나는 탐색이 됨)',
    { ...doubleRaw(), sliders: [{ id: 'c', min: -2, max: 7, step: 1, value: 4, label: 'c' }] },
  ],
  [
    '숨긴 점을 다른 객체가 가리킴',
    {
      ...mvtRaw(),
      objects: [...mvtRaw().objects, { readout: 'x(C)', label: 'x' }],
    },
  ],
  [
    '끄는 점은 숨기지 못함',
    {
      ...mvtRaw(),
      objects: mvtRaw().objects.map((o) => ('id' in o && o.id === 'R' ? { ...o, hide: true } : o)),
    },
  ],
  [
    '허용 오차 안 자리가 여럿(무리수 목표)',
    {
      ...mvtRaw(),
      goal: { value: { of: 'x(R)', is: 'sqrt(3)/2' }, tol: '1', hint: 'h' },
    },
  ],
] as const) {
  // 형식 검사 전체(읽기 + 닿는 자리 검사 deep) — 검사기(schema.ts)가 부르는 그대로
  test(`parse 오류(목표): ${name}`, () => {
    assert.throws(() => coordDef.deep?.(parseCoord(raw)));
  });
}

test('무리수 목표: 허용 오차 안의 자리가 하나면 통과', () => {
  const p = parseCoord({
    ...mvtRaw(),
    goal: { value: { of: 'x(R)', is: 'sqrt(3)' }, tol: '1/8', hint: 'h' },
  });
  const at = (i: number) => ({ ...initial(p), pts: { ...initial(p).pts, R: { i, j: 0 } } });
  assert.deepEqual(goalHits(p, at(7)), ['0']);
  assert.deepEqual(goalHits(p, at(6)), []);
});

test('검산: 목표 판정 항목을 sympy 가 다시 판정해 통과하고, 판정을 망가뜨리면 실패', () => {
  const ps = [
    parseCoord(doubleRaw()),
    parseCoord(mvtRaw()),
    parseCoord({
      ...mvtRaw(),
      goal: { value: { of: 'x(R)', is: 'sqrt(3)' }, tol: '1/8', hint: 'h' },
    }),
  ];
  const cs = ps.flatMap((p, k) => coordChecks(p).map((c) => ({ ...c, name: `${k}:${c.name}` })));
  const goals = cs.filter((c) => 'kind' in c && c.kind === 'goal');
  assert.equal(goals.length, 3);
  const r = runChecks(cs);
  assert.ok(r.ok, r.out);
  const bad = cs.map((c) =>
    'kind' in c && c.kind === 'goal' ? { ...c, hits: c.hits.map((h) => [...h, 0]) } : c,
  );
  assert.equal(runChecks(bad).ok, false);
});

test('방향키로 슬라이더가 아닌 점도 목표 판정에 같은 길을 쓴다(키 하나 = 손 한 번 뗌)', () => {
  const p = parseCoord(mvtRaw());
  let s = initial(p);
  for (let k = 0; k < 6; k++) s = keyMove(p, s, 'R', 'ArrowRight') ?? s;
  assert.deepEqual(goalHits(p, s), ['0']);
});

test('스투름: 서로 다른 실근 개수(중근은 하나), 0 인 다항식은 셀 수 없음', () => {
  const count = (src: string) => rootCount(polyOf(parseSym(src), {}) ?? []);
  assert.equal(count('x**3'), 1);
  assert.equal(count('(x-1)**2*(x+2)'), 2);
  assert.equal(count('x**2+1'), 0);
  assert.equal(count('(x-1)*(x-2)*(x-3)*(x-4)/7'), 4);
  assert.equal(count('x-x'), null);
  assert.equal(polyOf(parseSym('sin(x)'), {}), null);
  assert.equal(polyOf(parseSym('1/x'), {}), null);
});

test('가장 좁은 화면(382pt 접음)에서도 끌기만으로 목표 점의 모든 칸에 닿는다', () => {
  // 30칸(1/6 간격·x 5칸)이면 좁은 화면 한 칸이 8px 이상 — 끌어서 칸마다 놓을 수 있다
  const raw = { ...mvtRaw(), x: { min: -2, max: 3, step: '1/2' } };
  const objs = raw.objects.map((o) =>
    'id' in o && o.id === 'R' ? { ...o, point: { ...o.point, snap: '1/6', x: '-1/2' } } : o,
  );
  const p = parseCoord({ ...raw, objects: objs });
  const box = { w: NARROW_BOX_W, h: 220 };
  const f = frame(box);
  const seen = new Set<number>();
  for (let px = 0; px <= box.w; px += 0.5) {
    const s = dragPoint(p, initial(p), 'R', px, toPx(p, f, 0, 0)[1], box);
    seen.add(s.pts.R?.i ?? Number.NaN);
  }
  assert.equal(seen.size, 31);
});

test('parse 오류(목표): 목표가 보는 곡선 위 점의 끄는 칸이 좁은 화면에서 8px 보다 촘촘함', () => {
  const objs = mvtRaw().objects.map((o) =>
    'id' in o && o.id === 'R' ? { ...o, point: { ...o.point, snap: '1/8' } } : o,
  );
  assert.throws(() => parseCoord({ ...mvtRaw(), objects: objs }), /좁은 화면/);
});

test('닿는 자리 검사(상태를 모두 늘어놓는 무거운 검사)는 형식 검사(deep)에서만 — 장면을 열 때는 건너뜀', () => {
  // 화면은 매개변수 읽기(parse)만 하므로, 검사기가 통과시킨 목표를 장면마다 다시 늘어놓지 않는다(최악 46ms)
  const raw = { ...doubleRaw(), goal: { value: { of: 'roots(f)', is: 3 }, hint: 'h' } };
  const p = parseCoord(raw);
  assert.throws(() => coordDef.deep?.(p), /닿을 수 없음/);
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(doubleRaw())));
});

test('읽는 값 frac: 유리수면 분수로 보인다(글의 1/2 과 같은 꼴), 정의 안 되면 —', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: -3, max: 5, step: 1 },
    y: { min: -3, max: 7, step: 1 },
    objects: [
      { id: 'A', point: { x: 0, y: 1 }, name: 'A' },
      { id: 'B', point: { x: 2, y: 5, drag: 'xy' }, name: 'B' },
      { readout: 'slope(A,B)', label: '기울기', frac: true },
    ],
  });
  const text = (i: number, j: number) =>
    draw(p, { ...initial(p), pts: { ...initial(p).pts, B: { i, j } } }, BOX).readouts[0]?.text;
  assert.equal(text(2, 2), '1/2');
  assert.equal(text(2, 5), '2');
  assert.equal(text(3, -1), '−2/3');
  assert.equal(text(0, 3), '—');
});
