// 앱 뼈대: 지금 프로필을 정하고(누가 공부하나요), 해시 주소에 따라 화면을 고른다.
// 필기 내용은 여기서 들고 있지 않는다(풀이 노트마다 InkPage 가 저장소와 직접 주고받는다).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Background, Tool } from '../ink/types.ts';
import { LessonBoundary, LessonPlayer } from '../lesson/LessonPlayer.tsx';
import { type CardState, type Grade, gradeCard } from '../lib/srs.ts';
import { ProblemScreen } from './Book.tsx';
import { unitById } from './content.ts';
import { type LayoutMode, layoutMode } from './layout.ts';
import {
  addProfile,
  createProfileSwitch,
  FIRST,
  normalizeProfiles,
  type Profile,
  type ProfileState,
  randomProfileId,
  removeProfile,
  renameProfile,
} from './profile.ts';
import { parseRoute, type Route, routeHash } from './route.ts';
import {
  Home,
  type LastRoute,
  type Lessons,
  MapScreen,
  ProfilePicker,
  SettingsScreen,
  Shell,
  UnitHome,
  WrongNote,
} from './Screens.tsx';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './settings.ts';
import { deleteProfileData, requestPersist, saver, setCurrentProfile, store } from './store.ts';
import type { Cards } from './today.ts';

const CARD = 'card:';
const LESSON = 'lesson:';

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
    // 판정 결과(나란히/탭)가 바뀔 때만 다시 그린다 — 같은 값이면 React 가 렌더를 건너뛴다.
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
      저장하지 못했어요. 다시 시도하는 중이니 앱을 닫지 마세요.
    </div>
  );
}

export function App() {
  // 지금 프로필(기기 공통 키)을 먼저 읽고 화면을 그린다. 프로필이 바뀌면 key 가 바뀌어 화면 상태가
  // 통째로 새로 만들어진다(앞 사람의 카드·설정이 남지 않게).
  const [ps, setPs] = useState<ProfileState | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [picking, setPicking] = useState(false);
  const sw = useMemo(
    () =>
      createProfileSwitch({
        setModule: setCurrentProfile,
        setState: (u) => setPs((s) => u(s ?? { profile: FIRST, leaving: null })),
        persist: (id) => saver.save('profile', id),
      }),
    [],
  );

  useEffect(() => {
    void Promise.all([store.get<string>('profile'), store.get('profiles')])
      .catch(() => [undefined, undefined] as const)
      .then(([id, list]) => {
        const all = normalizeProfiles(list);
        // 목록에 없는 프로필(지워졌거나 깨진 값)이면 첫 프로필로
        const p = all.some((x) => x.id === id) && typeof id === 'string' ? id : FIRST;
        setCurrentProfile(p);
        setProfiles(all);
        setPs({ profile: p, leaving: null });
        // 둘 이상이 쓰는 기기면 시작할 때마다 누가 공부하는지 묻는다
        if (all.length >= 2) setPicking(true);
      });
  }, []);

  // 전환 2단계: leaving 이 그려진 커밋에서 <Screen> 이 사라지며 정리(마지막 필기 저장)가 먼저 돌고,
  // 그 다음 이 effect 에서 모듈 변수와 React 상태를 함께 바꾼다(profile.ts createProfileSwitch).
  const leaving = ps?.leaving ?? null;
  useEffect(() => {
    if (leaving !== null) sw.commit(leaving);
  }, [leaving, sw]);

  const saveProfiles = useCallback((list: Profile[]) => {
    setProfiles(list);
    saver.save('profiles', list);
  }, []);

  const pick = (id: string) => {
    setPicking(false);
    sw.request(id);
  };

  let body: React.ReactNode;
  if (ps === null || ps.leaving !== null) body = <main className="app" />;
  else if (picking)
    body = (
      <ProfilePicker
        profiles={profiles}
        current={ps.profile}
        onPick={pick}
        onCancel={() => setPicking(false)}
      />
    );
  else {
    const current = ps.profile;
    body = (
      <Screen
        key={current}
        who={profiles.find((x) => x.id === current)?.name ?? '나'}
        onWho={() => setPicking(true)}
        profiles={profiles}
        current={current}
        onAdd={(name) => saveProfiles(addProfile(profiles, name, randomProfileId))}
        onRename={(id, name) => saveProfiles(renameProfile(profiles, id, name))}
        onRemove={(id) => {
          saveProfiles(removeProfile(profiles, id));
          void deleteProfileData(id).catch(() => undefined);
        }}
        onSwitch={(id) => sw.request(id)}
      />
    );
  }
  return (
    <>
      <SaveWarning />
      {body}
    </>
  );
}

