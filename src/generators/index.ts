import type { Problem } from '../content/types.ts';
import { generators as fractionAddSub } from './e-fraction-addsub.ts';
import { generators as linearEq } from './m1-linear-eq.ts';
import { generators as productRule } from './math2-diff-product-rule.ts';
import { makeRng } from './rng.ts';
import type { Generator } from './types.ts';

export const allGenerators: Generator[] = [...fractionAddSub, ...linearEq, ...productRule];

export const generatorById = new Map(allGenerators.map((g) => [g.id, g]));

/** 생성기 이름과 시드로 문제 하나를 만든다. */
export function generate(genId: string, seed: number, id = `gen:${genId}:${seed}`): Problem {
  const g = generatorById.get(genId);
  if (!g) throw new Error(`없는 생성기: ${genId}`);
  return { ...g.make(makeRng(seed)), id, level: '기초', generator: genId, seed };
}
