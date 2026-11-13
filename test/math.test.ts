import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderRich, splitMath } from '../src/lib/math.ts';

test('글과 수식을 나눈다', () => {
  assert.deepEqual(splitMath('값은 $x+1$ 입니다'), [
    { type: 'text', value: '값은 ' },
    { type: 'inline', value: 'x+1' },
    { type: 'text', value: ' 입니다' },
  ]);
});

test('$$ 는 가운데 정렬 수식', () => {
  assert.deepEqual(splitMath('a $$y=2$$ b'), [
    { type: 'text', value: 'a ' },
    { type: 'display', value: 'y=2' },
    { type: 'text', value: ' b' },
  ]);
});

test('\\$ 는 글자 그대로', () => {
  assert.deepEqual(splitMath('가격 \\$5'), [{ type: 'text', value: '가격 $5' }]);
});

test('닫히지 않은 $ 는 오류', () => {
  assert.throws(() => splitMath('값 $x+1'));
});

test('renderRich 는 글자를 이스케이프하고 줄바꿈을 살린다', () => {
  const html = renderRich('<b>\n$x$');
  assert.ok(html.startsWith('&lt;b&gt;<br>'));
  assert.ok(html.includes('katex'));
});
