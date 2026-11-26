// 레슨 장면들. 장면은 데이터만 그리고, 진행(다음 장면·완료·처음부터)은 LessonPlayer 가 쥔다.
// 화면 글자 가운데 값에서 나오는 것(보기 글자·식·{{값}})은 format.ts·LRich 로 데이터에서 만든다.
// React key 는 데이터의 id 나 자리 번호로 — 글 내용을 key 로 쓰면 같은 글이 둘일 때 화면이 섞인다.
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { InkControl } from '../app/InkPage.tsx';
import { InkPage } from '../app/InkPage.tsx';
import { NumPad } from '../app/NumPad.tsx';
import { store } from '../app/store.ts';
import type { Background, Tool } from '../ink/types.ts';
import { answerText, CIRCLED, compareAnswer } from '../lib/answer.ts';
import {
  choiceLabel,
  handsOnCount,
  relSignTex,
  relTex,
  spotEqSign,
  spotEquation,
  spotFixed,
  tokenTex,
} from './format.ts';
import { legacyInkKey, lessonInkKey, migrateInk } from './inkKeys.ts';
import { optColumns } from './optCols.ts';
import type {
  ExploreScene,
  IntroScene,
  Lesson,
  QuestionScene,
  Scene,
  SolveItem,
  SolveScene,
  SpotItem,
  SpotScene,
  SpotToken,
  SummaryScene,
  TermsScene,
} from './types.ts';
import { LRich, NumLabel, reducedMotion, Tex } from './ui.tsx';
import { Widget } from './widgets/index.tsx';

export interface SceneEnv {
  lesson: Lesson;
  unitId: string;
  tool: Tool;
  background: Background;
  /** 끝낸 장면 id */
  done: readonly string[];
  /** 지금 머무는 장면(보이는 장면 중 맨 아래). 이보다 앞 장면은 '계속하기'로 떠난 장면이다 */
  current: string;
  onDone(id: string): void;
}

function Head({ s, big }: { s: Scene; big?: boolean }) {
  return (
    <>
      {s.chip && <LRich inline src={s.chip} className="chip" />}
      {big ? (
        <h1>
          <LRich inline src={s.title} />
        </h1>
      ) : (
        <h2>
          <LRich inline src={s.title} />
        </h2>
      )}
      {s.lead && <LRich src={s.lead} className="lead" />}
    </>
  );
}

const After = ({ s }: { s: Scene }) => (s.after ? <LRich src={s.after} /> : null);

export function SceneView({ s, env }: { s: Scene; env: SceneEnv }) {
  switch (s.kind) {
    case 'intro':
      return <Intro s={s} env={env} />;
    case 'question':
      return <Question s={s} env={env} />;
    case 'explore':
      return <Explore s={s} env={env} />;
    case 'terms':
      return <Terms s={s} />;
    case 'spot':
      return <Spot s={s} env={env} />;
    case 'solve':
      return <Solve s={s} env={env} />;
    case 'summary':
      return <Summary s={s} />;
  }
}

function Intro({ s, env }: { s: IntroScene; env: SceneEnv }) {
  const meta = [
    ...(s.meta ?? []),
    `약 ${env.lesson.minutes}분`,
    `직접 해 보기 ${handsOnCount(env.lesson)}번`,
  ];
  return (
    <>
      <Head s={s} big />
      <div className="meta">
        {meta.map((m, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 꼬리표 순서는 고정
          <LRich inline key={i} src={m} />
        ))}
      </div>
      <After s={s} />
    </>
  );
}

/**
 * 보기 단추 열 수(optCols.ts): 가장 넓은 단추가 한 줄 몫에 안 들면 두 줄로. 단추 폭이 아니라 단추 안 글이
 * 실제로 차지한 폭(Range)으로 잰다 — 수는 끊기지 않고(NumLabel 의 덩어리) 단위만 다음 줄로 내려가므로, 그렇게
 * 내려간 뒤의 폭이 단추에 필요한 폭이다. 이미 두 줄로 넓어진 단추로 재도 글 폭은 같아 다시 한 줄에 드는지 안다.
 * 칸 폭이 바뀌면(접기·펴기·회전) 다시 잰다. 그리기 전에 재야 넘친 모양이 한 번 보였다가 바뀌지 않는다(useLayoutEffect)
 */
