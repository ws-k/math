// 확률 실험 부품의 모델(순수). 화면(Simulate.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 동전·주사위·주머니·성공 횟수 기구를 학습자가 한 번씩 직접 던지고(누르고 있으면 계속), 나온 비율 막대를 이론값과
// 나란히 본다. 던지기는 시드 난수(generators/rng.ts 그대로)라 같은 시드면 같은 기록 — 되감기·테스트·화면 확인이 재현된다.
// 이론값은 모든 경우를 늘어놓아 세서 분수로 정확히 구하고, checks 가 sympy 로 따로 세어 대조한다.
//
// 2026-11-23 '직접 던지기'(조각 ④ · 1-나, 시안 outputs/widgets-v2/prob/toss.html): '1번·10번·100번' 버튼은 결과를 대신
// 그려 주는 버튼이라(P2) 없앴다. 기록(던진 결과 전부)을 남기고 화면은 그 앞의 t 개만 세므로, 되감기는 t 만 바꾼다.
// 누르는 동안은 React 를 거치지 않고 그릴 목록(simDraw)을 직접 적용한다(P8) — 그래서 그림이 이 파일의 순수 함수에서 나온다.
import { makeRng, type Rng } from '../../generators/rng.ts';
import { arr, fail, int, obj, oneOf, rationalStr, str } from '../parse.ts';
import { type Drawing, type Mark, r2 } from './draw.ts';
import { div, type Q, q, qi, ratStr } from './q.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface SimParams {
  device: 'coin' | 'die' | 'bag' | 'trial';
  /** 동전 수(1~4, 2개 이상이면 '앞면 수') · 주사위 수(1~2, 2개면 '눈의 합') · 성공 횟수 기구의 시행 수(1~10) */
  n: number;
  bag?: { label: string; count: number }[];
  /** 주머니에서 한 번에 차례로 꺼내는 공 수(1~4). 2 이상이면 count 색이 몇 번 나왔는지가 결과 */
  draws: number;
  /** 꺼낸 공을 다시 넣는가. 다시 넣지 않으면(비복원) 뒤의 공일수록 남은 공에서 고른다 */
  replace: boolean;
  /** 여러 번 꺼낼 때 셀 색(bag 의 label) */
  count?: string;
  /** 성공 횟수 기구: 한 번 성공할 확률 */
  p?: Q;
  /** 성공 횟수 기구: 무엇을 셀지(기본 '성공') */
  label?: string;
  /** 표본평균 실험: 고를 수 있는 표본 크기(주사위 수). 있으면 n 은 지금 고른 크기 */
  sizes?: number[];
  seed: number;
  /** 이만큼 던지면 목표를 이룬 것으로 본다 */
  goal: number;
}
/** 범주별 횟수 묶음(옛 '몰아 던지기' 모양 — 막대 글자를 셀 때 쓴다) */
export interface SimState {
  counts: number[];
  trials: number;
}

/** label: 결과의 온 이름(검산 이름·넓은 표) · short: 막대 밑·접은 표 칸에 쓰는 짧은 이름 */
type Cat = { label: string; short: string; prob: Q };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const multi = (p: SimParams) => p.device === 'bag' && p.draws > 1;
const countIdx = (p: SimParams) => (p.bag ?? []).findIndex((b) => b.label === p.count);
const what = (p: SimParams) => (p.device === 'trial' ? (p.label ?? '성공') : (p.count ?? ''));

/** 가장 적게·많이 나올 수 있는 셀 색 횟수(다시 넣지 않으면 공 수에 막힌다) */
function multiRange(p: SimParams): [number, number] {
  if (p.replace) return [0, p.draws];
  const total = sum((p.bag ?? []).map((b) => b.count));
  const c = (p.bag ?? [])[countIdx(p)]?.count ?? 0;
  return [Math.max(0, p.draws - (total - c)), Math.min(p.draws, c)];
}

