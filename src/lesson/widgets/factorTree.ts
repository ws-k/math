// 소인수분해 나무의 모델(순수). 나무 끝의 수를 고르고 숫자판(2~9)에서 나눌 수를 누르면 (나눈 수, 몫) 두 마디로
// 갈라진다. 4·6·8·9 같은 합성수로도 쪼갤 수 있게 한 것은 나무 모양이 여러 가지가 되게 하려는 것 — 소수로만 나누면
// 나무가 늘 한쪽으로 기울어 "모양이 달라도 끝은 같다"가 "순서가 달라도 같다"로 약해진다(D3 시안 안 1, PM 승인).
// 화면(FactorTree.tsx)과 검산(checks)이 같은 함수(splitOf·isPrime)를 쓴다 — 검산이 늘어놓는 나무가 화면에서
// 실제로 만들 수 있는 나무와 어긋나지 않게.
import { fail, int, obj } from '../parse.ts';
import type { WidgetDef } from './specs.ts';

export interface FactorTreeParams {
  /** 쪼갤 수(뿌리) */
  n: number;
}

/** 숫자판에 놓는 나눌 수. 9 보다 큰 수는 한 자리 수로 나눠 가는 교과서 방식 밖이라 두지 않는다 */
const PAD = [2, 3, 4, 5, 6, 7, 8, 9] as const;
/**
 * 소인수 개수 상한. 나무는 소인수 개수만큼 층이 생기고(2 로만 쪼개면 가장 깊다) 잎도 그만큼이다. 접은 화면
 * 382×580 에서 나무 상자는 298×222 — 층 높이 44(마디 높이)로 5층, 잎 폭 298/5 ≈ 60 이 마디 폭 50 보다 넓은 데까지
 * 들어간다. 6개(96 = 2⁵ × 3)면 6층 266px 로 숫자판이 '계속하기' 밑으로 밀리고 잎 폭 50 이 마디와 맞닿는다(D3 시안 측정)
 */
const MAX_FACTORS = 5;
/** 뿌리 상한. 마디 원 지름 44px 안에 굵은 1.25rem 숫자가 세 자리까지 들어간다 */
const MAX_N = 999;
/** 나무 상자 폭(접은 화면 카드 안쪽 폭). 화면은 이 폭에 대한 비율로 놓아 더 넓은 카드에서도 같은 모양 */
export const TREE_W = 298;
const ROW = 44;
const TOP = 22;

export interface TNode {
  n: number;
  /** 쪼갰으면 두 자식 번호(나눈 수, 몫) */
  kids: [number, number] | null;
  /** 소수로 확정(동그라미) */
  prime: boolean;
  parent: number | null;
}

export interface TState {
  /** 번호 = 마디 id. 마디는 지우지 않고 늘기만 해서 번호가 화면 요소의 key 로 그대로 쓰인다 */
  nodes: TNode[];
  /** 고른(숫자판을 기다리는) 끝 마디 */
  sel: number | null;
}

export type Msg = { text: string; cls: '' | 'ok' | 'bad' };

export interface Step {
  s: TState;
  msg: Msg;
  ok: boolean;
  /** 화면 낭독기에 따로 알릴 글(쪼갠 식). 글 칸의 안내와 달리 "곱하기"로 읽힌다 */
  say?: string;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** 소인수(작은 것부터, 겹치는 것 포함). 형식 검사용 — 나무는 이것을 쓰지 않고 학생이 쪼갠 대로 자란다 */
function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let d = 2; d * d <= m; d++)
    while (m % d === 0) {
      out.push(d);
      m /= d;
    }
  if (m > 1) out.push(m);
  return out;
}

/**
 * 숫자 뒤 조사. 읽는 소리의 끝 자리로 정한다: 0 영·1 일·3 삼·6 육·7 칠·8 팔 은 받침이 있어 '은·을', 그중 ㄹ 받침
 * (일·칠·팔)은 '으로' 대신 '로'. 10·100 처럼 0 으로 끝나는 수도 십·백 이라 받침(ㄹ 아님)이 있어 같은 규칙에 든다.
 * TODO: 3-바 공용화 때 교체(장면 공용 글 도우미로 옮겨 다른 부품과 같이 쓴다)
 */
export function josa(n: number, kind: '은' | '을' | '으로'): string {
  const d = Math.abs(n) % 10;
  const batchim = [0, 1, 3, 6, 7, 8].includes(d);
  if (kind === '은') return batchim ? '은' : '는';
  if (kind === '을') return batchim ? '을' : '를';
  return [0, 3, 6].includes(d) ? '으로' : '로';
}

