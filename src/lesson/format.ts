// 레슨 화면 글자를 데이터에서 만들어 내는 순수 함수들. 검사기와 화면이 같은 함수를 써야
// "검산한 값 = 보이는 값"이 보장된다.
import type { Lesson, NumFormat, SpotToken } from './types.ts';

const MINUS = '−';

/** "a/b"·정수 문자열 → [분자, 분모]. 형식이 다르면 예외 */
function rational(v: string): [bigint, bigint] {
  const m = v.match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!m) throw new Error(`값은 정수나 "a/b" 꼴이어야 함: ${v}`);
  const d = BigInt(m[2] ?? '1');
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
  return (neg ? MINUS : '') + body + (f.unit ?? '');
}

/** 글 속 {{이름}} 을 값으로. 모르는 이름은 오류(검사 단계에서 잡히게) */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) throw new Error(`모르는 치환 이름 {{${k}}}`);
    return v;
  });
}

/** sym 에 쓸 수 있는 글자. 숫자·소문자 변수·사칙·거듭제곱(**)·괄호만 — ^ 는 sympy 에서 XOR 이다 */
const SYM_OK = /^[0-9a-z+\-*/(). ]+$/;

/**
 * 계산식(sympy 문법)을 KaTeX 글자로. 곱셈 기호는 숫자·문자 사이면 숨기고 숫자끼리면 ×,
 * 거듭제곱은 위첨자. 화면 글자를 계산식에서 만들어야 검산한 식과 보이는 식이 어긋나지 않는다.
 */
export function symToTex(sym: string): string {
  const s = sym.replace(/\s+/g, '');
  if (!s || !SYM_OK.test(s) || /[a-z]{2}/.test(s)) throw new Error(`식에 쓸 수 없는 글자: ${sym}`);
  return s
    .replace(/\*\*(\d+|[a-z])/g, '^{$1}')
    .replace(/(\d)\*(\d)/g, '$1\\times $2')
    .replace(/\*/g, '');
}

/** 틀린 곳 찾기 토큰을 이어 붙인 등식(검산할 "틀린 식") */
export function spotEquation(tokens: SpotToken[]): string {
  return tokens.map((t) => ('sep' in t ? '=' : t.sym.replace(/\s+/g, ''))).join('');
}

const HANDS_ON = new Set(['question', 'explore', 'spot', 'solve']);

/** 손으로 해 보는 장면 수. 도입 장면의 "직접 해 보기 N번" */
export const handsOnCount = (l: Lesson) => l.scenes.filter((s) => HANDS_ON.has(s.kind)).length;
