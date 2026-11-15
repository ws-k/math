// 부품 모델이 쓰는 정확한 분수 계산. 수직선 칸·분수 조각·확률처럼 화면에 보이는 값은 부동소수 없이 계산해야
// 검산(sympy 의 정확한 값)과 글자가 한 자리도 어긋나지 않는다. 식 읽기·약분은 sym.ts 것을 그대로 쓴다.
import { evalRational, parseSym, type Rational, ratStr, reduce } from '../sym.ts';

export type Q = Rational;

/** "3"·"-1/2"·"0.25"·"1+1/3" 같은 숫자 식 → 기약분수 */
export const q = (s: string | number): Q => evalRational(parseSym(String(s)));
export const qi = (n: number | bigint): Q => [BigInt(n), 1n];
export const add = (a: Q, b: Q): Q => reduce(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const sub = (a: Q, b: Q): Q => reduce(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const mul = (a: Q, b: Q): Q => reduce(a[0] * b[0], a[1] * b[1]);
export const div = (a: Q, b: Q): Q => reduce(a[0] * b[1], a[1] * b[0]);
export const neg = (a: Q): Q => [-a[0], a[1]];
/** 크기 비교: a<b 이면 −1, 같으면 0, 크면 1 */
export const cmp = (a: Q, b: Q): -1 | 0 | 1 => {
  const d = a[0] * b[1] - b[0] * a[1];
  return d < 0n ? -1 : d > 0n ? 1 : 0;
};
export const eq = (a: Q, b: Q) => cmp(a, b) === 0;
export const num = (a: Q) => Number(a[0]) / Number(a[1]);
export const isInt = (a: Q) => a[1] === 1n;
/** 검산기(verify.py)가 읽는 sympy 식. 1/2 를 그대로 쓰면 파이썬 실수 0.5 가 되므로 Rational 로 감싼다 */
export const py = (a: Q) => (a[1] === 1n ? `Integer(${a[0]})` : `Rational(${a[0]},${a[1]})`);
export { ratStr };
