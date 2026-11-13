// 확률 실험 부품의 모델(순수). 화면(Simulate.tsx)과 검산(checks)이 이 함수들을 같이 쓴다.
// 동전·주사위·주머니를 여러 번 던져 나온 비율 막대를 이론값과 나란히 보인다. 던지기는 시드 난수
// (generators/rng.ts 그대로)라 같은 시드면 같은 결과 — 테스트와 화면 확인이 재현된다.
// 이론값은 모든 경우를 늘어놓아 세서 분수로 정확히 구하고, checks 가 sympy 로 따로 세어 대조한다.
import type { Rng } from '../../generators/rng.ts';
import { arr, fail, int, obj, oneOf, str } from '../parse.ts';
import { div, type Q, qi, ratStr } from './q.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface SimParams {
  device: 'coin' | 'die' | 'bag';
  /** 동전 수(1~4, 2개 이상이면 '앞면 수') · 주사위 수(1~2, 2개면 '눈의 합') */
  n: number;
  bag?: { label: string; count: number }[];
  seed: number;
  /** 이만큼 던지면 목표를 이룬 것으로 본다 */
  goal: number;
}
export interface SimState {
  counts: number[];
  trials: number;
}

type Cat = { label: string; prob: Q };

/** 한 번 던진 결과(기구마다의 원시 값들) → 범주 번호 */
function catOf(p: SimParams, raw: number[]): number {
  if (p.device === 'coin')
    return p.n === 1 ? 1 - (raw[0] as number) : raw.reduce((a, b) => a + b, 0);
  if (p.device === 'die') return raw.reduce((a, b) => a + b, 0) - p.n;
  return raw[0] as number;
}

/** 모든 원시 결과(같은 확률) — 이론값을 세는 데 쓴다 */
function outcomes(p: SimParams): number[][] {
  const sides = p.device === 'coin' ? [0, 1] : p.device === 'die' ? [1, 2, 3, 4, 5, 6] : [];
  if (p.device === 'bag') {
    const out: number[][] = [];
    (p.bag ?? []).forEach((b, i) => {
      for (let j = 0; j < b.count; j++) out.push([i]);
    });
    return out;
  }
  let all: number[][] = [[]];
  for (let k = 0; k < p.n; k++) all = all.flatMap((r) => sides.map((v) => [...r, v]));
  return all;
}

export function simCategories(p: SimParams): Cat[] {
  let labels: string[];
  if (p.device === 'coin')
    labels = p.n === 1 ? ['앞', '뒤'] : Array.from({ length: p.n + 1 }, (_, k) => `앞 ${k}개`);
  else if (p.device === 'die')
    labels = Array.from({ length: 5 * p.n + 1 }, (_, k) => String(k + p.n));
  else labels = (p.bag ?? []).map((b) => b.label);
  const all = outcomes(p);
  const hits = labels.map(() => 0);
  for (const o of all) hits[catOf(p, o)] = (hits[catOf(p, o)] ?? 0) + 1;
  return labels.map((label, i) => ({ label, prob: div(qi(hits[i] ?? 0), qi(all.length)) }));
}

export const simInit = (p: SimParams): SimState => ({
  counts: simCategories(p).map(() => 0),
  trials: 0,
});

/** times 번 던지기. 동전은 0/1, 주사위는 1~6, 주머니는 개수만큼의 공 중 하나를 고른다 */
export function simRun(p: SimParams, s: SimState, rng: Rng, times: number): SimState {
  const counts = [...s.counts];
  const balls = p.device === 'bag' ? outcomes(p) : [];
  for (let t = 0; t < times; t++) {
    let raw: number[];
    if (p.device === 'bag') raw = rng.pick(balls);
    else
      raw = Array.from({ length: p.n }, () =>
        p.device === 'coin' ? rng.int(0, 1) : rng.int(1, 6),
      );
    const c = catOf(p, raw);
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return { counts, trials: s.trials + times };
}

/** 막대 그림용: 범주별 나온 비율·이론값·글자 */
export function simBars(p: SimParams, s: SimState) {
  return simCategories(p).map((c, i) => {
    const n = s.counts[i] ?? 0;
    const freq = s.trials ? n / s.trials : 0;
    return {
      label: c.label,
      freq,
      theory: Number(c.prob[0]) / Number(c.prob[1]),
      theoryText: ratStr(c.prob),
      text: `${n}번 (${Math.round(freq * 100)}%)`,
    };
  });
}

// ---- 형식 검사·검산 ----

export const simulateDef: WidgetDef<SimParams> = {
  parse(raw) {
    const device = oneOf((raw as { device?: unknown } | null)?.device, '확률 실험 device', [
      'coin',
      'die',
      'bag',
    ] as const);
    const o = obj(
      raw,
      '확률 실험',
      ['device', 'seed'],
      device === 'bag' ? ['bag', 'goal'] : ['n', 'goal'],
    );
    const p: SimParams = {
      device,
      n:
        device === 'bag'
          ? 1
          : o.n === undefined
            ? 1
            : int(o.n, '확률 실험 n', 1, device === 'coin' ? 4 : 2),
      seed: int(o.seed, '확률 실험 seed', 0, 2 ** 31),
      goal: o.goal === undefined ? 100 : int(o.goal, '확률 실험 goal', 10, 10000),
    };
    if (device === 'bag') {
      if (o.bag === undefined) fail('확률 실험', '주머니에는 bag 이 필요');
      p.bag = arr(o.bag, '확률 실험 bag', 2, 5).map((rb, i) => {
        const b = obj(rb, `확률 실험 bag${i + 1}`, ['label', 'count']);
        return {
          label: str(b.label, `확률 실험 bag${i + 1} label`),
          count: int(b.count, `확률 실험 bag${i + 1} count`, 1, 20),
        };
      });
    }
    return p;
  },
  checks(p) {
    const cats = simCategories(p);
    // sympy 쪽은 파이썬으로 모든 경우를 따로 늘어놓아 센다(앱의 늘어놓기와 독립)
    const vars = Array.from({ length: p.n }, (_, i) => `v${i}`);
    const loops = (range: string) => vars.map((v) => `for ${v} in ${range}`).join(' ');
    const sum = vars.join('+');
    return cats.map((c, i): WidgetCheck => {
      let check: string;
      if (p.device === 'coin') {
        const heads = p.n === 1 ? 1 - i : i;
        check = `Rational(len([1 ${loops('range(2)')} if ${sum} == ${heads}]), 2**${p.n})`;
      } else if (p.device === 'die') {
        check = `Rational(len([1 ${loops('range(1, 7)')} if ${sum} == ${i + p.n}]), 6**${p.n})`;
      } else {
        const counts = (p.bag ?? []).map((b) => b.count);
        check = `Rational(${counts[i]}, ${counts.join('+')})`;
      }
      return { name: `이론값 ${c.label}`, answer: ratStr(c.prob), answerType: 'fraction', check };
    });
  },
  texts: (p) => (p.bag ?? []).map((b) => b.label),
};
