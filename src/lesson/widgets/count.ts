// 경우의 수 부품의 모델(순수). 화면(Count.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 공식으로 세기 전에 손으로 하나씩 만들어 보게 한다. 2026-11-23(결정 D1)부터 움직임이 곧 수학인 셋은 직접 조작이다:
//   순서 있는 나열(list) = 칩을 자리에 세우고 자리 바꾸기 — 배치가 화면에 남아 있어 "둘만 바꾸면 새 경우"가 손에 잡힌다
//   두 개 고르기(pick k=2) = 두 개를 선으로 잇기 — 선에는 방향이 없어 반대로 그어도 같은 짝이라는 게 눈에 보인다
//   벤 다이어그램(venn) = 원소 카드를 영역으로 끌어 분류 — 수마다 "A 인가, B 인가"를 학생이 판단한다
// 나머지(셋 이상 고르기·중복 나열·수형도·파스칼)는 옮길 뜻이 없어 누르기 그대로다(원칙 P1).
// 판정은 손을 뗀 자리에서만 한다(P3): 화면은 놓은 좌표를 lSpotAt·pHit·vRegionAt 에 넘기고 결과를 lMove·cLink·vPut 에 넘긴다.
// 부품 문구는 중립어('자리'·'경우'·'짝')이고, 원탁·깃발 같은 장면은 words 칸으로 자리 이름·결론 글을 바꾼다.
// 화면에 보이는 수(결론 식의 각 수)는 모두 여기서 계산하고 checks 가 sympy 로 다시 센다(P7).
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
  /** 장면이 바꾸는 부품 문구(모드마다 쓸 수 있는 칸이 다르다 — WORD_KEYS) */
  words?: CWords;
}
/**
 * 장면 글에 맞춰 바꾸는 부품 문구. 없으면 중립어를 쓴다.
 * done 은 결론 글 전체를 바꾸며 {식} 자리에 모델이 계산한 식('4 × 3 = 12')이 들어간다 — 숫자를 글에 직접 적지 않게.
 */
