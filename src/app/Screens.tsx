// 문제·레슨 밖의 화면들: 홈, 단원 목록, 단원 홈, 오답 노트, 설정, 누가 공부하나요.
import { type ReactNode, useState } from 'react';
import type { Unit } from '../content/types.ts';
import { lessonProgress } from '../lesson/state.ts';
import { Confirm } from './Confirm.tsx';
import { curriculum, curriculumTitle, unitById, units } from './content.ts';
import { ConceptCard, ExampleCard } from './Pages.tsx';
import { PenDiag } from './PenDiag.tsx';
import { cardKey, levelGroups, parseCardKey, resolveProblem } from './pages.ts';
import { FIRST, type Profile } from './profile.ts';
import { Rich } from './Rich.tsx';
import { type Route, routeHash } from './route.ts';
import type { Settings } from './settings.ts';
import { currentProfile } from './store.ts';
import {
  type Cards,
  courseStarted,
  GRADE_LABEL,
  todayPlan,
  unitProgress,
  wrongNote,
} from './today.ts';

export type LastRoute = Extract<Route, { name: 'unit' | 'lesson' }>;
/** 단원 id → 저장된 레슨 진행(lesson:<단원> 값) */
export type Lessons = Record<string, unknown>;

const unitHref = (unitId: string) => routeHash({ name: 'unit', unitId, pid: null, side: 'text' });
const keyHash = (key: string) => {
  const k = parseCardKey(key);
  return k ? routeHash({ name: 'unit', unitId: k.unitId, pid: k.pid, side: 'text' }) : '#/';
};

const NAV: { name: Route['name']; href: string; label: string }[] = [
  { name: 'home', href: '#/', label: '홈' },
  { name: 'map', href: '#/map', label: '단원' },
  { name: 'wrong', href: '#/wrong', label: '오답 노트' },
  { name: 'settings', href: '#/settings', label: '설정' },
];

