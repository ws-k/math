// 세로셈 가족의 진행·화면 도우미(리뷰 반영): 몫 첫 자리 0 의 내려쓰기 건너뛰기, 끌기 판정 값, 키보드 초점 대상,
// 화면 글의 조사, 가장 짧은 순환, 클래스 이름 접두어.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  type ColumnParams,
  columnDef,
  L_ROW,
  type LongParams,
  ladderText,
  longDragQ,
  longFocus,
  longNext,
  longPlan,
  longResult,
  longText,
  longView,
  type SynthParams,
  synthFocus,
  synthInit,
  synthPlace,
  synthSum,
} from '../src/lesson/widgets/column.ts';
import { runChecks } from './widget-verify.ts';

const parse = (raw: unknown) => columnDef.parse(raw) as ColumnParams;
const long = (raw: object) => parse({ mode: 'long', ...raw }) as LongParams;

// ---- M2: 몫 첫 자리가 0 이면 내려쓰기를 건너뛴다 ----

test('1 ÷ 20: 첫 자리 10 에서 몫 0 을 정하면 다음 0 은 저절로 내려와 바로 100 을 나눈다', () => {
  const pl = longPlan(long({ dividend: 1, divisor: 20, decimal: true }));
  assert.deepEqual(longNext(pl, { k: 0, phase: 'q' }), { k: 1, phase: 'q' });
  const v = longView(pl, { k: 1, phase: 'q' });
  // 내려온 0(셋째 칸)이 맨 위 줄에 진하게, 지금 나누는 수 100 세 칸을 칠한다
  const cur = v.cells.filter((c) => c.cls.includes('cur'));
  assert.deepEqual(
    cur.map((c) => [c.x, c.y, c.text]),
    [
      [58, L_ROW(0), '1'],
      [86, L_ROW(0), '0'],
      [106, L_ROW(0), '0'],
    ],
  );
  const m = longText.judge(pl, 0, 0);
  assert.equal(m.cls, '');
  assert.match(m.text, /몫 0/);
  assert.match(m.text, /100/);
  assert.doesNotMatch(m.text, /점선 칸/);
});

test('중간 자리 몫 0(1203 ÷ 12)은 그대로 내려 쓴다 — 건너뛰는 것은 첫 자리뿐', () => {
  const pl = longPlan(long({ dividend: 1203, divisor: 12 }));
  assert.deepEqual(longNext(pl, { k: 1, phase: 'q' }), { k: 2, phase: 'bring' });
});

// ---- M3: 손을 뗀 그 끌기의 dy 로 토막 수 ----

test('토막 수 = 시작 + 위로 끈 거리 ÷ 토막 높이(반올림), 0~9', () => {
  assert.equal(longDragQ(0, -2.4 * 20, 20), 2);
  assert.equal(longDragQ(0, -2.6 * 20, 20), 3);
  assert.equal(longDragQ(3, 30, 20), 2); // 아래로 1.5 토막 → 반올림 2 개 덜기
  assert.equal(longDragQ(0, 100, 20), 0);
  assert.equal(longDragQ(5, -1000, 20), 9);
});

// ---- M4: 키보드로 한 뒤 초점이 갈 곳 ----

test('초점 대상: 몫 정하기 → 손잡이, 내리기 → 내릴 수, 끝 → 처음부터 다시', () => {
  assert.equal(longFocus({ k: 0, phase: 'q' }), 'handle');
  assert.equal(longFocus({ k: 1, phase: 'bring' }), 'bring');
  assert.equal(longFocus({ k: 2, phase: 'done' }), 'reset');
  const p = parse({ mode: 'synth', coeffs: [1, 0, -2, 1], root: 2 }) as SynthParams;
  let s = synthInit(p);
  assert.equal(synthFocus(p, s), 'act');
  s = synthPlace(p, s, 'bot', 0).s;
  for (const j of [1, 2, 3]) s = synthSum(p, synthPlace(p, s, 'mid', j).s);
  assert.equal(synthFocus(p, s), 'reset');
});

// ---- M5: 화면 글의 조사는 수에 맞춰 ----

