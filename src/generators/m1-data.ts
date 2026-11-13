import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns } from './util.ts';

const UNIT = 'm1-data';

// 상대도수는 교과서처럼 소수로 보여 준다. 정답 칸은 기약분수로 두고(채점은 값 비교) 화면 표기만 소수.
// 총합을 20·25·40·50 처럼 10의 거듭제곱을 나누는 수로만 골라 소수가 끝나게 한다.
const TOTALS = [20, 25, 40, 50];

/** n/d 를 끝나는 소수 글자로 (d 는 1000 의 약수) */
function dec(n: number, d: number): string {
  const k = (n * 1000) / d;
  const ip = Math.floor(k / 1000);
  const fp = String(k % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return fp ? `${ip}.${fp}` : String(ip);
}

// 결과 앞뒤로 같은 단위를 붙여 조사가 수에 따라 바뀌지 않게 한다(점·명·회)
function mean(rng: Rng): GenProblem {
  const n = rng.int(4, 6);
  for (;;) {
    const xs = Array.from({ length: n }, () => rng.int(2, 30));
    const s = xs.reduce((a, b) => a + b, 0);
    if (s % n !== 0) continue;
    const m = s / n;
    const list = xs.map((x) => `$${x}$`).join(', ');
    return {
      q: `$${n}$명이 1분 동안 한 줄넘기 기록이 ${list} (단위: 회)예요. 평균은 몇 회인가요?`,
      choices: null,
      answer: String(m),
      answerTex: `$${m}$회`,
      answerType: 'int',
      check: `Rational(${xs.join('+')}, ${n})`,
      concepts: ['평균 = (변량의 총합) ÷ (변량의 개수)'],
      steps: [
        { title: '모두 더하기', body: `$$${xs.join('+')}=${s}$$` },
        { title: '사람 수로 나누기', body: `$$${s}\\div${n}=${m}$$` },
      ],
      tip: '평균은 모두 똑같이 나눠 가졌을 때의 값이에요. 가장 큰 값과 가장 작은 값 사이에 있어야 해요.',
    };
  }
}

function relative(rng: Rng): GenProblem {
  const t = rng.pick(TOTALS);
  const f = rng.int(1, Math.floor(t / 2));
  const d = dec(f, t);
  return {
    q: `전체 학생 $${t}$명 가운데 어떤 계급의 도수가 $${f}$명이에요. 이 계급의 상대도수를 소수로 구하세요.`,
    choices: null,
    answer: fracAns(f, t),
    answerTex: `$${d}$`,
    answerType: 'fraction',
    check: `${f}*Rational(1, ${t})`,
    concepts: ['상대도수 = (그 계급의 도수) ÷ (도수의 총합)', '상대도수는 0 이상 1 이하예요.'],
    steps: [
      { title: '식 세우기', body: `$$${f}\\div${t}$$` },
      { title: '계산하기', body: `$$${f}\\div${t}=${d}$$` },
    ],
    tip: '상대도수는 전체에서 차지하는 비율이에요. 100을 곱하면 백분율(%)이 돼요.',
  };
}

function fromRelative(rng: Rng): GenProblem {
  const t = rng.pick(TOTALS);
  const f = rng.int(1, Math.floor(t / 2));
  const d = dec(f, t);
  if (rng.int(0, 1) === 0) {
    return {
      q: `도수의 총합이 $${t}$인 도수분포표에서 어떤 계급의 상대도수가 $${d}$예요. 이 계급의 도수를 구하세요.`,
      choices: null,
      answer: String(f),
      answerTex: `$${f}$`,
      answerType: 'int',
      check: `${t}*Rational(${f * (1000 / t)}, 1000)`,
      concepts: ['(계급의 도수) = (도수의 총합) × (상대도수)'],
      steps: [{ title: '총합에 상대도수 곱하기', body: `$$${t}\\times${d}=${f}$$` }],
      tip: '상대도수 식을 거꾸로 쓰면 돼요. 나눗셈의 반대는 곱셈이에요.',
    };
  }
  return {
    q: `어떤 계급의 도수가 $${f}$이고 상대도수가 $${d}$예요. 도수의 총합을 구하세요.`,
    choices: null,
    answer: String(t),
    answerTex: `$${t}$`,
    answerType: 'int',
    check: `solve(Eq(x*Rational(${f * (1000 / t)}, 1000), ${f}), x)[0]`,
    concepts: ['(도수의 총합) = (계급의 도수) ÷ (상대도수)'],
    steps: [{ title: '도수를 상대도수로 나누기', body: `$$${f}\\div${d}=${t}$$` }],
    tip: `확인: $${t}\\times${d}=${f}$ 이에요.`,
  };
}

function missing(rng: Rng): GenProblem {
  const w = rng.pick([5, 10]);
  const start = rng.pick(w === 5 ? [10, 15, 20] : [40, 50, 60]);
  const fs = [rng.int(1, 6), rng.int(3, 9), rng.int(4, 12), rng.int(2, 8), rng.int(1, 5)];
  const k = rng.int(0, fs.length - 1);
  const total = fs.reduce((a, b) => a + b, 0);
  const rows = fs
    .map(
      (f, i) =>
        `${start + i * w}\\text{ 이상 }${start + (i + 1) * w}\\text{ 미만} & ${i === k ? 'A' : f}`,
    )
    .join(' \\\\ ');
  const lo = start + k * w;
  const known = fs.filter((_, i) => i !== k);
  const ks = known.reduce((a, b) => a + b, 0);
  return {
    q: `다음 도수분포표에서 A 에 알맞은 수를 구하세요.\n$$\\begin{array}{c|c} \\text{계급} & \\text{도수} \\\\ \\hline ${rows} \\\\ \\hline \\text{합계} & ${total} \\end{array}$$`,
    choices: null,
    answer: String(fs[k]),
    answerTex: `$${fs[k]}$`,
    answerType: 'int',
    check: `solve(Eq(${known.join('+')}+x, ${total}), x)[0]`,
    concepts: ['도수를 모두 더하면 도수의 총합이에요.'],
    steps: [
      { title: '아는 도수 더하기', body: `$$${known.join('+')}=${ks}$$` },
      { title: '총합에서 빼기', body: `$$${total}-${ks}=${fs[k]}$$` },
    ],
    tip: `A 는 $${lo}$ 이상 $${lo + w}$ 미만 계급의 도수예요. 경계의 값은 '이상' 쪽인 다음 계급에 넣어요.`,
  };
}

export const generators: Generator[] = [
  { id: 'data-mean', unitId: UNIT, title: '평균', make: mean },
  { id: 'relative-frequency', unitId: UNIT, title: '상대도수 구하기', make: relative },
  {
    id: 'relative-frequency-inverse',
    unitId: UNIT,
    title: '상대도수로 도수·총합 구하기',
    make: fromRelative,
  },
  { id: 'frequency-table-missing', unitId: UNIT, title: '도수분포표의 빈칸', make: missing },
];
