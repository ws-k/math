// 레슨 장면들. 장면은 데이터만 그리고, 진행(다음 장면·완료)은 LessonPlayer 가 쥔다.
// 화면 글자 가운데 값에서 나오는 것(보기 글자·식·연습문제 수)은 format.ts 로 데이터에서 만든다.
import { type CSSProperties, type ReactNode, useRef, useState } from 'react';
import type { InkControl } from '../app/InkPage.tsx';
import { InkPage } from '../app/InkPage.tsx';
import { NumPad } from '../app/NumPad.tsx';
import { Rich } from '../app/Rich.tsx';
import type { Background, Tool } from '../ink/types.ts';
import { compareAnswer } from '../lib/answer.ts';
import { fill, formatValue, handsOnCount, symToTex } from './format.ts';
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
  SummaryScene,
  TermsScene,
} from './types.ts';
import { reducedMotion, Tex } from './ui.tsx';
import { Widget } from './widgets/index.tsx';

export interface SceneEnv {
  lesson: Lesson;
  unitId: string;
  /** 단원 연습문제 수({{problems}}) */
  problems: number;
  tool: Tool;
  background: Background;
  onDone(id: string): void;
}

/** 등식 sym("왼쪽=오른쪽") → TeX */
const eqTex = (sym: string) => sym.split('=').map(symToTex).join('=');

function Head({ s, big }: { s: Scene; big?: boolean }) {
  return (
    <>
      {s.chip && <Rich inline emph src={s.chip} className="chip" />}
      {big ? (
        <h1>
          <Rich inline emph src={s.title} />
        </h1>
      ) : (
        <h2>
          <Rich inline emph src={s.title} />
        </h2>
      )}
      {s.lead && <Rich emph src={s.lead} className="lead" />}
    </>
  );
}

const After = ({ s }: { s: Scene }) => (s.after ? <Rich emph src={s.after} /> : null);

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
      return <Summary s={s} env={env} />;
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
        {meta.map((m) => (
          <Rich inline emph key={m} src={m} />
        ))}
      </div>
      <After s={s} />
    </>
  );
}

function Question({ s, env }: { s: QuestionScene; env: SceneEnv }) {
  const [right, setRight] = useState(false);
  const [wrong, setWrong] = useState<{ i: number; n: number } | null>(null);
  const [misses, setMisses] = useState(0);
  const labels = s.choices.map((c) => formatValue(c.value, s.format ?? {}));
  const pick = (i: number) => {
    if (right) return;
    if (i === s.answer) {
      setRight(true);
      setWrong(null);
      env.onDone(s.id);
    } else {
      // n 을 바꿔 같은 보기를 다시 눌러도 흔들림 애니메이션이 다시 돈다
      setWrong({ i, n: (wrong?.n ?? 0) + 1 });
      setMisses(misses + 1);
    }
  };
  const fb = wrong ? s.choices[wrong.i]?.feedback : undefined;
  return (
    <>
      <Head s={s} />
      <div className="card">
        {s.widget && <Widget spec={s.widget} onDone={() => {}} />}
        <div className="opts" style={{ '--n': s.choices.length } as CSSProperties}>
          {s.choices.map((c, i) => (
            <button
              type="button"
              key={`${c.value}-${i === wrong?.i ? wrong.n : 0}`}
              className={`opt num${right && i === s.answer ? ' right' : ''}${
                i === wrong?.i ? ' wrong' : ''
              }`}
              disabled={right}
              onClick={() => pick(i)}
            >
              {labels[i]}
            </button>
          ))}
        </div>
        {right && (
          <div className="reveal">
            <Rich emph src={s.reveal} />
            {s.thoughts?.map((t, i) => (
              <div className="thought" key={t}>
                <b>{i + 1}</b>
                <Rich emph src={t} />
              </div>
            ))}
            {s.conclude && <Rich emph src={s.conclude} />}
          </div>
        )}
        <div aria-live="polite">{!right && fb && <Rich emph src={fb} className="fb bad" />}</div>
        {s.gate && !right && misses >= 2 && (
          <button type="button" className="lbtn quiet" onClick={() => pick(s.answer)}>
            답 보기
          </button>
        )}
      </div>
      <After s={s} />
    </>
  );
}

function Explore({ s, env }: { s: ExploreScene; env: SceneEnv }) {
  return (
    <>
      <Head s={s} />
      <div className="card">
        <Widget spec={s.widget} onDone={() => env.onDone(s.id)} />
      </div>
      <After s={s} />
    </>
  );
}

