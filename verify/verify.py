"""npm run verify 2단계: 모든 문제의 check(검산식)를 sympy 로 계산해 answer 와 비교한다.

check 는 sympy 식 문자열이다. 예) "Rational(2,3) + Rational(1,4)", "diff((x+2)*(2*x**2-x-2), x).subs(x, 1)"
여러 줄이 필요하면 마지막 줄에 'ans = ...' 를 둔다.
"""
import ast
import json
import multiprocessing
import os
import re
import sys
from collections import defaultdict

import sympy
from sympy import Rational, simplify, sympify
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    rationalize,
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
        if simplify(a - b) == 0:
            return True
    except Exception:
        return False
    return _exact_zero(a - b)


# 역삼각함수 → (원래 함수, 각/π 의 범위). acos 의 값은 [0, π], asin·atan 은 [−π/2, π/2]
_INVERSE = {sympy.acos: (sympy.cos, 0, 1), sympy.asin: (sympy.sin, -Rational(1, 2), Rational(1, 2)),
            sympy.atan: (sympy.tan, -Rational(1, 2), Rational(1, 2))}
_ARC = (sympy.acos, sympy.asin, sympy.atan)
_Z = sympy.Symbol("_z")

# 최소다항식 차수 상한. 소수 다섯 개의 제곱근 합(64차)은 3초에 끝나지만 여섯 개(128차)는 90초를 넘겼다(검토 실험) —
# 검산 한 항목이 몇 분씩 붙잡히지 않게, 이보다 클 수 있는 수는 계산을 시작하지 않는다. 도형판(격자점·15° 칸 원)에서
# 나오는 수는 근호 몇 개짜리라 이 안에 든다
MINPOLY_MAX_DEG = 64


class ProofTooHard(Exception):
    """수치로는 같아 보이는데 최소다항식 차수가 상한을 넘어 정확히 같은지 증명하지 않았다. '다르다'로 넘기면 맞는 항목이
    소리 없이 다르다고 판정되므로, 어느 항목인지 드러나게 검산 실패로 올린다."""


def _deg_bound(e):
    """수 e 가 든 수체의 차수 상한(계산 전에 어림). 유리수의 제곱근들은 근호 안의 제곱 인수 없는 부분이 서로 몇 개
    독립인지(GF(2) 위 계수, r)로 정확히 2^r — √2·√3·√6 은 4 이지 8 이 아니다. 나머지 근호는 지수의 분모,
    π 의 분수배 각의 삼각함수는 원분체 차수 φ(4L), CRootOf 는 그 다항식 차수, 허수 단위는 2 를 곱한다."""
    basis = []  # 제곱근 안 소인수 집합(비트)들의 GF(2) 기저
    primes = {}
    bound = 1

    def add_vec(v):
        for b in basis:
            v = min(v, v ^ b)
        if v:
            basis.append(v)

    for a in e.atoms(sympy.Pow):
        x = a.exp
        if not x.is_Rational or x.is_Integer:
            continue
        b = a.base
        if x.q == 2 and b.is_Rational:
            n = b.p * b.q  # √(p/q) 와 √(pq) 는 같은 수체
            # 큰 수는 소인수분해가 느리다 — 다른 것과 독립이라고 치면(상한이 커질 뿐) 안전하다
            fs = sympy.factorint(abs(n)) if abs(n) < 10**12 else {("big", n): 1}
            v = 0
            for pr in [p for p, k in fs.items() if k % 2] + ([-1] if n < 0 else []):
                v |= 1 << primes.setdefault(pr, len(primes))
            add_vec(v)
        else:
            bound *= x.q
    # cos·sin·tan(pπ/q) 는 모두 원분체 Q(ζ_4L)(L = 분모들의 최소공배수) 안에 있다 — 각각 곱하면
    # sin(π/7)·sin(2π/7)·sin(3π/7) 이 432 로 어림되어 3차로 끝날 증명까지 막는다
    dens = [c.q for f in e.atoms(sympy.cos, sympy.sin, sympy.tan)
            if (c := f.args[0] / sympy.pi).is_Rational]
    if dens:
        bound *= sympy.totient(4 * sympy.ilcm(*dens))
    for r in e.atoms(sympy.CRootOf):
        bound *= r.poly.degree()
    if e.has(sympy.I):
        bound *= 2
    return bound * 2 ** len(basis)


