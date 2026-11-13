// 경우의 수 부품의 모델(순수). 화면(Count.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 공식으로 세기 전에 손으로 하나씩 만들어 보게 한다: 물건을 눌러 k개를 고르면 한 경우가 생기고,
// 이미 찾은 경우면 "이미 있어요"로 알려 준다. 모두 찾으면 끝. 전체 개수는 모델이 직접 다 늘어놓아 세고,
// checks 가 그 수를 sympy 의 공식(ff·binomial·거듭제곱)과 대조한다 — 늘어놓기와 공식이 서로를 검산한다.
// mode: list(순서 O) · pick(순서 X) · repeat(순서 O, 같은 것 여러 번) · tree(수형도) · pascal · venn
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
  sets?: { names: [string, string]; a: string[]; b: string[] };
}
export interface CState {
  /** 지금 고르는 중인 물건 번호들 */
  sel: number[];
  /** 찾은 경우(정규화한 키) */
  found: string[];
  /** 수형도에서 펼친 단계 수 */
  open: number;
  /** 파스칼 마지막 줄에서 연 칸 */
  rev: boolean[];
  /** 벤 다이어그램에서 고른 영역 */
  region: 'a' | 'ab' | 'b' | null;
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
    region: null,
  };
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
      return s.region === 'ab';
  }
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
      const st = obj(o.sets, '경우의 수 sets', ['names', 'a', 'b']);
      const names = arr(st.names, '경우의 수 names', 2, 2).map((x, i) =>
        str(x, `경우의 수 이름${i + 1}`),
      );
      const list = (v: unknown, at: string) => {
        const xs = arr(v, at, 1, 8).map((x, i) => str(x, `${at}${i + 1}`));
        if (new Set(xs).size !== xs.length) fail(at, '원소 중복');
        return xs;
      };
      return {
        mode,
        sets: {
          names: [names[0] as string, names[1] as string],
          a: list(st.a, '경우의 수 a'),
          b: list(st.b, '경우의 수 b'),
        },
      };
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
      const names = [...new Set([...s.a, ...s.b])];
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
    ...(p.sets ? [...p.sets.names, ...p.sets.a, ...p.sets.b] : []),
  ],
};
