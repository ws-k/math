// 그릴 목록 draw: 객체를 순서대로 종류 표(kinds.ts)에 나눠 주고, 그 뒤에 과제 모드의 그릴 것을 쌓는다.
// 끄는 동안의 갱신은 draw(매개변수, 상태, 크기) → 그릴 목록 하나로 한다. 화면은 이 목록을 React 로 처음 그리고,
// 끄는 동안에는 같은 목록을 DOM 에 직접 적용한다(React 렌더 없음) — 두 갈래로 그리면 어긋난다.
import { GOAL_MAX_STATES } from '../../goal.ts';
import { fail } from '../../parse.ts';
import { placeLabels, type Rect } from '../labels.ts';
import { frame, MIN_BOX_H, NARROW_BOX_W, r1 } from './frame.ts';
import { kindOf } from './kinds.ts';
import { stairDeps, zlenBox } from './mark.ts';
import { initial } from './model.ts';
import { depStates, nameWidth } from './point.ts';
import { symText } from './stat.ts';
import { drawStrip } from './strip.ts';
import { drawTask } from './task.ts';
import type { Box, CoordParams, CoordState, DrawCtx, Drawing } from './types.ts';

/** 점 이름표(.pname 13px 굵게) 상자: 한 자 약 9px, 높이 13px. 틈은 예전 자리(점에서 오른쪽 10·위 10 기준선)와 같게 */
const LABEL = { charW: 9, h: 13, gx: 10, gy: 7, dotR: 6 };
/** 상자 윗변에서 글자 기준선까지 */
const LABEL_ASCENT = 10;

/**
 * (매개변수, 상태, 크기) → 그릴 것 전부. 화면의 처음 그리기와 끄는 동안의 직접 적용이 이 함수 하나를 쓴다.
 * 끄는 동안 항목이 생기거나 사라지면 직접 적용이 못 따라가므로, 항목은 늘 같은 key 로 두고 hidden 으로 숨긴다.
 */
export function draw(p: CoordParams, s: CoordState, box: Box): Drawing {
  return drawWith(p, s, box).d;
}

/**
 * 형식 검사(무거운 쪽): 가장 좁은 화면, 처음 자리에서 점 이름표가 그림 밖으로 나가거나, 서로 겹치거나, 다른 점을
 * 덮으면 오류. labels.ts 는 자리가 모자라면 겹치는 자리라도 고르므로(이름표를 아예 안 그리는 것보다 낫게) 그 경우를
 * 여기서 잡는다 — 여러 글자 이름(요청 19)이 생기면서 이웃 점끼리 자리를 못 나누는 장면을 만들 수 있게 되었다.
 * 맞힌 뒤에는 숨긴 목표 점과 그 이름표가 더해지므로 그 상태도 한 번 더 본다
 */
export function checkLabels(p: CoordParams): void {
  const s0 = initial(p);
  for (const [s, when] of [
    [s0, ''],
    [{ ...s0, solved: true }, '맞힌 뒤 '],
  ] as const) {
    const { rects, f, spots } = drawWith(p, s, { w: NARROW_BOX_W, h: MIN_BOX_H });
    const at = `좌표 ${when}가장 좁은 화면에서`;
    for (const [i, { r, text }] of rects.entries()) {
      if (r.l < f.l - 0.5 || r.r > f.r + 0.5 || r.t < f.t - 0.5 || r.b > f.b + 0.5)
        fail(at, `이름표 '${text}' 이 그림 밖 — 이름을 짧게 하거나 점을 안쪽으로`);
      const other = rects.slice(0, i).find((q) => hit(q.r, r));
      if (other)
        fail(at, `이름표 '${other.text}'·'${text}' 이 겹침 — 이름을 짧게 하거나 점 사이를 넓게`);
      const d = LABEL.dotR;
      if (spots.some((q) => hit(r, { l: q.x - d, t: q.y - d, r: q.x + d, b: q.y + d })))
        fail(at, `이름표 '${text}' 이 다른 점을 덮음 — 이름을 짧게 하거나 점 사이를 넓게`);
    }
  }
}

const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * 무거운 형식 검사(계단 표시 — 요청 64): 가장 좁은 화면, 계단 두 점을 움직이는 것이 닿는 상태(2000 넘으면 고르게 덜어 냄)마다
 * 길이 글자가 점 이름표·점(반지름 6)·손잡이의 보이는 점(반지름 10)·다른 길이 글자와 겹치면 오류. 그리기는 비는 자리를 고르고
 * 이름표도 길이 글자를 피하지만, 자리가 모자라면 겹치는 자리라도 고르므로(안 그리는 것보다 낫게) 그 경우를 여기서 잡는다
 */
