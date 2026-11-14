// 문제 화면 #/unit/<단원>/<문제>. 넓은 화면은 왼쪽 문제 카드 | 오른쪽 풀이 노트, 좁은 화면은 탭으로 하나씩.
// 필기는 풀이 노트에만 한다 — 문제 글 위 필기는 화면 폭마다 글자 줄바꿈이 달라 글자와 어긋나서 없앴다.
// 손가락 가로 쓸기로 이전·다음 문제. 손가락 쓰기를 켜면 노트 위 한 손가락은 쓰기라서,
// 노트 위에서는 두 손가락 쓸기로 넘긴다(문제 카드 쪽은 여전히 한 손가락).
// (파일 이름은 예전 "책 화면"에서 이어 왔다)
import { useMemo, useRef, useState } from 'react';
import type { Unit } from '../content/types.ts';
import { PALM_MS } from '../ink/surface.ts';
import type { Background, InkSurface, Tool } from '../ink/types.ts';
import type { CardState, Grade } from '../lib/srs.ts';
import { Confirm } from './Confirm.tsx';
import { type InkControl, InkPage } from './InkPage.tsx';
import type { LayoutMode } from './layout.ts';
import { ProblemCard } from './Pages.tsx';
import { cardKey, isGenPid, noteKey, problemIndex, resolveProblem, step } from './pages.ts';
import { type Route, routeHash, type Side } from './route.ts';
import { classifySwipe } from './swipe.ts';
import { Toolbar } from './Toolbar.tsx';
import type { Cards } from './today.ts';

export interface ProblemScreenProps {
  unit: Unit;
  route: Extract<Route, { name: 'unit' }> & { pid: string };
  mode: LayoutMode;
  cards: Cards;
  tool: Tool;
  background: Background;
  onTool(t: Tool): void;
  onBackground(b: Background): void;
  fingerInk: boolean;
  onFingerInk(on: boolean): void;
  onGrade(key: string, r: Grade, before: CardState | undefined): void;
}

