import Foundation

public struct ControlPlaneAPIError: Error, Equatable, Sendable {
    public let status: Int
    public let requestID: String?
    public let code: String
    public let message: String

    public init(status: Int, requestID: String?, code: String, message: String) {
        self.status = status
        self.requestID = requestID
        self.code = code
        self.message = message
    }
}

public struct PairingDiscovery: Codable, Equatable, Sendable {
    public let deviceID: String
    public let workspaceID: String
    public let workspaceName: String
    public let updatedAt: String
    public let authRequired: Bool
    public let pairingStatus: String
    public let transport: TransportInfo

    enum CodingKeys: String, CodingKey {
        case deviceID = "deviceId"
        case workspaceID = "workspaceId"
        case workspaceName
        case updatedAt
        case authRequired
        case pairingStatus
        case transport
    }
}

public struct PairingBootstrapResponse: Codable, Equatable, Sendable {
    public let bundle: PairingBundle
    public let pairingCode: String
}

public struct PairingBundle: Codable, Equatable, Sendable {
    public let version: Int
    public let generatedAt: String
    public let deviceID: String
    public let workspaceID: String
    public let workspaceName: String
    public let pairingToken: String?
    public let transport: TransportInfo
    public let capabilities: ControlPlaneCapabilities

    enum CodingKeys: String, CodingKey {
        case version
        case generatedAt
        case deviceID = "deviceId"
        case workspaceID = "workspaceId"
        case workspaceName
        case pairingToken
        case transport
        case capabilities
    }
}

public struct TransportInfo: Codable, Equatable, Sendable {
    public let type: String?
    public let baseURL: String
    public let localBaseURL: String?
    public let phoneAccessURL: String?
    public let isLocalOnly: Bool?
    public let hint: String?

    enum CodingKeys: String, CodingKey {
        case type
        case baseURL = "baseUrl"
        case localBaseURL = "localBaseUrl"
        case phoneAccessURL = "phoneAccessUrl"
        case isLocalOnly
        case hint
    }

    public var preferredDisplayURL: String {
        phoneAccessURL ?? baseURL
    }
}

public struct ControlPlaneCapabilities: Codable, Equatable, Sendable {
    public let commandSubmission: Bool
    public let sessionInspection: Bool
    public let eventStreaming: Bool
    public let backgroundSync: Bool
}

public struct MobileBootstrapResponse: Decodable, Equatable, Sendable {
    public let workspace: WorkspaceSummary
    public let device: DeviceSummary
    public let transport: TransportInfo
    public let sync: SyncStatus?
    public let supportedCommands: [String]
    public let dashboard: DashboardPayload
}

public struct WorkspaceSummary: Decodable, Equatable, Sendable {
    public let id: String
    public let name: String
}

public struct DeviceSummary: Decodable, Equatable, Sendable {
    public let deviceID: String
    public let workspaceID: String
    public let workspaceName: String
    public let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case deviceID = "deviceId"
        case workspaceID = "workspaceId"
        case workspaceName
        case updatedAt
    }
}

public struct SyncStatus: Decodable, Equatable, Sendable {
    public let enabled: Bool
    public let lastSucceededAt: String?
    public let lastError: String?
}

public struct DashboardPayload: Decodable, Equatable, Sendable {
    public let workspace: WorkspaceSummary
    public let device: DeviceSummary
    public let stats: DashboardStats
    public let quota: DashboardQuota?
    public let sessions: [SessionSummary]
    public let automations: [AutomationSummary]
    public let templates: [TemplateSummary]
    public let recentCommands: [CommandSummary]

    public init(
        workspace: WorkspaceSummary,
        device: DeviceSummary,
        stats: DashboardStats,
        quota: DashboardQuota? = nil,
        sessions: [SessionSummary],
        automations: [AutomationSummary],
        templates: [TemplateSummary],
        recentCommands: [CommandSummary]
    ) {
        self.workspace = workspace
        self.device = device
        self.stats = stats
        self.quota = quota
        self.sessions = sessions
        self.automations = automations
        self.templates = templates
        self.recentCommands = recentCommands
    }
}

public struct DashboardStats: Decodable, Equatable, Sendable {
    public let sessionCount: Int
    public let activeRunCount: Int
    public let automationCount: Int
    public let templateCount: Int
    public let commandCount: Int
}

