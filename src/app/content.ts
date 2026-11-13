// 빌드 때 묶인 콘텐츠(커리큘럼 + 단원 JSON)를 화면에서 찾기 쉽게 정리한다.
import content from 'virtual:content';
import type { Curriculum, Unit } from '../content/types.ts';

// 형식 검사는 빌드 전 검산 단계(scripts/content-check.ts)가 맡는다.
export const curriculum = content.curriculum as Curriculum;
export const units = content.units as Unit[];
export const unitById = new Map(units.map((u) => [u.id, u]));
export const curriculumTitle = new Map(curriculum.units.map((u) => [u.id, u.title]));
