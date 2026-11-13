import type { Generator } from './types.ts';
import { paren, polyMul, polySym, polyTex } from './util.ts';

const UNIT = 'h1-higher-eq';

// 고차방정식은 근이 여러 개라 답 칸에 바로 적을 수 없다. 그래서 "가장 큰 근", "두 허근의 곱"처럼
// 수 하나로 묻는다. 검산식은 풀이(인수정리·치환)를 따라 하지 않고 sympy solve 로 근을 모두 구해
// 고르는 방식이라, 풀이에서 인수를 잘못 찾으면 검산이 바로 다른 답을 낸다.

// '이에요/예요'는 앞 소리의 받침으로 갈리는데 값이 무작위라 끝 글자로 고른다
// (숫자는 일·삼·육·칠·팔·영/십이 받침).
const ieyo = (tex: string | number) => (/[013678]$/.test(String(tex)) ? '이에요' : '예요');
const eul = (tex: string | number) => (/[013678]$/.test(String(tex)) ? '을' : '를');
const iga = (tex: string | number) => (/[013678]$/.test(String(tex)) ? '이' : '가');
// '로/으로'는 받침이 없거나 ㄹ 받침(일·칠·팔)이면 '로'
const ro = (tex: string | number) => (/[036]$/.test(String(tex)) ? '으로' : '로');

/** x-a 꼴 인수 글자: a=-2 → "x+2" */
const lin = (a: number) => polyTex([1, -a]);

const FACTOR_THM = '인수정리: $f(a)=0$ 이면 $f(x)$ 는 $x-a$ 로 나누어떨어져요.';
const SYNTH = '조립제법으로 $f(x)\\div(x-a)$ 의 몫을 구해요.';

/** 조립제법 한 번: 계수와 a 로 몫의 계수 */
function synth(c: number[], a: number): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < c.length - 1; i++) {
    acc = acc * a + (c[i] as number);
    out.push(acc);
  }
  return out;
}

