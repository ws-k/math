// 부품 등록부(검사 쪽). 부품마다 형식 검사(parse)와 검산 항목 생성(checks)을 둔다.
// 화면 쪽 등록부(widgets/index.tsx)와 나눈 이유: 검사기는 Node 로 .ts 만 읽을 수 있어서다.
// checks 는 화면이 쓰는 바로 그 TS 모델을 돌린 결과를 sympy 에 넘긴다(두 벌 계산 금지).
import type { CheckItem } from '../../content/check.ts';

type Named<T> = T extends unknown ? Omit<T, 'ref' | 'unit'> & { name: string } : never;
/** 부품이 만드는 검산 항목. ref 는 검사기가 "<단원>/lesson:<장면>:<name>"으로 붙인다 */
export type WidgetCheck = Named<CheckItem>;

export interface WidgetDef<P> {
  /** 매개변수를 검사해 타입 붙은 값으로. 모르는 칸·잘못된 값은 ParseError */
  parse(raw: unknown): P;
  checks(p: P): WidgetCheck[];
  /** 화면에 보일 글 칸들(검사기가 수식·강조 표기를 검사) */
  texts(p: P): string[];
}

// biome-ignore lint/suspicious/noExplicitAny: 부품마다 매개변수 타입이 달라 등록부는 any 로 모은다. 꺼낼 때 parse 가 타입을 다시 붙인다.
export const widgetDefs: Record<string, WidgetDef<any>> = {};
