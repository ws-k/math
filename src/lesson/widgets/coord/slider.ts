// 슬라이더: 형식 검사·제외 값 건너뛰기·정확한 값(분수)·닿는 값 목록. 목표 판정과 검산이 슬라이더 값을
// 분수로 다시 만들어 써야 해서(소수 0.1+0.2 오차로 '중근'을 놓치지 않게) 한곳에 모았다.
import { exactOf } from '../../expr.ts';
import { formatValue } from '../../format.ts';
import { growStates } from '../../goal.ts';
import { arr, fail, obj, str } from '../../parse.ts';
import type { Rational } from '../../sym.ts';
import { add, mul, num, qi, ratStr } from '../q.ts';
import { near, numExpr, toIndex } from './common.ts';
import { fmtNum, isWide, NARROW_BOX_W, piText } from './frame.ts';
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
    // 슬라이더 옆 숫자(sliderText)는 칸 번호에서 정확한 꼴로 만든다 — 유리수 칸에 π 꼴 시작(π/5 + k/2)처럼
    // 두 꼴이 섞이면 한 덩어리 글자로 적을 수 없어 막는다(0 은 어느 꼴에도 맞음)
    const fm = formOf(min.src, min.n);
    const fs = formOf(step.src, step.n);
    if (fs !== 'other' && fm !== 'zero' && fm !== fs)
      fail(`${at} min`, `칸(step)과 같은 꼴이어야 함(${fs === 'q' ? '유리수' : 'π 의 유리수 배'})`);
    toIndex(value - min.n, step.n, `${at} value`);
    // 끝 값이 칸 위가 아니면 슬라이더는 그 앞 칸에서 멈춘다 — 적힌 범위 끝과 닿는 값이 어긋나
    // 목표·검산이 늘어놓는 값(sliderValues)이 화면과 달라진다
    toIndex(max - min.n, step.n, `${at} max`);
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

/**
 * 목표가 보는 슬라이더의 한 칸 최소 폭(px). 이보다 촘촘하면 손가락으로 목표 칸에 멈추기 어렵다(◀▶ 버튼 대신
 * 하한을 둔 까닭: 접은 화면은 이미 높이가 모자라 버튼 줄을 더할 자리가 없다).
 */
export const MIN_SLIDER_STEP_PX = 7;

/**
 * 슬라이더 줄(.cslider, 17px) 글자의 어림 폭. 크롬 실측(382pt 접음): 한글 15.5·숫자 10.8·빈칸 4.5·점 5·
 * 수식 글자 11.3px — 조금 넉넉히 잡는다(좁게 어림하면 상한이 실제보다 느슨해진다). 수식 표기($·\명령·{}^_)는
 * 글자 하나 또는 0 으로 센다.
 */
export function sliderTextWidth(t: string): number {
  const plain = t.replace(/\\[A-Za-z]+/g, 'x').replace(/[$\\{}^_]/g, '');
  return [...plain].reduce((w, ch) => {
    // 빼기 기호(U+2212)는 코드 값이 커도 좁은 글자(isWide 가 좁게 본다) — 숫자 폭으로 센다
    if (isWide(ch)) return w + 16;
    if (ch === ' ') return w + 4.5;
    if (ch === '.' || ch === ',') return w + 5;
    return w + 11;
  }, 0);
}

/**
 * 가장 좁은 화면에서 슬라이더 한 칸의 폭(px). 줄(상자 폭 NARROW_BOX_W)에서 이름·가장 긴 값 글자·틈 10px×2 를
 * 빼고 손잡이 폭(약 20px)만큼 끝이 줄어든 길이를 칸 수로 나눈다. 값 글자는 화면이 적는 꼴(sliderText: −1.75·
 * 3π/4·5/12)로 재야 화면과 맞는다 — 칸 간격이 소수면 줄이 짧아진다 — 실측: '조각 수 n'·값 30 이면 입력 칸 189px(예전 어림 214px 보다 짧다).
 */
