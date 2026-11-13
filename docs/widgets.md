# 레슨 부품 매개변수 (단원 작성자용)

레슨 장면의 `widget: { "type": "...", "params": { ... } }` 에 넣는 값입니다. 모르는 칸·없는 참조는 형식 검사(`npm run verify`)에서 오류가 납니다. 채점·화면에 쓰는 값은 모두 검산 항목으로 내보내져 sympy 가 다시 계산합니다.

식 글자는 공통 문법입니다: 숫자, 변수, `+ - * / **`, 괄호, `sin cos tan exp log sqrt Abs pi E`. `^` 는 쓰지 않습니다(sympy 에서 다른 뜻). 곱셈 기호 `*` 는 빼지 않습니다(`3*x`).

---

## coord — 좌표평면

"이름 붙은 객체 + 참조" 목록으로 그립니다.

```json
{
  "mode": "explore",
  "x": { "min": 0, "max": 1.6, "step": "1/5" },
  "y": { "min": 0, "max": 8, "step": 1 },
  "objects": [
    { "id": "fg", "curve": "x**2*x**3", "label": "$y=x^2\\cdot x^3$" },
    { "id": "P", "point": { "on": "fg", "x": 1 }, "name": "P" },
    { "id": "Q", "point": { "on": "fg", "x": 1.5, "drag": "x", "snap": "1/20" }, "name": "Q" },
    { "secant": ["P", "Q"] },
    { "readout": "slope(P,Q)", "label": "할선 PQ 의 기울기" }
  ],
  "goal": { "approach": ["Q", "P"] },
  "intro": "처음 안내", "done": "목표를 이뤘을 때"
}
```

| 칸 | 뜻 |
|---|---|
| `mode` | `explore`(점 끌기·슬라이더) · `plot`(빈 칸 눌러 점 찍기, 끌어 옮기기, 눌러 지우기) · `connect`(찍은 점을 x 순으로 이음) · `line`(두 손잡이로 직선) · `sketch`(‘그리기 시작’ 뒤 손으로 긋기) |
| `x`, `y` | `min`·`max`·`step`(격자 칸 간격). 수 또는 식 글자(`"2*pi"`, `"pi/6"`). 칸은 40칸 이하 |
| `sliders` | `[{id, min, max, step, value, label}]` 1~3개. `id` 는 한 글자(a·b·c·d·h·k·m·n·p·q·r·s·t)이고 곡선 식에 그대로 씁니다 |
| `intro`, `done` | 글(Rich, `{{값}}` 가능) |
| `start` | line 모드 두 손잡이 처음 자리 `[[x,y],[x,y]]` (생략하면 가로 1/4·3/4, 가운데 줄) |

**objects** (앞에서 만든 이름만 가리킬 수 있습니다)

| 객체 | 모양 |
|---|---|
| 곡선 | `{id, curve:"식(x)", label?, tone?: main·soft·accent}` — `label` 은 그림 아래 범례(Rich) |
| 곡선 위 점 | `{id, point:{on:"곡선 id", x, drag?: none·x, snap?}, name?}` — y 는 곡선에서 계산. `x` 는 `snap`(기본: x 칸 간격)의 배수 |
| 칸 위 점 | `{id, point:{x, y, drag?: none·xy}, name?}` — 칸 간격의 배수 |
| 할선 | `{secant:["P","Q"]}` — 두 점이 같은 곡선 위 같은 자리에 오면 **접선으로 바뀝니다**(극한) |
| 접선 | `{tangent:{on:"곡선", at:"점"}}` — 기울기는 앱이 곡선을 기호 미분해서 계산 |
| 읽는 값 | `{readout:"slope(P,Q) · deriv(f,P) · x(P) · y(P) · value(a)", label, digits?: 0~4 (기본 2)}` |

`name` 은 그림 위 한 글자(P, Q, A′).

**goal** (explore 만): `{approach:["끄는 점","목표 점"], within?}` — 끄는 점이 목표 점에 `within`(기본 0 = 겹침) 안으로 오면 끝. 끄는 간격으로 닿을 수 없으면 형식 오류.

**task** (plot·connect·line·sketch 는 필수, ‘확인하기’로 채점). 목표값은 `{value, check}` 쌍: `value` 는 앱이 쓰는 값, `check` 는 그 값을 문제 조건으로 계산하는 sympy 식(답을 그대로 적으면 오류).

