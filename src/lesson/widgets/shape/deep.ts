// 닿는 자리를 모두 늘어놓는 형식 검사(수선의 발이 그린 직선 위인가·같아 보이는데 목표가 아닌 자리). 장면을 열 때는 건너뛴다.
import { checkHitTable, checkNotAtStart, growStates } from '../../goal.ts';
import { fail } from '../../parse.ts';
import { r2 } from '../draw.ts';
import { dependsOn } from './derive.ts';
import { goalMovers, goalStates, goalTable, moverOptions, shGoalHits, shGoalNeed } from './goal.ts';
import { dist, measureName, measureValue, round, sub } from './measure.ts';
import { P, shInit } from './model.ts';
import type { ShapeParams, ShGoal, ShMeasure, ShPoint, ShState } from './types.ts';

/**
 * 형식 검사: 수선의 발은 그린 직선(선분·다각형의 변) 위에만 놓여야 한다 — 내린 점이 닿는 모든 자리에서(목표가 없어도).
 * 발은 무한 직선 위로 계산되므로 직선 끝점이 격자 가장자리에 있지 않으면 발이 그린 선분 밖·그림 밖(SVG 위쪽 바깥)에
 * 놓여 '수선의 발'이 허공에 뜬 점으로 보이거나 아예 사라진다. 그린 선분 안이면 격자 안이기도 하다(끝점이 격자점).
 */
export function checkFeet(p: ShapeParams) {
  const edge = (a: string, b: string, u: string, v: string) =>
    (a === u && b === v) || (a === v && b === u);
  for (const pt of p.points) {
    if (!pt.foot) continue;
    const { from, line } = pt.foot;
    const [a, b] = line;
    const at = `도형판 ${pt.id}`;
    const drawn =
      p.segments.some(([u, v]) => edge(a, b, u, v)) ||
      p.polygons.some((pl) => pl.some((u, i) => edge(a, b, u, pl[(i + 1) % pl.length] as string)));
    if (!drawn)
      fail(
        at,
        `수선의 발 ${pt.id}: 직선 ${a}${b} 를 그린 직선(segments 의 선분이나 다각형의 변)으로 두세요 — 발이 허공에 뜬 점으로 보임`,
      );
    const src = p.points.find((x) => x.id === from) as ShPoint;
    const s0 = shInit(p);
    const states = src.drag ? moverOptions(p, from).map((o) => o.patch(s0)) : [s0];
    for (const s of states) {
      const A = P(s, a);
      const B = P(s, b);
      const H = P(s, pt.id);
      const t = ((H.x - A.x) * (B.x - A.x) + (H.y - A.y) * (B.y - A.y)) / dist(A, B) ** 2;
      if (t < -1e-9 || t > 1 + 1e-9) {
        const q = P(s, from);
        fail(
          at,
          `수선의 발 ${pt.id}: ${from} 이 (${r2(q.x)}, ${r2(q.y)}) 에 있으면 발이 (${r2(H.x)}, ${r2(H.y)}) 로 그린 직선 ${a}${b} 밖 — 직선 끝점을 격자 가장자리에 두세요`,
        );
      }
    }
  }
}

/**
 * 형식 검사: 따라오는 점·마주 보는 점은 기대는 끄는 점이 닿는 모든 자리에서 격자 안이어야 한다. 끄는 점은 격자에
 * 갇혀도 대칭점은 건너편 격자 밖(그림 밖)으로 나가 사라질 수 있다 — 고치는 길은 끄는 점의 range 를 좁히는 것.
 */
export function checkDerived(p: ShapeParams) {
  const s0 = shInit(p);
  for (const pt of p.points) {
    if (!pt.follow && !pt.mirror) continue;
    const movers = p.points.filter((x) => x.drag && dependsOn(p, pt.id).includes(x.id));
    let acc = [{ s: s0, sym: {} as Record<string, string> }];
    for (const m of movers) acc = growStates(acc, moverOptions(p, m.id), `도형판 ${pt.id}`);
    for (const { s } of acc) {
      const q = P(s, pt.id);
      const out = q.x < -1e-9 || q.x > p.grid.w + 1e-9 || q.y < -1e-9 || q.y > p.grid.h + 1e-9;
      if (!out) continue;
      const where = movers
        .map((m) => `${m.id}(${r2(P(s, m.id).x)}, ${r2(P(s, m.id).y)})`)
        .join(' ');
      fail(
        `도형판 ${pt.id}`,
        `${where} 에서 ${pt.id} 가 (${r2(q.x)}, ${r2(q.y)}) — 격자 밖이라 그림에서 사라짐. 끄는 점의 range 를 좁히세요`,
      );
    }
  }
}

/**
 * 형식 검사: 측정값끼리 견주는 목표에서, 두 측정값이 화면에 같은 수로 보이는데(PA ≈ 9, PB ≈ 9) 목표가 아닌 자리가
 * 있으면 오류. 학습자는 '같아 보이는데 왜 아니지'를 알 길이 없다. = 와 ≈ 의 차이만으로 가르지 않는다(PA = 3 과
 * PB ≈ 3 은 학습자 눈에 같다). 고치는 길은 digits 를 늘리는 것 — 정확한 분수 표시는 비(比)만 고칠 수 있어 택하지 않았다.
 */
export function checkSameText(p: ShapeParams, g: ShGoal, states: ShState[]) {
  if (g.kind !== 'value' || !('of' in g.is)) return;
  const a = p.measures[g.of] as ShMeasure;
  const b = sub(p, g.is.of);
  for (const s of states) {
    const va = measureValue(p, s, a);
    const vb = measureValue(p, s, b);
    if (va === null || vb === null) continue;
    const t = round(va, p.digits).s;
    if (t !== round(vb, p.digits).s || shGoalHits(p, s).length) continue;
    const where = goalMovers(p, g)
      .map((id) => `${id}(${r2(P(s, id).x)}, ${r2(P(s, id).y)})`)
      .join(' ');
    fail(
      '도형판 goal',
      `${where} 에서 ${measureName(p, a)} 와 ${measureName(p, b)} 가 화면에 똑같이 ${t} 로 보이는데 목표가 아님 — digits 를 늘리세요(지금 ${p.digits})`,
    );
  }
}

// 닿는 자리를 모두 늘어놓는 검사(발의 자리·목표에 닿을 수 있는가)는 형식 검사에서만 — 장면을 열 때는 건너뛴다
export function shapeDeep(p: ShapeParams) {
  checkFeet(p);
  checkDerived(p);
  const g = p.goal;
  if (!g) return;
  const at = '도형판 goal';
  checkNotAtStart(shGoalHits(p, shInit(p)), shGoalNeed(p), at);
  const states = goalStates(p, g).map((x) => x.s);
  checkSameText(p, g, states);
  checkHitTable(goalTable(p, g, states), g.kind === 'value' ? g.places : 1, g.tol, at, (k) =>
    g.kind === 'visit' ? `가 볼 곳 ${g.at[k]?.src}` : '목표',
  );
}
