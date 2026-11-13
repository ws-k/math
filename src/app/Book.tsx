// 단원·문제 화면 = 책. 펼친 책이면 왼쪽 교재 + 오른쪽 공책, 아니면 한 쪽씩.
// 손가락 가로 쓸기로 쪽을 넘긴다(필기는 펜 전용이라 손가락 쓸기와 부딪히지 않는다).
import { useMemo, useRef, useState } from 'react';
import type { Unit } from '../content/types.ts';
import { PALM_MS } from '../ink/surface.ts';
import type { Background, InkSurface, Tool } from '../ink/types.ts';
import type { CardState, Grade } from '../lib/srs.ts';
import { Confirm } from './Confirm.tsx';
import { type InkControl, InkPage } from './InkPage.tsx';
import type { LayoutMode } from './layout.ts';
import { ConceptPage, ExamplesPage, ProblemPage } from './Pages.tsx';
import {
  cardKey,
  flip,
  inkKey,
  isGenPid,
  pageNumber,
  problemIndex,
  resolveProblem,
} from './pages.ts';
import { type Route, routeHash, type Side } from './route.ts';
import { classifySwipe } from './swipe.ts';
import { Toolbar } from './Toolbar.tsx';
import type { Cards } from './today.ts';

export interface BookProps {
  unit: Unit;
  route: Extract<Route, { name: 'unit' }>;
  mode: LayoutMode;
  cards: Cards;
  tool: Tool;
  background: Background;
  onTool(t: Tool): void;
  onBackground(b: Background): void;
  onGrade(key: string, r: Grade, before: CardState | undefined): void;
}

