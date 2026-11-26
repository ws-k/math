// 글자 가운데 실측 감사의 브라우저 쪽(scripts/center-audit.mjs 가 묶어 헤드리스 Chrome 에 띄운다).
// 모든 단원 레슨 + 시험 레슨(test/widgets-fixture·lesson-fixture)을 하나씩 그리고 '도형 + 그 안 글자' 짝을 모은다.
// 재는 일(잉크 찾기)은 Node 쪽이 화면 캡처로 한다 — 여기는 짝 찾기·칠하기·위치 알려 주기만.
import 'katex/dist/katex.min.css';
import '../src/app/app.css';
import '../src/lesson/lesson.css';
import content from 'virtual:content';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_SETTINGS } from '../src/app/settings.ts';
import type { Unit } from '../src/content/types.ts';
import { LessonPlayer } from '../src/lesson/LessonPlayer.tsx';
import type { Lesson } from '../src/lesson/types.ts';
import { unit as fxUnit } from '../test/app-fixture.ts';
import { goodLesson } from '../test/lesson-fixture.ts';
import { widgetLessons } from '../test/widgets-fixture.ts';

type LUnit = Unit & { lesson: Lesson };
const units: LUnit[] = [
  ...(content.units as Unit[]).filter((u): u is LUnit => !!u.lesson),
  { ...fxUnit('fx-good', []), lesson: goodLesson() },
  ...widgetLessons().map((l, i) => ({ ...fxUnit(`fx-widgets${i + 1}`, []), lesson: l })),
];

const el = document.getElementById('root') as HTMLElement;
let root: Root | null = null;
const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 단원 레슨을 장면 끝까지 펼쳐 그린다. doneAll 이면 모든 장면을 끝낸 상태(맞힌 뒤 모습) */
async function show(id: string, doneAll: boolean) {
  const u = units.find((x) => x.id === id);
  if (!u) throw new Error(`단원 없음: ${id}`);
  root?.unmount();
  window.scrollTo(0, 0);
  root = createRoot(el);
  flushSync(() =>
    root?.render(
      <LessonPlayer
        key={`${id}${doneAll}`}
        unit={u}
        lesson={u.lesson}
        tool={DEFAULT_SETTINGS.tool}
        background={DEFAULT_SETTINGS.background}
        initial={{
          shown: u.lesson.scenes.length,
          done: doneAll ? u.lesson.scenes.map((s) => s.id) : [],
        }}
      />,
    ),
  );
  await document.fonts.ready;
  await raf();
  await raf();
  await sleep(150);
}

const enter = (n: Element | null) =>
  n?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

/** 끝낸 뒤에만 나오는 그림(선 잇기 배지·실험 결과)까지 보이게 손으로 해 본다 */
async function interact() {
  for (const svg of document.querySelectorAll('svg.ct-pairs')) {
    const n = svg.querySelectorAll('[data-node]').length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        // React 는 이 눌림을 다음 마이크로태스크에 반영한다 — 한 번씩 기다려야 앞의 고름이 남는다
        enter(svg.querySelector(`[data-node="${i}"]`));
        await sleep(0);
        enter(svg.querySelector(`[data-node="${j}"]`));
        await sleep(0);
      }
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('.sim-go'))
    for (let k = 0; k < 2; k++) {
      b.click();
      await sleep(80);
    }
  await raf();
  await raf();
  await sleep(400);
}

const vis = (e: Element) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true });
const painted = (e: Element) => {
  const cs = getComputedStyle(e);
  const fillOn = cs.fill !== 'none' && !/rgba\(.*, 0\)$/.test(cs.fill) && cs.fillOpacity !== '0';
  const strokeOn = cs.stroke !== 'none' && cs.strokeWidth !== '0px';
  return fillOn || strokeOn;
};
const alpha = (c: string) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return c === 'transparent' ? 0 : 1;
  const p = (m[1] as string).split(/[ ,/]+/).filter(Boolean);
  return p.length > 3 ? Number(p[3]) : 1;
};
const num = (s: string) => Number.parseFloat(s) || 0;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Cand {
  i: number;
  kind: 'svg' | 'html';
  scene: string;
  /** 글자 요소(부모 > 자신) */
  cls: string;
  /** 도형 요소(부모 > 자신) */
  shapeCls: string;
  text: string;
  /** 문서 좌표 */
  shape: Box & { round: boolean };
  /** 가로 가운데가 의도인가 — 왼쪽 맞춤 칸(답 칸의 단위 등)은 가로를 따지지 않는다 */
  hcenter: boolean;
  attrs?: Record<string, string>;
}
let cands: { c: Cand; t: Element; s: Element; save: [Element, string | null][] }[] = [];