/** 한 번 던진 결과(기구마다의 원시 값들) → 범주 번호 */
function catOf(p: SimParams, raw: number[]): number {
  if (p.device === 'coin') return p.n === 1 ? 1 - (raw[0] as number) : sum(raw);
  if (p.device === 'die') return sum(raw) - p.n;
  if (p.device === 'trial') return sum(raw);
  if (!multi(p)) return raw[0] as number;
  const ci = countIdx(p);
  return raw.filter((c) => c === ci).length - multiRange(p)[0];
}

/** 주머니의 공 하나하나(색 번호) */
const balls = (p: SimParams) =>
  (p.bag ?? []).flatMap((b, i) => Array.from({ length: b.count }, () => i));

/**
 * 모든 원시 결과와 그 무게(경우의 수) — 이론값을 세는 데 쓴다. 동전·주사위·한 번 꺼내기는 같은 확률의 결과를 늘어놓고,
 * 여러 번 꺼내기는 색의 순서마다 그 색 공을 고르는 가짓수를 곱하고, 성공 횟수는 a/b 를 b 칸 중 a 칸으로 본다.
 */
function weighted(p: SimParams): { raw: number[]; w: bigint }[] {
  const seqs = (k: number, sides: number[]) => {
    let all: number[][] = [[]];
    for (let j = 0; j < k; j++) all = all.flatMap((r) => sides.map((v) => [...r, v]));
    return all;
  };
  if (p.device === 'coin') return seqs(p.n, [0, 1]).map((raw) => ({ raw, w: 1n }));
  if (p.device === 'die') return seqs(p.n, [1, 2, 3, 4, 5, 6]).map((raw) => ({ raw, w: 1n }));
  if (p.device === 'trial') {
    const [a, b] = p.p as Q;
    return seqs(p.n, [0, 1]).map((raw) => ({
      raw,
      w: raw.reduce((acc, v) => acc * (v ? a : b - a), 1n),
    }));
  }
  const counts = (p.bag ?? []).map((b) => b.count);
  if (!multi(p)) return balls(p).map((c) => ({ raw: [c], w: 1n }));
  return seqs(
    p.draws,
    counts.map((_, i) => i),
  ).map((raw) => {
    const used = counts.map(() => 0);
    let w = 1n;
    for (const c of raw) {
      const left = (counts[c] as number) - (p.replace ? 0 : (used[c] as number));
      w *= BigInt(Math.max(0, left));
      used[c] = (used[c] as number) + 1;
    }
    return { raw, w };
  });
}

/** 표본평균의 이름: 소수 둘째 자리 안에서 끝나면 소수(3.5·2.25), 아니면 분수(7/3) */
function meanLabel(s: number, m: number): string {
  if ((s * 100) % m === 0) return String(s / m);
  return ratStr(div(qi(s), qi(m)));
}

const catCache = new WeakMap<SimParams, Cat[]>();
export function simCategories(p: SimParams): Cat[] {
  const hit = catCache.get(p);
  if (hit) return hit;
  let names: { label: string; short: string }[];
  const same = (l: string) => ({ label: l, short: l });
  if (p.device === 'coin')
    names = (p.n === 1 ? ['앞', '뒤'] : Array.from({ length: p.n + 1 }, (_, k) => `앞 ${k}개`)).map(
      same,
    );
  else if (p.device === 'die')
    names = Array.from({ length: 5 * p.n + 1 }, (_, k) =>
      same(p.sizes ? meanLabel(k + p.n, p.n) : String(k + p.n)),
    );
  else if (p.device === 'trial' || multi(p)) {
    const [lo, hi] = p.device === 'trial' ? [0, p.n] : multiRange(p);
    names = Array.from({ length: hi - lo + 1 }, (_, j) => ({
      label: `${what(p)} ${lo + j}번`,
      short: `${lo + j}번`,
    }));
  } else names = (p.bag ?? []).map((b) => same(b.label));
  const all = weighted(p);
  const total = all.reduce((a, o) => a + o.w, 0n);
  const hits = names.map(() => 0n);
  for (const o of all) {
    const c = catOf(p, o.raw);
    hits[c] = (hits[c] ?? 0n) + o.w;
  }
  const out = names.map((nm, i) => ({ ...nm, prob: div([hits[i] ?? 0n, 1n], [total, 1n]) }));
  catCache.set(p, out);
  return out;
}

