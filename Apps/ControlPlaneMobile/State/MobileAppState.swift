import Foundation
import Observation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
#if canImport(ControlPlaneMobileCore)
import ControlPlaneMobileCore
#endif

struct DiscoveredRelay: Identifiable, Equatable {
    let id: String
    let name: String
    let hostName: String
    let port: Int
    let baseURL: String
}

final class BonjourRelayDiscovery: NSObject {
    private let browser = NetServiceBrowser()
    private var services: [NetService] = []

    var onUpdate: (([DiscoveredRelay], Bool) -> Void)?
    private(set) var relays: [DiscoveredRelay] = []
    private(set) var isBrowsing = false

    override init() {
        super.init()
        browser.delegate = self
    }

    func start() {
        guard !isBrowsing else {
            return
        }

        relays = []
        services = []
        isBrowsing = true
        onUpdate?(relays, isBrowsing)
        browser.searchForServices(ofType: "_codexctl._tcp.", inDomain: "local.")
    }

    func stop() {
        guard isBrowsing else {
            return
        }

        browser.stop()
        services.removeAll()
        isBrowsing = false
        onUpdate?(relays, isBrowsing)
    }
}

extension BonjourRelayDiscovery: NetServiceBrowserDelegate {
    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        service.delegate = self
        services.append(service)
        service.resolve(withTimeout: 5)

        if !moreComing {
            onUpdate?(relays, isBrowsing)
        }
    }

    func netServiceBrowserDidStopSearch(_ browser: NetServiceBrowser) {
        isBrowsing = false
        onUpdate?(relays, isBrowsing)
    }
}

extension BonjourRelayDiscovery: NetServiceDelegate {
    func netServiceDidResolveAddress(_ sender: NetService) {
        guard let hostName = sender.hostName?.trimmingCharacters(in: CharacterSet(charactersIn: ".")),
              sender.port > 0 else {
            return
        }

        let relay = DiscoveredRelay(
            id: "\(sender.name)-\(hostName)-\(sender.port)",
            name: sender.name,
            hostName: hostName,
            port: sender.port,
            baseURL: "http://\(hostName):\(sender.port)"
        )

        if !relays.contains(where: { $0.id == relay.id }) {
            relays.append(relay)
            relays.sort { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
            onUpdate?(relays, isBrowsing)
        }
    }
}

@MainActor
@Observable
final class MobileAppState {
    private static let helpSeenKey = "codexremote.help.hasSeen"
    private static let onboardingSeenKey = "codexremote.onboarding.hasSeen"

    let controller = ControlPlaneMobileController()
    private let knownDeviceStore: any KnownDeviceStoring
    private let relayDiscovery: BonjourRelayDiscovery
    private var autoRefreshTask: Task<Void, Never>?

    var pairingCode = ""
    var baseURLText = ""
    var pendingSessionActionLabel: String?
    var clipboardConnectionHint: String?
    var clipboardConnectionAction: PairingLinkAction?

    var selectedSessionID: String?
    var lastRestoredDevice: SavedKnownDevice?
    var localErrorMessage: String?
    var discoveredRelays: [DiscoveredRelay] = []
    var isDiscoveringRelays = false
    var isHelpPresented = false
    var isOnboardingPresented = false
    var isReviewMode = false
    private(set) var hasAttemptedRestore = false
    private var previewBootstrap: MobileBootstrapResponse?
    private var previewSessionDetails: [String: SessionDetailPayload] = [:]
    private var previewLastCommand: SubmittedCommand?

    init(
        knownDeviceStore: any KnownDeviceStoring = UserDefaultsKnownDeviceStore(),
        relayDiscovery: BonjourRelayDiscovery = BonjourRelayDiscovery()
    ) {
        self.knownDeviceStore = knownDeviceStore
        self.relayDiscovery = relayDiscovery

        self.relayDiscovery.onUpdate = { [weak self] relays, isBrowsing in
            guard let self else {
                return
            }

            self.discoveredRelays = relays
            self.isDiscoveringRelays = isBrowsing

            if let firstRelay = relays.first,
               (ControlPlaneMobileClient.isLoopbackHost(URL(string: self.baseURLText)?.host) || self.baseURLText.isEmpty) {
                self.baseURLText = firstRelay.baseURL
            }
        }
    }

