#if DEBUG
    import Foundation
    import WebKit

    /// 자가 점검(개발 빌드 전용): `simctl launch <기기> <번들ID> -selfcheck` 로 켜면
    /// 웹뷰 안에서 글꼴·보안 출처·영구 저장·IndexedDB·안전 영역·언어를 재서 `Documents/selfcheck.json` 에 쓴다.
    /// scripts/ios.mjs selfcheck 가 그 파일을 읽어 통과·실패를 낸다. 새 iOS 베타가 나올 때도 이것부터 돌린다.
    /// 점검 코드를 웹(dist)에 넣지 않은 이유: 출시 웹앱에 개발용 코드가 실리지 않게.
    enum SelfCheck {
        static let fileName = "selfcheck.json"
        private static var done = false

        static func runIfRequested(in web: WKWebView) {
            guard !done, ProcessInfo.processInfo.arguments.contains("-selfcheck") else { return }
            done = true
            web.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
                let json: String
                switch result {
                case .success(let value): json = value as? String ?? "{\"error\":\"결과가 문자열이 아님\"}"
                case .failure(let error): json = "{\"error\":\(quoted(error.localizedDescription))}"
                }
                let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                try? Data(json.utf8).write(to: dir.appendingPathComponent(fileName), options: .atomic)
            }
        }

        private static func quoted(_ s: String) -> String {
            let data = try? JSONSerialization.data(withJSONObject: [s])
            let arr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
            return String(arr.dropFirst().dropLast())
        }

        /// 항목마다 따로 try 로 감싼다 — 하나가 터져도 나머지 결과는 남아야 원인을 좁힐 수 있다.
        /// IndexedDB 는 앱 기록(math-rebuild)과 다른 이름의 시험용 DB 로 쓰고 읽은 뒤 지운다.
        private static let script = #"""
            const r = { at: new Date().toISOString(), href: location.href, origin: location.origin };
            const attempt = async (name, f) => {
              try { r[name] = await f(); } catch (e) { r[name] = { error: String(e) }; }
            };
            await attempt('isSecureContext', () => window.isSecureContext);
            await attempt('language', () => navigator.language);
            await attempt('languages', () => navigator.languages);
            await attempt('nativeDetected', () => !!window.webkit?.messageHandlers?.mathApp);
            await attempt('storageApi', () => typeof navigator.storage?.persist === 'function');
            await attempt('persistedBefore', () => navigator.storage.persisted());
            await attempt('persist', () => navigator.storage.persist());
            await attempt('persistedAfter', () => navigator.storage.persisted());
            await attempt('estimate', async () => {
              const e = await navigator.storage.estimate();
              return { usage: e.usage, quota: e.quota };
            });
            await attempt('fonts', async () => {
              const out = {};
              for (const f of ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_Size1', 'KaTeX_AMS']) {
                const faces = await document.fonts.load(`16px ${f}`);
                out[f] = faces.length > 0 && faces.every((x) => x.status === 'loaded');
              }
              return out;
            });
            await attempt('indexedDB', () => new Promise((resolve, reject) => {
              const name = 'selfcheck-tmp';
              const open = indexedDB.open(name, 1);
              open.onupgradeneeded = () => open.result.createObjectStore('kv');
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const db = open.result;
                const value = { n: 42, s: '한글', a: [1, 2] };
                const w = db.transaction('kv', 'readwrite');
                w.objectStore('kv').put(value, 'k');
                w.onerror = () => reject(w.error);
                w.oncomplete = () => {
                  const g = db.transaction('kv', 'readonly').objectStore('kv').get('k');
                  g.onerror = () => reject(g.error);
                  g.onsuccess = () => {
                    const ok = JSON.stringify(g.result) === JSON.stringify(value);
                    db.close();
                    // 지우기가 끝난 뒤 돌려줘야 아래 databases 목록에 시험용 DB 가 안 남는다
                    const del = indexedDB.deleteDatabase(name);
                    del.onsuccess = del.onerror = () => resolve(ok);
                  };
                };
              };
            }));
            await attempt('databases', async () => (await indexedDB.databases()).map((d) => d.name));
            // 기록 사본(Backup.swift): 파일 수와 마지막 성공 시각. 앱 기록을 건드리지 않는 읽기 전용 질의다
            await attempt('backup', () => window.webkit.messageHandlers.mathApp.postMessage({ op: 'status' }));
            await attempt('safeArea', () => {
              const d = document.createElement('div');
              d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) ' +
                'env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
              document.body.append(d);
              const s = getComputedStyle(d);
              const v = { top: s.paddingTop, right: s.paddingRight, bottom: s.paddingBottom, left: s.paddingLeft };
              d.remove();
              return v;
            });
            await attempt('viewport', () => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
            return JSON.stringify(r);
            """#
    }
#endif
