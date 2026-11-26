// 원·칸 안 글자의 가운데 맞춤. 실기기에서 선 잇기 배지 숫자가 원 오른쪽 위로 비켜 그려졌다(2026-11-26) —
// 글자에 가운데 맞춤(text-anchor·dominant-baseline)이 빠져 x,y 가 글자 왼쪽 아래 기준선이 됐기 때문이다.
// 가운데 글자는 공용 클래스 하나(.mid-text)로만 맞춘다. 화면 실측 감사는 npm run audit:center(scripts/center-audit.mjs)로 다시 돌릴 수 있다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  type SimParams,
  simAppend,
  simDraw,
  simHistory,
  simulateDef,
} from '../src/lesson/widgets/simulate.ts';

const SRC = join(import.meta.dirname, '../src');
const files = (dir: string, ext: RegExp): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name), ext) : ext.test(d.name) ? [join(dir, d.name)] : [],
  );
const css = files(SRC, /\.css$/).map((f) => ({ f, s: readFileSync(f, 'utf8') }));

/** CSS 규칙 목록(주석 뺌): 선택자와 본문 */
const rules = (s: string) =>
  [...s.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: (m[1] as string).trim(),
    body: m[2] as string,
  }));

test('공용 가운데 글자 규칙: 글자 요소에 직접 text-anchor:middle + dominant-baseline:central', () => {
  const all = css.flatMap(({ s }) => rules(s));
  const mid = all.filter((r) => /(^|[\s,])\.lesson svg text\.mid-text$/.test(r.sel));
  assert.equal(mid.length, 1, '.lesson svg text.mid-text 규칙이 하나');
  assert.match(mid[0]?.body ?? '', /text-anchor:\s*middle/);
  assert.match(mid[0]?.body ?? '', /dominant-baseline:\s*central/);
});

test('dominant-baseline 은 공용 규칙에만 — 부품마다 따로 걸면 빠뜨리는 곳이 생긴다(WebKit 은 g 에서 물려받지도 않는다)', () => {
  const where = css.flatMap(({ f, s }) =>
    rules(s)
      .filter((r) => /dominant-baseline/.test(r.body) && !/text\.mid-text$/.test(r.sel))
      .map((r) => `${f.slice(SRC.length + 1)}: ${r.sel}`),
  );
  assert.deepEqual(where, []);
});

/**
 * 화면 코드에서 원 바로 뒤 글자가 그 원의 중심(cx,cy)에 놓였으면 가운데 글자다 — 공용 클래스가 있어야 하고,
 * y 를 손으로 내려(+4·+5) 맞추지 않는다(글자 크기·글꼴이 바뀌면 다시 어긋난다).
 */
test('원 중심에 놓인 SVG 글자는 모두 mid-text, y 손 보정 없음', () => {
  const attr = (tag: string, name: string) =>
    tag.match(new RegExp(`\\s${name}=\\{([^{}]+)\\}`))?.[1]?.trim();
  const bad: string[] = [];
  let seen = 0;
  for (const f of files(SRC, /\.tsx$/)) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<circle\b[^>]*?\/>/g)) {
      const cx = attr(m[0], 'cx');
      const cy = attr(m[0], 'cy');
      if (!cx || !cy) continue;
      // 같은 묶음 안 바로 뒤의 글자 한 개
      const rest = s.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400);
      const t = rest.match(/^\s*(?:\{[^<]*?)?<text\b[^>]*>/)?.[0];
      if (!t) continue;
      const x = attr(t, 'x');
      const y = attr(t, 'y');
      if (x !== cx || !y?.startsWith(cy)) continue;
      seen++;
      const name = `${f.slice(SRC.length + 1)}: <text x={${x}} y={${y}}>`;
      if (y !== cy) bad.push(`${name} — y 손 보정`);
      if (!/className=(?:"[^"]*\bmid-text\b[^"]*"|\{[^}]*\bmid-text\b[^}]*\})/.test(t))
        bad.push(`${name} — mid-text 없음`);
    }
  }
  // 선 잇기 점 이름·배지, 넓이 모형 더미 개수 — 이 셋이 안 잡히면 검사 자체가 고장
  assert.ok(seen >= 3, `원 중심 글자 ${seen}개만 찾음`);
  assert.deepEqual(bad, []);
});

test('확률 실험 마지막 결과: 동전·주사위·공 글자가 그 칸 중심에, mid-text 로', () => {
  const parse = (raw: unknown) => simulateDef.parse(raw) as SimParams;
  for (const raw of [
    { device: 'coin', n: 2, seed: 3 },
    { device: 'die', n: 2, seed: 3 },
    {
      device: 'bag',
      bag: [
        { label: '빨강', count: 2 },
        { label: '파랑', count: 1 },
      ],
      seed: 3,
    },
  ]) {
    const p = parse(raw);
    const h = simHistory(p);
    simAppend(p, h, 5);
    for (const t of [0, 5]) {
      const last = simDraw(p, h, t, { theory: true, compact: false }).last;
      const texts = last.filter((m) => m.k.startsWith('lt:'));
      assert.ok(texts.length > 0, `${raw.device} 글자 없음`);
      for (const m of texts) {
        const box = last.find((b) => b.k === `lc:${m.k.slice(3)}`);
        assert.ok(box, m.k);
        const c =
          box.tag === 'circle'
            ? [Number(box.a.cx), Number(box.a.cy)]
            : [
                Number(box.a.x) + Number(box.a.width) / 2,
                Number(box.a.y) + Number(box.a.height) / 2,
              ];
        const at = `${raw.device} t=${t} ${m.k}`;
        assert.match(String(m.a.class), /\bmid-text\b/, at);
        assert.ok(Math.abs(Number(m.a.x) - (c[0] as number)) < 0.01, `${at} x`);
        assert.ok(Math.abs(Number(m.a.y) - (c[1] as number)) < 0.01, `${at} y`);
      }
    }
  }
});
