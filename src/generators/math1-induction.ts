import type { Generator } from './types.ts';
import { eul, eun, ieyo, paren } from './util.ts';

const UNIT = 'math1-induction';

// 수능 공통 16번(수열의 귀납적 정의)은 "규칙대로 한 항씩 계산"이 전부라, 풀이도 한 단계에 항 하나씩 적는다.
// 등차·등비 점화식은 일반항으로 건너뛰는 지름길을 보여 주되, tip 에서 한 항씩 해도 같다는 걸 남긴다.
// 생성기 id 는 단원 id 로 시작한다 — 예전에 다른 단원과 id 가 겹쳐 엉뚱한 문제가 나온 사고가 있었다.

/** "+3" / "-3" — 식 뒤에 상수를 이어 붙일 때 */
const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

const REC = '귀납적 정의: 첫째항과 $a_{n+1}$ 을 $a_n$ 으로 나타낸 식(점화식)으로 수열을 정해요.';
const ARITH = '$a_{n+1}=a_n+d$ 꼴이면 공차가 $d$ 인 등차수열: $a_n=a_1+(n-1)d$';
const GEO = '$a_{n+1}=ra_n$ 꼴이면 공비가 $r$ 인 등비수열: $a_n=a_1r^{n-1}$';

// 점화식 뒤 조사: 끝이 a_n('엔')이면 받침이 있어 '을'
const head = (a1: number, rule: string) =>
  `수열 $\\{a_n\\}$ 이 $a_1=${a1}$ 이고, 모든 자연수 $n$ 에 대하여 $${rule}$ ${/n$/.test(rule) ? '을' : eul(rule)} 만족시켜요.`;

/** 검산식: 첫째항에서 점화식을 (k-1)번 그대로 돌린다. 일반항 공식을 쓰지 않아 풀이와 독립이다 */
const loopCheck = (a1: number, step: string, k: number) =>
  `v = ${a1}\nfor _ in range(${k - 1}):\n    v = ${step}\nans = v`;

