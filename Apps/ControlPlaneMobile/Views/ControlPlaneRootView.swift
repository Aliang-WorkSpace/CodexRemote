import SwiftUI
#if canImport(ControlPlaneMobileCore)
import ControlPlaneMobileCore
#endif

struct ControlPlaneRootView: View {
    let appState: MobileAppState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()

            Group {
                if appState.isConnected, horizontalSizeClass == .regular {
                    tabletConnectedView
                } else {
                    NavigationStack {
                        if appState.isConnected {
                            DashboardView(appState: appState)
                        } else {
                            PairingView(appState: appState)
                        }
                    }
                }
            }
            .opacity(appState.hasAttemptedRestore ? 1 : 0.01)
            .sheet(isPresented: Binding(
                get: { appState.isHelpPresented },
                set: { newValue in
                    if newValue {
                        appState.presentHelp()
                    } else {
                        appState.dismissHelp()
                    }
                }
            )) {
                HelpCenterView(appState: appState)
            }
            .fullScreenCover(isPresented: Binding(
                get: { appState.isOnboardingPresented },
                set: { newValue in
                    if newValue {
                        appState.presentOnboarding()
                    } else {
                        appState.dismissOnboarding(markSeen: false)
                    }
                }
            )) {
                MacSetupOnboardingView(appState: appState)
            }
            .onChange(of: appState.hasAttemptedRestore) { _, hasAttempted in
                guard hasAttempted else {
                    return
                }

                if appState.shouldAutoPresentOnboarding {
                    appState.presentOnboarding()
                } else if appState.shouldAutoPresentHelp {
                    appState.presentHelp()
                }
            }
            .task(id: appState.isConnected) {
                guard appState.isConnected,
                      horizontalSizeClass == .regular,
                      appState.selectedSessionID == nil,
                      let firstSessionID = preferredSessionID else {
                    return
                }

                await appState.openSession(firstSessionID)
            }

            if !appState.hasAttemptedRestore {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("正在启动 Codex Remote")
                        .font(.headline)
                    Text("正在恢复上次连接并准备首屏内容。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(24)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                .shadow(color: .black.opacity(0.08), radius: 20, y: 10)
            }
        }
    }

    private var preferredSessionID: String? {
        let sessions = appState.sessions
        return sessions.first(where: { ($0.runStatus ?? "") == "waitingForInput" })?.id
            ?? sessions.first(where: { ($0.runStatus ?? "") == "failed" })?.id
            ?? sessions.first?.id
    }

    @ViewBuilder
    private var tabletConnectedView: some View {
        NavigationSplitView {
            TabletSidebarView(appState: appState)
                .navigationTitle("Codex Remote")
        } detail: {
            if let selectedSessionID = appState.selectedSessionID {
                SessionDetailView(appState: appState, sessionID: selectedSessionID)
            } else {
                TabletOverviewPlaceholderView(appState: appState)
            }
        }
    }
}

