// 경우의 수 부품의 모델(순수). 화면(Count.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 공식으로 세기 전에 손으로 하나씩 만들어 보게 한다. 2026-11-23(결정 D1)부터 움직임이 곧 수학인 셋은 직접 조작이다:
//   순서 있는 나열(list) = 칩을 줄에 세우고 자리 바꾸기 — 줄이 화면에 남아 있어 "둘만 바꾸면 새 줄"이 손에 잡힌다
//   두 개 고르기(pick k=2) = 두 점을 선으로 잇기 — 선에는 방향이 없어 반대로 그어도 같은 선이라는 게 눈에 보인다
//   벤 다이어그램(venn) = 원소 카드를 영역으로 끌어 분류 — 수마다 "A 인가, B 인가"를 학생이 판단한다
// 나머지(셋 이상 고르기·중복 나열·수형도·파스칼)는 옮길 뜻이 없어 누르기 그대로다(원칙 P1).
// 판정은 손을 뗀 자리에서만 한다(P3): 화면은 놓은 좌표를 lSpotAt·pHit·vRegionAt 에 넘기고 결과를 lMove·cLink·vPut 에 넘긴다.
// 전체 개수는 모델이 직접 다 늘어놓아 세고, checks 가 그 수를 sympy 의 공식(ff·binomial·거듭제곱)과 대조한다.
import { arr, fail, int, obj, oneOf, str } from '../parse.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export type CMode = 'list' | 'pick' | 'repeat' | 'tree' | 'pascal' | 'venn';
export interface CountParams {
  mode: CMode;
  items?: string[];
  k?: number;
  /** tree: 같은 것을 다시 고를 수 있나 */
  repeat?: boolean;
  rows?: number;
  /** u: 전체집합(없으면 a∪b 만 분류하고 여집합은 보이지 않는다) */
  sets?: { names: [string, string]; a: string[]; b: string[]; u?: string[] };
}
/** 벤 다이어그램의 네 영역: a 에만 · 둘 다 · b 에만 · 둘 다 아님(전체집합 안, 두 원 밖) */
export type VReg = 'a' | 'ab' | 'b' | 'out';
export interface CState {
  /** 누르기로 고르는 중인 물건 번호들(누르기 나열·선 잇기 '눌러서 하기') */
  sel: number[];
  /** 찾은 경우(정규화한 키) */
  found: string[];
  /** 수형도에서 펼친 단계 수 */
  open: number;
  /** 파스칼 마지막 줄에서 연 칸 */
  rev: boolean[];
  /** 줄 세우기: 자리마다 선 물건 번호(빈자리 null) */
  seat: (number | null)[];
  /** 벤: 원소(vElems 차례)마다 놓인 영역, 아직 더미면 null */
  where: (VReg | null)[];
  /** 벤: 영역에 놓인 차례(원소 번호) — 같은 칸 안의 자리 순서를 정한다 */
  order: number[];
  /** 벤: '확인하기'에서 틀린 원소 번호. 그 카드를 옮기면 빠진다 */
  wrong: number[];
  /** 벤: 다 넣고 확인해 모두 맞음 */
  solved: boolean;
}

const ordered = (p: CountParams) => p.mode !== 'pick';
const repeats = (p: CountParams) => p.mode === 'repeat' || (p.mode === 'tree' && !!p.repeat);

/** 모든 경우를 늘어놓는다(정규화한 키 목록) */
export function cAll(p: CountParams): string[] {
  const n = p.items?.length ?? 0;
  const k = p.k ?? 0;
  const out = new Set<string>();
  const go = (cur: number[]) => {
    if (cur.length === k) {
      out.add(keyOf(p, cur));
      return;
    }
    for (let i = 0; i < n; i++) if (repeats(p) || !cur.includes(i)) go([...cur, i]);
  };
  go([]);
  return [...out];
}
const keyOf = (p: CountParams, sel: number[]) =>
  (ordered(p) ? sel : [...sel].sort((a, b) => a - b)).join(',');
export const cTotal = (p: CountParams) => cAll(p).length;

