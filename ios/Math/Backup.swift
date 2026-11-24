import Foundation

/// 학습 기록 사본(앱 전용). 원본은 웹뷰의 IndexedDB 이고, 웹(src/app/backup.ts)이 IndexedDB 트랜잭션이 끝날 때마다
/// 같은 내용을 메시지로 보낸다. 앱 웹뷰에서 persist() 가 false 라(실측) WebKit 이 저장소를 지워도 기록이 남게
/// Application Support/backup/ 에 키 하나당 파일 하나로 둔다. 시작할 때 웹이 IndexedDB 가 지워졌으면 이걸로 되살린다.
///
/// - 키 하나에 파일 하나: 필기 한 쪽을 저장할 때 다른 쪽 파일을 다시 쓰지 않는다. 파일마다 원자적으로 써서(.atomic)
///   쓰다가 꺼져도 반쯤 쓴 파일이 남지 않는다.
/// - 파일 이름은 키의 UTF-8 을 16진수로: 키에 `/`·`:`·`@` 가 들어가고, 시뮬레이터가 도는 맥 디스크는 대소문자를
///   구별하지 않아 base64 처럼 대소문자로 나누는 이름은 겹친다.
/// - 값(JSON 문자열)은 받은 그대로 적는다. 여기서 해석하지 않아 웹 쪽 자료 모양이 바뀌어도 고칠 게 없다.
/// - 파일 수정 시각·UserDefaults 는 쓰지 않는다(개인정보 매니페스트의 '이유 필요 API'). 마지막 성공 시각은 직접 적는다.
nonisolated final class BackupFiles: @unchecked Sendable {
    // @unchecked: 바뀌는 값(lastSuccess·metaPending)은 아래 직렬 큐 안에서만 만진다

    enum Op: Sendable {
        case put(key: String, json: String)
        case del(prefixes: [String], keys: [String])
        case clear
        case keys
        case read(after: String?, maxBytes: Int)
        case status

        /// 웹에서 온 메시지(src/app/backup.ts 의 nativeBridge). 모양이 틀리면 nil
        init?(_ body: Any) {
            guard let m = body as? [String: Any], let op = m["op"] as? String else { return nil }
            switch op {
            case "put":
                guard let k = m["key"] as? String, let j = m["json"] as? String else { return nil }
                self = .put(key: k, json: j)
            case "del":
                guard let p = m["prefixes"] as? [String], let k = m["keys"] as? [String] else { return nil }
                self = .del(prefixes: p, keys: k)
            case "clear": self = .clear
            case "keys": self = .keys
            case "read":
                guard let n = m["maxBytes"] as? Int, n > 0 else { return nil }
                self = .read(after: m["after"] as? String, maxBytes: n)
            case "status": self = .status
            default: return nil
            }
        }
    }

    enum Reply: Sendable {
        case ok
        case keys([String])
        case page(entries: [[String]], next: String?)
        case status(count: Int, lastSuccess: String?)

        /// 웹으로 돌려줄 값(WebKit 이 JS 값으로 바꾼다). nil 은 JS 의 null 이 되도록 NSNull
        var object: Any {
            switch self {
            case .ok: return true
            case .keys(let k): return k
            case .page(let e, let n): return ["entries": e, "next": n ?? NSNull()] as [String: Any]
            case .status(let c, let l): return ["count": c, "lastSuccess": l ?? NSNull()] as [String: Any]
            }
        }
    }

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private let dir: URL
    private let meta: URL
    /// 보낸 순서대로 처리해야 늦게 도착한 옛 값이 새 값을 덮지 않는다. 그래서 큐 하나로 줄 세운다
    private let queue = DispatchQueue(label: "math.backup", qos: .userInitiated)
    private var lastSuccess: String?
    private var metaPending = false

    init(root: URL) {
        dir = root.appendingPathComponent("backup", isDirectory: true)
        meta = root.appendingPathComponent("backup-meta.json")
    }

    static let shared = BackupFiles(
        root: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0])

    /// 큐에서 처리하고 답은 메인 스레드에서 준다(웹뷰 답 처리기는 메인에서 불러야 한다)
    func perform(_ op: Op, done: @escaping @MainActor @Sendable (Result<Reply, any Error>) -> Void) {
        queue.async {
            let result = Result { try self.run(op) }
            DispatchQueue.main.async { done(result) }
        }
    }

    private func run(_ op: Op) throws -> Reply {
        let fm = FileManager.default
        switch op {
        case .put(let key, let json):
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            try Data(json.utf8).write(to: try file(key), options: .atomic)
        case .del(let prefixes, let keys):
            // 접두어 비교는 UTF-8 바이트로: 웹(JS startsWith·IndexedDB 범위)과 똑같이 글자 단위로 자른다
            let doomed = Set(keys).union(
                try stored().filter { k in prefixes.contains { k.utf8.starts(with: $0.utf8) } })
            for k in doomed { try remove(try file(k)) }
        case .clear:
            try remove(dir)
        case .keys:
            return .keys(try stored())
        case .read(let after, let maxBytes):
            return try page(after: after, maxBytes: maxBytes)
        case .status:
            return .status(count: try stored().count, lastSuccess: lastSuccess ?? readMeta())
        }
        succeeded()
        return .ok
    }

    /// 키 순서대로 after 다음부터 maxBytes 언저리까지. 큰 필기를 한 답에 다 실으면 메모리가 두 배로 들어 나눈다
    private func page(after: String?, maxBytes: Int) throws -> Reply {
        let keys = try stored().sorted(by: Self.before)
        let rest = after.map { a in keys.filter { Self.before(a, $0) } } ?? keys
        var entries: [[String]] = []
        var bytes = 0
        for k in rest {
            let data = try Data(contentsOf: try file(k))
            if !entries.isEmpty && bytes + data.count > maxBytes { break }
            guard let json = String(data: data, encoding: .utf8) else {
                throw Failure(message: "사본 파일이 UTF-8 이 아니에요: \(k)")
            }
            entries.append([k, json])
            bytes += data.count
        }
        let next = entries.count < rest.count ? entries.last?[0] : nil
        return .page(entries: entries, next: next)
    }

    /// 쪽 나누기 순서. 문자열 비교(유니코드 정규화)가 아니라 바이트로 — 쪽마다 같은 순서여야 빠지거나 겹치지 않는다
    private static func before(_ a: String, _ b: String) -> Bool {
        a.utf8.lexicographicallyPrecedes(b.utf8)
    }

    /// 지금 사본에 있는 키들. 이름이 16진수가 아닌 파일(원자적 쓰기의 임시 파일 등)은 건너뛴다
    private func stored() throws -> [String] {
        guard FileManager.default.fileExists(atPath: dir.path) else { return [] }
        return try FileManager.default.contentsOfDirectory(atPath: dir.path).compactMap(Self.decode)
    }

    private func file(_ key: String) throws -> URL {
        let name = key.utf8.map { String(format: "%02x", $0) }.joined()
        // 파일 이름은 255바이트까지. 지금 키는 50자 안팎이라 닿지 않지만, 넘으면 조용히 잘리지 않게 실패로 알린다
        guard !name.isEmpty, name.utf8.count <= 250 else {
            throw Failure(message: "키가 너무 길거나 비었어요: \(key.prefix(40))")
        }
        return dir.appendingPathComponent(name, isDirectory: false)
    }

    private static func decode(_ name: String) -> String? {
        let hex = Array(name.utf8)
        guard !hex.isEmpty, hex.count % 2 == 0 else { return nil }
        var bytes: [UInt8] = []
        bytes.reserveCapacity(hex.count / 2)
        var i = 0
        while i < hex.count {
            guard let hi = nibble(hex[i]), let lo = nibble(hex[i + 1]) else { return nil }
            bytes.append(hi << 4 | lo)
            i += 2
        }
        return String(bytes: bytes, encoding: .utf8)
    }

    private static func nibble(_ c: UInt8) -> UInt8? {
        switch c {
        case 0x30...0x39: return c - 0x30  // 0-9
        case 0x61...0x66: return c - 0x61 + 10  // a-f (만들 때 소문자로만 쓴다)
        default: return nil
        }
    }

    private func remove(_ url: URL) throws {
        do {
            try FileManager.default.removeItem(at: url)
        } catch CocoaError.fileNoSuchFile {
            // 이미 없으면 지운 것과 같다
        }
    }

    // MARK: 마지막 성공 시각(자가 점검에 보인다)

    /// 쓰기마다 시각 파일까지 쓰면 파일 쓰기가 두 배가 되므로, 메모리에 적고 파일은 1초에 한 번만 쓴다
    private func succeeded() {
        lastSuccess = ISO8601DateFormatter().string(from: Date())
        guard !metaPending else { return }
        metaPending = true
        queue.asyncAfter(deadline: .now() + 1) {
            self.metaPending = false
            let body = ["lastSuccess": self.lastSuccess ?? ""]
            if let data = try? JSONSerialization.data(withJSONObject: body) {
                try? data.write(to: self.meta, options: .atomic)
            }
        }
    }

    private func readMeta() -> String? {
        guard let data = try? Data(contentsOf: meta),
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return obj["lastSuccess"] as? String
    }
}
