// 문제 카드와, 레슨이 아직 없는 단원의 옛 개념·예제 카드(곧 레슨으로 바뀐다).
// 문제 글 위에는 필기하지 않는다(풀이 노트에만) — 그래서 펼쳐지는 것(채점·힌트·풀이)을 필요한 자리에 바로 둔다.
import { useState } from 'react';
import type { Example, Problem, Step, Unit } from '../content/types.ts';
import { generatorById } from '../generators/index.ts';
import { answerText, CIRCLED, compareAnswer, type Verdict } from '../lib/answer.ts';
import type { CardState, Grade } from '../lib/srs.ts';
import { NumPad } from './NumPad.tsx';
import { genPid } from './pages.ts';
import { Rich } from './Rich.tsx';
import { routeHash } from './route.ts';
import { dueText, GRADE_LABEL } from './today.ts';

/** 옛 개념 설명(레슨이 없는 단원만). 레슨이 생기면 단원 홈에서 레슨이 이 자리를 대신한다 */
export function ConceptCard({ unit }: { unit: Unit }) {
  return (
    <section className="card">
      <span className="eyebrow">개념</span>
      {(unit.concept ?? []).map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 개념 순서는 고정
        <div className="concept-sec" key={i}>
          <h2>{c.heading}</h2>
          <Rich src={c.body} />
        </div>
      ))}
    </section>
  );
}

export function ExampleCard({ ex, n }: { ex: Example; n: number }) {
  return (
    <section className="card example">
      <span className="eyebrow">예제 {n}</span>
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

function StepList({ steps, shown, tip }: { steps: Step[]; shown: number; tip?: string }) {
  return (
    <>
      {steps.slice(0, shown).map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 풀이 단계 순서는 고정
        <div className="step" key={i}>
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
    <button type="button" className="btn soft" disabled={done} onClick={p.onNext}>
      {done ? '풀이 끝' : p.shown === 0 ? '풀이 1단계 보기' : `${p.shown + 1}단계 보기`}
    </button>
  );
}

const VERDICT: Record<Verdict, string> = {
  correct: '맞았어요.',
  wrong: '다시 생각해 봐요.',
  invalid: '답 모양을 확인해 주세요(정수·분수 a/b·소수).',
  unknown: '식으로 된 답이라 풀이와 직접 비교해 주세요.',
};

export function ProblemCard(p: {
  unit: Unit;
  problem: Problem;
  index: number;
  card: CardState | undefined;
  /** 없으면(생성 문제) 복습 카드에 넣지 않고 이 화면에서만 표시한다 */
  onGrade?: (r: Grade, before: CardState | undefined) => void;
}) {
  const { unit, problem: pr, card } = p;
  // 이 문제에 들어올 때의 카드. 다시 채점하면 이것에서 새로 계산해 덮어쓴다 —
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
    <article className="card pcard">
      <div className="problem-head">
        <span>{isGen ? '같은 유형 연습' : `문제 ${p.index + 1}`}</span>
        <span className="badge">{pr.level}</span>
      </div>
      <Rich src={pr.q} className="question" />

      {pr.choices ? (
        <div className="choices">
          {pr.choices.map((c, i) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: 보기 번호가 곧 자리
              key={i}
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
        <>
          <div className="answer-row">
            <output className="answer-input num" aria-label="답">
              {input.replace(/-/g, '−') || <span className="ph">답</span>}
            </output>
            <button type="button" className="btn primary big" onClick={() => check(input)}>
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
        </>
      )}
      <p className={`verdict ${verdict ?? ''}`} aria-live="polite">
        {verdict ? VERDICT[verdict] : ''}
      </p>

      <div className="row">
        {pr.concepts && pr.concepts.length > 0 && (
          <button
            type="button"
            className="btn soft"
            aria-pressed={hint}
            onClick={() => setHint(!hint)}
          >
            힌트
          </button>
        )}
        <button
          type="button"
          className="btn soft"
          aria-pressed={showAnswer}
          onClick={() => setShowAnswer(!showAnswer)}
        >
          정답 보기
        </button>
        {pr.steps.length > 0 && (
          <StepButton total={pr.steps.length} shown={shown} onNext={() => setShown(shown + 1)} />
        )}
      </div>
      {hint && (
        <ul className="hints">
          {pr.concepts?.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 힌트 순서는 고정
            <li key={i}>
              <Rich inline src={c} />
            </li>
          ))}
        </ul>
      )}
      {showAnswer && (
        <p className="answer-reveal">
          정답: <Rich inline src={answerText(pr)} />
        </p>
      )}
      {shown > 0 && (
        <div className="steps">
          <StepList steps={pr.steps} shown={shown} tip={pr.tip} />
        </div>
      )}

      <div className="grade">
        <div className="grade-label">스스로 채점</div>
        <div className="row grade-btns">
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
        {p.onGrade
          ? card && <p className="due">{dueText(card, Date.now())}</p>
          : mine && <p className="due">연습 문제라 복습 목록에는 넣지 않아요.</p>}
      </div>

      {gen && (
        <a
          className="btn quiet"
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
    </article>
  );
}
