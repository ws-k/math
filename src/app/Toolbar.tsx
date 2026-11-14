// 필기 도구 막대. 손가락·마우스로 누른다(펜은 쓰기 전용 — 설계 10장).
import type { Background, SizeLevel, Tool } from '../ink/types.ts';
import { HIGHLIGHT_COLOR, PEN_COLORS } from './settings.ts';

const BG_LABEL: Record<Background, string> = { none: '배경 없음', grid: '모눈', lines: '줄' };
const BG_NEXT: Record<Background, Background> = { none: 'grid', grid: 'lines', lines: 'none' };
const PEN_NAME = ['검정', '파랑', '빨강'];

export interface ToolbarProps {
  tool: Tool;
  background: Background;
  onTool(t: Tool): void;
  onBackground(b: Background): void;
  /** 한 손가락으로도 쓸지 */
  fingerInk: boolean;
  onFingerInk(on: boolean): void;
  onUndo(): void;
  onRedo(): void;
  onClear(): void;
}

export function Toolbar(p: ToolbarProps) {
  const { tool } = p;
  return (
    <div className="toolbar">
      {PEN_COLORS.map((c, i) => (
        <button
          type="button"
          key={c}
          aria-label={`${PEN_NAME[i]} 펜`}
          aria-pressed={tool.kind === 'pen' && tool.color === c}
          className="btn tool"
          onClick={() => p.onTool({ ...tool, kind: 'pen', color: c })}
        >
          <span className="swatch" style={{ background: c }} />
        </button>
      ))}
      <button
        type="button"
        aria-pressed={tool.kind === 'highlighter'}
        className="btn tool"
        onClick={() => p.onTool({ ...tool, kind: 'highlighter', color: HIGHLIGHT_COLOR })}
      >
        <span className="swatch hl" style={{ background: HIGHLIGHT_COLOR }} />
        형광
      </button>
      <button
        type="button"
        aria-pressed={tool.kind === 'eraser'}
        className="btn tool"
        onClick={() => p.onTool({ ...tool, kind: 'eraser' })}
      >
        지우개
      </button>
      <span className="sep" />
      {([0, 1, 2] as SizeLevel[]).map((s) => (
        <button
          type="button"
          key={s}
          aria-label={['가늘게', '보통', '굵게'][s]}
          aria-pressed={tool.size === s}
          className="btn tool"
          onClick={() => p.onTool({ ...tool, size: s })}
        >
          <span className="dot" style={{ width: 4 + s * 4, height: 4 + s * 4 }} />
        </button>
      ))}
      <span className="sep" />
      <button
        type="button"
        aria-label="손가락으로 쓰기"
        aria-pressed={p.fingerInk}
        className="btn tool"
        onClick={() => p.onFingerInk(!p.fingerInk)}
      >
        손가락
      </button>
      <span className="sep" />
      <button type="button" aria-label="실행 취소" className="btn tool" onClick={p.onUndo}>
        ↶
      </button>
      <button type="button" aria-label="다시 실행" className="btn tool" onClick={p.onRedo}>
        ↷
      </button>
      <button type="button" className="btn tool" onClick={p.onClear}>
        전체 지우기
      </button>
      <button
        type="button"
        className="btn tool"
        onClick={() => p.onBackground(BG_NEXT[p.background])}
      >
        {BG_LABEL[p.background]}
      </button>
    </div>
  );
}