export interface CWords {
  /** 처음 안내 한 줄 */
  intro?: string;
  /** 줄 세우기: 아직 세우지 않은 것이 있는 칸 이름(기본 '남은 것') */
  wait?: string;
  /** 줄 세우기: 자리 이름 k 개(기본 첫째·둘째…) */
  seats?: string[];
  /** 선 잇기: 하나를 부르는 말(기본 '하나' — '깃발마다', '사람마다') */
  item?: string;
  /** 벤: 두 원 밖 칸 이름(기본 '둘 다 아님') */
  out?: string;
  /** 결론 글. {식} 이 꼭 들어간다 */
  done?: string;
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
  /** 벤: 더미(맨 앞이 맨 위). 되돌린 카드는 맨 위로 온다 */
  deck: number[];
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
    deck: p.mode === 'venn' ? vElems(p).map((_, i) => i) : [],
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

// ---- 글자 폭 어림(형식 검사와 화면이 같이 쓴다) ----

/** 칩·점·카드 글자의 가장 작은 크기(px). 이보다 줄여야 들어가면 형식 오류 */
export const LABEL_MIN = 13;
/** 기본 글자 크기(px): 줄 세우기 칩 1.4rem · 점 · 벤 카드 */
export const CHIP_FONT = 22;
export const NODE_FONT = 20;
export const CARD_FONT = 17;
/** 묶음 표·자리 이름·넣을 곳 단추의 글자 크기(px, 화면 CSS 와 같은 값) */
const GROUP_FONT = 15;
const SMALL_FONT = 12.8;

/**
 * 글자 폭(em) 어림. 한글·기호는 1, 영문·숫자 0.62, 띄어쓰기 0.3, 가운뎃점·화살표 0.6.
 * 글꼴을 재지 않는 어림이라 넉넉한 쪽(한글 1em)으로 잡는다 — 형식 검사가 화면보다 먼저 막게.
 */
export function emW(s: string): number {
  let w = 0;
  for (const ch of s)
    w += ch === ' ' ? 0.3 : /[A-Za-z0-9.,]/.test(ch) ? 0.62 : /[·→-]/.test(ch) ? 0.6 : 1;
  return w;
}

/** 안쪽 폭 inner(px)에 한 줄로 넣을 글자 크기. base 에서 시작해 줄이고, LABEL_MIN 보다 작아야 하면 null */
export function fitPx(s: string, inner: number, base: number): number | null {
  const px = Math.min(base, Math.floor(inner / emW(s)));
  return px >= LABEL_MIN ? px : null;
}

/** 띄어쓰기에서만 줄을 바꿀 때(word-break: keep-all) 폭 w 안에 maxLines 줄로 드나 */
export function lineFit(text: string, w: number, px: number, maxLines: number): boolean {
  let lines = 1;
  let cur = 0;
  for (const word of text.split(' ')) {
    const ww = emW(word) * px;
    if (ww > w) return false;
    const add = cur ? cur + 0.3 * px + ww : ww;
    if (add <= w) cur = add;
    else {
      lines++;
      cur = ww;
    }
  }
  return lines <= maxLines;
}

/** 칩 안쪽 폭: 테두리 2px×2 와 양옆 여유 4px×2 를 뺀다 */
export const chipInner = (chip: number) => chip - 12;
/** 원 안쪽 폭: 글자 높이만큼 위아래로 벌어진 자리에서도 둘레에 닿지 않게 지름의 0.8 에서 테두리를 뺀다 */
export const nodeInner = (r: number) => 2 * r * 0.8 - 4;
/** 벤 카드 안쪽 폭 */
export const cardInner = () => V_CARD - 10;

// ---- 누르기(눌러서 하기 · 화면 낭독기) ----

/** 그냥 누르기가 이만큼이면 '눌러서 해도 돼요' 안내를 띄운다(P4 — 저울·'넘어가기'와 같은 기준) */
export const FAILS_FOR_TAP = 2;

/**
 * 움직임 없는 누르기 한 번. 누르기는 첫 번부터 고르기로 동작한다: 화면 낭독기(VoiceOver)의 두 번 두드리기는
 * 손가락 누르기로 들어와서, 두 번 놓쳐야 켜지게 두면 낭독기 사용자는 처음 두 번이 헛돈다.
 * 안내 글만 P4 대로 — 첫 번째는 끌기를 권하고(drag), 두 번째에 '눌러도 돼요'(tap). 고른 것을 다시 누르면 놓기 취소,
 * 다른 것을 누르면 두 번호(pair = [고른 것, 누른 것])를 돌려준다.
 */
export function tapStep(
  t: { fails: number; pick: number | null },
  i: number,
): { fails: number; pick: number | null; pair?: [number, number]; hint: 'drag' | 'tap' | null } {
  const hint = (fails: number) =>
    fails === 1 ? ('drag' as const) : fails === FAILS_FOR_TAP ? ('tap' as const) : null;
  // 고르기와 풀기(같은 것을 다시 누르기)는 둘 다 '끌지 않고 누른' 한 번으로 센다 — 같은 칩을 두 번 누르는 것이 흔한 신호
  if (t.pick === null) return { fails: t.fails + 1, pick: i, hint: hint(t.fails + 1) };
  if (t.pick === i) return { fails: t.fails + 1, pick: null, hint: hint(t.fails + 1) };
  return { fails: t.fails, pick: null, pair: [t.pick, i], hint: null };
}

// ---- 줄 세우기(list): 칩을 자리에 세우고 자리 바꾸기 ----

/** 줄 세우기·선 잇기·벤 판의 폭(그림 단위). 접은 화면 382px 의 카드 안쪽 폭과 같아 거기서 1단위 = 1px */
export const L_W = 298;
/** 기본 자리 이름. 나열은 4! = 24 가 손으로 찾는 상한이라 넷째까지 쓰이지만 k 상한(6)까지 둔다 */
export const L_ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
/**
 * 자리 판정 여유. 자리 상자 위아래로 이만큼 더 봐 준다 — 손가락 끝이 칩 가운데보다 조금 위·아래를 누르고 있어
 * 칩 가운데가 자리 상자 끝에 걸쳐도 그 자리로 친다(칩 한 변의 1/4 쯤).
 */
const SEAT_SLOP = 14;
/** 옆 여유: 자리 사이 간격의 절반까지, 다만 자리 상자 끝에서 10 을 넘지 않게(맨 끝 자리 바깥으로 멀리 놓으면 제자리로) */
const SEAT_SIDE = 10;
/** 판 좌우 밖으로 이만큼은 줄 밖 칸으로 친다(판 끝에서 손을 놓는 일이 잦다) */
const WAIT_SIDE = 10;
/** 판 맨 위 이름 글자 위까지 줄 밖 칸으로 친다(칸 위쪽 이름 띠 18 + 여유) */
const WAIT_TOP = 30;

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
  /** 이웃 자리 가운데 사이 거리(자리 하나면 자리 상자 + 14) */
  seatGap: number;
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
  const seatGap = k > 1 ? Math.min(box + 14, (L_W - box) / (k - 1)) : box + 14;
  const waitTop = 16;
  const waitBottom = waitTop + box;
  const seatY = waitBottom + 26 + box / 2;
  return {
    chip,
    box,
    waitX: row(n, waitGap),
    waitY: waitTop + box / 2,
    waitTop,
    waitBottom,
    seatX: row(k, seatGap),
    seatY,
    seatGap,
    h: seatY + box / 2 + 20,
  };
}

