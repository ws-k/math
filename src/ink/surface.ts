// 필기 엔진 (React 무관, 순수 DOM). 설계: docs/design.md 7-1·10장.
//
// 층 구조(아래→위): 배경(모눈·줄) div → host 원래 내용 → committed 캔버스(끝난 획) → live 캔버스(그리는 중).
// 그리는 동안은 콜백·상태 갱신 없이 live 캔버스에만 그려 입력 지연을 없애고,
// 끝난 획은 committed 로 옮겨 획이 많아져도 매 프레임 다시 그리지 않는다.
// 캔버스는 pointer-events:none — 손가락 입력은 그대로 host 의 스크롤·버튼으로 간다.

import { strokeWidths } from './geometry.ts';
import { createHistory, eraseAt } from './history.ts';
import { createTapDetector, type TouchPoint } from './tap.ts';
import type { Background, CreateInkSurface, Stroke, Tool } from './types.ts';

/** 종이 너비(종이 단위) */
const PAPER = 1000;
const PEN_BASE = [2.2, 3.4, 5] as const;
const HIGHLIGHTER_BASE = [14, 20, 28] as const;
const ERASER_RADIUS = [8, 14, 22] as const;
const HIGHLIGHTER_ALPHA = 0.35;
/** 펜을 뗀 뒤 손가락을 무시하는 시간 */
export const PALM_MS = 500;
/** 공책 아래 이만큼 남으면 늘린다 / 한 번에 늘리는 양 */
const GROW_MARGIN = 300;
const GROW_STEP = 600;
/**
 * iOS Safari 캔버스 한 장 최대 픽셀(약 16.7M). 넘으면 캔버스가 통째로 안 그려지므로,
 * 공책이 길어지면 선명도(DPR)를 조금 낮춰서라도 한도 안에 둔다.
 */
const MAX_CANVAS_PIXELS = 16_000_000;
/** 배경 간격(종이 단위) */
const GRID_STEP = 40;
const LINE_STEP = 50;
const BG_COLOR = 'rgba(80, 110, 160, 0.18)';

/** 포인터 이벤트 → 종이 좌표 점 [x, y, t, p] */
function pushPoint(out: number[], e: PointerEvent, rect: DOMRect) {
  const k = PAPER / rect.width;
  out.push((e.clientX - rect.left) * k, (e.clientY - rect.top) * k, e.timeStamp, e.pressure);
}

