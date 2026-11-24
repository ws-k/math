// 앱 로직 테스트용 작은 단원. 실제 콘텐츠가 바뀌어도 테스트가 흔들리지 않게 따로 만든다.
import type { BaseStore } from '../src/app/backup.ts';
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

/**
 * IndexedDB 대신 메모리 저장소. 키 순서는 IndexedDB 처럼 문자열 순이고, fill 은 없는 키만 채운다
 * (실제 fill 이 한 트랜잭션 안에서 getKey 로 확인하고 넣는 것과 같다).
 */
export function memStore(): BaseStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const sorted = (prefix: string) => [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
  return {
    data,
    get: async (k) => data.get(k) as never,
    set: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
    async delPrefix(prefixes, keys = []) {
      for (const k of [...data.keys()]) if (prefixes.some((p) => k.startsWith(p))) data.delete(k);
      for (const k of keys) data.delete(k);
    },
    keys: async (p = '') => sorted(p),
    entries: async (p) => sorted(p).map((k) => [k, data.get(k)] as [string, never]),
    async fill(entries, skip) {
      for (const [k, v] of entries) if (!skip(k) && !data.has(k)) data.set(k, v);
    },
  };
}
