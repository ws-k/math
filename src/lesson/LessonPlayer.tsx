// 레슨 화면: 위 진행 막대, 장면이 하나씩 쌓이는 본문, 아래 고정 '계속하기'.
// 진행 규칙은 state.ts(순수 리듀서), 장면 그리기는 Scenes.tsx 가 맡는다.
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { routeHash } from '../app/route.ts';
import { saver, store } from '../app/store.ts';
import type { Unit } from '../content/types.ts';
import type { Background, Tool } from '../ink/types.ts';
import { DragGuard } from './dragGuard.ts';
import { lessonVars } from './format.ts';
import { type SceneEnv, SceneFrame, SceneView } from './Scenes.tsx';
import {
  canNext,
  canSkip,
  complete,
  dockLabel,
  type LessonState,
  lessonKey,
  next,
  restore,
  skip,
  toSaved,
} from './state.ts';
import type { Lesson } from './types.ts';
import { LessonVars, reducedMotion } from './ui.tsx';

const unitHome = (unitId: string) => routeHash({ name: 'unit', unitId, pid: null, side: 'text' });

/**
 * 레슨 하나가 그리다 예외를 내도 앱 전체가 하얗게 멈추지 않게 레슨 범위에서 잡는다.
 * 검사기와 렌더 스모크 테스트가 대부분 막지만, 저장된 진행 값처럼 실행 중에만 보이는 문제가 남는다.
 */
export class LessonBoundary extends Component<
  { unitId: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error('레슨 화면 오류', e);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="lesson">
        <div className="wrap fail-box">
          <h2>레슨을 여는 중에 문제가 생겼어요</h2>
          <p className="lead">진행 기록은 그대로 있어요. 단원으로 돌아가 다시 열어 보세요.</p>
          <a className="lbtn blue" href={unitHome(this.props.unitId)}>
            단원으로 돌아가기
          </a>
        </div>
      </main>
    );
  }
}

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
  /** 장면별 틀린 횟수(저장하지 않는다 — 다시 열면 새로 센다) */
  const [misses, setMisses] = useState<Record<string, number>>({});
  const loaded = useRef(p.initial !== undefined);
  const vars = useMemo(() => lessonVars(lesson, unit.problems.length), [lesson, unit.problems]);

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
  const onMiss = useCallback((id: string) => {
    setMisses((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
  }, []);

  // 나타난 장면으로 스크롤. 동작 줄이기면 부드러운 스크롤 없이 바로.
  useEffect(() => {
    if (!entered) return;
    const el = document.querySelector(`[data-scene="${entered}"]`);
    const behavior = reducedMotion() ? 'auto' : 'smooth';
    requestAnimationFrame(() => el?.scrollIntoView({ behavior, block: 'start' }));
  }, [entered]);

  if (!st) return <main className="lesson" />;

  const total = lesson.scenes.length;
  const go = (n: LessonState) => {
    if (n === st) return;
    save(n);
    if (n.shown === 1) {
      setEntered(null);
      setMisses({});
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    } else setEntered(lesson.scenes[n.shown - 1]?.id ?? null);
  };
  const cur = lesson.scenes[st.shown - 1];
  const skippable = !!cur && canSkip(lesson, st, misses[cur.id] ?? 0);

  const env: SceneEnv = {
    lesson,
    unitId: unit.id,
    tool: p.tool,
    background: p.background,
    done: st.done,
    onDone,
    onMiss,
  };

  return (
    <LessonVars.Provider value={vars}>
      <DragGuard.Provider value={setDragging}>
        <main className="lesson">
          <div className="wrap">
            <div className="top">
              <a className="x" href={unitHome(unit.id)}>
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
            {/* 막힌 gate 에서 두 번 틀리면 공통 탈출구. 그만두지 않고 다음으로 가게 한다 */}
            {skippable ? (
              <button
                type="button"
                className="lbtn soft"
                disabled={dragging}
                onClick={() => !dragging && go(skip(lesson, st))}
              >
                답 보고 넘어가기
              </button>
            ) : (
              <button
                type="button"
                className="lbtn blue"
                disabled={dragging || !canNext(lesson, st)}
                onClick={() => !dragging && go(next(lesson, st))}
              >
                {dockLabel(lesson, st)}
              </button>
            )}
          </div>
        </main>
      </DragGuard.Provider>
    </LessonVars.Provider>
  );
}
