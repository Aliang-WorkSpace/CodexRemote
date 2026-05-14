import Foundation

public struct AppConfig: Equatable, Sendable {
    public let baseURL: URL
    public let title: String

    public init(
        baseURL: URL = URL(
            string: ProcessInfo.processInfo.environment["CODEX_REMOTE_DESKTOP_URL"]
                ?? ProcessInfo.processInfo.environment["CONTROL_PLANE_DESKTOP_URL"]
                ?? "http://127.0.0.1:8793/app"
        )!,
        title: String = "Codex Remote"
    ) {
        self.baseURL = baseURL
        self.title = title
    }

    public var hostLabel: String {
        if let host = baseURL.host {
            return "\(host):\(baseURL.port ?? 80)"
        }
        return baseURL.absoluteString
    }
}
