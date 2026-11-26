// 글자 가운데 실측 감사: npm run audit:center [-- --only=단원정규식] [--out=폴더] [--crop=글자요소정규식]
// 헤드리스 Chrome(맥에 깔린 것)으로 모든 단원 레슨 + 시험 레슨의 모든 장면을 접은 화면 382×580·펼친 화면 669×800 에서
// 열고(처음 모습·다 끝낸 뒤 모습 두 번), '원·사각형·상자 + 그 안 글자' 짝마다 글자 잉크 중심과 도형 중심의 차이를 잰다.
// - 잉크는 글꼴 지표(글자 상자)가 아니라 실제 획이다: 글자만 자홍·도형은 흰색으로 칠해 찍은 화면에서 자홍 화소를 모은다.
// - 화면 높이를 늘려 한 번에 찍지 않는다(captureBeyondViewport) — 높이가 바뀌면 접은 화면 @media 가 풀려 배치가 달라진다.
//   대신 스크롤로 차례로 화면 안에 들여와 보이는 화면만 찍는다.
// 결과: <out>/results.json(모든 짝), <out>/crops/*.png(넘은 것 + --crop 에 맞는 글자 요소의 원래 색 캡처), 종류별 요약.
// 기준: 가로나 세로로 1.5px 넘게 비키면 '넘음'. 왼쪽 맞춤 칸의 글자는 가로를 따지지 않는다(page 의 hcenter).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import * as esbuild from 'esbuild';
import { contentPlugin, root } from './esbuild-shared.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const OUT = resolve(root, arg('out') ?? '.cache/center-audit');
const ONLY = arg('only') ? new RegExp(arg('only')) : null;
/** 넘지 않아도 캡처해 둘 글자 요소(고친 뒤 모습을 남기려고) */
const CROP = arg('crop') ? new RegExp(arg('crop')) : null;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCALE = 2;
const LIMIT = 1.5;
const SIZES = [
  { name: 'fold', width: 382, height: 580 },
  { name: 'open', width: 669, height: 800 },
];

// ---- 묶기 ----
const www = join(OUT, 'www');
rmSync(join(OUT, 'crops'), { recursive: true, force: true });
mkdirSync(www, { recursive: true });
await esbuild.build({
  absWorkingDir: root,
  entryPoints: { page: join(root, 'scripts/center-audit.page.tsx') },
  bundle: true,
  outdir: www,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  define: { __DEV__: 'false', __BUILD__: '"audit"', 'process.env.NODE_ENV': '"production"' },
  plugins: [contentPlugin],
  logLevel: 'warning',
});
writeFileSync(
  join(www, 'index.html'),
  '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="./page.css"></head><body><div id="root"></div><script type="module" src="./page.js"></script></body></html>',
);

