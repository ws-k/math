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
  renderLesson(u: Unit, shown?: number, done?: string[]): string;
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
  // 보기 수는 줄바꿈 없는 덩어리, 단위 앞에만 줄바꿈 자리(NumLabel)
  assert.match(html, /<span class="mglue">4,333<\/span><wbr\/>원/);
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

test('틀린 곳 찾기 기호 1차: 부등호 토큰은 버튼, 등식 아닌 식·×·÷ 조각·∫ 이 그려진다', async () => {
  const { renderLesson } = await entry;
  const l = goodLesson();
  const spot = l.scenes.find((s) => s.kind === 'spot');
  assert.ok(spot?.kind === 'spot');
  spot.items = [
    {
      prompt: '부등호',
      mode: 'equivalent',
      from: '-2*x<6',
      tokens: [{ sym: 'x' }, { sep: '<', bad: true }, { sym: '-3' }],
      fix: { sym: '>', body: 'b' },
    },
    {
      prompt: '등식 아닌 식',
      mode: 'value',
      from: '(3/4)÷(2/5)',
      tokens: [{ sym: '3/4' }, { sym: '*(2/5)', bad: true }],
      fix: { sym: '*(5/2)', body: 'b' },
    },
    {
      prompt: '적분',
      mode: 'identity',
      tokens: [{ sym: 'Integral(x**3,x)' }, { sep: '=' }, { sym: 'x**4/4', bad: true }],
      fix: { sym: 'x**4/4+C', body: 'b' },
    },
  ];
  const html = renderLesson(withLesson(l));
  const card = html.slice(html.indexOf('data-scene="traps"'));
  // 버튼 수: 부등호 카드 3(부등호 포함) + 등식 아닌 식 2 + 적분 2(등호는 버튼이 아님)
  assert.equal(card.slice(0, card.indexOf('data-scene="try"')).match(/class="tok/g)?.length, 7);
  assert.match(card, /∫/);
  assert.match(card, /÷/);
  assert.match(card, /×/);
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

test('배포 빌드의 설정 화면에는 펜 진단(개발용 숫자)이 없고 전체 초기화는 있다', async () => {
  const { units, renderScreens } = await entry;
  const all = renderScreens(units[0] as (typeof units)[number]).join('');
  assert.doesNotMatch(all, /펜 진단/);
  assert.match(all, /전체 초기화/);
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

// 실제 단원 글이 바뀌어도 깨지지 않게 시험용 레슨(goodLesson)에 장면을 끼워 본다
const MARK = '결론 글 표시';
const goalScenes = (): Lesson => {
  const l = goodLesson();
  l.scenes.splice(1, 0, {
    kind: 'explore',
    id: 'g-after',
    title: '목표',
    widget: {
      type: 'coord',
      params: {
        mode: 'explore',
        x: { min: -1, max: 5, step: 1 },
        y: { min: -6, max: 10, step: 1 },
        sliders: [{ id: 'c', min: -2, max: 7, step: 1, value: 0, label: '$c$' }],
        objects: [{ id: 'f', curve: 'x**2-4*x+c' }],
        goal: { value: { of: 'roots(f)', is: 1 }, hint: '닿기만 하게' },
      },
    },
    after: MARK,
    afterGoal: true,
  });
  l.scenes.splice(2, 0, {
    kind: 'explore',
    id: 'g-seg',
    title: '선분 위 점',
    widget: {
      type: 'shape',
      params: {
        grid: { w: 10, h: 5 },
        points: [
          { id: 'A', x: 0, y: 0 },
          { id: 'B', x: 8, y: 0 },
          { id: 'S', x: 0, y: 4, aux: true },
          { id: 'M', x: 5, y: 4, aux: true },
          { id: 'T', x: 10, y: 4, aux: true },
          { id: 'D', x: 2, y: 4, drag: true, on: { seg: ['S', 'M'] } },
          { id: 'C', x: 6, y: 4, drag: true, on: { seg: ['M', 'T'] } },
        ],
        polygons: [['A', 'B', 'C', 'D']],
        measures: [{ area: 0 }],
        digits: 0,
      },
    },
  });
  return l;
};

test('결론 글 미루기(afterGoal): 목표를 못 이뤄도 다음 장면을 열면(그 장면을 떠나면) 결론 글이 보인다', async () => {
  // 용어 정의가 결론 글(after)에만 있는 장면도 있어, 넘어간 학습자가 끝내 그 글을 못 보면 안 된다.
  // 완료 기록(done)은 그대로 비어 있다 — 목표를 이룬 것으로 치지 않는다
  const { renderLesson } = await entry;
  const u = withLesson(goalScenes());
  assert.ok(!renderLesson(u, 2).includes(MARK), '머무는 동안은 숨김');
  assert.ok(renderLesson(u, 3).includes(MARK), '떠나면 보임');
});

test('도형판: 선분 위 끄는 점마다 ◀▶ 버튼(끌기 대체), 보조점 이름은 그리지 않음', async () => {
  const { renderLesson } = await entry;
  const html = renderLesson(withLesson(goalScenes()), 3);
  for (const t of ['◀ 점 D', '점 D ▶', '◀ 점 C', '점 C ▶']) assert.ok(html.includes(t), t);
  assert.ok(!html.includes('data-k="lab:S"'));
});

test('도형판 손잡이: 화면 낭독기가 점 이름과 함께 자리(좌표)를 읽는다', async () => {
  const { renderLesson } = await entry;
  const html = renderLesson(withLesson(goalScenes()), 3);
  assert.match(html, /aria-label="점 D"[^>]*aria-valuetext="x 2, y 4"/);
  assert.match(html, /aria-label="점 C"[^>]*aria-valuetext="x 6, y 4"/);
});

test('접은 화면(382×580) 모양도 예외 없이 그려진다: 확률 실험 가로 표·짧은 버튼, 타일 더미 자리', async () => {
  // 브라우저의 화면 조건 판정(matchMedia)을 흉내 — 접은 화면 조건에만 '맞음'. 부품은 첫 그림부터 이 값을 읽는다
  const { COMPACT_QUERY } = await import('../src/lesson/widgets/compact.ts');
  const g = globalThis as { matchMedia?: unknown };
  const saved = g.matchMedia;
  g.matchMedia = (q: string) => ({
    matches: q === COMPACT_QUERY,
    addEventListener() {},
    removeEventListener() {},
  });
  try {
    const { units, renderLesson } = await entry;
    const pick = (id: string) => {
      const u = units.find((x) => x.id === id);
      assert.ok(u?.lesson, id);
      return renderLesson(u);
    };
    const dice = pick('m2-probability');
    assert.match(dice, /class="sim-table fold"/);
    // 직접 던지기(1-나): 접은 화면은 '계속' 짧은 글, 던지기 단추는 '꾹 누르면 계속' 안내, 주머니는 '꺼내기'
    assert.match(dice, /class="lbtn soft sim-auto"[^>]*>계속</);
    assert.match(dice, /class="lbtn blue sim-go"[^>]*>던지기<small>꾹 누르면 계속<\/small>/);
    assert.match(dice, /class="lbtn blue sim-go"[^>]*>꺼내기<small>/);
    const tiles = pick('m3-factoring');
    assert.match(tiles, /class="slot x rot"/);
    assert.match(pick('math2-diff-product-rule'), /class="readouts grow-ro"/);
  } finally {
    g.matchMedia = saved;
  }
});

/** 레슨 HTML 에서 장면 하나(data-scene 부터 다음 장면 앞까지) */
const sceneHtml = (html: string, id: string): string => {
  const at = html.indexOf(`data-scene="${id}"`);
  assert.ok(at >= 0, id);
  const next = html.indexOf('data-scene="', at + 1);
  return html.slice(at, next < 0 ? undefined : next);
};

test('확률 실험: 질문 장면은 답을 맞히기 전까지 이론값 칸을 숨긴다(표가 정답을 미리 보여 주지 않게), 탐색 장면은 그대로', async () => {
  // m2-probability hook 은 "동전 두 개, 앞면이 1개일 확률은?" — 이론 칸의 '앞 1개 1/2' 가 곧 답이었다
  const { units, renderLesson } = await entry;
  const u = units.find((x) => x.id === 'm2-probability');
  assert.ok(u?.lesson);
  const before = renderLesson(u);
  assert.ok(!sceneHtml(before, 'hook').includes('이론 '), '질문 장면(넓은 화면): 이론 칸 없음');
  assert.ok(!sceneHtml(before, 'bag').includes('이론 '), '질문 장면 bag');
  assert.ok(sceneHtml(before, 'dice').includes('이론 '), '탐색 장면은 이론값을 보여 준다');
  // 그림의 이론 점선도 같다 — '앞 1개' 점선이 50% 눈금에 딱 놓여 답을 그대로 보여 줬다. 없는 점선을 가리키는 범례 글도 뺀다
  assert.ok(!sceneHtml(before, 'hook').includes('sim-theory'), '질문 장면: 이론 점선 없음');
  assert.ok(!sceneHtml(before, 'hook').includes('점선'), '질문 장면: 점선 범례 글 없음');
  assert.ok(sceneHtml(before, 'dice').includes('sim-theory'), '탐색 장면: 이론 점선 있음');
  assert.ok(sceneHtml(before, 'dice').includes('점선'), '탐색 장면: 점선 범례 글 있음');
  const solved = sceneHtml(renderLesson(u, undefined, ['hook']), 'hook');
  assert.ok(solved.includes('sim-theory') && solved.includes('점선'), '맞힌 뒤: 점선·범례 보임');
  // 맞힌 뒤(이어 보기로 이미 끝낸 장면 포함)에는 이론값과 견주어 본다
  assert.ok(
    sceneHtml(renderLesson(u, undefined, ['hook']), 'hook').includes('이론 '),
    '맞힌 뒤에는 보임',
  );
  // 접은 화면 가로 표도 같다(이론 줄)
  const { COMPACT_QUERY } = await import('../src/lesson/widgets/compact.ts');
  const g = globalThis as { matchMedia?: unknown };
  const saved = g.matchMedia;
  g.matchMedia = (q: string) => ({
    matches: q === COMPACT_QUERY,
    addEventListener() {},
    removeEventListener() {},
  });
  try {
    const fold = renderLesson(u);
    assert.ok(!sceneHtml(fold, 'hook').includes('>이론<'), '접은 화면 질문 장면: 이론 줄 없음');
    assert.ok(sceneHtml(fold, 'dice').includes('>이론<'), '접은 화면 탐색 장면: 이론 줄 있음');
    assert.ok(
      sceneHtml(renderLesson(u, undefined, ['hook']), 'hook').includes('>이론<'),
      '접은 화면 맞힌 뒤',
    );
  } finally {
    g.matchMedia = saved;
  }
});

test('접은 화면: 결과가 많은 성공 횟수(10번 = 11칸)·여러 번 꺼내기도 가로 표로, 첫 칸은 센 것의 이름', async () => {
  // 1-나 새 기구는 아직 쓰는 단원이 없어 m2-probability 를 빌려 장면 둘의 매개변수만 바꿔 그린다
  const { COMPACT_QUERY } = await import('../src/lesson/widgets/compact.ts');
  const g = globalThis as { matchMedia?: unknown };
  const saved = g.matchMedia;
  g.matchMedia = (q: string) => ({
    matches: q === COMPACT_QUERY,
    addEventListener() {},
    removeEventListener() {},
  });
  try {
    const { units, renderLesson } = await entry;
    const u = units.find((x) => x.id === 'm2-probability');
    assert.ok(u?.lesson);
    const lesson = structuredClone(u.lesson);
    const set = (id: string, params: unknown) => {
      const s = lesson.scenes.find((x) => x.id === id) as { widget?: { params: unknown } };
      assert.ok(s?.widget, id);
      s.widget.params = params;
    };
    set('dice', { device: 'trial', p: '1/3', n: 10, label: '명중', seed: 4 });
    set('hook', {
      device: 'bag',
      bag: [
        { label: '빨강', count: 2 },
        { label: '파랑', count: 3 },
      ],
      draws: 3,
      replace: false,
      count: '빨강',
      seed: 3,
    });
    const html = renderLesson({ ...u, lesson });
    const dice = sceneHtml(html, 'dice');
    assert.equal(dice.match(/class="sim-table fold"/g)?.length, 2);
    assert.match(dice, /<th scope="row">명중<\/th>/);
    assert.match(sceneHtml(html, 'hook'), /<th scope="row">빨강<\/th>/);
  } finally {
    g.matchMedia = saved;
  }
});
