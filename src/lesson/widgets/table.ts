// 표·영수증(정적). 질문 장면의 도입에 쓴다. 값 칸은 수(정수·분수)로 받아 formatValue 로 글자를 만든다 —
// 쉼표·단위 표기를 작성자가 손으로 쓰다 틀리지 않게. 값이 없는 칸은 '?'(구할 것).
import { formatValue } from '../format.ts';
import { arr, obj, optStr, rationalStr, str } from '../parse.ts';
import type { WidgetDef } from './specs.ts';

export interface TableRow {
  label: string;
  value?: string;
}

export interface TableParams {
  title?: string;
  unit: string;
  rows: TableRow[];
  total?: TableRow;
}

const row = (v: unknown, at: string): TableRow => {
  const o = obj(v, at, ['label'], ['value']);
  return {
    label: str(o.label, `${at} label`),
    ...(o.value !== undefined ? { value: rationalStr(o.value, `${at} value`) } : {}),
  };
};

export const cellText = (r: TableRow, unit: string) =>
  r.value === undefined ? '?' : formatValue(r.value, { unit });

export const tableDef: WidgetDef<TableParams> = {
  parse(raw) {
    const o = obj(raw, '표', ['unit', 'rows'], ['title', 'total']);
    const title = optStr(o.title, '표 title');
    return {
      ...(title !== undefined ? { title } : {}),
      unit: str(o.unit, '표 unit'),
      rows: arr(o.rows, '표 rows', 1, 8).map((r, i) => row(r, `표 줄${i + 1}`)),
      ...(o.total !== undefined ? { total: row(o.total, '표 total') } : {}),
    };
  },
  checks: () => [],
  texts: (p) => [
    ...(p.title ? [p.title] : []),
    ...p.rows.map((r) => r.label),
    ...(p.total ? [p.total.label] : []),
  ],
};