public struct DashboardQuota: Decodable, Equatable, Sendable {
    public let planType: String?
    public let credits: Double?
    public let primary: DashboardQuotaWindow?
    public let secondary: DashboardQuotaWindow?
    public let sourcedAt: String?
}

public struct DashboardQuotaWindow: Decodable, Equatable, Sendable {
    public let usedPercent: Double
    public let remainingPercent: Double
    public let windowMinutes: Double?
    public let resetsAt: String?

    enum CodingKeys: String, CodingKey {
        case usedPercent
        case remainingPercent
        case windowMinutes
        case resetsAt
    }

    public init(
        usedPercent: Double,
        remainingPercent: Double,
        windowMinutes: Double? = nil,
        resetsAt: String? = nil
    ) {
        self.usedPercent = usedPercent
        self.remainingPercent = remainingPercent
        self.windowMinutes = windowMinutes
        self.resetsAt = resetsAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        usedPercent = try Self.decodeFlexibleDouble(container: container, key: .usedPercent)
        remainingPercent = try Self.decodeFlexibleDouble(container: container, key: .remainingPercent)
        windowMinutes = try Self.decodeFlexibleOptionalDouble(container: container, key: .windowMinutes)
        resetsAt = try Self.decodeFlexibleOptionalString(container: container, key: .resetsAt)
    }
}

public struct SessionSummary: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let status: String
    public let runStatus: String?
    public let cwd: String?
    public let model: String?
    public let childRunCount: Int
    public let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, status, runStatus, cwd, model, childRunCount, updatedAt
    }

    public init(
        id: String,
        title: String,
        status: String,
        runStatus: String? = nil,
        cwd: String? = nil,
        model: String? = nil,
        childRunCount: Int,
        updatedAt: String
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.runStatus = runStatus
        self.cwd = cwd
        self.model = model
        self.childRunCount = childRunCount
        self.updatedAt = updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        status = try container.decode(String.self, forKey: .status)
        runStatus = try container.decodeIfPresent(String.self, forKey: .runStatus)
        cwd = try container.decodeIfPresent(String.self, forKey: .cwd)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        childRunCount = try container.decode(Int.self, forKey: .childRunCount)
        updatedAt = try Self.decodeFlexibleString(container: container, key: .updatedAt)
    }
}

public struct AutomationSummary: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let isEnabled: Bool
}

public struct TemplateSummary: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
}

public struct CommandSummary: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let status: String
    public let kind: String
    public let targetType: String?
    public let targetID: String?
    public let createdAt: String?
    public let completedAt: String?
    public let acknowledgementMessage: String?

    enum CodingKeys: String, CodingKey {
        case id, status, kind, createdAt, completedAt, acknowledgementMessage
        case targetType
        case targetID = "targetId"
    }
}

public struct SessionDetailPayload: Decodable, Equatable, Sendable {
    public let session: SessionDetail
    public let run: RunDetail?
    public let recentCommands: [SessionCommand]
    public let recentEvents: [SessionEvent]
}

public struct SessionDetail: Decodable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let fullTitle: String
    public let status: String
    public let cwd: String?
    public let model: String?
    public let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, fullTitle, status, cwd, model, updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        fullTitle = try container.decode(String.self, forKey: .fullTitle)
        status = try container.decode(String.self, forKey: .status)
        cwd = try container.decodeIfPresent(String.self, forKey: .cwd)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        updatedAt = try Self.decodeFlexibleString(container: container, key: .updatedAt)
    }
}

public struct RunDetail: Decodable, Equatable, Sendable {
    public let id: String
    public let status: String
    public let parentRunID: String?
    public let automationID: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case parentRunID = "parentRunId"
        case automationID = "automationId"
    }
}

public struct SessionCommand: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let status: String
    public let kind: String
    public let prompt: String?
    public let createdAt: String?
    public let completedAt: String?
    public let acknowledgementMessage: String?

    enum CodingKeys: String, CodingKey {
        case id, status, kind, prompt, createdAt, completedAt, acknowledgementMessage
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        status = try container.decode(String.self, forKey: .status)
        kind = try container.decode(String.self, forKey: .kind)
        prompt = try container.decodeIfPresent(String.self, forKey: .prompt)
        createdAt = try Self.decodeFlexibleOptionalString(container: container, key: .createdAt)
        completedAt = try Self.decodeFlexibleOptionalString(container: container, key: .completedAt)
        acknowledgementMessage = try container.decodeIfPresent(String.self, forKey: .acknowledgementMessage)
    }
}

