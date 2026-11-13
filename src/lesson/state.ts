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
  // 처음부터 다시 보기는 처음 배우는 것처럼: gate 가 다시 걸리게 완료 기록을 비운다
  const keep = s.finished ? { finished: true as const } : {};
  if (s.shown >= l.scenes.length) return { shown: 1, done: [], ...keep };
  const shown = s.shown + 1;
  return shown >= l.scenes.length ? { ...s, shown, finished: true } : { ...s, shown };
}

/** gate 장면에서 이만큼 실패하면 '넘어가기'를 보인다(막혀서 레슨을 그만두지 않게) */
export const SKIP_AFTER = 2;

/** 지금 막힌 gate 를 넘어갈 수 있나. misses 는 이 장면에서 틀린 횟수 */
export function canSkip(l: Lesson, s: LessonState, misses: number): boolean {
  return !canNext(l, s) && misses >= SKIP_AFTER;
}

/** 막힌 gate 를 끝낸 것으로 치고 다음 장면을 연다 */
export function skip(l: Lesson, s: LessonState): LessonState {
  const cur = l.scenes[s.shown - 1];
  return cur ? next(l, complete(s, cur.id)) : s;
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
  const done = [...new Set(Array.isArray(o.done) ? o.done.filter((d) => ids.includes(d)) : [])];
  // 저장된 자리 앞에 끝내지 않은 gate 가 있으면(기록이 깨졌거나 레슨에 gate 가 새로 생김) 거기서 멈춘다 —
  // 그렇지 않으면 막혀 있어야 할 장면을 건너뛴 채 이어진다
  for (let i = 0; i < at; i++)
    if (isGate(l, i) && !done.includes((l.scenes[i] as { id: string }).id))
      return { shown: i + 1, done, ...keep };
  return { shown: at + 1, done, ...keep };
}

/** 지도·홈·단원 홈에 보일 레슨 상태. at 은 이어서 볼 장면 번호(1부터, 시작 안 했으면 0) */
export function lessonProgress(
  l: Lesson,
  raw: unknown,
): { started: boolean; finished: boolean; at: number } {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SavedLesson>;
  if (typeof o.at !== 'string') return { started: false, finished: false, at: 0 };
  return { started: true, finished: o.finished === true, at: restore(l, raw).shown };
}