/** m 을 d 로 쪼갤 수 있으면 [d, 몫], 아니면 못 쪼개는 까닭(학생에게 보일 글). 화면과 검산이 같이 쓴다 */
function splitOf(m: number, d: number): [number, number] | string {
  if (d === m) return `${m} ÷ ${m} = 1 — 1 은 조각이 아니에요. 더 못 쪼개면 '소수예요'.`;
  // 숫자판에 m 보다 작은 수가 없으면(m = 2) '더 작은 수로'는 따를 수 없는 안내라 소수예요를 권한다
  if (d > m)
    return m <= PAD[0]
      ? `${m} ${josa(m, '은')} 더 쪼갤 수 없어요. '소수예요'를 눌러요.`
      : `${m} 보다 작은 수로 나눠요.`;
  if (m % d) return `${m} ÷ ${d} ${josa(d, '은')} 나누어떨어지지 않아요 (나머지 ${m % d}).`;
  return [d, m / d];
}

/** 첫 쪼개기로 고를 수 있는 서로 다른 두 수(작은 수 먼저). 8 × 9 와 9 × 8 은 한 가지로 센다 */
function rootPairs(n: number): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const d of PAD) {
    const r = splitOf(n, d);
    if (typeof r === 'string') continue;
    const pr = [Math.min(...r), Math.max(...r)] as [number, number];
    if (seen.has(String(pr))) continue;
    seen.add(String(pr));
    out.push(pr);
  }
  return out;
}

export const ftInit = (p: FactorTreeParams): TState => ({
  nodes: [{ n: p.n, kids: null, prime: false, parent: null }],
  sel: null,
});

const START = '쪼갤 수를 누르고, 그 수를 어떤 수로 나눌지 골라요.';
export const ftStartMsg = (): Msg => ({ text: START, cls: '' });

/** 마디 누르기. 끝 마디면 고르기(다시 누르면 풀기), 이미 쪼갠·동그라미 친 마디면 안내만 */
export function ftSelect(s: TState, id: number): Step {
  const x = s.nodes[id];
  if (!x) return { s, msg: ftStartMsg(), ok: false };
  if (x.kids)
    return {
      s: { ...s, sel: null },
      msg: { text: `${x.n} ${josa(x.n, '은')} 이미 쪼갰어요. 나무 맨 끝의 수를 골라요.`, cls: '' },
      ok: false,
    };
  if (x.prime)
    return {
      s: { ...s, sel: null },
      msg: { text: `${x.n} ${josa(x.n, '은')} 이미 동그라미 친 소수예요.`, cls: '' },
      ok: false,
    };
  if (s.sel === id) return { s: { ...s, sel: null }, msg: ftStartMsg(), ok: true };
  return {
    s: { ...s, sel: id },
    msg: {
      text: `${x.n} ${josa(x.n, '을')} 어떤 수로 나눌까요? 더 못 쪼개면 '소수예요'.`,
      cls: '',
    },
    ok: true,
  };
}

/**
 * 숫자판 상태. 고른 마디가 있으면 2~9 가 **모두** 눌린다 — 나누어떨어지는 수만 켜면 학생이 나누어떨어지는지
 * 따져 볼 일이 사라진다(원칙 P3: 판정은 누른 뒤에만)
 */
export const ftPad = (s: TState) => ({ digits: [...PAD], enabled: s.sel !== null });

/** 고른 마디를 d 로 쪼갠다. 못 나누면 나무는 그대로 두고 까닭만 알린다 */
export function ftSplit(s: TState, d: number): Step {
  const id = s.sel;
  const x = id === null ? undefined : s.nodes[id];
  if (id === null || !x) return { s, msg: ftStartMsg(), ok: false };
  const r = splitOf(x.n, d);
  if (typeof r === 'string') return { s, msg: { text: r, cls: 'bad' }, ok: false };
  const a = s.nodes.length;
  const nodes = s.nodes.map((y, i) =>
    i === id ? { ...y, kids: [a, a + 1] as [number, number] } : y,
  );
  nodes.push(
    { n: r[0], kids: null, prime: false, parent: id },
    { n: r[1], kids: null, prime: false, parent: id },
  );
  return {
    s: { nodes, sel: null },
    msg: { text: `${x.n} = ${r[0]} × ${r[1]}. 끝의 수를 눌러 계속 쪼개요.`, cls: '' },
    ok: true,
    say: `${x.n} ${josa(x.n, '은')} ${r[0]} 곱하기 ${r[1]}`,
  };
}

