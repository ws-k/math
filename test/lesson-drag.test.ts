import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clamp, crossedSign, edgeSafe, keyStep, nearest, snap } from '../src/lesson/drag.ts';

test('snap: 가장 가까운 칸으로(간격 기준점 min)', () => {
  assert.equal(snap(0.26, 0.5), 0.5);
  assert.equal(snap(-0.74, 0.5), -0.5);
  assert.equal(snap(7, 3, 1), 7);
  assert.equal(snap(5.4, 3, 1), 4);
});

test('clamp: 범위 안으로', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('keyStep: 방향키 한 칸, 범위 밖으로 안 나감', () => {
  assert.equal(keyStep(2, 'ArrowRight', 1, 0, 3), 3);
  assert.equal(keyStep(3, 'ArrowUp', 1, 0, 3), 3);
  assert.equal(keyStep(2, 'ArrowLeft', 0.5, 0, 3), 1.5);
  assert.equal(keyStep(2, 'Home', 1, 0, 3), 0);
  assert.equal(keyStep(2, 'End', 1, 0, 3), 3);
  assert.equal(keyStep(2, 'a', 1, 0, 3), null);
});

test('crossedSign: 칩 가운데가 등호를 완전히 넘었을 때만', () => {
  const eq = { left: 100, right: 120 };
  assert.equal(crossedSign(130, eq, 'right'), true);
  assert.equal(crossedSign(115, eq, 'right'), false);
  assert.equal(crossedSign(90, eq, 'left'), true);
  assert.equal(crossedSign(105, eq, 'left'), false);
});

test('nearest: 겹친 손잡이는 가장 가까운 것, 반경 밖이면 없음', () => {
  const hs = [
    { id: 'P', x: 0, y: 0 },
    { id: 'Q', x: 10, y: 0 },
  ];
  assert.equal(nearest(hs, { x: 7, y: 1 }, 28)?.id, 'Q');
  assert.equal(nearest(hs, { x: 4, y: 0 }, 28)?.id, 'P');
  assert.equal(nearest(hs, { x: 100, y: 0 }, 28), null);
});

test('edgeSafe: 손잡이를 화면 가장자리에서 20px 이상 떨어뜨린다', () => {
  assert.equal(edgeSafe(5, 400), 20);
  assert.equal(edgeSafe(395, 400), 380);
  assert.equal(edgeSafe(200, 400), 200);
});

// 끌기 장치(useDrag 의 알맹이)를 가짜 요소에 붙여 본다. Node 의 EventTarget 으로 포인터 사건을 흉내 낸다.
class FakeEl extends EventTarget {
  captured = new Set<number>();
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
}
const ptr = (type: string, x: number, y: number) =>
  Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });

test('attachDrag: 끄는 도중 떼어 내면(부품이 사라짐) 취소로 끝내고 잠금을 푼다', async () => {
  const { attachDrag } = await import('../src/lesson/useDrag.ts');
  const el = new FakeEl();
  const log: string[] = [];
  const detach = attachDrag(
    el as unknown as HTMLElement,
    () => ({
      onMove() {},
      onEnd(dx, dy, cancelled) {
        log.push(`end ${dx},${dy} ${cancelled}`);
      },
    }),
    (on) => log.push(`guard ${on}`),
    () => 0,
    () => {},
  );
  el.dispatchEvent(ptr('pointerdown', 10, 10));
  el.dispatchEvent(ptr('pointermove', 30, 25));
  detach();
  assert.deepEqual(log, ['guard true', 'guard false', 'end 20,15 true']);
  // 떼어 낸 뒤의 사건은 무시
  el.dispatchEvent(ptr('pointerup', 40, 40));
  assert.equal(log.length, 3);
});

test('attachDrag: 끌지 않을 때 떼어 내면 아무것도 부르지 않는다', async () => {
  const { attachDrag } = await import('../src/lesson/useDrag.ts');
  const el = new FakeEl();
  const log: string[] = [];
  const detach = attachDrag(
    el as unknown as HTMLElement,
    () => ({ onMove() {}, onEnd: () => log.push('end') }),
    () => log.push('guard'),
    () => 0,
    () => {},
  );
  detach();
  assert.deepEqual(log, []);
});