export const generators: Generator[] = [
  {
    id: 'math1-induction-arith-term',
    unitId: UNIT,
    title: '등차 점화식의 항',
    make(rng) {
      for (;;) {
        const a1 = rng.int(-5, 9);
        const d = rng.nonzero(-4, 6);
        const k = rng.int(6, 12);
        const ans = a1 + (k - 1) * d;
        if (ans === 0) continue;
        return {
          q: `${head(a1, `a_{n+1}=a_n${signed(d)}`)} $a_{${k}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: loopCheck(a1, `v + (${d})`, k),
          concepts: [REC, ARITH],
          steps: [
            {
              title: '점화식 읽기',
              body: `$a_{n+1}-a_n=${d}$, 곧 이웃한 두 항의 차가 늘 $${d}$ ${ieyo(d)}. 공차가 $${d}$ 인 등차수열이에요.`,
            },
            {
              title: '일반항 세우기',
              body: `첫째항에서 $n-1$ 번 $${d}$ 씩 더해요.\n$$a_n=${a1}+(n-1)\\cdot ${paren(d)}$$`,
            },
            {
              title: `$n=${k}$ 대입`,
              body: `$$a_{${k}}=${a1}+${k - 1}\\cdot ${paren(d)}=${ans}$$`,
            },
          ],
          tip: `$${k}$ 번째 항은 첫째항에서 $${k}$ 번이 아니라 $${k - 1}$ 번 뛴 자리예요. $(n-1)$ 을 $n$ 으로 쓰는 실수가 가장 많아요.`,
        };
      }
    },
  },
  {
    id: 'math1-induction-geo-term',
    unitId: UNIT,
    title: '등비 점화식의 항',
    make(rng) {
      for (;;) {
        const a1 = rng.pick([1, 2, 3, -1, -2, -3]);
        const r = rng.pick([2, 3, -2, -3]);
        const k = rng.int(4, 7);
        const ans = a1 * r ** (k - 1);
        if (Math.abs(ans) > 800) continue;
        return {
          q: `${head(a1, `a_{n+1}=${r}a_n`)} $a_{${k}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: loopCheck(a1, `(${r})*v`, k),
          concepts: [REC, GEO],
          steps: [
            {
              title: '점화식 읽기',
              body: `다음 항은 앞 항에 $${r}$ ${eul(r)} 곱한 값이에요. 공비가 $${r}$ 인 등비수열이에요.`,
            },
            {
              title: '일반항 세우기',
              body: `첫째항에 $${r}$ ${eul(r)} $n-1$ 번 곱해요.\n$$a_n=${a1}\\cdot ${paren(r)}^{n-1}$$`,
            },
            {
              title: `$n=${k}$ 대입`,
              body: `$${paren(r)}^{${k - 1}}=${r ** (k - 1)}$ 이므로\n$$a_{${k}}=${a1}\\cdot ${paren(r ** (k - 1))}=${ans}$$`,
            },
          ],
          // 부호 이야기는 공비가 음수일 때만 의미가 있다(양수 공비에 "곱한 부분은 음수"라 쓰면 틀린 말이 된다)
          tip:
            r < 0
              ? `공비가 음수면 항의 부호가 번갈아 바뀌어요. 지수 $${k - 1}$ ${eun(k - 1)} ${(k - 1) % 2 === 0 ? '짝수라 곱한 부분은 양수' : '홀수라 곱한 부분은 음수'}예요.`
              : `$${k}$ 번째 항이라도 공비는 $${k - 1}$ 번만 곱해요. 지수를 $${k}$ 로 쓰는 실수가 가장 많아요.`,
        };
      }
    },
  },
  {
    id: 'math1-induction-linear-rec',
    unitId: UNIT,
    title: '$a_{n+1}=pa_n+q$ 꼴의 항',
    make(rng) {
      for (;;) {
        const p = rng.pick([2, 3, -1, -2]);
        const q = rng.nonzero(-4, 4);
        const a1 = rng.int(-3, 3);
        const a2 = p * a1 + q;
        const a3 = p * a2 + q;
        const a4 = p * a3 + q;
        // 항이 그대로 머물면(고정점) 계산할 것이 없고, 너무 크면 손계산이 지루하다
        if (a2 === a1 || a4 === 0 || Math.abs(a4) > 150) continue;
        const rule = (prev: number, out: number) => `${p}\\cdot ${paren(prev)}${signed(q)}=${out}`;
        return {
          q: `${head(a1, `a_{n+1}=${p}a_n${signed(q)}`)} $a_4$ 의 값을 구하세요.`,
          choices: null,
          answer: String(a4),
          answerType: 'int',
          check: loopCheck(a1, `(${p})*v + (${q})`, 4),
          concepts: [REC, '점화식에 $n=1,2,3,\\cdots$ 을 차례로 넣으면 다음 항이 하나씩 나와요.'],
          steps: [
            { title: '$n=1$ 넣기', body: `$$a_2=${rule(a1, a2)}$$` },
            { title: '$n=2$ 넣기', body: `$$a_3=${rule(a2, a3)}$$` },
            { title: '$n=3$ 넣기', body: `$$a_4=${rule(a3, a4)}$$` },
          ],
          tip: '등차도 등비도 아닌 점화식은 공식 대신 한 항씩 계산해요. 앞에서 구한 항을 바로 다음 줄에 넣는 것이 전부예요.',
        };
      }
    },
  },
  {
    id: 'math1-induction-parity-rec',
    unitId: UNIT,
    title: '짝·홀에 따라 갈리는 점화식',
    make(rng) {
      for (;;) {
        const c = rng.pick([1, 3, 5, 7]);
        const a1 = rng.int(2, 24);
        const k = rng.int(5, 6);
        const seq = [a1];
        for (let i = 1; i < k; i++) {
          const v = seq[i - 1] as number;
          seq.push(v % 2 === 0 ? v / 2 : v + c);
        }
        const ans = seq[k - 1] as number;
        // 짝·홀 두 규칙이 모두 한 번 이상 쓰여야 이 유형을 연습하는 의미가 있다
        const evens = seq.slice(0, -1).filter((v) => v % 2 === 0).length;
        if (evens === 0 || evens === k - 1) continue;
        const steps = seq.slice(0, -1).map((v, i) => ({
          title: `$a_{${i + 2}}$ 구하기`,
          body:
            v % 2 === 0
              ? `$a_{${i + 1}}=${v}$ ${eun(v)} 짝수라 2로 나눠요. $a_{${i + 2}}=\\frac{${v}}{2}=${v / 2}$`
              : `$a_{${i + 1}}=${v}$ ${eun(v)} 홀수라 $${c}$ ${eul(c)} 더해요. $a_{${i + 2}}=${v}+${c}=${v + c}$`,
        }));
        return {
          q: `수열 $\\{a_n\\}$ 이 $a_1=${a1}$ 이고, 모든 자연수 $n$ 에 대하여\n$$a_{n+1}=\\begin{cases}\\dfrac{a_n}{2} & (a_n\\text{이 짝수인 경우})\\\\ a_n+${c} & (a_n\\text{이 홀수인 경우})\\end{cases}$$\n를 만족시켜요. $a_{${k}}$ 의 값을 구하세요.`,
          choices: null,
          answer: String(ans),
          answerType: 'int',
          check: `v = ${a1}\nfor _ in range(${k - 1}):\n    v = v // 2 if v % 2 == 0 else v + ${c}\nans = v`,
          concepts: [REC, '항마다 짝수인지 홀수인지 먼저 보고, 그에 맞는 규칙을 골라요.'],
          steps,
          tip: '규칙이 둘로 갈리는 점화식은 일반항을 찾기보다 표처럼 한 항씩 적는 것이 가장 빠르고 안전해요.',
        };
      }
    },
  },
];
