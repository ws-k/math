# 단원 갱신 지침 v2 — 탐색 장면에 목표 붙이기 (조각 ② 단원 적용 담당용)

당신은 별도 git worktree 에서 **맡은 3단원의 레슨(lesson)만** 고칩니다. 할 일은 하나입니다: "아무 데나 한 번 만지면 끝나는" 탐색 장면(좌표평면·도형판)에 **목표**를 붙이고, 그 장면의 글(lead·after·intro·done·note)을 새 조작에 맞게 고치는 것. 맡을 장면은 이 문서 끝 표에 있습니다.

배경: 계획서 `docs/plan-widgets-v2.md` 의 원칙 P1~P10 과 조각 ②. 목표는 **진행을 막지 않습니다**(2026-11-14 결정) — '계속하기'는 늘 열려 있고, 목표는 ① "맞았다" 글 ② 장면 완료 기록 ③ 숨긴 정답 공개 ④ 결론 글 공개에만 씁니다. 손을 8번 떼도 못 이루면 목표의 힌트 글이 보입니다.

## 0. 준비
- worktree 에 `node_modules`·`.venv` 가 없으면 원본 저장소 것을 링크하세요(worktree 맨 위에서, 원본 위치는 git 이 알려 줌):
  `root="$(git rev-parse --git-common-dir)/.." && ln -s "$root/node_modules" node_modules && ln -s "$root/.venv" .venv`
- 새 의존성 설치 금지. `reference/` 폴더는 읽지 마세요.

## 1. 먼저 읽기
- `docs/widgets.md` — 좌표평면의 **읽는 값 표·숨긴 정답·goal 표**, 슬라이더 `exclude`, 도형판의 **목표 `goal`**, 공통 규칙의 **결론 글 공개(`afterGoal`)**.
- 본보기 3단원(이 방식으로 이미 고친 장면):
  - `content/units/m3-quadratic-eq.json` — `zero`(값 맞추기 + 여러 자리: 곱이 0 인 자리 두 곳), `double`(슬라이더 목표: 실근 개수 `roots(f)` 가 1 = 중근)
  - `content/units/m2-linear-func.json` — `slope`(여러 곳 가 보기: 기울기 3, −1, 1/2 인 직선 하나씩)
  - `content/units/e-polygon-area.json` — `tri`(도형판 여러 자리: P 를 세 곳에 놓아도 넓이 같음), `trap`(도형판 값 맞추기: 사다리꼴 넓이 20)
- 맡은 단원의 레슨 전체(앞뒤 장면이 무엇을 말하는지 알아야 목표가 흐름에 맞습니다).

## 2. 목표 쓰는 법

**먼저 한 줄을 적으세요: "이 장면은 무엇을 깨닫게 하는가."** 목표는 그 깨달음에 닿아야만 이룰 수 있게 고릅니다. "아무 데나 한 번"이 아니라 "이 값이 되게", "이 세 곳을 다 보고"입니다.

| 깨닫게 할 것의 모양 | 목표 | 예 |
|---|---|---|
| 바꿔도 변하지 않는 것(불변) | 값 맞추기 + `places` 여러 자리 | 삼각형 넓이가 어디서나 12 — `{"value":{"of":1,"is":12,"places":3}}` |
| 몇 가지 경우를 비교 | 여러 곳 가 보기 `visit` | 기울기 3·−1·1/2, 각 60°·90°·120° |
| 특별한 한 순간(중근·접함·교점 수가 바뀜) | 값 맞추기 `value` | `roots(f)` 가 1, `meet(f,g)` 가 3 |
| 두 양이 같아지는 곳 | 값 맞추기 `is` 에 다른 읽는 값 | `{"of":"deriv(f,R)","is":"slope(P,Q)"}`(평균값 정리) |
| 계산해서 찾은 자리(답) | 점 자리 `place` + 검산식 | 두 직선의 교점에 점 놓기 `{"place":{"point":"P","x":{value,check},"y":{value,check}}}` |