export function cInit(p: CountParams): CState {
  return {
    sel: [],
    found: [],
    open: 0,
    rev: Array.from({ length: (p.rows ?? 0) + 1 }, () => false),
    seat: Array.from({ length: p.mode === 'list' ? (p.k ?? 0) : 0 }, () => null),
    where: p.mode === 'venn' ? vElems(p).map(() => null) : [],
    order: [],
    wrong: [],
    solved: false,
  };
}

/** 어떤 조작으로 그리나. 셋 이상 고르기·중복 나열은 선이나 자리 바꾸기로 나타낼 수 없어 누르기(tap)로 남는다 */
export function viewOf(p: CountParams): 'line' | 'pair' | 'venn' | 'tree' | 'pascal' | 'tap' {
  if (p.mode === 'list') return 'line';
  if (p.mode === 'pick' && p.k === 2) return 'pair';
  if (p.mode === 'venn' || p.mode === 'tree' || p.mode === 'pascal') return p.mode;
  return 'tap';
}

export type TapResult = 'add' | 'new' | 'dup' | 'skip';

/** 물건 i 를 누름. k 개가 차면 한 경우로 확인하고 고른 것을 비운다 */
export function cTap(p: CountParams, s: CState, i: number): { s: CState; res: TapResult } {
  if (!repeats(p) && s.sel.includes(i)) return { s, res: 'skip' };
  const sel = [...s.sel, i];
  if (sel.length < (p.k ?? 0)) return { s: { ...s, sel }, res: 'add' };
  const key = keyOf(p, sel);
  if (s.found.includes(key)) return { s: { ...s, sel: [] }, res: 'dup' };
  return { s: { ...s, sel: [], found: [...s.found, key] }, res: 'new' };
}

/** 경우 키 → 화면 글자. 영문·숫자 한 글자 이름이면 붙여 쓰고(AB), 아니면 순서는 →, 고르기는 · 로 */
export function cLabel(p: CountParams, key: string): string {
  const names = key.split(',').map((i) => p.items?.[Number(i)] ?? '?');
  if (names.every((x) => /^[A-Za-z0-9]$/.test(x)) && ordered(p)) return names.join('');
  return names.join(ordered(p) ? ' → ' : ' · ');
}

/** 수형도: 단계별 가지(부모 번호·물건 번호) */
export function cTree(p: CountParams): {
  /** id = 뿌리에서 그 가지까지 고른 물건 번호(화면 key 로 쓴다) */
  levels: { parent: number; item: number; id: string }[][];
  leaves: number;
} {
  const n = p.items?.length ?? 0;
  const levels: { parent: number; item: number; path: number[] }[][] = [];
  let prev: { path: number[] }[] = [{ path: [] }];
  for (let d = 0; d < (p.k ?? 0); d++) {
    const lv: { parent: number; item: number; path: number[] }[] = [];
    prev.forEach((node, pi) => {
      for (let i = 0; i < n; i++)
        if (repeats(p) || !node.path.includes(i))
          lv.push({ parent: pi, item: i, path: [...node.path, i] });
    });
    levels.push(lv);
    prev = lv;
  }
  return {
    levels: levels.map((lv) =>
      lv.map(({ parent, item, path }) => ({ parent, item, id: path.join('-') })),
    ),
    leaves: prev.length,
  };
}

/** 파스칼 삼각형(0행부터 rows 행까지). 각 수는 위 두 수의 합으로만 만든다 */
export function cPascal(rows: number): number[][] {
  const t: number[][] = [[1]];
  for (let r = 1; r <= rows; r++) {
    const up = t[r - 1] as number[];
    t.push(Array.from({ length: r + 1 }, (_, j) => (up[j - 1] ?? 0) + (up[j] ?? 0)));
  }
  return t;
}

export function cVenn(p: CountParams) {
  const a = p.sets?.a ?? [];
  const b = p.sets?.b ?? [];
  const both = a.filter((x) => b.includes(x));
  return {
    only: { a: a.filter((x) => !b.includes(x)), b: b.filter((x) => !a.includes(x)) },
    both,
    union: a.length + b.length - both.length,
  };
}

