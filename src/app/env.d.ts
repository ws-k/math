// 빌드 도구가 채워 넣는 이름들의 타입. 실제 값은 scripts/esbuild-shared.mjs 가 만든다.
declare const __DEV__: boolean;

// 바깥 선언 안에서는 상대 경로 타입을 가져올 수 없어 여기서는 모양만 두고 content.ts 에서 타입을 붙인다.
declare module 'virtual:content' {
  const content: { curriculum: unknown; units: unknown[] };
  export default content;
}

declare module '*.css';
