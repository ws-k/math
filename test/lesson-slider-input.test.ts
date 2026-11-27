// 슬라이더 줄 공용 장치(sliderInput.ts — 좌표평면·수직선이 같이 쓴다). 가짜 입력 요소로
// 끄는 동안 직접 적용(글자·낭독 글자), 손으로 놓음/키 놓음 구분, 부품 안 다른 끌기 중 거절(P9)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachSlider, SLIDER_ID, type SliderHandlers } from '../src/lesson/widgets/sliderInput.ts';

type L = Record<string, ((e: { preventDefault(): void }) => void)[]>;
function fakeTarget() {
  const ls: L = {};
  return {
    ls,
    addEventListener(t: string, f: (e: { preventDefault(): void }) => void) {
      ls[t] = [...(ls[t] ?? []), f];
    },
    removeEventListener(t: string, f: unknown) {
      ls[t] = (ls[t] ?? []).filter((x) => x !== f);
    },
    fire(t: string) {
      let prevented = false;
      for (const f of ls[t] ?? []) f({ preventDefault: () => (prevented = true) });
      return prevented;
    },
  };
}
function setup(h: Partial<SliderHandlers> = {}) {
  const el = { ...fakeTarget(), value: '0', attrs: {} as Record<string, string> };
  const input = Object.assign(el, {
    setAttribute(k: string, v: string) {
      el.attrs[k] = v;
    },
  });
  const out = { firstChild: null, textContent: '' };
  const win = fakeTarget();
  const log: string[] = [];
  const handlers: SliderHandlers = {
    input: (v) => {
      log.push(`input ${v}`);
      return `t = ${v}`;
    },
    change: (hand) => log.push(`change ${hand ? 'hand' : 'key'}`),
    ...h,
  };
  const off = attachSlider(
    input as unknown as HTMLInputElement,
    () => out as unknown as Element,
    () => handlers,
    win as unknown as Window,
  );
  return { input, out, win, log, off };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('슬라이더: 움직이는 동안 옆 숫자와 낭독 글자를 직접 고친다(렌더 없이)', () => {
  const s = setup();
  s.input.value = '3';
  s.input.fire('input');
  assert.deepEqual(s.log, ['input 3']);
  assert.equal(s.out.textContent, 't = 3');
  assert.equal(s.input.attrs['aria-valuetext'], 't = 3');
});

test('슬라이더: 손으로 끈 놓음(change)은 hand, 방향키·보조기기의 change 는 key', async () => {
  const s = setup();
  s.input.fire('pointerdown');
  s.win.fire('pointerup');
  s.input.fire('change'); // 놓을 때의 change 는 pointerup 바로 뒤에 온다
  await tick();
  s.input.fire('change');
  assert.deepEqual(s.log, ['change hand', 'change key']);
});

test('슬라이더: 부품 안에서 다른 것을 끄는 중이면(grab 이 false) 이 손짓은 받지 않고 값을 되돌린다(P9)', () => {
  const log: string[] = [];
  const s = setup({ grab: () => false, release: () => log.push('release') });
  s.input.value = '1';
  const prevented = s.input.fire('pointerdown');
  assert.equal(prevented, true);
  s.input.value = '4';
  s.input.fire('input');
  assert.equal(s.input.value, '1');
  s.input.fire('change');
  assert.deepEqual(s.log, []);
  s.win.fire('pointerup');
  assert.deepEqual(log, []); // 잡지 않았으니 놓기도 없다
});

test('슬라이더: 숫자가 아닌 값은 무시하고, 떼어 내면 듣기를 멈춘다', () => {
  const s = setup();
  s.input.value = '';
  s.input.value = 'abc';
  s.input.fire('input');
  assert.deepEqual(s.log, []);
  s.off();
  s.input.value = '2';
  s.input.fire('input');
  assert.deepEqual(s.log, []);
});

test('슬라이더 글자: 좌표평면·수직선이 같은 글자만(검산기가 기호로 둔 것 중 수식에 흔한 것)', () => {
  for (const c of 'abcdhkmnpqrst') assert.ok(SLIDER_ID.test(c), c);
  for (const c of ['x', 'y', 'e', 'i', 'tt', 'T']) assert.ok(!SLIDER_ID.test(c), c);
});
