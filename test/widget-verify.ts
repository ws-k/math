// 부품 검산 항목을 실제 sympy(verify.py)로 돌려 보는 테스트 도우미.
// "앱 모델이 낸 값 = sympy 가 계산한 값"을 테스트에서 바로 확인하려고 둔다.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WidgetCheck } from '../src/lesson/widgets/specs.ts';

export function runChecks(cs: WidgetCheck[]) {
  const items = cs.map(({ name, ...rest }) => ({ ref: `t/lesson:w:${name}`, unit: 't', ...rest }));
  const dir = mkdtempSync(join(tmpdir(), 'wverify-'));
  const f = join(dir, 'p.json');
  writeFileSync(f, JSON.stringify(items));
  const r = spawnSync('.venv/bin/python', ['verify/verify.py', f], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
}

/** 첫 답 항목의 answer 를 망가뜨린 사본(검산이 실제로 값을 보는지 확인용) */
export function tamper(cs: WidgetCheck[]): WidgetCheck[] {
  const i = cs.findIndex((c) => 'answer' in c || ('kind' in c && c.kind === 'approx'));
  if (i < 0) throw new Error('답 항목 없음');
  return cs.map((c, j) => {
    if (j !== i) return c;
    if ('kind' in c && c.kind === 'approx') return { ...c, value: `${Number(c.value) + 1}` };
    if (!('answer' in c)) return c;
    const a = c.answer;
    const bad = /^-?\d+$/.test(a) ? String(Number(a) + 1) : `${a}1`;
    return { ...c, answer: c.answerType === 'fraction' && bad.includes('/') ? '12345/7' : bad };
  });
}
