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

type Entry = { units: Unit[]; renderLesson(u: Unit): string };

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
