// 부품 등록부(검사 쪽). 부품마다 형식 검사(parse)와 검산 항목 생성(checks)을 둔다.
// 화면 쪽 등록부(widgets/index.tsx)와 나눈 이유: 검사기는 Node 로 .ts 만 읽을 수 있어서다.
// checks 는 화면이 쓰는 바로 그 TS 모델을 돌린 결과를 sympy 에 넘긴다(두 벌 계산 금지).
import type { CheckItem } from '../../content/check.ts';
import { balanceDef } from './balance.ts';
import { countDef } from './count.ts';
import { fractionDef } from './fraction.ts';
import { numberLineDef } from './numberLine.ts';
import { shapeDef } from './shape.ts';
import { simulateDef } from './simulate.ts';
import { tableDef } from './table.ts';
import { termDragDef } from './termDrag.ts';
import { unitCircleDef } from './unitCircle.ts';

type Named<T> = T extends unknown ? Omit<T, 'ref' | 'unit'> & { name: string } : never;
/** 부품이 만드는 검산 항목. ref 는 검사기가 "<단원>/lesson:<장면>:<name>"으로 붙인다 */
export type WidgetCheck = Named<CheckItem>;

export interface WidgetDef<P> {
  /** 매개변수를 검사해 타입 붙은 값으로. 모르는 칸·잘못된 값은 ParseError */
  parse(raw: unknown): P;
  checks(p: P): WidgetCheck[];
  /** 화면에 보일 글 칸들(원문). 검사기가 {{…}} 를 채운 뒤 수식·강조 표기를 검사한다 */
  texts(p: P): string[];
  /** 부품이 글을 채울 때 쓰는 자기 값({{a}} 등). 레슨 값 위에 덮어 채운다 */
  vars?(p: P): Record<string, string>;
  /** 부품이 그리는 방정식(sympy "왼쪽=오른쪽"). 레슨 equations 와 대조할 때 쓴다 */
  equation?(p: P): string | undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: 부품마다 매개변수 타입이 달라 등록부는 any 로 모은다. 꺼낼 때 parse 가 타입을 다시 붙인다.
export const widgetDefs: Record<string, WidgetDef<any>> = {
  balance: balanceDef,
  termDrag: termDragDef,
  table: tableDef,
  numberLine: numberLineDef,
  fraction: fractionDef,
  unitCircle: unitCircleDef,
  shape: shapeDef,
  count: countDef,
  simulate: simulateDef,
};