    var sessions: [SessionSummary] {
        controller.bootstrap?.dashboard.sessions ?? []
    }

    var activeSessions: [SessionSummary] {
        sessions.filter { session in
            let runStatus = session.runStatus ?? ""
            return ["active", "running"].contains(session.status) || ["running", "queued", "waitingForInput", "failed"].contains(runStatus)
        }
    }

    var isConnected: Bool {
        controller.bootstrap != nil
    }

    var errorMessage: String? {
        controller.errorMessage ?? localErrorMessage
    }

    var isRestoring: Bool {
        controller.isLoading && controller.bootstrap == nil && lastRestoredDevice != nil
    }

    var needsRePairing: Bool {
        !isConnected && lastRestoredDevice != nil && errorMessage != nil
    }

    var connectionTitle: String {
        if let bootstrap = controller.bootstrap {
            return "已连接到 \(bootstrap.device.workspaceName)"
        }

        if isRestoring, let restored = lastRestoredDevice {
            return "正在恢复 \(restored.bundle.workspaceName)"
        }

        if let restored = lastRestoredDevice {
            return needsRePairing ? "需要重新连接 \(restored.bundle.workspaceName)" : "等待恢复 \(restored.bundle.workspaceName)"
        }

        return "还没有连接 Mac"
    }

    var connectionSubtitle: String {
        if let bootstrap = controller.bootstrap {
            return bootstrap.transport.preferredDisplayURL
        }

        if let restored = lastRestoredDevice {
            if needsRePairing {
                return "上次连接信息还在，但这次没能恢复成功。可以重试一次，或者重新配对。"
            }

            return restored.bundle.transport.preferredDisplayURL
        }

        return "先直接连接本机地址，或粘贴一次配对码。"
    }

    var resumeSessionTitle: String {
        guard let lastSessionID = lastRestoredDevice?.lastSessionID,
              let session = sessions.first(where: { $0.id == lastSessionID }) else {
            return "还没有恢复会话"
        }

        return session.title
    }

    var connectionStepSummary: String {
        "已信任设备 -> 附近 Mac -> 二维码/剪贴板 -> 手动兜底"
    }

    var shouldAutoPresentHelp: Bool {
        !UserDefaults.standard.bool(forKey: Self.helpSeenKey)
    }

    var shouldAutoPresentOnboarding: Bool {
        !UserDefaults.standard.bool(forKey: Self.onboardingSeenKey)
    }

    var reviewModeBannerTitle: String {
        "审核演示模式"
    }

    var reviewModeBannerSubtitle: String {
        "当前显示的是示例数据，用来帮助首次理解产品，也方便审核查看完整流程。"
    }

    var lastCommandStatusTitle: String {
        if let pendingSessionActionLabel {
            return "\(pendingSessionActionLabel)中"
        }

        if let command = controller.lastCommand {
            return command.statusDisplayName
        }

        return "等待操作"
    }

    var lastCommandStatusSubtitle: String {
        if let pendingSessionActionLabel {
            return "正在把“\(pendingSessionActionLabel)”发送到这台 Mac。"
        }

        if let command = controller.lastCommand {
            return command.feedbackSummary
        }

        return "发送提示词、继续运行、重试或停止之后，最近一次回执会显示在这里。"
    }

    var hasTrustedDevice: Bool {
        lastRestoredDevice != nil
    }

    var trustedDeviceName: String {
        lastRestoredDevice?.bundle.workspaceName ?? "这台 Mac"
    }

    var trustedDeviceAddress: String? {
        lastRestoredDevice?.bundle.transport.phoneAccessURL ?? lastRestoredDevice?.bundle.transport.baseURL
    }

