// 레슨 진행 상태(순수 리듀서). 화면은 이 값을 그리기만 한다.
// 저장은 장면 번호가 아니라 장면 id 로 한다 — 레슨 글을 고쳐 장면을 끼워 넣어도 엉뚱한 곳에서 이어지지 않게.
import type { Lesson } from './types.ts';

export interface LessonState {
  /** 보이는 장면 수(앞에서부터 쌓인다) */
  shown: number;
  /** 끝낸 장면 id(정답을 맞히거나 부품 목표를 이룬 장면) */
  done: string[];
  /** 마지막 장면까지 본 적이 있다(지도의 "레슨 완료"). 처음부터 다시 봐도 남는다 */
  finished?: true;
}

export interface SavedLesson {
  at: string;
  done: string[];
  finished?: true;
}

export const lessonKey = (unitId: string) => `lesson:${unitId}`;

export const initialState = (): LessonState => ({ shown: 1, done: [] });

/** 처음부터 다시: 처음 배우는 것처럼 완료 기록을 비운다. 끝까지 본 적(finished)은 남긴다 */
export function restart(s: LessonState): LessonState {
  return s.finished ? { shown: 1, done: [], finished: true } : { shown: 1, done: [] };
}

/** 다음 장면. 목표를 이루지 않아도 넘어간다(사용자 결정 2026-11-14) — gate 표시가 있어도 막지 않는다 */
export function next(l: Lesson, s: LessonState): LessonState {
  if (s.shown >= l.scenes.length) return restart(s);
  const shown = s.shown + 1;
  return shown >= l.scenes.length ? { ...s, shown, finished: true } : { ...s, shown };
}

export function complete(s: LessonState, id: string): LessonState {
  return s.done.includes(id) ? s : { ...s, done: [...s.done, id] };
}

export function dockLabel(l: Lesson, s: LessonState): string {
  if (s.shown >= l.scenes.length) return '처음부터 다시 보기';
  return s.shown === 1 ? '시작하기' : '계속하기';
}

export function toSaved(l: Lesson, s: LessonState): SavedLesson {
  return {
    at: l.scenes[s.shown - 1]?.id ?? '',
    done: s.done,
    ...(s.finished ? { finished: true as const } : {}),
  };
}

/** 저장된 값은 예전 레슨 것이거나 깨졌을 수 있어, 지금 레슨에 있는 id 만 살린다 */
export function restore(l: Lesson, raw: unknown): LessonState {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SavedLesson>;
  const ids = l.scenes.map((x) => x.id);
  const at = typeof o.at === 'string' ? ids.indexOf(o.at) : -1;
  if (at < 0) return initialState();
  const keep = o.finished === true ? { finished: true as const } : {};
  const known = (v: unknown) => [
    ...new Set(Array.isArray(v) ? v.filter((d): d is string => ids.includes(d)) : []),
  ];
  const done = known(o.done);
  // finished 가 생기기 전 기록은 마지막 장면에 있어도 finished 가 없다 — 마지막 장면까지 왔으면 끝낸 것
  const last = at === ids.length - 1 ? { finished: true as const } : keep;
  return { shown: at + 1, done, ...last };
}

/** 지도·홈·단원 홈에 보일 레슨 상태. at 은 이어서 볼 장면 번호(1부터, 시작 안 했으면 0) */
export function lessonProgress(
  l: Lesson,
  raw: unknown,
): { started: boolean; finished: boolean; at: number } {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SavedLesson>;
  if (typeof o.at !== 'string') return { started: false, finished: false, at: 0 };
  const r = restore(l, raw);
  return { started: true, finished: r.finished === true, at: r.shown };
}