규칙(형식 검사가 막는 것 포함):
- **`hint` 필수**: 8번 떼도 못 이룬 학습자에게 보일 한 줄. 답을 그대로 말하지 말고 생각할 곳을 짚습니다("꼭짓점이 가로축에 딱 놓이게").
- **`done`**(좌표평면·도형판 모두 최상위 칸): 이뤘을 때 글. 무엇을 확인했는지 한 줄.
- **처음 자리가 이미 목표면 형식 오류** — 한 번 만지면 끝나는 탐색으로 되돌아갑니다. 처음 값(슬라이더 `value`, 점 처음 자리)이나 목표값을 바꾸세요.
- **닿을 수 없는 목표는 형식 오류**(끄는 간격·슬라이더 칸으로 그 값이 안 나옴).
- `tol` 은 목표값이 무리수일 때만. 오차 안의 자리가 정확히 하나(또는 `places`)여야 합니다.
- `roots`·`meet` 은 곡선이 x 의 다항식이고 그 곡선의 슬라이더 칸이 유리수일 때만.
- 진행 표시("3곳 중 2곳")는 부품이 알아서 보입니다. 글에 따로 적지 마세요.
- **결론 글 공개**: 결론(after)이 목표의 답을 말해 버리면 장면에 `"afterGoal": true` 를 두세요. after 는 목표를 이룬 뒤에 보입니다.
- afterGoal 의 after 는 목표를 못 이뤄도 '계속하기'로 그 장면을 떠나면 보입니다(완료 기록은 안 됨). 그래도 **다음 장면이 쓰는 용어 정의는 lead·intro 에 먼저** 두고, after 에는 확인·정리만 두세요 — 머무는 동안엔 after 가 안 보입니다.
- 목표 숫자를 글에 적으면 '글 속 숫자' 경고가 납니다(목표값을 {{…}} 로 넣는 장치는 아직 없음). 경고는 괜찮지만 **글의 숫자와 goal 의 숫자가 같은지 직접 확인**하세요.

## 3. 숨긴 정답 (`hide: true`)
- 좌표평면의 곡선·끄지 않는 점에 `"hide": true` 를 두면 목표·과제를 이루기 전에는 그리지 않고, 이루면 그립니다. 손그리기(sketch)·점 찍기(pointsOn) 과제의 정답 곡선, "기울기 12 가 되는 곳" 같은 목표 점에 씁니다.
- 숨긴 곡선·점은 **목표·과제만** 가리킬 수 있습니다. 그 점에 이름표·접선·읽는 값을 달거나 그 곡선 위에 점을 두면 형식 오류(숨긴 자리가 드러나므로).
- 숨긴 정답이 있는 장면의 글은 정답 위치를 미리 말하지 않습니다(lead·intro 에 좌표·식을 적지 않기).

## 4. 하지 말 것
- **장면 id·생성기 id·시드 변경 금지**(학습자 진행 기록이 장면 id 로 저장됨 — 코드를 되돌려도 기록은 안 돌아옴). 장면 추가·삭제·순서 변경도 하지 마세요.
- 맡은 `content/units/<id>.json` 의 `lesson` 밖(문제 30개·formulas·생성기)과 다른 단원, `src/**`·`verify/**`·`scripts/**`·`test/**`·`docs/**` 수정 금지.
- **가까워짐 신호 금지**(원칙 P3): "거의 다 왔어요", "가까워지면 색이 바뀌어요" 같은 글을 쓰지 않습니다. 목표 판정은 손을 뗀 자리에서만 합니다 — 글도 "끌어 놓아 보세요"처럼.
- **결과를 대신 그려 주는 버튼·'눌러' 안내 금지**(원칙 P2·P5). 글이 옛 조작(버튼)을 가리키지 않게.
- 어려운 목표로 학습자를 붙잡지 마세요. 그 장면 앞까지 배운 것으로 풀 수 있어야 합니다.
- 목표를 붙이려고 축 범위·슬라이더 범위·처음 자리를 바꾸는 것은 괜찮지만, 그러면 곡선 검산(parity) 항목이 바뀝니다 — 보고에 이유를 적으세요.
- 기존 부품으로 정말 안 되는 목표(끌기 범위 제한, 따라오는 점, 선분·화살표 등 ⑤ 조각 몫)는 가장 가까운 목표로 대신하고 보고의 "필요한 부품 기능"에 적으세요. `math2-definite`(구분구적, ③)·`geo-vector-ops`(벡터 꼼수 식, ⑤)는 뒤 조각에서 그림이 바뀌므로 지금은 목표만 붙입니다.