def _minpoly_is_x(e):
    """e 의 최소다항식이 x 인가(= e 가 정확히 0). 차수 상한을 넘을 수 있으면 계산하지 않고 ProofTooHard"""
    b = _deg_bound(e)
    if b > MINPOLY_MAX_DEG:
        s = sympy.sstr(e)
        raise ProofTooHard(f"최소다항식 차수가 최대 {b} 로 상한 {MINPOLY_MAX_DEG} 을 넘어 증명하지 않음: "
                           f"{s[:120]}{'…' if len(s) > 120 else ''}")
    return sympy.minimal_polynomial(e, _Z) == _Z


def _unabs(d):
    """Abs(u) 를 부호를 정해 ±u 로(cos 덧셈정리가 Abs 를 풀지 못하므로). u 가 0 에 아주 가까우면 부호를 수치로 정할 수
    없어 u 가 정확히 0 임을 따로 증명해 0 으로 바꾼다. 못 하면 None"""
    rep = {}
    for a in d.atoms(sympy.Abs):
        u = a.args[0]
        v = sympy.N(u, 30)
        if not v.is_real:
            return None
        if abs(v) > sympy.Float("1e-20"):
            rep[a] = u if v > 0 else -u
        elif _exact_zero(u):
            rep[a] = sympy.Integer(0)
        else:
            return None
    return d.xreplace(rep)


def _cos_proof(d):
    """|d| 가 아주 작고(호출 전 확인) cos(k·d) = 1 이 정확하면 d = 0 이다 — cos 가 1 이 되는 곳은 2π 의 정수배뿐이고
    |k·d| < 2π 이므로. k 는 1(라디안)과 π/180(도: deg(acos …) 는 180·acos/π). 격자점 각처럼 π 의 분수배가 아닌 각들의
    합·차(탈레스 ∠A + ∠B = 90°)에 쓴다: cos(acos a + acos b) 는 덧셈정리로 a·b − √(1−a²)·√(1−b²) 같은 대수적 수가
    되어 최소다항식으로 판정된다."""
    d = _unabs(d)
    if d is None:
        return False
    for k in (sympy.Integer(1), sympy.pi / 180):
        e = sympy.expand(d * k)
        # 역삼각함수 앞 계수가 작은 정수일 때만 — cos(180·x) 같은 것을 펼치면 180차 다항식이 되어 끝나지 않는다
        terms = [t for t in sympy.Add.make_args(e) if t.has(*_ARC)]
        if not all(t.as_independent(*_ARC)[0].is_Integer and abs(t.as_independent(*_ARC)[0]) <= 4
                   and t.as_independent(*_ARC)[1].func in _ARC for t in terms):
            continue
        c = sympy.expand_trig(sympy.cos(e))
        if c.has(*_ARC):
            continue
        if _minpoly_is_x(c - 1):
            return True
    return False


