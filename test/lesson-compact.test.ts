import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { COMPACT_QUERY } from '../src/lesson/widgets/compact.ts';

// 부품이 JS 로 읽는 '좁고 낮은 화면' 판정이 CSS 의 같은 이름 규칙과 어긋나면, 버튼·표는 접은 모양인데 그림은
// 넓은 모양(또는 그 반대)이 되어 한 화면에 안 들어간다. 두 CSS 파일이 이 조건을 글자 그대로 쓰는지 본다.
test('접은 화면 판정: JS 조건 = lesson.css·widgets.css 의 @media 조건', () => {
  for (const f of ['src/lesson/lesson.css', 'src/lesson/widgets/widgets.css']) {
    const css = readFileSync(join(import.meta.dirname, '..', f), 'utf8');
    assert.ok(css.includes(`@media ${COMPACT_QUERY} {`), f);
  }
});
