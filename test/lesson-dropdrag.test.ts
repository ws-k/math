// 끌어 놓기 공용 장치(dropDrag — count 의 칩·카드와 저울의 물건이 같이 쓴다). 화면 없이 가짜 요소로
// 끄는 동안의 표시·잠금과 놓을 때 넘기는 값을 본다. 놓은 자리의 판정(어느 칸인가)은 부품 모델이 맡는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type DropOpts, dropDrag } from '../src/lesson/widgets/dropDrag.ts';

function fakeEl() {
  const log: string[] = [];
  return {
    log,
    dataset: {} as Record<string, string>,
    style: { transform: '' },
    isConnected: true,
    getAnimations(o?: { subtree?: boolean }) {
      log.push(`anims ${o?.subtree ? 'subtree' : 'self'}`);
      return [{ cancel: () => log.push('cancel') }];
    },
  };
}
type Fake = ReturnType<typeof fakeEl>;

function setup(over: Partial<DropOpts> = {}, el: Fake | null = fakeEl()) {
  const drops: [unknown, number, number, string][] = [];
  const opts: DropOpts = {
    busy: { current: false },
    follow: (dx, dy) => `translate(${dx}px,${dy}px)`,
    onDrop: (e, dx, dy) => drops.push([e, dx, dy, (e as unknown as Fake).style.transform]),
    ...over,
  };
  const h = dropDrag(
    () => el as unknown as HTMLElement | null,
    () => opts,
  );
  return { h, opts, el, drops };
}

test('dropDrag: 다른 것을 끄는 중이거나 잠긴 것은 잡지 않는다(스크롤로 남게)', () => {
  const a = setup();
  assert.equal(a.h.pick?.(0, 0), true);
  a.opts.busy.current = true;
  assert.equal(a.h.pick?.(0, 0), false);
  const b = setup({ locked: true });
  assert.equal(b.h.pick?.(0, 0), false);
});

test('dropDrag: 잡으면 잠그고 하던 연출을 멈추고 들어 올린 표시, 끄는 동안 따라오고, 놓으면 놓인 자리 그대로 넘긴다', () => {
  const { h, opts, el, drops } = setup();
  const e = el as Fake;
  h.onStart?.(5, 5);
  assert.equal(opts.busy.current, true);
  assert.deepEqual(e.log, ['anims subtree', 'cancel']);
  assert.equal(e.dataset.lift, '');
  h.onMove(10, -4);
  assert.equal(e.style.transform, 'translate(10px,-4px)');
  h.onEnd(12, -3, false);
  assert.equal(opts.busy.current, false);
  assert.equal('lift' in e.dataset, false);
  // 받는 쪽이 놓인 자리를 재고 나서 transform 을 지운다 — 여기서 미리 지우지 않는다
  assert.deepEqual(drops, [[el, 12, -3, 'translate(10px,-4px)']]);
});

test('dropDrag: 취소(시스템이 빼앗음)나 화면에서 사라진 요소는 제자리로, 놓기를 부르지 않는다', () => {
  const a = setup();
  a.h.onStart?.(0, 0);
  a.h.onMove(30, 30);
  a.h.onEnd(30, 30, true);
  assert.equal((a.el as Fake).style.transform, '');
  assert.equal(a.opts.busy.current, false);
  assert.equal('lift' in (a.el as Fake).dataset, false);
  assert.deepEqual(a.drops, []);

  const b = setup();
  b.h.onStart?.(0, 0);
  b.h.onMove(30, 30);
  (b.el as Fake).isConnected = false;
  b.h.onEnd(30, 30, false);
  assert.equal((b.el as Fake).style.transform, '');
  assert.equal(b.opts.busy.current, false);
  assert.deepEqual(b.drops, []);
});

test('dropDrag: 들어 올림·내려놓음 표시를 부품이 바꿀 수 있다(저울은 든 칸까지 올린다)', () => {
  const log: string[] = [];
  const { h, el, drops } = setup({
    lift: () => log.push('lift'),
    land: () => log.push('land'),
  });
  h.onStart?.(0, 0);
  assert.deepEqual(log, ['lift']);
  assert.equal('lift' in (el as Fake).dataset, false);
  h.onEnd(20, 0, true);
  // 취소여도 표시는 지운다
  assert.deepEqual(log, ['lift', 'land']);
  assert.deepEqual(drops, []);
});

test('dropDrag: 놓을 때는 그때의 설정(마지막으로 그린 부품의 onDrop)을 쓴다', () => {
  const { h, opts, el } = setup();
  const got: string[] = [];
  h.onStart?.(0, 0);
  opts.onDrop = () => got.push('new');
  opts.follow = (dx) => `x${dx}`;
  h.onMove(3, 0);
  assert.equal((el as Fake).style.transform, 'x3');
  h.onEnd(9, 0, false);
  assert.deepEqual(got, ['new']);
});

test('dropDrag: 잡을 때 요소가 없었으면 잠그지 않고, 끝도 아무 일 없이 잠금만 푼다', () => {
  const { h, opts, drops } = setup({}, null);
  h.onStart?.(0, 0);
  assert.equal(opts.busy.current, false);
  h.onMove(10, 10);
  h.onEnd(10, 10, false);
  assert.equal(opts.busy.current, false);
  assert.deepEqual(drops, []);
});
