// 답 입력용 숫자 패드. iOS 키보드는 화면 절반을 가리고 펜 필기와 부딪혀서 직접 만든다.
// 입력 규칙은 answer.ts 가 읽을 수 있는 모양(정수·분수 a/b·소수)만 만들도록 막는다.

export type PadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '-'
  | '/'
  | '.'
  | 'back'
  | 'clear';

const MAX = 12;

export function pressKey(input: string, key: PadKey): string {
  if (key === 'clear') return '';
  if (key === 'back') return input.slice(0, -1);
  // 부호는 손가락으로 "앞에 붙이기"가 번거로워 뒤집기로 둔다.
  if (key === '-') return input.startsWith('-') ? input.slice(1) : `-${input}`;
  if (input.length >= MAX) return input;
  const last = input.at(-1);
  const endsWithDigit = last !== undefined && last >= '0' && last <= '9';
  if (key === '/') {
    // 분수와 소수를 섞으면 answer.ts 가 못 읽으므로 둘 중 하나만.
    if (!endsWithDigit || input.includes('/') || input.includes('.')) return input;
    return `${input}/`;
  }
  if (key === '.') {
    if (input.includes('.') || input.includes('/')) return input;
    return endsWithDigit ? `${input}.` : `${input}0.`;
  }
  return input + key;
}
