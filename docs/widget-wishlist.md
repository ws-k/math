# 부품 기능 요청 목록 (단원 작성 중 나온 것)

단원 작성 담당이 "지금 부품으로는 못 해서 가까운 부품으로 대신한 것"을 모아 둡니다. 한꺼번에 부품을 보강할 때 씁니다.

- balance: `unit` 빈칸 허용(단위 없는 비례식) — e-proportion
- coord: 축 이름(가로 = 밀가루, 세로 = 우유) — e-proportion
- numberLine: 두 줄 수직선(위아래 대응) — e-ratio
- shape: 조각 돌리기(원 부채꼴 잘라 엇갈려 붙이기) — e-circle-area
- shape: 원주(곡선 길이) 재기 — e-circle-area
- shape: 목표 기능("넓이를 12로 만들어 보세요") — e-polygon-area
- solid(새 부품): 직육면체 돌려 보기, 쌓기나무, 전개도 펼치기·접기 — e-cuboid
- shape: 모양을 지키며 꼭짓점 끌기(넓이 12인 직사각형의 가로·세로 바꾸기) — e-divisor-multiple
- numberLine: 범위·칸 수 확대(5000원 등), 점프 화살표 두 줄 — e-whole-ops, e-divisor-multiple
- 세로셈(나눗셈 사다리) 새 부품 — e-divisor-multiple
- numberLine·fraction·areaModel: 소수 표시 옵션 — e-decimal
- 틀린 곳 찾기: ÷ 기호 표시(지금은 번분수로 그려짐), 등식 아닌 식도 — e-fraction-div, e-divisor-multiple
- verify.py: spot 식의 소수를 분수로 정확히 읽기(0.1+0.2=0.3 오판 위험) — e-decimal
- 생성기 조사 도우미(을/를, 이에요/예요)를 util.ts 공용으로 — 여러 단원에 복제됨
- coord: 점 이름표(삼각형·육각형 등 여러 글자) — m1-plane-figures
- shape: 각도 합계 표시, 회전축·연장선 점선, 오목한 각(180° 초과) 표시 — m1-plane-figures
- histogram(새 부품) 또는 table 막대 확장, 줄기와 잎 그림 — m1-data
- 질문 보기 표기: 숫자 뒤 π 붙이기 옵션 — m1-solid-figures
- 강조 표기(==…==) 안에 수식($…$) 허용 — m1-plane-figures
- LITERAL 규칙이 `Rational(360, n)` 같은 계산식도 거부함(우회: 360*Rational(1,n)) — m1-plane-figures
- coord: 정답 곡선 숨기기(채점 전 숨김, 맞히면 보임) — 곡선 손그리기 장면에 필수 — m1-coord-graph
- shape: 함께 움직이는 점(한 점을 끌면 마주 보는 점이 따라옴, 교차한 두 직선 돌리기) — m1-basic-geometry
- ~~verify.py 버그~~ (고침): plot 직선 과제 기울기를 분수("2/3")로 주면 fr() 가 실수로 계산해 "풀 수 있나" 검사 실패(215줄 근처) — m1-coord-graph
