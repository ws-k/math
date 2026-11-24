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
        #if DEBUG
            // Safari 개발자 메뉴로 웹뷰 안을 들여다보는 것은 개발 빌드에서만
            web.isInspectable = true
        #endif
        web.load(URLRequest(url: BundleSchemeHandler.startURL))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        static let messageName = "mathApp"
        let files = BundleSchemeHandler()

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