/** 위 막대(앱 이름·화면 탭·지금 프로필) + 본문. 좁은 화면에서는 탭이 아래로 내려간다(CSS) */
export function Shell(p: {
  current: Route['name'];
  who: string;
  onWho(): void;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <header className="appbar">
        <a className="brand" href="#/">
          수학 다시 쌓기
        </a>
        <nav className="tabs" aria-label="화면">
          {NAV.map((n) => (
            <a
              key={n.name}
              className="tab"
              href={n.href}
              aria-current={n.name === p.current ? 'page' : undefined}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="who"
          onClick={p.onWho}
          aria-label={`지금 ${p.who}, 바꾸기`}
        >
          {p.who}
        </button>
      </header>
      <main className="page">{p.children}</main>
    </div>
  );
}

/** 기록 초기화 확인 창의 단계: 닫힘·묻는 중·지우는 중·실패 */
type ResetStep = null | 'ask' | 'busy' | 'failed';
const RESET_FAILED = '지우지 못했어요. 잠시 뒤 다시 시도해 주세요.';
/** 지우는 동안 창을 막아 두고, 끝나면 닫고, 실패하면 알린다 */
function runReset(reset: () => Promise<void>, set: (s: ResetStep) => void) {
  set('busy');
  reset().then(
    () => set(null),
    () => set('failed'),
  );
}

/** 레슨 상태 꼬리표 글 */
function lessonTag(unit: Unit, lessons: Lessons): { text: string; cls: string } | null {
  if (!unit.lesson) return null;
  const lp = lessonProgress(unit.lesson, lessons[unit.id]);
  if (lp.finished) return { text: '레슨 완료', cls: 'good' };
  if (lp.started) return { text: `레슨 ${lp.at}/${unit.lesson.scenes.length}`, cls: 'blue' };
  return { text: '레슨 있음', cls: 'blue' };
}

export function Home(p: {
  cards: Cards;
  settings: Settings;
  last: LastRoute | null;
  lessons: Lessons;
}) {
  const plan = todayPlan({
    cards: p.cards,
    units,
    lastUnitId: p.last?.unitId ?? null,
    now: Date.now(),
    goal: p.settings.dailyGoal,
  });
  const first = plan.due[0] ?? plan.fresh[0];
  const lastUnit = p.last ? unitById.get(p.last.unitId) : undefined;
  const lastWhat = (() => {
    const l = p.last;
    if (!l || !lastUnit) return '';
    if (l.name === 'lesson' && lastUnit.lesson) {
      const lp = lessonProgress(lastUnit.lesson, p.lessons[lastUnit.id]);
      return `레슨 · ${Math.max(1, lp.at)}/${lastUnit.lesson.scenes.length} 장면`;
    }
    if (l.name === 'unit' && l.pid) {
      const i = lastUnit.problems.findIndex((x) => x.id === l.pid);
      return i >= 0 ? `문제 ${i + 1}/${lastUnit.problems.length}` : '같은 유형 연습';
    }
    return '단원 홈';
  })();
  return (
    <>
      <h1 className="page-title">오늘도 한 걸음씩 해요</h1>
      <div className="grid2">
        <section className="card hero">
          <span className="eyebrow">오늘 할 일</span>
          <p className="stat">
            복습 <b className="num">{plan.due.length}</b>문제 · 새 문제{' '}
            <b className="num">{plan.fresh.length}</b>문제
          </p>
          {first ? (
            <a className="btn primary big block" href={keyHash(first)}>
              오늘 공부 시작하기
            </a>
          ) : (
            <>
              <p className="muted">오늘 복습할 문제가 없어요. '단원' 탭에서 단원을 골라 보세요.</p>
              <a className="btn soft big block" href="#/map">
                단원 보기
              </a>
            </>
          )}
        </section>
        {p.last && lastUnit && (
          <section className="card">
            <span className="eyebrow">이어서 하기</span>
            <h2>{lastUnit.title}</h2>
            <p className="muted">{lastWhat}</p>
            <a className="btn primary big block" href={routeHash(p.last)}>
              이어서 하기
            </a>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * 펼친 학년. 단원 홈에 갔다 돌아와도 그대로 두려고 화면 밖에 둔다(앱을 새로 열면 처음 상태).
 * 프로필을 바꾸면 다른 사람의 펼침을 물려받지 않게 프로필과 함께 기억한다.
 */
let openCourses: { profile: string; set: Set<string> } | null = null;

export function MapScreen({ cards, lessons }: { cards: Cards; lessons: Lessons }) {
  const started = (u: Unit) => !!u.lesson && lessonProgress(u.lesson, lessons[u.id]).started;
  const groups = curriculum.courses.map((c) => {
    const list = curriculum.units.filter((u) => u.course === c.id);
    const ready = list.flatMap((cu) => unitById.get(cu.id) ?? []);
    return { c, list, st: courseStarted(ready, cards, started) };
  });
  // 직접 열고 닫기 전에는 공부를 시작한 학년만 펼친다(기록은 늦게 읽히므로 그릴 때마다 다시 계산)
  // 아무것도 시작 안 했으면 첫 학년을 펼쳐 둔다
  const [picked, setPicked] = useState(() =>
    openCourses?.profile === currentProfile() ? openCourses.set : null,
  );
  const startedIds = groups.filter((g) => g.st.started > 0).map((g) => g.c.id);
  const open =
    picked ?? new Set(startedIds.length > 0 ? startedIds : groups.slice(0, 1).map((g) => g.c.id));
  const toggle = (id: string, on: boolean) => {
    if (open.has(id) === on) return;
    const next = new Set(open);
    if (on) next.add(id);
    else next.delete(id);
    openCourses = { profile: currentProfile(), set: next };
    setPicked(next);
  };
  return (
    <>
      <h1 className="page-title">단원</h1>
      {groups.map(({ c, list, st }) => (
        <details
          key={c.id}
          className="course"
          open={open.has(c.id)}
          onToggle={(e) => toggle(c.id, e.currentTarget.open)}
        >
          <summary>
            <h2 className="course-name">{c.name}</h2>
            <span className="course-count">
              {st.started > 0 ? `${st.started}/${list.length}단원 시작` : `${list.length}단원`}
            </span>
          </summary>
          <div className="unit-grid">
            {list.map((cu) => {
              const unit = unitById.get(cu.id);
              if (!unit)
                return (
                  <div key={cu.id} className="unit-card locked" aria-disabled>
                    <span className="unit-name">{cu.title}</span>
                    <span className="tags">
                      <span className="badge">준비 중</span>
                    </span>
                  </div>
                );
              const pr = unitProgress(unit, cards);
              const tag = lessonTag(unit, lessons);
              return (
                <a key={cu.id} className="unit-card" href={unitHref(cu.id)}>
                  <span className="unit-name">{cu.title}</span>
                  <span className="bar" aria-hidden>
                    <span style={{ width: `${(pr.done / Math.max(1, pr.total)) * 100}%` }} />
                  </span>
                  <span className="tags">
                    {tag && <span className={`badge ${tag.cls}`}>{tag.text}</span>}
                    <span className="badge num">
                      문제 {pr.done}/{pr.total}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </details>
      ))}
    </>
  );
}

/** 단원 홈 #/unit/<단원>: 레슨(또는 옛 개념·예제), 공식, 수준별 문제 목록 */
export function UnitHome({
  unit,
  cards,
  lessons,
  onReset,
}: {
  unit: Unit;
  cards: Cards;
  lessons: Lessons;
  /** 이 단원의 문제 기록·레슨 진행·필기를 지운다 */
  onReset(): Promise<void>;
}) {
  const [resetting, setResetting] = useState<ResetStep>(null);
  const pr = unitProgress(unit, cards);
  const lp = unit.lesson ? lessonProgress(unit.lesson, lessons[unit.id]) : null;
  const scenes = unit.lesson?.scenes.length ?? 0;
  const firstOpen =
    unit.problems.find((x) => !cards[cardKey(unit.id, x.id)]) ?? unit.problems[0] ?? null;
  return (
    <>
      <div className="crumbs">
        <a href="#/map">단원</a>
        <span aria-hidden>›</span>
        <span>{curriculum.courses.find((c) => c.id === unit.course)?.name ?? unit.course}</span>
      </div>
      <h1 className="page-title">{unit.title}</h1>
      <div className="grid2">
        {unit.lesson && lp && (
          <section className="card hero">
            <span className="eyebrow">레슨 · 약 {unit.lesson.minutes}분</span>
            <h2>
              {lp.finished
                ? '레슨을 끝냈어요'
                : lp.started
                  ? `${lp.at}/${scenes} 장면까지 봤어요`
                  : '개념은 레슨으로 배워요'}
            </h2>
            <a
              className="btn primary big block"
              href={routeHash({ name: 'lesson', unitId: unit.id })}
            >
              {lp.started && !lp.finished
                ? '레슨 이어하기'
                : lp.finished
                  ? '레슨 다시 보기'
                  : '레슨 시작하기'}
            </a>
          </section>
        )}
        <section className="card">
          <span className="eyebrow">연습문제</span>
          <h2 className="num">
            {pr.done}/{pr.total} 맞음
          </h2>
          <span className="bar" aria-hidden>
            <span style={{ width: `${(pr.done / Math.max(1, pr.total)) * 100}%` }} />
          </span>
          {firstOpen && (
            <a
              className="btn soft big block"
              href={routeHash({ name: 'unit', unitId: unit.id, pid: firstOpen.id, side: 'text' })}
            >
              {cards[cardKey(unit.id, firstOpen.id)]
                ? '처음 문제부터'
                : `문제 ${unit.problems.indexOf(firstOpen) + 1}부터 풀기`}
            </a>
          )}
        </section>
      </div>
      {unit.formulas.length > 0 && (
        <section className="card">
          <span className="eyebrow">공식</span>
          {unit.formulas.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 공식 순서는 고정
            <Rich key={i} src={f} className="formula" />
          ))}
        </section>
      )}
      {!unit.lesson && (
        <>
          <ConceptCard unit={unit} />
          {(unit.examples ?? []).map((ex, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 예제 순서는 고정
            <ExampleCard key={i} ex={ex} n={i + 1} />
          ))}
        </>
      )}
      <section className="card levels">
        <span className="eyebrow">수준별 문제</span>
        {levelGroups(unit).map((g) => (
          <div key={g.level} className="levels">
            <div className="level-head">
              {g.level}
              <span className="muted num">{g.items.length}문제</span>
            </div>
            <ul className="plist">
              {g.items.map(({ n, problem }) => {
                const c = cards[cardKey(unit.id, problem.id)];
                return (
                  <li key={problem.id}>
                    <a
                      className={`plink num${c ? ` ${c.last}` : ''}`}
                      href={routeHash({
                        name: 'unit',
                        unitId: unit.id,
                        pid: problem.id,
                        side: 'text',
                      })}
                      aria-label={`문제 ${n}${c ? ` ${GRADE_LABEL[c.last]}` : ''}`}
                    >
                      {n}
                      {c && <small>{GRADE_LABEL[c.last]}</small>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      <div className="row center">
        <button type="button" className="btn quiet" onClick={() => setResetting('ask')}>
          이 단원 기록 초기화
        </button>
      </div>
      {resetting && (
        <Confirm
          message={`'${unit.title}' 단원의 푼 문제·레슨 진행·필기를 모두 지울까요? 되돌릴 수 없어요.`}
          okLabel={resetting === 'failed' ? '다시 시도' : '초기화'}
          busy={resetting === 'busy'}
          error={resetting === 'failed' ? RESET_FAILED : undefined}
          onCancel={() => setResetting(null)}
          onOk={() => runReset(onReset, setResetting)}
        />
      )}
    </>
  );
}

export function WrongNote({ cards }: { cards: Cards }) {
  const keys = wrongNote(cards, units);
  return (
    <>
      <h1 className="page-title">오답 노트</h1>
      {keys.length === 0 && <p className="card muted">틀리거나 애매했던 문제가 여기에 모여요.</p>}
      <ul className="wrong-list">
        {keys.map((k) => {
          const ref = parseCardKey(k);
          const unit = ref ? unitById.get(ref.unitId) : undefined;
          const pr = unit && ref ? resolveProblem(unit, ref.pid) : null;
          const c = cards[k];
          if (!ref || !pr || !c) return null;
          return (
            <li key={k}>
              <a className="wrong-item" href={keyHash(k)}>
                <span className="meta">
                  <span className={`badge ${c.last === 'wrong' ? 'bad' : ''}`}>
                    {GRADE_LABEL[c.last]}
                  </span>
                  <span className="muted">
                    {curriculumTitle.get(ref.unitId)} ·{' '}
                    {new Date(c.history.at(-1)?.t ?? 0).toLocaleDateString('ko-KR')}
                  </span>
                </span>
                <Rich src={pr.q} />
                <span className="muted">눌러서 그때 쓴 풀이 노트와 함께 봐요</span>
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SettingsScreen(p: {
  settings: Settings;
  persisted: boolean;
  onChange(s: Settings): void;
  /** 손가락으로 쓰기(기기 설정) — 도구 막대가 없는 레슨 노트에서도 끄고 켤 수 있게 여기에도 둔다 */
  fingerInk: boolean;
  onFingerInk(on: boolean): void;
  profiles: Profile[];
  current: string;
  onAdd(name: string): void;
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onSwitch(id: string): void;
  /** 지금 프로필의 학습 기록 전체를 지운다(설정은 남긴다) */
  onResetAll(): Promise<void>;
}) {
  const { settings: s } = p;
  const goal = (d: number) =>
    p.onChange({ ...s, dailyGoal: Math.min(200, Math.max(1, s.dailyGoal + d)) });
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [resettingAll, setResettingAll] = useState<ResetStep>(null);
  const who = p.profiles.find((x) => x.id === p.current)?.name ?? '';
  return (
    <>
      <h1 className="page-title">설정</h1>
      <section className="card">
        <h2>하루 목표</h2>
        <div className="stepper-row">
          <button type="button" className="btn big" onClick={() => goal(-1)} aria-label="줄이기">
            −
          </button>
          <span className="value num">{s.dailyGoal}문제</span>
          <button type="button" className="btn big" onClick={() => goal(1)} aria-label="늘리기">
            +
          </button>
        </div>
      </section>
      <section className="card">
        <h2>필기</h2>
        <div className="stepper-row">
          <button
            type="button"
            className="btn big"
            aria-pressed={p.fingerInk}
            onClick={() => p.onFingerInk(!p.fingerInk)}
          >
            손가락으로 쓰기
          </button>
          {/* 켜짐 여부는 aria-pressed 로 읽어 주니 화면용 글자는 읽지 않게 둔다 */}
          <span className="value" aria-hidden>
            {p.fingerInk ? '켜짐' : '꺼짐'}
          </span>
        </div>
        <p className="muted">
          켜면 노트에 한 손가락으로 써요. 스크롤은 두 손가락으로 해요. 펜을 처음 쓰면 저절로 꺼져요.
          <br />이 기기를 쓰는 모두에게 적용돼요.
        </p>
      </section>
      <section className="card">
        <h2>프로필</h2>
        <p className="muted">한 기기를 여럿이 쓰면 사람마다 진행·필기·설정이 따로 저장돼요.</p>
        <ul className="plist-profiles">
          {p.profiles.map((pf) => (
            <li key={pf.id} className="prow">
              {editing?.id === pf.id ? (
                <form
                  className="row"
                  style={{ flex: 1 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    p.onRename(pf.id, editing.name);
                    setEditing(null);
                  }}
                >
                  <input
                    className="field"
                    aria-label="새 이름"
                    value={editing.name}
                    maxLength={12}
                    onChange={(e) => setEditing({ id: pf.id, name: e.target.value })}
                  />
                  <button type="submit" className="btn primary">
                    저장
                  </button>
                  <button type="button" className="btn quiet" onClick={() => setEditing(null)}>
                    취소
                  </button>
                </form>
              ) : (
                <>
                  <span className="name">
                    {pf.name}
                    {pf.id === p.current && <span className="badge blue"> 지금</span>}
                  </span>
                  {pf.id !== p.current && (
                    <button type="button" className="btn soft" onClick={() => p.onSwitch(pf.id)}>
                      바꾸기
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEditing({ id: pf.id, name: pf.name })}
                  >
                    이름
                  </button>
                  {pf.id !== FIRST && pf.id !== p.current && (
                    <button type="button" className="btn quiet" onClick={() => setRemoving(pf)}>
                      삭제
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            p.onAdd(adding);
            setAdding('');
          }}
        >
          <input
            className="field"
            aria-label="새 프로필 이름"
            placeholder="새 프로필 이름"
            value={adding}
            maxLength={12}
            onChange={(e) => setAdding(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={!adding.trim()}>
            추가
          </button>
        </form>
      </section>
      <section className="card">
        <h2>저장</h2>
        <p className="muted">
          {p.persisted
            ? '영구 저장이 허용되어 기기 안 기록이 지워지지 않아요.'
            : '영구 저장이 아직 허용되지 않았어요. 홈 화면에 추가해서 열면 허용될 수 있어요.'}
        </p>
      </section>
      <section className="card">
        <h2>학습 기록 초기화</h2>
        <p className="muted">
          모든 단원의 푼 문제·레슨 진행·필기를 지우고 처음부터 시작해요. 설정과 프로필은 남아요.
        </p>
        <div className="row">
          <button type="button" className="btn danger" onClick={() => setResettingAll('ask')}>
            전체 초기화
          </button>
        </div>
      </section>
      <section className="card">
        <PenDiag />
      </section>
      {resettingAll && (
        <Confirm
          message={`${who ? `'${who}'의 ` : ''}모든 학습 기록을 지울까요? 되돌릴 수 없어요.`}
          okLabel={resettingAll === 'failed' ? '다시 시도' : '전체 초기화'}
          busy={resettingAll === 'busy'}
          error={resettingAll === 'failed' ? RESET_FAILED : undefined}
          onCancel={() => setResettingAll(null)}
          onOk={() => runReset(p.onResetAll, setResettingAll)}
        />
      )}
      {removing && (
        <Confirm
          message={`'${removing.name}' 프로필과 그 사람의 진행·필기를 모두 지울까요? 되돌릴 수 없어요.`}
          okLabel="삭제"
          onCancel={() => setRemoving(null)}
          onOk={() => {
            p.onRemove(removing.id);
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}

/** 시작할 때(프로필이 둘 이상) 또는 위 막대의 이름을 눌렀을 때 */
export function ProfilePicker(p: {
  profiles: Profile[];
  current: string;
  onPick(id: string): void;
  onCancel?: () => void;
}) {
  return (
    <main className="picker">
      <h1>누가 공부하나요?</h1>
      <div className="picker-list">
        {p.profiles.map((pf) => (
          <button key={pf.id} type="button" className="btn" onClick={() => p.onPick(pf.id)}>
            <span className="avatar" aria-hidden>
              {pf.name.slice(0, 1)}
            </span>
            {pf.name}
            {pf.id === p.current && <small>지금 공부 중</small>}
          </button>
        ))}
      </div>
      {p.onCancel && (
        <button type="button" className="btn quiet" onClick={p.onCancel}>
          닫기
        </button>
      )}
      <p className="muted">프로필은 설정에서 추가하거나 이름을 바꿀 수 있어요.</p>
    </main>
  );
}
