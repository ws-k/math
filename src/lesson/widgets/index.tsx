// 부품 등록부(화면 쪽). 검사 쪽 등록부(specs.ts)의 parse 로 매개변수에 타입을 붙여 화면 부품에 넘긴다 —
// 검사기가 통과시킨 바로 그 해석을 화면도 쓰게 하려고.
import { type ComponentType, useMemo } from 'react';
import type { WidgetSpec } from '../types.ts';
import { Balance } from './Balance.tsx';
import { Count } from './Count.tsx';
import { Fraction } from './Fraction.tsx';
import { NumberLine } from './NumberLine.tsx';
import { Shape } from './Shape.tsx';
import { Simulate } from './Simulate.tsx';
import { widgetDefs } from './specs.ts';
import { Table } from './Table.tsx';
import { TermDrag } from './TermDrag.tsx';
import { UnitCircle } from './UnitCircle.tsx';
import './widgets.css';

export interface WidgetProps<P = unknown> {
  params: P;
  /** 부품 목표를 이뤘을 때(gate 장면이 열린다) */
  onDone(): void;
  /** 틀린 시도(한쪽만 덜기·놓친 끌기). 두 번이면 재생기가 '넘어가기'를 보인다 */
  onMiss(): void;
}

// biome-ignore lint/suspicious/noExplicitAny: 부품마다 매개변수 타입이 달라 등록부는 any 로 모은다.
export const widgetViews: Record<string, ComponentType<WidgetProps<any>>> = {
  balance: Balance,
  termDrag: TermDrag,
  table: Table,
  numberLine: NumberLine,
  fraction: Fraction,
  unitCircle: UnitCircle,
  shape: Shape,
  count: Count,
  simulate: Simulate,
};

export function Widget({
  spec,
  onDone,
  onMiss,
}: {
  spec: WidgetSpec;
  onDone(): void;
  onMiss(): void;
}) {
  const def = widgetDefs[spec.type];
  const View = widgetViews[spec.type];
  const params = useMemo(() => def?.parse(spec.params), [def, spec.params]);
  // 검사기가 모르는 부품을 막으므로 여기 오면 등록 누락이다. 렌더 스모크 테스트가 잡는다.
  if (!def || !View) throw new Error(`화면 부품 없음: ${spec.type}`);
  return <View params={params} onDone={onDone} onMiss={onMiss} />;
}