    var recommendedConnectionTitle: String {
        if isConnected {
            return "这台 iPhone 已经连上主控 Mac"
        }

        if hasTrustedDevice {
            return "恢复上次信任的 Mac"
        }

        if let firstRelay = discoveredRelays.first {
            return "接入附近的 \(firstRelay.name)"
        }

        if clipboardConnectionAction != nil {
            return "从剪贴板快速接入"
        }

        return "先发现或扫码，再手动输入"
    }

    var recommendedConnectionSubtitle: String {
        if isConnected {
            return "现在可以直接查看总览、进入会话并继续接管。"
        }

        if let saved = lastRestoredDevice {
            return "这台 iPhone 记住了 \(saved.bundle.workspaceName)，优先一键恢复，不必每次重新输入地址。"
        }

        if let firstRelay = discoveredRelays.first {
            return "发现同一局域网内的 \(firstRelay.name)，可以直接接入。"
        }

        if let hint = clipboardConnectionHint {
            return hint
        }

        return "先让 iPhone 和 Mac 在同一个 Wi‑Fi，下方会优先出现自动发现和快速接入入口。"
    }

    var recommendedConnectionButtonTitle: String {
        if isConnected {
            return "已连接"
        }

        if hasTrustedDevice {
            return "恢复连接"
        }

        if discoveredRelays.first != nil {
            return "立即接入附近 Mac"
        }

        if clipboardConnectionAction != nil {
            return "使用剪贴板内容接入"
        }

        return "等待自动发现"
    }

    func restoreSavedDeviceIfNeeded() async {
        guard !hasAttemptedRestore else {
            return
        }

        hasAttemptedRestore = true

        do {
            guard let savedDevice = try knownDeviceStore.loadKnownDevice() else {
                return
            }

            lastRestoredDevice = savedDevice
            baseURLText = savedDevice.bundle.transport.phoneAccessURL ?? savedDevice.bundle.transport.baseURL
            selectedSessionID = savedDevice.lastSessionID

            await controller.restore(bundle: savedDevice.bundle)

            if controller.bootstrap != nil {
                try persistCurrentDevice()
                if let sessionID = selectedSessionID {
                    await controller.openSession(sessionID)
                }
            }
        } catch {
            localErrorMessage = error.localizedDescription
        }
    }

    func handleScenePhaseChange(_ phase: ScenePhase) async {
        switch phase {
        case .active:
            refreshClipboardSuggestion()
            startRelayDiscovery()
            startAutoRefreshLoopIfNeeded()

            if !hasAttemptedRestore {
                await restoreSavedDeviceIfNeeded()
            } else if isConnected {
                await refreshHome()
            } else if lastRestoredDevice != nil {
                await retryLastDeviceConnection()
            }
        case .inactive, .background:
            stopAutoRefreshLoop()
            stopRelayDiscovery()
        @unknown default:
            break
        }
    }

    func handleIncomingURL(_ url: URL) async {
        guard let action = ControlPlaneMobileClient.parsePairingLink(url) else {
            return
        }

        switch action {
        case .direct(let baseURL):
            baseURLText = baseURL.absoluteString
            await connectDirect()
        case .pairingCode(let code):
            pairingCode = code
            await connectWithPairingCode()
        }
    }

    func refreshClipboardSuggestion() {
        #if canImport(UIKit)
        guard let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty,
              let action = ControlPlaneMobileClient.parseConnectionInput(text) else {
            clipboardConnectionAction = nil
            clipboardConnectionHint = nil
            return
        }

        clipboardConnectionAction = action
        switch action {
        case .direct(let url):
            clipboardConnectionHint = "检测到剪贴板里有可直连地址：\(url.absoluteString)"
        case .pairingCode:
            clipboardConnectionHint = "检测到剪贴板里有可用的配对信息，可以一键导入接入。"
        }
        #else
        clipboardConnectionAction = nil
        clipboardConnectionHint = nil
        #endif
    }