const name = (e: Element) => {
  const c = (e.getAttribute('class') ?? '').trim();
  return `${e.tagName.toLowerCase()}${c ? `.${c.split(/\s+/).join('.')}` : ''}`;
};
const path = (e: Element) => `${e.parentElement ? `${name(e.parentElement)} > ` : ''}${name(e)}`;

function collect(): Cand[] {
  cands = [];
  const push = (kind: Cand['kind'], t: Element, s: Element, round: boolean, hcenter: boolean) => {
    const r = s.getBoundingClientRect();
    const c: Cand = {
      i: cands.length,
      kind,
      scene: t.closest('[data-scene]')?.getAttribute('data-scene') ?? '?',
      cls: path(t),
      shapeCls: path(s),
      text: (t.textContent ?? '').trim().slice(0, 24),
      shape: { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, round },
      hcenter,
    };
    if (kind === 'svg') {
      const cs = getComputedStyle(t);
      c.attrs = {
        anchor: cs.textAnchor,
        baseline: cs.dominantBaseline,
        font: `${cs.fontWeight} ${cs.fontSize}`,
      };
    }
    cands.push({ c, t, s, save: [] });
  };
  // SVG: 글자마다 그 글자를 품은 가장 작은 원·사각형(그림 바탕처럼 글자보다 훨씬 큰 것은 뺀다)
  for (const t of document.querySelectorAll('#root svg text')) {
    if (!vis(t) || !(t.textContent ?? '').trim()) continue;
    const tr = t.getBoundingClientRect();
    if (tr.width === 0) continue;
    const cx = tr.x + tr.width / 2;
    const cy = tr.y + tr.height / 2;
    const svg = t.closest('svg');
    let best: Element | null = null;
    let bestA = Number.POSITIVE_INFINITY;
    for (const s of svg?.querySelectorAll('circle,ellipse,rect') ?? []) {
      if (!vis(s) || !painted(s)) continue;
      const r = s.getBoundingClientRect();
      if (cx < r.x || cx > r.right || cy < r.y || cy > r.bottom) continue;
      if (r.width > Math.max(90, tr.width * 3 + 20) || r.height > Math.max(70, tr.height * 3 + 20))
        continue;
      if (r.width * r.height < tr.width * tr.height * 0.5) continue;
      if (r.width * r.height < bestA) {
        bestA = r.width * r.height;
        best = s;
      }
    }
    if (best) push('svg', t, best, best.tagName !== 'rect', true);
  }
  // HTML: 바탕이나 테두리가 있는 작은 한 줄 상자 안의 글자(단추·알약·칸)
  const boxy = (b: Element) => {
    const cs = getComputedStyle(b);
    return (
      alpha(cs.backgroundColor) > 0.05 ||
      (num(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.05) ||
      cs.boxShadow !== 'none'
    );
  };
  const centerish = (q: CSSStyleDeclaration) =>
    q.textAlign === 'center' ||
    (/flex/.test(q.display) && q.justifyContent === 'center') ||
    (/grid/.test(q.display) && (q.justifyItems === 'center' || q.justifyContent === 'center'));
  for (const e of document.querySelectorAll('#root *')) {
    if (e.closest('svg') || e.closest('.katex') || !vis(e)) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && (n.nodeValue ?? '').trim())) continue;
    if (e.querySelector('svg,img,.katex,canvas,input,textarea')) continue;
    if ([...e.querySelectorAll('*')].some((k) => getComputedStyle(k).display !== 'inline'))
      continue;
    // 바탕 없는 글자면 글자 하나만 품은 상자 부모
    const p = e.parentElement;
    const box = boxy(e)
      ? e
      : p && boxy(p) && (p.textContent ?? '').trim() === (e.textContent ?? '').trim()
        ? p
        : null;
    if (!box) continue;
    const r = box.getBoundingClientRect();
    if (r.width > 240 || r.height > 90 || r.width < 6) continue;
    const cs = getComputedStyle(e);
    const lh = num(cs.lineHeight) || num(cs.fontSize) * 1.3;
    const rg = document.createRange();
    rg.selectNodeContents(e);
    const lines = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size;
    if (lines > 1 || r.height > lh * 2.6 + 16) continue;
    const bs = getComputedStyle(box);
    const shrink = /inline/.test(bs.display) && num(bs.paddingLeft) === num(bs.paddingRight);
    push(
      'html',
      e,
      box,
      num(bs.borderTopLeftRadius) >= Math.min(r.width, r.height) * 0.4,
      centerish(bs) || centerish(cs) || shrink,
    );
  }
  return cands.map((k) => k.c);
}

