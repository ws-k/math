import type { Generator } from './types.ts';
import { ieyo, paren, polyEval, polySym, polyTex } from './util.ts';

const UNIT = 'h1-quad-eq-func';

// 이 단원의 기초는 "그래프 문제를 판별식 하나로 바꾸기"다. 그래서 풀이는 늘
// ① x축(또는 직선)과 연립해 이차방정식 하나로 만들고 ② 판별식의 부호를 본다는 같은 틀로 쓴다.
// 검산식은 그 틀을 따르지 않고 sympy 로 실근을 직접 세거나(solveset) 구간 최대·최소(maximum)를
// 구하게 해서, 풀이 쪽에서 부호를 잘못 읽으면 검산이 다른 값을 낸다.

const D_RULE = '$ax^2+bx+c=0$ 의 판별식 $D=b^2-4ac$';
const D_POS = '$D>0$ 이면 두 점, $D=0$ 이면 한 점(접함), $D<0$ 이면 만나지 않아요.';
const LINE = '포물선과 직선의 교점은 두 식을 같게 놓은 이차방정식의 실근이에요.';

/** 판별식 부호로 교점 개수 */
const countOf = (d: number) => (d > 0 ? 2 : d === 0 ? 1 : 0);
const signTex = (d: number) => (d > 0 ? '>0' : d === 0 ? '=0' : '<0');
const meetText = (n: number) =>
  n === 2 ? '서로 다른 두 점에서 만나요' : n === 1 ? '한 점에서 만나요(접해요)' : '만나지 않아요';