const atCache = new WeakMap<SimParams, Map<number, SimParams>>();
/** 표본평균 실험에서 표본 크기 m 을 고른 매개변수(같은 m 이면 같은 객체 — 이론값 셈을 한 번만) */
export function simAt(p: SimParams, m: number): SimParams {
  if (!p.sizes?.includes(m)) return p;
  const by = atCache.get(p) ?? new Map<number, SimParams>();
  atCache.set(p, by);
  const out = by.get(m) ?? { ...p, n: m };
  by.set(m, out);
  return out;
}

/** 한 번 던지기. 동전은 0/1(1 = 앞), 주사위는 1~6, 주머니는 공 하나(다시 넣지 않으면 남은 공에서), 시행은 성공 1 */
function drawOnce(p: SimParams, rng: Rng, pool: number[]): number[] {
  if (p.device === 'coin') return Array.from({ length: p.n }, () => rng.int(0, 1));
  if (p.device === 'die') return Array.from({ length: p.n }, () => rng.int(1, 6));
  if (p.device === 'trial') {
    const [a, b] = (p.p as Q).map(Number) as [number, number];
    return Array.from({ length: p.n }, () => (rng.int(1, b) <= a ? 1 : 0));
  }
  if (!multi(p)) return rng.pick(pool.map((c) => [c]));
  if (p.replace) return Array.from({ length: p.draws }, () => rng.pick(pool));
  const left = [...pool];
  return Array.from(
    { length: p.draws },
    () => left.splice(rng.int(0, left.length - 1), 1)[0] as number,
  );
}

export const simInit = (p: SimParams): SimState => ({
  counts: simCategories(p).map(() => 0),
  trials: 0,
});

