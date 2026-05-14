import Foundation
import Testing
@testable import ControlPlaneMobileCore

private struct SequenceHTTPSession: HTTPSessioning {
    let responses: [String: String]

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let path = request.url?.path() ?? ""
        let body = responses[path] ?? responses["default"]!
        return (Data(body.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
    }
}

private struct FailingHTTPSession: HTTPSessioning {
    let error: Error

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        throw error
    }
}

@MainActor
@Test func controllerDiscoversAndConnectsDirectly() async throws {
    let session = SequenceHTTPSession(responses: [
        "/pairing": """
        {
          "deviceId": "device_1",
          "workspaceId": "local-mac",
          "workspaceName": "Local Mac",
          "updatedAt": "2026-04-02T12:00:00Z",
          "authRequired": false,
          "pairingStatus": "direct-bootstrap-available",
          "transport": {
            "type": "http",
            "baseUrl": "http://192.168.1.8:8793",
            "localBaseUrl": "http://127.0.0.1:8793",
            "phoneAccessUrl": "http://192.168.1.8:8793",
            "isLocalOnly": false,
            "hint": "same wifi"
          }
        }
        """,
        "/pairing/bootstrap": """
        {
          "bundle": {
            "version": 1,
            "generatedAt": "2026-04-02T12:00:00Z",
            "deviceId": "device_1",
            "workspaceId": "local-mac",
            "workspaceName": "Local Mac",
            "pairingToken": null,
            "transport": {
              "type": "http",
              "baseUrl": "http://192.168.1.8:8793",
              "localBaseUrl": "http://127.0.0.1:8793",
              "phoneAccessUrl": "http://192.168.1.8:8793",
              "isLocalOnly": false,
              "hint": "same wifi"
            },
            "capabilities": {
              "commandSubmission": true,
              "sessionInspection": true,
              "eventStreaming": false,
              "backgroundSync": true
            }
          },
          "pairingCode": "abc"
        }
        """,
        "/mobile/bootstrap": """
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
            "baseUrl": "http://192.168.1.8:8793",
            "localBaseUrl": "http://127.0.0.1:8793",
            "phoneAccessUrl": "http://192.168.1.8:8793",
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
            "stats": { "sessionCount": 1, "activeRunCount": 1, "automationCount": 0, "templateCount": 0, "commandCount": 1 },
            "sessions": [
              {
                "id": "session_1",
                "title": "Need follow-up",
                "status": "active",
                "runStatus": "waitingForInput",
                "cwd": "/tmp/project",
                "model": "gpt-5.4",
                "childRunCount": 0,
                "updatedAt": "2026-04-02T12:00:00Z"
              }
            ],
            "automations": [],
            "templates": [],
            "recentCommands": []
          }
        }
        """
    ])

    let controller = ControlPlaneMobileController()
    await controller.discover(baseURL: URL(string: "http://192.168.1.8:8793")!, session: session)
    #expect(controller.pairing?.pairingStatus == "direct-bootstrap-available")

    await controller.connectDirect(baseURL: URL(string: "http://192.168.1.8:8793")!, session: session)
    #expect(controller.pairing?.workspaceName == "Local Mac")
    #expect(controller.bootstrap?.dashboard.stats.sessionCount == 1)
    #expect(controller.errorMessage == nil)
}