export function ProblemScreen(p: ProblemScreenProps) {
  const { unit, route, mode } = p;
  const pid = route.pid;
  const problem = resolveProblem(unit, pid);
  const flipDir = useRef<1 | -1>(1);
  const surface = useRef<InkSurface | null>(null);
  const penAt = useRef(0);
  // ctl 은 한 번만 만들므로(아래) 지금 문제 기준의 넘기기를 ref 로 읽는다
  const goRef = useRef<(dir: 1 | -1) => void>(() => {});

  // 노트 컴포넌트가 이 객체를 효과 의존성으로 쓰므로, 매 렌더 새로 만들면 엔진이 다시 만들어진다.
  const ctl = useMemo<InkControl>(
    () => ({
      register: (_k, s) => {
        surface.current = s;
      },
      unregister: () => {
        surface.current = null;
        // 펜이 닿은 채 노트가 사라지면 penAt 이 무한대로 남아 쓸기가 영영 막힌다
        penAt.current = 0;
      },
      penActive: (_k, a) => {
        penAt.current = a ? Number.POSITIVE_INFINITY : performance.now();
        // 손가락이 먼저 닿아 쓸기 후보가 된 뒤 펜이 닿으면(손바닥을 대고 쓰기) 그 후보를 버린다 —
        // 펜을 뗀 뒤 손가락을 떼면 palm() 시간 창이 지나 쓸기로 오인될 수 있다
        if (a) touch.current = null;
      },
      swipe: (_k, g) => {
        const dir = classifySwipe(g);
        if (dir !== 0) goRef.current(dir);
      },
    }),
    [],
  );

  const go = (dir: 1 | -1) => {
    const to = step(unit, pid, dir);
    if (to === null) return;
    flipDir.current = dir;
    // 좁은 화면에서 노트를 보던 중이면 다음 문제도 노트 쪽으로(옛 ?side=note 주소와 같은 뜻)
    location.hash = routeHash({ ...route, pid: to });
  };
  goRef.current = go;
  const goSide = (side: Side) => {
    if (side !== route.side) location.hash = routeHash({ ...route, side });
  };

  const split = mode === 'spread';
  const [asking, setAsking] = useState(false);

  // 손바닥 판정: 펜이 닿아 있거나 막 뗐으면 손가락을 쓸기로 보지 않는다.
  const palm = () =>
    performance.now() - penAt.current < PALM_MS || !!surface.current?.palmBlocked();

  // 쓸기 판정: 손가락 하나일 때만. 캡처 단계에서 지켜보기만 하고 이벤트를 막지 않는다.
  const touch = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const fingers = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    lastPointer.current = e.pointerType;
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

  // 펜은 쓰기 전용 — 버튼·도구 막대를 펜으로 눌러도 반응하지 않게 한다(설계 10장).
  // Safari 는 click 에 pointerType 을 안 실어 줄 때가 있어 직전 pointerdown 의 종류도 본다.
  const lastPointer = useRef('');
  const onClickCapture = (e: React.MouseEvent) => {
    const t = (e.nativeEvent as Partial<PointerEvent>).pointerType || lastPointer.current;
    if (t === 'pen') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const card: CardState | undefined = p.cards[cardKey(unit.id, pid)];
  const turn = `turn-${flipDir.current === 1 ? 'next' : 'prev'}`;
  const total = unit.problems.length;
  const idx = problemIndex(unit, pid);
  // 좁은 화면에서도 문제 카드·노트를 둘 다 그려 두고 안 보이는 쪽만 숨긴다 — 탭을 오가도
  // 입력한 답·펼친 풀이·필기 엔진이 남는다.
  const hide = (side: Side) => !split && route.side !== side;

  return (
    <div className="pscreen" onClickCapture={onClickCapture}>
      <header className="pbar">
        <a
          className="back"
          href={routeHash({ name: 'unit', unitId: unit.id, pid: null, side: 'text' })}
        >
          <small>‹ {unit.title}</small>
          <b className="num">{idx >= 0 ? `문제 ${idx + 1}/${total}` : '같은 유형 연습'}</b>
        </a>
        {!split && (
          <div className="seg">
            <button
              type="button"
              className="btn"
              aria-pressed={route.side === 'text'}
              onClick={() => goSide('text')}
            >
              문제
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={route.side === 'note'}
              onClick={() => goSide('note')}
            >
              풀이 노트
            </button>
          </div>
        )}
        <button
          type="button"
          className="btn"
          aria-label="이전 문제"
          disabled={step(unit, pid, -1) === null}
          onClick={() => go(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="btn"
          aria-label="다음 문제"
          disabled={step(unit, pid, 1) === null}
          onClick={() => go(1)}
        >
          ›
        </button>
      </header>
      <div
        // 단원이 달라도 문제 id(p101)는 겹칠 수 있다 — 다른 단원 같은 번호로 가면 화면이 새로 만들어져야 한다
        key={`${unit.id}/${pid}`}
        className={`pbody ${split ? 'split' : 'tabs'} ${turn}`}
        onPointerDownCapture={onDown}
        onPointerUpCapture={onUp}
        onPointerCancelCapture={onUp}
      >
        <div className="pcol" hidden={hide('text')}>
          {problem ? (
            <ProblemCard
              unit={unit}
              problem={problem}
              index={idx}
              card={card}
              onGrade={
                // 생성 문제는 매번 새로 만드는 연습이라 복습 카드에 넣지 않는다(필기만 저장)
                isGenPid(problem.id)
                  ? undefined
                  : (r, before) => p.onGrade(cardKey(unit.id, problem.id), r, before)
              }
            />
          ) : (
            <p className="card">이 문제를 찾을 수 없어요.</p>
          )}
        </div>
        <section className="notepanel" hidden={hide('note')} aria-label="풀이 노트">
          <Toolbar
            tool={p.tool}
            background={p.background}
            onTool={p.onTool}
            onBackground={p.onBackground}
            fingerInk={p.fingerInk}
            onFingerInk={p.onFingerInk}
            onUndo={() => surface.current?.undo()}
            onRedo={() => surface.current?.redo()}
            onClear={() => setAsking(true)}
          />
          <div className="notebox">
            <InkPage
              inkKey={noteKey(unit.id, pid)}
              grow
              tool={p.tool}
              background={p.background}
              ctl={ctl}
              className="notebook"
            />
          </div>
        </section>
      </div>
      {asking && (
        <Confirm
          message="이 문제의 풀이 노트 필기를 모두 지울까요?"
          okLabel="모두 지우기"
          onCancel={() => setAsking(false)}
          onOk={() => {
            surface.current?.clear();
            setAsking(false);
          }}
        />
      )}
    </div>
  );
}