/** '소수예요': 맞으면 동그라미. 아니면 어느 수로 나뉘는지는 말하지 않는다(학생이 찾을 몫) */
export function ftPrime(s: TState): Step {
  const id = s.sel;
  const x = id === null ? undefined : s.nodes[id];
  if (id === null || !x) return { s, msg: ftStartMsg(), ok: false };
  if (!isPrime(x.n))
    return {
      s,
      msg: {
        text: `${x.n} ${josa(x.n, '은')} 1 과 ${x.n} 말고도 나누어떨어지는 수가 있어요.`,
        cls: 'bad',
      },
      ok: false,
    };
  const nodes = s.nodes.map((y, i) => (i === id ? { ...y, prime: true } : y));
  return {
    s: { nodes, sel: null },
    msg: {
      text: `${x.n} ${josa(x.n, '은')} 1 과 ${x.n} ${josa(x.n, '으로')}만 나뉘는 소수예요. 동그라미!`,
      cls: 'ok',
    },
    ok: true,
  };
}

const leaves = (s: TState) => s.nodes.filter((x) => !x.kids);
export const ftDone = (s: TState) => leaves(s).every((x) => x.prime);

/** 나무 모양 글자. 좌우를 바꾼 것(8 × 9 와 9 × 8)은 같은 모양으로 — 다시 쪼갤 때 "다르게"로 치지 않게 */
function shapeOf(s: TState, id: number): string {
  const x = s.nodes[id] as TNode;
  if (!x.kids) return String(x.n);
  const [a, b] = x.kids.map((k) => shapeOf(s, k)).sort();
  return `${x.n}(${a},${b})`;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => (k === 1 ? '' : [...String(k)].map((c) => SUP[Number(c)]).join(''));

export interface FtResult {
  /** 잎의 소수(작은 것부터) */
  flat: number[];
  /** (소수, 지수) */
  pow: [number, number][];
  flatTex: string;
  powTex: string;
  /** 글 칸용 거듭제곱 "2³ × 3²" */
  powText: string;
  shape: string;
  /** 뿌리를 처음 쪼갠 두 수(작은 수 먼저) */
  first: [number, number];
  say: string;
}

export function ftResult(s: TState): FtResult {
  const flat = leaves(s)
    .map((x) => x.n)
    .sort((a, b) => a - b);
  const pow: [number, number][] = [];
  for (const p of flat) {
    const last = pow[pow.length - 1];
    if (last && last[0] === p) last[1]++;
    else pow.push([p, 1]);
  }
  const root = s.nodes[0] as TNode;
  const kids = (root.kids ?? [0, 0]).map((k) => (s.nodes[k] as TNode).n);
  return {
    flat,
    pow,
    flatTex: `${root.n}=${flat.join('\\times')}`,
    powTex: `=${pow.map(([p, k]) => (k === 1 ? `${p}` : `${p}^{${k}}`)).join('\\times')}`,
    powText: pow.map(([p, k]) => `${p}${sup(k)}`).join(' × '),
    shape: shapeOf(s, 0),
    first: [Math.min(...kids), Math.max(...kids)] as [number, number],
    // 낭독기는 '×'를 '곱하기'로 읽지 않는 것이 있어 말로 적는다(쪼갤 때의 낭독과 같은 말)
    say: `${root.n} ${josa(root.n, '은')} ${flat.join(' 곱하기 ')}`,
  };
}

/**
 * 다 쪼갰을 때의 글. 앞 나무(prev, 처음 끝낸 나무)와 모양은 다른데 잎이 같으면 그것을 짚는다 — 이 부품이
 * 깨닫게 할 것("어떻게 쪼개 시작해도 끝에 남는 소수 조각은 똑같다")을 학생이 직접 본 순간이라서.
 * 결과 칸이 아니라 글 칸에 두는 것은 접은 화면 높이 때문이다(D3 시안)
 */
export function ftDoneMsg(cur: FtResult, prev: FtResult | null): Msg {
  if (prev && prev.powText === cur.powText && prev.shape !== cur.shape)
    return {
      text: `지난번 나무도 ${prev.powText} — 다르게 쪼개도 같은 소수 조각이 남아요.`,
      cls: 'ok',
    };
  return { text: '모든 끝이 소수예요. 다르게 쪼개도 같을까요? 다시 해 봐요.', cls: 'ok' };
}

/**
 * '다른 방법으로 다시'의 안내. 지금까지 끝낸 나무들(방금 것·처음 것)의 첫 쪼개기와 모두 다른 것 중 가장 고른 두 수를
 * 예로 든다(72: 2 × 36 → 8 × 9). 방금 것만 빼면 셋째 나무에서 처음 나무의 쪼개기를 다시 권하게 된다
 */
export function ftRedoMsg(p: FactorTreeParams, done: readonly FtResult[]): string {
  const used = new Set(done.map((r) => String(r.first)));
  const other = rootPairs(p.n)
    .filter((pr) => !used.has(String(pr)))
    .sort((a, b) => b[0] - a[0])[0];
  return `이번엔 처음과 다른 수로 쪼개 볼까요?${other ? ` 예: ${other[0]} × ${other[1]}.` : ''}`;
}

/**
 * 마디 자리(px, 상자 폭 TREE_W 기준). 잎을 왼쪽부터 같은 간격으로 놓고 부모는 두 자식 가운데, 층마다 44px 아래 —
 * 교과서 나무 그림 그대로. 잎이 늘 때마다 기존 마디도 옮겨지므로 화면은 옛 자리에서 새 자리로 미끄러지게 한다
 */
export function ftLayout(s: TState): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = s.nodes.map(() => ({ x: 0, y: 0 }));
  const order: number[] = [];
  const depth: number[] = s.nodes.map(() => 0);
  const walk = (id: number, d: number) => {
    depth[id] = d;
    const k = (s.nodes[id] as TNode).kids;
    if (!k) order.push(id);
    else for (const c of k) walk(c, d + 1);
  };
  walk(0, 0);
  const w = TREE_W / order.length;
  order.forEach((id, i) => {
    out[id] = { x: w * (i + 0.5), y: TOP + (depth[id] as number) * ROW };
  });
  const up = (id: number): number => {
    const k = (s.nodes[id] as TNode).kids;
    if (k) out[id] = { x: (up(k[0]) + up(k[1])) / 2, y: TOP + (depth[id] as number) * ROW };
    return (out[id] as { x: number }).x;
  };
  up(0);
  return out;
}

