// 부품 공용 목표 틀(순수). 좌표평면·도형판이 같이 쓴다 — 부품마다 "무엇을 재는가"는 다르지만
// "손을 뗀 자리에서만 판정, 진행 표시, 몇 번 떼도 못 이루면 힌트"는 같아야 학습자가 한 규칙으로 익힌다.
//
// 목표는 진행을 막지 않는다(2026-11-14 사용자 결정): '계속하기'는 늘 열려 있고, 목표는 ① 맞았다는 글
// ② 장면 완료 기록(onDone) ③ 숨긴 정답 공개 ④ 결론 글(after) 공개에만 쓴다.
//
// 원칙 P3(docs/plan-widgets-v2.md): 판정은 손을 뗀 자리에서만 — 끄는 도중 지나간 자리는 세지 않는다.
// 그래서 이 파일에는 "놓았을 때" 부르는 goalRelease 만 있고, 화면은 끄는 동안 이것을 부르지 않는다.
// 숨긴 정답에 다가가도 글·색이 바뀌지 않게, 화면 글(goalLine)은 '닿았나'만 보고 '얼마나 가까운가'는 보지 않는다.
import { compile, evalNum, exactOf, exactStr } from './expr.ts';
import { fail, obj, str } from './parse.ts';
import type { Rational } from './sym.ts';

/** 손을 이만큼 떼도 못 이루면 목표의 힌트 글을 보인다(계획서 '확인이 필요한 것' 4번의 제안값) */
export const GOAL_HINT_AFTER = 8;
/**
 * 목표 판정을 검산할 때 늘어놓는 상태 수 상한. 끌기·슬라이더로 닿는 모든 상태를 sympy 가 다시 판정하므로
 * 너무 많으면 검산이 느려진다(xy 점 하나가 12×12 칸이면 169).
 */
export const GOAL_MAX_STATES = 2000;

/** 판정에 쓰는 값: 수(화면·오차 비교)와, 분수로 정확히 구해지면 그 분수 */
export interface Val {
  n: number;
  q: Rational | null;
}

/**
 * 두 값이 같은가. 허용 오차 tol 이 0 이면 둘 다 분수일 때 정확히, 아니면(무리수) 상대오차 1e-9.
 * tol 이 있으면 그 안(원칙 P10 — 무리수 목표는 형식 검사가 '오차 안에 드는 자리가 하나뿐'임을 따로 확인).
 */
export function sameVal(a: Val, b: Val, tol: number): boolean {
  if (!Number.isFinite(a.n) || !Number.isFinite(b.n)) return false;
  if (tol > 0) return Math.abs(a.n - b.n) <= tol + 1e-12;
  if (a.q && b.q) return a.q[0] * b.q[1] === b.q[0] * a.q[1];
  return Math.abs(a.n - b.n) <= 1e-9 * Math.max(1, Math.abs(b.n));
}

export interface GoalProgress {
  /** 이미 닿은 목표 열쇠(여러 곳 가 보기면 그 곳 번호, 여러 자리면 그 자리). 정렬해 둔다 */
  seen: readonly string[];
  /** 목표를 이루기 전까지 손을 뗀 횟수 */
  tries: number;
  done: boolean;
}

export const goalStart = (): GoalProgress => ({ seen: [], tries: 0, done: false });

/**
 * 손을 뗀 자리 판정. hits = 지금 자리가 닿은 목표 열쇠들, need = 모아야 할 열쇠 수.
 * 끝난 뒤에는 그대로 돌려준다(다시 멀어져도 '맞았다'를 거두지 않는다).
 */
export function goalRelease(g: GoalProgress, hits: readonly string[], need: number): GoalProgress {
  if (g.done) return g;
  const seen = [...new Set([...g.seen, ...hits])].sort();
  const done = seen.length >= need;
  return { seen, tries: done ? g.tries : g.tries + 1, done };
}

export interface GoalTexts {
  intro?: string;
  done?: string;
  hint?: string;
}

/**
 * 화면 한 줄: 끝났으면 완료 글, 손을 GOAL_HINT_AFTER 번 떼도 못 이뤘으면 힌트, 아니면 처음 안내.
 * progress 는 모을 것이 둘 이상일 때만 "3곳 중 2곳"(하나짜리 목표의 0/1 은 정답 위치를 알려 주지 않지만 군더더기다).
 */
export function goalLine(
  g: GoalProgress,
  need: number,
  t: GoalTexts,
): { text: string; cls: '' | 'ok'; progress: string | null } {
  const progress = need > 1 ? `${need}곳 중 ${g.seen.length}곳` : null;
  if (g.done) return { text: t.done ?? '목표를 이뤘어요.', cls: 'ok', progress };
  if (t.hint && g.tries >= GOAL_HINT_AFTER) return { text: t.hint, cls: '', progress };
  return { text: t.intro ?? '', cls: '', progress };
}

// ---- 형식 검사 공용 ----