## 5. 작성·검산 주의 (요청 목록에서 모은 것)
- 검산식의 정수 나눗셈은 이제 분수로 읽습니다(`(-3+3)/2` 는 0, `2**5*2**3/2**4` 는 16 — 요청 36·107 해결).
- '답 그대로 적기' 규칙은 **정수·기약분수만** 막습니다. `Rational(360,8)`·`20/8` 처럼 약분이 남은 분수는 계산식으로 통과합니다(요청 24·113 해결). `Rational(5,3)`·`8`·`8/1` 은 여전히 막힘.
- 생성기에서 `String.replace` 로 `$$` 를 넣으면 `$` 하나가 됩니다(바꿀 글의 특수 패턴) — `replace(a, () => b)` 꼴이나 `split(a).join(b)` 로(요청 38).
- sympy `solveset` 은 치환형 삼각방정식(`2*cos(x)**2-cos(x)-1=0`, `2*sin(x)**2-sin(x)-1=0`)의 해를 덜 찾습니다 → `cos x` 를 문자로 바꿔 풀고 하나씩 세세요(요청 62·71).
- 좌표 과제 칸의 검산식은 `sympify` 로 읽힙니다 → `max()` 대신 `Max()`, `list(...)` 대신 `solveset(...).args[0]` 또는 `Max(*solve(...))`(요청 79·104).
- `(-1)**n` 이 든 극한은 sympy 가 오류를 냅니다 → 짝수·홀수 항 수열로 나눠 검산(요청 102). 급수 극한은 `limit(summation(...))` 대신 정적분으로(요청 104).
- `==…==`(강조) 안에 `$…$` 수식을 넣을 수 없습니다(요청 113).

## 6. 확인 (모두 통과해야 끝)
- 단원마다 `npm run verify:unit <id>` — 형식 오류 0, 검산 통과
- `npm run typecheck && npm run lint && npm test`
- `npm run verify:diff HEAD` — 달라진 검산 항목 목록. 목표를 붙인 장면마다 `<단원>/lesson:<장면>:목표 판정` 이 새로 생기는 것이 정상이고, 그 밖의 변화는 하나하나 이유를 적습니다. **장면 id 사라짐 0건**이어야 합니다.
- 커밋·push 하지 마세요(메인이 확인 후 커밋).

## 7. 보고 (짧게)
worktree 경로·브랜치, 그리고 장면마다 한 줄씩:
`<단원>/<장면> · 목표 종류 · 깨닫게 하는 것 한 줄 · afterGoal 여부 · verify:diff 항목(새로·바뀜) · 글 속 숫자 경고 수`
끝에 필요한 부품 기능, 남은 문제.

---

## 부록 A — 남은 장면 (목표 없는 탐색 51장면 / 35단원, 2026-11-14 코드에서 셈 → 2026-11-15 실생활 계획으로 4장면 제외)

본보기 3단원(5장면)은 끝났습니다. 아래 묶음은 제안이며 메인이 배정합니다. **제외 4장면**(그림이 통째로 바뀌어 `docs/plan-real-world.md` 에서 목표까지 한 번에 함): `math2-definite` rects, `calc-integral-app` slices, `math2-velocity` move, `e-circle-area` ratio — 조각 ② 지표 "목표 없는 탐색 0"의 예외입니다. 괄호 안은 부품, 뒤는 관련 요청 줄(`docs/widget-wishlist.md`).

| 묶음 | 단원 · 장면 | 참고 |
|---|---|---|
| 가 | `m1-basic-geometry` straight·parallel·build (도형판) / `m2-triangle-quad` iso·circum·para (도형판) / `m2-pythagoras` converse (도형판) | |
| 나 | `m2-similarity` parallel·area·centroid (도형판) / `m3-circle` slide·diameter·cyclic (도형판) / `m3-radical-ops` rect·add (도형판) | |
| 다 | `math1-sine-cosine-law` cosine·sine·area (도형판) / `geo-ellipse` find (도형판)·circles (좌표) / `geo-parabola` measure (도형판)·rings (좌표) | 67(60°·90°·120° 모두 보기), 106 |
| 라 | `geo-hyperbola` drag (도형판) / `geo-space-coord` section (도형판) / `geo-space-figures` perp (도형판) | 106 |
| 마 | `e-circle-area` poly (도형판) / `m1-expressions` value (좌표) / `m2-linear-func-eq` slope (좌표) | 37(기울기 목표) |
| 바 | `m3-sqrt` find·zoom (좌표) / `m3-quadratic-func` move (좌표) / `m3-trig-ratio` same (좌표) | 50(슬라이더 목표) |
| 사 | `h1-circle-eq` move (좌표) / `h1-rational-irrational` slide (좌표) / `h1-remainder-factor` slide·identity (좌표) | 56 |
| 아 | `h1-transform` graph (좌표) / `math1-exp-func` slider (좌표) / `math1-log-func` base (좌표) | 56, 60(밑 a≠1 → 슬라이더 `exclude`) |
| 자 | `math1-sigma` general (좌표) / `math1-trig-graph` slider (좌표) | 64·67 |
| 차 | `math2-diff-coefficient` corner (좌표) / `math2-diff-polynomial` rules (좌표) / `math2-indefinite` shift (좌표) | 75(목표 점 숨김), 82(두 값 같게) |
| 카 | `math2-tangent` mvt (좌표) | 75 |
| 타 | `calc-quotient-chain` chain (좌표) / `calc-series` race·geo (좌표) / `calc-trig-addition` overlay (좌표) | 98(내용 점검) |
| 파 | `geo-conic-tangent` slide (좌표) / `geo-vector-ops` scale (좌표) | 108(xy 점 목표), ⑤ |

