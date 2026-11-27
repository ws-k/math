import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  centerOf,
  clamp,
  crossedSign,
  edgeSafe,
  FAILS_FOR_TAP,
  inBox,
  isTap,
  keyStep,
  MIN_CELL_PX,
  missHint,
  NARROW_CARD_W,
  nearest,
  snap,
  TAP_ON,
  TAP_PX,
  tapMode,
} from '../src/lesson/drag.ts';

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

test('끌어 놓기 판정: 8px 못 움직였으면 누르기, 두 번 놓치면 눌러서 하기(count·저울 같은 값)', () => {
  assert.equal(TAP_PX, 8);
  assert.equal(FAILS_FOR_TAP, 2);
  assert.equal(isTap(0, 0), true);
  assert.equal(isTap(5, 6), true); // 7.81
  assert.equal(isTap(8, 0), false); // 딱 8 은 끌기
  assert.equal(isTap(6, -6), false); // 8.49
});

test('놓침 세기(count·세로셈·저울·수직선 공용): 첫 번째는 끄는 법, 두 번째에 눌러서 하기 안내, 그 뒤는 조용히', () => {
  assert.equal(TAP_ON, '끌기가 어려우면 눌러도 돼요.');
  assert.equal(missHint(0), null);
  assert.equal(missHint(1), 'drag');
  assert.equal(missHint(FAILS_FOR_TAP), 'tap');
  assert.equal(missHint(3), null);
  assert.equal(tapMode(1), false);
  assert.equal(tapMode(FAILS_FOR_TAP), true);
  assert.equal(tapMode(5), true);
});

test('손가락 칸 폭 하한: 가장 좁은 화면(382) 카드 안쪽 폭 298px, 한 칸 7px(좌표평면 슬라이더와 같은 기준)', () => {
  assert.equal(NARROW_CARD_W, 298);
  assert.equal(MIN_CELL_PX, 7);
});

test('끌어 놓기 판정: 놓은 요소의 가운데, 여유를 둔 상자 안(경계 포함)', () => {
  assert.deepEqual(centerOf({ left: 10, top: 20, width: 40, height: 30 }), [30, 35]);
  const b = { left: 100, right: 200, top: 50, bottom: 80 };
  assert.equal(inBox(150, 60, b), true);
  assert.equal(inBox(99, 60, b), false);
  assert.equal(inBox(84, 60, b, 16), true);
  assert.equal(inBox(83.9, 60, b, 16), false);
  assert.equal(inBox(216, 96, b, 16), true);
  assert.equal(inBox(216, 96.1, b, 16), false);
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
