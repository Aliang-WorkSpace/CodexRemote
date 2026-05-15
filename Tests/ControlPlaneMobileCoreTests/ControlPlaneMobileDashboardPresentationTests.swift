import Foundation
import Testing
@testable import ControlPlaneMobileCore

@Test func mobileDashboardPresentationBuildsOverviewHeroAndStats() {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let oneHourLater = formatter.string(from: Date().addingTimeInterval(60 * 60))

    let bootstrap = MobileBootstrapResponse(
        workspace: WorkspaceSummary(id: "local-mac", name: "Local Mac"),
        device: DeviceSummary(
            deviceID: "device_1",
            workspaceID: "local-mac",
            workspaceName: "Local Mac",
            updatedAt: "2026-04-02T08:00:00.000Z"
        ),
        transport: TransportInfo(
            type: "http",
            baseURL: "http://127.0.0.1:8793",
            localBaseURL: "http://127.0.0.1:8793",
            phoneAccessURL: "http://198.51.100.10:8793",
            isLocalOnly: false,
            hint: nil
        ),
        sync: SyncStatus(enabled: true, lastSucceededAt: "2026-04-02T08:10:00.000Z", lastError: nil),
        supportedCommands: [],
        dashboard: DashboardPayload(
            workspace: WorkspaceSummary(id: "local-mac", name: "Local Mac"),
            device: DeviceSummary(
                deviceID: "device_1",
                workspaceID: "local-mac",
                workspaceName: "Local Mac",
                updatedAt: "2026-04-02T08:00:00.000Z"
            ),
            stats: DashboardStats(sessionCount: 123, activeRunCount: 2, automationCount: 1, templateCount: 1, commandCount: 8),
            quota: DashboardQuota(
                planType: "plus",
                credits: 12.5,
                primary: DashboardQuotaWindow(
                    usedPercent: 28,
                    remainingPercent: 72,
                    windowMinutes: 300,
                    resetsAt: oneHourLater
                ),
                secondary: DashboardQuotaWindow(
                    usedPercent: 18,
                    remainingPercent: 82,
                    windowMinutes: 10080,
                    resetsAt: formatter.string(from: Date().addingTimeInterval(7 * 24 * 60 * 60))
                ),
                sourcedAt: "2026-04-02T08:10:00.000Z"
            ),
            sessions: [
                SessionSummary(
                    id: "session_waiting",
                    title: "AI早报飞书群推送",
                    status: "active",
                    runStatus: "waitingForInput",
                    cwd: "/Users/example/Desktop/codex",
                    model: "gpt-5.4",
                    childRunCount: 0,
                    updatedAt: "2026-04-02T08:06:00.000Z"
                ),
                SessionSummary(
                    id: "session_running",
                    title: "同步管理 APP",
                    status: "active",
                    runStatus: "running",
                    cwd: "/Users/example/Desktop/codex/CodexRemote",
                    model: "gpt-5.4",
                    childRunCount: 0,
                    updatedAt: "2026-04-02T08:05:00.000Z"
                )
            ],
            automations: [
                AutomationSummary(id: "ai", name: "AI早报飞书群推送", isEnabled: true)
            ],
            templates: [],
            recentCommands: []
        )
    )

    let presentation = MobileDashboardPresentation.build(
        bootstrap: bootstrap,
        selectedSessionID: "session_waiting"
    )

    #expect(presentation.heroTitle == "Local Mac")
    #expect(presentation.heroSubtitle.contains("2 个运行中") == true)
    #expect(presentation.heroSubtitle.contains("1 个待接管") == true)
    #expect(presentation.focus?.title == "AI早报飞书群推送")
    #expect(presentation.focus?.actionLabel == "继续处理")
    #expect(
        presentation.statCards.map { $0.title } ==
        ["待接管", "运行中", "异常", "自动化"]
    )
    #expect(presentation.quotaSummaries.count == 2)
    #expect(presentation.quotaSummaries.first?.title == "5小时额度")
    #expect(presentation.quotaSummaries.first?.remainingLabel == "剩余 72%")
    #expect(presentation.quotaSummaries.first?.resetLabel.contains("恢复") == true)
    #expect(presentation.quotaSummaries.first?.detailLabel.hasPrefix("约") == true)
    #expect(presentation.quotaSummaries.first?.detailLabel.contains("小时后") == true)
    #expect(presentation.quotaSummaries.last?.title == "7天额度")
    #expect(presentation.quotaSummaries.last?.remainingLabel == "剩余 82%")
    #expect(presentation.queue.map { $0.id } == ["session_waiting", "session_running"])
}

@Test func mobileDashboardPresentationNormalizesUnixSecondTimestamps() {
    let bootstrap = MobileBootstrapResponse(
        workspace: WorkspaceSummary(id: "local-mac", name: "Local Mac"),
        device: DeviceSummary(
            deviceID: "device_1",
            workspaceID: "local-mac",
            workspaceName: "Local Mac",
            updatedAt: "2026-04-02T08:00:00.000Z"
        ),
        transport: TransportInfo(
            type: "http",
            baseURL: "http://127.0.0.1:8793",
            localBaseURL: "http://127.0.0.1:8793",
            phoneAccessURL: "http://198.51.100.10:8793",
            isLocalOnly: false,
            hint: nil
        ),
        sync: nil,
        supportedCommands: [],
        dashboard: DashboardPayload(
            workspace: WorkspaceSummary(id: "local-mac", name: "Local Mac"),
            device: DeviceSummary(
                deviceID: "device_1",
                workspaceID: "local-mac",
                workspaceName: "Local Mac",
                updatedAt: "2026-04-02T08:00:00.000Z"
            ),
            stats: DashboardStats(sessionCount: 2, activeRunCount: 1, automationCount: 0, templateCount: 0, commandCount: 0),
            quota: nil,
            sessions: [
                SessionSummary(
                    id: "newer",
                    title: "Waiting",
                    status: "active",
                    runStatus: "waitingForInput",
                    cwd: "/Users/example/Desktop/codex/CodexRemote",
                    model: "gpt-5.4",
                    childRunCount: 0,
                    updatedAt: "1777517274"
                ),
                SessionSummary(
                    id: "older",
                    title: "Running",
                    status: "active",
                    runStatus: "running",
                    cwd: "/Users/example/Desktop/codex/CodexRemote",
                    model: "gpt-5.4",
                    childRunCount: 0,
                    updatedAt: "1777516715"
                )
            ],
            automations: [],
            templates: [],
            recentCommands: []
        )
    )

    let presentation = MobileDashboardPresentation.build(
        bootstrap: bootstrap,
        selectedSessionID: nil
    )

    #expect(presentation.queue.map { $0.id } == ["newer", "older"])
    #expect(presentation.focus?.subtitle.contains("1777517274") == false)
    #expect(presentation.focus?.subtitle.contains("更新于") == true)
}
