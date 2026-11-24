// 학습자 프로필. 한 기기를 아이와 어른이 같이 써서 진행·필기·설정을 사람별로 나눈다.
//
// 저장 키에 프로필 접두어(@<id>/)를 붙여 나눈다. 첫 프로필은 접두어 없이 기존 키를 그대로 쓴다 —
// 이미 쌓인 기록을 옮기는 작업(마이그레이션)이 없어 옮기다 잃을 위험도 없다.
// 화면 코드(InkPage 등)는 프로필을 모른다. 저장소와 saver 가 키를 바꿔 끼운다.

import { BACKUP_MARKER } from './backup.ts';
import { DEVICE_KEY } from './device.ts';

export const FIRST = 'first';

/**
 * 기기 공통 키: 프로필 목록·지금 프로필·기기 설정(펜 유무 등). 누가 쓰든 같은 값을 봐야 한다.
 * 앱 기록 사본의 표식도 여기 둔다 — 저장소 전체에 대한 표시라 사람별이 아니고, 첫 프로필의 키 목록에 섞이면 안 된다.
 */
const DEVICE_KEYS = new Set(['profiles', 'profile', DEVICE_KEY, BACKUP_MARKER]);

export function scopedKey(profile: string, key: string): string {
  if (profile === FIRST || DEVICE_KEYS.has(key)) return key;
  return `@${profile}/${key}`;
}

export interface RawStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /**
   * 접두어 범위들과 낱개 키들을 한 트랜잭션에서 지운다(프로필 삭제·기록 초기화).
   * 키마다 따로 지우다 중간에 실패하면 반쯤 지운 기록이 남고, 앱 사본도 이 한 길목으로 같은 범위를 지운다.
   */
  delPrefix(prefixes: string[], keys?: string[]): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  entries<T>(prefix: string): Promise<[string, T][]>;
}

/**
 * 지금 프로필의 키만 보이는 저장소. 돌려주는 키에서는 접두어를 뗀다.
 * 첫 프로필의 접두어는 빈 문자열이라 "모든 키" 조회에 다른 프로필(@…) 키가 섞이므로 걸러 낸다.
 * 범위 지우기는 내주지 않는다 — 첫 프로필의 접두어가 빈 문자열이라 다른 사람 기록까지 지울 수 있어서다.
 */
export function createScopedStore(
  raw: RawStore,
  current: () => string,
): Omit<RawStore, 'delPrefix'> {
  /** 이 프로필 것인가. 첫 프로필은 접두어가 없어 다른 프로필(@…) 키와 기기 공통 키를 걸러 낸다 */
  const mine = (pre: string, k: string) =>
    pre !== '' || (!k.startsWith('@') && !DEVICE_KEYS.has(k));
  const strip = (profile: string, keys: string[]) => {
    const pre = scopedKey(profile, '');
    return keys.filter((k) => mine(pre, k)).map((k) => (pre ? k.slice(pre.length) : k));
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
        .filter(([k]) => mine(pre, k))
        .map(([, v], i) => [keys[i] as string, v] as [string, T]);
    },
  };
}

/** App 이 들고 있는 프로필 상태. leaving 이면 화면(<Screen>)을 내리고 빈 자리표시만 그린다 */
export interface ProfileState {
  profile: string;
  leaving: string | null;
}

/**
 * 프로필 바꾸기. 저장소 모듈 변수(키 접두어)와 React 상태를 이 한 곳에서만 바꾼다 — 따로 바꾸면 그 사이에
 * 그려진 화면이 앞 사람 상태로 새 사람 키를 읽거나 쓴다.
 * 순서: request → App 이 <Screen> 을 내린다 → 같은 커밋에서 사라지는 화면의 정리(InkPage 의 마지막 저장)가
 * 먼저 돈다(옛 프로필 키로 고정) → App 의 effect 가 commit 을 불러 둘을 함께 바꾼다.
 * 저장이 끝나기를 기다리지 않는다: saver 가 save() 순간의 프로필로 키를 고정하므로 섞이지 않고,
 * 기다림을 두면 저장이 계속 실패할 때 전환이 영영 멈춘다.
 */
export function createProfileSwitch(d: {
  setModule(id: string): void;
  setState(u: (s: ProfileState) => ProfileState): void;
  persist(id: string): void;
  /**
   * 홈으로. 새 사람의 화면이 앞 사람이 보던 주소(단원·레슨)로 열리면, 그 주소가 새 사람의 '이어서 하기'(last)로
   * 저장돼 버린다. 화면을 바꾸기 전에 주소부터 홈으로 돌린다.
   */
  goHome(): void;
}) {
  return {
    request(id: string) {
      d.setState((s) => (s.profile === id && s.leaving === null ? s : { ...s, leaving: id }));
    },
    commit(id: string) {
      d.goHome();
      d.setModule(id);
      d.setState(() => ({ profile: id, leaving: null }));
      d.persist(id);
    },
  };
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

/** 이름 정리: 앞뒤 공백을 떼고 12자까지. 비면 null(저장하지 않는다) */
export function cleanName(raw: string): string | null {
  const n = raw.trim().slice(0, 12);
  return n ? n : null;
}

/** 새 프로필을 뒤에 붙인다. id 는 newId 로 만들되 이미 있으면 다시 만든다 */
export function addProfile(list: Profile[], name: string, newId: () => string): Profile[] {
  const n = cleanName(name);
  if (!n) return list;
  let id = newId();
  while (list.some((p) => p.id === id)) id = newId();
  return [...list, { id, name: n }];
}

export function renameProfile(list: Profile[], id: string, name: string): Profile[] {
  const n = cleanName(name);
  return n ? list.map((p) => (p.id === id ? { ...p, name: n } : p)) : list;
}

/** 첫 프로필은 지우지 않는다(접두어 없는 기존 기록이 그 사람 것이라) */
export function removeProfile(list: Profile[], id: string): Profile[] {
  return id === FIRST ? list : list.filter((p) => p.id !== id);
}

/** 영문 소문자·숫자 id(저장 키 접두어로 쓴다) */
export const randomProfileId = () => `p-${Math.random().toString(36).slice(2, 8)}`;
