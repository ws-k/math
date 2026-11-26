// 레슨 화면 글자를 데이터에서 만들어 내는 순수 함수들. 검사기와 화면이 같은 함수를 써야
// "검산한 값 = 보이는 값"이 보장된다.
import { isLogicSpot, reduce, spotContinuationTex, spotTex } from './sym.ts';
import type { Choice, Lesson, NumFormat, Rel, SolveItem, SpotToken } from './types.ts';

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
  // π 의 계수 1 은 적지 않는다(1π 가 아니라 π). 0 은 π 를 붙이면 다른 수처럼 보여 0 그대로.
  // 분수 계수는 π 를 분자에 둔다(4π/3 · π/3 — 4/3π 는 4/(3π) 로도 읽혀서. 검토 M4, PM 기본값)
  if (f.pi && !zero) {
    const [num, den] = body.split('/') as [string, string | undefined];
    const top = num === '1' ? 'π' : `${num}π`;
    body = den === undefined ? top : `${top}/${den}`;
  }
  return (neg && !zero ? MINUS : '') + body + (f.unit ?? '');
}

/**
 * 보기 하나의 화면 글자. 수는 formatValue 글자(NumLabel 로 그림), 식은 KaTeX, 글자는 그대로(LRich 로 그림).
 * 형식 검사(schema.ts)와 화면(Scenes.tsx)이 같은 함수를 써서 '다른 보기와 글자가 같음' 검사가 화면 글자 그대로 본다
 */
export function choiceLabel(
  c: Choice,
  f: NumFormat,
): { num: string } | { tex: string } | { text: string } {
  if ('value' in c) return { num: formatValue(c.value, f) };
  if ('sym' in c) return { tex: chainTex(c.sym.replace(/\s+/g, '')) };
  return { text: c.text };
}

/**
 * formatValue 글자('4,096가지')를 [수, 나머지] 로. 화면이 수를 줄바꿈 없는 덩어리로, 단위 앞에만 줄바꿈 자리를 두고
 * 그린다(NumLabel) — Safari 는 keep-all 에서도 쉼표 뒤를 줄바꿈 자리로 봐 좁은 보기 칸에서 '4, / 096가지' 로 갈랐고,
 * 크롬은 수와 단위를 한 낱말로 봐 칸 밖으로 넘쳤다. 수로 시작하지 않으면 null
 */
export function numSplit(text: string): [string, string] | null {
  // π 보기의 π 는 수에 붙은 덩어리 — 36 과 π, 4π 와 /3 사이에서 줄이 바뀌면 다른 수처럼 보인다
  const m = /^([−-]?\d[\d,]*(?:\.\d+)?(?:\/\d+|π\/\d+|π)?)(.*)$/s.exec(text);
  return m ? [m[1] as string, m[2] as string] : null;
}

/**
 * 수 하나만 적은 TeX 글자($−3$ · $2.5$ · $\frac{3}{4}$ · $1\frac{1}{2}$)의 값을 기약분수 글자("3/2")로. 다른 꼴이면 null.
 * 직접 풀기의 객관식 보기·정답 표기(answerTex)는 손으로 적는 글자라, 이것으로 검산한 수와 같은 수인지 대조한다
 */
export function texNumber(s: string): string | null {
  const m = /^\$(-?)(?:(\d+(?:\.\d+)?)|(\d+)?\\d?frac\{(\d+)\}\{(\d+)\})\$$/.exec(s.trim());
  if (!m) return null;
  const [, sign, dec, whole, num, den] = m;
  let n: bigint;
  let d: bigint;
  if (dec !== undefined) [n, d] = rational(dec);
  else {
    d = BigInt(den as string);
    if (d === 0n) return null;
    n = BigInt(whole ?? '0') * d + BigInt(num as string);
    [n, d] = reduce(n, d);
  }
  if (sign) n = -n;
  return d === 1n ? `${n}` : `${n}/${d}`;
}

export const CIRCLED = '①②③④⑤';

/**
 * 직접 풀기 글의 {{answer}} 에 들어갈 답 글자: 정답 표기(answerTex)가 있으면 그것, 객관식이면 보기 번호 ①~⑤,
 * 아니면 검산한 답 그대로. 형식 검사와 화면이 같은 함수를 써야 검사한 글자가 화면 글자다
 */