/** 펜 획: 점마다 굵기가 다르므로 중점 이차곡선 조각을 굵기별로 따로 긋는다(불투명이라 겹쳐도 티 안 남). */
function drawPen(ctx: CanvasRenderingContext2D, s: Stroke) {
  const p = s.pts;
  const n = p.length / 4;
  if (n === 0) return;
  const w = strokeWidths(p, { base: s.base });
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  if (n === 1) {
    ctx.beginPath();
    ctx.arc(p[0] as number, p[1] as number, (w[0] as number) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const px = (i: number) => p[i * 4] as number;
  const py = (i: number) => p[i * 4 + 1] as number;
  const mx = (i: number) => (px(i) + px(i + 1)) / 2;
  const my = (i: number) => (py(i) + py(i + 1)) / 2;
  const seg = (width: number) => {
    ctx.lineWidth = width;
    ctx.stroke();
  };
  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  ctx.lineTo(mx(0), my(0));
  seg(w[0] as number);
  for (let i = 1; i < n - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(mx(i - 1), my(i - 1));
    ctx.quadraticCurveTo(px(i), py(i), mx(i), my(i));
    seg(w[i] as number);
  }
  ctx.beginPath();
  ctx.moveTo(mx(n - 2), my(n - 2));
  ctx.lineTo(px(n - 1), py(n - 1));
  seg(w[n - 1] as number);
}

/**
 * 형광펜: 반투명이라 조각을 나눠 그으면 겹친 곳마다 진해진다. 그래서 굵기는 일정하게 두고
 * 한 경로로 한 번에 긋는다(진짜 형광펜도 굵기가 일정하다).
 */
function drawHighlighter(ctx: CanvasRenderingContext2D, s: Stroke) {
  const p = s.pts;
  const n = p.length / 4;
  if (n === 0) return;
  ctx.save();
  ctx.globalAlpha = HIGHLIGHTER_ALPHA;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.base;
  ctx.beginPath();
  ctx.moveTo(p[0] as number, p[1] as number);
  if (n === 1) ctx.lineTo((p[0] as number) + 0.01, p[1] as number);
  for (let i = 1; i < n - 1; i++) {
    const x = p[i * 4] as number;
    const y = p[i * 4 + 1] as number;
    ctx.quadraticCurveTo(
      x,
      y,
      (x + (p[i * 4 + 4] as number)) / 2,
      (y + (p[i * 4 + 5] as number)) / 2,
    );
  }
  if (n > 1) ctx.lineTo(p[(n - 1) * 4] as number, p[(n - 1) * 4 + 1] as number);
  ctx.stroke();
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.tool === 'highlighter') drawHighlighter(ctx, s);
  else drawPen(ctx, s);
}

function makeLayer(tag: 'div' | 'canvas', z: string): HTMLElement {
  const el = document.createElement(tag);
  el.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
  return el;
}

/** 스크롤되는 가장 가까운 조상(펜이 닿은 동안 잠근다) */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

export const createInkSurface: CreateInkSurface = (host, opts) => {
  let tool: Tool = opts.tool;
  let height = opts.doc.height;
  const history = createHistory(opts.doc.strokes);

  // host 를 기준 상자로. 배경을 z-index:-1 로 내용 뒤에 깔려면 host 가 쌓임 맥락이어야 해서
  // isolation:isolate 를 건다(z-index 를 바꾸지 않아 앱의 다른 쌓임 순서를 건드리지 않는다).
  const saved = {
    position: host.style.position,
    isolation: host.style.isolation,
    minHeight: host.style.minHeight,
  };
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.style.isolation = 'isolate';

  const bg = makeLayer('div', '-1');
  const committed = makeLayer('canvas', '1') as HTMLCanvasElement;
  // live 는 쪽 전체가 아니라 펜이 닿은 동안 "보이는 부분"만 덮는다(placeLive). 긴 공책에서
  // 쪽 크기 캔버스를 한 장 더 두면 iOS 메모리 한도에 금방 닿기 때문이다. 쉴 때는 0×0.
  const live = document.createElement('canvas');
  live.style.cssText =
    'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:1';
  live.width = live.height = 0;
  host.append(bg, committed, live);
  const cctx = committed.getContext('2d') as CanvasRenderingContext2D;
  const lctx = live.getContext('2d') as CanvasRenderingContext2D;

  /** CSS px / 종이 단위 */
  let scale = 1;
  let pxW = 0;
  let pxH = 0;

  // ---- 그리기 ----

  /** dx·dy: 캔버스가 host 왼쪽 위에서 떨어진 거리(기기 픽셀) — live 캔버스는 보이는 부분에만 있어서 */
  const prep = (ctx: CanvasRenderingContext2D, dpr: number, dx = 0, dy = 0) => {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -dx, -dy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };
  let dprUsed = 1;

  const redrawCommitted = (list: readonly Stroke[]) => {
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, pxW, pxH);
    prep(cctx, dprUsed);
    // 형광펜을 먼저 — 글씨 뒤에 깔려야 글씨가 흐려지지 않는다
    for (const s of list) if (s.tool === 'highlighter') drawStroke(cctx, s);
    for (const s of list) if (s.tool !== 'highlighter') drawStroke(cctx, s);
  };

  // 지우개로 문지르는 중의 획 목록(뗄 때 한 번에 기록 → 실행 취소 한 단위)
  let working: readonly Stroke[] | null = null;
  const shown = () => working ?? history.current;

  let cur: Stroke | null = null;
  /** live 캔버스에 지난번 그린 범위(종이 좌표) — 매 프레임 캔버스 전체를 지우지 않으려고 */
  let dirty: [number, number, number, number] | null = null;
  /** live 캔버스 위치(기기 픽셀, host 기준)와 크기 */
  let liveX = 0;
  let liveY = 0;

  const clearLive = () => {
    if (!dirty) return;
    const [x0, y0, x1, y1] = dirty;
    const k = scale * dprUsed;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(x0 * k - liveX - 2, y0 * k - liveY - 2, (x1 - x0) * k + 4, (y1 - y0) * k + 4);
    dirty = null;
  };

  const drawLive = () => {
    clearLive();
    if (!cur || cur.pts.length === 0) return;
    const p = cur.pts;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 4) {
      const x = p[i] as number;
      const y = p[i + 1] as number;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    // 굵기 최대치(기본의 약 1.5배)의 절반 + 여유
    const pad = cur.base;
    dirty = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
    prep(lctx, dprUsed, liveX, liveY);
    drawStroke(lctx, cur);
  };

  /**
   * live 캔버스를 host 중 화면에 보이는 부분(스크롤 상자·창과 겹치는 곳)에 맞춘다.
   * host 가 transform:scale 로 줄어 있을 수 있어 화면 좌표를 host 레이아웃 좌표로 되돌려 쓴다.
   */
  const placeLive = (r: DOMRect) => {
    const vs = r.width / Math.max(1, host.clientWidth);
    let top = Math.max(r.top, 0);
    let left = Math.max(r.left, 0);
    let bottom = Math.min(r.bottom, window.innerHeight);
    let right = Math.min(r.right, window.innerWidth);
    const sc = scroller?.getBoundingClientRect();
    if (sc) {
      top = Math.max(top, sc.top);
      left = Math.max(left, sc.left);
      bottom = Math.min(bottom, sc.bottom);
      right = Math.min(right, sc.right);
    }
    const x = (left - r.left) / vs;
    const y = (top - r.top) / vs;
    const w = Math.max(0, right - left) / vs;
    const h = Math.max(0, bottom - top) / vs;
    const pw = Math.round(w * dprUsed);
    const ph = Math.round(h * dprUsed);
    const px = Math.round(x * dprUsed);
    const py = Math.round(y * dprUsed);
    // 같은 자리면 그대로 둔다(크기를 다시 정하면 캔버스가 지워진다)
    if (pw === live.width && ph === live.height && px === liveX && py === liveY) return;
    liveX = px;
    liveY = py;
    const ls = live.style;
    ls.left = `${px / dprUsed}px`;
    ls.top = `${py / dprUsed}px`;
    ls.width = `${pw / dprUsed}px`;
    ls.height = `${ph / dprUsed}px`;
    live.width = pw;
    live.height = ph;
    dirty = null;
  };

  const releaseLive = () => {
    clearLive();
    live.width = live.height = 0;
    live.style.width = live.style.height = '0';
  };

  // 펜 획(live)과 지우개(committed 다시 그리기)는 한 프레임에 한 번만 — 이벤트가 프레임보다 잦다
  let raf = 0;
  let needLive = false;
  let needCommitted = false;
  const schedule = (what: 'live' | 'committed') => {
    if (what === 'live') needLive = true;
    else needCommitted = true;
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (needCommitted) redrawCommitted(shown());
        if (needLive) drawLive();
        needCommitted = needLive = false;
      });
    }
  };
  /** 예약한 그리기를 버리고, committed 를 다시 그려야 했는지 돌려준다 */
  const cancelFrame = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    const was = needCommitted;
    needCommitted = needLive = false;
    return was;
  };

  // ---- 크기 ----

  const applyMinHeight = (cssW: number) => {
    // 100% 아래로는 줄이지 않는다 — 새 공책(높이 0)이나 숨긴 채 만든 쪽이 쪼그라들지 않게
    if (opts.grow) host.style.minHeight = `max(100%, ${(height * cssW) / PAPER}px)`;
  };

  const resize = () => {
    const cssW = host.clientWidth;
    if (cssW === 0) return;
    applyMinHeight(cssW);
    const cssH = host.clientHeight;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, cssW * cssH)),
    );
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    scale = cssW / PAPER;
    updateBackground();
    if (w === pxW && h === pxH) return;
    // 캔버스 크기를 바꾸면 내용이 지워지므로 그대로 다시 그린다(종이 좌표라 비율대로 커진다)
    pxW = w;
    pxH = h;
    dprUsed = dpr;
    committed.width = w;
    committed.height = h;
    redrawCommitted(shown());
    if (penDown) {
      rect = host.getBoundingClientRect();
      placeLive(rect);
      dirty = null;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, live.width, live.height);
      drawLive();
    }
  };

  let background: Background = opts.background;
  function updateBackground() {
    const s = bg.style;
    if (background === 'grid') {
      const step = GRID_STEP * scale;
      s.backgroundImage = `linear-gradient(${BG_COLOR} 1px, transparent 1px),linear-gradient(90deg, ${BG_COLOR} 1px, transparent 1px)`;
      s.backgroundSize = `${step}px ${step}px`;
    } else if (background === 'lines') {
      s.backgroundImage = `linear-gradient(transparent ${LINE_STEP * scale - 1}px, ${BG_COLOR} 1px)`;
      s.backgroundSize = `100% ${LINE_STEP * scale}px`;
    } else {
      s.backgroundImage = 'none';
    }
  }

  const grow = (y: number) => {
    if (!opts.grow || y <= height - GROW_MARGIN) return;
    while (y > height - GROW_MARGIN) height += GROW_STEP;
    // 그리는 중이라도 바로 늘려야 계속 이어 쓸 수 있다(onChange 는 획이 끝날 때 한 번)
    resize();
  };

  // ---- 펜 ----

  let penId = -1;
  let penDown = false;
  let penUpAt = Number.NEGATIVE_INFINITY;
  let rect: DOMRect | null = null;
  let scroller: HTMLElement | null = null;
  let savedOverflow: string | null = null;
  const scratch: number[] = [];

  const palmBlocked = () => penDown || performance.now() - penUpAt < PALM_MS;

  const emit = () => opts.onChange({ strokes: history.current.slice(), height });

  // 펜이 닿은 동안 스크롤 상자를 잠근다. iOS 는 펜 터치를 막아도 관성 스크롤이 남거나
  // 손바닥이 상자를 밀 수 있는데, 쓰는 중에 종이가 움직이면 획이 엉뚱한 곳에 그어진다.
  const lockScroll = () => {
    scroller = scrollParent(host);
    if (!scroller) return;
    savedOverflow = scroller.style.overflow;
    scroller.style.overflow = 'hidden';
  };
  const unlockScroll = () => {
    if (scroller && savedOverflow !== null) scroller.style.overflow = savedOverflow;
    savedOverflow = null;
  };
  // 그래도 스크롤되면(잠그기 직전의 관성 등) 쪽 위치가 바뀌었으니 다음 점에서 다시 잰다
  const onScroll = () => {
    rect = null;
  };

  const rub = (pts: number[]) => {
    const r = ERASER_RADIUS[tool.size];
    let list = working ?? history.current;
    const before = list;
    for (let i = 0; i < pts.length; i += 4) {
      list = eraseAt(list, pts[i] as number, pts[i + 1] as number, r);
    }
    working = list;
    if (list !== before) schedule('committed');
  };

  const addPoints = (e: PointerEvent) => {
    if (!rect) {
      rect = host.getBoundingClientRect();
      if (cur) placeLive(rect);
    }
    const evs = e.getCoalescedEvents?.() ?? [];
    scratch.length = 0;
    for (const ev of evs.length ? evs : [e]) pushPoint(scratch, ev, rect);
    if (cur) {
      for (let i = 0; i < scratch.length; i++) cur.pts.push(scratch[i] as number);
      let maxY = 0;
      for (let i = 1; i < scratch.length; i += 4) maxY = Math.max(maxY, scratch[i] as number);
      grow(maxY);
      schedule('live');
    } else {
      rub(scratch);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'pen' || penDown) return;
    e.preventDefault();
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
      // 이미 떨어진 포인터 등 — 캡처 없이도 host 위에서는 계속 받는다
    }
    penId = e.pointerId;
    penDown = true;
    tap.invalidate();
    lockScroll();
    rect = null;
    if (tool.kind === 'eraser') {
      cur = null;
      working = history.current;
    } else {
      const hl = tool.kind === 'highlighter';
      cur = {
        tool: hl ? 'highlighter' : 'pen',
        color: tool.color,
        base: (hl ? HIGHLIGHTER_BASE : PEN_BASE)[tool.size],
        pts: [],
      };
    }
    opts.onPenActive?.(true);
    addPoints(e);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!penDown || e.pointerId !== penId) return;
    e.preventDefault();
    addPoints(e);
  };

  /** 획 마무리: 펜을 뗐을 때, 그리고 그리는 중에 쪽이 사라질 때(destroy) */
  const finish = () => {
    penDown = false;
    penId = -1;
    penUpAt = performance.now();
    rect = null;
    const committedStale = cancelFrame();
    // pointercancel 이어도 쓴 데까지는 남긴다 — 잃는 것보다 낫다
    if (cur) {
      const s = cur;
      cur = null;
      if (s.pts.length) {
        history.commit([...history.current, s]);
        redrawCommitted(history.current);
        emit();
      }
    } else if (working) {
      const w = working;
      working = null;
      // 아무것도 안 지웠으면 기록·저장하지 않는다(빈 실행 취소 단계가 생기지 않게)
      if (w !== history.current) {
        history.commit(w);
        emit();
      }
      if (committedStale) redrawCommitted(history.current);
    }
    releaseLive();
    unlockScroll();
    opts.onPenActive?.(false);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!penDown || e.pointerId !== penId) return;
    finish();
  };
  // ---- 터치 (손가락·iOS 펜 스크롤 막기·손바닥 무시·여러 손가락 탭) ----

  const tap = createTapDetector();
  const isStylus = (t: Touch) => (t as Touch & { touchType?: string }).touchType === 'stylus';
  const fingers = (list: TouchList) => {
    const out: TouchPoint[] = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i] as Touch;
      if (!isStylus(t)) out.push({ id: t.identifier, x: t.clientX, y: t.clientY });
    }
    return out;
  };
  const hasStylus = (list: TouchList) => {
    for (let i = 0; i < list.length; i++) if (isStylus(list[i] as Touch)) return true;
    return false;
  };

  const onTouchStart = (e: TouchEvent) => {
    // iOS 는 펜도 touch 로 페이지를 스크롤하므로 펜 터치의 기본 동작을 막는다
    if (hasStylus(e.changedTouches)) {
      e.preventDefault();
      tap.invalidate();
      return;
    }
    if (palmBlocked()) {
      e.preventDefault();
      e.stopPropagation();
      tap.invalidate();
      return;
    }
    tap.down(fingers(e.changedTouches), e.timeStamp);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (hasStylus(e.changedTouches)) {
      e.preventDefault();
      return;
    }
    if (palmBlocked()) {
      e.preventDefault();
      e.stopPropagation();
      tap.invalidate();
      return;
    }
    tap.move(fingers(e.changedTouches), e.timeStamp);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.type === 'touchcancel' || palmBlocked()) tap.invalidate();
    const n = tap.up(fingers(e.touches).length, e.timeStamp);
    if (n === 2) surface.undo();
    else if (n === 3) surface.redo();
  };

  // 펜은 쓰기 전용 — 펜이 닿은 동안·뗀 직후의 클릭이 교재 버튼을 누르지 않게 한다
  const onClick = (e: MouseEvent) => {
    if (palmBlocked()) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const cap = { capture: true };
  const capActive = { capture: true, passive: false };
  host.addEventListener('pointerdown', onPointerDown, cap);
  host.addEventListener('pointermove', onPointerMove, cap);
  host.addEventListener('pointerup', onPointerUp, cap);
  host.addEventListener('pointercancel', onPointerUp, cap);
  host.addEventListener('touchstart', onTouchStart, capActive);
  host.addEventListener('touchmove', onTouchMove, capActive);
  host.addEventListener('touchend', onTouchEnd, cap);
  host.addEventListener('touchcancel', onTouchEnd, cap);
  host.addEventListener('click', onClick, cap);
  const scrollOpts = { capture: true, passive: true };
  // 스크롤 이벤트는 거품이 안 올라오지만 캡처 단계에서는 창이 모든 상자의 스크롤을 받는다
  window.addEventListener('scroll', onScroll, scrollOpts);

  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  resize();

  const afterEdit = (changed: boolean) => {
    if (!changed) return;
    redrawCommitted(shown());
    emit();
  };

  // 펜이 닿아 있는 동안의 실행 취소·지우기는 무시한다 — 그리는 획과 기록이 엉킨다
  const surface = {
    setTool(t: Tool) {
      // 그리는 중에 바뀌어도 지금 획은 그대로, 다음 획부터 적용
      tool = t;
    },
    setBackground(b: Background) {
      background = b;
      updateBackground();
    },
    undo() {
      if (!penDown) afterEdit(history.undo());
    },
    redo() {
      if (!penDown) afterEdit(history.redo());
    },
    clear() {
      if (penDown || history.current.length === 0) return;
      history.commit([]);
      afterEdit(true);
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    palmBlocked,
    resize,
    destroy() {
      // 그리던 중에 쪽이 사라져도(쪽 넘김·화면 전환) 쓴 데까지 저장하고, 펜 상태를 풀어 준다
      if (penDown) finish();
      cancelFrame();
      ro.disconnect();
      window.removeEventListener('scroll', onScroll, scrollOpts);
      host.removeEventListener('pointerdown', onPointerDown, cap);
      host.removeEventListener('pointermove', onPointerMove, cap);
      host.removeEventListener('pointerup', onPointerUp, cap);
      host.removeEventListener('pointercancel', onPointerUp, cap);
      host.removeEventListener('touchstart', onTouchStart, cap);
      host.removeEventListener('touchmove', onTouchMove, cap);
      host.removeEventListener('touchend', onTouchEnd, cap);
      host.removeEventListener('touchcancel', onTouchEnd, cap);
      host.removeEventListener('click', onClick, cap);
      // DOM 에서 떼어도 캔버스 메모리는 GC 전까지 남는다(iOS 는 캔버스 총량 한도가 있다) — 0 으로 돌려준다
      committed.width = committed.height = 0;
      live.width = live.height = 0;
      bg.remove();
      committed.remove();
      live.remove();
      host.style.position = saved.position;
      host.style.isolation = saved.isolation;
      host.style.minHeight = saved.minHeight;
    },
  };
  return surface;
};
