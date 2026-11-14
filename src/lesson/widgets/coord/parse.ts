// 전체 형식 검사 parseCoord: 모드·축·슬라이더를 읽고, 객체는 종류 표(kinds.ts)로 나눠 주고,
// 객체 사이에 걸친 것(goal·task·start)을 맨 끝에 본다. 종류마다의 검사는 각 종류 파일에 있다.
import type { GridPt } from '../../grade.ts';
import { arr, fail, type Obj, obj, oneOf, str } from '../../parse.ts';
import { axis, ID, MAX_CELLS, near, numExpr, toIndex } from './common.ts';
import { KINDS } from './kinds.ts';
import { worldX } from './point.ts';
import { parseTask } from './task.ts';
import type { CoordObj, CoordParams, CurveObj, ParseCtx, PointObj, Slider } from './types.ts';

export function parseCoord(raw: unknown): CoordParams {
  const o = obj(
    raw,
    '좌표',
    ['mode', 'x', 'y', 'objects'],
    ['sliders', 'task', 'goal', 'intro', 'done', 'start'],
  );
  const mode = oneOf(o.mode, '좌표 mode', [
    'explore',
    'plot',
    'line',
    'connect',
    'sketch',
  ] as const);
  const x = axis(o.x, '좌표 x');
  const y = axis(o.y, '좌표 y');
  if (mode !== 'explore' && mode !== 'sketch') {
    const cx = (x.hi - x.lo) / x.st;
    const cy = (y.hi - y.lo) / y.st;
    if (cx > MAX_CELLS || cy > MAX_CELLS)
      fail(
        '좌표',
        `찍기·그리기 모드는 칸이 ${MAX_CELLS}칸 이하(지금 ${cx}×${cy}) — 한 칸이 손가락보다 작아짐`,
      );
  }
  const sliders: Slider[] = (
    o.sliders === undefined ? [] : arr(o.sliders, '좌표 sliders', 1, 3)
  ).map((rs, k) => {
    const at = `좌표 슬라이더${k + 1}`;
    const s = obj(rs, at, ['id', 'min', 'max', 'step', 'value', 'label']);
    const id = str(s.id, `${at} id`);
    if (!/^[abcdhkmnpqrst]$/.test(id))
      fail(`${at} id`, '식에 쓸 수 있는 한 글자(a·b·c·d·h·k·m·n·p·q·r·s·t)');
    const min = numExpr(s.min, `${at} min`).n;
    const max = numExpr(s.max, `${at} max`).n;
    const step = numExpr(s.step, `${at} step`);
    const value = numExpr(s.value, `${at} value`).n;
    if (!(max > min) || value < min || value > max) fail(at, '범위가 이상함');
    toIndex(value - min, step.n, `${at} value`);
    return {
      id,
      min,
      max,
      step: step.n,
      stepSrc: step.src,
      value,
      label: str(s.label, `${at} label`),
    };
  });
  const vars = ['x', ...sliders.map((s) => s.id)];
  const env0: Record<string, number> = Object.fromEntries(sliders.map((s) => [s.id, s.value]));

  const objects: CoordObj[] = [];
  const ids = new Set<string>();
  const curves = new Map<string, CurveObj>();
  const points = new Map<string, PointObj>();
  const named = (id: unknown, at: string) => {
    const s = str(id, at);
    if (!ID.test(s)) fail(at, `이름은 영문으로 시작하는 6자 이하 (${s})`);
    if (ids.has(s)) fail(at, `이름 중복 (${s})`);
    ids.add(s);
    return s;
  };
  const curveRef = (v: unknown, at: string) => {
    const c = curves.get(str(v, at));
    if (!c) return fail(at, `앞에 없는 곡선 ${String(v)}`);
    return c;
  };
  const pointRef = (v: unknown, at: string) => {
    const p = points.get(str(v, at));
    if (!p) return fail(at, `앞에 없는 점 ${String(v)}`);
    return p;
  };
  const ctx: ParseCtx = { x, y, sliders, vars, env0, curves, points, named, curveRef, pointRef };
  // 열쇠 이름으로 종류를 알아본다(표에 적힌 순서대로 — 앞 종류가 먼저)
  const kinds = Object.keys(KINDS) as (keyof typeof KINDS)[];
  arr(o.objects, '좌표 objects', 1, 16).forEach((ro, k) => {
    const at = `좌표 객체${k + 1}`;
    const r = (typeof ro === 'object' && ro !== null ? ro : {}) as Obj;
    const kind = kinds.find((kk) => kk in r) ?? fail(at, `${kinds.join('·')} 중 하나여야 함`);
    objects.push(KINDS[kind].parse(ro, at, ctx));
  });

  const p: CoordParams = {
    mode,
    x,
    y,
    objects,
    sliders,
    ...(o.intro !== undefined ? { intro: str(o.intro, '좌표 intro') } : {}),
    ...(o.done !== undefined ? { done: str(o.done, '좌표 done') } : {}),
  };

  if (o.goal !== undefined) {
    if (mode !== 'explore') fail('좌표 goal', 'explore 모드에서만(다른 모드는 task)');
    const g = obj(o.goal, '좌표 goal', ['approach'], ['within']);
    const [a, b] = arr(g.approach, '좌표 goal.approach', 2, 2);
    const pa = pointRef(a, '좌표 goal');
    const pb = pointRef(b, '좌표 goal');
    if (pa.drag === 'none') fail('좌표 goal', `${pa.id} 는 끌 수 없는 점`);
    const within = g.within === undefined ? 0 : numExpr(g.within, '좌표 goal.within').n;
    p.goal = { approach: [pa.id, pb.id], within };
    // 끄는 간격으로 닿을 수 있는 목표인가(겹쳐야 하면 b 의 x 가 a 의 끄는 칸 위에 있어야)
    const xb = worldX(p, pb, pb.i);
    const k = (xb - 0) / pa.snapN;
    if (within === 0 && !near(Math.round(k) * pa.snapN, xb))
      fail('좌표 goal', `${pa.id} 를 끌어서는 ${pb.id} 에 닿을 수 없음(끄는 간격)`);
  }

  if (o.task !== undefined) p.task = parseTask(o.task, p, curves);
  else if (mode !== 'explore') fail('좌표', `${mode} 모드에는 task 가 필요함`);

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
  return p;
}
