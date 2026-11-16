// 구분구적 직사각형 {id, rects:{of, x:[a,b], n}}: [a,b] 를 폭이 같은 n 조각으로 나눠 큰 어림·작은 어림을 함께 그리고,
// 두 합을 정확한 분수로 낸다(읽는 값 sums·big·small·gap). 검산은 닿는 모든 n 의 두 합 = sympy summation,
// 넓이 = sympy integrate(원칙 P7).
//
// 곡선은 구간 안(끝점 제외)에 기울기 0 인 곳이 없는 다항식만 받는다. 그래야 계속 오르거나 계속 내려서 조각마다
// 양 끝 높이 중 큰 쪽이 그 조각의 가장 높은 곳이라 '큰 어림 ≥ 넓이 ≥ 작은 어림'이 늘 맞는다(꺾이는 곡선이면
// 오른쪽 끝 합이 큰 어림이 아니다). 기울기 0 인 곳은 도함수의 구간 안 실근을 분수로 정확히 센다(poly.ts — 소수로
// 보면 끝점 근에서 흔들린다). x³ 처럼 멈췄다 다시 오르는 곡선도 막는다(보수적으로 — 끝점에서만 허용).
// 곡선은 구간에서 가로축 위(높이 ≥ 0)여야 한다: 음수 높이 조각은 아래로 그려져 노란 띠·초록 조각의 위아래가 뒤집힌다.
import { derivative, evalExact, exactOf, varsOf } from '../../expr.ts';
import { arr, fail, int, obj, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { add, cmp, div, mul, num, qi, ratStr, sub } from '../q.ts';
import type { WidgetCheck } from '../specs.ts';
import { numExpr } from './common.ts';
import { curveOf, fAt } from './curve.ts';
import { clampY, narrowFrame, r1, toPx } from './frame.ts';
import { polyOf, rootsBetween } from './poly.ts';
import { sliderValues } from './slider.ts';
import type { CoordParams, CoordState, KindDef, RectsObj } from './types.ts';

/**
 * 가장 좁은 화면에서 조각 하나의 최소 폭(px). 조각 테두리(1px)를 빼고도 색이 보여야 큰 어림·작은 어림을 가린다.
 * 밭(가로 30 m 를 30조각, 축척 같게)이 5px 이라 그보다 조금 여유를 둔 값.
 */
export const MIN_RECT_PX = 4;
/** 조각이 이보다 좁으면 테두리를 가늘게(thin) — 테두리가 조각을 덮지 않게 */
const THIN_PX = 8;

const Z: Rational = [0n, 1n];

export const rectsOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is RectsObj => o.kind === 'rects' && o.id === id) as RectsObj;

/** 지금 조각 수 */
export const countOf = (o: RectsObj, s: CoordState) =>
  'count' in o.n ? o.n.count : (s.vars[o.n.slider] ?? Number.NaN);

/** 조각 수 n 일 때 두 합(정확한 분수). 곡선이 어느 끝에서 정의되지 않으면 null */
export function sumsAt(
  p: CoordParams,
  o: RectsObj,
  n: number,
): { big: Rational; small: Rational } | null {
  if (!Number.isInteger(n) || n < 1) return null;
  const node = curveOf(p, o.of).node;
  const dx = div(sub(o.b, o.a), qi(n));
  let left = Z;
  let right = Z;
  for (let k = 0; k <= n; k++) {
    const v = evalExact(node, { x: add(o.a, mul(qi(k), dx)) });
    if (!v) return null;
    if (k < n) left = add(left, v);
    if (k > 0) right = add(right, v);
  }
  const L = mul(left, dx);
  const R = mul(right, dx);
  return o.rising ? { big: R, small: L } : { big: L, small: R };
}

export const sums = (p: CoordParams, s: CoordState, o: RectsObj) => sumsAt(p, o, countOf(o, s));

/** 검산용 sympy 글자. 조각 수는 슬라이더 이름(목표 판정 상태가 값을 넣는다) 또는 수. 더하는 번호는 u — 슬라이더 이름(a~t)과 겹치지 않게 */
export function sumSym(p: CoordParams, o: RectsObj, which: 'big' | 'small' | 'gap', n: string) {
  const dx = `((${o.to})-(${o.from}))/(${n})`;
  const term = `(${curveOf(p, o.of).expr}).subs(x,(${o.from})+u*${dx})*${dx}`;
  const right = `summation(${term},(u,1,${n}))`;
  const left = `summation(${term},(u,0,(${n})-1))`;
  const [big, small] = o.rising ? [right, left] : [left, right];
  if (which === 'big') return big;
  if (which === 'small') return small;
  return `(${big})-(${small})`;
}

