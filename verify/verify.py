"""npm run verify 2단계: 모든 문제의 check(검산식)를 sympy 로 계산해 answer 와 비교한다.

check 는 sympy 식 문자열이다. 예) "Rational(2,3) + Rational(1,4)", "diff((x+2)*(2*x**2-x-2), x).subs(x, 1)"
여러 줄이 필요하면 마지막 줄에 'ans = ...' 를 둔다.
"""
import ast
import json
import multiprocessing
import os
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


def _div(a, b):
    """정수 ÷ 정수는 분수로. 파이썬 그대로면 2**5*2**3/2**4 가 실수 16.0 이 되어 정수 답과 어긋나고,
    (-3+3)/2 가 0.0 이 된다(요청 36·107). 소수나 sympy 값이 끼면 원래 나눗셈 그대로."""
    if type(a) is int and type(b) is int:
        return Rational(a, b)
    return a / b


class _ExactDiv(ast.NodeTransformer):
    """검산식의 '/' 를 _div 호출로 바꾼다. 전역 계산을 통째로 sympy 정수로 바꾸면 반복문이 많은 검산식이 느려지고
    range·문자열 서식 같은 파이썬 쪽 동작까지 달라지므로, 문제가 된 정수 나눗셈 하나만 고친다."""

    def visit_BinOp(self, node):
        self.generic_visit(node)
        if isinstance(node.op, ast.Div):
            return ast.copy_location(
                ast.Call(ast.Name("_div", ast.Load()), [node.left, node.right], []), node
            )
        return node

    def visit_AugAssign(self, node):
        self.generic_visit(node)
        if isinstance(node.op, ast.Div) and isinstance(node.target, ast.Name):
            load = ast.Name(node.target.id, ast.Load())
            call = ast.Call(ast.Name("_div", ast.Load()), [load, node.value], [])
            return ast.copy_location(ast.Assign([node.target], call), node)
        return node


def _compile(code, mode):
    tree = ast.fix_missing_locations(_ExactDiv().visit(ast.parse(code, mode=mode)))
    return compile(tree, "<검산식>", mode)


def evaluate(code):
    code = code.strip()
    env = dict(NS)
    env["_div"] = _div
    if "\n" in code or code.startswith("ans"):
        exec(_compile(code, "exec"), env)
        if "ans" not in env:
            raise ValueError("여러 줄 검산식에는 'ans = ...' 가 필요합니다")
        return sympify(env["ans"])
    return sympify(eval(_compile(code, "eval"), env))


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
            # 글자는 sympy 가 유리수로 읽게 한다 — 파이썬 나눗셈("2/3")은 0.666… 실수가 되어 정확한 비교가 어긋난다
            v = sympy.Rational(sympy.sympify(v, rational=True)) if isinstance(v, str) else sympy.Rational(v)
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


def _round(v, d):
    """0.5 는 0 에서 먼 쪽으로 반올림한 값(유리수)"""
    r = sympy.floor(sympy.N(abs(v) * 10**d, 60) + Rational(1, 2))
    return (-r if v < 0 else r) / 10**d


def check_root(it):
    """값이 방정식의 해인가. 미지수는 하나(이름 무관), 값이 해 집합 안에 있으면 통과. digits 면 근삿값."""
    l, r = parse_eq(it["eq"])
    syms = (l - r).free_symbols
    if len(syms) != 1:
        return f"미지수가 하나인 방정식이 아님: {it['eq']}"
    sols = sympy.solveset(sympy.Eq(l, r), syms.pop(), domain=sympy.S.Reals)
    if "digits" in it:
        if not sols.is_FiniteSet:
            return f"해가 유한 개가 아님: {sols}"
        want = Rational(it["value"])
        if not any(_round(s, int(it["digits"])) == want for s in sols):
            return f"{it['value']} 이 해 {sols} 의 근삿값이 아님"
        return None
    if Rational(it["value"]) not in sols:
        return f"{it['value']} 이 {it['eq']} 의 해 {sols} 에 없음"
    return None


def _root_count(v):
    """x 의 식 v 의 서로 다른 실근 개수(앱은 스투름 열로 센다 — 여기서는 solveset 으로 따로). 무수히 많으면 None"""
    sols = sympy.solveset(v, sympy.Symbol("x"), domain=sympy.S.Reals)
    return sympy.Integer(len(sols)) if sols.is_FiniteSet else None


