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

test('문장 속 수식과 빈칸 없이 붙은 글자(쉼표·조사·괄호)는 한 덩어리(mglue)로 묶는다 — 쉼표가 다음 줄 맨 앞으로 떨어지지 않게', () => {
  const html = renderRich('그래서 $i^4=1$, 끝($x$)이에요');
  const glued = html.match(/<span class="mglue">/g) ?? [];
  assert.equal(glued.length, 2);
  // 앞이 빈칸이면 글자를 묶지 않고 뒤에 붙은 쉼표만 묶는다
  assert.ok(html.startsWith('그래서 <span class="mglue"><span class="katex">'));
  assert.ok(/<\/span>,<\/span> /.test(html));
  // 괄호와 조사는 수식 앞뒤 모두 묶는다
  assert.ok(html.includes('<span class="mglue">끝(<span class="katex">'));
  assert.ok(html.endsWith(')이에요</span>'));
  // 빈칸으로 떨어진 수식·가운데 수식은 묶지 않는다
  assert.ok(!renderRich('$x$ 는').includes('mglue'));
  assert.ok(!renderRich('값$$x$$끝').includes('mglue'));
  // 강조 태그를 가르지 않는다(묶을 글자에 태그가 걸리면 묶지 않음)
  const em = renderRich('**값**$x$', false, { emph: true });
  assert.ok(em.includes('<b>값</b>'));
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
