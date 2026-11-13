// 레슨 화면 글자를 데이터에서 만들어 내는 순수 함수들. 검사기와 화면이 같은 함수를 써야
// "검산한 값 = 보이는 값"이 보장된다.
import { reduce } from './sym.ts';
import type { Lesson, NumFormat, SpotToken } from './types.ts';

const MINUS = '−';

/** "a/b"·정수·소수 문자열 → [분자, 분모]. 형식이 다르면 예외 */
function rational(v: string): [bigint, bigint] {
  const m = v.match(/^(-?\d+)(?:\.(\d+)|\/(\d+))?$/);
  if (!m) throw new Error(`값은 정수·소수나 "a/b" 꼴이어야 함: ${v}`);
  if (m[2] !== undefined) return reduce(BigInt(`${m[1]}${m[2]}`), 10n ** BigInt(m[2].length));
  const d = BigInt(m[3] ?? '1');
  if (d === 0n) throw new Error(`분모가 0: ${v}`);
  return [BigInt(m[1] as string), d];
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * 보기 값을 화면 글자로. digits 가 있으면 그 자리에서 반올림(0.5 는 0 에서 먼 쪽), 없으면 정수는 그대로·
 * 정수가 아니면 분수로 둔다. 큰 수도 정확하게 다루려고 BigInt 로 계산한다.
 */
export function formatValue(value: string, f: NumFormat): string {
  const [n, d] = rational(value);
  const neg = n < 0n;
  const a = neg ? -n : n;
  let body: string;
  if (f.digits !== undefined) {
    const scale = 10n ** BigInt(f.digits);
    const r = (a * scale * 2n + d) / (d * 2n);
    const ip = (r / scale).toString();
    const fp = f.digits > 0 ? `.${(r % scale).toString().padStart(f.digits, '0')}` : '';
    body = group(ip) + fp;
  } else if (a % d === 0n) {
    body = group((a / d).toString());
  } else {
    body = `${a}/${d}`;
  }
  // 반올림해서 0 이 되면(−0.3 → 0) 부호를 붙이지 않는다 — "−0" 은 다른 수처럼 보인다
  const zero = !/[1-9]/.test(body);
  return (neg && !zero ? MINUS : '') + body + (f.unit ?? '');
}

/** 글 속 {{이름}} 을 값으로. 모르는 이름은 오류(검사 단계에서 잡히게) */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) throw new Error(`모르는 치환 이름 {{${k}}}`);
    return v;
  });
}

/** 계산식 → KaTeX. 식 구조를 거쳐 만든다(sym.ts) */
export { symToTex } from './sym.ts';

/** 틀린 곳 찾기 토큰을 이어 붙인 등식(검산할 "틀린 식") */
export function spotEquation(tokens: SpotToken[]): string {
  return tokens.map((t) => ('sep' in t ? '=' : t.sym.replace(/\s+/g, ''))).join('');
}

/** bad 토큰 자리에 fix 조각을 끼운 토큰들(고친 식). 화면도 검산도 이것으로 그린다 */
export const spotFixed = (tokens: SpotToken[], fix: string): SpotToken[] =>
  tokens.map((t) => ('bad' in t && t.bad ? { sym: fix } : t));

/** 레슨 글의 {{이름}} 값: 연습문제 수 + 레슨 values(검산된 값). 화면과 검사기가 같이 쓴다 */
export function lessonVars(l: Lesson, problems: number): Record<string, string> {
  const out: Record<string, string> = { problems: String(problems) };
  for (const [k, v] of Object.entries(l.values ?? {})) out[k] = v.value;
  return out;
}

const HANDS_ON = new Set(['question', 'explore', 'spot', 'solve']);

/** 손으로 해 보는 장면 수. 도입 장면의 "직접 해 보기 N번" */
export const handsOnCount = (l: Lesson) => l.scenes.filter((s) => HANDS_ON.has(s.kind)).length;
