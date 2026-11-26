import type { Generator } from './types.ts';
import { fracAns, fracTex, ieyo } from './util.ts';

const UNIT = 'math1-exp-func';

// 지수방정식·부등식은 "양변의 밑을 같게 → 지수 비교"가 한 흐름이고, 부등식은 밑이 1 보다 작을 때
// 부등호가 뒤집히는 것이 가장 흔한 실수라 두 경우를 같은 생성기에서 섞어 낸다.
// 해는 sympy solveset 으로 다시 구한다. solveset 이 log(2)/log(4)+2 처럼 정리하지 않은 꼴로 돌려줄 때가
// 있어 simplify 로 감싼다.

/** x+c 의 TeX: "x+2", "x-1" */
const xPlus = (c: number) => (c === 0 ? 'x' : c > 0 ? `x+${c}` : `x-${-c}`);
/** x-m 의 sympy */
const xPlusSym = (c: number) => (c === 0 ? 'x' : `(x + (${c}))`);

const SAME_BASE = '$a^{f(x)}=a^{g(x)} \\Leftrightarrow f(x)=g(x)$ ($a>0$, $a\\ne1$)';
const INEQ =
  '$a>1$ 이면 $a^{f(x)}<a^{g(x)} \\Leftrightarrow f(x)<g(x)$, $0<a<1$ 이면 부등호 방향이 바뀌어요.';
const SHIFT =
  '$y=a^{x-m}+n$ 은 $y=a^x$ 를 $x$ 축 방향으로 $m$, $y$ 축 방향으로 $n$ 만큼 옮긴 그래프이고 점근선은 $y=n$ 이에요.';

/** p^t 를 화면 숫자로(음수 지수면 분수) */
const powTex = (p: number, t: number) => (t >= 0 ? String(p ** t) : fracTex(1, p ** -t));
const powSym = (p: number, t: number) =>
  t >= 0 ? `Integer(${p ** t})` : `Rational(1, ${p ** -t})`;