export const generators: Generator[] = [
  {
    id: 'qef-xaxis-count',
    unitId: UNIT,
    title: '포물선과 x축의 교점 개수',
    make(rng) {
      // 세 경우(두 점·접함·안 만남)가 고루 나오게 먼저 경우를 정하고 맞는 계수를 뽑는다
      const want = rng.pick([0, 1, 2] as const);
      for (;;) {
        const a = rng.pick([1, 1, -1, 2]);
        const b = rng.int(-6, 6);
        const c = rng.int(-6, 6);
        const d = b * b - 4 * a * c;
        if (countOf(d) !== want || c === 0) continue;
        const f = [a, b, c];
        return {
          q: `이차함수 $y=${polyTex(f)}$ 의 그래프와 $x$축의 교점은 몇 개인지 구하세요.`,
          choices: null,
          answer: String(want),
          answerType: 'int',
          check: `len(solveset(${polySym(f)}, x, S.Reals))`,
          concepts: [D_RULE, D_POS],
          steps: [
            {
              title: '이차방정식으로 바꾸기',
              body: `$x$축은 $y=0$ 이에요. 교점의 $x$좌표는 $${polyTex(f)}=0$ 의 실근이에요.`,
            },
            {
              title: '판별식 계산',
              body: `$a=${a}$, $b=${b}$, $c=${c}$ 이므로\n$$D=${paren(b)}^2-4\\cdot${paren(a)}\\cdot${paren(c)}=${d}$$`,
            },
            {
              title: '부호 읽기',
              body: `$D${signTex(d)}$ 이므로 그래프는 $x$축과 ${meetText(want)}. 교점은 ${want}개예요.`,
            },
          ],
          tip: '근을 직접 구하지 않아도 판별식의 부호만으로 교점의 개수를 알 수 있어요.',
        };
      }
    },
  },
  {
    id: 'qef-tangent-k',
    unitId: UNIT,
    title: '포물선과 직선이 접할 조건',
    make(rng) {
      for (;;) {
        const b = rng.int(-6, 6);
        const m = rng.int(-4, 4);
        const n = rng.int(-5, 5);
        const e = b - m; // 연립한 식의 일차항 계수
        if (e % 2 !== 0 || e === 0) continue;
        // D=e^2-4(k-n)=0 → k=n+e^2/4
        const k = n + (e * e) / 4;
        if (Math.abs(k) > 20) continue;
        const lineTex = polyTex([m, n]);
        const lineSym = polySym([m, n]);
        const qf = `x^2${b === 0 ? '' : (b > 0 ? '+' : '') + polyTex([b, 0])}+k`;
        // 연립한 식의 상수항 k-n. n=0 이면 괄호 없이 k
        const kt = n === 0 ? 'k' : `(k${n > 0 ? `-${n}` : `+${-n}`})`;
        const eqTex = `x^2${e > 0 ? '+' : ''}${polyTex([e, 0])}+${kt}=0`;
        return {
          q: `이차함수 $y=${qf}$ 의 그래프와 직선 $y=${lineTex}$ 가 접할 때, 상수 $k$ 의 값을 구하세요.`,
          choices: null,
          answer: String(k),
          answerType: 'int',
          check: `solve(Eq(discriminant(x**2 + ${b}*x + k - (${lineSym}), x), 0), k)[0]`,
          concepts: [LINE, D_RULE, '접한다 ⇔ $D=0$'],
          steps: [
            {
              title: '두 식을 같게 놓기',
              body: `$${qf}=${lineTex}$ 에서 오른쪽을 왼쪽으로 옮기면\n$$${eqTex}$$`,
            },
            {
              title: '판별식이 0',
              body: `접하므로 이 방정식은 중근을 가져요.\n$$D=${paren(e)}^2-4${kt}=0$$`,
            },
            {
              title: '$k$ 구하기',
              body: `$4${kt}=${e * e}$ 이므로 $k=${k}$ ${ieyo(k)}.`,
            },
          ],
          tip: '직선의 식을 옮기지 않고 포물선 식만으로 판별식을 구하면 $x$축과 접하는 조건이 돼요. 꼭 한쪽으로 모아요.',
        };
      }
    },
  },
  {
    id: 'qef-line-count',
    unitId: UNIT,
    title: '포물선과 직선의 교점 개수',
    make(rng) {
      const want = rng.pick([0, 1, 2] as const);
      for (;;) {
        const b = rng.int(-5, 5);
        const c = rng.int(-5, 5);
        const m = rng.int(-3, 3);
        const n = rng.int(-5, 5);
        const f = [1, b - m, c - n];
        const d = (b - m) ** 2 - 4 * (c - n);
        if (countOf(d) !== want || m === 0) continue;
        const pTex = polyTex([1, b, c]);
        const lTex = polyTex([m, n]);
        return {
          q: `이차함수 $y=${pTex}$ 의 그래프와 직선 $y=${lTex}$ 의 교점은 몇 개인지 구하세요.`,
          choices: null,
          answer: String(want),
          answerType: 'int',
          check: `len(solveset(Eq(${polySym([1, b, c])}, ${polySym([m, n])}), x, S.Reals))`,
          concepts: [LINE, D_RULE, D_POS],
          steps: [
            {
              title: '두 식을 같게 놓기',
              body: `$${pTex}=${lTex}$ 에서 모두 왼쪽으로 옮기면\n$$${polyTex(f)}=0$$`,
            },
            {
              title: '판별식 계산',
              body: `$$D=${paren(f[1] as number)}^2-4\\cdot1\\cdot${paren(f[2] as number)}=${d}$$`,
            },
            {
              title: '부호 읽기',
              body: `$D${signTex(d)}$ 이므로 포물선과 직선은 ${meetText(want)}. 교점은 ${want}개예요.`,
            },
          ],
          tip: '포물선 식의 판별식만 보면 $x$축과의 관계예요. 직선과의 관계는 두 식의 차로 판별해요.',
        };
      }
    },
  },
  {
    id: 'qef-range-maxmin',
    unitId: UNIT,
    title: '범위가 정해진 이차함수의 최대·최소',
    make(rng) {
      for (;;) {
        const a = rng.pick([1, -1]);
        const p = rng.int(-2, 4);
        const qv = rng.int(-5, 5);
        const lo = rng.int(-2, 3);
        const hi = lo + rng.int(2, 4);
        const askMax = rng.next() < 0.5;
        // y=a(x-p)^2+q 를 펼친 계수
        const f = [a, -2 * a * p, a * p * p + qv];
        const inside = p >= lo && p <= hi;
        const cands = [lo, hi, ...(inside ? [p] : [])];
        const vals = cands.map((t) => polyEval(f, t));
        const ans = askMax ? Math.max(...vals) : Math.min(...vals);
        if (Math.abs(ans) > 40) continue;
        const word = askMax ? '최댓값' : '최솟값';
        const fTex = polyTex(f);
        const vTex = `${a === 1 ? '' : '-'}(x${p === 0 ? '' : p > 0 ? `-${p}` : `+${-p}`})^2${qv === 0 ? '' : qv > 0 ? `+${qv}` : qv}`;
        const list = cands.map((t, i) => `$f(${t})=${vals[i]}$`).join(', ');
        return {
          q: `$${lo}\\le x\\le ${hi}$ 에서 이차함수 $f(x)=${fTex}$ 의 ${word}을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `${askMax ? 'maximum' : 'minimum'}(${polySym(f)}, x, Interval(${lo}, ${hi}))`,
          concepts: [
            '범위가 정해지면 최대·최소 후보는 꼭짓점(범위 안일 때)과 양 끝점이에요.',
            '$y=a(x-p)^2+q$ 의 꼭짓점은 $(p,\\ q)$',
          ],
          steps: [
            {
              title: '꼭짓점 찾기',
              body: `$f(x)=${vTex}$ 이므로 꼭짓점의 $x$좌표는 $${p}$ ${ieyo(p)}.`,
            },
            {
              title: '꼭짓점이 범위 안인가',
              body: inside
                ? `꼭짓점이 $${lo}\\le x\\le ${hi}$ 안에 있어요. 후보는 꼭짓점과 양 끝점이에요.`
                : `꼭짓점이 $${lo}\\le x\\le ${hi}$ 밖에 있어요. 후보는 양 끝점뿐이에요.`,
            },
            {
              title: '후보의 값 비교',
              body: `${list} 이므로 ${word}은 $${ans}$ ${ieyo(ans)}.`,
            },
          ],
          tip: '꼭짓점이 범위 밖이면 그래프가 범위 안에서 한쪽으로만 올라가거나 내려가요. 그래서 끝점에서 최대·최소가 나와요.',
        };
      }
    },
  },
];
