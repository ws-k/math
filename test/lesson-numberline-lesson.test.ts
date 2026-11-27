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

test('부등호 뒤집기(m2-linear-ineq flip)는 두 점을 옮기는 과제다(D2) — P 는 a 위에서 −a 로, Q 는 b 위에서 −b 로', () => {
  const flip = scenes.find((x) => x.ref === 'm2-linear-ineq/flip');
  const w = flip?.s.widget?.params as {
    points: { id: string; at: string; label?: string }[];
    task: { type: string; answers: { point: string; answer: string }[] };
  };
  assert.equal(w.task.type, 'points');
  const at = (id: string) => w.points.find((x) => x.id === id)?.at;
  const ans = (id: string) => w.task.answers.find((x) => x.point === id)?.answer;
  // 알파벳 순서대로 짝(P↔a, Q↔b) — 글을 읽고 헷갈리지 않게
  assert.equal(at('P'), at('A'));
  assert.equal(at('Q'), at('B'));
  assert.equal(ans('P'), `-${at('A')}`);
  assert.equal(ans('Q'), `-${at('B')}`);
  assert.match(
    String((flip?.s as { lead?: string } | undefined)?.lead),
    /\$a\$ 위의 P[^.]*\$-a\$[^.]*\$b\$ 위의 Q[^.]*\$-b\$/,
  );
});

test('결론 글이 목표의 답을 말하는 장면은 목표 뒤에 공개(afterGoal) — 검토 M3', () => {
  for (const ref of [
    'm2-linear-ineq/flip',
    'e-whole-ops/remain',
    'e-divisor-multiple/bus',
    'm2-exponent-poly/jumps',
    'math1-induction/jumps',
  ]) {
    const sc = scenes.find((x) => x.ref === ref)?.s as { afterGoal?: boolean } | undefined;
    assert.equal(sc?.afterGoal, true, ref);
  }
  // 다음 장면들이 쓰는 용어(몫·나머지)는 머무는 동안 보이는 lead 에 먼저 — after 는 목표 뒤에야 보인다
  const remain = scenes.find((x) => x.ref === 'e-whole-ops/remain')?.s as { lead?: string };
  assert.match(String(remain.lead), /몫/);
  assert.match(String(remain.lead), /나머지/);
});

test('칸이 1 이 아닌 점프 장면은 "N칸씩" 이라고 하지 않는다(칸 수와 이동량이 다르다)', () => {
  const bad = scenes
    .filter(({ s }) => s.widget?.params.jumps && s.widget.params.step !== '1')
    .filter(({ s }) => /\d+칸씩/.test(String((s as { lead?: string }).lead)))
    .map((x) => x.ref);
  assert.deepEqual(bad, []);
});
