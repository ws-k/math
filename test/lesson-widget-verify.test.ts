// 좌표평면·넓이 모형 부품이 만드는 검산 항목이 실제 sympy 검산을 통과하는지(모드마다 하나씩).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { areaModelDef } from '../src/lesson/widgets/areaModel.ts';
import { coordDef } from '../src/lesson/widgets/coord.ts';

function verify(items: object[]) {
  const dir = mkdtempSync(join(tmpdir(), 'wv-'));
  const f = join(dir, 'p.json');
  writeFileSync(f, JSON.stringify(items));
  return spawnSync('.venv/bin/python', ['verify/verify.py', f], { encoding: 'utf8' });
}

const grid = { x: { min: -2, max: 3, step: 1 }, y: { min: -3, max: 4, step: 1 } };

const COORDS = [
  {
    mode: 'explore',
    x: { min: 0, max: 1.6, step: '1/5' },
    y: { min: 0, max: 8, step: 1 },
    objects: [
      { id: 'fg', curve: 'x**5' },
      { id: 'P', point: { on: 'fg', x: 1 } },
      { id: 'Q', point: { on: 'fg', x: 1.5, drag: 'x', snap: '1/20' } },
      { secant: ['P', 'Q'] },
      { readout: 'slope(P,Q)', label: '기울기' },
    ],
    goal: { approach: ['Q', 'P'] },
  },
  {
    mode: 'explore',
    x: { min: 0.5, max: 4, step: '1/2' },
    y: { min: -2, max: 2, step: 1 },
    sliders: [{ id: 'a', min: 1, max: 3, step: '1/2', value: 2, label: '$a$' }],
    objects: [
      { id: 'f', curve: 'log(x)*a' },
      { id: 'P', point: { on: 'f', x: 1, drag: 'x' } },
      { tangent: { on: 'f', at: 'P' } },
    ],
  },
  {
    mode: 'line',
    ...grid,
    objects: [{ id: 'f', curve: '(x+1)*(x-1)' }],
    task: { line: { tangent: { curve: 'f', at: 1 } } },
  },
  {
    mode: 'line',
    ...grid,
    objects: [{ id: 'f', curve: 'x' }],
    task: {
      line: {
        slope: { value: '1/2', check: 'S(3)/(4+2)' },
        through: { x: { value: '2', check: '1+1' }, y: { value: '1', check: '3-2' } },
      },
    },
  },
  {
    mode: 'plot',
    ...grid,
    objects: [{ id: 'f', curve: 'x' }],
    task: { point: { x: { value: '2', check: 'sqrt(4)' }, y: { value: '-1', check: '1-2' } } },
  },
  {
    mode: 'connect',
    ...grid,
    objects: [{ id: 'f', curve: 'x**2-1' }],
    task: { pointsOn: { curve: 'f', count: 4 } },
  },
  {
    mode: 'sketch',
    ...grid,
    objects: [{ id: 'f', curve: 'x/2' }],
    task: { sketch: { curve: 'f', tol: '1/2' } },
  },
];

const AREAS = [
  { mode: 'split', w: ['10', '3'], h: ['10', '2'] },
  { mode: 'split', w: ['x', '2'], h: ['x', '3'] },
  {
    mode: 'grow',
    w: 'x**2',
    h: 'x**3',
    wLabel: 'f',
    hLabel: 'g',
    at: 1,
    max: '1/2',
    step: '1/20',
  },
  { mode: 'tiles', tiles: { x2: 1, x: 5, one: 6 }, factor: '(x+2)*(x+3)' },
];

const items = (def: typeof coordDef | typeof areaModelDef, raws: unknown[]) =>
  raws.flatMap((r, k) =>
    // biome-ignore lint/suspicious/noExplicitAny: 두 부품의 매개변수 타입이 달라 여기서만 풀어 둔다
    (def.checks as (p: any) => { name: string }[])(def.parse(r)).map(({ name, ...rest }) => ({
      ...rest,
      ref: `t/lesson:w${k}:${name}`,
      unit: 't',
    })),
  );

test('좌표평면·넓이 모형의 검산 항목이 sympy 검산을 통과한다', () => {
  const all = [...items(coordDef, COORDS), ...items(areaModelDef, AREAS)];
  assert.ok(all.length > 20);
  const r = verify(all);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('일부러 틀린 목표값은 실패한다', () => {
  const bad = structuredClone(COORDS[4]) as { task: { point: { x: { value: string } } } };
  // 앱이 쓰는 값(3)과 검산식(4/2=2)이 다르다 — 형식 검사는 통과하고 sympy 가 잡아야 한다
  bad.task.point.x.value = '3';
  const r = verify(items(coordDef, [bad]));
  assert.equal(r.status, 1, r.stdout);
  const wrongFactor = { mode: 'tiles', tiles: { x2: 1, x: 5, one: 6 }, factor: '(x+1)*(x+6)' };
  assert.equal(verify(items(areaModelDef, [wrongFactor])).status, 1);
});