export function cDone(p: CountParams, s: CState): boolean {
  switch (p.mode) {
    case 'list':
    case 'pick':
    case 'repeat':
      return s.found.length === cTotal(p);
    case 'tree':
      return s.open >= (p.k ?? 0);
    case 'pascal':
      return s.rev.every(Boolean);
    case 'venn':
      return s.solved;
  }
}

// ---- 줄 세우기(list): 칩을 줄에 세우고 자리 바꾸기 ----

/** 줄 세우기·선 잇기·벤 판의 폭(그림 단위). 접은 화면 382px 의 카드 안쪽 폭과 같아 거기서 1단위 = 1px */
export const L_W = 298;
/** 칩을 끌어 놓을 자리 판정에서 자리 상자 위아래로 더 봐 주는 여유(손가락이 자리 가장자리에 걸쳐도) */
const SEAT_SLOP = 14;

export interface LGeom {
  /** 칩 한 변. 44px(누르는 칸 최소) 아래로 내려가지 않는다 */
  chip: number;
  /** 자리 틀 한 변(칩보다 조금 크게) */
  box: number;
  waitX: number[];
  waitY: number;
  /** 줄 밖(기다리는 곳) 띠의 위·아래 */
  waitTop: number;
  waitBottom: number;
  seatX: number[];
  seatY: number;
  /** 판 높이 */
  h: number;
}

/** 물건 n 개·자리 k 개의 판. 물건이 많아도 한 줄에 들게 칩을 줄이되 44 아래로는 줄이지 않는다(형식이 n ≤ 6 을 막는다) */
export function lGeom(n: number, k: number): LGeom {
  const chip = Math.max(44, Math.min(56, Math.floor((L_W - (n - 1) * 6) / n)));
  const box = chip + 8;
  const row = (m: number, gap: number) =>
    Array.from({ length: m }, (_, i) => L_W / 2 + (i - (m - 1) / 2) * gap);
  const waitGap = n > 1 ? Math.min(78, (L_W - chip) / (n - 1)) : 0;
  const seatGap = k > 1 ? Math.min(box + 14, (L_W - box) / (k - 1)) : 0;
  const waitTop = 18;
  const waitBottom = waitTop + box;
  const seatY = waitBottom + 30 + box / 2;
  return {
    chip,
    box,
    waitX: row(n, waitGap),
    waitY: waitTop + box / 2,
    waitTop,
    waitBottom,
    seatX: row(k, seatGap),
    seatY,
    h: seatY + box / 2 + 22,
  };
}

/** 놓은 자리(판 좌표) → 몇째 자리 · 줄 밖 · 판 밖(null = 제자리로) */
export function lSpotAt(g: LGeom, x: number, y: number): number | 'wait' | null {
  const half =
    g.seatX.length > 1
      ? Math.min(((g.seatX[1] as number) - (g.seatX[0] as number)) / 2, g.box / 2 + 10)
      : g.box / 2 + 10;
  if (Math.abs(y - g.seatY) <= g.box / 2 + SEAT_SLOP) {
    const s = g.seatX.findIndex((sx) => Math.abs(x - sx) <= half);
    if (s >= 0) return s;
  }
  if (x >= -10 && x <= L_W + 10 && y >= g.waitTop - 30 && y <= g.waitBottom + 12) return 'wait';
  return null;
}

export type LRes = 'none' | 'move' | 'new' | 'dup';

/**
 * 물건 i 를 자리 to(몇째) 또는 줄 밖('wait')으로. 줄 안끼리는 두 자리가 맞바뀌고, 줄 밖에서 찬 자리로 들어오면
 * 원래 있던 것은 줄 밖으로 나간다. 옮긴 뒤 자리가 다 찼으면 그 순서를 한 경우로 본다: 새 줄이면 적고(new),
 * 이미 있으면 적지 않는다(dup — 자리는 바뀐 채로 둔다. 학생이 바로 다음 줄을 만들어 가게).
 * 다 찾은 뒤에는 더 적지 않는다(move).
 */
