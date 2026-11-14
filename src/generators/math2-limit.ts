import type { Generator } from './types.ts';
import { fracAns, fracTex, paren, polySym, polyTex } from './util.ts';

const UNIT = 'math2-limit';

// 기초 유형은 '어떤 꼴인지 먼저 보고 그에 맞는 손질(약분·유리화·최고차항 나누기)을 고른다'를 연습시킨다.
// 그래서 풀이의 첫 단계는 늘 "그대로 넣으면 어떤 꼴인가"이고, 검산은 sympy limit 으로 따로 계산한다.
// 생성기 id 는 단원 id 로 시작한다 — 예전에 다른 단원과 id 가 겹쳐 엉뚱한 문제가 나온 사고가 있었다.

const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

// 조사는 앞 소리의 받침으로 갈리는데 값이 무작위라 끝 글자로 고른다
// (숫자 일·삼·육·칠·팔·영/십은 받침, 이·사·오·구는 받침 없음. x 는 '엑스'라 받침 없음).
const batchim = (s: number | string) => /[013678]$/.test(String(s));
const ieyo = (s: number | string) => (batchim(s) ? '이에요' : '예요');
const eul = (s: number | string) => (batchim(s) ? '을' : '를');
const iga = (s: number | string) => (batchim(s) ? '이' : '가');

/** x-a 를 TeX 로: a=-3 → "x+3", a=0 → "x" */
const lin = (a: number) => polyTex([1, -a]);

/** 최고차항으로 나눈 뒤의 항: 3 → "+\frac{3}{x}", -3 → "-\frac{3}{x}", 0 → "" */
const overX = (n: number, pow: string) =>
  n === 0 ? '' : `${n < 0 ? '-' : '+'}\\frac{${Math.abs(n)}}{${pow}}`;

const LIM =
  '$\\lim_{x\\to a}f(x)=L$: $x$ 가 $a$ 에 한없이 가까워질 때 $f(x)$ 가 $L$ 에 한없이 가까워져요.';
const ZERO = '$\\frac00$ 꼴은 분모를 0 으로 만드는 인수를 약분하거나, 근호가 있으면 유리화해요.';