public struct SessionEvent: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let level: String
    public let message: String
    public let occurredAt: String?
    public let repeatCount: Int

    enum CodingKeys: String, CodingKey {
        case id, level, message, occurredAt, repeatCount
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        level = try container.decode(String.self, forKey: .level)
        message = try container.decode(String.self, forKey: .message)
        occurredAt = try Self.decodeFlexibleOptionalString(container: container, key: .occurredAt)
        repeatCount = try container.decode(Int.self, forKey: .repeatCount)
    }
}

public struct SubmitCommandBody: Encodable, Equatable, Sendable {
    public let target: CommandTarget
    public let payload: CommandPayload

    public init(target: CommandTarget, payload: CommandPayload) {
        self.target = target
        self.payload = payload
    }
}

public struct CommandTarget: Encodable, Equatable, Sendable {
    public let type: String
    public let id: String
}

public struct CommandPayload: Encodable, Equatable, Sendable {
    public let kind: String
    public let prompt: String?
    public let attachments: [String]?
    public let reason: String?

    public init(kind: String, prompt: String? = nil, attachments: [String]? = nil, reason: String? = nil) {
        self.kind = kind
        self.prompt = prompt
        self.attachments = attachments
        self.reason = reason
    }
}

public struct SubmitCommandResponse: Decodable, Equatable, Sendable {
    public let command: SubmittedCommand
}

public struct SubmittedCommand: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let status: String
    public let acknowledgementMessage: String?

    public var statusDisplayName: String {
        switch status {
        case "queued":
            return "排队中"
        case "running":
            return "执行中"
        case "completed":
            return "已完成"
        case "failed":
            return "失败"
        default:
            return status
        }
    }

    public var feedbackSummary: String {
        acknowledgementMessage ?? "最近一次操作状态：\(statusDisplayName)"
    }
}

public struct MobileDashboardPresentation: Equatable, Sendable {
    public struct StatCard: Equatable, Identifiable, Sendable {
        public let title: String
        public let value: Int
        public let tone: String

        public var id: String { title }
    }

    public struct FocusSession: Equatable, Identifiable, Sendable {
        public let id: String
        public let title: String
        public let subtitle: String
        public let actionLabel: String
        public let statusLabel: String
    }

    public struct QueueItem: Equatable, Identifiable, Sendable {
        public let id: String
        public let title: String
        public let subtitle: String
        public let statusLabel: String
        public let actionLabel: String
    }

    public struct QuotaSummary: Equatable, Sendable {
        public let title: String
        public let remainingLabel: String
        public let resetLabel: String
        public let detailLabel: String
        public let tone: String
    }

    public let heroTitle: String
    public let heroSubtitle: String
    public let healthLabel: String
    public let statCards: [StatCard]
    public let quotaSummaries: [QuotaSummary]
    public let focus: FocusSession?
    public let queue: [QueueItem]

    public static func build(
        bootstrap: MobileBootstrapResponse,
        selectedSessionID: String?
    ) -> MobileDashboardPresentation {
        let sessions = bootstrap.dashboard.sessions
        let stats = bootstrap.dashboard.stats
        let waitingCount = sessions.filter { normalizedStatus($0) == "waitingForInput" }.count
        let failureCount = sessions.filter { normalizedStatus($0) == "failed" }.count
        let activeCount = stats.activeRunCount
        let quotaSummaries = buildQuotaSummaries(bootstrap.dashboard.quota)
        let focusSession = sessions.first(where: { $0.id == selectedSessionID })
            ?? prioritizedSessions(from: sessions).first

        let subtitleParts = [
            "\(stats.sessionCount) 个会话",
            "\(activeCount) 个运行中",
            waitingCount > 0 ? "\(waitingCount) 个待接管" : nil,
            failureCount > 0 ? "\(failureCount) 个异常" : nil
        ].compactMap { $0 }

        return MobileDashboardPresentation(
            heroTitle: bootstrap.workspace.name,
            heroSubtitle: subtitleParts.joined(separator: " · "),
            healthLabel: buildHealthLabel(waitingCount: waitingCount, failureCount: failureCount, activeCount: activeCount),
            statCards: [
                StatCard(title: "待接管", value: waitingCount, tone: "urgent"),
                StatCard(title: "运行中", value: activeCount, tone: "active"),
                StatCard(title: "异常", value: failureCount, tone: "warning"),
                StatCard(title: "自动化", value: stats.automationCount, tone: "success")
            ],
            quotaSummaries: quotaSummaries,
            focus: focusSession.map { session in
                FocusSession(
                    id: session.id,
                    title: session.title,
                    subtitle: buildSessionSubtitle(session),
                    actionLabel: buildActionLabel(for: session),
                    statusLabel: translateStatus(normalizedStatus(session))
                )
            },
            queue: prioritizedSessions(from: sessions).prefix(4).map { session in
                QueueItem(
                    id: session.id,
                    title: session.title,
                    subtitle: buildSessionSubtitle(session),
                    statusLabel: translateStatus(normalizedStatus(session)),
                    actionLabel: buildActionLabel(for: session)
                )
            }
        )
    }

