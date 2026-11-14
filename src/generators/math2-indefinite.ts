import type { Generator } from './types.ts';
import { paren, polyDiff, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'math2-indefinite';

// 수능 공통 17번처럼 "f'(x) 와 함숫값 하나 → f(m)" 흐름을 연습시키는 게 목적이다.
// 손계산이 지루하지 않게 원시함수의 계수가 모두 정수가 되도록 f'(x) 의 계수를 고른다
// (x² 의 계수는 3의 배수, x 의 계수는 짝수) — 분수 계수는 표준·수능형 문제에서 따로 다룬다.
const MAX = 150;
const okAns = (n: number) => n !== 0 && Math.abs(n) <= MAX;

/** "+3" / "-3" — 식 뒤에 상수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

// 조사(이에요/예요, 을/를 …)는 앞 소리의 받침으로 갈리는데 값이 무작위라 TeX 끝 글자로 고른다.
// 숫자는 영·일·삼·육·칠·팔(0·1·3·6·7·8)이 받침, 거듭제곱은 '제곱'이라 받침, 분수는 분자를 끝에 읽는다
// ("3분의 4"), x·t·C·a 는 '엑스·티·씨·에이'라 받침 없음. 적분 세 단원(부정적분·정적분·넓이)이 같이 쓴다.
function lastSound(tex: string | number): { batchim: boolean; rieul: boolean } {
  const s = String(tex).trim();
  const frac = /\\[dt]?frac\{-?(\d+)\}\{\d+\}$/.exec(s);
  if (!frac && /\^\{?\d+\}?$/.test(s)) return { batchim: true, rieul: false };
  const last = frac ? (frac[1] as string).slice(-1) : s.slice(-1);
  if (/\d/.test(last)) return { batchim: /[013678]/.test(last), rieul: /[178]/.test(last) };
  return { batchim: false, rieul: false };
}
export const ieyo = (tex: string | number) => (lastSound(tex).batchim ? '이에요' : '예요');
export const eul = (tex: string | number) => (lastSound(tex).batchim ? '을' : '를');
export const iga = (tex: string | number) => (lastSound(tex).batchim ? '이' : '가');
export const wa = (tex: string | number) => (lastSound(tex).batchim ? '과' : '와');
/** 으로/로 — ㄹ 받침(일·칠·팔)은 '로' */
export const ro = (tex: string | number) => {
  const l = lastSound(tex);
  return l.batchim && !l.rieul ? '으로' : '로';
};

const POWER = '$\\int x^n\\,dx=\\dfrac{x^{n+1}}{n+1}+C$';
const CONST = '조건 하나($f(a)$ 의 값)로 적분상수 $C$ 를 정해요.';

/** 원시함수(상수항 0)의 TeX 에 "+C" 를 붙인다 */
const withC = (F: number[]) => `${polyTex(F)}+C`;

/** 다항식 F 에 x=k 를 넣는 과정을 TeX 로: 계수·거듭제곱을 그대로 보여 준다 */
export function evalSteps(F: number[], k: number): string {
  // 0 을 넣으면 상수항 말고 모두 0 이라 과정을 늘어놓지 않는다
  if (k === 0) return String(F[F.length - 1] ?? 0);
  const deg = F.length - 1;
  const parts: string[] = [];
  F.forEach((c, i) => {
    const e = deg - i;
    if (c === 0) return;
    const pow = e === 0 ? '' : e === 1 ? paren(k) : `${paren(k)}^${e}`;
    const body =
      e === 0 ? String(Math.abs(c)) : Math.abs(c) === 1 ? pow : `${Math.abs(c)}\\cdot ${pow}`;
    parts.push(`${c < 0 ? '-' : parts.length ? '+' : ''}${body}`);
  });
  return parts.length ? parts.join('') : '0';
}

/** f(m) 을 구하는 마지막 두 단계(적분상수 정하기 → 대입)를 만든다 */
function constAndValue(F: number[], k: number, v: number, m: number, name = 'f') {
  const Fk = polyEval(F, k);
  const C = v - Fk;
  const Fm = polyEval(F, m);
  const ans = Fm + C;
  const steps = [
    {
      title: '적분상수 $C$ 정하기',
      body:
        k === 0
          ? `$x=0$ 을 넣으면 $C$ 만 남아요. $${name}(0)=C$ 이고 이 값이 $${v}$ 이므로 $C=${C}$ ${ieyo(C)}.`
          : `$${name}(${k})=${evalSteps(F, k)}+C=${Fk === 0 ? 'C' : `${Fk}+C`}$ 이고 이 값이 $${v}$ 이므로 $C=${C}$ ${ieyo(C)}.`,
    },
    {
      title: `$${name}(${m})$ 계산하기`,
      body:
        m === 0
          ? `$x=0$ 을 넣으면 $C$ 만 남아요.\n$$${name}(0)=C=${ans}$$`
          : `$$${name}(${m})=${evalSteps(F, m)}${signed(C)}=${ans}$$`,
    },
  ];
  return { ans, C, steps };
}

export const generators: Generator[] = [
  {
    id: 'math2-indefinite-value',
    unitId: UNIT,
    title: "$f'(x)$ 와 함숫값 하나로 $f(m)$ 구하기",
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-2, 2);
        const b = rng.int(-3, 3);
        const c = rng.int(-5, 5);
        const k = rng.pick([0, 1, -1]);
        const m = rng.int(-2, 3);
        const v = rng.int(-5, 5);
        if (m === k) continue;
        const F = [a, b, c, 0];
        const fp = polyDiff(F);
        const { ans, C, steps } = constAndValue(F, k, v, m);
        if (!okAns(ans) || C === 0) continue;
        return {
          q: `다항함수 $f(x)$ 에 대하여 $f'(x)=${polyTex(fp)}$ 이고 $f(${k})=${v}$ 일 때, $f(${m})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          // f(m) = f(k) + ∫_k^m f'(x)dx — 풀이(부정적분+C)와 다른 길로 같은 값을 낸다
          check: `integrate(${polySym(fp)}, (x, ${k}, ${m})) + ${paren(v)}`,
          concepts: [POWER, CONST],
          steps: [
            {
              title: '항마다 적분하기',
              body: `지수는 하나 올리고, 올린 수로 나눠요.\n$$f(x)=\\int(${polyTex(fp)})\\,dx=${withC(F)}$$`,
            },
            ...steps,
          ],
          tip: `미분해서 확인할 수 있어요. $(${polyTex(F)}${signed(C)})'=${polyTex(fp)}$ 로 처음 식이 돼요.`,
        };
      }
    },
  },
  {
    id: 'math2-indefinite-expand',
    unitId: UNIT,
    title: '곱의 꼴을 전개해서 적분하기',
    make(rng) {
      for (;;) {
        const p = rng.nonzero(-4, 4);
        const q = rng.nonzero(-5, 5);
        // 전개한 x 의 계수 q+3p 가 짝수여야 적분한 x² 의 계수가 정수다
        if ((q + 3 * p) % 2 !== 0) continue;
        const r = rng.int(-5, 5);
        const m = rng.nonzero(-2, 3);
        const prod = [3, q + 3 * p, p * q];
        const F = [1, (q + 3 * p) / 2, p * q, 0];
        const { ans, steps } = constAndValue(F, 0, r, m);
        if (!okAns(ans)) continue;
        const A = polyTex([1, p]);
        const B = polyTex([3, q]);
        return {
          q: `함수 $f(x)=\\displaystyle\\int(${A})(${B})\\,dx$ 에 대하여 $f(0)=${r}$ 일 때, $f(${m})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `integrate((x + ${paren(p)})*(3*x + ${paren(q)}), (x, 0, ${m})) + ${paren(r)}`,
          concepts: [POWER, '곱은 따로 적분해서 곱하지 않아요. 먼저 전개해요.', CONST],
          steps: [
            {
              title: '먼저 전개하기',
              body: `$$(${A})(${B})=${polyTex(prod)}$$`,
            },
            {
              title: '항마다 적분하기',
              body: `$$f(x)=\\int(${polyTex(prod)})\\,dx=${withC(F)}$$`,
            },
            ...steps,
          ],
          tip: `괄호마다 따로 적분해서 곱하면 틀려요. 그렇게 만든 식을 미분해 보면 $(${A})(${B})$ ${iga(B)} 되지 않아요. 곱은 먼저 전개해요.`,
        };
      }
    },
  },
  {
    id: 'math2-indefinite-tangent',
    unitId: UNIT,
    title: '접선의 기울기와 지나는 점으로 곡선 찾기',
    make(rng) {
      for (;;) {
        const a = rng.nonzero(-3, 3);
        const b = rng.int(-6, 6);
        const k = rng.int(-2, 2);
        const v = rng.int(-6, 6);
        const m = rng.int(-2, 3);
        if (m === k) continue;
        const F = [a, b, 0];
        const fp = polyDiff(F);
        const { ans, C, steps } = constAndValue(F, k, v, m);
        if (!okAns(ans) || C === 0) continue;
        return {
          q: `곡선 $y=f(x)$ 위의 점 $(x, f(x))$ 에서의 접선의 기울기가 $${polyTex(fp)}$ 이고, 이 곡선이 점 $(${k}, ${v})$ ${eul(v)} 지나요. $f(${m})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `integrate(${polySym(fp)}, (x, ${k}, ${m})) + ${paren(v)}`,
          concepts: [
            "접선의 기울기가 $f'(x)$ 예요. 그러니 $f(x)$ 는 그 부정적분이에요.",
            POWER,
            '곡선이 지나는 점이 적분상수 $C$ 를 정해요.',
          ],
          steps: [
            {
              title: '기울기를 도함수로 읽기',
              body: `점 $(x, f(x))$ 에서의 접선의 기울기는 $f'(x)$ 이므로 $f'(x)=${polyTex(fp)}$ ${ieyo(polyTex(fp))}.`,
            },
            {
              title: '적분하기',
              body: `$$f(x)=\\int(${polyTex(fp)})\\,dx=${withC(F)}$$`,
            },
            ...steps,
          ],
          tip: `기울기만으로는 곡선이 하나로 정해지지 않아요. 위아래로 옮긴 곡선이 모두 같은 기울기를 가지기 때문이에요. 지나는 점 $(${k}, ${v})$ ${iga(v)} 그중 하나를 골라 줘요.`,
        };
      }
    },
  },
  {
    id: 'math2-indefinite-diff-inside',
    unitId: UNIT,
    title: '미분한 것을 다시 적분하기',
    make(rng) {
      for (;;) {
        const b = rng.int(-4, 4);
        const c = rng.nonzero(-6, 6);
        const r = rng.int(-5, 5);
        const m = rng.nonzero(-2, 3);
        const G = [1, b, c, 0];
        const gp = polyDiff(G);
        const { ans, steps } = constAndValue(G, 0, r, m, 'F');
        if (!okAns(ans)) continue;
        const Gt = polyTex(G);
        return {
          q: `함수 $F(x)=\\displaystyle\\int\\left\\{\\frac{d}{dx}(${Gt})\\right\\}dx$ 에 대하여 $F(0)=${r}$ 일 때, $F(${m})$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `integrate(diff(${polySym(G)}, x), (x, 0, ${m})) + ${paren(r)}`,
          concepts: [
            '$\\int\\left\\{\\frac{d}{dx}f(x)\\right\\}dx=f(x)+C$ — 미분한 것을 적분하면 상수만 달라져요.',
            CONST,
          ],
          steps: [
            {
              title: '안쪽 미분하기',
              body: `$$\\frac{d}{dx}(${Gt})=${polyTex(gp)}$$`,
            },
            {
              title: '다시 적분하기',
              body: `미분한 것을 적분하면 원래 식에 상수가 붙어요.\n$$F(x)=\\int(${polyTex(gp)})\\,dx=${withC(G)}$$`,
            },
            ...steps,
          ],
          tip: `미분을 실제로 하지 않고 $F(x)=${Gt}+C$ 로 바로 써도 돼요. 미분과 적분은 서로 거꾸로라서, 남는 것은 상수 $C$ 뿐이에요.`,
        };
      }
    },
  },
];
