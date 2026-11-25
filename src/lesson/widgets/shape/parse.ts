// 형식 검사(매개변수 읽기). 틀린 칸은 fail 로 어디가 왜 틀렸는지 알린다.
import { type GoalShape, goalNum, needHint, parseGoalShape } from '../../goal.ts';
import { arr, fail, int, obj, optStr, str } from '../../parse.ts';
import { isDerived, parseDerived, parseRange } from './derive.ts';
import { goalMovers } from './goal.ts';
import { cutArea, measureKey, measureKind, measureName, shoelace, sub } from './measure.ts';
import { gcd, P, shInit } from './model.ts';
import { parsePieces } from './piece.ts';
import { CIRCLE_STEP, type ShapeParams, type ShIs, type ShMeasure, type ShPoint } from './types.ts';

// 대문자 한 자, 뒤에 ′ 하나까지(F′ — 옮긴 점·대칭점을 교과서처럼 부르려고)
const ID = /^[A-Z]′?$/;

export function parseShape(raw: unknown): ShapeParams {
  const o = obj(
    raw,
    '도형판',
    ['grid', 'points'],
    [
      'polygons',
      'circles',
      'segments',
      'measures',
      'digits',
      'cut',
      'pieces',
      'outline',
      'note',
      'goal',
      'done',
    ],
  );
  const g = obj(o.grid, '도형판 grid', ['w', 'h']);
  const grid = { w: int(g.w, '도형판 grid.w', 2, 16), h: int(g.h, '도형판 grid.h', 2, 12) };
  const ids = new Set<string>();
  const need = (id: unknown, at: string) => {
    const v = str(id, at);
    if (!ids.has(v)) fail(at, `없는 점 ${v}`);
    return v;
  };
  const prev = new Map<string, ShPoint>();
  const points: ShPoint[] = arr(o.points, '도형판 points', o.pieces === undefined ? 1 : 0, 10).map(
    (rp, i) => {
      const at = `도형판 점${i + 1}`;
      const x = obj(
        rp,
        at,
        ['id'],
        ['x', 'y', 'deg', 'drag', 'on', 'aux', 'foot', 'follow', 'mirror', 'range'],
      );
      const id = str(x.id, `${at} id`);
      if (!ID.test(id)) fail(`${at} id`, '대문자 한 글자(뒤에 ′ 하나까지)');
      if (ids.has(id)) fail(`${at} id`, `중복 (${id})`);
      if (x.drag !== undefined && typeof x.drag !== 'boolean') fail(`${at} drag`, 'true/false 만');
      const pt: ShPoint = { id, drag: x.drag === true };
      if (x.follow !== undefined || x.mirror !== undefined) {
        parseDerived(x, pt, at, grid, need, prev);
        ids.add(id);
        prev.set(id, pt);
        return pt;
      }
      if (x.foot !== undefined) {
        // 발은 자리를 늘 계산하는 점 — 자리·끌기·제약을 적으면 계산한 자리와 어긋난다
        const bad = ['x', 'y', 'deg', 'drag', 'on', 'aux', 'range'].find((k) => x[k] !== undefined);
        if (bad) fail(`${at} foot`, `수선의 발에는 ${bad} 를 적지 않음(자리는 계산함)`);
        const f = obj(x.foot, `${at} foot`, ['from', 'line']);
        const from = need(f.from, `${at} foot.from`);
        const line = arr(f.line, `${at} foot.line`, 2, 2).map((v, j) =>
          need(v, `${at} foot.line${j + 1}`),
        ) as [string, string];
        if (isDerived(prev.get(from)))
          fail(`${at} foot.from`, '발은 계산되는 점(발·따라오는 점·마주 보는 점)에서 내리지 않음');
        // 직선을 고정해 두면 발은 내린 점 하나만 따라간다(검산이 늘어놓는 상태도 그 점의 자리뿐)
        const [a, b] = line.map((v) => prev.get(v) as ShPoint);
        for (const e of [a, b])
          if (e?.drag || e?.on || isDerived(e))
            fail(`${at} foot.line`, `직선 위 점 ${e?.id} 은 고정된 격자점이어야 함`);
        if (a?.x === b?.x && a?.y === b?.y) fail(`${at} foot.line`, '직선의 두 점이 같은 자리');
        pt.foot = { from, line };
        ids.add(id);
        prev.set(id, pt);
        return pt;
      }
      if (x.aux !== undefined) {
        if (x.aux !== true) fail(`${at} aux`, 'true 만');
        if (pt.drag || x.on !== undefined) fail(`${at} aux`, '보조점은 고정 점(끌기·제약 없음)');
        pt.aux = true;
      }
      if (x.on !== undefined) {
        const on = obj(x.on, `${at} on`, [], ['seg', 'circle']);
        if (on.seg !== undefined) {
          const sg = arr(on.seg, `${at} on.seg`, 2, 2).map((v, j) =>
            need(v, `${at} on.seg${j + 1}`),
          );
          pt.on = { seg: [sg[0] as string, sg[1] as string] };
        } else if (on.circle !== undefined) {
          const c = arr(on.circle, `${at} on.circle`, 2, 2);
          pt.on = { circle: [need(c[0], `${at} 원 중심`), int(c[1], `${at} 반지름`, 1, 12)] };
        } else fail(`${at} on`, 'seg 나 circle 이 필요');
      }
      if (pt.on && 'circle' in pt.on) {
        const deg = int(x.deg, `${at} deg`, 0, 345);
        if (deg % CIRCLE_STEP) fail(`${at} deg`, `${CIRCLE_STEP}의 배수가 아님`);
        pt.deg = deg;
      } else {
        const cx = int(x.x, `${at} x`, -99, 99);
        const cy = int(x.y, `${at} y`, -99, 99);
        if (cx < 0 || cx > grid.w || cy < 0 || cy > grid.h) fail(at, `격자 밖 (${cx}, ${cy})`);
        pt.x = cx;
        pt.y = cy;
        if (x.deg !== undefined) fail(`${at} deg`, '원 위 점에만');
      }
      if (x.range !== undefined) pt.range = parseRange(x.range, pt, at, grid);
      ids.add(id);
      prev.set(id, pt);
      return pt;
    },
  );
  const p: ShapeParams = {
    grid,
    points,
    polygons: (o.polygons === undefined ? [] : arr(o.polygons, '도형판 polygons', 0, 4)).map(
      (pl, i) =>
        arr(pl, `도형판 다각형${i + 1}`, 3, 8).map((v, j) =>
          need(v, `도형판 다각형${i + 1} 점${j + 1}`),
        ),
    ),
    circles: (o.circles === undefined ? [] : arr(o.circles, '도형판 circles', 0, 3)).map(
      (rc, i) => {
        const c = obj(rc, `도형판 원${i + 1}`, ['c', 'r']);
        return { c: need(c.c, `도형판 원${i + 1} c`), r: int(c.r, `도형판 원${i + 1} r`, 1, 12) };
      },
    ),
    segments: (o.segments === undefined ? [] : arr(o.segments, '도형판 segments', 0, 8)).map(
      (rs, i) => {
        const sg = arr(rs, `도형판 선분${i + 1}`, 2, 2).map((v, j) =>
          need(v, `도형판 선분${i + 1} 점${j + 1}`),
        );
        return [sg[0], sg[1]] as [string, string];
      },
    ),
    measures: [],
    digits: o.digits === undefined ? 1 : int(o.digits, '도형판 digits', 0, 3),
  };
  const note = optStr(o.note, '도형판 note');
  if (note !== undefined) p.note = note;
  const done = optStr(o.done, '도형판 done');
  if (done !== undefined) p.done = done;
  // 차례로 읽는다 — 합·차·비는 앞에서 읽은 측정값만 가리킨다(순환이 생기지 않게)
  const rawMeasures = o.measures === undefined ? [] : arr(o.measures, '도형판 measures', 0, 6);
  rawMeasures.forEach((rm, i) => {
    const at = `도형판 측정${i + 1}`;
    const keys = ['len', 'angle', 'area', 'sum', 'diff', 'ratio'];
    const m = obj(rm, at, [], keys);
    // 열쇠가 둘이면 앞의 것만 읽혀 나머지가 소리 없이 버려진다
    if (keys.filter((k) => m[k] !== undefined).length !== 1)
      fail(at, `${keys.join('·')} 중 하나만`);
    const combo = (['sum', 'diff', 'ratio'] as const).find((k) => m[k] !== undefined);
    if (m.len !== undefined) {
      const l = arr(m.len, `${at} len`, 2, 2).map((v) => need(v, `${at} len`));
      p.measures.push({ len: [l[0], l[1]] as [string, string] });
    } else if (m.angle !== undefined) {
      const l = arr(m.angle, `${at} angle`, 3, 3).map((v) => need(v, `${at} angle`));
      p.measures.push({ angle: [l[0], l[1], l[2]] as [string, string, string] });
    } else if (combo) {
      const n = combo === 'sum' ? 4 : 2;
      const ops = arr(m[combo], `${at} ${combo}`, 2, n).map((v, j) => {
        const w = `${at} ${combo}${j + 1}`;
        if (i === 0) fail(w, '앞 측정값이 없음(묶을 측정값을 먼저 적으세요)');
        const k = int(v, w, 0, i - 1);
        const t = p.measures[k] as ShMeasure;
        if (!('len' in t || 'angle' in t))
          fail(w, '길이·각 측정값만 묶음(묶은 값·넓이는 다시 묶지 않음)');
        return k;
      });
      // PF + PF·|PF − FP|·PF ÷ PF 는 늘 2PF·0·1 — 끌어서 볼 것이 없다
      const ks = ops.map((k) => measureKey(p, p.measures[k] as ShMeasure));
      const dup = ks.findIndex((k, j) => ks.indexOf(k) !== j);
      if (dup >= 0)
        fail(
          at,
          `같은 측정값을 두 번 묶음 (${measureName(p, p.measures[ops[dup] as number] as ShMeasure)})`,
        );
      const kinds = new Set(ops.map((k) => measureKind(p, p.measures[k] as ShMeasure)));
      if (kinds.size > 1) fail(at, '길이는 길이끼리, 각은 각끼리 묶음');
      if (combo === 'ratio' && !kinds.has('len')) fail(at, '비는 길이끼리만');
      p.measures.push(
        combo === 'sum'
          ? { sum: ops }
          : combo === 'diff'
            ? { diff: ops as [number, number] }
            : { ratio: ops as [number, number] },
      );
    } else p.measures.push({ area: int(m.area, `${at} area`, 0, p.polygons.length - 1) });
  });
  // 보조점은 선분 위 점의 끝·선분 끝·수선의 발 직선으로만 — 다각형 꼭짓점·측정·원에 쓰면 보이지 않는 점을 읽게 된다
  const aux = new Set(points.filter((x) => x.aux).map((x) => x.id));
  const noAux = (ids: string[], what: string) => {
    const a = ids.find((id) => aux.has(id));
    if (a) fail(`도형판 ${what}`, `보조점 ${a} 은 선분 끝으로만 씀(그림에 안 보임)`);
  };
  p.polygons.forEach((pl, i) => {
    noAux(pl, `다각형${i + 1}`);
  });
  p.measures.forEach((m, i) => {
    // 묶은 값은 항들이 이미 검사됨
    if ('len' in m || 'angle' in m) noAux('len' in m ? m.len : m.angle, `측정${i + 1}`);
  });
  p.circles.forEach((c, i) => {
    noAux([c.c], `원${i + 1}`);
  });
  for (const pt of points) if (pt.on && 'circle' in pt.on) noAux([pt.on.circle[0]], `${pt.id}`);
  for (const pt of points)
    if (pt.on && 'seg' in pt.on) {
      const [a, b] = pt.on.seg.map((id) => points.find((x) => x.id === id) as ShPoint);
      if (a?.drag || b?.drag || a?.on || b?.on || isDerived(a) || isDerived(b))
        fail(`도형판 ${pt.id}`, '선분 끝점은 고정된 격자점이어야 함');
      if (gcd((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0)) < 2)
        fail(`도형판 ${pt.id}`, '선분 위 격자점이 양끝뿐이라 움직일 곳이 없음');
    } else if (pt.on && 'circle' in pt.on) {
      const c = points.find((x) => x.id === (pt.on as { circle: [string, number] }).circle[0]);
      if (c?.drag || c?.on || isDerived(c))
        fail(`도형판 ${pt.id}`, '원 중심은 고정된 격자점이어야 함');
    }
  if (o.cut !== undefined) {
    if (o.pieces !== undefined)
      fail('도형판 pieces', 'pieces 와 cut 중 하나만(cut 은 조각 하나 옮기기)');
    const c = obj(o.cut, '도형판 cut', ['piece', 'rest', 'by', 'result']);
    if (points.some((x) => x.drag || x.on))
      fail('도형판 cut', '잘라 옮기기에는 끄는 점·제약 점을 두지 않음');
    if (!p.polygons.length) fail('도형판 cut', '잘라 낼 다각형(polygons 첫째)이 있어야 함');
    const ids2 = (v: unknown, at: string) =>
      arr(v, at, 3, 8).map((x, j) => need(x, `${at}${j + 1}`));
    const by = arr(c.by, '도형판 cut.by', 2, 2).map((v, j) =>
      int(v, `도형판 cut.by${j + 1}`, -16, 16),
    );
    const result = arr(c.result, '도형판 cut.result', 3, 8).map((rv, j) => {
      const v = arr(rv, `도형판 결과 점${j + 1}`, 2, 2);
      return [
        int(v[0], `도형판 결과 점${j + 1} x`, 0, grid.w),
        int(v[1], `도형판 결과 점${j + 1} y`, 0, grid.h),
      ] as [number, number];
    });
    p.cut = {
      piece: ids2(c.piece, '도형판 조각 점'),
      rest: ids2(c.rest, '도형판 나머지 점'),
      by: [by[0] as number, by[1] as number],
      result,
    };
    if (p.cut.by[0] === 0 && p.cut.by[1] === 0) fail('도형판 cut.by', '옮기는 거리가 0');
    const s = shInit(p);
    const whole = shoelace((p.polygons[0] as string[]).map((id) => P(s, id)));
    const parts = cutArea(s, p.cut.rest) + cutArea(s, p.cut.piece);
    const res = shoelace(result.map(([x, y]) => ({ x, y })));
    if (Math.abs(whole - parts) > 1e-9) fail('도형판 cut', '조각+나머지 넓이가 처음 넓이와 다름');
    if (Math.abs(whole - res) > 1e-9)
      fail('도형판 cut.result', '결과 모양의 넓이가 처음 넓이와 다름');
  }
  if (o.pieces !== undefined) {
    // 조각을 목표 자리에 채우는 것이 이 장면의 목표 — 다른 목표·끄는 점이 같이 있으면 무엇을 하면 끝인지 흐려진다
    if (o.goal !== undefined)
      fail('도형판 pieces', '조각을 채우는 것이 목표 — goal 을 따로 두지 않음');
    if (points.some((x) => x.drag)) fail('도형판 pieces', '조각 옮기기에는 끄는 점을 두지 않음');
    parsePieces(o.pieces, o.outline, p);
  } else if (o.outline !== undefined) fail('도형판 outline', '조각(pieces)이 있을 때만');
  if (o.goal !== undefined) {
    const at = '도형판 goal';
    if (p.cut) fail(at, '잘라 옮기기는 조각을 제자리에 옮기는 것이 목표 — 따로 두지 않음');
    const of = (v: unknown, w: string) => int(v, w, 0, p.measures.length - 1);
    const { shape, common } = parseGoalShape<number, ShIs>(o.goal, at, {
      of,
      // 수면 목표값, { of: 번호 } 면 그 측정값과 견준다(PF = PH, AD÷AB = AE÷AC)
      is: (v, w) =>
        typeof v === 'object' && v !== null && !Array.isArray(v)
          ? { of: of(obj(v, w, ['of']).of, `${w}.of`) }
          : { num: goalNum(v, w) },
      num: goalNum,
      isNum: (i) => ('num' in i ? i.num : null),
    });
    needHint(common, at);
    const g = { ...(shape as GoalShape<number, ShIs>), ...common };
    if (g.kind === 'value' && 'of' in g.is) {
      // 번호가 달라도 내용이 같으면(PF 와 FP, ∠FPG 와 ∠GPF) 어디서나 맞아 한 번 만지면 끝난다
      if (measureKey(p, sub(p, g.of)) === measureKey(p, sub(p, g.is.of)))
        fail(`${at} value.is`, '같은 측정값끼리는 늘 같음');
      if (measureKind(p, sub(p, g.of)) !== measureKind(p, sub(p, g.is.of)))
        fail(`${at} value.is`, '같은 종류의 측정값끼리만 견줌(길이는 길이, 각은 각)');
    }
    if (!goalMovers(p, g).length) fail(at, '그 측정값을 바꾸는 끄는 점이 없음');
    p.goal = g;
  } else if (o.done !== undefined && !p.pieces)
    fail('도형판 done', '목표(goal)나 조각(pieces)이 있을 때만');
  return p;
}
