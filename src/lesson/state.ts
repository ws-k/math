// 레슨 진행 상태(순수 리듀서). 화면은 이 값을 그리기만 한다.
// 저장은 장면 번호가 아니라 장면 id 로 한다 — 레슨 글을 고쳐 장면을 끼워 넣어도 엉뚱한 곳에서 이어지지 않게.
import type { Lesson } from './types.ts';

export interface LessonState {
  /** 보이는 장면 수(앞에서부터 쌓인다) */
  shown: number;
  /** 끝낸 장면 id(정답을 맞히거나 부품 목표를 이룬 장면) */
  done: string[];
}

export interface SavedLesson {
  at: string;
  done: string[];
}

export const lessonKey = (unitId: string) => `lesson:${unitId}`;

export const initialState = (): LessonState => ({ shown: 1, done: [] });

const isGate = (l: Lesson, i: number) => {
  const s = l.scenes[i];
  return !!s && (s.kind === 'question' || s.kind === 'explore') && s.gate === true;
};

/** '계속하기'를 눌러도 되나. 마지막으로 보인 장면이 gate 면 끝내야 넘어간다 */
export function canNext(l: Lesson, s: LessonState): boolean {
  const cur = l.scenes[s.shown - 1];
  return !(cur && isGate(l, s.shown - 1) && !s.done.includes(cur.id));
}

export function next(l: Lesson, s: LessonState): LessonState {
  if (!canNext(l, s)) return s;
  if (s.shown >= l.scenes.length) return { shown: 1, done: s.done };
  return { ...s, shown: s.shown + 1 };
}

export function complete(s: LessonState, id: string): LessonState {
  return s.done.includes(id) ? s : { ...s, done: [...s.done, id] };
}

export function dockLabel(l: Lesson, s: LessonState): string {
  if (s.shown >= l.scenes.length) return '처음부터 다시 보기';
  return s.shown === 1 ? '시작하기' : '계속하기';
}

export function toSaved(l: Lesson, s: LessonState): SavedLesson {
  return { at: l.scenes[s.shown - 1]?.id ?? '', done: s.done };
}

/** 저장된 값은 예전 레슨 것이거나 깨졌을 수 있어, 지금 레슨에 있는 id 만 살린다 */
export function restore(l: Lesson, raw: unknown): LessonState {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SavedLesson>;
  const ids = l.scenes.map((x) => x.id);
  const at = typeof o.at === 'string' ? ids.indexOf(o.at) : -1;
  if (at < 0) return initialState();
  const done = Array.isArray(o.done) ? o.done.filter((d) => ids.includes(d)) : [];
  return { shown: at + 1, done: [...new Set(done)] };
}