/** times 번 몰아 던지기(테스트·검사용). 화면은 기록(simAppend)으로 던진다 — 둘은 같은 난수를 같은 순서로 쓴다 */
export function simRun(p: SimParams, s: SimState, rng: Rng, times: number): SimState {
  const counts = [...s.counts];
  const pool = balls(p);
  for (let t = 0; t < times; t++) {
    const c = catOf(p, drawOnce(p, rng, pool));
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return { counts, trials: s.trials + times };
}

// ---- 기록과 되감기 ----

/** 기록 상한. 끝 속도(초당 약 80번)로 2분 — 되감기 손잡이 한 칸이 너무 잘아지지 않게, 기억 공간도 묶는다 */
export const SIM_MAX = 10000;

/** 던진 결과 전부(지우지 않는다). 같은 시드로 시작하므로 같은 횟수면 같은 기록 */
export interface SimHistory {
  raws: number[][];
  cats: number[];
  rng: Rng;
}

/** 새 기록. 표본평균은 크기마다 다른 줄기(크기를 바꿔도 앞 크기의 기록은 그대로 남는다) */
export const simHistory = (p: SimParams): SimHistory => ({
  raws: [],
  cats: [],
  rng: makeRng(p.sizes ? p.seed + (p.n - 1) * 7919 : p.seed),
});

/** k 번 더 던져 기록 끝에 잇는다. 실제로 던진 수(상한에 닿으면 그보다 적다) */
export function simAppend(p: SimParams, h: SimHistory, k: number): number {
  const pool = balls(p);
  const n = Math.max(0, Math.min(k, SIM_MAX - h.cats.length));
  for (let j = 0; j < n; j++) {
    const raw = drawOnce(p, h.rng, pool);
    h.raws.push(raw);
    h.cats.push(catOf(p, raw));
  }
  return n;
}

/** 기록 앞의 t 번만 센 범주별 횟수(되감기 자리 t) */
export function simCountsAt(p: SimParams, h: SimHistory, t: number): number[] {
  const counts = simCategories(p).map(() => 0);
  const end = Math.min(t, h.cats.length);
  for (let j = 0; j < end; j++) {
    const c = h.cats[j] as number;
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

// ---- 누르고 있기 ----

/** 처음 한 번 던진 뒤 이만큼 누르고 있어야 계속 던지기가 시작된다(짧게 누른 한 번이 두 번이 되지 않게) */
export const HOLD_FIRST = 380;

/**
 * 누른 지 ms 지났을 때 한 박자에 던질 수(k)와 다음 박자까지(wait). 시안 그대로 초당 약 7 → 33 → 83번.
 * 처음엔 하나하나 보이게 느리게, 오래 누르면 '많이 던지면 다가간다'가 보일 만큼 빠르게.
 */
export function holdPace(ms: number): { k: number; wait: number } {
  if (ms < 1400) return { k: 1, wait: 140 };
  if (ms < 2600) return { k: 2, wait: 60 };
  return { k: 5, wait: 60 };
}

export interface HoldClock {
  now(): number;
  /** ms 뒤에 fn. 돌려준 함수를 부르면 취소 */
  later(ms: number, fn: () => void): () => void;
}

/**
 * 누르고 있기 조절기. start 에서 바로 한 번(tick(1, true)), HOLD_FIRST 뒤부터 holdPace 박자로 tick(k, false).
 * tick 은 그림만 고치고(React 렌더 없음), 손을 떼거나(stop) tick 이 false(기록이 참)를 돌려주면 settle 을 한 번 부른다 —
 * 상태(React)는 settle 에서만 바뀐다(P8: 누르는 동안 렌더 0회). 이미 누르는 중이면 start 는 아무 일도 하지 않는다(P9).
 */
export function makeHold(
  clock: HoldClock,
  tick: (k: number, first: boolean) => boolean,
  settle: () => void,
) {
  let on = false;
  let cancel: (() => void) | null = null;
  let t0 = 0;
  const stop = () => {
    if (!on) return;
    on = false;
    cancel?.();
    cancel = null;
    settle();
  };
  const loop = () => {
    cancel = null;
    if (!on) return;
    const { k, wait } = holdPace(clock.now() - t0);
    if (!tick(k, false)) return stop();
    cancel = clock.later(wait, loop);
  };
  return {
    start() {
      if (on) return;
      on = true;
      t0 = clock.now();
      if (!tick(1, true)) return stop();
      cancel = clock.later(HOLD_FIRST, loop);
    },
    stop,
    get on() {
      return on;
    },
  };
}

// ---- 그림 ----

/** 막대 글자: 범주별 나온 비율·이론값·글자 */
export function simBars(p: SimParams, s: SimState) {
  return simCategories(p).map((c, i) => {
    const n = s.counts[i] ?? 0;
    const freq = s.trials ? n / s.trials : 0;
    return {
      label: c.label,
      short: c.short,
      freq,
      theory: Number(c.prob[0]) / Number(c.prob[1]),
      theoryText: ratStr(c.prob),
      text: `${n}번 (${Math.round(freq * 100)}%)`,
      pct: `${Math.round(freq * 100)}%`,
    };
  });
}

// ---- 좁고 낮은 화면(접은 화면 382×580) 배치 ----
// 넓은 화면은 결과마다 한 줄(이름·횟수·이론)인 세로 표라, 주사위 두 개(합 11가지)면 표만 330px 였다.
// 접은 화면은 결과를 열로 세운 가로 표(이름·비율·이론 세 줄)를 6열씩 끊어 쌓고, 그림도 낮춘다.

/** 막대그림 틀(viewBox 단위). 접은 화면은 막대 칸(BASE−TOP)만 줄이고 폭·글자 크기는 그대로 */
export function simFrame(compact: boolean) {
  return compact ? { W: 320, H: 136, TOP: 10, BASE: 112 } : { W: 320, H: 190, TOP: 16, BASE: 150 };
}

/** 던지기 단추의 글. 기구에 맞는 동사(주머니는 공을 '꺼낸다', 성공 횟수는 한 묶음을 '해 본다') */
export function simActLabel(p: SimParams): string {
  if (p.device === 'bag') return '꺼내기';
  if (p.device === 'trial') return '해 보기';
  return '던지기';
}

/** 가로 표의 묶음: 한 줄에 6열까지, 넘으면 줄 수를 늘려 고르게(11 → 6·5, 7 → 4·3) */
export function simBlocks(n: number): number[][] {
  const rows = Math.ceil(n / 6);
  const per = Math.ceil(n / rows);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: Math.min(per, n - r * per) }, (_, k) => r * per + k),
  );
}

