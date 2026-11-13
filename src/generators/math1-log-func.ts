import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, polySym, polyTex } from './util.ts';

const UNIT = 'math1-log-func';

// 로그함수 기초는 세 가지 손놀림으로 모인다: 정의로 로그를 벗기기, 역함수를 '방정식 풀기'로 읽기,
// 부등식에서 밑에 따라 방향을 정하고 진수 조건을 함께 쓰기. 수능 공통 22번이 이 셋을 엮어 묻기 때문에
// 기초에서는 하나씩 떼어 손에 익히게 한다.

// '이에요/예요'는 앞 소리의 받침으로 갈리는데 값이 무작위라 끝 글자로 고른다
// (숫자는 일·삼·육·칠·팔·영/십이 받침).
const ieyo = (tex: string | number) => (/[013678]$/.test(String(tex)) ? '이에요' : '예요');

const DEF = '$\\log_ax=c \\Leftrightarrow x=a^c$';

/** 밑이 a 일 때 지수 k 의 상한 — a^k 가 손계산 범위(32 이하)를 넘지 않게 */
const MAXK: Record<number, number> = { 2: 5, 3: 3, 5: 2 };

/** 1차식 px+q 의 TeX·sympy. 상수항 0 이면 px 만 */
const lin = (p: number, q: number) => ({ tex: polyTex([p, q]), sym: polySym([p, q]) });