/** 목표에 적는 수(목표값·가 볼 곳). 화면 비교용 수와 분수(무리수면 null) */
export interface GoalNum extends Val {
  src: string;
}

/** 목표에 적는 수 읽기: 수 또는 변수 없는 식 글자("sqrt(3)", "pi/3") */
export function goalNum(v: unknown, at: string): GoalNum {
  let src: string;
  if (typeof v === 'number') src = exactStr(v);
  else src = str(v, at).replace(/\s+/g, '');
  let n: number;
  try {
    n = evalNum(compile(src, []), {});
  } catch (e) {
    return fail(at, (e as Error).message);
  }
  if (Number.isNaN(n)) fail(at, `수가 아님 (${src})`);
  return { src, n, q: exactOf(src) };
}

/**
 * 목표의 공통 모양. 무엇을 재는가(of)·무엇과 견주는가(is)는 부품이 읽는다.
 *   { visit: { of, at: [수…] } }          여러 곳 가 보기 — at 의 값마다 한 번씩 닿기
 *   { value: { of, is, places? } }        값 맞추기 — of 가 is 가 되는 자리 places(기본 1)곳
 * 공통 칸: hint(필수, 손을 GOAL_HINT_AFTER 번 떼도 못 이루면 보임), tol(허용 오차, 무리수 목표만)
 */
export type GoalShape<R, I> =
  | { kind: 'visit'; of: R; at: GoalNum[] }
  | { kind: 'value'; of: R; is: I; places: number };

export interface GoalCommon {
  hint: string;
  /** 허용 오차(원문·수). 0 이면 정확히 */
  tol: { src: string; n: number };
}

/**
 * 공통 목표 읽기. num 은 수 글자를 읽는 부품 쪽 함수(식 문법이 부품마다 같지만 오류 위치 글을 맞추려고 받는다).
 * extra.kinds 는 부품만의 목표 열쇠(좌표평면의 place·approach) — 그 열쇠가 있으면 shape 를 null 로 돌려 부품이 읽게 한다.
 * extra.keys 는 그 목표들이 더 쓰는 칸(approach 의 within).
 */
export function parseGoalShape<R, I>(
  raw: unknown,
  at: string,
  read: {
    of(v: unknown, at: string): R;
    is(v: unknown, at: string): I;
    num(v: unknown, at: string): GoalNum;
    /** is 가 수면 그 수(허용 오차 검사용), 다른 읽는 값과 견주면 null */
    isNum(i: I): GoalNum | null;
  },
  extra: { kinds: string[]; keys: string[] } = { kinds: [], keys: [] },
): { shape: GoalShape<R, I> | null; common: GoalCommon; o: Record<string, unknown> } {
  const kinds = ['visit', 'value', ...extra.kinds];
  const o = obj(raw, at, [], [...kinds, 'hint', 'tol', ...extra.keys]);
  const present = kinds.filter((k) => o[k] !== undefined);
  if (present.length !== 1) fail(at, `${kinds.join('·')} 중 하나만`);
  const k = present[0] as string;
  let tol = { src: '0', n: 0 };
  if (o.tol !== undefined) {
    const t = read.num(o.tol, `${at} tol`);
    tol = { src: t.src, n: t.n };
  }
  if (!(tol.n >= 0)) fail(`${at} tol`, '0 이상');
  const common: GoalCommon = { hint: o.hint === undefined ? '' : str(o.hint, `${at} hint`), tol };
  if (k === 'visit') {
    const v = obj(o.visit, `${at} visit`, ['of', 'at']);
    const of = read.of(v.of, `${at} visit.of`);
    if (!Array.isArray(v.at) || v.at.length < 2 || v.at.length > 6)
      fail(`${at} visit.at`, '가 볼 곳 2~6개');
    const pts = (v.at as unknown[]).map((x, i) => read.num(x, `${at} visit.at${i + 1}`));
    tolOnlyIrrational(tol, pts, at);
    for (let i = 0; i < pts.length; i++)
      for (let j = 0; j < i; j++)
        if (sameVal(pts[i] as GoalNum, pts[j] as GoalNum, tol.n))
          fail(`${at} visit.at`, `같은 곳이 두 번 (${pts[i]?.src})`);
    return { shape: { kind: 'visit', of, at: pts }, common, o };
  }
  if (k === 'value') {
    const v = obj(o.value, `${at} value`, ['of', 'is'], ['places']);
    const of = read.of(v.of, `${at} value.of`);
    const is = read.is(v.is, `${at} value.is`);
    const n = read.isNum(is);
    if (n) tolOnlyIrrational(tol, [n], at);
    // 다른 측정값·읽는 값과 견주면 두 값 모두 앱이 정확히 계산하고 sympy 가 정확히 다시 판정한다 — 오차를 두면
    // 정답이 아닌 이웃 자리까지 맞았다고 하게 된다(원칙 P10, 무리수 '수' 목표만 오차가 필요)
    else if (tol.n > 0)
      fail(`${at} tol`, '다른 값과 견주는 목표는 두 값을 정확히 견주므로 허용 오차를 두지 않음');
    let places = 1;
    if (v.places !== undefined) {
      if (
        typeof v.places !== 'number' ||
        !Number.isInteger(v.places) ||
        v.places < 1 ||
        v.places > 6
      )
        fail(`${at} value.places`, '1~6 정수');
      places = v.places as number;
    }
    return { shape: { kind: 'value', of, is, places }, common, o };
  }
  return { shape: null, common, o };
}