    private static func prioritizedSessions(from sessions: [SessionSummary]) -> [SessionSummary] {
        sessions.sorted { left, right in
            let leftRank = statusRank(normalizedStatus(left))
            let rightRank = statusRank(normalizedStatus(right))
            if leftRank != rightRank {
                return leftRank < rightRank
            }

            return (normalizedTimestamp(left.updatedAt) ?? 0) > (normalizedTimestamp(right.updatedAt) ?? 0)
        }
    }

    private static func normalizedStatus(_ session: SessionSummary) -> String {
        session.runStatus ?? session.status
    }

    private static func statusRank(_ status: String) -> Int {
        switch status {
        case "waitingForInput":
            return 0
        case "failed":
            return 1
        case "running", "active", "queued":
            return 2
        default:
            return 3
        }
    }

    private static func buildHealthLabel(waitingCount: Int, failureCount: Int, activeCount: Int) -> String {
        if waitingCount > 0 {
            return "待接管优先"
        }

        if failureCount > 0 {
            return "异常待处理"
        }

        if activeCount > 0 {
            return "运行中观察"
        }

        return "本机已就绪"
    }

    private static func buildActionLabel(for session: SessionSummary) -> String {
        switch normalizedStatus(session) {
        case "waitingForInput":
            return "继续处理"
        case "failed":
            return "检查并重试"
        case "running", "active", "queued":
            return "查看进度"
        default:
            return "打开会话"
        }
    }

    private static func buildSessionSubtitle(_ session: SessionSummary) -> String {
        [
            session.cwd,
            session.model,
            relativeTimestampLabel(session.updatedAt)
        ]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    private static func buildQuotaSummaries(_ quota: DashboardQuota?) -> [QuotaSummary] {
        guard let quota else {
            return []
        }

        return [quota.primary, quota.secondary]
            .compactMap { buildQuotaSummary(from: $0) }
    }

    private static func buildQuotaSummary(from window: DashboardQuotaWindow?) -> QuotaSummary? {
        guard let window else {
            return nil
        }

        let remaining = Int(window.remainingPercent.rounded())
        let tone = remaining <= 20 ? "warning" : "success"
        let windowLabel = quotaWindowLabel(window.windowMinutes)
        let resetLabel: String
        let detailLabel: String
        if let resetsAt = window.resetsAt,
           let timestamp = normalizedTimestamp(resetsAt) {
            resetLabel = absoluteMinuteLabel(timestamp)
            detailLabel = (relativeMinuteLabel(timestamp).map { "约\($0)" } ?? "恢复时间待确认")
        } else {
            resetLabel = "恢复时间待确认"
            detailLabel = tone == "warning" ? "请优先收敛消耗" : "当前额度状态稳定"
        }

        return QuotaSummary(
            title: windowLabel.map { "\($0)额度" } ?? "额度剩余",
            remainingLabel: "剩余 \(remaining)%",
            resetLabel: resetLabel,
            detailLabel: detailLabel,
            tone: tone
        )
    }

    private static func quotaWindowLabel(_ minutes: Double?) -> String? {
        guard let minutes else { return nil }
        let rounded = Int(minutes.rounded())
        if rounded % (24 * 60) == 0 {
            return "\(rounded / (24 * 60))天"
        }
        if rounded % 60 == 0 {
            return "\(rounded / 60)小时"
        }
        return "\(rounded)分钟"
    }

    private static func relativeMinuteLabel(_ timestamp: Double) -> String? {
        let now = Date()
        let target = Date(timeIntervalSince1970: timestamp / 1000)
        let diffMinutes = max(1, Int(((target.timeIntervalSince(now)) / 60).rounded()))

        if diffMinutes < 60 {
            return "\(diffMinutes)分钟后"
        }

        let hours = diffMinutes / 60
        let minutes = diffMinutes % 60
        if hours < 24 {
            return minutes == 0
                ? "\(hours)小时后"
                : "\(hours)小时\(minutes)分钟后"
        }

        let days = hours / 24
        let remainingHours = hours % 24
        if remainingHours == 0 {
            return "\(days)天后"
        }

        return "\(days)天\(remainingHours)小时后"
    }

    private static func absoluteMinuteLabel(_ timestamp: Double) -> String {
        let target = Date(timeIntervalSince1970: timestamp / 1000)
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")

        if calendar.isDateInToday(target) {
            formatter.dateFormat = "HH:mm"
            return "今天 \(formatter.string(from: target)) 恢复"
        }

        if calendar.isDateInTomorrow(target) {
            formatter.dateFormat = "HH:mm"
            return "明天 \(formatter.string(from: target)) 恢复"
        }

        formatter.dateFormat = "M月d日 HH:mm"
        return "\(formatter.string(from: target)) 恢复"
    }

    private static func translateStatus(_ status: String) -> String {
        switch status {
        case "waitingForInput":
            return "等待输入"
        case "failed":
            return "异常"
        case "running", "active":
            return "执行中"
        case "queued":
            return "排队中"
        default:
            return "空闲"
        }
    }

    private static func relativeTimestampLabel(_ value: String) -> String? {
        guard let timestamp = normalizedTimestamp(value) else {
            return value.isEmpty ? nil : "更新于\(value)"
        }

        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.unitsStyle = .full
        return "更新于\(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    private static func normalizedTimestamp(_ value: String) -> Double? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        if let numeric = Double(trimmed) {
            return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
        }

        let standardFormatter = ISO8601DateFormatter()
        if let date = standardFormatter.date(from: trimmed) {
            return date.timeIntervalSince1970 * 1000
        }

        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: trimmed) {
            return date.timeIntervalSince1970 * 1000
        }

