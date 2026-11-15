// 렌더 스모크: 모든 단원 레슨의 모든 장면을 실제 화면 코드로 그려 본다. 모르는 부품이나 그리다 나는 예외를 잡는다.
// Node 는 .tsx 를 바로 못 읽어 esbuild 로 묶은 뒤 불러온다.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { contentPlugin } from '../scripts/esbuild-shared.mjs';
import type { Unit } from '../src/content/types.ts';
import type { Lesson } from '../src/lesson/types.ts';
import { unit } from './app-fixture.ts';
import { goodLesson } from './lesson-fixture.ts';

type Entry = {
  units: Unit[];
  renderLesson(u: Unit, shown?: number): string;
  renderScreens(u: Unit): string[];
};

async function load(): Promise<Entry> {
  const r = await esbuild.build({
    entryPoints: [join(import.meta.dirname, 'render-smoke.entry.tsx')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    // react-dom/server 는 Node 내장 모듈을 require 해서 ESM 묶음 안에 넣으면 돌지 않는다.
    // 패키지는 묶지 않고 node_modules 에서 그대로 불러오게 결과 파일을 저장소 안(.cache)에 둔다.
    packages: 'external',
    define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'empty' },
    plugins: [contentPlugin],
  });
  const dir = join(import.meta.dirname, '../.cache/smoke');
  mkdirSync(dir, { recursive: true });
  const f = join(dir, 'entry.mjs');
  writeFileSync(f, r.outputFiles[0]?.text ?? '');
  return import(pathToFileURL(f).href);
}

const entry = load();
const withLesson = (lesson: Lesson): Unit => ({ ...unit('fixture', []), lesson });

test('시험용 레슨(장면 6종)이 끝까지 그려진다', async () => {
  const { renderLesson } = await entry;
  const html = renderLesson(withLesson(goodLesson()));
  for (const id of goodLesson().scenes.map((s) => s.id))
    assert.ok(html.includes(`data-scene="${id}"`), id);
  assert.match(html, /4,333원/);
  assert.match(html, /katex/);
});

test('모든 단원 레슨의 모든 장면이 예외 없이 그려진다', async () => {
  const { units, renderLesson } = await entry;
  for (const u of units.filter((x) => x.lesson)) {
    const html = renderLesson(u);
    for (const s of u.lesson?.scenes ?? [])
      assert.ok(html.includes(`data-scene="${s.id}"`), `${u.id}/${s.id}`);
  }
});

test('모르는 부품이면 실패한다', async () => {
  const { renderLesson } = await entry;
  const l = goodLesson();
  l.scenes.push({ kind: 'explore', id: 'w', title: 't', widget: { type: 'nope', params: {} } });
  assert.throws(() => renderLesson(withLesson(l)));
});

test('레슨 글의 {{…}} 는 모두 채워져 그려진다(검산된 값)', async () => {
  const { units, renderLesson } = await entry;
  for (const u of units.filter((x) => x.lesson)) {
    const html = renderLesson(u);
    assert.ok(!html.includes('{{'), `${u.id}: 채우지 않은 {{`);
  }
  const m1 = units.find((u) => u.id === 'm1-linear-eq');
  if (m1) assert.match(renderLesson(m1), /4000/);
});

test('모든 단원의 앱 화면(단원 홈·문제·홈·지도·오답·설정)이 예외 없이 그려진다', async () => {
  const { units, renderScreens } = await entry;
  for (const u of units) {
    const pages = renderScreens(u);
    assert.ok(
      pages.every((h) => h.length > 0),
      u.id,
    );
    // 레슨 단원은 단원 홈에서 레슨이 개념을 대신하고, 레슨 없는 단원은 옛 개념·예제 카드를 보인다
    assert.match(pages[0] as string, u.lesson ? /레슨 시작하기/ : /예제 1/);
  }
});

test('곱의 미분 레슨: 좌표평면·넓이 모형 부품이 그려진다(손잡이·확인하기 포함)', async () => {
  const { units, renderLesson } = await entry;
  const u = units.find((x) => x.id === 'math2-diff-product-rule');
  assert.ok(u?.lesson);
  const html = renderLesson(u);
  assert.match(html, /class="coord m-explore"/);
  assert.match(html, /class="coord m-line"/);
  assert.match(html, /class="area"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /확인하기/);
  assert.match(html, /할선 PQ 의 기울기/);
});

test('부품 6종 시험 레슨의 모든 장면이 그려진다', async () => {
  const { widgetLessons } = await import('./widgets-fixture.ts');
  const { renderLesson } = await entry;
  let html = '';
  for (const l of widgetLessons()) {
    const h = renderLesson(withLesson(l));
    for (const s of l.scenes) assert.ok(h.includes(`data-scene="${s.id}"`), s.id);
    html += h;
  }
  // 손잡이(role=slider)와 그림 제목이 실제로 나온다
  assert.match(html, /role="slider"/);
  for (const t of [
    '수직선',
    '분수 조각',
    '단위원',
    '도형판',
    '수형도',
    '벤 다이어그램',
    '확률 실험',
  ])
    assert.ok(html.includes(t), t);
});

test('결론 글 미루기(afterGoal): 목표를 못 이뤄도 다음 장면을 열면(그 장면을 떠나면) 결론 글이 보인다', async () => {
  // 용어 정의가 결론 글(after)에만 있는 장면도 있어, 넘어간 학습자가 끝내 그 글을 못 보면 안 된다.
  // 완료 기록(done)은 그대로 비어 있다 — 목표를 이룬 것으로 치지 않는다
  const { units, renderLesson } = await entry;
  const u = units.find((x) => x.id === 'm3-quadratic-eq');
  const scenes = u?.lesson?.scenes ?? [];
  const k = scenes.findIndex((s) => s.id === 'zero');
  assert.ok(u && k >= 0 && scenes[k]?.kind === 'explore' && scenes[k].afterGoal);
  const mark = '하나만 0 이어도 곱은 0';
  assert.ok(scenes[k]?.after?.includes(mark));
  assert.ok(!renderLesson(u, k + 1).includes(mark), '머무는 동안은 숨김');
  assert.ok(renderLesson(u, k + 2).includes(mark), '떠나면 보임');
});
