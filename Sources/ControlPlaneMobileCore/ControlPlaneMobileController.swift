import Foundation
import Observation

@MainActor
@Observable
public final class ControlPlaneMobileController {
    public private(set) var pairing: PairingDiscovery?
    public private(set) var bundle: PairingBundle?
    public private(set) var bootstrap: MobileBootstrapResponse?
    public private(set) var selectedSession: SessionDetailPayload?
    public private(set) var lastCommand: SubmittedCommand?
    public private(set) var errorMessage: String?
    public private(set) var isLoading = false

    public private(set) var client: ControlPlaneMobileClient?

    public init() {}

    public func discover(baseURL: URL, session: any HTTPSessioning = URLSession.shared) async {
        await runTask {
            let discoveryClient = ControlPlaneMobileClient(baseURL: baseURL, session: session)
            let pairing = try await discoveryClient.getPairing()
            self.pairing = pairing
        }
    }

    public func connectDirect(baseURL: URL, session: any HTTPSessioning = URLSession.shared) async {
        await runTask {
            let discoveryClient = ControlPlaneMobileClient(baseURL: baseURL, session: session)
            let bootstrap = try await discoveryClient.getPairingBootstrap()
            try await self.connect(bundle: bootstrap.bundle, session: session)
        }
    }

    public func connect(pairingCode: String, session: any HTTPSessioning = URLSession.shared) async {
        await runTask {
            let bundle = try ControlPlaneMobileClient.decodePairingCode(pairingCode)
            try await self.connect(bundle: bundle, session: session)
        }
    }

    public func restore(bundle: PairingBundle, session: any HTTPSessioning = URLSession.shared) async {
        await runTask {
            try await self.connect(bundle: bundle, session: session)
        }
    }

    public func refreshBootstrap() async {
        await runTask {
            guard let client else {
                throw ControlPlaneAPIError(status: 0, requestID: nil, code: "not_connected", message: "Client is not connected")
            }

            self.bootstrap = try await client.getMobileBootstrap()
        }
    }

    public func openSession(_ sessionID: String) async {
        await runTask {
            guard let client else {
                throw ControlPlaneAPIError(status: 0, requestID: nil, code: "not_connected", message: "Client is not connected")
            }

            self.selectedSession = try await client.getSessionDetail(sessionID: sessionID)
        }
    }

    public func sendPrompt(sessionID: String, prompt: String) async {
        await runTask {
            guard let client else {
                throw ControlPlaneAPIError(status: 0, requestID: nil, code: "not_connected", message: "Client is not connected")
            }

            let response = try await client.submitCommand(
                SubmitCommandBody(
                    target: CommandTarget(type: "session", id: sessionID),
                    payload: CommandPayload(kind: "sendPrompt", prompt: prompt, attachments: [])
                )
            )
            self.lastCommand = response.command
            self.selectedSession = try await client.getSessionDetail(sessionID: sessionID)
            self.bootstrap = try await client.getMobileBootstrap()
        }
    }

    public func resumeRun(sessionID: String) async {
        await submitSessionCommand(sessionID: sessionID, kind: "resumeRun")
    }

    public func retryRun(sessionID: String) async {
        await submitSessionCommand(sessionID: sessionID, kind: "retryRun")
    }

    public func stopRun(sessionID: String) async {
        await submitSessionCommand(sessionID: sessionID, kind: "stopRun")
    }

    public func disconnect() {
        pairing = nil
        bundle = nil
        bootstrap = nil
        selectedSession = nil
        lastCommand = nil
        errorMessage = nil
        isLoading = false
        client = nil
    }

    public func loadPreviewState(
        bootstrap: MobileBootstrapResponse,
        selectedSession: SessionDetailPayload? = nil,
        lastCommand: SubmittedCommand? = nil
    ) {
        pairing = nil
        bundle = nil
        client = nil
        errorMessage = nil
        isLoading = false
        self.bootstrap = bootstrap
        self.selectedSession = selectedSession
        self.lastCommand = lastCommand
    }

    private func connect(bundle: PairingBundle, session: any HTTPSessioning) async throws {
        guard let baseURL = URL(string: bundle.transport.baseURL) else {
            throw ControlPlaneAPIError(status: 0, requestID: nil, code: "invalid_base_url", message: "Invalid base URL")
        }

        let client = ControlPlaneMobileClient(baseURL: baseURL, token: bundle.pairingToken, session: session)
        let bootstrap = try await client.getMobileBootstrap()

        self.bundle = bundle
        self.client = client
        self.bootstrap = bootstrap
    }

    private func submitSessionCommand(sessionID: String, kind: String) async {
        await runTask {
            guard let client else {
                throw ControlPlaneAPIError(status: 0, requestID: nil, code: "not_connected", message: "Client is not connected")
            }

            let response = try await client.submitCommand(
                SubmitCommandBody(
                    target: CommandTarget(type: "session", id: sessionID),
                    payload: CommandPayload(kind: kind)
                )
            )
            self.lastCommand = response.command
            self.selectedSession = try await client.getSessionDetail(sessionID: sessionID)
            self.bootstrap = try await client.getMobileBootstrap()
        }
    }

    private func runTask(_ operation: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil

        do {
            try await operation()
        } catch let error as ControlPlaneAPIError {
            errorMessage = userFacingMessage(for: error)
        } catch {
            errorMessage = userFacingMessage(for: error)
        }

        isLoading = false
    }

    private func userFacingMessage(for error: Error) -> String {
        if let error = error as? ControlPlaneAPIError {
            switch error.code {
            case "not_connected":
                return "还没有连接到这台 Mac，请先完成接入。"
            case "invalid_base_url":
                return "地址无效。请输入这台 Mac 的局域网地址，例如 http://192.168.x.x:8793。"
            case "unauthorized":
                return "这台 Mac 需要重新配对，请重新连接一次。"
            default:
                return error.message
            }
        }

        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .timedOut, .dnsLookupFailed:
                return "无法连接到这台 Mac。请确认 iPhone 和 Mac 在同一个网络，并且控制台已经启动。"
            default:
                return urlError.localizedDescription
            }
        }

        return error.localizedDescription
    }
}