export const generators: Generator[] = [
  {
    id: 'heq-cubic-int-roots',
    unitId: UNIT,
    title: '세 정수근을 가진 삼차방정식',
    make(rng) {
      for (;;) {
        const a = rng.pick([1, -1, 2, -2]);
        const b = rng.int(-5, 5);
        const c = rng.int(-5, 5);
        // 세 근이 서로 달라야 "가장 큰 근"이 뚜렷하고, 0 근은 인수정리 연습이 안 된다
        if (new Set([a, b, c]).size < 3 || b === 0 || c === 0) continue;
        const f = polyMul(polyMul([1, -a], [1, -b]), [1, -c]);
        const q = synth(f, a);
        const big = Math.max(a, b, c);
        const F = polyTex(f);
        const val = f.map((k, i) => `${i ? '+' : ''}${paren(k * a ** (3 - i))}`).join('');
        return {
          q: `삼차방정식 $${F}=0$ 의 세 근 중 가장 큰 근을 구하세요.`,
          choices: null,
          answer: String(big),
          answerType: 'int',
          check: `Max(*solve(${polySym(f)}, x))`,
          concepts: [FACTOR_THM, SYNTH],
          steps: [
            {
              title: '근 하나 찾기',
              body: `상수항의 약수를 넣어 봐요. $x=${a}$ ${eul(a)} 넣으면 $${val}=0$ 이에요.`,
            },
            {
              title: '조립제법으로 나누기',
              body: `$${lin(a)}$ ${ro(a)} 나누면 몫은 $${polyTex(q)}$ ${ieyo(polyTex(q))}.\n$$${F}=(${lin(a)})(${polyTex(q)})$$`,
            },
            {
              title: '몫을 인수분해하기',
              body: `$${polyTex(q)}=(${lin(b)})(${lin(c)})$ 이에요.`,
            },
            {
              title: '가장 큰 근 고르기',
              body: `세 근은 $${a}$, $${b}$, $${c}$ 이고 가장 큰 근은 $${big}$ ${ieyo(big)}.`,
            },
          ],
          tip: `근과 계수의 관계로 확인할 수 있어요. 세 근의 합은 $x^2$ 의 계수의 부호를 바꾼 $${a + b + c}$ ${ieyo(a + b + c)}.`,
        };
      }
    },
  },
  {
    id: 'heq-cubic-complex',
    unitId: UNIT,
    title: '허근을 가진 삼차방정식',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-3, 3);
        const p = rng.int(-4, 4);
        const q = rng.int(1, 10);
        // 이차식 부분이 허근을 가져야 한다(판별식 < 0)
        if (p * p - 4 * q >= 0) continue;
        const quad = [1, p, q];
        const f = polyMul([1, -a], quad);
        const ask = rng.pick(['sum', 'prod'] as const);
        const ans = ask === 'sum' ? -p : q;
        const Q = polyTex(quad);
        const F = polyTex(f);
        const what = ask === 'sum' ? '합' : '곱';
        const pick = ask === 'sum' ? 'Add' : 'Mul';
        return {
          q: `삼차방정식 $${F}=0$ 의 두 허근의 ${what}을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `expand(${pick}(*[t for t in solve(${polySym(f)}, x) if not t.is_real]))`,
          concepts: [FACTOR_THM, '이차방정식 $x^2+px+q=0$ 의 두 근의 합은 $-p$, 곱은 $q$ 예요.'],
          steps: [
            {
              title: '근 하나 찾기',
              body: `$x=${a}$ ${eul(a)} 넣으면 $0$ 이 되므로 $${lin(a)}$ ${iga(a)} 인수예요.`,
            },
            {
              title: '조립제법으로 나누기',
              body: `$$${F}=(${lin(a)})(${Q})$$`,
            },
            {
              title: '허근은 이차식에서',
              body: `$${Q}=0$ 의 판별식은 $${p * p}-${4 * q}=${p * p - 4 * q}<0$ 이라 두 허근이 여기서 나와요.`,
            },
            {
              title: `근과 계수의 관계로 ${what}`,
              body: `두 허근의 ${what}은 $${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: '허근을 직접 구하지 않아도 이차식의 계수만으로 합과 곱을 알 수 있어요.',
        };
      }
    },
  },
  {
    id: 'heq-biquad',
    unitId: UNIT,
    title: '복이차방정식 (치환)',
    make(rng) {
      for (;;) {
        const a = rng.int(1, 5);
        const b = rng.int(1, 6);
        if (a >= b) continue;
        const A = a * a;
        const B = b * b;
        const f = [1, 0, -(A + B), 0, A * B];
        const F = polyTex(f);
        return {
          q: `사차방정식 $${F}=0$ 의 양수인 근을 모두 곱한 값을 구하세요.`,
          choices: null,
          answer: String(a * b),
          answerType: 'int',
          check: `Mul(*[t for t in solve(${polySym(f)}, x) if t.is_positive])`,
          concepts: [
            '$x^4+px^2+q=0$ 꼴은 $x^2=X$ 로 바꾸면 $X$ 에 대한 이차방정식이 돼요.',
            '$X$ 를 구한 뒤 다시 $x^2=X$ 를 풀어야 해요.',
          ],
          steps: [
            {
              title: '치환하기',
              body: `$x^2=X$ 라 하면 $X^2-${A + B}X+${A * B}=0$ 이에요.`,
            },
            {
              title: '$X$ 구하기',
              body: `$(X-${A})(X-${B})=0$ 이므로 $X=${A}$ 또는 $X=${B}$ ${ieyo(B)}.`,
            },
            {
              title: '다시 $x$ 로',
              body: `$x^2=${A}$ 에서 $x=\\pm${a}$, $x^2=${B}$ 에서 $x=\\pm${b}$ ${ieyo(b)}.`,
            },
            {
              title: '양수인 근 곱하기',
              body: `$${a}\\times${b}=${a * b}$ ${ieyo(a * b)}.`,
            },
          ],
          tip: '$X$ 만 구하고 멈추면 안 돼요. 근은 $x$ 의 값이라 $x^2=X$ 를 한 번 더 풀어요.',
        };
      }
    },
  },
  {
    id: 'heq-simul-lin-quad',
    unitId: UNIT,
    title: '일차식과 이차식의 연립방정식',
    make(rng) {
      for (;;) {
        const d = rng.nonzero(-4, 4);
        const y1 = rng.int(-4, 4);
        const x1 = y1 + d;
        const y2 = -d - y1;
        const x2 = -y1;
        // 해가 두 쌍으로 나뉘어야 "최댓값"이 의미가 있다
        if (y1 === y2) continue;
        const N = x1 * x1 + y1 * y1;
        const s1 = x1 + y1;
        const s2 = x2 + y2;
        const big = Math.max(s1, s2);
        const yq = [2, 2 * d, d * d - N];
        return {
          q: `연립방정식 $\\begin{cases}x-y=${d}\\\\x^2+y^2=${N}\\end{cases}$ 의 해를 $x=\\alpha$, $y=\\beta$ 라 할 때, $\\alpha+\\beta$ 의 최댓값을 구하세요.`,
          choices: null,
          answer: String(big),
          answerType: 'int',
          check: `Max(*[u + v for u, v in solve([Eq(x - y, ${d}), Eq(x**2 + y**2, ${N})], [x, y])])`,
          concepts: [
            '일차식을 한 문자에 대해 풀어 이차식에 대입해요.',
            '대입하면 미지수가 하나인 이차방정식이 돼요.',
          ],
          steps: [
            {
              title: '일차식을 $x$ 에 대해 풀기',
              body: `$x=y${d < 0 ? d : `+${d}`}$ ${ieyo(d)}.`,
            },
            {
              title: '이차식에 대입하기',
              body: `$(y${d < 0 ? d : `+${d}`})^2+y^2=${N}$ ${eul(N)} 정리하면 $${polyTex(yq, 'y')}=0$ 이에요.`,
            },
            {
              title: '$y$ 구하기',
              body: `$y=${y1}$ 또는 $y=${y2}$ ${ieyo(y2)}. 그때 $x=${x1}$, $x=${x2}$ ${ieyo(x2)}.`,
            },
            {
              title: '$\\alpha+\\beta$ 비교하기',
              body: `두 해에서 $\\alpha+\\beta$ 는 $${s1}$, $${s2}$ 이고 최댓값은 $${big}$ ${ieyo(big)}.`,
            },
          ],
          tip: '구한 해를 두 식에 모두 넣어 확인해요. 일차식에서 나온 짝을 바꾸어 쓰는 실수가 많아요.',
        };
      }
    },
  },
];
