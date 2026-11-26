// 따라오는 좌표 식(요청 50·129·137): 수·슬라이더 이름·앞에 나온 점의 x(P)·y(P) 로 계산하는 좌표.
// 따라오는 점({x:'x(P)', y:0} — 수선의 발, {on:'g', x:'x(P)'} — 다른 곡선 위 같은 세로줄, {x:'h', y:0} — 꼭짓점)과
// 세로선 자리({vline:'x(P)'})가 같은 꼴을 쓴다. 점 좌표를 구하는 일(pointXY·xSym)은 point.ts 몫이라 여기서는
// '점 좌표를 어떻게 얻는가'를 부르는 쪽이 넘기는 함수로 받는다 — 이 파일이 point.ts 를 가져오면 순환이 생긴다.
import { compile, evalExact, evalNum, exactStr, varsOf } from '../../expr.ts';
import { fail, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import type { FollowExpr, ParseCtx } from './types.ts';

/**
 * 점 좌표 x(P)·y(P). 앞 글자가 영문이면(max(…)·tx(…)) 다른 이름이라 건너뛴다. 식 글자(sym.ts)는 x(…) 를 함수로 읽으려다
 * 실패하므로 읽기 전에 자리표 변수로 바꾼다
 */
const REF = /(?<![A-Za-z])([xy])\(\s*([A-Za-z][A-Za-z0-9]*)\s*\)/g;
/**
 * 자리표 변수: 식 글자가 아는 한 글자 변수(sym.ts VARS) 중 슬라이더 이름(a·b·c·d·h·k·m·n·p·q·r·s·t)과 x 가 아닌 것.
 * 그래서 좌표 식 하나가 쓸 수 있는 점 좌표는 다섯 개까지 — (x(A)+x(B))/2 같은 중점도 둘이면 된다
 */
const SLOTS = ['u', 'v', 'w', 'y', 'z'];

/** 수·글자를 따라오는 좌표 식으로 읽는다. 점은 앞에 나온 것만(숨긴 점은 못 가리킴 — cx.pointRef 가 막는다) */
export function parseFollow(
  v: unknown,
  at: string,
  cx: Pick<ParseCtx, 'sliders' | 'pointRef'>,
): FollowExpr {
  const src = typeof v === 'number' ? exactStr(v) : str(v, at).replace(/\s+/g, '');
  const ids = cx.sliders.map((sl) => sl.id);
  // 점 좌표 말고는 슬라이더 이름만 — 먼저 점 좌표를 수로 지워 읽어 본다. x 는 못 쓴다(x 를 쓰면 'x 의 함수' 곧 곡선이지
  // 한 자리가 아니다). 자리표 글자(u·y …)를 사람이 직접 적은 것도 여기서 걸러진다 — 안 거르면 점 좌표로 읽힌다
  const bare = src.replace(REF, '1');
  try {
    compile(bare, ids);
  } catch (e) {
    return fail(at, (e as Error).message.replace(bare, src));
  }
  const refs: FollowExpr['refs'] = [];
  const body = src.replace(REF, (_m, ax: 'x' | 'y', id: string) => {
    const pt = cx.pointRef(id, at).id;
    const old = refs.find((r) => r.pt === pt && r.ax === ax);
    if (old) return old.v;
    const v = SLOTS[refs.length];
    if (!v) return fail(at, `점 좌표를 ${SLOTS.length}개 넘게 씀 (${src})`);
    const r = { v, pt, ax };
    refs.push(r);
    return r.v;
  });
  try {
    return { src, node: compile(body, [...ids, ...refs.map((r) => r.v)]), refs };
  } catch (e) {
    // 앞의 읽어 보기를 통과하면 여기서는 안 터지지만, 터지면 자리표(u·v …)가 아니라 적은 그대로 보인다
    return fail(at, (e as Error).message.replace(body, src));
  }
}

/** 슬라이더도 점도 안 쓰는 식(수 하나) — 옛 꼴(칸 위 고정 점·고정 세로선)과 같은 길로 보낸다 */
export const isConst = (e: FollowExpr) => varsOf(e.node).size === 0;

/** 식에 쓰인 슬라이더 id(자리표는 뺀다) */
export const followSliders = (e: FollowExpr): string[] => {
  const slots = new Set(e.refs.map((r) => r.v));
  return [...varsOf(e.node)].filter((v) => !slots.has(v));
};

/** 수로 계산. ref 는 점 좌표(정의 안 되면 NaN — 식 값도 NaN) */
export function followNum(
  e: FollowExpr,
  vars: Record<string, number>,
  ref: (pt: string, ax: 'x' | 'y') => number,
): number {
  const env: Record<string, number> = { ...vars };
  for (const r of e.refs) {
    const v = ref(r.pt, r.ax);
    if (!Number.isFinite(v)) return Number.NaN;
    env[r.v] = v;
  }
  return evalNum(e.node, env);
}

/** 분수로 정확히. 슬라이더·점 좌표 중 하나라도 분수가 아니면 null */
export function followQ(
  e: FollowExpr,
  vars: Record<string, Rational>,
  ref: (pt: string, ax: 'x' | 'y') => Rational | null,
): Rational | null {
  const env: Record<string, Rational> = { ...vars };
  for (const r of e.refs) {
    const q = ref(r.pt, r.ax);
    if (!q) return null;
    env[r.v] = q;
  }
  return evalExact(e.node, env);
}

/**
 * sympy 글자: 원문의 x(P)·y(P) 를 그 점의 검산 글자(끄는 점은 상태 기호 pt_P_x)로 바로 바꾼다. 슬라이더 이름은 그대로
 * (상태가 넣는다). 앱이 읽은 식 구조(node)를 거치지 않으므로 sympy 가 원문을 따로 읽는다 — 앱의 식 읽기가 틀려도
 * 검산이 같이 틀리지 않게(parity 의 뜻)
 */
export function followSym(e: FollowExpr, ref: (pt: string, ax: 'x' | 'y') => string): string {
  return e.src.replace(REF, (_m, ax: 'x' | 'y', id: string) => `(${ref(id, ax)})`);
}