/** 표를 둘 수 있는 결과 수. 표본평균(표본 4개 = 21가지)은 표가 네 겹이 되어 접은 화면을 넘으므로 그림만 */
export const SIM_TABLE_MAX = 12;

/** 접은 가로 표의 첫 칸 이름: 막대 이름이 짧은 이름(2번)이면 무엇을 센 것인지를 적는다 */
export function simAxis(p: SimParams): string {
  if (p.device === 'trial' || multi(p)) return what(p);
  if (p.sizes) return '평균';
  return '결과';
}

const X0 = 34;
const verb = (p: SimParams) =>
  p.device === 'bag' ? '꺼낸' : p.device === 'trial' ? '해 본' : '던진';

/** 마지막 결과 글: '앞 2개'·'합 7'·'평균 3.5'·'빨강 2번' */
function resultText(p: SimParams, cat: number): string {
  const c = simCategories(p)[cat];
  if (!c) return '';
  if (p.device === 'die') return `${p.sizes ? '평균' : p.n === 1 ? '눈' : '합'} ${c.label}`;
  return c.label;
}

/** 마지막 결과 그림의 한 칸 크기·한 줄 칸 수. 접은 화면 한 줄(던지기 단추 옆 약 120px)에 들게 */
export function simLastFrame(p: SimParams) {
  const g = p.device === 'bag' ? p.draws : p.n;
  const perRow = p.device === 'trial' ? 5 : 4;
  const s = g <= 2 ? 40 : p.device === 'trial' ? 16 : 26;
  const gap = s >= 26 ? 6 : 4;
  const cols = Math.min(g, perRow);
  const rows = Math.ceil(g / perRow);
  return { g, s, gap, cols, W: cols * s + (cols - 1) * gap, H: rows * s + (rows - 1) * gap };
}

/** 마지막 결과(되감은 자리의 결과) 그림: 동전 앞/뒤, 주사위 눈, 꺼낸 공의 색 이름 첫 글자, 시행은 성공 ●·실패 ○ */
function lastMarks(p: SimParams, raw: number[] | undefined): Mark[] {
  const { g, s, gap, cols } = simLastFrame(p);
  const out: Mark[] = [];
  for (let j = 0; j < g; j++) {
    const v = raw?.[j];
    const cx = (j % cols) * (s + gap) + s / 2;
    const cy = Math.floor(j / cols) * (s + gap) + s / 2;
    const idle = v === undefined ? ' idle' : '';
    // 동전 뒷면·시행 실패는 흐린 칸으로(글자 색도 같이 바꾸려고 글자에도 같은 표시를 붙인다)
    const back = (p.device === 'coin' || p.device === 'trial') && v === 0 ? ' back' : '';
    if (p.device === 'die') {
      out.push({
        k: `lc:${j}`,
        tag: 'rect',
        a: {
          x: cx - s / 2 + 1,
          y: cy - s / 2 + 1,
          width: s - 2,
          height: s - 2,
          rx: 6,
          class: `sim-die${idle}`,
        },
      });
    } else {
      const kind = p.device === 'coin' ? 'sim-coin' : p.device === 'trial' ? 'sim-hit' : 'sim-ball';
      out.push({
        k: `lc:${j}`,
        tag: 'circle',
        a: { cx, cy, r: s / 2 - 1.5, class: `${kind}${back}${idle}` },
      });
    }
    if (p.device === 'trial') continue;
    let text = '?';
    if (v !== undefined)
      text =
        p.device === 'coin'
          ? v
            ? '앞'
            : '뒤'
          : p.device === 'die'
            ? String(v)
            : ([...((p.bag ?? [])[v]?.label ?? '')][0] ?? '');
    out.push({
      k: `lt:${j}`,
      tag: 'text',
      a: { x: cx, y: cy + 5, class: `sim-lt${back}${idle}` },
      text,
    });
  }
  return out;
}

