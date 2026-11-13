// 교재 쪽 내용: 개념 쪽, 예제 쪽(+문제 목차), 문제 쪽.
import { useState } from 'react';
import type { Example, Problem, Step, Unit } from '../content/types.ts';
import { generatorById } from '../generators/index.ts';
import { compareAnswer, type Verdict } from '../lib/answer.ts';
import type { CardState, Grade } from '../lib/srs.ts';
import { NumPad } from './NumPad.tsx';
import { cardKey, genPid } from './pages.ts';
import { Rich } from './Rich.tsx';
import { routeHash } from './route.ts';
import { type Cards, dueText, GRADE_LABEL } from './today.ts';

const CIRCLED = ['①', '②', '③', '④', '⑤'];

export function ConceptPage({ unit }: { unit: Unit }) {
  return (
    <article className="text">
      <h1 className="unit-title">{unit.title}</h1>
      {(unit.concept ?? []).map((c) => (
        <section key={c.heading}>
          <h2>{c.heading}</h2>
          <Rich src={c.body} />
        </section>
      ))}
      {unit.formulas.length > 0 && (
        <section className="formulas">
          <h2>공식</h2>
          {unit.formulas.map((f) => (
            <Rich key={f} src={f} className="formula" />
          ))}
        </section>
      )}
      {/* 쪽 맨 끝에 둔다 — 위에 끼우면 이미 쓴 개념 쪽 필기가 글자와 어긋난다 */}
      {unit.lesson && (
        <a className="btn primary" href={routeHash({ name: 'lesson', unitId: unit.id })}>
          새 레슨으로 배우기
        </a>
      )}
    </article>
  );
}

