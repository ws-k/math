import type { Generator } from './types.ts';
import { paren, polyDiff, polyEval, polyMul, polySym, polyTex } from './util.ts';

const UNIT = 'math2-diff-polynomial';

// 이 단원의 도구는 (x^n)'=nx^{n-1} 과 "상수배·합·차는 항마다 따로"뿐이다. 곱의 미분법은 다음 단원이라
// 곱으로 주어진 식은 먼저 전개해서 미분하게 한다(전개 → 항마다 미분 → 대입의 세 걸음을 연습시키려고).
const MAX = 150;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

/** "+3" / "-3" — 식 뒤에 상수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

// '이에요/예요', '을/를'은 앞 소리의 받침으로 갈리는데 값이 무작위라 끝 글자로 고른다
// (숫자는 일·삼·육·칠·팔·영/십이 받침, 문자는 영어 이름이라 받침 없음).
const hasBatchim = (tex: string | number) => /[013678]$/.test(String(tex));
const ieyo = (tex: string | number) => (hasBatchim(tex) ? '이에요' : '예요');
const eul = (tex: string | number) => (hasBatchim(tex) ? '을' : '를');
// '로/으로'는 ㄹ 받침(일·칠·팔)이면 '로'라서 받침 규칙과 따로 고른다
const ro = (tex: string | number) => (/[036]$/.test(String(tex)) ? '으로' : '로');

const POWER = "$(x^n)'=nx^{n-1}$, 상수의 미분은 $0$";
const LINEAR = "$\\{af(x)+bg(x)\\}'=af'(x)+bg'(x)$ — 항마다 따로 미분해요.";

/**
 * 다항식을 x=k 에서 계산하는 과정 "12-8+4=8". 남는 항이 하나뿐이면 "-1=-1" 처럼 같은 수를
 * 두 번 쓰게 되므로 값만 쓴다.
 */
function termsAt(f: number[], k: number): string {
  const deg = f.length - 1;
  const vals = f.map((c, i) => c * k ** (deg - i)).filter((v, i) => f[i] !== 0 && v !== 0);
  const total = polyEval(f, k);
  if (vals.length <= 1) return String(total);
  return `${vals.map((v, i) => (i === 0 ? String(v) : signed(v))).join('')}=${total}`;
}