export const generators: Generator[] = [
  {
    id: 'logfunc-eq',
    unitId: UNIT,
    title: '로그방정식 $\\log_a(px+q)=k$',
    make(rng) {
      for (;;) {
        const a = rng.pick([2, 3, 5]);
        const k = rng.int(1, MAXK[a] as number);
        const p = rng.pick([1, 2, 3]);
        const q = rng.int(-6, 6);
        const pow = a ** k;
        // 답이 정수로 떨어지는 경우만 — 이 유형의 목표는 '정의로 바꾸기'라 분수 계산은 군더더기다
        if ((pow - q) % p !== 0) continue;
        const ans = (pow - q) / p;
        const L = lin(p, q);
        const solveStep =
          p === 1
            ? `$$x=${pow}${q === 0 ? '' : q > 0 ? `-${q}` : `+${-q}`}=${ans}$$`
            : `$$${p}x=${pow - q},\\quad x=${ans}$$`;
        return {
          q: `방정식 $\\log_{${a}}(${L.tex})=${k}$ 의 해를 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `solve(Eq(log(${L.sym}, ${a}), ${k}), x)[0]`,
          concepts: [DEF, '진수는 항상 양수여야 해요.'],
          steps: [
            {
              title: '정의로 로그 벗기기',
              body: `$\\log_{${a}}(${L.tex})=${k}$ 은 "$${a}$ 를 $${k}$ 번 곱하면 $${L.tex}$" 라는 뜻이에요.\n$$${L.tex}=${a}^{${k}}=${pow}$$`,
            },
            { title: '일차방정식 풀기', body: solveStep },
            {
              title: '진수 확인',
              body: `$x=${ans}$ 일 때 진수 $${L.tex}$ 의 값은 $${a}^{${k}}>0$ 이라 조건을 만족해요.`,
            },
          ],
          tip: `거꾸로 넣어 확인해요. $\\log_{${a}}${pow}=${k}$ 이니 맞아요.`,
        };
      }
    },
  },
  {
    id: 'logfunc-inverse',
    unitId: UNIT,
    title: '지수함수·로그함수의 역함수 값',
    make(rng) {
      const a = rng.pick([2, 3]);
      if (rng.int(0, 1) === 0) {
        // f(x)=a^x+q 의 역함수 g 에 대해 g(m): "f(x)=m 인 x" 로 읽게 한다
        const t = rng.int(1, a === 2 ? 4 : 3);
        const q = rng.nonzero(-5, 5);
        const m = a ** t + q;
        const F = `${a}^{x}${q > 0 ? `+${q}` : q}`;
        return {
          q: `함수 $f(x)=${F}$ 의 역함수를 $g(x)$ 라 할 때, $g(${m})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(t),
          answerType: 'int',
          check: `solve(Eq(${a}**x + ${paren(q)}, ${m}), x)[0]`,
          concepts: [
            '$g$ 가 $f$ 의 역함수이면 $g(m)=k \\Leftrightarrow f(k)=m$',
            '$y=a^x$ 와 $y=\\log_ax$ 는 서로 역함수예요.',
          ],
          steps: [
            {
              title: '역함수 값을 방정식으로',
              body: `$g(${m})=k$ 라 하면 $f(k)=${m}$ 이에요. 역함수식을 구하지 않아도 돼요.`,
            },
            {
              title: '지수 떼어 내기',
              body: `$$${a}^{k}${q > 0 ? `+${q}` : q}=${m},\\quad ${a}^{k}=${a ** t}$$`,
            },
            { title: '지수 읽기', body: `$${a ** t}=${a}^{${t}}$ 이므로 $k=${t}$ ${ieyo(t)}.` },
          ],
          tip: `역함수식으로도 확인돼요. $g(x)=\\log_{${a}}(x${q > 0 ? `-${q}` : `+${-q}`})$ 이고 $g(${m})=\\log_{${a}}${a ** t}=${t}$ ${ieyo(t)}.`,
        };
      }
      // f(x)=log_a(x+p) 의 역함수 g 에 대해 g(t)
      const t = rng.int(-1, 2);
      const p = rng.nonzero(-4, 4);
      const ansN = t >= 0 ? a ** t - p : 1 - p * a;
      const ansD = t >= 0 ? 1 : a;
      const ansTex = fracTex(ansN, ansD);
      const X = polyTex([1, p]);
      const powTex = t >= 0 ? String(a ** t) : `\\frac{1}{${a}}`;
      return {
        q: `함수 $f(x)=\\log_{${a}}(${X})$ 의 역함수를 $g(x)$ 라 할 때, $g(${t})$ 의 값을 구하세요.`,
        choices: null,
        answer: fracAns(ansN, ansD),
        answerType: 'fraction',
        check: `solve(Eq(log(${polySym([1, p])}, ${a}), ${t}), x)[0]`,
        concepts: ['$g$ 가 $f$ 의 역함수이면 $g(t)=k \\Leftrightarrow f(k)=t$', DEF],
        steps: [
          {
            title: '역함수 값을 방정식으로',
            body: `$g(${t})=k$ 라 하면 $f(k)=${t}$, 곧 $\\log_{${a}}(k${p > 0 ? `+${p}` : p})=${t}$ 이에요.`,
          },
          {
            title: '정의로 로그 벗기기',
            body: `$$k${p > 0 ? `+${p}` : p}=${a}^{${t}}=${powTex}$$`,
          },
          {
            title: '계산하기',
            body: `$$k=${powTex}${p > 0 ? `-${p}` : `+${-p}`}=${ansTex}$$`,
          },
        ],
        tip: `역함수식은 $g(x)=${a}^{x}${p > 0 ? `-${p}` : `+${-p}`}$ 이에요. $x=${t}$ 을 넣어도 같은 값이 나와요.`,
      };
    },
  },
  {
    id: 'logfunc-ineq-count',
    unitId: UNIT,
    title: '로그부등식을 만족시키는 정수의 개수',
    make(rng) {
      const big = rng.pick([2, 3]);
      const small = rng.int(0, 1) === 1; // 밑이 1/2·1/3 이면 부등호가 뒤집힌다
      const k = rng.int(1, big === 2 ? 4 : 3);
      const p = rng.int(-4, 5);
      const strict = rng.int(0, 1) === 1;
      const pow = big ** k;
      const count = strict ? pow - 1 : pow;
      const baseTex = small ? `\\frac{1}{${big}}` : String(big);
      const baseSym = small ? `Rational(1, ${big})` : String(big);
      // 밑이 1보다 작으면 "> -k" 꼴로 물어, 정리하면 밑이 큰 경우와 같은 범위가 되게 한다
      const rhs = small ? -k : k;
      const opTex = small ? (strict ? '>' : '\\ge') : strict ? '<' : '\\le';
      const opSym = small ? (strict ? '>' : '>=') : strict ? '<' : '<=';
      const flipTex = strict ? '<' : '\\le';
      const X = polyTex([1, -p]);
      const xs = polySym([1, -p]);
      const lo = p + 1;
      const hi = strict ? p + pow - 1 : p + pow;
      return {
        q: `부등식 $\\log_{${baseTex}}(${X})${opTex}${rhs}$ 을 만족시키는 정수 $x$ 의 개수를 구하세요.`,
        choices: null,
        answer: String(count),
        answerType: 'int',
        check: `len(Intersection(solveset(log(${xs}, ${baseSym}) ${opSym} ${rhs}, x, Reals), Range(${p - 5}, ${p + 40})))`,
        concepts: [
          '진수 조건: 로그 안은 양수',
          '밑이 1보다 크면 부등호 방향 그대로, 0과 1 사이면 반대로',
        ],
        steps: [
          { title: '진수 조건', body: `$${X}>0$ 이므로 $x>${p}$ ${ieyo(p)}.` },
          {
            title: small
              ? '밑이 1보다 작아요 — 부등호를 뒤집기'
              : '밑이 1보다 커요 — 부등호 그대로',
            body: small
              ? `$${rhs}=\\log_{${baseTex}}${pow}$ 이고, 밑이 $${baseTex}$ 이면 진수가 클수록 값이 작아져요.\n$$${X}${flipTex}${pow}$$`
              : `$${k}=\\log_{${big}}${pow}$ 이고, 밑이 $${big}$ 이면 진수가 클수록 값도 커요.\n$$${X}${flipTex}${pow}$$`,
          },
          {
            title: '범위 합치기',
            body: `$$${p}<x${flipTex}${p + pow}$$`,
          },
          {
            title: '정수 세기',
            body: `$${lo}$ 부터 $${hi}$ 까지 $${count}$ 개예요.`,
          },
        ],
        tip: '진수 조건을 빼먹으면 아래쪽 끝이 없어져 정수가 끝없이 많아져요. 범위의 양 끝을 꼭 둘 다 확인해요.',
      };
    },
  },
];
