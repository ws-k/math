import type { Rng } from './rng.ts';
import type { Generator } from './types.ts';
import { jo, paren, polySym, polyTex } from './util.ts';

const UNIT = 'h1-rational-irrational';

// 검산식은 sympy 가 그래프의 성질을 직접 계산하게 쓴다: 세로 점근선은 분모가 0 이 되는 x(solve(denom)),
// 가로 점근선은 x→∞ 극한(limit), 무리함수의 시작점은 근호 안이 0 이 되는 x. 생성기가 정한 p·q 를
// 검산식에 그대로 적으면 "식을 잘못 만들었는데 답도 같이 틀린" 경우가 잡히지 않는다.

const ASYM = '$y=\\dfrac{k}{x-p}+q\\ (k\\neq0)$ 의 점근선은 두 직선 $x=p$, $y=q$ 예요.';
const SQRT =
  '$y=\\sqrt{a(x-p)}+q$ 는 근호 안이 $0$ 이상인 곳에서만 정의되고, 시작점은 $(p,\\ q)$ 예요.';

/** 부호 붙은 상수항: 3 → +3, -3 → -3, 0 → '' */
const plus = (n: number) => (n === 0 ? '' : n < 0 ? `${n}` : `+${n}`);

/** 0 이 아닌 정수 n 의 약수(양·음) */
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= Math.abs(n); d++) if (n % d === 0) out.push(d, -d);
  return out;
}

const pickDivisor = (rng: Rng, n: number) => rng.pick(divisorsOf(n));

