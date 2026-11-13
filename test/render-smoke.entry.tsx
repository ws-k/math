// 렌더 스모크 테스트의 묶음 입구. esbuild 가 이 파일을 묶어(.tsx·CSS·virtual:content 처리) Node 에서 돌린다.
import content from 'virtual:content';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProblemScreen } from '../src/app/Book.tsx';
import { Home, MapScreen, SettingsScreen, UnitHome, WrongNote } from '../src/app/Screens.tsx';
import { DEFAULT_SETTINGS } from '../src/app/settings.ts';
import type { Unit } from '../src/content/types.ts';
import { LessonPlayer } from '../src/lesson/LessonPlayer.tsx';

export const units = content.units as Unit[];

/** 레슨의 모든 장면을 한꺼번에 펼친 화면 HTML */
export function renderLesson(unit: Unit): string {
  if (!unit.lesson) throw new Error(`${unit.id}: 레슨 없음`);
  return renderToStaticMarkup(
    <LessonPlayer
      unit={unit}
      lesson={unit.lesson}
      tool={DEFAULT_SETTINGS.tool}
      background={DEFAULT_SETTINGS.background}
      initial={{ shown: unit.lesson.scenes.length, done: [] }}
    />,
  );
}

/** 앱 화면들(단원 홈·문제 화면·홈·지도·오답 노트·설정)을 단원마다 그려 본다 */
export function renderScreens(unit: Unit): string[] {
  const noop = () => {};
  const first = unit.problems[0];
  const out = [
    renderToStaticMarkup(<UnitHome unit={unit} cards={{}} lessons={{}} />),
    renderToStaticMarkup(<Home cards={{}} settings={DEFAULT_SETTINGS} last={null} lessons={{}} />),
    renderToStaticMarkup(<MapScreen cards={{}} lessons={{}} />),
    renderToStaticMarkup(<WrongNote cards={{}} />),
    renderToStaticMarkup(
      <SettingsScreen
        settings={DEFAULT_SETTINGS}
        persisted={false}
        onChange={noop}
        profiles={[{ id: 'first', name: '나' }]}
        current="first"
        onAdd={noop}
        onRename={noop}
        onRemove={noop}
        onSwitch={noop}
      />,
    ),
  ];
  for (const mode of ['spread', 'single'] as const)
    if (first)
      out.push(
        renderToStaticMarkup(
          <ProblemScreen
            unit={unit}
            route={{ name: 'unit', unitId: unit.id, pid: first.id, side: 'text' }}
            mode={mode}
            cards={{}}
            tool={DEFAULT_SETTINGS.tool}
            background={DEFAULT_SETTINGS.background}
            onTool={noop}
            onBackground={noop}
            onGrade={noop}
          />,
        ),
      );
  return out;
}
