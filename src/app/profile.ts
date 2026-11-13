// 학습자 프로필. 한 기기를 아이와 어른이 같이 써서 진행·필기·설정을 사람별로 나눈다.
//
// 저장 키에 프로필 접두어(@<id>/)를 붙여 나눈다. 첫 프로필은 접두어 없이 기존 키를 그대로 쓴다 —
// 이미 쌓인 기록을 옮기는 작업(마이그레이션)이 없어 옮기다 잃을 위험도 없다.
// 화면 코드(InkPage 등)는 프로필을 모른다. 저장소와 saver 가 키를 바꿔 끼운다.

export const FIRST = 'first';

/** 기기 공통 키: 프로필 목록과 지금 프로필. 누가 쓰든 같은 값을 봐야 한다 */
const DEVICE_KEYS = new Set(['profiles', 'profile']);

export function scopedKey(profile: string, key: string): string {
  if (profile === FIRST || DEVICE_KEYS.has(key)) return key;
  return `@${profile}/${key}`;
}

export interface RawStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  entries<T>(prefix: string): Promise<[string, T][]>;
}

/**
 * 지금 프로필의 키만 보이는 저장소. 돌려주는 키에서는 접두어를 뗀다.
 * 첫 프로필의 접두어는 빈 문자열이라 "모든 키" 조회에 다른 프로필(@…) 키가 섞이므로 걸러 낸다.
 */
export function createScopedStore(raw: RawStore, current: () => string): RawStore {
  const strip = (profile: string, keys: string[]) => {
    const pre = scopedKey(profile, '');
    return keys
      .filter((k) => pre !== '' || !k.startsWith('@'))
      .map((k) => (pre ? k.slice(pre.length) : k));
  };
  return {
    get: (k) => raw.get(scopedKey(current(), k)),
    set: (k, v) => raw.set(scopedKey(current(), k), v),
    del: (k) => raw.del(scopedKey(current(), k)),
    async keys(prefix = '') {
      const p = current();
      return strip(p, await raw.keys(scopedKey(p, prefix)));
    },
    async entries<T>(prefix: string) {
      const p = current();
      const list = await raw.entries<T>(scopedKey(p, prefix));
      const keys = strip(
        p,
        list.map(([k]) => k),
      );
      const pre = scopedKey(p, '');
      return list
        .filter(([k]) => pre !== '' || !k.startsWith('@'))
        .map(([, v], i) => [keys[i] as string, v] as [string, T]);
    },
  };
}

/**
 * 프로필 바꾸기. 순서가 중요하다: 먼저 홈으로 가서 열린 화면(필기 등)이 사라지며 마지막 값을 저장하게
 * 하고, 그 저장이 끝날 때까지 기다린 뒤에 바꾼다. 그 사이 저장도 save() 순간의 프로필로 고정돼 섞이지 않는다.
 * 바꾼 뒤 화면은 <Screen key={프로필}> 로 새로 만들어 앞 사람의 상태가 남지 않게 한다.
 */
export async function switchProfile(
  id: string,
  d: { goHome(): void; idle(): Promise<void>; setCurrent(id: string): void },
): Promise<void> {
  d.goHome();
  // 홈으로 바뀐 화면이 그려지고 사라진 화면의 정리(저장)가 돈 다음에 기다린다
  await new Promise((r) => setTimeout(r, 0));
  await d.idle();
  d.setCurrent(id);
}

export interface Profile {
  id: string;
  name: string;
}

const ID_OK = /^[a-z0-9-]{1,24}$/;

/** 저장된 프로필 목록을 믿을 수 있는 모양으로. 첫 프로필은 늘 맨 앞에 있다 */
export function normalizeProfiles(raw: unknown): Profile[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Profile[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    const o = p as Partial<Profile> | null;
    if (typeof o?.id !== 'string' || !ID_OK.test(o.id) || seen.has(o.id)) continue;
    if (typeof o.name !== 'string' || !o.name.trim()) continue;
    seen.add(o.id);
    out.push({ id: o.id, name: o.name });
  }
  if (!seen.has(FIRST)) out.unshift({ id: FIRST, name: '나' });
  else out.sort((a, b) => (a.id === FIRST ? -1 : b.id === FIRST ? 1 : 0));
  return out;
}
