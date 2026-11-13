// 앱 로직 테스트용 작은 단원. 실제 콘텐츠가 바뀌어도 테스트가 흔들리지 않게 따로 만든다.
import type { Problem, Unit } from '../src/content/types.ts';

export function prob(id: string, extra: Partial<Problem> = {}): Problem {
  return {
    id,
    level: '기초',
    q: `문제 ${id}`,
    choices: null,
    answer: '1',
    answerType: 'int',
    check: '1',
    steps: [],
    ...extra,
  };
}

export function unit(id: string, problems: Problem[]): Unit {
  return {
    id,
    course: 'm1',
    unit: id,
    title: id,
    prereq: [],
    suneung: [],
    hours: 1,
    concept: [],
    formulas: [],
    examples: [],
    generators: [],
    problems,
  };
}
