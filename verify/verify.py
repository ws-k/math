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


KINDS = {"spot": check_spot, "equiv": check_equiv}


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
