// 자동 생성 파일 — 손으로 고치지 마세요. node scripts/gen-registry.ts 로 다시 만듭니다.
import type { Generator } from './types.ts';
import { generators as g_e_circle_area } from './e-circle-area.ts';
import { generators as g_e_cuboid } from './e-cuboid.ts';
import { generators as g_e_divisor_multiple } from './e-divisor-multiple.ts';
import { generators as g_e_fraction_addsub } from './e-fraction-addsub.ts';
import { generators as g_e_fraction_basics } from './e-fraction-basics.ts';
import { generators as g_e_polygon_area } from './e-polygon-area.ts';
import { generators as g_e_proportion } from './e-proportion.ts';
import { generators as g_e_ratio } from './e-ratio.ts';
import { generators as g_e_whole_ops } from './e-whole-ops.ts';
import { generators as g_m1_linear_eq } from './m1-linear-eq.ts';
import { generators as g_math2_diff_product_rule } from './math2-diff-product-rule.ts';

export const unitGenerators: Generator[] = [...g_e_circle_area, ...g_e_cuboid, ...g_e_divisor_multiple, ...g_e_fraction_addsub, ...g_e_fraction_basics, ...g_e_polygon_area, ...g_e_proportion, ...g_e_ratio, ...g_e_whole_ops, ...g_m1_linear_eq, ...g_math2_diff_product_rule];
