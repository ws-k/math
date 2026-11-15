// 목표 줄: 진행("3곳 중 2곳")과 처음 안내·힌트·완료 글. 좌표평면·도형판이 같이 쓴다 — 같은 목표 규칙이
// 부품마다 다른 모양·다른 읽어 주기로 보이지 않게. aria-live 라 화면 낭독기가 판정 결과를 읽는다.
// 진행은 글 칸(두 줄 높이를 늘 비워 둔다) 맨 앞에 함께 둔다 — 따로 한 줄을 쓰면 접은 화면(382×580)에서
// 그림부터 버튼까지가 한 화면을 넘는다(m3-quadratic-eq zero 실측).
import { type GoalProgress, type GoalTexts, goalLine } from '../goal.ts';
import { LRich } from '../ui.tsx';

export function GoalLine({
  prog,
  need,
  texts,
}: {
  prog: GoalProgress;
  need: number;
  texts: GoalTexts;
}) {
  const line = goalLine(prog, need, texts);
  return (
    <div className={`toast ${line.cls}`} aria-live="polite">
      {line.progress && <span className="gprog num">{line.progress}</span>}
      {line.text && <LRich inline src={line.text} />}
    </div>
  );
}