function useOptColumns(ref: RefObject<HTMLDivElement | null>, n: number): number {
  const [cols, setCols] = useState(n);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const range = document.createRange();
      let need = 0;
      for (const b of el.children) {
        const cs = getComputedStyle(b);
        const edge =
          parseFloat(cs.paddingLeft) +
          parseFloat(cs.paddingRight) +
          parseFloat(cs.borderLeftWidth) +
          parseFloat(cs.borderRightWidth);
        range.selectNodeContents(b);
        need = Math.max(need, range.getBoundingClientRect().width + edge);
      }
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setCols(optColumns(n, Math.ceil(need), el.clientWidth, gap));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, n]);
  return cols;
}

/** 보기 단추 안 글자: 수는 끊기지 않는 덩어리(NumLabel), 식은 KaTeX, 글자는 수식 섞인 글 */
function ChoiceText({ label }: { label: ReturnType<typeof choiceLabel> | undefined }) {
  if (!label) return null;
  if ('num' in label) return <NumLabel text={label.num} />;
  if ('tex' in label) return <Tex tex={label.tex} />;
  return <LRich inline src={label.text} />;
}

function Question({ s, env }: { s: QuestionScene; env: SceneEnv }) {
  const [picked, setPicked] = useState(false);
  const optsRef = useRef<HTMLDivElement>(null);
  const cols = useOptColumns(optsRef, s.choices.length);
  const [wrong, setWrong] = useState<{ i: number; n: number } | null>(null);
  // 이어 보기에서 이미 끝낸 장면도 답과 풀이를 펼쳐 둔다
  const right = picked || env.done.includes(s.id);
  const labels = s.choices.map((c) => choiceLabel(c, s.format ?? {}));
  const pick = (i: number) => {
    if (right) return;
    if (i === s.answer) {
      setPicked(true);
      setWrong(null);
      env.onDone(s.id);
    } else {
      // n 을 바꿔 같은 보기를 다시 눌러도 흔들림 애니메이션이 다시 돈다
      setWrong({ i, n: (wrong?.n ?? 0) + 1 });
    }
  };
  const fb = wrong ? s.choices[wrong.i]?.feedback : undefined;
  return (
    <>
      <Head s={s} />
      <div className="card">
        {s.widget && (
          <Widget spec={s.widget} onDone={() => {}} onMiss={() => {}} answered={right} />
        )}
        <div className="opts" ref={optsRef} style={{ '--n': cols } as CSSProperties}>
          {s.choices.map((_, i) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: 자리 번호 + 흔들림을 다시 돌리려는 횟수
              key={`${i}-${i === wrong?.i ? wrong.n : 0}`}
              className={`opt num${right && i === s.answer ? ' right' : ''}${
                i === wrong?.i ? ' wrong' : ''
              }`}
              disabled={right}
              onClick={() => pick(i)}
            >
              <ChoiceText label={labels[i]} />
            </button>
          ))}
        </div>
        {right && (
          <div className="reveal">
            <LRich src={s.reveal} />
            {s.thoughts?.map((t, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 생각 순서는 고정
              <div className="thought" key={i}>
                <b>{i + 1}</b>
                <LRich src={t} />
              </div>
            ))}
            {s.conclude && <LRich src={s.conclude} />}
          </div>
        )}
        <div aria-live="polite">{!right && fb && <LRich src={fb} className="fb bad" />}</div>
      </div>
      <After s={s} />
    </>
  );
}

function Explore({ s, env }: { s: ExploreScene; env: SceneEnv }) {
  // afterGoal 이면 결론 글은 목표를 이룬 뒤에(이어 보기로 이미 끝낸 장면이면 바로). 목표를 못 이뤄도
  // '계속하기'로 그 장면을 떠나면 보인다 — 결론 글에만 있는 용어 정의를 넘어간 학습자도 읽게.
  // 떠났다고 완료(done)로 적지는 않는다(완료 기록은 목표를 이뤘을 때 onDone 만)
  const [reached, setReached] = useState(false);
  const left = env.current !== s.id;
  const showAfter = !s.afterGoal || reached || left || env.done.includes(s.id);
  return (
    <>
      <Head s={s} />
      <div className="card">
        <Widget
          spec={s.widget}
          onDone={() => {
            setReached(true);
            env.onDone(s.id);
          }}
          onMiss={() => {}}
        />
      </div>
      {showAfter && <After s={s} />}
    </>
  );
}

