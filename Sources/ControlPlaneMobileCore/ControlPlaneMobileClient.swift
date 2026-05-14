import Foundation

public protocol HTTPSessioning: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPSessioning {}

public enum PairingLinkAction: Equatable, Sendable {
    case direct(URL)
    case pairingCode(String)
}

public final class ControlPlaneMobileClient: Sendable {
    public let baseURL: URL
    public let token: String?

    private let session: any HTTPSessioning
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(baseURL: URL, token: String? = nil, session: any HTTPSessioning = URLSession.shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    public func withToken(_ token: String?) -> ControlPlaneMobileClient {
        ControlPlaneMobileClient(baseURL: baseURL, token: token, session: session)
    }

    public func getPairing() async throws -> PairingDiscovery {
        try await request("/pairing", requiresAuth: false)
    }

    public func getPairingBootstrap() async throws -> PairingBootstrapResponse {
        try await request("/pairing/bootstrap", requiresAuth: token != nil)
    }

    public func getMobileBootstrap() async throws -> MobileBootstrapResponse {
        try await request("/mobile/bootstrap", requiresAuth: token != nil)
    }

    public func getSessionDetail(sessionID: String) async throws -> SessionDetailPayload {
        try await request("/mobile/sessions/\(sessionID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionID)", requiresAuth: token != nil)
    }

    public func submitCommand(_ body: SubmitCommandBody) async throws -> SubmitCommandResponse {
        try await request("/commands", method: "POST", body: body, requiresAuth: token != nil)
    }

    public static func decodePairingCode(_ pairingCode: String) throws -> PairingBundle {
        let normalized = pairingCode.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let padded = normalized.padding(toLength: ((normalized.count + 3) / 4) * 4, withPad: "=", startingAt: 0)
        guard let data = Data(base64Encoded: padded) else {
            throw ControlPlaneAPIError(status: 0, requestID: nil, code: "invalid_pairing_code", message: "Invalid pairing code")
        }

        return try JSONDecoder().decode(PairingBundle.self, from: data)
    }

    public static func normalizeBaseURLInput(_ input: String) -> URL? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        let candidate = trimmed.contains("://") ? trimmed : "http://\(trimmed)"
        return URL(string: candidate)
    }

    public static func isLoopbackHost(_ host: String?) -> Bool {
        guard let host else {
            return false
        }

        return host == "127.0.0.1" || host == "localhost" || host == "::1"
    }

    public static func parsePairingLink(_ url: URL) -> PairingLinkAction? {
        guard url.scheme == "controlplane" else {
            return nil
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let queryItems = components.queryItems ?? []

        if let code = queryItems.first(where: { $0.name == "code" })?.value,
           !code.isEmpty {
            return .pairingCode(code)
        }

        if let base = queryItems.first(where: { $0.name == "base" })?.value,
           let baseURL = normalizeBaseURLInput(base) {
            return .direct(baseURL)
        }

        return nil
    }

    public static func parseConnectionInput(_ input: String) -> PairingLinkAction? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        if let url = URL(string: trimmed),
           url.scheme == "controlplane" {
            return parsePairingLink(url)
        }

        if looksLikeAddress(trimmed),
           let baseURL = normalizeBaseURLInput(trimmed) {
            return .direct(baseURL)
        }

        return .pairingCode(trimmed)
    }

    private func request<Response: Decodable & Equatable & Sendable>(
        _ path: String,
        requiresAuth: Bool
    ) async throws -> Response {
        var request = URLRequest(url: makeURL(path: path))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if requiresAuth, let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await perform(request)
    }

    private func request<Response: Decodable & Equatable & Sendable, Body: Encodable>(
        _ path: String,
        method: String = "GET",
        body: Body,
        requiresAuth: Bool
    ) async throws -> Response {
        var request = URLRequest(url: makeURL(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if requiresAuth, let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return try await perform(request)
    }

    private func perform<Response: Decodable & Equatable & Sendable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ControlPlaneAPIError(status: 0, requestID: nil, code: "invalid_response", message: "Invalid HTTP response")
        }

        if (200..<300).contains(httpResponse.statusCode) {
            return try decoder.decode(Response.self, from: data)
        }

        let envelope = try? decoder.decode(APIErrorEnvelope.self, from: data)
        throw ControlPlaneAPIError(
            status: httpResponse.statusCode,
            requestID: envelope?.requestId ?? httpResponse.value(forHTTPHeaderField: "x-request-id"),
            code: envelope?.error.code ?? "http_\(httpResponse.statusCode)",
            message: envelope?.error.message ?? "Request failed"
        )
    }

    private func makeURL(path: String) -> URL {
        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !trimmed.isEmpty else {
            return baseURL
        }

        var url = baseURL
        for component in trimmed.split(separator: "/") {
            url.appendPathComponent(String(component))
        }
        return url
    }

    private static func looksLikeAddress(_ input: String) -> Bool {
        input.contains("://")
            || input.contains(".")
            || input.contains(":")
            || input.contains("/")
    }
}
