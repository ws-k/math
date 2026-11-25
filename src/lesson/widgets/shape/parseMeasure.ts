// 측정값 읽기(형식 검사). 차례로 읽는다 — 합·차·비·제곱·사인은 앞에서 읽은 측정값만 가리킨다(순환이 생기지 않게).
import { arr, fail, int, str } from '../../parse.ts';
import { measureKey, measureKind, measureName } from './measure.ts';
import type { ShapeParams, ShMeasure, ShMeasureOpts } from './types.ts';

/** 측정값 수 상한. 읽는 줄이 세 줄을 넘으면 접은 화면에서 그림과 버튼이 한 화면을 넘는다 */
export const MAX_MEASURES = 8;
const KINDS = ['len', 'angle', 'area', 'sum', 'diff', 'ratio', 'arc', 'around', 'sq', 'sin'];
const OPTS = ['label', 'tag', 'mark', 'ccw'];
/** 이름표 글자 수 상한(읽는 줄 한 칸에 들게) */
const LABEL_MAX = 8;

export function parseMeasures(
  raw: unknown,
  p: ShapeParams,
  need: (v: unknown, at: string) => string,
): void {
  const rawMeasures = raw === undefined ? [] : arr(raw, '도형판 measures', 0, MAX_MEASURES);
  rawMeasures.forEach((rm, i) => {
    const at = `도형판 측정${i + 1}`;
    if (typeof rm !== 'object' || rm === null || Array.isArray(rm)) fail(at, '객체가 아님');
    const m = rm as Record<string, unknown>;
    for (const k of Object.keys(m))
      if (!KINDS.includes(k) && !OPTS.includes(k)) fail(at, `모르는 칸 ${k}`);
    // 열쇠가 둘이면 앞의 것만 읽혀 나머지가 소리 없이 버려진다
    if (KINDS.filter((k) => m[k] !== undefined).length !== 1)
      fail(at, `${KINDS.join('·')} 중 하나만`);
    const base = readKind(m, at, i, p, need);
    const opts = readOpts(m, at, base);
    p.measures.push({ ...base, ...opts } as ShMeasure);
  });
}

/** 앞 측정값 번호 하나 */
function prevIndex(v: unknown, w: string, i: number) {
  if (i === 0) fail(w, '앞 측정값이 없음(묶을 측정값을 먼저 적으세요)');
  return int(v, w, 0, i - 1);
}

function readKind(
  m: Record<string, unknown>,
  at: string,
  i: number,
  p: ShapeParams,
  need: (v: unknown, at: string) => string,
): ShMeasure {
  if (m.len !== undefined) {
    const l = arr(m.len, `${at} len`, 2, 2).map((v) => need(v, `${at} len`));
    return { len: [l[0], l[1]] as [string, string] };
  }
  if (m.angle !== undefined) {
    const l = arr(m.angle, `${at} angle`, 3, 3).map((v) => need(v, `${at} angle`));
    return { angle: [l[0], l[1], l[2]] as [string, string, string] };
  }
  if (m.area !== undefined) return { area: int(m.area, `${at} area`, 0, p.polygons.length - 1) };
  if (m.arc !== undefined) {
    if (!p.arcs?.length) fail(`${at} arc`, '호(arcs)가 없음');
    return { arc: int(m.arc, `${at} arc`, 0, (p.arcs?.length ?? 1) - 1) };
  }
  if (m.around !== undefined) {
    if (!p.circles.length) fail(`${at} around`, '원(circles)이 없음');
    return { around: int(m.around, `${at} around`, 0, p.circles.length - 1) };
  }
  // 제곱·사인: 앞 측정값 하나를 바꾼 값(AB²·sin A). 묶은 값은 다시 바꾸지 않는다(이름이 길어지고 뜻이 흐려짐)
  for (const k of ['sq', 'sin'] as const) {
    if (m[k] === undefined) continue;
    const j = prevIndex(m[k], `${at} ${k}`, i);
    const t = p.measures[j] as ShMeasure;
    if (k === 'sq' && !('len' in t)) fail(`${at} sq`, '제곱은 길이 측정값만(AB²)');
    if (k === 'sin' && !('angle' in t)) fail(`${at} sin`, 'sin 은 각 측정값만(sin A)');
    return k === 'sq' ? { sq: j } : { sin: j };
  }
  const combo = (['sum', 'diff', 'ratio'] as const).find((k) => m[k] !== undefined) as
    | 'sum'
    | 'diff'
    | 'ratio';
  const n = combo === 'sum' ? 4 : 2;
  const ops = arr(m[combo], `${at} ${combo}`, 2, n).map((v, j) => {
    const w = `${at} ${combo}${j + 1}`;
    const k = prevIndex(v, w, i);
    const t = p.measures[k] as ShMeasure;
    // 비의 분모에는 sin 도(사인법칙 BC ÷ sin A)
    const sinDen = combo === 'ratio' && j === 1 && 'sin' in t;
    if (!('len' in t || 'angle' in t || 'arc' in t || 'sq' in t || sinDen))
      fail(w, '길이·각 측정값만 묶음(묶은 값·넓이는 다시 묶지 않음 — 길이 제곱·호 길이는 됨)');
    return k;
  });
  // PF + PF·|PF − FP|·PF ÷ PF 는 늘 2PF·0·1 — 끌어서 볼 것이 없다
  const ks = ops.map((k) => measureKey(p, p.measures[k] as ShMeasure));
  const dup = ks.findIndex((k, j) => ks.indexOf(k) !== j);
  if (dup >= 0)
    fail(
      at,
      `같은 측정값을 두 번 묶음 (${measureName(p, p.measures[ops[dup] as number] as ShMeasure)})`,
    );
  const kinds = ops.map((k) => measureKind(p, p.measures[k] as ShMeasure));
  if (combo === 'ratio') {
    // 비: 길이 ÷ 길이, 또는 길이 ÷ sin(사인법칙)
    if (kinds[0] !== 'len' || (kinds[1] !== 'len' && kinds[1] !== 'ratio'))
      fail(at, '비는 길이끼리만');
    return { ratio: ops as [number, number] };
  }
  if (new Set(kinds).size > 1) fail(at, '길이는 길이끼리, 각은 각끼리 묶음');
  return combo === 'sum' ? { sum: ops } : { diff: ops as [number, number] };
}

function readOpts(m: Record<string, unknown>, at: string, base: ShMeasure): ShMeasureOpts {
  const o: ShMeasureOpts = {};
  if (m.label !== undefined) {
    const l = str(m.label, `${at} label`);
    if ([...l].length > LABEL_MAX) fail(`${at} label`, `${LABEL_MAX}자까지(읽는 줄 한 칸에 들게)`);
    o.label = l;
  }
  const flag = (k: 'tag' | 'mark' | 'ccw') => {
    if (m[k] === undefined) return false;
    if (m[k] !== true) fail(`${at} ${k}`, 'true 만');
    return true;
  };
  if (flag('tag')) {
    // 그림 위에 둘 자리가 있는 것만(합·비 같은 묶은 값은 어디에 적을지 정해지지 않는다)
    if (!('len' in base || 'area' in base || 'angle' in base || 'arc' in base))
      fail(`${at} tag`, '그림 위 값은 길이·넓이·각·호 측정값에만');
    o.tag = true;
  }
  for (const k of ['mark', 'ccw'] as const)
    if (flag(k)) {
      if (!('angle' in base)) fail(`${at} ${k}`, '각에만');
      o[k] = true;
    }
  return o;
}
