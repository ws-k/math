import Foundation
import WebKit

/// `mathrebuild://localhost/<경로>` 요청을 앱 안 `dist/` 파일로 답한다.
///
/// `file://` 로 열지 않는 이유: 웹 번들이 ES 모듈이라 `file://` 에서는 출처가 없어 스크립트가 막힌다.
/// 자체 스킴은 http 처럼 "출처"가 생겨 모듈·IndexedDB 가 그대로 동작한다.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    /// 스킴·호스트를 바꾸면 IndexedDB 서랍(출처별)이 달라져 그동안의 기록이 안 보인다. 바꾸지 말 것.
    /// 언젠가 바꿔야 하면 옛 스킴 핸들러를 남겨 두고 기록을 옮긴다.
    static let scheme = "mathrebuild"
    static let host = "localhost"
    static let startURL = URL(string: "mathrebuild://localhost/index.html")!

    /// 빌드 때 폴더 참조로 복사된 웹 결과물. 심볼릭 링크를 풀어 둬야 경로 탈출 검사가 정확하다
    private let root: URL = Bundle.main.resourceURL!
        .appendingPathComponent("dist", isDirectory: true)
        .standardizedFileURL
        .resolvingSymlinksInPath()

    /// 확장자 → 파일 종류. 모듈 스크립트는 종류가 자바스크립트가 아니면 WebKit 이 실행을 거부하므로
    /// `.js` 는 반드시 `text/javascript` 다. 모르는 확장자는 내려받기 취급되지 않게 바이트열로 준다.
    private static let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8",
        "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8",
        "json": "application/json; charset=utf-8",
        "webmanifest": "application/manifest+json; charset=utf-8",
        "svg": "image/svg+xml",
        "png": "image/png",
        "woff2": "font/woff2",
        "woff": "font/woff",
        "ttf": "font/ttf",
    ]

    // 파일이 앱 안에 있어(가장 큰 main.js 도 몇 MB, 읽는 데 수 ms) start 안에서 동기로 다 답한다.
    // 그러면 stop 이 와도 이미 끝난 작업이라 따로 취소할 것이 없다.
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        // 답 없이 돌아가면 WebKit 쪽 요청이 끝나지 않고 매달린다 — 실패로라도 끝낸다
        guard let url = task.request.url else { return task.didFailWithError(URLError(.badURL)) }
        guard let file = file(for: url), let data = try? Data(contentsOf: file) else {
            respond(task, url: url, status: 404, type: "text/plain; charset=utf-8", body: Data())
            return
        }
        let type = Self.mimeTypes[file.pathExtension.lowercased()] ?? "application/octet-stream"
        respond(task, url: url, status: 200, type: type, body: data)
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    /// 요청 주소 → dist 안의 파일. 다른 호스트이거나 `..` 등으로 dist 밖을 가리키면 nil
    private func file(for url: URL) -> URL? {
        guard url.host == Self.host else { return nil }
        var path = url.path(percentEncoded: false)
        if path.isEmpty || path.hasSuffix("/") { path += "index.html" }
        let file = root.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/") else { return nil }
        return file
    }

    /// 상태 코드와 Content-Type 을 실어야 WebKit 이 모듈 스크립트·글꼴을 받아들인다(URLResponse 로는 부족).
    /// no-store: 앱을 새 dist 로 바꿔 설치했는데 웹뷰가 옛 파일을 캐시에서 꺼내 쓰는 일을 막는다
    private func respond(_ task: any WKURLSchemeTask, url: URL, status: Int, type: String, body: Data) {
        let headers = [
            "Content-Type": type,
            "Content-Length": String(body.count),
            "Cache-Control": "no-store",
        ]
        let response = HTTPURLResponse(
            url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}
