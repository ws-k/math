// 수직선 화면(NumberLine.tsx)을 실제로 그려 본다 — 모델 테스트로는 안 보이는 단추 글·머리글·화살표 줄을 확인한다.
// Node 는 .tsx 를 바로 못 읽어 esbuild 로 묶은 뒤 불러온다(render-smoke 와 같은 방식, 결과는 .cache 안).
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { type NLParams, numberLineDef } from '../src/lesson/widgets/numberLine.ts';

const ENTRY = `
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumberLine } from '../../src/lesson/widgets/NumberLine.tsx';
export const render = (params) =>
  renderToStaticMarkup(createElement(NumberLine, { params, onDone() {}, onMiss() {} }));
`;

async function load(): Promise<{ render(p: NLParams): string }> {
  const dir = join(import.meta.dirname, '../.cache/nl-view');
  mkdirSync(dir, { recursive: true });
  const src = join(dir, 'entry.tsx');
  writeFileSync(src, ENTRY);
  const r = await esbuild.build({
    entryPoints: [src],
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
const view = load();
const parse = (raw: unknown) => numberLineDef.parse(raw) as NLParams;

test('두 끝 구간 단추: 글은 고정(왼쪽 ○·오른쪽 ○·바깥), 지금 상태는 aria-pressed 로만', async () => {
  const { render } = await view;
  const html = render(
    parse({
      min: -5,
      max: 5,
      step: '1',
      task: {
        type: 'interval',
        ineq: 'Abs(x-1)>2',
        answer: { lo: { at: '-1', open: true }, hi: { at: '3', open: true }, out: true },
      },
    }),
  );
  const btn = (label: string) =>
    html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>([^<]*)</button>`));
  // 처음: 찬 점·사이 — 단추 글은 그대로, 눌림만 false
  assert.equal(btn('왼쪽 끝 빈 점')?.[1], '왼쪽 ○');
  assert.equal(btn('오른쪽 끝 빈 점')?.[1], '오른쪽 ○');
  assert.equal(btn('바깥 두 조각')?.[1], '바깥');
  assert.match(String(btn('왼쪽 끝 빈 점')?.[0]), /aria-pressed="false"/);
  assert.match(String(btn('바깥 두 조각')?.[0]), /aria-pressed="false"/);
});

test('진리집합: 머리글에 이름과 조건(KaTeX)을 집합마다 보여 준다', async () => {
  const { render } = await view;
  const html = render(
    parse({
      min: -2,
      max: 6,
      step: '1',
      sets: [
        { name: 'P', cond: '2*x-1>5', lo: { at: '3', open: true } },
        {
          name: 'Q',
          cond: ['x>1', 'x<=5'],
          lo: { at: '1', open: true },
          hi: { at: '5', open: false },
        },
      ],
    }),
  );
  const head = html.match(/<div class="wgt-head nl-head">([\s\S]*?)<\/div><svg/)?.[1] ?? '';
  assert.equal((head.match(/class="katex"/g) ?? []).length, 2);
  assert.match(head, /P/);
  assert.match(head, /Q/);
});

test('점프 두 벌: 둘째 벌 화살표는 다른 줄·색(nl-jump two), 다 뛰기 전엔 숨김', async () => {
  const { render } = await view;
  const html = render(
    parse({
      min: 0,
      max: 24,
      step: '1',
      label: '4',
      jumps: { start: '0', moves: ['4', '4'] },
      jumps2: { start: '0', moves: ['6'] },
    }),
  );
  assert.equal((html.match(/class="nl-jump two"/g) ?? []).length, 1);
  assert.equal((html.match(/class="nl-jump"/g) ?? []).length, 2);
  // 읽는 값 두 줄(벌마다 식)
  assert.match(html, /data-t="jump"/);
  assert.match(html, /data-t="jump2"/);
});