export interface SimDrawing extends Drawing {
  /** 마지막 결과 그림(던지기 단추 옆 작은 SVG) */
  last: Mark[];
}

/**
 * 기록 h 의 앞 t 번을 센 그림. 처음과 손을 뗀 뒤에는 React 가(Marks), 누르는 동안·되감는 동안에는 applyDrawing 이
 * 같은 목록을 쓴다. theory 가 false(질문을 맞히기 전)면 이론 점선을 목록에서 아예 뺀다 — 숨김(visibility)으로 두면
 * 점선의 높이가 그림 속에 정답으로 남는다(P3).
 */
export function simDraw(
  p: SimParams,
  h: SimHistory,
  t: number,
  o: { theory: boolean; compact: boolean },
): SimDrawing {
  const { W, TOP, BASE } = simFrame(o.compact);
  const total = h.cats.length;
  const s = { counts: simCountsAt(p, h, t), trials: Math.min(t, total) };
  const bars = simBars(p, s);
  // 막대 높이 축척은 이론값에서 정해 고정한다 — 던질 때마다 축척이 바뀌면 막대가 이론값에 다가가는 모습이 안 보인다.
  // 축척은 이론값을 숨겨도 같다: 축 글자(0·50·100%)만 보이고 어느 막대가 이론값인지는 드러나지 않는다
  const ymax = Math.min(1, Math.ceil(Math.max(...bars.map((b) => b.theory)) * 2 * 10) / 10);
  const bw = (W - X0 - 8) / bars.length;
  const y = (v: number) => r2(BASE - (Math.min(v, ymax) / ymax) * (BASE - TOP));
  const marks: Mark[] = [];
  [0, 0.5, 1].forEach((g, i) => {
    marks.push({
      k: `g:${i}`,
      tag: 'line',
      a: { x1: X0, y1: y(g * ymax), x2: W - 6, y2: y(g * ymax), class: 'sim-grid' },
    });
    marks.push({
      k: `ga:${i}`,
      tag: 'text',
      a: { x: X0 - 16, y: y(g * ymax) + 4, class: 'sim-ax' },
      text: `${Math.round(g * ymax * 100)}%`,
    });
  });
  const many = bars.length > SIM_TABLE_MAX;
  bars.forEach((b, i) => {
    const x = r2(X0 + i * bw + bw * 0.15);
    const w = r2(bw * 0.7);
    marks.push({
      k: `b:${i}`,
      tag: 'rect',
      a: { x, y: y(b.freq), width: w, height: r2(BASE - y(b.freq)), class: 'sim-bar' },
    });
    if (o.theory)
      marks.push({
        k: `t:${i}`,
        tag: 'line',
        a: {
          x1: r2(x - 3),
          y1: y(b.theory),
          x2: r2(x + w + 3),
          y2: y(b.theory),
          class: 'sim-theory',
        },
      });
    // 막대가 많으면(표본평균 21가지) 결과 이름이 겹쳐 정수 자리에만 둔다
    const show = !many || /^\d+$/.test(b.short);
    marks.push({
      k: `l:${i}`,
      tag: 'text',
      a: {
        x: r2(x + w / 2),
        y: BASE + 18,
        class: 'sim-lab',
        visibility: show ? 'visible' : 'hidden',
      },
      text: b.short,
    });
  });
  const raw = t > 0 ? h.raws[t - 1] : undefined;
  const idle =
    p.device === 'bag'
      ? '아직 안 꺼냈어요'
      : p.device === 'trial'
        ? '아직 안 해 봤어요'
        : '아직 안 던졌어요';
  const texts: Record<string, string> = {
    read: `${verb(p)} 횟수 ${s.trials}번`,
    cap:
      t > 0
        ? `${t === total ? '방금' : `${t}번째`} · ${resultText(p, h.cats[t - 1] as number)}`
        : idle,
    rew: t === total ? `${total}번` : `${t}/${total}번`,
  };
  bars.forEach((b, i) => {
    texts[`pct:${i}`] = b.pct;
    texts[`cnt:${i}`] = b.text;
  });
  return { marks, texts, last: lastMarks(p, raw) };
}

