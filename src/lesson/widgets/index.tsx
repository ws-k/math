// 부품 등록부(화면 쪽). 검사 쪽 등록부(specs.ts)의 parse 로 매개변수에 타입을 붙여 화면 부품에 넘긴다 —
// 검사기가 통과시킨 바로 그 해석을 화면도 쓰게 하려고.
import { type ComponentType, useMemo } from 'react';
import type { WidgetSpec } from '../types.ts';
import { AreaModel } from './AreaModel.tsx';
import { Balance } from './Balance.tsx';
import { Column } from './Column.tsx';
import { Coord } from './Coord.tsx';
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
  /** 부품 목표를 이뤘을 때(장면을 끝냄으로 적는다) */
  onDone(): void;
  /** 틀린 시도(오답·놓친 끌기 등). 2026-11-14 부터 재생기는 쓰지 않음 — 나중에 힌트용으로 쓰거나 지운다 */
  onMiss(): void;
  /**
   * 질문 장면 안의 부품이면 그 질문을 맞혔는가(이어 보기로 이미 끝낸 장면도 true). 탐색 장면이면 없음.
   * 부품이 정답을 그대로 보여 주는 칸(확률 실험의 이론값)을 맞히기 전에는 숨기는 데 쓴다
   */
  answered?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: 부품마다 매개변수 타입이 달라 등록부는 any 로 모은다.
export const widgetViews: Record<string, ComponentType<WidgetProps<any>>> = {
  balance: Balance,
  termDrag: TermDrag,
  table: Table,
  coord: Coord,
  areaModel: AreaModel,
  numberLine: NumberLine,
  fraction: Fraction,
  unitCircle: UnitCircle,
  shape: Shape,
  count: Count,
  simulate: Simulate,
  column: Column,
};

export function Widget({
  spec,
  onDone,
  onMiss,
  answered,
}: {
  spec: WidgetSpec;
  onDone(): void;
  onMiss(): void;
  answered?: boolean;
}) {
  const def = widgetDefs[spec.type];
  const View = widgetViews[spec.type];
  const params = useMemo(() => def?.parse(spec.params), [def, spec.params]);
  // 검사기가 모르는 부품을 막으므로 여기 오면 등록 누락이다. 렌더 스모크 테스트가 잡는다.
  if (!def || !View) throw new Error(`화면 부품 없음: ${spec.type}`);
  return <View params={params} onDone={onDone} onMiss={onMiss} answered={answered} />;
}