    func connectDirect() async {
        localErrorMessage = nil
        isReviewMode = false
        guard let url = ControlPlaneMobileClient.normalizeBaseURLInput(baseURLText) else {
            localErrorMessage = "地址无效"
            return
        }

        if ControlPlaneMobileClient.isLoopbackHost(url.host) {
            localErrorMessage = "请填写这台 Mac 的局域网地址，不要使用 127.0.0.1 或 localhost。"
            return
        }

        baseURLText = url.absoluteString

        await controller.connectDirect(baseURL: url)
        if controller.bootstrap != nil, controller.bundle != nil {
            pairingCode = ""
            try? persistCurrentDevice()
            startAutoRefreshLoopIfNeeded()
        }
    }

    func connectWithPairingCode() async {
        localErrorMessage = nil
        isReviewMode = false
        await controller.connect(pairingCode: pairingCode)
        if controller.bootstrap != nil, controller.bundle != nil {
            pairingCode = ""
            try? persistCurrentDevice()
            startAutoRefreshLoopIfNeeded()
        }
    }

    func connectUsingInput(_ input: String) async {
        localErrorMessage = nil

        guard let action = ControlPlaneMobileClient.parseConnectionInput(input) else {
            localErrorMessage = "没有识别出可用的接入信息。"
            return
        }

        switch action {
        case .direct(let url):
            baseURLText = url.absoluteString
            await connectDirect()
        case .pairingCode(let code):
            pairingCode = code
            await connectWithPairingCode()
        }
    }

    func performRecommendedConnection() async {
        localErrorMessage = nil

        if isConnected {
            return
        }

        if hasTrustedDevice {
            await retryLastDeviceConnection()
            return
        }

        if let relay = discoveredRelays.first {
            await connectToDiscoveredRelay(relay)
            return
        }

        if let action = clipboardConnectionAction {
            switch action {
            case .direct(let url):
                baseURLText = url.absoluteString
                await connectDirect()
            case .pairingCode(let code):
                pairingCode = code
                await connectWithPairingCode()
            }
            return
        }

        localErrorMessage = "还没有发现可接入的 Mac。请稍等自动发现，或者扫描电脑上的二维码。"
    }

    func retryLastDeviceConnection() async {
        localErrorMessage = nil
        isReviewMode = false
        guard let savedDevice = lastRestoredDevice else {
            return
        }

        await controller.restore(bundle: savedDevice.bundle)
        if controller.bootstrap != nil {
            try? persistCurrentDevice()
            if let sessionID = selectedSessionID {
                await controller.openSession(sessionID)
            }
            startAutoRefreshLoopIfNeeded()
        }
    }

    func openSession(_ sessionID: String) async {
        selectedSessionID = sessionID
        if isReviewMode {
            controller.loadPreviewState(
                bootstrap: previewBootstrap ?? Self.makePreviewBootstrap(),
                selectedSession: previewSessionDetails[sessionID],
                lastCommand: previewLastCommand
            )
            return
        }
        await controller.openSession(sessionID)
        try? persistCurrentDevice()
    }

    func sendPrompt(_ prompt: String) async {
        guard !isReviewMode else {
            localErrorMessage = "审核演示模式下不会发送真实命令。连接你的 Mac 后即可继续操作。"
            return
        }
        guard let sessionID = selectedSessionID else {
            return
        }

        pendingSessionActionLabel = "发送提示词"
        await controller.sendPrompt(sessionID: sessionID, prompt: prompt)
        pendingSessionActionLabel = nil
        try? persistCurrentDevice()
    }

    func refreshHome() async {
        if isReviewMode {
            controller.loadPreviewState(
                bootstrap: previewBootstrap ?? Self.makePreviewBootstrap(),
                selectedSession: selectedSessionID.flatMap { previewSessionDetails[$0] } ?? previewSessionDetails.values.first,
                lastCommand: previewLastCommand
            )
            return
        }
        await controller.refreshBootstrap()
        if let sessionID = selectedSessionID {
            await controller.openSession(sessionID)
        }
    }

