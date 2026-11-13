"""npm run verify 2단계: 모든 문제의 check(검산식)를 sympy 로 계산해 answer 와 비교한다.

check 는 sympy 식 문자열이다. 예) "Rational(2,3) + Rational(1,4)", "diff((x+2)*(2*x**2-x-2), x).subs(x, 1)"
여러 줄이 필요하면 마지막 줄에 'ans = ...' 를 둔다.
"""
import json
import sys
from collections import defaultdict

import sympy
from sympy import Rational, simplify, sympify
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

NS = {k: getattr(sympy, k) for k in dir(sympy) if not k.startswith("_")}
NS.update({s: sympy.Symbol(s) for s in "a b c d h k m n p q r s t u v w x y z".split()})
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)


def evaluate(code):
    code = code.strip()
    if "\n" in code or code.startswith("ans"):
        env = dict(NS)
        exec(code, env)
        if "ans" not in env:
            raise ValueError("여러 줄 검산식에는 'ans = ...' 가 필요합니다")
        return sympify(env["ans"])
    return sympify(eval(code, dict(NS)))


def equal(a, b):
    try:
        return simplify(a - b) == 0
    except Exception:
        return False


def parse_eq(s):
    """레슨 식 "왼쪽=오른쪽" → (왼쪽, 오른쪽). 1/2 가 실수 0.5 가 되지 않게 parse_expr(정수→Integer)로 읽는다."""
    sides = s.split("=")
    if len(sides) != 2:
        raise ValueError(f"등호가 하나인 등식이 아님: {s}")
    return tuple(parse_expr(x, local_dict=dict(NS)) for x in sides)


def holds(eq):
    """항등식인가(어떤 값을 넣어도 성립)"""
    l, r = eq
    return equal(l, r)


def solutions(eq):
    l, r = eq
    syms = (l - r).free_symbols
    if len(syms) != 1:
        raise ValueError(f"미지수가 하나인 방정식이 아님: {l} = {r}")
    return sympy.solveset(sympy.Eq(l, r), syms.pop(), domain=sympy.S.Reals)


def check_spot(it):
    """틀린 곳 찾기: 틀린 식은 성립하지 않고(또는 해가 달라지고), 고친 식은 성립해야(해가 같아야) 한다."""
    wrong, fixed = parse_eq(it["wrong"]), parse_eq(it["fixed"])
    if it["mode"] == "identity":
        if holds(wrong):
            return f"틀린 식 {it['wrong']} 이 사실은 항등식"
        if not holds(fixed):
            return f"고친 식 {it['fixed']} 이 항등식이 아님"
        return None
    if it["mode"] == "equivalent":
        want = solutions(parse_eq(it["from"]))
        if solutions(fixed) != want:
            return f"고친 식의 해 {solutions(fixed)} ≠ 원래 식의 해 {want}"
        if solutions(wrong) == want:
            return f"틀린 식 {it['wrong']} 의 해가 원래 식과 같음 {want}"
        return None
    return f"알 수 없는 mode {it['mode']}"


def check_equiv(it):
    """식 변형 전후의 해가 같은가. 저울 버튼·항 끌기 부품이 앱과 같은 TS 모델로 만든 전후 식을 넘긴다.
    양쪽에 같은 일을 하면 해가 같아야(expect=True), 한쪽만 하면 해가 달라져야(expect=False) 한다."""
    before, after = solutions(parse_eq(it["before"])), solutions(parse_eq(it["after"]))
    same = before == after
    if same != it["expect"]:
        want = "같아야" if it["expect"] else "달라야"
        return f"{it['before']} → {it['after']}: 해 {before} / {after} 가 {want} 함"
    return None


def check_sameeq(it):
    """두 등식이 같은 식인가. 저울·영수증·항 끌기가 같은 방정식을 그리는지(장면 간 숫자 어긋남) 본다.
    해만 같으면(3x+1001=13003) 통과하는 느슨한 비교가 되지 않게 '왼쪽−오른쪽'이 같은지 본다."""
    (al, ar), (bl, br) = parse_eq(it["a"]), parse_eq(it["b"])
    if not equal(al - ar, bl - br):
        return f"{it['a']} 와 {it['b']} 가 같은 식이 아님"
    return None


