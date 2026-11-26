// 레슨 형식 검사 + 검산 항목 만들기. 단원 검사(content-check)가 부른다.
// 장면 하나에서 첫 형식 오류를 만나면 그 장면은 거기서 멈추고 다음 장면으로 넘어간다 —
// 한 번에 모든 장면의 문제를 보여 주되, 깨진 장면에서 엉뚱한 오류가 줄줄이 나오지 않게.
import {
  type AnswerCheck,
  answerItem,
  type CheckItem,
  checkAnswerShape,
  checkExpr,
  texOk,
} from '../content/check.ts';
import type { Example } from '../content/types.ts';
import {
  chainTex,
  fill,
  formatValue,
  RELS,
  relTex,
  splitRel,
  spotEquation,
  spotFixed,
  symToTex,
  tokenTex,
} from './format.ts';
import {
  arr,
  dict,
  fail,
  int,
  type Obj,
  obj,
  oneOf,
  optStr,
  ParseError,
  rationalStr,
  str,
} from './parse.ts';
import { hasImag, isLogicSpot, parseSpot, spotFreeVars, texToSym } from './sym.ts';
import type { NumFormat, Rel, SpotToken } from './types.ts';
import { widgetDefs } from './widgets/specs.ts';

export interface LessonCtx {
  /** 단원 연습문제 수({{problems}}) */
  problems: number;
}

const BASE = ['id', 'kind', 'title'];
const BASE_OPT = ['chip', 'lead', 'after'];

const KIND_KEYS: Record<string, { req: string[]; opt: string[] }> = {
  intro: { req: [], opt: ['meta'] },
  question: {
    req: ['choices', 'answer', 'answerCheck', 'reveal'],
    opt: ['widget', 'format', 'thoughts', 'conclude', 'gate', 'eq'],
  },
  explore: { req: ['widget'], opt: ['gate', 'afterGoal'] },
  terms: { req: ['terms'], opt: ['aside'] },
  spot: { req: ['items'], opt: [] },
  solve: { req: ['items'], opt: [] },
  summary: { req: ['points'], opt: ['done', 'next'] },
};

const SOLVE_KEYS = ['id', 'q', 'steps', 'answer', 'answerType', 'check'];
const ID_OK = /^[a-z0-9-]+$/;
const NAME_OK = /^[a-z][a-zA-Z0-9]*$/;

/**
 * 글 속 숫자 가운데 {{…}} 로 넣지 않은 것 — 검산 밖이라 경고로 알린다. 수식($…$)은 덩어리째,
 * 일반 글은 숫자 하나씩(쉼표·소수점 포함) 알린다. 수식 밖 "12,000원" 도 답과 어긋날 수 있는 숫자다.
 */
function textNumbers(s: string): string[] {
  const out: string[] = [];
  const src = s.replace(/\{\{\w+\}\}/g, '');
  const math = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  for (const m of src.matchAll(math)) {
    const seg = m[1] ?? m[2] ?? '';
    if (/\d/.test(seg)) out.push((m[0] as string).trim());
  }
  for (const m of src.replace(math, ' ').matchAll(/\d[\d,.]*/g)) out.push(m[0]);
  return out;
}

/** 값 안의 모든 글자(객체·목록을 따라 내려간다) */
function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x);
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) yield* strings(x);
}
const SOLVE_OPT = ['concepts', 'tip', 'hint', 'placeholder'];

/** 등식 "왼쪽=오른쪽" 을 검사하고 그대로 돌려준다(양쪽 다 symToTex 로 그릴 수 있어야 함) */
function equation(v: unknown, at: string): string {
  const s = str(v, at).replace(/\s+/g, '');
  const sides = s.split('=');
  if (sides.length !== 2) fail(at, `등호가 하나인 등식이 아님 (${s})`);
  for (const side of sides) {
    try {
      symToTex(side);
    } catch (e) {
      fail(at, (e as Error).message);
    }
  }
  return s;
}

/**
 * 틀린 곳 찾기 식(공백을 뺀 글자)을 검사하고 돌려준다. rel 이면 등호·부등호가 꼭 하나, 아니면 없어야 한다(등식 아닌 식).
 * 화면이 그리는 함수(relTex)로 그려 보는 것이 검사다 — 그릴 수 없는 식이 검산기로만 가지 않게
 */
