// 수직선 2-다 단원 적용(P5 — 부품과 그 부품을 쓰는 단원 글을 한 묶음으로): 점프가 단추에서 끌기로 바뀌었으니
// 단원 레슨 글이 옛 단추('다음 이동 보기'·화살표 펼치기·'이동을 다 본 뒤')를 가리키지 않아야 한다.
// 형식 검사가 통과해도 글은 화면과 어긋날 수 있어 글자로 따로 본다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const dir = join(import.meta.dirname, '../content/units');
type Scene = { id: string; widget?: { type: string; params: Record<string, unknown> } };
const scenes = readdirSync(dir).flatMap((f) => {
  const u = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return ((u.lesson?.scenes ?? []) as Scene[])
    .filter((s) => s.widget?.type === 'numberLine')
    .map((s) => ({ ref: `${u.id}/${s.id}`, s }));
});

test('수직선 장면 글에 옛 점프 단추를 가리키는 말이 없다', () => {
  const bad = scenes
    .filter(({ s }) => /이동 보기|펼쳐|펼치|이동을 다 본|눌러/.test(JSON.stringify(s)))
    .map((x) => x.ref);
  assert.deepEqual(bad, []);
});

test('점프 장면 글은 점을 끌라고 말한다(10장면)', () => {
  const jumps = scenes.filter(({ s }) => s.widget?.params.jumps);
  assert.equal(jumps.length, 10);
  const silent = jumps
    .filter(({ s }) => !/끌/.test(String((s as { lead?: string }).lead)))
    .map((x) => x.ref);
  assert.deepEqual(silent, []);
});

test('부등호 뒤집기(m2-linear-ineq flip)는 두 점을 옮기는 과제다(D2)', () => {
  const flip = scenes.find((x) => x.ref === 'm2-linear-ineq/flip');
  const task = flip?.s.widget?.params.task as { type: string; answers: unknown[] } | undefined;
  assert.equal(task?.type, 'points');
  assert.equal(task?.answers.length, 2);
});
