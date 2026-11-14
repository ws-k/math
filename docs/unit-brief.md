# 단원 작성 지침 (단원 작성 담당용)

당신은 별도 git worktree 에서 맡은 단원만 만듭니다. 결과물은 단원마다 아래 두 파일입니다.
- `content/units/<id>.json` — 레슨(lesson) + 공식(formulas) + 연습문제 30개
- `src/generators/<id>.ts` — 기초 문제 생성기(3개 이상)

## 0. 준비
- worktree 에 `node_modules`·`.venv` 가 없으면 원본을 링크하세요:
  `ln -s /Users/woosoo/projects/Math/node_modules node_modules && ln -s /Users/woosoo/projects/Math/.venv .venv`
- 새 의존성 설치 금지. `reference/` 폴더는 읽지 마세요.

## 1. 먼저 읽기 (본보기)
- 본보기 단원 3개(가장 중요): `content/units/m1-linear-eq.json`, `content/units/e-fraction-addsub.json`, `content/units/math2-diff-product-rule.json` 와 각 생성기 `src/generators/*.ts`
- `docs/widgets.md` (쓸 수 있는 부품 11종과 매개변수)
- `docs/plan-lesson.md` 의 A5(전 연령 원칙)와 끝 "수정 사항" 절
- `docs/content-guide.md` 4~7장(정답·검산·KaTeX·생성기 규칙). 1~2장의 "성인 독자·~입니다"는 낡은 규칙이니 무시하고 아래를 따르세요.
- `docs/design.md` 2장의 단원 표(주제·공식·수능 연결)와 `content/curriculum.json` 의 그 단원 항목(id, title, prereq, topics, keyFormula, hours, suneung)

## 2. 레슨 (가장 중요 — 사용자가 "재미있고 이해 쉽게"를 가장 원함)
- 흐름: 도입 → 오늘의 질문(이미 아는 직관 꺼내기) → 손으로 해 보기(규칙 발견) → 이름 붙이기(용어는 발견 **뒤에**) → 지름길 또는 두 번째 해 보기 → 틀린 곳 찾기(실제로 자주 하는 실수 2개) → 직접 풀기 2~3개(힌트·풀이 한 단계씩) → 한 장 요약(3~4줄). 장면 7~9개, 한 장면에 생각 하나.
- **직접 만지는 인터랙션이 핵심**: 용어·요약 장면을 빼고 모든 장면에 손 조작이 하나 이상. **끌기(드래그)를 우선** — 점·항·조각·꼭짓점 옮기기, 슬라이더. 그래프·좌표가 나오는 단원은 coord 부품으로 **직접 점 찍기·직선 그리기·곡선 긋기 과제**를 넣으세요(사용자 요구).
- 공식은 글보다 조작으로 "왜"를 보여 주세요.
- 말투 "~해요", 담백하게. **유치함 금지**: 캐릭터·말풍선·이모지·반말·과한 칭찬 금지. 초등도 존댓말, 소재만 친숙하게(간식·장보기·요리·운동·여행·용돈·게임 점수). 초·중등에서 술·대출·세금·도박, 실존 브랜드 금지.
- 초등: 리드 2문장 이하, 한 문장 40자 안팎, 그림 먼저. 고등: 요약에 "수능에서는" 한 줄 가능.
- 모든 정답·보기·틀린 곳·부품 목표는 검산 통과 필수. 화면 값은 검산 칸에서 만들어지게(본보기처럼 `equations`·`values`·`{{…}}` 활용). 글 속 숫자 경고는 가능한 한 줄이세요.

## 3. 연습문제 30개
- 기초 15(`b01`~`b15`): 생성기로. 생성기 작성 후 `node scripts/gen-registry.ts` → `node scripts/gen-content.ts <id>`.
- 표준 10(`p101`~`p110`), 응용/수능형 5(`p201`~`p205`). 고등(수학Ⅰ·Ⅱ·확통·미적분·기하)은 `수능형`, 그 외는 `응용`. 고1 「수학」도 `응용`.
- 수능형: 그 단원이 수능에서 쓰이는 방식과 **같은 개념, 숫자·상황은 새로**. 기출 문장·숫자 복제 금지. 오지선다는 보기 5개 + choiceChecks.
- 풀이는 한 단계에 계산 하나, 단계마다 짧은 제목, "~해요".
- 모든 문제·생성기 시드 1~200 검산 통과.
- 검산 함정(sympy 1.14): ① `Piecewise` 의 한쪽 극한 `limit(…, '-')` 이 틀린 값을 내서 틀린 답이 통과할 수 있음 → 조각마다 따로 계산. ② 치환형 삼각방정식(2sin²x−sin x−1=0)의 해를 덜 찾음 → sin x 를 문자로 바꿔 풀고 하나씩 셀 것.
- 생성기 id 는 반드시 단원 접두어로 시작(중복 사고 방지).

## 4. 건드리지 말 것
- 맡은 단원 두 파일과 자동 생성되는 `src/generators/registry.ts` 외에는 **수정 금지**: `src/lesson/**`, `src/app/**`, `src/ink/**`, `scripts/**`, `verify/**`, `test/**`, `docs/**`, `content/curriculum.json`, 다른 단원.
- 기존 부품으로 표현이 정말 안 되는 인터랙션은 가장 가까운 부품으로 대신하고, 보고서의 "필요한 부품 기능"에 적으세요.

## 5. 확인 (모두 통과해야 끝)
- 단원마다 `npm run verify:unit <id>`
- 전체: `npm run typecheck && npm run lint && npm test && npm run verify`
- 커밋·push 하지 마세요(메인이 확인 후 커밋).

## 6. 보고 (짧게)
worktree 경로·브랜치, 단원별(레슨 장면 수와 쓴 부품, 검산 항목 수, 글 속 숫자 경고 수), 필요한 부품 기능, 남은 문제.