def _exact_zero(d):
    """simplify 가 0 을 못 보인 수 d 가 정확히 0 인가(변수 없는 수만). 원 위 15° 자리의 각처럼 cos 값이 겹근호 식이면
    acos(겹근호) 가 풀리지 않아 simplify 가 deg(acos(…)) − 60 을 0 으로 줄이지 못한다(요청 106 묶음).

    수치는 '어디를 볼지' 정하는 데만 쓰고, 같다는 결론은 늘 대수적 증명으로 낸다(가까운 다른 값을 같다고 하지 않게):
    1) 30자리에서 이미 다르면 다르다.
    2) acos(z) 마다 각/π 를 수치로 어림한 분수 q 를 구하고, z − cos(qπ) 의 최소다항식이 x 일 때만(= 정확히 0)
       acos(z) 를 qπ 로 바꾼다. asin·atan 도 같다. 한 각에서 난 오류는 그 각만 건너뛴다.
    3) 바꾼 뒤의 수가 대수적 수이고 그 최소다항식이 x 면 0.
    4) 역삼각함수가 남으면(π 의 분수배가 아닌 각들의 합·차) cos(d) = 1 을 대수적으로 보인다(_cos_proof).
    증명 못 하면(초월수·계산 실패) 다르다고 본다 — 틀리게 '같다'고 하는 것보다 검산 실패로 드러나는 쪽이 안전하다.
    차수 상한 때문에 증명을 건너뛴 길이 있었으면 ProofTooHard 로 알린다."""
    try:
        if d.free_symbols or abs(sympy.N(d, 30)) > sympy.Float("1e-25"):
            return False
    except Exception:
        return False
    hard = []

    def proven(f):
        try:
            return f()
        except ProofTooHard as ex:
            hard.append(ex)
        except Exception:
            pass
        return False

    rep = {}
    for f in d.atoms(*_ARC):
        try:
            fwd, lo, hi = _INVERSE[type(f)]
            # 40자리로 어림해 1e-30 안의 분수를 찾는다: 어림 오차(1e-40)보다 넉넉히 크고, 분모 720 이하 분수끼리의
            # 간격(1/720² ≈ 2e-6)보다는 한참 작아 맞는 분수 하나만 걸린다. 분수는 후보일 뿐 증명은 최소다항식이 한다
            th = sympy.N(f / sympy.pi, 40)
            q = sympy.nsimplify(th, rational=True, tolerance=sympy.Rational(1, 10**30))
        except Exception:
            continue
        # 분모 720(= 0.25° 단위)까지만 후보로: 격자점·15° 칸 원에서 나오는 각은 분모가 작고(7.5° = π/24),
        # 그보다 큰 분모는 π 의 분수배가 아닌 각을 어림한 가짜 분수다(그런 각은 4번 길이 맡는다)
        if not (q.is_Rational and q.q <= 720 and lo <= q <= hi):
            continue
        if proven(lambda f=f, fwd=fwd, q=q: _minpoly_is_x(f.args[0] - fwd(q * sympy.pi))):
            rep[f] = q * sympy.pi
    # 바꾼 것이 없으면 다시 정리하지 않는다 — equal 이 같은 수를 이미 simplify 했고, 근호가 많은 수는 simplify 가
    # 몇 분씩 걸려 차수 상한으로 막기 전에 붙잡힌다
    e = d
    if rep:
        try:
            e = sympy.simplify(d.xreplace(rep))
        except Exception:
            e = d.xreplace(rep)
    if e.is_Rational:
        return e == 0
    if not e.has(*_ARC):
        if proven(lambda: _minpoly_is_x(e)):
            return True
    elif proven(lambda: _cos_proof(e)):
        return True
    if hard:
        raise hard[0]
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


# ---- 틀린 곳 찾기(spot) 식 ----
# 소수는 글자 그대로 분수로 읽는다(rationalize). 부동소수로 읽으면 0.1+0.2=0.3 이 '성립 안 함'이 되고
# 0.1+0.2=0.30000000000000004 가 '성립'이 되어 판정이 거꾸로 난다(요청 17)
SPOT_TRANSFORMS = standard_transformations + (rationalize,)
_REL = {"<=": sympy.Le, ">=": sympy.Ge, "<": sympy.Lt, ">": sympy.Gt, "=": sympy.Eq}
_REL_RE = re.compile(r"<=|>=|<|>|=")
# 부정적분의 적분상수. 소문자는 NS 에 이미 기호로 있고, 대문자 C 는 sympy 에 없는 이름이라 여기서만 둔다
_CONST = sympy.Symbol("C")


def _limit(f, v, a, d="+-"):
    """화면의 x→a 는 양쪽 극한이다. sympy 의 Limit 기본은 오른쪽(+)이라 그대로 두면 lim |x|/x (x→0) 이 1 이 되어
    '극한 없음' 함정이 성립하는 식으로 읽힌다. 한쪽 극한은 화면에 a+ · a- 로 보이는 넷째 인자로만."""
    return sympy.Limit(f, v, a, d)


