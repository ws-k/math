// 단원 JSON 의 형식 검사 + 검산할 항목 모으기. dump-problems 와 테스트에서 함께 쓴다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Curriculum, Example, Problem, Unit } from '../src/content/types.ts';
import { allGenerators, generate } from '../src/generators/index.ts';
import { renderRich } from '../src/lib/math.ts';

export interface CheckItem {
  ref: string;
  unit: string;
  answer: string;
  answerType: string;
  check: string;
  choiceChecks?: string[];
}

export interface CheckResult {
  errors: string[];
  items: CheckItem[];
  units: Unit[];
}

const LEVEL_MIN: Record<string, number> = { 기초: 15, 표준: 10 };
const TYPES = new Set(['int', 'fraction', 'expr', 'choice']);

function texOk(where: string, s: string | undefined | null, errors: string[]) {
  if (s == null) return;
  try {
    renderRich(s, true);
  } catch (e) {
    errors.push(`${where}: 수식 오류 — ${(e as Error).message.split('\n')[0]}`);
  }
}

function checkAnswerShape(where: string, p: Problem | Example, errors: string[]) {
  if (!TYPES.has(p.answerType)) errors.push(`${where}: answerType 이상 (${p.answerType})`);
  if (!p.check?.trim()) errors.push(`${where}: check(검산식) 없음`);
  if (p.answerType === 'int' && !/^-?\d+$/.test(p.answer))
    errors.push(`${where}: int 답 형식 (${p.answer})`);
  if (p.answerType === 'fraction' && !/^-?\d+(\/\d+)?$/.test(p.answer))
    errors.push(`${where}: fraction 답은 "a/b" 꼴 (${p.answer})`);
  if (p.answerType === 'choice') {
    if (!/^[1-5]$/.test(p.answer)) errors.push(`${where}: choice 답은 1~5 (${p.answer})`);
    if (p.choices?.length !== 5) errors.push(`${where}: 보기 5개 필요`);
    if (p.choiceChecks?.length !== 5) errors.push(`${where}: choiceChecks 5개 필요`);
  }
  if (!p.steps?.length) errors.push(`${where}: 풀이 단계 없음`);
  for (const [i, st] of (p.steps ?? []).entries()) {
    if (!st.title?.trim() || !st.body?.trim())
      errors.push(`${where}: ${i + 1}단계 제목/본문 비어 있음`);
    texOk(`${where} ${i + 1}단계`, st.title, errors);
    texOk(`${where} ${i + 1}단계`, st.body, errors);
  }
  texOk(`${where} 문제`, p.q, errors);
  texOk(`${where} 팁`, p.tip, errors);
  for (const c of p.concepts ?? []) texOk(`${where} 개념`, c, errors);
  for (const c of p.choices ?? []) texOk(`${where} 보기`, c, errors);
  if ('answerTex' in p) texOk(`${where} 정답표기`, p.answerTex, errors);
}

const item = (ref: string, unit: string, p: Problem | Example): CheckItem => ({
  ref,
  unit,
  answer: p.answer,
  answerType: p.answerType,
  check: p.check,
  ...(p.choiceChecks ? { choiceChecks: p.choiceChecks } : {}),
});

export function checkContent(root = '.', samples = 200): CheckResult {
  const errors: string[] = [];
  const items: CheckItem[] = [];
  const cur: Curriculum = JSON.parse(readFileSync(join(root, 'content/curriculum.json'), 'utf8'));
  const curById = new Map(cur.units.map((u) => [u.id, u]));
  const dir = join(root, 'content/units');
  const units: Unit[] = [];
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const u: Unit = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    units.push(u);
    const W = u.id;
    if (`${u.id}.json` !== f) errors.push(`${f}: 파일 이름과 id 가 다름`);
    const cu = curById.get(u.id);
    if (!cu) errors.push(`${W}: 커리큘럼에 없는 단원`);
    else if (cu.prereq.join() !== u.prereq.join()) errors.push(`${W}: prereq 가 커리큘럼과 다름`);
    if (!u.concept?.length) errors.push(`${W}: 개념 없음`);
    for (const c of u.concept ?? []) {
      texOk(`${W} 개념`, c.heading, errors);
      texOk(`${W} 개념`, c.body, errors);
    }
    for (const f2 of u.formulas ?? []) texOk(`${W} 공식`, f2, errors);
    if ((u.examples?.length ?? 0) < 2 || (u.examples?.length ?? 0) > 3)
      errors.push(`${W}: 예제는 2~3개`);
    u.examples?.forEach((e, i) => {
      checkAnswerShape(`${W} 예제${i + 1}`, e, errors);
      items.push(item(`${W}/예제${i + 1}`, W, e));
    });
    const ids = new Set<string>();
    const count: Record<string, number> = {};
    for (const p of u.problems ?? []) {
      const where = `${W}/${p.id}`;
      if (ids.has(p.id)) errors.push(`${where}: id 중복`);
      ids.add(p.id);
      count[p.level] = (count[p.level] ?? 0) + 1;
      checkAnswerShape(where, p, errors);
      items.push(item(where, W, p));
    }
    for (const [lv, min] of Object.entries(LEVEL_MIN))
      if ((count[lv] ?? 0) < min) errors.push(`${W}: ${lv} ${count[lv] ?? 0}개 (최소 ${min})`);
    if ((count.수능형 ?? 0) + (count.응용 ?? 0) < 5)
      errors.push(`${W}: 수능형/응용 ${(count.수능형 ?? 0) + (count.응용 ?? 0)}개 (최소 5)`);
    for (const g of u.generators ?? []) {
      const gen = allGenerators.find((x) => x.id === g);
      if (!gen) errors.push(`${W}: 없는 생성기 ${g}`);
      else if (gen.unitId !== u.id) errors.push(`${W}: 생성기 ${g} 의 unitId 가 다름`);
    }
  }
  const gids = new Set<string>();
  for (const g of allGenerators) {
    if (gids.has(g.id)) errors.push(`생성기 id 중복: ${g.id}`);
    gids.add(g.id);
    for (let seed = 1; seed <= samples; seed++) {
      const ref = `gen:${g.id}:${seed}`;
      let p: Problem;
      try {
        p = generate(g.id, seed);
      } catch (e) {
        errors.push(`${ref}: 생성 실패 — ${(e as Error).message}`);
        continue;
      }
      checkAnswerShape(ref, p, errors);
      items.push(item(ref, g.unitId, p));
    }
  }
  return { errors, items, units };
}
