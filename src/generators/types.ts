import type { Problem } from '../content/types.ts';
import type { Rng } from './rng.ts';

/** 생성기가 만드는 문제. id·level·generator·seed 는 바깥에서 붙인다. */
export type GenProblem = Omit<Problem, 'id' | 'level' | 'generator' | 'seed'>;

export interface Generator {
  /** 전역에서 유일한 이름 (예: "frac-add-same-denom") */
  id: string;
  unitId: string;
  /** "같은 유형 더 풀기" 버튼에 보일 유형 이름 */
  title: string;
  make(rng: Rng): GenProblem;
}
