// 영수증 모양 표(정적).
import { LRich } from '../ui.tsx';
import type { WidgetProps } from './index.tsx';
import { cellText, type TableParams } from './table.ts';

export function Table({ params: p }: WidgetProps<TableParams>) {
  return (
    <div className="receipt">
      {p.title && <LRich inline src={p.title} className="shop" />}
      {p.rows.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 줄 순서는 데이터에서 고정이고 같은 이름 줄이 있을 수 있다
        <div className="rrow" key={i}>
          <LRich inline src={r.label} />
          <span className={r.value === undefined ? 'q' : 'num'}>{cellText(r, p.unit)}</span>
        </div>
      ))}
      {p.total && (
        <div className="rrow total">
          <LRich inline src={p.total.label} />
          <span className="num">{cellText(p.total, p.unit)}</span>
        </div>
      )}
    </div>
  );
}