private struct MacSetupOnboardingView: View {
    let appState: MobileAppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    onboardingHero
                    productModelCard
                    macSetupCard
                    nextStepCard
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("稍后") {
                        appState.dismissOnboarding(markSeen: true)
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    Button("我已经在 Mac 上准备好了") {
                        appState.dismissOnboarding(markSeen: true, presentHelpAfterward: true)
                    }
                    .buttonStyle(.borderedProminent)

                    Button("先看详细帮助") {
                        appState.dismissOnboarding(markSeen: true, presentHelpAfterward: true)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 8)
                .background(.ultraThinMaterial)
            }
        }
    }

    private var onboardingHero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("先准备你的 Mac")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            Text("Codex Remote 是移动副控端。真正运行 Codex 的是你的 Mac，所以第一次使用前，需要先把 Mac 主控端准备好。")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.84))

            Label("Mac 主控 · iPhone / iPad 副控", systemImage: "macbook.and.iphone")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.white.opacity(0.14), in: Capsule())
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.21, blue: 0.53),
                    Color(red: 0.16, green: 0.37, blue: 0.85),
                    Color(red: 0.11, green: 0.56, blue: 0.74)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
    }

    private var productModelCard: some View {
        onboardingCard(title: "先理解这个产品怎么工作", systemImage: "point.3.connected.trianglepath.dotted") {
            onboardingStep(index: 1, title: "Codex 运行在 Mac 上", copy: "工作区、会话、命令执行都在你的 Mac 上完成。")
            onboardingStep(index: 2, title: "iPhone 只是移动副控端", copy: "手机负责看总览、接管等待输入、重试失败任务，不直接承载执行上下文。")
            onboardingStep(index: 3, title: "先有主控，副控才能连接", copy: "如果 Mac 端还没安装或没启动，iPhone 端就不会有可连接目标。")
        }
    }

    private var macSetupCard: some View {
        onboardingCard(title: "在 Mac 上先做这 3 步", systemImage: "desktopcomputer") {
            onboardingStep(index: 1, title: "安装 Codex Remote for Mac", copy: "后续最理想的方式是直接在 Mac App Store 搜索并安装 `Codex Remote`。")
            onboardingStep(index: 2, title: "启动桌面主控或后台服务", copy: "第一次至少要让 Mac 主控端跑起来，这样局域网里才会出现可接入目标。")
            onboardingStep(index: 3, title: "让 Mac 和 iPhone 保持同一 Wi‑Fi", copy: "当前版本主要走局域网直连；准备好后，回到手机点击“直接接入这台 Mac”。")
        }
    }

    private var nextStepCard: some View {
        onboardingCard(title: "准备好之后你会看到什么", systemImage: "checkmark.circle") {
            Text("回到连接页后，优先会看到：已信任设备、附近自动发现到的 Mac、二维码/剪贴板快速接入。手动输入地址只是兜底。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func onboardingCard<Content: View>(title: String, systemImage: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            content()
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    @ViewBuilder
    private func onboardingStep(index: Int, title: String, copy: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(index)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(
                    LinearGradient(
                        colors: [Color.blue, Color.teal],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: Circle()
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(copy)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct TabletSidebarView: View {
    let appState: MobileAppState

    var body: some View {
        List(selection: selectionBinding) {
            Section {
                tabletOverviewCard
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                    .listRowBackground(Color.clear)
            }

            Section("优先接管") {
                ForEach(appState.sessions) { session in
                    Button {
                        Task { await appState.openSession(session.id) }
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Circle()
                                .fill(statusColor(for: session))
                                .frame(width: 10, height: 10)
                                .padding(.top, 6)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(session.title)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                    .lineLimit(2)

                                Text(session.cwd ?? session.model ?? "暂无上下文")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)

                                Text(displayStatus(for: session))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(statusColor(for: session))
                            }

                            Spacer(minLength: 8)

                            if appState.selectedSessionID == session.id {
                                Image(systemName: "sidebar.right")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.blue)
                            }
                        }
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .tag(session.id)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await appState.refreshHome()
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
    }

    private var selectionBinding: Binding<String?> {
        Binding(
            get: { appState.selectedSessionID },
            set: { newValue in
                guard let newValue else { return }
                Task { await appState.openSession(newValue) }
            }
        )
    }

    @ViewBuilder
    private var tabletOverviewCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("iPad 控制台")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.82))

            Text("总览与接管")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            Text("左侧常驻会话列表和总览，右侧常驻详情工作台，适合在 iPad 上持续盯住任务并快速接管。")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.82))

            HStack(spacing: 10) {
                metricPill(title: "会话", value: "\(appState.sessions.count)")
                metricPill(title: "运行中", value: "\(appState.activeSessions.count)")
            }
        }
        .padding(18)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.21, blue: 0.53),
                    Color(red: 0.16, green: 0.37, blue: 0.85),
                    Color(red: 0.11, green: 0.56, blue: 0.74)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous)
        )
    }

    @ViewBuilder
    private func metricPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
        case "completed":
            return "已完成"
        default:
            return "空闲"
        }
    }

    private func statusColor(for session: SessionSummary) -> Color {
        switch session.runStatus ?? session.status {
        case "waitingForInput":
            return Color(red: 0.05, green: 0.50, blue: 0.53)
        case "failed":
            return .red
        case "running", "active":
            return Color(red: 0.12, green: 0.30, blue: 0.82)
        case "queued":
            return .orange
        case "completed":
            return Color(red: 0.08, green: 0.47, blue: 0.43)
        default:
            return .secondary
        }
    }
}

private struct TabletOverviewPlaceholderView: View {
    let appState: MobileAppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("选择一个会话开始接管")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                    Text("iPad 版会把接管列表固定在左侧，右边保留当前会话的完整工作台。先从左边选一条需要处理的会话，详情会直接在这里展开。")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 14) {
                    overviewStat(title: "会话数", value: "\(appState.sessions.count)")
                    overviewStat(title: "运行中", value: "\(appState.activeSessions.count)")
                    overviewStat(title: "已连接", value: appState.isConnected ? "是" : "否")
                }
            }
            .padding(28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private func overviewStat(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.bold())
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
