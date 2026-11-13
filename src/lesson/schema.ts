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
import { fill, formatValue, spotEquation, spotFixed, symToTex } from './format.ts';
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
import type { NumFormat, SpotToken } from './types.ts';
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
  explore: { req: ['widget'], opt: ['gate'] },
  terms: { req: ['terms'], opt: ['aside'] },
  spot: { req: ['items'], opt: [] },
  solve: { req: ['items'], opt: [] },
  summary: { req: ['points'], opt: ['done', 'next'] },
};

const SOLVE_KEYS = ['id', 'q', 'steps', 'answer', 'answerType', 'check'];
const ID_OK = /^[a-z0-9-]+$/;
const NAME_OK = /^[a-z][a-zA-Z0-9]*$/;

/** 수식($…$) 속 숫자 가운데 {{…}} 로 넣지 않은 것 — 검산 밖이라 경고로 알린다 */
function mathNumbers(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)) {
    const seg = (m[1] ?? m[2] ?? '').replace(/\{\{\w+\}\}/g, '');
    if (/\d/.test(seg)) out.push((m[0] as string).trim());
  }
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
    for (const n of mathNumbers(s)) warnings.push(`${at}: 수식 속 숫자 ${n}`);
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
        const v = obj(rv, at, ['value', 'check']);
        const value = rationalStr(v.value, `${at} value`);
        checkExpr(`${at} check`, v.check, errors);
        vars[k] = value;
        items.push({
          ref: `${unitId}/lesson:값:${k}`,
          unit: unitId,
          answer: value,
          answerType: 'fraction',
          check: String(v.check),
        });
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
      const widget = (v: unknown) => {
        const w = obj(v, `${at} widget`, ['type', 'params'], ['eq']);
        const type = str(w.type, `${at} widget.type`);
        const def = widgetDefs[type];
        if (!def) return fail(`${at} widget`, `모르는 부품 ${type}`);
        let p: unknown;
        try {
          p = def.parse(w.params);
        } catch (e) {
          return fail(`${at} 부품 ${type}`, (e as Error).message);
        }
        const own = def.vars?.(p) ?? {};
        for (const t of def.texts(p)) text(`${at} 부품 글`, t, own);
        for (const c of def.checks(p)) {
          const { name, ...rest } = c;
          items.push({ ref: ref(id, name), unit: unitId, ...rest } as CheckItem);
        }
        if (w.eq !== undefined) {
          const want = eqRef(w.eq, `${at} widget.eq`);
          const drawn = def.equation?.(p);
          if (drawn === undefined) fail(`${at} widget.eq`, `${type} 부품은 방정식을 그리지 않음`);
          items.push({
            ref: ref(id, '같은 식'),
            unit: unitId,
            kind: 'sameeq',
            a: drawn as string,
            b: want,
          });
        }
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
          let format: NumFormat = {};
          if (s.format !== undefined) {
            const f = obj(s.format, `${at} format`, [], ['digits', 'unit', 'approx']);
            if (f.approx !== undefined && f.approx !== true) fail(`${at} approx`, 'true 만');
            if (f.approx && f.digits === undefined) fail(`${at} approx`, '근삿값은 digits 필요');
            format = {
              ...(f.digits !== undefined ? { digits: int(f.digits, `${at} digits`, 0, 6) } : {}),
              ...(f.unit !== undefined ? { unit: str(f.unit, `${at} unit`) } : {}),
              ...(f.approx ? { approx: true as const } : {}),
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
          choices.forEach((rc, ci) => {
            const ca = `${at} 보기${ci + 1}`;
            const c = obj(rc, ca, ['value', 'check'], ['feedback']);
            const value = choiceValue(c.value, `${ca} value`);
            values.push(value);
            checkExpr(`${ca} check`, c.check, errors);
            const fb = optStr(c.feedback, `${ca} feedback`);
            if (ci !== answer && fb === undefined) fail(ca, '오답 보기에는 feedback 필수');
            text(`${ca} feedback`, fb);
            const label = formatValue(value, format);
            if (labels.has(label)) fail(ca, `다른 보기와 글자가 같음 (${label})`);
            labels.add(label);
            checks.push(String(c.check));
          });
          text(`${at} reveal`, str(s.reveal, `${at} reveal`));
          if (s.thoughts !== undefined)
            arr(s.thoughts, `${at} thoughts`, 1, 5).forEach((t, i) => {
              text(`${at} 생각${i + 1}`, str(t, `${at} thoughts${i + 1}`));
            });
          text(`${at} conclude`, optStr(s.conclude, `${at} conclude`));
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
            const check = checks[ci] as string;
            items.push(
              format.approx
                ? { ref: r, unit: unitId, kind: 'approx', expr: check, value, digits }
                : { ref: r, unit: unitId, answer: value, answerType: 'fraction', check },
            );
          });
          if (s.eq !== undefined) {
            // 질문의 정답이 레슨 방정식의 해인가 — 영수증·저울과 질문이 같은 문제를 말하는지
            const [l, r] = eqRef(s.eq, `${at} eq`).split('=');
            const check = `solve(Eq(${l}, ${r}), x)[0]`;
            const value = values[answer] as string;
            items.push(
              format.approx
                ? {
                    ref: ref(id, '식의 해'),
                    unit: unitId,
                    kind: 'approx',
                    expr: check,
                    value,
                    digits,
                  }
                : {
                    ref: ref(id, '식의 해'),
                    unit: unitId,
                    answer: value,
                    answerType: 'fraction',
                    check,
                  },
            );
          }
          break;
        }
        case 'explore':
          widget(s.widget);
          break;
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
            const it = obj(ri, ia, ['prompt', 'mode', 'tokens', 'fix'], ['from']);
            text(`${ia} prompt`, str(it.prompt, `${ia} prompt`));
            const mode = oneOf(it.mode, `${ia} mode`, ['identity', 'equivalent'] as const);
            const from = it.from === undefined ? undefined : equation(it.from, `${ia} from`);
            if ((mode === 'equivalent') !== (from !== undefined))
              fail(ia, 'from 은 equivalent 일 때만, 그리고 반드시 있어야 함');
            const tokens = arr(it.tokens, `${ia} tokens`, 3, 12).map((rt, ti) => {
              const ta = `${ia} 토큰${ti + 1}`;
              const t = obj(rt, ta, [], ['sym', 'bad', 'sep']);
              if ('sep' in t) {
                obj(rt, ta, ['sep']);
                oneOf(t.sep, ta, ['='] as const);
                return { sep: '=' } as SpotToken;
              }
              const sym = str(t.sym, ta);
              try {
                symToTex(sym);
              } catch (e) {
                fail(ta, (e as Error).message);
              }
              if (t.bad !== undefined && t.bad !== true) fail(ta, 'bad 는 true 만');
              return (t.bad ? { sym, bad: true } : { sym }) as SpotToken;
            });
            const seps = tokens.filter((t) => 'sep' in t).length;
            const bads = tokens.filter((t) => 'bad' in t).length;
            if (seps !== 1) fail(ia, `등호 토큰이 하나여야 함 (${seps}개)`);
            if (bads !== 1) fail(ia, `틀린 토큰(bad)이 하나여야 함 (${bads}개)`);
            const wrong = equation(spotEquation(tokens), `${ia} 토큰 식`);
            const fx = obj(it.fix, `${ia} fix`, ['sym', 'body']);
            const fixSym = str(fx.sym, `${ia} fix.sym`).replace(/\s+/g, '');
            if (fixSym.includes('='))
              fail(`${ia} fix.sym`, 'bad 토큰 자리에 들어갈 조각만(등식 전체가 아님)');
            try {
              symToTex(fixSym);
            } catch (e) {
              fail(`${ia} fix.sym`, (e as Error).message);
            }
            // 고친 식 = bad 토큰만 바꿔 끼운 식. 고친 식을 따로 받으면 bad 표시를 엉뚱한 토큰에 달아도 통과한다
            const fixed = equation(spotEquation(spotFixed(tokens, fixSym)), `${ia} 고친 식`);
            text(`${ia} fix.body`, str(fx.body, `${ia} fix.body`));
            items.push({
              ref: ref(id, String(ii + 1)),
              unit: unitId,
              kind: 'spot',
              mode,
              ...(from !== undefined ? { from } : {}),
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