function spotRel(v: unknown, at: string, rel: boolean): string {
  const s = str(v, at).replace(/\s+/g, '');
  let parts: string[] = [];
  try {
    parts = splitRel(s);
    relTex(s);
  } catch (e) {
    fail(at, (e as Error).message);
  }
  if (rel && parts.length !== 3) fail(at, `등호·부등호가 하나인 식이 아님 (${s})`);
  if (!rel && parts.length !== 1) fail(at, `등식 아닌 식에 등호·부등호가 있음 (${s})`);
  // 자연수 조건(n 이 0 이상의 정수)을 검산기가 다루지 않아, 문자가 든 n!·ₙCᵣ·ₙPᵣ·∑ 의 부등식은 판정할 수 없다
  if (
    parts.length === 3 &&
    parts[1] !== '=' &&
    COMB_RE.test(s) &&
    sideHasVars(parts[0] as string, parts[2] as string)
  )
    fail(at, `문자가 든 계승·조합·순열·∑ 의 부등식은 검산하지 않음 (${s})`);
  return s;
}

const COMB_RE = /\b(factorial|binomial|ff|Sum|H)\(/;

/**
 * 허수·명제가 든 식의 쓰임 제한(검산기 verify.py 와 같은 규칙). 복소수에는 크기가 없어 부등식이 뜻이 없고, equivalent 는
 * 실수 해 집합을 견주므로 허수 해(x=i)를 다룰 수 없다. 명제(→·~)는 identity 의 = 로만 견준다(화면은 ⇔, 참·거짓이 늘
 * 같은가) — 수와 견주거나 해 집합을 구할 수 없어서. 명제 쪽 맞은편은 명제나 글자 하나(~ 를 두 번 붙인 것을 고친 p)
 */
function spotKindRules(at: string, mode: string, exprs: string[]) {
  for (const e of exprs) {
    const parts = splitRel(e);
    const sides = parts.length === 3 ? [parts[0], parts[2]] : [parts[0]];
    if (sides.some(hasImag)) {
      if (parts.length === 3 && parts[1] !== '=')
        fail(at, `허수가 든 부등식은 검산하지 않음 (${e})`);
      if (mode === 'equivalent')
        fail(at, `허수가 든 식은 해 집합을 견주지 않음(identity·value 로) (${e})`);
    }
    const logic = sides.map(isLogicSpot);
    if (!logic.some(Boolean)) continue;
    if (mode !== 'identity' || parts[1] !== '=')
      fail(at, `명제(→·~)는 identity 의 = 로만 견줌 (${e})`);
    if (sides.some((x, k) => !logic[k] && parseSpot(x).t !== 'var'))
      fail(at, `명제와 수를 견줄 수 없음 (${e})`);
  }
}
/** ∑ 의 k 처럼 묶인 글자를 뺀, 식에 남는 글자가 있는가 */
const sideHasVars = (...sides: string[]) => sides.some((x) => spotFreeVars(parseSpot(x)).size > 0);

/**
 * 토큰을 하나씩 그린 글자를 이어 붙이면 검산하는 식과 같은 식으로 읽히는가(보이는 식 = 검산한 식).
 * 관계 기호로 나뉜 쪽마다, 토큰 글자를 이어 붙인 TeX 를 다시 식으로 읽어(texToSym) 토큰 식을 이어 붙인 것과 구조를 견준다.
 * 토큰 하나하나는 그릴 수 있어도 이어 붙이면 달라진다: (x+1) 뒤 ×2 는 x+1×2 로, ∑k 뒤 ×2 는 ∑(k×2) 로 보인다.
 * 경계에서 숫자·글자가 맞붙으면(2 | 3 → 23) 구조는 같아도 버튼 두 개가 한 수를 이루므로 따로 막는다
 */
function tokensFaithful(tokens: SpotToken[], at: string) {
  const sides: string[][] = [[]];
  for (const t of tokens) {
    if ('sep' in t) sides.push([]);
    else sides[sides.length - 1]?.push(t.sym.replace(/\s+/g, ''));
  }
  for (const syms of sides) {
    for (let k = 1; k < syms.length; k++) {
      const a = syms[k - 1] as string;
      const b = syms[k] as string;
      if (/[A-Za-z0-9.]$/.test(a) && /^[A-Za-z0-9.]/.test(b))
        fail(at, `토큰 경계에서 글자·숫자가 맞붙음 (${a} | ${b}) — 한 토큰으로 합치기`);
    }
    const joined = syms.join('');
    let shown = '';
    try {
      shown = texToSym(syms.map((x, k) => tokenTex(x, k > 0)).join(''));
      if (JSON.stringify(parseSpot(shown)) === JSON.stringify(parseSpot(joined))) continue;
    } catch (e) {
      fail(at, `토큰을 이어 그린 글자를 읽을 수 없음 (${joined}): ${(e as Error).message}`);
    }
    fail(
      at,
      `토큰을 따로 그리면 검산하는 식 ${joined} 과 다르게 보임(${shown}) — 토큰을 합치거나 괄호로 묶기`,
    );
  }
}

export function validateLesson(
  unitId: string,
  raw: unknown,
  ctx: LessonCtx,
): { errors: string[]; items: CheckItem[]; warnings: string[] } {
  const errors: string[] = [];
  const items: CheckItem[] = [];
  const warnings: string[] = [];
  const W = `${unitId} 레슨`;
  const vars: Record<string, string> = { problems: String(ctx.problems) };
  /** 화면이 {{…}} 를 채워 그리는 글(원문). 여기 없는 칸에 {{ 가 있으면 화면에 그대로 보인다 */
  const filled = new Set<string>();
  /** 글 칸: 치환 → 수식·강조 표기 검사. 화면(LRich)도 같은 값으로 채운다 */
  const text = (at: string, s: string | undefined, extra: Record<string, string> = {}) => {
    if (s === undefined) return;
    filled.add(s);
    for (const n of textNumbers(s)) warnings.push(`${at}: 글 속 숫자 ${n}`);
    try {
      texOk(at, fill(s, { ...vars, ...extra }), errors, true);
    } catch (e) {
      errors.push(`${at}: ${(e as Error).message}`);
    }
  };
  const ref = (sceneId: string, name?: string) =>
    `${unitId}/lesson:${sceneId}${name ? `:${name}` : ''}`;

  let lesson: Obj;
  let scenes: unknown[];
  const equations: Record<string, string> = {};
  try {
    lesson = obj(raw, W, ['minutes', 'scenes'], ['equations', 'values']);
    int(lesson.minutes, `${W} minutes`, 1, 120);
    scenes = arr(lesson.scenes, `${W} scenes`, 1, 20);
    if (lesson.equations !== undefined) {
      const eqs = dict(lesson.equations, `${W} equations`);
      for (const [k, v] of Object.entries(eqs)) {
        if (!NAME_OK.test(k)) fail(`${W} equations`, `이름은 영문으로 (${k})`);
        equations[k] = equation(v, `${W} equations.${k}`);
      }
    }
    if (lesson.values !== undefined) {
      const vs = dict(lesson.values, `${W} values`);
      for (const [k, rv] of Object.entries(vs)) {
        const at = `${W} values.${k}`;
        if (!NAME_OK.test(k) || k === 'problems' || k === 'answer') fail(at, '쓸 수 없는 이름');
        const v = obj(rv, at, ['value'], ['check', 'eq']);
        const value = rationalStr(v.value, `${at} value`);
        vars[k] = value;
        const vref = `${unitId}/lesson:값:${k}`;
        if ((v.check === undefined) === (v.eq === undefined)) fail(at, 'check 와 eq 중 하나만');
        if (v.eq !== undefined) {
          // 레슨 식의 해로 검산 — 같은 방정식을 검산식에 손으로 다시 적지 않게
          const name = str(v.eq, `${at} eq`);
          const e = equations[name];
          if (e === undefined) fail(`${at} eq`, `레슨 equations 에 없는 식 ${name}`);
          items.push({ ref: vref, unit: unitId, kind: 'root', eq: e as string, value });
        } else {
          checkExpr(`${at} check`, v.check, errors);
          items.push({
            ref: vref,
            unit: unitId,
            answer: value,
            answerType: 'fraction',
            check: String(v.check),
          });
        }
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
    return { errors, items, warnings };
  }

  const ids = new Set<string>();
  let solveCount = 0;
  scenes.forEach((rawScene, si) => {
    const at0 = `${W} 장면${si + 1}`;
    try {
      const kind = oneOf(
        (rawScene as Obj | null)?.kind,
        `${at0} kind`,
        Object.keys(KIND_KEYS) as string[],
      );
      const keys = KIND_KEYS[kind] as { req: string[]; opt: string[] };
      const s = obj(rawScene, at0, [...BASE, ...keys.req], [...BASE_OPT, ...keys.opt]);
      const id = str(s.id, `${at0} id`);
      if (!ID_OK.test(id)) fail(`${at0} id`, `영문 소문자·숫자·- 만 (${id})`);
      if (ids.has(id)) fail(`${at0} id`, `중복 (${id})`);
      ids.add(id);
      const at = `${W} ${id}`;
      text(`${at} 꼬리표`, optStr(s.chip, `${at} chip`));
      text(`${at} 제목`, str(s.title, `${at} title`));
      text(`${at} 리드`, optStr(s.lead, `${at} lead`));
      text(`${at} 덧붙임`, optStr(s.after, `${at} after`));

      /** 레슨 equations 이름 → 식. 없는 이름이면 형식 오류 */
      const eqRef = (v: unknown, where: string) => {
        const name = str(v, where);
        const e = equations[name];
        if (e === undefined) return fail(where, `레슨 equations 에 없는 식 ${name}`);
        return e;
      };
      /** 부품 검사. 결론 글 공개(afterGoal) 판단에 쓰려고 '목표가 있나'를 돌려준다 */
      const widget = (v: unknown): boolean => {
        const w = obj(v, `${at} widget`, ['type', 'params'], ['eq']);
        const type = str(w.type, `${at} widget.type`);
        const def = widgetDefs[type];
        if (!def) return fail(`${at} widget`, `모르는 부품 ${type}`);
        let p: unknown;
        try {
          p = def.parse(w.params);
          def.deep?.(p);
        } catch (e) {
          return fail(`${at} 부품 ${type}`, (e as Error).message);
        }
        const own = def.vars?.(p) ?? {};
        for (const t of def.texts(p)) text(`${at} 부품 글`, t, own);
        for (const c of def.checks(p)) {
          const { name, ...rest } = c;
          items.push({ ref: ref(id, name), unit: unitId, ...rest } as CheckItem);
        }
        const drawn = def.equation?.(p);
        // 레슨에 식이 있는데 식을 그리는 부품이 eq 를 빠뜨리면 장면 간 숫자 어긋남을 못 잡는다.
        // 일부러 다른 식이면 eq:false 로 밝힌다
        if (w.eq === undefined && drawn !== undefined && Object.keys(equations).length > 0)
          fail(`${at} widget`, `식을 그리는 부품은 eq 필수(다른 식이면 eq: false)`);
        if (w.eq !== undefined && w.eq !== false) {
          const want = eqRef(w.eq, `${at} widget.eq`);
          if (drawn === undefined) fail(`${at} widget.eq`, `${type} 부품은 방정식을 그리지 않음`);
          items.push({
            ref: ref(id, '같은 식'),
            unit: unitId,
            kind: 'sameeq',
            a: drawn as string,
            b: want,
          });
        }
        return def.hasGoal?.(p) ?? false;
      };

      if (s.gate !== undefined && s.gate !== true) fail(`${at} gate`, 'true 만');
      switch (kind) {
        case 'intro': {
          if (s.meta !== undefined)
            arr(s.meta, `${at} meta`, 1, 4).forEach((m, i) => {
              text(`${at} meta`, str(m, `${at} meta${i + 1}`));
            });
          break;
        }
        case 'question': {
          if (s.widget !== undefined) widget(s.widget);
          const choices = arr(s.choices, `${at} choices`, 2, 5);
          const answer = int(s.answer, `${at} answer`, 0, choices.length - 1);
          checkExpr(`${at} answerCheck`, s.answerCheck, errors);
          // 보기 꼴(수·식·글자)은 첫 보기의 칸으로 정하고 모두 같아야 한다 — 섞이면 정답 검산을 한 가지로 못 한다
          const kindOf = (c: unknown) =>
            typeof c === 'object' && c !== null && 'sym' in c
              ? 'sym'
              : typeof c === 'object' && c !== null && 'text' in c
                ? 'text'
                : 'num';
          const kind = kindOf(choices[0]);
          if (choices.some((c) => kindOf(c) !== kind))
            fail(`${at} choices`, '보기 꼴이 섞임(수·식·글자 중 한 가지로)');
          if (kind !== 'num' && s.format !== undefined)
            fail(`${at} format`, '표기 규칙은 수 보기에만');
          if (kind !== 'num' && s.eq !== undefined) fail(`${at} eq`, '식의 해(eq)는 수 보기에만');
          let format: NumFormat = {};
          if (s.format !== undefined) {
            const f = obj(s.format, `${at} format`, [], ['digits', 'unit', 'approx', 'pi']);
            if (f.approx !== undefined && f.approx !== true) fail(`${at} approx`, 'true 만');
            if (f.approx && f.digits === undefined) fail(`${at} approx`, '근삿값은 digits 필요');
            if (f.pi !== undefined && f.pi !== true) fail(`${at} pi`, 'true 만');
            // π 보기의 value 는 계수라 근삿값 보기(값 자체를 반올림)·식의 해(값이 해인가)와 뜻이 맞지 않는다
            if (f.pi && f.approx) fail(`${at} pi`, 'π 보기는 근삿값(approx)과 함께 쓰지 않음');
            if (f.pi && s.eq !== undefined)
              fail(`${at} pi`, 'π 보기는 식의 해(eq)와 함께 쓰지 않음');
            format = {
              ...(f.digits !== undefined ? { digits: int(f.digits, `${at} digits`, 0, 6) } : {}),
              ...(f.unit !== undefined ? { unit: str(f.unit, `${at} unit`) } : {}),
              ...(f.approx ? { approx: true as const } : {}),
              ...(f.pi ? { pi: true as const } : {}),
            };
          }
          const digits = format.digits ?? 0;
          /** 근삿값 보기는 digits 자리까지 적은 소수(1.41), 아니면 정수·기약분수 */
          const choiceValue = (v: unknown, where: string) => {
            if (!format.approx) return rationalStr(v, where);
            const re = digits > 0 ? new RegExp(`^-?\\d+\\.\\d{${digits}}$`) : /^-?\d+$/;
            if (typeof v !== 'string' || !re.test(v))
              return fail(where, `소수 ${digits}자리로 적은 근삿값이 아님 (${String(v)})`);
            return v;
          };
          const labels = new Set<string>();
          const checks: string[] = [];
          const values: string[] = [];
          /** 식 보기의 식 · 글자 보기의 조건 */
          const syms: string[] = [];
          const whens: string[] = [];
          choices.forEach((rc, ci) => {
            const ca = `${at} 보기${ci + 1}`;
            let label = '';
            if (kind === 'sym') {
              const c = obj(rc, ca, ['sym'], ['feedback']);
              const sym = str(c.sym, `${ca} sym`).replace(/\s+/g, '');
              try {
                label = chainTex(sym);
              } catch (e) {
                fail(`${ca} sym`, (e as Error).message);
              }
              syms.push(sym);
            } else if (kind === 'text') {
              const c = obj(rc, ca, ['text', 'when'], ['feedback']);
              label = str(c.text, `${ca} text`);
              text(`${ca} 글자`, label);
              whens.push(str(c.when, `${ca} when`));
            } else {
              const c = obj(rc, ca, ['value', 'check'], ['feedback']);
              const value = choiceValue(c.value, `${ca} value`);
              values.push(value);
              checkExpr(`${ca} check`, c.check, errors);
              label = formatValue(value, format);
              checks.push(String(c.check));
            }
            const fb = optStr((rc as Obj).feedback, `${ca} feedback`);
            if (ci !== answer && fb === undefined) fail(ca, '오답 보기에는 feedback 필수');
            text(`${ca} feedback`, fb);
            if (labels.has(label)) fail(ca, `다른 보기와 글자가 같음 (${label})`);
            labels.add(label);
          });
          text(`${at} reveal`, str(s.reveal, `${at} reveal`));
          if (s.thoughts !== undefined)
            arr(s.thoughts, `${at} thoughts`, 1, 5).forEach((t, i) => {
              text(`${at} 생각${i + 1}`, str(t, `${at} thoughts${i + 1}`));
            });
          text(`${at} conclude`, optStr(s.conclude, `${at} conclude`));
          if (kind !== 'num') {
            // 식·글자 보기는 보기마다 값 항목이 없다 — 보기 식(조건) 전체를 정답 검산 한 항목이 본다
            const base = { ref: ref(id), unit: unitId, answer: String(answer + 1) };
            const check = String(s.answerCheck);
            items.push(
              kind === 'sym'
                ? { ...base, kind: 'choicesym', check, choices: syms }
                : { ...base, kind: 'choicewhen', check, whens },
            );
            break;
          }
          const main: AnswerCheck = {
            ref: ref(id),
            unit: unitId,
            answer: String(answer + 1),
            answerType: 'choice',
            check: String(s.answerCheck),
            choiceChecks: checks,
          };
          items.push(main);
          values.forEach((value, ci) => {
            const r = ref(id, `보기${ci + 1}`);
            const c0 = checks[ci] as string;
            // π 보기의 value 는 π 의 계수 — 검산식 값을 π 로 나눠 견준다(36π 를 보이면 검산값도 36π)
            const check = format.pi ? `(${c0})/pi` : c0;
            items.push(
              format.approx
                ? { ref: r, unit: unitId, kind: 'approx', expr: check, value, digits }
                : { ref: r, unit: unitId, answer: value, answerType: 'fraction', check },
            );
          });
          if (s.eq !== undefined) {
            // 질문의 정답이 레슨 방정식의 해인가 — 영수증·저울과 질문이 같은 문제를 말하는지.
            // 미지수 이름이나 '첫 해'에 기대지 않고 해 집합 안에 있는지 본다(verify.py root)
            items.push({
              ref: ref(id, '식의 해'),
              unit: unitId,
              kind: 'root',
              eq: eqRef(s.eq, `${at} eq`),
              value: values[answer] as string,
              ...(format.approx ? { digits } : {}),
            });
          }
          break;
        }
        case 'explore': {
          const hasGoal = widget(s.widget);
          if (s.afterGoal !== undefined) {
            // 결론 글을 목표를 이룬 뒤에 보인다 — 결론을 먼저 읽고 조작하지 않게
            if (s.afterGoal !== true) fail(`${at} afterGoal`, 'true 만');
            if (s.after === undefined) fail(`${at} afterGoal`, '미룰 결론 글(after)이 없음');
            if (!hasGoal)
              fail(`${at} afterGoal`, '목표가 없는 부품 — 한 번 만지면 바로 보여 미루는 뜻이 없음');
          }
          break;
        }
        case 'terms': {
          arr(s.terms, `${at} terms`, 1, 6).forEach((rt, i) => {
            const t = obj(rt, `${at} 용어${i + 1}`, ['term', 'body']);
            text(`${at} 용어`, str(t.term, `${at} term`));
            text(`${at} 용어 설명`, str(t.body, `${at} body`));
          });
          text(`${at} aside`, optStr(s.aside, `${at} aside`));
          break;
        }
        case 'spot': {
          arr(s.items, `${at} items`, 1, 3).forEach((ri, ii) => {
            const ia = `${at} 함정${ii + 1}`;
            const it = obj(ri, ia, ['prompt', 'mode', 'tokens', 'fix'], ['from', 'check']);
            text(`${ia} prompt`, str(it.prompt, `${ia} prompt`));
            const mode = oneOf(it.mode, `${ia} mode`, ['identity', 'equivalent', 'value'] as const);
            // 등식 아닌 식(value)은 관계 기호가 없고, 기준을 보이는 식(from)이나 숨은 검산식(check) 하나로 받는다
            const value = mode === 'value';
            const from = it.from === undefined ? undefined : spotRel(it.from, `${ia} from`, !value);
            const check = it.check === undefined ? undefined : str(it.check, `${ia} check`);
            // 숨은 기준도 문제 check 와 같은 규칙 — 72 처럼 답을 그대로 적으면 검산이 아무것도 보지 않는다
            if (check !== undefined) checkExpr(`${ia} check`, check, errors);
            // check 는 파이썬으로 계산해 소수가 부동소수(0.1+0.2 = 0.30000000000000004)가 된다 — 분수로 적게 한다
            if (check !== undefined && /\d*\.\d/.test(check))
              fail(`${ia} check`, '소수는 Rational(1, 10) 처럼 분수로 적기');
            if (value) {
              if ((from === undefined) === (check === undefined))
                fail(ia, 'value 는 from(보이는 식)·check(숨은 검산식) 중 하나만');
            } else {
              if (check !== undefined) fail(`${ia} check`, 'check 는 value 일 때만');
              if ((mode === 'equivalent') !== (from !== undefined))
                fail(ia, 'from 은 equivalent 일 때만, 그리고 반드시 있어야 함');
            }
            const tokens = arr(it.tokens, `${ia} tokens`, value ? 2 : 3, 12).map((rt, ti, all) => {
              const ta = `${ia} 토큰${ti + 1}`;
              const t = obj(rt, ta, [], ['sym', 'bad', 'sep']);
              if (t.bad !== undefined && t.bad !== true) fail(ta, 'bad 는 true 만');
              if ('sep' in t) {
                obj(rt, ta, ['sep'], ['bad']);
                const sep = oneOf(t.sep, ta, RELS);
                if (sep === '=' && t.bad) fail(ta, '등호는 틀린 곳이 될 수 없음(부등호만)');
                return (t.bad ? { sep, bad: true } : { sep }) as SpotToken;
              }
              const sym = str(t.sym, ta);
              const prev = all[ti - 1];
              const follows = typeof prev === 'object' && prev !== null && !('sep' in prev);
              try {
                tokenTex(sym, follows);
              } catch (e) {
                fail(ta, (e as Error).message);
              }
              return (t.bad ? { sym, bad: true } : { sym }) as SpotToken;
            });
            const seps = tokens.filter((t) => 'sep' in t).length;
            const bads = tokens.filter((t) => 'bad' in t);
            if (seps !== (value ? 0 : 1))
              fail(
                ia,
                value
                  ? `등식 아닌 식에 관계 토큰 (${seps}개)`
                  : `등호 토큰이 하나여야 함 (${seps}개)`,
              );
            if (bads.length !== 1) fail(ia, `틀린 토큰(bad)이 하나여야 함 (${bads.length}개)`);
            const wrong = spotRel(spotEquation(tokens), `${ia} 토큰 식`, !value);
            tokensFaithful(tokens, `${ia} 토큰`);
            const fx = obj(it.fix, `${ia} fix`, ['sym', 'body']);
            const fixSym = str(fx.sym, `${ia} fix.sym`).replace(/\s+/g, '');
            const badSep = bads[0] && 'sep' in bads[0] ? bads[0].sep : undefined;
            if (badSep !== undefined) {
              // 부등호가 틀린 곳이면 고친 조각도 다른 부등호 하나
              if (!RELS.includes(fixSym as Rel) || fixSym === '=' || fixSym === badSep)
                fail(
                  `${ia} fix.sym`,
                  `틀린 부등호 ${badSep} 대신 쓸 다른 부등호(<·>·<=·>=)여야 함`,
                );
            } else {
              if (/[=<>]/.test(fixSym))
                fail(`${ia} fix.sym`, 'bad 토큰 자리에 들어갈 조각만(등식 전체가 아님)');
              // 앞 토큰에 연산자로 이어지던 조각(+2)을 연산자 없는 조각(2)으로 바꾸면 앞 토큰과 맞붙어 다른 식이 된다.
              // 쪽의 첫 토큰(-1 처럼 부호로 시작하는 한 쪽 전체)은 앞에 붙을 것이 없어 괜찮다
              const op = /^[-+*÷]/;
              const bi = tokens.indexOf(bads[0] as SpotToken);
              const prev = tokens[bi - 1];
              const follows = prev !== undefined && !('sep' in prev);
              const badSym = (bads[0] as { sym: string }).sym.trim();
              try {
                tokenTex(fixSym, follows);
              } catch (e) {
                fail(`${ia} fix.sym`, (e as Error).message);
              }
              if (follows && op.test(badSym) && !op.test(fixSym))
                fail(`${ia} fix.sym`, `틀린 조각 ${badSym} 처럼 연산자로 시작해야 함`);
            }
            // 고친 식 = bad 토큰만 바꿔 끼운 식. 고친 식을 따로 받으면 bad 표시를 엉뚱한 토큰에 달아도 통과한다
            const fixed = spotRel(spotEquation(spotFixed(tokens, fixSym)), `${ia} 고친 식`, !value);
            tokensFaithful(spotFixed(tokens, fixSym), `${ia} 고친 토큰`);
            spotKindRules(ia, mode, [...(from !== undefined ? [from] : []), wrong, fixed]);
            if (check !== undefined && check.replace(/\s+/g, '') === fixed)
              fail(
                `${ia} check`,
                '숨은 검산식이 고친 식을 그대로 적음 — 무엇의 값인지 따로 계산하는 식이어야 함',
              );
            text(`${ia} fix.body`, str(fx.body, `${ia} fix.body`));
            items.push({
              ref: ref(id, String(ii + 1)),
              unit: unitId,
              kind: 'spot',
              mode,
              ...(from !== undefined ? { from } : {}),
              ...(check !== undefined ? { check } : {}),
              wrong,
              fixed,
            });
          });
          break;
        }
        case 'solve': {
          const itemIds = new Set<string>();
          arr(s.items, `${at} items`, 1, 3).forEach((ri, ii) => {
            const ia = `${at} 문제${ii + 1}`;
            const e = obj(ri, ia, SOLVE_KEYS, SOLVE_OPT) as unknown as Example & {
              id: unknown;
              hint?: unknown;
              placeholder?: unknown;
            };
            const iid = str(e.id, `${ia} id`);
            if (!ID_OK.test(iid)) fail(`${ia} id`, `영문 소문자·숫자·- 만 (${iid})`);
            if (itemIds.has(iid)) fail(`${ia} id`, `중복 (${iid})`);
            itemIds.add(iid);
            oneOf(e.answerType, `${ia} answerType`, ['int', 'fraction'] as const);
            checkAnswerShape(ia, e, errors);
            // 레슨은 문제·힌트·풀이 단계 모두 강조 표기(**)를 살려 그린다. {{answer}} 는 이 문제의 검산된 답
            const own = { answer: e.answer };
            text(`${ia} 문제`, e.q, own);
            text(`${ia} hint`, optStr(e.hint, `${ia} hint`), own);
            e.steps.forEach((st, si) => {
              text(`${ia} ${si + 1}단계 제목`, st.title, own);
              text(`${ia} ${si + 1}단계`, st.body, own);
            });
            text(`${ia} 팁`, e.tip, own);
            for (const c of e.concepts ?? []) text(`${ia} 개념`, c, own);
            optStr(e.placeholder, `${ia} placeholder`);
            items.push(answerItem(ref(id, iid), unitId, e));
            solveCount++;
          });
          break;
        }
        case 'summary': {
          arr(s.points, `${at} points`, 1, 5).forEach((p, i) => {
            text(`${at} 요약${i + 1}`, str(p, `${at} points${i + 1}`));
          });
          text(`${at} done`, optStr(s.done, `${at} done`));
          text(`${at} next`, optStr(s.next, `${at} next`));
          break;
        }
      }
      // 화면이 채우지 않는 칸(단위·placeholder 등)에 {{ 가 있으면 화면에 그대로 보인다
      for (const str0 of strings(rawScene))
        if (str0.includes('{{') && !filled.has(str0))
          errors.push(`${at}: 화면이 채우지 않는 칸에 {{…}} — ${str0}`);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      errors.push(e.message);
    }
  });
  if (solveCount < 2 || solveCount > 3)
    errors.push(`${W}: 직접 풀기 문제는 합쳐서 2~3개 (${solveCount}개)`);
  return { errors, items, warnings };
}
