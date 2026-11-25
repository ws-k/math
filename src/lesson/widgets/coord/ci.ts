// 신뢰구간 여러 개 {id, ci:{m, sd, n, z, draws}} (요청 99, 2-가): 표본마다 [x̄ − zσ/√n, x̄ + zσ/√n] 를 가로 막대로
// 쌓아 '대부분의 구간이 모평균 m 을 품는다'를 눈으로 세게 한다. 읽는 값 cover(C) = m 을 품은 구간 수.
//
// draws 는 표준화한 표본평균 u = (x̄ − m)/(σ/√n) 다. 실제 x̄ 를 적으면 n 슬라이더를 움직일 때 표본이 그대로라
// 거짓 그림이 된다 — u 로 적으면 x̄ = m + u·σ/√n 이라 n 을 키우면 구간이 좁아지고, 품는지(|u| ≤ z)는 그대로다
// (신뢰도는 n 이 아니라 z 가 정한다는 깨달음). z 를 슬라이더로 두면 품은 수가 바뀐다.
import { arr, fail, obj } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { cmp, neg, ratStr } from '../q.ts';
import { narrowFrame, r1, toPx } from './frame.ts';
import { nosNum, nosQ, nosSliders, nosValues, numOrSlider, qnum, statStates } from './stat.ts';
import type { CiObj, CoordParams, CoordState, KindDef, QNum } from './types.ts';

/** 표본 수 상한 */
const MAX_DRAWS = 40;
/** 가장 좁은 화면에서 줄 사이 최소 간격(px): 막대 두께 2.5px 와 틈 — 좁으면 줄끼리 붙어 하나로 보인다 */
export const MIN_ROW_PX = 5;
/** 표준화한 표본평균 |u| 상한(그보다 먼 표본은 사실상 없다 — 적는 실수를 잡으려고) */
const MAX_U = 6;
/** x̄ 표시(짧은 세로 금)의 반 길이 */
const TICK = 3;

export const ciOf = (p: CoordParams, id: string) =>
  p.objects.find((o): o is CiObj => o.kind === 'ci' && o.id === id) as CiObj;

/** 구간 k 가 m 을 품는가: |u| ≤ z(정확한 분수로 — 경계에 딱 걸린 표본도 sympy 와 같게) */
function covers(u: Rational, z: Rational): boolean {
  return cmp(u, neg(z)) >= 0 && cmp(u, z) <= 0;
}

/** m 을 품은 구간 수 */
export function coverAt(p: CoordParams, s: CoordState, o: CiObj): number {
  const z = nosQ(p, s, o.z);
  return z ? o.draws.filter((u) => covers(u.q, z)).length : Number.NaN;
}

/** 품은 수를 바꾸는 슬라이더(z), 구간 폭만 바꾸는 슬라이더(n) */
export const ciMovers = (o: CiObj) => [...nosSliders(o.n), ...nosSliders(o.z)];

