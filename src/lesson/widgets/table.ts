// 표·영수증(정적). 질문 장면의 도입에 쓴다. 칸 값은 계산식(sympy 문법의 작은 부분집합)으로 받아
// 앱이 정확히 계산해 formatValue 로 글자를 만든다 — 쉼표·단위 표기를 작성자가 손으로 쓰다 틀리지 않게.
// 미지수(x)가 든 칸과 값이 없는 칸은 '?'(구할 것).
// sum 이면 "줄들의 합 = 합계"라는 관계를 검산한다: 모두 숫자면 합이 맞는지, 미지수가 있으면 그 관계를
// 방정식으로 내보내 질문·다른 부품과 같은 식인지 대조한다(검사기가 Lesson.equations 와 비교).
import { formatValue } from '../format.ts';
import { arr, fail, obj, optStr, str } from '../parse.ts';
import { evalRational, type Node, parseSym, ratStr } from '../sym.ts';
import type { WidgetCheck, WidgetDef } from './specs.ts';

export interface TableRow {
  label: string;
  /** 칸 값 계산식. 없으면 '?' */
  value?: string;
}

export interface TableParams {
  title?: string;
  unit: string;
  rows: TableRow[];
  total?: TableRow;
  /** 합계 = 줄들의 합 */
  sum?: true;
}

const hasVar = (n: Node): boolean =>
  n.t === 'var' ||
  ('a' in n && hasVar(n.a)) ||
  ('b' in n && hasVar(n.b)) ||
  (n.t === 'call' && n.args.some(hasVar));

/** 칸 값: 숫자만이면 분수 문자열, 미지수가 있으면 null */
function cellValue(v: string): string | null {
  const n = parseSym(v);
  return hasVar(n) ? null : ratStr(evalRational(n));
}

const row = (v: unknown, at: string): TableRow => {
  const o = obj(v, at, ['label'], ['value']);
  const value = optStr(o.value, `${at} value`);
  if (value !== undefined) {
    try {
      cellValue(value);
    } catch (e) {
      fail(`${at} value`, (e as Error).message);
    }
  }
  return { label: str(o.label, `${at} label`), ...(value !== undefined ? { value } : {}) };
};

export function cellText(r: TableRow, unit: string): string {
  const v = r.value === undefined ? null : cellValue(r.value);
  return v === null ? '?' : formatValue(v, { unit });
}

const sumOf = (p: TableParams) => p.rows.map((r) => `(${r.value})`).join('+');

export const tableDef: WidgetDef<TableParams> = {
  parse(raw) {
    const o = obj(raw, '표', ['unit', 'rows'], ['title', 'total', 'sum']);
    const title = optStr(o.title, '표 title');
    const p: TableParams = {
      ...(title !== undefined ? { title } : {}),
      unit: str(o.unit, '표 unit'),
      rows: arr(o.rows, '표 rows', 1, 8).map((r, i) => row(r, `표 줄${i + 1}`)),
      ...(o.total !== undefined ? { total: row(o.total, '표 total') } : {}),
    };
    if (o.sum !== undefined) {
      if (o.sum !== true) fail('표 sum', 'true 만');
      if (!p.total?.value || cellValue(p.total.value) === null)
        fail('표 sum', '합계 칸에 숫자 값이 있어야 함');
      if (p.rows.some((r) => r.value === undefined)) fail('표 sum', '모든 줄에 값(식)이 있어야 함');
      p.sum = true;
    }
    return p;
  },
  checks(p) {
    if (!p.sum || !p.total?.value) return [];
    if (p.rows.some((r) => cellValue(r.value as string) === null)) return [];
    const out: WidgetCheck[] = [
      {
        name: '합계',
        answer: cellValue(p.total.value) as string,
        answerType: 'fraction',
        check: sumOf(p),
      },
    ];
    return out;
  },
  texts: (p) => [
    ...(p.title ? [p.title] : []),
    ...p.rows.map((r) => r.label),
    ...(p.total ? [p.total.label] : []),
  ],
  equation(p) {
    if (!p.sum || !p.total?.value) return undefined;
    if (!p.rows.some((r) => cellValue(r.value as string) === null)) return undefined;
    // 한 줄짜리 식은 괄호 없이(3*x+1000=13000) — 사람이 읽는 검산 목록에서 알아보기 쉽게
    const terms = p.rows.map((r) => r.value as string);
    const plain = terms.every((t) => !/[-+]/.test(t.slice(1)));
    return `${plain ? terms.join('+') : sumOf(p)}=${p.total.value}`;
  },
};