export const solveAnswerText = (it: Pick<SolveItem, 'answer' | 'answerType' | 'answerTex'>) =>
  it.answerTex ??
  (it.answerType === 'choice' ? (CIRCLED[Number(it.answer) - 1] ?? it.answer) : it.answer);

/** 글 속 {{이름}} 을 값으로. 모르는 이름은 오류(검사 단계에서 잡히게) */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) throw new Error(`모르는 치환 이름 {{${k}}}`);
    return v;
  });
}

/** 계산식 → KaTeX. 식 구조를 거쳐 만든다(sym.ts) */
export { spotTex, symToTex } from './sym.ts';

/** 틀린 곳 찾기 토큰을 이어 붙인 식(검산할 "틀린 식"). 관계 토큰이 없으면 등식 아닌 식 */
export function spotEquation(tokens: SpotToken[]): string {
  return tokens.map((t) => ('sep' in t ? t.sep : t.sym.replace(/\s+/g, ''))).join('');
}

/** bad 토큰 자리에 fix 조각을 끼운 토큰들(고친 식). 화면도 검산도 이것으로 그린다. 부등호가 bad 면 fix 도 부등호 */
export const spotFixed = (tokens: SpotToken[], fix: string): SpotToken[] =>
  tokens.map((t) => {
    if (!('bad' in t && t.bad)) return t;
    return 'sep' in t ? { sep: fix as Rel } : { sym: fix };
  });

export const RELS: readonly Rel[] = ['=', '<', '>', '<=', '>='];
const REL_RE = /<=|>=|<|>|=/;
const REL_TEX: Record<Rel, string> = { '=': '=', '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ' };

/** 관계 기호 하나의 글자(부등호 토큰 버튼) */
export const relSignTex = (r: Rel) => REL_TEX[r].trim();

/**
 * 토큰 하나의 글자. follows: 같은 쪽에서 앞 토큰 뒤에 이어지는가(쪽의 첫 토큰이면 +·− 는 부호). 앞 토큰에 × · ÷ 로 이어지는 조각(*(2/5) · ÷2)은 기호를 앞에 그린다 — +·− 로 이어지는 조각은
 * 원래부터 식 하나로 읽힌다(+4). / 로 이어지는 조각은 분수 칸을 둘로 나눌 수 없어 받지 않는다.
 * ×·÷ 뒤 조각은 식 전체를 그릴 때와 같은 곱셈·÷ 규칙으로(sym.ts spotContinuationTex) — 조각만 따로 그려
 * 괄호를 떼면 3, *(x+2) 가 3 ×x+2 로 보인다. 토큰을 이어 그린 글자가 검산하는 식과 같은지는 형식 검사(schema.ts)가 항목마다 본다.
 */
export function tokenTex(sym: string, follows = false): string {
  const s = sym.replace(/\s+/g, '');
  if (s.startsWith('**')) throw new Error(`식을 읽을 수 없음(거듭제곱으로 시작): ${sym}`);
  const op = s[0];
  if (op === '*' || op === '÷') {
    if (!follows) throw new Error(`쪽의 첫 토큰은 × · ÷ 로 시작할 수 없음: ${sym}`);
    return spotContinuationTex(op, s.slice(1));
  }
  // 앞 토큰에 +·− 로 이어지는 조각도 이어 붙인 식처럼 — 따로 그리면 +7*4/2 가 (+7×4)/2 로 부호가 분자 안에 들어간다
  if (follows && (op === '+' || op === '-')) return spotContinuationTex(op, s.slice(1));
  return spotTex(s);
}

/**
 * spot 식을 관계 기호 하나로 [왼쪽, 관계, 오른쪽] 으로, 관계가 없으면 [식] 으로. 둘 이상이면 예외(1<x<3 같은
 * 이어 쓴 부등식은 아직 검산하지 않는다). 수직선의 부등식 읽기(numberLine.ts splitIneq)와 같은 일이라 나중에 이것으로 합친다
 */