        return nil
    }
}

private extension Decodable {
    static func decodeFlexibleString<K: CodingKey>(
        container: KeyedDecodingContainer<K>,
        key: K
    ) throws -> String {
        if let stringValue = try? container.decode(String.self, forKey: key) {
            return stringValue
        }

        if let intValue = try? container.decode(Int.self, forKey: key) {
            return String(intValue)
        }

        if let doubleValue = try? container.decode(Double.self, forKey: key) {
            return String(doubleValue)
        }

        throw DecodingError.typeMismatch(
            String.self,
            .init(codingPath: container.codingPath + [key], debugDescription: "Expected string-compatible value")
        )
    }

    static func decodeFlexibleOptionalString<K: CodingKey>(
        container: KeyedDecodingContainer<K>,
        key: K
    ) throws -> String? {
        if (try? container.decodeNil(forKey: key)) == true {
            return nil
        }

        return try decodeFlexibleString(container: container, key: key)
    }

    static func decodeFlexibleDouble<K: CodingKey>(
        container: KeyedDecodingContainer<K>,
        key: K
    ) throws -> Double {
        if let doubleValue = try? container.decode(Double.self, forKey: key) {
            return doubleValue
        }

        if let intValue = try? container.decode(Int.self, forKey: key) {
            return Double(intValue)
        }

        if let stringValue = try? container.decode(String.self, forKey: key),
           let numeric = Double(stringValue) {
            return numeric
        }

        throw DecodingError.typeMismatch(
            Double.self,
            .init(codingPath: container.codingPath + [key], debugDescription: "Expected double-compatible value")
        )
    }

    static func decodeFlexibleOptionalDouble<K: CodingKey>(
        container: KeyedDecodingContainer<K>,
        key: K
    ) throws -> Double? {
        if (try? container.decodeNil(forKey: key)) == true {
            return nil
        }

        return try decodeFlexibleDouble(container: container, key: key)
    }
}

struct APIErrorEnvelope: Decodable, Equatable, Sendable {
    struct APIErrorPayload: Decodable, Equatable, Sendable {
        let code: String
        let message: String
    }

    let requestId: String?
    let error: APIErrorPayload
}

public struct APIEnvelope<Payload: Decodable & Equatable & Sendable>: Decodable, Equatable, Sendable {
    public let requestID: String?
    public let data: Payload

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.data = try container.decode(Payload.self)
        self.requestID = nil
    }
}
