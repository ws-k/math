import type { Generator } from './types.ts';
import { paren, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-diff-coefficient';

// 이 단원은 아직 (x^n)' 공식을 배우기 전이라, 모든 풀이를 정의(극한)와 인수분해만으로 쓴다.
// 그래서 함수는 이차식까지만 쓰고, 공식으로 빨리 푸는 길은 tip 에 "다음 단원" 검산으로만 남긴다.
const MAX = 60;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

/** "+3" / "-3" — 식 뒤에 상수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

// '이에요/예요', '을/를'은 앞 소리의 받침으로 갈리는데 값이 무작위라 끝 글자로 고른다
// (숫자는 일·삼·육·칠·팔·영/십이 받침, 문자는 영어 이름이라 받침 없음).
const hasBatchim = (tex: string | number) => /[013678]$/.test(String(tex));
const ieyo = (tex: string | number) => (hasBatchim(tex) ? '이에요' : '예요');
const eul = (tex: string | number) => (hasBatchim(tex) ? '을' : '를');
const iga = (tex: string | number) => (hasBatchim(tex) ? '이' : '가');
// '로/으로'는 ㄹ 받침(일·칠·팔)이면 '로'라서 받침 규칙과 따로 고른다
const ro = (tex: string | number) => (/[036]$/.test(String(tex)) ? '으로' : '로');

const DEF = "미분계수: $f'(a)=\\lim_{h\\to0}\\frac{f(a+h)-f(a)}{h}$";
const AVG = '평균변화율: $\\frac{f(b)-f(a)}{b-a}$';

/** f(a+mh) 의 괄호 안 글자. a=0 이면 "2h", m=1 이면 "a+h" 처럼 군더더기를 뺀다 */
function arg(a: number, m: number): string {
  const mh = `${Math.abs(m) === 1 ? '' : Math.abs(m)}h`;
  if (a === 0) return m < 0 ? `-${mh}` : mh;
  return `${a}${m < 0 ? '-' : '+'}${mh}`;
}

/** m·f'(a) 의 글자. m=1 이면 계수를 생략한다 */
const times = (m: number, a: number) => `${m === 1 ? '' : m}f'(${a})`;

export const generators: Generator[] = [
  {
    id: 'm2dc-avg-rate',
    unitId: UNIT,
    title: '이차함수의 평균변화율',
    make(rng) {
      for (;;) {
        const f = [rng.nonzero(-3, 3), rng.int(-5, 5), rng.int(-5, 5)];
        const a = rng.int(-3, 2);
        const b = a + rng.int(1, 4);
        const fa = polyEval(f, a);
        const fb = polyEval(f, b);
        const dy = fb - fa;
        const dx = b - a;
        const ans = dy / dx;
        if (!okAns(ans)) continue;
        const F = polyTex(f);
        const S = polySym(f);
        return {
          q: `함수 $f(x)=${F}$ 에서 $x$ 의 값이 $${a}$ 에서 $${b}$ 까지 변할 때의 평균변화율을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `((${S}).subs(x, ${b}) - (${S}).subs(x, ${a}))/(${b} - ${paren(a)})`,
          concepts: [AVG, '$y$ 가 늘어난 양을 $x$ 가 늘어난 양으로 나눠요.'],
          steps: [
            {
              title: '두 함숫값 구하기',
              body: `$f(${b})=${fb}$, $f(${a})=${fa}$ ${ieyo(fa)}.`,
            },
            {
              title: '늘어난 양 구하기',
              body: `$y$ 는 $${fb}-${paren(fa)}=${dy}$, $x$ 는 $${b}-${paren(a)}=${dx}$ 만큼 변했어요.`,
            },
            {
              title: '나누기',
              body: `$$\\frac{${dy}}{${dx}}=${ans}$$`,
            },
          ],
          tip: `평균변화율은 곡선 위의 두 점을 지나는 직선(할선)의 기울기와 같아요. 두 점은 $(${a},\\,${fa})$, $(${b},\\,${fb})$ ${ieyo(fb)}.`,
        };
      }
    },
  },
  {
    id: 'm2dc-def-value',
    unitId: UNIT,
    title: '정의로 미분계수 구하기',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-3, 3);
        const q = rng.int(-5, 5);
        const r = rng.int(-5, 5);
        const a = rng.int(-2, 3);
        const f = [p, q, r];
        const fa = polyEval(f, a);
        const c = 2 * p * a + q;
        const ans = c;
        if (!okAns(ans)) continue;
        const F = polyTex(f);
        const A = arg(a, 1);
        const num = polyTex([p, c, 0], 'h');
        return {
          q: `함수 $f(x)=${F}$ 에 대하여 미분계수의 정의를 써서 $f'(${a})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${polySym(f)}\nans = limit((f.subs(x, ${a} + h) - f.subs(x, ${a}))/h, h, 0)`,
          concepts: [DEF, '분자를 정리해 $h$ 로 약분한 뒤 $h\\to0$ 을 생각해요.'],
          steps: [
            {
              title: `$f(${A})$ 전개하기`,
              body: `$$f(${A})=${polyTex([p, c, fa], 'h')}$$`,
            },
            {
              title: '분자 정리하기',
              body: `$f(${a})=${fa}$ ${eul(fa)} 빼면 $f(${A})-f(${a})=${num}$ ${ieyo(num)}.`,
            },
            {
              title: '$h$ 로 나누기',
              body: `$$\\frac{f(${A})-f(${a})}{h}=${polyTex([p, c], 'h')}$$`,
            },
            {
              title: '극한 구하기',
              body: `$h\\to0$ 이면 $${polyTex([p, c], 'h')}\\to${c}$ 이므로 $f'(${a})=${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: `다음 단원에서 배우는 공식으로는 $f'(x)=${polyTex([2 * p, q])}$ 에 $x=${a}$ ${eul(a)} 넣어 바로 $${ans}$ ${iga(ans)} 나와요. 정의로 구한 값과 같아요.`,
        };
      }
    },
  },
  {
    id: 'm2dc-limit-scale',
    unitId: UNIT,
    title: '극한 식을 미분계수로 바꾸기',
    make(rng) {
      for (;;) {
        const a = rng.int(-2, 3);
        const D = rng.nonzero(-5, 5);
        const two = rng.next() < 0.5;
        const m = two ? rng.int(1, 3) : rng.int(2, 4);
        const n = two ? rng.int(1, 3) : 0;
        const ans = (m + n) * D;
        if (!okAns(ans)) continue;
        const up = arg(a, m);
        const fa = `f(${a})`;
        // f 의 식은 몰라도 되는 문제라, f'(a)=D 인 이차식 하나로 대신해 실제 극한을 계산한다.
        const stand = `(x - ${paren(a)})**2 + ${D}*(x - ${paren(a)}) + 3`;
        const head = `다항함수 $f(x)$ 가 $f'(${a})=${D}$ ${eul(D)} 만족시켜요.`;
        if (!two) {
          return {
            q: `${head} $\\displaystyle\\lim_{h\\to0}\\frac{f(${up})-${fa}}{h}$ 의 값을 구하세요.`,
            choices: null,
            answer: String(ans),
            answerType: 'int',
            check: `f = ${stand}\nans = limit((f.subs(x, ${a} + ${m}*h) - f.subs(x, ${a}))/h, h, 0)`,
            concepts: [DEF, '$x$ 가 늘어난 양과 분모가 같아야 미분계수예요.'],
            steps: [
              {
                title: '분모 맞추기',
                body: `$x$ 가 늘어난 양은 $${m}h$ 인데 분모는 $h$ 예요. 분모를 $${m}h$ 로 맞춰요.\n$$\\frac{f(${up})-${fa}}{h}=${m}\\cdot\\frac{f(${up})-${fa}}{${m}h}$$`,
              },
              {
                title: '미분계수로 바꾸기',
                body: `$h\\to0$ 이면 $${m}h\\to0$ 이므로 극한값은 $${times(m, a)}$ ${ieyo(a)}.`,
              },
              {
                title: '값 넣기',
                body: `$$${m}\\cdot ${paren(D)}=${ans}$$`,
              },
            ],
            tip: `분모를 맞추지 않고 $f'(${a})=${D}$ ${eul(D)} 답으로 쓰는 실수가 가장 많아요. $${m}$ 배를 꼭 챙겨요.`,
          };
        }
        const down = arg(a, -n);
        return {
          q: `${head} $\\displaystyle\\lim_{h\\to0}\\frac{f(${up})-f(${down})}{h}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${stand}\nans = limit((f.subs(x, ${a} + ${m}*h) - f.subs(x, ${a} - ${n}*h))/h, h, 0)`,
          concepts: [DEF, '분자에 $f(a)$ 를 빼고 더해 미분계수 두 개로 나눠요.'],
          steps: [
            {
              title: '가운데 값을 빼고 더하기',
              body: `분자에서 $${fa}$ ${eul(a)} 빼고 더해 두 덩어리로 나눠요.\n$$\\frac{f(${up})-${fa}}{h}+\\frac{${fa}-f(${down})}{h}$$`,
            },
            {
              title: '앞 덩어리',
              body: `$x$ 가 $${m === 1 ? '' : m}h$ 만큼 늘었으니 극한은 $${times(m, a)}$ ${ieyo(a)}.`,
            },
            {
              title: '뒤 덩어리',
              body: `$\\frac{${fa}-f(${down})}{h}=${n === 1 ? '' : n}\\cdot\\frac{f(${down})-${fa}}{-${n === 1 ? '' : n}h}$ 이므로 극한은 $${times(n, a)}$ ${ieyo(a)}.`.replace(
                '=\\cdot',
                '=',
              ),
            },
            {
              title: '더하기',
              body: `$$${times(m, a)}+${times(n, a)}=${m + n}\\cdot ${paren(D)}=${ans}$$`,
            },
          ],
          tip: `$x$ 가 $${arg(a, -n)}$ 에서 $${up}$ 까지 모두 $${m + n}h$ 만큼 움직였어요. 그래서 $${m + n}f'(${a})$ ${iga(a)} 돼요.`,
        };
      }
    },
  },
  {
    id: 'm2dc-x-to-a',
    unitId: UNIT,
    title: '$x\\to a$ 꼴의 극한과 미분계수',
    make(rng) {
      for (;;) {
        const p = rng.pick([1, 1, 2, -1]);
        const q = rng.int(-5, 5);
        const a = rng.nonzero(-3, 3);
        const f = [p, q, 0];
        const fa = polyEval(f, a);
        const ans = 2 * p * a + q;
        if (!okAns(ans) || p * a + q === 0) continue;
        const N = polyTex([p, q, -fa]);
        const X = polyTex([1, -a]);
        const L = polyTex([p, p * a + q]);
        return {
          q: `$\\displaystyle\\lim_{x\\to${a}}\\frac{${N}}{${X}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `limit((${polySym([p, q, -fa])})/(x - ${paren(a)}), x, ${a})`,
          concepts: [
            "$\\lim_{x\\to a}\\frac{f(x)-f(a)}{x-a}=f'(a)$",
            '분모가 $0$ 으로 가면 분자를 인수분해해 약분해요.',
          ],
          steps: [
            {
              title: '분자에 $x$ 대신 극한값 넣어 보기',
              body: `$x=${a}$ ${eul(a)} 넣으면 분자가 $0$ 이에요. 그래서 분자는 $${X}$ ${ro(X)} 나누어떨어져요.`,
            },
            {
              title: '인수분해',
              body: `$$${N}=(${X})(${L})$$`,
            },
            {
              title: '약분하고 대입',
              body: `$$\\lim_{x\\to${a}}(${L})=${p === 1 ? paren(a) : p === -1 ? `-${paren(a)}` : `${p}\\cdot ${paren(a)}`}${signed(p * a + q)}=${ans}$$`,
            },
          ],
          tip: `$f(x)=${polyTex(f)}$ 라 하면 분자는 $f(x)-f(${a})$ 라서 이 극한은 $f'(${a})$ 예요. 정의의 모양을 알아보면 계산 방향이 보여요.`,
        };
      }
    },
  },
];
