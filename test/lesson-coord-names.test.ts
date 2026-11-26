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
  NAME_MAX_PX,
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
