// 렌더 스모크 테스트의 묶음 입구. esbuild 가 이 파일을 묶어(.tsx·CSS·virtual:content 처리) Node 에서 돌린다.
import content from 'virtual:content';
import { renderToStaticMarkup } from 'react-dom/server';
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