/**
 * 허용 오차는 무리수 목표만(원칙 P10). 유리수 목표는 칸 위 값과 정확히 견줄 수 있어, 오차를 두면 정답이 아닌
 * 이웃 자리까지 맞았다고 하거나 계산 대신 더듬어 맞히게 된다.
 */
function tolOnlyIrrational(tol: { src: string; n: number }, nums: GoalNum[], at: string) {
  if (!(tol.n > 0)) return;
  const q = nums.find((x) => x.q);
  if (q) fail(`${at} tol`, `유리수 목표(${q.src})에는 허용 오차를 두지 않음 — 무리수 목표만`);
}

/** 새 목표(visit·value 와 부품의 새 열쇠)는 힌트가 필수 — 손을 여러 번 떼도 못 이룬 학습자에게 보일 글 */
export function needHint(c: GoalCommon, at: string) {
  if (!c.hint.trim()) fail(`${at} hint`, '힌트 글이 필요함(손을 여러 번 떼도 못 이루면 보임)');
}

// ---- 닿는 상태 표(형식 검사·검산 공용) ----

/**
 * 늘어놓은 상태마다 앱 판정(hits)을 돌려 목표마다 닿는 상태 번호를 모은다. visit 이면 열쇠가 곳 번호(0…n−1),
 * 아니면 목표가 하나라 무엇이든 닿으면 0번 목표에 든다. 이 표가 곧 검산 항목(kind goal)의 hits 다.
 */
export function hitTable<S>(
  states: readonly S[],
  hits: (s: S) => string[],
  visit: number | null,
): number[][] {
  const out: number[][] = Array.from({ length: visit ?? 1 }, () => []);
  states.forEach((s, k) => {
    const h = hits(s);
    if (visit !== null) for (const key of h) out[Number(key)]?.push(k);
    else if (h.length) out[0]?.push(k);
  });
  return out;
}

/**
 * 형식 검사: 목표마다 need 곳 이상 닿을 수 있는가, 허용 오차가 있으면 정확히 need 곳인가(원칙 P10 —
 * 무리수 목표가 오차 안에 여러 자리를 품으면 계산 대신 더듬어 찾게 된다). what(k) 는 오류 글의 목표 이름.
 */
export function checkHitTable(
  table: number[][],
  need: number,
  tol: { src: string; n: number },
  at: string,
  what: (k: number) => string,
): void {
  table.forEach((h, k) => {
    if (h.length < need)
      fail(at, `${what(k)}: 끌기·슬라이더로 닿을 수 없음(닿는 자리 ${h.length}곳 < ${need}곳)`);
    if (tol.n > 0 && h.length !== need)
      fail(
        at,
        `${what(k)}: 허용 오차 ${tol.src} 안에 드는 자리가 ${h.length}곳 — 정답 자리가 ${need}곳이어야 함`,
      );
  });
}

/**
 * 상태 늘리기: 지금까지의 조합 × 이 움직이는 것의 자리들. 상한을 넘으면 형식 오류 —
 * 상태마다 sympy 가 다시 판정하므로 검산이 끝없이 느려지지 않게.
 */
export function growStates<S>(
  acc: { s: S; sym: Record<string, string> }[],
  opts: { patch: (s: S) => S; sym: Record<string, string> }[],
  at: string,
): { s: S; sym: Record<string, string> }[] {
  if (acc.length * opts.length > GOAL_MAX_STATES)
    fail(at, `목표가 바라보는 상태가 너무 많음(${GOAL_MAX_STATES} 넘음) — 움직이는 것을 줄이세요`);
  return acc.flatMap((a) => opts.map((o) => ({ s: o.patch(a.s), sym: { ...a.sym, ...o.sym } })));
}

/**
 * 형식 검사: 처음 자리에서 이미 목표를 다 이뤘으면 오류 — 아무 데나 한 번 놓으면 끝나는 탐색으로 되돌아간다
 * (조각 ②가 없애려는 "한 번 만지면 완료"). 여러 곳 가 보기에서 처음 자리가 그중 한 곳인 것은 괜찮다.
 */
export function checkNotAtStart(startHits: readonly string[], need: number, at: string): void {
  if (startHits.length >= need)
    fail(at, '처음 자리가 이미 목표 — 한 번 만지면 끝나는 탐색이 됨(처음 자리나 목표를 바꾸세요)');
}
