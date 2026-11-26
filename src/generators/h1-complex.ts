import type { Generator } from './types.ts';
import { jo, paren } from './util.ts';

const UNIT = 'h1-complex';

// 복소수는 (실수부, 허수부) 두 정수로 들고 다닌다. 화면 글자(cTex)와 검산식(cSym)을 같은 두 수에서 만든다.

/** a+bi 의 TeX: (3,-1) → 3-i, (0,2) → 2i, (4,0) → 4 */
export function cTex(a: number, b: number): string {
  if (b === 0) return String(a);
  const bi = Math.abs(b) === 1 ? 'i' : `${Math.abs(b)}i`;
  if (a === 0) return (b < 0 ? '-' : '') + bi;
  return `${a}${b < 0 ? '-' : '+'}${bi}`;
}

/** a+bi 의 sympy 식 */
const cSym = (a: number, b: number) => `(${a} + (${b})*I)`;

/** 덧셈 꼴로 쓸 때 앞에 붙는 부호까지: 3 → +3, -3 → -3 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

/** 부호 붙은 n·s (계수 ±1 이면 숫자를 뺀다): (1,'i') → +i, (-3,'i^2') → -3i^2 */
const si = (n: number, s: string) => (n === 1 ? `+${s}` : n === -1 ? `-${s}` : `${signed(n)}${s}`);

const II = '$i^2=-1$ 이에요. $i$ 는 보통의 문자처럼 계산하고, $i^2$ 이 나오면 $-1$ 로 바꿔요.';

