// 부품 6종(수직선·분수·단위원·도형판·경우의 수·확률 실험)을 한 번씩 다 쓰는 시험용 레슨.
// 형식 검사·검산·렌더 스모크가 같은 레슨을 쓴다. 모드별로 고르게 넣었다.
import type { Lesson, Scene } from '../src/lesson/types.ts';
import { goodLesson } from './lesson-fixture.ts';

const explore = (id: string, type: string, params: Record<string, unknown>): Scene => ({
  kind: 'explore',
  id,
  title: `${type} 해 보기`,
  widget: { type, params },
});

export const WIDGET_SCENES: Scene[] = [
  explore('nl-point', 'numberLine', {
    min: -2,
    max: 4,
    step: '1/2',
    points: [{ id: 'P', at: '0', drag: true }],
    task: { type: 'point', point: 'P', answer: '3/2', check: 'Rational(1,2)+1' },
  }),
  explore('nl-iv', 'numberLine', {
    min: -5,
    max: 5,
    step: '1',
    task: { type: 'interval', ineq: '2*x+1<7', answer: { at: '3', dir: 'left', open: true } },
  }),
  explore('nl-data', 'numberLine', {
    min: 0,
    max: 10,
    step: '1',
    data: { values: ['2', '3', '3', '4', '10'], drag: true, show: ['mean', 'median'] },
  }),
  explore('nl-jump', 'numberLine', {
    min: -3,
    max: 8,
    step: '1',
    jumps: { start: '5', moves: ['-7', '3'] },
    region: { lo: { at: '1', open: false } },
  }),
  explore('fr-add', 'fraction', {
    shape: 'bar',
    mode: 'add',
    a: '1/2',
    b: '1/3',
    cut: { min: 2, max: 12 },
  }),
  explore('fr-sub', 'fraction', {
    shape: 'circle',
    mode: 'sub',
    a: '3/4',
    b: '1/6',
    cut: { min: 2, max: 12 },
  }),
  explore('fr-cmp', 'fraction', {
    shape: 'bar',
    mode: 'compare',
    a: '2/3',
    b: '3/5',
    cut: { min: 2, max: 15 },
  }),
  explore('fr-mul', 'fraction', { shape: 'bar', mode: 'mul', a: '2/3', b: '3/4' }),
  explore('fr-div', 'fraction', { shape: 'bar', mode: 'div', a: '3/2', b: '1/4' }),
  explore('uc', 'unitCircle', {
    unit: 'rad',
    start: 30,
    snap: 'special',
    show: ['sin', 'cos', 'tan'],
    unroll: true,
  }),
  explore('uc-task', 'unitCircle', {
    unit: 'deg',
    start: 0,
    snap: 15,
    show: ['sin'],
    task: { answer: 150, check: 'deg(pi - asin(Rational(1,2)))' },
  }),
  explore('sh-tri', 'shape', {
    grid: { w: 8, h: 6 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0, drag: true },
      { id: 'C', x: 0, y: 3, drag: true },
    ],
    polygons: [['A', 'B', 'C']],
    measures: [{ len: ['B', 'C'] }, { angle: ['B', 'A', 'C'] }, { area: 0 }],
  }),
  explore('sh-circle', 'shape', {
    grid: { w: 10, h: 8 },
    points: [
      { id: 'O', x: 5, y: 4 },
      { id: 'P', x: 0, y: 0 },
      { id: 'Q', x: 6, y: 3 },
      { id: 'M', x: 2, y: 1, drag: true, on: { seg: ['P', 'Q'] } },
      { id: 'R', deg: 90, drag: true, on: { circle: ['O', 3] } },
    ],
    circles: [{ c: 'O', r: 3 }],
    segments: [['P', 'Q']],
    measures: [{ len: ['O', 'R'] }, { len: ['P', 'M'] }],
  }),
  explore('sh-cut', 'shape', {
    grid: { w: 8, h: 4 },
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0 },
      { id: 'C', x: 6, y: 3 },
      { id: 'D', x: 2, y: 3 },
      { id: 'E', x: 2, y: 0 },
    ],
    polygons: [['A', 'B', 'C', 'D']],
    cut: {
      piece: ['A', 'E', 'D'],
      rest: ['E', 'B', 'C', 'D'],
      by: [4, 0],
      result: [
        [2, 0],
        [6, 0],
        [6, 3],
        [2, 3],
      ],
    },
    note: '왼쪽 세모 조각을 오른쪽 끝으로 옮겨 보세요.',
  }),
  explore('ct-list', 'count', { mode: 'list', items: ['A', 'B', 'C'], k: 2 }),
  explore('ct-pick', 'count', { mode: 'pick', items: ['사과', '배', '귤'], k: 2 }),
  explore('ct-rep', 'count', { mode: 'repeat', items: ['앞', '뒤'], k: 2 }),
  explore('ct-tree', 'count', { mode: 'tree', items: ['A', 'B', 'C'], k: 2 }),
  explore('ct-pascal', 'count', { mode: 'pascal', rows: 4 }),
  explore('ct-venn', 'count', {
    mode: 'venn',
    sets: { names: ['수학', '과학'], a: ['가', '나', '다', '라'], b: ['다', '라', '마'] },
  }),
  explore('sim-coin', 'simulate', { device: 'coin', n: 2, seed: 3 }),
  explore('sim-die', 'simulate', { device: 'die', n: 2, seed: 5, goal: 200 }),
  explore('sim-bag', 'simulate', {
    device: 'bag',
    bag: [
      { label: '빨강', count: 3 },
      { label: '파랑', count: 2 },
    ],
    seed: 9,
  }),
  explore('ft-72', 'factorTree', { n: 72 }),
];

/**
 * 부품 장면을 끼운 시험 레슨들. 레슨 하나는 장면 20개까지라 둘로 나눈다.
 * 직접 풀기 장면은 기존 시험 레슨 것을 그대로 쓴다(레슨마다 풀기 문제 2~3개 규칙).
 */
export function widgetLessons(): Lesson[] {
  const half = Math.ceil(WIDGET_SCENES.length / 2);
  return [WIDGET_SCENES.slice(0, half), WIDGET_SCENES.slice(half)].map((ws) => {
    const l = goodLesson();
    const solve = l.scenes.find((x) => x.kind === 'solve') as Scene;
    return { ...l, scenes: [...structuredClone(ws), solve] };
  });
}
