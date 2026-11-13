// 레슨 화면: 위 진행 막대, 장면이 하나씩 쌓이는 본문, 아래 고정 '계속하기'.
// 진행 규칙은 state.ts(순수 리듀서), 장면 그리기는 Scenes.tsx 가 맡는다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { routeHash } from '../app/route.ts';
import { saver, store } from '../app/store.ts';
import type { Unit } from '../content/types.ts';
import type { Background, Tool } from '../ink/types.ts';
import { DragGuard } from './dragGuard.ts';
import { SceneFrame, SceneView } from './Scenes.tsx';
import {
  canNext,
  complete,
  dockLabel,
  type LessonState,
  lessonKey,
  next,
  restore,
  toSaved,
} from './state.ts';
import type { Lesson } from './types.ts';
import { reducedMotion } from './ui.tsx';

export function LessonPlayer(p: {
  unit: Unit;
  lesson: Lesson;
  tool: Tool;
  background: Background;
  /** 저장소에서 진행을 읽지 않고 이 상태로 시작(렌더 스모크 테스트용) */
  initial?: LessonState;
}) {
  const { unit, lesson } = p;
  const [st, setSt] = useState<LessonState | null>(p.initial ?? null);
  /** 방금 '계속하기'로 나타난 장면(올라오는 애니메이션과 스크롤 대상) */
  const [entered, setEntered] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const loaded = useRef(p.initial !== undefined);

  useEffect(() => {
    if (loaded.current) return;
    void store
      .get(lessonKey(unit.id))
      .catch(() => undefined)
      .then((raw) => {
        loaded.current = true;
        setSt(restore(lesson, raw));
      });
  }, [unit.id, lesson]);

  const save = useCallback(
    (s: LessonState) => {
      setSt(s);
      saver.save(lessonKey(unit.id), toSaved(lesson, s));
    },
    [unit.id, lesson],
  );

  const stRef = useRef(st);
  stRef.current = st;
  const onDone = useCallback(
    (id: string) => {
      const cur = stRef.current;
      if (cur && !cur.done.includes(id)) save(complete(cur, id));
    },
    [save],
  );

  // 나타난 장면으로 스크롤. 동작 줄이기면 부드러운 스크롤 없이 바로.
  useEffect(() => {
    if (!entered) return;
    const el = document.querySelector(`[data-scene="${entered}"]`);
    const behavior = reducedMotion() ? 'auto' : 'smooth';
    requestAnimationFrame(() => el?.scrollIntoView({ behavior, block: 'start' }));
  }, [entered]);

  if (!st) return <main className="lesson" />;

  const total = lesson.scenes.length;
  const onNext = () => {
    if (dragging) return;
    const n = next(lesson, st);
    if (n === st) return;
    save(n);
    if (n.shown === 1) {
      setEntered(null);
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    } else setEntered(lesson.scenes[n.shown - 1]?.id ?? null);
  };

  const env = {
    lesson,
    unitId: unit.id,
    problems: unit.problems.length,
    tool: p.tool,
    background: p.background,
    onDone,
  };

  return (
    <DragGuard.Provider value={setDragging}>
      <main className="lesson">
        <div className="wrap">
          <div className="top">
            <a
              className="x"
              href={routeHash({ name: 'unit', unitId: unit.id, pid: null, side: 'text' })}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" role="img">
                <title>레슨 닫기</title>
                <path
                  d="M3 3l12 12M15 3L3 15"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </a>
            <div
              className="lbar"
              role="progressbar"
              aria-label="진행"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={st.shown}
            >
              <span style={{ width: `${(st.shown / total) * 100}%` }} />
            </div>
            <span className="count num">
              {st.shown}/{total}
            </span>
          </div>
          {lesson.scenes.slice(0, st.shown).map((s) => (
            <SceneFrame key={s.id} id={s.id} enter={s.id === entered}>
              <SceneView s={s} env={env} />
            </SceneFrame>
          ))}
        </div>
        <div className="dock">
          <button
            type="button"
            className="lbtn blue"
            disabled={dragging || !canNext(lesson, st)}
            onClick={onNext}
          >
            {dockLabel(lesson, st)}
          </button>
        </div>
      </main>
    </DragGuard.Provider>
  );
}