export const generators: Generator[] = [
  {
    id: 'complex-mul',
    unitId: UNIT,
    title: '복소수의 곱셈',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-4, 4);
        const b = rng.nonzero(-4, 4);
        const c = rng.nonzero(-4, 4);
        const d = rng.nonzero(-4, 4);
        const re = a * c - b * d;
        const im = a * d + b * c;
        if (im === 0 || re === 0) continue;
        return {
          q: `$(${cTex(a, b)})(${cTex(c, d)})=p+qi$ 일 때 실수 $p$, $q$ 에 대하여 $p+q$ 의 값을 구하세요.`,
          choices: null,
          answer: String(re + im),
          answerType: 'int',
          check: `ee = expand(${cSym(a, b)}*${cSym(c, d)})\nans = re(ee) + im(ee)`,
          concepts: [II, '두 복소수가 같으면 실수부끼리, 허수부끼리 같아요.'],
          steps: [
            {
              title: '분배법칙으로 펼치기',
              body: `$$${a * c}${si(a * d, 'i')}${si(b * c, 'i')}${si(b * d, 'i^2')}$$`,
            },
            {
              title: '$i^2=-1$ 로 바꾸기',
              body: `$${si(b * d, 'i^2').replace(/^\+/, '')}=${-b * d}$ ${jo(String(-b * d), '이에요/예요')}.\n$$${a * c}${signed(-b * d)}${si(im, 'i')}=${cTex(re, im)}$$`,
            },
            { title: '더하기', body: `$p=${re}$, $q=${im}$\n$$p+q=${re + im}$$` },
          ],
          tip: '$i^2$ 을 $1$ 로 두면 실수부의 부호가 뒤집혀요.',
        };
      }
    },
  },
  {
    id: 'complex-div',
    unitId: UNIT,
    title: '켤레복소수로 나눗셈하기',
    make(rng) {
      for (;;) {
        // 몫 p+qi 와 나누는 수 c+di 를 먼저 정하고 나뉘는 수를 곱해서 만든다 — 몫이 정수로 떨어지게
        const p = rng.nonzero(-3, 3);
        const q = rng.nonzero(-3, 3);
        const c = rng.nonzero(-3, 3);
        const d = rng.nonzero(-3, 3);
        const a = p * c - q * d;
        const b = p * d + q * c;
        if (a === 0 || b === 0) continue;
        const n2 = c * c + d * d;
        // 분자에 켤레 c-di 를 곱한 값
        const ure = a * c + b * d;
        const uim = b * c - a * d;
        return {
          q: `$\\dfrac{${cTex(a, b)}}{${cTex(c, d)}}=p+qi$ 일 때 실수 $p$, $q$ 에 대하여 $p+q$ 의 값을 구하세요.`,
          choices: null,
          answer: String(p + q),
          answerType: 'int',
          check: `ee = expand(${cSym(a, b)}*conjugate(${cSym(c, d)}))/expand(${cSym(c, d)}*conjugate(${cSym(c, d)}))\nans = re(ee) + im(ee)`,
          concepts: [
            '분모의 켤레복소수를 분자·분모에 곱하면 분모가 실수가 돼요: $(c+di)(c-di)=c^2+d^2$',
            II,
          ],
          steps: [
            {
              title: '분모의 켤레 곱하기',
              body: `분자·분모에 $${cTex(c, -d)}$ ${jo(cTex(c, -d), '을/를')} 곱해요.`,
            },
            {
              title: '분모',
              body: `$$(${cTex(c, d)})(${cTex(c, -d)})=${c * c}+${d * d}=${n2}$$`,
            },
            {
              title: '분자',
              body: `$$(${cTex(a, b)})(${cTex(c, -d)})=${cTex(ure, uim)}$$`,
            },
            {
              title: '나누고 더하기',
              body: `$$\\frac{${cTex(ure, uim)}}{${n2}}=${cTex(p, q)},\\quad p+q=${p}+${paren(q)}=${p + q}$$`,
            },
          ],
          tip: '분모에 $i$ 가 남으면 아직 끝난 게 아니에요. 켤레를 곱해 분모를 실수로 만들어요.',
        };
      }
    },
  },
  {
    id: 'i-power',
    unitId: UNIT,
    title: '$i$ 의 거듭제곱',
    make(rng) {
      for (;;) {
        const n = rng.int(5, 60);
        const m = rng.int(5, 60);
        if (n === m) continue;
        // i^n 은 n 을 4 로 나눈 나머지로 정해진다: 1, i, -1, -i
        const cyc: [number, number][] = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ];
        const [ar, ai] = cyc[n % 4] as [number, number];
        const [br, bi] = cyc[m % 4] as [number, number];
        const re = ar + br;
        const im = ai + bi;
        const ans = re + im;
        return {
          q: `$i^{${n}}+i^{${m}}=p+qi$ 일 때 실수 $p$, $q$ 에 대하여 $p+q$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `ee = I**${n} + I**${m}\nans = re(ee) + im(ee)`,
          concepts: [
            '$i^4=1$ 이라서 $i$ 의 거듭제곱은 $i,\\ -1,\\ -i,\\ 1$ 이 네 번마다 되풀이돼요.',
          ],
          steps: [
            {
              title: '4 로 나눈 나머지',
              body: `$${n}=4\\times${Math.floor(n / 4)}+${n % 4}$, $${m}=4\\times${Math.floor(m / 4)}+${m % 4}$`,
            },
            {
              title: '각각 줄이기',
              body: `$$i^{${n}}=i^{${n % 4}}=${cTex(ar, ai)},\\quad i^{${m}}=i^{${m % 4}}=${cTex(br, bi)}$$`,
            },
            {
              title: '더하기',
              body: `$$i^{${n}}+i^{${m}}=${cTex(re, im)},\\quad p+q=${ans}$$`,
            },
          ],
          tip: '$i^0=1$ 이에요. 나머지가 $0$ 이면 $1$ 로 바꿔요.',
        };
      }
    },
  },
  {
    id: 'complex-equal',
    unitId: UNIT,
    title: '복소수가 서로 같을 조건',
    make(rng) {
      for (;;) {
        const a = rng.int(-5, 5);
        const b = rng.nonzero(-5, 5);
        const x0 = rng.nonzero(-6, 6);
        const y0 = rng.nonzero(-6, 6);
        const c = x0 + a;
        const d = 2 * y0 - b;
        if (c === 0 || d === 0) continue;
        const left = `(x${a === 0 ? '' : signed(a)})+(2y${signed(-b)})i`;
        return {
          q: `실수 $x$, $y$ 에 대하여 $${left}=${cTex(c, d)}$ 일 때 $x+y$ 의 값을 구하세요.`,
          choices: null,
          answer: String(x0 + y0),
          answerType: 'int',
          check: `xr, yr = symbols('xr yr', real=True)\nee = expand(xr + (${a}) + (2*yr - (${b}))*I - ${cSym(c, d)})\nsol = solve([re(ee), im(ee)], [xr, yr])\nans = sol[xr] + sol[yr]`,
          concepts: ['$a$, $b$, $c$, $d$ 가 실수일 때 $a+bi=c+di$ 이면 $a=c$, $b=d$ 예요.'],
          steps: [
            {
              title: '실수부끼리',
              body: `$$x${a === 0 ? '' : signed(a)}=${c},\\quad x=${x0}$$`,
            },
            {
              title: '허수부끼리',
              body: `$$2y${signed(-b)}=${d},\\quad y=${y0}$$`,
            },
            { title: '더하기', body: `$$x+y=${x0}+${paren(y0)}=${x0 + y0}$$` },
          ],
          tip: '$x$, $y$ 가 실수라는 조건이 있어야 실수부·허수부로 나눌 수 있어요.',
        };
      }
    },
  },
];
