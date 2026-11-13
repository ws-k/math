import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { fracAns } from './util.ts';

const UNIT = 'e-circle-area';

// 초등에서는 원주율을 3.14 로 계산한다. 검산식에서 3.14 를 그대로 쓰면 파이썬이 실수(Float)로 읽어
// 유리수 비교가 깨지므로 늘 Rational(314,100) 으로 적는다.
const PI = 'Rational(314,100)';

/** 100배 한 정수 → 소수 글자(뒤 0 제거). 3.14 를 곱한 값은 소수 둘째 자리에서 끝난다 */
function dec(n100: number): string {
  const ip = Math.floor(n100 / 100);
  const fp = String(n100 % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fp ? `${ip}.${fp}` : String(ip);
}
// 수 뒤에는 늘 단위를 붙인다. '센티미터'가 모음으로 끝나 조사가 수와 상관없이 하나로 정해진다
const cm = (s: string | number) => `$${s}$ cm`;
const cm2 = (s: string | number) => `$${s}$ cm²`;

/** 3.14 를 곱한 값 k×3.14 의 정답 칸(기약분수)과 보이는 소수 */
const timesPi = (k: number) => ({ answer: fracAns(k * 314, 100), shown: dec(k * 314) });

const PI_CONCEPT =
  '원주율은 원주 ÷ 지름이에요. 어떤 원이든 3.14… 로 같고, 계산할 때는 3.14 를 써요.';

function circumference(rng: Rng): GenProblem {
  const byR = rng.int(0, 1) === 0;
  const r = rng.int(2, 15);
  const d = byR ? r * 2 : rng.int(3, 30);
  const { answer, shown } = timesPi(d);
  const steps: Step[] = [];
  if (byR)
    steps.push({ title: '지름 구하기', body: `지름은 반지름의 2배예요.\n$$${r}\\times2=${d}$$` });
  steps.push({ title: '지름 × 원주율', body: `$$${d}\\times3.14=${shown}$$` });
  return {
    q: `${byR ? `반지름이 ${cm(r)}` : `지름이 ${cm(d)}`}인 원의 원주는 몇 cm인가요? (원주율: $3.14$)`,
    choices: null,
    answer,
    answerTex: cm(shown),
    answerType: 'fraction',
    check: byR ? `${r}*2*${PI}` : `${d}*${PI}`,
    concepts: [PI_CONCEPT, '원주 = 지름 × 원주율'],
    steps,
    tip: byR
      ? '반지름에 바로 3.14 를 곱하면 원주의 반만 나와요. 지름부터 구해요.'
      : '원주는 지름의 3배보다 조금 길어요. 어림한 값과 비교해 확인해요.',
  };
}

function area(rng: Rng): GenProblem {
  const byD = rng.int(0, 2) === 0;
  const r = rng.int(2, 15);
  const d = r * 2;
  const { answer, shown } = timesPi(r * r);
  const steps: Step[] = [];
  if (byD)
    steps.push({ title: '반지름 구하기', body: `반지름은 지름의 반이에요.\n$$${d}\\div2=${r}$$` });
  steps.push({ title: '반지름 × 반지름', body: `$$${r}\\times${r}=${r * r}$$` });
  steps.push({ title: '원주율 곱하기', body: `$$${r * r}\\times3.14=${shown}$$` });
  return {
    q: `${byD ? `지름이 ${cm(d)}` : `반지름이 ${cm(r)}`}인 원의 넓이는 몇 cm²인가요? (원주율: $3.14$)`,
    choices: null,
    answer,
    answerTex: cm2(shown),
    answerType: 'fraction',
    check: byD ? `Rational(${d},2)**2*${PI}` : `${r}*${r}*${PI}`,
    concepts: [
      '원을 잘게 잘라 엇갈려 붙이면 가로가 원주의 반, 세로가 반지름인 직사각형에 가까워져요.',
      '원의 넓이 = 반지름 × 반지름 × 원주율',
    ],
    steps,
    tip: byD
      ? '지름을 반지름처럼 쓰면 넓이가 4배가 돼요. 반지름부터 구해요.'
      : '반지름 × 2 가 아니라 반지름 × 반지름이에요.',
  };
}

function reverse(rng: Rng): GenProblem {
  if (rng.int(0, 1) === 0) {
    // 원주 → 지름(또는 반지름)
    const askR = rng.int(0, 1) === 0;
    const r = rng.int(2, 15);
    const d = askR ? r * 2 : rng.int(3, 30);
    const c100 = d * 314;
    const c = dec(c100);
    const steps: Step[] = [
      {
        title: '지름 구하기',
        body: `원주 = 지름 × 3.14 이니 거꾸로 나눠요.\n$$${c}\\div3.14=${d}$$`,
      },
    ];
    if (askR) steps.push({ title: '반지름 구하기', body: `$$${d}\\div2=${r}$$` });
    const ans = askR ? r : d;
    return {
      q: `원주가 ${cm(c)}인 원의 ${askR ? '반지름' : '지름'}은 몇 cm인가요? (원주율: $3.14$)`,
      choices: null,
      answer: String(ans),
      answerTex: cm(ans),
      answerType: 'int',
      check: askR ? `Rational(${c100},100)/${PI}/2` : `Rational(${c100},100)/${PI}`,
      concepts: [PI_CONCEPT, '지름 = 원주 ÷ 원주율'],
      steps,
      tip: '답에 3.14 를 다시 곱해 처음 원주가 나오는지 확인해요.',
    };
  }
  // 넓이 → 반지름: 반지름 × 반지름이 어떤 수인지 먼저 찾는다
  const r = rng.int(2, 12);
  const a100 = r * r * 314;
  const a = dec(a100);
  return {
    q: `넓이가 ${cm2(a)}인 원의 반지름은 몇 cm인가요? (원주율: $3.14$)`,
    choices: null,
    answer: String(r),
    answerTex: cm(r),
    answerType: 'int',
    check: `sqrt(Rational(${a100},100)/${PI})`,
    concepts: [
      '원의 넓이 = 반지름 × 반지름 × 원주율',
      '같은 수를 두 번 곱해 어떤 수가 되는지 찾아요.',
    ],
    steps: [
      { title: '원주율로 나누기', body: `$$${a}\\div3.14=${r * r}$$` },
      {
        title: '두 번 곱한 수 찾기',
        // 수 뒤 조사(이/가)가 수마다 달라지므로 수는 식 안에만 둔다
        body: `반지름 × 반지름이 앞에서 구한 값이에요. 같은 수를 두 번 곱해 그 값이 되는 수를 찾아요.\n$$${r}\\times${r}=${r * r}$$`,
      },
    ],
    tip: '넓이를 2로 나누면 안 돼요. 반지름을 두 번 곱했으니 같은 수 두 개의 곱을 찾아요.',
  };
}

export const generators: Generator[] = [
  { id: 'circle-circumference', unitId: UNIT, title: '원주 구하기', make: circumference },
  { id: 'circle-area', unitId: UNIT, title: '원의 넓이 구하기', make: area },
  { id: 'circle-reverse', unitId: UNIT, title: '원주·넓이로 지름·반지름 구하기', make: reverse },
];
