// 전체 형식 검사 parseCoord: 모드·축·슬라이더를 읽고, 객체는 종류 표(kinds.ts)로 나눠 주고,
// 객체 사이에 걸친 것(goal·task·start)을 맨 끝에 본다. 종류마다의 검사는 각 종류 파일에 있다.
import type { GridPt } from '../../grade.ts';
import { arr, fail, type Obj, obj, oneOf, str } from '../../parse.ts';
import { axis, ID, MAX_CELLS, numExpr, toIndex } from './common.ts';
import { MIN_PLOT, narrowFrame } from './frame.ts';
import { goalPoints, parseGoal } from './goal.ts';
import { KINDS } from './kinds.ts';
import { parseSliders } from './slider.ts';
import { parseTask } from './task.ts';
import type {
  CoordObj,
  CoordParams,
  CurveObj,
  FillObj,
  ParseCtx,
  PointObj,
  RectsObj,
} from './types.ts';

export function parseCoord(raw: unknown): CoordParams {
  const o = obj(
    raw,
    '좌표',
    ['mode', 'x', 'y', 'objects'],
    ['sliders', 'task', 'goal', 'intro', 'done', 'start', 'equal'],
  );
  const mode = oneOf(o.mode, '좌표 mode', [
    'explore',
    'plot',
    'line',
    'connect',
    'sketch',
  ] as const);
  const x = axis(o.x, '좌표 x');
  const y = axis(o.y, '좌표 y', true);
  if (o.equal !== undefined && o.equal !== true) fail('좌표 equal', 'true 만');
  const equal = o.equal === true;
  // 축 끝 글자 자리·축척 같게로 줄어든 가장 좁은 화면의 그림이 너무 작으면 칸·곡선을 읽을 수 없다(frame.ts MIN_PLOT)
  const nf = narrowFrame({ x, y, equal });
  const [pw, ph] = [nf.r - nf.l, nf.b - nf.t];
  if (pw < MIN_PLOT.w - 1e-9 || ph < MIN_PLOT.h - 1e-9)
    fail(
      '좌표',
      `가장 좁은 화면에서 그림이 너무 작음(${pw.toFixed(0)}×${ph.toFixed(0)}px, 가로 ${MIN_PLOT.w}·세로 ${MIN_PLOT.h}px 이상) — ${equal ? '축척 같게면 가로·세로 범위 비를 줄이거나 equal 을 빼세요' : '축 끝 글자를 짧게'}`,
    );
  if (mode !== 'explore' && mode !== 'sketch') {
    const cx = (x.hi - x.lo) / x.st;
    const cy = (y.hi - y.lo) / y.st;
    if (cx > MAX_CELLS || cy > MAX_CELLS)
      fail(
        '좌표',
        `찍기·그리기 모드는 칸이 ${MAX_CELLS}칸 이하(지금 ${cx}×${cy}) — 한 칸이 손가락보다 작아짐`,
      );
  }
  const sliders = parseSliders(o.sliders);
  const vars = ['x', ...sliders.map((s) => s.id)];
  const env0: Record<string, number> = Object.fromEntries(sliders.map((s) => [s.id, s.value]));

  const objects: CoordObj[] = [];
  const ids = new Set<string>();
  const curves = new Map<string, CurveObj>();
  const points = new Map<string, PointObj>();
  const rects = new Map<string, RectsObj>();
  const fills = new Map<string, FillObj>();
  const named = (id: unknown, at: string) => {
    const s = str(id, at);
    if (!ID.test(s)) fail(at, `이름은 영문으로 시작하는 6자 이하 (${s})`);
    if (ids.has(s)) fail(at, `이름 중복 (${s})`);
    ids.add(s);
    return s;
  };
  /** hidden=false 면 숨긴 정답을 가리킬 수 없다(다른 객체가 가리키면 숨긴 자리가 드러난다) */
  const curveRef = (hidden: boolean) => (v: unknown, at: string) => {
    const c = curves.get(str(v, at));
    if (!c) return fail(at, `앞에 없는 곡선 ${String(v)}`);
    if (c.hide && !hidden) fail(at, `숨긴 곡선 ${c.id} 은 목표·과제만 가리킬 수 있음`);
    return c;
  };
  const pointRef = (hidden: boolean) => (v: unknown, at: string) => {
    const p = points.get(str(v, at));
    if (!p) return fail(at, `앞에 없는 점 ${String(v)}`);
    if (p.hide && !hidden) fail(at, `숨긴 점 ${p.id} 은 목표만 가리킬 수 있음`);
    return p;
  };
  const base = { x, y, equal, sliders, vars, env0, curves, points, rects, fills, named };
  const ctx: ParseCtx = { ...base, curveRef: curveRef(false), pointRef: pointRef(false) };
  const goalCtx: ParseCtx = { ...base, curveRef: curveRef(true), pointRef: pointRef(true) };
  // 열쇠 이름으로 종류를 알아본다(표에 적힌 순서대로 — 앞 종류가 먼저)
  const kinds = Object.keys(KINDS) as (keyof typeof KINDS)[];
  arr(o.objects, '좌표 objects', 1, 16).forEach((ro, k) => {
    const at = `좌표 객체${k + 1}`;
    const r = (typeof ro === 'object' && ro !== null ? ro : {}) as Obj;
    const kind = kinds.find((kk) => kk in r) ?? fail(at, `${kinds.join('·')} 중 하나여야 함`);
    objects.push(KINDS[kind].parse(ro, at, ctx));
  });

  // 같은 읽는 값이 두 줄이면 화면에 같은 숫자가 겹치고, 그 읽는 값의 검산 항목 이름도 겹쳐 기준선 비교가 하나를 잃는다
  const seenRo = new Set<string>();
  for (const ob of objects) {
    if (ob.kind !== 'readout') continue;
    const key = ob.src.replace(/\s+/g, '');
    if (seenRo.has(key)) fail('좌표 objects', `같은 읽는 값이 두 번 (${ob.src})`);
    seenRo.add(key);
  }

  const p: CoordParams = {
    mode,
    x,
    y,
    ...(equal ? { equal: true as const } : {}),
    objects,
    sliders,
    ...(o.intro !== undefined ? { intro: str(o.intro, '좌표 intro') } : {}),
    ...(o.done !== undefined ? { done: str(o.done, '좌표 done') } : {}),
  };

  if (o.goal !== undefined) {
    p.goal = parseGoal(o.goal, p, goalCtx);
    p.goalPts = goalPoints(p);
  }

  if (o.task !== undefined) p.task = parseTask(o.task, p, curves);
  else if (mode !== 'explore') fail('좌표', `${mode} 모드에는 task 가 필요함`);
  // 숨긴 정답은 목표·과제를 이뤄야 드러난다 — 둘 다 없으면 끝내 그려지지 않는 객체가 된다
  const hidden = objects.find((x) => 'hide' in x && x.hide);
  if (hidden && !p.goal && !p.task)
    fail(
      '좌표',
      `숨긴 ${'id' in hidden ? hidden.id : '객체'} 가 있는데 목표(goal)·과제(task)가 없어 드러날 때가 없음`,
    );

  if (o.start !== undefined) {
    if (mode !== 'line') fail('좌표 start', 'line 모드에서만');
    const pts = arr(o.start, '좌표 start', 2, 2).map((rp, k) => {
      const [sx, sy] = arr(rp, `좌표 start${k + 1}`, 2, 2);
      return {
        i: toIndex(numExpr(sx, '좌표 start').n, x.st, '좌표 start'),
        j: toIndex(numExpr(sy, '좌표 start').n, y.st, '좌표 start'),
      };
    }) as [GridPt, GridPt];
    if (pts[0].i === pts[1].i && pts[0].j === pts[1].j) fail('좌표 start', '두 점이 같음');
    p.start = pts;
  }
  // 목표에 닿을 수 있는가(닿는 상태를 늘어놓아 앱 판정으로 확인)는 형식 검사에서만 — coordDef.deep
  return p;
}
