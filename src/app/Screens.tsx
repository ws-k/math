// 책 밖의 화면들: 홈, 커리큘럼 지도, 오답 노트, 설정.

import { curriculum, curriculumTitle, unitById, units } from './content.ts';
import { PenDiag } from './PenDiag.tsx';
import { parseCardKey, resolveProblem } from './pages.ts';
import { Rich } from './Rich.tsx';
import { type Route, routeHash } from './route.ts';
import type { Settings } from './settings.ts';
import { type Cards, GRADE_LABEL, todayPlan, unitProgress, wrongNote } from './today.ts';

type LastRoute = Extract<Route, { name: 'unit' | 'lesson' }>;

const keyHash = (key: string) => {
  const k = parseCardKey(key);
  return k ? routeHash({ name: 'unit', unitId: k.unitId, pid: k.pid, side: 'text' }) : '#/';
};

function Nav() {
  return (
    <nav className="nav">
      <a className="btn" href="#/">
        홈
      </a>
      <a className="btn" href="#/map">
        지도
      </a>
      <a className="btn" href="#/wrong">
        오답 노트
      </a>
      <a className="btn" href="#/settings">
        설정
      </a>
    </nav>
  );
}

export function Home(p: { cards: Cards; settings: Settings; last: LastRoute | null }) {
  const plan = todayPlan({
    cards: p.cards,
    units,
    lastUnitId: p.last?.unitId ?? null,
    now: Date.now(),
    goal: p.settings.dailyGoal,
  });
  const first = plan.due[0] ?? plan.fresh[0];
  const lastUnit = p.last ? unitById.get(p.last.unitId) : undefined;
  return (
    <main className="screen paper">
      <Nav />
      <h1 className="title">수학 다시 쌓기</h1>
      <section className="card-box">
        <h2>오늘 할 일</h2>
        <p className="big">
          복습 <b>{plan.due.length}</b>문제 · 새 문제 <b>{plan.fresh.length}</b>문제
        </p>
        {first ? (
          <a className="btn primary" href={keyHash(first)}>
            오늘 공부 시작
          </a>
        ) : (
          <p>오늘 복습할 문제가 없습니다. 지도에서 단원을 골라 보세요.</p>
        )}
      </section>
      {p.last && lastUnit && (
        <section className="card-box">
          <h2>이어서 공부하기</h2>
          <a className="btn" href={routeHash(p.last)}>
            {lastUnit.title}
          </a>
        </section>
      )}
      <a className="btn" href="#/map">
        커리큘럼 지도 보기
      </a>
    </main>
  );
}

export function MapScreen({ cards }: { cards: Cards }) {
  return (
    <main className="screen paper">
      <Nav />
      <h1 className="title">커리큘럼 지도</h1>
      {curriculum.courses.map((c) => (
        <section key={c.id} className="course">
          <h2>{c.name}</h2>
          <div className="unit-grid">
            {curriculum.units
              .filter((u) => u.course === c.id)
              .map((cu) => {
                const unit = unitById.get(cu.id);
                if (!unit)
                  return (
                    <div key={cu.id} className="unit-card locked" aria-disabled>
                      <span className="unit-name">{cu.title}</span>
                      <span className="unit-meta">준비 중</span>
                    </div>
                  );
                const pr = unitProgress(unit, cards);
                return (
                  <a
                    key={cu.id}
                    className="unit-card"
                    href={routeHash({ name: 'unit', unitId: cu.id, pid: null, side: 'text' })}
                  >
                    <span className="unit-name">{cu.title}</span>
                    <span className="unit-meta">
                      {pr.done} / {pr.total}
                    </span>
                    <span className="bar">
                      <span style={{ width: `${(pr.done / Math.max(1, pr.total)) * 100}%` }} />
                    </span>
                  </a>
                );
              })}
          </div>
        </section>
      ))}
    </main>
  );
}

export function WrongNote({ cards }: { cards: Cards }) {
  const keys = wrongNote(cards, units);
  return (
    <main className="screen paper">
      <Nav />
      <h1 className="title">오답 노트</h1>
      {keys.length === 0 && <p>틀리거나 애매했던 문제가 여기에 모입니다.</p>}
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
                <span className="unit-meta">
                  {curriculumTitle.get(ref.unitId)} · {GRADE_LABEL[c.last]} ·{' '}
                  {new Date(c.history.at(-1)?.t ?? 0).toLocaleDateString('ko-KR')}
                </span>
                <Rich src={pr.q} />
                <span className="unit-meta">눌러서 그때 쓴 필기와 함께 보기</span>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export function SettingsScreen(p: {
  settings: Settings;
  persisted: boolean;
  onChange(s: Settings): void;
}) {
  const { settings: s } = p;
  const goal = (d: number) =>
    p.onChange({ ...s, dailyGoal: Math.min(200, Math.max(1, s.dailyGoal + d)) });
  return (
    <main className="screen paper">
      <Nav />
      <h1 className="title">설정</h1>
      <section className="card-box">
        <h2>하루 목표</h2>
        <div className="row">
          <button type="button" className="btn" onClick={() => goal(-1)} aria-label="줄이기">
            −
          </button>
          <span className="big">{s.dailyGoal}문제</span>
          <button type="button" className="btn" onClick={() => goal(1)} aria-label="늘리기">
            +
          </button>
        </div>
      </section>
      <section className="card-box">
        <h2>저장</h2>
        <p>
          {p.persisted
            ? '영구 저장이 허용되어 기기 안 기록이 지워지지 않습니다.'
            : '영구 저장이 아직 허용되지 않았습니다. 홈 화면에 추가해 열면 허용될 수 있습니다.'}
        </p>
      </section>
      <PenDiag />
    </main>
  );
}
