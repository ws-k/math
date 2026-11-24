// esbuild-shared.mjs 의 타입(테스트가 TS 에서 불러 쓴다).
import type { BuildOptions, Plugin } from 'esbuild';

export const root: string;
export const contentPlugin: Plugin;
export function options(o: { outdir: string; dev: boolean }): BuildOptions;
export function copyStatic(outdir: string): void;
export const BUILD_INPUTS: string[];
export function formatBuildId(hash: string, porcelain: string): string;
export function buildId(): string;
