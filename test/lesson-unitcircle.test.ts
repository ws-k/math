import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mark } from '../src/lesson/widgets/draw.ts';
import {
  exact,
  radText,
  type UCParams,
  ucDrag,
  ucDraw,
  ucGeom,
  ucKey,
  ucSnap,
  unitCircleDef,
} from '../src/lesson/widgets/unitCircle.ts';
import { runChecks, tamper } from './widget-verify.ts';

const parse = (raw: unknown) => unitCircleDef.parse(raw) as UCParams;
const SP = parse({ unit: 'deg', start: 30, snap: 'special', show: ['sin', 'cos', 'tan'] });
const RAD = parse({ unit: 'rad', start: 0, snap: 15, show: ['sin', 'cos'], unroll: true });

test('특수각 스냅·한 칸 이동(한 바퀴 돌면 0으로)', () => {
  assert.equal(ucSnap(SP, 28), 30);
  assert.equal(ucSnap(SP, 40), 45);
  assert.equal(ucSnap(SP, 359), 0);
  assert.equal(ucSnap(RAD, 22), 15);
  assert.equal(ucKey(SP, { deg: 30 }, 'ArrowRight')?.deg, 45);
  assert.equal(ucKey(SP, { deg: 330 }, 'ArrowRight')?.deg, 0);
  assert.equal(ucKey(SP, { deg: 0 }, 'ArrowLeft')?.deg, 330);
  assert.equal(ucKey(SP, { deg: 0 }, 'q'), null);
});

test('점 끌기: 놓은 곳의 각도를 재서 가장 가까운 각에 붙는다', () => {
  const g = ucGeom(SP);
  // 0° 점(cx+R, cy)을 (−R, −R) 만큼 끌면 (cx, cy−R) = 90°
  assert.equal(ucDrag(SP, { deg: 0 }, -g.R, -g.R).deg, 90);
  assert.equal(ucDrag(SP, { deg: 0 }, -2 * g.R, 0).deg, 180);
});

test('정확한 값(특수각)과 근삿값', () => {
  assert.deepEqual(exact(150), { sin: '1/2', cos: '-sqrt(3)/2', tan: '-sqrt(3)/3' });
  assert.deepEqual(exact(90), { sin: '1', cos: '0', tan: null });
  assert.equal(exact(10), null);
  assert.equal(radText(150), '5π/6');
  assert.equal(radText(180), 'π');
  assert.equal(radText(0), '0');
  const d = ucDraw(SP, { deg: 150 });
  assert.equal(d.texts.sin, 'sin θ = 1/2');
  assert.equal(d.texts.cos, 'cos θ = −√3/2');
  assert.equal(ucDraw(SP, { deg: 90 }).texts.tan, 'tan θ 는 정할 수 없어요');
  assert.equal(ucDraw(RAD, { deg: 15 }).texts.ang, 'θ = π/12 (15°)');
  assert.equal(ucDraw(parse({ ...RAD, snap: 10 }), { deg: 10 }).texts.sin, 'sin θ ≈ 0.174');
});

test('그릴 목록: 손잡이·sin 투영선이 각도를 따른다', () => {
  const g = ucGeom(SP);
  const d = ucDraw(SP, { deg: 90 });
  assert.equal(mark(d, 'h:P')?.a.transform, `translate(${g.cx} ${g.cy - g.R})`);
  assert.equal(mark(d, 'sinL')?.a.y2, g.cy - g.R);
});

test('검산 항목이 sympy 를 통과하고, 값을 망가뜨리면 실패한다', () => {
  const task = parse({
    unit: 'deg',
    start: 0,
    snap: 'special',
    show: ['sin'],
    task: { answer: 150, check: 'deg(pi - asin(Rational(1,2)))' },
  });
  for (const p of [SP, RAD, parse({ ...RAD, snap: 10 }), task]) {
    const r = runChecks(unitCircleDef.checks(p));
    assert.ok(r.ok, r.out);
  }
  assert.equal(runChecks(tamper(unitCircleDef.checks(SP))).ok, false);
});

test('parse: 모르는 칸, 360을 못 나누는 간격, 닿을 수 없는 과제 답은 오류', () => {
  assert.throws(() => parse({ unit: 'deg', start: 0, snap: 7, show: ['sin'] }), /360/);
  assert.throws(
    () => parse({ unit: 'deg', start: 0, snap: 'special', show: ['sin'], x: 1 }),
    /모르는 칸/,
  );
  assert.throws(
    () =>
      parse({
        unit: 'deg',
        start: 0,
        snap: 'special',
        show: ['sin'],
        task: { answer: 20, check: 'deg(asin(1))' },
      }),
    /닿을 수 없/,
  );
  assert.throws(
    () =>
      parse({
        unit: 'deg',
        start: 0,
        snap: 'special',
        show: ['sin'],
        task: { answer: 30, check: '30' },
      }),
    /그대로/,
  );
});