export const generators: Generator[] = [
  {
    id: 'm2dp-poly-value',
    unitId: UNIT,
    title: '다항함수의 미분계수',
    make(rng) {
      for (;;) {
        const f = [rng.nonzero(-3, 3), rng.int(-5, 5), rng.int(-6, 6), rng.int(-5, 5)];
        const k = rng.int(-2, 3);
        const d = polyDiff(f);
        const ans = polyEval(d, k);
        if (!okAns(ans) || f[1] === 0) continue;
        const F = polyTex(f);
        const Dt = polyTex(d);
        return {
          q: `함수 $f(x)=${F}$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff(${polySym(f)}, x).subs(x, ${k})`,
          concepts: [POWER, LINEAR],
          steps: [
            {
              title: '항마다 미분하기',
              body: `$$f'(x)=${Dt}$$`,
            },
            {
              title: `$x=${k}$ 대입하기`,
              body: `$$f'(${k})=${termsAt(d, k)}$$`,
            },
          ],
          tip:
            f[3] === 0
              ? `항이 여러 개여도 항마다 따로 미분해 더하면 돼요. $x$ 의 미분은 $1$ 이에요.`
              : `상수항은 미분하면 사라져요. 곡선을 위아래로 옮길 뿐 기울기는 바꾸지 않기 때문이에요.`,
        };
      }
    },
  },
  {
    id: 'm2dp-find-coef',
    unitId: UNIT,
    title: '미분계수로 계수 구하기',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-5, 5);
        const c = rng.int(-6, 6);
        const k = rng.nonzero(-2, 2);
        const V = 3 * k * k + 2 * a * k + c;
        if (V === 0 || Math.abs(V) > MAX) continue;
        const F = `x^3+ax^2${c === 0 ? '' : c === 1 ? '+x' : c === -1 ? '-x' : `${signed(c)}x`}`;
        const known = 3 * k * k + c;
        // 대입 뒤 "상수 + (2k)a" 꼴. 상수가 0 이면 a 항만 남긴다
        const lhs = known === 0 ? `${2 * k}a` : `${known}${signed(2 * k)}a`;
        return {
          q: `함수 $f(x)=${F}$ 에 대하여 $f'(${k})=${V}$ 일 때, 상수 $a$ 의 값을 구하세요.`,
          choices: null,
          answer: String(a),
          answerType: 'int',
          check: `solve(Eq(diff(x**3 + a*x**2 + ${c}*x, x).subs(x, ${k}), ${V}), a)[0]`,
          concepts: [POWER, "$a$ 도 그냥 상수라서 $(ax^2)'=2ax$ 예요."],
          steps: [
            {
              title: '미분하기',
              body: `$$f'(x)=3x^2+2ax${c === 0 ? '' : signed(c)}$$`,
            },
            {
              title: `$x=${k}$ 대입하기`,
              body: `$$f'(${k})=${3 * k * k}${signed(2 * k)}a${c === 0 ? '' : signed(c)}=${lhs}$$`,
            },
            {
              title: '방정식 풀기',
              body: `$${lhs}=${V}$ 이므로 $${2 * k}a=${V - known}$, $a=${a}$ ${ieyo(a)}.`,
            },
          ],
          tip: `$a=${a}$ ${eul(a)} 넣으면 $f'(x)=${polyTex([3, 2 * a, c])}$ 이고 $f'(${k})=${V}$ ${ro(V)} 맞아요.`,
        };
      }
    },
  },
  {
    id: 'm2dp-limit-deriv',
    unitId: UNIT,
    title: '극한 식을 도함수로 계산하기',
    make(rng) {
      for (;;) {
        const f = [rng.pick([1, 1, 2, -1]), rng.int(-4, 4), rng.int(-5, 5), rng.int(-5, 5)];
        const k = rng.int(-2, 2);
        const m = rng.int(1, 3);
        const d = polyDiff(f);
        const dk = polyEval(d, k);
        const ans = m * dk;
        if (!okAns(ans)) continue;
        const up = k === 0 ? `${m === 1 ? '' : m}h` : `${k}+${m === 1 ? '' : m}h`;
        const steps = [
          {
            title: '극한을 미분계수로 바꾸기',
            body:
              m === 1
                ? `정의 그대로라 극한값은 $f'(${k})$ ${ieyo(k)}.`
                : `$x$ 가 $${m}h$ 만큼 늘었는데 분모는 $h$ 라서 극한값은 $${m}f'(${k})$ ${ieyo(k)}.`,
          },
          {
            title: '도함수 구하기',
            body: `$$f'(x)=${polyTex(d)}$$`,
          },
          {
            title: `$f'(${k})$ 계산`,
            body: `$$f'(${k})=${termsAt(d, k)}$$`,
          },
        ];
        if (m !== 1)
          steps.push({ title: `${m}배 하기`, body: `$$${m}\\cdot ${paren(dk)}=${ans}$$` });
        return {
          q: `함수 $f(x)=${polyTex(f)}$ 에 대하여 $\\displaystyle\\lim_{h\\to0}\\frac{f(${up})-f(${k})}{h}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `f = ${polySym(f)}\nans = limit((f.subs(x, ${k} + ${m}*h) - f.subs(x, ${k}))/h, h, 0)`,
          concepts: ["미분계수: $f'(a)=\\lim_{h\\to0}\\frac{f(a+h)-f(a)}{h}$", POWER],
          steps,
          tip: `$f(${up})$ 를 직접 전개하면 길어요. 극한 식을 $f'(${k})$ ${ro(k)} 바꾸고 도함수에 대입하는 쪽이 훨씬 짧아요.`,
        };
      }
    },
  },
  {
    id: 'm2dp-expand-diff',
    unitId: UNIT,
    title: '전개한 뒤 미분하기',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-4, 4);
        const q = rng.nonzero(-5, 5);
        const k = rng.int(-2, 2);
        const g = [1, p];
        const h = [1, 0, q];
        const f = polyMul(g, h);
        const d = polyDiff(f);
        const ans = polyEval(d, k);
        if (!okAns(ans)) continue;
        const G = polyTex(g);
        const H = polyTex(h);
        return {
          q: `함수 $f(x)=(${G})(${H})$ 에 대하여 $f'(${k})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `diff((${polySym(g)})*(${polySym(h)}), x).subs(x, ${k})`,
          concepts: [POWER, LINEAR, '곱으로 된 식은 먼저 전개해요.'],
          steps: [
            {
              title: '전개하기',
              body: `$$f(x)=${polyTex(f)}$$`,
            },
            {
              title: '항마다 미분하기',
              body: `$$f'(x)=${polyTex(d)}$$`,
            },
            {
              title: `$x=${k}$ 대입하기`,
              body: `$$f'(${k})=${termsAt(d, k)}$$`,
            },
          ],
          tip: `괄호마다 따로 미분해 곱하면 $1\\cdot 2x$ 처럼 틀린 값이 나와요. 곱은 전개한 뒤 미분해요(다음 단원에서 곱의 미분법으로 더 빨리 푸는 법을 배워요).`,
        };
      }
    },
  },
];