/** 놓은 자리(판 좌표) → 몇째 자리 · 줄 밖 · 판 밖(null = 제자리로) */
export function lSpotAt(g: LGeom, x: number, y: number): number | 'wait' | null {
  const half = Math.min(g.seatGap / 2, g.box / 2 + SEAT_SIDE);
  const seatTop = g.seatY - g.box / 2 - SEAT_SLOP;
  if (y >= seatTop && y <= g.seatY + g.box / 2 + SEAT_SLOP) {
    const s = g.seatX.findIndex((sx) => Math.abs(x - sx) <= half);
    if (s >= 0) return s;
  }
  // 줄 밖 칸은 자리 줄 바로 위까지 — 그 사이에 아무 데도 아닌 틈을 두지 않는다
  if (x >= -WAIT_SIDE && x <= L_W + WAIT_SIDE && y >= g.waitTop - WAIT_TOP && y < seatTop)
    return 'wait';
  return null;
}

export type LRes = 'none' | 'move' | 'new' | 'dup';

/**
 * 물건 i 를 자리 to(몇째) 또는 줄 밖('wait')으로. 줄 안끼리는 두 자리가 맞바뀌고, 줄 밖에서 찬 자리로 들어오면
 * 원래 있던 것은 줄 밖으로 나간다. 옮긴 뒤 자리가 다 찼으면 그 순서를 한 경우로 본다: 새 경우면 적고(new),
 * 이미 있으면 적지 않는다(dup — 자리는 바뀐 채로 둔다. 학생이 바로 다음 경우를 만들어 가게).
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

/** 첫째 자리에 올 수 있는 가짓수, 둘째, … — 결론 글 "첫째 4 × 둘째 3" 의 수(곱 = 모든 경우, 검산은 ff) */
export function lFactors(p: CountParams): number[] {
  const n = p.items?.length ?? 0;
  return Array.from({ length: p.k ?? 0 }, (_, j) => n - j);
}

/** 자리 이름(장면이 바꿀 수 있다) */
export const lSeats = (p: CountParams) => p.words?.seats ?? L_ORD.slice(0, p.k ?? 0);

/** 줄 세우기 결론 글. 기본 "첫째 4 × 둘째 3 = 12가지", words.done 이 있으면 그 글의 {식} 에 "4 × 3 = 12" */
export function lDone(p: CountParams): string {
  const f = lFactors(p);
  const total = cTotal(p);
  if (p.words?.done) return p.words.done.replace('{식}', `${f.join(' × ')} = ${total}`);
  const seats = lSeats(p);
  return `${f.map((x, j) => `${seats[j]} ${x}`).join(' × ')} = ${total}가지`;
}