/** [a,b] 에서의 정적분(정확한 분수) — 다항식의 부정적분으로 */
function integral(p: CoordParams, o: RectsObj): Rational | null {
  const c = polyOf(curveOf(p, o.of).node, {});
  if (!c) return null;
  const anti = (x: Rational) =>
    c.reduce<Rational>((acc, ck, i) => {
      let xp: Rational = [1n, 1n];
      for (let j = 0; j <= i; j++) xp = mul(xp, x);
      return add(acc, div(mul(ck, xp), qi(i + 1)));
    }, Z);
  return sub(anti(o.b), anti(o.a));
}

export const rectsKind: KindDef<RectsObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['id', 'rects']);
    const id = cx.named(c.id, `${at} id`);
    const r = obj(c.rects, `${at} rects`, ['of', 'x', 'n']);
    const cv = cx.curveRef(r.of, `${at} of`);
    if ([...varsOf(cv.node)].some((v) => v !== 'x'))
      fail(`${at} of`, '구분구적 곡선에는 슬라이더를 쓰지 않음(슬라이더는 조각 수 n 만)');
    const poly = polyOf(cv.node, {});
    if (!poly)
      fail(`${at} of`, `곡선 ${cv.id} 이 x 의 다항식이 아님 — 계속 오르는지 정확히 볼 수 없음`);
    const [ra, rb] = arr(r.x, `${at} rects.x`, 2, 2);
    const A = numExpr(ra, `${at} rects.x`);
    const B = numExpr(rb, `${at} rects.x`);
    const a = exactOf(A.src);
    const b = exactOf(B.src);
    if (!a || !b)
      return fail(`${at} rects.x`, '구간 끝은 유리수(두 합을 분수로 정확히 계산하려고)');
    if (cmp(b, a) <= 0) fail(`${at} rects.x`, '끝이 시작보다 커야 함');
    if (A.n < cx.x.lo - 1e-9 || B.n > cx.x.hi + 1e-9) fail(`${at} rects.x`, '화면 밖');
    const dpoly = polyOf(derivative(cv.node, 'x'), {});
    if (!dpoly)
      return fail(
        `${at} of`,
        `곡선 ${cv.id} 의 도함수를 다항식으로 읽지 못함 — 기울기 0 인 곳을 셀 수 없음`,
      );
    // 도함수가 0 다항식(곡선이 상수)이면 null — 모든 조각 높이가 같아 큰·작은 어림이 같다(괜찮음)
    const turns = rootsBetween(dpoly, a, b);
    if (turns)
      fail(
        `${at} of`,
        `곡선 ${cv.id} 의 기울기가 0 인 곳이 구간 안에 ${turns}곳(${A.src}~${B.src}, 끝점 제외) — 기울기 0 은 끝점에서만 허용(그래야 조각의 양 끝 높이가 큰 어림·작은 어림임이 보장됨)`,
      );
    const fa = evalExact(cv.node, { x: a });
    const fb = evalExact(cv.node, { x: b });
    if (!fa || !fb) return fail(`${at} rects.x`, '곡선이 구간 끝에서 정의되지 않음');
    // 계속 오르거나 내리므로 구간의 가장 낮은 높이는 양 끝 중 하나
    if (cmp(fa, Z) < 0 || cmp(fb, Z) < 0)
      fail(
        `${at} of`,
        `곡선 ${cv.id} 이 ${A.src}~${B.src} 에서 가로축 아래로 내려감 — 높이가 음수인 조각은 아래로 그려져 큰·작은 어림 색 띠가 뒤집힘(구간을 곡선이 0 이상인 곳으로)`,
      );

    // 조각 수: 1 이상의 정수만 닿는 슬라이더, 또는 고정 수
    let n: RectsObj['n'];
    let nMax: number;
    if (typeof r.n === 'number') {
      nMax = int(r.n, `${at} rects.n`, 1, 200);
      n = { count: nMax };
    } else {
      const sid = str(r.n, `${at} rects.n`);
      const sl = cx.sliders.find((x) => x.id === sid);
      if (!sl) return fail(`${at} rects.n`, `없는 슬라이더 ${sid}`);
      const vs = sliderValues(sl).map((x) => x.v);
      if (vs.some((v) => !Number.isInteger(v) || v < 1))
        fail(`${at} rects.n`, `슬라이더 ${sid} 가 1 이상의 정수만 닿아야 함(조각 수)`);
      nMax = Math.max(...vs);
      n = { slider: sid };
    }
    // 가장 좁은 화면(접은 화면의 상자 폭, 가장 낮은 상자 높이)에서 n 이 가장 클 때의 조각 폭
    const f0 = narrowFrame(cx);
    const px = ((B.n - A.n) / nMax) * ((f0.r - f0.l) / (cx.x.hi - cx.x.lo));
    if (px < MIN_RECT_PX)
      fail(
        `${at} rects.n`,
        `가장 좁은 화면에서 n=${nMax} 의 조각 폭이 ${px.toFixed(1)}px — ${MIN_RECT_PX}px 보다 좁으면 테두리에 가려 색이 안 보임(조각 수를 줄이거나 구간을 넓게)`,
      );
    const o: RectsObj = {
      kind: 'rects',
      id,
      of: cv.id,
      from: A.src,
      to: B.src,
      a,
      b,
      n,
      rising: cmp(fb, fa) >= 0,
    };
    cx.rects.set(id, o);
    return o;
  },
  draw(o, k, { p, s, f, shapes }) {
    const n = countOf(o, s);
    const lo = num(o.a);
    const hi = num(o.b);
    const [, Y0] = toPx(p, f, lo, 0);
    let big = '';
    let small = '';
    let wPx = 0;
    if (Number.isInteger(n) && n >= 1) {
      const dx = (hi - lo) / n;
      const hs = Array.from({ length: n + 1 }, (_, i) => fAt(p, s, o.of, lo + i * dx));
      const rect = (i: number, h: number) => {
        if (!Number.isFinite(h) || h === 0) return '';
        const [X0] = toPx(p, f, lo + i * dx, 0);
        const [X1, Yh] = toPx(p, f, lo + (i + 1) * dx, h);
        wPx = X1 - X0;
        return `M${r1(X0)} ${r1(clampY(f, Y0))}V${r1(clampY(f, Yh))}H${r1(X1)}V${r1(clampY(f, Y0))}Z`;
      };
      for (let i = 0; i < n; i++) {
        const l = hs[i] as number;
        const r = hs[i + 1] as number;
        big += rect(i, o.rising ? r : l);
        small += rect(i, o.rising ? l : r);
      }
    }
    const thin = wPx > 0 && wPx < THIN_PX ? ' thin' : '';
    // 큰 어림을 먼저(아래), 작은 어림을 위에 — 위로 삐져나온 노란 띠가 곧 두 어림의 차이
    shapes.push({ t: 'path', key: `rb${k}`, d: big, cls: `rect big${thin}` });
    shapes.push({ t: 'path', key: `rs${k}`, d: small, cls: `rect small${thin}` });
  },
  checks(o, { p, out }) {
    const sl =
      'slider' in o.n ? p.sliders.find((x) => 'slider' in o.n && x.id === o.n.slider) : null;
    const ns = sl ? sliderValues(sl).map((x) => x.v) : 'count' in o.n ? [o.n.count] : [];
    const items: WidgetCheck[] = [];
    const smalls: string[] = [];
    const bigs: string[] = [];
    for (const n of ns) {
      const v = sumsAt(p, o, n);
      if (!v) continue;
      smalls.push(`(${ratStr(v.small)})`);
      bigs.push(`(${ratStr(v.big)})`);
      for (const which of ['big', 'small'] as const)
        items.push({
          name: `조각 ${o.id} ${which === 'big' ? '큰' : '작은'} 어림 n=${n}`,
          answer: ratStr(v[which]),
          answerType: 'fraction',
          check: sumSym(p, o, which, String(n)),
        });
    }
    const integ = `integrate(${curveOf(p, o.of).expr},(x,${o.from},${o.to}))`;
    const area = integral(p, o);
    if (area)
      items.push({
        name: `조각 ${o.id} 넓이`,
        answer: ratStr(area),
        answerType: 'fraction',
        check: integ,
      });
    // 큰·작은 배정(rising)의 독립 검증(원칙 P7): 위 항목은 sympy 도 앱과 같은 배정으로 더해 배정이 틀려도 함께 맞는다.
    // 그래서 앱이 낸 두 어림 값을 그대로 적고, 넓이는 sympy 가 따로 적분해 닿는 모든 n 에서 작은 ≤ 넓이 ≤ 큰 인지 본다
    // (모든 n 의 작은 어림 ≤ 넓이 ⇔ 그 가장 큰 값 ≤ 넓이 — 적분을 두 번만 하려고 Max·Min 으로 묶는다)
    if (smalls.length)
      items.push({
        name: `조각 ${o.id} 작은 어림 ≤ 넓이 ≤ 큰 어림(닿는 n ${smalls.length}개)`,
        answer: '1',
        answerType: 'int',
        check: `Piecewise((1,(Max(${smalls.join(',')})<=${integ})&(${integ}<=Min(${bigs.join(',')}))),(0,True))`,
      });
    out.push(...items);
  },
};
