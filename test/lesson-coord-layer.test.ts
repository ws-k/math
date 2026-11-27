// 좌표평면 그리는 순서(층): 점 이름표 같은 그림 안 글자는 늘 맨 위. 예전에는 객체 순서대로 쌓여, 뒤에 적은 선분·곡선이
// 앞 점의 이름표 위를 지나갔다(co-foot 의 선분 OP 가 'O' 를 가림). 끄는 동안 렌더 0회(P8)는 key 로 DOM 을 찾아 고치는
// 길(apply)이라, 층을 바꿔도 끄는 동안 항목 목록(key 와 그 순서)이 그대로인지도 함께 본다.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { dragPoint, draw, frame, initial, parseCoord, toPx } from '../src/lesson/widgets/coord.ts';
import { WIDGET_SCENES } from './widgets-fixture.ts';

const BOX = { w: 350, h: 260 };

const fixture = (id: string) => {
  const s = WIDGET_SCENES.find((x) => x.id === id);
  assert.ok(s && s.kind === 'explore' && s.widget);
  return parseCoord(s.widget.params);
};

/** 글자 항목이 하나도 그림 항목(선·점·곡선·조각) 앞에 오지 않는다 */
const labelsLast = (items: { t: string; key: string }[]) => {
  const first = items.findIndex((it) => it.t === 'label');
  assert.ok(first >= 0, '이름표가 있어야 함');
  const late = items.slice(first).filter((it) => it.t !== 'label');
  assert.deepEqual(
    late.map((it) => it.key),
    [],
    '이름표 뒤에 그림 항목이 있음',
  );
};

test('co-foot: 점 이름표(O·출발·발)가 선분·직각 표시보다 뒤(위 층) — 선분 OP 가 O 를 가리지 않게', () => {
  const p = fixture('co-foot');
  const d = draw(p, initial(p), BOX);
  labelsLast(d.items);
  const keys = d.items.map((it) => it.key);
  // n0 = 점 O 의 이름표, g3 = 선분 OP(객체 3번)
  assert.ok(keys.indexOf('n0') > keys.indexOf('g3'), keys.join(' '));
});

test('칠한 영역 이름표(tag)·점 이름표 모두 맨 위, 점 이름표가 칠한 영역 이름표를 가리지 않는 차례는 예전 그대로', () => {
  const p = parseCoord({
    mode: 'explore',
    x: { min: 0, max: 4, step: 1 },
    y: { min: 0, max: 4, step: 1 },
    objects: [
      { id: 'P', point: { x: 1, y: 1 }, name: 'P' },
      { id: 'f', curve: 'x' },
      { fill: { top: 'f', x: [0, 3] }, name: '밭' },
      { segment: ['P', [3, 3]] },
    ],
  });
  const d = draw(p, initial(p), BOX);
  labelsLast(d.items);
  const labels = d.items.filter((it) => it.t === 'label').map((it) => it.key);
  assert.deepEqual(labels, ['n0', 'n2']);
});

test('끄는 동안(P8 바탕): 점을 어디로 끌어도 항목 key 와 그 순서가 같다 — 이름표 자리가 바뀌어도', () => {
  const p = fixture('co-foot');
  const s0 = initial(p);
  const f = frame(BOX, p);
  const keys0 = draw(p, s0, BOX).items.map((it) => it.key);
  // 오른쪽 위 구석(이름표가 왼쪽으로 옮겨 감)·O 근처·축 위까지
  for (const [x, y] of [
    [6, 5],
    [1, 1],
    [0, 0],
    [3, 0],
    [-1, 5],
  ] as const) {
    const [px, py] = toPx(p, f, x, y);
    const s = dragPoint(p, s0, 'P', px, py, BOX);
    const d = draw(p, s, BOX);
    assert.deepEqual(
      d.items.map((it) => it.key),
      keys0,
      `(${x},${y})`,
    );
    labelsLast(d.items);
  }
});

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server';
import { Coord } from '../../src/lesson/widgets/Coord.tsx';
import { parseCoord } from '../../src/lesson/widgets/coord.ts';
export const render = (raw) =>
  renderToStaticMarkup(<Coord params={parseCoord(raw)} onDone={() => {}} onMiss={() => {}} />);
`;

async function load(): Promise<{ render(raw: unknown): string }> {
  const dir = join(import.meta.dirname, '../.cache/coord-layer');
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

test('화면(서버 렌더): 이름표 <text> 가 선분·점·직각 표시 뒤에, 손잡이(HTML)는 그림(SVG) 뒤 — 이름표가 손잡이를 덮지 않음', async () => {
  const { render } = await load();
  const s = WIDGET_SCENES.find((x) => x.id === 'co-foot');
  assert.ok(s && s.kind === 'explore' && s.widget);
  const html = render(s.widget.params);
  const firstName = html.indexOf('class="pname"');
  assert.ok(firstName > 0);
  for (const cls of ['seg ', 'rmark', 'class="pt'])
    assert.ok(html.lastIndexOf(cls) < firstName, `${cls} 가 이름표 뒤에 그려짐`);
  assert.ok(html.indexOf('</svg>') < html.indexOf('role="slider"'));
});

test('이름표 글자: 선 위에서도 읽히게 바탕색 테두리(paint-order)·누르기는 통과(pointer-events:none)', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/lesson/lesson.css'), 'utf8');
  for (const sel of ['.lesson .coord .pname {', '.lesson .coord .tag {']) {
    const at = css.indexOf(sel);
    assert.ok(at >= 0, sel);
    const body = css.slice(at, css.indexOf('}', at));
    assert.match(body, /paint-order: stroke;/, sel);
    assert.match(body, /stroke: var\(--bg\);/, sel);
    assert.match(body, /pointer-events: none;/, sel);
  }
});

test('길 띠 낭독(서버 렌더): 띠 묶음에 이름(읽는 값 이름), 눈금 숫자는 aria-hidden, 방향 글자가 묶음 안에', async () => {
  const { render } = await load();
  const s = WIDGET_SCENES.find((x) => x.id === 'co-walk');
  assert.ok(s && s.kind === 'explore' && s.widget);
  const html = render(s.widget.params);
  const g = html.slice(html.indexOf('<g class="strip'));
  assert.match(g, /^<g class="strip s-x" role="group" aria-label="길 띠: 집 기준 위치"/);
  assert.match(g, /<g aria-hidden="true"><text[^>]*class="snum"/);
  // B 처음 자리 t=1 — 속도 2 라 오른쪽으로
  assert.match(g, /class="sdir"[^>]*>오른쪽으로 걷는 중</);
});
