// 세로셈 가족 화면을 실제 화면 코드로 그려 본다(세 모드). 등록부(index.tsx)를 거치지 않고 Column.tsx 를 바로 묶는다 —
// 등록 두 줄은 메인이 합칠 때 적으므로, 등록 전에도 이 부품 혼자 그려지는지 여기서 확인한다.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const ENTRY = `
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Column } from '../../src/lesson/widgets/Column.tsx';
import { columnDef } from '../../src/lesson/widgets/column.ts';
export const render = (raw) =>
  renderToStaticMarkup(createElement('div', { className: 'lesson' },
    createElement(Column, { params: columnDef.parse(raw), onDone() {}, onMiss() {} })));
`;

async function load(): Promise<{ render(raw: unknown): string }> {
  const dir = join(import.meta.dirname, '../.cache/column-render');
  mkdirSync(dir, { recursive: true });
  const r = await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: dir, loader: 'tsx' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    packages: 'external',
    define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'empty' },
  });
  const f = join(dir, 'entry.mjs');
  writeFileSync(f, r.outputFiles[0]?.text ?? '');
  return import(pathToFileURL(f).href);
}
const entry = load();

test('긴 나눗셈 3 ÷ 11: 판·막대·손잡이(키보드 slider)·처음 안내', async () => {
  const { render } = await entry;
  const html = render({ mode: 'long', dividend: 3, divisor: 11, decimal: true });
  assert.match(html, /class="cl-dg"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuemax="9"/);
  // 토막 아홉 개를 미리 그려 둔다 — 끄는 동안은 보이기만 바꾼다(렌더 0회)
  assert.equal(html.match(/data-blk=""/g)?.length, 9);
  assert.match(html, /손잡이를 위로 끌어 30 에서 11 씩 덜어 내 보세요\./);
  assert.match(html, /남은 수/);
  assert.match(html, /처음부터 다시/);
});

test('조립제법: 계수 넷·빈칸 일곱(가운데 셋 + 아래 넷)·옮길 수 단추', async () => {
  const { render } = await entry;
  const html = render({ mode: 'synth', coeffs: [1, 0, -2, 1], root: 2 });
  assert.equal(html.match(/class="cl-sslot"/g)?.length, 7);
  assert.match(html, /class="cl-num act"/);
  assert.match(html, /x−2=0/);
  assert.match(html, /첫 계수 1 을 맨 아래 줄로 끌어 내려 보세요\./);
});

test('사다리: 카드 넷·점선 칸·끝 단추', async () => {
  const { render } = await entry;
  const html = render({ mode: 'ladder', numbers: [12, 18] });
  assert.equal(html.match(/class="cl-chip"/g)?.length, 4);
  assert.match(html, /data-target=""/);
  assert.match(html, /더 함께 나눌 수 없어요/);
  assert.match(html, /수 카드를 끌어 12·18 왼쪽 칸에 놓아 보세요\./);
});
