// 좌표평면 점 이름(요청 19·112): 여러 글자('출발'·'정상'·'그저께')와 프라임(A′ — 문서 예시가 쓰던 글자).
// 예전에는 영문 한 자 + ASCII ' 만 받아 문서의 A′ 예시가 형식 오류였다. 이름표는 그림 밖으로 나가지 않고 서로 겹치지
// 않아야 하며(labels.ts 재사용), 긴 이름이 가장 좁은 화면(382px)에서 그림을 가리지 않게 폭 상한을 형식 검사로 둔다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coordDef,
  draw,
  frame,
  type Item,
  initial,
  isWide,
  labelWidth,
  MIN_BOX_H,
  NAME_MAX_PX,
  NARROW_BOX_W,
  nameWidth,
  parseCoord,
} from '../src/lesson/widgets/coord.ts';

const BOX = { w: 298, h: 200 };

const withName = (name: string, x = 2, y = 2) => ({
  mode: 'explore',
  x: { min: 0, max: 10, step: 1 },
  y: { min: 0, max: 6, step: 1 },
  objects: [{ id: 'P', point: { x, y }, name }],
});

const labels = (raw: Record<string, unknown>) => {
  const p = parseCoord(raw);
  return draw(p, initial(p), BOX).items.filter(
    (it): it is Extract<Item, { t: 'label' }> => it.t === 'label',
  );
};

test('점 이름: 여러 글자·한글·프라임(A′, 옛 단원의 ASCII 따옴표 꼴도)·아래 첨자를 받는다', () => {
  for (const n of ['출발', '정상', '그저께', 'A′', "A'", 'P₁', 'AB', 'B″'])
    assert.equal(labels(withName(n))[0]?.text, n, n);
});

test('점 이름 폭: 한글 13px·그 밖 9px 로 세고 54px(한글 4자·영문 6자)까지', () => {
  assert.equal(nameWidth('정상'), 26);
  assert.equal(nameWidth('A′'), 18);
  assert.equal(NAME_MAX_PX, 54);
  assert.doesNotThrow(() => parseCoord(withName('꼭대기점')));
  assert.doesNotThrow(() => parseCoord(withName('ABCDEF')));
  assert.throws(() => parseCoord(withName('가장높은곳')), /65px.*54px/);
  assert.throws(() => parseCoord(withName('ABCDEFG')), /63px/);
});

test('형식 오류: 빈 이름·앞뒤 빈칸·수식 글자($ { })', () => {
  assert.throws(() => parseCoord(withName('')), /빈 글/);
  assert.throws(() => parseCoord(withName(' P')), /빈칸/);
  assert.throws(() => parseCoord(withName('$P$')), /수식/);
  assert.throws(() => parseCoord(withName('P{1}')), /수식/);
});

test('이름표 자리: 한글 이름도 실제 폭으로 놓여 그림 오른쪽 끝을 넘지 않는다(어느 칸에 있든)', () => {
  for (let x = 0; x <= 10; x++)
    for (const n of ['그저께', '꼭대기점', 'ABCDEF']) {
      const p = parseCoord(withName(n, x, 3));
      const f = frame(BOX, p);
      const it = draw(p, initial(p), BOX).items.find((i) => i.t === 'label');
      assert.ok(it && it.t === 'label');
      assert.ok(it.x >= f.l - 0.05 && it.x + nameWidth(n) <= f.r + 0.05, `${n} x=${x}: ${it.x}`);
    }
});

test('형식 검사(무거운 쪽): 가장 좁은 화면에서 처음 자리의 이름표가 서로 겹치면 오류', () => {
  // 한 자리에 이름 붙은 점 7개 — 후보 자리 6곳이 다 차서 일곱째가 겹친다
  const crowd = {
    mode: 'explore',
    x: { min: 0, max: 10, step: 1 },
    y: { min: 0, max: 6, step: 1 },
    objects: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => ({
      id,
      point: { x: 5, y: 3 },
      name: `${id}점`,
    })),
  };
  const p = parseCoord(crowd);
  assert.throws(() => coordDef.deep?.(p), /이름표.*겹침/);
  // 떨어진 점은 괜찮다
  const ok = parseCoord({
    ...crowd,
    objects: crowd.objects.slice(0, 3).map((o, k) => ({ ...o, point: { x: 1 + 4 * k, y: 3 } })),
  });
  assert.doesNotThrow(() => coordDef.deep?.(ok));
});

