import type { Step } from '../content/types.ts';
import type { Rng } from './rng.ts';
import type { Generator, GenProblem } from './types.ts';
import { jo } from './util.ts';

const UNIT = 'e-whole-ops';

const ORDER = '계산 순서: 괄호 안 → 곱셈·나눗셈(앞에서부터) → 덧셈·뺄셈(앞에서부터)';

/** 혼합 계산. 늘 앞에서부터 계산하면 틀리게 되는 꼴만 낸다 — 순서 규칙을 실제로 써야 풀리게 하려고 */
function mixedOrder(rng: Rng): GenProblem {
  const form = rng.pick(['add', 'sub', 'paren', 'muldiv'] as const);
  if (form === 'add' || form === 'sub') {
    let a: number;
    let b: number;
    let c: number;
    do {
      a = rng.int(20, 99);
      b = rng.int(3, 15);
      c = rng.int(2, 9);
    } while (form === 'sub' && a <= b * c);
    const p = b * c;
    const op = form === 'add' ? '+' : '-';
    const ans = form === 'add' ? a + p : a - p;
    return {
      q: `다음을 계산하세요.\n$$${a}${op}${b}\\times ${c}$$`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `${a} ${op} ${b}*${c}`,
      concepts: [ORDER],
      steps: [
        {
          title: '곱셈 먼저',
          body: `${form === 'add' ? '덧셈' : '뺄셈'}보다 곱셈을 먼저 해요.\n$$${b}\\times ${c}=${p}$$`,
        },
        {
          title: form === 'add' ? '덧셈' : '뺄셈',
          body: `$$${a}${op}${p}=${ans}$$`,
        },
      ],
      tip:
        form === 'add'
          ? `앞에서부터 $${a}+${b}$${jo(b, '을/를')} 먼저 하면 $${(a + b) * c}$${jo((a + b) * c, '이/가')} 나와요. 곱셈이 먼저예요.`
          : '빼는 수가 곱셈이면, 곱셈으로 빼는 양을 먼저 구한 다음 빼요.',
    };
  }
  if (form === 'paren') {
    const a = rng.int(10, 60);
    const b = rng.int(2, 30);
    const c = rng.int(2, 9);
    const s = a + b;
    return {
      q: `다음을 계산하세요.\n$$(${a}+${b})\\times ${c}$$`,
      choices: null,
      answer: String(s * c),
      answerType: 'int',
      check: `(${a} + ${b})*${c}`,
      concepts: [ORDER],
      steps: [
        { title: '괄호 안 먼저', body: `$$${a}+${b}=${s}$$` },
        { title: '곱셈', body: `$$${s}\\times ${c}=${s * c}$$` },
      ],
      tip: `괄호가 없다면 $${a}+${b}\\times ${c}=${a + b * c}$${jo(a + b * c, '이에요/예요')}. 괄호 하나로 답이 달라져요.`,
    };
  }
  let a: number;
  let b: number;
  let d: number;
  let k: number;
  do {
    a = rng.int(6, 25);
    b = rng.int(3, 9);
    d = rng.int(2, 9);
    k = rng.int(2, 12);
  } while (a * b <= k);
  const c = d * k;
  const p = a * b;
  return {
    q: `다음을 계산하세요.\n$$${a}\\times ${b}-${c}\\div ${d}$$`,
    choices: null,
    answer: String(p - k),
    answerType: 'int',
    check: `${a}*${b} - Rational(${c}, ${d})`,
    concepts: [ORDER],
    steps: [
      { title: '앞의 곱셈', body: `$$${a}\\times ${b}=${p}$$` },
      { title: '뒤의 나눗셈', body: `뺄셈보다 나눗셈을 먼저 해요.\n$$${c}\\div ${d}=${k}$$` },
      { title: '뺄셈', body: `$$${p}-${k}=${p - k}$$` },
    ],
    tip: '곱셈과 나눗셈을 모두 끝낸 다음에 덧셈·뺄셈을 해요.',
  };
}