export function checkStairs(p: CoordParams): void {
  const box = { w: NARROW_BOX_W, h: MIN_BOX_H };
  for (const [k, o] of p.objects.entries()) {
    if (o.kind !== 'stair') continue;
    for (const q of depStates(p, stairDeps(p, o), GOAL_MAX_STATES)) {
      const { d, rects, spots } = drawWith(p, q.s, box);
      const zs = d.items.flatMap((it) =>
        it.t === 'label' && it.cls === 'zlen' && !it.hidden
          ? [{ key: it.key, text: it.text, r: zlenBox(it.x, it.y, it.text) }]
          : [],
      );
      const mine = zs.filter((z) => z.key === `zx${k}` || z.key === `zy${k}`);
      const others = [
        ...rects.map((x) => ({ what: `이름표 '${x.text}'`, r: x.r })),
        ...spots.map((x) => ({
          what: '점',
          r: { l: x.x - 6, t: x.y - 6, r: x.x + 6, b: x.y + 6 },
        })),
        ...d.handles.map((h) => ({
          what: '손잡이',
          r: { l: h.x - 10, t: h.y - 10, r: h.x + 10, b: h.y + 10 },
        })),
      ];
      for (const z of mine) {
        const clash =
          others.find((x) => hit(z.r, x.r))?.what ?? zs.find((x) => x !== z && hit(z.r, x.r))?.text;
        if (clash)
          fail(
            '좌표 가장 좁은 화면에서',
            `계단 ${o.a}-${o.b} 글자 '${z.text}' 이 ${clash} 과 겹침 (${symText(q.sym) || '처음 자리'}) — 점 사이를 넓히거나 축 범위를 바꾸세요`,
          );
      }
    }
  }
}

function drawWith(p: CoordParams, s: CoordState, box: Box) {
  const f = frame(box, p);
  const cx: DrawCtx = {
    p,
    s,
    f,
    fills: [],
    shapes: [],
    items: [],
    tags: [],
    outer: [],
    box,
    handles: [],
    readouts: [],
    pins: [],
    spots: [],
    later: [],
  };
  for (const [k, o] of p.objects.entries()) kindOf(o).draw?.(o, k, cx);
  drawStrip(cx);
  drawTask(cx);
  // 이름표: 겹치지 않고 그림(잘라 내는 영역) 안에 드는 자리. 아무것도 겹치지 않으면 예전처럼 점의 오른쪽 위
  // 폭은 글자 수가 아니라 실제 폭 어림(한글은 영문보다 넓다) — labels.ts 는 '한 자 폭 × n' 으로 세므로 n 을 폭/한 자로 넘긴다
  const rects = placeLabels(
    cx.pins.map((q) => ({ x: q.x, y: q.y, n: nameWidth(q.it.text) / LABEL.charW })),
    cx.spots,
    f,
    LABEL,
  );
  cx.pins.forEach((q, i) => {
    const r = rects[i];
    if (!r) return;
    q.it.x = r1(r.l);
    q.it.y = r1(r.t + LABEL_ASCENT);
  });
  // 그다음 계단 길이 글자: 이름표와 앞서 놓은 길이 글자를 피해 자리를 고른다(mark.ts)
  const placed = [...rects];
  for (const job of cx.later) placed.push(...job(placed));
  // 층: 칠하기(격자 아래, 따로) · 조각 · 곡선·점·직선 · 글자(점 이름표 → 영역 이름표) — 객체 순서와 상관없이 곡선이
  // 조각에, 글자가 선에 가리지 않게. 점 이름표는 점과 같은 자리(items)에서 만들어지므로 여기서 글자만 맨 뒤로 뺀다 —
  // 뒤에 적은 선분이 앞 점의 이름표 위를 지나가던 것(co-foot 의 OP 가 'O' 를 가림). 나누는 기준이 항목 종류뿐이라
  // 끄는 동안에도 key 순서가 그대로다(직접 적용 apply 는 key 로 찾지만, React 가 다시 그릴 때 순서가 흔들리지 않게)
  const drawn = [...cx.shapes, ...cx.items];
  const d: Drawing = {
    fills: cx.fills,
    items: [
      ...drawn.filter((it) => it.t !== 'label'),
      ...drawn.filter((it) => it.t === 'label'),
      ...cx.tags,
    ],
    outer: cx.outer,
    handles: cx.handles,
    readouts: cx.readouts,
  };
  return {
    d,
    f,
    spots: cx.spots,
    rects: rects.map((r, i) => ({ r, text: cx.pins[i]?.it.text ?? '' })),
  };
}
