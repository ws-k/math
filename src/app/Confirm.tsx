// 앱 안의 확인 창. 브라우저 confirm() 은 홈 화면 앱(PWA)에서 모양을 바꿀 수 없고,
// iOS 에서 펜 입력·화면 전환과 엉켜 멈춘 듯 보일 때가 있어 직접 그린다.
export function Confirm(p: {
  message: string;
  okLabel: string;
  onOk(): void;
  onCancel(): void;
  /** 처리 중: 버튼을 막고 닫히지 않게 한다 */
  busy?: boolean;
  /** 실패 안내(있으면 메시지 아래에) */
  error?: string;
}) {
  const cancel = () => {
    if (!p.busy) p.onCancel();
  };
  return (
    // 바깥(어두운 곳)을 누르면 취소 — 키보드 사용자는 취소 버튼으로 닫는다
    // biome-ignore lint/a11y/noStaticElementInteractions: 배경 누르기는 보조 동작이고 버튼이 따로 있다
    // biome-ignore lint/a11y/useKeyWithClickEvents: 위와 같음
    <div className="confirm-back" onClick={cancel}>
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={p.message}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && cancel()}
      >
        <p className="confirm-msg">{p.message}</p>
        {p.error && (
          <p className="confirm-error" role="alert">
            {p.error}
          </p>
        )}
        <div className="row confirm-row">
          <button type="button" className="btn" onClick={cancel} disabled={p.busy}>
            취소
          </button>
          <button type="button" className="btn danger" onClick={p.onOk} disabled={p.busy}>
            {p.busy ? '지우는 중…' : p.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