/** 손을 뗀 뒤 화면 낭독기가 한 번 읽을 글(던질 때마다 읽으면 시끄럽다) */
export function simSay(p: SimParams, h: SimHistory, t: number): string {
  if (t === 0) return '';
  const counts = simCountsAt(p, h, t);
  const cats = simCategories(p);
  const last = resultText(p, h.cats[t - 1] as number);
  return `${last}. ${verb(p)} 횟수 ${t}번. ${cats.map((c, i) => `${c.label}: ${counts[i]}번`).join(', ')}`;
}

// ---- 형식 검사·검산 ----

function bool(v: unknown, at: string): boolean {
  if (typeof v !== 'boolean') return fail(at, `true/false 가 아님 (${String(v)})`);
  return v;
}

export const simulateDef: WidgetDef<SimParams> = {
  parse(raw) {
    const device = oneOf((raw as { device?: unknown } | null)?.device, '확률 실험 device', [
      'coin',
      'die',
      'bag',
      'trial',
    ] as const);
    const opt: Record<typeof device, string[]> = {
      coin: ['n', 'goal'],
      die: ['n', 'goal', 'sizes'],
      bag: ['bag', 'goal', 'draws', 'replace', 'count'],
      trial: ['goal', 'label'],
    };
    const o = obj(
      raw,
      '확률 실험',
      device === 'trial' ? ['device', 'seed', 'p', 'n'] : ['device', 'seed'],
      opt[device],
    );
    const p: SimParams = {
      device,
      n: 1,
      draws: 1,
      replace: true,
      seed: int(o.seed, '확률 실험 seed', 0, 2 ** 31),
      goal: o.goal === undefined ? 100 : int(o.goal, '확률 실험 goal', 10, 10000),
    };
    if (o.n !== undefined) {
      if (o.sizes !== undefined)
        fail('확률 실험 sizes', '표본평균 실험은 n 대신 sizes 로 크기를 정함');
      p.n = int(o.n, '확률 실험 n', 1, device === 'coin' ? 4 : device === 'die' ? 2 : 10);
    }
    if (o.sizes !== undefined) {
      const sizes = arr(o.sizes, '확률 실험 sizes', 1, 4).map((v) =>
        int(v, '확률 실험 sizes', 1, 4),
      );
      if (sizes.some((v, i) => i > 0 && v <= (sizes[i - 1] as number)))
        fail('확률 실험 sizes', '겹치지 않게 작은 것부터');
      p.sizes = sizes;
      p.n = sizes[0] as number;
    }
    if (device === 'trial') {
      const pr = q(rationalStr(o.p, '확률 실험 p'));
      if (pr[0] <= 0n || pr[0] >= pr[1]) fail('확률 실험 p', '0 과 1 사이 분수여야 함');
      p.p = pr;
      if (o.label !== undefined) p.label = str(o.label, '확률 실험 label');
    }
    if (device === 'bag') {
      if (o.bag === undefined) fail('확률 실험', '주머니에는 bag 이 필요');
      p.bag = arr(o.bag, '확률 실험 bag', 2, 5).map((rb, i) => {
        const b = obj(rb, `확률 실험 bag${i + 1}`, ['label', 'count']);
        return {
          label: str(b.label, `확률 실험 bag${i + 1} label`),
          count: int(b.count, `확률 실험 bag${i + 1} count`, 1, 20),
        };
      });
      if (o.draws !== undefined) p.draws = int(o.draws, '확률 실험 draws', 1, 4);
      if (o.replace !== undefined) p.replace = bool(o.replace, '확률 실험 replace');
      const total = sum(p.bag.map((b) => b.count));
      if (p.draws === 1) {
        // 한 번만 꺼내면 다시 넣든 말든 같고 셀 색도 필요 없다 — 뜻 없는 칸이 조용히 무시되지 않게
        if (o.replace !== undefined)
          fail('확률 실험 replace', '한 번만 꺼내면 뜻이 없음(draws 2 이상에서)');
        if (o.count !== undefined)
          fail('확률 실험 count', '한 번만 꺼내면 뜻이 없음(draws 2 이상에서)');
      } else {
        if (o.count === undefined) fail('확률 실험 count', '여러 번 꺼내면 셀 색(count)이 필요');
        p.count = str(o.count, '확률 실험 count');
        if (countIdx(p) < 0) fail('확률 실험 count', `주머니에 없는 이름 (${p.count})`);
        if (!p.replace && p.draws > total)
          fail('확률 실험 draws', `다시 넣지 않으면 공 수(${total})보다 많이 못 꺼냄`);
        // sympy 쪽이 공 하나하나를 늘어놓아 세므로(공 수^꺼내는 수) 공 수를 묶는다
        if (total > 20) fail('확률 실험 bag', '여러 번 꺼낼 때 공은 20개까지');
      }
    }
    return p;
  },
  checks(p) {
    // sympy 쪽은 파이썬으로 모든 경우를 따로 늘어놓아 센다(앱의 늘어놓기와 독립)
    const one = (q: SimParams, name: (c: Cat) => string): WidgetCheck[] => {
      const cats = simCategories(q);
      const k = q.device === 'bag' ? q.draws : q.n;
      const vars = Array.from({ length: k }, (_, i) => `v${i}`);
      const loops = (range: string) => vars.map((v) => `for ${v} in ${range}`).join(' ');
      const vsum = vars.join('+');
      return cats.map((c, i): WidgetCheck => {
        let check: string;
        if (q.device === 'coin') {
          const heads = q.n === 1 ? 1 - i : i;
          check = `Rational(len([1 ${loops('range(2)')} if ${vsum} == ${heads}]), 2**${q.n})`;
        } else if (q.device === 'die') {
          check = `Rational(len([1 ${loops('range(1, 7)')} if ${vsum} == ${i + q.n}]), 6**${q.n})`;
        } else if (q.device === 'trial') {
          const [a, b] = q.p as Q;
          const pr = `Rational(${a}, ${b})`;
          const r = i;
          check = `sum(${pr}**(${vsum})*(1-${pr})**(${q.n}-(${vsum})) ${loops('range(2)')} if ${vsum} == ${r})`;
        } else if (!multi(q)) {
          const counts = (q.bag ?? []).map((b) => b.count);
          check = `Rational(${counts[i]}, ${counts.join('+')})`;
        } else {
          // 공 하나하나(색 번호 목록)를 늘어놓고, 다시 넣지 않으면 앞에서 꺼낸 공은 건너뛴다
          const B = `[${balls(q).join(',')}]`;
          const T = balls(q).length;
          const ci = countIdx(q);
          const r = i + multiRange(q)[0];
          const gen = vars
            .map((v, j) =>
              q.replace || j === 0
                ? `for ${v} in range(${T})`
                : `for ${v} in range(${T}) if ${v} not in (${vars.slice(0, j).join(', ')},)`,
            )
            .join(' ');
          const hits = vars.map((v) => `(${B}[${v}] == ${ci})`).join('+');
          check = `Rational(len([1 ${gen} if ${hits} == ${r}]), ${q.replace ? `${T}**${q.draws}` : `ff(${T}, ${q.draws})`})`;
        }
        return { name: name(c), answer: ratStr(c.prob), answerType: 'fraction', check };
      });
    };
    if (p.sizes)
      return p.sizes.flatMap((m) => one(simAt(p, m), (c) => `이론값 표본 ${m}개 평균 ${c.label}`));
    return one(p, (c) => `이론값 ${c.label}`);
  },
  texts: (p) => [...(p.bag ?? []).map((b) => b.label), ...(p.label ? [p.label] : [])],
};
