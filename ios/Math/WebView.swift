import SwiftUI
import WebKit

/// 웹앱(dist)을 담는 웹뷰. 웹 코드는 고치지 않고 그대로 싣는다.
struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(context.coordinator.files, forURLScheme: BundleSchemeHandler.scheme)
        // 웹 쪽이 "앱 안에서 열렸는지"를 이 이름의 존재로 안다(dist 는 웹·앱 한 벌).
        // 같은 이름으로 기록 사본(Backup.swift) 메시지도 받는다. 되살리기는 사본을 읽어 웹에 돌려줘야 해서
        // 답을 줄 수 있는 처리기로 넣는다(웹에서 postMessage 가 약속을 돌려준다).
        // 웹뷰가 처리기를 강하게 쥐어 순환 참조가 생기므로 약한 대리자를 거친다
        config.userContentController.addScriptMessageHandler(
            WeakMessageHandler(context.coordinator), contentWorld: .page, name: Coordinator.messageName)

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator

        // 화면 이동이 전부 <a href="#/…"> 라 길게 누르면 링크 미리보기·메뉴가 뜬다. 앱에서는 끈다
        web.allowsLinkPreview = false
        // 뒤로 쓸기는 앱의 쪽 넘김(swipe.ts)과 부딪힌다. 기본값도 꺼짐이지만 일부러 끈 것임을 남긴다
        web.allowsBackForwardNavigationGestures = false
        // 웹뷰를 화면 끝까지 펴고 안전 영역 여백은 웹 CSS(env(safe-area-inset-*))가 맡는다.
        // 스크롤 뷰가 여백을 또 넣으면 두 번 비게 된다
        web.scrollView.contentInsetAdjustmentBehavior = .never
        // 바깥(문서) 스크롤만 튕김을 끈다. 안쪽 스크롤 칸(노트·목록)은 WebKit 이 따로 다뤄 그대로다
        web.scrollView.bounces = false
        // 첫 그림이 나오기 전 흰 번쩍임 방지: 런치 화면과 같은 색(밝음 #ffffff / 어두움 #0e1117)을 비쳐 보이게
        let background = UIColor(named: "LaunchBackground")
        web.isOpaque = false
        web.backgroundColor = background
        web.scrollView.backgroundColor = background
        web.underPageBackgroundColor = background
        #if DEBUG
            // Safari 개발자 메뉴로 웹뷰 안을 들여다보는 것은 개발 빌드에서만
            web.isInspectable = true
        #endif
        web.load(URLRequest(url: BundleSchemeHandler.startURL))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate,
        WKScriptMessageHandlerWithReply
    {
        static let messageName = "mathApp"
        let files = BundleSchemeHandler()

        /// 앱 안(mathrebuild://localhost/)만 연다. 밖으로 나가는 주소는 앱에 없어야 하고,
        /// 생겨도 앱 화면이 바깥 페이지로 바뀌어 돌아올 길이 없어지므로 막는다
        func webView(
            _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
            decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
        ) {
            let url = action.request.url
            let inside = url?.scheme == BundleSchemeHandler.scheme && url?.host == BundleSchemeHandler.host
            decisionHandler(inside ? .allow : .cancel)
        }

        /// 마지막으로 되살린 시각. 되살리자마자 또 죽으면 같은 화면이 원인일 수 있어 판단에 쓴다
        private var lastRecovery: ContinuousClock.Instant?

        /// iOS 가 메모리 때문에 웹 프로세스를 죽이면 웹뷰가 흰 화면으로 남는다. 다시 불러와 되살린다
        /// (저장은 IndexedDB 라 다시 불러와도 기록은 그대로다).
        /// 되살린 지 몇 초 안에 또 죽으면 그 화면이 메모리를 못 버티는 것이라 같은 화면을 다시 열면
        /// 죽고 살리기를 끝없이 되풀이한다. 그때는 가벼운 첫 화면(홈)으로 간다
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            let now = ContinuousClock.now
            let crashedAgain = lastRecovery.map { now - $0 < .seconds(5) } ?? false
            lastRecovery = now
            if webView.url == nil || crashedAgain {
                webView.load(URLRequest(url: BundleSchemeHandler.startURL))
            } else {
                webView.reload()
            }
        }

        /// 길게 누르기 메뉴(복사·공유·링크 열기) 없음. 글자 선택 자체는 CSS 가 화면별로 정한다
        func webView(
            _ webView: WKWebView, contextMenuConfigurationForElement elementInfo: WKContextMenuElementInfo,
            completionHandler: @escaping @MainActor (UIContextMenuConfiguration?) -> Void
        ) {
            completionHandler(nil)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            #if DEBUG
                SelfCheck.runIfRequested(in: webView)
            #endif
        }

        /// 기록 사본 메시지(src/app/backup.ts). 모양이 틀리면 오류로 답해 웹 쪽 약속이 거절된다
        func userContentController(
            _ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
            replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
        ) {
            guard let op = BackupFiles.Op(message.body) else {
                replyHandler(nil, "알 수 없는 메시지")
                return
            }
            BackupFiles.shared.perform(op) { result in
                switch result {
                case .success(let reply): replyHandler(reply.object, nil)
                case .failure(let error): replyHandler(nil, error.localizedDescription)
                }
            }
        }
    }
}

/// WKUserContentController 는 처리기를 강하게 쥔다. 코디네이터를 직접 넣으면 웹뷰와 서로 쥐어 해제되지 않는다
final class WeakMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
    private weak var target: (any WKScriptMessageHandlerWithReply)?
    init(_ target: any WKScriptMessageHandlerWithReply) { self.target = target }

    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        // 답을 안 하고 버리면 웹 쪽 약속이 영영 안 풀린다 — 대상이 사라졌으면 오류로라도 답한다
        guard let target else { return replyHandler(nil, "웹뷰가 닫혔어요") }
        target.userContentController(userContentController, didReceive: message, replyHandler: replyHandler)
    }
}
