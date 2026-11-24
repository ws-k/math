// 단원 JSON 의 형식 검사 + 검산할 항목 모으기. dump-problems 와 테스트에서 함께 쓴다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CheckItem,
  checkAnswerShape,
  answerItem as item,
  texOk,
} from '../src/content/check.ts';
import type { Curriculum, Problem, Unit } from '../src/content/types.ts';
import { allGenerators, generate } from '../src/generators/index.ts';
import { validateLesson } from '../src/lesson/schema.ts';
import { seedBias, simulateDef } from '../src/lesson/widgets/simulate.ts';

export type { CheckItem };

export interface CheckResult {
  errors: string[];
  /** 막지는 않지만 사람이 볼 것(레슨 수식 속 손으로 적은 숫자 등) */
  warnings: string[];
  items: CheckItem[];
  units: Unit[];
}

const LEVEL_MIN: Record<string, number> = { 기초: 15, 표준: 10 };

export function checkContent(root = '.', samples = 200, onlyUnit?: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const items: CheckItem[] = [];
  const cur: Curriculum = JSON.parse(readFileSync(join(root, 'content/curriculum.json'), 'utf8'));
  const curById = new Map(cur.units.map((u) => [u.id, u]));
  const dir = join(root, 'content/units');
  const units: Unit[] = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && (!onlyUnit || f === `${onlyUnit}.json`))
    .sort();
  if (onlyUnit && files.length === 0) errors.push(`${onlyUnit}: 단원 파일 없음`);
  for (const f of files) {
    const u: Unit = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    units.push(u);
    const W = u.id;
    if (`${u.id}.json` !== f) errors.push(`${f}: 파일 이름과 id 가 다름`);
    const cu = curById.get(u.id);
    if (!cu) errors.push(`${W}: 커리큘럼에 없는 단원`);
    else if (cu.prereq.join() !== u.prereq.join()) errors.push(`${W}: prereq 가 커리큘럼과 다름`);
    // 설명은 레슨(새 방식) 또는 개념+예제(옛 방식) 중 하나. 레슨이 생긴 단원은 레슨이 개념을 대신하므로
    // 옛 글을 남겨 두면 두 설명이 따로 놀게 된다 — 함께 있으면 오류.
    if (u.lesson === undefined && !u.concept?.length) errors.push(`${W}: 레슨도 개념도 없음`);
    if (u.lesson !== undefined && (u.concept !== undefined || u.examples !== undefined))
      errors.push(`${W}: 레슨이 있는 단원에는 옛 concept·examples 를 두지 않음`);
    for (const c of u.concept ?? []) {
      texOk(`${W} 개념`, c.heading, errors);
      texOk(`${W} 개념`, c.body, errors);
    }
    for (const f2 of u.formulas ?? []) texOk(`${W} 공식`, f2, errors);
    const exN = u.examples?.length ?? 0;
    if (u.lesson === undefined && (exN < 2 || exN > 3)) errors.push(`${W}: 예제는 2~3개`);
    if (u.lesson !== undefined) {
      const r = validateLesson(u.id, u.lesson, { problems: u.problems?.length ?? 0 });
      errors.push(...r.errors);
      warnings.push(...r.warnings);
      items.push(...r.items);
      // 확률 실험의 시드가 학습자를 엉뚱한 답으로 이끄는 줄기인지(simulate.ts seedBias). 같은 시드면 모두 같은 줄기를
      // 보므로 글쓴이가 바꿔야 한다 — 고른 시드도 가끔 걸려 오류가 아니라 경고로
      for (const sc of u.lesson.scenes) {
        const w = (sc as { widget?: { type: string; params: unknown } }).widget;
        if (w?.type !== 'simulate') continue;
        try {
          const b = seedBias(simulateDef.parse(w.params));
          if (!b.ok)
            warnings.push(`${W} 레슨 ${sc.id}: 확률 실험 시드 — ${b.problems.join(' / ')}`);
        } catch {
          // 형식 오류는 validateLesson 이 이미 알렸다
        }
      }
    }
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
    if (onlyUnit && g.unitId !== onlyUnit) continue;
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
  return { errors, warnings, items, units };
}