test('내릴 수 안내·막대 읽기·사다리 칸 이름의 조사', () => {
  assert.equal(longText.tapBring('0'), '0 을 누른 채 아래 점선 칸까지 끌어 보세요.');
  assert.equal(longText.tapBring('2'), '2 를 누른 채 아래 점선 칸까지 끌어 보세요.');
  assert.equal(longText.tapBringOn('5'), '5 를 한 번 누르면 내려가요.');
  assert.equal(longText.slider(2, 11), '토막 2개, 11 곱하기 2 는 22');
  assert.equal(longText.slider(3, 11), '토막 3개, 11 곱하기 3 은 33');
  assert.equal(longText.bringLive(2, 8, '0'), '몫 2, 남은 수 8. 다음 0 을 내리세요.');
  assert.equal(longText.bringLive(1, 9, '2'), '몫 1, 남은 수 9. 다음 2 를 내리세요.');
  assert.equal(ladderText.target(12, 18), '12 와 18 을 함께 나눌 수 칸');
  assert.equal(ladderText.target(6, 9), '6 과 9 를 함께 나눌 수 칸');
});

test('형식 오류 글의 조사', () => {
  assert.throws(() => parse({ mode: 'ladder', numbers: [8, 9] }), /8 과 9 는 서로소/);
  assert.throws(
    () => parse({ mode: 'ladder', numbers: [12, 18], cards: [2, 9] }),
    /9 는 소수가 아님/,
  );
  assert.throws(
    () => parse({ mode: 'synth', coeffs: [9, 9, 9, 9, 9], root: 9 }),
    /칸에 \d+ (이|가) 안 들어감/,
  );
});

// ---- 가장 짧은 순환 ----

test('1 ÷ 3: 한 자리 순환 0.3̇ — 첫 단계 뒤 남은 수 1 이 바로 돌아온다', () => {
  const p = long({ dividend: 1, divisor: 3, decimal: true });
  const pl = longPlan(p);
  assert.deepEqual(
    pl.steps.map(({ n, q, r }) => [n, q, r]),
    [[10, 3, 1]],
  );
  assert.equal(pl.end, 'repeat');
  assert.equal(pl.repFrom, 0);
  assert.equal(pl.digits, '100');
  assert.deepEqual(longResult(pl), { int: '0', non: '', rep: '3' });
  assert.deepEqual(longNext(pl, { k: 0, phase: 'q' }), { k: 1, phase: 'bring' });
  assert.deepEqual(longNext(pl, { k: 1, phase: 'bring' }), { k: 1, phase: 'done' });
  const v = runChecks(columnDef.checks(p));
  assert.ok(v.ok, v.out);
});

// ---- 클래스 이름: 부품 것은 모두 cl- 로(전역 .lesson .done 같은 이름과 부딪치지 않게) ----

/** 이 부품 CSS·화면이 써도 되는 남의 클래스(레슨 공용: 부품 틀·안내 칸·단추) */
const SHARED = new Set(['lesson', 'wgt', 'toast', 'ok', 'bad', 'lbtn', 'quiet']);

test('column.css 의 클래스 선택자는 cl- 로 시작하거나 레슨 공용 이름뿐', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/lesson/widgets/column.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{[^{}]*\}/g, '{}');
  const bad = [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)]
    .map((m) => m[1] as string)
    .filter((c) => c !== 'cl' && !c.startsWith('cl-') && !SHARED.has(c));
  assert.deepEqual([...new Set(bad)], []);
});

test('Column.tsx 의 className 글자에 접두어 없는 짧은 이름이 없다', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/lesson/widgets/Column.tsx'), 'utf8');
  // className= 뒤 값 하나를 통째로(중괄호 균형으로) 떼어 내고, 그 안의 따옴표 글자와 템플릿의 고정 글자에서 이름을 모은다
  const names: string[] = [];
  for (const m of src.matchAll(/className=/g)) {
    let i = (m.index as number) + m[0].length;
    let expr = '';
    if (src[i] === '"') expr = src.slice(i, src.indexOf('"', i + 1) + 1);
    else {
      let depth = 0;
      do {
        if (src[i] === '{') depth++;
        if (src[i] === '}') depth--;
        expr += src[i];
        i++;
      } while (depth > 0 && i < src.length);
    }
    for (const q of expr.matchAll(/'([^']*)'|"([^"]*)"|`([^`$]*)/g))
      names.push(
        ...(q[1] ?? q[2] ?? q[3] ?? '').split(/\s+/).filter((x) => /^[a-z][\w-]*$/i.test(x)),
      );
  }
  // 긴 나눗셈 칸의 모델 클래스(faint·q 등)는 화면에서 cl- 를 붙여 쓴다
  assert.match(src, /c\.cls\.map\(\(x\) => `cl-\$\{x\}`\)/);
  // 한 글자는 클래스가 아니라 fresh(`m${j}`) 같은 칸 열쇠다
  const bad = names.filter(
    (c) => c.length > 1 && c !== 'cl' && !c.startsWith('cl-') && !SHARED.has(c),
  );
  assert.deepEqual([...new Set(bad)], []);
});
