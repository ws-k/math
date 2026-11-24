import SwiftUI
import WebKit

/// 웹앱(dist)을 담는 웹뷰. 웹 코드는 고치지 않고 그대로 싣는다.
struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(context.coordinator.files, forURLScheme: BundleSchemeHandler.scheme)
        // 웹 쪽이 "앱 안에서 열렸는지"를 이 이름의 존재로 안다(dist 는 웹·앱 한 벌).
        // 웹뷰가 처리기를 강하게 쥐어 순환 참조가 생기므로 약한 대리자를 거친다
        config.userContentController.add(
            WeakMessageHandler(context.coordinator), name: Coordinator.messageName)

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

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
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

        /// iOS 가 메모리 때문에 웹 프로세스를 죽이면 웹뷰가 흰 화면으로 남는다. 다시 불러와 되살린다
        /// (저장은 IndexedDB 라 다시 불러와도 기록은 그대로다)
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            if webView.url == nil {
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

        // 지금은 앱 감지용 표식이라 받을 메시지가 없다
        func userContentController(
            _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
        ) {}
    }
}

/// WKUserContentController 는 처리기를 강하게 쥔다. 코디네이터를 직접 넣으면 웹뷰와 서로 쥐어 해제되지 않는다
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: (any WKScriptMessageHandler)?
    init(_ target: any WKScriptMessageHandler) { self.target = target }

    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
