import SwiftUI
#if canImport(ControlPlaneMobileCore)
import ControlPlaneMobileCore
#endif

struct DashboardView: View {
    let appState: MobileAppState

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var isSessionListExpanded = false

    private let collapsedSessionCount = 5

    private enum DashboardCardTone {
        case neutral
        case elevated
        case accent
        case softAccent
        case spotlight
    }

    private struct QuotaAppearance {
        let foreground: Color
        let accent: Color
        let tint: Color
        let icon: String
    }

    var body: some View {
        GeometryReader { proxy in
            let isWideLayout = horizontalSizeClass == .regular && proxy.size.width >= 900

            Group {
                if let bootstrap = appState.controller.bootstrap {
                    let presentation = MobileDashboardPresentation.build(
                        bootstrap: bootstrap,
                        selectedSessionID: appState.selectedSessionID
                    )

                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            if appState.isReviewMode {
                                reviewModeBanner
                            }

                            overviewHero(presentation: presentation)

                            if isWideLayout {
                                LazyVGrid(
                                    columns: [
                                        GridItem(.flexible(minimum: 280, maximum: 560), spacing: 16, alignment: .top),
                                        GridItem(.flexible(minimum: 280, maximum: 560), spacing: 16, alignment: .top),
                                    ],
                                    alignment: .leading,
                                    spacing: 16
                                ) {
                                    if let focus = presentation.focus {
                                        focusCard(focus: focus)
                                    }

                                    if !presentation.queue.isEmpty {
                                        queueCard(items: presentation.queue)
                                    }

                                    resumeCard(bootstrap: bootstrap)
                                    connectionCard(bootstrap: bootstrap)
                                }
                            } else {
                                if let focus = presentation.focus {
                                    focusCard(focus: focus)
                                }

                                if !presentation.queue.isEmpty {
                                    queueCard(items: presentation.queue)
                                }

                                resumeCard(bootstrap: bootstrap)
                                connectionCard(bootstrap: bootstrap)
                            }

                            sessionListCard(sessions: bootstrap.dashboard.sessions)

                            if let error = appState.errorMessage {
                                statusCard(
                                    title: "恢复提示",
                                    subtitle: error,
                                    tone: .red
                                )
                            }
                        }
                        .frame(maxWidth: isWideLayout ? 1120 : 720)
                        .padding(.horizontal, isWideLayout ? 28 : 16)
                        .padding(.vertical, 18)
                    }
                    .background(screenBackground.ignoresSafeArea())
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            statusCard(
                                title: appState.connectionTitle,
                                subtitle: appState.connectionSubtitle,
                                tone: .blue
                            )
                        }
                        .frame(maxWidth: isWideLayout ? 1120 : 720)
                        .padding(.horizontal, isWideLayout ? 28 : 16)
                        .padding(.vertical, 18)
                    }
                    .background(screenBackground.ignoresSafeArea())
                }
            }
        }
        .navigationTitle("Codex Remote")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: String.self) { sessionID in
            SessionDetailView(appState: appState, sessionID: sessionID)
                .task {
                    await appState.openSession(sessionID)
                }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    appState.presentHelp()
                } label: {
                    Label("使用帮助", systemImage: "questionmark.circle")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("断开") {
                    appState.disconnect()
                }
            }
        }
        .refreshable {
            await appState.refreshHome()
        }
    }

    private var screenBackground: some View {
        ZStack {
            Color(.systemGroupedBackground)
            LinearGradient(
                colors: [
                    Color(red: 0.89, green: 0.95, blue: 1.0).opacity(0.5),
                    Color.clear,
                    Color(red: 0.92, green: 0.98, blue: 0.97).opacity(0.38)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    @ViewBuilder
    private var reviewModeBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(appState.reviewModeBannerTitle, systemImage: "checkmark.seal")
                .font(.headline)
            Text(appState.reviewModeBannerSubtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(Color.orange.opacity(0.22), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func overviewHero(presentation: MobileDashboardPresentation) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("总览")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.82))
                    Text(presentation.heroTitle)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(presentation.heroSubtitle)
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.82))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 8) {
                    Label(presentation.healthLabel, systemImage: "gauge.with.needle")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(.white.opacity(0.14), in: Capsule())
                        .foregroundStyle(.white)

                    if appState.controller.isLoading {
                        ProgressView()
                            .tint(.white)
                            .controlSize(.small)
                    }
                }
            }

            HStack(spacing: 8) {
                heroStatusChip("运行中 \(presentation.statCards.first(where: { $0.title == "运行中" })?.value ?? 0)")
                heroStatusChip("待处理 \(presentation.queue.count)")
                heroStatusChip(presentation.healthLabel)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                ForEach(presentation.statCards) { card in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.title)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.76))
                        Text("\(card.value)")
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
            }

            Text("先看焦点任务和待处理队列，再进入会话继续、重试或停止当前任务。")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.76))

            if !presentation.quotaSummaries.isEmpty {
                VStack(spacing: 10) {
                    ForEach(Array(presentation.quotaSummaries.enumerated()), id: \.offset) { _, quotaSummary in
                        let appearance = quotaAppearance(for: quotaSummary)
                        HStack(alignment: .center, spacing: 10) {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(spacing: 8) {
                                    Image(systemName: appearance.icon)
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(appearance.foreground)
                                        .frame(width: 28, height: 28)
                                        .background(appearance.tint, in: Circle())

                                    Text(quotaSummary.title)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.white.opacity(0.78))
                                }

                                Text(quotaSummary.remainingLabel)
                                    .font(.headline.weight(.bold))
                                    .foregroundStyle(.white)
                            }

                            Spacer(minLength: 8)

                            VStack(alignment: .trailing, spacing: 8) {
                                Text(quotaSummary.resetLabel)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.white.opacity(0.88))
                                    .multilineTextAlignment(.trailing)

                                Text(quotaSummary.tone == "warning" ? "请优先收敛消耗" : "当前额度状态稳定")
                                    .font(.caption2)
                                    .foregroundStyle(.white.opacity(0.68))
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(
                                colors: [
                                    appearance.tint,
                                    .white.opacity(0.10)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .strokeBorder(appearance.accent.opacity(0.28), lineWidth: 1)
                        )
                    }
                }
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.10, green: 0.22, blue: 0.56),
                    Color(red: 0.17, green: 0.34, blue: 0.86),
                    Color(red: 0.08, green: 0.49, blue: 0.66)
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
        .shadow(color: Color(red: 0.10, green: 0.22, blue: 0.56).opacity(0.18), radius: 24, y: 14)
    }

    @ViewBuilder
    private func heroStatusChip(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white.opacity(0.92))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.white.opacity(0.12), in: Capsule())
    }

    private func quotaAppearance(for summary: MobileDashboardPresentation.QuotaSummary) -> QuotaAppearance {
        switch summary.tone {
        case "warning":
            return QuotaAppearance(
                foreground: Color(red: 1.0, green: 0.85, blue: 0.42),
                accent: Color(red: 1.0, green: 0.74, blue: 0.25),
                tint: Color(red: 1.0, green: 0.78, blue: 0.22).opacity(0.18),
                icon: "exclamationmark.triangle.fill"
            )
        default:
            return QuotaAppearance(
                foreground: Color(red: 0.62, green: 1.0, blue: 0.86),
                accent: Color(red: 0.35, green: 0.92, blue: 0.75),
                tint: Color(red: 0.32, green: 0.88, blue: 0.72).opacity(0.16),
                icon: "gauge.with.dots.needle.50percent"
            )
        }
    }

    @ViewBuilder
    private func focusCard(focus: MobileDashboardPresentation.FocusSession) -> some View {
        let appearance = statusAppearance(for: focus.statusLabel)

        cardContainer(title: "任务焦点", trailing: focus.statusLabel, tone: .spotlight) {
            NavigationLink(value: focus.id) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(focus.title)
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(focus.subtitle)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }

                        Spacer(minLength: 8)

                        VStack(alignment: .trailing, spacing: 8) {
                            Text(appearance.label)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(appearance.foreground)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(appearance.background, in: Capsule())
                                .overlay(
                                    Capsule()
                                        .strokeBorder(appearance.foreground.opacity(0.14), lineWidth: 1)
                                )

                            Image(systemName: appearance.icon)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(appearance.foreground.opacity(0.92))
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text(focus.actionLabel)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(appearance.foreground)
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(appearance.background)
                            .frame(height: 1)
                        Text(appearance.supportingCopy)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(
                    LinearGradient(
                        colors: [appearance.cardTint, .white.opacity(0.96)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                )
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func queueCard(items: [MobileDashboardPresentation.QueueItem]) -> some View {
        cardContainer(title: "待处理队列", trailing: "\(items.count) 项", tone: .softAccent) {
            VStack(spacing: 10) {
                ForEach(items) { item in
                    let appearance = statusAppearance(for: item.statusLabel)

                    NavigationLink(value: item.id) {
                        HStack(alignment: .top, spacing: 12) {
                            RoundedRectangle(cornerRadius: 999, style: .continuous)
                                .fill(appearance.foreground.opacity(0.88))
                                .frame(width: 5)

                            VStack(alignment: .leading, spacing: 6) {
                                Text(item.title)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text(item.subtitle)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Text(item.actionLabel)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(appearance.foreground)
                                    .lineLimit(2)
                            }
                            Spacer(minLength: 8)

                            VStack(alignment: .trailing, spacing: 8) {
                                Label(appearance.label, systemImage: appearance.icon)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(appearance.foreground)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(appearance.background, in: Capsule())
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(appearance.foreground.opacity(0.12), lineWidth: 1)
                                    )

                                Text(appearance.supportingCopy)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .frame(maxWidth: 92, alignment: .trailing)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(14)
                        .background(
                            LinearGradient(
                                colors: [appearance.cardTint, .white.opacity(0.96)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func resumeCard(bootstrap: MobileBootstrapResponse) -> some View {
        cardContainer(title: "继续上次工作", trailing: appState.lastCommandStatusTitle, tone: .elevated) {
            VStack(alignment: .leading, spacing: 8) {
                Text(appState.resumeSessionTitle)
                    .font(.headline)
                Text(appState.lastCommandStatusSubtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if let selectedSessionID = appState.selectedSessionID,
                   let session = bootstrap.dashboard.sessions.first(where: { $0.id == selectedSessionID }) {
                    NavigationLink(value: session.id) {
                        Text("打开上次会话")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.blue)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func connectionCard(bootstrap: MobileBootstrapResponse) -> some View {
        cardContainer(title: "连接状态", trailing: bootstrap.device.workspaceName, tone: .neutral) {
            VStack(alignment: .leading, spacing: 10) {
                connectionRow(label: "工作区", value: bootstrap.workspace.name)
                connectionRow(label: "Mac", value: bootstrap.device.workspaceName)
                connectionRow(label: "手机地址", value: bootstrap.transport.phoneAccessURL ?? bootstrap.transport.baseURL)
            }
        }
    }

    @ViewBuilder
    private func sessionListCard(sessions: [SessionSummary]) -> some View {
        let visibleSessions = Array(sessions.prefix(isSessionListExpanded ? sessions.count : collapsedSessionCount))

        cardContainer(
            title: "会话列表",
            trailing: isSessionListExpanded ? "已展开" : "前 \(min(collapsedSessionCount, sessions.count)) 项",
            tone: .neutral
        ) {
            VStack(spacing: 10) {
                ForEach(visibleSessions) { session in
                    NavigationLink(value: session.id) {
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(session.title)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text(session.cwd ?? session.model ?? "暂无上下文")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 8)
                            Text(displayStatus(for: session))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(statusColor(for: session))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(statusColor(for: session).opacity(0.12), in: Capsule())
                        }
                        .padding(14)
                        .background(.white.opacity(0.74), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                if sessions.count > collapsedSessionCount {
                    Button(isSessionListExpanded ? "收起会话列表" : "展开全部会话") {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isSessionListExpanded.toggle()
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
                }
            }
        }
    }

    @ViewBuilder
    private func cardContainer<Content: View>(title: String, trailing: String? = nil, tone: DashboardCardTone = .neutral, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline.weight(.semibold))
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.white.opacity(0.6), in: Capsule())
                }
            }

            content()
        }
        .padding(18)
        .background(cardBackground(for: tone), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(cardBorder(for: tone), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 20, x: 0, y: 12)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func statusCard(title: String, subtitle: String, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(tone)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(tone.opacity(0.12), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func connectionRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .textSelection(.enabled)
        }
    }

    private func cardBackground(for tone: DashboardCardTone) -> LinearGradient {
        switch tone {
        case .neutral:
            return LinearGradient(
                colors: [Color(.secondarySystemGroupedBackground), Color.white.opacity(0.92)],
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
        case .spotlight:
            return LinearGradient(
                colors: [Color(red: 0.95, green: 0.98, blue: 1.0), Color(red: 0.98, green: 0.99, blue: 1.0)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private func cardBorder(for tone: DashboardCardTone) -> Color {
        switch tone {
        case .neutral:
            return Color.black.opacity(0.05)
        case .elevated:
            return Color(red: 0.78, green: 0.84, blue: 0.96).opacity(0.45)
        case .accent:
            return Color(red: 0.39, green: 0.58, blue: 0.94).opacity(0.22)
        case .softAccent:
            return Color(red: 0.31, green: 0.69, blue: 0.72).opacity(0.18)
        case .spotlight:
            return Color(red: 0.33, green: 0.50, blue: 0.92).opacity(0.18)
        }
    }

    private func statusAppearance(for label: String) -> DashboardStatusAppearance {
        switch label {
        case "等待输入":
            return DashboardStatusAppearance(
                label: "等待输入",
                icon: "ellipsis.message.fill",
                foreground: Color(red: 0.05, green: 0.50, blue: 0.53),
                background: Color(red: 0.07, green: 0.62, blue: 0.66).opacity(0.12),
                cardTint: Color(red: 0.90, green: 0.98, blue: 0.98),
                supportingCopy: "这类会话最适合马上接管，补一条提示词就能继续推进。"
            )
        case "异常":
            return DashboardStatusAppearance(
                label: "异常",
                icon: "exclamationmark.triangle.fill",
                foreground: .red,
                background: Color.red.opacity(0.12),
                cardTint: Color(red: 1.0, green: 0.95, blue: 0.95),
                supportingCopy: "最近命令或流程出了问题，建议优先打开查看回执和事件。"
            )
        case "执行中":
            return DashboardStatusAppearance(
                label: "执行中",
                icon: "waveform.path.ecg",
                foreground: Color(red: 0.12, green: 0.30, blue: 0.82),
                background: Color(red: 0.12, green: 0.30, blue: 0.82).opacity(0.12),
                cardTint: Color(red: 0.93, green: 0.96, blue: 1.0),
                supportingCopy: "当前任务仍在推进，更适合观察进度或按需中断。"
            )
        case "排队中":
            return DashboardStatusAppearance(
                label: "排队中",
                icon: "clock.fill",
                foreground: .orange,
                background: Color.orange.opacity(0.14),
                cardTint: Color(red: 1.0, green: 0.97, blue: 0.92),
                supportingCopy: "命令已经提交但还没开始执行，适合继续观察状态变化。"
            )
        default:
            return DashboardStatusAppearance(
                label: label,
                icon: "circle.fill",
                foreground: .secondary,
                background: Color.secondary.opacity(0.12),
                cardTint: Color(.secondarySystemGroupedBackground),
                supportingCopy: "当前没有高压处理信号，可以稍后再回来看。"
            )
        }
    }

    private func displayStatus(for session: SessionSummary) -> String {
        switch session.runStatus ?? session.status {
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

    private func statusColor(for session: SessionSummary) -> Color {
        switch session.runStatus ?? session.status {
        case "waitingForInput":
            return Color(red: 0.07, green: 0.62, blue: 0.66)
        case "failed":
            return .red
        case "running", "active":
            return Color(red: 0.12, green: 0.30, blue: 0.82)
        case "queued":
            return .orange
        default:
            return .secondary
        }
    }
}

private struct DashboardStatusAppearance {
    let label: String
    let icon: String
    let foreground: Color
    let background: Color
    let cardTint: Color
    let supportingCopy: String
}