function Terms({ s }: { s: TermsScene }) {
  return (
    <>
      <Head s={s} />
      <div className="terms">
        {s.terms.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 용어 순서는 고정
          <div className="term" key={i}>
            <b>
              <LRich inline src={t.term} />
            </b>
            <LRich src={t.body} />
          </div>
        ))}
      </div>
      {s.aside && <LRich src={s.aside} className="aside" />}
      <After s={s} />
    </>
  );
}

function Spot({ s, env }: { s: SpotScene; env: SceneEnv }) {
  const found = useRef(new Set<number>());
  return (
    <>
      <Head s={s} />
      {s.items.map((it, i) => (
        <SpotCard
          // biome-ignore lint/suspicious/noArrayIndexKey: 함정 순서는 고정
          key={i}
          it={it}
          onFound={() => {
            found.current.add(i);
            if (found.current.size === s.items.length) env.onDone(s.id);
          }}
        />
      ))}
      <After s={s} />
    </>
  );
}

function SpotCard({ it, onFound }: { it: SpotItem; onFound(): void }) {
  const [found, setFound] = useState(false);
  /** 눌러 본 맞는 토큰과, 흔들림을 다시 돌리기 위한 횟수 */
  const [tried, setTried] = useState<Record<number, number>>({});
  const press = (i: number, bad: boolean) => {
    if (found) return;
    if (bad) {
      setFound(true);
      onFound();
    } else setTried({ ...tried, [i]: (tried[i] ?? 0) + 1 });
  };
  return (
    <div className="card">
      <LRich src={it.prompt} />
      <div className="spot">
        {it.from && (
          <>
            <Tex tex={relTex(it.from)} />
            <span className="arrow">→</span>
          </>
        )}
        {it.tokens.map((t, i) =>
          'sep' in t && t.sep === '=' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: 토큰 순서는 데이터에서 고정
            <span key={i} className="arrow">
              {spotEqSign(it.tokens)}
            </span>
          ) : (
            // 부등호는 누를 수 있는 토큰 — 방향을 잘못 쓴 실수가 틀린 곳일 수 있고, 부등호만 버튼이면 답이 드러난다
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: 흔들림을 다시 돌리려고 누른 횟수를 key 에 넣는다
              key={`${i}-${tried[i] ?? 0}`}
              className={`tok${found && t.bad ? ' found' : ''}${tried[i] ? ' ok nope' : ''}`}
              aria-pressed={found && t.bad ? true : undefined}
              onClick={() => press(i, !!t.bad)}
            >
              <Tex
                tex={
                  'sep' in t
                    ? relSignTex(t.sep)
                    : // 같은 쪽 앞 토큰 뒤에 이어지면 이어 붙인 식처럼 그린다(형식 검사가 같은 글자로 확인)
                      tokenTex(t.sym, i > 0 && !('sep' in (it.tokens[i - 1] as SpotToken)))
                }
              />
            </button>
          ),
        )}
      </div>
      {found && (
        <div className="fix">
          <span className="lbl">이렇게 고쳐요</span>
          {/* 검산한 바로 그 식: bad 토큰 자리에 fix 조각을 끼운 것 */}
          <Tex tex={relTex(spotEquation(spotFixed(it.tokens, it.fix.sym)))} className="m" />
          <LRich src={it.fix.body} />
        </div>
      )}
    </div>
  );
}