function Terms({ s }: { s: TermsScene }) {
  return (
    <>
      <Head s={s} />
      <div className="terms">
        {s.terms.map((t) => (
          <div className="term" key={t.term}>
            <b>
              <Rich inline emph src={t.term} />
            </b>
            <Rich emph src={t.body} />
          </div>
        ))}
      </div>
      {s.aside && <Rich emph src={s.aside} className="aside" />}
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
          key={it.prompt}
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
      <Rich emph src={it.prompt} />
      <div className="spot">
        {it.from && (
          <>
            <Tex tex={eqTex(it.from)} />
            <span className="arrow">→</span>
          </>
        )}
        {it.tokens.map((t, i) =>
          'sep' in t ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: 토큰 순서는 데이터에서 고정
            <span key={i} className="arrow">
              =
            </span>
          ) : (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: 흔들림을 다시 돌리려고 누른 횟수를 key 에 넣는다
              key={`${i}-${tried[i] ?? 0}`}
              className={`tok${found && t.bad ? ' found' : ''}${tried[i] ? ' ok nope' : ''}`}
              aria-pressed={found && t.bad ? true : undefined}
              onClick={() => press(i, !!t.bad)}
            >
              <Tex tex={symToTex(t.sym)} />
            </button>
          ),
        )}
      </div>
      {found && (
        <div className="fix">
          <span className="lbl">이렇게 고쳐요</span>
          <Tex tex={eqTex(it.fix.sym)} className="m" />
          <Rich emph src={it.fix.body} />
        </div>
      )}
    </div>
  );
}

function Solve({ s, env }: { s: SolveScene; env: SceneEnv }) {
  const solved = useRef(new Set<number>());
  return (
    <>
      <Head s={s} />
      {s.items.map((it, i) => (
        <SolveCard
          key={it.q}
          it={it}
          n={i + 1}
          inkKey={`ink:${env.unitId}:lesson:${s.id}:${i + 1}`}
          env={env}
          onSolved={() => {
            solved.current.add(i);
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
  env: SceneEnv;
  onSolved(): void;
}) {
  const { it } = p;
  const [input, setInput] = useState('');
  const [pad, setPad] = useState(false);
  const [fb, setFb] = useState<{ text: string; cls: '' | 'ok' | 'bad' } | null>(null);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(0);
  const [note, setNote] = useState(false);
  const [dots, setDots] = useState<{ id: number; style: CSSProperties }[]>([]);
  const ok = fb?.cls === 'ok';
  const cardRef = useRef<HTMLDivElement>(null);
  const ansRef = useRef<HTMLButtonElement>(null);

  const check = () => {
    const v = compareAnswer(input, it.answer, it.answerType);
    if (v === 'invalid') {
      setFb({ text: '숫자로 적어 주세요.', cls: '' });
      return;
    }
    const n = tries + 1;
    setTries(n);
    if (v === 'correct') {
      setFb({ text: '정답이에요! 풀이와 비교해 보세요.', cls: 'ok' });
      setPad(false);
      p.onSolved();
      if (!reducedMotion()) burst();
    } else {
      setFb({
        text: n < 2 ? '아쉬워요. 힌트를 보고 한 번 더!' : '괜찮아요. 풀이를 한 단계씩 따라가 봐요.',
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
      <Rich emph src={it.q} className="prob" />
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
        <button type="button" className="lbtn blue" disabled={ok} onClick={check}>
          확인
        </button>
      </div>
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
      {hint && it.hint && <Rich emph src={it.hint} className="hintbox" />}
      <div className="stepper">
        {it.steps.slice(0, shown).map((st) => (
          <div className="lstep" key={st.title}>
            <small>
              <Rich inline src={st.title} />
            </small>
            <Rich src={st.body} />
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
        onClick={() => setNote(!note)}
      >
        {note ? '풀이 노트 닫기' : '풀이 노트 열기'}
      </button>
      {note && (
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

function Summary({ s, env }: { s: SummaryScene; env: SceneEnv }) {
  const vars = { problems: String(env.problems) };
  return (
    <>
      <Head s={s} />
      <div className="sum">
        {s.points.map((pt, i) => (
          <div className="it" key={pt}>
            <b>{i + 1}</b>
            <Rich emph src={pt} />
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
              <Rich inline emph src={s.done} />
            </b>
          )}
          {s.next && <Rich emph src={fill(s.next, vars)} className="lead" />}
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