SPOT_NS = dict(NS, C=_CONST, Limit=_limit)
_BIG = (sympy.Sum, sympy.Integral, sympy.Limit)


def _spot_read(s):
    """식 하나. ÷ 는 / 와 우선순위·결합 방향이 같아(파이썬과 같게 sym.ts 가 읽는다) 글자만 바꿔 읽어도 같은 식이다"""
    return parse_expr(s.replace("÷", "/"), local_dict=dict(SPOT_NS), transformations=SPOT_TRANSFORMS)


def parse_spot(s):
    """spot 식 → (왼쪽, 관계, 오른쪽). 관계가 없는 식(등식 아닌 식)은 (식, None, None)"""
    ops = _REL_RE.findall(s)
    if not ops:
        return _spot_read(s), None, None
    if len(ops) != 1:
        raise ValueError(f"등호·부등호가 하나인 식이 아님: {s}")
    left, right = _REL_RE.split(s)
    return _spot_read(left), ops[0], _spot_read(right)


def _limit_value(lim):
    """양쪽 극한이 다르면 sympy 는 예외를 낸다 — '극한 없음'은 어떤 값과도 같지 않은 nan 으로 둔다.
    고친 식 쪽이 nan 이면 성립하지 않아 검산 실패로 드러난다"""
    try:
        return lim.doit()
    except ValueError:
        return sympy.nan


def _calc(e):
    """∑·∫·lim 을 계산한 값. 계산하지 못하고 남으면 '성립 안 함'으로 넘기지 않고 오류로 올린다 — 틀린 식 쪽에서
    소리 없이 '틀렸다'로 통과하면 검산이 아무것도 보지 않은 셈이 된다"""
    if not e.has(*_BIG):
        return e
    e = e.replace(lambda a: isinstance(a, sympy.Limit), _limit_value).doit()
    if e.has(*_BIG):
        raise ValueError(f"sympy 가 계산하지 못한 식: {e}")
    return e


def _indefinite(e):
    return [i for i in e.atoms(sympy.Integral) if any(len(lim) == 1 for lim in i.limits)]


def spot_holds(left, op, right):
    """식이 성립하는가. 등식은 항등식인가, 부등식은 미지수가 없으면 참인가·하나면 모든 실수에서 참인가."""
    if op == "=":
        ints = _indefinite(left) + _indefinite(right)
        if not ints:
            return equal(_calc(left), _calc(right))
        # 부정적분은 '원시함수 + 적분상수' 묶음이다. 한쪽에만 상수가 있으면(C 를 빠뜨림) 같은 식이 아니고,
        # 양쪽에 있으면 적분변수로 미분해 같은지 본다(상수만큼 달라도 같은 묶음)
        vs = {lim[0] for i in ints for lim in i.limits}
        if len(vs) != 1:
            raise ValueError(f"부정적분의 적분변수가 하나가 아님: {vs}")
        v = vs.pop()

        def has_const(e):
            return bool(_indefinite(e)) or _CONST in e.free_symbols

        if has_const(left) != has_const(right):
            return False
        return equal(sympy.diff(_calc(left) - _calc(right), v), 0)
    lv, rv = _calc(left), _calc(right)
    syms = (lv - rv).free_symbols
    rel = _REL[op](lv, rv)
    if not syms:
        if rel not in (sympy.true, sympy.false):
            raise ValueError(f"참·거짓을 정하지 못한 부등식: {rel}")
        return rel == sympy.true
    if len(syms) != 1:
        raise ValueError(f"부등식은 미지수 하나까지 판정: {rel}")
    return sympy.solveset(rel, syms.pop(), domain=sympy.S.Reals) == sympy.S.Reals


def spot_solutions(left, op, right):
    lv, rv = _calc(left), _calc(right)
    syms = (lv - rv).free_symbols
    if len(syms) != 1:
        raise ValueError(f"미지수가 하나인 식이 아님: {lv} {op} {rv}")
    return sympy.solveset(_REL[op](lv, rv), syms.pop(), domain=sympy.S.Reals)


