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

test('강조 옵션: **굵게** 와 ==강조== 를 태그로 바꾼다', () => {
  const html = renderRich('규칙은 **하나**, ==양쪽에 똑같이== $x$', false, { emph: true });
  assert.ok(html.includes('<b>하나</b>'));
  assert.ok(html.includes('<span class="hl">양쪽에 똑같이</span>'));
  assert.ok(html.includes('katex'));
});

test('강조 옵션이 없으면 기호를 글자 그대로 둔다', () => {
  assert.equal(renderRich('**a** ==b=='), '**a** ==b==');
});

test('강조 안의 글자도 이스케이프된다', () => {
  assert.equal(renderRich('**<i>**', false, { emph: true }), '<b>&lt;i&gt;</b>');
});

test('강조가 수식 경계를 넘거나 짝이 안 맞으면 strict 에서 거부', () => {
  assert.throws(() => renderRich('**$x$는**', true, { emph: true }));
  assert.throws(() => renderRich('==열고 안 닫음', true, { emph: true }));
  assert.throws(() => renderRich('**a** 그리고 **', true, { emph: true }));
  assert.doesNotThrow(() => renderRich('$x$ 는 **해**', true, { emph: true }));
});
