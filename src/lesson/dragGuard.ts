// 끄는 중인지 레슨 화면에 알리는 통로. 끄는 동안 하단 '계속하기'를 막는다 —
// 손가락이 화면 아래로 미끄러져 버튼 위에서 떨어지면 장면이 넘어가 버리기 때문이다.
// 끌기 시작·끝에 한 번씩만 부른다(매 프레임 부르면 레슨 전체가 다시 그려진다).
import { createContext } from 'react';

export const DragGuard = createContext<(dragging: boolean) => void>(() => {});
