// 레슨 검사 테스트용 올바른 레슨. 장면 7종 중 부품 없는 6종을 다 갖췄다.
import type { Lesson, Scene } from '../src/lesson/types.ts';

const solve = (n: number) => ({
  id: `p${n}`,
  q: `방정식 $x+${n}=${n + 2}$`,
  steps: [{ title: '빼기', body: `$x=2$` }],
  answer: '2',
  answerType: 'int',
  check: `solve(Eq(x+${n},${n + 2}),x)[0]`,
});

/** 장면 7종을 다 갖춘 올바른 레슨 */
export function goodLesson(): Lesson {
  return {
    minutes: 20,
    scenes: [
      {
        kind: 'intro',
        id: 'start',
        chip: '중1',
        title: '모르는 수\n찾기',
        lead: 'a',
        meta: ['방정식'],
      },
      {
        kind: 'question',
        id: 'hook',
        title: '얼마일까요?',
        choices: [
          { value: '3000', check: '(13000-1000)/4', feedback: '쿠키를 한 잔으로 셌어요.' },
          { value: '4000', check: 'solve(Eq(3*x+1000,13000),x)[0]' },
          {
            value: '13000/3',
            check: 'solve(Eq(3*x,13000),x)[0]',
            feedback: '쿠키 값을 빼야 해요.',
          },
        ],
        format: { unit: '원', digits: 0 },
        answer: 1,
        answerCheck: 'solve(Eq(3*x+1000,13000),x)[0]',
        reveal: '**맞아요!**',
        thoughts: ['하나', '둘'],
        conclude: '==방정식==이에요.',
      },
      { kind: 'terms', id: 'terms', title: '이름', terms: [{ term: '해', body: '$x=4000$' }] },
      {
        kind: 'spot',
        id: 'traps',
        title: '틀린 곳',
        items: [
          {
            prompt: '**함정 1**',
            mode: 'identity',
            tokens: [{ sym: '-(x-3)' }, { sep: '=' }, { sym: '-x' }, { sym: '-3', bad: true }],
            fix: { sym: '+3', body: '모든 항' },
          },
          {
            prompt: '함정 2',
            mode: 'equivalent',
            from: 'x/2+1=x/3',
            tokens: [{ sym: '3*x' }, { sym: '+1', bad: true }, { sep: '=' }, { sym: '2*x' }],
            fix: { sym: '+6', body: '1에도 6을' },
          },
        ],
      },
      { kind: 'solve', id: 'try', title: '직접', items: [solve(1), solve(2)] },
      {
        kind: 'summary',
        id: 'sum',
        title: '요약',
        points: ['저울'],
        done: '끝!',
        next: '연습문제 {{problems}}개예요.',
      },
    ] as Scene[],
  };
}