export function ExamplesPage({ unit, cards }: { unit: Unit; cards: Cards }) {
  return (
    <article className="text">
      <h2>예제</h2>
      {(unit.examples ?? []).map((ex, i) => (
        <ExampleBlock key={ex.q} ex={ex} n={i + 1} />
      ))}
      <h2>연습문제</h2>
      <ol className="toc">
        {unit.problems.map((p, i) => {
          const c = cards[cardKey(unit.id, p.id)];
          return (
            <li key={p.id}>
              <a
                className="toc-link"
                href={routeHash({ name: 'unit', unitId: unit.id, pid: p.id, side: 'text' })}
              >
                <span className="toc-n">{i + 1}</span>
                <span className="level">{p.level}</span>
                <span className="toc-mark">{c ? GRADE_LABEL[c.last] : ''}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function ExampleBlock({ ex, n }: { ex: Example; n: number }) {
  return (
    <section className="example">
      <h3>예제 {n}</h3>
      <Rich src={ex.q} />
      <Steps steps={ex.steps} tip={ex.tip} />
    </section>
  );
}

/** 풀이 단계를 하나씩 펼친다. 한꺼번에 보이면 스스로 생각할 틈이 없어서다. */
function Steps({ steps, tip }: { steps: Step[]; tip?: string }) {
  const [shown, setShown] = useState(0);
  return (
    <div className="steps">
      <StepList steps={steps} shown={shown} tip={tip} />
      {shown < steps.length && (
        <StepButton total={steps.length} shown={shown} onNext={() => setShown(shown + 1)} />
      )}
    </div>
  );
}

/** 펼친 단계까지(다 펼치면 팁도). 문제 쪽은 버튼과 떼어 쪽 아래에 둔다. */
function StepList({ steps, shown, tip }: { steps: Step[]; shown: number; tip?: string }) {
  return (
    <>
      {steps.slice(0, shown).map((s, i) => (
        <div className="step" key={s.title}>
          <div className="step-title">
            {i + 1}단계 · <Rich inline src={s.title} />
          </div>
          <Rich src={s.body} />
        </div>
      ))}
      {shown >= steps.length && tip && (
        <div className="tip">
          <b>짚고 넘어가기</b>
          <Rich src={tip} />
        </div>
      )}
    </>
  );
}

function StepButton(p: { total: number; shown: number; onNext(): void }) {
  const done = p.shown >= p.total;
  return (
    <button type="button" className="btn" disabled={done} onClick={p.onNext}>
      {done ? '풀이 끝' : p.shown === 0 ? '풀이 1단계 보기' : `${p.shown + 1}단계 보기`}
    </button>
  );
}

const VERDICT: Record<Verdict, string> = {
  correct: '맞았습니다',
  wrong: '다시 생각해 보세요',
  invalid: '답의 모양을 확인해 주세요 (정수·분수 a/b·소수)',
  unknown: '식으로 된 답이라 직접 비교해 주세요',
};

/**
 * 문제 쪽. 교재 쪽 필기는 글자 위치에 맞춰 남으므로, 누르면 펼쳐지는 것(채점 문구·힌트·정답·풀이·팁)은
 * 모두 문제·보기·답 입력·버튼보다 아래에 모아 둔다 — 펼쳐도 위쪽 글자가 밀리지 않아 필기가 어긋나지 않는다.
 */
export function ProblemPage(p: {
  unit: Unit;
  problem: Problem;
  index: number;
  card: CardState | undefined;
  /** 없으면(생성 문제) 복습 카드에 넣지 않고 이 화면에서만 표시한다 */
  onGrade?: (r: Grade, before: CardState | undefined) => void;
}) {
  const { unit, problem: pr, card } = p;
  // 이 쪽에 들어올 때의 카드. 다시 채점하면 이것에서 새로 계산해 덮어쓴다 —
  // 마음을 바꿔 여러 번 눌러도 틀린 횟수·상자가 누를 때마다 쌓이지 않게.
  const [before] = useState(card);
  const [mine, setMine] = useState<Grade | null>(null);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hint, setHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [shown, setShown] = useState(0);
  const gen = pr.generator ? generatorById.get(pr.generator) : undefined;
  const isGen = pr.id.startsWith('gen:');
  const graded = p.onGrade ? card?.last : mine;

  const check = (v: string) => setVerdict(compareAnswer(v, pr.answer, pr.answerType));
  const grade = (g: Grade) => {
    if (p.onGrade) p.onGrade(g, before);
    else setMine(g);
  };

  return (
    <article className="text">
      <div className="problem-head">
        <span>{isGen ? '같은 유형 연습' : `문제 ${p.index + 1} / ${unit.problems.length}`}</span>
        <span className="level">{pr.level}</span>
      </div>
      <Rich src={pr.q} className="question" />

      {pr.choices ? (
        <div className="choices">
          {pr.choices.map((c, i) => (
            <button
              type="button"
              key={c}
              className="btn choice"
              aria-pressed={input === String(i + 1)}
              onClick={() => {
                setInput(String(i + 1));
                check(String(i + 1));
              }}
            >
              <span className="circled">{CIRCLED[i]}</span>
              <Rich inline src={c} />
            </button>
          ))}
        </div>
      ) : pr.answerType === 'expr' ? null : (
        <div className="answer-box">
          <div className="answer-row">
            <span className="answer-label">답</span>
            <output className="answer-input">{input.replace(/-/g, '−') || ' '}</output>
            <button type="button" className="btn primary" onClick={() => check(input)}>
              확인
            </button>
          </div>
          <NumPad
            value={input}
            onChange={(v) => {
              setInput(v);
              setVerdict(null);
            }}
          />
        </div>
      )}

      <div className="row">
        {pr.concepts && pr.concepts.length > 0 && (
          <button type="button" className="btn" aria-pressed={hint} onClick={() => setHint(!hint)}>
            힌트
          </button>
        )}
        <button
          type="button"
          className="btn"
          aria-pressed={showAnswer}
          onClick={() => setShowAnswer(!showAnswer)}
        >
          정답 보기
        </button>
        {pr.steps.length > 0 && (
          // 다 펼친 뒤에도 버튼 자리를 남겨 둔다(사라지면 줄바꿈이 달라져 아래가 움직인다)
          <StepButton total={pr.steps.length} shown={shown} onNext={() => setShown(shown + 1)} />
        )}
      </div>

      <div className="grade">
        <div className="grade-label">스스로 채점</div>
        <div className="row">
          {(['right', 'unsure', 'wrong'] as Grade[]).map((g) => (
            <button
              type="button"
              key={g}
              className={`btn grade-${g}`}
              aria-pressed={graded === g}
              onClick={() => grade(g)}
            >
              {GRADE_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      {gen && (
        <a
          className="btn more"
          href={routeHash({
            name: 'unit',
            unitId: unit.id,
            pid: genPid(gen.id, Math.floor(Math.random() * 1e9)),
            side: 'text',
          })}
        >
          같은 유형 더 풀기 · {gen.title}
        </a>
      )}

      {/* ---- 여기부터 펼쳐지는 것들 ---- */}
      {verdict && <p className={`verdict ${verdict}`}>{VERDICT[verdict]}</p>}
      {p.onGrade
        ? card && <p className="due">{dueText(card, Date.now())}</p>
        : mine && <p className="due">연습 문제라 복습 목록에는 넣지 않습니다</p>}
      {hint && (
        <ul className="hints">
          {pr.concepts?.map((c) => (
            <li key={c}>
              <Rich inline src={c} />
            </li>
          ))}
        </ul>
      )}
      {showAnswer && (
        <p className="answer-reveal">
          정답:{' '}
          <Rich
            inline
            src={
              pr.answerTex ??
              (pr.choices ? (CIRCLED[Number(pr.answer) - 1] ?? pr.answer) : pr.answer)
            }
          />
        </p>
      )}
      <div className="steps">
        <StepList steps={pr.steps} shown={shown} tip={pr.tip} />
      </div>
    </article>
  );
}
