import type { Generator } from './types.ts';
import { polyDiff, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-velocity';

// 수직선 위 운동은 "위치 → (미분) → 속도 → (미분) → 가속도" 한 줄기라, 풀이는 늘 이 순서로
// 한 번에 하나씩 미분해 적는다. 운동 방향이 바뀌는 순간을 묻는 유형은 손계산이 맞게 떨어지도록
// 속도가 0 이 되는 두 시각(0<α<β)에서 위치 식을 거꾸로 만든다: v(t)=3A(t-α)(t-β).
// 검산식은 sympy 로 위치 식을 직접 미분하고, 방향이 바뀌는 시각은 "v=0 이고 앞뒤 부호가 다른 t"로
// 골라 풀이의 인수분해를 거치지 않는다. 생성기 id 는 모두 'math2-velocity-' 로 시작한다.

const ieyo = (tex: string | number) => (/[013678]$/.test(String(tex)) ? '이에요' : '예요');

/** t-α 를 글로 */
const lin = (r: number) => (r === 0 ? 't' : r > 0 ? `t-${r}` : `t+${-r}`);

/** g(k) 를 항별 값으로 풀어 쓴 글: "12-24+9=-3". 0 인 항은 뺀다 */
function subTex(g: number[], k: number): string {
  const deg = g.length - 1;
  const vals = g.map((c, i) => c * k ** (deg - i)).filter((v) => v !== 0);
  const ans = polyEval(g, k);
  const expr = vals.length
    ? vals.map((v, i) => (i === 0 || v < 0 ? String(v) : `+${v}`)).join('')
    : '0';
  return expr === String(ans) ? expr : `${expr}=${ans}`;
}

const lead = (X: number[]) =>
  `수직선 위를 움직이는 점 P 의 시각 $t$ $(t\\ge0)$ 에서의 위치 $x$ 가 $x=${polyTex(X, 't')}$ ${ieyo(polyTex(X, 't'))}.`;

const V = '속도 $v=\\frac{dx}{dt}$';
const ACC = '가속도 $a=\\frac{dv}{dt}$';
const TURN = '운동 방향이 바뀌는 순간: $v=0$ 이고 그 앞뒤에서 $v$ 의 부호가 바뀜';

/** 아무 삼차 위치 식: x=at^3+bt^2+ct+d */
function anyCubic(rng: Parameters<Generator['make']>[0]): number[] {
  return [rng.pick([1, -1, 2]), rng.int(-6, 6), rng.int(-10, 10), rng.int(-5, 5)];
}

export const generators: Generator[] = [
  {
    id: 'math2-velocity-speed-at',
    unitId: UNIT,
    title: '주어진 시각의 속도',
    make(rng) {
      for (;;) {
        const X = anyCubic(rng);
        const k = rng.int(1, 4);
        const v = polyDiff(X);
        const ans = polyEval(v, k);
        if (ans === 0 || Math.abs(ans) > 100) continue;
        return {
          q: `${lead(X)} $t=${k}$ 에서 점 P 의 속도를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff(${polySym(X, 't')}, t).subs(t, ${k})`,
          concepts: [V, "$(t^n)'=nt^{n-1}$"],
          steps: [
            {
              title: '위치를 미분해 속도 구하기',
              body: `$$v=\\frac{dx}{dt}=${polyTex(v, 't')}$$`,
            },
            { title: `$t=${k}$ 대입하기`, body: `$$v=${subTex(v, k)}$$` },
          ],
          tip:
            ans < 0
              ? '속도가 음수이면 그 순간 점 P 는 음의 방향으로 움직이고 있어요.'
              : '속도가 양수이면 그 순간 점 P 는 양의 방향으로 움직이고 있어요.',
        };
      }
    },
  },
  {
    id: 'math2-velocity-accel-at',
    unitId: UNIT,
    title: '주어진 시각의 가속도',
    make(rng) {
      for (;;) {
        const X = anyCubic(rng);
        const k = rng.int(1, 4);
        const v = polyDiff(X);
        const a = polyDiff(v);
        const ans = polyEval(a, k);
        if (ans === 0 || Math.abs(ans) > 100) continue;
        return {
          q: `${lead(X)} $t=${k}$ 에서 점 P 의 가속도를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff(${polySym(X, 't')}, t, 2).subs(t, ${k})`,
          concepts: [V, ACC],
          steps: [
            { title: '속도 구하기', body: `$$v=\\frac{dx}{dt}=${polyTex(v, 't')}$$` },
            { title: '가속도 구하기', body: `$$a=\\frac{dv}{dt}=${polyTex(a, 't')}$$` },
            { title: `$t=${k}$ 대입하기`, body: `$$a=${subTex(a, k)}$$` },
          ],
          tip: '가속도는 위치를 두 번 미분한 값이에요. 위치를 한 번만 미분하면 속도에서 멈춰요.',
        };
      }
    },
  },
  {
    id: 'math2-velocity-turn',
    unitId: UNIT,
    title: '운동 방향이 바뀌는 순간',
    make(rng) {
      for (;;) {
        const A = rng.pick([1, 2]);
        const al = rng.int(1, 3);
        const be = al + rng.int(1, 3);
        const b2 = -3 * A * (al + be);
        if (b2 % 2 !== 0) continue;
        const X = [A, b2 / 2, 3 * A * al * be, rng.int(-5, 5)];
        const v = polyDiff(X);
        const a = polyDiff(v);
        // 처음 바뀌는 순간의 위치, 또는 두 번째로 바뀌는 순간의 가속도
        const first = rng.next() < 0.5;
        const ans = first ? polyEval(X, al) : polyEval(a, be);
        if (ans === 0 || Math.abs(ans) > 100) continue;
        const Xs = polySym(X, 't');
        return {
          q: first
            ? `${lead(X)} 점 P 가 처음으로 운동 방향을 바꾸는 순간의 위치를 구하세요.`
            : `${lead(X)} 점 P 가 두 번째로 운동 방향을 바꾸는 순간의 가속도를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: [
            `X = ${Xs}`,
            'v = diff(X, t)',
            'ts = sorted([r for r in solve(v, t) if r > 0 and v.subs(t, r - Rational(1, 2)) * v.subs(t, r + Rational(1, 2)) < 0])',
            first ? 'ans = X.subs(t, ts[0])' : 'ans = diff(v, t).subs(t, ts[1])',
          ].join('\n'),
          concepts: [V, TURN, ...(first ? [] : [ACC])],
          steps: [
            {
              title: '속도 구하기',
              body: `$$v=${polyTex(v, 't')}=${3 * A}(${lin(al)})(${lin(be)})$$`,
            },
            {
              title: '방향이 바뀌는 시각',
              body: `$v=0$ 인 $t=${al}$, $t=${be}$ 앞뒤에서 $v$ 의 부호가 바뀌어요. $0<t<${al}$ 에서 $+$, $${al}<t<${be}$ 에서 $-$, $t>${be}$ 에서 $+$ 예요.`,
            },
            first
              ? {
                  title: `$t=${al}$ 일 때의 위치`,
                  body: `$$x=${subTex(X, al)}$$`,
                }
              : {
                  title: `$t=${be}$ 일 때의 가속도`,
                  body: `$a=\\frac{dv}{dt}=${polyTex(a, 't')}$ 이므로\n$$a=${subTex(a, be)}$$`,
                },
          ],
          tip: '속도가 0 이어도 앞뒤 부호가 그대로면 방향은 바뀌지 않아요. 부호가 바뀌는지 꼭 확인해요.',
        };
      }
    },
  },
  {
    id: 'math2-velocity-accel-zero',
    unitId: UNIT,
    title: '가속도가 0 인 순간의 속도',
    make(rng) {
      for (;;) {
        const A = rng.pick([1, -1, 2]);
        const t0 = rng.int(1, 3);
        const C = rng.int(-12, 12);
        // a(t)=6At+2B 가 t0 에서 0 이 되도록 B 를 정한다
        const X = [A, -3 * A * t0, C, rng.int(-5, 5)];
        const v = polyDiff(X);
        const a = polyDiff(v);
        const ans = polyEval(v, t0);
        if (ans === 0 || Math.abs(ans) > 100) continue;
        return {
          q: `${lead(X)} 점 P 의 가속도가 $0$ 인 순간의 속도를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff(${polySym(X, 't')}, t).subs(t, solve(diff(${polySym(X, 't')}, t, 2), t)[0])`,
          concepts: [V, ACC],
          steps: [
            { title: '속도 구하기', body: `$$v=${polyTex(v, 't')}$$` },
            { title: '가속도 구하기', body: `$$a=${polyTex(a, 't')}$$` },
            {
              title: '가속도가 0 인 시각',
              body: `$${polyTex(a, 't')}=0$ 에서 $t=${t0}$ ${ieyo(t0)}.`,
            },
            { title: `$t=${t0}$ 일 때의 속도`, body: `$$v=${subTex(v, t0)}$$` },
          ],
          tip: '가속도가 0 인 순간은 속도가 가장 크거나 가장 작은 순간이에요. 방향이 바뀌는 순간(속도가 0)과 헷갈리지 마세요.',
        };
      }
    },
  },
];