// ---- 정적 서버(127.0.0.1 만) ----
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};
const server = createServer((req, res) => {
  const p = join(
    www,
    decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/\/$/, '/index.html'),
  );
  try {
    const b = readFileSync(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

// ---- Chrome + DevTools 프로토콜(Node 내장 WebSocket — 새 의존성 없음) ----
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${join(OUT, 'profile')}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  'about:blank',
]);
const wsUrl = await new Promise((ok, no) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) ok(m[1]);
  });
  setTimeout(
    () => no(new Error(`Chrome 을 띄우지 못함(${CHROME}) — CHROME=경로 로 바꿀 수 있다`)),
    15000,
  );
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const wait = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown')
    console.error('페이지 예외:', m.params.exceptionDetails?.exception?.description?.slice(0, 300));
  if (!m.id || !wait.has(m.id)) return;
  const [ok, no] = wait.get(m.id);
  wait.delete(m.id);
  if (m.error) no(new Error(JSON.stringify(m.error)));
  else ok(m.result);
});
const send = (method, params = {}, sessionId) =>
  new Promise((ok, no) => {
    const id = ++seq;
    wait.set(id, [ok, no]);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const cmd = (m, p) => send(m, p, sessionId);
const ev = async (expr) => {
  const r = await cmd('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(`${expr}: ${r.exceptionDetails.exception?.description}`);
  return r.result.value;
};
const shot = async () =>
  Buffer.from((await cmd('Page.captureScreenshot', { format: 'png' })).data, 'base64');

// ---- PNG 읽기·쓰기(8비트 RGB/RGBA, 비월 — Chrome 캡처 형식) ----
function readPng(buf) {
  let o = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const d = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      ct = d[9];
    } else if (type === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
/** 캡처에서 CSS px 사각형 r 둘레 pad 만큼 잘라 PNG 로 */
function crop(img, r, pad) {
  const x0 = Math.max(0, Math.floor((r.x - pad) * SCALE));
  const y0 = Math.max(0, Math.floor((r.y - pad) * SCALE));
  const w = Math.min(img.w, Math.ceil((r.x + r.w + pad) * SCALE)) - x0;
  const h = Math.min(img.h, Math.ceil((r.y + r.h + pad) * SCALE)) - y0;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * img.w + x + x0) * img.bpp;
      img.px.copy(raw, y * (w * 3 + 1) + 1 + x * 3, i, i + 3);
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 도형 s(뷰포트 CSS px) 안 자홍 화소의 상자. 원(가로세로 같음)은 반지름 안만 — 알약은 사각형으로(양 끝 글자가 잘리지 않게) */
function ink(img, s) {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const circle = s.round && Math.abs(s.w - s.h) < 2;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = -1;
  let y1 = -1;
  for (
    let y = Math.max(0, Math.floor(s.y * SCALE));
    y < Math.min(img.h, Math.ceil((s.y + s.h) * SCALE));
    y++
  )
    for (
      let x = Math.max(0, Math.floor(s.x * SCALE));
      x < Math.min(img.w, Math.ceil((s.x + s.w) * SCALE));
      x++
    ) {
      const i = (y * img.w + x) * img.bpp;
      const [R, G, B] = [img.px[i], img.px[i + 1], img.px[i + 2]];
      // 흰 바탕 위 자홍(테두리 흐림 포함). 파랑·빨강 같은 다른 그림 색은 R·B 중 하나가 낮아 빠진다
      if (Math.min(R, B) - G < 90 || Math.abs(R - B) > 60) continue;
      if (circle && Math.hypot((x + 0.5) / SCALE - cx, (y + 0.5) / SCALE - cy) > s.w / 2) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  if (x1 < 0) return null;
  return { x: x0 / SCALE, y: y0 / SCALE, w: (x1 - x0) / SCALE, h: (y1 - y0) / SCALE };
}

const isOver = (r) =>
  !r.occl && (!r.ink || (r.hcenter && Math.abs(r.dx) > LIMIT) || Math.abs(r.dy) > LIMIT);
/**
 * 넘은 까닭. 'layout'(자리 탓): 글자 상자부터 도형 가운데에서 0.5px 넘게 비킴 — 맞춤 속성 빠짐·늘어난 상자 등, 고칠 것.
 * 'glyph'(글자 모양 탓): 글자 상자는 가운데인데 획이 원래 한쪽에 몰린 글자(°·소문자 cm·y =·분수 1/3·수식 축의 +−).
 */
const cause = (r) =>
  !isOver(r)
    ? null
    : !r.ink || Math.abs(r.emDy) > 0.5 || (r.hcenter && Math.abs(r.emDx) > 0.5)
      ? 'layout'
      : 'glyph';

// ---- 돌리기 ----
await cmd('Page.enable');
await cmd('Runtime.enable');
await cmd('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'light' },
  ],
});
const results = [];
mkdirSync(join(OUT, 'crops'), { recursive: true });
for (const size of SIZES) {
  await cmd('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: SCALE,
    mobile: true,
  });
  await cmd('Page.navigate', { url });
  for (let k = 0; k < 100 && !(await ev('!!window.__audit').catch(() => false)); k++)
    await new Promise((r) => setTimeout(r, 100));
  const list = (await ev('__audit.list()')).filter((u) => !ONLY || ONLY.test(u.id));
  for (const u of list)
    for (const pass of ['first', 'done']) {
      await ev(`__audit.show(${JSON.stringify(u.id)}, ${pass === 'done'})`);
      if (pass === 'done') await ev('__audit.interact()');
      const cs = await ev('__audit.collect()');
      const mine = [];
      const add = (c, w, b) => {
        const r = { size: size.name, unit: u.id, title: u.title, pass, ...c, occl: w.occl, ink: b };
        r.dx = b ? +(b.x + b.w / 2 - (w.shape.x + w.shape.w / 2)).toFixed(2) : null;
        r.dy = b ? +(b.y + b.h / 2 - (w.shape.y + w.shape.h / 2)).toFixed(2) : null;
        if (w.em) {
          r.emDx = +(w.em.x + w.em.w / 2 - (w.shape.x + w.shape.w / 2)).toFixed(2);
          r.emDy = +(w.em.y + w.em.h / 2 - (w.shape.y + w.shape.h / 2)).toFixed(2);
        }
        r.cause = cause(r);
        mine.push(r);
      };
      // 겹치는 짝(선 잇기 점과 그 배지 등)을 함께 칠하면 옆 짝의 자홍 글자가 이 도형 안에 섞인다 —
      // 도형이 서로 안 겹치는 무리로 나눠 무리마다 따로 칠해 잰다
      cs.sort((a, b) => a.shape.y - b.shape.y);
      const hit = (a, b) =>
        a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
      const layers = [];
      for (const c of cs) {
        const l = layers.find((g) => !g.some((o) => hit(o.shape, c.shape)));
        if (l) l.push(c);
        else layers.push([c]);
      }
      for (const layer of layers) {
        await ev(`__audit.paint(true, ${JSON.stringify(layer.map((c) => c.i))})`);
        // 위에서부터: 남은 것 중 맨 위를 화면 위쪽(고정 막대 아래)에 오게 스크롤하고, 화면 안에 다 들어온 것을 잰다.
        // 고정 막대·알림에 가린 것은 맨 위 차례가 될 때 다시 본다(그때도 가리면 '가림'으로 넘긴다)
        const pending = new Set(layer.map((c) => c.i));
        const byI = new Map(layer.map((c) => [c.i, c]));
        while (pending.size) {
          const first = byI.get([...pending][0]);
          await ev(`window.scrollTo(0, ${Math.max(0, first.shape.y - 120)})`);
          const info = await ev(`__audit.where(${JSON.stringify([...pending])})`);
          const img = readPng(await shot());
          let took = 0;
          for (const w of info) {
            if (w.shape.y < 0 || w.shape.y + w.shape.h > size.height) continue;
            if (w.occl && w.i !== first.i) continue;
            pending.delete(w.i);
            took++;
            add(byI.get(w.i), w, w.occl ? null : ink(img, w.shape));
          }
          if (!took) {
            // 화면보다 큰 상자 등 — 재지 않고 넘긴다
            pending.delete(first.i);
            add(first, { occl: 'offscreen', shape: first.shape }, null);
          }
        }
        await ev('__audit.paint(false)');
      }
      // 넘은 것은 원래 색으로 잘라 둔다(전후 비교용)
      for (const r of mine.filter((x) => isOver(x) || (!x.occl && CROP?.test(x.cls)))) {
        await ev(`window.scrollTo(0, ${Math.max(0, r.shape.y - 120)})`);
        const [w] = await ev(`__audit.where([${r.i}])`);
        r.crop = `${r.size}-${r.unit}-${r.pass}-${r.scene}-${r.i}.png`;
        writeFileSync(join(OUT, 'crops', r.crop), crop(readPng(await shot()), w.shape, 10));
      }
      results.push(...mine);
      const n = mine.filter(isOver).length;
      if (n) console.log(`${size.name} ${u.id} ${pass}: 짝 ${mine.length}개 중 넘음 ${n}`);
    }
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));

// ---- 요약: (글자 요소 @ 도형) 종류별, 까닭별 ----
const groups = new Map();
for (const r of results) {
  const k = `${r.kind} ${r.cls} @ ${r.shapeCls}`;
  const g = groups.get(k) ?? { n: 0, over: [] };
  g.n++;
  if (isOver(r)) g.over.push(r);
  groups.set(k, g);
}
console.log(`\n짝 ${results.length}개(가려서 못 잰 것 ${results.filter((r) => r.occl).length}개)`);
for (const [c, head] of [
  ['layout', '자리 탓(고칠 것)'],
  ['glyph', '글자 모양 탓(획이 원래 한쪽에 몰린 글자 — 글자 상자는 가운데)'],
]) {
  const rows = [...groups]
    .map(([k, g]) => [k, g.n, g.over.filter((r) => r.cause === c)])
    .filter(([, , o]) => o.length)
    .sort((a, b) => b[2].length - a[2].length);
  if (!rows.length) continue;
  console.log(`\n[${head}]`);
  for (const [k, n, o] of rows) {
    const m = (f) =>
      o.reduce(
        (a, r) => (f === 'dx' && !r.hcenter ? a : Math.abs(r[f] ?? 0) > Math.abs(a) ? r[f] : a),
        0,
      );
    const ex = [...new Set(o.map((r) => `${r.size} ${r.unit}/${r.scene} "${r.text}"`))];
    console.log(`넘음 ${o.length}/${n}  가로 최대 ${m('dx')} 세로 최대 ${m('dy')}  ${k}`);
    console.log(`    ${ex.slice(0, 4).join(' · ')}${ex.length > 4 ? ` 외 ${ex.length - 4}` : ''}`);
  }
}
const layout = results.filter((r) => r.cause === 'layout').length;
const glyph = results.filter((r) => r.cause === 'glyph').length;
console.log(
  `\n1.5px 넘음: 자리 탓 ${layout}개, 글자 모양 탓 ${glyph}개 — ${join(OUT, 'results.json')}`,
);
ws.close();
chrome.kill();
server.close();
