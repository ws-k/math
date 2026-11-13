// 영수증 모양 표(정적).
import { Rich } from '../../app/Rich.tsx';
import type { WidgetProps } from './index.tsx';
import { cellText, type TableParams } from './table.ts';

export function Table({ params: p }: WidgetProps<TableParams>) {
  return (
    <div className="receipt">
      {p.title && <Rich inline emph src={p.title} className="shop" />}
      {p.rows.map((r) => (
        <div className="rrow" key={r.label}>
          <Rich inline emph src={r.label} />
          <span className={r.value === undefined ? 'q' : 'num'}>{cellText(r, p.unit)}</span>
        </div>
      ))}
      {p.total && (
        <div className="rrow total">
          <Rich inline emph src={p.total.label} />
          <span className="num">{cellText(p.total, p.unit)}</span>
        </div>
      )}
    </div>
  );
}