// ---- 검토 반영(m2·m3·m9) ----

test('이름 폭(m2): 아는 좁은 글자(영문·숫자·프라임·첨자)만 9px, 모르는 글자는 넓게 13px', () => {
  assert.equal(nameWidth('p1'), 18);
  assert.equal(nameWidth('P₁′'), 27);
  assert.equal(nameWidth('ж'), 13);
  assert.equal(nameWidth('★'), 13);
  assert.equal(nameWidth('漢'), 13);
});

test('넓은 글자 판별(m3): 한 함수를 축 글자·슬라이더 글자·점 이름이 같이 쓴다', () => {
  assert.equal(isWide('가'), true);
  assert.equal(isWide('ж'), true);
  for (const ch of ['A', 'p', '1', '′', '₁', '−', '(', 'é']) assert.equal(isWide(ch), false, ch);
  assert.equal(labelWidth('시간(분)'), 11 * 3 + 6.5 * 2);
});

test('이름표 검사(m9): 맞힌 뒤(숨긴 목표 점이 보일 때)도 본다', () => {
  // 한 자리에 이름 붙은 점 넷은 네 귀퉁이에 놓인다. 숨긴 목표 점 T 가 맞힌 뒤 다섯째로 보이면 겹친다
  const four = ['A', 'B', 'C', 'D'].map((id) => ({ id, point: { x: 5, y: 3 }, name: `${id}점` }));
  const raw = (extra: Record<string, unknown>[]) => ({
    mode: 'explore',
    x: { min: 0, max: 10, step: 1 },
    y: { min: 0, max: 6, step: 1 },
    objects: [...four, { id: 'P', point: { x: 1, y: 1, drag: 'xy' } }, ...extra],
    goal: { approach: ['P', extra.length ? 'T' : 'A'] },
  });
  assert.doesNotThrow(() => coordDef.deep?.(parseCoord(raw([]))));
  assert.throws(
    () =>
      coordDef.deep?.(
        parseCoord(raw([{ id: 'T', point: { x: 5, y: 3 }, name: 'T점', hide: true }])),
      ),
    /맞힌 뒤.*이름표/,
  );
});

test('이름표 검사(m9): 후보 자리 여섯 곳이 모두 다른 점에 막혀 이름표가 점을 덮으면 오류', () => {
  const W = { w: NARROW_BOX_W, h: MIN_BOX_H };
  const raw = (objs: Record<string, unknown>[]) => ({
    mode: 'explore',
    x: { min: 0, max: 40, step: 1 },
    y: { min: 0, max: 20, step: 1 },
    objects: objs,
  });
  const A = { id: 'A', point: { x: 20, y: 10 }, name: 'A' };
  const p0 = parseCoord(raw([A]));
  const f = frame(W, p0);
  const sx = (f.r - f.l) / 40;
  const sy = (f.b - f.t) / 20;
  // 후보 상자 가운데(labels.ts: 틈 가로 10·세로 7, 높이 13, 한 자 9px)
  const cs: [number, number][] = [
    [14.5, -13.5],
    [-14.5, -13.5],
    [14.5, 13.5],
    [-14.5, 13.5],
    [0, -15.5],
    [0, 15.5],
  ];
  const dots = cs.map(([dx, dy], k) => ({
    id: `Q${k}`,
    point: { x: 20 + Math.round(dx / sx), y: 10 - Math.round(dy / sy) },
  }));
  assert.doesNotThrow(() => coordDef.deep?.(p0));
  assert.throws(() => coordDef.deep?.(parseCoord(raw([A, ...dots]))), /점을 덮음/);
});