export const ciKind: KindDef<CiObj> = {
  parse(ro, at, cx) {
    const c = obj(ro, at, ['id', 'ci']);
    const id = cx.named(c.id, `${at} id`);
    const r = obj(c.ci, `${at} ci`, ['m', 'sd', 'n', 'z', 'draws']);
    const m = qnum(r.m, `${at} ci.m`);
    if (m.n < cx.x.lo || m.n > cx.x.hi) fail(`${at} ci.m`, `평균 ${m.src} 이 화면 밖`);
    const sd = qnum(r.sd, `${at} ci.sd`);
    if (!(sd.n > 0)) fail(`${at} ci.sd`, '표준편차는 0 보다 커야 함');
    const n = numOrSlider(r.n, `${at} ci.n`, cx, (v) =>
      Number.isInteger(v) && v >= 1 ? null : '표본 크기 n 은 1 이상의 정수',
    );
    const z = numOrSlider(r.z, `${at} ci.z`, cx, (v) => (v > 0 ? null : 'z 는 0 보다 커야 함'));
    const draws = arr(r.draws, `${at} ci.draws`, 1, MAX_DRAWS).map((v, i): QNum => {
      const u = qnum(v, `${at} ci.draws${i + 1}`);
      if (Math.abs(u.n) > MAX_U)
        fail(`${at} ci.draws${i + 1}`, `표준화한 표본평균은 |u| ≤ ${MAX_U}`);
      return u;
    });
    const k = draws.length;
    // 줄 k 는 y=k — 맨 아래·맨 위 줄이 그림 테두리에 걸려 반쯤 잘리지 않게 반 칸씩 여유
    if (cx.y.lo > 0.5 || cx.y.hi < k + 0.5)
      fail(at, `줄 ${k}개(y=1~${k})가 그림 밖 — y 를 0~${k + 1} 처럼 줄을 다 품게`);
    const f0 = narrowFrame(cx);
    const px = (f0.b - f0.t) / (cx.y.hi - cx.y.lo);
    if (px < MIN_ROW_PX)
      fail(
        at,
        `가장 좁은 화면에서 줄 간격이 ${px.toFixed(1)}px — ${MIN_ROW_PX}px 보다 좁으면 줄이 붙어 셀 수 없음(표본 수를 줄이거나 y 범위를 좁게)`,
      );
    const o: CiObj = { kind: 'ci', id, m, sd, n, z, draws };
    cx.cis.set(id, o);
    return o;
  },
  draw(o, k, { p, s, f, shapes }) {
    const n = nosNum(s, o.n);
    const z = nosQ(p, s, o.z);
    const zn = nosNum(s, o.z);
    const se = o.sd.n / Math.sqrt(n);
    let hit = '';
    let miss = '';
    let ticks = '';
    if (z && Number.isFinite(se))
      o.draws.forEach((u, i) => {
        const xbar = o.m.n + u.n * se;
        const [X1, Y] = toPx(p, f, xbar - zn * se, i + 1);
        const [X2] = toPx(p, f, xbar + zn * se, i + 1);
        const [Xm] = toPx(p, f, xbar, i + 1);
        const seg = `M${r1(X1)} ${r1(Y)}H${r1(X2)}`;
        if (covers(u.q, z)) hit += seg;
        else miss += seg;
        ticks += `M${r1(Xm)} ${r1(Y - TICK)}V${r1(Y + TICK)}`;
      });
    const [Xm] = toPx(p, f, o.m.n, 0);
    // 모평균 세로선을 먼저(아래) — 구간 막대가 선 위에 놓여 '선을 지나는가'가 보이게
    shapes.push({ t: 'path', key: `i${k}l`, d: `M${r1(Xm)} ${r1(f.t)}V${r1(f.b)}`, cls: 'ci-m' });
    shapes.push({ t: 'path', key: `i${k}`, d: hit, cls: 'ci hit' });
    shapes.push({ t: 'path', key: `i${k}m`, d: miss, cls: 'ci miss' });
    shapes.push({ t: 'path', key: `i${k}d`, d: ticks, cls: 'ci-dot' });
  },
  checks(o, { p, out }) {
    // z 마다 품은 수: 앱의 |u| ≤ z 셈 = sympy 가 구간 끝(m ± …)으로 따로 센 값. n 은 품는지를 바꾸지 않아야 하므로
    // 여러 n 에서 센 값이 하나로 같아야 한다(다르면 −1 — 그림의 '좁아질 뿐 그대로'가 거짓). √n 이 든 부등식을 sympy 가
    // 하나하나 따지면 느려서(25 칸 × 20 표본 × z 5 칸 = 10초) n 은 양 끝을 포함해 고르게 5칸까지만
    const all = nosValues(p, o.n);
    const ns = [
      ...new Set([0, 1, 2, 3, 4].map((i) => all[Math.round((i * (all.length - 1)) / 4)])),
    ];
    const us = `[${o.draws.map((u) => ratStr(u.q)).join(', ')}]`;
    for (const st of statStates(p, nosSliders(o.z), [], `좌표 신뢰구간 ${o.id}`)) {
      const z = nosQ(p, st.s, o.z) as Rational;
      out.push({
        name: `신뢰구간 ${o.id} 덮는 수${st.text ? ` ${st.text}` : ''}`,
        answer: String(coverAt(p, st.s, o)),
        answerType: 'int',
        check: [
          `m, sd, z = ${ratStr(o.m.q)}, ${ratStr(o.sd.q)}, ${ratStr(z)}`,
          `us = ${us}`,
          `cs = {sum(1 for u in us if (m + (u - z)*sd/sqrt(N) <= m) and (m <= m + (u + z)*sd/sqrt(N))) for N in [${ns.join(', ')}]}`,
          'ans = cs.pop() if len(cs) == 1 else -1',
        ].join('\n'),
      });
    }
  },
};