@MainActor
@Test func controllerDisconnectClearsConnectedState() async throws {
    let session = SequenceHTTPSession(responses: [
        "/pairing/bootstrap": """
        {
          "bundle": {
            "version": 1,
            "generatedAt": "2026-04-02T12:00:00Z",
            "deviceId": "device_1",
            "workspaceId": "local-mac",
            "workspaceName": "Local Mac",
            "pairingToken": null,
            "transport": {
              "type": "http",
              "baseUrl": "http://192.168.1.8:8793",
              "localBaseUrl": "http://127.0.0.1:8793",
              "phoneAccessUrl": "http://192.168.1.8:8793",
              "isLocalOnly": false,
              "hint": "same wifi"
            },
            "capabilities": {
              "commandSubmission": true,
              "sessionInspection": true,
              "eventStreaming": false,
              "backgroundSync": true
            }
          },
          "pairingCode": "abc"
        }
        """,
        "/mobile/bootstrap": """
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
            "baseUrl": "http://192.168.1.8:8793",
            "localBaseUrl": "http://127.0.0.1:8793",
            "phoneAccessUrl": "http://192.168.1.8:8793",
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
    ])

    let controller = ControlPlaneMobileController()
    await controller.connectDirect(baseURL: URL(string: "http://192.168.1.8:8793")!, session: session)
    #expect(controller.bootstrap != nil)

    controller.disconnect()

    #expect(controller.bootstrap == nil)
    #expect(controller.bundle == nil)
    #expect(controller.lastCommand == nil)
    #expect(controller.errorMessage == nil)
}

@MainActor
@Test func controllerConnectDirectAcceptsNumericUpdatedAtFieldsFromServer() async throws {
    let session = SequenceHTTPSession(responses: [
        "/pairing/bootstrap": """
        {
          "bundle": {
            "version": 1,
            "generatedAt": "2026-04-03T02:43:16.082Z",
            "deviceId": "device_1",
            "workspaceId": "local-mac",
            "workspaceName": "Local Mac",
            "pairingToken": "pair_123",
            "transport": {
              "type": "http",
              "baseUrl": "http://172.26.242.72:8793",
              "localBaseUrl": "http://127.0.0.1:8793",
              "phoneAccessUrl": "http://172.26.242.72:8793",
              "isLocalOnly": false,
              "hint": "same wifi"
            },
            "capabilities": {
              "commandSubmission": true,
              "sessionInspection": true,
              "eventStreaming": false,
              "backgroundSync": true
            }
          },
          "pairingCode": "abc"
        }
        """,
        "/mobile/bootstrap": """
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
            "baseUrl": "http://172.26.242.72:8793",
            "localBaseUrl": "http://127.0.0.1:8793",
            "phoneAccessUrl": "http://172.26.242.72:8793",
            "isLocalOnly": false,
            "hint": "same wifi"
          },
          "sync": { "enabled": false },
          "supportedCommands": ["sendPrompt"],
          "dashboard": {
            "workspace": { "id": "local-mac", "name": "Local Mac" },
            "device": {
              "deviceId": "device_1",
              "workspaceId": "local-mac",
              "workspaceName": "Local Mac",
              "updatedAt": "2026-04-02T12:00:00Z"
            },
            "stats": { "sessionCount": 1, "activeRunCount": 1, "automationCount": 0, "templateCount": 0, "commandCount": 0 },
            "sessions": [
              {
                "id": "session_1",
                "title": "Need follow-up",
                "status": "active",
                "runStatus": "waitingForInput",
                "cwd": "/tmp/project",
                "model": "gpt-5.4",
                "childRunCount": 0,
                "updatedAt": 1775184211
              }
            ],
            "automations": [],
            "templates": [],
            "recentCommands": []
          }
        }
        """
    ])

    let controller = ControlPlaneMobileController()
    await controller.connectDirect(baseURL: URL(string: "http://172.26.242.72:8793")!, session: session)

    #expect(controller.bootstrap?.dashboard.sessions.first?.updatedAt == "1775184211")
    #expect(controller.errorMessage == nil)
}

@MainActor
@Test func controllerMapsNetworkErrorsToFriendlyChineseMessages() async throws {
    let controller = ControlPlaneMobileController()
    let session = FailingHTTPSession(error: URLError(.notConnectedToInternet))

    await controller.connectDirect(baseURL: URL(string: "http://172.26.242.72:8793")!, session: session)

    #expect(controller.errorMessage == "无法连接到这台 Mac。请确认 iPhone 和 Mac 在同一个网络，并且控制台已经启动。")
}

@MainActor
@Test func controllerOpenSessionLoadsRequestedDetail() async throws {
    let session = SequenceHTTPSession(responses: [
        "/pairing/bootstrap": """
        {
          "bundle": {
            "version": 1,
            "generatedAt": "2026-04-03T02:43:16.082Z",
            "deviceId": "device_1",
            "workspaceId": "local-mac",
            "workspaceName": "Local Mac",
            "pairingToken": "pair_123",
            "transport": {
              "type": "http",
              "baseUrl": "http://172.26.242.72:8793",
              "localBaseUrl": "http://127.0.0.1:8793",
              "phoneAccessUrl": "http://172.26.242.72:8793",
              "isLocalOnly": false,
              "hint": "same wifi"
            },
            "capabilities": {
              "commandSubmission": true,
              "sessionInspection": true,
              "eventStreaming": false,
              "backgroundSync": true
            }
          },
          "pairingCode": "abc"
        }
        """,
        "/mobile/bootstrap": """
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
            "baseUrl": "http://172.26.242.72:8793",
            "localBaseUrl": "http://127.0.0.1:8793",
            "phoneAccessUrl": "http://172.26.242.72:8793",
            "isLocalOnly": false,
            "hint": "same wifi"
          },
          "sync": { "enabled": false },
          "supportedCommands": ["sendPrompt"],
          "dashboard": {
            "workspace": { "id": "local-mac", "name": "Local Mac" },
            "device": {
              "deviceId": "device_1",
              "workspaceId": "local-mac",
              "workspaceName": "Local Mac",
              "updatedAt": "2026-04-02T12:00:00Z"
            },
            "stats": { "sessionCount": 1, "activeRunCount": 1, "automationCount": 0, "templateCount": 0, "commandCount": 0 },
            "sessions": [
              {
                "id": "session_1",
                "title": "Need follow-up",
                "status": "active",
                "runStatus": "waitingForInput",
                "cwd": "/tmp/project",
                "model": "gpt-5.4",
                "childRunCount": 0,
                "updatedAt": "2026-04-02T12:00:00Z"
              }
            ],
            "automations": [],
            "templates": [],
            "recentCommands": []
          }
        }
        """,
        "/mobile/sessions/session_1": """
        {
          "session": {
            "id": "session_1",
            "title": "Need follow-up",
            "fullTitle": "Need follow-up",
            "status": "active",
            "cwd": "/tmp/project",
            "model": "gpt-5.4",
            "updatedAt": "2026-04-02T12:00:00Z"
          },
          "run": {
            "id": "run_1",
            "status": "waitingForInput",
            "parentRunId": null,
            "automationId": null
          },
          "recentCommands": [],
          "recentEvents": [
            {
              "id": "event_1",
              "level": "info",
              "message": "Waiting for input",
              "occurredAt": "2026-04-02T12:00:00Z",
              "repeatCount": 1
            }
          ]
        }
        """
    ])

    let controller = ControlPlaneMobileController()
    await controller.connectDirect(baseURL: URL(string: "http://172.26.242.72:8793")!, session: session)
    await controller.openSession("session_1")

    #expect(controller.selectedSession?.session.id == "session_1")
    #expect(controller.selectedSession?.run?.status == "waitingForInput")
    #expect(controller.errorMessage == nil)
}