| task | 모드 | 채점 |
|---|---|---|
| `{point:{x:T, y:T}}` | plot | 하나만 찍었고 칸 번호가 같음(정수 비교) |
| `{pointsOn:{curve, count}}` | plot·connect | 모든 점이 곡선 위(상대오차 1e-9), x 중복 없음, count 개 이상 |
| `{line:{slope?:T, through?:{x:T,y:T}, intercept?:T}}` | line | 두 손잡이 칸 번호×칸 간격으로 기울기를 분수로 정확히 비교. 칸 간격이 유리수여야 함 |
| `{line:{tangent:{curve, at}}}` | line | 기울기·접점을 앱이 곡선에서 계산(다항·유리식만). 다른 조건과 같이 못 씀 |
| `{sketch:{curve, tol}}` | sketch | x 표본 21곳 중 80% 이상을 덮고, 덮은 곳의 85% 이상이 `tol` 안. `tol` ≤ 칸 간격. 탭 대체 예외 |

찍기·그리기 모드(plot·connect·line)는 x·y 칸이 각각 **12칸 이하**여야 합니다(가장 좁은 화면에서 한 칸이 손가락으로 고를 만큼). 과제 곡선에는 슬라이더 변수를 쓸 수 없습니다.

**만들어지는 검산 항목**: 곡선마다 parity(TS 계산 vs sympy, 표본 9점), 접선·할선 극한·deriv 에 쓰이는 곡선의 미분 parity, 목표값 answer+check, 점 목표의 칸 번호(= check/칸 간격), 접선 기울기(`diff(곡선,x).subs(x,at)`)·접점(`곡선.subs(x,at)`), ‘풀 수 있나’(plot: 범위 안 격자로 답이 나오나).

**손 조작**: 손잡이 56px(보이는 점 20px), 겹치면 가장 가까운 것. 키보드 방향키(곡선 위 점은 끄는 간격 한 칸), 찍은 점은 Delete 로 지움. 탭 대체: 곡선 위 끄는 점은 ‘◯ 왼쪽으로/오른쪽으로’, plot·connect 는 ‘점 더하기’, line 은 빈 칸을 누르면 가까운 손잡이가 그 칸으로.

---

## areaModel — 넓이 모형

**split** (곱셈·분배법칙·곱셈공식): 칸을 눌러 넓이를 열고, 다 열면 `처음 곱 = 칸 넓이 합`.

```json
{ "mode": "split", "w": ["10", "3"], "h": ["10", "2"], "intro": "...", "done": "..." }
```
`w`·`h` 는 항 1~3개(식, x 가능). 검산: 칸 넓이 합 = 처음 곱(숫자면 fraction, x 가 있으면 `expand`).

**grow** (곱의 미분): 가로 w(x)·세로 h(x) 직사각형의 모서리 손잡이로 Δx 를 바꿉니다. 띠 2개·모서리와 ‘띠 두 개 ÷ Δx’, ‘모서리 ÷ Δx’가 보입니다.

```json
{ "mode": "grow", "w": "x**2", "h": "x**3", "wLabel": "$f(x)=x^2$", "hLabel": "$g(x)=x^3$",
  "at": 1, "max": "1/2", "step": "1/20", "goal": "1/20", "intro": "...", "done": "..." }
```
`at`·`max`·`step`·`goal` 은 유리수, `max` 는 `step` 의 정수배(50 이하). Δx 범위에서 가로·세로가 양수로 늘어나야 합니다. 목표: Δx ≤ `goal`(기본 한 칸). 검산: 가로·세로·`diff(w*h)` parity, `(wh)′(at)` 를 sympy diff 와 대조.

**tiles** (인수분해): x²·x·1 타일을 끌어(또는 고르고 판을 눌러) 빈틈없는 직사각형을 만들면 가로·세로가 인수로 보입니다. x 타일은 ‘돌리기’.

```json
{ "mode": "tiles", "tiles": { "x2": 1, "x": 5, "one": 6 }, "factor": "(x+2)*(x+3)", "done": "..." }
```
타일로 직사각형을 만들 수 없으면 형식 오류. 검산: `factor` 를 전개하면 타일 식과 같은가.

---

## 공통

- 레슨에 `equations` 가 있고 부품이 방정식을 그리면(`table`·`balance`·`termDrag`) `eq` 가 필수입니다. 일부러 다른 식이면 `"eq": false`.
- 끄는 동안 ‘계속하기’가 잠깁니다. 동작 줄이기면 움직임이 꺼집니다.
- 펜·손가락·마우스 모두 끌 수 있습니다(Pointer Events). 손잡이는 HTML 요소이고, 끄는 터치는 스크롤을 막습니다(Chrome 은 SVG 안쪽의 `touch-action` 을 무시해서).