def check_approx(it):
    """무리수 근삿값 보기: 정확한 값을 digits 자리에서 반올림(0.5 는 0 에서 먼 쪽)한 값이 보기 글자와 같은가"""
    val = evaluate(it["expr"])
    if not val.is_real:
        return f"실수가 아님: {val}"
    d = int(it["digits"])
    scaled = sympy.N(abs(val) * 10**d, 60)
    r = sympy.floor(scaled + Rational(1, 2))
    if val < 0:
        r = -r
    want = Rational(it["value"]) * 10**d
    if r != want:
        return f"{it['expr']} ≈ {sympy.N(val, 12)} 를 {d}자리로 반올림하면 {r / 10**d} ≠ {it['value']}"
    return None


def read(s):
    """레슨 부품이 넘긴 식 글자. 1/2 가 실수 0.5 가 되지 않게 parse_expr(정수→Integer)로 읽는다."""
    return parse_expr(str(s), local_dict=dict(NS))


def defined(v):
    """실수이고 유한한가(zoo·nan·복소수는 '정의 안 됨')"""
    return v.is_real is True and v.is_finite is True


def check_parity(it):
    """그래프 계산기(TS)와 sympy 가 같은 식을 같은 값으로 계산하는가. 상대오차 1e-9, 정의 안 되는 자리는 양쪽 다."""
    pts, vals = it["points"], it["values"]
    if len(pts) != len(vals) or not pts:
        return "점과 값의 개수가 다르거나 비어 있음"
    e = read(it["expr"])
    for pt, ts in zip(pts, vals):
        sub = {sympy.Symbol(k): read(v) for k, v in pt.items()}
        v = sympy.N(e.subs(sub), 30)
        if not defined(v):
            if ts is not None:
                return f"{it['expr']} @ {pt}: sympy 는 정의 안 됨({v}), TS 는 {ts}"
            continue
        if ts is None:
            return f"{it['expr']} @ {pt}: TS 는 정의 안 됨, sympy 는 {v}"
        if abs(float(v) - ts) > 1e-9 * max(1.0, abs(float(v))):
            return f"{it['expr']} @ {pt}: TS {ts} ≠ sympy {v}"
    return None


def _grid(view):
    """보기 범위 안 격자 칸 번호 (i 목록, j 목록)와 칸 간격·범위"""
    xmin, xmax = read(view["x"][0]), read(view["x"][1])
    ymin, ymax = read(view["y"][0]), read(view["y"][1])
    sx, sy = read(view["sx"]), read(view["sy"])
    I = range(int(sympy.ceiling(xmin / sx)), int(sympy.floor(xmax / sx)) + 1)
    J = range(int(sympy.ceiling(ymin / sy)), int(sympy.floor(ymax / sy)) + 1)
    return I, J, sx, sy, (xmin, xmax, ymin, ymax)


def _on_grid(v, step):
    k = sympy.nsimplify(sympy.simplify(v / step))
    return k.is_integer is True


