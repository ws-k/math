// 자동 생성 파일 — 손으로 고치지 마세요. node scripts/gen-registry.ts 로 다시 만듭니다.
import type { Generator } from './types.ts';
import { generators as g_e_circle_area } from './e-circle-area.ts';
import { generators as g_e_cuboid } from './e-cuboid.ts';
import { generators as g_e_fraction_addsub } from './e-fraction-addsub.ts';
import { generators as g_e_polygon_area } from './e-polygon-area.ts';
import { generators as g_e_proportion } from './e-proportion.ts';
import { generators as g_e_ratio } from './e-ratio.ts';
import { generators as g_m1_basic_geometry } from './m1-basic-geometry.ts';
import { generators as g_m1_coord_graph } from './m1-coord-graph.ts';
import { generators as g_m1_expressions } from './m1-expressions.ts';
import { generators as g_m1_linear_eq } from './m1-linear-eq.ts';
import { generators as g_math2_diff_product_rule } from './math2-diff-product-rule.ts';

export const unitGenerators: Generator[] = [...g_e_circle_area, ...g_e_cuboid, ...g_e_fraction_addsub, ...g_e_polygon_area, ...g_e_proportion, ...g_e_ratio, ...g_m1_basic_geometry, ...g_m1_coord_graph, ...g_m1_expressions, ...g_m1_linear_eq, ...g_math2_diff_product_rule];
