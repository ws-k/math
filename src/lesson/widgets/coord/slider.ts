// 슬라이더: 형식 검사·제외 값 건너뛰기·정확한 값(분수)·닿는 값 목록. 목표 판정과 검산이 슬라이더 값을
// 분수로 다시 만들어 써야 해서(소수 0.1+0.2 오차로 '중근'을 놓치지 않게) 한곳에 모았다.
import { exactOf } from '../../expr.ts';
import { arr, fail, obj, str } from '../../parse.ts';
import { type Rational, reduce } from '../../sym.ts';
import { near, numExpr, toIndex } from './common.ts';
import type { Slider } from './types.ts';

export function parseSliders(raw: unknown): Slider[] {
  return (raw === undefined ? [] : arr(raw, '좌표 sliders', 1, 3)).map((rs, k) => {
    const at = `좌표 슬라이더${k + 1}`;
    const s = obj(rs, at, ['id', 'min', 'max', 'step', 'value', 'label'], ['exclude']);
    const id = str(s.id, `${at} id`);
    if (!/^[abcdhkmnpqrst]$/.test(id))
      fail(`${at} id`, '식에 쓸 수 있는 한 글자(a·b·c·d·h·k·m·n·p·q·r·s·t)');
    const min = numExpr(s.min, `${at} min`);
    const max = numExpr(s.max, `${at} max`).n;
    const step = numExpr(s.step, `${at} step`);
    const value = numExpr(s.value, `${at} value`).n;
    if (!(max > min.n) || value < min.n || value > max) fail(at, '범위가 이상함');
    toIndex(value - min.n, step.n, `${at} value`);
    const exclude = (s.exclude === undefined ? [] : arr(s.exclude, `${at} exclude`, 1, 3)).map(
      (v, i) => {
        const e = numExpr(v, `${at} exclude${i + 1}`).n;
        if (e < min.n || e > max) fail(`${at} exclude`, '범위 밖');
        toIndex(e - min.n, step.n, `${at} exclude${i + 1}`);
        if (near(e, value)) fail(`${at} exclude`, '처음 값은 뺄 수 없음');
        return e;
      },
    );
    const sl: Slider = {
      id,
      min: min.n,
      max,
      step: step.n,
      stepSrc: step.src,
      minSrc: min.src,
      value,
      label: str(s.label, `${at} label`),
      exclude,
    };
    if (sliderValues(sl).length < 2) fail(at, '움직일 수 있는 값이 둘 이상이어야 함');
    return sl;
  });
}

const clean = (v: number) => Number(v.toPrecision(12));
const excluded = (sl: Slider, v: number) => sl.exclude.some((e) => near(v, e));

/** 칸 번호 k 의 값 */
const valueAt = (sl: Slider, k: number) => clean(sl.min + k * sl.step);
const lastK = (sl: Slider) => Math.round((sl.max - sl.min) / sl.step);

/** 닿을 수 있는 모든 값(칸 번호와 값). 제외 값은 빠진다 */
export function sliderValues(sl: Slider): { k: number; v: number }[] {
  const out: { k: number; v: number }[] = [];
  for (let k = 0; k <= lastK(sl); k++) {
    const v = valueAt(sl, k);
    if (!excluded(sl, v)) out.push({ k, v });
  }
  return out;
}

/**
 * 끈 자리(raw)를 칸에 맞추고, 제외 값이면 움직이던 쪽(prev → raw)으로 한 칸 더 간다. 끝이면 반대쪽으로.
 * 밑 a=1 처럼 곡선이 사라지는 값을 슬라이더가 건너뛰게(요청 60).
 */
export function sliderSnap(sl: Slider, raw: number, prev: number): number {
  const n = lastK(sl);
  let k = Math.min(n, Math.max(0, Math.round((raw - sl.min) / sl.step)));
  if (!excluded(sl, valueAt(sl, k))) return valueAt(sl, k);
  const dir = raw < prev ? -1 : 1;
  for (const d of [dir, -dir]) {
    for (let j = k + d; j >= 0 && j <= n; j += d)
      if (!excluded(sl, valueAt(sl, j))) {
        k = j;
        return valueAt(sl, k);
      }
  }
  return prev;
}

/** 슬라이더 값의 정확한 분수(min·step 이 유리수일 때). π 칸이면 null */
export function sliderQ(sl: Slider, v: number): Rational | null {
  const m = exactOf(sl.minSrc);
  const st = exactOf(sl.stepSrc);
  if (!m || !st) return null;
  const k = BigInt(Math.round((v - sl.min) / sl.step));
  return reduce(m[0] * st[1] + k * st[0] * m[1], m[1] * st[1]);
}

/** 칸 번호 k 의 값을 sympy 글자로(검산 상태) */
export function sliderSym(sl: Slider, k: number): string {
  const m = exactOf(sl.minSrc);
  const st = exactOf(sl.stepSrc);
  if (m && st) {
    const [a, b] = reduce(m[0] * st[1] + BigInt(k) * st[0] * m[1], m[1] * st[1]);
    return b === 1n ? `${a}` : `${a}/${b}`;
  }
  return `(${sl.minSrc})+${k}*(${sl.stepSrc})`;
}
