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
  // 수직선 2-라 새 옵션(단원 적용은 3-아): 두 줄 · 범위 확대 · 소수 눈금 + 무리수 점 · 두 조각 구간 · 편차 막대 ·
  // 점 무게 · 진리집합 비교
  explore('nl-two', 'numberLine', {
    min: 0,
    max: 2,
    step: '1/3',
    label: '1',
    unit: 'L',
    second: { min: '0', max: '6', step: '1', unit: '컵' },
    points: [{ id: 'P', at: '0', drag: true }],
    task: { type: 'point', point: 'P', answer: '2/3', check: 'Rational(2)/3' },
  }),
  explore('nl-range', 'numberLine', {
    min: 0,
    max: 5000,
    step: '200',
    label: '1000',
    jumps: { start: '5000', moves: ['-1200', '-1200', '-1200'] },
  }),
  // 점프 두 벌(요청 13 — 공배수): 4씩 다 뛴 뒤 6씩, 둘이 처음 만나는 자리에 P
  explore('nl-jump2', 'numberLine', {
    min: 0,
    max: 24,
    step: '1',
    label: '4',
    points: [{ id: 'P', at: '1', drag: true }],
    jumps: { start: '0', moves: ['4', '4', '4'] },
    jumps2: { start: '0', moves: ['6', '6'] },
    task: { type: 'point', point: 'P', answer: '12', check: 'ilcm(4,6)' },
  }),
  explore('nl-irr', 'numberLine', {
    min: 0,
    max: 4,
    step: '1/5',
    label: '1',
    decimal: true,
    points: [
      { id: 'B', at: 'pi', label: 'π' },
      { id: 'P', at: '0', drag: true },
    ],
    task: { type: 'point', point: 'P', near: 'sqrt(2)' },
  }),
  explore('nl-out', 'numberLine', {
    min: -5,
    max: 5,
    step: '1',
    task: {
      type: 'interval',
      ineq: 'Abs(x-1)>2',
      answer: { lo: { at: '-1', open: true }, hi: { at: '3', open: true }, out: true },
    },
  }),
  explore('nl-dev', 'numberLine', {
    min: 0,
    max: 15,
    step: '1',
    label: '5',
    data: { values: ['1', '5', '7', '9', '13'], show: ['mean', 'dev', 'var', 'sd'], drag: true },
  }),
  explore('nl-weight', 'numberLine', {
    min: 0,
    max: 10,
    step: '1',
    data: {
      values: ['0', '3', '6'],
      weights: [3, 2, 1],
      show: ['mean', 'median'],
      drag: true,
    },
  }),
  explore('nl-sets', 'numberLine', {
    min: -2,
    max: 6,
    step: '1',
    sets: [
      {
        name: 'P',
        cond: 'Abs(x-2)<1',
        lo: { at: '1', open: true },
        hi: { at: '3', open: true },
      },
      { name: 'Q', cond: 'x>0', lo: { at: '0', open: true } },
    ],
    compare: true,
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
  // 좌표평면 2-나 새 옵션(단원 적용은 3-아): 따라오는 점·세로선(점선)·여러 글자·프라임 이름
  explore('co-follow', 'coord', {
    mode: 'explore',
    x: { min: -2, max: 2, step: '1/2' },
    y: { min: -4, max: 7, step: 1 },
    sliders: [{ id: 'c', min: -3, max: 3, step: 1, value: 0, label: '적분상수 $C$' }],
    objects: [
      { id: 'g', curve: 'x**2', tone: 'soft' },
      { id: 'F', curve: 'x**2+c' },
      { id: 'P', point: { on: 'F', x: -1, drag: 'x', snap: '1/2' }, name: 'P' },
      { id: 'R', point: { on: 'g', x: 'x(P)' }, name: 'R′' },
      { vline: 'x(P)', dash: true, tone: 'soft' },
      { tangent: { on: 'F', at: 'P' } },
      { tangent: { on: 'g', at: 'R' } },
      { readout: 'deriv(F,P)', label: 'P 의 기울기' },
      { readout: 'deriv(g,R)', label: 'R′ 의 기울기' },
    ],
  }),
  // 수선의 발(따라오는 점)·직각 표시·한글 이름 — 축척 같게
  explore('co-foot', 'coord', {
    mode: 'explore',
    equal: true,
    x: { min: -1, max: 6, step: 1 },
    y: { min: -1, max: 5, step: 1 },
    objects: [
      { id: 'O', point: { x: 0, y: 0 }, name: 'O' },
      { id: 'P', point: { x: 4, y: 3, drag: 'xy' }, name: '출발' },
      { id: 'H', point: { x: 'x(P)', y: 0 }, name: '발' },
      { segment: ['O', 'P'], tone: 'soft' },
      { segment: ['P', 'H'] },
      { segment: ['O', 'H'] },
      { right: ['P', 'H', 'O'] },
      { readout: 'x(H)', label: '발의 자리', digits: 0 },
    ],
  }),
  // 점근선 세로선(슬라이더를 따라감)과 꼭짓점처럼 슬라이더를 따라오는 점
  explore('co-asym', 'coord', {
    mode: 'explore',
    x: { min: -5, max: 5, step: 1 },
    y: { min: -4, max: 4, step: 1 },
    sliders: [{ id: 'a', min: -2, max: 2, step: 1, value: 1, label: '$a$' }],
    objects: [
      { id: 'f', curve: '1/(x-a)+1', label: '$y=\\frac{1}{x-a}+1$' },
      { vline: 'a', dash: true, tone: 'soft', label: '점근선 $x=a$' },
      { id: 'C', point: { x: 'a', y: 1 }, name: '중심' },
    ],
  }),
  // 좌표평면 3-가 새 옵션(단원 적용은 3-나): 가로 길 띠 + 걷는 사람(math2-area-distance trip 꼴 — 읽는 값 3개 + 목표)
  explore('co-walk', 'coord', {
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, unit: '시간' },
    y: { min: -4, max: 4, step: 2, name: '속도', unit: 'km/시', areaUnit: 'km' },
    objects: [
      { id: 'v', curve: '4-2*x', label: '속도 $v(t)=4-2t$' },
      { id: 'B', point: { on: 'v', x: 1, drag: 'x', snap: '1/4' }, name: 'B' },
      { id: 'F', fill: { top: 'v', x: [0, 'B'] }, sign: true },
      { readout: 'x(B)', label: '출발 뒤' },
      { readout: 'net(F)', label: '집 기준 위치' },
      { readout: 'abs(F)', label: '걸은 거리' },
    ],
    strip: {
      dir: 'x',
      min: 0,
      max: 4,
      step: '1/2',
      label: '1',
      at: 'net(F)',
      face: 'y(B)',
    },
    goal: {
      value: { of: 'net(F)', is: 0, places: 2 },
      hint: '출발 말고 위치가 0 인 때가 또 있어요.',
    },
    intro: '집 기준 위치가 0 인 때를 두 번 찾아 B 를 놓아 보세요.',
  }),
  // 세로 길 띠 + 리프트(math2-velocity move 꼴 — 시간 슬라이더를 따라오는 점의 높이, 방향 = 미분계수의 부호)
  explore('co-lift', 'coord', {
    mode: 'explore',
    x: { min: 0, max: 4, step: 1, unit: '분' },
    y: { min: -1, max: 5, step: 1, name: '높이', unit: 'm' },
    sliders: [{ id: 't', min: 0, max: 4, step: '1/4', value: 0, label: '시각 $t$' }],
    objects: [
      { id: 'X', curve: 'x**3-6*x**2+9*x', label: '높이 $h(t)$' },
      { id: 'P', point: { on: 'X', x: 't' }, name: 'P' },
      { readout: 'value(t)', label: '시각' },
      { readout: 'y(P)', label: '높이' },
    ],
    strip: { dir: 'y', min: -1, max: 5, step: '1', at: 'y(P)', face: 'deriv(X,P)' },
  }),
  // 계단 표시(요청 64 — math2-diff-coefficient secant 꼴): P~Q 의 가로·세로 변과 길이
  explore('co-stair', 'coord', {
    mode: 'explore',
    x: { min: 0, max: '7/2', step: '1/2', name: '시간', unit: '초' },
    y: { min: 0, max: 10, step: 1, name: '거리', unit: 'm' },
    objects: [
      { id: 'f', curve: 'x**2', label: '$s=t^2$' },
      { id: 'P', point: { on: 'f', x: 1 }, name: 'P' },
      { id: 'Q', point: { on: 'f', x: 3, drag: 'x', snap: '1/10' }, name: 'Q' },
      { secant: ['P', 'Q'] },
      { stair: ['P', 'Q'] },
      { readout: 'slope(P,Q)', label: 'P~Q 평균 빠르기' },
    ],
    goal: { approach: ['Q', 'P'] },
    intro: 'Q 를 끌어 P 에 겹쳐 보세요.',
  }),
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