export function lMove(
  p: CountParams,
  s: CState,
  i: number,
  to: number | 'wait',
): { s: CState; res: LRes; key?: string } {
  const from = s.seat.indexOf(i);
  const seat = [...s.seat];
  if (to === 'wait') {
    if (from < 0) return { s, res: 'none' };
    seat[from] = null;
  } else {
    if (from === to) return { s, res: 'none' };
    const q = seat[to] ?? null;
    seat[to] = i;
    if (from >= 0) seat[from] = q;
  }
  const n = { ...s, seat };
  if (seat.some((x) => x === null) || cDone(p, s)) return { s: n, res: 'move' };
  const key = seat.join(',');
  if (s.found.includes(key)) return { s: n, res: 'dup', key };
  return { s: { ...n, found: [...s.found, key] }, res: 'new', key };
}

/** 첫째 자리에 올 수 있는 가짓수, 둘째, … — 다 찾은 뒤 "첫째 4 × 둘째 3" 으로 보인다(곱 = 모든 경우, 검산은 ff) */
export function lFactors(p: CountParams): number[] {
  const n = p.items?.length ?? 0;
  return Array.from({ length: p.k ?? 0 }, (_, j) => n - j);
}

/** 다 찾은 줄을 첫째 자리의 물건별로 묶는다(물건 차례). 묶음 안은 사전 차례 — 묶음 수 × 크기 = 곱의 모양 */
export function lGroups(p: CountParams, found: string[]): { head: number; keys: string[] }[] {
  const idx = (k: string) => k.split(',').map(Number);
  const cmp = (a: string, b: string) => {
    const x = idx(a);
    const y = idx(b);
    for (let i = 0; i < x.length; i++)
      if (x[i] !== y[i]) return (x[i] as number) - (y[i] as number);
    return 0;
  };
  return (p.items ?? [])
    .map((_, head) => ({ head, keys: found.filter((k) => idx(k)[0] === head).sort(cmp) }))
    .filter((g) => g.keys.length);
}

// ---- 선 잇기(pick k=2) ----

/** 점 반지름. 지름 54 — 누르는 칸 44 이상 */
const P_R = 27;
export interface PGeom {
  w: number;
  h: number;
  r: number;
  pos: [number, number][];
}

/**
 * 점 n 개를 정다각형 꼭짓점에(모두 같은 자격으로 보이게 — 대각선도 한 쌍이다). 넷은 네 모서리, 여섯은 평평한
 * 육각형(위아래가 낮아 판이 덜 높다). 첫 점이 왼쪽 위에서 시계 방향으로 놓여 이름 차례가 읽힌다.
 */