/** 몫과 나머지. 나머지가 0 이 아닌 경우만 — "나누는 수보다 작은 나머지"를 직접 보게 하려고 */
function divRemainder(rng: Rng): GenProblem {
  const b = rng.int(3, 9);
  const qt = rng.int(4, 30);
  const r = rng.int(1, b - 1);
  const a = b * qt + r;
  const ask = rng.pick(['몫', '나머지'] as const);
  const story = rng.next() < 0.5;
  const q = story
    ? `사탕 ${a}개를 한 봉지에 ${b}개씩 담아요. ${ask === '몫' ? '몇 봉지를 채울 수 있을까요?' : '봉지에 담지 못하고 남는 사탕은 몇 개일까요?'}`
    : `$${a}\\div ${b}$의 ${ask}${ask === '몫' ? '을' : '를'} 구하세요.`;
  return {
    q,
    choices: null,
    answer: String(ask === '몫' ? qt : r),
    answerType: 'int',
    check: ask === '몫' ? `floor(Rational(${a}, ${b}))` : `Mod(${a}, ${b})`,
    concepts: [
      '나눗셈은 나누어지는 수에서 나누는 수를 몇 번 덜어 낼 수 있는지 세는 거예요.',
      '(나누어지는 수) = (나누는 수) × (몫) + (나머지), 나머지는 나누는 수보다 작아요.',
    ],
    steps: [
      {
        title: '몫 찾기',
        body: `$${b}$에 어떤 수를 곱해야 $${a}$${jo(a, '을/를')} 넘지 않으면서 가장 가까운지 찾아요.\n$$${b}\\times ${qt}=${b * qt},\\quad ${b}\\times ${qt + 1}=${b * (qt + 1)}$$\n$${b * (qt + 1)}$${jo(b * (qt + 1), '은/는')} $${a}$보다 커서 몫은 $${qt}$${jo(qt, '이에요/예요')}.`,
      },
      { title: '나머지 구하기', body: `$$${a}-${b * qt}=${r}$$` },
      {
        title: '검산',
        body: `$$${b}\\times ${qt}+${r}=${a}$$\n나머지 $${r}$${jo(r, '은/는')} $${b}$보다 작아요.`,
      },
    ],
    tip: '나머지가 나누는 수보다 크거나 같으면 한 번 더 덜어 낼 수 있다는 뜻이에요. 몫을 다시 확인해요.',
  };
}

/** 두 자리 × 두 자리. 세로셈이 "일의 자리 곱 + 십의 자리 곱"인 것을 단계로 보인다 */
function multiplyTwoDigit(rng: Rng): GenProblem {
  const a = rng.int(13, 98);
  const t = rng.int(1, 9);
  const u = rng.int(2, 9);
  const b = 10 * t + u;
  const lo = a * u;
  const hi = a * t * 10;
  return {
    q: `다음을 계산하세요.\n$$${a}\\times ${b}$$`,
    choices: null,
    answer: String(a * b),
    answerType: 'int',
    check: `${a}*${b}`,
    concepts: [
      `곱하는 수를 자리마다 나눠요: $${b}=${10 * t}+${u}$`,
      '나눠 곱한 것을 더하면 처음 곱과 같아요.',
    ],
    steps: [
      { title: '일의 자리 곱', body: `$$${a}\\times ${u}=${lo}$$` },
      {
        title: '십의 자리 곱',
        body: `십의 자리 $${t}$${jo(t, '은/는')} 사실 $${10 * t}$${jo(10 * t, '이에요/예요')}.\n$$${a}\\times ${10 * t}=${hi}$$`,
      },
      { title: '더하기', body: `$$${lo}+${hi}=${a * b}$$` },
    ],
    tip: `세로셈에서 십의 자리 곱은 한 칸 왼쪽으로 밀어 써요. 그 빈칸이 바로 0이에요. 밀지 않으면 $${lo}+${a * t}$처럼 잘못 더하게 돼요.`,
  };
}