def _goal_match(v, t, tol):
    """목표 판정 한 칸: 둘 다 실수이고, tol=0 이면 정확히 같고, 아니면 |v−t| ≤ tol(정확한 값으로)."""
    if v is None or not (defined(v) and defined(t)):
        return False
    if tol == 0:
        if v.is_Rational and t.is_Rational:
            return v == t
        # 30자리에서 이미 다르면 다르다(빠른 길). 아주 가까울 때만 기호로 확인한다
        if abs(sympy.N(v - t, 30)) > sympy.Float("1e-25"):
            return False
        return equal(v, t)
    return bool(sympy.N(sympy.Abs(v - t), 50) <= tol)


def check_goal(it):
    """부품 목표 판정(원칙 P7): 끌기·슬라이더로 닿는 모든 상태(states)에서 앱이 '목표에 닿았다'고 본 상태(hits)가
    sympy 로 다시 판정한 것과 같은가. 목표마다 need 곳 이상 닿을 수 있어야 하고(닿을 수 없는 목표 금지),
    허용 오차가 있으면(무리수 목표, 원칙 P10) 닿는 자리가 정확히 need 곳이어야 한다 — 오차 안에 자리가 여럿이면
    더듬어 맞히기가 되거나 정답이 아닌 자리를 맞았다고 하게 된다."""
    comps = [(read(c["expr"]), bool(c.get("roots"))) for c in it["of"]]
    targets = [[read(t) for t in tg] for tg in it["targets"]]
    tol = read(it["tol"])
    got = [[] for _ in targets]
    for k, st in enumerate(it["states"]):
        sub = {sympy.Symbol(n): read(v) for n, v in st.items()}
        vals = []
        for e, roots in comps:
            v = e.subs(sub)
            vals.append(_root_count(v) if roots else v)
        for ti, tg in enumerate(targets):
            if all(_goal_match(v, t.subs(sub), tol) for v, t in zip(vals, tg)):
                got[ti].append(k)
    if got != it["hits"]:
        return f"앱 판정 {it['hits']} ≠ sympy 판정 {got} (상태 번호, 목표마다)"
    need = int(it["need"])
    for ti, h in enumerate(got):
        if len(h) < need:
            return f"목표 {ti + 1} 에 닿는 상태가 {len(h)}곳 < {need}곳 (닿을 수 없는 목표)"
        if tol != 0 and len(h) != need:
            return f"허용 오차 {tol} 안에 드는 상태가 {len(h)}곳 — 정답 자리가 {need}곳이어야 함"
    return None


KINDS = {
    "goal": check_goal,
    "root": check_root,
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


def _run(it):
    try:
        return check_item(it)
    except Exception as e:  # 검산식 자체 오류
        return f"검산식 오류: {type(e).__name__}: {e}"


# 이만큼 넘으면 여러 프로세스로 나눠 검산한다(요청 61, 전체 검산 6분). 적으면 프로세스를 띄우는 시간이 더 든다
PARALLEL_FROM = 300


def run_all(items):
    """항목마다 실패 까닭(통과면 None). 순서는 입력 그대로 — 나눠 돌려도 출력이 같게."""
    if len(items) < PARALLEL_FROM:
        return [_run(it) for it in items]
    # spawn: macOS 에서 fork 는 시스템 라이브러리와 섞이면 멈출 수 있다. 작은 묶음(chunksize)으로 나눠야
    # 느린 단원(로그부등식 생성기 등)의 항목이 한 프로세스에 몰리지 않는다
    with multiprocessing.get_context("spawn").Pool(os.cpu_count() or 2) as pool:
        return pool.map(_run, items, chunksize=16)


def main(path):
    items = json.load(open(path, encoding="utf-8"))
    total, passed = defaultdict(int), defaultdict(int)
    fails = []
    for it, err in zip(items, run_all(items)):
        if it["ref"].startswith("gen:"):
            kind = "생성기 표본"
        elif "/lesson:" in it["ref"]:
            kind = "레슨"
        else:
            kind = "문제·예제"
        key = (it["unit"], kind)
        total[key] += 1
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