export function sliderStepPx(sl: Slider): number {
  const value = Math.max(...sliderValues(sl).map(({ v }) => sliderTextWidth(sliderText(sl, v))));
  const track = NARROW_BOX_W - sliderTextWidth(sl.label) - value - 2 * 10 - 20;
  return track / lastK(sl);
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

/** 식 글자를 π 의 유리수 배로('-pi' → −1, 'pi/12' → 1/12, '0' → 0). 아니면 null */
function piQ(src: string, n: number): Rational | null {
  const z = exactOf(src);
  if (z) return z[0] === 0n ? [0n, 1n] : null;
  if (!/\bpi\b/.test(src)) return null;
  const q = exactOf(src.replace(/\bpi\b/g, '(1)'));
  // pi 를 1 로 바꾼 값이 정말 n/π 인지 확인한다(pi**2·sin(pi) 같은 꼴을 걸러 낸다)
  return q && near(num(q) * Math.PI, n) ? q : null;
}

type Form = 'zero' | 'q' | 'pi' | 'other';
function formOf(src: string, n: number): Form {
  const q = exactOf(src);
  if (q) return q[0] === 0n ? 'zero' : 'q';
  return piQ(src, n) ? 'pi' : 'other';
}

/** 분모가 2·5 로만 이뤄졌으면 끝나는 소수의 자릿수(2·5 지수 중 큰 쪽), 아니면 null */
function decimals(d: bigint): number | null {
  let x = d;
  let e2 = 0;
  let e5 = 0;
  while (x % 2n === 0n) {
    x /= 2n;
    e2++;
  }
  while (x % 5n === 0n) {
    x /= 5n;
    e5++;
  }
  return x === 1n ? Math.max(e2, e5) : null;
}

/**
 * 슬라이더 옆 숫자 글자. 값(number)을 그대로 찍으면 칸이 π/12·1/12 일 때 0.785398163397448 같은 원시 소수가
 * 나와 접은 화면 줄을 넘었다. 부동소수를 거치지 않게 칸 번호에서 정확한 값을 만들어 칸 모양을 따른다:
 * - 칸(과 처음 끝)이 끝나는 소수로 떨어지면(1/2·1/4·1/10) 소수, 자릿수는 그 값의 분모(2·5 지수)대로 — 같은 장면의
 *   읽는 값 value(a) 도 이 글자를 쓴다(readout.ts).
 * - 안 떨어지면(1/12) 분수. 칸마다 정하지 않고 슬라이더 하나에 한 꼴 — 3/12 만 0.25 로 튀면 1/6·1/3 사이에서 어색하다.
 * - π 배수 칸(π/12)은 π 꼴(눈금 글자 tickText 와 같은 piText).
 * - 어느 쪽도 아니면(√2/4 칸) 칸 크기보다 한 자리 더 반올림.
 */
export function sliderText(sl: Slider, v: number): string {
  const k = BigInt(Math.round((v - sl.min) / sl.step));
  const m = exactOf(sl.minSrc);
  const st = exactOf(sl.stepSrc);
  if (m && st) {
    const [n, d] = add(m, mul([k, 1n], st));
    if (d === 1n) return String(n).replace('-', '−');
    const dm = decimals(m[1]);
    const ds = decimals(st[1]);
    const dv = decimals(d);
    if (dm !== null && ds !== null && dv !== null) return formatValue(`${n}/${d}`, { digits: dv });
    return `${n < 0n ? '−' : ''}${n < 0n ? -n : n}/${d}`;
  }
  const ps = piQ(sl.stepSrc, sl.step);
  const pm = ps && piQ(sl.minSrc, sl.min);
  if (ps && pm) {
    const [n, d] = add(pm, mul([k, 1n], ps));
    return piText(Number(n), Number(d));
  }
  return fmtNum(v, Math.min(4, Math.max(0, Math.ceil(-Math.log10(sl.step))) + 1));
}

/** 슬라이더 값의 정확한 분수(min·step 이 유리수일 때). π 칸이면 null */
export function sliderQ(sl: Slider, v: number): Rational | null {
  const m = exactOf(sl.minSrc);
  const st = exactOf(sl.stepSrc);
  if (!m || !st) return null;
  return add(m, mul(qi(Math.round((v - sl.min) / sl.step)), st));
}

/** 칸 번호 k 의 값을 sympy 글자로(검산 상태) */
export function sliderSym(sl: Slider, k: number): string {
  const m = exactOf(sl.minSrc);
  const st = exactOf(sl.stepSrc);
  if (m && st) return ratStr(add(m, mul(qi(k), st)));
  return `(${sl.minSrc})+${k}*(${sl.stepSrc})`;
}

/** 슬라이더 값 조합 하나: 수(앱 계산)·sympy 글자(검산 점)·사람이 읽는 글(형식 오류 글) */
export interface SliderCombo {
  num: Record<string, number>;
  sym: Record<string, string>;
  text: string;
}

/**
 * 쓰인 슬라이더(ids)가 닿는 값의 모든 조합. 상태 늘리기는 목표 검산과 같은 growStates 로 — 상한(2000)과
 * 넘을 때의 형식 오류가 한곳에서 정해진다. 조각 끝 표시·선분 끝을 '처음 값만이 아니라 모든 칸에서' 볼 때 쓴다
 */
export function sliderCombos(sliders: Slider[], ids: string[], at: string): SliderCombo[] {
  let acc: { s: SliderCombo; sym: Record<string, string> }[] = [
    { s: { num: {}, sym: {}, text: '' }, sym: {} },
  ];
  for (const id of ids) {
    const sl = sliders.find((x) => x.id === id);
    if (!sl) continue;
    acc = growStates(
      acc,
      sliderValues(sl).map(({ k, v }) => ({
        patch: (c: SliderCombo) => ({
          num: { ...c.num, [id]: v },
          sym: { ...c.sym, [id]: sliderSym(sl, k) },
          text: `${c.text}${c.text ? ', ' : ''}${id}=${v}`,
        }),
        sym: {},
      })),
      at,
    );
  }
  return acc.map((a) => a.s);
}
