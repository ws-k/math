// 좌표평면 슬라이더 옆 숫자 글자. 예전엔 값(number)을 그대로 찍어 칸이 π/12·1/12 이면
// 0.785398163397448·0.0833333333333 이 보였다(접은 화면에서 줄 밖으로 넘침, 화면 점검 2026-11-19).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSliders, sliderStepPx, sliderText } from '../src/lesson/widgets/coord/slider.ts';

const one = (s: Record<string, unknown>) => {
  const [sl] = parseSliders([{ id: 'b', label: '$b$', ...s }]);
  if (!sl) throw new Error('슬라이더 없음');
  return sl;
};

test('슬라이더 글자: π 배수 칸이면 π 꼴(0·π·3π/4·−π/2)', () => {
  const sl = one({ min: 0, max: 'pi', step: 'pi/12', value: 'pi/4' });
  assert.equal(sliderText(sl, Math.PI / 4), 'π/4');
  assert.equal(sliderText(sl, 0), '0');
  assert.equal(sliderText(sl, Math.PI), 'π');
  assert.equal(sliderText(sl, (3 * Math.PI) / 4), '3π/4');
  assert.equal(sliderText(sl, (8 * Math.PI) / 12), '2π/3');
  const neg = one({ min: '-pi', max: 'pi', step: 'pi/6', value: 0 });
  assert.equal(sliderText(neg, -Math.PI / 2), '−π/2');
  assert.equal(sliderText(neg, -Math.PI), '−π');
});

test('슬라이더 글자: 끝나는 소수로 안 떨어지는 칸(1/12)이면 분수 — 한 슬라이더는 한 꼴(1/12 칸의 6/12 도 0.5 가 아닌 1/2), 정수는 정수', () => {
  const sl = one({ min: 0, max: 1, step: '1/12', value: 1 });
  assert.equal(sliderText(sl, 1 / 12), '1/12');
  assert.equal(sliderText(sl, 6 / 12), '1/2');
  assert.equal(sliderText(sl, 1), '1');
  assert.equal(sliderText(sl, 0), '0');
  const third = one({ min: '-1', max: 1, step: '1/3', value: 0 });
  assert.equal(sliderText(third, -2 / 3), '−2/3');
});

test('슬라이더 글자: 끝나는 소수로 떨어지는 칸(1/2·1/4·1/10)이면 소수(−1.5·−1.75·2.3), 빼기는 진짜 빼기 기호', () => {
  const half = one({ min: -2, max: 2, step: '1/2', value: 1 });
  assert.equal(sliderText(half, -1.5), '−1.5');
  assert.equal(sliderText(half, -2), '−2');
  const tenth = one({ min: 2, max: 3, step: '1/10', value: 2 });
  assert.equal(sliderText(tenth, 2.3), '2.3');
  const q = one({ min: -2, max: 2, step: '1/4', value: 0 });
  assert.equal(sliderText(q, -1.75), '−1.75');
  assert.equal(sliderText(q, 2), '2');
  const t = one({ min: 0, max: 1, step: 0.1, value: 0.5 });
  assert.equal(sliderText(t, 0.1 + 0.2), '0.3');
});

test('슬라이더 글자: π 꼴은 칸 번호에서 정확히 — 분모 제한 없음(π/30), 처음 값이 π/5 여도 섞인 분모로', () => {
  const fine = one({ min: '-2*pi', max: '2*pi', step: 'pi/30', value: 0 });
  assert.equal(sliderText(fine, -2 * Math.PI + 53 * (Math.PI / 30)), '−7π/30');
  // 부동소수로 더해 온 값(315.99…칸)이어도 칸 번호로 반올림해 정확히
  const far = one({ min: 0, max: '100*pi', step: 'pi/12', value: 0 });
  assert.equal(sliderText(far, 0.1 + 1199 * (Math.PI / 12)), '1199π/12');
  const off = one({ min: 'pi/5', max: 'pi/5+pi', step: 'pi/12', value: 'pi/5' });
  assert.equal(sliderText(off, Math.PI / 5 + Math.PI / 12), '17π/60');
});

test('슬라이더 글자: 소수 자릿수는 값의 분모(2·5 지수)대로 — 6자리에서 자르지 않는다', () => {
  const sl = one({ min: 0, max: '1/16', step: '1/128', value: 0 });
  assert.equal(sliderText(sl, 1 / 128), '0.0078125');
  assert.equal(sliderText(sl, 2 / 128), '0.015625');
});

test('형식 검사: 처음 끝(min)과 칸(step)의 꼴이 섞이면(유리수 칸에 π 시작, π 칸에 유리수 시작) 막는다', () => {
  assert.throws(() => one({ min: 1, max: 'pi', step: 'pi/12', value: 1 }), /같은 꼴/);
  assert.throws(() => one({ min: 'pi/4', max: 'pi/4+2', step: '1/2', value: 'pi/4' }), /같은 꼴/);
  assert.doesNotThrow(() => one({ min: 0, max: 'pi', step: 'pi/12', value: 0 }));
});

test('슬라이더 글자: 유리수도 π 배수도 아닌 칸은 칸 크기에 맞는 자릿수', () => {
  const sl = one({ min: 0, max: 'sqrt(2)', step: 'sqrt(2)/4', value: 0 });
  assert.equal(sliderText(sl, Math.SQRT2 / 4), '0.35');
});

test('슬라이더 한 칸 폭 어림은 화면에 적는 글자(π/12 꼴)로 잰다 — 원시 소수 폭으로 재면 줄이 짧게 잡힌다', () => {
  const pi = one({ min: 0, max: 'pi', step: 'pi/12', value: 'pi/4' });
  // 가장 긴 값 글자 '11π/12' 기준: 줄이 원시 소수(0.785…, 17자) 기준보다 훨씬 길다
  assert.ok(sliderStepPx(pi) > 15, String(sliderStepPx(pi)));
});

test('읽는 값 value(슬라이더)도 슬라이더 옆 숫자와 같은 꼴 — calc-trig-addition overlay 에서 0.79 와 π/4 가 엇갈렸다', async () => {
  const { readFileSync } = await import('node:fs');
  const { draw, initial, parseCoord } = await import('../src/lesson/widgets/coord.ts');
  const unit = JSON.parse(readFileSync('content/units/calc-trig-addition.json', 'utf8'));
  const sc = unit.lesson.scenes.find((s: { id: string }) => s.id === 'overlay');
  const p = parseCoord(sc.widget.params);
  const ro = draw(p, initial(p), { w: 340, h: 260 }).readouts;
  assert.equal(ro[0]?.text, 'π/4');
});
