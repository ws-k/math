# 단원 콘텐츠 작성 규칙

단원 하나 = `content/units/<id>.json` 하나 + (선택) 생성기 `src/generators/<id>.ts`.
형식은 `src/content/types.ts`의 `Unit`. 단원 목록·선수 관계는 `content/curriculum.json`.

## 1. 독자

- 성인입니다. 학교 수학을 오래전에 배워 대부분 잊었습니다.
- 쉬운 말로 씁니다. 한 단계에는 한 가지만 담습니다.
- 공식에는 "왜 그런지"를 한두 문장으로 붙입니다.
- 계산 과정은 건너뛰지 않습니다.

## 2. 말투와 형식 (`reference/` 풀이 파일이 기준)

- "~입니다" 체로 씁니다.
- **풀이 한 단계에는 계산 하나만** 넣습니다. 단계마다 짧은 제목을 붙입니다(예: "분모를 12로 맞추기", "분자끼리 더하기").
- 문제 하나의 구성은 이렇습니다.
  - `concepts`: 필요한 개념·공식. 앱에서 힌트로 보여 줍니다.
  - `steps`: 단계별 풀이
  - `tip`: 짚고 넘어가기. 검산하는 법이나 자주 하는 실수를 적습니다. 없어도 됩니다.
  - `answer`: 정답
- 문제와 해설은 **모두 새로 씁니다.** 교과서·문제집·기출의 문장과 숫자를 옮기지 않습니다. 참고 파일에서는 형식과 말투만 따릅니다.
- 문장제의 소재는 성인의 생활(요리, 장보기, 이동, 운동, 저축 등)에서 가져옵니다.

## 3. 단원 JSON 칸

| 칸 | 규칙 |
|---|---|
| `id`, `title`, `prereq`, `hours` | `curriculum.json`과 **똑같이** 씁니다(검사기가 prereq를 비교합니다). |
| `course` | 표시용 이름입니다. "초등", "중1", "중2", "중3", "고1 수학", "수학Ⅰ", "수학Ⅱ", "확률과 통계", "미적분", "기하" |
| `unit` | 대단원 이름입니다(예: "수와 연산", "문자와 식", "미분"). |
| `suneung` | curriculum의 `suneung` + `suneungTools`(순서 유지, 중복 제거) |
| `concept` | 소제목 2~4개입니다. `body`는 짧게, 공식마다 이유를 붙입니다. 줄바꿈은 `\n`입니다. |
| `formulas` | 핵심 공식을 LaTeX로 적습니다(`$...$`). |
| `examples` | 2~3개입니다. 풀이를 가장 자세하게 보여 줍니다. `answer`·`answerType`·`check`가 필수입니다. |
| `generators` | 이 단원 생성기 id 목록입니다. 기초 15문제(`b01`~`b15`)를 이 목록을 돌아가며 찍습니다. |
| `problems` | 기초 15 / 표준 10 / 수능형 5 이상. 초등·중등은 수능형 대신 `"응용"`을 씁니다. |

문제 id는 이렇게 붙입니다. 생성기 기초 문제는 `b01`~(자동), 직접 쓴 기초는 `p001`~, 표준은 `p101`~, 수능형·응용은 `p201`~입니다.

## 4. 정답과 검산 (가장 중요)

- `answerType`
  - `int`: 정수
  - `fraction`: 기약분수 `"5/3"`. 정수여도 됩니다. 가분수로 적고, 대분수 표시는 `answerTex`로 합니다(예: `"$1\\frac{2}{3}$"`).
  - `choice`: 오지선다 번호 `"1"`~`"5"`. `choices` 5개와 `choiceChecks` 5개가 필요합니다.
  - `expr`: 식. 앱이 자동으로 비교하지 않으므로 꼭 필요할 때만 씁니다.
- `check`는 **sympy 문법의 식**으로, 문제의 조건에서 답을 **직접 계산**해야 합니다.
  - ✅ `"Rational(2,3) + Rational(3,4)"`
  - ✅ `"solve(Eq(3*(x-2), x+4), x)[0]"`
  - ✅ `"diff((x+2)*(2*x**2-x-2), x).subs(x, 1)"`
  - ❌ `"17/12"`처럼 답만 적은 것은 검사기가 거부합니다.
  - 여러 줄이 필요하면 마지막에 `ans = ...`를 둡니다.
  - 쓸 수 있는 기호: `a b c d h k m n p q r s t u v w x y z`
- 오지선다: `choiceChecks`의 값 가운데 **정답 번호 하나만** `check`와 같아야 합니다.
- **검산을 통과하지 못한 문제는 넣지 않습니다.**

## 5. 수식 (KaTeX)

- 글 속 수식은 `$...$`, 가운데 정렬 수식은 `$$...$$`로 씁니다. JSON 안에서는 역슬래시를 두 번(`\\frac`) 씁니다.
- **수식 안에 한글을 그냥 쓰면 오류입니다.** `\text{사과}`처럼 씁니다. 되도록 한글은 수식 밖에 둡니다.
- 검사기가 모든 칸의 수식을 KaTeX strict 모드로 렌더링해 봅니다.

## 6. 생성기 (`src/generators/<id>.ts`)

```ts
import type { Generator } from './types.ts';
import { fracTex, fracAns, polyTex, polySym, paren, gcd, lcm, polyMul, polyDiff, polyEval } from './util.ts';

export const generators: Generator[] = [
  {
    id: 'frac-add-same-denom',
    unitId: 'e-fraction-addsub',
    title: '분모가 같은 분수의 덧셈',
    make(rng) {
      // 숫자를 정하고 → q, steps, answer, check 를 만든다
      return { q, choices: null, answer, answerType: 'fraction', check, concepts, steps, tip };
    },
  },
];
```

- 같은 시드면 항상 같은 문제가 나와야 합니다(`rng`만 씁니다. `Math.random` 금지).
- 의도와 다른 경우(분모가 같아지거나, 답이 0이거나, 숫자가 너무 큰 경우)는 다시 뽑아서 피합니다.
- 생성기 하나에서 시드 1~200이 모두 검산을 통과해야 합니다.

## 7. 확인 명령

```
node scripts/gen-content.ts <id>    # 기초 b01~b15 를 생성기로 다시 찍어 넣기
npm run verify:unit <id>            # 이 단원만 형식·수식·정답 검산
npm run verify                      # 전체
npm run verify:diff <기준 커밋>      # 기준 커밋과 견줘 달라진 검산 항목 목록 + 장면 id 사라짐 검사
```
