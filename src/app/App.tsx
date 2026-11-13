// 앱 뼈대: 해시 주소에 따라 화면을 고르고, 진행 카드·설정을 들고 있다.
// 필기 내용은 여기서 들고 있지 않는다(쪽마다 InkPage 가 저장소와 직접 주고받는다).
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Background, Tool } from '../ink/types.ts';
import { type CardState, type Grade, gradeCard } from '../lib/srs.ts';
import { Book } from './Book.tsx';
import { unitById } from './content.ts';
import { type LayoutMode, layoutMode } from './layout.ts';
import { FIRST, normalizeProfiles } from './profile.ts';
import { parseRoute, type Route, routeHash } from './route.ts';
import { Home, MapScreen, SettingsScreen, WrongNote } from './Screens.tsx';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './settings.ts';
import { requestPersist, saver, setCurrentProfile, store } from './store.ts';
import type { Cards } from './today.ts';

type UnitRoute = Extract<Route, { name: 'unit' }>;

const CARD = 'card:';

function useRoute(): Route {
  const [r, setR] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setR(parseRoute(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

const readLayout = () => layoutMode(window.innerWidth, window.innerHeight);

function useLayout(): LayoutMode {
  const [m, setM] = useState(readLayout);
  useEffect(() => {
    // 판정 결과(펼침/한 쪽)가 바뀔 때만 다시 그린다 — 같은 값이면 React 가 렌더를 건너뛴다.
    const on = () => setM(readLayout());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

/** 저장 실패 경고 한 줄. 실패한 값은 saver 가 쥐고 다시 시도하므로, 성공하면 저절로 사라진다. */
function SaveWarning() {
  const failing = useSyncExternalStore(saver.subscribe, saver.failing);
  if (!failing) return null;
  return (
    <div className="save-warn" role="alert">
      저장하지 못했습니다 — 다시 시도하는 중입니다. 앱을 닫지 마세요.
    </div>
  );
}

export function App() {
  // 지금 프로필(기기 공통 키)을 먼저 읽고 화면을 그린다. 프로필이 바뀌면 key 가 바뀌어 화면 상태가
  // 통째로 새로 만들어진다(앞 사람의 카드·설정이 남지 않게).
  const [profile, setProfile] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([store.get<string>('profile'), store.get('profiles')])
      .catch(() => [undefined, undefined] as const)
      .then(([id, list]) => {
        // 목록에 없는 프로필(지워졌거나 깨진 값)이면 첫 프로필로
        const known = normalizeProfiles(list).some((x) => x.id === id);
        const p = known && typeof id === 'string' ? id : FIRST;
        setCurrentProfile(p);
        setProfile(p);
      });
  }, []);
  return (
    <>
      <SaveWarning />
      {profile === null ? <main className="screen paper" /> : <Screen key={profile} />}
    </>
  );
}

function Screen() {
  const route = useRoute();
  const mode = useLayout();
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<Cards>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [last, setLast] = useState<UnitRoute | null>(null);
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    void requestPersist().then(setPersisted);
    void Promise.all([
      store.entries<CardState>(CARD),
      store.get('settings'),
      store.get<UnitRoute>('last'),
    ])
      .then(([cs, s, l]) => {
        setCards(Object.fromEntries(cs.map(([k, v]) => [k.slice(CARD.length), v])));
        setSettings(normalizeSettings(s));
        if (l?.name === 'unit' && unitById.has(l.unitId)) setLast(l);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (route.name !== 'unit' || !unitById.has(route.unitId)) return;
    setLast(route);
    saver.save('last', route);
  }, [route]);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    saver.save('settings', s);
  }, []);
  const onTool = (tool: Tool) => saveSettings({ ...settings, tool });
  const onBackground = (background: Background) => saveSettings({ ...settings, background });
  // before = 그 문제 쪽에 들어올 때의 카드. 다시 채점하면 거기서 새로 계산해 덮어쓴다.
  const onGrade = (key: string, r: Grade, before: CardState | undefined) => {
    const c = gradeCard(before, r, Date.now());
    saver.save(CARD + key, c);
    setCards({ ...cards, [key]: c });
  };

  // 없는 단원 주소면 지도로. 렌더 중에 주소를 바꾸면 그리는 도중 다른 화면 렌더가 끼어드므로 효과에서.
  const missing = route.name === 'unit' && !unitById.has(route.unitId);
  useEffect(() => {
    if (missing) location.hash = routeHash({ name: 'map' });
  }, [missing]);

  if (!ready) return <main className="screen paper" />;

  switch (route.name) {
    case 'home':
      return <Home cards={cards} settings={settings} last={last} />;
    case 'map':
      return <MapScreen cards={cards} />;
    case 'wrong':
      return <WrongNote cards={cards} />;
    case 'settings':
      return <SettingsScreen settings={settings} persisted={persisted} onChange={saveSettings} />;
    case 'unit': {
      const unit = unitById.get(route.unitId);
      if (!unit) return null;
      return (
        <Book
          unit={unit}
          route={route}
          mode={mode}
          cards={cards}
          tool={settings.tool}
          background={settings.background}
          onTool={onTool}
          onBackground={onBackground}
          onGrade={onGrade}
        />
      );
    }
  }
}