type Pt = { x: number; y: number };

/** 자리 순서(위층부터, 같은 층은 왼쪽부터). 화면의 Tab·낭독 순서와 '다음 끝 마디'가 같은 순서를 쓴다 */
export function ftOrder(s: TState): number[] {
  const pos = ftLayout(s);
  return s.nodes
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = pos[a] as Pt;
      const pb = pos[b] as Pt;
      return pa.y - pb.y || pa.x - pb.x;
    });
}

/**
 * 동그라미를 친 뒤 키보드 포커스를 옮길 다음 끝 마디(아직 안 쪼갠·동그라미 안 친 것). 자리 순으로 from 다음부터 찾고
 * 끝에 닿으면 처음부터. 없으면(다 끝남) null — 그때 포커스는 '다른 방법으로 다시'로 간다
 */
export function ftNextLeaf(s: TState, from: number): number | null {
  const order = ftOrder(s);
  const at = order.indexOf(from);
  const open = (i: number) => !s.nodes[i]?.kids && !s.nodes[i]?.prime;
  for (let k = 1; k <= order.length; k++) {
    const i = order[(at + k) % order.length] as number;
    if (open(i)) return i;
  }
  return null;
}

/**
 * 쪼갠 뒤 움직임의 출발 자리. last 는 바로 전까지 화면에 보이던 자리 — 움직이는 중에 또 쪼개면 중간 자리라서,
 * 거기서 이어 가야 마디가 끝 자리로 튀었다가 다시 움직이지 않는다. 새 마디는 부모의 그 자리에서 나온다.
 * last 가 없으면(처음 그림·새 나무) 움직이지 않는다(null)
 */
export function ftMoveFrom(last: readonly Pt[] | null, s: TState): Pt[] | null {
  if (!last) return null;
  const to = ftLayout(s);
  return to.map((p, i) => {
    const old = last[i];
    if (old) return old;
    const par = s.nodes[i]?.parent;
    return (par != null && last[par]) || p;
  });
}

/** 나무 상자 높이. 가장 깊은 나무(소수로만 쪼갬)도 들어가게 소인수 개수로 정해 둔다 — 자라면서 높이가 바뀌면 아래 숫자판이 튄다 */
export const ftHeight = (p: FactorTreeParams) => primeFactors(p.n).length * ROW + 2;