def check_spot(it):
    """틀린 곳 찾기: 틀린 식은 성립하지 않고(또는 해·값이 달라지고), 고친 식은 성립해야(해·값이 같아야) 한다.
    identity: 등식·부등식이 늘 성립하는가 / equivalent: from 과 해 집합이 같은가 /
    value: 등식이 아닌 식 — 보이는 식 from 이나 숨은 검산식 check(문제 check 와 같은 문법)와 값이 같은가."""
    wrong, fixed = parse_spot(it["wrong"]), parse_spot(it["fixed"])
    mode = it["mode"]
    if mode == "value":
        if wrong[1] or fixed[1]:
            return "등식 아닌 식(value)에 등호·부등호가 있음"
        if ("from" in it) == ("check" in it):
            return "value 는 from(보이는 식)·check(숨은 검산식) 중 하나만"
        want = _spot_read(it["from"]) if "from" in it else evaluate(it["check"])
        if spot_holds(wrong[0], "=", want):
            return f"틀린 식 {it['wrong']} 의 값이 {want} 와 같음"
        if not spot_holds(fixed[0], "=", want):
            return f"고친 식 {it['fixed']} 의 값이 {want} 와 다름"
        return None
    if wrong[1] is None or fixed[1] is None:
        return "등호·부등호가 없는 식"
    if mode == "identity":
        if spot_holds(*wrong):
            return f"틀린 식 {it['wrong']} 이 사실은 항등식"
        if not spot_holds(*fixed):
            return f"고친 식 {it['fixed']} 이 항등식이 아님"
        return None
    if mode == "equivalent":
        want = spot_solutions(*parse_spot(it["from"]))
        if spot_solutions(*fixed) != want:
            return f"고친 식의 해 {spot_solutions(*fixed)} ≠ 원래 식의 해 {want}"
        if spot_solutions(*wrong) == want:
            return f"틀린 식 {it['wrong']} 의 해가 원래 식과 같음 {want}"
        return None
    return f"알 수 없는 mode {mode}"


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
    """x 의 다항식 v 의 서로 다른 실근 개수. 앱(poly.ts)과 같은 스투름 셈이지만 sympy 구현(Poly.count_roots)으로 따로 —
    solveset 은 3차 441상태에 25초가 걸려 검산이 느려졌다. 0 인 다항식(무수히 많음)이면 None"""
    p = sympy.Poly(v, sympy.Symbol("x"))
    return None if p.is_zero else sympy.Integer(p.count_roots())


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
    # 곡선 식의 소수(0.1)는 분수로 — 앱은 소수 계수를 분수로 정확히 계산하므로(expr.ts evalExact) 실수로 읽으면
    # 0.1·3 = 0.30000000000000004 처럼 어긋나 앱과 다른 판정이 난다
    def exact(s):
        return sympy.nsimplify(read(s), rational=True)

    comps = [(exact(c["expr"]), bool(c.get("roots"))) for c in it["of"]]
    targets = [[exact(t) for t in tg] for tg in it["targets"]]
    tol = read(it["tol"])
    got = [[] for _ in targets]
    for k, st in enumerate(it["states"]):
        sub = {sympy.Symbol(n): read(v) for n, v in st.items()}
        # 한꺼번에 대입: 차례로 넣으면 x/√(x²+y²) 에 x=0 이 먼저 들어가 0 이 되고 y=0 이 들어가도 0 으로 남아,
        # 점이 꼭짓점과 겹쳐 각을 정할 수 없는 자리(0/0)가 90° 로 나온다
        vals = []
        for e, roots in comps:
            v = e.subs(sub, simultaneous=True)
            vals.append(_root_count(v) if roots else v)
        try:
            for ti, tg in enumerate(targets):
                if all(_goal_match(v, t.subs(sub, simultaneous=True), tol) for v, t in zip(vals, tg)):
                    got[ti].append(k)
        except ProofTooHard as ex:
            return f"상태 {k} {st}: {ex}"
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