/** 경우 키 → 짧은 글자(목록·묶음 표용). 이름이 모두 한 글자면 붙여 쓰고(ABC), 아니면 → 로(빨1→빨2) */
export function lShort(p: CountParams, key: string): string {
  const names = key.split(',').map((i) => p.items?.[Number(i)] ?? '?');
  return names.join(names.every((x) => [...x].length === 1) ? '' : '→');
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

/** 묶음 표 한 칸 폭(px) — 물건 n 개면 n 칸, 칸 사이 4 */
export const lGroupCol = (n: number) => (L_W - (n - 1) * 4) / n;

// ---- 선 잇기(pick k=2) ----

/** 점 반지름. 지름 54 — 누르는 칸 44 이상 */
export const P_R = 27;
export interface PGeom {
  w: number;
  h: number;
  r: number;
  pos: [number, number][];
}

/**
 * 점 n 개를 정다각형 꼭짓점에(모두 같은 자격으로 보이게 — 대각선도 한 쌍이다). 둘은 좌우, 셋·다섯은 맨 위 꼭짓점부터,
 * 넷은 왼쪽 위 모서리부터, 여섯은 평평한 육각형(위아래가 낮아 판이 덜 높다)의 왼쪽 위부터 시계 방향으로 놓는다.
 */
export function pGeom(n: number): PGeom {
  const w = L_W;
  // 194: 판 아래 찾은 목록(15쌍까지)·결론 두 줄·'처음부터 다시'·보기 단추가 접은 화면 한 장에 들게(214 → 194).
  // 200 이면 prob-probability bag(질문 장면) 완료 상태가 4px 넘쳤다. 가장자리 여유를 반지름 + 5 로 줄여 육각형 이웃 간격 75 를 지킨다
  const h = 194;
  const start = ({ 2: 180, 3: -90, 4: -135, 5: -90, 6: -120 } as Record<number, number>)[n] ?? -90;
  const unit = Array.from({ length: n }, (_, i) => {
    const t = ((start + (i * 360) / n) * Math.PI) / 180;
    return [Math.cos(t), Math.sin(t)] as [number, number];
  });
  const xs = unit.map((u) => u[0]);
  const ys = unit.map((u) => u[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const m = P_R + 5;
  const rho = Math.min(90, bw ? (w - 2 * m) / bw : 90, bh ? (h - 2 * m) / bh : 90);
  const cx = w / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * rho;
  const cy = h / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * rho;
  return { w, h, r: P_R, pos: unit.map(([x, y]) => [cx + x * rho, cy + y * rho]) };
}

/** 손 뗀 자리에서 가장 가까운 점(반지름 + 10 안 — 손가락 끝이 원 가장자리 조금 밖이어도). 시작한 점은 빼고, 없으면 −1 */
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

/** 두 점 a·b 를 잇는다. 선에는 방향이 없어 키는 작은 번호부터 — b→a 로 그어도 같은 짝(dup) */
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

/** 점마다 이은 선 수. 다 이으면 모두 n−1 */
export function pDegree(p: CountParams, found: string[]): number[] {
  const d = (p.items ?? []).map(() => 0);
  for (const k of found) for (const i of k.split(',')) d[Number(i)] = (d[Number(i)] as number) + 1;
  return d;
}

/**
 * 결론 식의 수: 하나마다 이은 수(each), 양 끝에서 센 수(ends = 이은 수의 합), 모든 경우(total).
 * 모두 이은 그림(cAll)에서 센다 — checks 가 binomial·ff 로 따로 대조한다
 */
export function pFacts(p: CountParams): { each: number; ends: number; total: number } {
  const d = pDegree(p, cAll(p));
  return { each: d[0] ?? 0, ends: d.reduce((a, b) => a + b, 0), total: cTotal(p) };
}

/** 선 잇기 결론 글. 기본 "하나마다 3개 × 4 = 12, 짝 하나를 양쪽에서 두 번 셌으니 ÷ 2 = 6가지" */
export function pDone(p: CountParams): string {
  const n = p.items?.length ?? 0;
  const f = pFacts(p);
  if (p.words?.done) return p.words.done.replace('{식}', `${f.each} × ${n} ÷ 2 = ${f.total}`);
  const item = p.words?.item ?? '하나';
  return `${item}마다 ${f.each}개 × ${n} = ${f.ends}, 짝 하나를 양쪽에서 두 번 셌으니 ÷ 2 = ${f.total}가지`;
}

// ---- 벤 분류(venn) ----

/**
 * 벤 판(전체집합 사각형) 크기와 두 원. 카드가 통째로 칸 안에 들어야 해서(2026-11-23 검토) 원을 크게(반지름 100),
 * 중심 사이를 90 으로 해 겹친 곳 폭을 110 으로 넓혔다 — 겹친 곳 4장·에만 3장씩·둘 다 아님 6장.
 */
export const V_W = L_W;
export const V_H = 270;
export const V_A = { cx: 104, cy: 120, r: 100 };
export const V_B = { cx: 194, cy: 120, r: 100 };
/** 판 아래 더미 줄의 높이(카드 더미·남은 수·확인하기 — 누르는 칸 44 + 위아래 3). 56 이면 질문 장면에서 넣을 곳 단추를 연 채
 *  두 줄 안내가 뜨면 접은 화면 카드가 3px 넘쳤다(prob-conditional venn) */
export const V_DECK = 50;
/** 카드 한 변(누르는 칸 최소). 화면도 이 값으로 그린다 */
export const V_CARD = 44;
/** 카드 줄 간격(카드 + 틈 4) */
const V_STEP = V_CARD + 4;
const V_PAD = 4;
/** 판 맨 위 이름 띠(두 집합 이름·U) — 카드 자리를 두지 않는다 */
export const V_TOP = 22;
/** 카드 테두리가 원 둘레에 닿지 않게 두는 틈 */
const V_GAP = 2;

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

const regOf = (x: number, y: number): VReg => {
  const inA = Math.hypot(x - V_A.cx, y - V_A.cy) < V_A.r;
  const inB = Math.hypot(x - V_B.cx, y - V_B.cy) < V_B.r;
  return inA && inB ? 'ab' : inA ? 'a' : inB ? 'b' : 'out';
};

/** 놓은 자리(판 좌표) → 영역. 판 아래 더미 줄이면 'deck'(더미로 되돌리기), 판 밖이면 null(제자리로) */
export function vRegionAt(x: number, y: number): VReg | 'deck' | null {
  // 더미 줄은 판 좌우로 10 씩 더 봐 준다(왼쪽 끝 더미 카드를 제자리 근처에 놓는 일이 잦다)
  if (y > V_H && y <= V_H + V_DECK + 10 && x >= -10 && x <= V_W + 10) return 'deck';
  if (x < 0 || x > V_W || y < 0 || y > V_H) return null;
  return regOf(x, y);
}

/** 카드(가운데 x,y)가 통째로 칸 reg 안인가: 네 모서리·네 변 가운데·가운데 아홉 점 — 볼록하지 않은 '에만' 칸은 변 가운데가 원 안으로 들어갈 수 있다 */
const cardIn = (reg: VReg, x: number, y: number) => {
  const h = V_CARD / 2 + V_GAP;
  if (x - V_CARD / 2 < V_PAD || x + V_CARD / 2 > V_W - V_PAD) return false;
  if (y - V_CARD / 2 < V_TOP || y + V_CARD / 2 > V_H - V_PAD) return false;
  for (const sx of [-1, 0, 1])
    for (const sy of [-1, 0, 1]) if (regOf(x + sx * h, y + sy * h) !== reg) return false;
  return true;
};

type VRow = { y: number; mid: number; cap: number };
let rowCache: Record<VReg, VRow[]> | null = null;

/**
 * 칸마다 카드 줄. 원 세 칸은 두 원 중심 높이를 지나는 줄부터 위아래로 48 간격, 둘 다 아님 칸은 판 바닥 줄부터 위로.
 * 줄마다 카드가 통째로 드는 구간을 재서 몇 장 드는지(cap)와 구간 가운데(mid)를 둔다. 채우는 차례는 가운데 줄 → 위 → 아래.
 * 칸끼리는 겹치지 않으므로(카드가 통째로 제 칸 안) 다른 칸 카드와도 겹치지 않는다.
 */
function vRows(): Record<VReg, VRow[]> {
  if (rowCache) return rowCache;
  const res = {} as Record<VReg, VRow[]>;
  for (const reg of ['a', 'ab', 'b', 'out'] as const) {
    const base = reg === 'out' ? V_H - V_PAD - V_CARD / 2 : V_A.cy;
    const rows: (VRow & { k: number })[] = [];
    for (let k = -4; k <= 4; k++) {
      const y = base + k * V_STEP;
      let best: [number, number] | null = null;
      let cur: [number, number] | null = null;
      for (let x = 0; x <= V_W; x++) {
        if (!cardIn(reg, x, y)) continue;
        if (cur && cur[1] === x - 1) cur[1] = x;
        else cur = [x, x];
        if (!best || cur[1] - cur[0] > best[1] - best[0]) best = [cur[0], cur[1]];
      }
      if (best)
        rows.push({
          k,
          y,
          mid: (best[0] + best[1]) / 2,
          cap: Math.floor((best[1] - best[0]) / V_STEP) + 1,
        });
    }
    rows.sort((a, b) => Math.abs(a.k) - Math.abs(b.k) || a.k - b.k);
    res[reg] = rows.map(({ y, mid, cap }) => ({ y, mid, cap }));
  }
  rowCache = res;
  return res;
}

/** 칸마다 들어가는 카드 수. 정답대로 넣었을 때 이보다 많으면 형식 오류, 학생이 더 넣으려 하면 'full' */
export function vCap(): Record<VReg, number> {
  const r = vRows();
  const sum = (reg: VReg) => r[reg].reduce((a, x) => a + x.cap, 0);
  return { a: sum('a'), ab: sum('ab'), b: sum('b'), out: sum('out') };
}

/**
 * 칸 reg 에 카드 m 장이 설 자리(놓인 차례대로). 가운데 줄부터 채우고 줄 안에서는 가운데 정렬 — 한 장이면 칸 가운데,
 * 석 장이면 가운데 줄 둘 + 위 줄 가운데 하나. 카드가 빠지면 남은 카드가 다시 가운데로 모인다(자동 줄 맞춤).
 */
export function vLayout(reg: VReg, m: number): [number, number][] {
  const out: [number, number][] = [];
  let left = m;
  for (const row of vRows()[reg]) {
    if (left <= 0) break;
    const c = Math.min(row.cap, left);
    for (let i = 0; i < c; i++) out.push([row.mid + (i - (c - 1) / 2) * V_STEP, row.y]);
    left -= c;
  }
  return out;
}

/** 원소 e(vElems 차례)를 영역 to 로, null 이면 더미 맨 위로. 그 칸이 다 찼으면 'full'(상태 그대로) */
export function vPut(
  _p: CountParams,
  s: CState,
  e: number,
  to: VReg | null,
): { s: CState; res: 'move' | 'full' | 'none' } {
  const from = s.where[e] ?? null;
  if (from === to || s.solved) return { s, res: 'none' };
  if (to && s.where.filter((w) => w === to).length >= vCap()[to]) return { s, res: 'full' };
  const where = [...s.where];
  where[e] = to;
  const order = s.order.filter((x) => x !== e).concat(to ? [e] : []);
  const rest = s.deck.filter((x) => x !== e);
  const deck = to ? rest : [e, ...rest];
  // 옮긴 카드는 틀림 표시를 지운다 — 다시 '확인하기'로만 판정(놓는 순간에는 아무 신호도 없다)
  return { s: { ...s, where, order, deck, wrong: s.wrong.filter((x) => x !== e) }, res: 'move' };
}

/** 원소 e 카드의 자리(판 좌표). 더미면 판 아래 왼쪽 더미 자리(위 석 장만 두께로 비켜 보인다) */
export function vPos(p: CountParams, s: CState, e: number): [number, number] {
  const w = s.where[e] ?? null;
  if (!w) {
    const d = Math.min(Math.max(vDeck(p, s).indexOf(e), 0), 2);
    return [V_CARD / 2 + V_PAD + d * 2, V_H + V_DECK / 2 + 2 - d * 2];
  }
  const inReg = s.order.filter((x) => s.where[x] === w);
  return vLayout(w, inReg.length)[inReg.indexOf(e)] as [number, number];
}

/** 더미에 남은 원소(맨 앞이 맨 위 — 맨 위 한 장만 끌 수 있다) */
export function vDeck(_p: CountParams, s: CState): number[] {
  return s.deck;
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

/** 벤 '넣을 곳' 단추 한 칸 폭(px): 더미 줄 폭을 넷으로(사이 4) 나누고 안쪽 여유 4 를 뺀다 */
export const vChooseW = () => (V_W - 3 * 4) / 4 - 4;
/** 벤 칸 이름(장면이 바꿀 수 있는 것은 둘 다 아님 칸) */
export function vNames(p: CountParams): Record<VReg, string> {
  const n = p.sets?.names ?? ['', ''];
  return { a: `${n[0]}에만`, ab: '둘 다', b: `${n[1]}에만`, out: p.words?.out ?? '둘 다 아님' };
}

// ---- 형식 검사·검산 ----

const MAX_CASES = 24;

/** 조작마다 장면이 바꿀 수 있는 문구 칸 */
const WORD_KEYS = {
  line: ['intro', 'wait', 'seats', 'done'],
  pair: ['intro', 'item', 'done'],
  venn: ['intro', 'out'],
} as const;

function parseWords(v: unknown, view: keyof typeof WORD_KEYS, k: number): CWords {
  const at = '경우의 수 words';
  const w = obj(v, at, [], [...WORD_KEYS[view]]);
  const out: CWords = {};
  for (const key of ['intro', 'wait', 'item', 'out'] as const)
    if (w[key] !== undefined) out[key] = str(w[key], `${at}.${key}`);
  if (w.seats !== undefined)
    out.seats = arr(w.seats, `${at}.seats`, k, k).map((x, i) => str(x, `${at}.seats${i + 1}`));
  if (w.done !== undefined) {
    out.done = str(w.done, `${at}.done`);
    // 결론 식의 수는 모델이 계산해 검산한 값만 — 글에 숫자를 직접 적지 않게 {식} 자리를 꼭 두게 한다
    if (!out.done.includes('{식}')) fail(`${at}.done`, '{식} 자리가 없음');
  }
  return out;
}

/** 고정 크기 칩·점·카드·이름 칸·단추에 글자가 드는지(안 들면 겹치거나 잘린다) */
function fitCheck(p: CountParams) {
  const no = (what: string, s: string) =>
    fail('경우의 수', `글자가 길어 ${what}에 안 들어감: ${s}`);
  const view = viewOf(p);
  const items = p.items ?? [];
  const n = items.length;
  const k = p.k ?? 0;
  if (view === 'line') {
    const g = lGeom(n, k);
    for (const it of items) if (!fitPx(it, chipInner(g.chip), CHIP_FONT)) no('칩', it);
    const seats = lSeats(p);
    for (const s of seats) if (!lineFit(s, g.seatGap - 4, SMALL_FONT, 1)) no('자리 이름', s);
    if (!lineFit(p.words?.wait ?? '남은 것', L_W, SMALL_FONT, 1))
      no('줄 밖 칸 이름', p.words?.wait ?? '');
    // 다 찾은 뒤 묶음 표: 물건 n 칸, 한 칸에 가장 긴 경우 글자와 머리글(자리 이름 + 물건)
    if (k >= 2) {
      const col = lGroupCol(n) - 12;
      const longest = [...items].sort((a, b) => emW(b) - emW(a));
      const key = Array.from({ length: k }, (_, j) => items.indexOf(longest[j] as string)).join(
        ',',
      );
      const label = lShort(p, key);
      if (emW(label) * GROUP_FONT > col) no('묶음 표 한 칸', label);
      for (const it of items)
        if (!lineFit(`${seats[0]} ${it}`, lGroupCol(n), 12, 1)) no('묶음 표 머리', it);
    }
  }
  if (view === 'pair')
    for (const it of items) if (!fitPx(it, nodeInner(P_R), NODE_FONT)) no('점', it);
  if (view === 'venn') {
    for (const x of vElems(p)) if (!fitPx(x, cardInner(), CARD_FONT)) no('카드', x);
    // 그림 위 이름 띠: 왼쪽·오른쪽 반에서 가운데 U 자리를 뺀 폭
    for (const nm of p.sets?.names ?? [])
      if (!lineFit(nm, V_W / 2 - 20, 13, 1)) no('그림 이름 칸', nm);
    for (const nm of Object.values(vNames(p)))
      if (!lineFit(nm, vChooseW(), SMALL_FONT, 2)) no('넣을 곳 단추', nm);
  }
}

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
      const o = obj(raw, '경우의 수', ['mode', 'sets'], ['words']);
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
        ...(o.words === undefined ? {} : { words: parseWords(o.words, 'venn', 0) }),
      };
      // 카드는 칸마다 정해진 자리에만 선다(겹쳐 가리지 않게) — 정답대로 넣었을 때 자리가 모자라면 끝낼 수 없다
      const cap = vCap();
      const c = vCounts(p);
      for (const r of ['a', 'ab', 'b', 'out'] as const)
        if (c[r] > cap[r])
          fail('경우의 수 sets', `${r} 칸 원소 ${c[r]}개가 그림의 자리 ${cap[r]}개보다 많음`);
      fitCheck(p);
      return p;
    }
    const raw0 = raw as { k?: unknown } | null;
    const drag = mode === 'list' || (mode === 'pick' && raw0?.k === 2);
    const o = obj(
      raw,
      '경우의 수',
      ['mode', 'items', 'k'],
      [...(mode === 'tree' ? ['repeat'] : []), ...(drag ? ['words'] : [])],
    );
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
      ...(o.words === undefined
        ? {}
        : { words: parseWords(o.words, mode === 'list' ? 'line' : 'pair', k) }),
    };
    const total = mode === 'tree' ? cTree(p).leaves : cTotal(p);
    if (total > MAX_CASES)
      fail(
        '경우의 수',
        `경우가 너무 많아 손으로 다 찾기 어려움 (${total}가지, ${MAX_CASES}가지까지)`,
      );
    fitCheck(p);
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
      const c = vCounts(p);
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
      // 결론 줄의 '…에만' 개수(2026-11-23 부터 화면에 보임)
      out.push({
        name: 'a에만',
        answer: String(c.a),
        answerType: 'int',
        check: `len(${fs(s.a)} - ${fs(s.b)})`,
      });
      out.push({
        name: 'b에만',
        answer: String(c.b),
        answerType: 'int',
        check: `len(${fs(s.b)} - ${fs(s.a)})`,
      });
      // 전체집합이 있을 때만 화면에 보이는 수(칠한 여집합의 원소 수, 두 원 밖 원소 수)
      if (s.u) {
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
    // 선 잇기 결론 글의 수: 하나마다 이은 수, 양 끝에서 두 번 센 수(2026-11-23 부터 화면에 보임)
    if (viewOf(p) === 'pair') {
      const f = pFacts(p);
      out.push({
        name: '하나마다 짝',
        answer: String(f.each),
        answerType: 'int',
        check: `binomial(${n}, 2)*2/${n}`,
      });
      out.push({
        name: '두 번 센 수',
        answer: String(f.ends),
        answerType: 'int',
        check: `ff(${n}, 2)`,
      });
    }
    return out;
  },
  texts: (p) => [
    ...(p.items ?? []),
    ...(p.sets ? [...p.sets.names, ...p.sets.a, ...p.sets.b, ...(p.sets.u ?? [])] : []),
    ...Object.values(p.words ?? {}).flat(),
  ],
};