export const generators: Generator[] = [
  {
    id: 'math2-limit-factor',
    unitId: UNIT,
    title: '인수분해로 푸는 $\\frac00$ 꼴',
    make(rng) {
      for (;;) {
        const a = rng.int(-3, 3);
        const b = rng.int(-4, 4);
        const c = rng.int(-4, 4);
        // b=a 이면 분자가 (x-a)^2 이라 답이 0, c=a 이면 극한이 없다. b=c 이면 약분하면 1 이라 시시하다
        if (b === a || c === a || b === c) continue;
        const num = [1, -(a + b), a * b];
        const den = [1, -(a + c), a * c];
        const ans = fracAns(a - b, a - c);
        return {
          q: `$\\displaystyle\\lim_{x\\to ${a}}\\frac{${polyTex(num)}}{${polyTex(den)}}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: `limit((${polySym(num)})/(${polySym(den)}), x, ${a})`,
          concepts: [LIM, ZERO],
          steps: [
            {
              title: '그대로 넣어 보기',
              body: `$x=${a}$ ${eul(a)} 넣으면 분자도 분모도 $0$ 이에요. $\\frac00$ 꼴이라 손질이 필요해요.`,
            },
            {
              title: '인수분해',
              body: `둘 다 $${lin(a)}$ ${eul(lin(a))} 인수로 가져요.\n$$\\frac{(${lin(a)})(${lin(b)})}{(${lin(a)})(${lin(c)})}$$`,
            },
            {
              title: '약분하기',
              body: `$x\\ne ${a}$ 인 곳에서 보므로 $${lin(a)}\\ne0$ 이라 약분할 수 있어요.\n$$\\frac{${lin(b)}}{${lin(c)}}$$`,
            },
            {
              title: `$x=${a}$ 대입`,
              body: `$$\\frac{${a}${signed(-b)}}{${a}${signed(-c)}}=${fracTex(a - b, a - c)}$$`,
            },
          ],
          tip: `극한값은 $x=${a}$ 에서의 함숫값이 아니라 다가가는 값이에요. 원래 식은 $x=${a}$ 에서 정의되지 않지만 극한값은 있어요.`,
        };
      }
    },
  },
  {
    id: 'math2-limit-rationalize',
    unitId: UNIT,
    title: '유리화로 푸는 $\\frac00$ 꼴',
    make(rng) {
      for (;;) {
        const c = rng.int(1, 4);
        const a = rng.int(-3, 5);
        const b = c * c - a;
        if (b === 0) continue;
        // 근호가 분자에 있으면 답은 1/(2c), 분모에 있으면 2c. 두 모양을 다 연습시킨다
        const up = rng.next() < 0.5;
        const root = `\\sqrt{x${signed(b)}}-${c}`;
        const rootSym = `sqrt(x + (${b})) - ${c}`;
        const xa = lin(a);
        const xaSym = `(x - (${a}))`;
        const conj = `\\sqrt{x${signed(b)}}+${c}`;
        const ans = up ? fracAns(1, 2 * c) : String(2 * c);
        const q = up ? `\\frac{${root}}{${xa}}` : `\\frac{${xa}}{${root}}`;
        return {
          q: `$\\displaystyle\\lim_{x\\to ${a}}${q}$ 의 값을 구하세요.`,
          choices: null,
          answer: ans,
          answerType: 'fraction',
          check: up
            ? `limit((${rootSym})/${xaSym}, x, ${a})`
            : `limit(${xaSym}/(${rootSym}), x, ${a})`,
          concepts: [LIM, ZERO, '$(\\sqrt{A}-B)(\\sqrt{A}+B)=A-B^2$ 로 근호를 없애요.'],
          steps: [
            {
              title: '그대로 넣어 보기',
              body: `$x=${a}$ 이면 $\\sqrt{${a}${signed(b)}}=${c}$ ${iga(c)} 되어 근호 부분이 $0$, $${xa}$ 도 $0$ 이에요. $\\frac00$ 꼴이에요.`,
            },
            {
              title: '켤레식 곱하기',
              body: `분모·분자에 $${conj}$ ${eul(c)} 곱해요. 근호 부분은 $(x${signed(b)})-${c * c}=${xa}$ ${iga(xa)} 돼요.`,
            },
            {
              title: '약분하기',
              body: up
                ? `$$\\frac{${xa}}{(${xa})(${conj})}=\\frac{1}{${conj}}$$`
                : `$$\\frac{(${xa})(${conj})}{${xa}}=${conj}$$`,
            },
            {
              title: `$x=${a}$ 대입`,
              body: up ? `$$\\frac{1}{${c}+${c}}=${fracTex(1, 2 * c)}$$` : `$$${c}+${c}=${2 * c}$$`,
            },
          ],
          tip: `켤레식은 가운데 부호만 바꾼 $${conj}$ ${ieyo(c)}. 곱하면 근호가 사라지면서 $${xa}$ ${iga(xa)} 나와 약분돼요.`,
        };
      }
    },
  },
  {
    id: 'math2-limit-inf-ratio',
    unitId: UNIT,
    title: '$\\frac\\infty\\infty$ 꼴: 최고차항의 비',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-6, 6);
        const s = rng.nonzero(-4, 4);
        const n1 = rng.int(-5, 5);
        const n0 = rng.int(-5, 5);
        const d1 = rng.int(-5, 5);
        const d0 = rng.nonzero(-5, 5);
        // 답이 ±1 만 나오면 '계수의 비'가 눈에 띄지 않는다
        if (Math.abs(p) === Math.abs(s)) continue;
        const num = [p, n1, n0];
        const den = [s, d1, d0];
        return {
          q: `$\\displaystyle\\lim_{x\\to\\infty}\\frac{${polyTex(num)}}{${polyTex(den)}}$ 의 값을 구하세요.`,
          choices: null,
          answer: fracAns(p, s),
          answerType: 'fraction',
          check: `limit((${polySym(num)})/(${polySym(den)}), x, oo)`,
          concepts: [
            '$\\frac\\infty\\infty$ 꼴은 분모의 최고차항으로 분모·분자를 나눠요.',
            '$x\\to\\infty$ 이면 $\\frac1x\\to0$, $\\frac1{x^2}\\to0$',
          ],
          steps: [
            {
              title: '꼴 확인',
              body: '$x$ 가 한없이 커지면 분자·분모 모두 한없이 커져요. $\\frac\\infty\\infty$ 꼴이에요.',
            },
            {
              title: '$x^2$ 으로 나누기',
              body: `분모의 최고차항이 $x^2$ 이므로 분모·분자를 $x^2$ 으로 나눠요.\n$$\\frac{${p}${overX(n1, 'x')}${overX(n0, 'x^2')}}{${s}${overX(d1, 'x')}${overX(d0, 'x^2')}}$$`,
            },
            {
              title: '0 으로 가는 항 지우기',
              body: `분모에 $x$ 가 남은 항은 모두 $0$ 으로 가요. 남는 것은 $\\frac{${p}}{${s}}$ ${ieyo(p)}.`,
            },
            { title: '정리', body: `$$\\frac{${p}}{${s}}=${fracTex(p, s)}$$` },
          ],
          tip: `차수가 같으면 극한값은 최고차항 계수의 비 $\\frac{${p}}{${s}}$ ${ieyo(p)}. 나머지 계수는 답에 영향을 주지 않아요.`,
        };
      }
    },
  },
  {
    id: 'math2-limit-one-sided',
    unitId: UNIT,
    title: '좌극한과 우극한',
    make(rng) {
      for (;;) {
        const a = rng.int(-2, 3);
        const p = rng.int(-4, 4);
        const qq = rng.nonzero(-3, 3);
        const r = rng.int(-4, 4);
        const left = a * a + p;
        const right = qq * a + r;
        // 좌·우가 같으면 '따로 구한다'는 연습이 흐려진다
        if (left === right) continue;
        const ans = left + right;
        const L = polyTex([1, 0, p]);
        const R = polyTex([qq, r]);
        return {
          q: `함수\n$$f(x)=\\begin{cases}${L} & (x<${a})\\\\ ${R} & (x\\ge ${a})\\end{cases}$$\n에 대하여 $\\displaystyle\\lim_{x\\to ${a}-}f(x)+\\lim_{x\\to ${a}+}f(x)$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          // sympy 1.14 의 limit 은 Piecewise 의 한쪽 극한을 틀리게 낸다(양쪽 다 오른쪽 조각 값).
          // 그래서 조각마다 그 쪽 방향의 극한을 따로 계산한다
          check: `limit(${polySym([1, 0, p])}, x, ${a}, '-') + limit(${polySym([qq, r])}, x, ${a}, '+')`,
          concepts: [
            '좌극한 $\\lim_{x\\to a-}$: 왼쪽($x<a$)에서 다가갈 때',
            '우극한 $\\lim_{x\\to a+}$: 오른쪽($x>a$)에서 다가갈 때',
          ],
          steps: [
            {
              title: '좌극한',
              body: `$x<${a}$ 쪽 식은 $${L}$ ${p === 0 ? '이에요' : ieyo(p)}.\n$$\\lim_{x\\to ${a}-}f(x)=${paren(a)}^2${p === 0 ? '' : signed(p)}=${left}$$`,
            },
            {
              title: '우극한',
              body: `$x>${a}$ 쪽 식은 $${R}$ ${r === 0 ? '예요' : ieyo(r)}.\n$$\\lim_{x\\to ${a}+}f(x)=${qq}\\cdot ${paren(a)}${r === 0 ? '' : signed(r)}=${right}$$`,
            },
            { title: '더하기', body: `$$${left}+${paren(right)}=${ans}$$` },
          ],
          tip: `좌극한과 우극한이 서로 달라서($${left}\\ne ${right}$) $x\\to ${a}$ 일 때의 극한은 없어요. 그래도 한쪽 극한은 각각 있어요.`,
        };
      }
    },
  },
];