function Solve({ s, env }: { s: SolveScene; env: SceneEnv }) {
  const solved = useRef(new Set<string>());
  return (
    <>
      <Head s={s} />
      {s.items.map((it, i) => (
        <SolveCard
          key={it.id}
          it={it}
          n={i + 1}
          inkKey={lessonInkKey(env.unitId, s.id, it.id)}
          legacyKey={legacyInkKey(env.unitId, s.id, i)}
          env={env}
          onSolved={() => {
            solved.current.add(it.id);
            if (solved.current.size === s.items.length) env.onDone(s.id);
          }}
        />
      ))}
      <After s={s} />
    </>
  );
}

const NO_CTL: InkControl = { register() {}, unregister() {}, penActive() {} };

const BURST_COLORS = ['var(--primary)', 'var(--good)', 'var(--coin)', 'var(--bad)'];

function SolveCard(p: {
  it: SolveItem;
  n: number;
  inkKey: string;
  /** 문제 번호로 저장하던 예전 필기 키. 노트를 처음 열 때 새 키로 옮긴다 */
  legacyKey: string;
  env: SceneEnv;
  onSolved(): void;
}) {
  const { it } = p;
  /** 이 문제 글에서만 쓰는 값: 검산된 답 */
  const own = { answer: answerText(it) };
  const [input, setInput] = useState('');
  const [pad, setPad] = useState(false);
  const [fb, setFb] = useState<{ text: string; cls: '' | 'ok' | 'bad' } | null>(null);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(0);
  const [note, setNote] = useState(false);
  /** 옛 키 필기를 옮긴 뒤에 노트를 연다 — InkPage 가 먼저 새 키(빈 값)를 읽으면 옛 필기가 안 보인다 */
  const [noteReady, setNoteReady] = useState(false);
  const [dots, setDots] = useState<{ id: number; style: CSSProperties }[]>([]);
  const ok = fb?.cls === 'ok';
  const cardRef = useRef<HTMLDivElement>(null);
  const ansRef = useRef<HTMLButtonElement>(null);

  const optsRef = useRef<HTMLDivElement>(null);
  const cols = useOptColumns(optsRef, it.choices?.length ?? 0);
  /** 객관식 보기는 누른 보기 번호를 바로 넘긴다(setInput 이 반영되기 전에 채점하므로) */
  const check = (value = input) => {
    const v = compareAnswer(value, it.answer, it.answerType);
    if (v === 'invalid') {
      setFb({ text: '숫자로 적어 주세요.', cls: '' });
      return;
    }
    const n = tries + 1;
    setTries(n);
    if (v === 'correct') {
      setFb({ text: '정답이에요. 풀이와 비교해 보세요.', cls: 'ok' });
      setPad(false);
      p.onSolved();
      if (!reducedMotion()) burst();
    } else {
      setFb({
        text:
          n < 2
            ? '아쉬워요. 힌트를 보고 한 번 더 해 봐요.'
            : '괜찮아요. 풀이를 한 단계씩 따라가 봐요.',
        cls: 'bad',
      });
      if (n >= 2 && shown === 0) setShown(1);
    }
  };
  // 정답 표시: 확인 버튼 근처에서 작은 점 16개가 퍼졌다 사라진다(동작 줄이기면 없음)
  const burst = () => {
    const cr = cardRef.current?.getBoundingClientRect();
    const ar = ansRef.current?.getBoundingClientRect();
    if (!cr || !ar) return;
    const base = Date.now();
    setDots(
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = 50 + Math.random() * 40;
        return {
          id: base + i,
          style: {
            left: ar.right - cr.left - 40,
            top: ar.top - cr.top + ar.height / 2,
            background: BURST_COLORS[i % 4],
            '--dx': `${Math.cos(a) * r}px`,
            '--dy': `${Math.sin(a) * r}px`,
          } as CSSProperties,
        };
      }),
    );
    setTimeout(() => setDots([]), 800);
  };

  const shownInput = input.replace(/-/g, '−');
  return (
    <div className="card burst" ref={cardRef}>
      <LRich src={it.q} vars={own} className="prob" />
      {it.answerType === 'choice' ? (
        // 객관식: 보기를 누르면 바로 채점(문제 화면 Pages 와 같은 방식). 점이 퍼지는 자리는 정답 보기
        <div className="opts" ref={optsRef} style={{ '--n': cols } as CSSProperties}>
          {(it.choices ?? []).map((c, i) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: 보기 번호가 곧 자리
              key={i}
              ref={String(i + 1) === it.answer ? ansRef : undefined}
              className={`opt num${ok && String(i + 1) === it.answer ? ' right' : ''}${
                fb?.cls === 'bad' && input === String(i + 1) ? ' wrong' : ''
              }`}
              disabled={ok}
              onClick={() => {
                setInput(String(i + 1));
                check(String(i + 1));
              }}
            >
              {CIRCLED[i]} <LRich inline src={c} />
            </button>
          ))}
        </div>
      ) : (
        <div className="ansrow">
          <button
            type="button"
            ref={ansRef}
            className={`ans${fb?.cls === 'ok' ? ' ok' : fb?.cls === 'bad' ? ' bad' : ''}`}
            aria-label={`문제 ${p.n} 답`}
            aria-expanded={pad}
            disabled={ok}
            onClick={() => setPad(!pad)}
          >
            {shownInput || <span className="ph">{it.placeholder ?? '답'}</span>}
          </button>
          <button type="button" className="lbtn blue" disabled={ok} onClick={() => check()}>
            확인
          </button>
        </div>
      )}
      {pad && !ok && (
        <NumPad
          value={input}
          onChange={(v) => {
            setInput(v);
            if (fb?.cls === 'bad' || fb?.cls === '') setFb(null);
          }}
        />
      )}
      <p className={`fb${fb?.cls ? ` ${fb.cls}` : ''}`} aria-live="polite">
        {fb?.text}
      </p>
      {hint && it.hint && <LRich src={it.hint} vars={own} className="hintbox" />}
      <div className="stepper">
        {it.steps.slice(0, shown).map((st, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 풀이 단계 순서는 고정
          <div className="lstep" key={i}>
            <small>
              <LRich inline src={st.title} vars={own} />
            </small>
            <LRich src={st.body} vars={own} />
          </div>
        ))}
      </div>
      <div className="row2">
        <button
          type="button"
          className="lbtn soft"
          disabled={!it.hint || hint}
          onClick={() => setHint(true)}
        >
          힌트
        </button>
        <button
          type="button"
          className="lbtn soft"
          disabled={shown >= it.steps.length}
          onClick={() => setShown(shown + 1)}
        >
          {shown >= it.steps.length ? '풀이 끝' : '풀이 한 단계'}
        </button>
      </div>
      <button
        type="button"
        className="lbtn quiet"
        aria-expanded={note}
        onClick={() => {
          setNote(!note);
          if (!noteReady)
            void migrateInk(store, p.legacyKey, p.inkKey)
              .catch(() => undefined)
              .finally(() => setNoteReady(true));
        }}
      >
        {note ? '풀이 노트 닫기' : '풀이 노트 열기'}
      </button>
      {note && noteReady && (
        <div className="note-drawer">
          <InkPage
            inkKey={p.inkKey}
            grow
            tool={p.env.tool}
            background={p.env.background}
            ctl={NO_CTL}
            className="notebook"
          />
        </div>
      )}
      {dots.map((d) => (
        <i key={d.id} className="bdot" style={d.style} />
      ))}
    </div>
  );
}

function Summary({ s }: { s: SummaryScene }) {
  return (
    <>
      <Head s={s} />
      <div className="sum">
        {s.points.map((pt, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 요약 순서는 고정
          <div className="it" key={i}>
            <b>{i + 1}</b>
            <LRich src={pt} />
          </div>
        ))}
      </div>
      {(s.done || s.next) && (
        <div className="done">
          <div className="bigcheck" aria-hidden>
            ✓
          </div>
          {s.done && (
            <b>
              <LRich inline src={s.done} />
            </b>
          )}
          {s.next && <LRich src={s.next} className="lead" />}
        </div>
      )}
      <After s={s} />
    </>
  );
}

/** 장면 하나를 감싸는 틀 */
export function SceneFrame(p: { id: string; enter: boolean; children: ReactNode }) {
  return (
    <section className={`scene${p.enter ? ' enter' : ''}`} data-scene={p.id}>
      {p.children}
    </section>
  );
}
