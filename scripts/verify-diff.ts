// 검산 기준선 비교: 기준 커밋과 지금 작업 트리의 검산 항목·장면 id 를 견준다.
// 사용법: node scripts/verify-diff.ts [기준 커밋, 기본 HEAD]
// 동작을 바꾸는 작업은 "차이 0"이 아니라 "달라진 항목이 목록으로 나오고 하나하나 설명됨"이 합격 기준이라
// (docs/plan-widgets-v2.md P6) 그 목록을 뽑는다. 장면 id 는 학습자의 진행 기록 열쇠라 사라지면 실패로 끝낸다.
// 기준 커밋의 파일은 git archive 로 임시 폴더에 풀어 그 자리에서 형식 검사(dump-problems)를 돌린다 —
// 지금 작업 트리를 건드리지 않으려고.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type Item = { ref: string };

/** ref 로 맞춰 사라진 것·새로 생긴 것·내용이 바뀐 것 */
export function diffItems(base: Item[], now: Item[]) {
  const a = new Map(base.map((x) => [x.ref, JSON.stringify(x)]));
  const b = new Map(now.map((x) => [x.ref, JSON.stringify(x)]));
  return {
    gone: [...a.keys()].filter((k) => !b.has(k)),
    added: [...b.keys()].filter((k) => !a.has(k)),
    changed: [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k)),
  };
}

/** 사라진 장면 id(진행 기록이 끊김)와 새 장면 id */
export function diffScenes(base: string[], now: string[]) {
  const a = new Set(base);
  const b = new Set(now);
  return { removed: base.filter((x) => !b.has(x)), added: now.filter((x) => !a.has(x)) };
}

/** 폴더 안 단원들의 "<단원>/<장면>" 목록 */
function sceneIds(root: string): string[] {
  const dir = join(root, 'content/units');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const u = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return (u.lesson?.scenes ?? []).map((s: { id: string }) => `${u.id}/${s.id}`);
    });
}

/** root 에서 형식 검사를 돌려 검산 항목을 읽는다 */
function dump(root: string): Item[] {
  execFileSync(process.execPath, ['scripts/dump-problems.ts'], { cwd: root, stdio: 'ignore' });
  return JSON.parse(readFileSync(join(root, '.cache/problems.json'), 'utf8'));
}

/** 묶어서 보이기: "<단원> <장면>" → 개수 */
const group = (refs: string[]) => {
  const m = new Map<string, number>();
  for (const r of refs) {
    const [unit, rest = ''] = r.split('/lesson:');
    const k = rest ? `${unit} ${rest.split(':')[0]}` : (unit ?? r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([k, n]) => `${k} ×${n}`);
};

if (import.meta.main) {
  const here = resolve(import.meta.dirname, '..');
  const ref = process.argv[2] ?? 'HEAD';
  const tmp = mkdtempSync(join(tmpdir(), 'verify-base-'));
  try {
    const tar = execFileSync('git', ['archive', ref], { cwd: here, maxBuffer: 1 << 30 });
    execFileSync('tar', ['-x', '-C', tmp], { input: tar });
    if (existsSync(join(here, 'node_modules')))
      symlinkSync(join(here, 'node_modules'), join(tmp, 'node_modules'));
    const items = diffItems(dump(tmp), dump(here));
    const scenes = diffScenes(sceneIds(tmp), sceneIds(here));
    const show = (title: string, refs: string[]) => {
      console.log(`${title} ${refs.length}건`);
      for (const g of group(refs)) console.log(`  - ${g}`);
      for (const r of refs.slice(0, 200)) console.log(`      ${r}`);
    };
    console.log(`기준 ${ref} 와 지금 작업 트리 비교`);
    show('사라진 검산 항목', items.gone);
    show('새로 생긴 검산 항목', items.added);
    show('내용이 바뀐 검산 항목', items.changed);
    console.log(`장면 id: 사라짐 ${scenes.removed.length}건, 새로 ${scenes.added.length}건`);
    for (const s of scenes.removed) console.log(`  - 사라짐 ${s}`);
    if (scenes.removed.length) {
      console.error('장면 id 가 사라졌습니다 — 학습자의 진행 기록이 끊깁니다');
      process.exitCode = 1;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