/**
 * 숫자판으로 끝까지 쪼갠 모든 나무의 잎(작은 것부터) 가운데 서로 다른 것. 화면의 쪼개기 규칙(splitOf)과 소수
 * 판정(isPrime)을 그대로 써서 닿는 나무를 모두 늘어놓는다 — 검산이 "한 가지이고 그것이 sympy factorint 와 같다"를 본다
 */
export function ftLeafSets(n: number): number[][] {
  const memo = new Map<number, string[]>();
  const sets = (m: number): string[] => {
    const hit = memo.get(m);
    if (hit) return hit;
    const out = new Set<string>();
    if (isPrime(m)) out.add(String(m));
    for (const d of PAD) {
      const r = splitOf(m, d);
      if (typeof r === 'string') continue;
      for (const a of sets(r[0]))
        for (const b of sets(r[1]))
          out.add(
            [...a.split(','), ...b.split(',')]
              .map(Number)
              .sort((x, y) => x - y)
              .join(','),
          );
    }
    const v = [...out];
    memo.set(m, v);
    return v;
  };
  return sets(n).map((x) => x.split(',').map(Number));
}

/** 나무에 나올 수 있는 모든 수(뿌리부터 쪼개 닿는 수). 소수 판정을 sympy 와 대조할 범위 */
function reachable(n: number): number[] {
  const seen = new Set<number>();
  const go = (m: number) => {
    if (seen.has(m)) return;
    seen.add(m);
    for (const d of PAD) {
      const r = splitOf(m, d);
      if (typeof r !== 'string') for (const c of r) go(c);
    }
  };
  go(n);
  return [...seen].sort((a, b) => a - b);
}

export const factorTreeDef: WidgetDef<FactorTreeParams> = {
  parse(raw) {
    const o = obj(raw, '소인수분해 나무', ['n']);
    const n = int(o.n, '소인수분해 나무 n', 4, MAX_N);
    const at = `소인수분해 나무 n=${n}`;
    const fs = primeFactors(n);
    if (fs.length === 1) fail(at, '소수라 쪼갤 것이 없음');
    if (fs.length > MAX_FACTORS)
      fail(
        at,
        `소인수 ${fs.length}개 — ${MAX_FACTORS}개까지(나무가 ${fs.length}층이 되어 접은 화면 382×580 을 넘침. 예: 96 = 2⁵ × 3)`,
      );
    // 쪼개다 나올 수 있는 합성수마다 숫자판 2~9 에 나누는 수가 있어야 나무가 끝난다(121 = 11 × 11 은 막힘).
    // 소인수 조건으로 어림하지 않고 화면과 같은 쪼개기 규칙(splitOf)으로 닿는 수를 모두 본다
    for (const v of reachable(n))
      if (!isPrime(v) && PAD.every((d) => typeof splitOf(v, d) === 'string'))
        fail(at, `숫자판(2~9)으로 못 쪼개는 ${v} 가 생김 — 10 보다 큰 소인수는 하나까지`);
    if (rootPairs(n).length < 2)
      fail(at, "첫 쪼개기가 한 가지뿐이라 '다른 방법으로 다시'를 해 볼 수 없음");
    return { n };
  },
  checks(p) {
    // 닿는 모든 나무의 잎을 각각 sympy factorint 와 대조한다. 모델이 옳다면 한 가지뿐이라 항목도 하나
    const cs = ftLeafSets(p.n).map((leafs, i, all) => {
      const cnt = new Map<number, number>();
      for (const f of leafs) cnt.set(f, (cnt.get(f) ?? 0) + 1);
      const dict = [...cnt].map(([f, k]) => `${f}: ${k}`).join(', ');
      return {
        name: all.length > 1 ? `잎 = 소인수분해 ${i + 1}` : '잎 = 소인수분해',
        answer: '1',
        answerType: 'int',
        check: `int(factorint(${p.n}) == {${dict}})`,
      };
    });
    // '소수예요'의 판정(isPrime)이 나무에 나올 수 있는 모든 수에서 sympy isprime 과 같은가
    const vs = reachable(p.n);
    const py = (b: boolean) => (b ? 'True' : 'False');
    return [
      ...cs,
      {
        name: '소수 판정',
        answer: '1',
        answerType: 'int',
        check: `int([isprime(v) for v in [${vs.join(', ')}]] == [${vs.map((v) => py(isPrime(v))).join(', ')}])`,
      },
    ];
  },
  texts: () => [],
  hasGoal: () => true,
};