export const generators: Generator[] = [
  {
    id: 'rat-asymptote',
    unitId: UNIT,
    title: '유리함수의 점근선',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-4, 4);
        const q = rng.nonzero(-4, 4);
        const k = rng.nonzero(-6, 6);
        // 분자 = q(x-p)+k = qx + (k-qp)
        const c = k - q * p;
        const num = [q, c];
        const den = [1, -p];
        if (p + q === 0) continue;
        return {
          q: `유리함수 $y=\\dfrac{${polyTex(num)}}{${polyTex(den)}}$ 의 그래프의 점근선이 두 직선 $x=m$, $y=n$ 일 때 $m+n$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p + q),
          answerType: 'int',
          check: `f = (${polySym(num)})/(${polySym(den)})\nans = solve(denom(f), x)[0] + limit(f, x, oo)`,
          concepts: [ASYM, '분자를 분모로 나눠 $\\dfrac{k}{x-p}+q$ 꼴로 고쳐 써요.'],
          steps: [
            {
              title: '분자를 분모로 묶기',
              body: `$$${polyTex(num)}=${q === 1 ? '' : q === -1 ? '-' : q}(${polyTex(den)})${plus(k)}$$`,
            },
            {
              title: '나눠 쓰기',
              body: `$$y=\\frac{${k}}{${polyTex(den)}}${plus(q)}$$`,
            },
            {
              title: '점근선 읽기',
              body: `$x=${p}$, $y=${q}$ ${jo(String(q), '이라/라')}서 $m+n=${p}+${paren(q)}=${p + q}$`,
            },
          ],
          tip: `세로 점근선은 분모가 $0$ 이 되는 $x$ 예요. $${polyTex(den)}=0$ 에서 $x=${p}$.`,
        };
      }
    },
  },
  {
    id: 'rat-translate-point',
    unitId: UNIT,
    title: '평행이동한 유리함수 위의 점',
    make(rng) {
      for (;;) {
        const k = rng.pick([-12, -8, -6, -4, -3, -2, 2, 3, 4, 6, 8, 12]);
        const m = rng.nonzero(-4, 4);
        const n = rng.int(-4, 4);
        // 넣는 x 를 x-m 이 k 의 약수가 되게 골라 함숫값이 정수로 떨어지게
        const d = pickDivisor(rng, k);
        const t = m + d;
        const s = k / d + n;
        if (t === 0) continue;
        return {
          q: `함수 $y=\\dfrac{${k}}{x}$ 의 그래프를 $x$축의 방향으로 $${m}$ 만큼, $y$축의 방향으로 $${n}$ 만큼 평행이동한 그래프가 점 $(${t},\\ s)$ 를 지날 때 $s$ 의 값을 구하세요.`,
          choices: null,
          answer: String(s),
          answerType: 'int',
          check: `(${k}/(x - (${m})) + (${n})).subs(x, ${t})`,
          concepts: [
            '$y=f(x)$ 를 $x$축 방향으로 $m$, $y$축 방향으로 $n$ 만큼 평행이동하면 $y-n=f(x-m)$ 이에요.',
          ],
          steps: [
            {
              title: '옮긴 식',
              body: `$$y=\\frac{${k}}{${polyTex([1, -m])}}${plus(n)}$$`,
            },
            {
              title: `x=${t} 넣기`,
              body: `$$s=\\frac{${k}}{${t}-${paren(m)}}${plus(n)}=\\frac{${k}}{${d}}${plus(n)}$$`,
            },
            { title: '계산하기', body: `$$s=${k / d}${plus(n)}=${s}$$` },
          ],
          tip: `$x$축 방향으로 $${m}$ 만큼 옮기면 식에는 $x-${paren(m)}$ 로 들어가요. 부호를 조심해요.`,
        };
      }
    },
  },
  {
    id: 'irr-domain-range',
    unitId: UNIT,
    title: '무리함수의 정의역과 치역',
    make(rng) {
      for (;;) {
        const a = rng.pick([-3, -2, -1, 1, 2, 3]);
        const p = rng.int(-4, 4);
        const c = rng.int(-5, 5);
        // 근호 안 ax+b = a(x-p)
        const b = -a * p;
        const inside = [a, b];
        if (p + c === 0 || b === 0) continue;
        const ge = a > 0;
        const dom = ge ? '\\ge' : '\\le';
        return {
          q: `함수 $y=\\sqrt{${polyTex(inside)}}${plus(c)}$ 의 정의역이 $\\{x\\mid x${dom} m\\}$, 치역이 $\\{y\\mid y\\ge n\\}$ 일 때 $m+n$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p + c),
          answerType: 'int',
          check: `m0 = solve(Eq(${polySym(inside)}, 0), x)[0]\nans = m0 + (sqrt(${polySym(inside)}) + (${c})).subs(x, m0)`,
          concepts: [SQRT],
          steps: [
            {
              title: '근호 안은 0 이상',
              body: `$$${polyTex(inside)}\\ge0,\\quad x${dom}${p}$$`,
            },
            {
              title: '근호의 가장 작은 값',
              body: `$\\sqrt{\\ }$ 는 $0$ 이상이고 $x=${p}$ 에서 $0$ 이라 $y\\ge${c}$ ${jo(String(c), '이에요/예요')}.`,
            },
            { title: '더하기', body: `$$m+n=${p}+${paren(c)}=${p + c}$$` },
          ],
          tip:
            a > 0
              ? '$x$ 의 계수가 양수면 시작점에서 오른쪽으로 그려져요.'
              : `$x$ 의 계수가 음수면 시작점에서 왼쪽으로 그려져서 정의역이 $x\\le${p}$ ${jo(String(p), '이에요/예요')}.`,
        };
      }
    },
  },
  {
    id: 'irr-through-point',
    unitId: UNIT,
    title: '무리함수가 지나는 점으로 계수 정하기',
    make(rng) {
      for (;;) {
        const r = rng.int(1, 4);
        const d = pickDivisor(rng, r * r);
        // 근호 안 a·d 가 r² 이 되게: a = r²/d
        const a = (r * r) / d;
        if (Math.abs(a) > 9 || a === 1) continue;
        const m = rng.int(-3, 3);
        const n = rng.int(-3, 3);
        const t = m + d;
        const s = n + r;
        const da = d === 1 ? 'a' : d === -1 ? '-a' : `${d}a`;
        return {
          q: `함수 $y=\\sqrt{ax}$ 의 그래프를 $x$축의 방향으로 $${m}$ 만큼, $y$축의 방향으로 $${n}$ 만큼 평행이동한 그래프가 점 $(${t},\\ ${s})$ 를 지날 때 상수 $a$ 의 값을 구하세요.`,
          choices: null,
          answer: String(a),
          answerType: 'int',
          check: `solve(Eq(sqrt(a*(${t} - (${m}))) + (${n}), ${s}), a)[0]`,
          concepts: [
            SQRT,
            '$y=\\sqrt{ax}$ 를 $x$축 방향으로 $m$, $y$축 방향으로 $n$ 만큼 옮기면 $y=\\sqrt{a(x-m)}+n$ 이에요.',
          ],
          steps: [
            {
              title: '옮긴 식',
              body: `$$y=\\sqrt{a(${polyTex([1, -m])})}${plus(n)}$$`,
            },
            {
              title: '점 넣기',
              body: `$$${s}=\\sqrt{a(${t}-${paren(m)})}${plus(n)},\\quad \\sqrt{${da}}=${r}$$`,
            },
            { title: '양변 제곱하기', body: `$$${da}=${r * r},\\quad a=${a}$$` },
          ],
          tip:
            a < 0
              ? '$a$ 가 음수면 근호 안 $a(x-m)$ 이 $0$ 이상이 되도록 $x\\le m$ 쪽에 그래프가 있어요.'
              : '제곱하기 전에 $\\sqrt{\\ }$ 쪽 값이 $0$ 이상인지 확인해요.',
        };
      }
    },
  },
];
