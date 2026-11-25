// 소인수분해 나무 화면을 실제 컴포넌트로 그려 본다(서버 렌더). 등록부(index.tsx)에 넣기 전에도 화면 코드가
// 그려지는지·처음 화면의 단추가 시안대로인지 본다. Node 는 .tsx 를 못 읽어 render-smoke 처럼 esbuild 로 묶는다.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server';
import { FactorTree } from '../../src/lesson/widgets/FactorTree.tsx';
import { factorTreeDef } from '../../src/lesson/widgets/factorTree.ts';
export const render = (raw) =>
  renderToStaticMarkup(<FactorTree params={factorTreeDef.parse(raw)} onDone={() => {}} onMiss={() => {}} />);
`;

async function load(): Promise<{ render(raw: unknown): string }> {
  const dir = join(import.meta.dirname, '../.cache/ft-view');
  mkdirSync(dir, { recursive: true });
  const r = await esbuild.build({
    stdin: { contents: ENTRY, loader: 'tsx', resolveDir: dir },
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    packages: 'external',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'empty' },
  });
  const f = join(dir, 'entry.mjs');
  writeFileSync(f, r.outputFiles[0]?.text ?? '');
  return import(pathToFileURL(f).href);
}

test('처음 화면: 뿌리 72 한 마디, 숫자판 2~9·소수예요(고르기 전이라 꺼짐), 처음부터 다시, 안내 글', async () => {
  const { render } = await load();
  const html = render({ n: 72 });
  const nodes = html.match(/<button[^>]*data-nd="\d+"[^>]*>[^<]*<\/button>/g) ?? [];
  assert.equal(nodes.length, 1);
  assert.match(nodes[0] as string, /aria-label="72, 아직 쪼갤 수 있는지 모름"/);
  assert.match(nodes[0] as string, /aria-pressed="false"/);
  assert.match(html, /role="group" aria-label="나눌 수"/);
  const pad = html.slice(html.indexOf('ft-pad'));
  for (const d of ['2', '3', '4', '5', '6', '7', '8', '9', '소수예요'])
    assert.match(pad, new RegExp(`disabled="">${d}</button>`), d);
  assert.match(html, /aria-label="처음부터 다시"/);
  assert.match(html, /쪼갤 수를 누르고, 그 수를 어떤 수로 나눌지 골라요\./);
  // 나무 상자 높이 = 소인수 5개 × 층 44 + 2(시안 222px)
  assert.match(html, /class="ft-tree" style="height:222px"/);
  assert.doesNotMatch(html, /다른 방법으로 다시/);
});