function Screen(p: {
  who: string;
  onWho(): void;
  profiles: Profile[];
  current: string;
  onAdd(name: string): void;
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onSwitch(id: string): void;
}) {
  const route = useRoute();
  const mode = useLayout();
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<Cards>({});
  const [lessons, setLessons] = useState<Lessons>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [last, setLast] = useState<LastRoute | null>(null);
  const [persisted, setPersisted] = useState(false);

  // 레슨 진행은 레슨 화면이 직접 저장하므로, 홈·지도로 돌아올 때마다 다시 읽는다
  const lessonView = route.name !== 'lesson';
  useEffect(() => {
    if (!lessonView) return;
    void store
      .entries(LESSON)
      .then((ls) => setLessons(Object.fromEntries(ls.map(([k, v]) => [k.slice(LESSON.length), v]))))
      .catch(() => undefined);
  }, [lessonView]);

  useEffect(() => {
    void requestPersist().then(setPersisted);
    void Promise.all([
      store.entries<CardState>(CARD),
      store.get('settings'),
      store.get<LastRoute>('last'),
    ])
      .then(([cs, s, l]) => {
        setCards(Object.fromEntries(cs.map(([k, v]) => [k.slice(CARD.length), v])));
        setSettings(normalizeSettings(s));
        if ((l?.name === 'unit' || l?.name === 'lesson') && unitById.has(l.unitId)) setLast(l);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if ((route.name !== 'unit' && route.name !== 'lesson') || !unitById.has(route.unitId)) return;
    setLast(route);
    saver.save('last', route);
  }, [route]);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    saver.save('settings', s);
  }, []);
  const onTool = (tool: Tool) => saveSettings({ ...settings, tool });
  const onBackground = (background: Background) => saveSettings({ ...settings, background });
  // before = 그 문제에 들어올 때의 카드. 다시 채점하면 거기서 새로 계산해 덮어쓴다.
  const onGrade = (key: string, r: Grade, before: CardState | undefined) => {
    const c = gradeCard(before, r, Date.now());
    saver.save(CARD + key, c);
    setCards({ ...cards, [key]: c });
  };

  // 없는 단원 주소면 지도로. 렌더 중에 주소를 바꾸면 그리는 도중 다른 화면 렌더가 끼어드므로 효과에서.
  const missing =
    (route.name === 'unit' && !unitById.has(route.unitId)) ||
    (route.name === 'lesson' && !unitById.get(route.unitId)?.lesson);
  useEffect(() => {
    if (missing) location.hash = routeHash({ name: 'map' });
  }, [missing]);

  if (!ready) return <main className="app" />;

  const shell = (name: Route['name'], children: React.ReactNode) => (
    <Shell current={name} who={p.who} onWho={p.onWho}>
      {children}
    </Shell>
  );

  switch (route.name) {
    case 'home':
      return shell(
        'home',
        <Home cards={cards} settings={settings} last={last} lessons={lessons} />,
      );
    case 'map':
      return shell('map', <MapScreen cards={cards} lessons={lessons} />);
    case 'wrong':
      return shell('wrong', <WrongNote cards={cards} />);
    case 'settings':
      return shell(
        'settings',
        <SettingsScreen
          settings={settings}
          persisted={persisted}
          onChange={saveSettings}
          profiles={p.profiles}
          current={p.current}
          onAdd={p.onAdd}
          onRename={p.onRename}
          onRemove={p.onRemove}
          onSwitch={p.onSwitch}
        />,
      );
    case 'lesson': {
      const unit = unitById.get(route.unitId);
      if (!unit?.lesson) return null;
      return (
        <LessonBoundary key={unit.id} unitId={unit.id}>
          <LessonPlayer
            unit={unit}
            lesson={unit.lesson}
            tool={settings.tool}
            background={settings.background}
          />
        </LessonBoundary>
      );
    }
    case 'unit': {
      const unit = unitById.get(route.unitId);
      if (!unit) return null;
      if (route.pid === null)
        return shell('map', <UnitHome unit={unit} cards={cards} lessons={lessons} />);
      return (
        <ProblemScreen
          unit={unit}
          route={{ ...route, pid: route.pid }}
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