export const generators: Generator[] = [
  {
    id: 'ef-eq-same-base',
    unitId: UNIT,
    title: '밑을 같게 하는 지수방정식',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3, 5]);
        const s = rng.pick([1, 2]);
        const c = rng.int(-3, 3);
        const t = rng.int(-3, 5);
        const B = p ** s;
        if (B > 25 || p ** Math.abs(t) > 243 || t === 0) continue;
        // s(x+c) = t → x = t/s − c
        const ans = fracAns(t - s * c, s);
        if (ans === '0') continue;
        const N = powTex(p, t);
        const lhs = `${B}^{${xPlus(c)}}`;
        const expo = s === 1 ? xPlus(c) : `${s}(${xPlus(c)})`;
        return {
          q: `방정식 $${lhs}=${N}$ 의 해를 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `simplify(list(solveset(Eq(Integer(${B})**${xPlusSym(c)}, ${powSym(p, t)}), x, S.Reals))[0])`,
          concepts: [SAME_BASE, '$(a^m)^n=a^{mn}$'],
          steps: [
            {
              title: `양변을 $${p}$ 의 거듭제곱으로`,
              body: `$$${p}^{${expo}}=${p}^{${t}}$$`,
            },
            {
              title: '지수끼리 같다고 놓기',
              body: `$$${expo}=${t}$$`,
            },
            {
              title: '$x$ 구하기',
              body: `$$x=${fracTex(t - s * c, s)}$$`,
            },
          ],
          tip: `밑이 같아지면 지수만 비교하면 돼요. 오른쪽 수도 $${p}$ 의 거듭제곱으로 바꾸는 것이 첫걸음이에요.`,
        };
      }
    },
  },
  {
    id: 'ef-ineq-count',
    unitId: UNIT,
    title: '지수부등식을 만족시키는 자연수의 개수',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3]);
        const c = rng.int(-2, 2);
        const k = rng.int(1, 5);
        if (p ** k > 81) continue;
        const dec = rng.int(0, 1) === 1;
        // 증가(밑 p): p^(x+c) ≤ p^k → x ≤ k−c
        // 감소(밑 1/p): (1/p)^(x+c) > (1/p)^k → x+c < k → x < k−c
        const cnt = dec ? k - c - 1 : k - c;
        if (cnt < 2 || cnt > 8) continue;
        const N = p ** k;
        if (!dec) {
          return {
            q: `다음 부등식을 만족시키는 자연수 $x$ 의 개수를 구하세요.\n$$${p}^{${xPlus(c)}}\\le ${N}$$`,
            choices: null,
            answer: String(cnt),
            answerType: 'int',
            check: `len([i for i in range(1, 60) if Integer(${p})**(i + (${c})) <= ${N}])`,
            concepts: [INEQ],
            steps: [
              {
                title: `오른쪽을 $${p}$ 의 거듭제곱으로`,
                body: `$$${p}^{${xPlus(c)}}\\le ${p}^{${k}}$$`,
              },
              {
                title: '밑이 1 보다 크면 그대로',
                body: `밑이 $1$ 보다 커서($${p}>1$) 부등호 방향이 그대로예요.\n$$${xPlus(c)}\\le ${k}$$`,
              },
              {
                title: '범위 구하기',
                body: `$$x\\le ${k - c}$$`,
              },
              {
                title: '자연수 세기',
                body: `$1$ 부터 $${k - c}$ 까지 $${cnt}$ 개예요.`,
              },
            ],
            tip: `밑이 $1$ 보다 큰 지수함수는 증가해요. 그래서 지수의 크기와 값의 크기가 같은 방향이에요.`,
          };
        }
        return {
          q: `다음 부등식을 만족시키는 자연수 $x$ 의 개수를 구하세요.\n$$\\left(\\dfrac{1}{${p}}\\right)^{${xPlus(c)}}>\\dfrac{1}{${N}}$$`,
          choices: null,
          answer: String(cnt),
          answerType: 'int',
          check: `len([i for i in range(1, 60) if Rational(1, ${p})**(i + (${c})) > Rational(1, ${N})])`,
          concepts: [INEQ],
          steps: [
            {
              title: `오른쪽을 $\\frac{1}{${p}}$ 의 거듭제곱으로`,
              body: `$$\\left(\\frac{1}{${p}}\\right)^{${xPlus(c)}}>\\left(\\frac{1}{${p}}\\right)^{${k}}$$`,
            },
            {
              title: '밑이 1 보다 작으면 뒤집기',
              body: `밑이 $1$ 보다 작아서($0<\\frac{1}{${p}}<1$) 부등호 방향이 바뀌어요.\n$$${xPlus(c)}<${k}$$`,
            },
            {
              title: '범위 구하기',
              body: `$$x<${k - c}$$`,
            },
            {
              title: '자연수 세기',
              body: `$1$ 부터 $${k - c - 1}$ 까지 $${cnt}$ 개예요.`,
            },
          ],
          tip: `밑이 $1$ 보다 작은 지수함수는 감소해요. 지수가 클수록 값이 작아지니 부등호를 뒤집어야 해요. 뒤집지 않으면 자연수가 끝없이 많은 엉뚱한 범위가 나와요.`,
        };
      }
    },
  },
  {
    id: 'ef-asymptote',
    unitId: UNIT,
    title: '평행이동한 지수함수의 점근선',
    make(rng) {
      for (;;) {
        const a = rng.pick([2, 3]);
        const m = rng.int(-2, 2);
        const k = rng.int(-5, 5);
        const x0 = rng.int(-1, 4);
        const e = x0 - m;
        if (e < 0 || a ** e > 27 || k === 0) continue;
        const y0 = a ** e + k;
        return {
          q: `함수 $y=${a}^{${xPlus(-m)}}+k$ 의 그래프는 $x=${x0}$ 일 때 $y=${y0}$ ${ieyo(y0)}. 이 그래프의 점근선이 직선 $y=p$ 일 때, $p$ 의 값을 구하세요. (단, $k$ 는 상수예요.)`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `solve(Eq(Integer(${a})**(${x0} - (${m})) + k, ${y0}), k)[0]`,
          concepts: [SHIFT],
          steps: [
            {
              title: '점을 넣기',
              body: `두 값을 식에 넣어요.\n$$${y0}=${a}^{${e}}+k$$`,
            },
            {
              title: '거듭제곱 계산',
              body: `$${a}^{${e}}=${a ** e}$ 이므로 $k=${y0}-${a ** e}=${k}$ ${ieyo(k)}.`,
            },
            {
              title: '점근선 읽기',
              body: `$y=${a}^{${xPlus(-m)}}$ 의 그래프는 $x$ 축($y=0$)에 한없이 가까워지기만 해요. 그 그래프를 ${k < 0 ? '아래로' : '위로'} $${Math.abs(k)}$ 만큼 옮겼으니 점근선은 $y=${k}$, 곧 $p=${k}$ ${ieyo(k)}.`,
            },
          ],
          tip: '좌우로 옮기는 것($x$ 축 방향)은 점근선을 바꾸지 않아요. 점근선은 위아래로 옮긴 만큼만 움직여요.',
        };
      }
    },
  },
  {
    id: 'ef-max-min',
    unitId: UNIT,
    title: '닫힌 구간에서 지수함수의 최대·최소',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3]);
        const dec = rng.int(0, 1) === 1;
        const m = rng.int(-1, 2);
        const n = rng.int(-3, 3);
        const lo = rng.int(-1, 1);
        const hi = lo + rng.int(2, 3);
        // 밑 b = p 또는 1/p. 지수 e = x − m
        const eLo = lo - m;
        const eHi = hi - m;
        const sgn = dec ? -1 : 1;
        // 값 = p^(sgn·e) + n. 정수만 나오게 sgn·e ≥ 0 인 쪽만 고른다
        if (Math.min(sgn * eLo, sgn * eHi) < 0) continue;
        const vLo = p ** (sgn * eLo) + n;
        const vHi = p ** (sgn * eHi) + n;
        if (Math.max(vLo, vHi) > 40) continue;
        const max = Math.max(vLo, vHi);
        const min = Math.min(vLo, vHi);
        const base = dec ? `\\left(\\dfrac{1}{${p}}\\right)` : `${p}`;
        const baseSym = dec ? `Rational(1, ${p})` : `Integer(${p})`;
        const nTex = n === 0 ? '' : n > 0 ? `+${n}` : `${n}`;
        const f = `${base}^{${xPlus(-m)}}${nTex}`;
        const fSym = `${baseSym}**${xPlusSym(-m)} + (${n})`;
        const atMax = dec ? lo : hi;
        const atMin = dec ? hi : lo;
        return {
          q: `$${lo}\\le x\\le ${hi}$ 에서 함수 $y=${f}$ 의 최댓값과 최솟값의 합을 구하세요.`,
          choices: null,
          answer: String(max + min),
          answerType: 'int',
          check: `ans = (${fSym}).subs(x, ${lo}) + (${fSym}).subs(x, ${hi})`,
          concepts: [
            '닫힌 구간에서 증가함수는 오른쪽 끝, 감소함수는 왼쪽 끝에서 최댓값을 가져요.',
            '$a>1$ 이면 $y=a^x$ 는 증가, $0<a<1$ 이면 감소해요.',
          ],
          steps: [
            {
              title: '증가인지 감소인지',
              body: dec
                ? `밑이 $1$ 보다 작아서($0<\\frac{1}{${p}}<1$) 감소함수예요. 왼쪽 끝에서 가장 커요.`
                : `밑이 $1$ 보다 커서($${p}>1$) 증가함수예요. 오른쪽 끝에서 가장 커요.`,
            },
            {
              title: '최댓값',
              body: `$x=${atMax}$ 일 때 $y=${max}$ ${ieyo(max)}.`,
            },
            {
              title: '최솟값',
              body: `$x=${atMin}$ 일 때 $y=${min}$ ${ieyo(min)}.`,
            },
            {
              title: '합',
              body: `$$${max}+${min < 0 ? `(${min})` : min}=${max + min}$$`,
            },
          ],
          tip: '지수함수는 계속 증가하거나 계속 감소해서, 닫힌 구간의 최댓값과 최솟값은 늘 양 끝에서 나와요.',
        };
      }
    },
  },
];
