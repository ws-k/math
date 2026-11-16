// 형식 검사 도우미(수 식·축·칸 번호·채점 목표·이름 규칙). 객체 종류 파일과 과제·전체 검사가 같이 쓰므로
// 아래층에 따로 둔다 — 종류 파일끼리 서로 빌려 쓰면 순서가 꼬인다.
import { LITERAL } from '../../../content/check.ts';
import { compile, evalNum, exactOf, exactStr } from '../../expr.ts';
import { fail, obj, str } from '../../parse.ts';
import { AXIS_LABEL_MAX_PX, axisLabel, labelWidth } from './frame.ts';
import type { Axis, Target } from './types.ts';

/** 찍기·그리기 모드에서 x·y 방향 칸 수 상한. 가장 좁은 화면(382px)에서도 한 칸이 손가락으로 고를 만큼(약 20px) */
export const MAX_CELLS = 12;
/** 곡선 위 점을 끌 때 x 방향 칸 수 상한(끄는 간격이 6px 아래로 가지 않게) */
export const MAX_SNAPS = 50;

export const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

export function numExpr(v: unknown, at: string): { src: string; n: number } {
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
  return { src, n };
}

/** 읽는 값 줄 끝에 붙는 단위 글자(areaUnit·slopeUnit) 수 상한. 축 끝 글자(name·unit)는 폭으로 잰다(AXIS_LABEL_MAX_PX) */
const UNIT_TEXT = 8;

export function axis(v: unknown, at: string, vertical = false): Axis {
  const o = obj(
    v,
    at,
    ['min', 'max', 'step'],
    ['name', 'unit', ...(vertical ? ['areaUnit', 'slopeUnit'] : [])],
  );
  const min = numExpr(o.min, `${at} min`);
  const max = numExpr(o.max, `${at} max`);
  const step = numExpr(o.step, `${at} step`);
  if (!(max.n > min.n)) fail(at, 'max 가 min 보다 커야 함');
  if (!(step.n > 0)) fail(`${at} step`, '0 보다 커야 함');
  if ((max.n - min.n) / step.n > 40) fail(at, '칸이 너무 많음(40칸 이하)');
  const text = (k: string) => {
    if (o[k] === undefined) return {};
    const t = str(o[k], `${at} ${k}`).trim();
    if (!t) fail(`${at} ${k}`, '빈 글자');
    if ((k === 'areaUnit' || k === 'slopeUnit') && [...t].length > UNIT_TEXT)
      fail(`${at} ${k}`, `1~${UNIT_TEXT}자`);
    return { [k]: t };
  };
  const out: Axis = {
    min: min.src,
    max: max.src,
    step: step.src,
    lo: min.n,
    hi: max.n,
    st: step.n,
    exact: exactOf(step.src),
    ...text('name'),
    ...text('unit'),
    ...text('areaUnit'),
    ...text('slopeUnit'),
  };
  // 축 끝 글자는 이름과 단위를 합친 한 줄('시간(분)')이 그림 폭을 줄이므로 글자 수가 아니라 합친 폭으로 잰다
  const label = axisLabel(out);
  if (label && labelWidth(label) > AXIS_LABEL_MAX_PX)
    fail(
      at,
      `축 끝 글자 '${label}' 이 ${labelWidth(label)}px — ${AXIS_LABEL_MAX_PX}px 이하로(가장 좁은 화면에서 그림 폭을 너무 줄임, 한글 7자 남짓)`,
    );
  return out;
}

/** 값을 칸 번호로. 칸 위가 아니면 형식 오류 */
export function toIndex(n: number, step: number, at: string): number {
  const k = Math.round(n / step);
  if (!near(k * step, n)) fail(at, `칸 위가 아님 (${n} 은 ${step} 의 배수가 아님)`);
  return k;
}

export function target(v: unknown, at: string): Target {
  const o = obj(v, at, ['value', 'check']);
  const value = str(o.value, `${at} value`).replace(/\s+/g, '');
  try {
    compile(value, []);
  } catch (e) {
    fail(`${at} value`, (e as Error).message);
  }
  const check = str(o.check, `${at} check`);
  if (LITERAL.test(check))
    fail(`${at} check`, '답을 그대로 적은 값 — 문제 조건으로 계산하는 식이어야 함');
  return { value, check };
}

export const ID = /^[A-Za-z][A-Za-z0-9]{0,5}$/;