    func resumeRun() async {
        guard !isReviewMode else {
            localErrorMessage = "审核演示模式下不会继续真实任务。连接你的 Mac 后即可继续操作。"
            return
        }
        guard let sessionID = selectedSessionID else {
            return
        }

        pendingSessionActionLabel = "继续运行"
        await controller.resumeRun(sessionID: sessionID)
        pendingSessionActionLabel = nil
        try? persistCurrentDevice()
    }

    func retryRun() async {
        guard !isReviewMode else {
            localErrorMessage = "审核演示模式下不会重试真实任务。连接你的 Mac 后即可继续操作。"
            return
        }
        guard let sessionID = selectedSessionID else {
            return
        }

        pendingSessionActionLabel = "重试运行"
        await controller.retryRun(sessionID: sessionID)
        pendingSessionActionLabel = nil
        try? persistCurrentDevice()
    }

    func stopRun() async {
        guard !isReviewMode else {
            localErrorMessage = "审核演示模式下不会停止真实任务。连接你的 Mac 后即可继续操作。"
            return
        }
        guard let sessionID = selectedSessionID else {
            return
        }

        pendingSessionActionLabel = "停止运行"
        await controller.stopRun(sessionID: sessionID)
        pendingSessionActionLabel = nil
        try? persistCurrentDevice()
    }

    func disconnect() {
        stopAutoRefreshLoop()
        stopRelayDiscovery()
        selectedSessionID = nil
        pairingCode = ""
        pendingSessionActionLabel = nil
        lastRestoredDevice = nil
        localErrorMessage = nil
        isReviewMode = false
        previewBootstrap = nil
        previewSessionDetails = [:]
        previewLastCommand = nil
        controller.disconnect()
        try? knownDeviceStore.clearKnownDevice()
    }

    func enterReviewMode() {
        stopAutoRefreshLoop()
        stopRelayDiscovery()
        localErrorMessage = nil
        pairingCode = ""
        pendingSessionActionLabel = nil
        isReviewMode = true

        let bootstrap = Self.makePreviewBootstrap()
        let sessionDetails = Self.makePreviewSessionDetails()
        let lastCommand = Self.makePreviewLastCommand()

        previewBootstrap = bootstrap
        previewSessionDetails = Dictionary(uniqueKeysWithValues: sessionDetails.map { ($0.session.id, $0) })
        previewLastCommand = lastCommand
        selectedSessionID = sessionDetails.first?.session.id

        controller.loadPreviewState(
            bootstrap: bootstrap,
            selectedSession: sessionDetails.first,
            lastCommand: lastCommand
        )
    }

    func presentHelp() {
        isHelpPresented = true
    }

    func dismissHelp(markSeen: Bool = true) {
        if markSeen {
            UserDefaults.standard.set(true, forKey: Self.helpSeenKey)
        }
        isHelpPresented = false
    }

    func presentOnboarding() {
        isOnboardingPresented = true
    }

    func dismissOnboarding(markSeen: Bool = true, presentHelpAfterward: Bool = false) {
        if markSeen {
            UserDefaults.standard.set(true, forKey: Self.onboardingSeenKey)
        }
        isOnboardingPresented = false

        if presentHelpAfterward {
            presentHelp()
        }
    }

    private func persistCurrentDevice() throws {
        guard let bundle = controller.bundle else {
            return
        }

        let savedDevice = SavedKnownDevice(
            bundle: bundle,
            lastSessionID: selectedSessionID,
            savedAt: ISO8601DateFormatter().string(from: .now)
        )
        try knownDeviceStore.saveKnownDevice(savedDevice)
        lastRestoredDevice = savedDevice
    }

    func useDiscoveredRelay(_ relay: DiscoveredRelay) {
        baseURLText = relay.baseURL
    }

    func connectToDiscoveredRelay(_ relay: DiscoveredRelay) async {
        baseURLText = relay.baseURL
        await connectDirect()
    }

