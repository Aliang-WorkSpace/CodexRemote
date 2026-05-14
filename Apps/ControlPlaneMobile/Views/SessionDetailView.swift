import SwiftUI
#if canImport(ControlPlaneMobileCore)
import ControlPlaneMobileCore
#endif

struct SessionDetailView: View {
    let appState: MobileAppState
    let sessionID: String

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var prompt = ""
    @State private var detail: SessionDetailPayload?
    @State private var loadErrorMessage: String?
    @State private var isLoadingDetail = true

    var body: some View {
        GeometryReader { proxy in
            let isWideLayout = horizontalSizeClass == .regular && proxy.size.width >= 980

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if appState.isReviewMode {
                        ContentUnavailableView {
                            Label("审核演示模式", systemImage: "checkmark.seal")
                        } description: {
                            Text("当前展示的是示例会话详情，用来帮助理解产品结构。连接你的 Mac 后，这里会切换成真实会话。")
                        }
                    }

                    if let detail {
                        detailHeader(detail: detail)

                        if isWideLayout {
                            HStack(alignment: .top, spacing: 16) {
                                VStack(alignment: .leading, spacing: 16) {
                                    commandStatusHero()
                                    sessionStatusGrid(detail: detail)
                                    commandComposerCard()
                                }
                                .frame(maxWidth: .infinity, alignment: .topLeading)

                                VStack(alignment: .leading, spacing: 16) {
                                    if let lastCommand = appState.controller.lastCommand {
                                        commandReceiptCard(lastCommand: lastCommand)
                                    }

                                    eventTimelineCard(events: detail.recentEvents)
                                }
                                .frame(maxWidth: .infinity, alignment: .topLeading)
                            }
                        } else {
                            commandStatusHero()
                            sessionStatusGrid(detail: detail)
                            commandComposerCard()

                            if let lastCommand = appState.controller.lastCommand {
                                commandReceiptCard(lastCommand: lastCommand)
                            }

                            eventTimelineCard(events: detail.recentEvents)
                        }
                    } else if let loadErrorMessage {
                        ContentUnavailableView(
                            "会话暂时打不开",
                            systemImage: "exclamationmark.triangle",
                            description: Text(loadErrorMessage)
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                    } else {
                        ProgressView("正在加载会话…")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 64)
                    }
                }
                .frame(maxWidth: isWideLayout ? 1180 : 760)
                .padding(.horizontal, 16)
                .padding(.vertical, 18)
            }
            .frame(maxWidth: .infinity)
            .background(screenBackground.ignoresSafeArea())
        }
        .navigationTitle("会话详情")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: sessionID) {
            await reloadSessionDetail()
        }
        .refreshable {
            await reloadSessionDetail()
        }
    }

    private var screenBackground: some View {
        ZStack {
            Color(.systemGroupedBackground)
            LinearGradient(
                colors: [
                    Color(red: 0.90, green: 0.95, blue: 1.0).opacity(0.46),
                    Color.clear,
                    Color(red: 0.92, green: 0.98, blue: 0.97).opacity(0.34)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var isBusy: Bool {
        isLoadingDetail || appState.controller.isLoading
    }

    @ViewBuilder
    private func detailHeader(detail: SessionDetailPayload) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("当前接管")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.82))
                    Text(detail.session.title)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(detail.session.cwd ?? "暂无工作目录")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.78))
                }

                Spacer(minLength: 12)

                statusBadge(
                    text: sessionBadgeLabel(detail: detail),
                    appearance: appearance(for: detail.run?.status ?? detail.session.status)
                )
            }

            HStack(spacing: 8) {
                heroInfoPill(title: "模型", value: detail.session.model ?? "未知")
                heroInfoPill(title: "运行", value: detail.run?.status ?? "无")
                heroInfoPill(title: "事件", value: "\(detail.recentEvents.count)")
            }

            Text("先看当前动作回执，再决定继续、重试还是停止这条会话。")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.74))
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.09, green: 0.19, blue: 0.46),
                    Color(red: 0.12, green: 0.32, blue: 0.80),
                    Color(red: 0.05, green: 0.53, blue: 0.64)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.white.opacity(0.12), lineWidth: 1)
        )
        .shadow(color: Color(red: 0.09, green: 0.19, blue: 0.46).opacity(0.18), radius: 24, y: 14)
    }

    @ViewBuilder
    private func commandStatusHero() -> some View {
        let appearance = appearance(for: appState.controller.lastCommand?.status ?? detail?.run?.status ?? detail?.session.status ?? "idle")

        detailCard(title: "操作状态", trailing: appState.lastCommandStatusTitle, tone: .accent) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 12) {
                    Image(systemName: appearance.icon)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(appearance.foreground)
                        .frame(width: 42, height: 42)
                        .background(appearance.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(appState.lastCommandStatusTitle)
                            .font(.headline)
                        Text(appState.lastCommandStatusSubtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                HStack(spacing: 8) {
                    statusBadge(text: appearance.label, appearance: appearance)

                    if isBusy {
                        Label("处理中", systemImage: "hourglass")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(Color.secondary.opacity(0.08), in: Capsule())
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func sessionStatusGrid(detail: SessionDetailPayload) -> some View {
        detailCard(title: "运行概览", trailing: detail.session.status, tone: .neutral) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                detailMetric(title: "会话状态", value: detail.session.status)
                detailMetric(title: "运行状态", value: detail.run?.status ?? "无")
                detailMetric(title: "模型", value: detail.session.model ?? "未知")
                detailMetric(title: "最近事件", value: "\(detail.recentEvents.count)")
            }
        }
    }

    @ViewBuilder
    private func commandComposerCard() -> some View {
        detailCard(title: "继续这个会话", trailing: isBusy ? "处理中" : "可操作", tone: .softAccent) {
            VStack(alignment: .leading, spacing: 14) {
                TextEditor(text: $prompt)
                    .frame(minHeight: 126)
                    .padding(4)
                    .background(Color.white.opacity(0.88), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.black.opacity(0.08), lineWidth: 1)
                    )

                VStack(spacing: 10) {
                    Button {
                        let current = prompt
                        prompt = ""
                        Task {
                            await appState.sendPrompt(current)
                            await reloadSessionDetail()
                        }
                    } label: {
                        Label("发送提示词", systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.12, green: 0.32, blue: 0.80))
                    .disabled(isBusy || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    HStack(spacing: 10) {
                        actionButton(title: "继续", icon: "play.fill", tint: .blue) {
                            await appState.resumeRun()
                            await reloadSessionDetail()
                        }

                        actionButton(title: "重试", icon: "arrow.clockwise", tint: .orange) {
                            await appState.retryRun()
                            await reloadSessionDetail()
                        }
                    }

                    actionButton(title: "停止当前运行", icon: "stop.fill", tint: .red, fullWidth: true) {
                        await appState.stopRun()
                        await reloadSessionDetail()
                    }
                }

                if isBusy {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text(appState.lastCommandStatusSubtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func commandReceiptCard(lastCommand: SubmittedCommand) -> some View {
        let appearance = appearance(for: lastCommand.status)

        detailCard(title: "最近命令", trailing: lastCommand.statusDisplayName, tone: .elevated) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(appearance.background)
                        .frame(width: 44, height: 44)
                        .overlay(
                            Image(systemName: appearance.icon)
                                .font(.headline.weight(.semibold))
                                .foregroundStyle(appearance.foreground)
                        )

                    VStack(alignment: .leading, spacing: 4) {
                        Text(lastCommand.statusDisplayName)
                            .font(.headline)
                        Text(lastCommand.feedbackSummary)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                if let message = lastCommand.acknowledgementMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
        }
    }

    @ViewBuilder
    private func eventTimelineCard(events: [SessionEvent]) -> some View {
        detailCard(title: "事件时间线", trailing: "\(events.count) 条", tone: .neutral) {
            VStack(spacing: 12) {
                if events.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("还没有最近事件")
                            .font(.subheadline.weight(.semibold))
                        Text("这条会话暂时没有可展示的最近事件，你可以先发送提示词或稍后再刷新。")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Color.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                } else {
                    ForEach(Array(events.prefix(5).enumerated()), id: \.element.id) { index, event in
                        timelineRow(event: event, isLast: index == min(events.count, 5) - 1)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func timelineRow(event: SessionEvent, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Circle()
                    .fill(timelineColor(for: event.level))
                    .frame(width: 11, height: 11)

                if !isLast {
                    Rectangle()
                        .fill(timelineColor(for: event.level).opacity(0.18))
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.message)
                    .font(.subheadline.weight(.semibold))
                Text(event.occurredAt ?? "没有时间戳")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder
    private func detailMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .minimumScaleFactor(0.86)
        }
        .frame(maxWidth: .infinity, minHeight: 84, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.76), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder
    private func heroInfoPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.68))
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private func statusBadge(text: String, appearance: DetailStatusAppearance) -> some View {
        Label(text, systemImage: appearance.icon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(appearance.foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(appearance.background, in: Capsule())
    }

    @ViewBuilder
    private func detailCard<Content: View>(
        title: String,
        trailing: String? = nil,
        tone: DetailCardTone,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                Text(title)
                    .font(.headline.weight(.semibold))

                Spacer()

                if let trailing {
                    Text(trailing)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.6), in: Capsule())
                }
            }

            content()
        }
        .padding(18)
        .background(detailCardBackground(for: tone), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(detailCardBorder(for: tone), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 20, x: 0, y: 12)
    }

    @ViewBuilder
    private func actionButton(
        title: String,
        icon: String,
        tint: Color,
        fullWidth: Bool = false,
        action: @escaping () async -> Void
    ) -> some View {
        Button {
            Task { await action() }
        } label: {
            Label(title, systemImage: icon)
                .frame(maxWidth: fullWidth ? .infinity : nil)
        }
        .buttonStyle(.bordered)
        .tint(tint)
        .disabled(isBusy)
        .controlSize(.large)
    }

    private func reloadSessionDetail() async {
        isLoadingDetail = true
        loadErrorMessage = nil

        await appState.openSession(sessionID)

        if let selectedSession = appState.controller.selectedSession,
           selectedSession.session.id == sessionID {
            detail = selectedSession
            loadErrorMessage = nil
        } else {
            detail = nil
            loadErrorMessage = appState.errorMessage ?? "这次没有拿到当前会话的详情，请稍后再试。"
        }

        isLoadingDetail = false
    }

    private func sessionBadgeLabel(detail: SessionDetailPayload) -> String {
        let rawStatus = detail.run?.status ?? detail.session.status
        return appearance(for: rawStatus).label
    }

    private func timelineColor(for type: String) -> Color {
        switch type {
        case "error":
            return .red
        case "info":
            return Color(red: 0.12, green: 0.32, blue: 0.80)
        default:
            return Color(red: 0.07, green: 0.62, blue: 0.66)
        }
    }

    private func appearance(for status: String) -> DetailStatusAppearance {
        switch status {
        case "waitingForInput":
            return DetailStatusAppearance(
                label: "等待输入",
                icon: "ellipsis.message.fill",
                foreground: Color(red: 0.05, green: 0.50, blue: 0.53),
                background: Color(red: 0.07, green: 0.62, blue: 0.66).opacity(0.14)
            )
        case "failed":
            return DetailStatusAppearance(
                label: "异常",
                icon: "exclamationmark.triangle.fill",
                foreground: .red,
                background: Color.red.opacity(0.14)
            )
        case "running", "active":
            return DetailStatusAppearance(
                label: "执行中",
                icon: "waveform.path.ecg",
                foreground: Color(red: 0.12, green: 0.30, blue: 0.82),
                background: Color(red: 0.12, green: 0.30, blue: 0.82).opacity(0.14)
            )
        case "queued":
            return DetailStatusAppearance(
                label: "排队中",
                icon: "clock.fill",
                foreground: .orange,
                background: Color.orange.opacity(0.18)
            )
        case "completed":
            return DetailStatusAppearance(
                label: "已完成",
                icon: "checkmark.circle.fill",
                foreground: Color(red: 0.08, green: 0.47, blue: 0.43),
                background: Color(red: 0.08, green: 0.47, blue: 0.43).opacity(0.14)
            )
        default:
            return DetailStatusAppearance(
                label: "空闲",
                icon: "circle.fill",
                foreground: .secondary,
                background: Color.secondary.opacity(0.14)
            )
        }
    }

    private func detailCardBackground(for tone: DetailCardTone) -> LinearGradient {
        switch tone {
        case .neutral:
            return LinearGradient(
                colors: [Color(.secondarySystemGroupedBackground), Color.white.opacity(0.94)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .elevated:
            return LinearGradient(
                colors: [Color.white, Color(red: 0.95, green: 0.97, blue: 1.0)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .accent:
            return LinearGradient(
                colors: [Color(red: 0.92, green: 0.96, blue: 1.0), Color.white],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .softAccent:
            return LinearGradient(
                colors: [Color(red: 0.94, green: 0.99, blue: 0.99), Color.white],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private func detailCardBorder(for tone: DetailCardTone) -> Color {
        switch tone {
        case .neutral:
            return Color.black.opacity(0.05)
        case .elevated:
            return Color(red: 0.78, green: 0.84, blue: 0.96).opacity(0.45)
        case .accent:
            return Color(red: 0.39, green: 0.58, blue: 0.94).opacity(0.22)
        case .softAccent:
            return Color(red: 0.31, green: 0.69, blue: 0.72).opacity(0.18)
        }
    }
}

private enum DetailCardTone {
    case neutral
    case elevated
    case accent
    case softAccent
}

private struct DetailStatusAppearance {
    let label: String
    let icon: String
    let foreground: Color
    let background: Color
}