export function splitRel(s: string): [string, Rel, string] | [string] {
  const ops = s.match(new RegExp(REL_RE.source, 'g')) ?? [];
  if (ops.length > 1) throw new Error(`관계 기호가 둘 이상: ${s}`);
  if (ops.length === 0) return [s];
  const [l, r] = s.split(REL_RE) as [string, string];
  return [l, ops[0] as Rel, r];
}

/**
 * spot 식("왼쪽 관계 오른쪽", 또는 관계 없는 식) → KaTeX. 등식은 예전 화면과 같은 글자(양쪽을 따로 그려 = 로 잇기).
 * 명제끼리의 = 는 ⇔ 로 그린다 — 검산기는 '참·거짓이 늘 같은가'를 보는데 p→q = ~q→~p 는 수의 등식처럼 읽힌다
 */
export function relTex(s: string): string {
  const parts = splitRel(s);
  if (parts.length === 1) return spotTex(parts[0]);
  const [l, op, r] = parts;
  const sign = op === '=' && (isLogicSpot(l) || isLogicSpot(r)) ? '\\Leftrightarrow ' : REL_TEX[op];
  return `${spotTex(l)}${sign}${spotTex(r)}`;
}

const ineqDir = (r: string) => (r[0] === '<' ? '<' : r[0] === '>' ? '>' : '=');

/**
 * 식·구간 보기용: splitRel 에 더해 같은 방향 부등호 둘로 이어 쓴 부등식(−1<x≤3)도 [식, 관계, 식, 관계, 식] 으로.
 * 방향이 엇갈리면(1<x>3) 구간 하나로 읽을 수 없어 예외. 틀린 곳 찾기 식은 이어 쓴 꼴을 아직 검산하지 않아 splitRel 그대로
 */
export function splitChain(s: string): string[] {
  const ops = s.match(new RegExp(REL_RE.source, 'g')) ?? [];
  if (ops.length < 2) return splitRel(s);
  const [a, b] = ops as [string, string];
  if (ops.length > 2 || ineqDir(a) === '=' || ineqDir(a) !== ineqDir(b))
    throw new Error(`이어 쓴 부등식은 같은 방향 부등호 둘까지: ${s}`);
  const [l, m, r] = s.split(REL_RE) as [string, string, string];
  return [l, a, m, b, r];
}

/** 이어 쓴 부등식까지 그리는 relTex(식·구간 보기 글자) */
export function chainTex(s: string): string {
  const parts = splitChain(s);
  if (parts.length < 5) return relTex(s);
  return parts.map((x, k) => (k % 2 ? REL_TEX[x as Rel] : spotTex(x))).join('');
}

/** 틀린 곳 찾기 토큰 사이 등호 자리의 글자(누를 수 없는 칸). 명제끼리면 relTex 와 같게 ⇔ */
// 토큰 하나씩이 아니라 이어 붙인 쪽 전체로 본다 — '*3'·'÷2' 처럼 앞 토큰에 이어지는 조각은 혼자 식이 아니라
// 토큰마다 읽으면 화면이 예외로 죽는다(검토 C1). 명제는 식 전체로만 쓰여(sym.ts logicOnly) 쪽 단위로 판정해도 같다
export function spotEqSign(tokens: SpotToken[]): '=' | '⇔' {
  const parts = splitRel(spotEquation(tokens));
  return parts.length === 3 && parts[1] === '=' && (isLogicSpot(parts[0]) || isLogicSpot(parts[2]))
    ? '⇔'
    : '=';
}

/** 레슨 글의 {{이름}} 값: 연습문제 수 + 레슨 values(검산된 값). 화면과 검사기가 같이 쓴다 */
export function lessonVars(l: Lesson, problems: number): Record<string, string> {
  const out: Record<string, string> = { problems: String(problems) };
  for (const [k, v] of Object.entries(l.values ?? {})) out[k] = v.value;
  return out;
}

const HANDS_ON = new Set(['question', 'explore', 'spot', 'solve']);

/** 손으로 해 보는 장면 수. 도입 장면의 "직접 해 보기 N번" */
export const handsOnCount = (l: Lesson) => l.scenes.filter((s) => HANDS_ON.has(s.kind)).length;