export function pGeom(n: number): PGeom {
  const w = L_W;
  // 200: 판 아래 찾은 목록(15쌍까지)·완료 글 두 줄·보기 단추가 접은 화면 한 장에 들게(214 에서 줄임)
  const h = 200;
  const start = ({ 2: 180, 3: -90, 4: -135, 5: -90, 6: -120 } as Record<number, number>)[n] ?? -90;
  const unit = Array.from({ length: n }, (_, i) => {
    const t = ((start + (i * 360) / n) * Math.PI) / 180;
    return [Math.cos(t), Math.sin(t)] as [number, number];
  });
  const xs = unit.map((u) => u[0]);
  const ys = unit.map((u) => u[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const m = P_R + 8;
  const rho = Math.min(90, bw ? (w - 2 * m) / bw : 90, bh ? (h - 2 * m) / bh : 90);
  const cx = w / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * rho;
  const cy = h / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * rho;
  return { w, h, r: P_R, pos: unit.map(([x, y]) => [cx + x * rho, cy + y * rho]) };
}

/** 손 뗀 자리에서 가장 가까운 점(반지름 + 10 안). 시작한 점(except)은 빼고, 없으면 −1 */
export function pHit(g: PGeom, x: number, y: number, except: number): number {
  let best = -1;
  let bd = g.r + 10;
  g.pos.forEach(([px, py], i) => {
    const d = Math.hypot(x - px, y - py);
    if (i !== except && d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** 두 점 a·b 를 잇는다. 선에는 방향이 없어 키는 작은 번호부터 — b→a 로 그어도 같은 선(dup) */
export function cLink(
  p: CountParams,
  s: CState,
  a: number,
  b: number,
): { s: CState; res: 'new' | 'dup' | 'self'; key?: string } {
  if (a === b) return { s, res: 'self' };
  const key = keyOf(p, [a, b]);
  if (s.found.includes(key)) return { s, res: 'dup', key };
  return { s: { ...s, found: [...s.found, key] }, res: 'new', key };
}

/** 점마다 이은 선 수. 다 이으면 모두 n−1 — "점마다 n−1 개 × n 개 ÷ 2" 가 그림에서 읽힌다 */
export function pDegree(p: CountParams, found: string[]): number[] {
  const d = (p.items ?? []).map(() => 0);
  for (const k of found) for (const i of k.split(',')) d[Number(i)] = (d[Number(i)] as number) + 1;
  return d;
}

// ---- 벤 분류(venn) ----

/** 벤 판(전체집합 사각형) 크기와 두 원. 원이 크고 많이 겹쳐야 겹친 곳에도 카드가 여럿 선다 */
export const V_W = L_W;
export const V_H = 260;
export const V_A = { cx: 101, cy: 112, r: 96 };
export const V_B = { cx: 197, cy: 112, r: 96 };
/** 판 아래 더미 줄의 높이(카드 더미·남은 수·확인하기) */
export const V_DECK = 56;
/** 카드 한 변(누르는 칸 최소)과 카드 사이 간격 */
export const V_CARD = 44;
const V_STEP = 48;
const V_PAD = 4;
/** 판 맨 위 이름 띠(두 집합 이름·U) — 카드 자리를 두지 않는다 */
export const V_TOP = 22;
/** 카드 가운데가 원 둘레에서 이만큼은 떨어져야 그 칸 자리로 친다(둘레에 걸친 카드가 어느 칸인지 헷갈리지 않게) */
const V_EDGE = 12;

/** 분류할 원소: 전체집합(없으면 a∪b). 수면 수 차례, 아니면 가나다 — a 다음 b 차례로 두면 답이 드러난다 */
export function vElems(p: CountParams): string[] {
  const st = p.sets;
  if (!st) return [];
  const xs = st.u ?? [...new Set([...st.a, ...st.b])];
  const num = xs.every((x) => /^-?\d+(\.\d+)?$/.test(x));
  return [...xs].sort((a, b) => (num ? Number(a) - Number(b) : a.localeCompare(b, 'ko')));
}

export function vTruth(p: CountParams, x: string): VReg {
  const inA = p.sets?.a.includes(x) ?? false;
  const inB = p.sets?.b.includes(x) ?? false;
  return inA && inB ? 'ab' : inA ? 'a' : inB ? 'b' : 'out';
}

const regOf = (x: number, y: number, edge: number): VReg | null => {
  const da = Math.hypot(x - V_A.cx, y - V_A.cy);
  const db = Math.hypot(x - V_B.cx, y - V_B.cy);
  const inA = da <= V_A.r - edge;
  const outA = da >= V_A.r + edge;
  const inB = db <= V_B.r - edge;
  const outB = db >= V_B.r + edge;
  if (inA && inB) return 'ab';
  if (inA && outB) return 'a';
  if (inB && outA) return 'b';
  if (outA && outB) return 'out';
  return null;
};

/** 놓은 자리(판 좌표) → 영역. 판 아래 더미 줄이면 'deck'(더미로 되돌리기), 판 밖이면 null(제자리로) */
export function vRegionAt(x: number, y: number): VReg | 'deck' | null {
  if (y > V_H && y <= V_H + V_DECK + 10 && x >= -10 && x <= V_W + 10) return 'deck';
  if (x < 0 || x > V_W || y < 0 || y > V_H) return null;
  return regOf(x, y, 0);
}

let slotCache: Record<VReg, [number, number][]> | null = null;

/**
 * 영역마다 카드가 설 자리(가운데 좌표), 먼저 채울 것부터. 2026-11-23 시안에서는 자리보다 많이 넣으면 같은 줄에서
 * 간격을 좁혀 카드가 서로 가렸다 — 여기서는 줄(48 간격)마다 그 영역에 드는 구간을 재서 들어가는 만큼만 자리를
 * 만들고, 다른 영역 자리와 겹치는 것은 뺀다. 자리가 다 차면 그 칸에는 더 넣지 못한다(vPut 'full').
 * 칸 크기는 문제와 상관없는 그림의 모양이라 답을 흘리지 않는다(형식 검사가 정답 개수 ≤ 자리 수를 확인).
 */
export function vSlots(): Record<VReg, [number, number][]> {
  if (slotCache) return slotCache;
  const half = V_CARD / 2;
  const rowsFor = (reg: VReg, y0: number) => {
    const out: [number, number][] = [];
    for (let y = y0 + half + V_TOP; y + half <= V_H - V_PAD; y += V_STEP) {
      const runs: [number, number][] = [];
      for (let x = half + V_PAD; x <= V_W - half - V_PAD; x++) {
        if (regOf(x, y, V_EDGE) !== reg) continue;
        const run = runs.at(-1);
        if (run && run[1] === x - 1) run[1] = x;
        else runs.push([x, x]);
      }
      for (const [a, b] of runs) {
        const m = Math.floor((b - a) / V_STEP) + 1;
        for (let i = 0; i < m; i++) out.push([(a + b) / 2 + (i - (m - 1) / 2) * V_STEP, y]);
      }
    }
    return out;
  };
  const clash = (a: [number, number], b: [number, number]) =>
    Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) < V_CARD + 2;
  const taken: [number, number][] = [];
  const res = {} as Record<VReg, [number, number][]>;
  // 좁은 칸(겹친 곳)부터 자리를 잡는다 — 넓은 칸이 먼저 잡으면 겹친 곳이 1~2자리로 줄어든다
  for (const reg of ['ab', 'a', 'b', 'out'] as const) {
    let best: [number, number][] = [];
    for (let y0 = 0; y0 < V_STEP; y0 += 2) {
      const c = rowsFor(reg, y0).filter((s) => !taken.some((t) => clash(s, t)));
      if (c.length > best.length) best = c;
    }
    const mx = best.reduce((a, s) => a + s[0], 0) / (best.length || 1);
    const my = best.reduce((a, s) => a + s[1], 0) / (best.length || 1);
    best.sort(
      (s, t) =>
        Math.hypot(s[0] - mx, s[1] - my) - Math.hypot(t[0] - mx, t[1] - my) ||
        s[1] - t[1] ||
        s[0] - t[0],
    );
    res[reg] = best;
    taken.push(...best);
  }
  slotCache = res;
  return res;
}

/** 원소 e(vElems 차례)를 영역 to 로, null 이면 더미로. 그 칸 자리가 다 찼으면 'full'(상태 그대로) */
export function vPut(
  _p: CountParams,
  s: CState,
  e: number,
  to: VReg | null,
): { s: CState; res: 'move' | 'full' | 'none' } {
  const from = s.where[e] ?? null;
  if (from === to || s.solved) return { s, res: 'none' };
  if (to && s.where.filter((w) => w === to).length >= vSlots()[to].length)
    return { s, res: 'full' };
  const where = [...s.where];
  where[e] = to;
  const order = s.order.filter((x) => x !== e).concat(to ? [e] : []);
  // 옮긴 카드는 틀림 표시를 지운다 — 다시 '확인하기'로만 판정(놓는 순간에는 아무 신호도 없다)
  return { s: { ...s, where, order, wrong: s.wrong.filter((x) => x !== e) }, res: 'move' };
}

/** 원소 e 카드의 자리(판 좌표). 더미면 판 아래 왼쪽 더미 자리 */
export function vPos(p: CountParams, s: CState, e: number): [number, number] {
  const w = s.where[e] ?? null;
  if (!w) {
    const deck = vDeck(p, s);
    const d = Math.min(Math.max(deck.indexOf(e), 0), 2);
    return [V_CARD / 2 + V_PAD + d * 2, V_H + V_DECK / 2 + 2 - d * 2];
  }
  const inReg = s.order.filter((x) => s.where[x] === w);
  return vSlots()[w][inReg.indexOf(e)] as [number, number];
}

/** 더미에 남은 원소(맨 앞이 맨 위 — 맨 위 한 장만 끌 수 있다) */
export function vDeck(p: CountParams, s: CState): number[] {
  return vElems(p)
    .map((_, i) => i)
    .filter((i) => (s.where[i] ?? null) === null);
}

/** '확인하기': 더미가 비었을 때만. 틀린 카드 번호를 적고, 하나도 없으면 다 맞음(solved) */
export function vCheck(p: CountParams, s: CState): { s: CState } {
  if (vDeck(p, s).length || s.solved) return { s };
  const el = vElems(p);
  const wrong = el.map((x, i) => (s.where[i] === vTruth(p, x) ? -1 : i)).filter((i) => i >= 0);
  return { s: { ...s, wrong, solved: wrong.length === 0 } };
}

/** 영역별 정답 개수와 합집합·여집합 수. 화면의 결론 글이 이 값을 쓰고 checks 가 sympy 로 다시 센다 */
export function vCounts(p: CountParams): {
  a: number;
  ab: number;
  b: number;
  out: number;
  nA: number;
  nB: number;
  union: number;
  u?: number;
  compA?: number;
} {
  const el = vElems(p);
  const cnt = (r: VReg) => el.filter((x) => vTruth(p, x) === r).length;
  const v = cVenn(p);
  const nA = p.sets?.a.length ?? 0;
  const base = {
    a: cnt('a'),
    ab: cnt('ab'),
    b: cnt('b'),
    out: cnt('out'),
    nA,
    nB: p.sets?.b.length ?? 0,
    union: v.union,
  };
  const u = p.sets?.u?.length;
  return u === undefined ? base : { ...base, u, compA: u - nA };
}

// ---- 형식 검사·검산 ----

const MAX_CASES = 24;

export const countDef: WidgetDef<CountParams> = {
  parse(raw) {
    const mode = oneOf((raw as { mode?: unknown } | null)?.mode, '경우의 수 mode', [
      'list',
      'pick',
      'repeat',
      'tree',
      'pascal',
      'venn',
    ] as const);
    if (mode === 'pascal') {
      const o = obj(raw, '경우의 수', ['mode', 'rows']);
      return { mode, rows: int(o.rows, '경우의 수 rows', 1, 8) };
    }
    if (mode === 'venn') {
      const o = obj(raw, '경우의 수', ['mode', 'sets']);
      const st = obj(o.sets, '경우의 수 sets', ['names', 'a', 'b'], ['u']);
      const names = arr(st.names, '경우의 수 names', 2, 2).map((x, i) =>
        str(x, `경우의 수 이름${i + 1}`),
      );
      const list = (v: unknown, at: string, max: number) => {
        const xs = arr(v, at, 1, max).map((x, i) => str(x, `${at}${i + 1}`));
        if (new Set(xs).size !== xs.length) fail(at, '원소 중복');
        return xs;
      };
      const a = list(st.a, '경우의 수 a', 8);
      const b = list(st.b, '경우의 수 b', 8);
      const u = st.u === undefined ? undefined : list(st.u, '경우의 수 u', 16);
      if (u && [...a, ...b].some((x) => !u.includes(x)))
        fail('경우의 수 u', '전체집합이 a·b 의 원소를 모두 품지 않음');
      const p: CountParams = {
        mode,
        sets: { names: [names[0] as string, names[1] as string], a, b, ...(u ? { u } : {}) },
      };
      // 카드는 칸마다 정해진 자리에만 선다(겹쳐 가리지 않게) — 정답대로 넣었을 때 자리가 모자라면 끝낼 수 없다
      const slots = vSlots();
      const c = vCounts(p);
      for (const r of ['a', 'ab', 'b', 'out'] as const)
        if (c[r] > slots[r].length)
          fail(
            '경우의 수 sets',
            `${r} 칸 원소 ${c[r]}개가 그림의 자리 ${slots[r].length}개보다 많음`,
          );
      return p;
    }
    const o = obj(raw, '경우의 수', ['mode', 'items', 'k'], mode === 'tree' ? ['repeat'] : []);
    const items = arr(o.items, '경우의 수 items', 2, 6).map((x, i) =>
      str(x, `경우의 수 물건${i + 1}`),
    );
    if (new Set(items).size !== items.length) fail('경우의 수 items', '이름 중복');
    const rep = mode === 'repeat' || (mode === 'tree' && o.repeat === true);
    if (o.repeat !== undefined && typeof o.repeat !== 'boolean')
      fail('경우의 수 repeat', 'true/false 만');
    const k = int(o.k, '경우의 수 k', 1, rep ? 4 : items.length);
    const p: CountParams = {
      mode,
      items,
      k,
      ...(mode === 'tree' && o.repeat === true ? { repeat: true } : {}),
    };
    const total = mode === 'tree' ? cTree(p).leaves : cTotal(p);
    if (total > MAX_CASES)
      fail(
        '경우의 수',
        `경우가 너무 많아 손으로 다 찾기 어려움 (${total}가지, ${MAX_CASES}가지까지)`,
      );
    return p;
  },
  checks(p) {
    const out: WidgetCheck[] = [];
    if (p.mode === 'pascal') {
      const rows = p.rows ?? 0;
      const last = cPascal(rows).at(-1) as number[];
      last.forEach((v, j) => {
        out.push({
          name: `${rows}행 ${j}번째`,
          answer: String(v),
          answerType: 'int',
          check: `binomial(${rows}, ${j})`,
        });
      });
      out.push({
        name: `${rows}행 합`,
        answer: String(last.reduce((a, b) => a + b, 0)),
        answerType: 'int',
        check: `Integer(2)**${rows}`,
      });
      return out;
    }
    if (p.mode === 'venn') {
      const s = p.sets as NonNullable<CountParams['sets']>;
      const names = [...new Set([...s.a, ...s.b, ...(s.u ?? [])])];
      const fs = (xs: string[]) => `FiniteSet(${xs.map((x) => names.indexOf(x)).join(', ')})`;
      const v = cVenn(p);
      out.push({
        name: '합집합',
        answer: String(v.union),
        answerType: 'int',
        check: `len(${fs(s.a)} | ${fs(s.b)})`,
      });
      out.push({
        name: '교집합',
        answer: String(v.both.length),
        answerType: 'int',
        check: `len(${fs(s.a)} & ${fs(s.b)})`,
      });
      // 전체집합이 있을 때만 화면에 보이는 수(칠한 여집합의 원소 수, 두 원 밖 원소 수)
      if (s.u) {
        const c = vCounts(p);
        const U = fs(s.u);
        out.push({
          name: '여집합',
          answer: String(c.compA),
          answerType: 'int',
          check: `len(${U} - ${fs(s.a)})`,
        });
        out.push({
          name: '밖',
          answer: String(c.out),
          answerType: 'int',
          check: `len(${U} - (${fs(s.a)} | ${fs(s.b)}))`,
        });
      }
      return out;
    }
    const n = p.items?.length ?? 0;
    const k = p.k ?? 0;
    const formula = repeats(p)
      ? `Integer(${n})**${k}`
      : ordered(p)
        ? `ff(${n}, ${k})`
        : `binomial(${n}, ${k})`;
    const total = p.mode === 'tree' ? cTree(p).leaves : cTotal(p);
    out.push({ name: '모든 경우', answer: String(total), answerType: 'int', check: formula });
    return out;
  },
  texts: (p) => [
    ...(p.items ?? []),
    ...(p.sets ? [...p.sets.names, ...p.sets.a, ...p.sets.b, ...(p.sets.u ?? [])] : []),
  ],
};
