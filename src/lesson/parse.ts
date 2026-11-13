// 형식 검사 도우미. 첫 오류에서 위치를 담아 예외를 던진다(장면·부품 하나 단위로 잡는다).
// zod 같은 라이브러리를 들이지 않으려고 필요한 만큼만 직접 짠다. 모르는 칸을 오류로 보는 것이 핵심 —
// 오타 난 칸 이름(예: feedbak)이 조용히 무시되면 검사를 통과한 채 화면에서 빠진다.

export type Obj = Record<string, unknown>;

export class ParseError extends Error {}

const fail = (at: string, msg: string): never => {
  throw new ParseError(`${at}: ${msg}`);
};

export function obj(v: unknown, at: string, req: string[], opt: string[] = []): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return fail(at, '객체가 아님');
  const o = v as Obj;
  for (const k of req) if (!(k in o)) fail(at, `${k} 칸 없음`);
  const known = new Set([...req, ...opt]);
  for (const k of Object.keys(o)) if (!known.has(k)) fail(at, `모르는 칸 ${k}`);
  return o;
}

/** 비어 있지 않은 글 */
export function str(v: unknown, at: string): string {
  if (typeof v !== 'string' || !v.trim()) return fail(at, '빈 글이거나 글이 아님');
  return v;
}

export function optStr(v: unknown, at: string): string | undefined {
  return v === undefined ? undefined : str(v, at);
}

export function int(v: unknown, at: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    return fail(at, `${min}~${max} 사이 정수가 아님 (${String(v)})`);
  return v;
}

export function arr(
  v: unknown,
  at: string,
  min: number,
  max = Number.POSITIVE_INFINITY,
): unknown[] {
  if (!Array.isArray(v)) return fail(at, '목록이 아님');
  if (v.length < min || v.length > max) fail(at, `${min}~${max}개여야 함 (${v.length}개)`);
  return v;
}

export function oneOf<T extends string>(v: unknown, at: string, options: readonly T[]): T {
  if (!options.includes(v as T))
    return fail(at, `${options.join('/')} 중 하나가 아님 (${String(v)})`);
  return v as T;
}

/** 정수 또는 기약분수 꼴 "a/b" 문자열 */
export function rationalStr(v: unknown, at: string): string {
  if (typeof v !== 'string' || !/^-?\d+(\/[1-9]\d*)?$/.test(v))
    return fail(at, `정수나 "a/b" 꼴이 아님 (${String(v)})`);
  return v;
}

export { fail };