export function Book(p: BookProps) {
  const { unit, route, mode } = p;
  const problem = route.pid === null ? null : resolveProblem(unit, route.pid);
  const flipDir = useRef<1 | -1>(1);
  const surfaces = useRef(new Map<string, InkSurface>());
  const active = useRef<string | null>(null);
  const penAt = useRef(0);

  // 쪽 컴포넌트가 이 객체를 효과 의존성으로 쓰므로, 매 렌더 새로 만들면 엔진이 다시 만들어진다.
  const ctl = useMemo<InkControl>(
    () => ({
      register: (k, s) => surfaces.current.set(k, s),
      unregister: (k) => {
        surfaces.current.delete(k);
        // 펜이 닿은 채 쪽이 사라지면 penAt 이 무한대로 남아 쓸기가 영영 막힌다
        if (active.current === k) {
          active.current = null;
          penAt.current = 0;
        }
      },
      penActive: (k, a) => {
        active.current = k;
        penAt.current = a ? Number.POSITIVE_INFINITY : performance.now();
      },
    }),
    [],
  );

  const go = (dir: 1 | -1) => {
    const to = flip(unit, route.pid, route.side, dir, mode);
    if (!to) return;
    flipDir.current = dir;
    location.hash = routeHash({ name: 'unit', unitId: unit.id, ...to });
  };
  const goSide = (side: Side) => {
    if (side === route.side) return;
    flipDir.current = side === 'note' ? 1 : -1;
    location.hash = routeHash({ ...route, side });
  };

  const spread = mode === 'spread';
  // 실행 취소 등은 펼친 책이면 마지막으로 펜을 댄 쪽(아직 안 댔으면 공책 쪽)에,
  // 한 쪽 보기면 보이는 쪽에 — 숨긴 반대쪽도 마운트돼 있어 "마지막 쪽"이 안 보이는 쪽일 수 있다.
  const targetSide = (): Side => {
    if (!spread) return route.side;
    const a = active.current;
    return a && a === inkKey(unit.id, route.pid, 'text') ? 'text' : 'note';
  };
  const target = () => surfaces.current.get(inkKey(unit.id, route.pid, targetSide()));

  // 전체 지우기는 되돌릴 수 있어도 한 번에 많이 사라져 놀라므로 먼저 묻는다
  const [asking, setAsking] = useState<Side | null>(null);
  const sideName = (side: Side) =>
    route.pid === null
      ? side === 'text'
        ? '개념 쪽'
        : '예제 쪽'
      : side === 'text'
        ? '교재 쪽'
        : '공책 쪽';

  // 손바닥 판정: 어느 쪽이든 펜이 닿아 있거나 막 뗐으면 손가락을 쓸기로 보지 않는다.
  // penAt 은 쪽이 사라진 직후(엔진이 없어진 뒤)에도 잠깐 막기 위한 보조 기록이다.
  const palm = () =>
    performance.now() - penAt.current < PALM_MS ||
    [...surfaces.current.values()].some((s) => s.palmBlocked());

  // 쓸기 판정: 손가락 하나일 때만. 캡처 단계에서 지켜보기만 하고 이벤트를 막지 않는다.
  const touch = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const fingers = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    // 첫 손가락(isPrimary)에서 다시 센다. 바깥에서 떼어 up 을 못 받은 손가락이 쌓이지 않게.
    fingers.current = e.isPrimary ? 1 : fingers.current + 1;
    touch.current =
      fingers.current === 1 && !palm()
        ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }
        : null;
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    fingers.current = Math.max(0, fingers.current - 1);
    const s = touch.current;
    if (!s || s.id !== e.pointerId) return;
    touch.current = null;
    // 손가락이 먼저 닿고 펜이 뒤따른 경우(손바닥을 먼저 대고 쓰기)도 뗄 때 다시 본다
    if (e.type === 'pointercancel' || palm()) return;
    const dir = classifySwipe({ dx: e.clientX - s.x, dy: e.clientY - s.y, dt: e.timeStamp - s.t });
    if (dir !== 0) go(dir);
  };

  // 펜은 쓰기 전용 — 교재 버튼·도구 막대를 펜으로 눌러도 반응하지 않게 한다(설계 10장).
  // Safari 는 click 에 pointerType 을 안 실어 줄 때가 있어 직전 pointerdown 의 종류도 본다.
  const lastPointer = useRef('');
  const onAnyDown = (e: React.PointerEvent) => {
    lastPointer.current = e.pointerType;
    onDown(e);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    const t = (e.nativeEvent as Partial<PointerEvent>).pointerType || lastPointer.current;
    if (t === 'pen') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const ink = (side: Side, grow: boolean) => ({
    inkKey: inkKey(unit.id, route.pid, side),
    grow,
    tool: p.tool,
    // 교재 쪽은 글자 위에 줄·모눈이 겹치면 읽기 어려워 배경은 공책 쪽에만 깐다.
    background: side === 'note' ? p.background : ('none' as Background),
    ctl,
  });

  const card: CardState | undefined = route.pid ? p.cards[cardKey(unit.id, route.pid)] : undefined;
  const turn = `turn-${flipDir.current === 1 ? 'next' : 'prev'}`;
  // 한 쪽 보기에서도 교재·공책을 둘 다 마운트하고 안 보이는 쪽만 숨긴다 — 탭을 오가도
  // 입력한 답·펼친 풀이가 남는다. 넘김 효과는 숨김이 풀릴 때 다시 도는 CSS 애니메이션으로 낸다.
  const shownAttr = (side: Side) =>
    spread ? {} : { hidden: route.side !== side, className: turn };
  const textPage = (
    <Page n={pageNumber(unit, route.pid, 'text')} side="text" {...shownAttr('text')}>
      <InkPage {...ink('text', false)} fit>
        {route.pid === null ? (
          <ConceptPage unit={unit} />
        ) : problem ? (
          <ProblemPage
            key={problem.id}
            unit={unit}
            problem={problem}
            index={problemIndex(unit, problem.id)}
            card={card}
            onGrade={
              // 생성 문제는 매번 새로 만드는 연습이라 복습 카드에 넣지 않는다(필기만 저장)
              isGenPid(problem.id)
                ? undefined
                : (r, before) => p.onGrade(cardKey(unit.id, problem.id), r, before)
            }
          />
        ) : (
          <p className="text">이 문제를 찾을 수 없습니다.</p>
        )}
      </InkPage>
    </Page>
  );
  const notePage = (
    <Page n={pageNumber(unit, route.pid, 'note')} side="note" {...shownAttr('note')}>
      {route.pid === null ? (
        // 단원 첫 펼침의 오른쪽 쪽은 예제·목차. 내용이 정해진 쪽이라 공책처럼 늘리지 않는다.
        <InkPage {...ink('note', false)} fit>
          <ExamplesPage unit={unit} cards={p.cards} />
        </InkPage>
      ) : (
        <InkPage {...ink('note', true)} className="notebook" />
      )}
    </Page>
  );

  const pageKey = `${route.pid}`;
  const total = unit.problems.length;
  const idx = route.pid === null ? -1 : problemIndex(unit, route.pid);

  return (
    <div className="book-screen" onClickCapture={onClickCapture}>
      <header className="book-head">
        <a className="btn" href="#/map" aria-label="지도로">
          ‹ 지도
        </a>
        <a
          className="crumb"
          href={routeHash({ name: 'unit', unitId: unit.id, pid: null, side: 'text' })}
        >
          {unit.title}
          {idx >= 0 && ` · ${idx + 1}/${total}`}
        </a>
        {!spread && (
          <div className="tabs">
            <button
              type="button"
              className="btn"
              aria-pressed={route.side === 'text'}
              onClick={() => goSide('text')}
            >
              {route.pid === null ? '개념' : '교재'}
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={route.side === 'note'}
              onClick={() => goSide('note')}
            >
              {route.pid === null ? '예제' : '공책'}
            </button>
          </div>
        )}
        <button type="button" className="btn" aria-label="이전 쪽" onClick={() => go(-1)}>
          ‹
        </button>
        <button type="button" className="btn" aria-label="다음 쪽" onClick={() => go(1)}>
          ›
        </button>
      </header>
      <Toolbar
        tool={p.tool}
        background={p.background}
        onTool={p.onTool}
        onBackground={p.onBackground}
        onUndo={() => target()?.undo()}
        onRedo={() => target()?.redo()}
        onClear={() => setAsking(targetSide())}
      />
      <div
        className={`book ${spread ? 'spread' : 'single'}`}
        onPointerDownCapture={onAnyDown}
        onPointerUpCapture={onUp}
        onPointerCancelCapture={onUp}
      >
        <div key={pageKey} className={`pages ${spread ? turn : ''}`}>
          {textPage}
          {spread && <div className="fold" aria-hidden />}
          {notePage}
        </div>
      </div>
      {asking && (
        <Confirm
          message={`${sideName(asking)}(${pageNumber(unit, route.pid, asking)}쪽) 필기를 모두 지울까요?`}
          okLabel="모두 지우기"
          onCancel={() => setAsking(null)}
          onOk={() => {
            surfaces.current.get(inkKey(unit.id, route.pid, asking))?.clear();
            setAsking(null);
          }}
        />
      )}
    </div>
  );
}

function Page(p: {
  n: number;
  side: Side;
  hidden?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { n, side, children } = p;
  return (
    <section className={`page page-${side} ${p.className ?? ''}`} hidden={p.hidden}>
      {children}
      <footer className="page-no">{n}</footer>
    </section>
  );
}
