// 부품 등록부(화면 쪽). 검사 쪽 등록부(specs.ts)의 parse 로 매개변수에 타입을 붙여 화면 부품에 넘긴다 —
// 검사기가 통과시킨 바로 그 해석을 화면도 쓰게 하려고.
import { type ComponentType, createContext, useMemo } from 'react';
import type { WidgetSpec } from '../types.ts';
import { widgetDefs } from './specs.ts';

export interface WidgetProps<P = unknown> {
  params: P;
  /** 부품 목표를 이뤘을 때(gate 장면이 열린다) */
  onDone(): void;
}

// biome-ignore lint/suspicious/noExplicitAny: 부품마다 매개변수 타입이 달라 등록부는 any 로 모은다.
export const widgetViews: Record<string, ComponentType<WidgetProps<any>>> = {};

/**
 * 끄는 중인지 레슨 화면에 알리는 통로. 끄는 동안 하단 '계속하기'를 막는다 —
 * 손가락이 화면 아래로 미끄러져 버튼 위에서 떨어지면 장면이 넘어가 버리기 때문이다.
 * 끌기 시작·끝에 한 번씩만 부른다(매 프레임 부르면 레슨 전체가 다시 그려진다).
 */
export const DragGuard = createContext<(dragging: boolean) => void>(() => {});

export function Widget({ spec, onDone }: { spec: WidgetSpec; onDone(): void }) {
  const def = widgetDefs[spec.type];
  const View = widgetViews[spec.type];
  const params = useMemo(() => def?.parse(spec.params), [def, spec.params]);
  // 검사기가 모르는 부품을 막으므로 여기 오면 등록 누락이다. 렌더 스모크 테스트가 잡는다.
  if (!def || !View) throw new Error(`화면 부품 없음: ${spec.type}`);
  return <View params={params} onDone={onDone} />;
}
