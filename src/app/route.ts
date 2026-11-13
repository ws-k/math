// 해시 주소 ↔ 화면. GitHub Pages 하위 경로에서도 서버 설정 없이 동작하도록 해시를 쓴다.

/** 교재 쪽(문제·개념·예제) 또는 공책 쪽 */
export type Side = 'text' | 'note';

export type Route =
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'wrong' }
  | { name: 'settings' }
  | { name: 'unit'; unitId: string; pid: string | null; side: Side };

const SIMPLE = new Set(['map', 'wrong', 'settings']);

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path = '', query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const head = parts[0];
  if (!head) return { name: 'home' };
  if (parts.length === 1 && SIMPLE.has(head)) return { name: head as 'map' | 'wrong' | 'settings' };
  if (head === 'unit' && parts[1] && parts.length <= 3) {
    // 한 쪽씩 보는 화면에서 앞 문제로 넘기면 공책 쪽에 내려앉아야 해서 쪽도 주소에 담는다.
    const side: Side = new URLSearchParams(query).get('side') === 'note' ? 'note' : 'text';
    return { name: 'unit', unitId: parts[1], pid: parts[2] ?? null, side };
  }
  return { name: 'home' };
}

export function routeHash(r: Route): string {
  if (r.name === 'home') return '#/';
  if (r.name !== 'unit') return `#/${r.name}`;
  let h = `#/unit/${encodeURIComponent(r.unitId)}`;
  if (r.pid !== null) h += `/${encodeURIComponent(r.pid)}`;
  if (r.side === 'note') h += '?side=note';
  return h;
}