def check_plot(it):
    """좌표 찍기·그리기 과제가 범위 안 격자로 풀리는 문제인가."""
    view = it["view"]
    I, J, sx, sy, (xmin, xmax, ymin, ymax) = _grid(view)
    task = it["task"]
    if task == "point":
        X, Y = evaluate(it["x"]), evaluate(it["y"])
        if not (defined(X) and defined(Y)):
            return f"점 ({X}, {Y}) 가 실수가 아님"
        if not (xmin <= X <= xmax and ymin <= Y <= ymax):
            return f"점 ({X}, {Y}) 가 화면 밖"
        if not (_on_grid(X, sx) and _on_grid(Y, sy)):
            return f"점 ({X}, {Y}) 가 격자 위가 아님"
        return None
    if task == "pointsOn":
        f = read(it["curve"])
        x = sympy.Symbol("x")
        hits = 0
        for i in I:
            Y = sympy.simplify(f.subs(x, i * sx))
            if defined(Y) and ymin <= Y <= ymax and _on_grid(Y, sy):
                hits += 1
        if hits < it["count"]:
            return f"곡선 {it['curve']} 위 격자점 {hits}개 < {it['count']}개"
        return None
    if task == "line":
        # 칸 간격이 유리수일 때만(직선 과제는 형식 검사에서 그렇게 막는다). 분수로 빠르게 센다.
        from fractions import Fraction as F

        def fr(v):
            v = sympy.Rational(evaluate(v)) if isinstance(v, str) else sympy.Rational(v)
            return F(int(v.p), int(v.q))

        fsx, fsy = fr(sx), fr(sy)
        pts = [(i * fsx, j * fsy) for i in I for j in J]
        m = fr(it["slope"]) if "slope" in it else None
        c = fr(it["intercept"]) if "intercept" in it else None
        P = (fr(it["through"][0]), fr(it["through"][1])) if "through" in it else None
        for a in range(len(pts)):
            for b in range(a + 1, len(pts)):
                (x1, y1), (x2, y2) = pts[a], pts[b]
                if x1 == x2:
                    continue
                k = (y2 - y1) / (x2 - x1)
                if m is not None and k != m:
                    continue
                if c is not None and y1 - k * x1 != c:
                    continue
                if P is not None and P[1] - y1 != k * (P[0] - x1):
                    continue
                return None
        return "조건을 만족하는 직선이 범위 안 격자점 2개를 지나지 않음"
    if task == "sketch":
        tol = read(it["tol"])
        if not (tol > 0 and tol <= sx and tol <= sy):
            return f"허용 오차 {tol} 가 0 이하이거나 격자 간격보다 큼"
        f = read(it["curve"])
        x = sympy.Symbol("x")
        for k in range(21):
            X = xmin + (xmax - xmin) * k / 20
            Y = sympy.N(f.subs(x, X), 30)
            if not defined(Y) or not (ymin <= Y <= ymax):
                return f"곡선 {it['curve']} 이 x={X} 에서 정의 안 되거나 화면 밖({Y})"
        return None
    return f"알 수 없는 과제 {task}"


KINDS = {
    "spot": check_spot,
    "equiv": check_equiv,
    "sameeq": check_sameeq,
    "approx": check_approx,
    "parity": check_parity,
    "plot": check_plot,
}


def check_item(it):
    if "kind" in it:
        f = KINDS.get(it["kind"])
        return f(it) if f else f"알 수 없는 kind {it['kind']}"
    typ, ans = it["answerType"], it["answer"]
    val = evaluate(it["check"])
    if typ == "int":
        if not (val.is_integer and val == int(ans)):
            return f"검산값 {val} ≠ 답 {ans}"
    elif typ == "fraction":
        r = Rational(ans)
        if str(r) != ans:
            return f"답 {ans} 이 기약분수 꼴이 아님 (→ {r})"
        if not (val.is_rational and val == r):
            return f"검산값 {val} ≠ 답 {ans}"
    elif typ == "expr":
        a = parse_expr(ans, local_dict=dict(NS), transformations=TRANSFORMS)
        if not equal(val, a):
            return f"검산값 {val} ≠ 답 {a}"
    elif typ == "choice":
        vals = [evaluate(c) for c in it["choiceChecks"]]
        hits = [i + 1 for i, v in enumerate(vals) if equal(v, val)]
        if hits != [int(ans)]:
            return f"검산값 {val} 과 같은 보기 {hits} (답 {ans})"
    else:
        return f"알 수 없는 answerType {typ}"
    return None


def main(path):
    items = json.load(open(path, encoding="utf-8"))
    total, passed = defaultdict(int), defaultdict(int)
    fails = []
    for it in items:
        if it["ref"].startswith("gen:"):
            kind = "생성기 표본"
        elif "/lesson:" in it["ref"]:
            kind = "레슨"
        else:
            kind = "문제·예제"
        key = (it["unit"], kind)
        total[key] += 1
        try:
            err = check_item(it)
        except Exception as e:  # 검산식 자체 오류
            err = f"검산식 오류: {type(e).__name__}: {e}"
        if err:
            fails.append((it["ref"], err))
        else:
            passed[key] += 1
    print(f"{'단원':<28}{'구분':<10}{'통과':>6} / {'전체':<6}")
    for key in sorted(total):
        mark = "" if passed[key] == total[key] else "  ← 실패 있음"
        print(f"{key[0]:<28}{key[1]:<10}{passed[key]:>6} / {total[key]:<6}{mark}")
    print(f"합계: {sum(passed.values())} / {sum(total.values())}")
    if fails:
        print(f"\n실패 {len(fails)}건:")
        for ref, err in fails[:60]:
            print(f"  - {ref}: {err}")
        sys.exit(1)
    print("검산 통과 ✓")


if __name__ == "__main__":
    main(sys.argv[1])