function setI(save: [Element, string | null][], e: Element, props: Record<string, string>) {
  save.push([e, e.getAttribute('style')]);
  for (const [k, v] of Object.entries(props))
    (e as HTMLElement | SVGElement).style.setProperty(k, v, 'important');
}

/**
 * on: 글자는 자홍, 도형은 흰색으로 칠해 캡처에서 글자 잉크만 골라낼 수 있게(only 가 있으면 그 후보만). off: 모두 되돌리기
 */
function paint(on: boolean, only?: number[]) {
  for (const k of on && only ? only.map((i) => cands[i]).filter((x) => !!x) : cands) {
    if (!on) {
      for (const [e, st] of k.save.reverse()) {
        if (st === null) e.removeAttribute('style');
        else e.setAttribute('style', st);
      }
      k.save = [];
    } else if (k.c.kind === 'svg') {
      setI(k.save, k.t, { fill: '#ff00ff', stroke: 'none', opacity: '1' });
      setI(k.save, k.s, { fill: '#ffffff', stroke: 'none' });
    } else {
      setI(k.save, k.s, {
        'background-color': '#ffffff',
        'background-image': 'none',
        'box-shadow': 'none',
        'border-color': '#ffffff',
      });
      for (const d of [k.t, ...k.t.querySelectorAll('*')])
        setI(k.save, d, {
          color: '#ff00ff',
          '-webkit-text-fill-color': '#ff00ff',
          'text-shadow': 'none',
          opacity: '1',
        });
    }
  }
}

/**
 * 지금 화면(뷰포트) 좌표의 도형·글자 상자와 가림 여부. 가림: HTML 상자는 가운데에 다른 것이 올라와 있으면
 * (겹친 카드 더미의 아래 장 등), SVG 글자는 장면 밖 것(고정 막대·알림)이 덮고 있으면
 */
function where(idx: number[]) {
  return idx.map((i) => {
    const k = cands[i];
    if (!k) throw new Error(`후보 없음: ${i}`);
    const r = k.s.getBoundingClientRect();
    const shape = { x: r.x, y: r.y, w: r.width, h: r.height, round: k.c.shape.round };
    let occl = false;
    if (r.y >= 0 && r.bottom <= innerHeight) {
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const own = k.c.kind === 'html' ? k.s : (k.t.closest('[data-scene]') ?? k.t.closest('svg'));
      occl = !!hit && !!own && !own.contains(hit) && !hit.contains(own);
    }
    // 글자 상자(글꼴의 위·아래 높이로 잡힌 줄 상자) — 잉크와 비교해 '자리 탓'과 '글자 모양 탓'을 가른다
    let e: DOMRect;
    if (k.c.kind === 'svg') e = k.t.getBoundingClientRect();
    else {
      const rg = document.createRange();
      rg.selectNodeContents(k.t);
      e = rg.getBoundingClientRect();
    }
    return { i, shape, occl, em: { x: e.x, y: e.y, w: e.width, h: e.height } };
  });
}

Object.assign(window, {
  __audit: {
    list: () => units.map((u) => ({ id: u.id, title: u.title })),
    show,
    interact,
    collect,
    paint,
    where,
  },
});
