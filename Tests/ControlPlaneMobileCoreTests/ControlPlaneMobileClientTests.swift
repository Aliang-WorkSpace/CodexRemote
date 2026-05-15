import Foundation
import Testing
@testable import ControlPlaneMobileCore

private struct StubHTTPSession: HTTPSessioning {
    let handler: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await handler(request)
    }
}

@Test func decodesPairingCodeIntoBundle() throws {
    let payload = """
    {
      "version": 1,
      "generatedAt": "2026-04-02T12:00:00Z",
      "deviceId": "device_1",
      "workspaceId": "local-mac",
      "workspaceName": "Local Mac",
      "pairingToken": "pair_123",
      "transport": {
        "type": "http",
        "baseUrl": "http://192.0.2.10:8793",
        "localBaseUrl": "http://127.0.0.1:8793",
        "phoneAccessUrl": "http://192.0.2.10:8793",
        "isLocalOnly": false,
        "hint": "same wifi"
      },
      "capabilities": {
        "commandSubmission": true,
        "sessionInspection": true,
        "eventStreaming": false,
        "backgroundSync": true
      }
    }
    """
    let pairingCode = Data(payload.utf8).base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")

    let bundle = try ControlPlaneMobileClient.decodePairingCode(pairingCode)
    #expect(bundle.transport.baseURL == "http://192.0.2.10:8793")
    #expect(bundle.pairingToken == "pair_123")
}

@Test func sendsBearerTokenForAuthenticatedRequests() async throws {
    let session = StubHTTPSession { request in
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer pair_123")
        let payload = """
        {
          "workspace": { "id": "local-mac", "name": "Local Mac" },
          "device": {
            "deviceId": "device_1",
            "workspaceId": "local-mac",
            "workspaceName": "Local Mac",
            "updatedAt": "2026-04-02T12:00:00Z"
          },
          "transport": {
            "type": "http",
            "baseUrl": "http://192.0.2.10:8793",
            "localBaseUrl": "http://127.0.0.1:8793",
            "phoneAccessUrl": "http://192.0.2.10:8793",
            "isLocalOnly": false,
            "hint": "same wifi"
          },
          "sync": { "enabled": false, "lastSucceededAt": null, "lastError": null },
          "supportedCommands": ["sendPrompt"],
          "dashboard": {
            "workspace": { "id": "local-mac", "name": "Local Mac" },
            "device": {
              "deviceId": "device_1",
              "workspaceId": "local-mac",
              "workspaceName": "Local Mac",
              "updatedAt": "2026-04-02T12:00:00Z"
            },
            "stats": { "sessionCount": 1, "activeRunCount": 0, "automationCount": 0, "templateCount": 0, "commandCount": 0 },
            "sessions": [],
            "automations": [],
            "templates": [],
            "recentCommands": []
          }
        }
        """
        return (Data(payload.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
    }

    let client = ControlPlaneMobileClient(
        baseURL: URL(string: "http://192.0.2.10:8793")!,
        token: "pair_123",
        session: session
    )

    let bootstrap = try await client.getMobileBootstrap()
    #expect(bootstrap.workspace.name == "Local Mac")
}

@Test func normalizeBaseURLInputAddsSchemeAndTrimsWhitespace() throws {
    let url = try #require(ControlPlaneMobileClient.normalizeBaseURLInput(" 198.51.100.10:8793 "))
    #expect(url.absoluteString == "http://198.51.100.10:8793")
}

@Test func detectsLoopbackHostsForConnectionGuidance() {
    #expect(ControlPlaneMobileClient.isLoopbackHost("127.0.0.1"))
    #expect(ControlPlaneMobileClient.isLoopbackHost("localhost"))
    #expect(!ControlPlaneMobileClient.isLoopbackHost("198.51.100.10"))
}

@Test func parsesDirectPairingLinkIntoBaseURL() throws {
    let url = try #require(URL(string: "controlplane://pair?base=http%3A%2F%2F198.51.100.10%3A8793"))
    let action = try #require(ControlPlaneMobileClient.parsePairingLink(url))

    switch action {
    case .direct(let baseURL):
        #expect(baseURL.absoluteString == "http://198.51.100.10:8793")
    default:
        Issue.record("Expected direct connection action")
    }
}

@Test func parsesPairingCodeLinkIntoCodePayload() throws {
    let url = try #require(URL(string: "controlplane://pair?code=abc123"))
    let action = try #require(ControlPlaneMobileClient.parsePairingLink(url))

    switch action {
    case .pairingCode(let pairingCode):
        #expect(pairingCode == "abc123")
    default:
        Issue.record("Expected pairing code action")
    }
}

@Test func parsesClipboardDirectLinkIntoAction() throws {
    let action = try #require(ControlPlaneMobileClient.parseConnectionInput("controlplane://pair?base=http%3A%2F%2F198.51.100.10%3A8793"))

    switch action {
    case .direct(let baseURL):
        #expect(baseURL.absoluteString == "http://198.51.100.10:8793")
    default:
        Issue.record("Expected direct connection action from clipboard payload")
    }
}

@Test func parsesClipboardBaseURLIntoAction() throws {
    let action = try #require(ControlPlaneMobileClient.parseConnectionInput("198.51.100.10:8793"))

    switch action {
    case .direct(let baseURL):
        #expect(baseURL.absoluteString == "http://198.51.100.10:8793")
    default:
        Issue.record("Expected direct connection action from base URL")
    }
}

@Test func parsesClipboardPairingCodeIntoAction() throws {
    let action = try #require(ControlPlaneMobileClient.parseConnectionInput("abc123_pairing_code"))

    switch action {
    case .pairingCode(let pairingCode):
        #expect(pairingCode == "abc123_pairing_code")
    default:
        Issue.record("Expected pairing code action from clipboard payload")
    }
}