const PLACE = ['일', '십', '백', '천'];

/** 세 자리 덧셈·뺄셈. 받아올림·받아내림이 한 번 이상 생기는 것만 — 이 유형의 목적이 그것이므로 */
function addSubCarry(rng: Rng): GenProblem {
  const op = rng.pick(['+', '-'] as const);
  for (;;) {
    const a = rng.int(op === '+' ? 105 : 302, 989);
    const b = rng.int(105, op === '+' ? 989 : a - 30);
    const da = [...String(a)].reverse().map(Number);
    const db = [...String(b)].reverse().map(Number);
    const steps: Step[] = [];
    let carry = 0;
    let events = 0;
    for (let i = 0; i < 3; i++) {
      const x = da[i] ?? 0;
      const y = db[i] ?? 0;
      const place = `${PLACE[i]}의 자리`;
      if (op === '+') {
        const s = x + y + carry;
        const plus = carry ? '+1' : '';
        const top = s >= 10;
        if (top) events++;
        steps.push({
          title: place,
          body: top
            ? `$$${x}+${y}${plus}=${s}$$\n$${s % 10}$${jo(s % 10, '을/를')} 쓰고 $1$${jo(1, '을/를')} ${PLACE[i + 1]}의 자리로 올려요.`
            : `$$${x}+${y}${plus}=${s}$$`,
        });
        carry = top ? 1 : 0;
      } else {
        const have = x - carry;
        const need = have < y;
        if (need) events++;
        const minus = carry ? '-1' : '';
        const v = need ? have + 10 - y : have - y;
        steps.push({
          title: place,
          body: need
            ? `${carry ? '아랫자리에 1을 빌려주고 남은 수에서' : `$${x}$에서`} $${y}$${jo(y, '을/를')} 뺄 수 없어요. ${PLACE[i + 1]}의 자리에서 10을 빌려요.\n$$10+${x}${minus}-${y}=${v}$$`
            : `$$${x}${minus}-${y}=${v}$$`,
        });
        carry = need ? 1 : 0;
      }
    }
    if (events === 0) continue;
    if (op === '+' && carry) {
      steps.push({ title: '천의 자리', body: '올라온 $1$을 천의 자리에 써요.' });
    }
    const ans = op === '+' ? a + b : a - b;
    steps.push({ title: '답', body: `$$${a}${op}${b}=${ans}$$` });
    return {
      q: `다음을 계산하세요.\n$$${a}${op}${b}$$`,
      choices: null,
      answer: String(ans),
      answerType: 'int',
      check: `${a} ${op} ${b}`,
      concepts: [
        '같은 자리끼리 계산해요. 일의 자리부터 시작해요.',
        op === '+'
          ? '한 자리의 합이 10 이상이면 10을 윗자리의 1로 올려요(받아올림).'
          : '윗수가 작아 뺄 수 없으면 윗자리에서 1을 빌려 10으로 바꿔요(받아내림).',
      ],
      steps,
      tip:
        op === '+'
          ? '올린 1을 윗자리에서 더하는 걸 잊기 쉬워요. 작게 적어 두면 놓치지 않아요.'
          : '자리마다 큰 수에서 작은 수를 빼 버리는 실수가 가장 흔해요. 늘 위의 수에서 아래 수를 빼요.',
    };
  }
}

export const generators: Generator[] = [
  { id: 'whole-mixed-order', unitId: UNIT, title: '혼합 계산의 순서', make: mixedOrder },
  { id: 'whole-div-remainder', unitId: UNIT, title: '몫과 나머지', make: divRemainder },
  { id: 'whole-mul-two-digit', unitId: UNIT, title: '두 자리 수의 곱셈', make: multiplyTwoDigit },
  {
    id: 'whole-addsub-carry',
    unitId: UNIT,
    title: '받아올림·받아내림이 있는 덧셈·뺄셈',
    make: addSubCarry,
  },
];
