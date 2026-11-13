// 레슨 풀이 노트의 필기 키. 예전에는 문제 번호(1부터)로, 지금은 문제 id 로 저장한다 —
// 문제 순서를 바꾸면 번호 키는 다른 문제의 필기를 보여 주기 때문이다.

export const lessonInkKey = (unitId: string, sceneId: string, itemId: string) =>
  `ink:${unitId}:lesson:${sceneId}:${itemId}`;

/** 예전 키(장면 안 문제 번호, 1부터) */
export const legacyInkKey = (unitId: string, sceneId: string, index: number) =>
  `ink:${unitId}:lesson:${sceneId}:${index + 1}`;

interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * 옛 키의 필기를 새 키로 한 번 옮긴다. 새 키에 이미 필기가 있으면 덮지 않는다(새로 쓴 것이 이긴다).
 * 새 키에 다 쓴 뒤에만 옛 키를 지운다 — 중간에 실패하면 옛 키가 남아 다음에 다시 옮긴다.
 */
export async function migrateInk(s: KV, from: string, to: string): Promise<void> {
  if ((await s.get(to)) !== undefined) return;
  const old = await s.get(from);
  if (old === undefined) return;
  await s.set(to, old);
  await s.del(from);
}