    private func startRelayDiscovery() {
        relayDiscovery.start()
    }

    private func stopRelayDiscovery() {
        relayDiscovery.stop()
    }

    private func startAutoRefreshLoopIfNeeded() {
        guard autoRefreshTask == nil else {
            return
        }

        autoRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                guard let self else {
                    return
                }

                if self.isConnected {
                    await self.refreshHome()
                } else if self.lastRestoredDevice != nil {
                    await self.retryLastDeviceConnection()
                }
            }
        }
    }

    private func stopAutoRefreshLoop() {
        autoRefreshTask?.cancel()
        autoRefreshTask = nil
    }

    private static func makePreviewBootstrap() -> MobileBootstrapResponse {
        let json = """
        {
          "workspace": { "id": "review-demo", "name": "Codex Remote Demo" },
          "device": {
            "deviceId": "demo-device",
            "workspaceId": "review-demo",
            "workspaceName": "Codex Remote Demo",
            "updatedAt": "2026-04-30T07:30:00Z"
          },
          "transport": {
            "type": "demo",
            "baseUrl": "demo://codex-remote",
            "localBaseUrl": "demo://codex-remote",
            "phoneAccessUrl": null,
            "isLocalOnly": true,
            "hint": "review mode"
          },
          "sync": {
            "enabled": false,
            "lastSucceededAt": "2026-04-30T07:30:00Z",
            "lastError": null
          },
          "supportedCommands": ["sendPrompt", "resumeRun", "retryRun", "stopRun"],
          "dashboard": {
            "workspace": { "id": "review-demo", "name": "Codex Remote Demo" },
            "device": {
              "deviceId": "demo-device",
              "workspaceId": "review-demo",
              "workspaceName": "Codex Remote Demo",
              "updatedAt": "2026-04-30T07:30:00Z"
            },
            "stats": {
              "sessionCount": 3,
              "activeRunCount": 1,
              "automationCount": 1,
              "templateCount": 1,
              "commandCount": 5
            },
            "sessions": [
              {
                "id": "demo_waiting",
                "title": "发布周报摘要",
                "status": "active",
                "runStatus": "waitingForInput",
                "cwd": "/Users/demo/work/weekly-report",
                "model": "gpt-5.4",
                "childRunCount": 0,
                "updatedAt": 1777533900
              },
              {
                "id": "demo_running",
                "title": "知识库整理",
                "status": "active",
                "runStatus": "running",
                "cwd": "/Users/demo/work/knowledge-base",
                "model": "gpt-5.4",
                "childRunCount": 2,
                "updatedAt": 1777533600
              },
              {
                "id": "demo_failed",
                "title": "飞书日报发送",
                "status": "failed",
                "runStatus": "failed",
                "cwd": "/Users/demo/work/daily-briefing",
                "model": "gpt-5.4-mini",
                "childRunCount": 0,
                "updatedAt": 1777533300
              }
            ],
            "automations": [
              { "id": "auto_1", "name": "每日晨报", "isEnabled": true }
            ],
            "templates": [
              { "id": "tpl_1", "name": "快速继续会话" }
            ],
            "recentCommands": [
              {
                "id": "cmd_demo_1",
                "status": "failed",
                "kind": "sendPrompt",
                "targetType": "session",
                "targetId": "demo_waiting",
                "createdAt": "2026-04-30T07:24:00Z",
                "completedAt": "2026-04-30T07:24:18Z",
                "acknowledgementMessage": "上一次发送被中断，等待继续输入。"
              }
            ]
          }
        }
        """

        return try! JSONDecoder().decode(MobileBootstrapResponse.self, from: Data(json.utf8))
    }

    private static func makePreviewSessionDetails() -> [SessionDetailPayload] {
        let waiting = """
        {
          "session": {
            "id": "demo_waiting",
            "title": "发布周报摘要",
            "fullTitle": "发布周报摘要",
            "status": "active",
            "cwd": "/Users/demo/work/weekly-report",
            "model": "gpt-5.4",
            "updatedAt": 1777533900
          },
          "run": {
            "id": "demo_waiting",
            "status": "waitingForInput",
            "parentRunId": null,
            "automationId": null
          },
          "recentCommands": [
            {
              "id": "cmd_demo_1",
              "status": "failed",
              "kind": "sendPrompt",
              "prompt": "把本周项目进展整理成 3 点摘要",
              "createdAt": "2026-04-30T07:24:00Z",
              "completedAt": "2026-04-30T07:24:18Z",
              "acknowledgementMessage": "上一次发送被中断，等待继续输入。"
            }
          ],
          "recentEvents": [
            {
              "id": "evt_1",
              "level": "info",
              "message": "会话已经整理出初稿，等待你继续输入下一条提示词。",
              "occurredAt": "2026-04-30T07:24:20Z",
              "repeatCount": 1
            },
            {
              "id": "evt_2",
              "level": "warning",
              "message": "最近一次命令未完成，建议先查看命令回执。",
              "occurredAt": "2026-04-30T07:24:21Z",
              "repeatCount": 1
            }
          ]
        }
        """

        let running = """
        {
          "session": {
            "id": "demo_running",
            "title": "知识库整理",
            "fullTitle": "知识库整理",
            "status": "active",
            "cwd": "/Users/demo/work/knowledge-base",
            "model": "gpt-5.4",
            "updatedAt": 1777533600
          },
          "run": {
            "id": "demo_running",
            "status": "running",
            "parentRunId": null,
            "automationId": null
          },
          "recentCommands": [
            {
              "id": "cmd_demo_2",
              "status": "running",
              "kind": "resumeRun",
              "prompt": null,
              "createdAt": "2026-04-30T07:20:00Z",
              "completedAt": null,
              "acknowledgementMessage": "当前正在整理知识库条目。"
            }
          ],
          "recentEvents": [
            {
              "id": "evt_3",
              "level": "info",
              "message": "正在扫描文档目录并提取最近更新条目。",
              "occurredAt": "2026-04-30T07:20:16Z",
              "repeatCount": 1
            }
          ]
        }
        """

        let failed = """
        {
          "session": {
            "id": "demo_failed",
            "title": "飞书日报发送",
            "fullTitle": "飞书日报发送",
            "status": "failed",
            "cwd": "/Users/demo/work/daily-briefing",
            "model": "gpt-5.4-mini",
            "updatedAt": 1777533300
          },
          "run": {
            "id": "demo_failed",
            "status": "failed",
            "parentRunId": null,
            "automationId": "auto_1"
          },
          "recentCommands": [
            {
              "id": "cmd_demo_3",
              "status": "failed",
              "kind": "startAutomation",
              "prompt": null,
              "createdAt": "2026-04-30T07:15:00Z",
              "completedAt": "2026-04-30T07:15:14Z",
              "acknowledgementMessage": "发送日报时遇到上游接口错误。"
            }
          ],
          "recentEvents": [
            {
              "id": "evt_4",
              "level": "error",
              "message": "日报发送失败，建议检查内容摘要后重试。",
              "occurredAt": "2026-04-30T07:15:16Z",
              "repeatCount": 1
            }
          ]
        }
        """

        let decoder = JSONDecoder()
        return [
            try! decoder.decode(SessionDetailPayload.self, from: Data(waiting.utf8)),
            try! decoder.decode(SessionDetailPayload.self, from: Data(running.utf8)),
            try! decoder.decode(SessionDetailPayload.self, from: Data(failed.utf8))
        ]
    }

    private static func makePreviewLastCommand() -> SubmittedCommand {
        let json = """
        {
          "id": "cmd_demo_1",
          "status": "failed",
          "acknowledgementMessage": "演示模式：这里展示的是最近一次命令回执。"
        }
        """

        return try! JSONDecoder().decode(SubmittedCommand.self, from: Data(json.utf8))
    }
}
