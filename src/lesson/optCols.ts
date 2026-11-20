// 질문 보기 단추의 열 수. 보기는 늘 한 줄(보기 수만큼 열)로 두지만, 단추 하나가 그 몫보다 넓으면 격자 열이
// 내용 폭만큼 늘어나 카드 밖으로 나갔다(prob-normal binom: '0.0228' 넷이 339px > 298px). 숫자·분수 보기는
// 글자 중간에서 줄을 바꿀 수 없어 단추를 좁힐 수 없으므로, 그때는 열을 반으로 줄여 두 줄로 쌓는다.

/**
 * n 개 보기를 몇 열로 둘까. need = 가장 넓은 단추에 필요한 폭(내용 + 안쪽 여백 + 테두리), width = 보기 칸 폭.
 * 보기 수 그대로 → 반(올림, 넷이면 2열) → 2열 → 한 열 순서로 처음 들어가는 것(여섯이면 3열이 넘쳐도 바로 한 열로
 * 떨어지지 않게). 폭을 모르면(0 — 재기 전·서버 렌더) n.
 */
export function optColumns(n: number, need: number, width: number, gap: number): number {
  if (width <= 0 || need <= 0) return n;
  const fits = (c: number) => c * need + (c - 1) * gap <= width + 0.5;
  for (const c of [n, Math.ceil(n / 2), 2]) if (c <= n && fits(c)) return c;
  return 1;
}