장면 목록을 다시 세려면: 탐색 장면 중 좌표평면이 `mode: explore` 인데 `goal` 이 없거나, 도형판이 `cut`·`goal` 둘 다 없는 것.

## 부록 B — 목표·숨김을 요청한 단원 (부록 A 와 겹치지 않는 장면)
목표 없는 탐색이 아니어도 요청 목록이 목표·숨김을 바란 곳입니다. 해당 단원을 맡으면 함께 봅니다.
- 정답 곡선 숨김(맞힌 뒤 공개): `m1-coord-graph`(25), `math1-arith-geo`·`math1-sigma`(64, pointsOn 정답 곡선)
- 교점 자리 목표: `m2-simul-eq`(37 — `place` 또는 `meet`)
- 슬라이더 목표: `m3-quadratic-func`(50, 본보기 `m3-quadratic-eq` double 참고), `math2-limit`·`math2-continuity`(76), `math2-max-min-eq`·`math2-indefinite`(82 — "교점 3개"는 `meet(f,g)`, "두 값 같게"는 `is` 에 다른 읽는 값)
- 목표 점 숨김·식 값(판별식): `h1-inequalities`·`h1-quad-eq-func`·`h1-higher-eq`(55 — 판별식은 슬라이더 식 읽는 값 `b**2-4*a*c`)
- 끄는 점 목표 칸(x,y): `h1-circle-eq`·`h1-coord-line`·`h1-transform`(56), `geo-vector-ops`·`geo-vector-dot`·`geo-conic-tangent`(108)
- 슬라이더 제외 값: `math1-log-func`(60)

## 부록 C — 실생활 글 (2026-11-15, `docs/plan-real-world.md`)
맡은 단원이 `docs/plan-real-world.md` 의 '나'·'다'·'라' 에 있으면 목표와 실생활 글을 **한 번에** 고칩니다. 그 문서의 해당 단원 항목(바꿀 장면·상황·깨닫게 할 것·숫자)을 그대로 따르고, 아래 규칙을 지킵니다.
- **R1 그림이 곧 수학 객체**: 배경 삽화·사진·외부 그림 금지. 밭·길·물은 앱이 그리는 곡선·영역·점과 한글 이름표로.
- **R2 들어갈 때 실생활, 나올 때 표기**: 결론 글이나 다음 '이름 붙이기'에 대응 한 줄("밭의 넓이 → $\int_0^3 f(x)\,dx$"). 요약의 "수능에서는"과 직접 풀기 중 2문제 이상은 수능 표기 그대로.
- **R3 같은 id 로 교체**: 장면 추가·삭제·id 변경 금지(추가는 메인 승인 장면만).
- **R4 숫자는 그대로**: 곡선·점·숫자가 같으면 검산 항목이 안 바뀝니다. 글만 바꾼 장면에서 `verify:diff` 가 바뀌면 원인부터 보고.
- **R5 음수가 되는 양은 위치·높이로만**: "거리·넓이·양"은 음수가 될 수 없습니다. "집 기준 위치(동쪽 +)", "기준 지점에서 본 높이".
- **R6 현실 수치 점검표**: 새로 쓴 상황마다 `docs/plan-real-world.md` 점검표 형식의 한 줄(장면 | 수치 | 판단)을 보고에 적습니다.
- **직접 풀기 교체**: 3문제 중 1문제만 실생활로, **새 문제 id** 로 바꿉니다(옛 id 의 필기가 엉뚱한 문제에 붙지 않게). 수능 표기 문제 2개는 남깁니다.
- **소재**: 고등 단원도 술·대출·투자 수익·세금·도박·실존 브랜드 금지. 용돈 저축 이자는 허용. 캐릭터·이모지·과한 칭찬 금지.
- 단위 붙은 숫자는 '글 속 숫자' 경고를 늘립니다 → 레슨 값(`values`·`{{…}}`)으로.
